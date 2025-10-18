// components/ShareToFarcasterButton.tsx
"use client";

import * as React from "react";
import { shareOrCast } from "@/lib/share";

type Props = {
  text: string;
  embeds?: string[];
  url?: string;               // canonical web URL to append after text
  className?: string;
  disabled?: boolean;
  title?: string;
  children?: React.ReactNode;
  onDone?: (via: "sdk" | "web") => void;
};

export default function ShareToFarcasterButton({
  text,
  embeds = [],
  url,
  className,
  disabled,
  title,
  children = "Share on Farcaster",
  onDone,
}: Props) {
  const onClick = React.useCallback(async () => {
    // Try in-app SDK first; fall back to Warpcast web composer
    const before = performance.now();
    await shareOrCast({ text, url, embeds });
    const via = performance.now() - before < 800 ? "sdk" : "web"; // quick heuristic
    onDone?.(via as "sdk" | "web");
  }, [text, url, embeds, onDone]);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        className ??
        "rounded-2xl bg-[#BBA46A] text-[#0b0e14] px-4 py-3 font-semibold hover:bg-[#d6c289] transition disabled:opacity-60 disabled:cursor-not-allowed"
      }
    >
      {children}
    </button>
  );
}
