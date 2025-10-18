// components/ShareToFarcasterButton.tsx
"use client";

import * as React from "react";
import { composeCast, isInFarcasterEnv } from "@/lib/miniapp";
import { buildWarpcastCompose, openShareWindow } from "@/lib/share";

type Props = {
  text: string;
  embeds?: string[];
  url?: string;               // optional: link to include after the text
  className?: string;
  disabled?: boolean;
  title?: string;
  children?: React.ReactNode;
  onDone?: (via: "sdk" | "web" | "noop") => void; // which path was used
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
    const fullText = url && !text.includes(url) ? `${text}\n${url}` : text;

    // 1) Try composing in-app via SDKs (frame-sdk or miniapp-sdk)
    const ok = await composeCast({ text: fullText, embeds });
    if (ok) {
      onDone?.("sdk");
      return;
    }

    // 2) INSIDE Warpcast: DO NOT open web composer (would show download interstitial)
    if (isInFarcasterEnv()) {
      try {
        (window as any)?.__toast?.("Couldn’t open composer in-app. Update Warpcast and try again.");
      } catch {}
      onDone?.("noop");
      return;
    }

    // 3) Browser / dapp webviews: fallback to Warpcast web composer
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
