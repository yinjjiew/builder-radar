/**
 * The owner's own reading of the category ranking.
 *
 * This is deliberately not a row in `insight_reports`. That table holds machine
 * briefs, keeps only the newest {@link KEEP_REPORTS} of them and deletes the
 * rest on every cycle, so a hand-written analysis placed there would be pushed
 * out of the history within eight days and then dropped. It also would not
 * belong: the machine brief is regenerated from whatever the corpus looks like
 * today, while this was written once, after reading every post in all eight
 * categories by hand, and it is the judgement the numbers are there to support.
 *
 * The figures below were measured on the date in `measuredAt` and are frozen
 * with the prose, the same way an archived brief is. The tables further down the
 * page always recompute, so a number here drifting from a number there is
 * expected and is itself informative — it says the sample grew.
 */

export type OwnerFinding = {
  /** Stable key for React and for linking to a single finding later. */
  id: string;
  title: string;
  /** The reading itself. */
  body: string;
  /** Measured figures the reading rests on, quoted as of `measuredAt`. */
  evidence: string;
};

export type OwnerCaveat = {
  id: string;
  title: string;
  detail: string;
};

export const OWNER_READING = {
  measuredAt: "2026-08-30",

  /**
   * Average likes per category, in the order they came out. Kept as data rather
   * than prose so the ranking on the page cannot drift from the sentence about
   * the ranking.
   */
  ranking: [
    { category: "building-block", avgLikes: 800, posts: 33 },
    { category: "interactive-3d", avgLikes: 581, posts: 37 },
    { category: "education", avgLikes: 448, posts: 11 },
    { category: "own-site", avgLikes: 311, posts: 25 },
    { category: "visual-2d", avgLikes: 301, posts: 25 },
    { category: "game", avgLikes: 290, posts: 25 },
    { category: "web-app", avgLikes: 132, posts: 10 },
    { category: "client-work", avgLikes: 122, posts: 38 }
  ],

  lead: `Every post collected here has been read and filed by hand into one of eight
categories. Ranked by average likes they come out in the order below. That order is
where the analysis starts, not where it ends: two things distort it, and both matter
more than the gap between any two adjacent categories.`,

  caveats: [
    {
      id: "thin",
      title: "Two categories are too thin to rank",
      detail: `Educational apps rests on 11 posts and Practical web apps on 10. Neither
carries enough evidence to sit in a list beside categories built on three or four times
as much, and a single strong post moves either of them several places.`
    },
    {
      id: "carried",
      title: "One builder can carry a whole category",
      detail: `Building blocks is the clearest case: one maker of UI components takes 78%
of the likes in the category. Its average is therefore mostly a fact about him, not about
the format — which turns out to be the interesting part rather than a defect.`
    }
  ] satisfies OwnerCaveat[],

  findings: [
    {
      id: "small-factory",
      title: "Building blocks is the surprise, and underneath it is a small factory",
      body: `Nothing predicted this category topping the ranking. The posts are simple —
a set of buttons, a thinking orb, a gooey hover effect — and they land far above their
author's usual reach. What is actually underneath is not "components for developers" but
a small factory: an app whose whole job is to let someone produce one specific kind of
thing — a button, a wallpaper, an icon — and then put it to use on their own phone or
desktop. Read that way the ceiling is high, because the output is small, personal,
immediately usable, and endlessly repeatable.`,
      evidence: `@Jakubantalik: 7 posts averaging 2,945 likes against 19,048 followers,
median 3,277, best 6,082. He holds 78% of the likes in a category of 33 posts by 11
builders.`
    },
    {
      id: "two-way",
      title: "Interactive 3D outruns 2D, and interactivity is being read too narrowly",
      body: `3D holds attention in a way flat visuals do not, even when both respond to
the visitor. The more useful observation sits one step further out: almost everything in
this corpus takes "interactive" to mean the user dragging, scrolling or hovering.
It can be two-way — a figure on the page that reacts to where the visitor moves in front
of their own camera. Nobody in this sample is doing that, which is exactly why it is
worth doing.`,
      evidence: `Interactive 3D averages 581 likes across 37 posts against 301 across 25
for 2D visuals & toys, a factor of 1.9. Medians 187 against 106.`
    },
    {
      id: "floor",
      title: "Games trail 3D because 3D has a floor and games do not",
      body: `Read one by one, the game posts are not held down by their ceiling but by
their floor. A game has to actually be good: an old-fashioned or thin one draws nothing at
all. A 3D scene only has to look striking, and then it reliably works. The two categories
differ far less in their best posts than in their worst.`,
      evidence: `The weakest quarter of Interactive 3D posts still clears 118 likes; the
weakest quarter of Games sits at 46. Medians 187 against 125, on 37 and 25 posts.`
    },
    {
      id: "social",
      title: "Personal & studio sites are the one social category",
      body: `This is the only category whose subject is a person rather than a product —
an introduction, a studio, a record of a life. That gives it a social pull none of the
others have, and it is also the place where interactivity has barely been tried. Sharing a
life as something a visitor moves through, rather than scrolls past, is a wide-open
combination.`,
      evidence: `25 posts from 21 builders — the most evenly spread category in the
corpus. No single person holds more than a quarter of its likes.`
    },
    {
      id: "converged",
      title: "Practical web apps are the flat spot, and convergence is why",
      body: `The tools-and-efficiency category is the smallest and the second weakest at
once, which makes it the clearest negative signal on the page. Utility has already
converged onto the handful of apps everyone opens every day, so one more calculator or
workflow has nowhere to land. Worth holding on to precisely because this is the category
closest to what the platform is for.`,
      evidence: `10 posts, fewer than any other category, averaging 132 likes with a
median of 64 — the lowest median in the corpus.`
    }
  ] satisfies OwnerFinding[]
};
