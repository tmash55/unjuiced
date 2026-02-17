import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Simple in-memory cache to coalesce bursts
type CacheEntry = { etag: string; body: string; ts: number };
const MEMO = new Map<string, CacheEntry>();
const TTL_MS = 10_000; // 10s

const SUPPORTED_SPORTS = new Set([
  "nfl",
  "nba",
  "nhl",
  "mlb",
  "ncaabaseball",
  "ncaaf",
  "ncaab",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
]);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    const sid = (sp.get("sid") || sp.get("familySid") || "").trim();

    if (!sport || !SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json({ error: "invalid_sport" }, { status: 400 });
    }
    if (!sid) {
      return NextResponse.json({ error: "missing_sid" }, { status: 400 });
    }

    const key = `props:${sport}:rows:alt:${sid}`;

    // Memory cache check
    const now = Date.now();
    const cached = MEMO.get(key);
    if (cached && now - cached.ts < TTL_MS) {
      const ifNoneMatch = req.headers.get("if-none-match");
      if (ifNoneMatch && ifNoneMatch === cached.etag) {
        return new NextResponse(null, { status: 304 });
      }
      return new NextResponse(cached.body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=10",
          ETag: cached.etag,
        },
      });
    }

    const raw = await redis.get(key as any);
    if (!raw) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Ensure body is a stringified JSON regardless of storage type
    const bodyStr = typeof raw === "string" ? (raw as string) : JSON.stringify(raw);
    const etag = `W/"${Buffer.from(String(bodyStr.length) + ':' + sid).toString('base64')}"`;
    MEMO.set(key, { etag, body: bodyStr, ts: now });

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(bodyStr, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=10",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[/api/props/alt] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

