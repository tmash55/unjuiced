import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const H_PRIM_PREFIX = "props:"; // props:{sport}:rows:prim
const Z_ROI_LIVE_PREFIX = "props:"; // props:{sport}:sort:roi:live:{mkt}
const Z_ROI_PREGAME_PREFIX = "props:"; // props:{sport}:sort:roi:pregame:{mkt}

function parseIntSafe(v: string | null, def: number): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    const market = (sp.get("market") || "").trim();
    const scope = (sp.get("scope") || "pregame").toLowerCase() as "pregame" | "live";
    const limit = Math.max(1, Math.min(300, parseIntSafe(sp.get("limit"), 100)));
    const cursor = Math.max(0, parseIntSafe(sp.get("cursor"), 0));
    const playerId = sp.get("playerId") || undefined;
    const team = sp.get("team") || undefined;

    const allowed = new Set(["nfl", "mlb", "wnba", "nba"]);
    if (!sport || !allowed.has(sport)) {
      return NextResponse.json({ error: "invalid_sport" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!market) {
      return NextResponse.json({ error: "market_required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const zkey = scope === "live"
      ? `${Z_ROI_LIVE_PREFIX}${sport}:sort:roi:live:${market}`
      : `${Z_ROI_PREGAME_PREFIX}${sport}:sort:roi:pregame:${market}`;

    // Page SIDs from ZSET (simple offset cursor)
    const zrUnknown = (await (redis as any).zrange(zkey, cursor, cursor + limit - 1, { rev: true })) as unknown;
    const zrArr = Array.isArray(zrUnknown) ? (zrUnknown as any[]) : [];
    let sids = zrArr.map((x) => String(x));

    // Fetch rows
    const H_PRIM = `${H_PRIM_PREFIX}${sport}:rows:prim`;
    const rawUnknown = sids.length ? ((await (redis as any).hmget(H_PRIM, ...sids)) as unknown) : [];
    let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];
    if (sids.length && rawArr.length === 0) {
      rawArr = await Promise.all(sids.map((id) => (redis as any).hget(H_PRIM, id)));
    }

    // Parse and build rows mapping
    type Row = any;
    const rowsParsed = rawArr.map((val) => {
      if (!val) return null;
      if (typeof val === "string") { try { return JSON.parse(val) as Row; } catch { return null; } }
      if (typeof val === "object") return val as Row;
      return null;
    });
    let rows: Row[] = rowsParsed.filter(Boolean) as Row[];

    // Optional filters
    if (playerId) rows = rows.filter((r: any) => String(r?.ent || "").startsWith(`pid:${playerId}`));
    if (team) rows = rows.filter((r: any) => (r?.team || r?.ev?.team || "") === team);

    // Keep sids aligned to rows (remove any nulls)
    sids = sids.filter((_, i) => Boolean(rowsParsed[i]));

    const nextCursor = zrArr.length === limit ? String(cursor + limit) : null;

    return NextResponse.json(
      { sids, rows, nextCursor },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}