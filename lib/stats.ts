import { getDb, hasDatabase } from "@/lib/db";
import { NOT_WORK, PRODUCT_CATEGORIES } from "@/lib/mission";

/**
 * Why the numbers are shaped this way.
 *
 * Raw like counts cannot be compared across builders: 500 likes means something
 * very different for an account with 3,000 followers than for one with 150,000.
 * Every comparison here therefore runs on ENGAGEMENT, defined as likes per 1,000
 * followers, which removes audience size from the picture.
 *
 * Engagement still carries each builder's own baseline popularity, so a second
 * measure isolates the thing we actually want. BREAKOUT divides a post's
 * engagement by the median engagement of that same builder's other posts. A
 * breakout of 4 means the audience wanted that specific post four times more
 * than they usually want that person's work, which is the cleanest available
 * signal of appetite for the thing itself rather than for its author.
 *
 * Medians are used throughout rather than averages because a single viral post
 * distorts a mean badly at these sample sizes.
 *
 * Only MATURE posts enter any comparison. Likes accumulate for roughly two days,
 * so a post whose counts were captured 40 minutes after publishing is not
 * comparable to one captured a week later. Maturity means the stored metrics were
 * read at least 24 hours after the post appeared.
 */

const MATURITY = "24 hours";
// A median needs a few points to mean anything; below this a builder gets no
// baseline and their posts are excluded from breakout ranking rather than
// producing a confident-looking number from two data points.
const MIN_POSTS_FOR_BASELINE = 4;

/**
 * Both statuses contribute posts to the statistics. 'guest' is the author of a
 * post added by hand who was never chosen for the ranked roster — their post is
 * part of the corpus, they are not part of the directory.
 */
const CORPUS_STATUSES = ["approved", "guest"];

/**
 * A ranking of posts is meant to answer "what work resonated", so a post that
 * handed over no work does not belong in it however many likes it drew. Both
 * rankings therefore require a category, which also excludes posts not yet
 * tagged: an untagged post is not known to be work, and admitting it on the
 * chance that it might be is what filled the earlier ranking with takes, replies
 * and conference photos.
 *
 * The one exception is a post the owner added by hand. That is an explicit
 * judgement that it belongs, and it should not have to wait for the next
 * enrichment cycle to appear.
 */
function workPostsOnly(sql: ReturnType<typeof getDb>) {
  return sql`(
    p.added_by_hand
    or (pi.product_category is not null and pi.product_category <> ${NOT_WORK})
  )`;
}

/**
 * The two reporting ranges.
 *
 * All-history answers "what works", using every post ever collected. The recent
 * window answers "what is working now", which is a different question and can
 * disagree — a category can lead on all-history because of one old hit while
 * having gone quiet since.
 *
 * Fourteen days is not arbitrary: it is the same window in which stored like
 * counts are still being actively refreshed, so every post inside it is measured
 * on maintained numbers rather than on whatever was true when it was first read.
 */
export type RankWindow = "all" | "recent";
export const RECENT_WINDOW_DAYS = 14;

export function parseWindow(raw: string | undefined): RankWindow {
  return raw === "recent" || raw === "14d" ? "recent" : "all";
}

export type CorpusHealth = {
  creators: number;
  posts: number;
  maturePosts: number;
  taggedPosts: number;
  tagFresh: number;
  creatorsSummarised: number;
  buildersWithBaseline: number;
  oldestPost: string | null;
  newestPost: string | null;
  lastEnrichedAt: string | null;
};

export type DimensionRow = {
  key: string;
  posts: number;
  creators: number;
  medianEngagement: number;
  medianBreakout: number | null;
  topEngagement: number;
  totalLikes: number;
  repostRate: number;
  recentPosts: number;
  avgNocodeSignal: number;
};

export type BreakoutRow = {
  id: string;
  username: string;
  text: string;
  url: string;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  followersCount: number;
  engagement: number;
  breakout: number | null;
  note: string | null;
  themes: string[];
  artifact: string | null;
  productCategory: string | null;
  mature: boolean;
  nocodeSignal: number | null;
  addedByHand: boolean;
};

export type NocodeSplit = {
  band: "high" | "medium" | "low";
  posts: number;
  medianEngagement: number;
  medianBreakout: number | null;
};

export type CreatorFocusRow = {
  username: string;
  name: string;
  followersCount: number | null;
  summary: string | null;
  products: string[];
  themes: string[];
  relevance: number | null;
  opportunity: string | null;
  updatedAt: string | null;
  maturePosts: number;
  medianEngagement: number | null;
};

export type StrategyReport = {
  headline: string;
  demandRead: string;
  opportunities: Array<{ title: string; detail: string; evidence: string }>;
  gaps: Array<{ title: string; detail: string }>;
  recommendations: Array<{ action: string; why: string }>;
  watchlist: Array<{ username: string; why: string }>;
  sample: Record<string, unknown>;
  createdAt: string;
};

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const maybeNum = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function getCorpusHealth(): Promise<CorpusHealth> {
  const empty: CorpusHealth = {
    creators: 0,
    posts: 0,
    maturePosts: 0,
    taggedPosts: 0,
    tagFresh: 0,
    creatorsSummarised: 0,
    buildersWithBaseline: 0,
    oldestPost: null,
    newestPost: null,
    lastEnrichedAt: null
  };
  if (!hasDatabase()) return empty;

  const sql = getDb();
  const [row] = await sql<
    Array<Record<string, unknown>>
  >`
    with base as (
      select p.id, p.creator_id, p.created_at,
             (p.metrics_refreshed_at >= p.created_at + ${MATURITY}::interval) as mature
      from posts p
      join creators c on c.id = p.creator_id
      where c.status = any(${CORPUS_STATUSES})
    )
    select
      -- The roster, not the corpus: guests contribute posts but are not builders
      -- anyone chose to follow.
      (select count(*) from creators where status = 'approved') as creators,
      (select count(*) from base) as posts,
      (select count(*) from base where mature) as mature_posts,
      (select count(*) from post_insights pi join base b on b.id = pi.post_id) as tagged_posts,
      (select count(*) from post_insights pi join base b on b.id = pi.post_id
        where pi.updated_at > now() - interval '7 days') as tag_fresh,
      (select count(*) from creators where status = 'approved' and focus_summary is not null)
        as creators_summarised,
      (select count(*) from (
         select creator_id from base where mature
         group by creator_id having count(*) >= ${MIN_POSTS_FOR_BASELINE}
       ) t) as builders_with_baseline,
      -- Scoped to base, not all posts, so the range matches the counts above
      -- rather than including builders who have since been paused or removed.
      (select min(created_at) from base) as oldest_post,
      (select max(created_at) from base) as newest_post,
      (select max(finished_at) from sync_runs where kind = 'insights' and status = 'succeeded')
        as last_enriched_at
  `;

  const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : null);

  return {
    creators: num(row.creators),
    posts: num(row.posts),
    maturePosts: num(row.mature_posts),
    taggedPosts: num(row.tagged_posts),
    tagFresh: num(row.tag_fresh),
    creatorsSummarised: num(row.creators_summarised),
    buildersWithBaseline: num(row.builders_with_baseline),
    oldestPost: iso(row.oldest_post),
    newestPost: iso(row.newest_post),
    lastEnrichedAt: iso(row.last_enriched_at)
  };
}

/**
 * Shared analysis base: every post of a corpus builder, expressed as likes per
 * 1,000 followers, with each builder's own median attached so a post can be
 * measured against its author rather than against the whole corpus.
 *
 * The window narrows which posts are REPORTED, never which posts form the
 * baseline. A builder's median is always taken over their whole history, because
 * a fortnight of their output is often three or four posts — too few for a median
 * to mean anything, and using one would make the breakout multiple noisier in the
 * exact view where it matters most. The comparison stays against how that person
 * usually performs, while the list shows only what happened lately.
 */
function scoredPosts(sql: ReturnType<typeof getDb>, window: RankWindow = "all") {
  const recentOnly = window === "recent";
  return sql`
    with base as (
      select
        p.id, p.creator_id, p.text, p.url, p.created_at,
        p.like_count, p.repost_count, p.reply_count,
        c.username, c.followers_count,
        (p.like_count::float8 / nullif(c.followers_count, 0) * 1000) as engagement,
        (p.metrics_refreshed_at >= p.created_at + ${MATURITY}::interval) as mature
      from posts p
      join creators c on c.id = p.creator_id
      where c.status = any(${CORPUS_STATUSES}) and coalesce(c.followers_count, 0) > 0
    ),
    baseline as (
      select
        creator_id,
        count(*) as mature_posts,
        percentile_cont(0.5) within group (order by engagement)::float8 as median_engagement
      from base
      where mature and engagement is not null
      group by creator_id
    ),
    scored as (
      select
        b.*,
        bl.mature_posts,
        bl.median_engagement,
        case
          when bl.mature_posts >= ${MIN_POSTS_FOR_BASELINE} and bl.median_engagement > 0
          then b.engagement / bl.median_engagement
        end as breakout
      from base b
      left join baseline bl on bl.creator_id = b.creator_id
      where ${
        recentOnly
          ? sql`b.created_at > now() - ${`${RECENT_WINDOW_DAYS} days`}::interval`
          : sql`true`
      }
    )
  `;
}

export async function getThemeStats(): Promise<DimensionRow[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql)}
    select
      theme as key,
      count(*) as posts,
      count(distinct s.creator_id) as creators,
      percentile_cont(0.5) within group (order by s.engagement)::float8 as median_engagement,
      percentile_cont(0.5) within group (order by s.breakout)::float8 as median_breakout,
      max(s.engagement)::float8 as top_engagement,
      sum(s.like_count) as total_likes,
      (sum(s.repost_count)::float8 / nullif(sum(s.like_count), 0)) as repost_rate,
      count(*) filter (where s.created_at > now() - interval '30 days') as recent_posts,
      avg(pi.nocode_signal)::float8 as avg_nocode_signal
    from scored s
    join post_insights pi on pi.post_id = s.id
    cross join lateral unnest(pi.themes) as theme
    where s.mature and s.engagement is not null
    group by theme
    order by median_engagement desc nulls last, posts desc
  `;
  return rows.map(toDimensionRow);
}

export type TagDimension = "artifact" | "intent" | "audience";

export async function getTagStats(dimension: TagDimension): Promise<DimensionRow[]> {
  if (!hasDatabase()) return [];
  // Whitelisted above by type, re-checked here so a bad call site cannot reach
  // the identifier helper with arbitrary text.
  if (!["artifact", "intent", "audience"].includes(dimension)) return [];

  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql)}
    select
      pi.${sql(dimension)} as key,
      count(*) as posts,
      count(distinct s.creator_id) as creators,
      percentile_cont(0.5) within group (order by s.engagement)::float8 as median_engagement,
      percentile_cont(0.5) within group (order by s.breakout)::float8 as median_breakout,
      max(s.engagement)::float8 as top_engagement,
      sum(s.like_count) as total_likes,
      (sum(s.repost_count)::float8 / nullif(sum(s.like_count), 0)) as repost_rate,
      count(*) filter (where s.created_at > now() - interval '30 days') as recent_posts,
      avg(pi.nocode_signal)::float8 as avg_nocode_signal
    from scored s
    join post_insights pi on pi.post_id = s.id
    where s.mature and s.engagement is not null
    group by pi.${sql(dimension)}
    order by median_engagement desc nulls last, posts desc
  `;
  return rows.map(toDimensionRow);
}

function toDimensionRow(row: Record<string, unknown>): DimensionRow {
  return {
    key: String(row.key ?? "unknown"),
    posts: num(row.posts),
    creators: num(row.creators),
    medianEngagement: num(row.median_engagement),
    medianBreakout: maybeNum(row.median_breakout),
    topEngagement: num(row.top_engagement),
    totalLikes: num(row.total_likes),
    repostRate: num(row.repost_rate),
    recentPosts: num(row.recent_posts),
    avgNocodeSignal: num(row.avg_nocode_signal)
  };
}

export async function getBreakoutPosts(limit = 12): Promise<BreakoutRow[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql)}
    select
      s.id, s.username, s.text, s.url, s.created_at,
      s.like_count, s.repost_count, s.followers_count,
      s.engagement, s.breakout,
      pi.note, pi.themes, pi.artifact, pi.nocode_signal
    from scored s
    left join post_insights pi on pi.post_id = s.id
    where s.mature and s.breakout is not null
    order by s.breakout desc
    limit ${limit}
  `;
  return rows.map(toBreakoutRow);
}

export async function getTopEngagementPosts(limit = 12): Promise<BreakoutRow[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql)}
    select
      s.id, s.username, s.text, s.url, s.created_at,
      s.like_count, s.repost_count, s.followers_count,
      s.engagement, s.breakout,
      pi.note, pi.themes, pi.artifact, pi.nocode_signal
    from scored s
    left join post_insights pi on pi.post_id = s.id
    where s.mature and s.engagement is not null
    order by s.engagement desc
    limit ${limit}
  `;
  return rows.map(toBreakoutRow);
}

function toBreakoutRow(row: Record<string, unknown>): BreakoutRow {
  return {
    id: String(row.id),
    username: String(row.username),
    text: String(row.text ?? ""),
    url: String(row.url ?? ""),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    likeCount: num(row.like_count),
    repostCount: num(row.repost_count),
    followersCount: num(row.followers_count),
    engagement: num(row.engagement),
    breakout: maybeNum(row.breakout),
    note: row.note ? String(row.note) : null,
    themes: Array.isArray(row.themes) ? (row.themes as string[]) : [],
    artifact: row.artifact ? String(row.artifact) : null,
    productCategory: row.product_category ? String(row.product_category) : null,
    mature: row.mature === undefined ? true : Boolean(row.mature),
    nocodeSignal: maybeNum(row.nocode_signal),
    addedByHand: Boolean(row.added_by_hand)
  };
}

export type PostRankMetric = "likes" | "rate";

/**
 * The post leaderboard.
 *
 * Unlike the dimension tables this does not filter to mature posts. A post whose
 * likes were last read an hour after publishing is undercounted, so including it
 * can only rank it too low, never too high — there is no way for a fresh post to
 * steal a place it has not earned. Immature rows are flagged instead of hidden so
 * a genuine new hit can show up on the day it lands.
 *
 * Ranking by likes rewards whoever has the biggest audience; ranking by likes per
 * 1,000 followers rewards whatever resonated hardest relative to reach. They
 * produce very different lists, which is the point of offering both.
 */
export async function getTopPosts(
  metric: PostRankMetric,
  window: RankWindow = "all",
  limit = 30
): Promise<BreakoutRow[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const order = metric === "likes" ? sql`s.like_count desc` : sql`s.engagement desc`;
  const rows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql, window)}
    select
      s.id, s.username, s.text, s.url, s.created_at,
      s.like_count, s.repost_count, s.followers_count,
      s.engagement, s.breakout, s.mature,
      p.added_by_hand,
      pi.note, pi.themes, pi.artifact, pi.product_category, pi.nocode_signal
    from scored s
    join posts p on p.id = s.id
    left join post_insights pi on pi.post_id = s.id
    where s.engagement is not null and ${workPostsOnly(sql)}
    order by ${order}, s.created_at desc
    limit ${limit}
  `;
  return rows.map(toBreakoutRow);
}

export type CategoryRow = DimensionRow & {
  avgLikes: number;
  medianLikes: number;
  avgEngagement: number;
  share: number;
  examples: BreakoutRow[];
};

/**
 * Ranks product categories. Reports both the average and the median of each
 * measure on purpose: the average is what a "which category wins" question
 * usually means, but at these sample sizes one viral post drags an average a long
 * way, and a category whose average sits far above its median is being carried by
 * a single hit rather than performing consistently.
 */
export async function getCategoryStats(window: RankWindow = "all"): Promise<CategoryRow[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();

  const rows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql, window)}
    select
      pi.product_category as key,
      count(*) as posts,
      count(distinct s.creator_id) as creators,
      avg(s.like_count)::float8 as avg_likes,
      percentile_cont(0.5) within group (order by s.like_count)::float8 as median_likes,
      avg(s.engagement)::float8 as avg_engagement,
      percentile_cont(0.5) within group (order by s.engagement)::float8 as median_engagement,
      percentile_cont(0.5) within group (order by s.breakout)::float8 as median_breakout,
      max(s.engagement)::float8 as top_engagement,
      sum(s.like_count) as total_likes,
      (sum(s.repost_count)::float8 / nullif(sum(s.like_count), 0)) as repost_rate,
      count(*) filter (where s.created_at > now() - interval '30 days') as recent_posts,
      avg(pi.nocode_signal)::float8 as avg_nocode_signal
    from scored s
    join post_insights pi on pi.post_id = s.id
    where s.mature and s.engagement is not null
      -- A stale value from a superseded prompt version must not be ranked
      -- alongside current ones, so the category must still be in the vocabulary.
      and pi.product_category <> ${NOT_WORK}
      and pi.product_category = any(${[...PRODUCT_CATEGORIES]})
    group by pi.product_category
    order by avg_engagement desc nulls last, posts desc
  `;

  const totalPosts = rows.reduce((sum, row) => sum + num(row.posts), 0);

  // Best examples per category, taken in one pass rather than a query per row.
  const exampleRows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql, window)}
    , ranked as (
      select
        s.id, s.username, s.text, s.url, s.created_at,
        s.like_count, s.repost_count, s.followers_count,
        s.engagement, s.breakout, s.mature,
        pi.note, pi.themes, pi.artifact, pi.product_category, pi.nocode_signal,
        row_number() over (
          partition by pi.product_category order by s.engagement desc
        ) as rank
      from scored s
      join post_insights pi on pi.post_id = s.id
      where s.mature and s.engagement is not null
      -- A stale value from a superseded prompt version must not be ranked
      -- alongside current ones, so the category must still be in the vocabulary.
      and pi.product_category <> ${NOT_WORK}
      and pi.product_category = any(${[...PRODUCT_CATEGORIES]})
    )
    select * from ranked where rank <= 3
  `;

  const examples = new Map<string, BreakoutRow[]>();
  for (const row of exampleRows) {
    const key = String(row.product_category);
    const list = examples.get(key) ?? [];
    list.push(toBreakoutRow(row));
    examples.set(key, list);
  }

  return rows.map((row) => ({
    ...toDimensionRow(row),
    avgLikes: num(row.avg_likes),
    medianLikes: num(row.median_likes),
    avgEngagement: num(row.avg_engagement),
    share: totalPosts ? num(row.posts) / totalPosts : 0,
    examples: examples.get(String(row.key)) ?? []
  }));
}

/**
 * Splits posts by how strongly the model read them as evidence that non-engineers
 * want to build the thing themselves, then compares engagement across the bands.
 * If the high band outperforms the low band, this audience is rewarding exactly
 * the kind of work the platform is meant to enable.
 */
export async function getNocodeSplit(): Promise<NocodeSplit[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql)}
    select
      case
        when pi.nocode_signal >= 60 then 'high'
        when pi.nocode_signal >= 30 then 'medium'
        else 'low'
      end as band,
      count(*) as posts,
      percentile_cont(0.5) within group (order by s.engagement)::float8 as median_engagement,
      percentile_cont(0.5) within group (order by s.breakout)::float8 as median_breakout
    from scored s
    join post_insights pi on pi.post_id = s.id
    where s.mature and s.engagement is not null
    group by band
  `;

  const order: Array<NocodeSplit["band"]> = ["high", "medium", "low"];
  return rows
    .map((row) => ({
      band: String(row.band) as NocodeSplit["band"],
      posts: num(row.posts),
      medianEngagement: num(row.median_engagement),
      medianBreakout: maybeNum(row.median_breakout)
    }))
    .sort((a, b) => order.indexOf(a.band) - order.indexOf(b.band));
}

export async function getCreatorFocus(): Promise<CreatorFocusRow[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    ${scoredPosts(sql)}
    select
      c.username, c.name, c.followers_count,
      c.focus_summary, c.focus_products, c.focus_themes,
      c.focus_relevance, c.focus_opportunity, c.focus_updated_at,
      coalesce(agg.mature_posts, 0) as mature_posts,
      agg.median_engagement
    from creators c
    left join (
      select
        creator_id,
        count(*) as mature_posts,
        percentile_cont(0.5) within group (order by engagement)::float8 as median_engagement
      from scored
      where mature and engagement is not null
      group by creator_id
    ) agg on agg.creator_id = c.id
    where c.status = 'approved'
    order by c.focus_relevance desc nulls last, c.followers_count desc nulls last
  `;

  return rows.map((row) => ({
    username: String(row.username),
    name: String(row.name),
    followersCount: maybeNum(row.followers_count),
    summary: row.focus_summary ? String(row.focus_summary) : null,
    products: Array.isArray(row.focus_products) ? (row.focus_products as string[]) : [],
    themes: Array.isArray(row.focus_themes) ? (row.focus_themes as string[]) : [],
    relevance: maybeNum(row.focus_relevance),
    opportunity: row.focus_opportunity ? String(row.focus_opportunity) : null,
    updatedAt: row.focus_updated_at instanceof Date ? row.focus_updated_at.toISOString() : null,
    maturePosts: num(row.mature_posts),
    medianEngagement: maybeNum(row.median_engagement)
  }));
}

function toReport(row: Record<string, unknown>): StrategyReport {
  const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    headline: String(row.headline ?? ""),
    demandRead: String(row.demand_read ?? ""),
    opportunities: list(row.opportunities),
    gaps: list(row.gaps),
    recommendations: list(row.recommendations),
    watchlist: list(row.watchlist),
    sample: (row.sample as Record<string, unknown>) ?? {},
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : ""
  };
}

/**
 * The retained history of briefs, newest first. Each was written against a
 * different snapshot of the corpus, so reading them in sequence shows which
 * conclusions held as the sample grew and which were artefacts of a thin one.
 */
export async function getReportHistory(limit = 8): Promise<StrategyReport[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    select * from insight_reports order by created_at desc limit ${limit}
  `;
  return rows.map(toReport);
}

export async function getLatestReport(): Promise<StrategyReport | null> {
  const [report] = await getReportHistory(1);
  return report ?? null;
}

export type CycleStatus = {
  startedAt: string;
  postsAt: string | null;
  enrichedAt: string | null;
  briefAt: string | null;
  finishedAt: string | null;
  complete: boolean;
};

/**
 * The three phases run minutes apart because each has its own function timeout,
 * so the site reports the cycle rather than three separate finish times.
 */
export async function getCycleStatus(): Promise<CycleStatus | null> {
  if (!hasDatabase()) return null;
  const sql = getDb();
  const [row] = await sql<Array<Record<string, unknown>>>`
    select * from sync_cycles order by started_at desc limit 1
  `;
  if (!row) return null;

  const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : null);
  return {
    startedAt: iso(row.started_at) ?? "",
    postsAt: iso(row.posts_at),
    enrichedAt: iso(row.enriched_at),
    briefAt: iso(row.brief_at),
    finishedAt: iso(row.finished_at),
    complete: Boolean(row.finished_at)
  };
}
