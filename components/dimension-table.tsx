import { compactNumber } from "@/lib/format";
import type { DimensionRow } from "@/lib/stats";

// Fewer mature posts than this and a median is a coincidence rather than a
// finding, so the row is marked instead of being quietly ranked alongside the rest.
const THIN_SAMPLE = 5;

export function DimensionTable({
  title,
  question,
  rows,
  label,
  emptyNote = "Nothing tagged yet. This fills in after the next enrichment run."
}: {
  title: string;
  question: string;
  rows: DimensionRow[];
  label: (key: string) => string;
  emptyNote?: string;
}) {
  if (!rows.length) {
    return (
      <section className="panel">
        <h3>{title}</h3>
        <p className="panel-question">{question}</p>
        <p className="empty-note">{emptyNote}</p>
      </section>
    );
  }

  // Rows with a usable sample lead, thin ones follow. Sorting purely by median
  // would let a single post with one lucky number head the table and own the
  // longest bar, which reads as the headline finding when it is closer to noise.
  const reliable = rows.filter((row) => row.posts >= THIN_SAMPLE);
  const thin = rows.filter((row) => row.posts < THIN_SAMPLE);
  const byEngagement = (a: DimensionRow, b: DimensionRow) =>
    b.medianEngagement - a.medianEngagement;
  const ordered = [...reliable.sort(byEngagement), ...thin.sort(byEngagement)];

  // Scaled to the best reliable row so the bars compare things worth comparing.
  const peak = Math.max(...(reliable.length ? reliable : rows).map((row) => row.medianEngagement), 0.0001);

  return (
    <section className="panel">
      <h3>{title}</h3>
      <p className="panel-question">{question}</p>

      <div className="table-scroll">
        <table className="stat-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className="numeric">Posts</th>
              <th scope="col" className="numeric">Likes per 1k followers</th>
              <th scope="col" className="numeric">Breakout</th>
              <th scope="col" className="numeric">Total likes</th>
              <th scope="col" className="numeric">Last 30d</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const isThin = row.posts < THIN_SAMPLE;
              return (
                <tr key={row.key} className={isThin ? "thin-row" : undefined}>
                  <th scope="row">
                    <span className="row-label">{label(row.key)}</span>
                    <span className="row-sub">
                      {row.creators} {row.creators === 1 ? "builder" : "builders"}
                    </span>
                  </th>
                  <td className="numeric">
                    {row.posts}
                    {isThin ? (
                      <span
                        className="thin-flag"
                        title={`Only ${row.posts} mature posts — treat as directional, not proof`}
                      >
                        thin
                      </span>
                    ) : null}
                  </td>
                  <td className="numeric">
                    <span className="bar-cell">
                      <span className="bar-value">{row.medianEngagement.toFixed(1)}</span>
                      <span className="bar-track" aria-hidden="true">
                        <span
                          className="bar-fill"
                          style={{ width: `${Math.max(2, (row.medianEngagement / peak) * 100)}%` }}
                        />
                      </span>
                    </span>
                  </td>
                  <td className="numeric">
                    {row.medianBreakout === null ? (
                      <span className="na">n/a</span>
                    ) : (
                      `${row.medianBreakout.toFixed(2)}×`
                    )}
                  </td>
                  <td className="numeric">{compactNumber(row.totalLikes)}</td>
                  <td className="numeric">{row.recentPosts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
