// app/layout.tsx
import "./../styles/globals.css";
export const metadata = { title: "Proof of Time" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
