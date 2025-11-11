// app/api/relic-og/route.tsx
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
type Item = {
  symbol: string;
  days: number;
  tier: Tier;
  never_sold?: boolean;
  no_sell_streak_days?: number;
  token?: string;
};

const W = 1200;
const H = 630;

const tierColors: Record<Tier, { bg: string; rim: string; glow: string }> = {
  Bronze:   { bg: "#2b1c10", rim: "#C8AC6B", glow: "rgba(200,172,107,0.22)" },
  Silver:   { bg: "#1f242a", rim: "#D6DCE4", glow: "rgba(198,210,222,0.22)" },
  Gold:     { bg: "#2a210b", rim: "#F0D17A", glow: "rgba(240,209,122,0.22)" },
  Platinum: { bg: "#171c28", rim: "#C4D6FF", glow: "rgba(196,214,255,0.22)" },
  Obsidian: { bg: "#0b0e14", rim: "#6a758a", glow: "rgba(106,117,138,0.22)" },
};

function esc(s?: string) {
  return (s || "").replace(/[<>&]/g, (m) => ({ "<":"&lt;","&":"&amp;",">":"&gt;" }[m]!));
}
function short(addr?: string) {
  if (!addr) return "";
  const a = String(addr);
  return a.length > 10 ? `${a.slice(0,6)}…${a.slice(-4)}` : a;
}

function parseItems(req: NextRequest): Item[] {
  const sp = new URL(req.url).searchParams;

  const sym = sp.getAll("symbol[]");
  const days = sp.getAll("days[]");
  const tier = sp.getAll("tier[]");
  const never = sp.getAll("never_sold[]");
  const nosell = sp.getAll("no_sell_streak_days[]");
  const token = sp.getAll("token[]");

  const list: Item[] = sym.length
    ? sym.map((_, i) => ({
        symbol: sym[i],
        days: Number(days[i] ?? 0) || 0,
        tier: (tier[i] as Tier) || "Bronze",
        never_sold: /^(1|true|yes)$/i.test(never[i] || ""),
        no_sell_streak_days: Number(nosell[i] ?? 0) || 0,
        token: token[i],
      }))
    : [{
        symbol: sp.get("symbol") || "RELIC",
        days: Number(sp.get("days") || 0) || 0,
        tier: (sp.get("tier") as Tier) || "Bronze",
        never_sold: /^(1|true|yes)$/i.test(sp.get("never_sold") || ""),
        no_sell_streak_days: Number(sp.get("no_sell_streak_days") || 0) || 0,
        token: sp.get("token") || "",
      }];

  return list.slice(0, 3);
}

function Row({ it }: { it: Item }) {
  const c = tierColors[it.tier];
  const badge = it.never_sold ? "Never sold" : `No-sell ${Math.max(0, it.no_sell_streak_days||0)}d`;

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
      {/* coin */}
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: c.glow }} />
        <div style={{ position: "absolute", inset: 8, borderRadius: 999, background: c.bg, border: `4px solid ${c.rim}` }} />
        <div style={{ position: "absolute", inset: 24, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.25)" }} />
        <div style={{ position: "absolute", left: 50, top: 50, width: 20, height: 20, borderRadius: 4, background: "#fff", opacity: 0.95 }} />
      </div>

      {/* text */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ color: "#d8d6cf", fontSize: 18, letterSpacing: 2 }}>
          {esc(it.tier)} Relic
        </div>
        <div style={{ color: "#f6f1e6", fontSize: 44, fontWeight: 800, fontFamily: "serif" }}>
          ${esc(it.symbol)}
        </div>
        {it.token ? (
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, fontFamily: "monospace" }}>
            {esc(short(it.token))}
          </div>
        ) : null}
        <div style={{
          marginTop: 10, display: "inline-flex", alignItems: "center",
          gap: 8, padding: "6px 10px", borderRadius: 12,
          background: it.never_sold ? "rgba(16,120,80,0.18)" : "rgba(60,140,210,0.18)",
          border: `1px solid ${it.never_sold ? "rgba(80,225,160,0.35)" : "rgba(120,190,255,0.35)"}`,
          color: it.never_sold ? "#b8f8d2" : "#d6ecff", fontSize: 14
        }}>
          {badge}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ color: "#fff", fontSize: 70, fontWeight: 800, lineHeight: 0.9 }}>
          {Math.max(0, it.days || 0)}
        </div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 22, marginTop: 4 }}>
          days held
        </div>
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const items = parseItems(req);

  const body = (
    <div
      style={{
        width: W, height: H, display: "flex", flexDirection: "column",
        background: "linear-gradient(135deg,#0b0e14,#141a22)", color: "#fff",
        padding: 0, position: "relative"
      }}
    >
      {/* header */}
      <div style={{ padding: "56px 48px 0 48px" }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: "#f2e9d0", fontFamily: "serif" }}>
          Proof of Time
        </div>
        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.78)", fontSize: 16 }}>
          Relics forged by patience
        </div>
      </div>

      {/* rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 48px 0 48px" }}>
        {items.map((it, i) => (<Row key={i} it={it} />))}
      </div>

      {/* footer */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 56,
        background: "rgba(255,255,255,0.03)", display: "flex",
        alignItems: "center", justifyContent: "flex-end", paddingRight: 56
      }}>
        <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 18 }}>
          Time &gt; hype • #ProofOfTime
        </div>
      </div>
    </div>
  );

  return new ImageResponse(body, {
    width: W,
    height: H,
    headers: {
      "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
