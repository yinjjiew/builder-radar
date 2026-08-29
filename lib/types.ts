export type Builder = {
  id: string;
  username: string;
  name: string;
  description: string;
  profileImageUrl: string | null;
  followersCount: number | null;
  verified: boolean;
  lastSyncedAt: string | null;
  /**
   * What this builder makes: at most two tags and an optional sentence, both set
   * by hand and never touched by the six-hour cycle. The tags use the same
   * vocabulary as the post categories, so a builder's stated output and the
   * ranking of what resonates can be read against each other.
   *
   * The AI's own read of each builder still exists in the database and still
   * feeds the statistics and the brief. It is not shown here, because anything
   * shown here has to survive the next cycle unchanged.
   */
  workKinds: string[];
  workSummary: string | null;
  /** Activity only: enough to see the roster is live, without quoting posts. */
  postCount: number;
  latestPostAt: string | null;
};

/**
 * 'guest' is the author of a post added by hand who is not on the ranked roster:
 * their posts count towards the statistics, they do not appear as a builder.
 */
export type CreatorStatus = "approved" | "paused" | "removed" | "guest";

export type ManagedCreator = {
  id: string;
  username: string;
  name: string;
  profileImageUrl: string | null;
  followersCount: number | null;
  status: CreatorStatus;
  lastSyncedAt: string | null;
  postCount: number;
  isSeed: boolean;
};

/*
 * DiscoveryCandidate lived here until the follow graph was removed. Candidates
 * only ever came from reading following lists, which is the one genuinely
 * expensive call against the X API, so nothing can produce one any more. The
 * table is left in the database rather than dropped, because the rows record
 * accounts that were once considered and that is worth keeping.
 */
