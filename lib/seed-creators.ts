/**
 * The curated roster. Every handle here was verified against the X API rather
 * than written from memory — four plausible-looking handles turned out not to
 * exist, so an unverified list would have silently seeded dead rows.
 *
 * The mix is deliberate. The first ten builders are craft and 3D specialists,
 * and the demand analysis kept reporting the same limitation about them: of 83
 * tagged posts exactly one was aimed at non-technical people. A directory of
 * only design engineers can say what other engineers admire, but not much about
 * what an ordinary person would want to build. The roster therefore adds people
 * shipping prompt-to-app products, and solo builders whose work is closer to
 * marketing and product than to engineering.
 *
 * `bucket` groups a builder for the network view and for reading the statistics
 * by cohort. It is a curation decision, unlike the AI-assigned tags on posts.
 */
export const seedCreators = [
  // --- Prompt-to-app, AI building tools: the market being entered ---
  {
    username: "rauchg",
    label: "Guillermo Rauch",
    bucket: "no-code",
    summary: "CEO of Vercel; v0 and prompt-to-interface generation."
  },
  {
    username: "amasad",
    label: "Amjad Masad",
    bucket: "no-code",
    summary: "CEO of Replit; agents that build and deploy software for non-coders."
  },
  {
    username: "shadcn",
    label: "shadcn",
    bucket: "no-code",
    summary: "Component distribution and the UI layer AI tools generate into."
  },
  {
    username: "mckaywrigley",
    label: "Mckay Wrigley",
    bucket: "no-code",
    summary: "Builds and teaches AI coding workflows."
  },
  {
    username: "jsngr",
    label: "Jordan Singer",
    bucket: "no-code",
    summary: "Design-led AI product prototypes; previously Figma and Diagram."
  },
  {
    username: "nutlope",
    label: "Hassan El Mghari",
    bucket: "no-code",
    summary: "Ships open-source AI apps at a high rate."
  },
  {
    username: "antonosika",
    label: "Anton Osika",
    bucket: "no-code",
    summary: "Founder of Lovable; natural-language app generation."
  },
  {
    username: "steventey",
    label: "Steven Tey",
    bucket: "no-code",
    summary: "Founder of Dub; developer-facing products built in public."
  },
  {
    username: "thebuggeddev",
    label: "The Bugged Dev",
    bucket: "no-code",
    summary: "Design engineering and AI-assisted builds."
  },

  // --- Solo shippers: closest available proxy for a non-engineer builder ---
  {
    username: "levelsio",
    label: "Pieter Levels",
    bucket: "indie",
    summary: "Ships small profitable products alone, in public."
  },
  {
    username: "gregisenberg",
    label: "Greg Isenberg",
    bucket: "indie",
    summary: "Publishes startup ideas daily; a read on what people want built."
  },
  {
    username: "arvidkahl",
    label: "Arvid Kahl",
    bucket: "indie",
    summary: "Bootstrapped software and audience building."
  },
  {
    username: "tibo_maker",
    label: "Tibo",
    bucket: "indie",
    summary: "Builds multiple small products in public."
  },
  {
    username: "yongfook",
    label: "Jon Yongfook",
    bucket: "indie",
    summary: "Bootstrapped image and video automation for businesses."
  },

  // --- Design engineering: the polish layer the data says wins ---
  {
    username: "jh3yy",
    label: "Jhey Tompkins",
    bucket: "craft",
    summary: "Polished CSS, interface and creative-coding experiments."
  },
  {
    username: "delba_oliveira",
    label: "Delba de Oliveira",
    bucket: "craft",
    summary: "Developer experience and craft; Claude Code."
  },
  {
    username: "raunofreiberg",
    label: "Rauno Freiberg",
    bucket: "craft",
    summary: "High-craft interaction and design engineering at Vercel."
  },
  {
    username: "Una",
    label: "Una Kravets",
    bucket: "craft",
    summary: "CSS and web UI platform work at Google Chrome."
  },
  {
    username: "markdalgleish",
    label: "Mark Dalgleish",
    bucket: "craft",
    summary: "React Router and design systems; co-creator of CSS Modules."
  },
  {
    username: "aidenybai",
    label: "Aiden Bai",
    bucket: "craft",
    summary: "Web performance tooling; Million and React Scan."
  },
  {
    username: "argyleink",
    label: "Adam Argyle",
    bucket: "craft",
    summary: "Design engineering and CSS at Shopify; previously Chrome."
  },
  {
    username: "samdape",
    label: "Sam Dape",
    bucket: "craft",
    summary: "Interface design and front-end craft."
  },
  {
    username: "Ibelick",
    label: "Julien Thibeaut",
    bucket: "craft",
    summary: "Detailed software interfaces and Motion Primitives."
  },

  // --- 3D and creative coding: the visual spectacle that travels furthest ---
  {
    username: "mrdoob",
    label: "Ricardo Cabello",
    bucket: "3d",
    summary: "Creator of Three.js."
  },
  {
    username: "bruno_simon",
    label: "Bruno Simon",
    bucket: "3d",
    summary: "Three.js and interactive 3D web projects."
  },
  {
    username: "Andersonmancini",
    label: "Anderson Mancini",
    bucket: "3d",
    summary: "Three.js scenes, games and interactive demos."
  },
  {
    username: "techartist_",
    label: "Techartist",
    bucket: "3d",
    summary: "Interfaces, 3D, shaders and game-development experiments."
  },
  {
    username: "QuentinHocde",
    label: "Quentin Hocdé",
    bucket: "3d",
    summary: "Independent creative and interactive web development."
  },
  {
    username: "makio64",
    label: "David Ronai",
    bucket: "3d",
    summary: "3D websites, applications, games and graphics tools."
  },
  {
    username: "RobinPayot",
    label: "Robin Payot",
    bucket: "3d",
    summary: "Immersive websites and creative Three.js work."
  }
] as const;

export type SeedBucket = (typeof seedCreators)[number]["bucket"];

export const BUCKET_LABELS: Record<string, string> = {
  "no-code": "AI & no-code tools",
  indie: "Solo shippers",
  craft: "Design engineering",
  "3d": "3D & creative coding"
};
