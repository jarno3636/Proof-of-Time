import "../styles/globals.css";
import Providers from "./providers";
import { Cinzel } from "next/font/google";

export const metadata = { title: "Proof of Time" };

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400","600","700"] });

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
