// lib/data.ts
import { Balance, HexAddr, Transfer } from "./types";
import { createPublicClient, http, decodeEventLog, Hex, getAddress } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

const INFURA_KEY = process.env.INFURA_API_KEY!;
if (!INFURA_KEY) {
  console.warn("INFURA_API_KEY is missing – set it in Vercel env.");
}

const client = createPublicClient({
  chain: base,
  transport: http(`https://base-mainnet.infura.io/v3/${INFURA_KEY}`),
});

// ---- helpers ---------------------------------------------------------------

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as Hex; // keccak256("Transfer(address,address,uint256)")

function toLower(x: string) {
  return (x || "").toLowerCase();
}

async function safeRead<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

// ---- discover tokens via logs ---------------------------------------------

/**
 * Scan logs in block chunks to find all ERC20 Transfer events where the wallet
 * is either sender or recipient. Returns a set of token addresses + raw transfers.
 * NOTE: For large/very old wallets you can reduce RANGE_SIZE to avoid provider limits.
 */
export async function fetchTransfersBase(address: HexAddr): Promise<Transfer[]> {
  const acct = toLower(address) as HexAddr;

  const latest = await client.getBlockNumber();
  const RANGE_SIZE = 200_000n; // ~safe chunk size; adjust if provider complains
  let from = 0n;
  const transfers: Transfer[] = [];

  while (from <= latest) {
    const to = (from + RANGE_SIZE < latest) ? (from + RANGE_SIZE) : latest;

    // We need two queries per range (from=addr and to=addr).
    const [outLogs, inLogs] = await Promise.all([
      client.getLogs({
        fromBlock: from,
        toBlock: to,
        topics: [TRANSFER_TOPIC, (getAddress(acct) as Hex)],
      }).catch(() => []),
      client.getLogs({
        fromBlock: from,
        toBlock: to,
        topics: [TRANSFER_TOPIC, null, (getAddress(acct) as Hex)],
      }).catch(() => []),
    ]);

    // Combine and parse
    for (const log of [...outLogs, ...inLogs]) {
      // Some logs may be from non-ERC20 contracts; try to decode defensively.
      try {
        const decoded = decodeEventLog({
          abi: erc20Abi,
          data: log.data,
          topics: log.topics as Hex[],
        });

        if (decoded.eventName !== "Transfer") continue;
        const args = decoded.args as { from: Hex; to: Hex; value: bigint };

        transfers.push({
          token: toLower(log.address) as HexAddr,
          from: toLower(args.from) as HexAddr,
          to: toLower(args.to) as HexAddr,
          value: args.value,
          block: Number(log.blockNumber ?? 0n),
          ts: 0, // fill below
          symbol: "TKN",
          decimals: 18,
        });
      } catch {
        // ignore non-ERC20 Transfer-like logs
      }
    }

    from = to + 1n;
  }

  // Attach timestamps (batch unique blockNumbers)
  const uniqueBlocks = [...new Set(transfers.map(t => BigInt(t.block)))];
  const blockTimeMap = new Map<number, number>();
  await Promise.all(
    uniqueBlocks.map(async (bn) => {
      const blk = await safeRead(client.getBlock({ blockNumber: bn }), null as any);
      if (blk) blockTimeMap.set(Number(bn), Number(blk.timestamp));
    })
  );
  for (const t of transfers) {
    t.ts = blockTimeMap.get(t.block) ?? 0;
  }

  // Discover token addresses we touched
  // We'll populate symbol/decimals later alongside balances.
  transfers.sort((a, b) => a.block - b.block || a.ts - b.ts);
  return transfers;
}

// ---- balances + metadata for discovered tokens ----------------------------

/**
 * Given a wallet, ask viem/Infura for balanceOf + metadata for tokens we saw
 * in transfers. If you want to ensure we include tokens with balance but no
 * recent transfers, you can seed `candidateTokens` with a known list too.
 */
export async function fetchBalancesBase(address: HexAddr): Promise<Balance[]> {
  // Option A: use transfers to discover tokens first (preferred to avoid guessing)
  const txs = await fetchTransfersBase(address);
  const tokenSet = new Set<string>(txs.map(t => t.token));
  const candidates = [...tokenSet];

  // If you want to seed popular Base tokens to catch "held but never transferred":
  // candidates.push("0x...USDC", "0x...WETH", ...)

  const out: Balance[] = [];
  await Promise.all(
    candidates.map(async (token) => {
      const [raw, symbol, decimals] = await Promise.all([
        safeRead(client.readContract({
          address: token as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        }), 0n),
        safeRead(client.readContract({
          address: token as `0x${string}`,
          abi: erc20Abi,
          functionName: "symbol",
        }), "TKN"),
        safeRead(client.readContract({
          address: token as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        }), 18),
      ]);

      if (raw === 0n) return;
      out.push({ token: token as HexAddr, symbol, decimals: Number(decimals), raw });
    })
  );

  return out;
}

// ---- prices (DeFiLlama) ----------------------------------------------------

export async function fetchPriceUSDMap(tokens: HexAddr[]): Promise<Record<string, number>> {
  const uniq = [...new Set(tokens.map(t => t.toLowerCase()))];
  if (!uniq.length) return {};
  const ids = uniq.map(a => `base:${a}`).join(",");
  const url = `https://coins.llama.fi/prices/current/${ids}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return {};
  const json = await res.json().catch(() => ({})) as { coins?: Record<string, { price: number }> };

  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(json.coins || {})) {
    const addrLower = key.split(":")[1]?.toLowerCase();
    if (addrLower && typeof val.price === "number") out[addrLower] = val.price;
  }
  return out;
}
