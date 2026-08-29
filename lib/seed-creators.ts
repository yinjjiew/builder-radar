/**
 * The curated roster. Every handle here was verified against the X API, and
 * every builder's recent posts were read before they were added — 23 plausible
 * handles turned out not to exist, and a further 37 accounts existed but were
 * cut after reading their feed.
 *
 * This list replaced an earlier one that was wrong in a specific way worth
 * recording, because the same mistake is easy to make again. The first roster
 * was assembled by asking "is this person adjacent to the market?", which let in
 * platform founders posting company news, AI commentators reacting to other
 * people's releases, indie hackers posting revenue, and interface people posting
 * advice. The owner reviewed it by hand and removed 36 of 50, including every
 * account over 200k followers, then added 14 of their own between 2k and 33k.
 *
 * So the question is not adjacency, it is `ROSTER_RULES` in lib/mission.ts:
 * do they build for the web, and do they show the result. Screening applied it
 * to evidence rather than reputation — the last five original posts of every
 * candidate — which is why several well-known names are absent:
 *
 *   Inactive. A studio whose newest post is from 2023 cannot report on what is
 *   being built now, however good the back catalogue: North Kingdom, Instrument,
 *   Cuberto, makemepulse, Upperquad, timrodenbroeker, sxywu, NadiehBremer.
 *   Commentary rather than work. steveruizok, joshpuckett, wagerfield and mamuso
 *   all build real things; their feeds are mostly takes about building.
 *   Other people's work. Codrops and its editor publish the best index of this
 *   world, and awwwards and siteinspire curate it, but a ranking of posts is a
 *   ranking of whose work is being shown — theirs would credit the showcase.
 *   Product marketing. Framer, Webflow, Rive, tldraw and GSAP post release notes
 *   to an audience, which is a different act from a builder showing a result.
 *
 * `bucket` groups a builder for reading statistics by cohort. It is a curation
 * decision, unlike the AI-assigned tags on posts.
 */
export const seedCreators = [
  // --- Creative studios: they post the work they deliver, with the client named ---
  {
    username: "active_theory",
    label: "Active Theory",
    bucket: "studio",
    summary: "Experience studio behind many of the most-awarded interactive sites."
  },
  {
    username: "lusionltd",
    label: "Lusion",
    bucket: "studio",
    summary: "Real-time interactive experiences; heavy WebGL, consistently award-winning."
  },
  {
    username: "resn_has_no_i",
    label: "Resn",
    bucket: "studio",
    summary: "Long-running interactive studio; narrative-led brand experiences."
  },
  {
    username: "Immersive_g",
    label: "Immersive Garden",
    bucket: "studio",
    summary: "Awwwards studio of the year; immersive sites for culture and luxury brands."
  },
  {
    username: "uns__nstudio",
    label: "Unseen Studio",
    bucket: "studio",
    summary: "Design and development studio; typography-forward interactive sites."
  },
  {
    username: "MerciMichel",
    label: "Merci-Michel",
    bucket: "studio",
    summary: "French digital experience studio; playful, game-adjacent brand sites."
  },
  {
    username: "Holographikco",
    label: "Holographik",
    bucket: "studio",
    summary: "Creative digital studio; 3D and motion-led client work."
  },
  {
    username: "basementstudio",
    label: "basement.studio",
    bucket: "studio",
    summary: "Digital studio that also ships public tools; built and runs Shader Lab."
  },
  {
    username: "studiofreight",
    label: "Studio Freight",
    bucket: "studio",
    summary: "Creative studio; posts brand and web cases, and originated Lenis."
  },
  {
    username: "obys_agency",
    label: "Obys",
    bucket: "studio",
    summary: "Awwwards studio of the year; concept-driven sites and published experiments."
  },
  {
    username: "AntinomyStudio",
    label: "Antinomy Studio",
    bucket: "studio",
    summary: "Announces client work in detail: MetaMask, Waabi, Shopify front-ends."
  },
  {
    username: "14islands",
    label: "14islands",
    bucket: "studio",
    summary: "Design and technology agency; posts each site launch with the case study."
  },

  // --- Creative developers: individuals shipping interactive and 3D web work ---
  {
    username: "mrdoob",
    label: "Ricardo Cabello",
    bucket: "creative-dev",
    summary: "Created Three.js; the library most of this roster builds on."
  },
  {
    username: "bruno_simon",
    label: "Bruno Simon",
    bucket: "creative-dev",
    summary: "Three.js Journey; the best-known teacher of 3D on the web."
  },
  {
    username: "AristideBenoist",
    label: "Aristide Benoist",
    bucket: "creative-dev",
    summary: "Bespoke sites for Netflix, A24 and Google; independent creative developer."
  },
  {
    username: "Andersonmancini",
    label: "Anderson Mancini",
    bucket: "creative-dev",
    summary: "Freelance creative developer and teacher; Three.js effects and portfolios."
  },
  {
    username: "techartist_",
    label: "Tech Artist",
    bucket: "creative-dev",
    summary: "Experiments in code, form, light and motion; shaders and interfaces."
  },
  {
    username: "niccolomiranda",
    label: "Niccolò Miranda",
    bucket: "creative-dev",
    summary: "Creative technologist; founded Revelium, speaks on interactive work."
  },
  {
    username: "Anemolito",
    label: "Daniel Velasquez",
    bucket: "creative-dev",
    summary: "Teaches and practises creative development; React and Three.js."
  },
  {
    username: "QuentinHocde",
    label: "Quentin Hocdé",
    bucket: "creative-dev",
    summary: "Independent interactive developer collaborating with award-winning studios."
  },
  {
    username: "makio64",
    label: "David Ronai",
    bucket: "creative-dev",
    summary: "Organises Three.js Conf; builds immersive web experiences."
  },
  {
    username: "grc_michael",
    label: "Michaël Garcia",
    bucket: "creative-dev",
    summary: "French interactive developer; GSAP-heavy site work."
  },
  {
    username: "RobinPayot",
    label: "Robin Payot",
    bucket: "creative-dev",
    summary: "Senior freelance creative developer; immersive sites since 2013."
  },
  {
    username: "Anais_Iris_L",
    label: "Anais Iris",
    bucket: "creative-dev",
    summary: "Art director and web designer; Framer and 3D, ex-Immersive Garden."
  },
  {
    username: "_Thibka",
    label: "Thibaut Foussard",
    bucket: "creative-dev",
    summary: "Creative developer; made Three.js Light Kit."
  },
  {
    username: "mattdesl",
    label: "Matt DesLauriers",
    bucket: "creative-dev",
    summary: "Generative artist and renderer author; interactive work shown in galleries."
  },
  {
    username: "XorDev",
    label: "XorDev",
    bucket: "creative-dev",
    summary: "Shader artist; posts tiny GLSL pieces that reliably outperform their reach."
  },
  {
    username: "thespite",
    label: "Jaume Sanchez Elias",
    bucket: "creative-dev",
    summary: "WebGL and WebXR developer; long stream of finished graphics experiments."
  },
  {
    username: "akella",
    label: "Yuri Artiukh",
    bucket: "creative-dev",
    summary: "Livecodes Three.js and GLSL, often rebuilding effects from award-winning sites."
  },
  {
    username: "onirenaud",
    label: "Renaud Rohlinger",
    bucket: "creative-dev",
    summary: "WebGPU work at the frontier: million-particle fluid sims, on-device tracking."
  },
  {
    username: "nicolasdnl",
    label: "Nicolas Danielou",
    bucket: "creative-dev",
    summary: "Makes art with code; numbered generative series and his own site."
  },
  {
    username: "ikeryou",
    label: "Ryo Ikeda",
    bucket: "creative-dev",
    summary: "Posts a numbered interaction experiment almost daily; pure craft, no commentary."
  },
  {
    username: "CantBeFaraz",
    label: "Faraz Shaikh",
    bucket: "creative-dev",
    summary: "3D graphics lead; WebGPU techniques and open-source Three.js libraries."
  },
  {
    username: "benhouston3d",
    label: "Ben Houston",
    bucket: "creative-dev",
    summary: "Contributes graphics internals to Three.js; explains each change with a demo."
  },
  {
    username: "clementroche_",
    label: "Clément Roche",
    bucket: "creative-dev",
    summary: "Created Lenis; co-founded Darkroom, whose code runs on major brand sites."
  },
  {
    username: "DavidHckh",
    label: "David Heckh",
    bucket: "creative-dev",
    summary: "Freelance developer; open-sourced his WebGL portfolio to unusual reception."
  },
  {
    username: "thenoumenon",
    label: "The Noumenon",
    bucket: "creative-dev",
    summary: "Design engineer and shader coder; posts full breakdowns of each visual layer."
  },
  {
    username: "brunoimbrizi",
    label: "Bruno Imbrizi",
    bucket: "creative-dev",
    summary: "Creative coder; generative series and standalone interactive tools."
  },
  {
    username: "mustache_dev",
    label: "Mustache",
    bucket: "creative-dev",
    summary: "Creative developer doing 3D client work, mostly for French brands."
  },
  {
    username: "keithclarkcouk",
    label: "Keith Clark",
    bucket: "creative-dev",
    summary: "Pushes what a browser can do; renderers, engines and in-browser editors."
  },

  // --- Design engineers: interface craft, shipped as components and demos ---
  {
    username: "jh3yy",
    label: "Jhey Tompkins",
    bucket: "design-engineer",
    summary: "Interface experiments in CSS and JS, published as working demos."
  },
  {
    username: "Ibelick",
    label: "Julien Thibeaut",
    bucket: "design-engineer",
    summary: "Ships components and small tools rather than opinions about them."
  },
  {
    username: "thebuggeddev",
    label: "The Bugged Dev",
    bucket: "design-engineer",
    summary: "Design engineer building in public; interface details and small products."
  },
  {
    username: "jesper_vos",
    label: "Jesper Vos",
    bucket: "design-engineer",
    summary: "Design engineer; founded Maneken, ships interface work."
  },
  {
    username: "Jakubantalik",
    label: "Jakub Antalík",
    bucket: "design-engineer",
    summary: "Releases free interaction libraries — Gooey, transitions, orbs — to huge response."
  },
  {
    username: "DanHollick",
    label: "Dan Hollick",
    bucket: "design-engineer",
    summary: "Builds the tool the problem needs, up to and including a font editor."
  },
  {
    username: "merycodes",
    label: "Mery Kabanova",
    bucket: "design-engineer",
    summary: "Design engineer at Vercel; posts interface work in progress with the reasoning."
  },
  {
    username: "nonzeroexitcode",
    label: "nonzeroexitcode",
    bucket: "design-engineer",
    summary: "Deep dives on interaction mechanics, each with a working implementation."
  },
  {
    username: "ChallengesCss",
    label: "Temani Afif",
    bucket: "design-engineer",
    summary: "CSS-only effects, posted as demos with the technique written up."
  },
  {
    username: "anatudor",
    label: "Ana Tudor",
    bucket: "design-engineer",
    summary: "CSS at the far end of what it can do; demo first, then the maths."
  },
  {
    username: "eduardbodak",
    label: "Eduard Bodak",
    bucket: "design-engineer",
    summary: "Micro-interactions and motion detail; ran a hundred-day button series."
  },
  {
    username: "jesper_alpacka",
    label: "Jesper Landberg",
    bucket: "design-engineer",
    summary: "Awwwards independent of the year twice; WebGL fused into ordinary UI."
  },
  {
    username: "JulianGarnier",
    label: "Julian Garnier",
    bucket: "design-engineer",
    summary: "Created Anime.js; now building an animation editor on top of it."
  },

  // --- Games and tools: the playable end, and the tools other builders use ---
  {
    username: "measure_plan",
    label: "measure_plan",
    bucket: "tooling",
    summary: "Builds browser games and a light physics engine, and ships the levels."
  },
  {
    username: "andreintg",
    label: "Andrei Intg",
    bucket: "tooling",
    summary: "Game tools; Unbound Loop, where agents build 3D scenes from blocks."
  },
  {
    username: "wawasensei",
    label: "Wawa Sensei",
    bucket: "tooling",
    summary: "Teaches Three.js and R3F, and builds the open-source editor he teaches in."
  },

  // --- Platforms: kept for market context, not because they post work ---
  {
    username: "rauchg",
    label: "Guillermo Rauch",
    bucket: "platform",
    summary: "CEO of Vercel; v0 and prompt-to-interface generation."
  },
  {
    username: "amasad",
    label: "Amjad Masad",
    bucket: "platform",
    summary: "CEO of Replit; agents that build and deploy software for non-coders."
  },
  {
    username: "zoink",
    label: "Dylan Field",
    bucket: "platform",
    summary: "CEO of Figma; where most of this work is designed before it is built."
  },
  {
    username: "nutlope",
    label: "Hassan El Mghari",
    bucket: "platform",
    summary: "Ships open-source AI apps at volume; the prompt-to-app pattern in public."
  }
] as const;

export type SeedBucket = (typeof seedCreators)[number]["bucket"];

export const BUCKET_LABELS: Record<string, string> = {
  studio: "Creative studios",
  "creative-dev": "Creative developers",
  "design-engineer": "Design engineers",
  tooling: "Games & tools",
  platform: "Platforms",
  // Retained so rows seeded by the previous roster still render a label.
  "no-code": "AI & no-code tools",
  indie: "Solo shippers",
  "ai-creator": "AI tools for non-coders",
  craft: "Design engineering",
  "3d": "3D & creative coding"
};
