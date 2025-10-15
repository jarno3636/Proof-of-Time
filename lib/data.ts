import { Balance, HexAddr, Transfer } from "./types";

/** TODO: wire real Airstack or BaseScan queries */
export async function fetchTransfersBase(address: HexAddr): Promise<Transfer[]> {
  // Return ERC-20 transfers involving address on Base (both directions), with block/time
  // Implement Airstack query; map to Transfer shape.
  return [];
}

export async function fetchBalancesBase(address: HexAddr): Promise<Balance[]> {
  // Fetch current ERC-20 balances on Base
  return [];
}

export async function fetchPriceUSDMap(tokens: HexAddr[]): Promise<Record<string, number>> {
  // Cache Coingecko/DefiLlama prices. Return { tokenAddressLower: priceUSD }
  return {};
}
