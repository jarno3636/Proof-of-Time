"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

// Local UA helper
function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent || "");
}

export default function Nav() {
  const { address } = useAccount();
  const { connectAsync } = useConnect();
  const connectors = useConnectors();

  const insideFarcaster = useMemo(isFarcasterUA, []);

  // --- Admin allowlist (add more as needed) ---
  const ADMIN_ADDRESSES = [
    "0x3118FE32B27651734fe4D966D1bC240bE6e3139D",
    "0x738f3feBfF6DACeE3B4b9dfb339128F6E94F0E8d",
  ].map(a => a.toLowerCase());
  const isAdmin = !!address && ADMIN_ADDRESSES.includes(address.toLowerCase());
  // --------------------------------------------

  // Prefer Farcaster connector inside Warpcast if present
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

  const potLinkClasses =
    "inline-flex items-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-900/40 hover:bg-zinc-800/50 px-4 py-2 text-sm font-semibold text-zinc-200 transition focus:outline-none focus:ring-2 focus:ring-zinc-700/50";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/20 bg-black/5 border-b border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        {/* Logo / title */}
        <Link
          href="/"
          className="text-xl font-semibold tracking-wide hover:text-[#d6c289] transition"
        >
          <span className="text-[#BBA46A]">⟡</span> Proof of Time
        </Link>

        {/* Admin-only link rendered with wallet state */}
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            mounted,
            authenticationStatus,
          }) => {
            const ready = mounted && authenticationStatus !== "loading";
            const connected = ready && account && chain;

            const showPotLink = connected && isAdmin;

            const handleClick = async () => {
              if (insideFarcaster && farcasterConn) {
                try {
                  await connectAsync({ connector: farcasterConn });
                  return;
                } catch {
                  // fall back to modal
                }
              }
              openConnectModal?.();
            };

            return (
              <>
                <div className="ml-4">
                  {showPotLink && (
                    <Link href="/pot" className={potLinkClasses} title="Proof of Time Token">
                      PøT Token
                    </Link>
                  )}
                </div>

                {/* Right actions */}
                <div className="ml-auto flex items-center gap-2">
                  {!ready ? (
                    <button className={baseBtn} disabled aria-busy="true">
                      Connecting…
                    </button>
                  ) : !connected ? (
                    <button onClick={handleClick} className={baseBtn} aria-label="Connect Wallet">
                      Connect Wallet
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={openChainModal} className={baseBtn + " !px-3"} type="button">
                        {chain?.name ?? "Chain"}
                      </button>
                      <button onClick={openAccountModal} className={baseBtn} type="button">
                        {account?.displayName}
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </nav>
  );
}
