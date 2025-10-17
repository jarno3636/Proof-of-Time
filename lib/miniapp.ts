// lib/miniapp.ts
/** Farcaster Mini App SDK shape (tolerant to older builds) */
type MiniAppSdk = {
  actions?: {
    openUrl?: (url: string | { url: string }) => Promise<void> | void;
    openURL?: (url: string) => Promise<void> | void; // legacy
    composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
    ready?: () => Promise<void> | void;
  };
  isInMiniApp?: () => boolean;
};

/* ---------------- Env helpers ---------------- */

export const SITE_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SITE_URL) ||
  "https://proofoftime.vercel.app";

export const MINIAPP_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_FC_MINIAPP_URL) ||
  "";

/** Public Farcaster Mini App deeplink (your live mini app page). */
export const FARCASTER_MINIAPP_LINK =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_FC_MINIAPP_LINK) ||
  "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";

/** Prefer dedicated mini host if configured. */
export function miniEntryUrl(): string {
  const base = MINIAPP_URL || SITE_URL;
  try {
    return new URL("/mini", base).toString();
  } catch {
    return `${SITE_URL}/mini`;
  }
}

/** Prefer Farcaster directory link for in-app embeds; else fall back. */
export function fcEmbedUrl(): string {
  if (FARCASTER_MINIAPP_LINK) return FARCASTER_MINIAPP_LINK;
  try {
    return new URL("/frames", SITE_URL).toString();
  } catch {
    return `${SITE_URL}/frames`;
  }
}

/* ---------------- UA heuristics ---------------- */

export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}

export function isBaseAppUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /BaseWallet|Base\sApp|Base\/\d|CoinbaseWallet|CoinbaseMobile|CoinbaseApp|CBBrowser|CBWallet|Coinbase(Android|iOS)?/i.test(
    ua
  );
}

/** Simple mobile UA check (for general decisions) */
export function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod|Android|Mobile|CriOS|FxiOS/i.test(ua);
}

/* ---------------- URL helpers ---------------- */

function toAbsoluteUrl(input: string, base = SITE_URL): string {
  try {
    return new URL(input, base).toString();
  } catch {
    try {
      return new URL(base).toString();
    } catch {
      return SITE_URL;
    }
  }
}

/** Prefer Mini App URL inside Warpcast; else normal site (absolute). */
export function fcPreferMini(pathOrAbs = ""): string {
  const base = isFarcasterUA() && MINIAPP_URL ? MINIAPP_URL : SITE_URL;
  const absBase = toAbsoluteUrl(base);
  if (!pathOrAbs) return absBase;
  if (/^https?:\/\//i.test(pathOrAbs)) return pathOrAbs;
  const sep = pathOrAbs.startsWith("/") ? "" : "/";
  return `${absBase}${sep}${pathOrAbs}`;
}

/* ---------------- Farcaster composer helpers ---------------- */

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
    const abs = e ? toAbsoluteUrl(e, SITE_URL) : "";
    if (abs) url.searchParams.append("embeds[]", abs);
  }
  return url.toString();
}

/* ---------------- SDK loaders ---------------- */

/**
 * Tries globals first (fast), then a dynamic import via Function(import) to
 * avoid bundler resolution issues in Next.js/edge, then globals again.
 */
export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === "undefined") return null;

  // 1) Fast path: globals injected by Warpcast
  const g = window as any;
  const globalSdk: MiniAppSdk | null = g?.farcaster?.miniapp?.sdk || g?.sdk || null;
  if (globalSdk) return globalSdk;

  // 2) Dynamic import without bundler resolution
  try {
    const spec = "@farcaster/miniapp-sdk";
    const importer = (Function("m", "return import(m)")) as (m: string) => Promise<any>;
    const mod = await importer(spec).catch(() => null);
    const fromModule: MiniAppSdk | undefined = mod?.sdk ?? mod?.default;
    if (fromModule) return fromModule;
  } catch {
    // ignore
  }

  // 3) Fallback to any late-populated globals
  return (g?.farcaster?.miniapp?.sdk || g?.sdk || null) as MiniAppSdk | null;
}

/** Call sdk.actions.ready() quickly so we never hang splash */
export async function ensureReady(timeoutMs = 1200): Promise<void> {
  try {
    const sdk = await getMiniSdk();
    if (!sdk?.actions?.ready) return;
    await Promise.race<void>([
      Promise.resolve(sdk.actions.ready()),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // noop
  }
}

/** Soft wrapper that also pings legacy globals if present. Safe to call anywhere. */
export async function signalMiniAppReady(): Promise<void> {
  try {
    await ensureReady(900);
  } catch {}
  try {
    (window as any)?.farcaster?.actions?.ready?.();
  } catch {}
  try {
    (window as any)?.farcaster?.miniapp?.sdk?.actions?.ready?.();
  } catch {}
}

/* ===================== Base App (MiniKit globals) ===================== */

function getMiniKit(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w?.miniKit || w?.coinbase?.miniKit || null;
}

async function tryBaseComposeCast(args: { text?: string; embeds?: string[] }) {
  if (!isBaseAppUA()) return false;
  try {
    const mk = getMiniKit();
    if (mk?.composeCast) {
      await mk.composeCast(args);
      return true;
    }
  } catch {
    // noop
  }
  return false;
}

/**
 * Try to open a URL natively (Base MiniKit ➜ Farcaster SDK).
 * Returns true if handled natively; false if the caller should fallback to window.open / router push.
 */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;
  const safe = toAbsoluteUrl(url, SITE_URL);

  // 1) Base App MiniKit
  try {
    const mk = getMiniKit();
    if (mk?.openUrl) {
      await mk.openUrl(safe);
      return true;
    }
    if (mk?.openURL) {
      await mk.openURL(safe);
      return true;
    }
  } catch {
    // noop
  }

  // 2) Farcaster Mini App SDK (Warpcast)
  try {
    const sdk = await getMiniSdk();
    if (sdk?.actions?.openUrl) {
      try {
        await (sdk.actions.openUrl as any)(safe);
      } catch {
        await (sdk.actions.openUrl as any)({ url: safe });
      }
      return true;
    }
    if (sdk?.actions?.openURL) {
      await sdk.actions.openURL(safe);
      return true;
    }
  } catch {
    // noop
  }

  // 3) Not handled
  return false;
}

/**
 * Compose everywhere:
 * - Inside Warpcast (Mini App): sdk.actions.composeCast (official) 
 * - Else: open Warpcast web composer (works on mobile & desktop)
 */
export async function composeCastEverywhere({
  text = "",
  embeds = [] as string[],
}: {
  text?: string;
  embeds?: string[];
} = {}): Promise<"sdk" | "web"> {
  const normalized = (embeds || []).map((e) => toAbsoluteUrl(e, SITE_URL));

  // 1) Try Base MiniKit bridge (if user is inside Base app WebView)
  if (await tryBaseComposeCast({ text, embeds: normalized })) {
    return "sdk";
  }

  // 2) Try official Mini App SDK inside Warpcast
  try {
    const sdk = await getMiniSdk();
    if (sdk?.actions?.composeCast && isFarcasterUA()) {
      await ensureReady();
      await sdk.actions.composeCast({ text, embeds: normalized });
      return "sdk";
    }
  } catch {
    // fallthrough to web
  }

  // 3) Fallback to Warpcast web composer
  const url = buildFarcasterComposeUrl({ text, embeds: normalized });
  if (typeof window !== "undefined") {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  }
  return "web";
}
