import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const revalidate = 0;

/** Safe readers from searchParams (no fetches) */
function getOne(sp: Record<string, string | string[] | undefined>, k: string) {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v ?? "";
}
function num(v: string, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
}
function bool(v: string) {
  return /^(1|true|yes|on)$/i.test(v || "");
}

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";

export default async function Image({
  searchParams,
}: {
  params: { address: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const W = 1200, H = 630;

  // ——— read data from URL (no network calls) ———
  const symbol = (getOne(searchParams, "sym") || "RELIC").toUpperCase().slice(0, 10);
  const days   = num(getOne(searchParams, "days"), 0);
  const nsd    = num(getOne(searchParams, "nsd"), 0);
  const tier   = (getOne(searchParams, "tier") || "Bronze") as Tier;
  const never  = bool(getOne(searchParams, "never"));

  const badgeText = never ? "Never sold" : `No-sell ${nsd}d`;

  // If nothing was provided (or everything is default), still render a nice brand card
  const justBrand = symbol === "RELIC" && days === 0 && nsd === 0 && tier === "Bronze" && !never;

  const Row = () => (
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
        <div style={{ color: "#d8d6cf", fontSize: 18, letterSpacing: 2 }}>{tier} Relic</div>
        <div style={{ color: "#f6f1e6", fontSize: 56, fontWeight: 800, fontFamily: "serif" }}>${symbol}</div>
        <div
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 12,
            background: never ? "rgba(16,120,80,0.18)" : "rgba(60,140,210,0.18)",
            border: `1px solid ${never ? "rgba(80,225,160,0.35)" : "rgba(120,190,255,0.35)"}`,
            color: never ? "#b8f8d2" : "#d6ecff",
            fontSize: 16,
          }}
        >
          {badgeText}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ color: "#fff", fontSize: 92, fontWeight: 800, lineHeight: 0.9 }}>{days}</div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 26, marginTop: 6 }}>days held</div>
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H, display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg,#0b0e14,#141a22)",
          color: "#fff", padding: 0, position: "relative",
        }}
      >
        <div style={{ padding: "56px 48px 0 48px" }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#f2e9d0", fontFamily: "serif" }}>
            Proof of Time
          </div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,0.78)", fontSize: 18 }}>
            Relics forged by patience — I stood the test of time.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 48px 0 48px" }}>
          {justBrand ? null : <Row />}
        </div>

        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: 60,
            background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center",
            justifyContent: "flex-end", paddingRight: 56,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 20 }}>
            Time &gt; hype • #ProofOfTime
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
