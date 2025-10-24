// components/LaunchShare.tsx
"use client";

import Image from "next/image";
import ShareToFarcasterButton from "@/components/ShareToFarcasterButton";

const MINIAPP =
  process.env.NEXT_PUBLIC_FC_MINIAPP_LINK ||
  "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");
const LAUNCH_URL = `${SITE}/launch`;

// X/Twitter
function openTweet(text: string, url: string) {
  const base = "https://twitter.com/intent/tweet";
  const href = `${base}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const w = window.open(href, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = href;
}

export default function LaunchShare() {
  const shareText =
    "Launching Proof of Time on Base — fixed-price presale + holder rewards. Join:";

  return (
    <div className="w-full rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Logo */}
      <div className="shrink-0 relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden ring-1 ring-zinc-800/70">
        <Image src="/pot.PNG" alt="Proof of Time" fill sizes="56px" className="object-cover" />
      </div>

      {/* Text (allows wrapping without pushing buttons off-screen) */}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-300">Share the launch</div>
        <div className="text-[11px] text-zinc-500">
          Help spread the word. Links include the miniapp + launch page.
        </div>
      </div>

      {/* Buttons (wrap on narrow screens) */}
      <div className="flex flex-wrap items-center gap-2">
        <ShareToFarcasterButton
          text={shareText}
          embeds={[MINIAPP, LAUNCH_URL]}
          className="rounded-lg bg-[#BBA46A] text-[#0b0e14] px-3 py-1.5 text-sm font-semibold hover:bg-[#d6c289] transition"
        >
          Farcaster
        </ShareToFarcasterButton>

        <button
          onClick={() => openTweet(shareText, LAUNCH_URL)}
          className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-1.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800/60 transition"
        >
          Twitter/X
        </button>
      </div>
    </div>
  );
}
