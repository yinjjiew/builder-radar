import { cleanPostText, compactNumber, relativeDate } from "@/lib/format";
import { themeLabel } from "@/lib/mission";
import type { BreakoutRow } from "@/lib/stats";

export function SignalPostList({
  posts,
  metric
}: {
  posts: BreakoutRow[];
  metric: "breakout" | "engagement";
}) {
  if (!posts.length) {
    return <p className="empty-note">Not enough mature posts yet to rank anything.</p>;
  }

  return (
    <ol className="signal-list">
      {posts.map((post) => (
        <li key={post.id}>
          <div className="signal-figure">
            <strong>
              {metric === "breakout"
                ? `${post.breakout === null ? "–" : post.breakout.toFixed(1)}×`
                : post.engagement.toFixed(1)}
            </strong>
            <span>{metric === "breakout" ? "vs own median" : "likes per 1k"}</span>
          </div>

          <div className="signal-body">
            <p className="signal-note">{post.note || cleanPostText(post.text, 160)}</p>
            {/* Without a note the heading already is the post text; showing it twice
                just pads the row. */}
            {post.note ? <p className="signal-quote">{cleanPostText(post.text)}</p> : null}
            <div className="signal-meta">
              <a
                href={`https://x.com/${post.username}`}
                target="_blank"
                rel="noreferrer"
                className="signal-handle"
              >
                @{post.username}
              </a>
              <span>{compactNumber(post.followersCount)} followers</span>
              <span>♥ {compactNumber(post.likeCount)}</span>
              <span>↻ {compactNumber(post.repostCount)}</span>
              <span>{relativeDate(post.createdAt)}</span>
              <a href={post.url} target="_blank" rel="noreferrer" className="signal-open">
                Open on X ↗
              </a>
            </div>
            {post.themes.length ? (
              <div className="signal-themes">
                {post.themes.map((theme) => (
                  <span className="tag" key={theme}>
                    {themeLabel(theme)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
