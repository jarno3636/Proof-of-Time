// lib/miniapp.ts

/** Minimal types for the SDKs (tolerant to older builds) */
export type MiniAppSdk = {
  actions?: {
    // Navigation
    openUrl?: (url: string | { url: string }) => Promise<void> | void;
    openURL?: (url: string) => Promise<void> | void; // legacy

    // Compose / share
    composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
    share?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void; // frame-sdk

    // Ready
    ready?: () => Promise<void> | void;
  };
};

/* ---------------- Env + URL helpers ---------------- */
export function siteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://proofoftime.vercel.app";
}

export function safeUrl(u = ""): string {
  try {
    return new URL(String(u || ""), siteOrigin()).toString();
  } catch {
    return "";
  }
}

function toAbsoluteHttpUrl(u = ""): string {
  const abs = safeUrl(u);
  return /^https?:\/\//i.test(abs) ? abs : "";
}

/** UA helper kept for back-compat (Nav.tsx, AutoConnectMini.tsx) */
export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent || "");
}

/* ---------------- Warpcast web composer URL ---------------- */
export function buildFarcasterComposeUrl({
  text = "",
  embeds = [] as string[],
}: {
  text?: string;
  embeds?: string[];
} = {}): string {
  const url = new URL("https://warpcast.com/~/compose");
  if (text) url.searchParams.set("text", text);
  for (const e of embeds || []) {
    const abs = toAbsoluteHttpUrl(e);
    if (abs) url.searchParams.append("embeds[]", abs);
  }
  return url.toString();
}

/* ---------------- Dynamic SDK loaders ---------------- */
async function getGlobalSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === "undefined") return null;
  const g = window as any;
  return g?.farcaster?.miniapp?.sdk || g?.farcaster?.actions || g?.sdk || null;
}

async function tryImport<T = any>(spec: string): Promise<T | null> {
  try {
    const importer = Function("m", "return import(m)") as (m: string) => Promise<any>;
    const mod = await importer(spec);
    return (mod?.sdk ?? mod?.default ?? mod) as T;
  } catch {
    return null;
  }
}

export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  const global = await getGlobalSdk();
  if (global) return global;
  const fromModule = await tryImport<MiniAppSdk>("@farcaster/miniapp-sdk");
  return (fromModule as any) || null;
}

export async function getFrameSdk(): Promise<MiniAppSdk | null> {
  const global = await getGlobalSdk();
  if (global) return global;
  const fromModule = await tryImport<MiniAppSdk>("@farcaster/frame-sdk");
  return (fromModule as any) || null;
}

/** Ready ping — safe anywhere */
export async function ensureReady(timeoutMs = 1200): Promise<void> {
  try {
    const sdk = (await getFrameSdk()) || (await getMiniSdk());
    if (!sdk?.actions?.ready) return;
    await Promise.race<void>([
      Promise.resolve(sdk.actions.ready()),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {}
}

export async function signalMiniAppReady(): Promise<void> {
  try { await ensureReady(900); } catch {}
  try { (window as any)?.farcaster?.actions?.ready?.(); } catch {}
  try { (window as any)?.farcaster?.miniapp?.sdk?.actions?.ready?.(); } catch {}
}

/* ---------------- (Optional) Base App MiniKit bridge ---------------- */
function getMiniKit(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w?.miniKit || w?.coinbase?.miniKit || null;
}

async function tryBaseComposeCast(args: { text?: string; embeds?: string[] }) {
  try {
    const mk = getMiniKit();
    if (mk?.composeCast) {
      await mk.composeCast(args);
      return true;
    }
  } catch {}
  return false;
}

/* ---------------- Compose helpers ---------------- */
function onlyHttpEmbeds(list?: string[]) {
  return (list || []).map(toAbsoluteHttpUrl).filter(Boolean);
}

/** Try to compose a cast inside Warpcast/Base first. */
export async function composeCast({
  text = "",
  embeds = [],
}: {
  text?: string;
  embeds?: string[];
} = {}): Promise<boolean> {
  const norm = onlyHttpEmbeds(embeds);

  // Base App (if present)
  if (await tryBaseComposeCast({ text, embeds: norm })) return true;

  // Newer frame-sdk
  const frame = await getFrameSdk();
  if (frame?.actions?.share) {
    try { await ensureReady(); await frame.actions.share({ text, embeds: norm }); return true; } catch {}
  }
  if (frame?.actions?.composeCast) {
    try { await ensureReady(); await frame.actions.composeCast({ text, embeds: norm }); return true; } catch {}
  }

  // Mini app sdk
  const mini = await getMiniSdk();
  if (mini?.actions?.composeCast) {
    try { await ensureReady(); await mini.actions.composeCast({ text, embeds: norm }); return true; } catch {}
  }

  return false;
}

/** Compose everywhere: SDK first; else open web composer (single route). */
export async function composeCastEverywhere({
  text = "",
  embeds = [],
}: {
  text?: string;
  embeds?: string[];
} = {}): Promise<"sdk" | "web"> {
  const ok = await composeCast({ text, embeds });
  if (ok) return "sdk";

  const url = buildFarcasterComposeUrl({ text, embeds });
  if (typeof window !== "undefined") {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  }
  return "web";
}

/* ---------------- Optional: openInMini ---------------- */
export async function openInMini(url: string): Promise<boolean> {
  const safe = safeUrl(url);
  if (!safe) return false;

  // 1) Base App bridge
  try {
    const mk = getMiniKit();
    if (mk?.openUrl) { await mk.openUrl(safe); return true; }
    if (mk?.openURL) { await mk.openURL(safe); return true; }
  } catch {}

  // 2) Farcaster runtimes
  try {
    const frame = await getFrameSdk();
    if (frame?.actions?.openUrl) {
      try { await (frame.actions.openUrl as any)(safe); }
      catch { await (frame.actions.openUrl as any)({ url: safe }); }
      return true;
    }
    if (frame?.actions?.openURL) { await frame.actions.openURL(safe); return true; }

    const mini = await getMiniSdk();
    if (mini?.actions?.openUrl) {
      try { await (mini.actions.openUrl as any)(safe); }
      catch { await (mini.actions.openUrl as any)({ url: safe }); }
      return true;
    }
    if (mini?.actions?.openURL) { await mini.actions.openURL(safe); return true; }
  } catch {}

  // 3) Fallback: same-tab nav
  if (typeof window !== "undefined") {
    try { window.location.assign(safe); return true; } catch {}
    try { window.open(safe, "_self", "noopener,noreferrer"); return true; } catch {}
  }
  return false;
}
