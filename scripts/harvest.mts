/**
 * Searches X for posts that showcase a made thing, and writes the candidates to
 * a file for review. It classifies nothing and stores nothing.
 *
 * Five categories were too thin to rank off the roster's own output — the roster
 * is 60 creative web developers, and most of them post 3D scenes and client work.
 * Games, learning apps, portfolios, building blocks and practical web apps exist
 * in quantity on X; they are just made by other people. Search reaches them.
 *
 * Author follower counts come back in the same request through an expansion,
 * which is what keeps this affordable: without it every candidate would need its
 * own user lookup, and likes per 1,000 followers cannot be computed without the
 * follower count.
 */
import { writeFileSync } from "node:fs";

const BASE = "https://api.x.com/2";
const MIN_LIKES = 120;

/**
 * Token launches and agent-framework announcements match almost any phrasing
 * about building something, and they arrive with enough engagement to crowd out
 * the posts being looked for. Cheaper to exclude them in the query than to read
 * past them.
 */
const EXCLUDE =
  '-airdrop -presale -token -tokens -"$" -crypto -web3 -onchain -"on-chain" -NFT -mint -staking -giveaway -RT -hiring -course -discount -"my newsletter"';

type Metrics = {
  like_count: number;
  retweet_count: number;
  reply_count: number;
};
type Raw = {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  lang?: string;
  public_metrics?: Metrics;
  referenced_tweets?: Array<{ type: string; id: string }>;
};
type User = {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: { followers_count: number };
};

export type Candidate = {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  url: string;
  username: string;
  name: string;
  description: string;
  followers: number;
  profileImageUrl: string | null;
  verified: boolean;
  engagement: number;
  query: string;
};

async function search(query: string, maxResults = 500) {
  const params = new URLSearchParams({
    query: `${query} ${EXCLUDE} -is:retweet -is:quote -is:reply has:links lang:en`,
    max_results: String(maxResults),
    sort_order: "relevancy",
    "tweet.fields": "created_at,public_metrics,author_id,lang,referenced_tweets",
    expansions: "author_id",
    "user.fields": "description,profile_image_url,public_metrics,verified"
  });

  const response = await fetch(`${BASE}/tweets/search/all?${params}`, {
    headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    data?: Raw[];
    includes?: { users?: User[] };
  };

  const users = new Map((json.includes?.users ?? []).map((user) => [user.id, user]));

  return (json.data ?? []).flatMap<Candidate>((post) => {
    const likes = post.public_metrics?.like_count ?? 0;
    if (likes < MIN_LIKES) return [];
    // Belt and braces: the operators above should already have excluded these.
    if ((post.referenced_tweets ?? []).some((r) => r.type !== "replied_to")) return [];
    const author = users.get(post.author_id);
    if (!author) return [];
    const followers = author.public_metrics?.followers_count ?? 0;
    if (!followers) return [];
    return [
      {
        id: post.id,
        text: post.text,
        createdAt: post.created_at,
        likeCount: likes,
        url: `https://x.com/${author.username}/status/${post.id}`,
        username: author.username,
        name: author.name,
        description: author.description ?? "",
        followers,
        profileImageUrl: author.profile_image_url ?? null,
        verified: Boolean(author.verified),
        engagement: (likes / followers) * 1000,
        query
      }
    ];
  });
}

const [label, ...QUERIES] = process.argv.slice(2);
if (!label || !QUERIES.length) {
  console.error('usage: harvest.mts <label> "query one" "query two" ...');
  process.exit(1);
}

const found = new Map<string, Candidate>();

for (const query of QUERIES) {
  try {
    const results = await search(query);
    let added = 0;
    for (const candidate of results) {
      if (found.has(candidate.id)) continue;
      found.set(candidate.id, candidate);
      added += 1;
    }
    console.log(`${added.toString().padStart(3)} new  <- ${query}`);
  } catch (error) {
    console.log(`  ERROR <- ${query}: ${error instanceof Error ? error.message : error}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

const all = [...found.values()].sort((a, b) => b.likeCount - a.likeCount);
const outfile = `/tmp/cand-${label}.json`;
writeFileSync(outfile, JSON.stringify(all, null, 2));
console.log(`\n${all.length} candidates over ${MIN_LIKES} likes -> ${outfile}`);
for (const candidate of all) {
  console.log(
    `${candidate.id}|${candidate.username}|${candidate.likeCount}|${Math.round(candidate.engagement)}|${candidate.text.replace(/\s+/g, " ").slice(0, 150)}`
  );
}
