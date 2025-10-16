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
  address: _unused,
  tokens,
  selectedSymbols = [],
}: {
  address: string;
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

  // Single static CTA URL (home) used for all shares
  const CTA_URL = `${site}/`;

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

  /* ---------- Farcaster ---------- */
  const shareFC = (text: string) => {
    const url = buildFarcasterComposeUrl({ text, embeds: [CTA_URL] });
    composeCast(url);
  };
  const shareAllFC = useCallback(() => shareFC(buildText(tokens)), [tokens]);
  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    shareFC(buildText(selected));
  }, [selected]);

  /* ---------- X (Twitter) ---------- */
  // Force the URL into the text so X always renders the card.
  function openXShare(text: string, url: string) {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({
      // Put the URL in the text body — most reliable for previews.
      text: `${text}\n${url}`,
    });
    window.open(`${base}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }
  const shareAllX = useCallback(() => openXShare(buildText(tokens), CTA_URL), [tokens]);
  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    openXShare(buildText(selected), CTA_URL);
  }, [selected]);

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={shareAllFC} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          Share Altar (Farcaster)
        </button>
        <button
          onClick={shareSelectedFC}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
        >
          Share Selected (Farcaster)
        </button>

        <button onClick={shareAllX} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          Share Altar (X)
        </button>
        <button
          onClick={shareSelectedX}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
        >
          Share Selected (X)
        </button>
      </div>
    </div>
  );
}
