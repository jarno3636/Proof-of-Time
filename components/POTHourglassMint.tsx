"use client";

import { useCallback, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import {
  POTHOURGLASS_ABI,
  POTHOURGLASS_ADDRESS,
} from "@/lib/pothourglass";

export default function POTHourglassMint() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [refreshNonce, setRefreshNonce] = useState(0);

  const { data: totalSupply } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalSupply",
    query: { enabled: true },
  });

  const { data: burned } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalPotBurned",
    query: { enabled: true, gcTime: 0, staleTime: 0 },
  });

  const handleMint = async () => {
    await writeContractAsync({
      address: POTHOURGLASS_ADDRESS,
      abi: POTHOURGLASS_ABI,
      functionName: "mint",
    });
  };

  const refresh = () => setRefreshNonce((n) => n + 1);

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5">
      <h3 className="text-lg font-semibold text-[#BBA46A]">
        Proof of Time Hourglass
      </h3>

      <p className="mt-2 text-sm text-zinc-400 max-w-md">
        A fully on-chain pixel relic. Minted only by burning PøT.
        Each hourglass locks your moment in time—forever.
      </p>

      {/* Stats */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          <div className="text-zinc-500">Minted</div>
          <div className="font-semibold">
            {Number(totalSupply ?? 0)} / 1000
          </div>
        </div>

        <div className="text-right">
          <div className="text-zinc-500 flex items-center gap-1 justify-end">
            PøT Burned
            <button
              onClick={refresh}
              title="Refresh"
              className="rounded-full border border-zinc-700/60 p-1 hover:border-[#BBA46A]/60 transition"
            >
              🛡
            </button>
          </div>
          <div className="font-semibold">
            {burned
              ? `${Number(burned) / 1e18}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              : "—"}
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleMint}
        disabled={!address || isPending}
        className="mt-5 w-full rounded-xl bg-[#BBA46A] hover:bg-[#d6c289] px-4 py-3 text-sm font-semibold text-[#0b0e14] transition disabled:opacity-60"
      >
        {isPending ? "Minting…" : "Mint (10,000 PøT)"}
      </button>

      <p className="mt-3 text-[11px] text-zinc-500">
        Body rarity: Iron · Bronze · Obsidian<br />
        Background FX: Lightning · Flames · Stardust · Rift
      </p>
    </div>
  );
}
