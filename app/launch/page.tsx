// app/launch/page.tsx
"use client";

import Nav from "@/components/Nav";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, formatUnits, parseAbi } from "viem";
import { base } from "viem/chains";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import Countdown from "@/components/Countdown";
import LaunchShare from "@/components/LaunchShare";

/** ========= Config ========= */
const PRESALE_ADDRESS = (process.env.NEXT_PUBLIC_PRESALE_ADDRESS || "").trim() as `0x${string}`;
const TOKEN_ADDRESS   = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS   || "").trim() as `0x${string}`;
const POT_LINK        = process.env.NEXT_PUBLIC_POT_LINK || "/pot";

// Optional: on-chain lock readers (fallbacks), but we’ll prefer envs if present.
const LIQ_ADDRESS   = (process.env.NEXT_PUBLIC_LIQ_ADDRESS || "").trim() as `0x${string}`;
const TEAMLOCK_ADDR = (process.env.NEXT_PUBLIC_TEAM_LOCK_ADDRESS || "").trim() as `0x${string}`;
const CLAIM_ADDR    = (process.env.NEXT_PUBLIC_CLAIM_LOCK_ADDRESS || "").trim() as `0x${string}`;

// If you’ve set these, we’ll show them directly:
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
  "function buy() payable",
] as const);

const LIQ_ABI = parseAbi([ "function lpLockedUntil() view returns (uint256)" ] as const);
const TEAMLOCK_ABI = parseAbi([ "function releaseAt() view returns (uint256)" ] as const);

// Some claim lock contracts use different names:
const CLAIM_ABI_RELEASE = parseAbi([ "function releaseAt() view returns (uint256)" ] as const);
const CLAIM_ABI_UNLOCK  = parseAbi([ "function unlockAt() view returns (uint256)" ] as const);

/** ========= Links ========= */
const LINKS = {
  token:   "https://basescan.org/address/0x098bbeb9e36ba67dd9ded4d1428bd384569db2ad",
  liq:     LIQ_ADDRESS ? `https://basescan.org/address/${LIQ_ADDRESS}` : "",
  presale: "https://basescan.org/address/0x63206e25648847033de7a4e4e186f2814ce7a063",
  timelock: TEAMLOCK_ADDR ? `https://basescan.org/address/${TEAMLOCK_ADDR}` : "",
  claim:    CLAIM_ADDR ? `https://basescan.org/address/${CLAIM_ADDR}` : "",
  potPage: POT_LINK || "/pot",
};

/** ========= Helpers ========= */
const fmt18 = (n?: bigint, digits = 4) =>
  n !== undefined ? Number(formatUnits(n, 18)).toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
function ts(unix?: bigint | number) {
  const u = typeof unix === "bigint" ? Number(unix) : unix;
  if (!u) return "—";
  return (
    new Date(u * 1000).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + ` (${tz})`
  );
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
const GOLD = "#BBA46A";
const PIE_COLORS = ["#F1E1A6", "#A3925D", "#6B6242", "#2B2A25"]; // lightest → darkest

export default function LaunchPage() {
  const { address, isConnected, chainId } = useAccount();
  const [ethAmount, setEthAmount] = useState<string>("");

  /** Reads — Presale */
  const { data: price }      = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "priceTokensPerEth" });
  const { data: startAt }    = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "startAt" });
  const { data: endAt }      = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "endAt" });
  const { data: minWei }     = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "minPerWalletWei" });
  const { data: maxWei }     = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "maxPerWalletWei" });
  const { data: hardCap }    = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "hardCapWei" });
  const { data: saleSupply } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "saleSupply" });
  const { data: raised }     = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "totalRaisedWei",  query: { refetchInterval: 5000 } });
  const { data: sold }       = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "totalSoldTokens", query: { refetchInterval: 5000 } });
  const { data: isLive }     = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "live",            query: { refetchInterval: 5000 } });

  /** Reads — Locks: prefer env, else try contracts if provided */
  const { data: lpUntilOnChain } =
    useReadContract({ address: LIQ_ADDRESS, abi: LIQ_ABI, functionName: "lpLockedUntil", query: { enabled: !!LIQ_ADDRESS && !LP_LOCK_UNIX_ENV } });

  const { data: teamUntilOnChain } =
    useReadContract({ address: TEAMLOCK_ADDR, abi: TEAMLOCK_ABI, functionName: "releaseAt", query: { enabled: !!TEAMLOCK_ADDR && !TEAM_LOCK_UNIX_ENV } });

  const { data: claimReleaseA } =
    useReadContract({ address: CLAIM_ADDR, abi: CLAIM_ABI_RELEASE, functionName: "releaseAt", query: { enabled: !!CLAIM_ADDR && !CLAIM_UNLOCK_UNIX } });
  const { data: claimReleaseB } =
    useReadContract({ address: CLAIM_ADDR, abi: CLAIM_ABI_UNLOCK,  functionName: "unlockAt",  query: { enabled: !!CLAIM_ADDR && !CLAIM_UNLOCK_UNIX } });

  const lpUntil   = (LP_LOCK_UNIX_ENV || Number(lpUntilOnChain || 0)) || undefined;
  const teamUntil = (TEAM_LOCK_UNIX_ENV || Number(teamUntilOnChain || 0)) || undefined;
  const claimUnlock =
    (CLAIM_UNLOCK_UNIX || Number(claimReleaseA || 0) || Number(claimReleaseB || 0)) || undefined;

  /** Wallet + buy */
  const { data: bal } = useBalance({ address, chainId: base.id });
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash });

  const canBuy = useMemo(() => {
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
  }, [isConnected, chainId, ethAmount, minWei, maxWei, bal, isLive]);

  const onBuy = () => {
    if (!PRESALE_ADDRESS) return;
    writeContract({
      address: PRESALE_ADDRESS,
      abi: PRESALE_ABI,
      functionName: "buy",
      value: BigInt(Math.floor(Number(ethAmount) * 1e18)),
      chainId: base.id,
    });
  };

  /** Distribution */
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

  const saleEndUnix = Number(endAt || 0);

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100">
      <Nav />

      {/* === Main content === */}
      <section className="mx-auto max-w-6xl px-6 py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[420px,1fr]">
          {/* Left: Buy + Share */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6 md:p-7">
              <div className="text-center md:text-left flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <h1 className="text-3xl md:text-2xl font-semibold tracking-wide">
                  Launch <span className="text-[#BBA46A]">Your Token</span>
                </h1>
                {saleEndUnix ? (
                  <div className="text-xs text-zinc-400">
                    Ends in{" "}
                    <span className="text-[#BBA46A] font-semibold">
                      <Countdown target={saleEndUnix} />
                    </span>
                  </div>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-zinc-400 text-center md:text-left">
                Fixed-price presale on <span className="text-[#BBA46A]">Base</span>. Unsold tokens seed liquidity on Aerodrome.
                Team allocation locked. Holder rewards via a separate <span className="text-[#BBA46A]">500M tiered program</span>.
              </p>

              {/* Buy widget */}
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
                    {isPending ? "Submitting…" : confirming ? "Confirming…" : "Buy"}
                  </button>
                </div>
                {confirmed && <div className="text-xs text-emerald-400">Purchase confirmed ✔</div>}
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

            {/* Pie chart: distribution */}
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6 md:p-7">
              <h3 className="text-lg font-semibold text-[#BBA46A] tracking-wide text-center md:text-left">
                Token Distribution
              </h3>
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

          {/* Right: Details & links */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 md:p-7">
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
                    <Row k="Chain"           v="Base (8453)" />
                    {lpUntil ?     <Row k="LP lock until"   v={`${ts(lpUntil)}  ·  ${rel(lpUntil)}`} /> : null}
                    {teamUntil ?   <Row k="Team lock until" v={`${ts(teamUntil)}  ·  ${rel(teamUntil)}`} /> : null}
                    {claimUnlock ? <Row k="Claim unlocks"   v={`${ts(claimUnlock)}  ·  ${rel(claimUnlock)}`} /> : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {PRESALE_ADDRESS && (
                  <a
                    href={`https://basescan.org/address/${PRESALE_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                  >
                    View Presale ↗
                  </a>
                )}
                {TOKEN_ADDRESS && (
                  <a
                    href={`https://basescan.org/address/${TOKEN_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                  >
                    View Token ↗
                  </a>
                )}
                <Link
                  href={POT_LINK}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[#BBA46A] hover:text-[#d6c289] hover:border-[#BBA46A]/50 transition"
                >
                  Holder Rewards (PoT) ↗
                </Link>
              </div>
            </div>

            {/* Contracts & Links */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 md:p-7">
              <h3 className="text-lg font-semibold text-[#BBA46A] tracking-wide">Contracts & Links</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <A href={LINKS.token}   label="PoT Token" />
                <A href={LINKS.presale} label="Presale Fixed" />
                {LINKS.liq && <A href={LINKS.liq} label="Liquidity Manager" />}
                {LINKS.timelock && <A href={LINKS.timelock} label="Simple Token Timelock" />}
                {LINKS.claim && <A href={LINKS.claim} label="TimeLockClaim" />}
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
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 md:p-7">
              <h3 className="text-lg font-semibold text-[#BBA46A] tracking-wide">Disclaimer</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                This page provides access to a token presale smart contract deployed on Base. Tokens have no promise of returns,
                dividends, or voting rights. Participation may be restricted in certain jurisdictions. Do your own research.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Simplified footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-900/20">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-center">
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
