export type ArbRow = {
    eid: string;
    mkt: string;
    ln: number;
    roi_bps: number;
    ev: any;
    o: any;
    u: any;
    ts: number;
  };
  
  export async function fetchArbs(params: { v?: number; limit?: number; cursor?: number; event_id?: string }) {
    const sp = new URLSearchParams();
    if (params.v != null) sp.set("v", String(params.v));
    if (params.limit != null) sp.set("limit", String(params.limit));
    if (params.cursor != null) sp.set("cursor", String(params.cursor));
    if (params.event_id) sp.set("event_id", params.event_id);
    const res = await fetch(`/api/arbs?${sp.toString()}`, { credentials: "include" });
    if (res.status === 304) return { unchanged: true as const };
    if (!res.ok) throw new Error(`GET /api/arbs ${res.status}`);
    return (await res.json()) as { format: number; v: number; ids: string[]; rows: ArbRow[] };
  }
  
  export async function fetchRows(ids: string[]): Promise<Array<{ id: string; row: ArbRow | null }>> {
    const res = await fetch("/api/arbs/rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids }),
    });
    if (res.status === 401) {
      // session likely expired (laptop sleep); surface a sentinel so caller can recover
      throw new Error("AUTH_EXPIRED");
    }
    if (!res.ok) throw new Error(`POST /api/arbs/rows ${res.status}`);
    const { rows } = await res.json();
    return rows as Array<{ id: string; row: ArbRow | null }>;
  }