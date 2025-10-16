"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import {
  injected,
  metaMask,
  coinbaseWallet,
  walletConnect,
} from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const INFURA_KEY =
  process.env.NEXT_PUBLIC_INFURA_KEY || process.env.INFURA_API_KEY || "";
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

const transports = {
  [base.id]: http(
    INFURA_KEY
      ? `https://base-mainnet.infura.io/v3/${INFURA_KEY}`
      : "https://mainnet.base.org"
  ),
};

const connectors = [
  // Prefer injected first (covers Farcaster in-app & Base/Coinbase wallet browsers)
  injected({ shimDisconnect: true }),

  // Explicit popular wallets
  metaMask({ dappMetadata: { name: "Proof of Time" } }),
  coinbaseWallet({
    appName: "Proof of Time",
    preference: "all", // supports Base/Coinbase Wallet variants
  }),
  ...(WC_PROJECT_ID
    ? [
        walletConnect({
          projectId: WC_PROJECT_ID,
          showQrModal: true,
          metadata: {
            name: "Proof of Time",
            description: "Relics of on-chain patience on Base.",
            url: "https://proofoftime.vercel.app",
            icons: ["https://proofoftime.vercel.app/icon.png"],
          },
        }),
      ]
    : []),
];

const config = createConfig({
  chains: [base],
  transports,
  connectors,
  autoConnect: true, // 🔒 restores last session & enables smooth injected flows
  multiInjectedProviderDiscovery: true,
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
