import { ImageResponse } from "next/og";
import React from "react";

// Required for OG image routes
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// These two hints make the renderer more stable in some environments
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

const W = 1200;
const H = 630;

export default function Image({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "");
  const title = clean((searchParams.title as string) || "Relics Revealed");

  // Keep it ultra-minimal first (we’ll add rows back once this renders)
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          backgroundColor: "#150022", // solid color = safest
          color: "#ffffff",
          fontSize: 56,
          fontWeight: 800,
          paddingLeft: 48,
          paddingTop: 72,
        }}
      >
        {title}
      </div>
    ),
    { width: W, height: H }
  );
}
