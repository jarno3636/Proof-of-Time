// app/providers.tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

import { wagmiConfig } from "@/lib/wallet";
import { MiniKitContextProvider } from "@/providers/MiniKitProvider";
import FarcasterMiniBridge from "@/components/FarcasterMiniBridge";

const qc = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniKitContextProvider>
      <WagmiProvider config={wagmiConfig} reconnectOnMount>
        <QueryClientProvider client={qc}>
          <RainbowKitProvider
            initialChain={base}
            theme={darkTheme({ accentColor: "#BBA46A" })}
            modalSize="compact"
            coolMode
          >
            {/* keep Warpcast splash happy */}
            <FarcasterMiniBridge />
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MiniKitContextProvider>
  );
}
