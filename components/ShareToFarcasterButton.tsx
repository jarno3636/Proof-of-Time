"use client";

import * as React from "react";
import { composeCast } from "@/lib/miniapp";
import { buildWarpcastCompose } from "@/lib/share";

// Local mini-env detect (no import from miniapp.ts needed)
function isInFarcasterEnv(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const hasGlobal =
      !!(window as any).farcaster ||
      !!(window as any).Farcaster?.mini ||
      !!(window as any).Farcaster?.mini?.sdk;
    const inIframe = window.self !== window.top;
    const ua =
      typeof navigator !== "undefined"
        ? /Warpcast|Farcaster/i.test(navigator.userAgent || "")
        : false;
    return hasGlobal || ua || inIframe;
  } catch {
    return false;
  }
}

type Props = {
  text: string;
  embeds?: string[] | readonly string[];
  /** Optional web URL (NOT injected into text). Added to embeds for web composer only. */
  url?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  children?: React.ReactNode;
  onDone?: (via: "sdk" | "web" | "noop") => void;
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
    const fullText = (text || "").trim();
    const embedList: string[] = Array.isArray(embeds) ? embeds.map(String) : [];

    if (isInFarcasterEnv()) {
      // IN WARPCAST: try SDK compose; do not open web composer
      const typedComposeCast = composeCast as unknown as (args: {
        text?: string;
        embeds?: string[];
      }) => Promise<boolean>;

      const ok = await typedComposeCast({ text: fullText, embeds: embedList });
      if (ok) {
        onDone?.("sdk");
        return;
      }
      try {
        (window as any)?.__toast?.(
          "Couldn’t open composer in-app. Update Warpcast and try again."
        );
      } catch {}
      onDone?.("noop");
      return;
    }

    // OUTSIDE WARPCAST: open Warpcast web composer (URL NOT injected into text).
    // If a url prop was provided, pass it as an additional embed.
    const finalEmbeds = url ? [...embedList, url] : embedList;
    const href = buildWarpcastCompose({ text: fullText, embeds: finalEmbeds });

    try {
      const w = window.open(href, "_blank", "noopener,noreferrer");
      if (!w) window.location.href = href;
      onDone?.("web");
    } catch {
      try {
        window.location.href = href;
        onDone?.("web");
      } catch {
        onDone?.("noop");
      }
    }
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
