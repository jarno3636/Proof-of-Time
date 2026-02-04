// lib/data.ts
import { Balance, HexAddr, Transfer } from "./types";
import {
  createPublicClient,
  http,
  decodeEventLog,
  Hex,
  getAddress,
} from "viem";
import type { AbiEvent } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

// ───────────────────────────── ENV & seeds ─────────────────────────────

const INFURA_KEY = process.env.INFURA_API_KEY || "";
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || "";
const GOLD_KEY = process.env.COVALENT_API_KEY || "";
const SEED_ENV = (process.env.BASE_SEED_TOKENS || "").trim();

/**
 * Proof of Time (protocol token)
 * Always tracked even if no transfers exist yet.
 */
const POT_TOKEN = "0xe4d22a9af4e14fdf70795dd9c9531295095f0cb6";

const DEFAULT_SEEDS = [
  "0x833589fCD6EDB6E08f4c7C32D4f41f182e88C0A4", // USDC
  "0x4200000000000000000000000000000000000006", // WETH
];

const SEED_TOKENS: HexAddr[] = [
  ...DEFAULT_SEEDS,
  ...SEED_ENV.split(",").map((s) => s.trim()).filter(Boolean),
  POT_TOKEN,
].map((a) => a.toLowerCase()) as HexAddr[];

// ───────────────────── RPC clients ─────────────────────

const INFURA_URL = INFURA_KEY
  ? `https://base-mainnet.infura.io/v3/${INFURA_KEY}`
  : null;

const PUBLIC_URL = "https://mainnet.base.org";

function makeClient(url: string) {
  return createPublicClient({
    chain: base,
    transport: http(url, { retryCount: 2 }),
  });
}

const clientPrimary = makeClient(INFURA_URL ?? PUBLIC_URL);
const clientFallback = makeClient(PUBLIC_URL);

async function withFallback<T>(
  call: (c: ReturnType<typeof makeClient>) => Promise<T>,
  fallbackValue?: T
): Promise<T> {
  try {
    return await call(clientPrimary);
  } catch {
    try {
      return await call(clientFallback);
    } catch {
      if (arguments.length === 2) return fallbackValue as T;
      throw new Error("RPC failed");
    }
  }
}

// ───────────────────── Throttling ─────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const LOG_RANGE_SLEEP_MS = 120;
const MULTICALL_CHUNK = 75;
const MULTICALL_SLEEP_MS = 120;

// ───────────────────────── helpers ─────────────────────────

const transferEvent = {
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" },
  ],
} as const satisfies AbiEvent;

const toLower = (x: string) => (x || "").toLowerCase();

// ───────────── Transfers via Etherscan ─────────────

export async function fetchTransfersViaEtherscan(
  address: HexAddr,
  maxPages = 10
): Promise<Transfer[]> {
  if (!ETHERSCAN_KEY) return [];

  const out: Transfer[] = [];
  let page = 1;

  while (page <= maxPages) {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", "8453");
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("address", address);
    url.searchParams.set("page", String(page));
    url.searchParams.set("offset", "1000");
    url.searchParams.set("sort", "asc");
    url.searchParams.set("apikey", ETHERSCAN_KEY);

    const res = await fetch(url.toString(), { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) break;

    const json: any = await res.json().catch(() => ({}));
    const list: any[] = Array.isArray(json?.result) ? json.result : [];
    if (!list.length) break;

    for (const r of list) {
      const tokenAddr = toLower(r?.contractAddress);
      if (!/^0x[0-9a-f]{40}$/.test(tokenAddr)) continue;

      out.push({
        token: tokenAddr as HexAddr,
        from: toLower(r?.from) as HexAddr,
        to: toLower(r?.to) as HexAddr,
        value: BigInt(r?.value ?? "0"),
        block: Number(r?.blockNumber ?? 0),
        ts: Number(r?.timeStamp ?? 0),
        symbol: r?.tokenSymbol || "TKN",
        decimals: Number(r?.tokenDecimal ?? 18),
      });
    }

    if (list.length < 1000) break;
    page++;
    await sleep(80);
  }

  out.sort((a, b) => a.block - b.block || a.ts - b.ts);
  return out;
}

// ───────────── On-chain fallback transfers ─────────────

export async function fetchTransfersBase(address: HexAddr): Promise<Transfer[]> {
  const acct = toLower(address) as HexAddr;
  const latest = await withFallback((c) => c.getBlockNumber());
  const RANGE_SIZE = 200_000n;

  let from = 0n;
  const transfers: Transfer[] = [];

  while (from <= latest) {
    const to = from + RANGE_SIZE < latest ? from + RANGE_SIZE : latest;

    const [outLogs, inLogs] = await Promise.all([
      withFallback((c) =>
        c.getLogs({
          fromBlock: from,
          toBlock: to,
          event: transferEvent,
          args: { from: getAddress(acct) },
        })
      ).catch(() => []),
      withFallback((c) =>
        c.getLogs({
          fromBlock: from,
          toBlock: to,
          event: transferEvent,
          args: { to: getAddress(acct) },
        })
      ).catch(() => []),
    ]);

    for (const log of [...outLogs, ...inLogs]) {
      try {
        const decoded = decodeEventLog({
          abi: erc20Abi,
          data: log.data,
          topics: log.topics as any,
        });
        if (decoded.eventName !== "Transfer") continue;

        const args = decoded.args as { from: Hex; to: Hex; value: bigint };

        transfers.push({
          token: toLower(log.address) as HexAddr,
          from: toLower(args.from) as HexAddr,
          to: toLower(args.to) as HexAddr,
          value: args.value,
          block: Number(log.blockNumber ?? 0n),
          ts: 0,
          symbol: "TKN",
          decimals: 18,
        });
      } catch {}
    }

    from = to + 1n;
    await sleep(LOG_RANGE_SLEEP_MS);
  }

  return transfers;
}

// ───────────── Balances (GoldRush → RPC) ─────────────

export async function fetchBalancesBase(address: HexAddr): Promise<Balance[]> {
  const out: Balance[] = [];
  const tokenSet = new Set<string>();

  for (const t of SEED_TOKENS) tokenSet.add(t);

  const candidates = [...tokenSet] as HexAddr[];

  for (let i = 0; i < candidates.length; i += MULTICALL_CHUNK) {
    const chunk = candidates.slice(i, i + MULTICALL_CHUNK);

    const balanceCalls = chunk.map((token) => ({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }));

    const symbolCalls = chunk.map((token) => ({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    }));

    const decimalsCalls = chunk.map((token) => ({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    }));

    const [balancesRes, symbolsRes, decimalsRes] = await Promise.all([
      withFallback((c) => c.multicall({ contracts: balanceCalls })).catch(() => []),
      withFallback((c) => c.multicall({ contracts: symbolCalls })).catch(() => []),
      withFallback((c) => c.multicall({ contracts: decimalsCalls })).catch(() => []),
    ]);

    for (let j = 0; j < chunk.length; j++) {
      const raw = (balancesRes?.[j] as any)?.result as bigint | undefined;
      if (!raw || raw === 0n) continue;

      out.push({
        token: chunk[j],
        symbol: ((symbolsRes?.[j] as any)?.result as string) ?? "TKN",
        decimals: Number(((decimalsRes?.[j] as any)?.result as number) ?? 18),
        raw,
      });
    }

    await sleep(MULTICALL_SLEEP_MS);
  }

  return out;
}

// ───────────── Prices (DeFiLlama) ─────────────

export async function fetchPriceUSDMap(
  tokens: HexAddr[]
): Promise<Record<string, number>> {
  const uniq = [...new Set(tokens.map((t) => t.toLowerCase()))];
  if (!uniq.length) return {};

  const ids = uniq.map((a) => `base:${a}`).join(",");
  const res = await fetch(`https://coins.llama.fi/prices/current/${ids}`, {
    cache: "no-store",
  });
  if (!res.ok) return {};

  const json = await res.json().catch(() => ({}));
  const out: Record<string, number> = {};

  for (const [key, val] of Object.entries(json.coins || {})) {
    const addrLower = key.split(":")[1];
    if (addrLower && typeof (val as any).price === "number") {
      out[addrLower] = (val as any).price;
    }
  }

  return out;
}
