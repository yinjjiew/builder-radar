import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { TagSlots } from "@/components/tag-slots";
import { setPostCategoriesAction } from "@/app/curate/actions";
import { hasDatabase } from "@/lib/db";
import { cleanPostText, compactNumber } from "@/lib/format";
import { productCategoryLabel, WORK_KINDS } from "@/lib/mission";
import { isAdmin } from "@/lib/role";
import {
  getReviewAuthors,
  getReviewCounts,
  getReviewPosts,
  parseReviewFilter,
  parseReviewSort,
  REVIEW_PAGE_SIZE,
  type ReviewSort
} from "@/lib/review";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Review tags · Builder Radar",
  description: "Every collected post with the category it was filed under, editable in place."
};

const SORTS: Array<{ key: ReviewSort; label: string }> = [
  { key: "likes", label: "Most likes" },
  { key: "rate", label: "Highest per 1k" },
  { key: "recent", label: "Newest" }
];

type Params = {
  filter?: string;
  sort?: string;
  page?: string;
  author?: string;
  done?: string;
  error?: string;
};

function link(params: Params) {
  const query = new URLSearchParams();
  if (params.filter && params.filter !== "all") query.set("filter", params.filter);
  if (params.sort && params.sort !== "likes") query.set("sort", params.sort);
  if (params.author) query.set("author", params.author);
  if (params.page && params.page !== "1") query.set("page", params.page);
  const suffix = query.toString();
  return suffix ? `/review?${suffix}` : "/review";
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;

  // The page is a bulk editor, so there is nothing on it for a read-only viewer:
  // every row is a form. The actions check the credential tier themselves; this
  // is only about not showing a wall of disabled controls.
  if (!(await isAdmin())) redirect("/posts");

  if (!hasDatabase()) {
    return (
      <main className="insights-shell">
        <SiteNav current="/review" />
        <p className="empty-note">Connect PostgreSQL and run a sync to review tags.</p>
      </main>
    );
  }

  const filter = parseReviewFilter(params.filter);
  const sort = parseReviewSort(params.sort);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const author = (params.author ?? "").replace(/[^\w]/g, "").slice(0, 20) || undefined;

  const [posts, counts, authors] = await Promise.all([
    getReviewPosts({ filter, sort, page, username: author }),
    getReviewCounts(),
    getReviewAuthors()
  ]);

  const returnTo = link({ filter, sort, author, page: String(page) });
  const filters = [
    { key: "all", label: "Everything", count: counts.total },
    ...WORK_KINDS.map((kind) => ({
      key: kind,
      label: productCategoryLabel(kind),
      count: counts.byCategory[kind] ?? 0
    })),
    { key: "none", label: "Not work / untagged", count: counts.none },
    { key: "edited", label: "Edited by hand", count: counts.edited }
  ];

  return (
    <main className="insights-shell">
      <SiteNav current="/review" />

      {params.done ? <div className="notice notice-success">{params.done}</div> : null}
      {params.error ? <div className="notice notice-error">{params.error}</div> : null}

      <header className="insights-header">
        <p className="eyebrow">Review</p>
        <h1>Every post, and what it was filed as.</h1>
        <p className="mission-line">
          The whole collected corpus, tags included, with nothing filtered out. The rankings show
          only work, only mature posts, thirty at a time — the right shape for reading a leaderboard
          and the wrong shape for fixing one, because the posts most worth fixing are the ones a
          filtered view hides. Anything here can be re-tagged in place.
        </p>
        <p className="mission-line">
          A tag you set is permanent. The six-hour cycle keeps collecting posts and re-reading them,
          but it will not overwrite a category a person chose, so the corrections accumulate rather
          than being undone overnight. Both{" "}
          <Link href="/posts" className="hero-inline-link">
            the post rank
          </Link>{" "}
          and{" "}
          <Link href="/categories" className="hero-inline-link">
            the category ranking
          </Link>{" "}
          are recomputed on every page load, so a change lands immediately. Only the written brief
          waits for the next cycle.
        </p>

        <div className="health-strip">
          <div>
            <strong>{counts.total}</strong>
            <span>posts collected</span>
          </div>
          <div>
            <strong>{counts.total - counts.none}</strong>
            <span>filed as work</span>
          </div>
          <div>
            <strong>{counts.none}</strong>
            <span>not work</span>
          </div>
          <div>
            <strong>{counts.edited}</strong>
            <span>set by hand</span>
          </div>
        </div>
      </header>

      <section className="panel">
        <h3>Narrow it down</h3>
        <p className="panel-question">
          Start with <strong>Not work / untagged</strong> sorted by likes: a popular post sitting in
          there is either a genuine take or a piece of work that was misfiled, and the second kind
          is what is missing from the rankings.
        </p>

        <div className="filter-chips" role="group" aria-label="Filter by category">
          {filters.map((entry) => (
            <Link
              key={entry.key}
              href={link({ filter: entry.key, sort, author })}
              className={entry.key === filter ? "filter-chip active" : "filter-chip"}
              aria-current={entry.key === filter ? "true" : undefined}
            >
              {entry.label}
              <span className="filter-count">{entry.count}</span>
            </Link>
          ))}
        </div>

        <div className="review-controls">
          <div className="metric-toggle" role="group" aria-label="Sort order">
            {SORTS.map((entry) => (
              <Link
                key={entry.key}
                href={link({ filter, sort: entry.key, author })}
                className={entry.key === sort ? "metric-option active" : "metric-option"}
                aria-current={entry.key === sort ? "true" : undefined}
              >
                {entry.label}
              </Link>
            ))}
          </div>

          <form className="author-filter" action="/review" method="get">
            <input type="hidden" name="filter" value={filter} />
            <input type="hidden" name="sort" value={sort} />
            <label className="sr-only" htmlFor="author">
              Builder
            </label>
            <select id="author" name="author" defaultValue={author ?? ""}>
              <option value="">Every builder</option>
              {authors.map((entry) => (
                <option value={entry.username} key={entry.username}>
                  @{entry.username} ({entry.posts})
                </option>
              ))}
            </select>
            <button type="submit" className="ghost-button">
              Show
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <ul className="review-list">
          {posts.map((post) => (
            <li className="review-row" key={post.id}>
              <div className="review-body">
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
                    {compactNumber(post.likeCount)} likes
                    {post.engagement === null ? "" : ` · ${post.engagement.toFixed(1)} per 1k`} ·{" "}
                    {new Date(post.createdAt).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                    {post.edited ? <span className="fresh-flag">set by hand</span> : null}
                    {post.addedByHand ? <span className="fresh-flag">added by hand</span> : null}
                    {post.tagged ? null : <span className="fresh-flag">never tagged</span>}
                  </span>
                </div>

                <p className="rank-text">{cleanPostText(post.text, 320)}</p>

                <div className="rank-meta">
                  {post.categories.length ? (
                    post.categories.map((category) => (
                      <span className="tag" key={category}>
                        {productCategoryLabel(category)}
                      </span>
                    ))
                  ) : (
                    <span className="tag tag-muted">not work</span>
                  )}
                  <a href={post.url} target="_blank" rel="noreferrer" className="rank-link">
                    Open post
                  </a>
                </div>
              </div>

              <form action={setPostCategoriesAction} className="review-form">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <TagSlots
                  selected={post.categories}
                  idPrefix={`post-${post.id}`}
                  primaryEmptyLabel="Not work"
                />
                <button type="submit" className="approve-button">
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>

        {posts.length ? null : <p className="empty-note">Nothing matches this filter.</p>}

        <div className="pager">
          {page > 1 ? (
            <Link href={link({ filter, sort, author, page: String(page - 1) })} className="rank-link">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="footnote">Page {page}</span>
          {posts.length === REVIEW_PAGE_SIZE ? (
            <Link href={link({ filter, sort, author, page: String(page + 1) })} className="rank-link">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </section>

      <footer className="insights-footer">
        <p className="footnote">
          Almost every post is one thing. The second slot is for the rare post that genuinely handed
          over two — a tutorial that ships the playable toy it teaches, a client site released as an
          open-source library — and a post with two tags is counted in both categories. Using it as
          a hedge between two candidates is worse than picking one, because it inflates both.
        </p>
        <p className="footnote">
          Choosing <em>Not work</em> is a real answer rather than a blank one: it records that the
          post handed over nothing made and drops it out of both rankings, which is what should
          happen to a take, a question or a conference photo however well it performed.
        </p>
      </footer>
    </main>
  );
}
