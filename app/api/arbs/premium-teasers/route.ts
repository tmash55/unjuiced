import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { ROWS_FORMAT, type ArbRow } from "@/lib/arb-schema";
import { zrevrangeCompat } from "@/lib/redis-zset";
import { ARBS_REDIS_KEYS } from "@/lib/arbs-redis-keys";

/**
 * Special endpoint to fetch premium arbs for teaser display
 * Does NOT apply free user filtering - used to show what free users are missing
 */
export async function GET(req: NextRequest) {
  try {
    const limit = 3; // Only need top 3 for teasers

    // Fetch top arbs by ROI (prefer pregame, fallback to all)
    let ids = await zrevrangeCompat(
      redis as any,
      ARBS_REDIS_KEYS.sortRoiPregame,
      0,
      limit - 1,
    );

    if (ids.length === 0) {
      ids = await zrevrangeCompat(
        redis as any,
        ARBS_REDIS_KEYS.sortRoi,
        0,
        limit - 1,
      );
    }

    const rawUnknown = ids.length
      ? ((await (redis as any).hmget(ARBS_REDIS_KEYS.rows, ...ids)) as unknown)
      : [];
    let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];

    if (ids.length && rawArr.length === 0) {
      rawArr = await Promise.all(
        ids.map((id) => (redis as any).hget(ARBS_REDIS_KEYS.rows, id)),
      );
    }

    const rows: ArbRow[] = (rawArr || [])
      .map((r) => (r ? (typeof r === "string" ? JSON.parse(r) : r) : null))
      .filter(Boolean) as ArbRow[];

    // Filter for premium arbs (ROI > 1.5%)
    const premiumRows = rows.filter((r) => (r.roi_bps || 0) / 100 > 1.5);

    return NextResponse.json(
      { format: ROWS_FORMAT, rows: premiumRows },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
        },
      },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "internal_error", message: e?.message || "" },
      { status: 500 },
    );
  }
}
