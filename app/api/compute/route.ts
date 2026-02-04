import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

import { computePerTokenStats } from "@/lib/proofOfTime";
import { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";
import {
  fetchBalancesBase,
  fetchTransfersBase,
  fetchTransfersViaEtherscan,
  fetchPriceUSDMap,
} from "@/lib/data";

/* ───────────────────────── Config ───────────────────────── */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

const UPSTREAM_TIMEOUT_MS = 15_000;
const TRANSFER_PAGE_SIZE = 1000;
const MAX_TRANSFER_PAGES = 6;

/* ───────────────────────── Utils ───────────────────────── */

function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), ms)
    ),
  ]);
}

function sanitizeErr(e: unknown) {
  return {
    name: String((e as any)?.name || ""),
    message: String((e as any)?.message || e),
    code: String((e as any)?.code || ""),
  };
}

/* ───────────────────────── Alchemy Client ───────────────────────── */

function getAlchemy() {
  if (!ALCHEMY_KEY) return null;
  return new Alchemy({
    apiKey: ALCHEMY_KEY,
    network: Network.BASE_MAINNET,
  });
}

/* ───────────────────────── Alchemy Fetchers ───────────────────────── */

async function fetchBalancesAlchemy(
  alchemy: Alchemy,
  address: HexAddr
): Promise<Balance[]> {
  const res = await withTimeout(
    alchemy.core.getTokenBalances(address),
    UPSTREAM_TIMEOUT_MS
  );

  const raw = Array.isArray((res as any)?.tokenBalances)
    ? (res as any).tokenBalances
    : [];

  const out: Balance[] = [];

  for (const tb of raw) {
    if (!tb?.tokenBalance || tb.tokenBalance === "0") continue;
    const token = String(tb.contractAddress || "").toLowerCase();
    if (!token.startsWith("0x")) continue;

    let rawBal = 0n;
    try {
      rawBal = BigInt(tb.tokenBalance);
    } catch {
      continue;
    }

    let symbol = "TKN";
    let decimals = 18;

    try {
      const meta = await alchemy.core.getTokenMetadata(token);
      if (meta?.symbol) symbol = meta.symbol;
      if (typeof meta?.decimals === "number") decimals = meta.decimals;
    } catch {
      /* metadata is best-effort */
    }

    out.push({
      token: token as HexAddr,
      symbol,
      decimals,
      raw: rawBal,
    });
  }

  return out;
}

async function fetchTransfersAlchemy(
  alchemy: Alchemy,
  address: HexAddr
): Promise<Transfer[]> {
  const out: Transfer[] = [];

  async function fetchDir(params: {
    fromAddress?: HexAddr;
    toAddress?: HexAddr;
  }) {
    let pageKey: string | undefined;
    let pages = 0;

    while (pages < MAX_TRANSFER_PAGES) {
      pages++;

      const res = await withTimeout(
        alchemy.core.getAssetTransfers({
          category: [AssetTransfersCategory.ERC20],
          excludeZeroValue: true,
          withMetadata: true,
          maxCount: TRANSFER_PAGE_SIZE,
          pageKey,
          ...params,
        } as any),
        UPSTREAM_TIMEOUT_MS
      );

      const transfers = Array.isArray((res as any)?.transfers)
        ? (res as any).transfers
        : [];

      for (const t of transfers) {
        const token = String(t?.rawContract?.address || "").toLowerCase();
        if (!token.startsWith("0x")) continue;

        const from = String(t.from || "").toLowerCase();
        const to = String(t.to || "").toLowerCase();
        if (!from.startsWith("0x") || !to.startsWith("0x")) continue;

        let value = 0n;
        try {
          value = BigInt(String(t.rawContract?.value || "0"));
        } catch {
          continue;
        }

        const ts = t.metadata?.blockTimestamp
          ? Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000)
          : 0;

        out.push({
          token: token as HexAddr,
          from: from as HexAddr,
          to: to as HexAddr,
          value,
          block: parseInt(t.blockNum, 16) || 0,
          ts,
          symbol: t.asset || "TKN",
          decimals: Number(t.rawContract?.decimal ?? 18),
        });
      }

      pageKey = (res as any)?.pageKey;
      if (!pageKey) break;
    }
  }

  await Promise.all([
    fetchDir({ fromAddress: address }),
    fetchDir({ toAddress: address }),
  ]);

  out.sort((a, b) => a.block - b.block || a.ts - b.ts);
  return out;
}

/* ───────────────────────── POST /api/compute ───────────────────────── */

export async function POST(req: NextRequest) {
  /* 1️⃣ Parse address */
  let address: HexAddr;
  try {
    const body = await req.json().catch(() => ({}));
    const raw =
      body?.address ||
      new URL(req.url).searchParams.get("address") ||
      "";

    if (!isHexAddress(raw)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    address = raw.toLowerCase() as HexAddr;
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  /* 2️⃣ Supabase (write-only cache) */
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  supabase.from("wallets").upsert({ address }).catch(() => {});

  /* 3️⃣ Fetch balances (Alchemy → Backup) */
  let balances: Balance[] = [];
  let balancesFailed = false;
  let alchemyAttempted = false;
  let sourceBalances = "none";

  const alchemy = getAlchemy();

  if (alchemy) {
    alchemyAttempted = true;
    try {
      balances = await fetchBalancesAlchemy(alchemy, address);
      sourceBalances = "alchemy";
      console.log("[compute] balances via alchemy", balances.length);
    } catch (e) {
      balancesFailed = true;
      console.warn("[compute] alchemy balances failed", sanitizeErr(e));
    }
  }

  if (!balances.length && balancesFailed) {
    try {
      balances = await fetchBalancesBase(address);
      sourceBalances = "base_backup";
      balancesFailed = false;
    } catch (e) {
      console.error("[compute] base backup balances failed", sanitizeErr(e));
    }
  }

  if (balancesFailed) {
    return NextResponse.json(
      { error: "Unable to verify on-chain balances right now. Please retry." },
      { status: 503 }
    );
  }

  /* 4️⃣ Fetch transfers (best-effort) */
  let transfers: Transfer[] = [];
  let sourceTransfers = "none";

  if (alchemy) {
    try {
      transfers = await fetchTransfersAlchemy(alchemy, address);
      sourceTransfers = "alchemy";
    } catch {
      transfers = [];
    }
  }

  if (!transfers.length) {
    try {
      transfers =
        (await fetchTransfersViaEtherscan(address)) ||
        (await fetchTransfersBase(address));
      sourceTransfers = transfers.length ? "base_backup" : "none";
    } catch {
      transfers = [];
    }
  }

  /* 5️⃣ Prices (best-effort) */
  let priceMap: Record<string, number> = {};
  try {
    priceMap = await fetchPriceUSDMap(balances.map((b) => b.token));
  } catch {}

  /* 6️⃣ Compute */
  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const s = computePerTokenStats(
      address,
      b.token,
      transfers,
      b,
      priceMap[b.token.toLowerCase()]
    );
    if (s) stats.push(s);
  }

  /* 7️⃣ Persist */
  if (stats.length) {
    supabase
      .from("token_holdings")
      .upsert(
        stats.map((s) => ({
          address,
          token_address: s.token_address.toLowerCase(),
          symbol: s.symbol,
          decimals: s.decimals,
          first_acquired_ts: s.first_acquired_ts,
          last_full_exit_ts: s.last_full_exit_ts,
          last_sell_ts: s.last_sell_ts,
          held_since: s.held_since,
          continuous_hold_days: s.continuous_hold_days,
          no_sell_streak_days: s.no_sell_streak_days,
          never_sold: s.never_sold,
          balance_numeric: s.balance_numeric,
          time_score: s.time_score,
          last_computed_at: new Date().toISOString(),
        })),
        { onConflict: "address,token_address" }
      )
      .catch(() => {});
  }

  /* 8️⃣ Respond */
  return NextResponse.json({
    address,
    count: stats.length,
    meta: {
      alchemyAttempted,
      sourceBalances,
      sourceTransfers,
      balances: balances.length,
      transfers: transfers.length,
    },
  });
}
