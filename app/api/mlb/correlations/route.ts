import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface CorrelationRow {
  correlation_type: "teammate_props" | "pitcher_vs_team" | "vs_hand";
  player_a_id: number;
  player_a_name: string;
  player_a_market: string;
  player_a_threshold: number;
  player_b_id: number | null;
  player_b_name: string | null;
  player_b_market: string | null;
  player_b_threshold: number | null;
  team_id: number | null;
  team_abbr: string | null;
  context: Record<string, any>;
  co_occurrence_pct: number;
  sample_size: number;
  both_hit_count: number;
  confidence: "S" | "A" | "B" | "C";
}

export interface CorrelationResponse {
  correlations: CorrelationRow[];
  mode: "game" | "player";
  id: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("game_id");
    const playerId = searchParams.get("player_id");
    const minSample = Number(searchParams.get("min_sample") ?? 3);
    const minCoOccurrence = Number(searchParams.get("min_co_occurrence") ?? 30);

    if (!gameId && !playerId) {
      return NextResponse.json(
        { error: "Either game_id or player_id is required" },
        { status: 400 }
      );
    }

    const sb = createServerSupabaseClient();

    if (gameId) {
      const { data, error } = await sb.rpc("get_game_correlations", {
        p_game_id: Number(gameId),
        p_min_sample: minSample,
        p_min_co_occurrence: minCoOccurrence,
      });

      if (error) {
        console.error("[Correlations API] RPC error:", error);
        return NextResponse.json(
          { error: "Failed to fetch game correlations", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { correlations: data ?? [], mode: "game", id: Number(gameId) } as CorrelationResponse,
        { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
      );
    }

    // Player mode
    const { data, error } = await sb.rpc("get_player_correlations", {
      p_player_id: Number(playerId),
      p_limit: Number(searchParams.get("limit") ?? 30),
    });

    if (error) {
      console.error("[Correlations API] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch player correlations", details: error.message },
        { status: 500 }
      );
    }

    // Map player RPC response to CorrelationRow shape
    const correlations: CorrelationRow[] = (data ?? []).map((row: any) => ({
      correlation_type: row.correlation_type,
      player_a_id: Number(playerId),
      player_a_name: row.partner_name ?? "",
      player_a_market: row.market_a,
      player_a_threshold: 0.5,
      player_b_id: row.partner_id,
      player_b_name: row.partner_name,
      player_b_market: row.market_b,
      player_b_threshold: 0.5,
      team_id: null,
      team_abbr: null,
      context: row.context ?? {},
      co_occurrence_pct: row.co_occurrence_pct,
      sample_size: row.sample_size,
      both_hit_count: 0,
      confidence: row.confidence ?? "C",
    }));

    return NextResponse.json(
      { correlations, mode: "player", id: Number(playerId) } as CorrelationResponse,
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error: any) {
    console.error("[Correlations API] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500 }
    );
  }
}
