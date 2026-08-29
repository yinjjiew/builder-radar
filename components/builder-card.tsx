import Image from "next/image";
import { ConfirmButton } from "@/components/confirm-button";
import { removeUpAction } from "@/app/curate/actions";
import type { Builder } from "@/lib/types";
import { compactNumber, relativeDate } from "@/lib/format";
import { workKindLabel } from "@/lib/mission";

export function BuilderCard({
  builder,
  rank,
  admin = false
}: {
  builder: Builder;
  rank: number;
  admin?: boolean;
}) {
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

          {/* The rank column is only wide enough for the number, so the one admin
              control on this card sits under the follower count instead. */}
          <div className="builder-aside">
            <div className="follower-count">
              <strong>{compactNumber(builder.followersCount)}</strong>
              <span>{builder.followersCount === null ? "" : "followers"}</span>
            </div>
            {admin ? (
              <form action={removeUpAction} className="inline-form">
                <input type="hidden" name="creatorId" value={builder.id} />
                <input type="hidden" name="returnTo" value="/" />
                <ConfirmButton
                  className="danger-link"
                  message={`Remove @${builder.username} from the directory permanently?\n\nThey will drop out of the ranking and the network, and the six-hour update will not add them back.\n\nTheir collected posts stop counting towards the statistics.`}
                >
                  Remove
                </ConfirmButton>
              </form>
            ) : null}
          </div>
        </header>

        <p className="bio">{builder.description || "No biography available."}</p>

        <div className="work-block">
          <div className="posts-heading">
            <span>What kinds of work they do</span>
            {builder.lastSyncedAt ? (
              <span>Updated {relativeDate(builder.lastSyncedAt)} ago</span>
            ) : null}
          </div>

          {builder.workKinds.length ? (
            <p className="work-kinds">
              {builder.workKinds.map((kind) => (
                <span className="work-kind" key={kind}>
                  {workKindLabel(kind)}
                </span>
              ))}
            </p>
          ) : null}

          {builder.workSummary ? (
            <p className="work-summary">{builder.workSummary}</p>
          ) : (
            <div className="posts-placeholder">
              A read of their work appears after the next enrichment run.
            </div>
          )}

          <p className="work-activity">
            {builder.postCount ? (
              <>
                {builder.postCount} post{builder.postCount === 1 ? "" : "s"} tracked
                {builder.latestPostAt ? ` · latest ${relativeDate(builder.latestPostAt)} ago` : ""}
              </>
            ) : (
              "No posts collected yet."
            )}
          </p>
        </div>
        {builder.focusSummary ? (
          <div className="builder-focus">
            <p className="builder-focus-head">
              <span>What they are working on right now</span>
              {builder.focusRelevance !== null ? (
                <span className="relevance-chip">{builder.focusRelevance}/100 relevance</span>
              ) : null}
            </p>
            <p>{builder.focusSummary}</p>
            {builder.focusProducts.length ? (
              <p className="focus-products">
                <span>Products</span>
                {builder.focusProducts.map((product) => (
                  <span className="tag" key={product}>
                    {product}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}

      </div>
    </article>
  );
}
