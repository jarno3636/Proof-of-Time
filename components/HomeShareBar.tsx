"use client";

import { useMemo, useCallback } from "react";
import {
  FARCASTER_MINIAPP_LINK,
  buildFarcasterComposeUrl,
  isFarcasterUA,
  isMobileUA,
} from "@/lib/miniapp";

export default function HomeShareBar() {
  // Fun/varied lines you can expand later
  const castLines = useMemo(
    () =>
      [
        "Discover your top 3 longest-held tokens on Base ⏳ #ProofOfTime",
        "My on-chain patience test: which tokens did I hold the longest? 🧪",
        "Time > hype. Reveal your relics on Base now. ⛓️",
        "Your wallet tells a story — see your longest streaks. 📜",
        "How long did you really HODL? Find out. 💎✊",
        "Unveil your altar: top relics by days held. 🕯️",
        "Base OG check: which tokens survived the longest? 🛡️",
        "I’m measuring my conviction on-chain. You in? ⚖️",
      ] as const,
    []
  );

  const pick = useCallback(() => {
    const i = Math.floor(Math.random() * castLines.length);
    return castLines[i] || castLines[0];
  }, [castLines]);

  const FC_EMBED = FARCASTER_MINIAPP_LINK;

  const shareToFarcaster = useCallback(() => {
    const text = pick();
    const url = buildFarcasterComposeUrl({ text, embeds: [FC_EMBED] });

    if (isMobileUA() || isFarcasterUA()) {
      window.location.href = url;   // same-tab nav in mobile/webview
      return;
    }
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  }, [pick, FC_EMBED]);

  const CTA_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const shareToX = useCallback(() => {
    const text = pick();
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text, url: CTA_URL });
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, [pick, CTA_URL]);

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <button
        onClick={shareToFarcaster}
        className="rounded-2xl bg-[#BBA46A] text-[#0b0e14] px-4 py-3 font-semibold hover:bg-[#d6c289] transition"
      >
        Share on Farcaster
      </button>
      <button
        onClick={shareToX}
        className="rounded-2xl border border-white/15 px-4 py-3 text-zinc-200 hover:bg-white/10 transition"
      >
        Tweet It
      </button>
      <span className="text-xs text-zinc-500">
      </span>
    </div>
  );
}
