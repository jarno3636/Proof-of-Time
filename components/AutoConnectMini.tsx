// components/AutoConnectMini.tsx
"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { isFarcasterUA } from "@/lib/miniapp";

function pickPreferred(connectors: ReturnType<typeof useConnect>["connectors"]) {
  // Prefer Coinbase inside Farcaster (if present), then Injected, then any ready connector.
  const byId = Object.fromEntries(connectors.map(c => [c.id, c]));
  const cb   = connectors.find(c => /coinbase/i.test(c.name)) || byId["coinbaseWalletSDK"];
  const inj  = connectors.find(c => /injected/i.test(c.name)) || byId["injected"];
  const ready = connectors.find(c => (c as any).ready);
  return cb || inj || ready || connectors[0];
}

/** One-shot auto-connect when running inside Warpcast (no modal).
 *  If it can’t connect, it silently does nothing. */
export default function AutoConnectMini() {
  const tried = useRef(false);
  const { isConnected } = useAccount();
  const { connectors, connectAsync, status } = useConnect();

  useEffect(() => {
    if (tried.current) return;
    if (!isFarcasterUA()) return;                    // only try inside Warpcast
    if (isConnected) return;
    if (status === "pending" || status === "success") return;

    tried.current = true;

    const run = async () => {
      // Allow Farcaster SDK / wallet bridges to settle
      await new Promise((r) => setTimeout(r, 450));
      const pick = pickPreferred(connectors);
      if (!pick) return;
      try {
        await connectAsync({ connector: pick });
        // persist last connector for later click-to-reconnect
        if (typeof window !== "undefined") localStorage.setItem("__pot_last_connector", pick.id);
      } catch {
        // ignore — user can always click the button
      }
    };

    // only once per session
    if (typeof window !== "undefined" && !sessionStorage.getItem("__pot_auto_connect_v1")) {
      sessionStorage.setItem("__pot_auto_connect_v1", "1");
      void run();
    }
  }, [connectors, connectAsync, isConnected, status]);

  return null;
}
