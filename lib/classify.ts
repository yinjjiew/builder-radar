import { aiModel, getAiClient, hasAi } from "@/lib/ai";
import type { XPost, XUser } from "@/lib/x";

export type CandidateAssessment = {
  score: number;
  qualifies: boolean;
  reason: string;
};

/**
 * The model is only asked for a hint, so a malformed answer must never abort a
 * discovery pass. Anything unusable becomes null, and `score` is clamped to the
 * 0-100 range that the discovery_candidates check constraint enforces.
 */
function parseAssessment(raw: string): CandidateAssessment | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;

  const { score, qualifies, reason } = value as Record<string, unknown>;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;

  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    qualifies: Boolean(qualifies),
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : "No explanation given."
  };
}

export async function classifyCandidate(
  user: XUser,
  posts: XPost[]
): Promise<CandidateAssessment | null> {
  if (!hasAi()) return null;

  const client = getAiClient();
  const postText = posts.map((post, index) => `${index + 1}. ${post.text}`).join("\n");
  const input = `Evaluate whether this X account belongs in Builder Radar.

Builder Radar is a curated directory of individual design engineers and creative developers who frequently publish concrete things they personally build: interactive websites, interfaces, AI software experiments, Three.js/WebGL work, games, or creative-coding demos.

Reject company accounts, aggregators, generic technology commentary, news accounts, marketing-only accounts, and accounts that mostly repost other people's work.

Account: @${user.username}
Name: ${user.name}
Bio: ${user.description ?? ""}

Recent original posts:
${postText || "No recent original posts were available."}`;

  const response = await client.responses.create({
    model: aiModel(),
    input,
    text: {
      format: {
        type: "json_schema",
        name: "builder_radar_assessment",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            score: { type: "integer", minimum: 0, maximum: 100 },
            qualifies: { type: "boolean" },
            reason: { type: "string" }
          },
          required: ["score", "qualifies", "reason"]
        }
      }
    }
  });

  return parseAssessment(response.output_text);
}
