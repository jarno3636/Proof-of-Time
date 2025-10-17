"use client";

import { useCallback, useMemo } from "react";
import {
  buildFarcasterComposeUrl,
  FARCASTER_MINIAPP_LINK,
  isFarcasterUA,
  isMobileUA,
} from "@/lib/miniapp";

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

  // Always embed your Farcaster mini-app directory link (stays in-app inside Warpcast)
  const FC_EMBED = FARCASTER_MINIAPP_LINK;

  // X / Twitter still points to your homepage for card preview
  const CTA_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const titleLine = (list: Token[]) =>
    list.length === 1
      ? "⟡ Relic Revealed"
      : list.length <= 3
      ? "⟡ Relics Revealed"
      : "⟡ Proof of Time — Altar";

  const lineFor = (t: Token) => {
    const sym = `$${t.symbol}`;
    const d = `${t.days}d`;
    const badge = t.never_sold ? "✦ never sold" : `⏳ no-sell ${t.no_sell_streak_days}d`;
    return `• ${sym} — ${d} (${badge})`;
  };

  const buildText = (list: Token[]) =>
    [
      titleLine(list),
      ...list.map(lineFor),
      "Time > hype. #ProofOfTime ⏳",
      "Time to let those diamond hands shine 💎✊",
    ].join("\n");

  // ---------- Farcaster (force web composer everywhere) ----------
  const shareFC = useCallback((text: string) => {
    const url = buildFarcasterComposeUrl({ text, embeds: [FC_EMBED] });

    // Same-tab navigation on mobile & inside Warpcast webview (avoids popup blockers / app-store)
    if (isMobileUA() || isFarcasterUA()) {
      window.location.href = url;
      return;
    }

    // Desktop web: open a new tab if possible
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url; // fallback if popups are blocked
  }, [FC_EMBED]);

  const shareAllFC = useCallback(() => shareFC(buildText(tokens)), [tokens, shareFC]);
  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    shareFC(buildText(selected));
  }, [selected, shareFC]);

  // ---------- X / Twitter ----------
  function openXShare(text: string, url?: string) {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }

  const shareAllX = useCallback(() => openXShare(buildText(tokens), CTA_URL), [tokens, CTA_URL]);
  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    openXShare(buildText(selected), CTA_URL);
  }, [selected, CTA_URL]);

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={shareAllFC}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg白/20 transition"
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
