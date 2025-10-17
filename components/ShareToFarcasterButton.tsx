// components/ShareToFarcasterButton.tsx
"use client";

import * as React from "react";
import { composeCast } from "@/lib/miniapp";
import { buildWarpcastCompose, openShareWindow } from "@/lib/share";

type Props = {
  text: string;
  embeds?: string[];
  url?: string;               // optional: link to include after the text
  className?: string;
  disabled?: boolean;
  title?: string;
  children?: React.ReactNode;
  onDone?: (via: "sdk" | "web") => void; // which path was used
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
    // 1) Try composing in-app via SDKs (frame-sdk or miniapp-sdk)
    const ok = await composeCast({ text: url && !text.includes(url) ? `${text}\n${url}` : text, embeds });
    if (ok) {
      onDone?.("sdk");
      return;
    }

    // 2) Fallback to Warpcast web composer (works everywhere)
    const href = buildWarpcastCompose({ text, url, embeds });
    await openShareWindow(href);
    onDone?.("web");
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
