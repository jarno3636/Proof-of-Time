"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function detectPreferInjected(): boolean {
  if (typeof window === "undefined") return false;
  const ua = (navigator.userAgent || "").toLowerCase();
  const eth: any = (window as any).ethereum;

  const inFarcaster = /warpcast|farcaster/.test(ua);
  const coinbaseInjected =
    eth?.isCoinbaseWallet ||
    eth?.isBaseWallet ||
    eth?.providers?.some((p: any) => p?.isCoinbaseWallet || p?.isBaseWallet);

  // Prefer injected when inside Farcaster app webview or Coinbase/Base wallet
  return Boolean(inFarcaster || coinbaseInjected);
}

export default function WalletConnect() {
  const router = useRouter();
  const { address, isConnected, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectAsync, connectors, isPending } = useConnect();

  // Auto-route to altar on connect
  useEffect(() => {
    if (isConnected && address) router.push(`/relic/${address}`);
  }, [isConnected, address, router]);

  // One-time attempt to auto-trigger injected connect if we're in Farcaster/Base context
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    if (isConnected || status === "reconnecting") return;

    if (detectPreferInjected()) {
      const injected = connectors.find((c) => c.id === "injected");
      if (injected) {
        tried.current = true;
        // This will open the wallet prompt in those environments
        connectAsync({ connector: injected }).catch(() => {
          /* user canceled / ignore */
        });
      }
    }
  }, [connectAsync, connectors, isConnected, status]);

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
        const ready = mounted && status !== "reconnecting";
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#BBA46A] text-black hover:opacity-95 disabled:opacity-60 px-4 py-2 text-sm font-semibold"
            >
              {isPending ? "Opening…" : "Connect Wallet"}
            </button>
          );
        }

        return (
          <div className="relative flex items-center gap-2">
            <button
              onClick={openAccountModal}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10"
              title={account.address}
            >
              {short(account.address)}
            </button>

            {/* Optional quick disconnect button (Account modal also has Disconnect) */}
            {/* <button
              onClick={() => disconnect()}
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              title="Disconnect"
            >
              Disconnect
            </button> */}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
