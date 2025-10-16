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

// ✅ RainbowKit wallet factories (show up as options in the modal)
import {
  injectedWallet,        // “Browser Wallet” (Base/Coinbase/MetaMask/Rabby/Rango injections)
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

const INFURA_KEY =
  process.env.NEXT_PUBLIC_INFURA_KEY || process.env.INFURA_API_KEY || "";
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

// ── Wallet groups (you can reorder) ──────────────────────────────────────────
const wallets = [
  {
    groupName: "Popular",
    wallets: [
      injectedWallet,
      metaMaskWallet,
      coinbaseWallet,
      rainbowWallet,
      rabbyWallet,
      // WalletConnect button only if a projectId is set
      ...(WC_PROJECT_ID ? [walletConnectWallet] : []),
    ],
  },
];

// Build wagmi connectors from RainbowKit wallets
const connectors = connectorsForWallets(wallets, {
  appName: "Proof of Time",
  projectId: WC_PROJECT_ID || "stub-project-id", // RainbowKit is happier with a non-empty string; WC won’t be used if modal button omitted
});

// Wagmi config
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
});

const qc = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // ✅ Reconnects to last-used connector on mount (works with Injected too)
    <WagmiProvider config={config} reconnectOnMount>
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
