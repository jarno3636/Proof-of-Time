"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected, metaMask, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_KEY || process.env.INFURA_API_KEY || "";
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || ""; // set this in env for WalletConnect to appear

// Include Injected explicitly so it shows up in the RainbowKit modal
const connectors = [
  injected({ shimDisconnect: true }),            // Browser / Injected (Farcaster, Base, MetaMask, CBW in-app)
  metaMask(),                                    // MetaMask (explicit)
  coinbaseWallet({ appName: "Proof of Time" }),  // Coinbase Wallet
  ...(WC_PROJECT_ID
    ? [walletConnect({
        projectId: WC_PROJECT_ID,
        showQrModal: true,
        metadata: {
          name: "Proof of Time",
          description: "Relics of on-chain patience on Base.",
          url: "https://proofoftime.vercel.app",
          icons: ["https://proofoftime.vercel.app/icon.png"],
        },
      })]
    : []),
];

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
  // ❌ autoConnect not supported here in wagmi v2 — use reconnectOnMount on the provider below
});

const qc = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // ✅ This enables auto-reconnect to the last used connector (incl. Injected) after disconnect/refresh
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
