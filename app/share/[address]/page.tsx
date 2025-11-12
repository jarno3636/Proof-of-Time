import Link from "next/link";
import ShareActions from "@/components/ShareActions";

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
    const r = await fetch(`/api/relic/${addr}`, { cache: "no-store", next: { revalidate: 0 } });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ tokens: [] as Token[] }));
    return (j?.tokens || []) as Token[];
  } catch {
    return [];
  }
}

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
  const title = selected ? `Relics: ${selected}` : `Relics for ${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
    Object.entries(searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v ?? ""]]))
  );
  const picks = parseSelected(sp);

  // Load relics and compute the 0–3 chosen items (server-side)
  const all = await fetchRelics(address).catch(() => [] as Token[]);
  const chosen: Token[] =
    picks.length > 0
      ? all
          .filter((t) => picks.includes(t.symbol.toUpperCase()))
          .filter((t, i, arr) => arr.findIndex((x) => x.symbol === t.symbol) === i)
          .slice(0, 3)
      : all.sort((a, b) => (b.days || 0) - (a.days || 0)).slice(0, 3);

  // Canonical page URL for sharing
  const shareUrl = `${origin}/share/${address}${picks.length ? `?selected=${encodeURIComponent(picks.join(","))}` : ""}`;

  // Embed a compact payload so the OG route NEVER fetches at edge (avoids 500)
  type Lite = Pick<Token, "symbol" | "days" | "no_sell_streak_days" | "never_sold" | "tier">;
  const lite: Lite[] = (chosen.length ? chosen : [{
    symbol: "RELIC", days: 0, no_sell_streak_days: 0, never_sold: true, tier: "Bronze" as const,
  }]).map((t) => ({
    symbol: t.symbol,
    days: Math.max(0, t.days || 0),
    no_sell_streak_days: Math.max(0, t.no_sell_streak_days || 0),
    never_sold: !!t.never_sold,
    tier: t.tier,
  }));

  // Base64URL encode (Node runtime here is fine)
  const payload = Buffer.from(JSON.stringify(lite), "utf8").toString("base64url");

  // Build image path with data= payload and small cache-buster
  const qs = new URLSearchParams();
  qs.set("data", payload);
  if (picks.length) qs.set("selected", picks.join(",")); // harmless/meta
  qs.set("v", Date.now().toString().slice(-6));
  const ogPath = `/share/${address}/opengraph-image?${qs.toString()}`;

  return (
    <main className="min-h-[100svh] bg-[#0b0e14] text-[#EDEEF2]">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">Relics to Share</h1>
            <p className="opacity-80 mt-1">I stood the test of time — come see how you measure up.</p>
          </div>

          <a
            href={ogPath}
            download={`relics-${address}.png`}
            className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/15 text-sm shrink-0"
            title="Download image"
          >
            Download image
          </a>
        </header>

        {/* Inline OG image preview */}
        <section className="mt-6">
          <figure className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
            <figcaption className="px-2 pb-2 text-sm text-white/70">Proof of Time — your relics</figcaption>
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0b0e14]">
              <img
                src={ogPath}
                alt="Relic altar preview"
                width={1200}
                height={630}
                loading="eager"
                style={{ display: "block", width: "100%", height: "auto" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "data:image/svg+xml;charset=utf-8," +
                    encodeURIComponent(
                      `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><rect width='100%' height='100%' fill='#0b0e14'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#fff' font-size='48' font-family='sans-serif'>Proof of Time</text></svg>`
                    );
                }}
              />
            </div>
          </figure>
        </section>

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
