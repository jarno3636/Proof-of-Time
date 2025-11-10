// app/pot/page.tsx
"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseAbi } from "viem";
import { base } from "viem/chains";

/** ---------- UI islands ---------- */
const BuyButton = dynamic(() => import("@/components/BuyButton"), { ssr: false });
const PriceChip = dynamic(() => import("@/components/PriceChip"), { ssr: false });

/** ========= Helpers ========= */
type Addr = `0x${string}`;
const asAddr = (v?: string): Addr | undefined => {
  const s = (v ?? "").trim().replace(/\s+/g, "").replace(/['"`]/g, "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return undefined;
  return s.toLowerCase() as Addr;
};
const READ_BASE = { chainId: base.id };

/** ========= Config ========= */
const POT_ADDRESS = asAddr(process.env.NEXT_PUBLIC_POT_ADDRESS);
// GeckoTerminal pool for PØT/WETH on Base (from your link)
const GECKO_POOL_ID = "base/0x89a77adf4e04d3af3db8794870aabb63c556c9fa";

/** ========= Minimal ABI ========= */
const POT_ABI = parseAbi([
  "function holderInfo(address holder) view returns (uint256 streakStart,uint256 completedWeeks,uint256 lastClaimedWeek,uint256 claimableWeeks,uint256 claimableAmount,uint16 currentMultBps,uint256 effectiveBaseRateBps,uint256 reserveBalance,uint256 baselineBalance)",
  "function claimable(address holder) view returns (uint256 weeks_, uint256 amount_)",
  "function getHolderTier(address holder) view returns (uint256 idx, uint16 minWeeks, uint16 bps)",
  "function currentWeek() view returns (uint256)",
  "function baseRateBps() view returns (uint256)",
  "function halvingIntervalWeeks() view returns (uint256)",
  "function claim()",
] as const);

/** ========= UI helpers ========= */
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

export default function PotPage() {
  const { address, chainId, isConnected } = useAccount();

  /** Reads (force Base chain) */
  const { data: info } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "holderInfo",
    args: [address as Addr],
    query: { enabled: !!address && !!POT_ADDRESS, refetchInterval: 20_000 },
    ...READ_BASE,
  });

  const { data: claimable } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "claimable",
    args: [address as Addr],
    query: { enabled: !!address && !!POT_ADDRESS, refetchInterval: 20_000 },
    ...READ_BASE,
  });

  const { data: tier } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "getHolderTier",
    args: [address as Addr],
    query: { enabled: !!address && !!POT_ADDRESS, refetchInterval: 60_000 },
    ...READ_BASE,
  });

  const { data: week } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "currentWeek",
    query: { refetchInterval: 60_000, enabled: !!POT_ADDRESS },
    ...READ_BASE,
  });

  const { data: baseRate } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "baseRateBps",
    query: { enabled: !!POT_ADDRESS },
    ...READ_BASE,
  });

  const { data: halving } = useReadContract({
    address: POT_ADDRESS,
    abi: POT_ABI,
    functionName: "halvingIntervalWeeks",
    query: { enabled: !!POT_ADDRESS },
    ...READ_BASE,
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
  ] =
    (info ??
      [
        0n, 0n, 0n, 0n, 0n, 0, 0n, 0n, 0n,
      ]) as unknown as [bigint, bigint, bigint, bigint, bigint, number, bigint, bigint, bigint];

  const [, claimableAmt] = (claimable ?? [0n, 0n]) as unknown as [bigint, bigint];

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100">
      <Nav />

      {/* Top bar */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-zinc-300 hover:text-[#d6c289] transition">← Back</Link>
          <div className="flex items-center gap-3">
            {/* Live price chip (fails safe) */}
            <PriceChip poolId={GECKO_POOL_ID} />
            <div className="text-xs md:text-sm text-zinc-500">
              {POT_ADDRESS ? (
                <>Contract: <span className="text-[#BBA46A] font-medium">{POT_ADDRESS.slice(0, 6)}…{POT_ADDRESS.slice(-4)}</span></>
              ) : (
                "Set NEXT_PUBLIC_POT_ADDRESS"
              )}
            </div>
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

              {/* Buy button on token page */}
              <div className="mt-5">
                <BuyButton />
              </div>
            </div>
          </div>

          {/* Right side: Live panel */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <h3 className="text-lg font-semibold text-[#BBA46A]">Your Time Panel</h3>

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

      <Footer />
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
