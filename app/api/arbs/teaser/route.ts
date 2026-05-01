import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { ROWS_FORMAT, type ArbRow } from "@/lib/arb-schema";
import { zrevrangeCompat } from "@/lib/redis-zset";

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
    let ids = await zrevrangeCompat(redis as any, Z_ROI_PREGAME, 0, limit - 1);
    if (ids.length === 0) {
      ids = await zrevrangeCompat(redis as any, Z_ROI_ALL, 0, limit - 1);
    }

    const rawUnknown = ids.length ? ((await (redis as any).hmget(H_ROWS, ...ids)) as unknown) : [];
    let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];
    if (ids.length && rawArr.length === 0) {
      rawArr = await Promise.all(ids.map((id) => (redis as any).hget(H_ROWS, id)));
    }
    // Keep ids and rows parallel
    const pairs: Array<{ id: string; row: ArbRow }> = [];
    for (let i = 0; i < ids.length; i++) {
      const r = rawArr[i];
      if (!r) continue;
      const parsed: ArbRow = typeof r === "string" ? JSON.parse(r) : r;
      if (parsed) pairs.push({ id: ids[i], row: parsed });
    }
    const finalIds = pairs.map((p) => p.id);
    const rows = pairs.map((p) => p.row);

    return NextResponse.json(
      { format: ROWS_FORMAT, v: serverV, ids: finalIds, rows },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "internal_error", message: e?.message || "" }, { status: 500 });
  }
}
