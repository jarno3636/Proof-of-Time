// app/share/opengraph-image.tsx
import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Optional hints; harmless here
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default function Image() {
  // No args! This file is invoked without props.
  const W = 1200;
  const H = 630;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          backgroundColor: "#150022",
          color: "#ffffff",
          fontSize: 56,
          fontWeight: 800,
          paddingLeft: 48,
          paddingTop: 72,
        }}
      >
        Relics Revealed
      </div>
    ),
    { width: W, height: H }
  );
}
