import { ImageResponse } from "next/og";

export const alt = "Builder Radar — a ranked directory of design engineers and creative developers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#11140f",
          color: "#fffef8",
          padding: "80px 90px",
          fontFamily: "Georgia, serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "3px solid #c8f15a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#c8f15a" }} />
          </div>
          <div
            style={{
              fontSize: 26,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontFamily: "sans-serif"
            }}
          >
            Builder Radar
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 74, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            See what the internet&rsquo;s most inventive builders are making.
          </div>
          <div style={{ fontSize: 30, color: "#c8f15a", fontFamily: "sans-serif" }}>
            Design engineers and creative developers, ranked.
          </div>
        </div>
      </div>
    ),
    size
  );
}
