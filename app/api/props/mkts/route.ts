import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
const SUPPORTED_SPORTS = new Set(["nfl", "nba", "nhl", "ncaaf"]);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    if (!sport || !SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json({ error: "invalid_sport" }, { status: 400 });
    }

    const key = `props:${sport}:mkts`;
    const mkts = await redis.smembers<string>(key);
    return NextResponse.json({ mkts: mkts || [] }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
  } catch (e) {
    console.error("[/api/props/mkts] error", e);
    return NextResponse.json({ mkts: [] }, { status: 200 });
  }
}


