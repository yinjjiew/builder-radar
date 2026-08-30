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
 * Arrived at by reading the corpus against each draft and correcting by hand.
 * The first set could not be counted at all — "utility-tool", "web-app" and
 * "dev-tool" sat side by side with no boundary between them. The second fixed
 * the boundaries but kept twelve values, which split the corpus so finely that
 * eight of them held fewer than five posts each. This one settles two questions
 * the earlier sets got wrong:
 *
 *   Every value describes the artifact, never the post. A category that meant
 *   "the post is teaching" swept up tutorials about work belonging in five
 *   different buckets, which is why explanation now falls under not-work and
 *   'education' means the made thing itself teaches.
 *
 *   The interactive split is by dimension, not by feel. "3D, visuals & toys" was
 *   one bucket holding a raymarched world and a CSS gradient study, and no
 *   definition could keep those together honestly. "Is there a space with depth?"
 *   is answerable the same way by two different readers, which is the only
 *   property a boundary actually needs.
 *
 * The set is ordered and the first match wins. Overlap is unavoidable — a client
 * site can be full of 3D, a portfolio can be a shader demo — so ambiguity is
 * resolved by precedence rather than by the model's mood, which is what stops
 * the same post landing in a different bucket every cycle.
 */
export const PRODUCT_CATEGORIES = [
  "client-work",
  "education",
  "game",
  "own-site",
  "building-block",
  "web-app",
  "interactive-3d",
  "visual-2d",
  "not-work"
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  "client-work": "Client & brand work",
  education: "Educational apps",
  game: "Games",
  "own-site": "Personal & studio sites",
  "building-block": "Building blocks",
  "web-app": "Practical web apps",
  "interactive-3d": "Interactive 3D",
  "visual-2d": "2D visuals & toys",
  "not-work": "Deleted"
};

/** The only category that means "this post did not hand over any made thing". */
export const NOT_WORK: ProductCategory = "not-work";

/**
 * Everything a person or a post can be said to be about. Same vocabulary for
 * both, so a builder's stated output and the ranking of what resonates can be
 * read against each other.
 */
export const WORK_KINDS = PRODUCT_CATEGORIES.filter((value) => value !== NOT_WORK) as Exclude<
  ProductCategory,
  "not-work"
>[];

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

Every category describes the artifact — the made thing the post hands over. None
of them describes the post. This is the rule that earlier versions broke: a
category that meant "the post is teaching" collected tutorials about work that
belonged in five different buckets, and the counts stopped meaning anything.

1. not-work — no made thing is handed over. An opinion, a question, a joke,
   industry news, a hiring notice, conference or personal life, praise for
   someone else's work, an award announcement that does not show the work itself.

   A post that only explains belongs here too, and this is the change: a tutorial
   thread, a written breakdown, a CSS tip, a livestream announcement, a
   conference talk. The explanation is not an artifact. If the post also links to
   something usable — a demo, a repo, a component, a live page — categorise that
   thing instead and ignore the fact that the post explains it.
2. client-work — the artifact was made for someone else: a client, a brand, an
   employer. "New work", "we designed and built X for Y", a case study, a launch
   with a company name, an award for a named brand project. Choose this however
   the work was built, including when it is heavily 3D or animated, because who
   it was for is the most reliable fact about it.
3. education — the artifact itself teaches. Its content is the lesson: an
   interactive explainer, a learning app, a course or lesson platform, a study
   aid, a simulation or visualisation built so that a concept becomes clear, a
   thing made to teach children or students.

   The test is whether the thing teaches, not whether the post teaches. A post
   explaining how the author built a solar system is rule 1; an interactive solar
   system built so you learn the planets is this. Because this beats everything
   below, a game made to teach and an explanatory visualisation are both
   education: what a thing is for says more than what it is made of.
4. game — a game. Something with rules and an objective that a person plays:
   levels, a score, a win or a lose, a puzzle to solve, a character to control,
   an opponent to beat. The test is whether it can be played to completion or to
   failure. A scene you can drag, spin, click or disturb has no objective and is
   not a game however satisfying it is to poke — that is rule 7 or 8.
5. own-site — the artifact presents a person or a company: their portfolio, their
   studio site, a personal site or blog, a personal log of their own life or
   work, a redesign of their own site, a company page showing off its own output.
   The point is presenting whose it is. It must genuinely be theirs; the same
   page built for an employer is client-work. Choose this over everything below
   even when the site is full of 3D, because a portfolio is a portfolio however
   it is rendered — including when they open-source it, since it is still their
   portfolio.
6. building-block — the artifact is a part, and you take it away and use it in
   your own work. A component library, a UI kit or design system, a set of
   transitions or effects other people can drop in, an npm package, a framework,
   engine or plugin, and equally the small factory that produces such a part: a
   font editor, an icon or image generator, a button or gradient generator, a
   mockup maker, a shader or asset exporter.

   The test is what you leave with. If you leave with a piece that goes into
   something you are building, it is this. If you leave with an answer or a
   finished task, it is rule 7.
7. web-app — the artifact is a web app that gets something done. You open it and
   it does a job for you: a workflow someone assembled, a calculator, a
   converter, a dashboard, an editor, a planner, an app that saves time at work
   or in daily life. The test is that what you leave with is an outcome rather
   than a part.
8. interactive-3d — the artifact is a three-dimensional scene, shown for what it
   looks like rather than for what it does. There is a space with depth: a
   camera, perspective, geometry, a model, a world you can move through or orbit.
   Three.js and WebGL scenes, 3D product showcases with no task, raymarched
   scenes, 3D particle and fluid simulations, 3D toys you can push around.
9. visual-2d — the artifact is a flat visual or a flat toy: canvas, SVG or CSS
   visuals, 2D generative art, a flat shader pattern, a gradient or noise study,
   a flow field, a pixel or image effect, a cursor-following blob, a 2D physics
   toy, a data visualisation drawn on a plane.

   Rules 8 and 9 are told apart by one question only: is there a
   three-dimensional space? Depth, perspective, a camera, geometry — then 8. Flat
   — then 9. Do not use how impressive it looks, or the library it was built
   with, and note that a fragment shader can be either: a raymarched scene is 3D,
   a flat pattern is 2D. Toys are not their own category; a 3D toy is 8 and a 2D
   toy is 9.

Choose exactly one, always. If two rules seem to fit, the earlier one wins; that
is what the order is for, and hedging is what made an earlier pass of this corpus
impossible to count.

Two habits to avoid, both seen in earlier passes of this corpus:
  A post can show real work in a video or a link with almost no words. "progress
  63" or a bare link from someone whose whole feed is 3D scenes is still work —
  use what you know about the author and pick the kind they build. Do not reach
  for not-work just because the text is short.
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
  "client-work": "client work",
  education: "education",
  game: "games",
  "own-site": "personal & studio sites",
  "building-block": "building blocks",
  "web-app": "web apps",
  "interactive-3d": "3D",
  "visual-2d": "2D visuals",
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
