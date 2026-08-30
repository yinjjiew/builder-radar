/**
 * Stores harvested posts that have already been read and categorised by hand.
 *
 * Separate from `addPostByLink` because that route re-fetches the post from X,
 * and the harvest already paid for the same data: the post, its metrics and the
 * author's follower count all come back in the search response. Re-reading them
 * one link at a time would spend credits twice for nothing.
 *
 * Every row lands as a guest author and unreviewed. Guest, because a post picked
 * up in a search does not earn its writer a place among the ranked builders;
 * unreviewed, because the category here is a judgement made from 150 characters
 * of text and deserves a second look before it is trusted.
 *
 * Usage: import-candidates.mts <decisions.json>, where the file is
 * [{ "id": "1234", "category": "game" }, ...] and each id must be present in one
 * of the /tmp/cand-*.json harvest files.
 */
import { readdirSync, readFileSync } from "node:fs";
import { getDb } from "../lib/db";
import { PRODUCT_CATEGORIES, type ProductCategory } from "../lib/mission";

/** Mirrors the harvest output. Not imported from it: that file runs on import. */
type Candidate = {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  url: string;
  username: string;
  name: string;
  description: string;
  followers: number;
  profileImageUrl: string | null;
  verified: boolean;
};

type Decision = { id: string; category: ProductCategory };

const [decisionsPath] = process.argv.slice(2);
if (!decisionsPath) {
  console.error("usage: import-candidates.mts <decisions.json>");
  process.exit(1);
}

const pool = new Map<string, Candidate>();
for (const name of readdirSync("/tmp")) {
  if (!name.startsWith("cand-") || !name.endsWith(".json")) continue;
  for (const candidate of JSON.parse(readFileSync(`/tmp/${name}`, "utf8")) as Candidate[]) {
    pool.set(candidate.id, candidate);
  }
}

const decisions = JSON.parse(readFileSync(decisionsPath, "utf8")) as Decision[];
const sql = getDb();

let stored = 0;
const skipped: string[] = [];

for (const decision of decisions) {
  const candidate = pool.get(decision.id);
  if (!candidate) {
    skipped.push(`${decision.id}: not in any harvest file`);
    continue;
  }
  if (!PRODUCT_CATEGORIES.includes(decision.category)) {
    skipped.push(`${decision.id}: unknown category ${decision.category}`);
    continue;
  }

  const [blocked] = await sql<Array<{ post_id: string }>>`
    select post_id from blocked_posts where post_id = ${decision.id}
  `;
  if (blocked) {
    skipped.push(`${decision.id}: on the blocklist`);
    continue;
  }

  await sql.begin(async (tx) => {
    const [creator] = await tx<Array<{ id: string; status: string }>>`
      insert into creators (
        username, name, description, profile_image_url,
        followers_count, verified, status, added_by_hand, last_synced_at
      ) values (
        ${candidate.username}, ${candidate.name}, ${candidate.description},
        ${candidate.profileImageUrl}, ${candidate.followers}, ${candidate.verified},
        'guest', true, now()
      )
      on conflict (username) do update set
        followers_count = coalesce(excluded.followers_count, creators.followers_count),
        name = excluded.name,
        updated_at = now()
      returning id, status
    `;

    if (!creator || creator.status === "removed") {
      skipped.push(`${decision.id}: @${candidate.username} is removed from the directory`);
      return;
    }

    await tx`
      insert into posts (
        id, creator_id, text, url, created_at,
        like_count, repost_count, reply_count, fetched_at, metrics_refreshed_at, added_by_hand
      ) values (
        ${candidate.id}, ${creator.id}, ${candidate.text}, ${candidate.url},
        ${candidate.createdAt}, ${candidate.likeCount}, 0, 0, now(), now(), true
      )
      on conflict (id) do nothing
    `;

    await tx`
      -- product_category stays null: it records what the model answered, and no
      -- model has seen this post. The category here was read off the text by hand.
      insert into post_insights (post_id, product_category, categories, reviewed, prompt_version)
      values (${candidate.id}, null, ${tx.array([decision.category])}, false, 0)
      on conflict (post_id) do nothing
    `;

    stored += 1;
  });
}

console.log(`stored ${stored} of ${decisions.length}`);
for (const line of skipped) console.log(`  skipped ${line}`);

const counts = await sql<Array<{ key: string; n: string }>>`
  select cat as key, count(*) as n
  from post_insights pi
  join posts p on p.id = pi.post_id
  join creators c on c.id = p.creator_id
  cross join lateral unnest(pi.categories) as cat
  where c.status in ('approved', 'guest')
  group by cat order by count(*) desc
`;
console.table(counts);

await sql.end();
