"use client";

import { useCallback, useMemo } from "react";
import { buildFarcasterComposeUrl, composeCast } from "@/lib/miniapp";

type Token = {
  token_address: string;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
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

  const makeText = (list: Token[]) => {
    const parts = list.map(
      (t) =>
        `$${t.symbol} ${t.days}d${
          t.never_sold ? " (never sold)" : ` (no-sell ${t.no_sell_streak_days}d)`
        }`
    );
    return `Proof of Time: ${parts.join(" • ")}\nTime > hype. #ProofOfTime ⏳`;
  };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const cardUrlAll = `${site}/api/card/${address}`;

  // ---------- Farcaster (altar / selected) ----------
  const shareAllFC = useCallback(() => {
    const text = makeText(tokens);
    const url = buildFarcasterComposeUrl({ text, embeds: [cardUrlAll] });
    composeCast(url);
  }, [tokens, cardUrlAll]);

  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    const text = makeText(selected);
    const url = buildFarcasterComposeUrl({ text, embeds: [cardUrlAll] });
    composeCast(url);
  }, [selected, cardUrlAll]);

  // ---------- X / Twitter (altar / selected) ----------
  function openXShare(text: string, url?: string) {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({
      text,
      ...(url ? { url } : {}),
    });
    const shareUrl = `${base}?${params.toString()}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  const shareAllX = useCallback(() => {
    openXShare(makeText(tokens), cardUrlAll);
  }, [tokens, cardUrlAll]);

  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    openXShare(makeText(selected), cardUrlAll);
  }, [selected, cardUrlAll]);

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
