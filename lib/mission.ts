/**
 * Everything the AI produces is judged against this goal, and every statistic on
 * /insights exists to answer a question it raises. Edit it here and the whole
 * pipeline re-aims on the next enrichment run.
 */
export const MISSION =
  "Build an AI-powered, no-code platform that lets ordinary people — not software engineers — create, launch, and continuously improve websites and software.";

export const MISSION_SHORT = "AI no-code platform for non-engineers";

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
 * What kind of product the post is about. This is the dimension the category
 * ranking groups by, and it is deliberately product-shaped ("a small tool that
 * does one job") rather than form-shaped, because the question it answers is
 * what an ordinary person would want to make — not what file type it shipped as.
 */
export const PRODUCT_CATEGORIES = [
  "utility-tool",
  "web-app",
  "website",
  "game",
  "ui-kit",
  "dev-tool",
  "ai-agent",
  "creative-visual",
  "data-dashboard",
  "mobile-app",
  "browser-extension",
  "content-course",
  "api-service",
  "automation",
  "none"
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  "utility-tool": "Utility tool",
  "web-app": "Web app",
  website: "Website or landing page",
  game: "Game or playable toy",
  "ui-kit": "UI kit or design system",
  "dev-tool": "Developer tool",
  "ai-agent": "AI agent or assistant",
  "creative-visual": "Creative visual piece",
  "data-dashboard": "Dashboard or data view",
  "mobile-app": "Mobile app",
  "browser-extension": "Browser extension",
  "content-course": "Course or written content",
  "api-service": "API or service",
  automation: "Automation or workflow",
  none: "No product"
};

/**
 * How each category is described to the model. Vague category names are the main
 * cause of drifting tags, so each one gets a boundary rather than a synonym.
 */
export const PRODUCT_CATEGORY_RULES = `- utility-tool: a small focused thing that does one job well (a measurement overlay, a converter, a generator)
- web-app: a multi-feature application someone signs into or uses repeatedly
- website: a marketing site, landing page, portfolio, or microsite
- game: a game or a playable toy with no purpose beyond play
- ui-kit: components, primitives, templates, or a design system for others to build with
- dev-tool: tooling whose user is a programmer (CLI, library, build tool, debugger)
- ai-agent: something that acts on the user's behalf, not just answers
- creative-visual: a 3D scene, shader, generative artwork, or motion piece shown for its own sake
- data-dashboard: charts, analytics, or a data view
- mobile-app: an iOS or Android app
- browser-extension: an extension
- content-course: the product is the teaching itself (a course, tutorial series, video, article)
- api-service: a backend, API, or hosted service
- automation: a workflow, integration, or pipeline that runs without a person
- none: the post is an opinion, a question, or news, with no product in it`;

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

export function productCategoryLabel(value: string) {
  return PRODUCT_CATEGORY_LABELS[value as ProductCategory] ?? value;
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
