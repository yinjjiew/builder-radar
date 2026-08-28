import Image from "next/image";
import Link from "next/link";
import { getDiscoveryCandidates, getManagedCreators, hasDatabase } from "@/lib/db";
import { addCreator, reviewCandidate, setCreatorStatus } from "@/app/admin/actions";
import { compactNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type AdminSearchParams = Promise<{ added?: string; error?: string }>;

export default async function AdminPage({
  searchParams
}: {
  searchParams: AdminSearchParams;
}) {
  const { added, error } = await searchParams;

  if (!hasDatabase()) {
    return (
      <main className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Private review queue</p>
            <h1>Manage directory</h1>
          </div>
          <Link href="/">View public directory</Link>
        </header>
        <div className="empty-state">
          <h2>No database connected</h2>
          <p>Set DATABASE_URL and run the migrations to manage the directory.</p>
        </div>
      </main>
    );
  }

  const [creators, candidates] = await Promise.all([
    getManagedCreators(),
    getDiscoveryCandidates()
  ]);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Private review queue</p>
          <h1>Manage directory</h1>
        </div>
        <Link href="/">View public directory</Link>
      </header>

      {added ? <div className="notice notice-success">{added}</div> : null}
      {error ? <div className="notice notice-error">{error}</div> : null}

      <section className="admin-section">
        <h2>Add a builder</h2>
        <p className="section-note">
          Paste an X username or profile URL. Their posts appear after the next sync.
        </p>
        <form action={addCreator} className="add-creator-form">
          <label className="sr-only" htmlFor="username">
            X username
          </label>
          <input
            id="username"
            name="username"
            placeholder="@username or x.com/username"
            autoComplete="off"
            required
          />
          <button type="submit" className="approve-button">
            Add builder
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>Directory ({creators.filter((c) => c.status === "approved").length} live)</h2>
        {creators.length === 0 ? (
          <p className="section-note">No builders yet. Add one above.</p>
        ) : (
          <ul className="creator-rows">
            {creators.map((creator) => (
              <li key={creator.id} className={`creator-row status-${creator.status}`}>
                {creator.profileImageUrl ? (
                  <Image
                    src={creator.profileImageUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="avatar"
                  />
                ) : (
                  <div className="avatar avatar-fallback">{creator.name[0]}</div>
                )}

                <div className="creator-identity">
                  <strong>{creator.name}</strong>
                  <a
                    href={`https://x.com/${creator.username}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{creator.username}
                  </a>
                </div>

                <div className="creator-stats">
                  <span>{compactNumber(creator.followersCount)}</span>
                  <span>{creator.postCount} posts</span>
                  {creator.isSeed ? <span className="tag">seed</span> : null}
                  {creator.status === "paused" ? <span className="tag">paused</span> : null}
                </div>

                <div className="creator-controls">
                  <form action={setCreatorStatus}>
                    <input type="hidden" name="id" value={creator.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={creator.status === "approved" ? "paused" : "approved"}
                    />
                    <button type="submit" className="ghost-button">
                      {creator.status === "approved" ? "Pause" : "Resume"}
                    </button>
                  </form>
                  <form action={setCreatorStatus}>
                    <input type="hidden" name="id" value={creator.id} />
                    <input type="hidden" name="status" value="removed" />
                    <button type="submit" className="reject-button">
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section">
        <h2>Discovered candidates</h2>
        {candidates.length === 0 ? (
          <p className="section-note">
            Automatic discovery is not on a schedule, because reading full following lists
            is billed per account and costs far more than the post sync. Run
            <code>/api/cron/check-following</code> by hand if you want a discovery pass.
          </p>
        ) : (
          <div className="candidate-list">
            {candidates.map((candidate) => (
              <article className="candidate-card" key={candidate.id}>
                <div className="candidate-person">
                  {candidate.profileImageUrl ? (
                    <Image
                      src={candidate.profileImageUrl}
                      alt=""
                      width={52}
                      height={52}
                      className="avatar"
                    />
                  ) : (
                    <div className="avatar avatar-fallback">{candidate.name[0]}</div>
                  )}
                  <div>
                    <h3>{candidate.name}</h3>
                    <a
                      href={`https://x.com/${candidate.username}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{candidate.username}
                    </a>
                  </div>
                </div>
                <p>{candidate.description || "No bio provided."}</p>
                <div className="candidate-meta">
                  <span>{candidate.followersCount.toLocaleString()} followers</span>
                  <span>
                    Score {candidate.relevanceScore === null ? "pending" : candidate.relevanceScore}
                  </span>
                  <span>
                    Found via {candidate.discoveredBy.map((name) => `@${name}`).join(", ")}
                  </span>
                </div>
                <p className="assessment">{candidate.relevanceReason}</p>
                {candidate.status === "pending" ? (
                  <form action={reviewCandidate} className="review-actions">
                    <input type="hidden" name="id" value={candidate.id} />
                    <button name="decision" value="approved" className="approve-button">
                      Approve
                    </button>
                    <button name="decision" value="rejected" className="reject-button">
                      Reject
                    </button>
                  </form>
                ) : (
                  <div className={`decision decision-${candidate.status}`}>{candidate.status}</div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
