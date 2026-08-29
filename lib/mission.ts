/**
 * Everything the AI produces is judged against this goal, and every statistic on
 * /insights exists to answer a question it raises. Edit it here and the whole
 * pipeline re-aims on the next enrichment run.
 */
export const MISSION =
  "Build an AI-powered, no-code platform that lets ordinary people — not software engineers — create, launch, and continuously improve websites and software.";

export const MISSION_SHORT = "AI no-code platform for non-engineers";

/**
 * Who belongs on the roster. This is not a restatement of the mission: the
 * mission is what the owner is building, this is whose output is worth watching
 * while building it. It was written by reading which builders the owner kept and
 * which they removed by hand, and the two rules below are the ones that
 * decision actually followed.
 *
 * Every builder removed by hand failed one of them: platform founders posting
 * company news, AI commentators reacting to other people's releases, indie
 * hackers posting revenue screenshots, and interface people posting tips rather
 * than things they made. Follower count did not save any of them — accounts
 * above 100k were removed while accounts under 3k were kept.
 */
export const ROSTER_RULES = `1. Do they build for the web? Websites, web experiences, interactive and 3D
   pieces, interface components, browser games, or the tools other people build
   those with. Not marketing, not commentary, not fundraising, not AI news.
2. Do they show the result? A link, a video, a demo, a case study — something
   made. Someone who only posts opinions, tips, threads about process, or
   reactions to other people's work does not belong here however large they are.`;

export const ROSTER_THEME =
  "People and studios who build things for the web and post the results: creative and interactive web development, web experiences and 3D, interface craft, browser games, and the tools and libraries used to make them.";

/**
 * A closed vocabulary, not free-form tags. The model may only answer with these
 * values, which is what makes counting across creators and weeks meaningful;
 * free text would fragment into synonyms and never aggregate.
 */
export const THEMES = [
  "app-generation",
  "website-building",
  "ui-components",
  "design-to-code",
  "prototyping",
  "animation-motion",
  "polish-craft",
  "games-interactive",
  "3d-webgl",
  "data-viz",
  "creative-coding",
  "ai-agents",
  "llm-integration",
  "vibe-coding",
  "automation-workflows",
  "devtools-infra",
  "mobile-apps",
  "browser-extensions",
  "internal-tools",
  "content-marketing-tools",
  "ecommerce",
  "education-learning",
  "indie-monetization",
  "image-generation",
  "voice-audio",
  "video"
] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  "app-generation": "Prompt-to-app generation",
  "website-building": "Websites & landing pages",
  "ui-components": "UI components & design systems",
  "design-to-code": "Design or screenshot to code",
  prototyping: "Fast prototyping & MVPs",
  "animation-motion": "Animation & motion",
  "polish-craft": "Polish & craft details",
  "games-interactive": "Games & interactive toys",
  "3d-webgl": "3D & WebGL",
  "data-viz": "Data visualisation",
  "creative-coding": "Creative coding & generative art",
  "ai-agents": "AI agents",
  "llm-integration": "Wiring up LLMs",
  "vibe-coding": "AI-assisted coding workflow",
  "automation-workflows": "Automation & workflows",
  "devtools-infra": "Developer tools & infrastructure",
  "mobile-apps": "Mobile apps",
  "browser-extensions": "Browser extensions",
  "internal-tools": "Internal tools & dashboards",
  "content-marketing-tools": "Content & marketing tools",
  ecommerce: "E-commerce",
  "education-learning": "Education & learning",
  "indie-monetization": "Indie monetisation",
  "image-generation": "Image generation",
  "voice-audio": "Voice & audio",
  video: "Video"
};

/**
 * The kind of work a post is about, and the dimension the category ranking
 * groups by.
 *
 * This is the third attempt and the first one that survived being read against
 * the corpus. The first set could not be counted at all — "utility-tool",
 * "web-app" and "dev-tool" sat side by side with no boundary between them. The
 * second fixed the boundaries but kept twelve values, which split the corpus so
 * finely that eight of them ended up with fewer than five posts each: pairs like
 * component-library and motion-interaction, or dev-tool and creative-tool, were
 * being told apart on a distinction nobody cared about while both were too thin
 * to rank. Seven values with real sample sizes answer more questions than twelve
 * precise ones that each measure noise.
 *
 * Two properties make the set countable, and both matter more than the names:
 *
 *   Every value answers the same question. "What did this post hand over?" A
 *   category is never about who it was for, how it was made, or how finished it
 *   is; those are separate columns.
 *
 *   The set is ordered, and the first match wins. Overlap is unavoidable — a
 *   client site can be full of 3D, a portfolio can be a shader demo — so
 *   ambiguity is resolved by precedence rather than by the model's mood, which
 *   is what stops the same post landing in a different bucket every cycle.
 */
export const PRODUCT_CATEGORIES = [
  "teaching",
  "client-work",
  "game",
  "utility-tool",
  "own-product",
  "interface-craft",
  "interactive-3d",
  "not-work"
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  teaching: "Teaching the craft",
  "client-work": "Client & brand work",
  game: "Games & playable toys",
  "utility-tool": "Tools that get something done",
  "own-product": "Their own site or product",
  "interface-craft": "Interface & UI components",
  "interactive-3d": "Interactive 3D & visuals",
  "not-work": "Not work"
};

/** The only category that means "this post did not hand over any made thing". */
export const NOT_WORK: ProductCategory = "not-work";

/**
 * Everything a person or a post can be said to be about. Same vocabulary for
 * both, so a builder's stated output and the ranking of what resonates can be
 * read against each other.
 */
export const WORK_KINDS = PRODUCT_CATEGORIES.filter(
  (value) => value !== NOT_WORK
) as Exclude<ProductCategory, "not-work">[];

/**
 * A post may carry two categories at most, and a builder two kinds of work.
 *
 * Two is not a compromise between one and many. One is right for almost every
 * post, and the cases where it is wrong are real but narrow: a tutorial that is
 * itself a playable toy, a client site released as an open-source library. A
 * third slot would not describe anything the second cannot; it would only let a
 * post be counted three times in a ranking of seven categories, which is how a
 * leaderboard stops meaning anything.
 *
 * The model is only ever asked for one. The second slot exists for the owner,
 * who is the one person able to tell a genuine double from a hedge.
 */
export const MAX_POST_CATEGORIES = 2;
export const MAX_WORK_KINDS = 2;

/**
 * Accepts a list of category names from a form or a model and returns the ones
 * that are real work categories, deduplicated, in the order given, capped.
 * Everything that writes tags goes through this, so an unknown value can never
 * reach a ranking and be counted as a category of its own.
 */
export function sanitizeWorkKinds(values: unknown, limit = MAX_POST_CATEGORIES) {
  const list = Array.isArray(values) ? values : [values];
  const out: string[] = [];
  for (const value of list) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!WORK_KINDS.includes(trimmed as never)) continue;
    if (out.includes(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The decision procedure handed to the model verbatim. It is written as ordered
 * questions rather than definitions because definitions are what produced the
 * synonym pile-up: asked "is this a utility or a tool", a model will answer
 * differently on Tuesday. Asked "was it delivered to a client — yes or no", it
 * answers the same way every time.
 */
export const PRODUCT_CATEGORY_RULES = `Work through these in order and stop at the first one that fits. Earlier rules
beat later ones even when a later one also seems to apply.

1. not-work — the post hands over nothing that was made. An opinion, a question,
   a joke, industry news, a hiring notice, conference or personal life, praise
   for someone else's work, or an award announcement that does not show the work
   itself. If the only thing being offered is a thought, it is not-work.
2. teaching — the post exists to explain how something is done: a tutorial, a
   written breakdown of a technique, a course, a livestream, a talk, or a
   published lesson. Choose this even when the subject is 3D or a client site,
   because what is handed over is the explanation rather than the thing.
3. client-work — made for someone else: a client, a brand, or an employer.
   "New work", "we designed and built X for Y", a case study, a launch with a
   company name, an award for a named brand project. Choose this however the work
   was built, including when it is heavily 3D or animated, because who it was for
   is the most reliable fact about it.
4. game — something playable, made to be played. A game, a puzzle, or a toy with
   no purpose beyond messing with it.
5. utility-tool — the thing exists to get something done. Anything someone opens
   to produce an outcome: a utility, an editor, a generator, a converter, a
   playground, a dashboard, an app that saves someone time at work or in daily
   life, and equally a library, framework, engine or plugin that does that job
   for people who write code. The test is whether a person would use it to
   accomplish something rather than to look at it. Choose this over own-product
   even when the author built and owns the tool, because what it is matters more
   than who owns it.
6. own-product — the author's own presence or property, not a tool: their
   portfolio, their studio site, a personal site, a personal blog, a redesign of
   their own site, or their own product where the post is about the launch and
   the brand rather than about what it does for you. It must genuinely be theirs;
   work for an employer is client-work. Choose this over the two categories below
   even when the site is full of 3D or animation, because a portfolio is a
   portfolio however it is rendered.
7. interface-craft — the artifact is a piece of interface. A reusable component,
   a UI kit or design system, a set of transitions or effects other people can
   drop in, a hover or scroll behaviour, a micro-interaction, an animated
   component, a layout or typographic detail. Both the still thing and its
   behaviour belong here: a button someone can install and the way that button
   moves are the same kind of work. Choose this over interactive-3d whenever the
   thing shown is part of an interface, even if it is rendered with WebGL.
8. interactive-3d — the artifact is a scene or a visual, shown for what it looks
   like rather than for what it does: a 3D scene, a shader, a simulation, a
   particle or fluid study, a generative or audiovisual piece, a WebGL
   experiment, or a data-driven visual made to be looked at and explored. If
   there is no interface and no task, and the point is the image, it is this.

Choose exactly one, always. If two rules seem to fit, the earlier one wins; that
is what the order is for, and hedging is what made an earlier pass of this corpus
impossible to count.

Two habits to avoid, both seen in earlier passes of this corpus:
  A post can show real work in a video or a link with almost no words. "progress
  63", "new stream", or a bare link from someone whose whole feed is 3D scenes is
  still work — use what you know about the author and pick the kind they build.
  Do not reach for not-work just because the text is short.
  The reverse is also true: enthusiasm about someone else's release, a thread of
  advice, or a screenshot of revenue is not-work no matter how long it is.`;

export const ARTIFACTS = [
  "app",
  "website",
  "ui-component",
  "game",
  "tool",
  "agent",
  "demo",
  "library",
  "content",
  "none"
] as const;

export type Artifact = (typeof ARTIFACTS)[number];

export const ARTIFACT_LABELS: Record<Artifact, string> = {
  app: "A working app",
  website: "A website or page",
  "ui-component": "A UI component",
  game: "A game or toy",
  tool: "A utility tool",
  agent: "An AI agent",
  demo: "A visual demo",
  library: "A library or package",
  content: "Writing or video",
  none: "No artifact shipped"
};

export const INTENTS = [
  "ship",
  "demo",
  "progress",
  "tutorial",
  "opinion",
  "question",
  "promo"
] as const;

export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  ship: "Shipped something finished",
  demo: "Showed a demo",
  progress: "Work in progress",
  tutorial: "Taught how to do it",
  opinion: "Shared a take",
  question: "Asked the audience",
  promo: "Promotion"
};

export const AUDIENCES = ["developers", "designers", "non-technical", "mixed"] as const;

export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  developers: "Developers",
  designers: "Designers",
  "non-technical": "Non-technical people",
  mixed: "Mixed audience"
};

/**
 * Shorter forms of the same vocabulary, for the chips under a builder's name
 * where the sentence around them already supplies the verb.
 */
export const WORK_KIND_LABELS: Record<ProductCategory, string> = {
  teaching: "teaching",
  "client-work": "client work",
  game: "games",
  "utility-tool": "tools",
  "own-product": "own products",
  "interface-craft": "interface & UI",
  "interactive-3d": "3D & visuals",
  "not-work": "unclear"
};

export function productCategoryLabel(value: string) {
  return PRODUCT_CATEGORY_LABELS[value as ProductCategory] ?? value;
}

export function workKindLabel(value: string) {
  return WORK_KIND_LABELS[value as ProductCategory] ?? value;
}

export function themeLabel(value: string) {
  return THEME_LABELS[value as Theme] ?? value;
}

export function artifactLabel(value: string) {
  return ARTIFACT_LABELS[value as Artifact] ?? value;
}

export function intentLabel(value: string) {
  return INTENT_LABELS[value as Intent] ?? value;
}

export function audienceLabel(value: string) {
  return AUDIENCE_LABELS[value as Audience] ?? value;
}
