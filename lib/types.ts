export type Builder = {
  id: string;
  username: string;
  name: string;
  description: string;
  profileImageUrl: string | null;
  followersCount: number | null;
  verified: boolean;
  lastSyncedAt: string | null;
  focusSummary: string | null;
  focusProducts: string[];
  focusRelevance: number | null;
  /**
   * What this builder makes, read from their whole recent output rather than
   * from whatever they happened to post this week. `workKinds` uses the same
   * vocabulary as the post categories, so a builder's stated output and the
   * ranking of what resonates can be read against each other.
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

export type DiscoveryCandidate = {
  id: string;
  xUserId: string;
  username: string;
  name: string;
  description: string;
  profileImageUrl: string | null;
  followersCount: number;
  relevanceScore: number | null;
  relevanceReason: string | null;
  discoveredBy: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};
