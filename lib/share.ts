// lib/share.ts
import {
  composeCast,
  composeCastEverywhere,
  safeUrl,
  buildFarcasterComposeUrl, // kept for compatibility
} from "./miniapp";

/** Normalize embeds to plain http(s) only. */
function normEmbeds(embeds?: string | string[]) {
  if (!embeds) return [] as string[];
  const list = Array.isArray(embeds) ? embeds : [embeds];
  return list
    .map((e) => safeUrl(e))
    .filter(Boolean)
    .filter((u) => /^https?:\/\//i.test(u));
}

/**
 * High-level share:
 * 1) Try in-app compose via SDK (Farcaster/Base).
 * 2) Else open Warpcast web composer (single route, no miniapp deeplinks).
 */
export async function shareOrCast({
  text = "",
  embeds = [],
  url = "",
}: {
  text?: string;
  embeds?: string[];
  url?: string; // canonical HTTPS URL to include after the text
}) {
  const fullText =
    url && !String(text).includes(url) ? `${text}\n${url}`.trim() : (text || "").trim();

  const ok = await composeCast({ text: fullText, embeds: normEmbeds(embeds) });
  if (ok) return true;

  await composeCastEverywhere({ text: fullText, embeds: normEmbeds(embeds) });
  return true;
}

/* ---------------- Back-compat helpers for older components ---------------- */

/** Build Warpcast web composer URL (kept so older imports don’t break). */
export function buildWarpcastCompose({
  url = "",
  text = "",
  embeds = [],
}: {
  url?: string;
  text?: string;
  embeds?: string[];
}) {
  const wcText = url && !(text || "").includes(url) ? `${text} ${url}`.trim() : (text || "").trim();
  return buildFarcasterComposeUrl({ text: wcText, embeds: normEmbeds(embeds) });
}

/** Open a share window (simple wrapper; prefer shareOrCast). */
export async function openShareWindow(href: string) {
  if (!href) return;
  if (typeof window !== "undefined") {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }
}
