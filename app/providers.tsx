// app/providers.tsx
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
import { useMemo } from "react";

import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

import { MiniKitContextProvider } from "@/providers/MiniKitProvider";
import FarcasterMiniBridge from "@/components/FarcasterMiniBridge";
import { isFarcasterUA } from "@/lib/miniapp";

const INFURA_KEY =
  process.env.NEXT_PUBLIC_INFURA_KEY || process.env.INFURA_API_KEY || "";
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "";

// keep Query Client as-is
const qc = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  // Detect Farcaster on the client
  const insideFarcaster = useMemo(isFarcasterUA, []);

  // Choose wallet list at runtime (client) to avoid popup-only connectors in Farcaster
  const walletGroups = useMemo(() => {
    if (insideFarcaster) {
      // ✅ Inside Warpcast: prefer WalletConnect (stable in-app)
      return [
        {
          groupName: "Farcaster",
          wallets: [
            // WalletConnect is the one that works reliably in the in-app webview.
            // (Uses native deep-links/sheets instead of popups.)
            walletConnectWallet,
            // Optionally include Coinbase Wallet *via* WalletConnect (keeps a single flow).
            // coinbaseWallet,  // <- comment this IN only if you want it shown explicitly
          ],
        },
      ];
    }
    // 🌐 Normal web: keep your original set
    return [
      {
        groupName: "Popular",
        wallets: [
          injectedWallet,
          metaMaskWallet,
          coinbaseWallet,
          rainbowWallet,
          rabbyWallet,
          ...(WC_PROJECT_ID ? [walletConnectWallet] : []),
        ],
      },
    ];
  }, [insideFarcaster]);

  const connectors = useMemo(
    () =>
      connectorsForWallets(walletGroups, {
        appName: "Proof of Time",
        projectId: WC_PROJECT_ID || "stub-project-id",
      }),
    [walletGroups]
  );

  const config = useMemo(
    () =>
      createConfig({
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
      }),
    [connectors]
  );

  return (
    <MiniKitContextProvider>
      <WagmiProvider config={config} reconnectOnMount>
        <QueryClientProvider client={qc}>
          <RainbowKitProvider
            initialChain={base}
            theme={darkTheme({ accentColor: "#BBA46A" })}
            modalSize="compact"
            coolMode
          >
            {/* keeps Warpcast splash happy */}
            <FarcasterMiniBridge />
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MiniKitContextProvider>
  );
}
