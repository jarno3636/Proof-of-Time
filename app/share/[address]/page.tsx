import Link from "next/link";
import ShareActions from "@/components/ShareActions";

/** Shared types */
type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: Tier;
};

function absOrigin() {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "").trim();
  if (env) return env.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v}`;
  return "https://proofoftime.vercel.app";
}

async function fetchRelics(addr: string): Promise<Token[]> {
  try {
    const r = await fetch(`${absOrigin()}/api/relic/${addr}`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ tokens: [] as Token[] }));
    return (j?.tokens || []) as Token[];
  } catch {
    return [];
  }
}

/** Parse “selected” (preferred) or “pick” (legacy). */
function parseSelected(sp: URLSearchParams): string[] {
  const raw = (sp.get("selected") || sp.get("pick") || "").trim();
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3);
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: any) {
  const origin = absOrigin();
  const addr = (params.address || "").toLowerCase();
  const selected = (searchParams?.selected || searchParams?.pick || "").toString();
  const title = selected ? `Relics: ${selected}` : `Relics for ${addr.slice(0,6)}…${addr.slice(-4)}`;
  const description = "I stood the test of time. Check your relics at Proof of Time.";
  const url = `${origin}/share/${addr}${selected ? `?selected=${encodeURIComponent(selected)}` : ""}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { address: string };
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  const origin = absOrigin();
  const address = (params.address || "").toLowerCase();

  const sp = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v ?? ""]]
    )
  );
  const picks = parseSelected(sp);

  const all = await fetchRelics(address);
  const chosen =
    picks.length > 0
      ? all
          .filter((t) => picks.includes(t.symbol.toUpperCase()))
          .filter((t, i, arr) => arr.findIndex((x) => x.symbol === t.symbol) === i)
          .slice(0, 3)
      : all.sort((a, b) => (b.days || 0) - (a.days || 0)).slice(0, 3);

  // Canonical share link (used for Farcaster + X; no visible URL text on page)
  const shareUrl = `${origin}/share/${address}${
    picks.length ? `?selected=${encodeURIComponent(picks.join(","))}` : ""
  }`;

  // ✅ Direct OG image endpoint (no .png suffix); downloadable
  const pngUrl =
    `${origin}/share/${address}/opengraph-image` +
    (picks.length ? `?selected=${encodeURIComponent(picks.join(","))}` : "") +
    `&v=${Date.now().toString().slice(-6)}`;

  return (
    <main className="min-h-[100svh] bg-[#0b0e14] text-[#EDEEF2]">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header + short tagline */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Relics to Share
            </h1>
            <p className="opacity-80 mt-1">
              I stood the test of time — come see how you measure up.
            </p>
          </div>

          <a
            href={pngUrl}
            download
            className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/15 text-sm shrink-0"
            title="Download image"
          >
            Download image
          </a>
        </header>

        {/* Altar-styled preview */}
        <section
          data-share="altar"
          className="relative mx-auto max-w-5xl mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.06] to-transparent opacity-50" />
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#BBA46A]" />
              <h2 className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">
                Relic Altar
              </h2>
            </div>
            <div className="text-xs text-zinc-400">
              {chosen.length
                ? `${chosen.length} Relic${chosen.length > 1 ? "s" : ""}`
                : "No Relics Yet"}
            </div>
          </div>

          <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(chosen.length
              ? chosen
              : [
                  {
                    token_address:
                      "0x0000000000000000000000000000000000000000" as `0x${string}`,
                    symbol: "RELIC",
                    days: 0,
                    no_sell_streak_days: 0,
                    never_sold: true,
                    tier: "Bronze" as Tier,
                  },
                ]
            ).map((t, i) => (
              <div
                key={i}
                className="relative rounded-2xl p-4 bg-[#0B0E14]/95 ring-1 ring-white/10 overflow-hidden"
              >
                <div className="text-[11px] tracking-[0.18em] uppercase opacity-70">
                  {t.tier} Relic
                </div>
                <div className="text-2xl font-semibold leading-tight">
                  ${t.symbol}
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-3xl font-bold tracking-tight">
                    {Math.max(0, t.days || 0)}
                  </span>
                  <span className="ml-2 opacity-80">days held</span>
                </div>
                <div className="mt-2 text-xs opacity-80">
                  {t.never_sold
                    ? "Never sold"
                    : `No-sell ${Math.max(0, t.no_sell_streak_days || 0)}d`}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Client-only share buttons (separate component) */}
        <ShareActions className="mt-6" shareUrl={shareUrl} />

        <div className="mt-4">
          <Link
            href={`/relic/${address}`}
            className="rounded-xl px-4 py-2 font-semibold bg-white/10 hover:bg-white/20 border border-white/20"
          >
            Back to Altar
          </Link>
        </div>
      </div>
    </main>
  );
}
