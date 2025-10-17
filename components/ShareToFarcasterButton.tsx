// components/ShareToFarcasterButton.tsx
"use client";

import { useCallback } from "react";
import { composeInWarpcast, buildWarpcastWebCompose } from "@/lib/miniapp";

export default function ShareToFarcasterButton({
  text,
  embeds = [],
  children = "Share on Farcaster",
}: {
  text: string;
  embeds?: string[];
  children?: React.ReactNode;
}) {
  const onClick = useCallback(async () => {
    // 1) Try native mini-app composer (only works inside Warpcast)
    const handled = await composeInWarpcast(text, embeds);
    if (handled) return;

    // 2) Fallback: open Warpcast web composer (works on desktop/web)
    const url = buildWarpcastWebCompose(text, embeds);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url; // popup blocked
  }, [text, embeds]);

  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
    >
      {children}
    </button>
  );
}
