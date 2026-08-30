/**
 * Re-derives each builder's work tags from the categories on their own posts.
 *
 * The owner has now classified the whole corpus by hand, so the categories on a
 * builder's posts are their judgement rather than a model's, and they are better
 * evidence of what that person makes than the tags set earlier from reading
 * profiles.
 *
 * Evidence, though, not instruction. Deriving a tag from one post is how @XorDev,
 * who writes fragment shaders, would end up filed under whatever single post
 * happened to be classified first, and @bruno_simon has exactly one classified
 * post — a talk — against a body of 3D work. So a hand-set tag is only overturned
 * by at least THRESHOLD classified posts. Below that the existing tag stands and
 * the builder is reported as thin, because the honest answer is that the corpus
 * cannot yet speak for them.
 *
 * The one exception is a builder with no tags at all. There, any evidence beats
 * the empty set, so a single post is allowed to fill it.
 *
 * Nothing is deleted. Previous tags are written to backups/ first, since these
 * were partly set by hand and the whole point of the exercise is to improve them,
 * not to lose them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getDb } from "../lib/db";
import { MAX_WORK_KINDS, WORK_KIND_LABELS } from "../lib/mission";

/** Classified posts needed before the corpus may overturn an existing tag. */
const THRESHOLD = 3;
/** A second tag has to describe a real part of the output, not one stray post. */
const SECOND_TAG_MIN_POSTS = 2;
const SECOND_TAG_MIN_SHARE = 0.25;

const sql = getDb();

const creators = await sql<
  Array<{ id: string; username: string; work_kinds: string[] | null; followers_count: number }>
>`
  select id, username, work_kinds, coalesce(followers_count, 0) as followers_count
  from creators
  where status = 'approved'
  order by followers_count desc
`;

/**
 * Counted per distinct post, not per category tag. A post may carry two
 * categories, and summing the tags inflates the evidence: @wawasensei has two
 * classified posts carrying three tags between them, which cleared a threshold of
 * three and let two posts overturn a stated tag.
 */
const totals = await sql<Array<{ creator_id: string; posts: number }>>`
  select p.creator_id, count(distinct p.id)::int as posts
  from posts p
  join post_insights pi on pi.post_id = p.id
  where p.creator_id = any(${creators.map((c) => c.id)})
    and coalesce(array_length(pi.categories, 1), 0) > 0
  group by p.creator_id
`;
const postsByCreator = new Map(totals.map((row) => [row.creator_id, row.posts]));

const distribution = await sql<Array<{ creator_id: string; category: string; posts: number }>>`
  select p.creator_id, cat as category, count(*)::int as posts
  from posts p
  join post_insights pi on pi.post_id = p.id
  cross join lateral unnest(pi.categories) as cat
  where p.creator_id = any(${creators.map((c) => c.id)})
  group by p.creator_id, cat
`;

const byCreator = new Map<string, Array<{ category: string; posts: number }>>();
for (const row of distribution) {
  const list = byCreator.get(row.creator_id) ?? [];
  list.push({ category: row.category, posts: row.posts });
  byCreator.set(row.creator_id, list);
}

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `backups/work-kinds-${stamp}.json`;
writeFileSync(
  backup,
  JSON.stringify(
    creators.map((c) => ({ username: c.username, work_kinds: c.work_kinds })),
    null,
    2
  )
);
console.log(`previous tags saved to ${backup}\n`);

type Outcome = "changed" | "confirmed" | "kept (thin evidence)" | "kept (no classified posts)";

const report: Array<{
  username: string;
  before: string;
  after: string;
  evidence: string;
  outcome: Outcome;
}> = [];

const updates: Array<{ id: string; kinds: string[] }> = [];

for (const creator of creators) {
  const counts = (byCreator.get(creator.id) ?? []).sort(
    (a, b) => b.posts - a.posts || a.category.localeCompare(b.category)
  );
  const before = creator.work_kinds ?? [];
  const total = postsByCreator.get(creator.id) ?? 0;
  const evidence = counts.map((row) => `${row.category}:${row.posts}`).join(" ") || "none";

  if (!total) {
    report.push({
      username: creator.username,
      before: before.join(", ") || "—",
      after: before.join(", ") || "—",
      evidence,
      outcome: "kept (no classified posts)"
    });
    continue;
  }

  // Thin evidence may fill an empty slot but may not overturn a stated tag.
  if (total < THRESHOLD && before.length) {
    report.push({
      username: creator.username,
      before: before.join(", "),
      after: before.join(", "),
      evidence,
      outcome: "kept (thin evidence)"
    });
    continue;
  }

  const derived = [counts[0].category];
  const second = counts[1];
  if (
    second &&
    second.posts >= SECOND_TAG_MIN_POSTS &&
    second.posts / total >= SECOND_TAG_MIN_SHARE
  ) {
    derived.push(second.category);
  }
  const kinds = derived.slice(0, MAX_WORK_KINDS);

  const same =
    kinds.length === before.length && kinds.every((kind, index) => kind === before[index]);

  report.push({
    username: creator.username,
    before: before.join(", ") || "—",
    after: kinds.join(", "),
    evidence,
    outcome: same ? "confirmed" : "changed"
  });

  if (!same) updates.push({ id: creator.id, kinds });
}

await sql.begin(async (tx) => {
  for (const update of updates) {
    await tx`
      update creators
      set work_kinds = ${tx.array(update.kinds)}, updated_at = now()
      where id = ${update.id}
    `;
  }
});

const label = (csv: string) =>
  csv
    .split(", ")
    .map((key) => WORK_KIND_LABELS[key as keyof typeof WORK_KIND_LABELS] ?? key)
    .join(", ");

for (const outcome of [
  "changed",
  "confirmed",
  "kept (thin evidence)",
  "kept (no classified posts)"
] as Outcome[]) {
  const rows = report.filter((row) => row.outcome === outcome);
  console.log(`\n===== ${outcome} (${rows.length}) =====`);
  for (const row of rows) {
    const arrow =
      outcome === "changed" ? `${label(row.before)}  ->  ${label(row.after)}` : label(row.after);
    console.log(`@${row.username.padEnd(20)} ${arrow}`);
    console.log(`${" ".repeat(22)}posts: ${row.evidence}`);
  }
}

console.log(`\n${updates.length} of ${creators.length} builders retagged`);

await sql.end();
