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
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { getDb } from "../lib/db";

const BASE = "https://api.x.com/2";
/**
 * Low, on purpose. The site ranks by likes per 1,000 followers, so a 70-like post
 * from a builder with 800 followers outscores a 400-like post from one with
 * 90,000 — and the categories that need filling are exactly the ones small
 * accounts work in. A high floor here would re-collect the same large accounts
 * the roster already covers.
 */
const MIN_LIKES = Number(process.env.MIN_LIKES ?? 60);

/**
 * Above this, the account is a company, a media outlet or a celebrity, and the
 * post is almost always marketing, industry news, or a teaser with nothing
 * attached. The roster the owner built by hand tops out well below this, and the
 * categories being filled are ones small builders work in.
 */
const MAX_FOLLOWERS = Number(process.env.MAX_FOLLOWERS ?? 80_000);

/**
 * Likes per 1,000 followers, which is what the site actually ranks on.
 *
 * A raw-like floor asks the wrong question of a small maker. Fifteen likes from
 * 500 followers is 30 per 1k and outranks 500 likes from 100,000 followers, so
 * holding out for big like counts discards exactly the posts that score well on
 * the page this corpus feeds.
 */
const MIN_ENGAGEMENT = Number(process.env.MIN_ENGAGEMENT ?? 0);

/**
 * Below this the rate stops meaning anything. An account with 41 followers that
 * picks up 147 likes scores 3,585 per 1k and tops the table, but the reach came
 * from the algorithm rather than from followers, so the ratio measures the wrong
 * thing. One such post is already in the corpus and sits at number one.
 */
const MIN_FOLLOWERS = Number(process.env.MIN_FOLLOWERS ?? 150);

/**
 * Token launches and agent-framework announcements match almost any phrasing
 * about building something, and they arrive with enough engagement to crowd out
 * the posts being looked for. Cheaper to exclude them in the query than to read
 * past them.
 */
const EXCLUDE =
  '-airdrop -presale -token -tokens -"$" -crypto -web3 -onchain -"on-chain" -NFT -mint -staking -giveaway -RT -hiring -course -discount -"my newsletter" -nsfw -hentai -porn -onlyfans -fetish -adultgame -throne';

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
  entities?: { urls?: Array<{ expanded_url?: string; unwound_url?: string }> };
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
  /**
   * Where the post actually points. A t.co link says nothing, and the difference
   * between a category and a wrong guess is usually the destination: itch.io and
   * a Steam page are not the same kind of work, and neither are a GitHub repo and
   * a live demo.
   */
  links: string[];
  query: string;
};

async function search(query: string, maxResults = 100) {
  const params = new URLSearchParams({
    // Only the three exclusions are forced. `has:links` used to be, and it quietly
    // ruled out most visual work: a shader or a game is often posted as a video
    // with no link at all, which is true of a good part of the corpus already on
    // the site. Each query now says for itself whether a link is required.
    // lang:en was forced here too, and it removed the visual work wholesale: a
    // sketch posted as an image with three words of caption is classified as an
    // undetermined language rather than English, and the Japanese creative-coding
    // accounts never appeared at all. Set LANG= to drop the restriction.
    query:
      `${query} ${EXCLUDE} -is:retweet -is:quote -is:reply` +
      (process.env.LANG_FILTER === "" ? "" : ` ${process.env.LANG_FILTER ?? "lang:en"}`),
    max_results: String(maxResults),
    sort_order: "relevancy",
    "tweet.fields": "created_at,public_metrics,author_id,lang,referenced_tweets,entities",
    expansions: "author_id",
    "user.fields": "description,profile_image_url,public_metrics,verified"
  });

  // The archive holds far more than the last month, and the site ranks over all
  // history, so the thin categories are worth searching back through. Relevancy
  // ordering on its own returns almost nothing older than a few weeks.
  if (process.env.START_TIME) params.set("start_time", process.env.START_TIME);
  if (process.env.END_TIME) params.set("end_time", process.env.END_TIME);

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

  // Every post here has already been paid for. The like floor and the follower cap
  // are applied below in this process, so a run with the wrong floor throws away
  // posts that cost money to read and cannot be got back without paying again --
  // which is exactly what happened to a batch of generative-art accounts whose
  // work sits under sixty likes. Raw responses are kept so the filters can be
  // reconsidered offline.
  mkdirSync("harvest-raw", { recursive: true });
  appendFileSync(
    "harvest-raw/responses.jsonl",
    JSON.stringify({ at: new Date().toISOString(), query, response: json }) + "\n"
  );

  return (json.data ?? []).flatMap<Candidate>((post) => {
    const likes = post.public_metrics?.like_count ?? 0;
    if (likes < MIN_LIKES) return [];
    // Belt and braces: the operators above should already have excluded these.
    if ((post.referenced_tweets ?? []).some((r) => r.type !== "replied_to")) return [];
    const author = users.get(post.author_id);
    if (!author) return [];
    const followers = author.public_metrics?.followers_count ?? 0;
    if (followers < MIN_FOLLOWERS || followers > MAX_FOLLOWERS) return [];
    if ((likes / followers) * 1000 < MIN_ENGAGEMENT) return [];
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
        links: (post.entities?.urls ?? [])
          .map((url) => url.unwound_url ?? url.expanded_url ?? "")
          .filter((url) => url && !url.includes("//x.com/") && !url.includes("//twitter.com/")),
        query
      }
    ];
  });
}

/**
 * Every post the owner has already ruled on, in either direction.
 *
 * `posts` holds what they kept and `blocked_posts` what they threw away, and a
 * candidate matching either one is not a candidate: re-proposing a post they
 * already filed wastes their time, and re-proposing one they discarded asks them
 * to make the same decision twice.
 */
async function alreadyJudged() {
  const sql = getDb();
  const rows = await sql<Array<{ post_id: string }>>`
    select id as post_id from posts
    union
    select post_id from blocked_posts
  `;
  await sql.end();
  return new Set(rows.map((row) => row.post_id));
}

const [label, ...QUERIES] = process.argv.slice(2);
if (!label || !QUERIES.length) {
  console.error('usage: harvest.mts <label> "query one" "query two" ...');
  process.exit(1);
}

const judged = await alreadyJudged();
console.log(`excluding ${judged.size} posts already ruled on\n`);

const found = new Map<string, Candidate>();
let excluded = 0;

for (const query of QUERIES) {
  try {
    const results = await search(query);
    let added = 0;
    for (const candidate of results) {
      if (found.has(candidate.id)) continue;
      if (judged.has(candidate.id)) {
        excluded += 1;
        continue;
      }
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
console.log(
  `\n${all.length} candidates over ${MIN_LIKES} likes -> ${outfile}` +
    ` (${excluded} skipped as already judged)`
);
for (const candidate of all) {
  console.log(
    `\n${candidate.id} @${candidate.username} · ${candidate.followers} followers · ` +
      `${candidate.likeCount} likes · ${Math.round(candidate.engagement)}/1k`
  );
  console.log(`  ${candidate.text.replace(/\s+/g, " ")}`);
  if (candidate.links.length) console.log(`  -> ${candidate.links.join("  ")}`);
}
