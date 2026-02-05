import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(
    "https://proofoftime.vercel.app/api/jobs/seed-tokens",
    { method: "POST" }
  );

  const json = await res.json().catch(() => null);

  return NextResponse.json({
    triggered: true,
    result: json,
  });
}
