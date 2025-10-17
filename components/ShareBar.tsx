// components/ShareBar.tsx
"use client";

import { useCallback, useMemo } from "react";
import {
  buildFarcasterComposeUrl,
  composeCast as composeCastMini,
  openInMini,                 // ← use SDK/MiniKit to open URL in-app
  isFarcasterUA,
  isBaseAppUA,
  FARCASTER_MINIAPP_LINK,     // ← keep your Farcaster directory URL as the embed
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
  // Dedup + filter by symbol
  const selected = useMemo(() => {
    if (!selectedSymbols.length) return [] as Token[];
    const wanted = new Set(selectedSymbols);
    const seen = new Set<string>();
    return tokens.filter((t) => {
      if (!wanted.has(t.symbol)) return false;
      if (seen.has(t.symbol)) return false;
      seen.add(t.symbol);
      return true;
    });
  }, [tokens, selectedSymbols]);

  // Always embed your Farcaster directory link so posts resolve in-app
  const FC_EMBED = FARCASTER_MINIAPP_LINK;

  // X / Twitter still points to your homepage for the card
  const CTA_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  // ---------- Text builders ----------
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

  const buildText = (list: Token[]) =>
    [
      titleLine(list),
      ...list.map(lineFor),
      "Time > hype. #ProofOfTime ⏳",
      "Time to let those diamond hands shine 💎✊",
    ].join("\n");

  // ---------- Farcaster (robust, no deep-link) ----------
  const shareFC = useCallback(
    async (list: Token[]) => {
      const text = buildText(list);

      // 1) Try native compose when available (mini app or Base bridge)
      const ok = await composeCastMini({ text, embeds: [FC_EMBED] });
      if (ok) return;

      // 2) Build the universal web composer URL
      const url = buildFarcasterComposeUrl({ text, embeds: [FC_EMBED] });

      // 3) Ask SDK/MiniKit to open it in-app (works in Farcaster + Base browsers)
      const handled = await openInMini(url);
      if (handled) return;

      // 4) Fallbacks: stay on web composer (avoids “download app” interstitials)
      if (typeof window !== "undefined") {
        if (isFarcasterUA() || isBaseAppUA()) {
          // Inside Farcaster or Base in-app browser – navigate same tab
          window.location.href = url;
        } else {
          // Desktop/mobile web – open new tab, fallback to same tab if blocked
          const w = window.open(url, "_blank", "noopener,noreferrer");
          if (!w) window.location.href = url;
        }
      }
    },
    [FC_EMBED]
  );

  const shareAllFC = useCallback(() => { void shareFC(tokens); }, [tokens, shareFC]);
  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    void shareFC(selected);
  }, [selected, shareFC]);

  // ---------- X / Twitter ----------
  function openXShare(text: string, url?: string) {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url); // keep link so the card renders
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }

  const shareAllX = useCallback(() => {
    openXShare(buildText(tokens), CTA_URL);
  }, [tokens, CTA_URL]);

  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    openXShare(buildText(selected), CTA_URL);
  }, [selected, CTA_URL]);

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
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
