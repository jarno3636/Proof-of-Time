// components/Nav.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useMemo } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isFarcasterUA } from "@/lib/miniapp";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const LAST_CONNECTOR_KEY = "pot_last_connector";

export default function Nav() {
  const { address, status: accountStatus, isConnecting, connector } = useAccount();
  const { connectAsync, status: connectStatus } = useConnect();
  const connectors = useConnectors();

  const insideFarcaster = useMemo(isFarcasterUA, []);

  // remember last connector (unchanged)
  useEffect(() => {
    if (!address || !connector) return;
    try {
      const id = (connector as any).id || (connector as any).type || "unknown";
      localStorage.setItem(LAST_CONNECTOR_KEY, String(id));
    } catch {}
  }, [address, connector]);

  // find common connectors (unchanged)
  const byId: Record<string, (typeof connectors)[number]> = useMemo(
    () => Object.fromEntries(connectors.map((c) => [c.id, c])),
    [connectors]
  );
  const injected =
    connectors.find((c) => /injected/i.test(c.name)) || byId["injected"];
  const coinbaseSDK =
    connectors.find((c) => /coinbase/i.test(c.name)) || byId["coinbaseWalletSDK"];

  // (kept) gentle auto-reconnect after disconnect — but NOT inside Farcaster
  const triedAutoReconnectRef = useRef(false);
  useEffect(() => {
    if (insideFarcaster) return; // avoid popup-block in mini-app
    if (accountStatus !== "disconnected") {
      triedAutoReconnectRef.current = false;
      return;
    }
    if (triedAutoReconnectRef.current) return;
    const lastId =
      (typeof window !== "undefined" ? localStorage.getItem(LAST_CONNECTOR_KEY) : null) || "";
    const last = byId[lastId];
    if (last) {
      triedAutoReconnectRef.current = true;
      const t = setTimeout(() => {
        connectAsync({ connector: last }).catch(() => {});
      }, 200);
      return () => clearTimeout(t);
    }
  }, [accountStatus, byId, connectAsync, insideFarcaster]);

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
                // ✅ IMPORTANT: Inside Warpcast, force the Injected connector
                // (Base/Coinbase provides an injected provider in the in-app webview).
                if (insideFarcaster && injected) {
                  try {
                    await connectAsync({ connector: injected });
                    localStorage.setItem(LAST_CONNECTOR_KEY, injected.id);
                    return;
                  } catch {
                    // fall back to modal if injected fails
                    openConnectModal?.();
                    return;
                  }
                }

                // Normal web: prefer last-used connector; if that is coinbaseSDK it may open a popup.
                // Let RainbowKit modal handle UX in that case.
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
                      <img
                        alt={chain?.name ?? "Chain"}
                        src={chain.iconUrl}
                        width={18}
                        height={18}
                        style={{ borderRadius: 999, objectFit: "cover" }}
                      />
                    ) : null}
                    <span className="hidden sm:inline">{chain?.name ?? "Chain"}</span>
                  </button>
                  <button
                    onClick={openAccountModal}
                    className={baseBtn}
                    type="button"
                    aria-label="Account"
                    title="Account"
                  >
                    {account?.displayName || (address ? short(address) : "Account")}
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
