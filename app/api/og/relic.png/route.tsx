// app/api/og/relic.png/route.tsx
import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#fff",
          fontSize: 48,
          fontWeight: 700,
        }}
      >
        Proof of Time ✅
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
