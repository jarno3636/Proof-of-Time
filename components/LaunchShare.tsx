"use client";

import * as React from "react"; // <-- add this
import Image from "next/image";
import ShareToFarcasterButton from "@/components/ShareToFarcasterButton";

const MINIAPP =
  process.env.NEXT_PUBLIC_FC_MINIAPP_LINK ||
  "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");
const LAUNCH_URL = `${SITE}/launch`;
const SALE_END = Number(process.env.NEXT_PUBLIC_PRESALE_END_UNIX || 0);

// simple 9d 2h 47m formatter
function fmtRemaining(t: number) {
  if (t <= 0) return "ended";
  const s = Math.floor(t / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// X/Twitter
function openTweet(text: string, url: string) {
  const base = "https://twitter.com/intent/tweet";
  const href = `${base}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const w = window.open(href, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = href;
}

export default function LaunchShare() {
  // compute countdown live
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!SALE_END) return;
    const id = setInterval(() => setNow(Date.now()), 1000 * 30); // update every 30s
    return () => clearInterval(id);
  }, []);

  const remaining = SALE_END ? Math.max(0, SALE_END * 1000 - now) : 0;
  const countdown = SALE_END ? fmtRemaining(remaining) : null;

  // text with countdown included
  const shareText =
    `Launching Proof of Time on Base — fixed-price presale + holder rewards. ` +
    (countdown ? `Sale ends in ${countdown}.` : "Join:");

  return (
    <div className="w-full rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Logo */}
      <div className="shrink-0 relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden ring-1 ring-zinc-800/70">
        <Image src="/pot.PNG" alt="Proof of Time" fill sizes="56px" className="object-cover" />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-300">Share the launch</div>
        <div className="text-[11px] text-zinc-500">
          {countdown ? <>Sale ends in <span className="text-[#BBA46A] font-medium">{countdown}</span>.</> : "Help spread the word."}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* ONE embed only → miniapp (prevents double preview) */}
        <ShareToFarcasterButton
          text={shareText}
          embeds={[MINIAPP]}
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
