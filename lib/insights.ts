import {
  aiModel,
  asEnum,
  asEnumList,
  asScore,
  asText,
  asTextList,
  getAiClient,
  hasAi,
  parseJsonObject
} from "@/lib/ai";
import {
  ARTIFACTS,
  AUDIENCES,
  INTENTS,
  MISSION,
  NOT_WORK,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_RULES,
  ROSTER_THEME,
  THEMES,
  type Artifact,
  type Audience,
  type Intent,
  type ProductCategory,
  type Theme
} from "@/lib/mission";

export type PostTag = {
  id: string;
  themes: Theme[];
  artifact: Artifact;
  productCategory: ProductCategory;
  intent: Intent;
  audience: Audience;
  nocodeSignal: number;
  note: string;
};

/**
 * The rolling read of one builder, plus a tag for each of their recent posts.
 *
 * There is deliberately nothing here that the directory card displays. The tags
 * and the description under a builder's name are the owner's, set by hand and
 * never overwritten, so this call exists to feed the statistics and the brief.
 */
export type CreatorFocus = {
  summary: string;
  products: string[];
  themes: Theme[];
  relevance: number | null;
  opportunity: string;
  posts: PostTag[];
};

export type FocusInput = {
  username: string;
  name: string;
  description: string;
  followersCount: number | null;
  posts: Array<{ id: string; text: string; createdAt: string; likeCount: number }>;
};

/**
 * The analysis window: how many of a builder's newest posts one call covers.
 *
 * Tagging deliberately uses the same window as the summary. A post therefore gets
 * tagged while it is still inside the window, keeps that tag once it falls out,
 * and is never looked at again. Selecting candidates on any wider definition of
 * "untagged" would make builders with long histories eligible forever, since
 * posts outside the window can never be reached.
 */
export const ANALYSIS_WINDOW = 20;

/**
 * Bumped whenever the tagging prompt or vocabulary changes. Rows tagged under an
 * older version are re-tagged, because a leaderboard built from two different
 * prompts would partly be ranking the prompt rather than the posts. Version 2
 * added product_category and the boundary rules that go with it. Version 3
 * replaced that category set outright. Version 4 merged it down to seven values
 * and reordered them, which changes real judgements and not only names: a
 * builder's own utility now files as a tool rather than as their own product.
 */
export const PROMPT_VERSION = 4;

const postTagSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "themes",
    "artifact",
    "product_category",
    "intent",
    "audience",
    "nocode_signal",
    "note"
  ],
  properties: {
    id: { type: "string" },
    themes: { type: "array", items: { type: "string", enum: [...THEMES] } },
    artifact: { type: "string", enum: [...ARTIFACTS] },
    product_category: { type: "string", enum: [...PRODUCT_CATEGORIES] },
    intent: { type: "string", enum: [...INTENTS] },
    audience: { type: "string", enum: [...AUDIENCES] },
    nocode_signal: { type: "integer", minimum: 0, maximum: 100 },
    note: { type: "string" }
  }
} as const;

const focusSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "products", "themes", "relevance", "opportunity", "posts"],
  properties: {
    summary: { type: "string" },
    products: { type: "array", items: { type: "string" } },
    themes: { type: "array", items: { type: "string", enum: [...THEMES] } },
    relevance: { type: "integer", minimum: 0, maximum: 100 },
    opportunity: { type: "string" },
    posts: { type: "array", items: postTagSchema }
  }
} as const;

function perThousand(likes: number, followers: number | null) {
  if (!followers) return "unknown";
  return `${((likes / followers) * 1000).toFixed(1)} likes per 1k followers`;
}

/**
 * Reads one builder's recent posts and returns both a rolling description of what
 * they are working on and a tag for every post supplied. Tagging rides along with
 * the summary because the model needs the same context for both, and one call is
 * cheaper and more coherent than twenty.
 */
export async function summariseCreator(input: FocusInput): Promise<CreatorFocus | null> {
  if (!hasAi()) return null;

  const posts = input.posts.slice(0, ANALYSIS_WINDOW);
  const postLines = posts
    .map(
      (post) =>
        `[id ${post.id}] (${post.createdAt.slice(0, 10)}, ${post.likeCount} likes, ${perThousand(
          post.likeCount,
          input.followersCount
        )})\n${post.text.replace(/\s+/g, " ").slice(0, 600)}`
    )
    .join("\n\n");

  const prompt = `You are the research analyst for a founder with this goal:
"${MISSION}"

To learn what people actually want built, the founder tracks a curated roster of ${ROSTER_THEME}

Study one builder from that roster and report what they actually make.

About this builder
- "summary" is 2 to 4 sentences on their work: what they make, who it is for, and where they are heading. Name concrete things, not adjectives. Do not describe their posting style.
- "products" lists named products, sites, tools or projects they are visibly working on. Real names only. Empty array if none are named.
- "relevance" scores 0-100 how much watching this builder teaches the founder about what people want built on the web and what makes it resonate. Someone shipping visible web work that an ordinary person would want to make scores high. Someone posting mainly company news, industry commentary, or work with no visible result scores low, however large their following.
- "opportunity" is one or two sentences on what the founder should take from this builder. Concrete, not encouragement.

Tagging their posts
- "posts" must contain exactly one entry for every post id given below, using the id verbatim.
- "note" is a short phrase naming what was built or claimed in that post.
- "nocode_signal" scores 0-100 how strongly the post is evidence that people who cannot code would want to make this kind of thing themselves.
- "product_category" is the kind of work the post hands over. This is the dimension the whole corpus is ranked by, so consistency matters more than nuance. Follow this procedure exactly:
${PRODUCT_CATEGORY_RULES}

Builder: @${input.username} (${input.name})
Followers: ${input.followersCount ?? "unknown"}
Bio: ${input.description || "(none)"}

Recent original posts. Links are shortened by X, so a post may be a caption on a video or image you cannot see; the caption plus what you know of this builder is usually enough to tell what was handed over.
${postLines || "(no recent posts available)"}`;

  const client = getAiClient();
  const response = await client.responses.create({
    model: aiModel(),
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "builder_focus",
        strict: true,
        schema: focusSchema
      }
    }
  });

  const parsed = parseJsonObject(response.output_text);
  if (!parsed) return null;

  const allowedIds = new Set(posts.map((post) => post.id));
  const rawPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
  const seen = new Set<string>();
  const tags: PostTag[] = [];

  for (const entry of rawPosts) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = asText(record.id);
    // Models occasionally invent or repeat ids; only tags that map to a real post
    // we asked about may reach the database.
    if (!allowedIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    tags.push({
      id,
      themes: asEnumList(record.themes, THEMES),
      artifact: asEnum(record.artifact, ARTIFACTS, "none"),
      productCategory: asEnum(record.product_category, PRODUCT_CATEGORIES, NOT_WORK),
      intent: asEnum(record.intent, INTENTS, "opinion"),
      audience: asEnum(record.audience, AUDIENCES, "mixed"),
      nocodeSignal: asScore(record.nocode_signal, 0) ?? 0,
      note: asText(record.note).slice(0, 240)
    });
  }

  const summary = asText(parsed.summary);
  if (!summary) return null;

  return {
    summary: summary.slice(0, 900),
    products: asTextList(parsed.products, 6, 80),
    themes: asEnumList(parsed.themes, THEMES, 6),
    relevance: asScore(parsed.relevance),
    opportunity: asText(parsed.opportunity).slice(0, 600),
    posts: tags
  };
}

export type StrategyBrief = {
  headline: string;
  demandRead: string;
  opportunities: Array<{ title: string; detail: string; evidence: string }>;
  gaps: Array<{ title: string; detail: string }>;
  recommendations: Array<{ action: string; why: string }>;
  watchlist: Array<{ username: string; why: string }>;
};

const briefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "demand_read", "opportunities", "gaps", "recommendations", "watchlist"],
  properties: {
    headline: { type: "string" },
    demand_read: { type: "string" },
    opportunities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "evidence"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          evidence: { type: "string" }
        }
      }
    },
    gaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail"],
        properties: { title: { type: "string" }, detail: { type: "string" } }
      }
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "why"],
        properties: { action: { type: "string" }, why: { type: "string" } }
      }
    },
    watchlist: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["username", "why"],
        properties: { username: { type: "string" }, why: { type: "string" } }
      }
    }
  }
} as const;

/**
 * Turns the computed statistics into a reading of the market. The model is given
 * the numbers rather than the raw corpus so its claims stay anchored to what was
 * actually measured.
 */
export async function writeStrategyBrief(evidence: string): Promise<StrategyBrief | null> {
  if (!hasAi()) return null;

  const prompt = `You advise a founder with this goal:
"${MISSION}"

Below are measured statistics from a curated set of design engineers and creative developers on X. Engagement rate is likes divided by the author's follower count, so it compares resonance across audiences of different sizes. Breakout multiple compares a post against that same author's own median, so a high value means the audience wanted that specific thing far more than they usually want that author's work. Sample sizes are given as n; treat any n below 5 as weak evidence and say so rather than overclaiming.

Write a brief the founder can act on.

Rules:
- "headline" is one sentence naming the single most important thing the data says.
- "demand_read" is 3 to 5 sentences on what this audience actually rewards and what that implies about what ordinary people will want to build. Cite specific numbers from the evidence.
- "opportunities" has 2 to 4 entries. "evidence" must quote the specific statistic that supports it.
- "gaps" has 2 to 3 entries naming what this data does NOT tell the founder, or where the sample is too thin or too developer-skewed to trust.
- "recommendations" has 3 to 5 concrete next actions for the product.
- "watchlist" names up to 4 usernames from the evidence worth watching closely, with the reason.
- Be specific and quantitative. Never pad. If the evidence is thin, say which numbers you would need.

EVIDENCE
${evidence}`;

  const client = getAiClient();
  const response = await client.responses.create({
    model: aiModel(),
    input: prompt,
    text: {
      format: { type: "json_schema", name: "strategy_brief", strict: true, schema: briefSchema }
    }
  });

  const parsed = parseJsonObject(response.output_text);
  if (!parsed) return null;

  const objectList = <K extends string>(value: unknown, keys: K[], limit: number) => {
    if (!Array.isArray(value)) return [];
    const out: Array<Record<K, string>> = [];
    for (const entry of value) {
      if (typeof entry !== "object" || entry === null) continue;
      const record = entry as Record<string, unknown>;
      const mapped = {} as Record<K, string>;
      let usable = false;
      for (const key of keys) {
        mapped[key] = asText(record[key]).slice(0, 600);
        if (mapped[key]) usable = true;
      }
      if (usable) out.push(mapped);
      if (out.length >= limit) break;
    }
    return out;
  };

  const headline = asText(parsed.headline);
  if (!headline) return null;

  return {
    headline: headline.slice(0, 300),
    demandRead: asText(parsed.demand_read).slice(0, 2000),
    opportunities: objectList(parsed.opportunities, ["title", "detail", "evidence"], 4),
    gaps: objectList(parsed.gaps, ["title", "detail"], 4),
    recommendations: objectList(parsed.recommendations, ["action", "why"], 5),
    // The model returns handles with or without the @, and the page adds its own.
    watchlist: objectList(parsed.watchlist, ["username", "why"], 4).map((entry) => ({
      ...entry,
      username: entry.username.replace(/^@+/, "")
    }))
  };
}
