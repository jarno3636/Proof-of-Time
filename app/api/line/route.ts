// app/api/line/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACKS = [
  "Time rewards those who stay.",
  "Patience is a speed most miss.",
  "Discipline turns minutes into monuments.",
  "Loyalty is the slow forge of trust.",
  "Happiness grows where consistency lives.",
  "Will is the quiet engine of destiny.",
];

function pickFallback(seedStr: string) {
  const s = seedStr.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACKS[s % FALLBACKS.length];
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY || "";
  let symbols: string[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    symbols = Array.isArray(body?.symbols) ? body.symbols.slice(0, 3) : [];
  } catch {}

  // If no key, return deterministic fallback
  if (!key) {
    return NextResponse.json({ line: pickFallback(symbols.join("|")) });
  }

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 2500);

  const prompt = [
    "Write ONE short, profound line (<=120 chars) about time, patience, discipline, loyalty, happiness, or will.",
    "No hashtags. No emojis. No quotes around it.",
    symbols.length ? `Optional nod to: ${symbols.map((s) => "$" + s).join(", ")} (keep subtle).` : "",
  ]
    .join(" ")
    .trim();

  try {
    // Chat Completions (“messages route”)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You craft brief, timeless aphorisms. Max 120 chars. No emojis. No hashtags." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 60,
      }),
    });

    clearTimeout(to);

    if (!r.ok) {
      return NextResponse.json({ line: pickFallback(symbols.join("|")) });
    }
    const j = await r.json().catch(() => ({} as any));
    const raw =
      j?.choices?.[0]?.message?.content?.trim?.() ||
      j?.choices?.[0]?.message?.content ||
      "";
    const line = raw ? (raw.length <= 120 ? raw : raw.slice(0, 119) + "…") : pickFallback(symbols.join("|"));
    return NextResponse.json({ line });
  } catch {
    clearTimeout(to);
    return NextResponse.json({ line: pickFallback(symbols.join("|")) });
  }
}
