import { classifyCandidate } from "@/lib/classify";
import { getDb } from "@/lib/db";
import { seedCreators } from "@/lib/seed-creators";
import { getAllFollowing, getUserPosts, lookupUsersByUsernames, type XUser } from "@/lib/x";

async function beginRun(kind: "posts" | "following") {
  const sql = getDb();
  const [run] = await sql<{ id: string }[]>`
    insert into sync_runs (kind, status) values (${kind}, 'running') returning id
  `;
  return run.id;
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
      insert into creators (username, name, description, status)
      values (${seed.username}, ${seed.label}, ${seed.summary}, 'approved')
      on conflict (username) do nothing
    `;
  }
}

export async function syncCreatorsAndPosts() {
  const sql = getDb();
  const runId = await beginRun("posts");
  const errors: Array<{ username: string; error: string }> = [];
  let postsUpserted = 0;

  try {
    await ensureSeedRows();
    const creatorRows = await sql<{ username: string }[]>`
      select username from creators where status = 'approved'
    `;
    const users = await lookupUsersByUsernames(creatorRows.map((creator) => creator.username));

    for (const user of users) {
      try {
        const [creator] = await sql<{ id: string }[]>`
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
          returning id
        `;

        if (!creator) continue;

        const [latest] = await sql<{ id: string }[]>`
          select id from posts where creator_id = ${creator.id}
          order by created_at desc limit 1
        `;
        const posts = await getUserPosts(user.id, latest?.id ?? null);

        for (const post of posts) {
          await sql`
            insert into posts (
              id, creator_id, text, url, created_at,
              like_count, repost_count, reply_count, fetched_at
            ) values (
              ${post.id}, ${creator.id}, ${post.text},
              ${`https://x.com/${user.username}/status/${post.id}`}, ${post.created_at},
              ${post.public_metrics?.like_count ?? 0},
              ${post.public_metrics?.retweet_count ?? 0},
              ${post.public_metrics?.reply_count ?? 0}, now()
            )
            on conflict (id) do update set
              text = excluded.text,
              like_count = excluded.like_count,
              repost_count = excluded.repost_count,
              reply_count = excluded.reply_count,
              fetched_at = now()
          `;
          postsUpserted += 1;
        }
      } catch (error) {
        errors.push({
          username: user.username,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const detail = { creatorsFound: users.length, postsUpserted, errors };
    await finishRun(runId, errors.length === users.length ? "failed" : "succeeded", detail);
    return detail;
  } catch (error) {
    const detail = { error: error instanceof Error ? error.message : String(error), errors };
    await finishRun(runId, "failed", detail);
    throw error;
  }
}

async function storeCandidate(user: XUser, discoveredBy: string) {
  const sql = getDb();
  const posts = await getUserPosts(user.id);
  const assessment = await classifyCandidate(user, posts);

  await sql`
    insert into discovery_candidates (
      x_user_id, username, name, description, profile_image_url,
      followers_count, relevance_score, relevance_reason, discovered_by
    ) values (
      ${user.id}, ${user.username}, ${user.name}, ${user.description ?? ""},
      ${user.profile_image_url ?? null}, ${user.public_metrics?.followers_count ?? 0},
      ${assessment?.score ?? null},
      ${assessment?.reason ?? "Awaiting AI classification."},
      ${sql.array([discoveredBy])}
    )
    on conflict (x_user_id) do update set
      username = excluded.username,
      name = excluded.name,
      description = excluded.description,
      profile_image_url = excluded.profile_image_url,
      followers_count = excluded.followers_count,
      relevance_score = coalesce(excluded.relevance_score, discovery_candidates.relevance_score),
      relevance_reason = coalesce(excluded.relevance_reason, discovery_candidates.relevance_reason),
      discovered_by = (
        select array_agg(distinct value)
        from unnest(discovery_candidates.discovered_by || excluded.discovered_by) value
      ),
      updated_at = now()
  `;
}

export async function checkNewFollowees() {
  const sql = getDb();
  const runId = await beginRun("following");
  let discovered = 0;
  let baselined = 0;
  const errors: Array<{ username: string; error: string }> = [];

  try {
    const creators = await sql<
      Array<{
        id: string;
        x_user_id: string;
        username: string;
        following_baselined_at: Date | null;
      }>
    >`
      select id, x_user_id, username, following_baselined_at
      from creators
      where status = 'approved' and x_user_id is not null
    `;

    const approvedIds = new Set(creators.map((creator) => creator.x_user_id));

    for (const creator of creators) {
      try {
        const following = await getAllFollowing(creator.x_user_id);
        const knownRows = await sql<{ target_user_id: string }[]>`
          select target_user_id from following_edges
          where source_user_id = ${creator.x_user_id}
        `;
        const known = new Set(knownRows.map((row) => row.target_user_id));

        if (creator.following_baselined_at) {
          const newFollowees = following.filter(
            (user) => !known.has(user.id) && !approvedIds.has(user.id)
          );
          for (const user of newFollowees) {
            await storeCandidate(user, creator.username);
            discovered += 1;
          }
        } else {
          baselined += 1;
        }

        for (const user of following) {
          await sql`
            insert into following_edges (source_user_id, target_user_id)
            values (${creator.x_user_id}, ${user.id})
            on conflict (source_user_id, target_user_id)
            do update set last_seen_at = now()
          `;
        }

        await sql`
          update creators
          set following_baselined_at = coalesce(following_baselined_at, now())
          where id = ${creator.id}
        `;
      } catch (error) {
        errors.push({
          username: creator.username,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const detail = { creatorsChecked: creators.length, discovered, baselined, errors };
    await finishRun(runId, errors.length === creators.length ? "failed" : "succeeded", detail);
    return detail;
  } catch (error) {
    const detail = { error: error instanceof Error ? error.message : String(error), errors };
    await finishRun(runId, "failed", detail);
    throw error;
  }
}
