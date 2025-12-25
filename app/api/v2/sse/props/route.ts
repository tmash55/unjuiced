export const runtime = "edge";

import { NextRequest } from "next/server";

// Channel mapping for each sport
// These match the ingestor's publish channels
const SPORT_CHANNELS: Record<string, string> = {
  nba: "odds_updates:nba",
  nfl: "odds_updates:nfl",
  nhl: "odds_updates:nhl",
  ncaaf: "odds_updates:ncaaf",
  ncaab: "odds_updates:ncaab",
  ufc: "odds_updates:ufc",
  soccer_epl: "odds_updates:soccer_epl",
  // Fallback for other sports
  mlb: "odds_updates:mlb",
  wnba: "odds_updates:wnba",
};

const VALID_SPORTS = new Set(Object.keys(SPORT_CHANNELS));

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const sport = (sp.get("sport") || "").trim().toLowerCase();
  
  if (!sport || !VALID_SPORTS.has(sport)) {
    return new Response(JSON.stringify({ error: "invalid_sport", valid: Array.from(VALID_SPORTS) }), { status: 400 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  
  // V2: Subscribe to odds_updates channel for the sport
  // Payload format: { type: "update", keys: [...], count: N, timestamp: "..." }
  const channel = SPORT_CHANNELS[sport] || `odds_updates:${sport}`;

  const upstream = await fetch(`${url}/subscribe/${encodeURIComponent(channel)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("failed to subscribe", { status: 502 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const pump = async () => {
    const reader = upstream.body!.getReader();
    const enc = new TextEncoder();

    // Send hello event
    try { 
      await writer.write(enc.encode(`event: hello\ndata: {"channel":"${channel}","version":"v2"}\n\n`)); 
    } catch { void 0; }

    const safeWrite = async (chunk: Uint8Array) => {
      try { await writer.write(chunk); } catch { throw new Error('closed'); }
    };

    // Keep-alive pings
    const PING_MS = 15_000;
    const ping = setInterval(async () => {
      try { await safeWrite(enc.encode(`: ping\n\n`)); } catch { clearInterval(ping); }
    }, PING_MS);

    const onAbort = () => {
      clearInterval(ping);
      try { writer.close(); } catch { void 0; }
    };
    if (req.signal.aborted) onAbort();
    req.signal.addEventListener('abort', onAbort, { once: true });

    try {
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        finished = !!done;
        if (finished) break;
        try { await safeWrite(value!); } catch { break; }
      }
    } finally {
      clearInterval(ping);
      try { await writer.close(); } catch { void 0; }
    }
  };

  pump();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

