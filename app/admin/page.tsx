import Image from "next/image";
import Link from "next/link";
import { getDiscoveryCandidates } from "@/lib/db";
import { reviewCandidate } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const candidates = await getDiscoveryCandidates();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Private review queue</p>
          <h1>Candidate accounts</h1>
        </div>
        <Link href="/">View public directory</Link>
      </header>

      {candidates.length === 0 ? (
        <div className="empty-state">
          <h2>No candidates yet</h2>
          <p>The first following check creates a baseline. New followees appear after that.</p>
        </div>
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
                  <h2>{candidate.name}</h2>
                  <a href={`https://x.com/${candidate.username}`} target="_blank">
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
                <span>Found via {candidate.discoveredBy.map((name) => `@${name}`).join(", ")}</span>
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
    </main>
  );
}
