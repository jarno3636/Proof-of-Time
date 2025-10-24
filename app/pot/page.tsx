"use client";

import Nav from "@/components/Nav";
import Image from "next/image";
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

/** ========= Config ========= */
const POT_ADDRESS = (process.env.NEXT_PUBLIC_POT_ADDRESS || "").trim() as `0x${string}`;

// Minimal ABI (only what we call/read)
const POT_ABI = parseAbi([
  // reads
  "function holderInfo(address holder) view returns (uint256,uint256,uint256,uint256,uint256,uint16,uint256,uint256,uint256)",
  "function claimable(address holder) view returns (uint256 weeks_, uint256 amount_)",
  "function getHolderTier(address holder) view returns (uint256 idx, uint16 minWeeks, uint16 bps)",
  "function currentWeek() view returns (uint256)",
  "function baseRateBps() view returns (uint256)",
  "function halvingIntervalWeeks() view returns (uint256)",
  // write
  "function claim()",
] as const);

/** ========= Helpers ========= */
function fmt18(n?: bigint, digits = 4) {
  if (n === undefined) return "—";
  const s = Number.parseFloat(formatUnits(n, 18));
  return isFinite(s) ? s.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
}
function bpsToX(bps?: number) {
  if (bps === undefined) return "—";
  return (bps / 10_000).toFixed(2) + "×";
}
function since(ts?: bigint) {
  if (!ts) return "—";
  const ms = Number(ts) * 1000;
  if (ms <= 0) return "—";
  const d = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  return d < 1 ? "<1 day" : `${d} days`;
}

export default function PotPage() {
  const { address, chainId, isConnected } = useAccount();

  /** Reads */
  const { data: info } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "holderInfo",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && !!POT_ADDRESS },
  });

  const { data: claimable } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "claimable",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && !!POT_ADDRESS },
  });

  const { data: tier } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "getHolderTier",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address && !!POT_ADDRESS },
  });

  const { data: week } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "currentWeek",
  });

  const { data: baseRate } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "baseRateBps",
  });

  const { data: halving } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "halvingIntervalWeeks",
  });

  /** Write: claim */
  const { writeContract, data: txHash, isPending: isClaiming } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const canClaim = useMemo(() => {
    if (!isConnected || !address || !claimable) return false;
    const [, amount] = claimable as readonly [bigint, bigint];
    return amount > 0n && chainId === base.id;
  }, [isConnected, address, claimable, chainId]);

  const onClaim = () => {
    if (!POT_ADDRESS) return;
    writeContract({
      address: POT_ADDRESS,
      abi: POT_ABI,
      functionName: "claim",
      chainId: base.id,
    });
  };

  // Unpack info for display
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
  ] = (info ?? []) as unknown as [
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

  const [, claimableAmt] = (claimable ?? []) as unknown as [bigint, bigint];

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100">
      {/* Use site Nav (now includes the /pot link for your admin wallet) */}
      <Nav />

      {/* Top bar with back + contract snippet */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-zinc-300 hover:text-[#d6c289] transition">
            ← Back
          </Link>
          <div className="text-xs md:text-sm text-zinc-500">
            {POT_ADDRESS ? (
              <>
                Contract:{" "}
                <span className="text-[#BBA46A] font-medium">
                  {POT_ADDRESS.slice(0, 6)}…{POT_ADDRESS.slice(-4)}
                </span>
              </>
            ) : (
              "Set NEXT_PUBLIC_POT_ADDRESS"
            )}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-[340px,1fr]">
          {/* Left: Logo & blurb */}
          <div className="space-y-6">
            {/* Use pot-dark background-matched image if available */}
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6 flex items-center justify-center">
              {/* Prefer /pot-dark.png; fallback is /pot.PNG */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pot.PNG"
                alt="Proof of Time"
                width={260}
                height={260}
                className="rounded-lg"
              />
            </div>

            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <h2 className="text-lg font-semibold text-[#BBA46A]">Proof of Time (PøT)</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Rewards are minted at genesis and deposited into this contract as a finite reserve.
                Each outgoing transfer resets your streak; week 1 yields no rewards; the longer you
                hold, the higher your multiplier tier. Claims draw from the reserve only.
              </p>
              <ul className="mt-3 text-sm text-zinc-400 list-disc pl-5 space-y-1">
                <li>
                  <span className="text-[#BBA46A] font-medium">Fixed supply:</span> 1,000,000,000
                  {" "}PØT (18 decimals)
                </li>
                <li>
                  <span className="text-[#BBA46A] font-medium">Week-2+ rewards</span>, streak resets
                  on outgoing transfers
                </li>
                <li>
                  Baseline balance blocks{" "}
                  <span className="text-[#BBA46A]">top-up exploit</span> before claiming
                </li>
                <li>
                  Optional <span className="text-[#BBA46A]">global halving</span> every N weeks
                </li>
              </ul>
            </div>
          </div>

          {/* Right side: Info first, then live panel */}
          <div className="space-y-6">
            {/* --- How rewards work (moved above) --- */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <h3 className="text-lg font-semibold text-[#BBA46A]">How rewards work</h3>
              <ol className="mt-3 text-sm text-zinc-400 list-decimal pl-5 space-y-2">
                <li>
                  Hold PØT without sending it out; your streak counts in{" "}
                  <span className="text-[#BBA46A]">whole weeks</span>.
                </li>
                <li>
                  Week 1 yields no rewards; from <span className="text-[#BBA46A]">Week 2</span>{" "}
                  onward you start accruing.
                </li>
                <li>
                  Rewards = <span className="text-[#BBA46A]">min(currentBalance, baseline)</span>{" "}
                  × baseRate × multiplier × eligibleWeeks.
                </li>
                <li>
                  Any outgoing transfer <span className="text-[#BBA46A]">resets</span> your streak
                  and frozen baseline.
                </li>
                <li>
                  Click <strong className="text-[#BBA46A]">Claim</strong> to receive rewards from
                  the contract reserve.
                </li>
              </ol>
            </div>

            {/* --- Live panel --- */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Your Time Panel</h3>
                <span className="text-xs text-zinc-500">Chain: Base</span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Stat label="Completed weeks" value={completedWeeks?.toString() ?? "—"} />
                <Stat label="Current week" value={week?.toString() ?? "—"} />
                <Stat label="Claimable weeks" value={claimableWeeks?.toString() ?? "—"} />
                <Stat label="Claimable amount" value={`${fmt18(claimableAmt)} PØT`} />
                <Stat label="Tier multiplier" value={bpsToX(Number(currentMultBps))} />
                <Stat label="Eff. base rate" value={`${Number(effectiveBaseRateBps ?? 0n)} bps`} />
                <Stat label="Baseline balance" value={`${fmt18(baselineBalance)} PØT`} />
                <Stat label="Reserve (contract)" value={`${fmt18(reserveBalance)} PØT`} />
                <Stat label="Streak since" value={since(streakStart)} />
                <Stat label="Last claimed week" value={lastClaimedWeek?.toString() ?? "—"} />
                <Stat label="Base rate (bps)" value={`${Number(baseRate ?? 0n)}`} />
                <Stat label="Halving interval" value={`${Number(halving ?? 0n)} weeks`} />
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={onClaim}
                  disabled={!canClaim || isClaiming || isConfirming}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    canClaim && !isClaiming && !isConfirming
                      ? "bg-[#BBA46A] text-[#0b0e14] hover:bg-[#d6c289]"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  {isClaiming ? "Submitting…" : isConfirming ? "Confirming…" : "Claim"}
                </button>
                {!isConnected && (
                  <span className="text-xs text-zinc-500">Connect wallet to claim</span>
                )}
                {chainId !== base.id && isConnected && (
                  <span className="text-xs text-zinc-500">Switch to Base</span>
                )}
                {isConfirmed && (
                  <span className="text-xs text-emerald-400">Claim successful ✔</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-zinc-200">
        <span className="text-[#BBA46A]">{value}</span>
      </div>
    </div>
  );
}
