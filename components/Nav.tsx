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

const LAST_CONNECTOR_KEY = "pot_last_connector"; // stores connector.id

export default function Nav() {
  const { address, status: accountStatus, isConnecting, connector } = useAccount();
  const { connectAsync, status: connectStatus } = useConnect();
  const connectors = useConnectors();

  const insideFarcaster = useMemo(isFarcasterUA, []);

  // Persist last-used connector id on connect (covers modal & programmatic)
  useEffect(() => {
    if (!address || !connector) return;
    try {
      const id = (connector as any).id || (connector as any).type || "unknown";
      localStorage.setItem(LAST_CONNECTOR_KEY, String(id));
    } catch {}
  }, [address, connector]);

  // Helper: choose the best connector for this environment
  const pickPreferred = useMemo(() => {
    const byId: Record<string, (typeof connectors)[number]> = Object.fromEntries(
      connectors.map((c) => [c.id, c])
    );

    const lastId = (typeof window !== "undefined" && localStorage.getItem(LAST_CONNECTOR_KEY)) || "";
    const last = lastId && byId[lastId] ? byId[lastId] : null;

    const coinbase =
      connectors.find((c) => /coinbase/i.test(c.name)) || byId["coinbaseWalletSDK"];

    const injected =
      connectors.find((c) => /injected/i.test(c.name)) || byId["injected"];

    const ready = connectors.find((c) => (c as any).ready);

    // Preference order:
    //  - If in Farcaster: last -> Coinbase -> Injected -> ready -> first
    //  - Else (normal web): last -> Injected -> Coinbase -> ready -> first
    if (insideFarcaster) return last || coinbase || injected || ready || connectors[0];
    return last || injected || coinbase || ready || connectors[0];
  }, [connectors, insideFarcaster]);

  // Loosen readiness for injected (if window.ethereum exists)
  const hasWindowEth =
    typeof window !== "undefined" &&
    !!(window as any).ethereum &&
    !Array.isArray((window as any).ethereum);

  const canQuickConnect =
    !address &&
    !!pickPreferred &&
    // If preferred is injected, allow when either .ready !== false OR we detect window.ethereum
    ((pickPreferred.id === "injected" &&
      (((pickPreferred as any).ready !== false) || hasWindowEth)) ||
      // Otherwise, if not injected, require not explicitly unready
      (pickPreferred.id !== "injected" && (pickPreferred as any).ready !== false));

  // Prevent repeated auto attempts per disconnection (only applies to auto-reconnect logic below)
  const triedAutoReconnectRef = useRef(false);

  // One-shot auto-reconnect after a disconnect to the same last connector (non-intrusive)
  useEffect(() => {
    if (accountStatus !== "disconnected") {
      triedAutoReconnectRef.current = false;
      return;
    }
    if (triedAutoReconnectRef.current) return;

    const lastId =
      (typeof window !== "undefined" ? localStorage.getItem(LAST_CONNECTOR_KEY) : null) || "";
    const last = connectors.find((c) => c.id === lastId);

    if (last) {
      triedAutoReconnectRef.current = true;
      const t = setTimeout(async () => {
        try {
          await connectAsync({ connector: last });
        } catch {
          // ignore; user can click the button to open the modal
        }
      }, 200);
      return () => clearTimeout(t);
    }
  }, [accountStatus, connectAsync, connectors]);

  // Brand button classes (your original look)
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

        {/* Right controls */}
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
                // Try programmatic connect with the preferred connector, then fall back to modal
                if (!connected && canQuickConnect && pickPreferred) {
                  try {
                    await connectAsync({ connector: pickPreferred });
                    if (typeof window !== "undefined") {
                      localStorage.setItem(LAST_CONNECTOR_KEY, pickPreferred.id);
                    }
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
