import { aiModel, hasAi } from "@/lib/ai";
import { getDb } from "@/lib/db";
import {
  ANALYSIS_WINDOW,
  PROMPT_VERSION,
  summariseCreator,
  writeStrategyBrief,
  type FocusInput,
  type PostTag
} from "@/lib/insights";
import {
  artifactLabel,
  audienceLabel,
  intentLabel,
  NOT_WORK,
  productCategoryLabel,
  themeLabel
} from "@/lib/mission";
import {
  getBreakoutPosts,
  getCategoryStats,
  getCorpusHealth,
  getCreatorFocus,
  getNocodeSplit,
  getTagStats,
  getThemeStats
} from "@/lib/stats";
import { markCyclePhase } from "@/lib/sync";

// The route allows 300s. Stopping short leaves room for the bookkeeping write;
// whatever is skipped returns next cycle, because its focus_latest_post_id still
// trails its newest post.
const CREATOR_BUDGET_MS = 220_000;
// A model call takes most of a minute, nearly all of it waiting, so several in
// flight cuts wall time sharply. Writes still happen one at a time after each
// group, which keeps the single pooled connection calm.
const CONCURRENCY = 5;
// Below this there is not enough tagged material for a brief to say anything
// honest, so the run records the shortfall rather than inventing a reading.
const MIN_TAGGED_FOR_BRIEF = 10;
// A function killed mid-run leaves its row claiming to be running. Anything older
// than this was certainly killed, so it is closed out rather than left to
// confuse the next reader.
const STALE_RUN_MINUTES = 15;
// How many past briefs stay browsable on /insights.
export const KEEP_REPORTS = 8;

type RunKind = "insights" | "brief";

async function beginRun(kind: RunKind) {
  const sql = getDb();
  await sql`
    update sync_runs
    set status = 'failed',
        detail = detail || '{"note":"abandoned; function stopped before finishing"}'::jsonb,
        finished_at = now()
    where kind = 'insights' and status = 'running'
      and started_at < now() - ${`${STALE_RUN_MINUTES} minutes`}::interval
  `;
  const [run] = await sql<{ id: string }[]>`
    insert into sync_runs (kind, status, detail)
    values ('insights', 'running', ${sql.json({ phase: kind })})
    returning id
  `;
  return run.id;
}

async function finishRun(runId: string, status: "succeeded" | "failed", detail: unknown) {
  const sql = getDb();
  await sql`
    update sync_runs set status = ${status}, detail = ${sql.json(
      detail as Parameters<typeof sql.json>[0]
    )}, finished_at = now()
    where id = ${runId}
  `;
}

type Candidate = {
  id: string;
  username: string;
  name: string;
  description: string;
  followersCount: number | null;
  newestPostId: string | null;
  focusLatestPostId: string | null;
  hasSummary: boolean;
  untagged: number;
};

async function selectCandidates(): Promise<Candidate[]> {
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    select
      c.id, c.username, c.name, c.description, c.followers_count,
      c.focus_latest_post_id,
      (c.focus_summary is not null) as has_summary,
      newest.id as newest_post_id,
      coalesce(untagged.count, 0) as untagged
    from creators c
    left join lateral (
      select p.id from posts p where p.creator_id = c.id
      order by p.created_at desc limit 1
    ) newest on true
    left join lateral (
      -- Counted inside the analysis window only: posts older than the window
      -- cannot be reached by a call, so counting them would make this builder
      -- eligible on every future run.
      select count(*) as count
      from (
        select p.id from posts p where p.creator_id = c.id
        order by p.created_at desc limit ${ANALYSIS_WINDOW}
      ) recent
      left join post_insights pi on pi.post_id = recent.id
      where pi.post_id is null or pi.prompt_version < ${PROMPT_VERSION}
    ) untagged on true
    -- Guests are included so that a post added by hand gets a product category.
    -- Without it the post would appear in the post rank but be invisible to the
    -- category ranking, which only counts tagged posts.
    where c.status in ('approved', 'guest')
    order by c.followers_count desc nulls last
  `;

  return rows
    .map((row) => ({
      id: String(row.id),
      username: String(row.username),
      name: String(row.name),
      description: String(row.description ?? ""),
      followersCount: row.followers_count === null ? null : Number(row.followers_count),
      newestPostId: row.newest_post_id ? String(row.newest_post_id) : null,
      focusLatestPostId: row.focus_latest_post_id ? String(row.focus_latest_post_id) : null,
      hasSummary: Boolean(row.has_summary),
      untagged: Number(row.untagged ?? 0)
    }))
    .filter((candidate) => {
      if (!candidate.newestPostId) return false;
      if (!candidate.hasSummary) return true;
      if (candidate.untagged > 0) return true;
      return candidate.newestPostId !== candidate.focusLatestPostId;
    });
}

async function loadPosts(creatorId: string): Promise<FocusInput["posts"]> {
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    select id, text, created_at, like_count from posts
    where creator_id = ${creatorId}
    order by created_at desc
    limit ${ANALYSIS_WINDOW}
  `;
  return rows.map((row) => ({
    id: String(row.id),
    text: String(row.text ?? ""),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    likeCount: Number(row.like_count ?? 0)
  }));
}

/**
 * The kinds of work a builder does, counted from the tags on their own posts.
 * Used only when the model declines to name any; ordered by how often each kind
 * appears so the first one is what they mostly do.
 */
function dominantKinds(posts: PostTag[]) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.productCategory === NOT_WORK) continue;
    counts.set(post.productCategory, (counts.get(post.productCategory) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kind]) => kind);
}

async function enrichCreator(candidate: Candidate) {
  const sql = getDb();
  const posts = await loadPosts(candidate.id);
  if (!posts.length) return { username: candidate.username, tagged: 0, summarised: false };

  const focus = await summariseCreator({
    username: candidate.username,
    name: candidate.name,
    description: candidate.description,
    followersCount: candidate.followersCount,
    posts
  });

  if (!focus) return { username: candidate.username, tagged: 0, summarised: false };

  const model = aiModel();
  for (const tag of focus.posts) {
    await sql`
      insert into post_insights (
        post_id, themes, artifact, product_category, intent, audience,
        nocode_signal, note, model, prompt_version
      ) values (
        ${tag.id}, ${sql.array(tag.themes)}, ${tag.artifact}, ${tag.productCategory},
        ${tag.intent}, ${tag.audience}, ${tag.nocodeSignal}, ${tag.note},
        ${model}, ${PROMPT_VERSION}
      )
      on conflict (post_id) do update set
        themes = excluded.themes,
        artifact = excluded.artifact,
        product_category = excluded.product_category,
        intent = excluded.intent,
        audience = excluded.audience,
        nocode_signal = excluded.nocode_signal,
        note = excluded.note,
        model = excluded.model,
        prompt_version = excluded.prompt_version,
        updated_at = now()
    `;
  }

  // The model occasionally returns no work kinds for someone whose posts are
  // plainly all one thing — a feed of untitled generative pieces, for instance.
  // Its own per-post judgements are already the evidence for the answer, so fall
  // back to counting them rather than leaving the directory card blank.
  const workKinds = focus.workKinds.length ? focus.workKinds : dominantKinds(focus.posts);

  await sql`
    update creators set
      focus_summary = ${focus.summary},
      focus_products = ${sql.array(focus.products)},
      focus_themes = ${sql.array(focus.themes)},
      focus_relevance = ${focus.relevance},
      focus_opportunity = ${focus.opportunity},
      work_kinds = ${sql.array(workKinds)},
      work_summary = ${focus.workSummary || null},
      focus_latest_post_id = ${candidate.newestPostId},
      focus_updated_at = now()
    where id = ${candidate.id}
  `;

  return { username: candidate.username, tagged: focus.posts.length, summarised: true };
}

/**
 * Phase one: refresh what each builder is working on and tag their recent posts.
 * Splitting this from the brief keeps both inside the function time limit, and
 * lets either be retried without redoing the other.
 */
export async function runEnrichment(cycleId: string | null = null) {
  const startedAt = Date.now();
  const runId = await beginRun("insights");
  const errors: Array<{ username: string; error: string }> = [];
  let summarised = 0;
  let tagged = 0;
  let skippedForTime = 0;

  try {
    if (!hasAi()) throw new Error("OPENAI_API_KEY is not configured");

    const candidates = await selectCandidates();

    for (let index = 0; index < candidates.length; index += CONCURRENCY) {
      if (Date.now() - startedAt > CREATOR_BUDGET_MS) {
        skippedForTime = candidates.length - index;
        break;
      }

      const group = candidates.slice(index, index + CONCURRENCY);
      // Each settles independently so one bad answer cannot take down the group.
      const settled = await Promise.allSettled(group.map((candidate) => enrichCreator(candidate)));

      settled.forEach((result, offset) => {
        if (result.status === "fulfilled") {
          if (result.value.summarised) summarised += 1;
          tagged += result.value.tagged;
        } else {
          errors.push({
            username: group[offset].username,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          });
        }
      });
    }

    const detail = {
      phase: "insights",
      candidates: candidates.length,
      summarised,
      tagged,
      skippedForTime,
      elapsedMs: Date.now() - startedAt,
      errors
    };
    await finishRun(runId, errors.length && !summarised ? "failed" : "succeeded", detail);
    await markCyclePhase(cycleId, "enriched_at", { enrich: detail });
    return detail;
  } catch (error) {
    const detail = {
      phase: "insights",
      error: error instanceof Error ? error.message : String(error),
      summarised,
      tagged,
      errors
    };
    await finishRun(runId, "failed", detail);
    throw error;
  }
}

function table(title: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return `${title}: no data yet\n`;
  const keys = Object.keys(rows[0]);
  const lines = rows.map((row) => keys.map((key) => `${key}=${row[key]}`).join("  "));
  return `${title}\n${lines.join("\n")}\n`;
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

/**
 * Renders the computed statistics as plain text for the strategy call. The model
 * sees only measured numbers, never the raw corpus, so its claims stay tied to
 * something the reader can check against the same tables on the page.
 */
export async function buildEvidence() {
  const [health, themes, artifacts, categories, intents, audiences, nocode, breakouts, creators] =
    await Promise.all([
      getCorpusHealth(),
      getThemeStats(),
      getTagStats("artifact"),
      getCategoryStats(),
      getTagStats("intent"),
      getTagStats("audience"),
      getNocodeSplit(),
      getBreakoutPosts(10),
      getCreatorFocus()
    ]);

  const dimension = (
    rows: Awaited<ReturnType<typeof getThemeStats>>,
    label: (key: string) => string
  ) =>
    rows.map((row) => ({
      name: label(row.key),
      n: row.posts,
      builders: row.creators,
      median_likes_per_1k: round(row.medianEngagement),
      median_breakout: row.medianBreakout === null ? "n/a" : round(row.medianBreakout),
      total_likes: row.totalLikes,
      posts_last_30d: row.recentPosts
    }));

  const evidence = [
    `CORPUS: ${health.creators} builders, ${health.posts} posts, ${health.maturePosts} mature (metrics read at least 24h after posting), ${health.taggedPosts} tagged, ${health.buildersWithBaseline} builders with a usable personal baseline.`,
    "",
    table("THEMES (what is being built)", dimension(themes, themeLabel)),
    table("ARTIFACT (what kind of thing shipped)", dimension(artifacts, artifactLabel)),
    table(
      "PRODUCT CATEGORY (ranked by average likes per 1k; avg far above median means one hit is carrying it)",
      categories.map((row) => ({
        category: productCategoryLabel(row.key),
        n: row.posts,
        builders: row.creators,
        avg_likes: round(row.avgLikes, 0),
        median_likes: round(row.medianLikes, 0),
        avg_likes_per_1k: round(row.avgEngagement),
        median_likes_per_1k: round(row.medianEngagement),
        median_breakout: row.medianBreakout === null ? "n/a" : round(row.medianBreakout),
        share_of_corpus: `${round(row.share * 100, 1)}%`,
        best: row.examples[0]
          ? `@${row.examples[0].username}: ${(row.examples[0].note ?? row.examples[0].text)
              .replace(/\s+/g, " ")
              .slice(0, 90)}`
          : "none"
      }))
    ),
    table("INTENT (how it was presented)", dimension(intents, intentLabel)),
    table("AUDIENCE (who it was aimed at)", dimension(audiences, audienceLabel)),
    table(
      "NO-CODE SIGNAL BANDS (does work relevant to non-engineers resonate more?)",
      nocode.map((row) => ({
        band: row.band,
        n: row.posts,
        median_likes_per_1k: round(row.medianEngagement),
        median_breakout: row.medianBreakout === null ? "n/a" : round(row.medianBreakout)
      }))
    ),
    table(
      "BREAKOUT POSTS (engagement divided by that author's own median)",
      breakouts.map((row) => ({
        author: `@${row.username}`,
        followers: row.followersCount,
        likes: row.likeCount,
        likes_per_1k: round(row.engagement),
        breakout: row.breakout === null ? "n/a" : round(row.breakout, 1),
        what: (row.note ?? row.text).replace(/\s+/g, " ").slice(0, 140)
      }))
    ),
    table(
      "BUILDERS",
      creators.map((row) => ({
        handle: `@${row.username}`,
        followers: row.followersCount ?? "unknown",
        relevance: row.relevance ?? "unscored",
        median_likes_per_1k: row.medianEngagement === null ? "n/a" : round(row.medianEngagement),
        focus: (row.summary ?? "not yet summarised").replace(/\s+/g, " ").slice(0, 260)
      }))
    )
  ].join("\n");

  return { evidence, health };
}

/** Phase two: read the statistics and write the founder-facing brief. */
export async function runStrategyBrief(cycleId: string | null = null) {
  const sql = getDb();
  const startedAt = Date.now();
  const runId = await beginRun("brief");

  try {
    if (!hasAi()) throw new Error("OPENAI_API_KEY is not configured");

    const { evidence, health } = await buildEvidence();

    if (health.taggedPosts < MIN_TAGGED_FOR_BRIEF) {
      const detail = {
        phase: "brief",
        brief: `skipped: ${health.taggedPosts} tagged posts, need ${MIN_TAGGED_FOR_BRIEF}`,
        elapsedMs: Date.now() - startedAt
      };
      await finishRun(runId, "succeeded", detail);
      return detail;
    }

    const report = await writeStrategyBrief(evidence);
    if (!report) throw new Error("model returned nothing usable");

    await sql`
      insert into insight_reports (
        headline, demand_read, opportunities, gaps, recommendations, watchlist, sample, model
      ) values (
        ${report.headline}, ${report.demandRead},
        ${sql.json(report.opportunities)}, ${sql.json(report.gaps)},
        ${sql.json(report.recommendations)}, ${sql.json(report.watchlist)},
        ${sql.json({
          creators: health.creators,
          posts: health.posts,
          maturePosts: health.maturePosts,
          taggedPosts: health.taggedPosts,
          evidenceChars: evidence.length
        })},
        ${aiModel()}
      )
    `;

    // Each brief is a snapshot of a moving corpus, so the history is worth
    // keeping to see how the reading changes. Beyond eight the older ones stop
    // being comparable to today's much larger sample.
    await sql`
      delete from insight_reports
      where id not in (
        select id from insight_reports order by created_at desc limit ${KEEP_REPORTS}
      )
    `;

    const detail = {
      phase: "brief",
      brief: "written",
      headline: report.headline,
      taggedPosts: health.taggedPosts,
      elapsedMs: Date.now() - startedAt
    };
    await finishRun(runId, "succeeded", detail);
    await markCyclePhase(cycleId, "brief_at", { brief: detail });
    return detail;
  } catch (error) {
    const detail = {
      phase: "brief",
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt
    };
    await finishRun(runId, "failed", detail);
    throw error;
  }
}
