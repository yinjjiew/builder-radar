import { getAiClient, aiModel, hasAi, parseJsonObject } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { MISSION_SHORT } from "@/lib/mission";
import { getFollowing, type XUser } from "@/lib/x";

/**
 * Builds the follow graph behind /network.
 *
 * This is the one expensive operation in the project. X bills $0.010 per account
 * returned from a following list, so the cost of a pass is exactly
 * `scouts x perScout x $0.010` and is fixed before the first request goes out.
 * Reading every builder's full following list would cost roughly $300 and would
 * be over $1,000 a month on the six-hour cycle, which is why this is deliberately
 * kept off the cron and run by hand.
 */
const COST_PER_ACCOUNT_READ = 0.01;

export const NETWORK_DEFAULTS = { scouts: 30, perScout: 50 };

// Candidates below this are almost always personal accounts with no public work.
const MIN_CANDIDATE_FOLLOWERS = 1_500;

// Keeps the drawn graph legible and bounds the AI screening pass.
const SHORTLIST = 90;
const MAX_GRAPH_CANDIDATES = 55;

const POSITIVE = [
  "build", "building", "ship", "shipping", "maker", "indie", "founder", "creator",
  "design engineer", "designer", "developer", "engineer", "creative", "three.js",
  "threejs", "webgl", "shader", "frontend", "front-end", "react", "next.js", "css",
  "animation", "motion", "interface", "ui", "ux", "product", "prototype", "app",
  "tool", "open source", "oss", "startup", "saas", "no-code", "nocode", "ai",
  "llm", "agent", "generative", "bootstrapped", "solopreneur", "webdev"
];

const NEGATIVE = [
  "journalist", "reporter", "news", "politics", "crypto", "nft", "trader",
  "investor relations", "recruiter", "sports", "official account"
];

/**
 * Cheap prefilter. Its only job is to stop obvious noise from reaching the AI
 * screen; the model makes the actual keep/drop decision.
 */
function heuristicScore(user: XUser) {
  const text = `${user.name ?? ""} ${user.description ?? ""}`.toLowerCase();
  if (!text.trim()) return 0;
  let score = 0;
  for (const term of POSITIVE) if (text.includes(term)) score += 8;
  for (const term of NEGATIVE) if (text.includes(term)) score -= 25;
  const followers = user.public_metrics?.followers_count ?? 0;
  if (followers > 5_000) score += 5;
  if (followers > 50_000) score += 5;
  return Math.max(0, Math.min(100, score));
}

type Candidate = {
  user: XUser;
  inDegree: number;
  followedBy: string[];
  heuristic: number;
};

/**
 * Asks the model which shortlisted accounts actually fit the directory. Batched
 * because one request per account would be both slow and wasteful, and screening
 * is a judgement the keyword filter cannot make: "building the future of X" says
 * nothing about whether someone ships visible work.
 */
async function screenCandidates(candidates: Candidate[]) {
  const keep = new Map<string, { keep: boolean; score: number; reason: string }>();
  if (!hasAi() || !candidates.length) return keep;

  const client = getAiClient();
  const batches: Candidate[][] = [];
  for (let index = 0; index < candidates.length; index += 18) {
    batches.push(candidates.slice(index, index + 18));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const listing = batch
        .map(
          (candidate, index) =>
            `${index + 1}. @${candidate.user.username} (${
              candidate.user.public_metrics?.followers_count ?? 0
            } followers) — ${(candidate.user.description ?? "no bio").replace(/\s+/g, " ").slice(0, 200)}`
        )
        .join("\n");

      try {
        const response = await client.responses.create({
          model: aiModel(),
          input: [
            {
              role: "system",
              content:
                `You screen accounts for a directory of people who publicly build and ship things people can see and use.\n` +
                `The directory exists to inform this mission: ${MISSION_SHORT}\n\n` +
                `Keep an account only if the person themselves designs, builds, or ships software, interfaces, tools, or creative work in public.\n` +
                `Drop: company and product accounts, investors, recruiters, commentators and news accounts, researchers who do not ship, ` +
                `and anyone whose bio gives no evidence of building.\n` +
                `Score 0-100 for how useful they would be in the directory. Be strict; most accounts should be dropped.`
            },
            { role: "user", content: `Screen these accounts:\n\n${listing}` }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "screen",
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["results"],
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["username", "keep", "score", "reason"],
                      properties: {
                        username: { type: "string" },
                        keep: { type: "boolean" },
                        score: { type: "integer" },
                        reason: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        });

        const parsed = parseJsonObject(response.output_text ?? "");
        const results = Array.isArray(parsed?.results) ? parsed.results : [];
        for (const row of results) {
          const entry = row as Record<string, unknown>;
          const username = String(entry.username ?? "").replace(/^@+/, "").toLowerCase();
          if (!username) continue;
          keep.set(username, {
            keep: Boolean(entry.keep),
            score: Math.max(0, Math.min(100, Number(entry.score) || 0)),
            reason: String(entry.reason ?? "").slice(0, 280)
          });
        }
      } catch {
        // A failed batch just means those candidates fall back to the heuristic.
      }
    })
  );

  return keep;
}

export async function buildNetwork(options: Partial<typeof NETWORK_DEFAULTS> = {}) {
  const sql = getDb();
  const scouts = Math.max(1, Math.min(options.scouts ?? NETWORK_DEFAULTS.scouts, 60));
  const perScout = Math.max(1, Math.min(options.perScout ?? NETWORK_DEFAULTS.perScout, 200));

  const creators = await sql<Array<{ id: string; username: string; x_user_id: string }>>`
    select id, username, x_user_id from creators
    where status = 'approved' and x_user_id is not null
    order by followers_count desc nulls last
    limit ${scouts}
  `;

  const creatorIds = new Set(creators.map((creator) => creator.x_user_id));
  const seen = new Map<string, Candidate>();
  const errors: Array<{ username: string; error: string }> = [];
  let accountsRead = 0;
  let edgesWritten = 0;

  for (const creator of creators) {
    try {
      const following = await getFollowing(creator.x_user_id, perScout);
      accountsRead += following.length;

      for (const user of following) {
        await sql`
          insert into following_edges (source_user_id, target_user_id)
          values (${creator.x_user_id}, ${user.id})
          on conflict (source_user_id, target_user_id) do update set last_seen_at = now()
        `;
        edgesWritten += 1;

        // Edges between roster members are kept for the graph but the person is
        // already in the directory, so they are not a discovery candidate.
        if (creatorIds.has(user.id)) continue;
        if ((user.public_metrics?.followers_count ?? 0) < MIN_CANDIDATE_FOLLOWERS) continue;

        const existing = seen.get(user.id);
        if (existing) {
          existing.inDegree += 1;
          existing.followedBy.push(creator.username);
        } else {
          seen.set(user.id, {
            user,
            inDegree: 1,
            followedBy: [creator.username],
            heuristic: heuristicScore(user)
          });
        }
      }

      await sql`
        update creators set following_baselined_at = now() where id = ${creator.id}
      `;
    } catch (error) {
      errors.push({
        username: creator.username,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // How many of the roster follow someone is the strongest available signal that
  // they belong in this world, so it outranks the bio keywords.
  const shortlist = [...seen.values()]
    .filter((candidate) => candidate.inDegree > 1 || candidate.heuristic >= 16)
    .sort((a, b) => b.inDegree - a.inDegree || b.heuristic - a.heuristic)
    .slice(0, SHORTLIST);

  const screened = await screenCandidates(shortlist);

  const scored = shortlist
    .map((candidate) => {
      const verdict = screened.get(candidate.user.username.toLowerCase());
      const score = verdict ? verdict.score : candidate.heuristic;
      const kept = verdict ? verdict.keep : candidate.heuristic >= 32;
      return { candidate, score, kept, reason: verdict?.reason ?? "Matched directory keywords." };
    })
    .filter((row) => row.kept)
    .sort((a, b) => b.candidate.inDegree - a.candidate.inDegree || b.score - a.score);

  const onGraph = new Set(scored.slice(0, MAX_GRAPH_CANDIDATES).map((row) => row.candidate.user.id));

  for (const row of scored) {
    const { user } = row.candidate;
    await sql`
      insert into discovery_candidates (
        x_user_id, username, name, description, profile_image_url,
        followers_count, relevance_score, relevance_reason, discovered_by,
        theme_score, on_graph
      ) values (
        ${user.id}, ${user.username}, ${user.name}, ${user.description ?? ""},
        ${user.profile_image_url ?? null}, ${user.public_metrics?.followers_count ?? 0},
        ${row.score}, ${row.reason}, ${sql.array(row.candidate.followedBy)},
        ${row.score}, ${onGraph.has(user.id)}
      )
      on conflict (x_user_id) do update set
        username = excluded.username,
        name = excluded.name,
        description = excluded.description,
        profile_image_url = excluded.profile_image_url,
        followers_count = excluded.followers_count,
        relevance_score = excluded.relevance_score,
        relevance_reason = excluded.relevance_reason,
        theme_score = excluded.theme_score,
        on_graph = excluded.on_graph,
        discovered_by = (
          select array_agg(distinct value)
          from unnest(discovery_candidates.discovered_by || excluded.discovered_by) value
        ),
        updated_at = now()
    `;
  }

  const cost = Number((accountsRead * COST_PER_ACCOUNT_READ).toFixed(2));
  const detail = {
    scouts: creators.length,
    perScout,
    accountsRead,
    edgesWritten,
    uniqueAccounts: seen.size,
    shortlisted: shortlist.length,
    kept: scored.length,
    onGraph: onGraph.size,
    errors
  };

  await sql`
    insert into network_runs (
      scouts, per_scout_limit, accounts_read, edges_written,
      candidates_kept, estimated_cost_usd, detail
    ) values (
      ${creators.length}, ${perScout}, ${accountsRead}, ${edgesWritten},
      ${scored.length}, ${cost}, ${sql.json(JSON.parse(JSON.stringify(detail)))}
    )
  `;

  return { ...detail, estimatedCostUsd: cost };
}

export type GraphNode = {
  id: string;
  username: string;
  name: string;
  followers: number;
  kind: "core" | "candidate";
  bucket: string | null;
  reason: string | null;
  followedBy: string[];
};

export async function getNetworkGraph() {
  const sql = getDb();

  const core = await sql<
    Array<{
      x_user_id: string;
      username: string;
      name: string;
      followers_count: number | null;
      bucket: string | null;
    }>
  >`
    select x_user_id, username, name, followers_count, bucket
    from creators
    where status = 'approved' and x_user_id is not null
    order by followers_count desc nulls last
  `;

  const candidates = await sql<
    Array<{
      x_user_id: string;
      username: string;
      name: string;
      followers_count: number;
      relevance_reason: string | null;
      discovered_by: string[] | null;
    }>
  >`
    select x_user_id, username, name, followers_count, relevance_reason, discovered_by
    from discovery_candidates
    where on_graph = true and status = 'pending'
    order by followers_count desc
  `;

  const nodes: GraphNode[] = [
    ...core.map((row) => ({
      id: row.x_user_id,
      username: row.username,
      name: row.name,
      followers: row.followers_count ?? 0,
      kind: "core" as const,
      bucket: row.bucket,
      reason: null,
      followedBy: []
    })),
    ...candidates.map((row) => ({
      id: row.x_user_id,
      username: row.username,
      name: row.name,
      followers: row.followers_count,
      kind: "candidate" as const,
      bucket: null,
      reason: row.relevance_reason,
      followedBy: row.discovered_by ?? []
    }))
  ];

  const ids = nodes.map((node) => node.id);
  const edges = ids.length
    ? await sql<Array<{ source_user_id: string; target_user_id: string }>>`
        select source_user_id, target_user_id from following_edges
        where source_user_id = any(${sql.array(ids)})
          and target_user_id = any(${sql.array(ids)})
      `
    : [];

  const [run] = await sql<
    Array<{ accounts_read: number; estimated_cost_usd: string; created_at: Date; scouts: number }>
  >`
    select accounts_read, estimated_cost_usd, created_at, scouts
    from network_runs order by created_at desc limit 1
  `;

  return {
    nodes,
    edges: edges.map((edge) => ({ source: edge.source_user_id, target: edge.target_user_id })),
    lastRun: run
      ? {
          accountsRead: run.accounts_read,
          cost: Number(run.estimated_cost_usd),
          scouts: run.scouts,
          at: run.created_at
        }
      : null
  };
}
