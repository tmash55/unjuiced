export const runtime = "edge";

import { NextRequest } from "next/server";
import { getRedisPubSubEndpoint } from "@/lib/redis-endpoints";
import { pumpPubSub } from "@/lib/sse-pubsub";

export async function GET(req: NextRequest) {
  // Open access: allow free and unsigned users to subscribe to props SSE

  const sp = new URL(req.url).searchParams;
  const sport = (sp.get("sport") || "").trim().toLowerCase();
  const allowed = new Set(["nfl", "ncaaf", "mlb", "wnba", "nba", "ncaab", "nhl"]);
  if (!sport || !allowed.has(sport)) {
    return new Response(JSON.stringify({ error: "invalid_sport" }), { status: 400 });
  }

  const pubsub = getRedisPubSubEndpoint();
  const url = pubsub.url;
  const token = pubsub.token;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: "missing_redis_pubsub_env" }), { status: 500 });
  }
  const channel = `pub:props:${sport}`;

  const upstream = await fetch(`${url}/subscribe/${encodeURIComponent(channel)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("failed to subscribe", { status: 502 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  pumpPubSub({
    upstream: upstream.body!,
    writer,
    signal: req.signal,
    helloEvent: `event: hello\ndata: {}\n\n`,
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
