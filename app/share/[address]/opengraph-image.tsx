import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const revalidate = 0;

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
type Lite = {
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: Tier;
};

/** base64url → string (edge-safe) */
function b64urlDecode(input: string): string {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function parsePayload(searchParams: Record<string, string | string[] | undefined>): Lite[] | null {
  try {
    const raw = Array.isArray(searchParams["data"]) ? searchParams["data"][0] : (searchParams["data"] as string | undefined);
    if (!raw) return null;
    const json = b64urlDecode(raw);
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return null;
    // Minimal validation
    return arr
      .slice(0, 3)
      .map((t) => ({
        symbol: String(t.symbol || "RELIC"),
        days: Math.max(0, Number(t.days) || 0),
        no_sell_streak_days: Math.max(0, Number(t.no_sell_streak_days) || 0),
        never_sold: !!t.never_sold,
        tier: (t.tier as Tier) || ("Bronze" as Tier),
      })) as Lite[];
  } catch {
    return null;
  }
}

export default async function Image({
  searchParams,
}: {
  params: { address: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const W = 1200,
    H = 630;

  // Render strictly from payload (no external fetch at edge)
  const chosen: Lite[] =
    parsePayload(searchParams) ??
    ([{ symbol: "RELIC", days: 0, no_sell_streak_days: 0, never_sold: true, tier: "Bronze" }] as Lite[]);

  const Row = (t: Lite) => {
    const badge = t.never_sold ? "Never sold" : `No-sell ${t.no_sell_streak_days}d`;
    return (
      <div
        style={{
          display: "flex",
          gap: 24,
          width: W - 96,
          padding: 16,
          borderRadius: 20,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", width: 120, height: 120 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ position: "absolute", inset: 8, borderRadius: 999, background: "#141a22", border: "4px solid #C8AC6B" }} />
          <div style={{ position: "absolute", inset: 24, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.25)" }} />
          <div style={{ position: "absolute", left: 50, top: 50, width: 20, height: 20, borderRadius: 4, background: "#fff", opacity: 0.95 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ color: "#d8d6cf", fontSize: 18, letterSpacing: 2 }}>{t.tier} Relic</div>
          <div style={{ color: "#f6f1e6", fontSize: 44, fontWeight: 800, fontFamily: "serif" }}>${t.symbol}</div>
          <div
            style={{
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 12,
              background: t.never_sold ? "rgba(16,120,80,0.18)" : "rgba(60,140,210,0.18)",
              border: `1px solid ${t.never_sold ? "rgba(80,225,160,0.35)" : "rgba(120,190,255,0.35)"}`,
              color: t.never_sold ? "#b8f8d2" : "#d6ecff",
              fontSize: 14,
            }}
          >
            {badge}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#fff", fontSize: 70, fontWeight: 800, lineHeight: 0.9 }}>{t.days}</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 22, marginTop: 4 }}>days held</div>
        </div>
      </div>
    );
  };

  const rows = chosen.map((t, i) => <Row key={i as any} {...t} />);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg,#0b0e14,#141a22)",
          color: "#fff",
          padding: 0,
          position: "relative",
        }}
      >
        <div style={{ padding: "56px 48px 0 48px" }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#f2e9d0", fontFamily: "serif" }}>Proof of Time</div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,0.78)", fontSize: 16 }}>
            Relics forged by patience — I stood the test of time.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 48px 0 48px" }}>{rows}</div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 56,
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 56,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 18 }}>Time &gt; hype • #ProofOfTime</div>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
