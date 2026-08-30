/**
 * Puts back posts from a backup written by drop-unreviewed.mts.
 *
 * Takes a category, because the reason for restoring is always that one bucket
 * was emptied by a rule that was right about the rest. Client & brand work went
 * from 74 posts to 1: the owner had reviewed every other tab and never opened
 * that one, so "throw away what nobody reviewed" read as "throw away client work"
 * — a true statement about the flag and the wrong answer about the corpus.
 *
 * Restored rows keep reviewed = false, which is the honest value. The category on
 * them is the model's guess and nobody has checked it, so they come back into the
 * review queue rather than arriving with a judgement they never received.
 */
import { readdirSync, readFileSync } from "node:fs";
import { getDb } from "../lib/db";

type Row = {
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
  insights: Record<string, unknown> | null;
};

const [category, file] = process.argv.slice(2);
if (!category) {
  console.error("usage: restore-dropped.mts <category> [backup.json]");
  process.exit(1);
}

const path =
  file ??
  `backups/${readdirSync("backups")
    .filter((name) => name.startsWith("dropped-unreviewed"))
    .sort()
    .pop()}`;

const rows = (JSON.parse(readFileSync(path, "utf8")) as Row[]).filter((row) =>
  ((row.insights?.categories as string[] | undefined) ?? []).includes(category)
);

console.log(`${path}: ${rows.length} posts filed as ${category}`);
if (!rows.length) process.exit(0);

const sql = getDb();

await sql.begin(async (tx) => {
  for (const row of rows) {
    await tx`
      insert into posts (
        id, creator_id, text, url, created_at,
        like_count, repost_count, reply_count, added_by_hand,
        fetched_at, metrics_refreshed_at
      ) values (
        ${row.id}, ${row.creator_id}, ${row.text}, ${row.url}, ${row.created_at},
        ${row.like_count}, ${row.repost_count}, ${row.reply_count}, ${row.added_by_hand},
        now(), ${row.created_at}
      )
      on conflict (id) do nothing
    `;

    if (row.insights) {
      const i = row.insights;
      await tx`
        insert into post_insights (
          post_id, themes, artifact, product_category, categories, intent, audience,
          nocode_signal, note, model, prompt_version, reviewed, reviewed_at,
          categories_edited, categories_edited_at, created_at, updated_at
        ) values (
          ${row.id},
          ${tx.array((i.themes as string[]) ?? [])},
          ${(i.artifact as string) ?? null},
          ${(i.product_category as string) ?? null},
          ${tx.array((i.categories as string[]) ?? [])},
          ${(i.intent as string) ?? null},
          ${(i.audience as string) ?? null},
          ${(i.nocode_signal as number) ?? null},
          ${(i.note as string) ?? null},
          ${(i.model as string) ?? null},
          ${(i.prompt_version as number) ?? 0},
          ${Boolean(i.reviewed)},
          ${(i.reviewed_at as string) ?? null},
          ${Boolean(i.categories_edited)},
          ${(i.categories_edited_at as string) ?? null},
          ${(i.created_at as string) ?? null},
          ${(i.updated_at as string) ?? null}
        )
        on conflict (post_id) do nothing
      `;
    }
  }

  // The blocklist is what stops the sync collecting them again, so a restore that
  // left it in place would work until the next cycle and then look like a bug.
  await tx`delete from blocked_posts where post_id = any(${rows.map((row) => row.id)})`;
});

const [totals] = await sql<Array<{ posts: string; reviewed: string; unreviewed: string; blocked: string }>>`
  select
    (select count(*) from posts) as posts,
    (select count(*) from post_insights where reviewed) as reviewed,
    (select count(*) from post_insights where not reviewed) as unreviewed,
    (select count(*) from blocked_posts) as blocked
`;
console.log("now:", totals);

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
