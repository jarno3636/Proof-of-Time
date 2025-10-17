// components/ShareBar.tsx
"use client";

import { useCallback, useMemo } from "react";
import { buildFarcasterComposeUrl, FARCASTER_MINIAPP_LINK } from "@/lib/miniapp";

type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier?: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
};

export default function ShareBar({
  address,
  tokens,
  selectedSymbols = [],
}: {
  address: string;
  tokens: Token[];
  selectedSymbols?: string[];
}) {
  // de-duped selected
  const selected = useMemo(() => {
    if (!selectedSymbols.length) return [] as Token[];
    const wanted = new Set(selectedSymbols.map((s) => s.toUpperCase()));
    const seen = new Set<string>();
    return tokens.filter((t) => {
      const sym = t.symbol.toUpperCase();
      if (!wanted.has(sym)) return false;
      if (seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });
  }, [tokens, selectedSymbols]);

  // Absolute site origin for image URLs
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  // ----- IMG URLs (ALL vs SELECTED) -----
  const imgAllUrl = useMemo(() => {
    const u = new URL(`/api/share/altar`, site);
    u.searchParams.set("address", address);
    u.searchParams.set("_", String(Date.now())); // cache-bust
    return u.toString();
  }, [site, address]);

  const imgSelectedUrl = useMemo(() => {
    const u = new URL(`/api/share/altar`, site);
    u.searchParams.set("address", address);
    if (selected.length) {
      u.searchParams.set("symbols", selected.map((t) => t.symbol).join(","));
    }
    u.searchParams.set("_", String(Date.now())); // cache-bust
    return u.toString();
  }, [site, address, selected]);

  // X / Twitter card target
  const ctaUrl = useMemo(() => site + "/", [site]);

  const titleLine = (list: Token[]) =>
    list.length === 1
      ? "⟡ Relic Revealed"
      : list.length <= 3
      ? "⟡ Relics Revealed"
      : "⟡ Proof of Time — Altar";

  const lineFor = (t: Token) => {
    const badge = t.never_sold ? "✦ never sold" : `⏳ no-sell ${t.no_sell_streak_days}d`;
    return `• $${t.symbol} — ${t.days}d (${badge})`;
  };

  const safeTrim = (s: string, cap = 320) => (s.length <= cap ? s : s.slice(0, cap - 1) + "…");

  const buildText = (list: Token[], cap?: number) => {
    const lines = [
      titleLine(list),
      ...list.map(lineFor),
      "",
      `See yours: ${FARCASTER_MINIAPP_LINK}`,
      "Time > hype. #ProofOfTime ⏳",
    ];
    const out = lines.join("\n");
    return cap ? safeTrim(out, cap) : out;
  };

  // —— Farcaster: ALWAYS use Warpcast web composer with our image embed ——
  const openWarpcastComposer = useCallback((text: string, embedUrl: string) => {
    const url = buildFarcasterComposeUrl({ text, embeds: [embedUrl] });
    if (typeof window !== "undefined") {
      const inWarpcast = /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent || "");
      if (inWarpcast) {
        // inside the Warpcast webview: navigate in-place
        window.location.href = url;
      } else {
        // web/dapp: open in a new tab (fallback to same-tab if popup blocked)
        const w = window.open(url, "_blank", "noopener,noreferrer");
        if (!w) window.location.href = url;
      }
    }
  }, []);

  const shareAllFC = useCallback(
    () => openWarpcastComposer(buildText(tokens, 320), imgAllUrl),
    [tokens, imgAllUrl, openWarpcastComposer]
  );

  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    openWarpcastComposer(buildText(selected, 320), imgSelectedUrl);
  }, [selected, imgSelectedUrl, openWarpcastComposer]);

  // —— X / Twitter ——
  function openXShare(text: string, url?: string) {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }
  const shareAllX = useCallback(() => openXShare(buildText(tokens, 280), ctaUrl), [tokens, ctaUrl]);
  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    openXShare(buildText(selected, 280), ctaUrl);
  }, [selected, ctaUrl]);

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Farcaster */}
        <button
          onClick={shareAllFC}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
          title="Share all relics on Farcaster"
        >
          Share Altar (Farcaster)
        </button>
        <button
          onClick={shareSelectedFC}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
          title="Share selected relics on Farcaster"
        >
          Share Selected (Farcaster)
        </button>

        {/* X / Twitter */}
        <button
          onClick={shareAllX}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
          title="Share all relics on X"
        >
          Share Altar (X)
        </button>
        <button
          onClick={shareSelectedX}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
          title="Share selected relics on X"
        >
          Share Selected (X)
        </button>
      </div>

      {/* Small utility row — lets users grab the image too */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <a
          href={imgAllUrl}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-zinc-200"
          title="Open generated altar image in a new tab"
        >
          Open Altar Image
        </a>
        <span>·</span>
        <a
          href={imgSelectedUrl}
          target="_blank"
          rel="noreferrer"
          className={`underline hover:text-zinc-200 ${!selected.length ? "pointer-events-none opacity-50" : ""}`}
          onClick={(e) => {
            if (!selected.length) e.preventDefault();
          }}
          title={selected.length ? "Open selected-only image" : "Select relics first"}
        >
          Open Selected Image
        </a>
      </div>
    </div>
  );
}
