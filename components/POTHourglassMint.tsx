"use client";

import { useState } from "react";
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

export default function POTHourglassMint() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
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

  /* ---------- Tx receipt ---------- */

  const {
    isLoading: confirming,
    isSuccess,
  } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  /* ---------- Mint ---------- */

  const handleMint = async () => {
    setError(null);
    setTxHash(null);

    try {
      const hash = await writeContractAsync({
        address: POTHOURGLASS_ADDRESS,
        abi: POTHOURGLASS_ABI,
        functionName: "mint",
      });

      setTxHash(hash);
    } catch (e: any) {
      if (e?.shortMessage) setError(e.shortMessage);
      else if (e?.message) setError(e.message);
      else setError("Mint failed");
    }
  };

  /* ---------- Post-success refresh ---------- */
  if (isSuccess) {
    refetchSupply();
    refetchBurned();
  }

  return (
    <div className="rounded-2xl border border-[#BBA46A]/40 bg-gradient-to-b from-[#151922] to-[#0b0e14] p-5 sm:p-6 shadow-[0_0_40px_rgba(187,164,106,0.08)]">
      <h3 className="text-lg font-semibold text-[#BBA46A]">
        Proof of Time Hourglass
      </h3>

      <p className="mt-2 text-sm text-zinc-400 max-w-md">
        A fully on-chain pixel relic. Minting permanently burns PøT and
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
          <div className="text-zinc-500">PøT Burned</div>
          <div className="font-semibold">
            {burned
              ? `${Number(burned) / 1e18}`.replace(
                  /\B(?=(\d{3})+(?!\d))/g,
                  ","
                )
              : "—"}
          </div>
        </div>
      </div>

      {/* ---------- CTA ---------- */}
      <button
        onClick={handleMint}
        disabled={!address || confirming}
        className="mt-5 w-full rounded-xl bg-[#BBA46A] hover:bg-[#d6c289] px-4 py-3 text-sm font-semibold text-[#0b0e14] transition disabled:opacity-60"
      >
        {confirming
          ? "Confirming mint…"
          : "Mint (10,000 PøT burned)"}
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
