"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent || "");
}

export default function Nav() {
  const { address } = useAccount();
  const { connectAsync } = useConnect();
  const connectors = useConnectors();

  const insideFarcaster = useMemo(isFarcasterUA, []);

  // --- Admin allowlist ---
  const ADMIN_ADDRESSES = [
    "0x3118FE32B27651734fe4D966D1bC240bE6e3139D",
    "0x738f3feBfF6DACeE3B4b9dfb339128F6E94F0E8d",
  ].map(a => a.toLowerCase());
  const isAdmin = !!address && ADMIN_ADDRESSES.includes(address.toLowerCase());
  // ------------------------

  const farcasterConn = useMemo(
    () =>
      connectors.find(
        (c) =>
          c.id.toLowerCase().includes("farcaster") ||
          c.name.toLowerCase().includes("farcaster")
      ) || null,
    [connectors]
  );

  const [open, setOpen] = useState(false);

  const baseBtn =
    "inline-flex items-center gap-2 rounded-xl bg-[#BBA46A] hover:bg-[#d6c289] px-5 py-3 text-sm font-semibold text-[#0b0e14] transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#BBA46A]/40 [appearance:none]";

  const item =
    "block w-full text-left rounded-lg border border-zinc-700/40 bg-zinc-900/40 hover:bg-zinc-800/60 px-4 py-2 text-sm font-semibold text-zinc-200 transition";

  const handleConnect = async () => {
    if (insideFarcaster && farcasterConn) {
      try {
        await connectAsync({ connector: farcasterConn });
        return;
      } catch {
        // fall back to modal
      }
    }
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/20 bg-black/5 border-b border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        {/* Logo */}
        <Link href="/" className="text-xl font-semibold tracking-wide hover:text-[#d6c289] transition">
          <span className="text-[#BBA46A]">⟡</span> Proof of Time
        </Link>

        {/* Menu button */}
        <button
          onClick={() => setOpen((s) => !s)}
          className="ml-2 inline-flex items-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-900/40 hover:bg-zinc-800/50 px-3 py-2 text-sm font-semibold text-zinc-200 transition"
          aria-expanded={open}
          aria-controls="site-menu"
        >
          Menu ▾
        </button>

        {/* Right actions */}
        <div className="ml-auto">
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted, authenticationStatus }) => {
              const ready = mounted && authenticationStatus !== "loading";
              const connected = ready && account && chain;

              const onClick = async () => {
                await handleConnect();
                openConnectModal?.();
              };

              return !ready ? (
                <button className={baseBtn} disabled aria-busy="true">Connecting…</button>
              ) : !connected ? (
                <button onClick={onClick} className={baseBtn} aria-label="Connect Wallet">Connect Wallet</button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={openChainModal} className={baseBtn + " !px-3"} type="button">
                    {chain?.name ?? "Chain"}
                  </button>
                  <button onClick={openAccountModal} className={baseBtn} type="button">
                    {account?.displayName}
                  </button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div id="site-menu" className="mx-auto max-w-6xl px-4 pb-4">
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-3 grid gap-2 sm:grid-cols-2">
            {/* Admin-only links */}
            <Link
              href="/launch"
              className={`${item} ${!isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => isAdmin && setOpen(false)}
            >
              Launch (Admin)
            </Link>
            <Link
              href="/pot"
              className={`${item} ${!isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => isAdmin && setOpen(false)}
            >
              PoT (Admin)
            </Link>
          </div>
          {!isAdmin && (
            <p className="px-2 pt-2 text-xs text-zinc-500">
              Admin-only pages are disabled until an admin wallet is connected.
            </p>
          )}
        </div>
      )}
    </nav>
  );
}
