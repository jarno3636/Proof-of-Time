"use client";

import { useEffect } from "react";

/**
 * Notifies Warpcast mini-app shell that the UI is ready.
 * Safe no-op outside Farcaster.
 */
export default function FarcasterReady() {
  useEffect(() => {
    // Native global (Warpcast) – preferred
    const fc = (globalThis as any).farcaster;
    if (fc?.actions?.ready) {
      fc.actions.ready();
      return;
    }

    // Optional SDK fallback if you later install @farcaster/miniapp-sdk
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const miniapp = require("@farcaster/miniapp-sdk")?.default ??
                      require("@farcaster/miniapp-sdk");
      miniapp?.actions?.ready?.();
    } catch {
      /* noop */
    }
  }, []);

  return null;
}
