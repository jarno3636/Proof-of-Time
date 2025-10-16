"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { http } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_KEY || process.env.INFURA_API_KEY || "";
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || ""; // ← make sure this is set in Vercel

const config = getDefaultConfig({
  appName: "Proof of Time",
  projectId: WC_PROJECT_ID, // enables WalletConnect & full wallet list
  chains: [base],
  transports: {
    [base.id]: http(
      INFURA_KEY
        ? `https://base-mainnet.infura.io/v3/${INFURA_KEY}`
        : "https://mainnet.base.org"
    ),
  },
  ssr: true,
});

const qc = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider
          initialChain={base}
          theme={darkTheme({ accentColor: "#BBA46A" })}
          modalSize="compact"
          coolMode
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
