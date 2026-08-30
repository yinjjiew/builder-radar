import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { hasDatabase } from "@/lib/db";
import { cleanPostText, compactNumber } from "@/lib/format";
import { productCategoryLabel } from "@/lib/mission";
import {
  getCategoryStats,
  getCorpusHealth,
  parseWindow,
  RECENT_WINDOW_DAYS,
  type CategoryRow,
  type PostRankMetric,
  type RankWindow
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Product categories · Builder Radar",
  description:
    "Which kinds of work earn the most attention: games, tools, client work, 3D and the rest, ranked by likes per 1,000 followers or by raw likes."
};

/**
 * Below this a category's numbers move too much on a single post to rank.
 *
 * This was 5, which let a category of nine posts be ranked against one of
 * thirty-eight as though the two medians carried the same weight. They do not:
 * the corpus was searched hard for educational apps and practical web apps and
 * the supply on X is genuinely thin, so those two sit in the double digits while
 * the rest are near forty. Holding the line at five would present that gap as a
 * finding about which work resonates, when it is a fact about how many posts
 * there are to look at.
 */
const THIN_SAMPLE = 15;

function href(metric: PostRankMetric, window: RankWindow) {
  return `/categories?by=${metric}&window=${window}`;
}

/** The two figures the active metric puts in front, and the two it demotes. */
function figures(row: CategoryRow, metric: PostRankMetric) {
  return metric === "likes"
    ? {
        lead: row.avgLikes,
        leadMedian: row.medianLikes,
        other: row.avgEngagement,
        otherMedian: row.medianEngagement
      }
    : {
        lead: row.avgEngagement,
        leadMedian: row.medianEngagement,
        other: row.avgLikes,
        otherMedian: row.medianLikes
      };
}

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<{ by?: string; window?: string }>;
}) {
  const params = await searchParams;
  const metric: PostRankMetric = params.by === "rate" ? "rate" : "likes";
  const window = parseWindow(params.window);

  if (!hasDatabase()) {
    return (
      <main className="insights-shell">
        <SiteNav current="/categories" />
        <p className="empty-note">
          Connect PostgreSQL and run an enrichment pass to see categories.
        </p>
      </main>
    );
  }

  const [categories, health] = await Promise.all([
    getCategoryStats(metric, window),
    getCorpusHealth()
  ]);

  const solid = categories.filter((row) => row.posts >= THIN_SAMPLE);
  const thin = categories.filter((row) => row.posts < THIN_SAMPLE);
  const ordered = [...solid, ...thin];
  // Scaled against reliable rows only, so a two-post category cannot set the
  // scale for everything else.
  const peak = solid.reduce((max, row) => Math.max(max, figures(row, metric).lead), 0) || 1;
  const unit = metric === "likes" ? "likes" : "per 1k";

  return (
    <main className="insights-shell">
      <SiteNav current="/categories" />

      <header className="insights-header">
        <p className="eyebrow">Work categories</p>
        <h1>Which kinds of work actually earn attention.</h1>
        <p className="mission-line">
          Every post that handed over something made is filed under one of eight kinds of work. The
          question this answers is which kinds an audience rewards — and therefore which kinds an
          ordinary person would get the most out of being able to make.
        </p>
        <p className="mission-line">
          Every category describes the made thing, never the post about it, and they are applied in
          a fixed order so overlap resolves the same way every time: work delivered for a client is
          client work whether or not it is full of 3D, and a portfolio is a portfolio however it is
          rendered. Posts that handed over nothing made are filed as deleted rather than given a
          category of their own. A post may carry a second tag where it genuinely handed over two
          things, in which case it counts in both categories.
        </p>
        <p className="mission-line">
          <strong>Educational apps teach; posts that teach do not count.</strong> A thread
          explaining how a solar system was built hands over an explanation, which is not a made
          thing. An interactive solar system built so you learn the planets is the category. The
          test is whether the artifact teaches, not whether the author does.
        </p>
        <p className="mission-line">
          <strong>A part or an outcome.</strong> Building blocks are what you take away and use in
          your own work — a component, a package, or the small factory that produces one, like a
          font or gradient generator. Practical web apps are what get a job done while you are
          there: a workflow, a calculator, a dashboard.
        </p>
        <p className="mission-line">
          <strong>Games are games, and the rest split by dimension.</strong> A game has an objective
          — levels, a score, something to win or lose. A scene you can only drag or disturb has
          none, and files as interactive 3D if it has depth and 2D visuals if it is flat. That line
          is drawn on whether there is a space with a camera and perspective, not on how impressive
          the result looks.
        </p>

        <div className="toggle-stack">
          <div className="metric-toggle" role="group" aria-label="Ranking metric">
            <Link
              href={href("likes", window)}
              className={metric === "likes" ? "metric-option active" : "metric-option"}
              aria-current={metric === "likes" ? "true" : undefined}
            >
              Raw likes
            </Link>
            <Link
              href={href("rate", window)}
              className={metric === "rate" ? "metric-option active" : "metric-option"}
              aria-current={metric === "rate" ? "true" : undefined}
            >
              Likes per 1k followers
            </Link>
          </div>

          <div className="metric-toggle" role="group" aria-label="Time range">
            <Link
              href={href(metric, "all")}
              className={window === "all" ? "metric-option active" : "metric-option"}
              aria-current={window === "all" ? "true" : undefined}
            >
              All history
            </Link>
            <Link
              href={href(metric, "recent")}
              className={window === "recent" ? "metric-option active" : "metric-option"}
              aria-current={window === "recent" ? "true" : undefined}
            >
              Last {RECENT_WINDOW_DAYS} days
            </Link>
          </div>
        </div>

        <p className="footnote toggle-note">
          {metric === "rate"
            ? "Ranked by average likes per 1,000 followers, which asks which kind of work resonates hardest relative to the audience that saw it. This is the fairer comparison, because a category posted mainly by small accounts is not penalised for it."
            : "Ranked by average raw likes, which asks which kind of work reaches the most people. This partly ranks audience size: a category dominated by builders with large followings will lead it whether or not the work landed well for them."}
        </p>
        <p className="footnote toggle-note">
          {window === "all"
            ? "Every classified post ever collected. More evidence per category, so this is the read to trust when the two ranges disagree."
            : `Only posts from the last ${RECENT_WINDOW_DAYS} days. This is what is landing now, but each category has far fewer posts behind it, so expect more categories below the reliability line.`}
        </p>

        <div className="health-strip">
          <div>
            <strong>{categories.length}</strong>
            <span>kinds of work seen</span>
          </div>
          <div>
            <strong>{categories.reduce((sum, row) => sum + row.posts, 0)}</strong>
            <span>tags applied</span>
          </div>
          <div>
            <strong>{solid.length}</strong>
            <span>with a usable sample</span>
          </div>
          <div>
            <strong>{health.maturePosts}</strong>
            <span>comparable posts</span>
          </div>
        </div>
      </header>

      <section className="method">
        <h2>How this ranking works</h2>
        <div className="method-grid">
          <div>
            <h4>Average and median, side by side</h4>
            <p>
              The average answers the plain question of which category does best. The median is
              shown next to it as a check: when a category&rsquo;s average sits far above its
              median, one viral post is carrying it and the category is not reliably strong.
            </p>
          </div>
          <div>
            <h4>Two metrics, deliberately</h4>
            <p>
              Likes per 1,000 followers measures resonance and is the honest default. Raw likes
              measures reach and largely reflects which categories the biggest accounts post in.
              Where the two orders disagree, a category is either punching above its audience or
              coasting on one.
            </p>
          </div>
          <div>
            <h4>Thin samples are separated, not ranked</h4>
            <p>
              Categories with fewer than {THIN_SAMPLE} posts sit below the line. They are shown
              because their absence is itself informative, but their numbers should not be read as a
              ranking. The {RECENT_WINDOW_DAYS}-day view pushes more categories below that line,
              which is a property of the shorter range rather than of the categories.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>The ranking</h3>
        <p className="panel-question">
          Ordered by average {metric === "likes" ? "raw likes" : "likes per 1,000 followers"}. The
          other measure stays in the table so the two can be read against each other. Hover any bar
          for the exact figure.
        </p>

        <div className="category-table-wrap">
          <table className="stat-table category-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">{metric === "likes" ? "Avg likes" : "Avg per 1k"}</th>
                <th scope="col">{metric === "likes" ? "Median likes" : "Median per 1k"}</th>
                <th scope="col">{metric === "likes" ? "Avg per 1k" : "Avg likes"}</th>
                <th scope="col">{metric === "likes" ? "Median per 1k" : "Median likes"}</th>
                <th scope="col">Breakout</th>
                <th scope="col">Share of tags</th>
                <th scope="col">n</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const isThin = row.posts < THIN_SAMPLE;
                const { lead, leadMedian, other, otherMedian } = figures(row, metric);
                // A mean well above the median means a few strong posts are doing
                // the work and the category is not consistently good. Like counts
                // are power-law distributed, so a ratio above 2 is the norm here
                // and flagging it flagged almost every row; the threshold marks
                // the cases where one post genuinely carries the category.
                const skewed = leadMedian > 0 && lead / leadMedian > 5;
                const format = (value: number) =>
                  metric === "likes" ? compactNumber(Math.round(value)) : value.toFixed(1);
                const formatOther = (value: number) =>
                  metric === "likes" ? value.toFixed(1) : compactNumber(Math.round(value));
                return (
                  <tr key={row.key} className={isThin ? "thin-row" : undefined}>
                    <th scope="row">
                      <span className="cat-name">{productCategoryLabel(row.key)}</span>
                      <span className="cat-sub">
                        {row.creators} builder{row.creators === 1 ? "" : "s"}
                        {skewed && !isThin ? " · average skewed by outliers" : ""}
                      </span>
                    </th>
                    <td>
                      <div className="bar-cell" title={`${lead.toFixed(2)} ${unit}`}>
                        <span className="bar-value">{format(lead)}</span>
                        <span className="bar-track">
                          <span
                            className="bar-fill"
                            style={{
                              width: `${Math.min(100, (lead / peak) * 100)}%`
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td>{format(leadMedian)}</td>
                    <td>{formatOther(other)}</td>
                    <td>{formatOther(otherMedian)}</td>
                    <td>
                      {row.medianBreakout === null ? "–" : `${row.medianBreakout.toFixed(2)}×`}
                    </td>
                    <td>{(row.share * 100).toFixed(0)}%</td>
                    <td className={isThin ? "thin-n" : undefined}>{row.posts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {categories.length ? null : (
          <p className="empty-note">
            {window === "recent"
              ? `No classified posts in the last ${RECENT_WINDOW_DAYS} days yet.`
              : "No categorised posts yet. Runs with the next enrichment pass."}
          </p>
        )}
      </section>

      {ordered.map((row) => (
        <section className="panel category-panel" key={row.key}>
          <div className="category-head">
            <h3>{productCategoryLabel(row.key)}</h3>
            <div className="category-figures">
              <div>
                <strong>
                  {metric === "likes"
                    ? compactNumber(Math.round(row.avgLikes))
                    : row.avgEngagement.toFixed(1)}
                </strong>
                <span>avg {unit}</span>
              </div>
              <div>
                <strong>
                  {metric === "likes"
                    ? row.avgEngagement.toFixed(1)
                    : compactNumber(Math.round(row.avgLikes))}
                </strong>
                <span>avg {metric === "likes" ? "per 1k" : "likes"}</span>
              </div>
              <div>
                <strong>{row.posts}</strong>
                <span>posts</span>
              </div>
              <div>
                <strong>{row.recentPosts}</strong>
                <span>last 30 days</span>
              </div>
            </div>
          </div>

          {row.posts < THIN_SAMPLE ? (
            <p className="thin-warning">
              Only {row.posts} post{row.posts === 1 ? "" : "s"} in this category. Treat the figures
              as an indication that it exists, not as a measurement.
            </p>
          ) : null}

          {row.examples.length ? (
            <>
              <p className="panel-question">
                The strongest three by{" "}
                {metric === "likes" ? "raw likes" : "likes per 1,000 followers"}.
              </p>
              <ul className="example-list">
                {row.examples.map((post) => (
                  <li key={post.id}>
                    <div className="example-head">
                      <a href={`https://x.com/${post.username}`} target="_blank" rel="noreferrer">
                        @{post.username}
                      </a>
                      <span>
                        {metric === "likes"
                          ? `${compactNumber(post.likeCount)} likes · ${post.engagement.toFixed(1)} per 1k`
                          : `${post.engagement.toFixed(1)} per 1k · ${compactNumber(post.likeCount)} likes`}
                        {post.breakout === null
                          ? ""
                          : ` · ${post.breakout.toFixed(1)}× their median`}
                      </span>
                    </div>
                    <p>{post.note ?? cleanPostText(post.text).slice(0, 180)}</p>
                    <div className="example-foot">
                      {post.reviewed ? null : <span className="tag tag-muted">not reviewed</span>}
                      {post.categories.map((category) => (
                        <span className="tag" key={category}>
                          {productCategoryLabel(category)}
                        </span>
                      ))}
                      <a href={post.url} target="_blank" rel="noreferrer" className="rank-link">
                        Open post
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="empty-note">No examples yet.</p>
          )}
        </section>
      ))}

      <footer className="insights-footer">
        <p className="footnote">
          Categories are assigned by the model from a fixed vocabulary with written boundary rules,
          applied in order, so the same kind of work lands in the same category every time. Changing
          those rules re-tags the whole corpus rather than mixing two standards, because a
          leaderboard built from two different definitions would partly be ranking the definition.
        </p>
        <p className="footnote">
          Any tag can be corrected by hand on the review page, and a hand-set tag is permanent: the
          six-hour cycle re-reads posts but never overwrites a category a person chose. Both this
          ranking and the post rank are computed on every page load, so a correction shows up
          immediately; the written brief on <Link href="/insights">/insights</Link> is rewritten on
          the next cycle rather than on the spot.
        </p>
      </footer>
    </main>
  );
}
