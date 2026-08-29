import { BuilderCard } from "@/components/builder-card";
import { addUpAction } from "@/app/curate/actions";
import { getBuilders, hasDatabase } from "@/lib/db";
import { isAdmin } from "@/lib/role";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const [builders, admin, params] = await Promise.all([
    getBuilders(),
    isAdmin(),
    searchParams
  ]);
  const latestSync = builders
    .map((builder) => builder.lastSyncedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <main>
      <section className="hero">
        <nav className="nav-shell" aria-label="Primary navigation">
          <Link href="/" className="wordmark">
            <span className="radar-mark" aria-hidden="true"><i /></span>
            Builder Radar
          </Link>
          <div className="nav-links">
            <Link href="/posts" className="nav-link">Post rank</Link>
            <Link href="/categories" className="nav-link">Categories</Link>
            <Link href="/network" className="nav-link">Network</Link>
            <Link href="/insights" className="nav-link">Insights</Link>
          </div>
        </nav>

        <div className="hero-copy">
          <p className="eyebrow">Signals from people who ship</p>
          <h1>See what the internet’s most inventive builders are making.</h1>
          <p className="hero-description">
            Creative studios, interactive and 3D developers, design engineers and the people
            who make the tools they build with. Everyone here passes two tests: they build for
            the web, and they show the result. Every six hours an AI reads what each one shipped
            and{" "}
            <Link href="/insights" className="hero-inline-link">
              measures which of it the audience actually rewards
            </Link>
            .
          </p>
          <div className="hero-stats" aria-label="Directory details">
            <div><strong>{builders.length}</strong><span>curated builders</span></div>
            <div><strong>6h</strong><span>refresh cycle</span></div>
            <div><strong>AI</strong><span>demand analysis</span></div>
          </div>
        </div>

        <div className="orbit-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="radar-sweep" />
          <div className="radar-dot dot-one" />
          <div className="radar-dot dot-two" />
          <div className="radar-dot dot-three" />
        </div>
      </section>

      <section className="directory-section" id="directory">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The directory</p>
            <h2>Builders, ranked by followers</h2>
            <p className="section-note">
              Followers set the order, not the membership. Each entry says what kinds of work
              that builder actually does, read from their whole recent output rather than from
              whichever few things they posted this week.
            </p>
          </div>
          <p className="sync-note">
            {latestSync
              ? `Live data · last sync ${new Date(latestSync).toLocaleString("en", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit"
                })}`
              : "Awaiting the first X data sync"}
          </p>
        </div>

        {!hasDatabase() ? (
          <div className="setup-banner">
            <span className="setup-indicator" />
            Preview mode: connect PostgreSQL and run the first sync to populate live follower counts and posts.
          </div>
        ) : null}

        {params.done ? <div className="notice notice-success">{params.done}</div> : null}
        {params.error ? <div className="notice notice-error">{params.error}</div> : null}

        {admin ? (
          <div className="curate-inline">
            <h3>Add a builder</h3>
            <p className="section-note">
              Paste an X handle or profile link. Their posts arrive with the next six-hour update,
              and the network graph and insights pick them up on the same cycle.
            </p>
            <form action={addUpAction} className="add-creator-form">
              <label className="sr-only" htmlFor="up-link">
                X username or profile link
              </label>
              <input
                id="up-link"
                name="link"
                placeholder="@username or x.com/username"
                autoComplete="off"
                required
              />
              <input type="hidden" name="returnTo" value="/" />
              <button type="submit" className="approve-button">
                Add builder
              </button>
            </form>
          </div>
        ) : null}

        <div className="builder-list">
          {builders.map((builder, index) => (
            <BuilderCard builder={builder} rank={index + 1} admin={admin} key={builder.id} />
          ))}
        </div>
      </section>

      <footer>
        <Link href="/" className="wordmark footer-wordmark">
          <span className="radar-mark" aria-hidden="true"><i /></span>
          Builder Radar
        </Link>
        <p>Curated by humans. Refreshed by software.</p>
      </footer>
    </main>
  );
}
