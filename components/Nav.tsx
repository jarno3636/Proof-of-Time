"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const LAST_CONNECTOR_KEY = "pot_last_connector"; // 'injected' | 'walletconnect' | 'coinbaseWallet' | etc.

export default function Nav() {
  const { address, status: accountStatus, isConnecting } = useAccount();
  const { connectAsync, status: connectStatus } = useConnect();
  const connectors = useConnectors();

  // Prefer an injected connector for one-click flows (Farcaster/Base/MetaMask/CBW)
  const injected = connectors.find((c) => c.type === "injected");

  // “Can quick connect” if we’re not already connected & an injected provider is present/ready
  const canQuickConnect =
    !address && !!injected && (injected as any).ready !== false;

  // Prevent repeated auto-attempts in a tight loop
  const triedAutoReconnectRef = useRef(false);

  // Soft auto-reconnect after a manual disconnect if the last session used injected.
  useEffect(() => {
    if (accountStatus !== "disconnected") {
      // Reset guard whenever we’re not in a disconnected state
      triedAutoReconnectRef.current = false;
      return;
    }

    // Only try once per disconnection
    if (triedAutoReconnectRef.current) return;

    const last = (typeof window !== "undefined"
      ? localStorage.getItem(LAST_CONNECTOR_KEY)
      : null) as string | null;

    if (last === "injected" && injected && (injected as any).ready !== false) {
      triedAutoReconnectRef.current = true;
      // Small delay so the UI settles after the disconnect modal closes
      const t = setTimeout(async () => {
        try {
          await connectAsync({ connector: injected });
        } catch {
          // no worries—user can click the button to open the modal
        }
      }, 250);
      return () => clearTimeout(t);
    }
  }, [accountStatus, connectAsync, injected]);

  // ⟡ Brand button (forces same look connected/disconnected)
  const baseBtn =
    "inline-flex items-center gap-2 rounded-xl " +
    "bg-[#BBA46A] hover:bg-[#d6c289] " +
    "px-5 py-3 text-sm font-semibold " +
    "text-[#0b0e14] transition " +
    "disabled:opacity-60 disabled:cursor-not-allowed " +
    "focus:outline-none focus:ring-2 focus:ring-[#BBA46A]/40 " +
    "[appearance:none]"; // prevent UA styling overriding color in some browsers

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

          {/* Custom Connect so both states share identical styling */}
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
                    const res = await connectAsync({ connector: injected });
                    // remember last connector if connect succeeded
                    if (typeof window !== "undefined") {
                      localStorage.setItem(LAST_CONNECTOR_KEY, "injected");
                    }
                    return res;
                  } catch {
                    // fall back to modal if quick connect fails
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

              // Connected state — chain & account use the exact same brand styles
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
                    // When they disconnect from this modal, the useEffect above will
                    // auto-attempt injected again if that was the last connector.
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
