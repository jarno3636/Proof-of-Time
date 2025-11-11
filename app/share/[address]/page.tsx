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

  // Preload (to keep current behavior / ranking); OG image uses the same data anyway
  const all = await fetchRelics(address);
  const chosen =
    picks.length > 0
      ? all
          .filter((t) => picks.includes(t.symbol.toUpperCase()))
          .filter((t, i, arr) => arr.findIndex((x) => x.symbol === t.symbol) === i)
          .slice(0, 3)
      : all.sort((a, b) => (b.days || 0) - (a.days || 0)).slice(0, 3);

  // Canonical page URL (what we embed/share)
  const shareUrl = `${origin}/share/${address}${
    picks.length ? `?selected=${encodeURIComponent(picks.join(","))}` : ""
  }`;

  // ✅ Direct OG image URL (server route returns image/png) — also used for the inline <img />
  const imgUrl =
    `${origin}/share/${address}/opengraph-image` +
    (picks.length ? `?selected=${encodeURIComponent(picks.join(","))}` : "") +
    `&v=${Date.now().toString().slice(-6)}`;

  return (
    <main className="min-h-[100svh] bg-[#0b0e14] text-[#EDEEF2]">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
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
            href={imgUrl}
            download
            className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/15 text-sm shrink-0"
            title="Download image"
          >
            Download image
          </a>
        </header>

        {/* The image itself (what social scrapers also use) */}
        <figure className="mt-6">
          <img
            src={imgUrl}
            alt="Proof of Time — your relics"
            className="w-full rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,.35)]"
            loading="eager"
            decoding="async"
          />
          <figcaption className="sr-only">Relics forged by patience</figcaption>
        </figure>

        {/* Share buttons (no visible URL/text on the page) */}
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
