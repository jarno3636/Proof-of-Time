// components/HomeCountdown.tsx
"use client";
import Countdown from "./Countdown";
export default function HomeCountdown() {
  const end = Number(process.env.NEXT_PUBLIC_PRESALE_END_UNIX || 0);
  if (!end) return null;
  return <Countdown target={end} />;
}
