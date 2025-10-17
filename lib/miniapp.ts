// lib/miniapp.ts

/** Farcaster Mini App SDK shape (kept) */
type MiniAppSdk = {
  actions?: {
    openUrl?: (url: string | { url: string }) => Promise<void> | void;
    openURL?: (url: string) => Promise<void> | void;
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

/** Absolute URL helpers (kept) */
function toAbsoluteUrl(input: string, base = SITE_URL): string {
  try { return new URL(input, base).toString(); }
  catch { try { return new URL(base).toString(); } catch { return SITE_URL; } }
}

/* ---------------- UA helpers (kept) ---------------- */
export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}
export function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android|Mobile|CriOS|FxiOS/i.test(navigator.userAgent);
}

/* ---------------- Composer URL (use this everywhere) ---------------- */
export function buildFarcasterComposeUrl({
  text = "",
  embeds = [] as string[],
}: { text?: string; embeds?: string[] } = {}): string {
  const url = new URL("https://warpcast.com/~/compose");
  if (text) url.searchParams.set("text", text);
  for (const e of embeds || []) {
    const abs = e ? toAbsoluteUrl(e, SITE_URL) : "";
    if (abs) url.searchParams.append("embeds[]", abs);
  }
  return url.toString();
}
