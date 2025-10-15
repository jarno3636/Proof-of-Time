import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Proof of Time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function fetchTop3(address: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/relic/${address}`, { cache: "no-store" });
  return res.json();
}

export async function GET(_: Request, { params }: { params: { address: string } }) {
  const { address } = params;
  const data = await fetchTop3(address);

  const items: any[] = data.tokens ?? [];
  const palette = { bg: "#0B0E14", fg: "#EDEEF2", gold: "#C7A46B" };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          background: palette.bg, color: palette.fg, display: "flex", flexDirection: "column",
          padding: 48, fontFamily: "Inter, ui-sans-serif, system-ui",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -0.5 }}>Proof of Time</div>
        <div style={{ marginTop: 8, opacity: 0.7 }}>Relics forged by time • Base</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 32 }}>
          {items.map((it) => (
            <div key={it.symbol} style={{
              borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))"
            }}>
              <div style={{ fontSize: 20, opacity: 0.8 }}>{it.tier} Relic</div>
              <div style={{ fontSize: 56, fontWeight: 800, marginTop: 8 }}>
                {it.days}<span style={{ fontSize: 28, opacity: 0.8 }}> d</span>
              </div>
              <div style={{ fontSize: 24, marginTop: 8 }}>${it.symbol}</div>
              <div style={{ marginTop: 8, fontSize: 20, color: palette.gold }}>
                {it.never_sold ? "Never sold" : `No-sell ${it.no_sell_streak_days}d`}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", opacity: 0.65, fontSize: 20 }}>
          Built for Base • Farcaster native
        </div>
      </div>
    ),
    { ...size }
  );
}
