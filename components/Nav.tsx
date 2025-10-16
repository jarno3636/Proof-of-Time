"use client";

import Link from "next/link";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Nav() {
  const { address, isConnecting } = useAccount();
  const { connectAsync, status: connectStatus } = useConnect();
  const connectors = useConnectors();

  // Prefer an injected connector for one-click flows (Farcaster/Base/MetaMask/CBW)
  const injected = connectors.find((c) => c.type === "injected");
  const canQuickConnect = !address && !!injected && (injected as any).ready !== false;

  const baseBtn =
    "inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 " +
    "px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed " +
    "transition";

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
                (!authenticationStatus || authenticationStatus === "authenticated");

              // One-click connect for injected wallets
              const handleClick = async () => {
                if (!connected && canQuickConnect && injected) {
                  try {
                    await connectAsync({ connector: injected });
                    return;
                  } catch {
                    // If quick connect fails, fall back to the modal
                  }
                }
                openConnectModal?.();
              };

              if (!ready) {
                return (
                  <button className={baseBtn} disabled>
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
                  >
                    Connect Wallet
                  </button>
                );
              }

              // Connected state – same look & feel
              return (
                <div className="flex items-center gap-2">
                  {/* Chain button (click to switch) */}
                  <button
                    onClick={openChainModal}
                    className={baseBtn + " !px-3"}
                    type="button"
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
                    <span className="hidden sm:inline">{chain?.name ?? "Chain"}</span>
                  </button>

                  {/* Account button (click to view/disconnect) */}
                  <button onClick={openAccountModal} className={baseBtn} type="button">
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
