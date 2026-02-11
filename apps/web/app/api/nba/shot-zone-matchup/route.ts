import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  opponentTeamId: z.coerce.number().int().positive(),
  season: z.string().nullish().transform(v => v ?? "2025-26"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      opponentTeamId: searchParams.get("opponentTeamId"),
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { playerId, opponentTeamId, season } = parsed.data;
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_shot_zone_matchup", {
      p_player_id: playerId,
      p_opponent_team_id: opponentTeamId,
      p_season: season,
    });

    if (error) {
      console.error("[/api/nba/shot-zone-matchup] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch shot zone matchup", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/shot-zone-matchup] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500 }
    );
  }
}

