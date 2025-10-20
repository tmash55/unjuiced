import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const H_PRIM_PREFIX = "props:"; // props:{sport}:rows:prim
const MAX_IDS = 1000;
const CHUNK = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sport = typeof body?.sport === "string" ? body.sport.trim().toLowerCase() : "";
    const input = Array.isArray(body?.sids) ? body.sids : Array.isArray(body?.ids) ? body.ids : [];
    const normalized = (input as unknown[])
      .map((x: unknown) => (typeof x === "string" || typeof x === "number" ? String(x) : ""))
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const allowed = new Set(["nfl", "ncaaf", "mlb", "wnba", "nba", "ncaab", "nhl"]);
    if (!sport || !allowed.has(sport)) {
      return NextResponse.json(
        { error: "invalid_sport" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!normalized.length) {
      return NextResponse.json(
        { rows: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of normalized) { if (!seen.has(id)) { seen.add(id); ordered.push(id); } }
    const capped = ordered.slice(0, MAX_IDS);

    const out: Array<{ sid: string; row: any | null }> = [];
    let usedFallback = false;

    const safeParse = (val: any) => {
      if (!val) return null;
      if (typeof val === "string") { try { return JSON.parse(val); } catch { return null; } }
      if (typeof val === "object") return val;
      return null;
    };

    const H_PRIM = `${H_PRIM_PREFIX}${sport}:rows:prim`;
    for (let offset = 0; offset < capped.length; offset += CHUNK) {
      const chunk = capped.slice(offset, offset + CHUNK);
      const rawUnknown = (await (redis as any).hmget(H_PRIM, ...chunk)) as unknown;
      let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];
      if (!Array.isArray(rawUnknown) || rawArr.length === 0) {
        usedFallback = true;
        rawArr = await Promise.all(chunk.map((id) => (redis as any).hget(H_PRIM, id)));
      }
      rawArr.forEach((val, i) => {
        const sid = chunk[i];
        const row = safeParse(val);
        out.push({ sid, row });
      });
    }

    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (usedFallback) headers["X-Props-HMGET-Fallback"] = "1";

    return NextResponse.json({ rows: out }, { headers });
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}