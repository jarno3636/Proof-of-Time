"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { isFarcasterUA } from "@/lib/miniapp";

/** One-shot auto-connect when running inside Warpcast */
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
      await new Promise((r) => setTimeout(r, 400)); // let SDK settle

      const injected =
        connectors.find((c) => /injected/i.test(c.name)) ||
        connectors.find((c) => c.id === "injected");

      const coinbase =
        connectors.find((c) => /coinbase/i.test(c.name)) ||
        connectors.find((c) => c.id === "coinbaseWalletSDK");

      const pick = injected || coinbase || connectors[0];
      if (!pick) return;

      try {
        await connectAsync({ connector: pick });
      } catch {
        /* ignore */
      }
    };

    const key = "__pot_auto_connect_v1";
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      void run();
    }
  }, [connectors, connectAsync, isConnected, status]);

  return null;
}
