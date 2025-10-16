// lib/miniapp.ts
// MiniApp helpers with ZERO hard dependency on external SDKs.
// Works in Warpcast MiniApp if available, otherwise falls back to web.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "");

export const MINIAPP_URL =
  process.env.NEXT_PUBLIC_MINIAPP_URL ?? SITE_URL;

/** Detect MiniApp runtime via global (preferred) or UA (fallback). */
export function isMiniApp(): boolean {
  const g: any = typeof window !== "undefined" ? (window as any) : undefined;
  const hasGlobal = !!g?.farcaster?.miniapp || !!g?.miniapp;
  if (hasGlobal) return true;
  if (typeof navigator !== "undefined") {
    return /Farcaster|Warpcast/i.test(navigator.userAgent || "");
  }
  return false;
}

/** Safely access the MiniApp SDK if injected by Warpcast. */
function getMiniApp() {
  const g: any = typeof window !== "undefined" ? (window as any) : undefined;
  // Warpcast commonly puts it on window.farcaster.miniapp
  return g?.farcaster?.miniapp || g?.miniapp || null;
}

/** Let the container know we're ready (no-op in normal browsers). */
export async function signalMiniAppReady() {
  try {
    const mini = getMiniApp();
    await mini?.actions?.ready?.();
  } catch {
    // ignore
  }
}

/** Build Warpcast web composer URL (fallback when native composer not available). */
export function buildFarcasterComposeUrl(opts: { text: string; embeds?: string[] }) {
  const params = new URLSearchParams();
  if (opts.text) params.set("text", opts.text);
  if (opts.embeds?.length) {
    for (const e of opts.embeds) params.append("embeds[]", e);
  }
  return `https://warpcast.com/~/compose?${params.toString()}`;
}

/**
 * Compose a cast:
 * - If inside MiniApp with native composer → uses it.
 * - Else → falls back to Warpcast web composer URL.
 */
export function composeCast(arg: string | { text: string; embeds?: string[] }) {
  const mini = getMiniApp();
  const isObj = typeof arg === "object";
  const text = isObj ? (arg.text || "") : "";
  const embeds = isObj ? arg.embeds : undefined;

  if (mini?.actions?.composeCast) {
    // Use native miniapp composer (keeps users inside Warpcast)
    return mini.actions.composeCast({ text, embeds });
  }

  // Fallback: open Warpcast web composer (new tab / redirect)
  const url = isObj ? buildFarcasterComposeUrl({ text, embeds }) : arg;
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
}
