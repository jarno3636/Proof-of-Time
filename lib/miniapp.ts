// Minimal Farcaster mini-app helpers used by ShareBar (and future frames)

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "");

// If you ever host a separate frame-only domain, set NEXT_PUBLIC_MINIAPP_URL.
// For now we just reuse the site URL.
export const MINIAPP_URL =
  process.env.NEXT_PUBLIC_MINIAPP_URL ?? SITE_URL;

/** Naive Farcaster UA check (works in Warpcast in-app webview) */
export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Farcaster|Warpcast/i.test(ua);
}

/**
 * Build a Warpcast compose URL with optional embeds.
 * Example: buildFarcasterComposeUrl({ text: "gm", embeds: ["https://site/card.png"] })
 */
export function buildFarcasterComposeUrl(opts: {
  text: string;
  embeds?: string[];
}) {
  const params = new URLSearchParams();
  if (opts.text) params.set("text", opts.text);

  if (opts.embeds && opts.embeds.length) {
    // Warpcast expects multiple "embeds[]" params
    for (const e of opts.embeds) params.append("embeds[]", e);
  }

  return `https://warpcast.com/~/compose?${params.toString()}`;
}

/**
 * Navigate to the compose URL. If you later add Neynar or Frames,
 * you can swap this for a postMessage-based composer.
 */
export function composeCast(url: string) {
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
}
