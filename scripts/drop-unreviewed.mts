/**
 * Throws away every post nobody has reviewed, and blocks it from coming back.
 *
 * The corpus is meant to contain only posts the owner has personally judged.
 * Anything still carrying the machine's guess is noise in a leaderboard they are
 * using to make decisions, and leaving it in place while adding vetted posts
 * alongside would mix the two permanently.
 *
 * Blocking rather than only deleting is what makes this stick. The sync reads
 * each builder's timeline from the newest post it already has, so deleting a
 * recent post just invites the next cycle to collect it again — and the owner
 * asked specifically that thrown-away posts not reappear, and not be filed under
 * Deleted either, which is a category rather than a removal.
 *
 * Every deleted row is written to backups/ first. This is irreversible against a
 * corpus that took hundreds of hand judgements to build, so the restore path has
 * to exist even if it is never used.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getDb } from "../lib/db";

const sql = getDb();

const doomed = await sql<
  Array<{
    id: string;
    creator_id: string;
    username: string;
    text: string;
    url: string;
    created_at: string;
    like_count: number;
    repost_count: number;
    reply_count: number;
    added_by_hand: boolean;
    insights: unknown;
  }>
>`
  select
    p.id, p.creator_id, c.username, p.text, p.url, p.created_at,
    p.like_count, p.repost_count, p.reply_count, p.added_by_hand,
    to_jsonb(pi) - 'post_id' as insights
  from posts p
  join creators c on c.id = p.creator_id
  left join post_insights pi on pi.post_id = p.id
  where not coalesce(pi.reviewed, false)
  order by p.like_count desc
`;

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `backups/dropped-unreviewed-${stamp}.json`;
writeFileSync(backup, JSON.stringify(doomed, null, 2));
console.log(`backed up ${doomed.length} posts -> ${backup}`);

const ids = doomed.map((post) => post.id);

await sql.begin(async (tx) => {
  await tx`
    insert into blocked_posts (post_id, url, username, reason)
    select p.id, p.url, c.username, 'never reviewed'
    from posts p join creators c on c.id = p.creator_id
    where p.id = any(${ids})
    on conflict (post_id) do nothing
  `;
  // post_insights cascades from posts, so one delete is enough.
  await tx`delete from posts where id = any(${ids})`;
});

const [remaining] = await sql<Array<{ posts: string; reviewed: string; unreviewed: string }>>`
  select
    (select count(*) from posts) as posts,
    (select count(*) from post_insights where reviewed) as reviewed,
    (select count(*) from post_insights where not reviewed) as unreviewed
`;
console.log("remaining:", remaining);

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

const [blocked] = await sql<Array<{ n: string }>>`select count(*) as n from blocked_posts`;
console.log("blocked_posts now:", blocked.n);

await sql.end();
