"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  POTHOURGLASS_ABI,
  POTHOURGLASS_ADDRESS,
} from "@/lib/pothourglass";
import { erc20Abi, formatUnits } from "viem";

// Constants
const POT_ADDRESS = "0xe4D22a9af4E14fDF70795dd9c9531295095f0Cb6" as const;
const MINT_PRICE = 10_000n * 10n ** 18n;
const MAX_SUPPLY = 1000;

export default function POTHourglassMint() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [step, setStep] =
    useState<"idle" | "approving" | "minting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  /* ───────── Reads ───────── */

  const { data: totalSupply, refetch: refetchSupply } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalSupply",
  });

  const { data: burned, refetch: refetchBurned } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalPotBurned",
  });

  const { data: potBalance } = useReadContract({
    address: POT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: POT_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, POTHOURGLASS_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  /* ───────── Tx confirmation ───────── */

  const { isLoading: confirming, isSuccess } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
    });

  /* ───────── Derived state ───────── */

  const minted = Number(totalSupply ?? 0);
  const soldOut = minted >= MAX_SUPPLY;

  const insufficientPOT = useMemo(() => {
    if (!potBalance) return false;
    return potBalance < MINT_PRICE;
  }, [potBalance]);

  const needsApproval = useMemo(() => {
    if (!allowance) return true;
    return allowance < MINT_PRICE;
  }, [allowance]);

  /* ───────── Mint flow ───────── */

  const handleMintFlow = async () => {
    if (!address || soldOut) return;

    setError(null);
    setTxHash(null);

    try {
      // 1) Approve if needed
      if (needsApproval) {
        setStep("approving");
        await writeContractAsync({
          address: POT_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [POTHOURGLASS_ADDRESS, MINT_PRICE],
        });
        await refetchAllowance();
      }

      // 2) Mint
      setStep("minting");
      const hash = await writeContractAsync({
        address: POTHOURGLASS_ADDRESS,
        abi: POTHOURGLASS_ABI,
        functionName: "mint",
      });

      setTxHash(hash);
    } catch (e: any) {
      setStep("idle");
      setError(e?.shortMessage || e?.message || "Transaction failed");
    }
  };

  /* ───────── Post-success effects ───────── */

  useEffect(() => {
    if (isSuccess) {
      setStep("success");
      refetchSupply();
      refetchBurned();
    }
  }, [isSuccess, refetchSupply, refetchBurned]);

  /* ───────── UI helpers ───────── */

  const buttonLabel = () => {
    if (soldOut) return "⛔ Sold Out";
    if (!address) return "Connect Wallet";
    if (insufficientPOT) return "Not enough PØT";
    if (step === "approving") return "Approving PØT…";
    if (step === "minting" || confirming) return "Confirming mint…";
    return "Mint (10,000 PØT burned)";
  };

  /* ───────── Render ───────── */

  return (
    <div
      className={[
        "rounded-2xl p-5 sm:p-6 transition-all duration-700",
        "border bg-gradient-to-b from-[#151922] to-[#0b0e14]",
        step === "success"
          ? "border-[#BBA46A] shadow-[0_0_60px_rgba(187,164,106,0.35)] animate-pulse"
          : "border-[#BBA46A]/40 shadow-[0_0_40px_rgba(187,164,106,0.08)]",
      ].join(" ")}
    >
      <h3 className="text-lg font-semibold text-[#BBA46A]">
        Proof of Time Hourglass
      </h3>

      <p className="mt-2 text-sm text-zinc-400 max-w-md">
        A fully on-chain pixel relic. Each mint permanently burns PØT and
        crystallizes belief into time.
      </p>

      {/* ───────── Stats ───────── */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Stat label="Minted" value={`${minted} / ${MAX_SUPPLY}`} />
        <Stat
          label="Your PØT"
          value={
            potBalance
              ? `${Number(formatUnits(potBalance, 18)).toLocaleString()}`
              : "—"
          }
        />
        <Stat
          label="Burned"
          value={
            burned
              ? `${Number(formatUnits(burned, 18)).toLocaleString()}`
              : "—"
          }
        />
      </div>

      {/* ───────── CTA ───────── */}
      <button
        onClick={handleMintFlow}
        disabled={!address || insufficientPOT || soldOut || confirming}
        className={[
          "mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
          soldOut
            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            : "bg-[#BBA46A] hover:bg-[#d6c289] text-[#0b0e14]",
          "disabled:opacity-60",
        ].join(" ")}
      >
        {buttonLabel()}
      </button>

      {/* ───────── Feedback ───────── */}
      {txHash && (
        <div className="mt-3 text-xs text-zinc-400">
          {confirming && "⏳ Waiting for confirmation…"}
          {isSuccess && (
            <span className="block text-[#BBA46A] font-semibold">
              ✨ Hourglass forged successfully
            </span>
          )}
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#BBA46A]"
          >
            View transaction ↗
          </a>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-400">
          ⚠️ {error}
        </p>
      )}

      <p className="mt-4 text-[11px] text-zinc-500">
        Body: Iron · Bronze · Obsidian
        <br />
        FX: Lightning · Flames · Stardust · Rift
      </p>
    </div>
  );
}

/* ───────── Small helper ───────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div className="font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
