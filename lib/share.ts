// lib/share.ts
import { composeCast, composeCastEverywhere, safeUrl } from "./miniapp";

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
 * 1) Try in-app compose via SDK (Farcaster).
 * 2) Else open Warpcast web composer (single route, no miniapp deeplinks).
 */
export async function shareOrCast({
  text = "",
  embeds = [],
  url = "",
}: {
  text?: string;
  embeds?: string[];
  url?: string;   // canonical HTTPS URL to include in the text
}) {
  const fullText = url && !String(text).includes(url) ? `${text}\n${url}`.trim() : (text || "").trim();

  const ok = await composeCast({ text: fullText, embeds: normEmbeds(embeds) });
  if (ok) return true;

  await composeCastEverywhere({ text: fullText, embeds: normEmbeds(embeds) });
  return true;
}
