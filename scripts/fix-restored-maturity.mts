/**
 * Repairs the capture time on the posts put back by restore-dropped.mts.
 *
 * That script inserted metrics_refreshed_at as the post's own created_at, which
 * says the like count was read the instant the post appeared. Maturity is defined
 * as metrics read at least 24 hours after publication, so all 73 rows failed it
 * permanently and were excluded from every statistic. Client & brand work showed
 * 38 posts in review and one in the category table.
 *
 * The honest replacement is the enrichment timestamp. These like counts came from
 * the sync that originally collected the posts, and enrichment ran against them
 * afterwards, so that is a moment when the numbers were demonstrably on hand.
 * fetched_at would be wrong in the other direction: it holds the time of the
 * restore, and nothing was read from X then.
 */
import { getDb } from "../lib/db";

const sql = getDb();

const before = await sql<Array<{ broken: string }>>`
  select count(*) as broken from posts where metrics_refreshed_at = created_at
`;
console.log("posts with a capture time equal to their publication time:", before[0].broken);

const fixed = await sql<Array<{ id: string }>>`
  update posts p
  set metrics_refreshed_at = pi.created_at
  from post_insights pi
  where pi.post_id = p.id
    and p.metrics_refreshed_at = p.created_at
    and pi.created_at > p.created_at
  returning p.id
`;
console.log("repaired:", fixed.length);

const [after] = await sql<Array<{ broken: string; mature: string }>>`
  select
    (select count(*) from posts where metrics_refreshed_at = created_at) as broken,
    (select count(*) from posts where metrics_refreshed_at >= created_at + interval '24 hours') as mature
`;
console.log("still broken:", after.broken, " mature overall:", after.mature);

const counts = await sql<Array<{ category: string; total: string; counted: string }>>`
  select cat as category,
    count(*) as total,
    count(*) filter (
      where p.metrics_refreshed_at >= p.created_at + interval '24 hours'
        and c.followers_count >= 150
    ) as counted
  from post_insights pi
  join posts p on p.id = pi.post_id
  join creators c on c.id = p.creator_id
  cross join lateral unnest(pi.categories) as cat
  where c.status in ('approved', 'guest')
  group by cat
  order by count(*) desc
`;
console.table(
  counts.map((row) => ({
    category: row.category,
    posts: Number(row.total),
    inStatistics: Number(row.counted)
  }))
);

await sql.end();
