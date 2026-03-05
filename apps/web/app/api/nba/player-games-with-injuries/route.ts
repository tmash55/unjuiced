import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  season: z.string().nullish().transform(v => v ?? "2025-26"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { playerId, season } = parsed.data;
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_player_games_with_injuries", {
      p_player_id: playerId,
      p_season: season,
      p_filter_player_id: null,
    });

    if (error) {
      console.error("[player-games-with-injuries] RPC error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("[player-games-with-injuries] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
