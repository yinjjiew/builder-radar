/**
 * Finds the maker's own post by searching for the thing they made.
 *
 * Phrase queries were tried first and they do not work. Asking for the words a
 * builder uses returns the words other people use about builders: three separate
 * query styles all came back dominated by roundups — "the best UI components,
 * save this 👇", "found some ridiculously good resources" — where the artifact is
 * real and the poster did not make it. Under the site's rules those are not work,
 * so nine candidates in ten were unusable and each one still cost money to read.
 *
 * A domain inverts that. Searching url:"trovecn.dev" returns everyone who ever
 * linked it, the maker included, and because the domain was chosen for its
 * category the artifact needs no judgement — only the author does, which is
 * answerable from the text: "I added a new loading state to X" is the maker and
 * "found this, save it" is not.
 *
 * Input is a text file, one domain per line, `domain category` — category being
 * the site's own vocabulary so a candidate arrives pre-filed:
 *
 *   trovecn.dev      building-block
 *   alg0.dev         education
 *
 * Blank lines and lines starting with # are ignored.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { getDb } from "../lib/db";

const BASE = "https://api.x.com/2";
const MIN_LIKES = Number(process.env.MIN_LIKES ?? 25);
const MAX_FOLLOWERS = 80_000;
/** X caps a query at 512 characters on this tier; leave room for the suffix. */
const QUERY_BUDGET = 380;

type Metrics = { like_count: number; retweet_count: number; reply_count: number };
type Raw = {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
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

type Candidate = {
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
  links: string[];
  /** The category of whichever input domain this post links to. */
  category: string;
  domain: string;
};

const [listPath] = process.argv.slice(2);
if (!listPath) {
  console.error("usage: harvest-urls.mts <domains.txt>");
  process.exit(1);
}

const entries = readFileSync(listPath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const [domain, category] = line.split(/\s+/);
    return { domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""), category };
  })
  .filter((entry) => entry.domain && entry.category);

const categoryOf = new Map(entries.map((entry) => [entry.domain, entry.category]));

/** Groups domains into queries that fit inside the length limit. */
function batches() {
  const out: string[][] = [];
  let current: string[] = [];
  let length = 0;
  for (const { domain } of entries) {
    const term = `url:"${domain}" OR `.length;
    if (length + term > QUERY_BUDGET && current.length) {
      out.push(current);
      current = [];
      length = 0;
    }
    current.push(domain);
    length += term;
  }
  if (current.length) out.push(current);
  return out;
}

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

const judged = await alreadyJudged();
const groups = batches();
console.log(
  `${entries.length} domains in ${groups.length} queries, excluding ${judged.size} judged posts\n`
);

const found = new Map<string, Candidate>();

for (const group of groups) {
  const query = group.map((domain) => `url:"${domain}"`).join(" OR ");
  const params = new URLSearchParams({
    query: `(${query}) -is:retweet -is:quote -is:reply`,
    max_results: "100",
    sort_order: "relevancy",
    "tweet.fields": "created_at,public_metrics,author_id,referenced_tweets,entities",
    expansions: "author_id",
    "user.fields": "description,profile_image_url,public_metrics,verified"
  });

  const response = await fetch(`${BASE}/tweets/search/all?${params}`, {
    headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` }
  });

  if (!response.ok) {
    console.log(`  ERROR ${response.status}: ${(await response.text()).slice(0, 160)}`);
    console.log(`  (${group.join(", ")})`);
    continue;
  }

  const json = (await response.json()) as { data?: Raw[]; includes?: { users?: User[] } };
  const users = new Map((json.includes?.users ?? []).map((user) => [user.id, user]));
  let added = 0;

  for (const post of json.data ?? []) {
    if (found.has(post.id) || judged.has(post.id)) continue;
    if ((post.referenced_tweets ?? []).some((r) => r.type !== "replied_to")) continue;

    const likes = post.public_metrics?.like_count ?? 0;
    if (likes < MIN_LIKES) continue;

    const author = users.get(post.author_id);
    const followers = author?.public_metrics?.followers_count ?? 0;
    if (!author || !followers || followers > MAX_FOLLOWERS) continue;

    const links = (post.entities?.urls ?? [])
      .map((url) => url.unwound_url ?? url.expanded_url ?? "")
      .filter((url) => url && !url.includes("//x.com/") && !url.includes("//twitter.com/"));

    // Which of the requested domains did this post actually link to? A query of
    // ten domains returns posts for all ten mixed together, and the category
    // comes from the domain rather than from the post.
    const hit = group.find((domain) => links.some((link) => link.includes(domain)));
    if (!hit) continue;

    found.set(post.id, {
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
      links,
      category: categoryOf.get(hit) ?? "",
      domain: hit
    });
    added += 1;
  }

  console.log(`${added.toString().padStart(3)} candidates <- ${group.length} domains`);
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

const all = [...found.values()].sort(
  (a, b) => a.category.localeCompare(b.category) || b.likeCount - a.likeCount
);
writeFileSync("/tmp/cand-urls.json", JSON.stringify(all, null, 2));
console.log(`\n${all.length} candidates -> /tmp/cand-urls.json`);

let current = "";
for (const candidate of all) {
  if (candidate.category !== current) {
    current = candidate.category;
    console.log(`\n===== ${current} =====`);
  }
  console.log(
    `\n${candidate.id} | ${candidate.likeCount} likes · ${Math.round(candidate.engagement)}/1k · ` +
      `@${candidate.username} (${candidate.followers}f) · ${candidate.domain}`
  );
  console.log(`  ${candidate.text.replace(/\s+/g, " ")}`);
}
