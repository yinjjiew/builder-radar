import { ActionForm } from "@/components/action-form";
import { BuilderCard } from "@/components/builder-card";
import { TagSlots } from "@/components/tag-slots";
import { addUpAction } from "@/app/curate/actions";
import { getBuilders, hasDatabase } from "@/lib/db";
import { isAdmin } from "@/lib/role";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [builders, admin] = await Promise.all([getBuilders(), isAdmin()]);
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
            <Link href="/insights" className="nav-link">Insights</Link>
            {admin ? <Link href="/review" className="nav-link">Review</Link> : null}
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
              Followers set the order, not the membership. Each entry carries at most two tags
              naming what that builder focuses on, chosen by hand from the same vocabulary the
              posts are categorised with. The six-hour update refreshes follower counts and
              collects posts; it never rewrites a tag or a description.
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

        {admin ? (
          <div className="curate-inline">
            <h3>Add a builder</h3>
            <p className="section-note">
              Paste an X handle or profile link and say what they build. The tag is required: you
              have just read their feed, which is the only moment anyone actually knows. The
              description is optional. Their posts arrive with the next six-hour update, and the
              insights brief picks them up on the same cycle.
            </p>
            <ActionForm action={addUpAction} className="add-creator-form add-creator-tagged">
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
              <TagSlots selected={[]} idPrefix="new-builder" />
              <label className="sr-only" htmlFor="up-note">
                Description
              </label>
              <input
                id="up-note"
                name="note"
                placeholder="What they build, in a sentence (optional)"
                autoComplete="off"
                maxLength={400}
              />
              <button type="submit" className="approve-button">
                Add builder
              </button>
            </ActionForm>
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
