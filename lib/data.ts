import { Balance, HexAddr, Transfer } from "./types";
import { createPublicClient, http, decodeEventLog, Hex, getAddress } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

const INFURA_KEY = process.env.INFURA_API_KEY!;
const BASESCAN_KEY = process.env.BASESCAN_API_KEY || "";
const SEED_ENV = (process.env.BASE_SEED_TOKENS || "").trim();

// Known-safe default seeds on Base (edit as you like)
// USDC: 0x833589fCD6EDB6E08f4c7C32D4f41f182e88C0A4
// WETH: 0x4200000000000000000000000000000000000006
const DEFAULT_SEEDS = [
  "0x833589fCD6EDB6E08f4c7C32D4f41f182e88C0A4",
  "0x4200000000000000000000000000000000000006",
];

const SEED_TOKENS: HexAddr[] = [
  ...DEFAULT_SEEDS,
  ...SEED_ENV.split(",").map(s => s.trim()).filter(Boolean),
].map(a => a.toLowerCase()) as HexAddr[];

if (!INFURA_KEY) {
  console.warn("INFURA_API_KEY is missing – set it in Vercel env.");
}

const client = createPublicClient({
  chain: base,
  transport: http(`https://base-mainnet.infura.io/v3/${INFURA_KEY}`),
});

// ---------------------------------------------------------------------------

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as Hex; // keccak256("Transfer(address,address,uint256)")

const toLower = (x: string) => (x || "").toLowerCase();
async function safeRead<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

// ---------- Optional discovery via BaseScan (fast) --------------------------

async function discoverTokensViaBaseScan(address: HexAddr): Promise<HexAddr[]> {
  if (!BASESCAN_KEY) return [];
  const url = new URL("https://api.basescan.org/api");
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("address", address);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "1000"); // first 1000 ERC20 transfers
  url.searchParams.set("sort", "asc");
  url.searchParams.set("apikey", BASESCAN_KEY);

  const res = await fetch(url.toString(), { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return [];
  const json: any = await res.json().catch(() => ({}));
  const list: any[] = Array.isArray(json?.result) ? json.result : [];
  const addrs = new Set<string>();
  for (const r of list) {
    const ca = toLower(r?.contractAddress);
    if (ca && /^0x[0-9a-f]{40}$/.test(ca)) addrs.add(ca);
  }
  return [...addrs] as HexAddr[];
}

// ---------- On-chain discovery via logs (truth; slower) ---------------------

export async function fetchTransfersBase(address: HexAddr): Promise<Transfer[]> {
  const acct = toLower(address) as HexAddr;
  const latest = await client.getBlockNumber();

  // Adjust if provider complains; more chunks = more calls = safer.
  const RANGE_SIZE = 200_000n;
  let from = 0n;
  const transfers: Transfer[] = [];

  while (from <= latest) {
    const to = (from + RANGE_SIZE < latest) ? (from + RANGE_SIZE) : latest;

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

    for (const log of [...outLogs, ...inLogs]) {
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
          ts: 0, // set below
          symbol: "TKN",
          decimals: 18,
        });
      } catch { /* ignore non-ERC20 logs */ }
    }

    from = to + 1n;
  }

  // Attach timestamps (batch unique block numbers)
  const uniqueBlocks = [...new Set(transfers.map(t => BigInt(t.block)))];
  const blockTimeMap = new Map<number, number>();
  await Promise.all(uniqueBlocks.map(async (bn) => {
    const blk = await safeRead(client.getBlock({ blockNumber: bn }), null as any);
    if (blk) blockTimeMap.set(Number(bn), Number(blk.timestamp));
  }));
  for (const t of transfers) t.ts = blockTimeMap.get(t.block) ?? 0;

  transfers.sort((a, b) => a.block - b.block || a.ts - b.ts);
  return transfers;
}

// ---------- Balances + metadata (Infura/viem) -------------------------------

export async function fetchBalancesBase(address: HexAddr): Promise<Balance[]> {
  // 1) Candidates from transfers (truth)
  const txs = await fetchTransfersBase(address);
  const tokenSet = new Set<string>(txs.map(t => t.token));

  // 2) Optional: Candidates via BaseScan (fast list)
  const bs = await discoverTokensViaBaseScan(address);
  for (const a of bs) tokenSet.add(a.toLowerCase());

  // 3) Seed list to ensure common tokens are checked
  for (const a of SEED_TOKENS) tokenSet.add(a);

  const candidates = [...tokenSet] as HexAddr[];
  if (!candidates.length) return [];

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

      if (raw === 0n) return; // only keep non-zero balances
      out.push({ token, symbol, decimals: Number(decimals), raw });
    })
  );

  return out;
}

// ---------- Prices (DeFiLlama) ---------------------------------------------

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
