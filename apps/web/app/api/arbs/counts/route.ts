import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const Z_ROI_ALL = "arbs:sort:roi";
const Z_ROI_LIVE = "arbs:sort:roi:live";
const Z_ROI_PREGAME = "arbs:sort:roi:pregame";
const V_VER = "arbs:v";

export async function GET() {
  try {
    const [all, live, pregame, v] = await Promise.all([
      (redis as any).zcard(Z_ROI_ALL) as Promise<number>,
      (redis as any).zcard(Z_ROI_LIVE) as Promise<number>,
      (redis as any).zcard(Z_ROI_PREGAME) as Promise<number>,
      redis.get<number>(V_VER),
    ]);
    return NextResponse.json(
      { all: Number(all || 0), live: Number(live || 0), pregame: Number(pregame || 0), v: Number(v || 0) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "internal_error", message: e?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}