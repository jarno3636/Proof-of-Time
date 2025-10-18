"use client";
import { useEffect } from "react";
import { ensureReady } from "@/lib/miniapp";
import { probeFarcaster } from "@/lib/farcasterDebug";

export default function FarcasterMiniBridge() {
  useEffect(() => {
    // Ping ready(); don’t throw if it’s missing.
    ensureReady(1200).catch(() => {});
    // Legacy globals still around in some Warpcasts:
    try { (window as any)?.farcaster?.actions?.ready?.(); } catch {}
    try { (window as any)?.farcaster?.miniapp?.sdk?.actions?.ready?.(); } catch {}

    // Helpful console diagnostics (only when inside Warpcast/webview devtools)
    try {
      const p = probeFarcaster();
      // eslint-disable-next-line no-console
      console.debug("[FC Probe]", p);
    } catch {}
  }, []);

  return null;
}
