import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = { s: string; d: string; ns: string; t?: string };

const W = 1200;
const H = 630;
const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, ""); // ASCII-only

// super-conservative row view (no emojis, no borderRadius, no gap)
function RowView({ it }: { it: Row }) {
  return (
    <div
      style={{
        display: "block",
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 10,
        border: "1px solid rgba(255,255,255,0.1)",
        backgroundColor: "rgba(255,255,255,0.05)",
        marginBottom: 10,
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 800, display: "inline" }}>{`$${it.s}`}</div>
      <span style={{ opacity: 0.7, paddingLeft: 12, paddingRight: 12 }}>|</span>
      <span style={{ fontSize: 28, display: "inline" }}>{it.d}d</span>
      <span style={{ opacity: 0.7, paddingLeft: 12, paddingRight: 12 }}>|</span>
      <span style={{ fontSize: 22, opacity: 0.9, display: "inline" }}>
        {it.ns === "1" ? "never sold" : `no-sell ${it.ns}d`}
      </span>
      {it.t ? (
        <span
          style={{
            fontSize: 18,
            opacity: 0.95,
            paddingLeft: 12,
            paddingRight: 12,
            marginLeft: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        >
          {it.t}
        </span>
      ) : null}
    </div>
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Title (ASCII only)
  const title =
    clean(
      searchParams.get("title") ||
        "Relics Revealed"
    ) || "Relics Revealed";

  // Extract up to 4 rows from sN/dN/nsN/tN
  const rows: Row[] = [];
  for (let i = 1; i <= 4; i++) {
    const s = searchParams.get(`s${i}`);
    const d = searchParams.get(`d${i}`);
    const ns = searchParams.get(`ns${i}`);
    const t = searchParams.get(`t${i}`) || undefined;
    if (s && d && ns) {
      rows.push({
        s: clean(s.toUpperCase()),
        d: clean(d),
        ns: clean(ns),
        t: t ? clean(t) : undefined,
      });
    }
  }

  // Fallback content so route always renders
  const list =
    rows.length > 0
      ? rows.slice(0, 4)
      : [
          { s: "TOBY", d: "123", ns: "1", t: "Gold" },
          { s: "USDC", d: "88", ns: "30" },
        ];

  // Minimal, crash-proof layout (no gradients, no fancy CSS)
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          color: "#ffffff",
          backgroundColor: "#150022",
          paddingLeft: 48,
          paddingRight: 48,
          paddingTop: 48,
          paddingBottom: 48,
          display: "block",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ display: "block", marginBottom: 24 }}>
          <div
            style={{
              display: "inline-block",
              verticalAlign: "middle",
              width: 64,
              height: 64,
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              textAlign: "center",
              lineHeight: "64px",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            PoT
          </div>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              marginLeft: 16,
              verticalAlign: "middle",
            }}
          >
            {title}
          </span>
        </div>

        {/* Rows (render explicitly to avoid JSX quirks) */}
        <div>
          {list[0] ? <RowView it={list[0]} /> : null}
          {list[1] ? <RowView it={list[1]} /> : null}
          {list[2] ? <RowView it={list[2]} /> : null}
          {list[3] ? <RowView it={list[3]} /> : null}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            left: 48,
            bottom: 40,
            fontSize: 18,
            opacity: 0.85,
          }}
        >
          proofoftime.vercel.app
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
