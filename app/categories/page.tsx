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
  type RankWindow
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Product categories · Builder Radar",
  description:
    "Which kinds of product earn the most attention: games, utility tools, UI kits, agents and the rest, ranked."
};

// Below this a category's numbers move too much on a single post to rank.
const THIN_SAMPLE = 5;

function href(window: RankWindow) {
  return `/categories?window=${window}`;
}

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const window = parseWindow((await searchParams).window);

  if (!hasDatabase()) {
    return (
      <main className="insights-shell">
        <SiteNav current="/categories" />
        <p className="empty-note">Connect PostgreSQL and run an enrichment pass to see categories.</p>
      </main>
    );
  }

  const [categories, health] = await Promise.all([
    getCategoryStats(window),
    getCorpusHealth()
  ]);

  const solid = categories.filter((row) => row.posts >= THIN_SAMPLE);
  const thin = categories.filter((row) => row.posts < THIN_SAMPLE);
  const ordered = [...solid, ...thin];
  // Scaled against reliable rows only, so a two-post category cannot set the
  // scale for everything else.
  const peak = solid.reduce((max, row) => Math.max(max, row.avgEngagement), 0) || 1;

  return (
    <main className="insights-shell">
      <SiteNav current="/categories" />

      <header className="insights-header">
        <p className="eyebrow">Work categories</p>
        <h1>Which kinds of work actually earn attention.</h1>
        <p className="mission-line">
          Every post that handed over something made is classified into exactly one kind of work.
          The question this answers is which kinds an audience rewards — and therefore which kinds
          an ordinary person would get the most out of being able to make.
        </p>
        <p className="mission-line">
          The categories answer one question, &ldquo;what did this post hand over&rdquo;, and are
          applied in a fixed order so that overlap resolves the same way every cycle: work
          delivered for a client is client work whether or not it is full of 3D, and a post
          explaining a technique is teaching whatever the technique was. Posts that handed over
          nothing made are excluded rather than given a category of their own.
        </p>

        <div className="metric-toggle" role="group" aria-label="Time range">
          <Link
            href={href("all")}
            className={window === "all" ? "metric-option active" : "metric-option"}
            aria-current={window === "all" ? "true" : undefined}
          >
            All history
          </Link>
          <Link
            href={href("recent")}
            className={window === "recent" ? "metric-option active" : "metric-option"}
            aria-current={window === "recent" ? "true" : undefined}
          >
            Last {RECENT_WINDOW_DAYS} days
          </Link>
        </div>

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
            <span>work posts</span>
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
            <h4>Per 1,000 followers</h4>
            <p>
              Categories are ranked on likes per 1,000 followers, not raw likes. Otherwise the
              ranking would just reflect which categories happen to be posted by the builders with
              the biggest audiences.
            </p>
          </div>
          <div>
            <h4>Thin samples are separated, not ranked</h4>
            <p>
              Categories with fewer than {THIN_SAMPLE} posts sit below the line. They are shown
              because their absence is itself informative, but their numbers should not be read as
              a ranking. The {RECENT_WINDOW_DAYS}-day view pushes more categories below that line,
              which is a property of the shorter range rather than of the categories.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>The ranking</h3>
        <p className="panel-question">
          Ordered by average likes per 1,000 followers. Hover any bar for the exact figure.
        </p>

        <div className="category-table-wrap">
          <table className="stat-table category-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Avg per 1k</th>
                <th scope="col">Median per 1k</th>
                <th scope="col">Avg likes</th>
                <th scope="col">Median likes</th>
                <th scope="col">Breakout</th>
                <th scope="col">Share</th>
                <th scope="col">n</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const isThin = row.posts < THIN_SAMPLE;
                // A mean well above the median means a few strong posts are doing
                // the work and the category is not consistently good. Like counts
                // are power-law distributed, so a ratio above 2 is the norm here
                // and flagging it flagged almost every row; the threshold marks
                // the cases where one post genuinely carries the category.
                const skewed = row.medianEngagement > 0 && row.avgEngagement / row.medianEngagement > 5;
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
                      <div className="bar-cell" title={`${row.avgEngagement.toFixed(2)} likes per 1k`}>
                        <span className="bar-value">{row.avgEngagement.toFixed(1)}</span>
                        <span className="bar-track">
                          <span
                            className="bar-fill"
                            style={{
                              width: `${Math.min(100, (row.avgEngagement / peak) * 100)}%`
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td>{row.medianEngagement.toFixed(1)}</td>
                    <td>{compactNumber(Math.round(row.avgLikes))}</td>
                    <td>{compactNumber(Math.round(row.medianLikes))}</td>
                    <td>{row.medianBreakout === null ? "–" : `${row.medianBreakout.toFixed(2)}×`}</td>
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
                <strong>{row.avgEngagement.toFixed(1)}</strong>
                <span>avg per 1k</span>
              </div>
              <div>
                <strong>{compactNumber(Math.round(row.avgLikes))}</strong>
                <span>avg likes</span>
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
            <ul className="example-list">
              {row.examples.map((post) => (
                <li key={post.id}>
                  <div className="example-head">
                    <a href={`https://x.com/${post.username}`} target="_blank" rel="noreferrer">
                      @{post.username}
                    </a>
                    <span>
                      {post.engagement.toFixed(1)} per 1k · {compactNumber(post.likeCount)} likes
                      {post.breakout === null ? "" : ` · ${post.breakout.toFixed(1)}× their median`}
                    </span>
                  </div>
                  <p>{post.note ?? cleanPostText(post.text).slice(0, 180)}</p>
                  <a href={post.url} target="_blank" rel="noreferrer" className="rank-link">
                    Open post
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">No examples yet.</p>
          )}
        </section>
      ))}

      <footer className="insights-footer">
        <p className="footnote">
          Categories are assigned by the model from a fixed vocabulary with written boundary rules,
          so the same kind of product lands in the same category each cycle. Changing those rules
          re-tags the whole corpus rather than mixing two standards, because a leaderboard built
          from two different definitions would partly be ranking the definition.
        </p>
      </footer>
    </main>
  );
}
