"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";

// Inline UA check; no import from lib/miniapp.ts
function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent || "");
}

function pickPreferred(connectors: ReturnType<typeof useConnect>["connectors"]) {
  const byId = Object.fromEntries(connectors.map((c) => [c.id, c]));
  const cb = connectors.find((c) => /coinbase/i.test(c.name)) || byId["coinbaseWalletSDK"];
  const inj = connectors.find((c) => /injected/i.test(c.name)) || byId["injected"];
  const ready = connectors.find((c) => (c as any).ready);
  return cb || inj || ready || connectors[0];
}

/** One-shot auto-connect inside Warpcast (no modal). */
export default function AutoConnectMini() {
  const tried = useRef(false);
  const { isConnected } = useAccount();
  const { connectors, connectAsync, status } = useConnect();

  useEffect(() => {
    if (tried.current) return;
    if (!isFarcasterUA()) return;
    if (isConnected) return;
    if (status === "pending" || status === "success") return;

    tried.current = true;

    const run = async () => {
      await new Promise((r) => setTimeout(r, 450));
      const pick = pickPreferred(connectors);
      if (!pick) return;
      try {
        await connectAsync({ connector: pick });
        if (typeof window !== "undefined") localStorage.setItem("__pot_last_connector", pick.id);
      } catch {
        // ignore — user can click the button
      }
    };

    if (typeof window !== "undefined" && !sessionStorage.getItem("__pot_auto_connect_v1")) {
      sessionStorage.setItem("__pot_auto_connect_v1", "1");
      void run();
    }
  }, [connectors, connectAsync, isConnected, status]);

  return null;
}
