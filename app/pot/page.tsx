"use client";

import Nav from "@/components/Nav";
import Link from "next/link";
import { useEffect, useMemo } from "react";
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

/** ========= Minimal ABI (matches your contract) ========= */
const POT_ABI = parseAbi([
  // reads
  "function holderInfo(address holder) view returns (uint256 streakStart_,uint256 completedWeeks_,uint256 lastClaimedWeek_,uint256 claimableWeeks_,uint256 claimableAmount_,uint16 currentMultBps_,uint256 effectiveBaseRateBps_,uint256 reserveBalance_,uint256 baselineBalance_)",
  "function claimable(address holder) view returns (uint256 weeks_, uint256 amount_)",
  "function getHolderTier(address holder) view returns (uint256 idx, uint16 minWeeks, uint16 bps)",
  "function currentWeek() view returns (uint256)",
  "function baseRateBps() view returns (uint256)",
  "function halvingIntervalWeeks() view returns (uint256)",
  // write
  "function claim()",
] as const);

/** ========= Helpers ========= */
const readBase = { chainId: base.id as const };
const q = { retry: 0, refetchOnWindowFocus: false } as const;

function fmt18(n?: bigint, digits = 4) {
  if (n === undefined) return "—";
  const v = Number.parseFloat(formatUnits(n, 18));
  return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
}
function bpsToX(bps?: number) {
  if (!Number.isFinite(bps as number)) return "—";
  return (Number(bps) / 10_000).toFixed(2) + "×";
}
function since(ts?: bigint) {
  if (!ts) return "—";
  const ms = Number(ts) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  return d < 1 ? "<1 day" : `${d} days`;
}
function Debug({ label, error, status }: { label: string; error?: unknown; status?: string }) {
  if (!error) return null;
  const msg = typeof error === "object" && error && "message" in (error as any)
    ? (error as any).message
    : String(error);
  return (
    <div className="mt-3 rounded-lg border border-red-900/50 bg-red-900/10 p-2 text-xs text-red-300">
      <div className="font-semibold">{label} failed ({status})</div>
      <div className="mt-1 break-words">{msg}</div>
    </div>
  );
}

export default function PotPage() {
  const { address, chainId, isConnected } = useAccount();

  /** Reads (forced Base) */
  const { data: info, error: eInfo, status: sInfo } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "holderInfo",
    args: [address as `0x${string}`],
    ...readBase,
    query: { ...q, enabled: !!address && !!POT_ADDRESS, refetchInterval: 20_000 },
  });

  const { data: claimable, error: eClaimable, status: sClaimable } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "claimable",
    args: [address as `0x${string}`],
    ...readBase,
    query: { ...q, enabled: !!address && !!POT_ADDRESS, refetchInterval: 20_000 },
  });

  const { data: tier, error: eTier, status: sTier } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "getHolderTier",
    args: [address as `0x${string}`],
    ...readBase,
    query: { ...q, enabled: !!address && !!POT_ADDRESS, refetchInterval: 60_000 },
  });

  const { data: week, error: eWeek, status: sWeek } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "currentWeek",
    ...readBase,
    query: { ...q, refetchInterval: 60_000 },
  });

  const { data: baseRate, error: eBase, status: sBase } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "baseRateBps",
    ...readBase,
    query: q,
  });

  const { data: halving, error: eHalving, status: sHalving } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "halvingIntervalWeeks",
    ...readBase,
    query: q,
  });

  /** Write: claim */
  const { writeContract, data: txHash, isPending: isClaiming } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const canClaim = useMemo(() => {
    if (!isConnected || !address || !claimable) return false;
    const [, amount] = claimable as readonly [bigint, bigint];
    return amount > 0n && chainId === base.id;
  }, [isConnected, address, claimable, chainId]);

  const onClaim = () => {
    if (!POT_ADDRESS) return;
    writeContract({ address: POT_ADDRESS, abi: POT_ABI, functionName: "claim", chainId: base.id });
  };

  // Unpack info for display (safe defaults)
  const [
    streakStart,
    completedWeeks,
    lastClaimedWeek,
    claimableWeeks,
    _claimableAmount,
    currentMultBps,
    effectiveBaseRateBps,
    reserveBalance,
    baselineBalance,
  ] =
    (info ??
      [0n, 0n, 0n, 0n, 0n, 0, 0n, 0n, 0n]) as unknown as [
      bigint, bigint, bigint, bigint, bigint, number, bigint, bigint, bigint
    ];

  const [, claimableAmt] = (claimable ?? [0n, 0n]) as unknown as [bigint, bigint];

  useEffect(() => {
    const firstErr = eInfo || eClaimable || eTier || eWeek || eBase || eHalving;
    if (firstErr) console.error("[pot reads error]", firstErr);
  }, [eInfo, eClaimable, eTier, eWeek, eBase, eHalving]);

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100">
      <Nav />

      {/* Top bar */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-zinc-300 hover:text-[#d6c289] transition">← Back</Link>
          <div className="text-xs md:text-sm text-zinc-500">
            {POT_ADDRESS ? (
              <>Contract: <span className="text-[#BBA46A] font-medium">{POT_ADDRESS.slice(0, 6)}…{POT_ADDRESS.slice(-4)}</span></>
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
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pot.PNG" alt="Proof of Time" width={260} height={260} className="rounded-lg" />
            </div>

            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <h2 className="text-lg font-semibold text-[#BBA46A]">Proof of Time (PøT)</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Rewards are minted at genesis and deposited into this contract as a finite reserve.
                Each outgoing transfer resets your streak; week 1 yields no rewards; the longer you
                hold, the higher your multiplier tier. Claims draw from the reserve only.
              </p>
              <ul className="mt-3 text-sm text-zinc-400 list-disc pl-5 space-y-1">
                <li><span className="text-[#BBA46A] font-medium">Fixed supply:</span> 1,000,000,000 PØT (18 decimals)</li>
                <li><span className="text-[#BBA46A] font-medium">Week-2+ rewards</span>, streak resets on outgoing transfers</li>
                <li>Rewards use <span className="text-[#BBA46A]">min(currentBalance, baseline)</span> to block top-ups</li>
                <li>Optional global halving every N weeks</li>
                <li><span className="text-[#BBA46A] font-medium">Minimum hold:</span> 500 PØT required to earn rewards</li>
              </ul>

              {/* Debug block for this page */}
              <Debug label="holderInfo" error={eInfo} status={sInfo} />
              <Debug label="claimable" error={eClaimable} status={sClaimable} />
              <Debug label="getHolderTier" error={eTier} status={sTier} />
              <Debug label="currentWeek" error={eWeek} status={sWeek} />
              <Debug label="baseRateBps" error={eBase} status={sBase} />
              <Debug label="halvingIntervalWeeks" error={eHalving} status={sHalving} />
            </div>
          </div>

          {/* Right side */}
          <div className="space-y-6">
            {/* How rewards work */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <h3 className="text-lg font-semibold text-[#BBA46A]">How rewards work</h3>
              <ol className="mt-3 text-sm text-zinc-400 list-decimal pl-5 space-y-2">
                <li>Hold PØT without sending it out; your streak counts in whole weeks.</li>
                <li>Week 1 yields no rewards; from <span className="text-[#BBA46A]">Week 2</span> onward you accrue.</li>
                <li>Rewards = min(balance, baseline) × baseRate × multiplier × eligibleWeeks.</li>
                <li>Any outgoing transfer resets your streak and baseline.</li>
                <li>You must hold at least <span className="text-[#BBA46A] font-semibold">500 PØT</span>.</li>
              </ol>
            </div>

            {/* Live panel */}
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
                <Stat label="Tier multiplier" value={bpsToX(Number(tier?.[2] ?? currentMultBps))} />
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
                {!isConnected && <span className="text-xs text-zinc-500">Connect wallet to claim</span>}
                {chainId !== base.id && isConnected && <span className="text-xs text-zinc-500">Switch to Base</span>}
                {isConfirmed && <span className="text-xs text-emerald-400">Claim successful ✔</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-900/20">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-zinc-500">© {new Date().getFullYear()} Proof of Time</div>
          <div className="flex items-center gap-4">
            {POT_ADDRESS ? (
              <a
                href={`https://basescan.org/address/${POT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 text-sm font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                title="View PoT contract on BaseScan"
              >
                View Contract ↗
              </a>
            ) : (
              <span className="text-xs text-zinc-500">Set NEXT_PUBLIC_POT_ADDRESS</span>
            )}
          </div>
        </div>
      </footer>
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
