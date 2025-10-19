"use client";

import { useMemo, useCallback } from "react";
import ShareToFarcasterButton from "@/components/ShareToFarcasterButton";

// Inline the miniapp link so we don't import from lib/miniapp.ts
const FARCASTER_MINIAPP_LINK =
  process.env.NEXT_PUBLIC_FC_MINIAPP_LINK ||
  "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";

export default function HomeShareBar() {
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

  const text = pick();

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <ShareToFarcasterButton text={text} embeds={[FARCASTER_MINIAPP_LINK]}>
        Share on Farcaster
      </ShareToFarcasterButton>

      <button
        onClick={shareToX}
        className="rounded-2xl border border-white/15 px-4 py-3 text-zinc-200 hover:bg-white/10 transition"
      >
        Tweet It
      </button>
    </div>
  );
}
