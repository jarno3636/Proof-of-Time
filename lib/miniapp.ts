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

/** Absolute URL to your Farcaster frame endpoint (fallback embed). */
export function fcEmbedUrl(): string {
  return FARCASTER_MINIAPP_LINK || `${SITE_URL}/frames`;
}

/* ---------------- UA helpers ---------------- */

export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}

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

/* ---------------- Farcaster web composer ---------------- */

export function buildFarcasterComposeUrl({
  text = "",
  embeds = [] as string[],
}: {
  text?: string;
  embeds?: string[];
} = {}): string {
  const url = new URL("https://warpcast.com/~/compose"); // web composer
  if (text) url.searchParams.set("text", text);
  for (const e of embeds || []) {
    const abs = e ? toAbsoluteUrl(e, SITE_URL) : "";
    if (abs) url.searchParams.append("embeds[]", abs);
  }
  return url.toString();
}

/* ---------------- Mini SDK (restored so existing imports build) ---------------- */

/**
 * Tries globals first (fast), then a dynamic import via Function(import)
 * to avoid bundler resolution issues in Next.js/edge, then globals again.
 */
export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === "undefined") return null;

  const g = window as any;
  const globalSdk: MiniAppSdk | null =
    g?.farcaster?.miniapp?.sdk || g?.sdk || null;
  if (globalSdk) return globalSdk;

  try {
    const spec = "@farcaster/miniapp-sdk";
    const importer = (Function("m", "return import(m)")) as (m: string) => Promise<any>;
    const mod = await importer(spec).catch(() => null);
    const fromModule: MiniAppSdk | undefined = mod?.sdk ?? mod?.default;
    if (fromModule) return fromModule;
  } catch {
    // ignore
  }

  return (g?.farcaster?.miniapp?.sdk || g?.sdk || null) as MiniAppSdk | null;
}

/** Call sdk.actions.ready() quickly so mini splash never hangs (no-throw). */
export async function ensureReady(timeoutMs = 900): Promise<void> {
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

/** Legacy-friendly wrapper used by some components (safe to call anywhere). */
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
