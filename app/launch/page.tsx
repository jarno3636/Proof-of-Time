// app/launch/page.tsx
"use client";

import Nav from "@/components/Nav";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, formatUnits, parseAbi, parseEther } from "viem";
import { base } from "viem/chains";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import LaunchShare from "@/components/LaunchShare";

/** ========= Config (from env) =========
 * viem complains if a mixed-case address doesn't match checksum.
 * Lowercasing avoids that requirement and is accepted by viem.
 */
const PRESALE_ADDRESS = ((process.env.NEXT_PUBLIC_PRESALE_ADDRESS || "").trim().toLowerCase() || "") as `0x${string}`;
const TOKEN_ADDRESS   = ((process.env.NEXT_PUBLIC_TOKEN_ADDRESS   || "").trim().toLowerCase() || "") as `0x${string}`;
const POT_LINK        = process.env.NEXT_PUBLIC_POT_LINK || "/pot";

const LIQ_ADDRESS     = ((process.env.NEXT_PUBLIC_LIQ_ADDRESS           || "").trim().toLowerCase() || "") as `0x${string}`;
const TEAMLOCK_ADDR   = ((process.env.NEXT_PUBLIC_TEAM_LOCK_ADDRESS     || "").trim().toLowerCase() || "") as `0x${string}`;
const CLAIM_ADDR      = ((process.env.NEXT_PUBLIC_CLAIM_LOCK_ADDRESS    || "").trim().toLowerCase() || "") as `0x${string}`;

const LP_LOCK_UNIX_ENV   = Number(process.env.NEXT_PUBLIC_LP_LOCK_UNIX || 0);
const TEAM_LOCK_UNIX_ENV = Number(process.env.NEXT_PUBLIC_TEAM_LOCK_UNIX || 0);
const CLAIM_UNLOCK_UNIX  = Number(process.env.NEXT_PUBLIC_CLAIM_UNLOCK_UNIX || 0);

/** ========= ABIs ========= */
const PRESALE_ABI = parseAbi([
  "function priceTokensPerEth() view returns (uint256)",
  "function startAt() view returns (uint256)",
  "function endAt() view returns (uint256)",
  "function minPerWalletWei() view returns (uint256)",
  "function maxPerWalletWei() view returns (uint256)",
  "function hardCapWei() view returns (uint256)",
  "function saleSupply() view returns (uint256)",
  "function totalRaisedWei() view returns (uint256)",
  "function totalSoldTokens() view returns (uint256)",
  "function live() view returns (bool)",
  "function finalized() view returns (bool)",
  "function claim() view returns (address)",
  "function buy() payable",
] as const);

const LIQ_ABI      = parseAbi([ "function lpLockedUntil() view returns (uint256)" ] as const);
const TEAMLOCK_ABI = parseAbi([ "function releaseAt() view returns (uint256)" ] as const);
const CLAIM_ABI_A  = parseAbi([ "function releaseAt() view returns (uint256)" ] as const);
const CLAIM_ABI_B  = parseAbi([ "function unlockAt() view returns (uint256)" ] as const);

const CLAIMLOCK_ABI = parseAbi([
  "function claim()",
  "function claimable(address) view returns (uint256)",
  "function unlockAt() view returns (uint256)",
] as const);

/** ========= Links (from envs) ========= */
const LINKS = {
  token:   TOKEN_ADDRESS   ? `https://basescan.org/address/${TOKEN_ADDRESS}`     : "",
  presale: PRESALE_ADDRESS ? `https://basescan.org/address/${PRESALE_ADDRESS}`   : "",
  liq:     LIQ_ADDRESS     ? `https://basescan.org/address/${LIQ_ADDRESS}`       : "",
  timelock:TEAMLOCK_ADDR   ? `https://basescan.org/address/${TEAMLOCK_ADDR}`     : "",
  claim:   CLAIM_ADDR      ? `https://basescan.org/address/${CLAIM_ADDR}`        : "",
  potPage: POT_LINK || "/pot",
};

/** ========= Helpers ========= */
// Always read from Base regardless of wallet chain
const READ_BASE: { chainId: number } = { chainId: base.id };

const fmt18 = (n?: bigint, digits = 4) =>
  n !== undefined ? Number(formatUnits(n, 18)).toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
function ts(unix?: bigint | number) {
  const u = typeof unix === "bigint" ? Number(unix) : unix;
  if (!u) return "—";
  return new Date(u * 1000).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true,
  }) + ` (${tz})`;
}
function rel(unix?: bigint | number) {
  const u = typeof unix === "bigint" ? Number(unix) : unix;
  if (!u) return "";
  const d = Math.round((u * 1000 - Date.now()) / 86_400_000);
  if (d > 0) return `in ${d} day${d === 1 ? "" : "s"}`;
  if (d === 0) return "today";
  return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago`;
}

/** Palette tuned for contrast on dark */
const PIE_COLORS = ["#F1E1A6", "#A3925D", "#6B6242", "#2B2A25"];

export default function LaunchPage() {
  const { address, isConnected, chainId } = useAccount();
  const [ethAmount, setEthAmount] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());
  const [lastTx, setLastTx] = useState<"buy" | "claim" | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  /** Reads — Presale (force Base chain) */
  const { data: price }      = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "priceTokensPerEth", query: { enabled: !!PRESALE_ADDRESS }, ...READ_BASE });
  const { data: startAt }    = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "startAt",           query: { enabled: !!PRESALE_ADDRESS }, ...READ_BASE });
  const { data: endAt }      = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "endAt",             query: { enabled: !!PRESALE_ADDRESS }, ...READ_BASE });
  const { data: minWei }     = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "minPerWalletWei",   query: { enabled: !!PRESALE_ADDRESS }, ...READ_BASE });
  const { data: maxWei }     = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "maxPerWalletWei",   query: { enabled: !!PRESALE_ADDRESS }, ...READ_BASE });
  const { data: hardCap }    = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "hardCapWei",        query: { enabled: !!PRESALE_ADDRESS }, ...READ_BASE });
  const { data: saleSupply } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "saleSupply",        query: { enabled: !!PRESALE_ADDRESS }, ...READ_BASE });
  const { data: raised }     = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "totalRaisedWei",    query: { enabled: !!PRESALE_ADDRESS, refetchInterval: 5000 }, ...READ_BASE });
  const { data: sold }       = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "totalSoldTokens",   query: { enabled: !!PRESALE_ADDRESS, refetchInterval: 5000 }, ...READ_BASE });
  const { data: isLive }     = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "live",              query: { enabled: !!PRESALE_ADDRESS, refetchInterval: 5000 }, ...READ_BASE });
  const { data: finalized }  = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "finalized",         query: { enabled: !!PRESALE_ADDRESS, refetchInterval: 5000 }, ...READ_BASE });
  const { data: claimFromPresale } =
    useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "claim", query: { enabled: !!PRESALE_ADDRESS }, ...READ_BASE });

  /** Reads — Locks (prefer envs; force Base chain) */
  const { data: lpOnChain } =
    useReadContract({ address: LIQ_ADDRESS, abi: LIQ_ABI, functionName: "lpLockedUntil", query: { enabled: !!LIQ_ADDRESS && !LP_LOCK_UNIX_ENV }, ...READ_BASE });
  const { data: teamOnChain } =
    useReadContract({ address: TEAMLOCK_ADDR, abi: TEAMLOCK_ABI, functionName: "releaseAt", query: { enabled: !!TEAMLOCK_ADDR && !TEAM_LOCK_UNIX_ENV }, ...READ_BASE });
  const { data: claimA } =
    useReadContract({ address: CLAIM_ADDR, abi: CLAIM_ABI_A, functionName: "releaseAt", query: { enabled: !!CLAIM_ADDR && !CLAIM_UNLOCK_UNIX }, ...READ_BASE });
  const { data: claimB } =
    useReadContract({ address: CLAIM_ADDR, abi: CLAIM_ABI_B, functionName: "unlockAt",  query: { enabled: !!CLAIM_ADDR && !CLAIM_UNLOCK_UNIX }, ...READ_BASE });

  const lpUntil     = (LP_LOCK_UNIX_ENV || Number(lpOnChain || 0)) || undefined;
  const teamUntil   = (TEAM_LOCK_UNIX_ENV || Number(teamOnChain || 0)) || undefined;
  const claimUnlock = (CLAIM_UNLOCK_UNIX || Number(claimA || 0) || Number(claimB || 0)) || undefined;

  /** Claim contract resolve */
  const claimAddr = (claimFromPresale as `0x${string}` | undefined) || (CLAIM_ADDR || undefined);

  /** Claim lock reads (force Base chain) */
  const { data: unlockAt, refetch: refetchUnlockAt } = useReadContract({
    address: claimAddr,
    abi: CLAIMLOCK_ABI,
    functionName: "unlockAt",
    query: { enabled: !!claimAddr, refetchInterval: 30_000 },
    ...READ_BASE,
  });

  const { data: userClaimable, refetch: refetchClaimable } = useReadContract({
    address: claimAddr,
    abi: CLAIMLOCK_ABI,
    functionName: "claimable",
    args: [address as `0x${string}`],
    query: { enabled: !!claimAddr && !!address, refetchInterval: 30_000 },
    ...READ_BASE,
  });

  /** Wallet + writes */
  const { data: bal } = useBalance({ address, chainId: base.id });
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (confirmed && lastTx === "claim") {
      refetchClaimable?.();
      refetchUnlockAt?.();
      setLastTx(null);
    }
  }, [confirmed, lastTx, refetchClaimable, refetchUnlockAt]);

  /** Buy gating */
  const canBuy = useMemo(() => {
    if (!PRESALE_ADDRESS) return false;
    if (!isConnected || chainId !== base.id) return false;
    const v = Number(ethAmount || 0);
    const min = Number(minWei ? formatEther(minWei as bigint) : 0);
    const max = Number(maxWei ? formatEther(maxWei as bigint) : 0);
    if (!isLive) return false;
    if (!v || v <= 0) return false;
    if (min && v < min) return false;
    if (max && v > max) return false;
    if (bal && v > Number(bal.formatted)) return false;
    return true;
  }, [PRESALE_ADDRESS, isConnected, chainId, ethAmount, minWei, maxWei, bal, isLive]);

  const onBuy = () => {
    if (!PRESALE_ADDRESS || !ethAmount) return;
    setLastTx("buy");
    writeContract({
      address: PRESALE_ADDRESS,
      abi: PRESALE_ABI,
      functionName: "buy",
      value: parseEther(ethAmount),
      chainId: base.id,
    });
  };

  /** Claim gating */
  const unlockMs = Number(unlockAt || 0) * 1000;
  const isUnlocked = !!unlockMs && now >= unlockMs;
  const claimableNum = Number(userClaimable ?? 0);

  const canClaim = Boolean(
    isConnected &&
      chainId === base.id &&
      claimAddr &&
      finalized &&
      isUnlocked &&
      claimableNum > 0 &&
      !isPending &&
      !confirming
  );

  const onClaim = () => {
    if (!claimAddr) return;
    setLastTx("claim");
    writeContract({
      address: claimAddr,
      abi: CLAIMLOCK_ABI,
      functionName: "claim",
      chainId: base.id,
    });
  };

  /** Distribution (static copy) */
  const distData = [
    { name: "Presale (60%)", value: 300_000_000 },
    { name: "LP & Treasury (37.5%)", value: 187_500_000 },
    { name: "Team (2.5%)", value: 12_500_000 },
    { name: "Holder Rewards (500M)", value: 500_000_000 },
  ];

  const progress = useMemo(() => {
    const r = Number(raised ? formatEther(raised as bigint) : 0);
    const h = Number(hardCap ? formatEther(hardCap as bigint) : 0);
    return { r, h, pct: h > 0 ? Math.min(100, (r / h) * 100) : 0 };
  }, [raised, hardCap]);

  /** Sale status text */
  const startMs = Number(startAt || 0) * 1000;
  const endMs   = Number(endAt   || 0) * 1000;

  let saleStatus: string;
  if (!startMs || !endMs) {
    saleStatus = "Sale schedule pending";
  } else if (now < startMs) {
    saleStatus = `Opens ${ts(Number(startAt || 0))} (${rel(Number(startAt || 0))})`;
  } else if (now >= startMs && now <= endMs) {
    saleStatus = (isLive ? "Presale live" : "Presale window active");
  } else {
    saleStatus = finalized ? "Presale closed · Finalized" : "Presale closed";
  }

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100">
      <Nav />

      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 md:py-10">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center rounded-full bg-zinc-900/50 px-3 py-1 text-xs text-zinc-300 ring-1 ring-zinc-800/70">
            {saleStatus}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10 justify-items-center lg:justify-items-stretch">
          {/* Left column */}
          <div className="w-full max-w-[640px]">
            {/* Buy card */}
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6 md:p-7">
              <h1 className="text-center md:text-left text-3xl font-semibold tracking-wide">
                Launch <span className="text-[#BBA46A]">Your Token</span>
              </h1>

              <p className="mt-2 text-sm text-zinc-400 text-center md:text-left">
                Fixed-price presale on <span className="text-[#BBA46A]">Base</span>. Unsold tokens seed liquidity on Aerodrome.
                Team allocation locked. Holder rewards via a separate <span className="text-[#BBA46A]">500M tiered program</span>.
              </p>

              {/* Buy */}
              <div className="mt-5 space-y-3">
                <label className="text-xs text-zinc-400">Amount (ETH)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="0.01"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    className="w-full rounded-xl bg-[#0f131b] border border-zinc-800/70 px-4 py-2.5 text-sm outline-none focus:border-[#BBA46A]"
                  />
                  <button
                    onClick={onBuy}
                    disabled={!canBuy || isPending || confirming}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      canBuy && !isPending && !confirming
                        ? "bg-[#BBA46A] text-[#0b0e14] hover:bg-[#d6c289]"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    }`}
                  >
                    {isPending && lastTx === "buy" ? "Submitting…" : confirming && lastTx === "buy" ? "Confirming…" : "Buy"}
                  </button>
                </div>
                {isConnected && chainId !== base.id && (
                  <div className="text-xs text-red-400">Switch to Base to continue.</div>
                )}
                <div className="text-xs text-zinc-500">Wallet balance: {bal?.formatted ?? "—"} ETH</div>
              </div>

              {/* Progress */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-zinc-400 uppercase tracking-wide">
                  <span>Raised</span>
                  <span>
                    {progress.r.toLocaleString()} / {progress.h.toLocaleString()} ETH ({progress.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-800/60 overflow-hidden">
                  <div className="h-full bg-[#BBA46A]" style={{ width: `${progress.pct}%` }} />
                </div>
              </div>

              {/* Share */}
              <div className="mt-6">
                <LaunchShare />
              </div>
            </div>

            {/* Pie */}
            <div className="mt-6 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6 md:p-7">
              <h3 className="text-lg font-semibold text-[#BBA46A] tracking-wide text-center md:text-left">Token Distribution</h3>
              <div className="mt-4 h-64 md:h-80 overflow-visible">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      dataKey="value"
                      data={distData}
                      cx="50%"
                      cy="46%"
                      outerRadius={98}
                      innerRadius={54}
                      labelLine={false}
                      paddingAngle={1.2}
                      isAnimationActive
                    >
                      {distData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#00000055" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0f1116",
                        border: "1px solid #2a2f3a",
                        borderRadius: 12,
                        color: "#e5e7eb",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="square"
                      wrapperStyle={{ color: "#e5e7eb", fontSize: 12, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-4 text-[11px] sm:text-xs leading-relaxed text-zinc-400 text-center md:text-left">
                * An additional <span className="text-[#BBA46A] font-medium">500,000,000</span> tokens are reserved in the token contract
                and released to holders in <span className="text-[#BBA46A]">tiered schedules</span>. See{" "}
                <Link href={POT_LINK} className="underline text-[#BBA46A] hover:text-[#d6c289]">
                  Holder Rewards (PoT)
                </Link>.
              </p>
            </div>
          </div>

          {/* Right column */}
          <div className="w-full max-w-[640px]">
            {/* Claim card */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 md:p-7">
              <h3 className="text-lg font-semibold text-[#BBA46A] tracking-wide">Claim Tokens</h3>

              {!claimAddr ? (
                <p className="mt-2 text-sm text-zinc-400">Claim contract not set yet.</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-zinc-400">
                    {finalized ? (
                      isUnlocked ? (
                        <>Your claimable: <span className="text-[#BBA46A] font-medium">{fmt18(userClaimable as bigint, 0)}</span> tokens</>
                      ) : (
                        <>Unlocks at <span className="text-[#BBA46A]">{ts(unlockAt as bigint)}</span> ({rel(Number(unlockAt))})</>
                      )
                    ) : (
                      <>Claims open after presale is finalized.</>
                    )}
                  </p>

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={onClaim}
                      disabled={!canClaim}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        canClaim
                          ? "bg-[#BBA46A] text-[#0b0e14] hover:bg-[#d6c289]"
                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      }`}
                    >
                      {isPending && lastTx === "claim" ? "Submitting…" : confirming && lastTx === "claim" ? "Confirming…" : "Claim"}
                    </button>

                    {claimAddr && (
                      <a
                        href={`https://basescan.org/address/${claimAddr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-2 text-sm font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                      >
                        View Claim Contract ↗
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Sale info */}
            <div className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 md:p-7">
              <h3 className="text-lg font-semibold text-[#BBA46A] tracking-wide">Sale Information</h3>
              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800/60">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-zinc-800/60">
                    <Row k="Price"           v={`${price ? fmt18(price as bigint, 0) : "…"} tokens / ETH`} />
                    <Row k="Sale allocation" v={`${fmt18(saleSupply as bigint, 0)} tokens`} />
                    <Row k="Min per wallet"  v={`${minWei ? Number(formatEther(minWei as bigint)) : "—"} ETH`} />
                    <Row k="Max per wallet"  v={`${maxWei ? Number(formatEther(maxWei as bigint)) : "—"} ETH`} />
                    <Row k="Hard cap"        v={`${hardCap ? Number(formatEther(hardCap as bigint)) : "—"} ETH`} />
                    <Row k="Tokens sold"     v={`${fmt18(sold as bigint, 0)}`} />
                    <Row k="Sale window"     v={`${ts(startAt as bigint)}  →  ${ts(endAt as bigint)}`} />
                    <Row k="Status"          v={saleStatus} />
                    <Row k="Chain"           v="Base (8453)" />
                    {(LP_LOCK_UNIX_ENV || lpOnChain)     && <Row k="LP lock until"   v={`${ts(lpUntil!)}  ·  ${rel(lpUntil!)}`} />}
                    {(TEAM_LOCK_UNIX_ENV || teamOnChain) && <Row k="Team lock until" v={`${ts(teamUntil!)}  ·  ${rel(teamUntil!)}`} />}
                    {(CLAIM_UNLOCK_UNIX || claimA || claimB || unlockAt) &&
                      <Row k="Claim unlocks" v={`${ts((unlockAt as bigint) || claimUnlock!)}  ·  ${rel(Number((unlockAt as bigint) || claimUnlock!))}`} />}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {LINKS.presale && (
                  <a
                    href={LINKS.presale}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                  >
                    View Presale ↗
                  </a>
                )}
                {LINKS.token && (
                  <a
                    href={LINKS.token}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                  >
                    View Token ↗
                  </a>
                )}
                <Link
                  href={LINKS.potPage}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                >
                  Holder Rewards (PoT) ↗
                </Link>
              </div>
            </div>

            {/* Contracts & Links */}
            <div className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 md:p-7">
              <h3 className="text-lg font-semibold text-[#BBA46A] tracking-wide">Contracts & Links</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {LINKS.token    && <A href={LINKS.token}    label="PoT Token" />}
                {LINKS.presale  && <A href={LINKS.presale}  label="Presale Fixed" />}
                {LINKS.liq      && <A href={LINKS.liq}      label="Liquidity Manager" />}
                {LINKS.timelock && <A href={LINKS.timelock} label="Simple Token Timelock" />}
                {LINKS.claim    && <A href={LINKS.claim}    label="TimeLockClaim" />}
                <Link
                  href={LINKS.potPage}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-2 font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                >
                  Holder Rewards Page ↗
                </Link>
              </div>
              <p className="mt-3 text-xs text-zinc-500">All links open in a new tab when applicable.</p>
            </div>

            {/* Disclaimer */}
            <div className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 md:p-7">
              <h3 className="text-lg font-semibold text-[#BBA46A] tracking-wide">Disclaimer</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                This page provides access to a token presale smart contract deployed on Base. Tokens have no promise of returns,
                dividends, or voting rights. Participation may be restricted in certain jurisdictions. Do your own research.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800/60 bg-zinc-900/20">
        <div className="mx-auto w-full max-w-6xl px-6 py-6 flex items-center justify-center">
          <div className="text-xs text-zinc-500">© {new Date().getFullYear()} Proof of Time</div>
        </div>
      </footer>
    </main>
  );
}

function A({ href, label }: { href: string; label: string }) {
  if (!href) return null;
  const isExternal = href.startsWith("http");
  const classes =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-2 font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition";
  return isExternal ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {label} ↗
    </a>
  ) : (
    <Link href={href} className={classes}>
      {label} ↗
    </Link>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="bg-[#0f131b] hover:bg-[#121722] transition-colors">
      <td className="w-48 px-4 py-3 text-zinc-400">{k}</td>
      <td className="px-4 py-3 font-medium text-zinc-200">
        <span className="text-[#BBA46A]">{v}</span>
      </td>
    </tr>
  );
}
