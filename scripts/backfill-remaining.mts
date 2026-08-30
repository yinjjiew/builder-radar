/**
 * Reads reposts and replies from X for the hand-added posts the local cache
 * cannot cover.
 *
 * The raw-response cache only exists for searches run after it was added, so the
 * earlier batch of imports has no record to correct from. A lookup by id is the
 * cheapest call available -- one request covers a hundred posts -- and without it
 * the repost rate stays wrong for those rows.
 */
import { getDb } from "../lib/db";

const sql = getDb();

const rows = await sql<Array<{ id: string }>>`
  select id from posts where added_by_hand and repost_count = 0 and reply_count = 0
`;
console.log("posts to look up:", rows.length);

let corrected = 0;

for (let index = 0; index < rows.length; index += 100) {
  const chunk = rows.slice(index, index + 100).map((row) => row.id);
  const response = await fetch(
    `https://api.x.com/2/tweets?ids=${chunk.join(",")}&tweet.fields=public_metrics`,
    { headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` } }
  );

  if (!response.ok) {
    console.log(`ERROR ${response.status}: ${(await response.text()).slice(0, 160)}`);
    break;
  }

  const json = (await response.json()) as {
    data?: Array<{
      id: string;
      public_metrics: { retweet_count: number; reply_count: number; like_count: number };
    }>;
  };

  for (const post of json.data ?? []) {
    const m = post.public_metrics;
    if (m.retweet_count === 0 && m.reply_count === 0) continue;
    await sql`
      update posts
      set repost_count = ${m.retweet_count},
          reply_count = ${m.reply_count},
          like_count = ${m.like_count},
          metrics_refreshed_at = now()
      where id = ${post.id}
    `;
    corrected += 1;
  }
}

console.log("corrected from the API:", corrected);

const [totals] = await sql<Array<{ reposts: string; replies: string; zeroed: string }>>`
  select
    count(*) filter (where added_by_hand and repost_count > 0) as reposts,
    count(*) filter (where added_by_hand and reply_count > 0) as replies,
    count(*) filter (where added_by_hand and repost_count = 0 and reply_count = 0) as zeroed
  from posts
`;
console.log(totals);

await sql.end();
