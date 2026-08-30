/**
 * Splits the old interactive-3d bucket into 3D scenes and flat visuals.
 *
 * A rename could not do this, because the old value covered both: raymarched
 * worlds and CSS gradient studies sat in one bucket, which is the reason the
 * split exists. Each of the 121 posts was read individually and the ones listed
 * here judged flat. Where the text alone was not decisive — a bare link, "cool",
 * "summer" — the author's medium decided it, since a creator who posts canvas
 * experiments every day is not suddenly shipping a 3D world.
 *
 * The rest stay interactive-3d, so this file only has to name the exceptions.
 * Hand-set rows are included: the owner chose interactive-3d when it was the only
 * interactive category there was, and asked for the split to be made for them.
 */
import { getDb } from "../lib/db";

const FLAT = [
  // pixel art, not a rendered space
  "2092866920307450225", // @andreintg  480x800 synth pixels
  // glyph generator: text atlases are flat, unlike the engine post next to it
  "2019400587088118052", // @AristideBenoist  MTSDF generator
  // @brunoimbrizi works in 2D canvas generative and audio-reactive pieces
  "1673081352894251010",
  "1699075535715135524",
  "1702246867680026755",
  "1702616965339041876",
  "1730898181817335928",
  "1863289938877219237",
  // a numeric input is interface, and interface is flat
  "2065769909687357814", // @CantBeFaraz  Blender-style number input
  "2090746420227649623", // @DanHollick  Figma plugin
  // @eduardbodak posts UI micro-interactions
  "2089274616447476065",
  "2090366607558086755",
  "2092900114138378557",
  // @ikeryou posts daily 2D canvas experiments
  "2089989210031927534",
  "2090701947171168558",
  "2091309314883629182",
  "2092014769759043708",
  "2092165343901106205",
  "2092732582068908479",
  "2093270321935909220",
  // @jesper_vos works in CSS; the glass orbs post is the exception and stays 3D
  "2079536373975879935",
  "2088247145023283226",
  "2091854478303437024",
  "2092605159150887340", // @jh3yy  CSS
  // @mattdesl: the splat posts are 3D, these two are plotter-style generative
  "2081861601313898741", // 6000 rectangles, additive blending
  "2089696792933699856", // Pattern Language, woven pattern work
  "2093315772374212789", // @measure_plan  light physics engine is 2D
  // video and sound pieces, no rendered space
  "2067566026439492065",
  "2092950855821492441",
  // @nicolasdnl  Genuary generative art
  "2016921201218633852",
  "2016989326836441430",
  "2017184909052227746",
  "2017302676124344736",
  "2017547068823253430",
  "2019040953529733267",
  "2048787915119939787",
  "2049046035243085987",
  // CSS Painting API paints into flat backgrounds
  "2091187586266009847",
  "2091187584147816473",
  "2077742386608763333" // @QuentinHocde  sin, images & loop
];

const sql = getDb();

const [before] = await sql<Array<{ n: string }>>`
  select count(*) as n from post_insights where categories @> array['interactive-3d']::text[]
`;

await sql`
  update post_insights
  set categories = array_replace(categories, 'interactive-3d', 'visual-2d')
  where post_id = any(${FLAT}) and categories @> array['interactive-3d']::text[]
`;

await sql`
  update post_insights
  set product_category = 'visual-2d'
  where post_id = any(${FLAT}) and product_category = 'interactive-3d'
`;

const after = await sql<Array<{ key: string; n: string }>>`
  select cat as key, count(*) as n
  from post_insights pi
  join posts p on p.id = pi.post_id
  join creators c on c.id = p.creator_id
  cross join lateral unnest(pi.categories) as cat
  where c.status in ('approved', 'guest')
  group by cat order by count(*) desc
`;

console.log(`interactive-3d before: ${before.n}, listed as flat: ${FLAT.length}`);
console.table(after);

await sql.end();
