import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { ROWS_FORMAT, type ArbRow } from "@/lib/arb-schema";
import { isArbFreshForMode } from "@/lib/arb-freshness";
import { createClient } from "@/libs/supabase/server";
import { PLAN_LIMITS } from "@/lib/plans";
import { getUserPlan } from "@/lib/plans-server";
import { zrevrangeCompat } from "@/lib/redis-zset";

const H_ROWS = "arbs:rows";
const Z_ROI = "arbs:sort:roi";
const Z_ROI_LIVE = "arbs:sort:roi:live";
const Z_ROI_PREGAME = "arbs:sort:roi:pregame";
const V_VER = "arbs:v";

function parseIntSafe(v: string | null, def: number): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    // Get user authentication status and plan
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userPlan = await getUserPlan(user);
    
    const sp = new URL(req.url).searchParams;
    const clientV = parseIntSafe(sp.get("v"), 0);
    
    // Apply plan-based limits
    const requestedLimit = parseIntSafe(sp.get("limit"), 100);
    const planLimits = PLAN_LIMITS[userPlan].arbitrage;
    const maxAllowed = planLimits.maxResults === -1 ? 1000 : planLimits.maxResults;
    
    // For free/anonymous users, we need to fetch MORE records from Redis because we'll filter them down
    // Fetch 5x the requested amount to ensure we have enough after filtering
    const isFreeUser = userPlan === 'free' || userPlan === 'anonymous';
    const fetchLimit = isFreeUser ? Math.min(500, maxAllowed * 5) : Math.max(1, Math.min(maxAllowed, requestedLimit));
    const limit = Math.max(1, Math.min(maxAllowed, requestedLimit)); // This is what we tell the client
    
    const cursor = Math.max(0, parseIntSafe(sp.get("cursor"), 0));
    const eventId = sp.get("event_id");
    const mode = (sp.get("mode") ?? "all").toLowerCase() as "all" | "live" | "pregame";
    const debug = sp.get("debug") === "1";

    const serverV = (await redis.get<number>(V_VER)) ?? 0;
    if (clientV && clientV === serverV) {
      return new NextResponse(null, {
        status: 304,
        headers: { "Cache-Control": "no-store" },
      });
    }

    let ids: string[] = [];
    const Z = mode === "live" ? Z_ROI_LIVE : mode === "pregame" ? Z_ROI_PREGAME : Z_ROI;
    if (eventId) {
      const allResp = (await (redis as any).smembers(`arbs:by_event:${eventId}`)) as unknown;
      const allIds: string[] = Array.isArray(allResp) ? (allResp as any[]).map((x) => String(x)) : [];
      if (allIds.length > 0) {
        const scores = (await (redis as any).zmscore(Z, ...allIds)) as Array<number | null> | null;
        const pairs = allIds
          .map((id, i) => [id, Number(scores?.[i] ?? 0)] as const)
          .sort((a, b) => b[1] - a[1]);
        ids = pairs.slice(cursor, cursor + fetchLimit).map((p) => p[0]);
      }
    } else {
      ids = await zrevrangeCompat(redis as any, Z, cursor, cursor + fetchLimit - 1);
    }

    const rawUnknown = ids.length ? ((await (redis as any).hmget(H_ROWS, ...ids)) as unknown) : [];
    let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];
    let usedFallback = false;
    if (ids.length && (!Array.isArray(rawUnknown) || (rawArr.length === 0 && ids.length > 0))) {
      // Fallback: fetch via HGET per id (works across client versions)
      usedFallback = true;
      rawArr = await Promise.all(ids.map((id) => (redis as any).hget(H_ROWS, id)));
    }
    const parseRow = (val: any): ArbRow | null => {
      if (!val) return null;
      if (typeof val === 'string') {
        try { return JSON.parse(val) as ArbRow; } catch { return null; }
      }
      if (typeof val === 'object') return val as ArbRow;
      return null;
    };
    const rowsParsed = rawArr.map(parseRow);

    // Keep ids and rows parallel: zip them together, then filter as pairs
    let pairs: Array<{ id: string; row: ArbRow }> = [];
    const missingIds: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const row = rowsParsed[i];
      if (row) {
        pairs.push({ id: ids[i], row });
      } else {
        missingIds.push(ids[i]);
      }
    }

    const preFreshCount = pairs.length;
    pairs = pairs.filter((p) => isArbFreshForMode(p.row, mode, Date.now()));
    const staleFilteredCount = preFreshCount - pairs.length;

    // Apply plan-based restrictions
    let filteredCount = 0;
    if (userPlan === 'free' || userPlan === 'anonymous') {
      const originalCount = pairs.length;
      pairs = pairs.filter((p) => {
        const roiPercent = (p.row.roi_bps ?? 0) / 100;
        const isLive = p.row.ev?.live === true;
        return roiPercent <= 1.0 && !isLive;
      });
      filteredCount = originalCount - pairs.length;
      if (pairs.length > limit) pairs = pairs.slice(0, limit);
    } else if (userPlan === 'sharp' && !planLimits.hasLiveArb) {
      // Sharp: pregame only (no live arbs)
      const originalCount = pairs.length;
      pairs = pairs.filter((p) => p.row.ev?.live !== true);
      filteredCount = originalCount - pairs.length;
      if (pairs.length > limit) pairs = pairs.slice(0, limit);
    }

    // Extract parallel arrays for response
    const finalIds = pairs.map((p) => p.id);
    const rows = pairs.map((p) => p.row);

    const body: Record<string, any> = {
      format: ROWS_FORMAT,
      v: serverV,
      mode,
      ids: finalIds,
      rows,
      // Include plan info in response
      plan: userPlan,
      limits: {
        maxResults: planLimits.maxResults,
        applied: limit,
        canFilter: planLimits.canFilter,
        canExport: planLimits.canExport,
      }
    };
    if (debug) body.missing = missingIds;
    if (debug && staleFilteredCount > 0) body.staleFiltered = staleFilteredCount;
    if (filteredCount > 0) {
      body.filteredCount = filteredCount;
      body.filteredReason =
        userPlan === "sharp"
          ? "Sharp plan: pregame arbs only (upgrade to Elite for live)"
          : "Free users limited to pregame arbs with ROI ≤ 1%";
    }

    const headers: Record<string, string> = { 
      "Cache-Control": "no-store",
      "X-User-Plan": userPlan,
      "X-Plan-Limit": String(maxAllowed),
    };
    if (missingIds.length) headers["X-Arbs-Missing"] = String(missingIds.length);
    if (usedFallback) headers["X-Arbs-HMGET-Fallback"] = "1";

    return NextResponse.json(body, { headers });
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
