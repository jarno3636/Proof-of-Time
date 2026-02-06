"use client";

import { useState, useMemo } from "react";
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
import { erc20Abi } from "viem";

// 🔧 replace with your actual POT token address
const POT_ADDRESS = "0xe4D22a9af4E14fDF70795dd9c9531295095f0Cb6" as const;
const MINT_PRICE = 10_000n * 10n ** 18n;

export default function POTHourglassMint() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [step, setStep] = useState<"idle" | "approving" | "minting">("idle");
  const [error, setError] = useState<string | null>(null);

  /* ---------- Reads ---------- */

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

  /* ---------- Tx receipt ---------- */

  const { isLoading: confirming, isSuccess } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
    });

  /* ---------- Derived state ---------- */

  const insufficientPOT = useMemo(() => {
    if (!potBalance) return false;
    return potBalance < MINT_PRICE;
  }, [potBalance]);

  const needsApproval = useMemo(() => {
    if (!allowance) return true;
    return allowance < MINT_PRICE;
  }, [allowance]);

  /* ---------- Main flow ---------- */

  const handleMintFlow = async () => {
    if (!address) return;

    setError(null);
    setTxHash(null);

    try {
      // 1️⃣ Approve if needed
      if (needsApproval) {
        setStep("approving");

        const approveHash = await writeContractAsync({
          address: POT_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [POTHOURGLASS_ADDRESS, MINT_PRICE],
        });

        await waitForTx(approveHash);
        await refetchAllowance();
      }

      // 2️⃣ Mint
      setStep("minting");

      const mintHash = await writeContractAsync({
        address: POTHOURGLASS_ADDRESS,
        abi: POTHOURGLASS_ABI,
        functionName: "mint",
      });

      setTxHash(mintHash);
    } catch (e: any) {
      setStep("idle");
      setError(e?.shortMessage || e?.message || "Transaction failed");
    }
  };

  /* ---------- Post-success refresh ---------- */
  if (isSuccess) {
    refetchSupply();
    refetchBurned();
  }

  /* ---------- UI ---------- */

  const buttonLabel = () => {
    if (!address) return "Connect Wallet";
    if (insufficientPOT) return "Not enough PØT";
    if (step === "approving") return "Approving PØT…";
    if (step === "minting" || confirming) return "Confirming mint…";
    return "Mint (10,000 PØT burned)";
  };

  return (
    <div className="rounded-2xl border border-[#BBA46A]/40 bg-gradient-to-b from-[#151922] to-[#0b0e14] p-5 sm:p-6 shadow-[0_0_40px_rgba(187,164,106,0.08)]">
      <h3 className="text-lg font-semibold text-[#BBA46A]">
        Proof of Time Hourglass
      </h3>

      <p className="mt-2 text-sm text-zinc-400 max-w-md">
        A fully on-chain pixel relic. Minting permanently burns PØT and
        crystallizes a moment of belief into time.
      </p>

      {/* ---------- Stats ---------- */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          <div className="text-zinc-500">Minted</div>
          <div className="font-semibold">
            {Number(totalSupply ?? 0)} / 1000
          </div>
        </div>

        <div className="text-right">
          <div className="text-zinc-500">PØT Burned</div>
          <div className="font-semibold">
            {burned
              ? `${Number(burned) / 1e18}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              : "—"}
          </div>
        </div>
      </div>

      {/* ---------- CTA ---------- */}
      <button
        onClick={handleMintFlow}
        disabled={!address || insufficientPOT || confirming}
        className="mt-5 w-full rounded-xl bg-[#BBA46A] hover:bg-[#d6c289] px-4 py-3 text-sm font-semibold text-[#0b0e14] transition disabled:opacity-60"
      >
        {buttonLabel()}
      </button>

      {/* ---------- Feedback ---------- */}
      {txHash && (
        <div className="mt-3 text-xs text-zinc-400">
          {confirming && "⏳ Waiting for confirmation…"}
          {isSuccess && (
            <span className="text-[#BBA46A] font-semibold">
              ✅ Mint successful!
            </span>
          )}
          <div className="mt-1">
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#BBA46A]"
            >
              View transaction ↗
            </a>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-400">
          ⚠️ {error}
        </p>
      )}

      <p className="mt-4 text-[11px] text-zinc-500">
        Body rarity: Iron · Bronze · Obsidian
        <br />
        Background FX: Lightning · Flames · Stardust · Rift
      </p>
    </div>
  );
}

/* ---------- helper ---------- */
async function waitForTx(hash: `0x${string}`) {
  return new Promise((resolve) => setTimeout(resolve, 12_000));
}
