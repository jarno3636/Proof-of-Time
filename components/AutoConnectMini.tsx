"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { isFarcasterUA } from "@/lib/miniapp";

/**
 * Tries to auto-connect once when running inside Warpcast.
 * Order: Injected (if present) → Coinbase Wallet → first available.
 */
export default function AutoConnectMini() {
  const tried = useRef(false);
  const { isConnected } = useAccount();
  const { connectors, connectAsync, status } = useConnect();

  useEffect(() => {
    if (tried.current) return;
    if (!isFarcasterUA()) return;               // only act in the mini app
    if (isConnected) return;                     // nothing to do
    if (status === "pending" || status === "success") return;

    tried.current = true;

    const doIt = async () => {
      // tiny delay so the Farcaster SDK finishes ready()
      await new Promise((r) => setTimeout(r, 400));

      // Prefer an injected provider if present
      const injected =
        connectors.find((c) => /injected/i.test(c.name)) ||
        connectors.find((c) => c.id === "injected");

      // Otherwise prefer Coinbase Wallet if available
      const cbw =
        connectors.find((c) => /coinbase/i.test(c.name)) ||
        connectors.find((c) => c.id === "coinbaseWalletSDK");

      // Fallback to first available
      const fallback = connectors[0];

      const pick = injected || cbw || fallback;
      if (!pick) return;

      try {
        await connectAsync({ connector: pick });
      } catch {
        // Silent: user can still click connect manually
      }
    };

    // Only once per session
    const key = "__pot_auto_connect_v1";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    void doIt();
  }, [connectors, connectAsync, isConnected, status]);

  return null;
}
