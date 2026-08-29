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
 * groups by. This list replaced an earlier one that could not be counted: it had
 * "utility-tool", "web-app", "dev-tool" and "api-service" as separate values
 * with no boundary between them, no value at all for the most common kind of
 * work on the roster — a site built for a client — and a catch-all
 * "creative-visual" that swallowed a third of the corpus.
 *
 * Two properties make this set countable, and both matter more than the names:
 *
 *   Every value answers the same question. "What did this post hand over?" A
 *   category is never about who it was for, how it was made, or how finished it
 *   is; those are separate columns.
 *
 *   The set is ordered, and the first match wins. Overlap is unavoidable — a
 *   client site can be full of 3D, a tutorial can be about a shader — so
 *   ambiguity is resolved by precedence rather than by the model's mood, which
 *   is what stops the same post landing in a different bucket every cycle.
 */
export const PRODUCT_CATEGORIES = [
  "teaching",
  "client-site",
  "own-site",
  "component-library",
  "dev-tool",
  "creative-tool",
  "game-toy",
  "motion-interaction",
  "interactive-3d",
  "data-visual",
  "web-app",
  "not-work"
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  teaching: "Teaching the craft",
  "client-site": "Site or experience for a client",
  "own-site": "Their own site or portfolio",
  "component-library": "UI components & libraries",
  "dev-tool": "Tools & libraries for developers",
  "creative-tool": "Tools for making things",
  "game-toy": "Games & playable toys",
  "motion-interaction": "Motion & interaction craft",
  "interactive-3d": "3D, shaders & generative visuals",
  "data-visual": "Data visualisation",
  "web-app": "Working app or product",
  "not-work": "Not work"
};

/** The only category that means "this post did not hand over any made thing". */
export const NOT_WORK: ProductCategory = "not-work";

/** Everything a person can be said to build. Same vocabulary as the post categories. */
export const WORK_KINDS = PRODUCT_CATEGORIES.filter(
  (value) => value !== NOT_WORK
) as Exclude<ProductCategory, "not-work">[];

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
2. teaching — the post exists to explain how something is done: a tutorial,
   a written breakdown of a technique, a course, a livestream, a talk, or a
   published lesson. Choose this even when the subject is 3D or a client site,
   because what is handed over is the explanation.
3. client-site — a website or web experience made for a client, a brand, or an
   employer. "New work", "we designed and built X for Y", a case study, a launch
   with a company name, a site-of-the-day for a named brand project. Choose this
   however the site was built, including when it is heavily 3D or animated.
4. own-site — a site the author made for themselves: their portfolio, their
   studio site, a personal site, or the landing page for their own product.
5. component-library — reusable interface pieces other people install into their
   own UI: a component, a set of transitions or effects, a design system.
6. dev-tool — tooling for people who write code, and not a UI component: a
   library, framework, engine, renderer, plugin, editor extension, or a
   contribution to one.
7. creative-tool — an application whose whole point is that someone else makes
   something visual with it: an editor, a generator, a playground, a canvas.
8. game-toy — something playable. A game, a puzzle, or a toy with no purpose
   beyond messing with it.
9. motion-interaction — the artifact is the behaviour of an interface: a
   transition, a hover or scroll effect, a micro-interaction, an animated
   component. Choose this over interactive-3d when the thing shown is a piece of
   interface, even if it is rendered with WebGL.
10. interactive-3d — the artifact is a scene or a visual rather than an
   interface: a 3D scene, a shader, a simulation, a generative or audiovisual
   piece, shown for what it looks like.
11. data-visual — the artifact is driven by a dataset: a chart, a map, an
   explorable data piece.
12. web-app — a working application or product where the point is what it does
   rather than how it looks or who it was for.

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
  "client-site": "client sites",
  "own-site": "own sites",
  "component-library": "UI components",
  "dev-tool": "developer tools",
  "creative-tool": "tools for makers",
  "game-toy": "games & toys",
  "motion-interaction": "motion & interaction",
  "interactive-3d": "3D & shaders",
  "data-visual": "data visualisation",
  "web-app": "apps & products",
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
