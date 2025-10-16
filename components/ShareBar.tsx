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

  // HTML share pages that expose OG (reliable in Warpcast)
  const altarSharePage = `${site}/card/${address}`;
  const relicSharePage = (t: Token) => {
    const q = new URLSearchParams({
      symbol: t.symbol,
      days: String(t.days ?? 0),
      tier: t.tier || "Bronze",
      token: t.token_address,
    });
    return `${site}/relic-card?${q.toString()}`;
  };

  // ✨ nicer copy
  const title = (list: Token[]) =>
    list.length === 1 ? "⟡ Relic Revealed"
    : list.length <= 3 ? "⟡ Relics Revealed"
    : "⟡ Proof of Time — Altar";

  const lineFor = (t: Token) =>
    `• $${t.symbol} — ${t.days}d (${t.never_sold ? "✦ never sold" : `⏳ no-sell ${t.no_sell_streak_days}d`})`;

  const diamond = "Time to let those diamond hands shine 💎✊";
  const closing = "Time > hype. #ProofOfTime ⏳";
  const buildText = (list: Token[]) => [title(list), ...list.map(lineFor), diamond, closing].join("\n");

  // Farcaster: no link in body, embed the share page
  const shareFC = (text: string, embedUrl: string) => {
    const url = buildFarcasterComposeUrl({ text, embeds: [embedUrl] });
    composeCast(url);
  };

  const shareAllFC = useCallback(() => {
    shareFC(buildText(tokens), altarSharePage);
  }, [tokens, altarSharePage]);

  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    const page = selected.length === 1 ? relicSharePage(selected[0]) : altarSharePage;
    shareFC(buildText(selected), page);
  }, [selected, altarSharePage]);

  // X: keep the URL so a card appears
  function openX(text: string, url?: string) {
    const base = "https://twitter.com/intent/tweet";
    const qs = new URLSearchParams({ text });
    if (url) qs.set("url", url);
    window.open(`${base}?${qs.toString()}`, "_blank", "noopener,noreferrer");
  }

  const shareAllX = useCallback(() => openX(buildText(tokens), altarSharePage), [tokens, altarSharePage]);
  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    const page = selected.length === 1 ? relicSharePage(selected[0]) : altarSharePage;
    openX(buildText(selected), page);
  }, [selected, altarSharePage]);

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
