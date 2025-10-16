"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const LAST_CONNECTOR_KEY = "pot_last_connector"; // 'injected' | 'walletConnect' | 'coinbaseWallet' | etc.

export default function Nav() {
  // Persist the connector on every successful connect (works for modal or programmatic)
  const { address, status: accountStatus, isConnecting, connector } = useAccount({
    onConnect(data) {
      try {
        const id =
          (data.connector as any)?.type ||
          (data.connector as any)?.id ||
          "unknown";
        localStorage.setItem(LAST_CONNECTOR_KEY, String(id));
      } catch {}
    },
    onDisconnect() {
      // keep LAST_CONNECTOR_KEY so we know what to auto-reconnect with
    },
  });

  const { connectAsync, status: connectStatus } = useConnect();
  const connectors = useConnectors();

  // Prefer injected for one-click (Farcaster in-app, Base/Coinbase browsers, MetaMask)
  const injected = connectors.find((c) => c.type === "injected");

  // if we’re not connected and there’s *any* window.ethereum, allow quick attempt even if ready flag lies
  const hasWindowEth =
    typeof window !== "undefined" &&
    !!(window as any).ethereum &&
    !Array.isArray((window as any).ethereum);

  const canQuickConnect =
    !address && (!!injected && ((injected as any).ready !== false || hasWindowEth));

  // Prevent repeated auto attempts per disconnection
  const triedAutoReconnectRef = useRef(false);

  // One-shot auto-reconnect with injected after a disconnect if that was the last connector
  useEffect(() => {
    if (accountStatus !== "disconnected") {
      triedAutoReconnectRef.current = false;
      return;
    }
    if (triedAutoReconnectRef.current) return;

    const last =
      (typeof window !== "undefined"
        ? localStorage.getItem(LAST_CONNECTOR_KEY)
        : null) || "";

    if (last.toLowerCase() === "injected" && injected) {
      triedAutoReconnectRef.current = true;
      const t = setTimeout(async () => {
        try {
          await connectAsync({ connector: injected });
        } catch {
          // ignore; user can click the button to open the modal
        }
      }, 200);
      return () => clearTimeout(t);
    }
  }, [accountStatus, connectAsync, injected]);

  // ⟡ Brand button (same look for both states)
  const baseBtn =
    "inline-flex items-center gap-2 rounded-xl " +
    "bg-[#BBA46A] hover:bg-[#d6c289] " +
    "px-5 py-3 text-sm font-semibold " +
    "text-[#0b0e14] transition " +
    "disabled:opacity-60 disabled:cursor-not-allowed " +
    "focus:outline-none focus:ring-2 focus:ring-[#BBA46A]/40 " +
    "[appearance:none]";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/20 bg-black/5 border-b border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        {/* Brand / Title */}
        <Link
          href="/"
          className="text-xl font-semibold tracking-wide hover:text-[#d6c289] transition"
        >
          <span className="text-[#BBA46A]">⟡</span> Proof of Time
        </Link>

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-3">
          {address && (
            <Link
              href={`/relic/${address}`}
              className="text-sm text-zinc-300 hover:text-white"
            >
              Your Altar
            </Link>
          )}

          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== "loading";
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus ||
                  authenticationStatus === "authenticated");

              const handleClick = async () => {
                // Try injected first for one-click flows
                if (!connected && canQuickConnect && injected) {
                  try {
                    await connectAsync({ connector: injected });
                    // record it for future auto-reconnects
                    localStorage.setItem(LAST_CONNECTOR_KEY, "injected");
                    return;
                  } catch {
                    // fall through to modal
                  }
                }
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
                  <button
                    onClick={handleClick}
                    className={baseBtn}
                    disabled={isConnecting || connectStatus === "pending"}
                    aria-label="Connect Wallet"
                  >
                    Connect Wallet
                  </button>
                );
              }

              // Connected state — same brand styling
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className={baseBtn + " !px-3"}
                    type="button"
                    aria-label="Select Chain"
                    title={chain?.name ?? "Chain"}
                  >
                    {chain?.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={chain?.name ?? "Chain"}
                        src={chain.iconUrl}
                        width={18}
                        height={18}
                        style={{ borderRadius: 999, objectFit: "cover" }}
                      />
                    ) : null}
                    <span className="hidden sm:inline">
                      {chain?.name ?? "Chain"}
                    </span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    className={baseBtn}
                    type="button"
                    aria-label="Account"
                    title="Account"
                  >
                    {account?.displayName ||
                      (address ? short(address) : "Account")}
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
