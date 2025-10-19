import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = { s: string; d: string; ns: string; t?: string };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "");
  const title = clean(searchParams.get("title") || "Relics Revealed");

  const items: Row[] = [];
  for (let i = 1; i <= 4; i++) {
    const s = searchParams.get(`s${i}`);
    const d = searchParams.get(`d${i}`);
    const ns = searchParams.get(`ns${i}`);
    const t = searchParams.get(`t${i}`) || undefined;
    if (s && d && ns) items.push({ s: clean(s), d: clean(d), ns: clean(ns), t: t ? clean(t) : undefined });
  }

  const width = 1200;
  const height = 630;

  const row = (it: Row, i: number) => (
    <div
      key={i}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.05)",
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
            background: "rgba(255,255,255,0.08)",
            fontSize: 18,
          }}
        >
          {it.t}
        </div>
      )}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 48,
          color: "white",
          background:
            "linear-gradient(135deg, #111 0%, #2a004d 35%, #4b0082 100%)",
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
                background: "rgba(255,255,255,0.08)",
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
          {items.length
            ? items.map(row)
            : [
                { s: "TOBY", d: "123", ns: "1", t: "Gold" },
                { s: "USDC", d: "88", ns: "30" },
                { s: "WETH", d: "55", ns: "5", t: "Silver" },
              ].map(row)}
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
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 16,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width, height }
  );
}
