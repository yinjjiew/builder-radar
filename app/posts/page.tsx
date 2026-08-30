import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { SiteNav } from "@/components/site-nav";
import { addPostAction, deletePostAction } from "@/app/curate/actions";
import { hasDatabase } from "@/lib/db";
import { cleanPostText, compactNumber } from "@/lib/format";
import { productCategoryLabel } from "@/lib/mission";
import { isAdmin } from "@/lib/role";
import {
  getCycleStatus,
  getTopPosts,
  parseWindow,
  RECENT_WINDOW_DAYS,
  type PostRankMetric,
  type RankWindow
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Post rank · Builder Radar",
  description:
    "The 30 strongest pieces of work in the directory, over all history or the last two weeks, by raw likes and by likes per 1,000 followers."
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

function href(metric: PostRankMetric, window: RankWindow) {
  return `/posts?by=${metric}&window=${window}`;
}

export default async function PostRankPage({
  searchParams
}: {
  searchParams: Promise<{ by?: string; window?: string }>;
}) {
  const params = await searchParams;
  const metric: PostRankMetric = params.by === "likes" ? "likes" : "rate";
  const window = parseWindow(params.window);
  const admin = await isAdmin();

  if (!hasDatabase()) {
    return (
      <main className="insights-shell">
        <SiteNav current="/posts" />
        <p className="empty-note">Connect PostgreSQL and run a sync to rank posts.</p>
      </main>
    );
  }

  const [posts, cycle] = await Promise.all([
    getTopPosts(metric, window, RANK_SIZE),
    getCycleStatus()
  ]);

  const peak = posts.reduce(
    (max, post) => Math.max(max, metric === "likes" ? post.likeCount : post.engagement),
    0
  );

  return (
    <main className="insights-shell">
      <SiteNav current="/posts" />

      <header className="insights-header">
        <p className="eyebrow">Post rank</p>
        <h1>The {RANK_SIZE} strongest pieces of work in the directory.</h1>
        <p className="mission-line">
          Four views of the same corpus, and the disagreements between them are the useful part: raw
          likes measure reach, likes per 1,000 followers measure resonance, and the range decides
          whether you are asking what works or what is working now.
        </p>
        <p className="mission-line">
          Only posts that handed over something made are ranked here, and each one carries the tag
          it was filed under. A post needs at least one of the{" "}
          <Link href="/categories" className="hero-inline-link">
            eight kinds of work
          </Link>{" "}
          to qualify, which keeps out takes, questions, award announcements and industry news
          however well they performed.
        </p>
        {admin ? (
          <p className="mission-line">
            A tag that looks wrong can be changed on the{" "}
            <Link href="/review" className="hero-inline-link">
              review page
            </Link>
            , and this ranking reflects the change on your next page load.
          </p>
        ) : null}

        <div className="toggle-stack">
          <div className="metric-toggle" role="group" aria-label="Ranking metric">
            <Link
              href={href("rate", window)}
              className={metric === "rate" ? "metric-option active" : "metric-option"}
              aria-current={metric === "rate" ? "true" : undefined}
            >
              Likes per 1k followers
            </Link>
            <Link
              href={href("likes", window)}
              className={metric === "likes" ? "metric-option active" : "metric-option"}
              aria-current={metric === "likes" ? "true" : undefined}
            >
              Raw likes
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
            ? "Ranked by likes divided by the author's follower count. This is the fairer comparison: it asks how hard a post landed relative to the audience that saw it, so a small account with a genuine hit outranks a large account posting routinely."
            : "Ranked by absolute like count. This mostly ranks audience size — the largest accounts dominate regardless of whether a post did well for them. Useful for seeing what reached the most people, misleading as a measure of quality."}
        </p>
        <p className="footnote toggle-note">
          {window === "all"
            ? "Every post ever collected. The most reliable read, and the one to trust when the two ranges disagree, because it has the most evidence behind it."
            : `Only posts from the last ${RECENT_WINDOW_DAYS} days — the same window in which like counts are still being actively refreshed, so these figures are the best maintained. A shorter range means fewer posts, so treat a narrow lead as noise.`}
        </p>
      </header>

      {admin ? (
        <section className="panel curate-panel">
          <h2>Add a post</h2>
          <p className="section-note">
            Paste the link to any post. If its author is not on the roster they are stored as a
            guest, so the post joins the rankings without joining the builder list.
          </p>
          <ActionForm action={addPostAction} className="add-creator-form">
            <label className="sr-only" htmlFor="post-link">
              Post link
            </label>
            <input
              id="post-link"
              name="link"
              placeholder="https://x.com/username/status/123…"
              autoComplete="off"
              required
            />
            <button type="submit" className="approve-button">
              Add post
            </button>
          </ActionForm>
        </section>
      ) : null}

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
                      {post.addedByHand ? <span className="fresh-flag">added by hand</span> : null}
                      {post.reviewed ? null : (
                        <span className="fresh-flag flag-unreviewed">not reviewed</span>
                      )}
                    </span>
                  </div>

                  <p className="rank-text">{cleanPostText(post.text).slice(0, 260)}</p>

                  <div className="rank-meta">
                    {post.categories.length ? (
                      post.categories.map((category) => (
                        <span className="tag" key={category}>
                          {productCategoryLabel(category)}
                        </span>
                      ))
                    ) : (
                      <span className="tag tag-muted">deleted</span>
                    )}
                    {post.breakout === null ? null : (
                      <span className="rank-chip">{post.breakout.toFixed(1)}× their median</span>
                    )}
                    <a href={post.url} target="_blank" rel="noreferrer" className="rank-link">
                      Open post
                    </a>
                    {admin ? (
                      <ActionForm action={deletePostAction} className="inline-form">
                        <input type="hidden" name="postId" value={post.id} />
                        <ConfirmButton
                          className="danger-link"
                          message={`Delete @${post.username}'s post permanently?\n\nIt will be removed from every ranking and will never be collected again, even though it stays on X.\n\nThis cannot be undone from this page.`}
                        >
                          Delete
                        </ConfirmButton>
                      </ActionForm>
                    ) : null}
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

        {posts.length ? null : (
          <p className="empty-note">
            {window === "recent"
              ? `No work posted in the last ${RECENT_WINDOW_DAYS} days has been classified yet.`
              : "No classified work yet. Posts are ranked once the enrichment run has judged what each one handed over."}
          </p>
        )}
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
        <p className="footnote">
          A post you add by hand is ranked immediately and keeps its place whatever the classifier
          later decides, because choosing it is itself the judgement that it belongs.
        </p>
      </footer>
    </main>
  );
}
