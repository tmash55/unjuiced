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

// =============================================================================
// V2 API Functions (using new SSE key structure: odds:{sport}:{eventId}:{market}:{book})
// =============================================================================

export async function fetchPropsTableV2(params: {
  sport: string;
  market: string;
  scope: PropsScope;
  limit?: number;
}): Promise<{ sids: string[]; rows: PropsRow[]; nextCursor: string | null; meta?: any }> {
  const sp = new URLSearchParams();
  sp.set("sport", params.sport);
  sp.set("market", params.market);
  sp.set("scope", params.scope);
  if (params.limit != null) sp.set("limit", String(params.limit));
  
  const res = await fetch(`/api/v2/props/table?${sp.toString()}`, { 
    credentials: "include", 
    cache: "no-store" 
  });
  if (!res.ok) throw new Error(`GET /api/v2/props/table ${res.status}`);
  return res.json();
}

export async function fetchMarketsV2(sport: string): Promise<{ 
  sport: string;
  markets: Array<{ key: string; display: string; eventCount: number }>;
  count: number;
}> {
  const sp = new URLSearchParams();
  sp.set("sport", sport);
  
  const res = await fetch(`/api/v2/props/markets?${sp.toString()}`, { 
    credentials: "include", 
    cache: "no-store" 
  });
  if (!res.ok) throw new Error(`GET /api/v2/props/markets ${res.status}`);
  return res.json();
}

export async function fetchAlternatesV2(params: {
  sport: string;
  eventId: string;
  market: string;
  player: string;
  primaryLine?: number;
}): Promise<{
  eventId: string;
  sport: string;
  market: string;
  player: string | null;
  team: string | null;
  position: string | null;
  primary_ln: number | null;
  alternates: Array<{
    ln: number;
    books: Record<string, {
      over?: { price: number; decimal: number; link: string | null; limit_max?: number | null };
      under?: { price: number; decimal: number; link: string | null; limit_max?: number | null };
    }>;
    best?: {
      over?: { bk: string; price: number };
      under?: { bk: string; price: number };
    };
  }>;
}> {
  const sp = new URLSearchParams();
  sp.set("sport", params.sport);
  sp.set("eventId", params.eventId);
  sp.set("market", params.market);
  sp.set("player", params.player);
  if (params.primaryLine !== undefined) sp.set("primaryLine", String(params.primaryLine));
  
  const res = await fetch(`/api/v2/props/alternates?${sp.toString()}`, { 
    credentials: "include", 
    cache: "no-store" 
  });
  if (!res.ok) throw new Error(`GET /api/v2/props/alternates ${res.status}`);
  return res.json();
}