"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_KEY || process.env.INFURA_API_KEY;

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(
      INFURA_KEY ? `https://base-mainnet.infura.io/v3/${INFURA_KEY}` : "https://mainnet.base.org"
    ),
  },
  multiInjectedProviderDiscovery: true,
  ssr: true,
});

const qc = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#BBA46A" })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
