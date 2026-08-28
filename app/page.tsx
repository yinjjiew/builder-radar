import { BuilderCard } from "@/components/builder-card";
import { getBuilders, hasDatabase } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const builders = await getBuilders();
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
          <a href="#directory" className="nav-link">Explore directory</a>
        </nav>

        <div className="hero-copy">
          <p className="eyebrow">Signals from people who ship</p>
          <h1>See what the internet’s most inventive builders are making.</h1>
          <p className="hero-description">
            A focused feed of design engineers and creative developers—ranked by audience,
            updated from their latest original posts.
          </p>
          <div className="hero-stats" aria-label="Directory details">
            <div><strong>{builders.length}</strong><span>curated builders</span></div>
            <div><strong>5</strong><span>recent posts each</span></div>
            <div><strong>6h</strong><span>refresh cycle</span></div>
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

        <div className="builder-list">
          {builders.map((builder, index) => (
            <BuilderCard builder={builder} rank={index + 1} key={builder.id} />
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
