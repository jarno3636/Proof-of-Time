// lib/data.ts
import { Balance, HexAddr, Transfer } from "./types";
import { createPublicClient, http, Hex, getAddress } from "viem";
import type { AbiEvent } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

// ---- ENV + setup ------------------------------------------------------------

const INFURA_KEY = process.env.INFURA_API_KEY!;
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || "";
const GOLD_KEY = process.env.COVALENT_API_KEY || "";
const SEED_ENV = (process.env.BASE_SEED_TOKENS || "").trim();

const DEFAULT_SEEDS = [
  // USDC + WETH (Base mainnet)
  "0x833589fCD6EDB6E08f4c7C32D4f41f182e88C0A4",
  "0x4200000000000000000000000000000000000006",
];

const SEED_TOKENS: HexAddr[] = [
  ...DEFAULT_SEEDS,
  ...SEED_ENV.split(",").map(s => s.trim()).filter(Boolean),
].map(a => a.toLowerCase()) as HexAddr[];

if (!INFURA_KEY) console.warn("⚠️ INFURA_API_KEY missing – set it in Vercel env.");

const client = createPublicClient({
  chain: base,
  transport: http(`https://base-mainnet.infura.io/v3/${INFURA_KEY}`),
});

// (Keep topic constant around for reference if needed elsewhere)
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as Hex;

// viem@2: provide a literal-typed Transfer event for getLogs({ event })
const transferEvent = {
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true,  name: "from",  type: "address" },
    { indexed: true,  name: "to",    type: "address" },
    { indexed: false, name: "value", type: "uint256" },
  ],
} as const satisfies AbiEvent;

const toLower = (x: string) => (x || "").toLowerCase();
async function safeRead<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

// ---- Etherscan V2 token discovery ------------------------------------------

async function discoverTokensViaEtherscanV2All(address: HexAddr, maxPages = 25): Promise<HexAddr[]> {
  if (!ETHERSCAN_KEY) return [];
  const addrs = new Set<string>();
  let page = 1;

  while (page <= maxPages) {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", "8453");          // Base
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
      const ca = toLower(r?.contractAddress);
      if (ca && /^0x[0-9a-f]{40}$/.test(ca)) addrs.add(ca);
    }

    if (list.length < 1000) break;
    page++;
  }
  return [...addrs] as HexAddr[];
}

// ---- GoldRush (Covalent) balances fallback ---------------------------------

async function discoverViaGoldRush(address: HexAddr): Promise<
  { token: HexAddr; symbol: string; decimals: number; raw: bigint }[]
> {
  if (!GOLD_KEY) return [];
  const urls = [
    `https://api.covalenthq.com/v1/allchains/address/${address}/balances/?chains=8453&key=${GOLD_KEY}`,
    `https://api.covalenthq.com/v1/8453/address/${address}/balances_v2/?nft=false&no-nft-fetch=true&key=${GOLD_KEY}`,
  ];

  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) continue;

    const json: any = await res.json().catch(() => ({}));
    const items: any[] =
      json?.data?.items ||
      json?.data?.items?.[8453] ||
      [];

    const out: { token: HexAddr; symbol: string; decimals: number; raw: bigint }[] = [];
    for (const it of items) {
      const addr = (it?.contract_address || it?.address || "").toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(addr)) continue;
      const rawStr = String(it?.balance ?? it?.balance_wei ?? "0");
      let raw = 0n; try { raw = BigInt(rawStr); } catch {}
      if (raw === 0n) continue;

      const symbol = it?.contract_ticker_symbol || it?.symbol || "TKN";
      const decimals = typeof it?.contract_decimals === "number"
        ? it.contract_decimals
        : (typeof it?.decimals === "number" ? it.decimals : 18);

      out.push({ token: addr as HexAddr, symbol, decimals, raw });
    }
    if (out.length) return out;
  }
  return [];
}

// ---- On-chain Transfer logs (truth; slower) --------------------------------

export async function fetchTransfersBase(address: HexAddr): Promise<Transfer[]> {
  const acct = toLower(address) as HexAddr;
  const latest = await client.getBlockNumber();
  const RANGE_SIZE = 200_000n;
  let from = 0n;
  const transfers: Transfer[] = [];

  while (from <= latest) {
    const to = (from + RANGE_SIZE < latest) ? (from + RANGE_SIZE) : latest;

    // viem@2: use event + args (no raw topics)
    const [outLogs, inLogs] = await Promise.all([
      client.getLogs({
        fromBlock: from,
        toBlock: to,
        event: transferEvent,
        args: { from: getAddress(acct) }
      }).catch(() => []),
      client.getLogs({
        fromBlock: from,
        toBlock: to,
        event: transferEvent,
        args: { to: getAddress(acct) }
      }).catch(() => []),
    ]);

    for (const log of [...outLogs, ...inLogs] as any[]) {
      const args = (log as any).args as { from: Hex; to: Hex; value: bigint } | undefined;
      if (!args) continue;
      transfers.push({
        token: toLower((log as any).address) as HexAddr,
        from: toLower(args.from) as HexAddr,
        to: toLower(args.to) as HexAddr,
        value: args.value,
        block: Number((log as any).blockNumber ?? 0n),
        ts: 0,
        symbol: "TKN",
        decimals: 18,
      });
    }
    from = to + 1n;
  }

  // Attach timestamps
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

// ---- Balances + metadata (Infura + GoldRush + Etherscan) -------------------

export async function fetchBalancesBase(address: HexAddr): Promise<Balance[]> {
  // 1) From logs
  const txs = await fetchTransfersBase(address);
  const tokenSet = new Set<string>(txs.map(t => t.token));

  // 2) From Etherscan (paged)
  const es = await discoverTokensViaEtherscanV2All(address);
  for (const a of es) tokenSet.add(a.toLowerCase());

  // 3) From seed list
  for (const a of SEED_TOKENS) tokenSet.add(a);

  // 4) From GoldRush (complete balances)
  const gr = await discoverViaGoldRush(address);
  for (const g of gr) tokenSet.add(g.token);

  const candidates = [...tokenSet] as HexAddr[];
  if (!candidates.length) return [];

  const grMap = new Map(gr.map(x => [x.token, x]));
  const toMulticall = candidates.filter(t => !grMap.has(t));
  const out: Balance[] = [];

  // Use GoldRush data directly
  for (const x of gr) {
    out.push({ token: x.token, symbol: x.symbol, decimals: x.decimals, raw: x.raw });
  }

  // Fallback: on-chain reads
  if (toMulticall.length) {
    const balanceCalls = toMulticall.map(token => ({
      address: token as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [address],
    }) as const);
    const symbolCalls = toMulticall.map(token => ({
      address: token as `0x${string}`, abi: erc20Abi, functionName: "symbol",
    }) as const);
    const decimalsCalls = toMulticall.map(token => ({
      address: token as `0x${string}`, abi: erc20Abi, functionName: "decimals",
    }) as const);

    const [balancesRes, symbolsRes, decimalsRes] = await Promise.all([
      client.multicall({ contracts: balanceCalls }).catch(() => []),
      client.multicall({ contracts: symbolCalls }).catch(() => []),
      client.multicall({ contracts: decimalsCalls }).catch(() => []),
    ]);

    for (let i = 0; i < toMulticall.length; i++) {
      const token = toMulticall[i];
      const raw = (balancesRes?.[i]?.result as bigint) ?? 0n;
      if (raw === 0n) continue;
      const symbol = (symbolsRes?.[i]?.result as string) ?? "TKN";
      const decimals = Number((decimalsRes?.[i]?.result as number) ?? 18);
      out.push({ token, symbol, decimals, raw });
    }
  }
  return out;
}

// ---- Prices (DeFiLlama) ----------------------------------------------------

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
