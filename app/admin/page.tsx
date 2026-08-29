import Image from "next/image";
import Link from "next/link";
import { getDiscoveryCandidates, getManagedCreators, hasDatabase } from "@/lib/db";
import { addCreator, reviewCandidate, setCreatorStatus } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { restoreUpAction, unblockPostAction } from "@/app/curate/actions";
import { getBlockedPosts } from "@/lib/curate";
import { compactNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type AdminSearchParams = Promise<{
  added?: string;
  error?: string;
  done?: string;
}>;

export default async function AdminPage({
  searchParams
}: {
  searchParams: AdminSearchParams;
}) {
  const { added, error, done } = await searchParams;

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

  const [allCreators, candidates, blockedPosts] = await Promise.all([
    getManagedCreators(),
    getDiscoveryCandidates(),
    getBlockedPosts()
  ]);

  const creators = allCreators.filter((creator) => creator.status !== "removed");
  const removed = allCreators.filter((creator) => creator.status === "removed");

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
      {done ? <div className="notice notice-success">{done}</div> : null}
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
                    <ConfirmButton
                      className="reject-button"
                      message={`Remove @${creator.username} from the directory permanently?\n\nThey will drop out of the ranking and the network, and the six-hour update will not add them back — including if they are on the seed list.\n\nYou can undo this from the removed list below.`}
                    >
                      Remove
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section">
        <h2>Removed builders ({removed.length})</h2>
        <p className="section-note">
          Removal is permanent by design: the six-hour update will not add these back, even the
          ones that came from the seed list. This is the only place it can be undone.
        </p>
        {removed.length === 0 ? (
          <p className="section-note">Nothing removed.</p>
        ) : (
          <ul className="creator-rows">
            {removed.map((creator) => (
              <li key={creator.id} className="creator-row status-removed">
                <div className="creator-identity">
                  <strong>{creator.name}</strong>
                  <a href={`https://x.com/${creator.username}`} target="_blank" rel="noreferrer">
                    @{creator.username}
                  </a>
                </div>
                <div className="creator-stats">
                  <span>{compactNumber(creator.followersCount)}</span>
                  <span>{creator.postCount} posts</span>
                  {creator.isSeed ? <span className="tag">seed</span> : null}
                </div>
                <div className="creator-controls">
                  <form action={restoreUpAction}>
                    <input type="hidden" name="creatorId" value={creator.id} />
                    <input type="hidden" name="returnTo" value="/admin" />
                    <button type="submit" className="ghost-button">
                      Restore
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section">
        <h2>Deleted posts ({blockedPosts.length})</h2>
        <p className="section-note">
          These post ids are refused on every sync, which is what stops the next update from
          collecting them again from their author&rsquo;s timeline. Unblocking one lets it return.
        </p>
        {blockedPosts.length === 0 ? (
          <p className="section-note">No posts deleted.</p>
        ) : (
          <ul className="creator-rows">
            {blockedPosts.map((post) => (
              <li key={post.postId} className="creator-row">
                <div className="creator-identity">
                  <strong>@{post.username || "unknown"}</strong>
                  {post.url ? (
                    <a href={post.url} target="_blank" rel="noreferrer">
                      Open on X
                    </a>
                  ) : null}
                </div>
                <div className="creator-stats">
                  <span>
                    {post.createdAt
                      ? new Date(post.createdAt).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric"
                        })
                      : ""}
                  </span>
                </div>
                <div className="creator-controls">
                  <form action={unblockPostAction}>
                    <input type="hidden" name="postId" value={post.postId} />
                    <input type="hidden" name="returnTo" value="/admin" />
                    <button type="submit" className="ghost-button">
                      Unblock
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
