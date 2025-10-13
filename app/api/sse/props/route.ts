export const runtime = "edge";

import { NextRequest } from "next/server";
import { createClient } from "@/libs/supabase/server";

async function assertPro(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();
  if (!profile || (profile.plan !== 'pro' && profile.plan !== 'admin')) {
    return new Response(JSON.stringify({ error: 'pro required' }), { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await assertPro(req);
  if (denied) return denied;

  const sp = new URL(req.url).searchParams;
  const sport = (sp.get("sport") || "").trim().toLowerCase();
  const allowed = new Set(["nfl", "mlb", "wnba", "nba"]);
  if (!sport || !allowed.has(sport)) {
    return new Response(JSON.stringify({ error: "invalid_sport" }), { status: 400 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const channel = `pub:props:${sport}`;

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

    // optional hello (ignore if closed)
    try { await writer.write(enc.encode(`event: hello\ndata: {}\n\n`)); } catch {void 0;}

    const safeWrite = async (chunk: Uint8Array) => {
      try { await writer.write(chunk); } catch { throw new Error('closed'); }
    };

    const PING_MS = 15_000;
    const ping = setInterval(async () => {
      try { await safeWrite(enc.encode(`: ping\n\n`)); } catch { clearInterval(ping); }
    }, PING_MS);

    const onAbort = () => {
      clearInterval(ping);
      try { writer.close(); } catch {void 0;}
    };
    if (req.signal.aborted) onAbort();
    req.signal.addEventListener('abort', onAbort, { once: true });

    try {
      let finished=false;
      while(!finished) {
        const { value, done } = await reader.read();
        finished = !!done;
        if (finished) break;
        try { await safeWrite(value!); } catch { break; }
      }
    } finally {
      clearInterval(ping);
      try { await writer.close(); } catch {void 0;}
    }
  };

  pump();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}