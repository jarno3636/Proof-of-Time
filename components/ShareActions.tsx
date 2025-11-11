"use client";

import { useCallback } from "react";
import { shareOrCast } from "@/lib/share";

export default function ShareActions({
  shareUrl,
  className = "",
}: {
  shareUrl: string;
  className?: string;
}) {
  const text = "⟡ Relics Revealed\nTime > hype. #ProofOfTime ⏳";

  const onCast = useCallback(
    () => shareOrCast({ text, embeds: [shareUrl] }),
    [shareUrl]
  );

  const onX = useCallback(() => {
    const href = `https://x.com/intent/tweet?url=${encodeURIComponent(
      `${shareUrl}${shareUrl.includes("?") ? "&" : "?"}v=${Date.now()
        .toString()
        .slice(-6)}`
    )}&text=${encodeURIComponent(text)}`;
    const w = window.open(href, "_top", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, [shareUrl]);

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <button
        onClick={onCast}
        className="rounded-xl px-4 py-2 font-semibold bg-[#8a66ff] hover:bg-[#7b58ef] border border-white/20"
      >
        Share on Farcaster
      </button>
      <button
        onClick={onX}
        className="rounded-xl px-4 py-2 font-semibold bg-[#1d9bf0] hover:bg-[#168bd9] border border-white/20"
      >
        Share on X
      </button>
    </div>
  );
}
