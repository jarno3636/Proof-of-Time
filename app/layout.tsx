import "../styles/globals.css";
import Providers from "./providers";
import { Cinzel } from "next/font/google";
import type { Metadata, Viewport } from "next";
import MiniAppBoot from "@/components/MiniAppBoot";
import AppReady from "@/components/AppReady";

/* ---------- Resolve absolute site URL (server-safe) ---------- */
function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
const site = getSiteUrl();

/* ---------- Fonts ---------- */
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

/* ---------- Viewport ---------- */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e14",
};

/* ---------- Metadata ---------- */
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Proof of Time", template: "%s · Proof of Time" },
  description: "Your longest-held tokens on Base. Time > hype.",
  applicationName: "Proof of Time",
  keywords: ["Base", "crypto", "onchain", "holder", "relics", "OG image"],
  authors: [{ name: "Proof of Time" }],
  openGraph: {
    type: "website",
    title: "Proof of Time",
    description: "Your longest-held tokens on Base. Time > hype.",
    url: site,
    siteName: "Proof of Time",
    images: [
      { url: "/share.PNG", width: 1200, height: 630, alt: "Proof of Time" }, // ✅ Updated
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof of Time",
    description: "Your longest-held tokens on Base. Time > hype.",
    images: ["/share.PNG"], // ✅ Updated
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0e14" }],
  robots: { index: true, follow: true },
  alternates: { canonical: site },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Perf: preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        {/* ✅ Farcaster Mini-App SDK */}
        <script async src="https://cdn.farcaster.xyz/sdk/miniapp/v2.js"></script>

        {/* ✅ Farcaster Mini-App meta */}
        <meta name="x-miniapp-name" content="Proof of Time" />
        <meta name="x-miniapp-image" content={`${site}/share.PNG`} /> {/* ✅ Updated */}
        <meta name="x-miniapp-url" content={site} />

        {/* Ultra-early MiniApp ready ping + retries */}
        <script
          id="fc-miniapp-ready"
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  if (window.__fcReadyInjected) return; window.__fcReadyInjected = true;
  var attempts = 0, maxAttempts = 40; var done = false;
  function signalReadyOnce(){
    if (done) return;
    try { window.farcaster?.actions?.ready?.(); } catch(e) {}
    try { window.farcaster?.miniapp?.sdk?.actions?.ready?.(); } catch(e) {}
    try { window.Farcaster?.mini?.sdk?.actions?.ready?.(); } catch(e) {}
    attempts++; if (attempts >= maxAttempts) stop();
  }
  function stop(){ done = true; try{ clearInterval(iv); }catch(_){} 
    window.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('DOMContentLoaded', signalReadyOnce, { once: true });
  }
  function onVis(){ if (!document.hidden) signalReadyOnce(); }
  function onFocus(){ signalReadyOnce(); }
  function onPageShow(){ signalReadyOnce(); }
  signalReadyOnce();
  document.addEventListener('DOMContentLoaded', signalReadyOnce, { once: true });
  var iv = setInterval(signalReadyOnce, 150);
  window.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pageshow', onPageShow);
})();
          `,
          }}
        />
      </head>
      <body className={`${cinzel.className} bg-[#0b0e14] text-zinc-200`}>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_-20%,rgba(187,164,106,.15),transparent),radial-gradient(60%_40%_at_-10%_110%,rgba(255,255,255,.05),transparent)]" />
        {/* Client boot + ready ping */}
        <MiniAppBoot />
        <AppReady />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
