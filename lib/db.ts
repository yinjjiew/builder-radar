import postgres, { type Sql } from "postgres";
import { seedCreators } from "@/lib/seed-creators";
import type {
  Builder,
  CreatorStatus,
  DiscoveryCandidate,
  ManagedCreator
} from "@/lib/types";

const seedUsernames = new Set<string>(
  seedCreators.map((creator) => creator.username.toLowerCase())
);

// Server-side cap so a stuck query fails the request instead of holding the
// serverless function open until the platform kills it.
const STATEMENT_TIMEOUT_MS = 20_000;

let client: Sql | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!client) {
    client = postgres(process.env.DATABASE_URL, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
      // Requires Supabase's SESSION pooler (port 5432), not the transaction
      // pooler (6543). postgres.js pipelines queued queries onto a busy
      // connection, which transaction-mode Supavisor never answers, wedging
      // every later request behind it. See README.
      connection: { statement_timeout: STATEMENT_TIMEOUT_MS }
    });
  }

  return client;
}

export async function getBuilders(): Promise<Builder[]> {
  if (!hasDatabase()) {
    return seedCreators.map((creator, index) => ({
      id: `seed-${index}`,
      username: creator.username,
      name: creator.label,
      description: creator.summary,
      profileImageUrl: null,
      followersCount: null,
      verified: false,
      lastSyncedAt: null,
      focusSummary: null,
      focusProducts: [],
      focusRelevance: null,
      posts: []
    }));
  }

  const sql = getDb();
  const rows = await sql<
    Array<{
      id: string;
      username: string;
      name: string;
      description: string;
      profile_image_url: string | null;
      followers_count: number | null;
      verified: boolean;
      last_synced_at: Date | null;
      focus_summary: string | null;
      focus_products: string[];
      focus_relevance: number | null;
      posts: Array<{
        id: string;
        text: string;
        created_at: string;
        url: string;
        like_count: number;
        repost_count: number;
        reply_count: number;
      }>;
    }>
  >`
    select
      c.id,
      c.username,
      c.name,
      c.description,
      c.profile_image_url,
      c.followers_count,
      c.verified,
      c.last_synced_at,
      c.focus_summary,
      c.focus_products,
      c.focus_relevance,
      coalesce(
        (
          select json_agg(recent_posts order by recent_posts.created_at desc)
          from (
            select p.id, p.text, p.created_at, p.url,
                   p.like_count, p.repost_count, p.reply_count
            from posts p
            where p.creator_id = c.id
            order by p.created_at desc
            limit 5
          ) recent_posts
        ),
        '[]'::json
      ) as posts
    from creators c
    where c.status = 'approved'
    order by c.followers_count desc nulls last, lower(c.username) asc
  `;

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    name: row.name,
    description: row.description,
    profileImageUrl: row.profile_image_url,
    followersCount: row.followers_count,
    verified: row.verified,
    lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
    focusSummary: row.focus_summary,
    focusProducts: row.focus_products ?? [],
    focusRelevance: row.focus_relevance,
    posts: row.posts.map((post) => ({
      id: post.id,
      text: post.text,
      createdAt: new Date(post.created_at).toISOString(),
      url: post.url,
      likeCount: post.like_count,
      repostCount: post.repost_count,
      replyCount: post.reply_count
    }))
  }));
}

export async function getManagedCreators(): Promise<ManagedCreator[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<
    Array<{
      id: string;
      username: string;
      name: string;
      profile_image_url: string | null;
      followers_count: number | null;
      status: CreatorStatus;
      last_synced_at: Date | null;
      post_count: string;
    }>
  >`
    select
      c.id,
      c.username,
      c.name,
      c.profile_image_url,
      c.followers_count,
      c.status,
      c.last_synced_at,
      (select count(*) from posts p where p.creator_id = c.id) as post_count
    from creators c
    -- Removed builders are listed too, at the bottom, so a permanent removal is
    -- visible and can be undone deliberately rather than being invisible.
    order by
      case c.status when 'approved' then 0 when 'paused' then 1 when 'guest' then 2 else 3 end,
      c.followers_count desc nulls last,
      lower(c.username) asc
  `;

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    name: row.name,
    profileImageUrl: row.profile_image_url,
    followersCount: row.followers_count,
    status: row.status,
    lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
    postCount: Number(row.post_count),
    isSeed: seedUsernames.has(row.username.toLowerCase())
  }));
}

export async function getDiscoveryCandidates(): Promise<DiscoveryCandidate[]> {
  if (!hasDatabase()) return [];
  const sql = getDb();
  const rows = await sql<
    Array<{
      id: string;
      x_user_id: string;
      username: string;
      name: string;
      description: string;
      profile_image_url: string | null;
      followers_count: number;
      relevance_score: number | null;
      relevance_reason: string | null;
      discovered_by: string[];
      status: "pending" | "approved" | "rejected";
      created_at: Date;
    }>
  >`
    select * from discovery_candidates
    order by
      case status when 'pending' then 0 when 'approved' then 1 else 2 end,
      relevance_score desc nulls last,
      created_at desc
  `;

  return rows.map((row) => ({
    id: row.id,
    xUserId: row.x_user_id,
    username: row.username,
    name: row.name,
    description: row.description,
    profileImageUrl: row.profile_image_url,
    followersCount: row.followers_count,
    relevanceScore: row.relevance_score,
    relevanceReason: row.relevance_reason,
    discoveredBy: row.discovered_by,
    status: row.status,
    createdAt: row.created_at.toISOString()
  }));
}
