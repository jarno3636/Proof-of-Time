// components/ShareToFarcasterButton.tsx
"use client";

import * as React from "react";
import { composeCastEverywhere } from "@/lib/miniapp";

type Props = {
  text: string;
  embeds?: string[];
  className?: string;
  disabled?: boolean;
  title?: string;
  children?: React.ReactNode;
  onDone?: (via: "sdk" | "web") => void; // optional: know which path was used
};

export default function ShareToFarcasterButton({
  text,
  embeds = [],
  className,
  disabled,
  title,
  children = "Share on Farcaster",
  onDone,
}: Props) {
  const onClick = React.useCallback(async () => {
    const via = await composeCastEverywhere({ text, embeds });
    onDone?.(via);
  }, [text, embeds, onDone]);

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
