// app/share/[address]/page.tsx
import Link from "next/link";

// …(types + helpers unchanged)

export async function generateMetadata({ params, searchParams }: any) {
  const addr = (params.address || "").toLowerCase();
  const pick = (searchParams?.selected || searchParams?.pick || "").toString();
  const title = pick ? `Relics: ${pick}` : `Relics for ${addr.slice(0,6)}…${addr.slice(-4)}`;
  const description = "I stood the test of time. Check your relics at Proof of Time.";
  const url =
    `${absOrigin()}/share/${addr}` + (pick ? `?selected=${encodeURIComponent(pick)}` : "");

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function Page({ params, searchParams }: { params: { address: string }; searchParams: any }) {
  const origin = absOrigin();
  const address = (params.address || "").toLowerCase();

  const sp = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v ?? ""]]))
  );
  const picks = parseSelected(sp);

  const all = await fetchRelics(address);
  const chosen =
    picks.length
      ? all
          .filter((t) => picks.includes(t.symbol.toUpperCase()))
          .filter((t, i, arr) => arr.findIndex((x) => x.symbol === t.symbol) === i)
          .slice(0, 3)
      : all.sort((a, b) => (b.days || 0) - (a.days || 0)).slice(0, 3);

  // Canonical share link + direct image (cache-busted)
  const shareUrl =
    `${origin}/share/${address}` + (picks.length ? `?selected=${encodeURIComponent(picks.join(","))}` : "");
  const pngUrl = `${origin}/share/${address}/opengraph-image.png${
    picks.length ? `?selected=${encodeURIComponent(picks.join(","))}` : ""
  }&v=${Date.now().toString().slice(-6)}`;

  return (
    <main className="min-h-[100svh] bg-[#0b0e14] text-[#EDEEF2]">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header + tagline */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">Relics to Share</h1>
            <p className="opacity-80 mt-1">
              I stood the test of time — come see how you measure up at Proof of Time.
            </p>
            <p className="opacity-60 mt-2 text-sm break-all">
              Share URL: <a className="underline" href={shareUrl}>{shareUrl}</a>
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

        {/* Altar-styled preview (matches card) */}
        <section
          data-share="altar"
          className="relative mx-auto max-w-5xl mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.06] to-transparent opacity-50" />
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#BBA46A]" />
              <h2 className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">Relic Altar</h2>
            </div>
            <div className="text-xs text-zinc-400">
              {chosen.length ? `${chosen.length} Relic${chosen.length > 1 ? "s" : ""}` : "No Relics Yet"}
            </div>
          </div>

          <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chosen.map((t, i) => (
              <div key={i} className="relative rounded-2xl p-4 bg-[#0B0E14]/95 ring-1 ring-white/10 overflow-hidden">
                <div className="text-[11px] tracking-[0.18em] uppercase opacity-70">{t.tier} Relic</div>
                <div className="text-2xl font-semibold leading-tight">${t.symbol}</div>
                <div className="mt-2 text-sm">
                  <span className="text-3xl font-bold tracking-tight">{t.days}</span>
                  <span className="ml-2 opacity-80">days held</span>
                </div>
                <div className="mt-2 text-xs opacity-80">
                  {t.never_sold ? "Never sold" : `No-sell ${t.no_sell_streak_days}d`}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Client share buttons (SDK in-app; web composer elsewhere) */}
        <ShareActions shareUrl={shareUrl} className="mt-6" />

        {/* Back */}
        <div className="mt-4">
          <Link href={`/relic/${address}`} className="rounded-xl px-4 py-2 font-semibold bg-white/10 hover:bg-white/20 border border-white/20">
            Back to Altar
          </Link>
        </div>
      </div>
    </main>
  );
}

// --- client helper in same file (or move to a component) ---
"use client";
import { shareOrCast } from "@/lib/share";
import { useCallback } from "react";

function ShareActions({ shareUrl, className = "" }: { shareUrl: string; className?: string }) {
  const text = "⟡ Relics Revealed\nI stood the test of time — check yours at Proof of Time.\nTime > hype. #ProofOfTime ⏳";
  const onCast = useCallback(() => shareOrCast({ text, embeds: [shareUrl] }), [shareUrl]);
  const onX = useCallback(() => {
    const href = `https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
    const w = window.open(href, "_top", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, [shareUrl]);

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <button onClick={onCast} className="rounded-xl px-4 py-2 font-semibold bg-[#8a66ff] hover:bg-[#7b58ef] border border-white/20">
        Share on Farcaster
      </button>
      <button onClick={onX} className="rounded-xl px-4 py-2 font-semibold bg-[#1d9bf0] hover:bg-[#168bd9] border border-white/20">
        Share on X
      </button>
    </div>
  );
}
