import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SUPPORTED_SPORTS = new Set(["nfl", "nba", "nhl", "ncaaf"]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sport = (url.searchParams.get("sport") || "").trim().toLowerCase();
  const sidsParam = (url.searchParams.get("sids") || "").trim();
  const fromId = (url.searchParams.get("from_id") || req.headers.get("last-event-id") || "$").trim();
  const embed = url.searchParams.get("embed") === "1";

  if (!sport || !SUPPORTED_SPORTS.has(sport)) {
    return new Response(JSON.stringify({ error: "invalid_sport" }), { status: 400 });
  }
  if (!sidsParam) {
    return new Response(JSON.stringify({ error: "missing_sids" }), { status: 400 });
  }

  const sids = new Set(sidsParam.split(",").map(s => s.trim()).filter(Boolean));
  const streamKey = `props:${sport}:alt:x`;

  // We will poll XRANGE periodically to emulate tailing with resume
  let cursor = fromId || "$";

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  const write = async (str: string) => {
    try { await writer.write(enc.encode(str)); } catch { /* connection closed */ }
  };

  // Hello event
  await write(`event: hello\ndata: {"sport":"${sport}"}\n\n`);

  const HEARTBEAT_MS = 30_000;
  const POLL_MS = 900; // gentle polling to avoid thrash
  let hb: any;
  let timer: any;
  let closed = false;

  const closeAll = async () => {
    if (closed) return;
    closed = true;
    clearInterval(hb);
    clearInterval(timer);
    try { await writer.close(); } catch {}
  };

  hb = setInterval(() => write(`:hb\n\n`), HEARTBEAT_MS);

  const loop = async () => {
    if (closed) return;
    try {
      // Read new entries from stream
      // XRANGE: if cursor is "$", there's nothing to read; set to just before now
      const start = cursor === "$" ? "(0-0" : `(${cursor}`;
      const end = "+";
      const entries = await redis.xrange(streamKey, start, end, { count: 200 });

      for (const [id, fields] of entries as any[]) {
        cursor = id;
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }
        const sid = data["sid"];
        if (!sid || !sids.has(sid)) continue;

        if (embed) {
          const key = `props:${sport}:rows:alt:${sid}`;
          const family = await redis.get(key);
          await write(`event: alt\nid: ${id}\ndata: ${JSON.stringify({ sid, family: family ? JSON.parse(family as string) : null })}\n\n`);
        } else {
          await write(`event: alt\nid: ${id}\ndata: ${JSON.stringify({ sid })}\n\n`);
        }
      }
    } catch (err) {
      // soft failure; keep polling
    }
  };

  timer = setInterval(loop, POLL_MS);
  req.signal.addEventListener("abort", closeAll, { once: true });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}


