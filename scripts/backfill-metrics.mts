/**
 * Fills in the repost and reply counts that import-candidates.mts wrote as zero.
 *
 * The importer only carried the like count across, because that is all the
 * candidate records held. Zero is not a missing value in the database though: the
 * repost rate reported per category is an average over these columns, so 54 posts
 * claiming no reposts pulled every category they touched downwards.
 *
 * The real numbers were in the API responses all along and are on disk in
 * harvest-raw/, so this costs nothing to correct.
 */
import { readFileSync } from "node:fs";
import { getDb } from "../lib/db";

type Cached = { reposts: number; replies: number; likes: number };

const metrics = new Map<string, Cached>();
for (const line of readFileSync("harvest-raw/responses.jsonl", "utf8").trim().split("\n")) {
  const entry = JSON.parse(line) as {
    response: {
      data?: Array<{
        id: string;
        public_metrics?: { retweet_count: number; reply_count: number; like_count: number };
      }>;
    };
  };
  for (const post of entry.response.data ?? []) {
    if (!post.public_metrics) continue;
    metrics.set(post.id, {
      reposts: post.public_metrics.retweet_count,
      replies: post.public_metrics.reply_count,
      likes: post.public_metrics.like_count
    });
  }
}
console.log(`${metrics.size} posts in the local cache`);

const sql = getDb();

const zeroed = await sql<Array<{ id: string; like_count: number }>>`
  select id, like_count from posts
  where added_by_hand and repost_count = 0 and reply_count = 0
`;
console.log(`${zeroed.length} hand-added posts carrying zero reposts and zero replies`);

let updated = 0;
let missing = 0;

await sql.begin(async (tx) => {
  for (const post of zeroed) {
    const cached = metrics.get(post.id);
    if (!cached) {
      missing += 1;
      continue;
    }
    // A post can genuinely have no reposts and no replies. Only write when the
    // cache actually disagrees with what is stored.
    if (cached.reposts === 0 && cached.replies === 0) continue;
    await tx`
      update posts
      set repost_count = ${cached.reposts}, reply_count = ${cached.replies}
      where id = ${post.id}
    `;
    updated += 1;
  }
});

console.log(`corrected ${updated}, not in the cache ${missing}`);

const [totals] = await sql<Array<{ reposts: string; replies: string }>>`
  select
    count(*) filter (where added_by_hand and repost_count > 0) as reposts,
    count(*) filter (where added_by_hand and reply_count > 0) as replies
  from posts
`;
console.log("hand-added posts now with reposts:", totals.reposts, " with replies:", totals.replies);

await sql.end();
