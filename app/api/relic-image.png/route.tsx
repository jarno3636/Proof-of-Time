import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const W = 1200;
const H = 630;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ASCII-only title (avoid emojis / non-ASCII)
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "");
  const title = clean(searchParams.get("title") || "Relics Revealed");

  // Render the simplest possible card first
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          backgroundColor: "#150022", // solid purple — safe
          color: "#ffffff",
          // Keep layout dead simple (no grid/gap/borderRadius etc.)
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
