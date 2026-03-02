export const runtime = "edge";

import { NextRequest } from "next/server";
import { resolveRedisPubSubEndpoint } from "@/lib/redis-endpoints";
import { pumpPubSub, pumpMultiPubSub } from "@/lib/sse-pubsub";

// Channel mapping for each sport
// These match the ingestor's publish channels
const SPORT_CHANNELS: Record<string, string> = {
  nba: "odds_updates:nba",
  nfl: "odds_updates:nfl",
  nhl: "odds_updates:nhl",
  ncaaf: "odds_updates:ncaaf",
  ncaab: "odds_updates:ncaab",
  mlb: "odds_updates:mlb",
  ncaabaseball: "odds_updates:ncaabaseball",
  wnba: "odds_updates:wnba",
  soccer_epl: "odds_updates:soccer_epl",
  soccer_laliga: "odds_updates:soccer_laliga",
  soccer_mls: "odds_updates:soccer_mls",
  soccer_ucl: "odds_updates:soccer_ucl",
  soccer_uel: "odds_updates:soccer_uel",
  tennis_atp: "odds_updates:tennis_atp",
  tennis_challenger: "odds_updates:tennis_challenger",
  tennis_itf_men: "odds_updates:tennis_itf_men",
  tennis_itf_women: "odds_updates:tennis_itf_women",
  tennis_utr_men: "odds_updates:tennis_utr_men",
  tennis_utr_women: "odds_updates:tennis_utr_women",
  tennis_wta: "odds_updates:tennis_wta",
  ufc: "odds_updates:ufc",
};

const VALID_SPORTS = new Set(Object.keys(SPORT_CHANNELS));

async function subscribeToChannel(
  url: string,
  token: string,
  channel: string
): Promise<Response> {
  return fetch(`${url}/subscribe/${encodeURIComponent(channel)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    cache: "no-store",
  });
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;

  // Support both single sport (legacy) and multiple sports (new)
  const singleSport = (sp.get("sport") || "").trim().toLowerCase();
  const multipleSports = (sp.get("sports") || "").trim().toLowerCase();

  let channels: string[] = [];
  let subscribedSports: string[] = [];

  if (singleSport) {
    if (!VALID_SPORTS.has(singleSport)) {
      return new Response(JSON.stringify({ error: "invalid_sport", valid: Array.from(VALID_SPORTS) }), { status: 400 });
    }
    channels = [SPORT_CHANNELS[singleSport] || `odds_updates:${singleSport}`];
    subscribedSports = [singleSport];
  } else if (multipleSports) {
    let sportsList: string[];

    if (multipleSports === "all" || multipleSports === "*") {
      sportsList = Array.from(VALID_SPORTS);
    } else {
      sportsList = multipleSports.split(",").map(s => s.trim()).filter(Boolean);
      const invalidSports = sportsList.filter(s => !VALID_SPORTS.has(s));
      if (invalidSports.length > 0) {
        return new Response(JSON.stringify({
          error: "invalid_sports",
          invalid: invalidSports,
          valid: Array.from(VALID_SPORTS)
        }), { status: 400 });
      }
    }

    if (sportsList.length === 0) {
      return new Response(JSON.stringify({ error: "no_sports_provided" }), { status: 400 });
    }

    channels = sportsList.map(s => SPORT_CHANNELS[s] || `odds_updates:${s}`);
    subscribedSports = sportsList;
  } else {
    return new Response(JSON.stringify({
      error: "missing_sport_param",
      usage: "Use ?sport=nba for single sport or ?sports=nba,nfl for multiple"
    }), { status: 400 });
  }

  const pubsub = resolveRedisPubSubEndpoint();
  const url = pubsub.url;
  const token = pubsub.token;
  if (!url || !token) {
    const reason = pubsub.rejectedLoopback
      ? "loopback Redis pubsub URL rejected in production"
      : "missing_redis_pubsub_env";
    return new Response(JSON.stringify({ error: reason }), { status: 500 });
  }

  const helloEvent = `event: hello\ndata: ${JSON.stringify({
    version: "v2",
    mode: channels.length > 1 ? "multi" : "direct",
    sports: subscribedSports,
  })}\n\n`;

  // Subscribe to all channels in parallel
  const responses = await Promise.all(
    channels.map(ch => subscribeToChannel(url, token, ch))
  );

  // Check that at least one succeeded
  const validUpstreams = responses.filter(r => r.ok && r.body);
  if (validUpstreams.length === 0) {
    return new Response("failed to subscribe", { status: 502 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  if (validUpstreams.length === 1) {
    // Single channel — use the simpler single-stream pump
    pumpPubSub({
      upstream: validUpstreams[0].body!,
      writer,
      signal: req.signal,
      helloEvent,
    });
  } else {
    // Multiple channels — merge all streams into one client connection
    pumpMultiPubSub({
      upstreams: validUpstreams.map(r => r.body!),
      writer,
      signal: req.signal,
      helloEvent,
    });
  }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
