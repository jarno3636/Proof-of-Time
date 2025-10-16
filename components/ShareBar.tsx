"use client";

import { useCallback, useMemo } from "react";
import { buildFarcasterComposeUrl, composeCast } from "@/lib/miniapp";

type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier?: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
};

export default function ShareBar({
  address: _unused, // kept for API compatibility
  tokens,
  selectedSymbols = [],
}: {
  address: string;            // ignored (we now share home)
  tokens: Token[];
  selectedSymbols?: string[];
}) {
  const selected = useMemo(
    () =>
      selectedSymbols.length
        ? tokens.filter((t) => selectedSymbols.includes(t.symbol))
        : [],
    [tokens, selectedSymbols]
  );

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  // ✅ Single static CTA URL (home). This drives both the embed (FC) and link (X).
  const CTA_URL = `${site}/`;

  /* ---------- Nicer cast/tweet text ---------- */
  function titleLine(list: Token[]) {
    if (list.length === 1) return "⟡ Relic Revealed";
    if (list.length <= 3) return "⟡ Relics Revealed";
    return "⟡ Proof of Time — Altar";
  }

  function lineFor(t: Token) {
    const sym = `$${t.symbol}`;
    const d = `${t.days}d`;
    const badge = t.never_sold ? "✦ never sold" : `⏳ no-sell ${t.no_sell_streak_days}d`;
    return `• ${sym} — ${d} (${badge})`;
  }

  function buildText(list: Token[]) {
    const lines = [
      titleLine(list),
      ...list.map(lineFor),
      "Time > hype. #ProofOfTime ⏳",
      "Time to let those diamond hands shine 💎✊",
    ];
    return lines.join("\n");
  }

  /* ---------- Farcaster (Warpcast) ---------- */
  // We keep text clean (no URL in the text) and attach a single embed = home page.
  const shareFC = (text: string) => {
    const url = buildFarcasterComposeUrl({ text, embeds: [CTA_URL] });
    composeCast(url);
  };

  const shareAllFC = useCallback(() => {
    shareFC(buildText(tokens));
  }, [tokens]);

  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    shareFC(buildText(selected));
  }, [selected]);

  /* ---------- X (Twitter) ---------- */
  // For X we *do* include the URL param, pointing to home.
  function openXShare(text: string, url?: string) {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    window.open(`${base}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  const shareAllX = useCallback(() => {
    openXShare(buildText(tokens), CTA_URL);
  }, [tokens]);

  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    openXShare(buildText(selected), CTA_URL);
  }, [selected]);

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
    </div>
  );
}
