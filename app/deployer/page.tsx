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
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

/** ========= Config ========= */
const PRESALE_ADDRESS = (process.env.NEXT_PUBLIC_PRESALE_ADDRESS || "").trim() as `0x${string}`;
const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "").trim() as `0x${string}`;
const POT_LINK = process.env.NEXT_PUBLIC_POT_LINK || "/pot"; // link to your Proof-of-Time page

// (Optional) locks for table display
const LP_LOCK_UNIX = Number(process.env.NEXT_PUBLIC_LP_LOCK_UNIX || 0); // e.g., 1766581200
const TEAM_LOCK_UNIX = Number(process.env.NEXT_PUBLIC_TEAM_LOCK_UNIX || 0); // e.g., 1751029200

// Minimal Presale ABI (reads + buy)
const PRESALE_ABI = parseAbi([
  // reads
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
  // write
  "function buy() payable",
] as const);

/** ========= Project Links (hard-coded per your deploys) ========= */
const LINKS = {
  token: "https://basescan.org/address/0x098bbeb9e36ba67dd9ded4d1428bd384569db2ad",
  liq:   "https://basescan.org/address/0x793ec280d1fd72ecabedfd984f11a39a50e1c5b7",
  presale: "https://basescan.org/address/0x63206e25648847033de7a4e4e186f2814ce7a063",
  timelock: "https://basescan.org/address/0xbeA426A7D608F746Ed843a8EeAF5c09BA971A793",
  claim: "https://basescan.org/address/0xf3a5f12eb334a63b2ea66310381cd0f0d77b0a77",
  potPage: POT_LINK || "/pot",
};

/** ========= Helpers ========= */
const fmt = (n?: bigint | number, digits = 4) => {
  if (n === undefined || n === null) return "—";
  const num = typeof n === "bigint" ? Number(n) : n;
  return Number.isFinite(num) ? num.toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
};
const fmt18 = (n?: bigint, digits = 4) => (n !== undefined ? Number(formatUnits(n, 18)).toLocaleString(undefined, { maximumFractionDigits: digits }) : "—");
const ts = (unix?: bigint | number) => {
  const u = typeof unix === "bigint" ? Number(unix) : unix;
  if (!u) return "—";
  try { return new Date(u * 1000).toLocaleString(); } catch { return "—"; }
};
const percent = (num: number, den: number) => (den > 0 ? ((num / den) * 100).toFixed(1) + "%" : "—");

// Colors (dark + gold accent)
const BG = "#0b0e14";
const GOLD = "#BBA46A";
const GOLD_SOFT = "#d6c289";
const RIM = "#2a2f3a";

export default function LaunchPage() {
  const { address, isConnected, chainId } = useAccount();
  const [ethAmount, setEthAmount] = useState<string>("");

  /** Reads */
  const { data: price } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "priceTokensPerEth" });
  const { data: startAt } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "startAt" });
  const { data: endAt } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "endAt" });
  const { data: minWei } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "minPerWalletWei" });
  const { data: maxWei } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "maxPerWalletWei" });
  const { data: hardCap } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "hardCapWei" });
  const { data: saleSupply } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "saleSupply" });
  const { data: raised } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "totalRaisedWei", watch: true });
  const { data: sold } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "totalSoldTokens", watch: true });
  const { data: isLive } = useReadContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "live", watch: true });
  const { data: bal } = useBalance({ address, chainId: base.id });

  /** Write */
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
    try {
      writeContract({
        address: PRESALE_ADDRESS,
        abi: PRESALE_ABI,
        functionName: "buy",
        value: BigInt(Math.floor(Number(ethAmount) * 1e18)),
        chainId: base.id,
      });
    } catch (e) {
      console.error(e);
    }
  };

  /** Distribution data (pie) */
  const distData = [
    { name: "Presale (60%)", value: 300_000_000 },
    { name: "LP & Treasury (37.5%)", value: 187_500_000 },
    { name: "Team (2.5%)", value: 12_500_000 },
    // Extra 500M released by holding tiers (described and linked)
    { name: "Holder Rewards (500M)", value: 500_000_000 },
  ];
  const PIE_COLORS = [GOLD, "#8a7a4a", "#6b613e", "#3c3a2f"]; // gold accents

  const progress = useMemo(() => {
    const r = Number(raised ? formatEther(raised as bigint) : 0);
    const h = Number(hardCap ? formatEther(hardCap as bigint) : 0);
    return { r, h, pct: h > 0 ? Math.min(100, (r / h) * 100) : 0 };
  }, [raised, hardCap]);

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100">
      <Nav />

      {/* Top bar */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-zinc-300 hover:text-[${GOLD_SOFT}] transition">← Back</Link>
          <div className="text-xs md:text-sm text-zinc-500">
            {PRESALE_ADDRESS ? (
              <>Presale: <span className="text-[${GOLD}] font-medium">{PRESALE_ADDRESS.slice(0,6)}…{PRESALE_ADDRESS.slice(-4)}</span></>
            ) : (
              "Set NEXT_PUBLIC_PRESALE_ADDRESS"
            )}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[380px,1fr]">
          {/* Left: Hero / Buy card */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                Launch <span className="text-[${GOLD}]">Your Token</span>
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Fixed-price presale on <span className="text-[${GOLD}]">Base</span>. Unsold tokens seed
                liquidity on Aerodrome. Team allocation locked. Holder rewards via a separate
                <span className="text-[${GOLD}]"> 500M-tiered program</span> (see link below).
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
                    className="w-full rounded-xl bg-[#0f131b] border border-zinc-800/70 px-4 py-2.5 text-sm outline-none focus:border-[${GOLD}]"
                  />
                  <button
                    onClick={onBuy}
                    disabled={!canBuy || isPending || confirming}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      canBuy && !isPending && !confirming
                        ? `bg-[${GOLD}] text-[${BG}] hover:bg-[${GOLD_SOFT}]`
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    }`}
                  >
                    {isPending ? "Submitting…" : confirming ? "Confirming…" : "Buy"}
                  </button>
                </div>
                {confirmed && (
                  <div className="text-xs text-emerald-400">Purchase confirmed ✔</div>
                )}
                {isConnected && chainId !== base.id && (
                  <div className="text-xs text-red-400">Switch to Base to continue.</div>
                )}
                <div className="text-xs text-zinc-500">Wallet balance: {bal?.formatted ?? "—"} ETH</div>
              </div>

              {/* Progress */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Raised</span>
                  <span>
                    {progress.r.toLocaleString()} / {progress.h.toLocaleString()} ETH ({progress.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-800/60 overflow-hidden">
                  <div className="h-full bg-[${GOLD}]" style={{ width: `${progress.pct}%` }} />
                </div>
              </div>
            </div>

            {/* Pie chart: distribution */}
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6">
              <h3 className="text-lg font-semibold text-[${GOLD}]">Token Distribution</h3>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="value" data={distData} cx="50%" cy="50%" outerRadius={95} label>
                      {distData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#111318", border: `1px solid ${RIM}`, borderRadius: 12, color: "#e5e7eb" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-zinc-400">
                * An additional <span className="text-[${GOLD}] font-medium">500,000,000</span> tokens are reserved in the
                token contract and released to holders in <span className="text-[${GOLD}]">tiered schedules</span>
                based on holding duration. See details here: {" "}
                <Link href={POT_LINK} className="underline text-[${GOLD}] hover:text-[${GOLD_SOFT}]">Holder Rewards (PoT)</Link>.
              </p>
            </div>
          </div>

          {/* Right: Details & links */}
<div className="space-y-6">
  {/* Info table */}
  <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
    <h3 className="text-lg font-semibold text-[${GOLD}]">Sale Information</h3>
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800/60">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-zinc-800/60">
          <Row k="Price" v={`${fmt18(price as bigint, 0)} tokens / ETH`} />
          <Row k="Sale allocation" v={`${fmt18(saleSupply as bigint, 0)} tokens`} />
          <Row k="Min per wallet" v={`${minWei ? Number(formatEther(minWei as bigint)) : "—"} ETH`} />
          <Row k="Max per wallet" v={`${maxWei ? Number(formatEther(maxWei as bigint)) : "—"} ETH`} />
          <Row k="Hard cap" v={`${hardCap ? Number(formatEther(hardCap as bigint)) : "—"} ETH`} />
          <Row k="Tokens sold" v={`${fmt18(sold as bigint, 0)}`} />
          <Row k="Sale window" v={`${ts(startAt as bigint)} → ${ts(endAt as bigint)}`} />
          <Row k="Chain" v="Base (8453)" />
          {LP_LOCK_UNIX ? <Row k="LP lock until" v={ts(LP_LOCK_UNIX)} /> : null}
          {TEAM_LOCK_UNIX ? <Row k="Team lock until" v={ts(TEAM_LOCK_UNIX)} /> : null}
        </tbody>
      </table>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      {PRESALE_ADDRESS && (
        <a
          href={`https://basescan.org/address/${PRESALE_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[${GOLD}] hover:text-[${GOLD_SOFT}] hover:border-[${GOLD}]/50 transition"
        >
          View Presale ↗
        </a>
      )}
      {TOKEN_ADDRESS && (
        <a
          href={`https://basescan.org/address/${TOKEN_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[${GOLD}] hover:text-[${GOLD_SOFT}] hover:border-[${GOLD}]/50 transition"
        >
          View Token ↗
        </a>
      )}
      <Link
        href={POT_LINK}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 font-semibold text-[${GOLD}] hover:text-[${GOLD_SOFT}] hover:border-[${GOLD}]/50 transition"
      >
        Holder Rewards (PoT) ↗
      </Link>
    </div>
  </div>

  {/* NEW: Contracts & Links (above disclaimer) */}
  <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
    <h3 className="text-lg font-semibold text-[${GOLD}]">Contracts & Links</h3>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <A href={LINKS.token} label="PoT Token" />
      <A href={LINKS.presale} label="Presale Fixed" />
      <A href={LINKS.liq} label="Liquidity Manager" />
      <A href={LINKS.timelock} label="Simple Token Timelock" />
      <A href={LINKS.claim} label="TimeLockClaim" />
      <Link
        href={LINKS.potPage}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-2 font-semibold text-[${GOLD}] hover:text-[${GOLD_SOFT}] hover:border-[${GOLD}]/50 transition"
      >
        Holder Rewards Page ↗
      </Link>
    </div>
    <p className="mt-3 text-xs text-zinc-500">All links open in a new tab when applicable.</p>
  </div>

  {/* Disclaimer */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <h3 className="text-lg font-semibold text-[${GOLD}]">Disclaimer</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                This page provides access to a token presale smart contract deployed on Base. Tokens
                have no promise of returns, dividends, or voting rights. Participation may be
                restricted in certain jurisdictions. Do your own research and consult licensed
                counsel. Interacting with smart contracts involves risk; you assume full
                responsibility for all transactions executed from your wallet. By proceeding, you
                acknowledge these terms.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800/60 bg-zinc-900/20">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-zinc-500">© {new Date().getFullYear()} Your Project</div>
          <div className="text-xs text-zinc-500">
            Built for Base · Styled with gold accents
          </div>
        </div>
      </footer>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="bg-[#0f131b] hover:bg-[#121722] transition-colors">
      <td className="w-48 px-4 py-3 text-zinc-400">{k}</td>
      <td className="px-4 py-3 font-medium text-zinc-200"><span className="text-[#BBA46A]">{v}</span></td>
    </tr>
  );
}
