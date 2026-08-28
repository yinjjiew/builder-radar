import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { hasDatabase } from "@/lib/db";
import { cleanPostText, compactNumber } from "@/lib/format";
import { productCategoryLabel } from "@/lib/mission";
import { getCycleStatus, getTopPosts, type PostRankMetric } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Post rank · Builder Radar",
  description: "The 30 strongest posts in the directory, by raw likes and by likes per 1,000 followers."
};

const RANK_SIZE = 30;

function stamp(value: string | null | undefined) {
  if (!value) return "not yet";
  return new Date(value).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default async function PostRankPage({
  searchParams
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const params = await searchParams;
  const metric: PostRankMetric = params.by === "likes" ? "likes" : "rate";

  if (!hasDatabase()) {
    return (
      <main className="insights-shell">
        <SiteNav current="/posts" />
        <p className="empty-note">Connect PostgreSQL and run a sync to rank posts.</p>
      </main>
    );
  }

  const [posts, cycle] = await Promise.all([getTopPosts(metric, RANK_SIZE), getCycleStatus()]);

  const peak = posts.reduce(
    (max, post) => Math.max(max, metric === "likes" ? post.likeCount : post.engagement),
    0
  );

  return (
    <main className="insights-shell">
      <SiteNav current="/posts" />

      <header className="insights-header">
        <p className="eyebrow">Post rank</p>
        <h1>The {RANK_SIZE} strongest posts in the directory.</h1>
        <p className="mission-line">
          Two rankings of the same corpus. They disagree, and the disagreement is the useful part:
          raw likes measure reach, likes per 1,000 followers measure resonance.
        </p>

        <div className="metric-toggle" role="group" aria-label="Ranking metric">
          <Link
            href="/posts?by=rate"
            className={metric === "rate" ? "metric-option active" : "metric-option"}
            aria-current={metric === "rate" ? "true" : undefined}
          >
            Likes per 1k followers
          </Link>
          <Link
            href="/posts?by=likes"
            className={metric === "likes" ? "metric-option active" : "metric-option"}
            aria-current={metric === "likes" ? "true" : undefined}
          >
            Raw likes
          </Link>
        </div>

        <p className="footnote toggle-note">
          {metric === "rate"
            ? "Ranked by likes divided by the author's follower count. This is the fairer comparison: it asks how hard a post landed relative to the audience that saw it, so a small account with a genuine hit outranks a large account posting routinely."
            : "Ranked by absolute like count. This mostly ranks audience size — the largest accounts dominate regardless of whether a post did well for them. Useful for seeing what reached the most people, misleading as a measure of quality."}
        </p>
      </header>

      <section className="panel">
        <ol className="rank-list">
          {posts.map((post, index) => {
            const value = metric === "likes" ? post.likeCount : post.engagement;
            const width = peak > 0 ? Math.max(2, (value / peak) * 100) : 0;
            return (
              <li className="rank-row" key={post.id}>
                <span className="rank-number">{index + 1}</span>

                <div className="rank-body">
                  <div className="rank-head">
                    <a
                      href={`https://x.com/${post.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rank-handle"
                    >
                      @{post.username}
                    </a>
                    <span className="rank-sub">
                      {compactNumber(post.followersCount)} followers ·{" "}
                      {new Date(post.createdAt).toLocaleDateString("en", {
                        month: "short",
                        day: "numeric"
                      })}
                      {post.mature ? null : <span className="fresh-flag">still climbing</span>}
                    </span>
                  </div>

                  <p className="rank-text">{cleanPostText(post.text).slice(0, 260)}</p>

                  <div className="rank-meta">
                    {post.productCategory && post.productCategory !== "none" ? (
                      <span className="tag">{productCategoryLabel(post.productCategory)}</span>
                    ) : null}
                    {post.breakout === null ? null : (
                      <span className="rank-chip">{post.breakout.toFixed(1)}× their median</span>
                    )}
                    <a href={post.url} target="_blank" rel="noreferrer" className="rank-link">
                      Open post
                    </a>
                  </div>
                </div>

                <div className="rank-metric">
                  <strong>
                    {metric === "likes" ? compactNumber(post.likeCount) : value.toFixed(1)}
                  </strong>
                  <span>{metric === "likes" ? "likes" : "per 1k"}</span>
                  <span className="rank-secondary">
                    {metric === "likes"
                      ? `${post.engagement.toFixed(1)} per 1k`
                      : `${compactNumber(post.likeCount)} likes`}
                  </span>
                  <div className="rank-bar" aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {posts.length ? null : <p className="empty-note">No posts collected yet.</p>}
      </section>

      <footer className="insights-footer">
        <p className="footnote">
          This ranking is computed from the database on every page load, so it is never stale
          relative to the collected data. New posts and refreshed like counts arrive with the
          six-hour cycle; the most recent finished collecting at {stamp(cycle?.postsAt)}.
        </p>
        <p className="footnote">
          Posts marked <em>still climbing</em> had their like count read less than 24 hours after
          publishing. They are included rather than hidden, because an undercounted post can only
          rank lower than it deserves, never higher.
        </p>
      </footer>
    </main>
  );
}
