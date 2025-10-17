"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  darkTheme,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

import { MiniKitContextProvider } from "@/providers/MiniKitProvider";
import FarcasterMiniBridge from "@/components/FarcasterMiniBridge"; // keeps Warpcast splash happy

const INFURA_KEY =
  process.env.NEXT_PUBLIC_INFURA_KEY || process.env.INFURA_API_KEY || "";
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "";

/** Put injected first so your click-to-connect prefers the in-app provider. */
const wallets = [
  {
    groupName: "Popular",
    wallets: [
      injectedWallet,
      coinbaseWallet,      // keep, but won’t auto-open
      metaMaskWallet,
      rainbowWallet,
      rabbyWallet,
      ...(WC_PROJECT_ID ? [walletConnectWallet] : []),
    ],
  },
];

const connectors = connectorsForWallets(wallets, {
  appName: "Proof of Time",
  projectId: WC_PROJECT_ID || "stub-project-id",
});

/** Important: don’t auto-reconnect on mount (prevents popup-blocked toasts). */
const config = createConfig({
  chains: [base],
  connectors,
  transports: {
    [base.id]: http(
      INFURA_KEY
        ? `https://base-mainnet.infura.io/v3/${INFURA_KEY}`
        : "https://mainnet.base.org"
    ),
  },
  ssr: true,
  // autoConnect is off by default in wagmi v2; leaving it off.
});

const qc = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniKitContextProvider>
      {/* ↓↓↓ turn OFF reconnectOnMount so no silent deep-link attempts happen */}
      <WagmiProvider config={config} reconnectOnMount={false}>
        <QueryClientProvider client={qc}>
          <RainbowKitProvider
            initialChain={base}
            theme={darkTheme({ accentColor: "#BBA46A" })}
            modalSize="compact"
            coolMode
          >
            <FarcasterMiniBridge />
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MiniKitContextProvider>
  );
}
