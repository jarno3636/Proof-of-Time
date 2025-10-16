// app/layout.tsx
import "../styles/globals.css";
import Providers from "./providers";
import { Cinzel } from "next/font/google";
import type { Metadata, Viewport } from "next";

// ---- Resolve a stable absolute site URL on the server (no `window`) ----
function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env; // e.g. https://proof-of-time.xyz

  // Vercel fallback (preview/prod)
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  // Local dev
  return "http://localhost:3000";
}
const site = getSiteUrl();

// ---- Font ----
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

// ---- Viewport (good for mobile meta) ----
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e14",
};

// ---- Metadata (evaluated server-side; safe to use `site`) ----
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: "Proof of Time",
    template: "%s · Proof of Time",
  },
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
      // Global fallback — your per-user/per-relic images come from /api/card/[address] & /api/relic-card
      { url: "/og.png", width: 1200, height: 630, alt: "Proof of Time" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof of Time",
    description: "Your longest-held tokens on Base. Time > hype.",
    images: ["/og.png"],
    // Set your handle if you want attribution on shares:
    // creator: "@your_handle",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0e14" }],
  robots: { index: true, follow: true },
  alternates: { canonical: site },
  // You can add frame defaults here if you really want global tags,
  // but it's better to emit frame meta per-frame route HTML response.
  other: {
    // Example (commented): "fc:frame": "vNext",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Perf: preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className={`${cinzel.className} bg-[#0b0e14] text-zinc-200`}>
        {/* Subtle “temple” backdrop */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_-20%,rgba(187,164,106,.15),transparent),radial-gradient(60%_40%_at_-10%_110%,rgba(255,255,255,.05),transparent)]" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
