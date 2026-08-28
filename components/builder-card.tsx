import Image from "next/image";
import type { Builder } from "@/lib/types";
import { compactNumber, relativeDate } from "@/lib/format";

export function BuilderCard({ builder, rank }: { builder: Builder; rank: number }) {
  return (
    <article className="builder-card">
      <div className="rank-column" aria-label={`Rank ${rank}`}>
        <span className="rank-hash">#</span>
        <strong>{rank}</strong>
      </div>

      <div className="builder-content">
        <header className="builder-header">
          <div className="identity">
            {builder.profileImageUrl ? (
              <Image
                src={builder.profileImageUrl}
                alt=""
                width={64}
                height={64}
                className="avatar"
              />
            ) : (
              <div className="avatar avatar-fallback" aria-hidden="true">
                {builder.name.slice(0, 1)}
              </div>
            )}
            <div className="identity-copy">
              <div className="name-line">
                <h2>{builder.name}</h2>
                {builder.verified ? <span className="verified" aria-label="Verified">✓</span> : null}
              </div>
              <a
                href={`https://x.com/${builder.username}`}
                target="_blank"
                rel="noreferrer"
                className="handle"
              >
                @{builder.username}
              </a>
            </div>
          </div>

          <div className="follower-count">
            <strong>{compactNumber(builder.followersCount)}</strong>
            <span>{builder.followersCount === null ? "" : "followers"}</span>
          </div>
        </header>

        <p className="bio">{builder.description || "No biography available."}</p>

        <div className="posts-heading">
          <span>Recent builds</span>
          {builder.lastSyncedAt ? <span>Updated {relativeDate(builder.lastSyncedAt)} ago</span> : null}
        </div>

        {builder.posts.length ? (
          <ol className="post-list">
            {builder.posts.map((post) => (
              <li key={post.id}>
                <a href={post.url} target="_blank" rel="noreferrer" className="post-link">
                  <span className="post-text">{post.text}</span>
                  <span className="post-meta">
                    <span>{relativeDate(post.createdAt)}</span>
                    <span>♥ {compactNumber(post.likeCount)}</span>
                    <span>↻ {compactNumber(post.repostCount)}</span>
                    <span className="open-post">Open on X ↗</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <div className="posts-placeholder">
            Recent posts will appear after the first X sync.
          </div>
        )}
      </div>
    </article>
  );
}
