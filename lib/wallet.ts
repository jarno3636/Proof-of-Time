"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";

// RainbowKit wallet factories (modal buttons)
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

// Prefer Coinbase/Base injection explicitly
import { injected } from "@wagmi/connectors";

// Farcaster official wagmi connector (works in Warpcast)
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

// RainbowKit wallet groups (full set for web/dapps)
const walletGroups = [
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

// Convert to wagmi connectors used by RainbowKit modal
const rkConnectors = connectorsForWallets(walletGroups, {
  appName: "Proof of Time",
  projectId: WC_PROJECT_ID || "stub-project-id",
});

// Final wagmi config (order matters)
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ||
        (process.env.NEXT_PUBLIC_INFURA_KEY
          ? `https://base-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_KEY}`
          : "https://mainnet.base.org")
    ),
  },
  connectors: [
    // 1) Farcaster Mini-App connector (handles Warpcast webview properly)
    miniAppConnector(),

    // 2) Prefer Coinbase/Base injected provider if present
    injected({ target: "coinbaseWallet", shimDisconnect: true }),

    // 3) Full RainbowKit set for web (MetaMask, Coinbase Wallet SDK, WalletConnect, etc.)
    ...rkConnectors,
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }), // nice UX across reloads
});
