// Enhanced Farcaster Mini-App helpers for Proof of Time
// Works with Warpcast, Neynar, or the upcoming @farcaster/miniapp-sdk.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "");

// If you ever host a separate frame-only domain, set NEXT_PUBLIC_MINIAPP_URL.
// For now we reuse the main site URL.
export const MINIAPP_URL =
  process.env.NEXT_PUBLIC_MINIAPP_URL ?? SITE_URL;

/** Detect if running inside Warpcast or Farcaster in-app webview. */
export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Farcaster|Warpcast/i.test(ua);
}

/** Build a Warpcast compose URL with optional embeds. */
export function buildFarcasterComposeUrl(opts: { text?: string; embeds?: string[] }) {
  const params = new URLSearchParams();
  if (opts.text) params.set("text", opts.text);
  (opts.embeds ?? []).forEach((e) => params.append("embeds[]", e));
  return `https://warpcast.com/~/compose?${params.toString()}`;
}

/**
 * Compose a cast, preferring Farcaster MiniApp SDK if present,
 * otherwise opening the Warpcast composer as fallback.
 */
export async function composeCast(opts: { text?: string; embeds?: string[] }) {
  if (typeof window === "undefined") return;

  try {
    const miniapp = (await import("@farcaster/miniapp-sdk")).default;

    // If running inside Warpcast or MiniApp webview, prefer native composer
    if (miniapp?.isInMiniApp?.() || isFarcasterUA()) {
      await miniapp?.actions?.composeCast?.(opts);
      return;
    }
  } catch {
    // Ignore — fallback below
  }

  // Fallback: open the Warpcast web composer
  const url = buildFarcasterComposeUrl(opts);
  window.location.href = url;
}

/** Optional helper to mark readiness when running as a MiniApp. */
export async function signalMiniAppReady() {
  if (typeof window === "undefined") return;
  try {
    const miniapp = (await import("@farcaster/miniapp-sdk")).default;
    await miniapp?.actions?.ready?.();
  } catch {
    /* no-op */
  }
}
