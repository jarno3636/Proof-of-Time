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
  address,
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

  // Altar-wide OG card
  const altarCardUrl = `${site}/api/card/${address}`;

  // Single-relic OG card
  const relicCardUrl = (t: Token) => {
    const params = new URLSearchParams({
      symbol: t.symbol,
      days: String(t.days ?? 0),
      tier: t.tier || "Bronze",
      token: t.token_address,
    });
    return `${site}/api/relic-card?${params.toString()}`;
  };

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

  function closingLine() {
    return "Time > hype. #ProofOfTime ⏳";
  }

  function buildText(list: Token[]) {
    const lines = [titleLine(list), ...list.map(lineFor), closingLine()];
    return lines.join("\n");
  }

  /* ---------- Farcaster ---------- */
  const shareFC = (text: string, embedUrl: string) => {
    // Include the URL in the text for better previews across clients.
    const textWithUrl = `${text}\n${embedUrl}`;
    const url = buildFarcasterComposeUrl({ text: textWithUrl, embeds: [embedUrl] });
    composeCast(url);
  };

  const shareAllFC = useCallback(() => {
    const text = buildText(tokens);
    shareFC(text, altarCardUrl);
  }, [tokens, altarCardUrl]);

  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    const text = buildText(selected);
    const embed = selected.length === 1 ? relicCardUrl(selected[0]) : altarCardUrl;
    shareFC(text, embed);
  }, [selected, altarCardUrl]);

  /* ---------- X (Twitter) ---------- */
  function openXShare(text: string, url?: string) {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    window.open(`${base}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  const shareAllX = useCallback(() => {
    openXShare(buildText(tokens), altarCardUrl);
  }, [tokens, altarCardUrl]);

  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    const text = buildText(selected);
    const embed = selected.length === 1 ? relicCardUrl(selected[0]) : altarCardUrl;
    openXShare(text, embed);
  }, [selected, altarCardUrl]);

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
