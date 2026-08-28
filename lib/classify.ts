import OpenAI from "openai";
import type { XPost, XUser } from "@/lib/x";

export type CandidateAssessment = {
  score: number;
  qualifies: boolean;
  reason: string;
};

export async function classifyCandidate(
  user: XUser,
  posts: XPost[]
): Promise<CandidateAssessment | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
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

  return JSON.parse(response.output_text) as CandidateAssessment;
}
