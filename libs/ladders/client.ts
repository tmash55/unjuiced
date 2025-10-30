export type Sport = "nfl" | "nba" | "nhl" | "ncaaf";

export async function findSid(params: { sport: Sport; mkt: string; ent?: string; player?: string; eid: string; }) {
  const q = new URLSearchParams();
  q.set("sport", params.sport);
  q.set("mkt", params.mkt);
  if (params.eid) q.set("eid", params.eid);
  if (params.player) q.set("player", params.player);
  if (params.ent) q.set("ent", params.ent);
  const url = `/api/props/find?${q.toString()}`;
  console.debug("[ladders] findSid", url);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("find failed");
  const json = await res.json();
  console.debug("[ladders] findSid result", json);
  return json as { sids: string[]; resolved: any };
}

export async function getFamily(sport: Sport, sid: string, etag?: string) {
  const q = new URLSearchParams({ sport, sid });
  const url = `/api/props/alt?${q.toString()}`;
  console.debug("[ladders] getFamily", { url, etag });
  const res = await fetch(url, {
    cache: "no-store",
    headers: etag ? { "If-None-Match": etag } : undefined,
  });
  if (res.status === 304) {
    console.debug("[ladders] getFamily 304 Not Modified");
    return { status: 304 as const };
  }
  if (!res.ok) {
    if (res.status === 404) {
      console.debug("[ladders] getFamily 404 - No alternates available for this SID");
      throw new Error("alt failed: not_found");
    }
    console.warn("[ladders] getFamily failed", res.status);
    throw new Error(`alt failed: ${res.status}`);
  }
  const nextTag = res.headers.get("etag") || undefined;
  try {
    const bodyAny = await res.json().catch(async () => {
      const txt = await res.text();
      return JSON.parse(txt);
    });
    const parsed = typeof bodyAny === 'string' ? JSON.parse(bodyAny) : bodyAny;
    console.debug("[ladders] getFamily 200", { etag: nextTag, lines: Array.isArray(parsed?.lines) ? parsed.lines.length : null });
    return { status: 200 as const, body: parsed, etag: nextTag };
  } catch (e) {
    console.warn("[ladders] getFamily JSON parse failed");
    throw e;
  }
}

export function openAltSSE(opts: { sport: Sport; sids: string[]; embed?: boolean; lastEventId?: string; onAlt?: (e: { id: string; sid: string; family?: any }) => void; onError?: (e: any) => void; }) {
  const q = new URLSearchParams({ sport: opts.sport, sids: opts.sids.join(",") });
  if (opts.embed) q.set("embed", "1");
  const url = `/api/sse/alt?${q.toString()}`;
  const es = new EventSource(url, { withCredentials: false });

  es.onmessage = (ev) => {
    // We only send named events; ignore default messages
  };

  es.addEventListener("alt", (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data);
      opts.onAlt?.({ id: (ev as any).lastEventId || (ev as any).id || "", sid: data.sid, family: data.family });
    } catch (e) {
      // swallow
    }
  });

  es.onerror = opts.onError || null as any;
  return es;
}


