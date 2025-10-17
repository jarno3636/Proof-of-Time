// components/Nav.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isFarcasterUA } from "@/lib/miniapp";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Nav() {
  const { address } = useAccount();
  const { connectAsync } = useConnect();
  const connectors = useConnectors();

  const insideFarcaster = useMemo(isFarcasterUA, []);

  // Helper: find Farcaster mini-connector
  const farcasterConn = useMemo(
    () =>
      connectors.find(
        (c) =>
          c.id.toLowerCase().includes("farcaster") ||
          c.name.toLowerCase().includes("farcaster")
      ) || null,
    [connectors]
  );

  const baseBtn =
    "inline-flex items-center gap-2 rounded-xl bg-[#BBA46A] hover:bg-[#d6c289] px-5 py-3 text-sm font-semibold text-[#0b0e14] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#BBA46A]/40 [appearance:none]";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/20 bg-black/5 border-b border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-xl font-semibold tracking-wide hover:text-[#d6c289] transition">
          <span className="text-[#BBA46A]">⟡</span> Proof of Time
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {address && (
            <Link href={`/relic/${address}`} className="text-sm text-zinc-300 hover:text-white">
              Your Altar
            </Link>
          )}

          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted, authenticationStatus }) => {
              const ready = mounted && authenticationStatus !== "loading";
              const connected = ready && account && chain;

              const handleClick = async () => {
                // Inside Warpcast, prefer the Farcaster connector (no popups, no blocked window)
                if (insideFarcaster && farcasterConn) {
                  try {
                    await connectAsync({ connector: farcasterConn });
                    return;
                  } catch {
                    // fall back to modal if something odd happens
                  }
                }
                // Else use RainbowKit modal with full options
                openConnectModal?.();
              };

              if (!ready) {
                return (
                  <button className={baseBtn} disabled aria-busy="true">
                    Connecting…
                  </button>
                );
              }

              if (!connected) {
                return (
                  <button onClick={handleClick} className={baseBtn} aria-label="Connect Wallet">
                    Connect Wallet
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button onClick={openChainModal} className={baseBtn + " !px-3"} type="button">
                    {chain?.name ?? "Chain"}
                  </button>
                  <button onClick={openAccountModal} className={baseBtn} type="button">
                    {account?.displayName || short(account?.address!)}
                  </button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </nav>
  );
}
