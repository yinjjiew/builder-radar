import Image from "next/image";
import Link from "next/link";
import { getManagedCreators, hasDatabase } from "@/lib/db";
import { setCreatorStatus } from "@/app/admin/actions";
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

  const [allCreators, blockedPosts] = await Promise.all([
    getManagedCreators(),
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
          Adding happens on the <Link href="/">directory</Link>, because that form asks for the
          tags a builder is required to have and this one did not.
        </p>
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
                      message={`Remove @${creator.username} from the directory permanently?\n\nThey will drop out of the ranking and the six-hour update will not add them back — including if they are on the seed list.\n\nYou can undo this from the removed list below.`}
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

    </main>
  );
}
