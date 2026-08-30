import { getDb, hasDatabase } from "@/lib/db";
import { WORK_KINDS } from "@/lib/mission";

/**
 * The corpus with its tags, laid out for correction rather than for ranking.
 *
 * The ranking pages are deliberately narrow: thirty posts, only work, only
 * mature. That is the right shape for reading a leaderboard and the wrong shape
 * for fixing one, because the posts most worth fixing are exactly the ones a
 * filtered view hides — work that was filed as not-work and so vanished. This
 * query hides nothing and sorts by whatever makes the mistakes easiest to find.
 */

const CORPUS_STATUSES = ["approved", "guest"];

/** 40 rows is about one screen of scrolling and one round trip. */
export const REVIEW_PAGE_SIZE = 40;

export type ReviewSort = "likes" | "rate" | "recent";
/** 'none' selects posts carrying no category at all, tagged or not. */
export type ReviewFilter = string;

export type ReviewPost = {
  id: string;
  username: string;
  name: string;
  text: string;
  url: string;
  createdAt: string;
  likeCount: number;
  followersCount: number | null;
  engagement: number | null;
  categories: string[];
  edited: boolean;
  addedByHand: boolean;
  tagged: boolean;
  reviewed: boolean;
  note: string | null;
};

export type ReviewCounts = {
  total: number;
  none: number;
  edited: number;
  unreviewed: number;
  byCategory: Record<string, number>;
};

export function parseReviewSort(raw: string | undefined): ReviewSort {
  return raw === "rate" || raw === "recent" ? raw : "likes";
}

export function parseReviewFilter(raw: string | undefined): ReviewFilter {
  if (raw === "none" || raw === "edited" || raw === "unreviewed") return raw;
  return WORK_KINDS.includes(raw as never) ? (raw as string) : "all";
}

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function getReviewCounts(): Promise<ReviewCounts> {
  const empty: ReviewCounts = {
    total: 0,
    none: 0,
    edited: 0,
    unreviewed: 0,
    byCategory: {}
  };
  if (!hasDatabase()) return empty;
  const sql = getDb();

  const [totals] = await sql<Array<Record<string, unknown>>>`
    select
      count(*) as total,
      count(*) filter (where coalesce(array_length(pi.categories, 1), 0) = 0) as none,
      count(*) filter (where coalesce(pi.categories_edited, false)) as edited,
      count(*) filter (where not coalesce(pi.reviewed, false)) as unreviewed
    from posts p
    join creators c on c.id = p.creator_id
    left join post_insights pi on pi.post_id = p.id
    where c.status = any(${CORPUS_STATUSES})
  `;

  const perCategory = await sql<Array<Record<string, unknown>>>`
    select cat as key, count(*) as posts
    from posts p
    join creators c on c.id = p.creator_id
    join post_insights pi on pi.post_id = p.id
    cross join lateral unnest(pi.categories) as cat
    where c.status = any(${CORPUS_STATUSES})
    group by cat
  `;

  return {
    total: num(totals?.total),
    none: num(totals?.none),
    edited: num(totals?.edited),
    unreviewed: num(totals?.unreviewed),
    byCategory: Object.fromEntries(perCategory.map((row) => [String(row.key), num(row.posts)]))
  };
}

export async function getReviewPosts({
  filter,
  sort,
  page,
  username
}: {
  filter: ReviewFilter;
  sort: ReviewSort;
  page: number;
  username?: string;
}): Promise<ReviewPost[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();

  const where =
    filter === "all"
      ? sql`true`
      : filter === "none"
        ? sql`coalesce(array_length(pi.categories, 1), 0) = 0`
        : filter === "edited"
          ? sql`coalesce(pi.categories_edited, false)`
          : filter === "unreviewed"
            ? sql`not coalesce(pi.reviewed, false)`
            : sql`pi.categories @> array[${filter}]::text[]`;

  const order =
    sort === "recent"
      ? sql`p.created_at desc`
      : sort === "rate"
        ? sql`(p.like_count::float8 / nullif(c.followers_count, 0)) desc nulls last`
        : sql`p.like_count desc`;

  const rows = await sql<Array<Record<string, unknown>>>`
    select
      p.id, p.text, p.url, p.created_at, p.like_count, p.added_by_hand,
      c.username, c.name, c.followers_count,
      coalesce(pi.categories, '{}') as categories,
      coalesce(pi.categories_edited, false) as categories_edited,
      coalesce(pi.reviewed, false) as reviewed,
      (pi.post_id is not null) as tagged,
      pi.note,
      (p.like_count::float8 / nullif(c.followers_count, 0) * 1000) as engagement
    from posts p
    join creators c on c.id = p.creator_id
    left join post_insights pi on pi.post_id = p.id
    where c.status = any(${CORPUS_STATUSES})
      and ${where}
      and ${username ? sql`lower(c.username) = lower(${username})` : sql`true`}
    order by ${order}, p.created_at desc
    limit ${REVIEW_PAGE_SIZE}
    offset ${Math.max(0, page - 1) * REVIEW_PAGE_SIZE}
  `;

  return rows.map((row) => ({
    id: String(row.id),
    username: String(row.username),
    name: String(row.name ?? ""),
    text: String(row.text ?? ""),
    url: String(row.url ?? ""),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    likeCount: num(row.like_count),
    followersCount: row.followers_count === null ? null : num(row.followers_count),
    engagement: row.engagement === null ? null : num(row.engagement),
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
    edited: Boolean(row.categories_edited),
    addedByHand: Boolean(row.added_by_hand),
    tagged: Boolean(row.tagged),
    reviewed: Boolean(row.reviewed),
    note: row.note ? String(row.note) : null
  }));
}

/**
 * The builders whose posts are in the corpus, so the review page can be narrowed
 * to one person. Ordered by how much of the corpus is theirs, since that is who
 * a reviewer is most likely to be checking.
 */
export async function getReviewAuthors(): Promise<Array<{ username: string; posts: number }>> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    select c.username, count(p.id) as posts
    from creators c
    join posts p on p.creator_id = c.id
    where c.status = any(${CORPUS_STATUSES})
    group by c.username
    order by count(p.id) desc, lower(c.username)
  `;
  return rows.map((row) => ({
    username: String(row.username),
    posts: num(row.posts)
  }));
}
