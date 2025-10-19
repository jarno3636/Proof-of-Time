// app/api/og/relic.png/route.tsx
import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";
export const revalidate = 0;
export const dynamic = "force-dynamic";

type Row = { s: string; d: string; ns: string; t?: string };

// GET /api/og/relic.png?title=...&s1=TOBY&d1=123&ns1=1&t1=Gold&...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const title = searchParams.get("title") || "Relics Revealed"; // keep simple title to avoid rare glyph issues

  const items: Row[] = [];
  for (let i = 1; i <= 4; i++) {
    const s = searchParams.get(`s${i}`);
    const d = searchParams.get(`d${i}`);
    const ns = searchParams.get(`ns${i}`); // "1" = never sold; else streak days
    const t = searchParams.get(`t${i}`) || undefined;
    if (s && d && ns) items.push({ s, d, ns, t });
  }

  const width = 1200;
  const height = 630;

  const row = (item: Row, idx: number) => (
    <div
      key={idx}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 800 }}>{`$${item.s}`}</div>
      <div style={{ opacity: 0.9 }}>•</div>
      <div style={{ fontSize: 28 }}>{item.d}d</div>
      <div style={{ opacity: 0.9 }}>•</div>
      <div style={{ fontSize: 24, opacity: 0.9 }}>
        {item.ns === "1" ? "✦ never sold" : `⏳ ${item.ns}d`}
      </div>
      {item.t && (
        <div
          style={{
            marginLeft: 10,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 20,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          {item.t}
        </div>
      )}
    </div>
  );

  // Return ImageResponse directly (DON'T wrap in new Response(...))
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
            "radial-gradient(1200px 600px at -10% -20%, #5b21b6 0%, rgba(20,20,20,1) 48%), radial-gradient(900px 400px at 120% 120%, #9333ea 0%, rgba(10,10,10,1) 52%)",
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
                fontSize: 40,
              }}
            >
              ⏳
            </div>
            <div style={{ fontSize: 46, fontWeight: 800 }}>{title}</div>
          </div>
          <div style={{ fontSize: 20, opacity: 0.8 }}>Time &gt; hype • #ProofOfTime</div>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gap: 14 }}>
          {items.length
            ? items.map((it, i) => row(it, i))
            : [
                { s: "TOBY", d: "123", ns: "1", t: "Gold" },
                { s: "USDC", d: "88", ns: "30" },
                { s: "WETH", d: "55", ns: "5", t: "Silver" },
              ].map((it, i) => row(it, i))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 22, opacity: 0.85 }}>farcaster miniapp • proof of time</div>
          <div style={{ display: "flex", gap: 10 }}>
            {["Bronze", "Silver", "Gold", "Platinum", "Obsidian"].map((t) => (
              <div
                key={t}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 18,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width, height } // content-type is set automatically to image/png
  );
}
