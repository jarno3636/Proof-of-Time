"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import cn from "clsx";

/* ---------- Helpers ---------- */
function isHexAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test((s || "").trim());
}

function getSiteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

function hardNavigate(absUrl: string) {
  try { window.location.assign(absUrl); return; } catch {}
  try { window.location.href = absUrl; return; } catch {}
  try { window.location.replace(absUrl); return; } catch {}
  try { window.open(absUrl, "_self", "noopener,noreferrer"); return; } catch {}
  try {
    const a = document.createElement("a");
    a.href = absUrl;
    a.target = "_self";
    a.rel = "noreferrer noopener";
    a.style.position = "absolute";
    a.style.left = "-9999px";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1200);
  } catch {}
}

/* ---------- Component ---------- */
export default function RevealRelicsInline() {
  const router = useRouter();
  const { address } = useAccount();
  const origin = getSiteOrigin();

  // address entry (always visible so users can avoid connecting)
  const [addr, setAddr] = useState("");
  const trimmed = useMemo(() => (addr || "").trim(), [addr]);
  const valid = useMemo(() => isHexAddress(trimmed), [trimmed]);

  const submitAddress = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!valid) return;
      const path = `/relic/${trimmed.toLowerCase()}`;
      const abs = `${origin}${path}`;

      // Try SPA, fall back to hard nav (for Base/CB Wallet webviews)
      try {
        router.push(path);
        setTimeout(() => {
          if (document.visibilityState !== "hidden") hardNavigate(abs);
        }, 60);
      } catch {
        hardNavigate(abs);
      }
    },
    [router, valid, trimmed, origin]
  );

  return (
    <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5 sm:p-6">
      <div className="flex flex-col gap-3">
        {/* Connected wallet path: show a *real link* primary button */}
        {address && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <a
              href={`/relic/${address}`}
              target="_self"
              rel="noreferrer noopener"
              className={cn(
                "inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold",
                "bg-[#BBA46A] text-[#0b0e14] hover:bg-[#d6c289] transition"
              )}
            >
              Open your altar
            </a>

            <p className="text-xs text-zinc-400">
              Prefer not to connect? Paste any Base address below instead.
            </p>
          </div>
        )}

        {/* Address entry (works with or without connection) */}
        <form onSubmit={submitAddress} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <label htmlFor="reveal-addr" className="text-xs text-zinc-400">
              Reveal by address (0x…)
            </label>
            <input
              id="reveal-addr"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="0xabc…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 w-full rounded-xl bg-zinc-900/60 border border-white/10 px-4 py-3 outline-none focus:border-[#BBA46A] transition"
            />
            {!valid && trimmed.length > 0 && (
              <div className="mt-1 text-xs text-red-300">Enter a valid 0x address</div>
            )}
            {!address && (
              <p className="mt-2 text-[11px] text-zinc-400">
                Don’t want to connect? Paste any Base address here to view its altar.
              </p>
            )}
          </div>

          <div className="sm:pt-6">
            <button
              type="submit"
              disabled={!valid}
              className="w-full sm:w-auto rounded-2xl bg-[#BBA46A] hover:bg-[#d6c289] px-5 py-3 font-semibold text-[#0b0e14] transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reveal altar by address"
              aria-disabled={!valid}
            >
              Reveal
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
