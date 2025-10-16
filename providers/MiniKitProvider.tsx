// providers/MiniKitProvider.tsx
"use client";

import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { ReactNode, useMemo } from "react";
import { base } from "wagmi/chains";

/**
 * Wrap your app with this to enable Coinbase Mini App features when opened
 * inside the Coinbase app. It is a harmless no-op on regular web.
 */
export function MiniKitContextProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY;

  // In local/dev without a key, we still render children; MiniKitProvider requires a string.
  const safeKey = useMemo(() => apiKey || "dev-placeholder-key", [apiKey]);

  return (
    <MiniKitProvider
      apiKey={safeKey}
      chain={base}
      // Optional but useful:
      appName="Proof of Time"
      debug={false}
    >
      {children}
    </MiniKitProvider>
  );
}
