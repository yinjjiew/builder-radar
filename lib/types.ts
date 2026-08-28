export type BuilderPost = {
  id: string;
  text: string;
  createdAt: string;
  url: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
};

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
  posts: BuilderPost[];
};

export type CreatorStatus = "approved" | "paused" | "removed";

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
