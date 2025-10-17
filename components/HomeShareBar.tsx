"use client";

import { useCallback, useMemo } from "react";
import {
  FARCASTER_MINIAPP_LINK,
  buildFarcasterComposeUrl,
  composeCast as composeCastMini,
  openInMini,
  isFarcasterUA,
  isBaseAppUA,
} from "@/lib/miniapp";

/** Small helper to pick a random item every click */
function pickOne<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function HomeShareBar() {
  // Always embed your Farcaster Mini App so casts stay in-app
  const FC_EMBED = FARCASTER_MINIAPP_LINK;

  // If you want X to point to your website card instead, swap to NEXT_PUBLIC_SITE_URL
  const SHARE_URL = FARCASTER_MINIAPP_LINK;

  const castLines = useMemo(
    () =>
      [
        "Discover your top 3 longest-held tokens on Base ⏳ #ProofOfTime",
        "What are your oldest relics on Base? I’m checking mine now. 🗿",
        "I’m measuring time on chain, not hype. Find your relics. ⌛️ #ProofOfTime",
        "How patient are your bags? Uncover your longest-held tokens on Base. 💎",
        "Turn diamond hands into data. Reveal your relics on Base. 💠",
        "Your altar awaits—see which tokens you’ve held the longest. 🕯️",
        "Find out just how diamond 💎 your hads really are!✊",
        "Proof of Time: because holding > hoping. Show me your relics. 🛡️",
        "Who’s the real OG? Reveal your top 3 longest-held tokens. 🧭",
      ] as const,
    []
  );

  const shareFarcaster = useCallback(async () => {
    const text = pickOne(castLines);

    // 1) Try native compose (Mini App / Base bridge)
    const ok = await composeCastMini({ text, embeds: [FC_EMBED] });
    if (ok) return;

    // 2) Universal composer URL
    const url = buildFarcasterComposeUrl({ text, embeds: [FC_EMBED] });

    // 3) Ask SDK/MiniKit to open in-app (Farcaster / Base)
    const handled = await openInMini(url);
    if (handled) return;

    // 4) Fallbacks
    if (typeof window !== "undefined") {
      if (isFarcasterUA() || isBaseAppUA()) {
        window.location.href = url; // same webview
      } else {
        const w = window.open(url, "_blank", "noopener,noreferrer");
        if (!w) window.location.href = url;
      }
    }
  }, [castLines, FC_EMBED]);

  const shareX = useCallback(() => {
    const text = pickOne(castLines);
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text, url: SHARE_URL });
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, [castLines, SHARE_URL]);

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button
        onClick={shareFarcaster}
        className="rounded-2xl bg-[#BBA46A] text-[#0b0e14] px-4 py-2 font-semibold hover:bg-[#d6c289] transition"
        title="Share on Farcaster"
      >
        Share on Farcaster
      </button>
      <button
        onClick={shareX}
        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-zinc-100 hover:bg-white/10 transition"
        title="Share on X"
      >
        Share on X
      </button>
      <p className="basis-full text-xs text-zinc-500">
        Each click shuffles a fresh message to keep your posts unique.
      </p>
    </div>
  );
}
