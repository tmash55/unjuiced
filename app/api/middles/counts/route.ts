import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { MIDDLES_REDIS_KEYS } from "@/lib/middles-redis-keys";

export async function GET() {
  try {
    const [all, live, pregame, v] = await Promise.all([
      (redis as any).zcard(MIDDLES_REDIS_KEYS.sortScore) as Promise<number>,
      (redis as any).zcard(MIDDLES_REDIS_KEYS.sortScoreLive) as Promise<number>,
      (redis as any).zcard(
        MIDDLES_REDIS_KEYS.sortScorePregame,
      ) as Promise<number>,
      redis.get<number>(MIDDLES_REDIS_KEYS.version),
    ]);

    return NextResponse.json(
      {
        all: Number(all || 0),
        live: Number(live || 0),
        pregame: Number(pregame || 0),
        v: Number(v || 0),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
