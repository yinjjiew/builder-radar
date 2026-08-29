/**
 * Re-tags the whole corpus under the current prompt version, in as many passes as
 * it takes.
 *
 * The scheduled route stops after a few minutes because a serverless function is
 * killed at five, so a vocabulary change would otherwise take several cycles to
 * work through the roster — during which the rankings would be counting two
 * different definitions at once. Run from a terminal there is no such limit.
 */
import { getDb } from "../lib/db";
import { PROMPT_VERSION } from "../lib/insights";
import { runEnrichment } from "../lib/enrich";

const sql = getDb();

async function remaining() {
  const [row] = await sql<Array<{ stale: string }>>`
    select count(*) as stale
    from creators c
    join lateral (
      select p.id from posts p where p.creator_id = c.id
      order by p.created_at desc limit 20
    ) recent on true
    left join post_insights pi on pi.post_id = recent.id
    where c.status in ('approved', 'guest')
      and (pi.post_id is null or pi.prompt_version < ${PROMPT_VERSION})
  `;
  return Number(row.stale);
}

console.log(`prompt version ${PROMPT_VERSION}; ${await remaining()} posts to tag`);

for (let pass = 1; pass <= 12; pass += 1) {
  const detail = await runEnrichment();
  const left = await remaining();
  console.log(
    `pass ${pass}: ${detail.summarised} builders, ${detail.tagged} posts tagged, ` +
      `${detail.skippedForTime ?? 0} left for time, ${left} posts still stale`
  );
  if (detail.errors?.length) console.log("  errors:", JSON.stringify(detail.errors).slice(0, 400));
  if (!left) break;
  if (!detail.summarised) {
    console.log("no progress in this pass, stopping");
    break;
  }
}

const counts = await sql<Array<{ key: string; posts: string }>>`
  select cat as key, count(*) as posts
  from post_insights pi
  join posts p on p.id = pi.post_id
  join creators c on c.id = p.creator_id
  cross join lateral unnest(pi.categories) as cat
  where c.status in ('approved', 'guest')
  group by cat order by count(*) desc
`;
console.table(counts);

const [summary] = await sql<Array<Record<string, string>>>`
  select
    count(*) as tagged,
    count(*) filter (where array_length(pi.categories, 1) is null) as not_work,
    count(*) filter (where pi.categories_edited) as edited
  from post_insights pi
  join posts p on p.id = pi.post_id
  join creators c on c.id = p.creator_id
  where c.status in ('approved', 'guest')
`;
console.log(summary);

await sql.end();
