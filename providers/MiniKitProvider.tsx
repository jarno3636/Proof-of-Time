// providers/MiniKitProvider.tsx
"use client";

import { ReactNode } from "react";
import { base } from "wagmi/chains";

/**
 * Tries to dynamically import Coinbase MiniKit only if installed.
 * Falls back to a no-op provider otherwise.
 */
export function MiniKitContextProvider({ children }: { children: ReactNode }) {
  // In normal browsers or when MiniKit isn't installed, we just render children.
  if (typeof window === "undefined") return <>{children}</>;

  // Dynamically import MiniKitProvider if available (no compile-time import)
  const LazyMiniKit = dynamicMiniKit();
  if (!LazyMiniKit) return <>{children}</>;

  const { MiniKitProvider } = LazyMiniKit;
  const apiKey =
    process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY || "dev-placeholder-key";

  try {
    return (
      <MiniKitProvider apiKey={apiKey} chain={base}>
        {children}
      </MiniKitProvider>
    );
  } catch {
    return <>{children}</>;
  }
}

/** Dynamic import shim — returns null if module not found */
function dynamicMiniKit() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@coinbase/onchainkit/minikit");
  } catch {
    return null;
  }
}
