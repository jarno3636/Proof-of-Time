// components/LaunchShare.tsx
"use client";

import Image from "next/image";
import Countdown from "./Countdown";

const MINIAPP = "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
const LAUNCH_URL = `${SITE}/launch`;

const text = encodeURIComponent("Launching Proof of Time on Base — fixed-price presale + holder rewards. Join:");
const tweetUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(LAUNCH_URL)}`;
const fcUrl    = `https://warpcast.com/~/compose?text=${text}&embeds[]=${encodeURIComponent(MINIAPP)}&embeds[]=${encodeURIComponent(LAUNCH_URL)}`;

const SALE_END = Number(process.env.NEXT_PUBLIC_PRESALE_END_UNIX || 0); // optional for extra countdown

export default function LaunchShare() {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-4 flex items-center gap-4">
      <div className="shrink-0 relative w-14 h-14 rounded-lg overflow-hidden ring-1 ring-zinc-800/70">
        <Image src="/pot.PNG" alt="Proof of Time" fill sizes="56px" className="object-cover" />
      </div>
      <div className="flex-1">
        <div className="text-sm text-zinc-300">Share the launch</div>
        {SALE_END ? (
          <div className="text-[11px] text-zinc-500">Sale ends in <span className="text-[#BBA46A]"><Countdown target={SALE_END} /></span></div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <a href={fcUrl} target="_blank" rel="noopener noreferrer"
           className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-1.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800/60">Farcaster</a>
        <a href={tweetUrl} target="_blank" rel="noopener noreferrer"
           className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-1.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800/60">Twitter/X</a>
      </div>
    </div>
  );
}
