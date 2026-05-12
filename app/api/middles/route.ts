import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { zrevrangeCompat } from "@/lib/redis-zset";
import {
  getMiddlesByEventKey,
  MIDDLES_REDIS_KEYS,
} from "@/lib/middles-redis-keys";
import {
  MIDDLES_ROWS_FORMAT,
  type MiddleMode,
  type MiddleRow,
} from "@/lib/middles-schema";

function parseIntSafe(value: string | null, fallback: number): number {
  const n = Number(value ?? "");
  return Number.isFinite(n) ? n : fallback;
}

function parseMode(value: string | null): MiddleMode {
  const mode = String(value || "all").toLowerCase();
  if (mode === "live" || mode === "pregame") return mode;
  return "all";
}

function parseRow(value: unknown): MiddleRow | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as MiddleRow;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value as MiddleRow;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const clientV = parseIntSafe(sp.get("v"), 0);
    const limit = Math.max(
      1,
      Math.min(1000, parseIntSafe(sp.get("limit"), 100)),
    );
    const cursor = Math.max(0, parseIntSafe(sp.get("cursor"), 0));
    const eventId = sp.get("event_id");
    const mode = parseMode(sp.get("mode"));
    const debug = sp.get("debug") === "1";

    const serverV = (await redis.get<number>(MIDDLES_REDIS_KEYS.version)) ?? 0;
    if (clientV && clientV === serverV) {
      return new NextResponse(null, {
        status: 304,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const sortKey =
      mode === "live"
        ? MIDDLES_REDIS_KEYS.sortScoreLive
        : mode === "pregame"
          ? MIDDLES_REDIS_KEYS.sortScorePregame
          : MIDDLES_REDIS_KEYS.sortScore;

    let ids: string[] = [];
    if (eventId) {
      const allResp = (await (redis as any).smembers(
        getMiddlesByEventKey(eventId),
      )) as unknown;
      const allIds = Array.isArray(allResp)
        ? (allResp as unknown[]).map((value) => String(value))
        : [];
      if (allIds.length > 0) {
        const scores = (await (redis as any).zmscore(
          sortKey,
          ...allIds,
        )) as Array<number | null> | null;
        ids = allIds
          .map((id, index) => [id, Number(scores?.[index] ?? 0)] as const)
          .sort((a, b) => b[1] - a[1])
          .slice(cursor, cursor + limit)
          .map(([id]) => id);
      }
    } else {
      ids = await zrevrangeCompat(
        redis as any,
        sortKey,
        cursor,
        cursor + limit - 1,
      );
    }

    const rawUnknown = ids.length
      ? ((await (redis as any).hmget(
          MIDDLES_REDIS_KEYS.rows,
          ...ids,
        )) as unknown)
      : [];
    let rawRows = Array.isArray(rawUnknown) ? (rawUnknown as unknown[]) : [];
    let usedFallback = false;

    if (ids.length && (!Array.isArray(rawUnknown) || rawRows.length === 0)) {
      usedFallback = true;
      rawRows = await Promise.all(
        ids.map((id) => (redis as any).hget(MIDDLES_REDIS_KEYS.rows, id)),
      );
    }

    const rows: MiddleRow[] = [];
    const finalIds: string[] = [];
    const missing: string[] = [];

    ids.forEach((id, index) => {
      const row = parseRow(rawRows[index]);
      if (!row) {
        missing.push(id);
        return;
      }
      finalIds.push(id);
      rows.push(row);
    });

    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (missing.length) headers["X-Middles-Missing"] = String(missing.length);
    if (usedFallback) headers["X-Middles-HMGET-Fallback"] = "1";

    const body: Record<string, unknown> = {
      format: MIDDLES_ROWS_FORMAT,
      v: serverV,
      mode,
      ids: finalIds,
      rows,
    };
    if (debug) body.missing = missing;

    return NextResponse.json(body, { headers });
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
