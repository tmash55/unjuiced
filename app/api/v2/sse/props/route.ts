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
  mlb: "odds_updates:mlb",
  wnba: "odds_updates:wnba",
};

const VALID_SPORTS = new Set(Object.keys(SPORT_CHANNELS));

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  
  // Support both single sport (legacy) and multiple sports (new)
  const singleSport = (sp.get("sport") || "").trim().toLowerCase();
  const multipleSports = (sp.get("sports") || "").trim().toLowerCase();
  
  let usePattern = false;
  let channel: string;
  let subscribedSports: string[] = [];
  
  if (singleSport) {
    // Legacy mode: single sport using SUBSCRIBE
    if (!VALID_SPORTS.has(singleSport)) {
      return new Response(JSON.stringify({ error: "invalid_sport", valid: Array.from(VALID_SPORTS) }), { status: 400 });
    }
    channel = SPORT_CHANNELS[singleSport] || `odds_updates:${singleSport}`;
    subscribedSports = [singleSport];
  } else if (multipleSports) {
    // New mode: multiple sports
    if (multipleSports === "all" || multipleSports === "*") {
      // Subscribe to all sports using pattern
      usePattern = true;
      channel = "odds_updates:*";
      subscribedSports = Array.from(VALID_SPORTS);
    } else {
      // Parse comma-separated list
      const sportsList = multipleSports.split(",").map(s => s.trim()).filter(Boolean);
      
      // Validate all sports
      const invalidSports = sportsList.filter(s => !VALID_SPORTS.has(s));
      if (invalidSports.length > 0) {
        return new Response(JSON.stringify({ 
          error: "invalid_sports", 
          invalid: invalidSports,
          valid: Array.from(VALID_SPORTS) 
        }), { status: 400 });
      }
      
      if (sportsList.length === 0) {
        return new Response(JSON.stringify({ error: "no_sports_provided" }), { status: 400 });
      }
      
      if (sportsList.length === 1) {
        // Single sport, use direct subscription
        channel = SPORT_CHANNELS[sportsList[0]] || `odds_updates:${sportsList[0]}`;
        subscribedSports = sportsList;
      } else {
        // Multiple sports - use pattern subscription to get all, client filters
        // This is more efficient than opening multiple connections
        usePattern = true;
        channel = "odds_updates:*";
        subscribedSports = sportsList;
      }
    }
  } else {
    return new Response(JSON.stringify({ 
      error: "missing_sport_param", 
      usage: "Use ?sport=nba for single sport or ?sports=nba,nfl for multiple" 
    }), { status: 400 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  
  // Use PSUBSCRIBE for pattern matching, SUBSCRIBE for direct channel
  const subscribeEndpoint = usePattern ? "psubscribe" : "subscribe";
  
  const upstream = await fetch(`${url}/${subscribeEndpoint}/${encodeURIComponent(channel)}`, {
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

    // Send hello event with subscription info
    try { 
      await writer.write(enc.encode(`event: hello\ndata: ${JSON.stringify({
        channel,
        version: "v2",
        mode: usePattern ? "pattern" : "direct",
        sports: subscribedSports,
      })}\n\n`)); 
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
