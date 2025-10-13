import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { ROWS_FORMAT, type ArbRow } from "@/lib/arb-schema";

const H_ROWS = "arbs:rows";
const Z_ROI_ALL = "arbs:sort:roi";
const Z_ROI_PREGAME = "arbs:sort:roi:pregame";
const V_VER = "arbs:v";

function parseIntSafe(v: string | null, def: number): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const limit = Math.max(1, Math.min(2, parseIntSafe(sp.get("limit"), 2)));

    const serverV = (await redis.get<number>(V_VER)) ?? 0;

    // Prefer pregame; fall back to all if empty
    let zrUnknown = (await (redis as any).zrange(Z_ROI_PREGAME, 0, limit - 1, { rev: true })) as unknown;
    let zrArr = Array.isArray(zrUnknown) ? (zrUnknown as any[]) : [];
    if (zrArr.length === 0) {
      zrUnknown = (await (redis as any).zrange(Z_ROI_ALL, 0, limit - 1, { rev: true })) as unknown;
      zrArr = Array.isArray(zrUnknown) ? (zrUnknown as any[]) : [];
    }
    const ids = zrArr.map(String).slice(0, limit);

    const rawUnknown = ids.length ? ((await (redis as any).hmget(H_ROWS, ...ids)) as unknown) : [];
    let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];
    if (ids.length && rawArr.length === 0) {
      rawArr = await Promise.all(ids.map((id) => (redis as any).hget(H_ROWS, id)));
    }
    const rows: ArbRow[] = (rawArr || [])
      .map((r) => (r ? (typeof r === "string" ? JSON.parse(r) : r) : null))
      .filter(Boolean) as ArbRow[];

    return NextResponse.json(
      { format: ROWS_FORMAT, v: serverV, ids, rows },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "internal_error", message: e?.message || "" }, { status: 500 });
  }
}