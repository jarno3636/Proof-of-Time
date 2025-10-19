import { ImageResponse } from "next/og";
import { put } from "@vercel/blob";
import type { NextRequest } from "next/server";
import React from "react"; // <-- needed when using JSX in a route

export const runtime = "edge";

type Token = {
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier?: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
};

type Body = {
  title: string;
  tokens: Token[];
  kind?: "relics" | "altar";
};

const size = { width: 1200, height: 630 };

function clean(s: string) {
  return s.replace(/[^\x20-\x7E]/g, "");
}

function Card({ title, rows }: { title: string; rows: Token[] }) {
  const Row = (t: Token, i: number) => (
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
      <div style={{ fontSize: 34, fontWeight: 800 }}>{`$${t.symbol}`}</div>
      <div style={{ opacity: 0.7 }}>|</div>
      <div style={{ fontSize: 28 }}>{t.days}d</div>
      <div style={{ opacity: 0.7 }}>|</div>
      <div style={{ fontSize: 22, opacity: 0.9 }}>
        {t.never_sold ? "never sold" : `no-sell ${t.no_sell_streak_days}d`}
      </div>
      {t.tier && (
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
          {t.tier}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 48,
        color: "white",
        backgroundColor: "#150022",
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
        {rows.slice(0, 4).map(Row)}
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
    </div>
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  const title = clean(body.title || "Relics Revealed");
  const rows = (body.tokens || []).map((t) => ({
    ...t,
    symbol: clean(t.symbol),
  }));

  // 1) Render PNG
  const image = new ImageResponse(<Card title={title} rows={rows} />, size);
  const arrayBuffer = await image.arrayBuffer();

  // 2) Upload to Vercel Blob (public)
  const key = `relics/${Date.now()}_${title.replace(/\s+/g, "_")}.png`;
  const { url } = await put(key, arrayBuffer, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
  });

  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
