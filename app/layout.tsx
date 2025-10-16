// app/layout.tsx
import "../styles/globals.css";
import Providers from "./providers";
import { Cinzel } from "next/font/google";
import type { Metadata } from "next";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "600", "700"] });

const site =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof window === "undefined" ? "https://your-site.example" : window.location.origin);

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
      // Fallback. Per-user/per-relic cards are served via /api/card/[address] and /api/relic-card
      { url: "/og.png", width: 1200, height: 630, alt: "Proof of Time" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof of Time",
    description: "Your longest-held tokens on Base. Time > hype.",
    images: ["/og.png"],
    creator: "@", // optional: add your handle
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0e14" }],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cinzel.className} bg-[#0b0e14] text-zinc-200`}>
        {/* Subtle “temple” backdrop */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_-20%,rgba(187,164,106,.15),transparent),radial-gradient(60%_40%_at_-10%_110%,rgba(255,255,255,.05),transparent)]" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
