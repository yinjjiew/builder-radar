import { getDb } from "@/lib/db";
import { seedCreators } from "@/lib/seed-creators";
import { getPostsByIds, getUserPosts, lookupUsersByUsernames } from "@/lib/x";

// A post's likes keep climbing for roughly two days, so anything measured before
// then is not yet comparable. Posts older than the window are left alone: their
// counts have settled and re-reading them would only cost X API quota.
const REFRESH_WINDOW_DAYS = 14;
const MATURITY_HOURS = 48;
const REFRESH_BATCH = 100;
const SETTLED_RECHECK_DAYS = 7;

// Profile reads bill at $0.010 each against $0.005 for a post, so with thirty
// builders they were the largest line on the bill — and follower counts barely
// move in six hours. Refreshing them daily instead of four times a day removes
// about three quarters of that cost and changes no number anyone looks at.
const PROFILE_REFRESH_HOURS = 20;

/**
 * Brings stored like/repost/reply counts back up to date for a bounded window of
 * recent posts. Prioritises posts whose metrics were captured before they had
 * time to mature, then anything not re-read in the last three days.
 */
async function refreshRecentMetrics() {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    select id from posts
    where created_at > now() - ${`${REFRESH_WINDOW_DAYS} days`}::interval
      and (
        metrics_refreshed_at is null
        or metrics_refreshed_at < created_at + ${`${MATURITY_HOURS} hours`}::interval
        or metrics_refreshed_at < now() - ${`${SETTLED_RECHECK_DAYS} days`}::interval
      )
    order by created_at desc
    limit ${REFRESH_BATCH}
  `;

  if (!rows.length) return { refreshed: 0, missing: 0 };

  const ids = rows.map((row) => row.id);
  let fresh: Awaited<ReturnType<typeof getPostsByIds>>;
  try {
    fresh = await getPostsByIds(ids);
  } catch {
    // Every requested post being deleted makes X return errors with no data.
    // That is not a reason to fail the whole sync.
    return { refreshed: 0, missing: ids.length };
  }

  for (const post of fresh) {
    await sql`
      update posts set
        text = ${post.text},
        like_count = ${post.public_metrics?.like_count ?? 0},
        repost_count = ${post.public_metrics?.retweet_count ?? 0},
        reply_count = ${post.public_metrics?.reply_count ?? 0},
        metrics_refreshed_at = now()
      where id = ${post.id}
    `;
  }

  return { refreshed: fresh.length, missing: ids.length - fresh.length };
}

async function beginRun(kind: "posts" | "following", cycleId: string | null = null) {
  const sql = getDb();
  const [run] = await sql<{ id: string }[]>`
    insert into sync_runs (kind, status, cycle_id)
    values (${kind}, 'running', ${cycleId})
    returning id
  `;
  return run.id;
}

/**
 * The three phases of an update run minutes apart because each is bounded by the
 * serverless function timeout. Grouping them under one cycle lets the site report
 * a single "last updated" time rather than three that disagree.
 */
export async function openCycle() {
  const sql = getDb();
  const [cycle] = await sql<{ id: string }[]>`
    insert into sync_cycles default values returning id
  `;
  return cycle.id;
}

export async function currentCycleId() {
  const sql = getDb();
  const [cycle] = await sql<{ id: string }[]>`
    select id from sync_cycles
    where started_at > now() - interval '3 hours'
    order by started_at desc limit 1
  `;
  return cycle?.id ?? null;
}

export async function markCyclePhase(
  cycleId: string | null,
  phase: "posts_at" | "enriched_at" | "brief_at",
  detail: Record<string, unknown> = {}
) {
  if (!cycleId) return;
  const sql = getDb();
  const payload = JSON.parse(JSON.stringify(detail)) as Parameters<typeof sql.json>[0];
  const column = sql(phase);
  await sql`
    update sync_cycles
    set ${column} = now(),
        detail = detail || ${sql.json(payload)},
        finished_at = case when ${phase} = 'brief_at' then now() else finished_at end
    where id = ${cycleId}
  `;
}

async function finishRun(
  runId: string,
  status: "succeeded" | "failed",
  detail: Record<string, unknown>
) {
  const sql = getDb();
  const serializedDetail = JSON.parse(JSON.stringify(detail)) as Parameters<typeof sql.json>[0];
  await sql`
    update sync_runs
    set status = ${status}, detail = ${sql.json(serializedDetail)}, finished_at = now()
    where id = ${runId}
  `;
}

async function ensureSeedRows() {
  const sql = getDb();
  for (const seed of seedCreators) {
    // do nothing on conflict: an existing row may have been paused or removed
    // deliberately from /admin, and that decision must survive every sync.
    await sql`
      insert into creators (username, name, description, status, bucket)
      values (${seed.username}, ${seed.label}, ${seed.summary}, 'approved', ${seed.bucket})
      on conflict (username) do update set
        bucket = coalesce(creators.bucket, excluded.bucket)
    `;
  }
}

/**
 * Re-reads X profiles, but only for creators whose copy has gone stale. Post
 * fetching needs `x_user_id`, which is already stored, so it does not depend on
 * this having run.
 */
async function refreshStaleProfiles() {
  const sql = getDb();
  const stale = await sql<{ username: string }[]>`
    select username from creators
    where status = 'approved'
      and (
        x_user_id is null
        or last_synced_at is null
        or last_synced_at < now() - ${`${PROFILE_REFRESH_HOURS} hours`}::interval
      )
  `;

  if (!stale.length) return { looked_up: 0, updated: 0 };

  const users = await lookupUsersByUsernames(stale.map((creator) => creator.username));
  for (const user of users) {
    await sql`
      update creators set
        x_user_id = ${user.id},
        username = ${user.username},
        name = ${user.name},
        description = ${user.description ?? ""},
        profile_image_url = ${user.profile_image_url ?? null},
        followers_count = ${user.public_metrics?.followers_count ?? null},
        verified = ${user.verified ?? false},
        last_synced_at = now(),
        updated_at = now()
      where lower(username) = lower(${user.username})
    `;
  }

  return { looked_up: stale.length, updated: users.length };
}

export async function syncCreatorsAndPosts(cycleId: string | null = null) {
  const sql = getDb();
  const runId = await beginRun("posts", cycleId);
  const errors: Array<{ username: string; error: string }> = [];
  let postsUpserted = 0;

  try {
    await ensureSeedRows();
    const profiles = await refreshStaleProfiles();

    const creators = await sql<Array<{ id: string; username: string; x_user_id: string }>>`
      select id, username, x_user_id from creators
      where status = 'approved' and x_user_id is not null
      order by followers_count desc nulls last
    `;

    for (const creator of creators) {
      try {
        const [latest] = await sql<{ id: string }[]>`
          select id from posts where creator_id = ${creator.id}
          order by created_at desc limit 1
        `;
        const posts = await getUserPosts(creator.x_user_id, latest?.id ?? null);

        for (const post of posts) {
          await sql`
            insert into posts (
              id, creator_id, text, url, created_at,
              like_count, repost_count, reply_count, fetched_at, metrics_refreshed_at
            ) values (
              ${post.id}, ${creator.id}, ${post.text},
              ${`https://x.com/${creator.username}/status/${post.id}`}, ${post.created_at},
              ${post.public_metrics?.like_count ?? 0},
              ${post.public_metrics?.retweet_count ?? 0},
              ${post.public_metrics?.reply_count ?? 0}, now(), now()
            )
            on conflict (id) do update set
              text = excluded.text,
              like_count = excluded.like_count,
              repost_count = excluded.repost_count,
              reply_count = excluded.reply_count,
              fetched_at = now(),
              metrics_refreshed_at = now()
          `;
          postsUpserted += 1;
        }
      } catch (error) {
        errors.push({
          username: creator.username,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const metrics = await refreshRecentMetrics();

    const detail = { creators: creators.length, profiles, postsUpserted, metrics, errors };
    await finishRun(runId, errors.length === creators.length ? "failed" : "succeeded", detail);
    await markCyclePhase(cycleId, "posts_at", { posts: detail });
    return detail;
  } catch (error) {
    const detail = { error: error instanceof Error ? error.message : String(error), errors };
    await finishRun(runId, "failed", detail);
    throw error;
  }
}
