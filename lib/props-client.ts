export type PropsScope = "pregame" | "live";

export type BookQuote = {
  over?: { price: number; u?: string; m?: string; limit_max?: number | null } | null;
  under?: { price: number; u?: string; m?: string; limit_max?: number | null } | null;
};

export type BestQuote = {
  over?: { bk: string; price: number } | null;
  under?: { bk: string; price: number } | null;
};

export type PropsRow = {
  eid: string;
  ent: string; // e.g., "pid:12345" | "game" | "team:home" | "team:away"
  player?: string;
  team?: string;
  mkt: string;
  ln: number;
  ev: {
    dt?: string;
    live?: boolean;
    home?: Record<string, any>;
    away?: Record<string, any>;
  };
  books: Record<string, BookQuote>;
  best?: BestQuote;
  avg?: { over?: number; under?: number };
  ts?: number;
};

export type PropsFamily = {
  eid: string;
  ent: string;
  mkt: string;
  ev?: any;
  primary_ln?: number;
  lines: Array<{
    ln: number;
    books: Record<string, BookQuote>;
    best?: BestQuote;
    avg?: { over?: number; under?: number };
  }>;
  ts?: number;
};

export async function fetchMarkets(sport: string): Promise<{ markets: string[] }> {
  const sp = new URLSearchParams();
  sp.set("sport", sport);
  const res = await fetch(`/api/props/markets?${sp.toString()}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/props/markets ${res.status}`);
  return res.json();
}

export async function fetchPropsTable(params: {
  sport: string;
  market: string;
  scope: PropsScope;
  cursor?: string | number | null;
  limit?: number;
  playerId?: string;
  team?: string;
}): Promise<{ sids: string[]; rows: PropsRow[]; nextCursor: string | null }> {
  const sp = new URLSearchParams();
  sp.set("sport", params.sport);
  sp.set("market", params.market);
  sp.set("scope", params.scope);
  if (params.cursor != null) sp.set("cursor", String(params.cursor));
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.playerId) sp.set("playerId", params.playerId);
  if (params.team) sp.set("team", params.team);
  const res = await fetch(`/api/props/table?${sp.toString()}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/props/table ${res.status}`);
  return res.json();
}

export async function fetchPropsRows(sport: string, sids: string[]): Promise<Array<{ sid: string; row: PropsRow | null }>> {
  const res = await fetch(`/api/props/rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sport, sids }),
  });
  if (!res.ok) throw new Error(`POST /api/props/rows ${res.status}`);
  const json = await res.json();
  return (json?.rows || []) as Array<{ sid: string; row: PropsRow | null }>;
}

export async function fetchAlternates(sport: string, sid: string): Promise<PropsFamily | null> {
  const sp = new URLSearchParams();
  sp.set("sport", sport);
  const res = await fetch(`/api/props/alternates/${encodeURIComponent(sid)}?${sp.toString()}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/props/alternates/${sid} ${res.status}`);
  const json = await res.json();
  return (json?.family || null) as PropsFamily | null;
}