// app/page.tsx
"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseAbi } from "viem";
import { base } from "viem/chains";

/* ---------- Client islands ---------- */
const BuyButton = dynamic(() => import("@/components/BuyButton"), {
  ssr: false,
});

const PriceChip = dynamic(() => import("@/components/PriceChip"), {
  ssr: false,
});

const POTHourglassMint = dynamic(
  () => import("@/components/POTHourglassMint"),
  { ssr: false }
);

/* ---------- Types / Helpers ---------- */
type Addr = `0x${string}`;

const asAddr = (v?: string): Addr | undefined => {
  const s = (v ?? "").trim().replace(/\s+/g, "").replace(/['"`]/g, "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return undefined;
  return s.toLowerCase() as Addr;
};

const READ_BASE = { chainId: base.id };

/* ---------- Config ---------- */
const POT_ADDRESS = asAddr(process.env.NEXT_PUBLIC_POT_ADDRESS);

// GeckoTerminal pool for PØT/WETH on Base
const GECKO_POOL_ID = "base/0x89a77adf4e04d3af3db8794870aabb63c556c9fa";

/* ---------- ABI ---------- */
const POT_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function holderInfo(address holder) view returns (uint256 streakStart,uint256 completedWeeks,uint256 lastClaimedWeek,uint256 claimableWeeks,uint256 claimableAmount,uint16 currentMultBps,uint256 effectiveBaseRateBps,uint256 reserveBalance,uint256 baselineBalance)",
  "function getHolderTier(address holder) view returns (uint256 idx, uint16 minWeeks, uint16 bps)",
  "function currentWeek() view returns (uint256)",
  "function claim()",
] as const);

/* ---------- Formatters ---------- */
function fmt18(n?: bigint, digits = 4) {
  if (n === undefined) return "—";

  const v = Number.parseFloat(formatUnits(n, 18));

  return Number.isFinite(v)
    ? v.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
}

function bpsToX(bps?: number) {
  if (!Number.isFinite(bps as number)) return "—";
  return `${(Number(bps) / 10_000).toFixed(2)}×`;
}

function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Home() {
  const { address, chainId, isConnected } = useAccount();

  /* ---------- Reads ---------- */
  const { data: balance } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "balanceOf",
    args: [address as Addr],
    query: {
      enabled: !!address && !!POT_ADDRESS,
      refetchInterval: 20_000,
    },
    ...READ_BASE,
  });

  const { data: info } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "holderInfo",
    args: [address as Addr],
    query: {
      enabled: !!address && !!POT_ADDRESS,
      refetchInterval: 20_000,
    },
    ...READ_BASE,
  });

  const { data: tier } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "getHolderTier",
    args: [address as Addr],
    query: {
      enabled: !!address && !!POT_ADDRESS,
      refetchInterval: 60_000,
    },
    ...READ_BASE,
  });

  const { data: week } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "currentWeek",
    query: {
      enabled: !!POT_ADDRESS,
      refetchInterval: 60_000,
    },
    ...READ_BASE,
  });

  /* ---------- Writes ---------- */
  const {
    writeContract,
    data: txHash,
    isPending: isClaiming,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [
    streakStart,
    completedWeeks,
    lastClaimedWeek,
    claimableWeeks,
    claimableAmount,
    currentMultBps,
    effectiveBaseRateBps,
    reserveBalance,
    baselineBalance,
  ] =
    (info ??
      [
        0n,
        0n,
        0n,
        0n,
        0n,
        0,
        0n,
        0n,
        0n,
      ]) as unknown as [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        number,
        bigint,
        bigint,
        bigint
      ];

  const claimableNow = claimableAmount;

  const canClaim = useMemo(() => {
    if (!POT_ADDRESS) return false;
    if (!isConnected || !address) return false;
    if (chainId !== base.id) return false;
    return claimableNow > 0n;
  }, [isConnected, address, chainId, claimableNow]);

  const onClaim = () => {
    if (!POT_ADDRESS || !canClaim) return;

    writeContract({
      address: POT_ADDRESS,
      abi: POT_ABI,
      functionName: "claim",
      chainId: base.id,
    });
  };

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100 flex flex-col">
      <Nav />

      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-6xl px-6 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-20 pb-12 md:pb-16 flex-grow">
        <div className="grid gap-8 lg:grid-cols-[1.02fr,0.98fr] lg:items-start">
          {/* ---------- Left: Headline ---------- */}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-[#BBA46A]/30 bg-[#BBA46A]/10 px-3 py-1 text-xs font-semibold text-[#d6c289]">
                Built on Base · Powered by patience
              </div>

              <PriceChip poolId={GECKO_POOL_ID} />
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tight text-center md:text-left">
              Hold PøT. Build your streak.{" "}
              <span className="text-zinc-400">Claim your time.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-zinc-400 text-center md:text-left md:pr-10 mx-auto md:mx-0">
              Proof of Time rewards holders who stay consistent. Your streak
              grows by the week, your multiplier improves over time, and
              eligible holders can claim from a finite reserve.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
              <BuyButton />

              <Link
                href="/pot"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:text-zinc-100 hover:border-[#BBA46A]/50 transition"
              >
                View full PøT dashboard
              </Link>
            </div>

            {/* Burn highlight */}
            <div className="mt-6 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 px-5 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[#BBA46A]">
                    Supply Update: 100M PøT Burned
                  </div>
                  <p className="mt-1 text-zinc-400">
                    100,000,000 PøT were permanently sent to the burn address
                    to tighten supply and support long-term conviction.
                  </p>
                </div>
              </div>

              <a
                href="https://basescan.org/tx/0xd55d4b1f4c9e7f18519f29f6abeee223210e1125fa27f197f6bb346b1aec525d"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-zinc-700/70 bg-zinc-950/40 px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-zinc-200 hover:text-[#BBA46A] hover:border-[#BBA46A]/60 transition"
              >
                View burn tx on BaseScan ↗
              </a>
            </div>
          </div>

          {/* ---------- Right: Market + Live Holder Panel ---------- */}
          <div className="grid gap-6">
            <PriceChip poolId={GECKO_POOL_ID} variant="hero" />

            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-5 sm:p-6 shadow-2xl shadow-black/20">
              <div>
                <h2 className="text-xl font-bold text-[#BBA46A]">
                  Your PøT Panel
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Connect your wallet to view your balance, weekly streak,
                  claimable rewards, and current multiplier.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <MiniStat
                  label="Your balance"
                  value={`${fmt18(balance)} PØT`}
                />

                <MiniStat
                  label="Week streak"
                  value={`${completedWeeks?.toString() ?? "0"} weeks`}
                />

                <MiniStat
                  label="Claimable"
                  value={`${fmt18(claimableNow)} PØT`}
                />

                <MiniStat
                  label="Claimable weeks"
                  value={claimableWeeks?.toString() ?? "0"}
                />

                <MiniStat
                  label="Multiplier"
                  value={bpsToX(Number(tier?.[2] ?? currentMultBps))}
                />

                <MiniStat
                  label="Current week"
                  value={week?.toString() ?? "—"}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-zinc-800/70 bg-[#0b0e14]/60 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Connected wallet
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-300">
                      {isConnected ? shortAddr(address) : "Not connected"}
                    </div>
                  </div>

                  <button
                    onClick={onClaim}
                    disabled={!canClaim || isClaiming || isConfirming}
                    className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                      canClaim && !isClaiming && !isConfirming
                        ? "bg-[#BBA46A] text-[#0b0e14] hover:bg-[#d6c289]"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    }`}
                  >
                    {isClaiming
                      ? "Submitting…"
                      : isConfirming
                      ? "Confirming…"
                      : "Claim PØT"}
                  </button>
                </div>

                <div className="mt-3 min-h-5 text-xs">
                  {!POT_ADDRESS && (
                    <span className="text-red-400">
                      Missing NEXT_PUBLIC_POT_ADDRESS.
                    </span>
                  )}

                  {!isConnected && POT_ADDRESS && (
                    <span className="text-zinc-500">
                      Connect your wallet to check rewards.
                    </span>
                  )}

                  {isConnected && chainId !== base.id && (
                    <span className="text-zinc-500">
                      Switch to Base to claim.
                    </span>
                  )}

                  {isConnected &&
                    chainId === base.id &&
                    claimableNow === 0n &&
                    !isConfirmed && (
                      <span className="text-zinc-500">
                        No claimable rewards yet. Keep holding and let the
                        streak build.
                      </span>
                    )}

                  {isConfirmed && (
                    <span className="text-emerald-400">
                      Claim successful ✔
                    </span>
                  )}
                </div>
              </div>
            </div>

            <POTHourglassMint />
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Build a Weekly Streak"
            text="PøT rewards consistency. The longer your eligible hold continues, the more meaningful your streak becomes."
          />

          <FeatureCard
            title="Claim From the Reserve"
            text="Rewards are distributed from a finite reserve, not endlessly created on demand. The system is built around scarcity and patience."
          />

          <FeatureCard
            title="Hold With Intention"
            text="Outgoing transfers reset your streak. PøT is designed for holders who want their time in the token to matter."
          />
        </div>
      </section>

      {/* ---------- Mechanics Note ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6">
          <h2 className="text-xl font-bold text-[#BBA46A]">
            How Proof of Time Works
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Mechanic
              number="01"
              title="Hold PØT"
              text="Your wallet balance is tracked on Base. A minimum hold is required to begin earning rewards."
            />
            <Mechanic
              number="02"
              title="Build Weeks"
              text="Your completed weeks determine your streak and reward eligibility. Week one is the warm-up."
            />
            <Mechanic
              number="03"
              title="Claim Rewards"
              text="When rewards become available, claim directly from the contract using the live panel."
            />
          </div>

          <p className="mt-6 text-sm text-zinc-500 max-w-3xl">
            Note: PøT holder rewards are based on contract mechanics. Outgoing
            transfers may reset streak progress. Rewards draw from the available
            reserve and may depend on balance, baseline, tier, and current
            contract settings.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <h3 className="font-semibold text-[#BBA46A]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-base font-bold text-[#BBA46A]">{value}</div>
    </div>
  );
}

function Mechanic({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-[#0b0e14]/50 p-5">
      <div className="text-xs font-black tracking-widest text-zinc-600">
        {number}
      </div>
      <h3 className="mt-3 font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </div>
  );
}
