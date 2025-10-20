import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const ALLOWED_SPORTS = new Set(["nfl", "ncaaf", "mlb", "wnba", "nba", "ncaab", "nhl"]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport")?.trim().toLowerCase() || "";
    const sid = searchParams.get("sid")?.trim() || "";

    // Validate sport
    if (!sport || !ALLOWED_SPORTS.has(sport)) {
      return NextResponse.json(
        { error: "invalid_sport" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validate sid
    if (!sid) {
      return NextResponse.json(
        { error: "missing_sid" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Fetch alternates from Redis
    const altKey = `props:${sport}:rows:alt:${sid}`;
    const altData = await redis.get(altKey);

    if (!altData) {
      return NextResponse.json(
        { alternates: [], message: "no_alternates_found" },
        { 
          status: 200, 
          headers: { 
            "Cache-Control": "public, max-age=30, s-maxage=30" // Cache for 30s
          } 
        }
      );
    }

    // Parse alternates data
    let parsed;
    try {
      parsed = typeof altData === "string" ? JSON.parse(altData) : altData;
    } catch (parseError) {
      console.error("[ALTERNATES] Parse error:", parseError);
      return NextResponse.json(
        { error: "invalid_data_format" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Extract lines array from the parsed data
    const lines = parsed?.lines || [];
    const primaryLine = parsed?.primary_ln;
    
    // Filter out the primary line from alternates (we don't want duplicates)
    const alternates = lines.filter((line: any) => line.ln !== primaryLine);

    // Return alternates with metadata
    return NextResponse.json(
      { 
        sid,
        sport,
        alternates,
        primary_ln: primaryLine,
        player: parsed?.player,
        position: parsed?.position,
        team: parsed?.team,
        market: parsed?.mkt,
        event: parsed?.ev,
        timestamp: Date.now()
      },
      { 
        headers: { 
          "Cache-Control": "public, max-age=30, s-maxage=30",
          "X-Alternates-Count": String(alternates.length),
          "X-Primary-Line": String(primaryLine || "unknown")
        } 
      }
    );
  } catch (error: any) {
    console.error("[ALTERNATES] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}









