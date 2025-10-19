// app/share/[...slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

type Row = { s: string; d: string; ns: string; t?: string };

const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, ""); // ASCII only
const W = 1200;
const H = 630;

function parseRow(seg: string): Row | null {
  // seg format: SYMBOL-DAYS-NS[-TIER]
  const parts = seg.split("-");
  if (parts.length < 3) return null;
  const [s, d, ns, t] = parts;
  if (!s || !d || !ns) return null;
  return { s: clean(decodeURIComponent(s)), d: clean(d), ns: clean(ns), t: t ? clean(decodeURIComponent(t)) : undefined };
}

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

export default function Image({ params }: { params: { slug?: string[] } }) {
  const titleRaw = (params.slug?.[0] ?? "Relics Revealed");
  const title = clean(decodeURIComponent(titleRaw));

  // Parse up to 4 rows
  const rows: Row[] = [];
  for (let i = 1; i <= 4; i++) {
    const seg = params.slug?.[i];
    if (!seg) break;
    const r = parseRow(seg);
    if (r) rows.push(r);
  }

  const fallback: Row[] = [
    { s: "TOBY", d: "123", ns: "1", t: "Gold" },
    { s: "USDC", d: "88", ns: "30" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          color: "#fff",
          backgroundColor: "#150022",
          paddingLeft: 48,
          paddingRight: 48,
          paddingTop: 48,
          paddingBottom: 48,
          display: "block",
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
          <span style={{ fontSize: 44, fontWeight: 800, marginLeft: 16, verticalAlign: "middle" }}>
            {title}
          </span>
        </div>

        {/* Body */}
        <div>
          {(rows.length ? rows : fallback).slice(0, 4).map((it, idx) => (
            // Avoid Array.map directly in JSX constructs? This simple one is usually fine,
            // but if it ever crashes, expand to explicit conditional renders [0..3].
            <RowView key={idx} it={it} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ position: "absolute", left: 48, bottom: 40, fontSize: 18, opacity: 0.85 }}>
          proofoftime.vercel.app
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
