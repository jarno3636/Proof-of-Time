/// lib/miniapp.ts

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

/* ---------------- URL helpers ---------------- */
function toAbsoluteUrl(input: string, base = SITE_URL): string {
  try { return new URL(input, base).toString(); }
  catch { try { return new URL(base).toString(); } catch { return SITE_URL; } }
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
export function buildFarcasterComposeUrl({ text = "", embeds = [] as string[] } = {}): string {
  const url = new URL("https://warpcast.com/~/compose");
  if (text) url.searchParams.set("text", text);
  for (const e of embeds || []) url.searchParams.append("embeds[]", toAbsoluteUrl(e, SITE_URL));
  return url.toString();
}

/* ---------------- SDK loaders ---------------- */
export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === "undefined") return null;

  // 1) Try global injection first (fast path in many builds)
  const g = window as any;
  const globalSdk: MiniAppSdk | null =
    g?.farcaster?.miniapp?.sdk || g?.sdk || null;
  if (globalSdk) return globalSdk;

  // 2) Try a truly dynamic import at runtime WITHOUT bundler resolution.
  //    Using Function('return import(...)') avoids webpack/vite resolving it at build time.
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
    if (mk?.composeCast) { await mk.composeCast(args); return true; }
  } catch {}
  return false;
}
/** Try to open a URL natively (Base MiniKit ➜ Farcaster SDK) */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;
  const safe = toAbsoluteUrl(url, SITE_URL);
  try {
    const mk = getMiniKit();
    if (mk?.openUrl) { await mk.openUrl(safe); return true; }
    if (mk?.openURL) { await mk.openURL(safe); return true; }
  } catch {}
  try {
    const sdk = await getMiniSdk();
    if (sdk?.actions?.openUrl) {
      try { await (sdk.actions.openUrl as any)(safe); }
      catch { await (sdk.actions.openUrl as any)({ url: safe }); }
      return true;
    }
    if (sdk?.actions?.openURL) { await sdk.actions.openURL(safe); return true; }
  } catch {}
  return false;
}
/** Unified compose helper */
export async function composeCast({ text = "", embeds = [] as string[] } = {}): Promise<boolean> {
  const normalizedEmbeds = (embeds || []).map((e) => toAbsoluteUrl(e, SITE_URL));
  if (await tryBaseComposeCast({ text, embeds: normalizedEmbeds })) return true;
  const sdk = await getMiniSdk();
  if (sdk?.actions?.composeCast && isFarcasterUA()) {
    try { await ensureReady(); await sdk.actions.composeCast({ text, embeds: normalizedEmbeds }); return true; } catch {}
  }
  return false;
}
