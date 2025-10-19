// app/share/opengraph-image.tsx
import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// These exports are VALID (and recommended) on opengraph-image.* files:
export const contentType = "image/png";
export const size = { width: 1200, height: 630 }; // Next will use these if you omit in ImageResponse

type Row = { s: string; d: string; ns: string; t?: string };

export default function Image({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "");
  const title = clean((searchParams.title as string) || "Relics Revealed");

  const rows: Row[] = [];
  for (let i = 1; i <= 4; i++) {
    const s = searchParams[`s${i}`];
    const d = searchParams[`d${i}`];
    const ns = searchParams[`ns${i}`];
    const t = searchParams[`t${i}`];
    if (typeof s === "string" && typeof d === "string" && typeof ns === "string") {
      rows.push({
        s: clean(s),
        d: clean(d),
        ns: clean(ns),
        t: typeof t === "string" ? clean(t) : undefined,
      });
    }
  }

  const Row = (it: Row, i: number) => (
    <div
      key={i}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 800 }}>{`$${it.s}`}</div>
      <div style={{ opacity: 0.7 }}>|</div>
      <div style={{ fontSize: 28 }}>{it.d}d</div>
      <div style={{ opacity: 0.7 }}>|</div>
      <div style={{ fontSize: 22, opacity: 0.9 }}>
        {it.ns === "1" ? "never sold" : `no-sell ${it.ns}d`}
      </div>
      {it.t && (
        <div
          style={{
            marginLeft: 8,
            padding: "2px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.2)",
            backgroundColor: "rgba(255,255,255,0.08)",
            fontSize: 18,
          }}
        >
          {it.t}
        </div>
      )}
    </div>
  );

  return new ImageResponse(
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 48,
        color: "white",
        backgroundColor: "#150022", // solid color = crash-proof
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              display: "grid",
              placeItems: "center",
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            PoT
          </div>
          <div style={{ fontSize: 46, fontWeight: 800 }}>{title}</div>
        </div>
        <div style={{ fontSize: 20, opacity: 0.8 }}>{"Time > hype - #ProofOfTime"}</div>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gap: 14 }}>
        {rows.length
          ? rows.map(Row)
          : [
              { s: "TOBY", d: "123", ns: "1", t: "Gold" },
              { s: "USDC", d: "88", ns: "30" },
              { s: "WETH", d: "55", ns: "5", t: "Silver" },
            ].map(Row)}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: 0.85,
          fontSize: 18,
        }}
      >
        <div>proofoftime.vercel.app</div>
        <div style={{ display: "flex", gap: 10 }}>
          {["Bronze", "Silver", "Gold", "Platinum", "Obsidian"].map((t) => (
            <div
              key={t}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.16)",
                backgroundColor: "rgba(255,255,255,0.06)",
                fontSize: 16,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>,
    { width: size.width, height: size.height }
  );
}
