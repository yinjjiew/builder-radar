const X_API_BASE = "https://api.x.com/2";

export type XUser = {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
};

export type XPost = {
  id: string;
  text: string;
  created_at: string;
  /**
   * Present when the post points at another one. A reply, a repost or a quote all
   * show up here; the type is what tells them apart.
   */
  referenced_tweets?: Array<{
    type: "retweeted" | "quoted" | "replied_to";
    id: string;
  }>;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    bookmark_count?: number;
    impression_count?: number;
  };
};

type XResponse<T> = {
  data?: T;
  includes?: { users?: XUser[] };
  meta?: { next_token?: string; newest_id?: string; oldest_id?: string };
  errors?: Array<{ title?: string; detail?: string }>;
};

function token() {
  if (!process.env.X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN is not configured");
  }
  return process.env.X_BEARER_TOKEN;
}

/**
 * Thrown when the X account has no credits left.
 *
 * Worth its own type because it is the one failure retrying cannot fix and the
 * one the cycle must survive: every X endpoint returns it at once, and a cycle
 * that treated it as a crash would skip recomputing the rankings and writing an
 * insight from data already stored, which needs no API at all.
 */
export class XCreditsDepletedError extends Error {
  constructor() {
    super("The X API account is out of credits, so no new posts could be collected.");
    this.name = "XCreditsDepletedError";
  }
}

const MAX_ATTEMPTS = 4;
const MAX_RETRY_WAIT_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the window named by x-rate-limit-reset (absolute epoch seconds),
 * falling back to exponential backoff when the header is absent or implausible.
 */
function retryDelayMs(response: Response, attempt: number) {
  const reset = Number(response.headers.get("x-rate-limit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    const wait = reset * 1000 - Date.now();
    if (wait > 0) return Math.min(wait + 1_000, MAX_RETRY_WAIT_MS);
  }
  return Math.min(2 ** attempt * 1_000, MAX_RETRY_WAIT_MS);
}

async function xFetch<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${X_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  let lastError = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token()}` },
      cache: "no-store"
    });

    if (response.ok) {
      const payload = (await response.json()) as XResponse<T>;
      if (payload.errors?.length && !payload.data) {
        throw new Error(payload.errors.map((error) => error.detail ?? error.title).join("; "));
      }
      return payload;
    }

    const body = await response.text();
    if (response.status === 402) throw new XCreditsDepletedError();
    lastError = `X API ${response.status}: ${body.slice(0, 500)}`;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS - 1) break;

    await sleep(retryDelayMs(response, attempt));
  }

  throw new Error(lastError);
}

export async function lookupUsersByUsernames(usernames: string[]) {
  const allUsers: XUser[] = [];
  for (let index = 0; index < usernames.length; index += 100) {
    const batch = usernames.slice(index, index + 100);
    const response = await xFetch<XUser[]>("/users/by", {
      usernames: batch.join(","),
      "user.fields": "description,profile_image_url,public_metrics,verified,url"
    });
    allUsers.push(...(response.data ?? []));
  }
  return allUsers;
}

/**
 * Is this someone else's post, passed along?
 *
 * The corpus is meant to measure what a builder made, and a repost or a quote
 * measures what they noticed. Their like count belongs to the original author,
 * so counting it here credits the wrong person and inflates whichever category
 * the quoted thing happened to be about. `exclude=retweets` on the timeline
 * catches only reposts, so quotes have to be dropped by looking at the reference.
 */
export function isRepostOrQuote(post: XPost) {
  return (post.referenced_tweets ?? []).some(
    (reference) => reference.type === "retweeted" || reference.type === "quoted"
  );
}

/**
 * `max_results` is a ceiling, not an order: with `since_id` set, only posts
 * published since the last cycle come back, and only those are billed. The
 * ceiling still matters, because anything above it is lost for good — the next
 * cycle's `since_id` is the newest post stored, so posts stranded in the gap are
 * never asked for again.
 *
 * On the old six-hour cycle a ceiling of 10 meant 40 posts a day per builder. On
 * a daily cycle it means 10, and the busiest day any builder in this roster has
 * had is 7. Three posts of headroom against a hard data loss is too thin a
 * margin for a free ceiling, hence 25.
 */
const MAX_POSTS_PER_CYCLE = 25;

export async function getUserPosts(userId: string, sinceId?: string | null) {
  const response = await xFetch<XPost[]>(`/users/${userId}/tweets`, {
    max_results: String(MAX_POSTS_PER_CYCLE),
    exclude: "replies,retweets",
    "tweet.fields": "created_at,public_metrics,referenced_tweets",
    since_id: sinceId ?? ""
  });
  return (response.data ?? []).filter((post) => !isRepostOrQuote(post));
}

/**
 * Re-reads metrics for posts already stored. `getUserPosts` uses since_id and so
 * never revisits a post, which froze every like count at whatever it happened to
 * be minutes after publishing. Comparing engagement across posts requires
 * counts measured at a similar age, so the sync refreshes a recent window.
 */
export async function getPostsByIds(ids: string[]) {
  const posts: XPost[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const batch = ids.slice(index, index + 100);
    const response = await xFetch<XPost[]>("/tweets", {
      ids: batch.join(","),
      "tweet.fields": "created_at,public_metrics"
    });
    posts.push(...(response.data ?? []));
  }
  return posts;
}

/**
 * A single post together with its author, for adding one by hand from a link.
 *
 * The author comes back in the same request via an expansion rather than a second
 * lookup, which matters because the person may not be on the roster at all: their
 * follower count is what makes the post comparable to the rest of the corpus, so
 * a post cannot be stored usefully without it.
 */
export async function getPostWithAuthor(id: string) {
  const response = await xFetch<XPost & { author_id?: string }>(`/tweets/${id}`, {
    "tweet.fields": "created_at,public_metrics,author_id,referenced_tweets",
    expansions: "author_id",
    "user.fields": "description,profile_image_url,public_metrics,verified"
  });

  const post = response.data;
  if (!post?.id) return null;

  const author =
    response.includes?.users?.find((user) => user.id === post.author_id) ??
    response.includes?.users?.[0] ??
    null;

  return { post, author };
}

/*
 * There is deliberately no follow-graph read here.
 *
 * X bills that endpoint per account returned, at $0.010 each rather than per
 * request, so reading one popular builder's following list costs around $10 and
 * doing it across the roster costs a few hundred. The graph built from it was
 * removed for exactly that reason, and leaving the client function behind would
 * make it a one-line accident to spend that again.
 */
