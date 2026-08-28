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
  meta?: { next_token?: string; newest_id?: string; oldest_id?: string };
  errors?: Array<{ title?: string; detail?: string }>;
};

function token() {
  if (!process.env.X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN is not configured");
  }
  return process.env.X_BEARER_TOKEN;
}

async function xFetch<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${X_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store"
  });

  if (!response.ok) {
    const reset = response.headers.get("x-rate-limit-reset");
    const body = await response.text();
    throw new Error(
      `X API ${response.status}${reset ? ` (reset ${reset})` : ""}: ${body.slice(0, 500)}`
    );
  }

  const payload = (await response.json()) as XResponse<T>;
  if (payload.errors?.length && !payload.data) {
    throw new Error(payload.errors.map((error) => error.detail ?? error.title).join("; "));
  }
  return payload;
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

export async function getUserPosts(userId: string, sinceId?: string | null) {
  const response = await xFetch<XPost[]>(`/users/${userId}/tweets`, {
    max_results: "10",
    exclude: "replies,retweets",
    "tweet.fields": "created_at,public_metrics",
    since_id: sinceId ?? ""
  });
  return response.data ?? [];
}

export async function getAllFollowing(userId: string) {
  const users: XUser[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await xFetch<XUser[]>(`/users/${userId}/following`, {
      max_results: "1000",
      pagination_token: paginationToken ?? "",
      "user.fields": "description,profile_image_url,public_metrics,verified,url"
    });
    users.push(...(response.data ?? []));
    paginationToken = response.meta?.next_token;
  } while (paginationToken);

  return users;
}
