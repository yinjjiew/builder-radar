import { getDb } from "@/lib/db";
import { parsePostId } from "@/lib/post-url";
import { normalizeUsername } from "@/lib/username";
import { getPostWithAuthor, lookupUsersByUsernames, type XUser } from "@/lib/x";

export type CurateResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Removes a post and records that it must never come back.
 *
 * Deleting the row alone is not enough. The sync re-reads each builder's timeline
 * on every cycle, so a post removed by hand would reappear within six hours. The
 * blocklist is what the insert consults to make the removal permanent, and it
 * keeps the post id after the row is gone.
 */
export async function blockPost(postId: string): Promise<CurateResult> {
  const sql = getDb();

  const [post] = await sql<Array<{ url: string; username: string }>>`
    select p.url, c.username
    from posts p join creators c on c.id = p.creator_id
    where p.id = ${postId}
  `;

  await sql.begin(async (tx) => {
    await tx`
      insert into blocked_posts (post_id, url, username)
      values (${postId}, ${post?.url ?? ""}, ${post?.username ?? ""})
      on conflict (post_id) do nothing
    `;
    // post_insights cascades from this, so the tags go with it.
    await tx`delete from posts where id = ${postId}`;
  });

  return {
    ok: true,
    message: post
      ? `Removed @${post.username}'s post. It will not be collected again.`
      : "Post removed."
  };
}

async function upsertGuestAuthor(author: XUser) {
  const sql = getDb();
  const [row] = await sql<Array<{ id: string; status: string }>>`
    insert into creators (
      x_user_id, username, name, description, profile_image_url,
      followers_count, verified, status, added_by_hand, last_synced_at
    ) values (
      ${author.id}, ${author.username}, ${author.name}, ${author.description ?? ""},
      ${author.profile_image_url ?? null},
      ${author.public_metrics?.followers_count ?? null},
      ${author.verified ?? false}, 'guest', true, now()
    )
    on conflict (username) do update set
      -- An existing builder keeps their status: pulling in one of their posts by
      -- hand must not quietly demote a roster member to guest, nor revive one
      -- who was removed on purpose.
      x_user_id = coalesce(excluded.x_user_id, creators.x_user_id),
      followers_count = coalesce(excluded.followers_count, creators.followers_count),
      name = excluded.name,
      updated_at = now()
    returning id, status
  `;
  return row;
}

/**
 * Adds a single post from a link, whoever wrote it.
 *
 * If the author is not on the roster they are stored as a guest: the post needs a
 * follower count to be comparable with the rest of the corpus, but someone whose
 * post was picked up in passing did not earn a place among the ranked builders.
 */
export async function addPostByLink(raw: string): Promise<CurateResult> {
  const postId = parsePostId(raw);
  if (!postId) {
    return { ok: false, message: "That does not look like a post link. Paste the URL of a post." };
  }

  const sql = getDb();

  const [blocked] = await sql<Array<{ post_id: string }>>`
    select post_id from blocked_posts where post_id = ${postId}
  `;
  if (blocked) {
    // Silently re-adding something the owner deleted would make "never again"
    // untrue, so this needs an explicit unblock instead.
    return {
      ok: false,
      message: "That post was deleted earlier. Restore it from the removed list first."
    };
  }

  const [existing] = await sql<Array<{ id: string }>>`select id from posts where id = ${postId}`;
  if (existing) return { ok: false, message: "That post is already in the directory." };

  let fetched: Awaited<ReturnType<typeof getPostWithAuthor>>;
  try {
    fetched = await getPostWithAuthor(postId);
  } catch (error) {
    return {
      ok: false,
      message: `X would not return that post: ${
        error instanceof Error ? error.message.slice(0, 140) : "unknown error"
      }`
    };
  }

  if (!fetched?.post) {
    return { ok: false, message: "That post does not exist, or is private or deleted." };
  }
  if (!fetched.author) {
    return { ok: false, message: "Could not identify the author of that post." };
  }

  const creator = await upsertGuestAuthor(fetched.author);
  if (!creator) return { ok: false, message: "Could not store the author of that post." };
  if (creator.status === "removed") {
    return {
      ok: false,
      message: `@${fetched.author.username} was removed from the directory, so their posts are not collected.`
    };
  }

  const post = fetched.post;
  await sql`
    insert into posts (
      id, creator_id, text, url, created_at,
      like_count, repost_count, reply_count,
      fetched_at, metrics_refreshed_at, added_by_hand
    ) values (
      ${post.id}, ${creator.id}, ${post.text},
      ${`https://x.com/${fetched.author.username}/status/${post.id}`},
      ${post.created_at},
      ${post.public_metrics?.like_count ?? 0},
      ${post.public_metrics?.retweet_count ?? 0},
      ${post.public_metrics?.reply_count ?? 0},
      now(), now(), true
    )
    on conflict (id) do nothing
  `;

  return {
    ok: true,
    message: `Added @${fetched.author.username}'s post. It is tagged for the category ranking on the next update.`
  };
}

export async function unblockPost(postId: string): Promise<CurateResult> {
  const sql = getDb();
  await sql`delete from blocked_posts where post_id = ${postId}`;
  return {
    ok: true,
    message: "Post unblocked. It returns on the next update, or add it now from its link."
  };
}

export type BlockedPost = {
  postId: string;
  url: string;
  username: string;
  createdAt: string;
};

export async function getBlockedPosts(): Promise<BlockedPost[]> {
  const sql = getDb();
  const rows = await sql<Array<Record<string, unknown>>>`
    select post_id, url, username, created_at
    from blocked_posts order by created_at desc limit 100
  `;
  return rows.map((row) => ({
    postId: String(row.post_id),
    url: String(row.url ?? ""),
    username: String(row.username ?? ""),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : ""
  }));
}

/**
 * Adds a builder to the ranked roster by handle or profile link.
 *
 * A removed builder is not revived here. "Removed" is meant to be permanent, and
 * the one place that can undo it is the removed list in /admin, where the choice
 * is explicit rather than a side effect of pasting a link.
 */
export async function addUpByLink(raw: string): Promise<CurateResult> {
  const username = normalizeUsername(raw);
  if (!username) return { ok: false, message: "Enter a valid X username or profile link." };

  const sql = getDb();
  const [existing] = await sql<Array<{ status: string }>>`
    select status from creators where lower(username) = lower(${username})
  `;

  if (existing?.status === "approved") {
    return { ok: false, message: `@${username} is already in the directory.` };
  }
  if (existing?.status === "removed") {
    return {
      ok: false,
      message: `@${username} was permanently removed. Restore them from the removed list in /admin.`
    };
  }

  let profile: XUser | undefined;
  try {
    [profile] = await lookupUsersByUsernames([username]);
  } catch {
    profile = undefined;
  }

  await sql`
    insert into creators (
      x_user_id, username, name, description, profile_image_url,
      followers_count, verified, status, added_by_hand
    ) values (
      ${profile?.id ?? null}, ${profile?.username ?? username},
      ${profile?.name ?? username}, ${profile?.description ?? ""},
      ${profile?.profile_image_url ?? null},
      ${profile?.public_metrics?.followers_count ?? null},
      ${profile?.verified ?? false}, 'approved', true
    )
    on conflict (username) do update set
      status = 'approved',
      added_by_hand = true,
      x_user_id = coalesce(excluded.x_user_id, creators.x_user_id),
      followers_count = coalesce(excluded.followers_count, creators.followers_count),
      updated_at = now()
  `;

  return {
    ok: true,
    message: profile
      ? `@${username} added. Their posts arrive with the next update.`
      : `@${username} added. Details fill in on the next update.`
  };
}

/**
 * Takes a builder off the roster for good.
 *
 * The row is kept rather than deleted, and that is the mechanism: the seeding
 * step uses `on conflict do nothing` for status, so a 'removed' row is what stops
 * the next sync from adding them back. Deleting the row would also delete their
 * posts by cascade and let the seed list resurrect them within hours.
 */
export async function removeUp(creatorId: string): Promise<CurateResult> {
  const sql = getDb();
  const [creator] = await sql<Array<{ username: string }>>`
    update creators set status = 'removed', updated_at = now()
    where id = ${creatorId}
    returning username
  `;
  return {
    ok: true,
    message: creator
      ? `@${creator.username} removed. They will not be added back.`
      : "Builder removed."
  };
}

export async function restoreUp(creatorId: string): Promise<CurateResult> {
  const sql = getDb();
  const [creator] = await sql<Array<{ username: string }>>`
    update creators set status = 'approved', updated_at = now()
    where id = ${creatorId}
    returning username
  `;
  return { ok: true, message: creator ? `@${creator.username} restored.` : "Builder restored." };
}
