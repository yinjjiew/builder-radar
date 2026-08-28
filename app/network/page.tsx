import { SiteNav } from "@/components/site-nav";
import { hasDatabase } from "@/lib/db";
import { compactNumber } from "@/lib/format";
import { layoutGraph, placeLabels } from "@/lib/graph-layout";
import { BUCKET_LABELS } from "@/lib/seed-creators";
import { getNetworkGraph } from "@/lib/network";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Network · Builder Radar",
  description:
    "The 30 builders in the directory and the on-theme accounts they follow, as a follow graph."
};

const BUCKET_COLORS: Record<string, string> = {
  "no-code": "#c8ff2f",
  indie: "#ff9f45",
  craft: "#69d2ff",
  "3d": "#c98bff"
};

const CANDIDATE_COLOR = "#5c6470";

function radius(followers: number, core: boolean) {
  // Area would make the largest accounts swallow the canvas, so the scale is
  // logarithmic: it preserves the ordering while keeping every node clickable.
  const base = 5 + Math.log10(1 + followers) * 2.6;
  return core ? base + 2.5 : base;
}

export default async function NetworkPage() {
  if (!hasDatabase()) {
    return (
      <main className="insights-shell">
        <SiteNav current="/network" />
        <p className="empty-note">Connect PostgreSQL to see the network.</p>
      </main>
    );
  }

  const { nodes, edges, lastRun } = await getNetworkGraph();
  const core = nodes.filter((node) => node.kind === "core");
  const candidates = nodes.filter((node) => node.kind === "candidate");

  const sized = nodes.map((node) => ({
    node,
    radius: radius(node.followers, node.kind === "core")
  }));

  const { positions, width, height } = layoutGraph(
    sized.map((entry) => ({
      id: entry.node.id,
      weight: entry.node.followers,
      radius: entry.radius,
      pinned: entry.node.kind === "core"
    })),
    edges
  );
  const at = new Map(positions.map((position) => [position.id, position]));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const radiusOf = new Map(sized.map((entry) => [entry.node.id, entry.radius]));

  // Roster members get first claim on label space; candidates fill the gaps.
  const labels = new Map(
    placeLabels(
      sized
        .filter((entry) => entry.node.kind === "core" || entry.node.followers > 30_000)
        .map((entry) => {
          const position = at.get(entry.node.id);
          return {
            id: entry.node.id,
            text: entry.node.username,
            x: position?.x ?? 0,
            y: position?.y ?? 0,
            radius: entry.radius,
            fontSize: entry.node.kind === "core" ? 11 : 9.5,
            priority:
              (entry.node.kind === "core" ? 1_000_000 : 0) + entry.node.followers
          };
        })
    ).map((label) => [label.id, label])
  );

  const ranked = [...candidates].sort(
    (a, b) => b.followedBy.length - a.followedBy.length || b.followers - a.followers
  );

  return (
    <main className="insights-shell">
      <SiteNav current="/network" />

      <header className="insights-header">
        <p className="eyebrow">Network</p>
        <h1>Who the directory follows.</h1>
        <p className="mission-line">
          The {core.length} builders in the directory, plus {candidates.length} accounts they
          follow that fit the same theme. The second group is the pipeline: these are the people
          worth considering for the directory next.
        </p>
        <div className="health-strip">
          <div>
            <strong>{core.length}</strong>
            <span>in the directory</span>
          </div>
          <div>
            <strong>{candidates.length}</strong>
            <span>candidates found</span>
          </div>
          <div>
            <strong>{edges.length}</strong>
            <span>follow links drawn</span>
          </div>
          <div>
            <strong>{lastRun ? `$${lastRun.cost.toFixed(2)}` : "–"}</strong>
            <span>cost of this graph</span>
          </div>
        </div>
      </header>

      {nodes.length ? (
        <section className="panel graph-panel">
          <div className="graph-legend">
            {Object.entries(BUCKET_LABELS).map(([key, label]) => (
              <span key={key}>
                <i style={{ background: BUCKET_COLORS[key] }} /> {label}
              </span>
            ))}
            <span>
              <i style={{ background: CANDIDATE_COLOR }} /> Candidate, not yet in the directory
            </span>
          </div>

          <div className="graph-scroll">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="graph-svg"
              role="img"
              aria-label={`Follow graph of ${core.length} builders and ${candidates.length} candidates`}
            >
              <g stroke="#4a525e" strokeWidth="1">
                {edges.map((edge, index) => {
                  const a = at.get(edge.source);
                  const b = at.get(edge.target);
                  if (!a || !b) return null;
                  const targetIsCore = byId.get(edge.target)?.kind === "core";
                  return (
                    <line
                      key={`${edge.source}-${edge.target}-${index}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      opacity={targetIsCore ? 0.75 : 0.4}
                    />
                  );
                })}
              </g>

              {nodes.map((node) => {
                const position = at.get(node.id);
                if (!position) return null;
                const isCore = node.kind === "core";
                const size = radiusOf.get(node.id) ?? 6;
                const label = labels.get(node.id);
                const color = isCore
                  ? BUCKET_COLORS[node.bucket ?? ""] ?? "#c8ff2f"
                  : CANDIDATE_COLOR;
                return (
                  // SVG anchors work without any client JavaScript.
                  <a
                    key={node.id}
                    href={`https://x.com/${node.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="graph-node"
                  >
                    <title>
                      {`@${node.username} · ${compactNumber(node.followers)} followers${
                        isCore ? " · in the directory" : ""
                      }${node.followedBy.length ? ` · followed by ${node.followedBy.length} of the directory` : ""}`}
                    </title>
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r={size}
                      fill={color}
                      fillOpacity={isCore ? 0.9 : 0.6}
                      stroke={isCore ? "#0d0f12" : "#3a4049"}
                      strokeWidth={isCore ? 1.5 : 1}
                    />
                    {label ? (
                      <text
                        x={label.x}
                        y={label.y}
                        textAnchor="middle"
                        className={isCore ? "graph-label core" : "graph-label"}
                      >
                        {node.username}
                      </text>
                    ) : null}
                  </a>
                );
              })}
            </svg>
          </div>

          <p className="footnote">
            Node size is the log of follower count, so ordering is preserved without the largest
            accounts covering the canvas. A line means the directory member follows that account.
            Every node links to its X profile.
          </p>
        </section>
      ) : (
        <section className="panel">
          <p className="empty-note">
            The graph has not been built yet. It is a paid, manually triggered pass rather than part
            of the six-hour cycle.
          </p>
        </section>
      )}

      {ranked.length ? (
        <section className="panel">
          <h3>Candidates worth adding</h3>
          <p className="panel-question">
            Ranked by how many of the directory follow them. Being followed by several independent
            members is a far stronger signal than any single bio, because it is a judgement made by
            people already doing the work.
          </p>

          <ol className="candidate-list">
            {ranked.map((node) => (
              <li key={node.id}>
                <div className="candidate-main">
                  <a href={`https://x.com/${node.username}`} target="_blank" rel="noreferrer">
                    @{node.username}
                  </a>
                  <span className="candidate-sub">
                    {compactNumber(node.followers)} followers · followed by{" "}
                    {node.followedBy.length} of the directory
                  </span>
                  {node.reason ? <p className="candidate-reason">{node.reason}</p> : null}
                </div>
                <div className="candidate-scouts">
                  {node.followedBy.slice(0, 6).map((scout) => (
                    <span className="tag" key={scout}>
                      @{scout}
                    </span>
                  ))}
                  {node.followedBy.length > 6 ? (
                    <span className="tag">+{node.followedBy.length - 6}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <footer className="insights-footer">
        <p className="footnote">
          {lastRun
            ? `Built ${new Date(lastRun.at).toLocaleString("en", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              })} by reading ${lastRun.accountsRead} follow records across ${lastRun.scouts} builders, at a cost of $${lastRun.cost.toFixed(2)}.`
            : "No graph pass has run yet."}
        </p>
        <p className="footnote">
          X charges $0.010 for every account returned from a following list — ten times the price of
          reading a post. Refreshing this graph every six hours like the rest of the site would cost
          over a thousand dollars a month, so it is deliberately a manual pass. Follower counts on
          the nodes stay current with the daily profile refresh; only the connections are frozen
          until the next run.
        </p>
      </footer>
    </main>
  );
}
