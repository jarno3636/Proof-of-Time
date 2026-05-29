"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import {
  POTHOURGLASS_ABI,
  POTHOURGLASS_ADDRESS,
} from "@/lib/pothourglass";
import { erc20Abi, formatUnits } from "viem";
import { base } from "viem/chains";

// Constants
const POT_ADDRESS = "0xe4D22a9af4E14fDF70795dd9c9531295095f0Cb6" as const;
const MINT_PRICE = 10_000n * 10n ** 18n;
const MAX_SUPPLY = 1000;

type MintStep =
  | "idle"
  | "approving"
  | "approvalConfirming"
  | "minting"
  | "mintConfirming"
  | "refreshing"
  | "success";

function getErrorMessage(e: unknown) {
  if (typeof e === "object" && e !== null) {
    const err = e as {
      shortMessage?: string;
      message?: string;
      details?: string;
    };

    return (
      err.shortMessage ||
      err.details ||
      err.message ||
      "Transaction failed"
    );
  }

  return "Transaction failed";
}

function fmtPot(value?: bigint) {
  if (value === undefined) return "—";

  const n = Number(formatUnits(value, 18));

  if (!Number.isFinite(n)) return "—";

  return n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export default function POTHourglassMint() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | null>(null);
  const [step, setStep] = useState<MintStep>("idle");
  const [error, setError] = useState<string | null>(null);

  /* ───────── Reads ───────── */

  const { data: totalSupply, refetch: refetchSupply } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalSupply",
    chainId: base.id,
  });

  const { data: burned, refetch: refetchBurned } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalPotBurned",
    chainId: base.id,
  });

  const { data: potBalance, refetch: refetchBalance } = useReadContract({
    address: POT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: {
      enabled: !!address,
      refetchInterval: 20_000,
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: POT_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, POTHOURGLASS_ADDRESS] : undefined,
    chainId: base.id,
    query: {
      enabled: !!address,
      refetchInterval: 20_000,
    },
  });

  /* ───────── Tx confirmation ───────── */

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    chainId: base.id,
  });

  /* ───────── Derived state ───────── */

  const minted = Number(totalSupply ?? 0n);
  const soldOut = minted >= MAX_SUPPLY;
  const wrongChain = !!address && chainId !== base.id;

  const insufficientPOT = useMemo(() => {
    if (!address) return false;
    if (potBalance === undefined) return false;
    return potBalance < MINT_PRICE;
  }, [address, potBalance]);

  const needsApproval = useMemo(() => {
    if (!address) return false;
    if (allowance === undefined) return true;
    return allowance < MINT_PRICE;
  }, [address, allowance]);

  const busy =
    step === "approving" ||
    step === "approvalConfirming" ||
    step === "minting" ||
    step === "mintConfirming" ||
    step === "refreshing" ||
    confirming;

  const disabled =
    !address ||
    wrongChain ||
    insufficientPOT ||
    soldOut ||
    busy;

  /* ───────── Mint flow ───────── */

  const handleMintFlow = async () => {
    if (!address || soldOut || wrongChain || busy) return;

    setError(null);
    setTxHash(null);
    setApprovalHash(null);
    setStep("idle");

    try {
      if (!publicClient) {
        throw new Error("Base public client unavailable. Try again.");
      }

      // 1) Approve if needed
      if (needsApproval) {
        setStep("approving");

        let approvalTxHash: `0x${string}`;

        try {
          approvalTxHash = await writeContractAsync({
            address: POT_ADDRESS,
            abi: erc20Abi,
            functionName: "approve",
            args: [POTHOURGLASS_ADDRESS, MINT_PRICE],
            chainId: base.id,
          });

          setApprovalHash(approvalTxHash);
          setStep("approvalConfirming");

          await publicClient.waitForTransactionReceipt({
            hash: approvalTxHash,
          });

          const allowanceResult = await refetchAllowance();
          const updatedAllowance = allowanceResult.data;

          if (updatedAllowance === undefined || updatedAllowance < MINT_PRICE) {
            throw new Error(
              "Approval confirmed, but allowance is still too low. Please try again."
            );
          }
        } catch (e: unknown) {
          setError(getErrorMessage(e) || "Approval failed");
          setStep("idle");
          throw e;
        }
      }

      // 2) Mint only after approval is confirmed/refetched
      setStep("minting");

      const hash = await writeContractAsync({
        address: POTHOURGLASS_ADDRESS,
        abi: POTHOURGLASS_ABI,
        functionName: "mint",
        chainId: base.id,
      });

      setTxHash(hash);
      setStep("mintConfirming");
    } catch (e: unknown) {
      setStep("idle");

      // Avoid replacing a more specific approval error with a generic one.
      setError((current) => current ?? getErrorMessage(e));
    }
  };

  /* ───────── Post-success effects ───────── */

  const refreshAfterMint = useCallback(async () => {
    setStep("refreshing");

    try {
      await refetchSupply();
      await refetchBurned();
      await refetchBalance();
      await refetchAllowance();

      setStep("success");
    } catch (e: unknown) {
      setStep("success");
      setError(
        `Mint succeeded, but fresh stats could not be loaded: ${getErrorMessage(
          e
        )}`
      );
    }
  }, [refetchSupply, refetchBurned, refetchBalance, refetchAllowance]);

  useEffect(() => {
    if (!isSuccess) return;

    refreshAfterMint();
  }, [isSuccess, refreshAfterMint]);

  /* ───────── UI helpers ───────── */

  const buttonLabel = () => {
    if (soldOut) return "⛔ Sold Out";
    if (!address) return "Connect Wallet";
    if (wrongChain) return "Switch to Base";
    if (insufficientPOT) return "Not enough PØT";
    if (step === "approving") return "Approving PØT…";
    if (step === "approvalConfirming") return "Confirming approval…";
    if (step === "minting") return "Submitting mint…";
    if (step === "mintConfirming" || confirming) return "Confirming mint…";
    if (step === "refreshing") return "Refreshing stats…";
    if (step === "success") return "Mint another hourglass";
    if (needsApproval) return "Approve + Mint";
    return "Mint — Burn 10,000 PØT";
  };

  /* ───────── Render ───────── */

  return (
    <div
      className={[
        "rounded-2xl p-5 sm:p-6 transition-all duration-700",
        "border bg-gradient-to-b from-[#151922] to-[#0b0e14]",
        step === "success"
          ? "border-[#BBA46A] shadow-[0_0_60px_rgba(187,164,106,0.35)]"
          : "border-[#BBA46A]/40 shadow-[0_0_40px_rgba(187,164,106,0.08)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#BBA46A]">
            Proof of Time Hourglass
          </h3>

          <p className="mt-2 text-sm text-zinc-400 max-w-md">
            A limited on-chain timepiece. Each mint permanently burns PØT and
            marks your conviction on Base.
          </p>
        </div>

        <div className="rounded-full border border-[#BBA46A]/30 bg-[#BBA46A]/10 px-3 py-1 text-xs font-bold text-[#d6c289]">
          10,000 PØT
        </div>
      </div>

      {/* ───────── Stats ───────── */}
      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <Stat label="Minted" value={`${minted} / ${MAX_SUPPLY}`} />
        <Stat label="Your PØT" value={fmtPot(potBalance)} />
        <Stat label="Burned" value={fmtPot(burned)} />
      </div>

      {/* ───────── CTA ───────── */}
      <button
        onClick={handleMintFlow}
        disabled={disabled}
        className={[
          "mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
          soldOut || disabled
            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            : "bg-[#BBA46A] hover:bg-[#d6c289] text-[#0b0e14]",
          "disabled:opacity-60",
        ].join(" ")}
      >
        {buttonLabel()}
      </button>

      {/* ───────── Feedback ───────── */}
      {(approvalHash || txHash || step !== "idle") && (
        <div className="mt-3 space-y-2 text-xs text-zinc-400">
          {step === "approving" && <p>Approve the PØT spend in your wallet…</p>}

          {step === "approvalConfirming" && (
            <p>⏳ Waiting for approval confirmation…</p>
          )}

          {step === "minting" && <p>Submit the mint in your wallet…</p>}

          {(step === "mintConfirming" || confirming) && (
            <p>⏳ Waiting for mint confirmation…</p>
          )}

          {step === "refreshing" && <p>Refreshing hourglass stats…</p>}

          {step === "success" && (
            <p className="font-semibold text-[#BBA46A]">
              ✨ Hourglass forged successfully
            </p>
          )}

          {approvalHash && (
            <a
              href={`https://basescan.org/tx/${approvalHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline hover:text-[#BBA46A]"
            >
              View approval transaction ↗
            </a>
          )}

          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline hover:text-[#BBA46A]"
            >
              View mint transaction ↗
            </a>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">⚠️ {error}</p>}

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
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
