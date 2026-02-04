// lib/alchemyBalances.ts
import { alchemy } from "./alchemy";
import { Balance, HexAddr } from "./types";

export async function fetchBalancesAlchemy(
  address: HexAddr
): Promise<Balance[]> {
  const res = await alchemy.core.getTokenBalances(address);

  const balances: Balance[] = [];

  for (const tb of res.tokenBalances) {
    if (!tb.tokenBalance || tb.tokenBalance === "0") continue;

    const meta = await alchemy.core.getTokenMetadata(tb.contractAddress);

    balances.push({
      token: tb.contractAddress.toLowerCase() as HexAddr,
      symbol: meta.symbol || "TKN",
      decimals: meta.decimals ?? 18,
      raw: BigInt(tb.tokenBalance),
    });
  }

  return balances;
}
