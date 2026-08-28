import Link from "next/link";
import { DimensionTable } from "@/components/dimension-table";
import { SignalPostList } from "@/components/signal-post-list";
import { hasDatabase } from "@/lib/db";
import { compactNumber } from "@/lib/format";
import { artifactLabel, audienceLabel, intentLabel, MISSION, themeLabel } from "@/lib/mission";
import {
  getBreakoutPosts,
  getCorpusHealth,
  getCreatorFocus,
  getNocodeSplit,
  getTagStats,
  getThemeStats,
  getTopEngagementPosts,
  getLatestReport
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Demand signals · Builder Radar",
  description:
    "What the builders in this directory are making, and which of it the audience actually rewards."
};

const BAND_COPY: Record<string, string> = {
  high: "Strongly suggests non-engineers want to build this",
  medium: "Partly relevant to non-engineers",
  low: "Aimed at engineers only"
};

function stamp(value: string | null) {
  if (!value) return "not yet";
  return new Date(value).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default async function InsightsPage() {
  if (!hasDatabase()) {
    return (
      <main className="insights-shell">
        <p className="empty-note">
          Connect PostgreSQL and run an enrichment pass to see demand signals.
        </p>
      </main>
    );
  }

  const [health, report, themes, artifacts, intents, audiences, nocode, breakouts, top, creators] =
    await Promise.all([
      getCorpusHealth(),
      getLatestReport(),
      getThemeStats(),
      getTagStats("artifact"),
      getTagStats("intent"),
      getTagStats("audience"),
      getNocodeSplit(),
      getBreakoutPosts(10),
      getTopEngagementPosts(6),
      getCreatorFocus()
    ]);

  const high = nocode.find((band) => band.band === "high");
  const low = nocode.find((band) => band.band === "low");
  const nocodeRatio =
    high && low && low.medianEngagement > 0 ? high.medianEngagement / low.medianEngagement : null;

  return (
    <main className="insights-shell">
      <nav className="insights-nav" aria-label="Primary navigation">
        <Link href="/" className="wordmark insights-wordmark">
          <span className="radar-mark" aria-hidden="true">
            <i />
          </span>
          Builder Radar
        </Link>
        <Link href="/" className="nav-link-dark">
          Back to directory
        </Link>
      </nav>

      <header className="insights-header">
        <p className="eyebrow">Demand signals</p>
        <h1>What this crowd actually rewards.</h1>
        <p className="mission-line">
          Every number here is measured against one goal: <em>{MISSION}</em>
        </p>
        <div className="health-strip">
          <div>
            <strong>{health.creators}</strong>
            <span>builders</span>
          </div>
          <div>
            <strong>{health.posts}</strong>
            <span>posts collected</span>
          </div>
          <div>
            <strong>{health.maturePosts}</strong>
            <span>comparable</span>
          </div>
          <div>
            <strong>{health.taggedPosts}</strong>
            <span>AI-tagged</span>
          </div>
          <div>
            <strong>{stamp(health.lastEnrichedAt)}</strong>
            <span>last analysis</span>
          </div>
        </div>
      </header>

      {report ? (
        <section className="brief">
          <p className="eyebrow acid">The read · {stamp(report.createdAt)}</p>
          <h2>{report.headline}</h2>
          <p className="brief-body">{report.demandRead}</p>

          {report.opportunities.length ? (
            <div className="brief-block">
              <h3>Where the opening is</h3>
              <ol className="brief-list">
                {report.opportunities.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    {item.evidence ? <p className="brief-evidence">{item.evidence}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {report.recommendations.length ? (
            <div className="brief-block">
              <h3>What to do next</h3>
              <ol className="brief-list">
                {report.recommendations.map((item) => (
                  <li key={item.action}>
                    <strong>{item.action}</strong>
                    <p className="brief-evidence">{item.why}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {report.gaps.length ? (
            <div className="brief-block caution">
              <h3>What this data cannot tell you</h3>
              <ul className="brief-list plain">
                {report.gaps.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {report.watchlist.length ? (
            <div className="brief-block">
              <h3>Watch closely</h3>
              <ul className="watchlist">
                {report.watchlist.map((item) => {
                  // Reports written before handles were normalised still carry a
                  // leading @, and this view supplies its own.
                  const handle = item.username.replace(/^@+/, "");
                  return (
                    <li key={handle}>
                      <a href={`https://x.com/${handle}`} target="_blank" rel="noreferrer">
                        @{handle}
                      </a>
                      <span>{item.why}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="brief">
          <p className="empty-note">
            No strategy brief yet. It is written after enough posts have been tagged.
          </p>
        </section>
      )}

      <section className="method">
        <h2>How to read these numbers</h2>
        <div className="method-grid">
          <div>
            <h4>Likes per 1,000 followers</h4>
            <p>
              Raw like counts cannot be compared between a 3,000-follower account and a
              150,000-follower one. Dividing by audience size makes resonance comparable. In this
              directory the most-followed builder is one of the least resonant per follower, which
              raw likes hide completely.
            </p>
          </div>
          <div>
            <h4>Breakout multiple</h4>
            <p>
              A post divided by the median of its own author&rsquo;s posts. A breakout of 4 means
              this audience wanted that specific thing four times more than they usually want that
              person&rsquo;s work. It is the cleanest signal of appetite for the idea rather than for
              its author.
            </p>
          </div>
          <div>
            <h4>Only mature posts count</h4>
            <p>
              Likes keep climbing for about two days. A post measured 40 minutes after publishing is
              not comparable to one measured a week later, so only posts whose counts were read at
              least 24 hours after publishing enter any ranking. {health.maturePosts} of{" "}
              {health.posts} qualify.
            </p>
          </div>
          <div>
            <h4>Medians, not averages</h4>
            <p>
              One viral post distorts an average badly at these sample sizes. Every central figure
              here is a median, and any group with fewer than five posts is flagged as thin rather
              than ranked as if it were solid.
            </p>
          </div>
        </div>
      </section>

      <DimensionTable
        title="What they build"
        question="Which kinds of work does this audience reward most per follower?"
        rows={themes}
        label={themeLabel}
      />

      <DimensionTable
        title="What kind of thing shipped"
        question="Does a finished artifact beat a demo, a component, or a take?"
        rows={artifacts}
        label={artifactLabel}
      />

      <DimensionTable
        title="How it was presented"
        question="Does shipping outperform talking about shipping?"
        rows={intents}
        label={intentLabel}
      />

      <DimensionTable
        title="Who it was aimed at"
        question="Your platform targets non-engineers. Does this crowd reward that framing?"
        rows={audiences}
        label={audienceLabel}
      />

      <section className="panel">
        <h3>Appetite for no-code-relevant work</h3>
        <p className="panel-question">
          Each post was scored on how strongly it suggests non-engineers would want to build that
          thing themselves. If the high band outperforms the low band, this audience is already
          rewarding the kind of output your platform is meant to produce.
        </p>

        {nocode.length ? (
          <>
            <div className="band-grid">
              {nocode.map((band) => (
                <div className="band" key={band.band}>
                  <p className="band-name">{band.band}</p>
                  <strong>{band.medianEngagement.toFixed(1)}</strong>
                  <span>likes per 1k followers</span>
                  <p className="band-copy">{BAND_COPY[band.band]}</p>
                  <p className="band-n">
                    n = {band.posts}
                    {band.medianBreakout === null
                      ? ""
                      : ` · breakout ${band.medianBreakout.toFixed(2)}×`}
                  </p>
                </div>
              ))}
            </div>
            {nocodeRatio ? (
              <p className="band-verdict">
                No-code-relevant posts resonate <strong>{nocodeRatio.toFixed(1)}×</strong> more per
                follower than engineer-only posts.
              </p>
            ) : null}
          </>
        ) : (
          <p className="empty-note">Waiting on tagged posts.</p>
        )}
      </section>

      <section className="panel">
        <h3>Breakout posts</h3>
        <p className="panel-question">
          Posts that beat their own author&rsquo;s median by the widest margin. These are the moments
          the audience wanted something far more than usual, which makes them the strongest available
          evidence of latent demand.
        </p>
        <SignalPostList posts={breakouts} metric="breakout" />
      </section>

      <section className="panel">
        <h3>Highest resonance overall</h3>
        <p className="panel-question">
          Ranked purely by likes per 1,000 followers, ignoring each author&rsquo;s baseline.
        </p>
        <SignalPostList posts={top} metric="engagement" />
      </section>

      <section className="panel">
        <h3>What each builder is working on</h3>
        <p className="panel-question">
          Refreshed whenever someone posts something new. Relevance scores how much their work
          informs your goal, not how good they are.
        </p>

        <div className="focus-list">
          {creators.map((creator) => (
            <article className="focus-card" key={creator.username}>
              <header>
                <div>
                  <a
                    href={`https://x.com/${creator.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-handle"
                  >
                    @{creator.username}
                  </a>
                  <span className="focus-sub">
                    {compactNumber(creator.followersCount)} followers
                    {creator.medianEngagement === null
                      ? ""
                      : ` · ${creator.medianEngagement.toFixed(1)} likes per 1k`}
                  </span>
                </div>
                <div className="relevance">
                  <span className="relevance-value">
                    {creator.relevance === null ? "–" : creator.relevance}
                  </span>
                  <span className="relevance-label">relevance</span>
                </div>
              </header>

              <p className="focus-summary">
                {creator.summary ?? "Not yet analysed. Runs after their next post."}
              </p>

              {creator.products.length ? (
                <p className="focus-products">
                  <span>Building</span>
                  {creator.products.map((product) => (
                    <span className="tag" key={product}>
                      {product}
                    </span>
                  ))}
                </p>
              ) : null}

              {creator.opportunity ? (
                <p className="focus-opportunity">
                  <span>For you</span> {creator.opportunity}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <footer className="insights-footer">
        <p>
          {health.taggedPosts} of {health.posts} posts tagged · {health.creatorsSummarised} of{" "}
          {health.creators} builders summarised · {health.buildersWithBaseline} have enough mature
          posts for a personal baseline · posts collected from{" "}
          {health.oldestPost ? new Date(health.oldestPost).toLocaleDateString("en") : "–"} to{" "}
          {health.newestPost ? new Date(health.newestPost).toLocaleDateString("en") : "–"}.
        </p>
        <p className="footnote">
          Statistics recompute on every page load. Summaries and the brief refresh every six hours,
          after new posts are collected. The sample is design engineers and creative developers, so
          it reveals what a technical audience rewards; treat it as a signal about craft and appetite,
          not as a survey of non-technical users.
        </p>
      </footer>
    </main>
  );
}
