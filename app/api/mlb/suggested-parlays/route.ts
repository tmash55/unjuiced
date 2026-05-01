import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface ParlayLeg {
  player_id: number;
  player_name: string;
  market: string;
  line: number;
  odds: number | null;
  book: string | null;
  composite_score: number | null;
  grade: string | null;
  model_prob: number | null;
}

export interface SuggestedParlay {
  id: number;
  game_id: number;
  game_date: string;
  parlay_type: "teammate_stack" | "pitcher_domination" | "narrative";
  legs: ParlayLeg[];
  combined_model_prob: number | null;
  correlation_boost: number | null;
  narrative: string | null;
  confidence: "S" | "A" | "B" | "C";
  tags: string[];
  sgp_odds: Record<string, number> | null;
}

export interface SuggestedParlaysResponse {
  parlays: SuggestedParlay[];
}

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? getETDate();
    const gameId = searchParams.get("game_id");
    const minConfidence = searchParams.get("min_confidence") ?? "C";

    const sb = createServerSupabaseClient();

    const { data, error } = await sb.rpc("get_suggested_parlays", {
      p_date: date,
      p_game_id: gameId ? Number(gameId) : null,
      p_min_confidence: minConfidence,
    });

    if (error) {
      console.error("[Suggested Parlays API] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch suggested parlays", details: error.message },
        { status: 500 }
      );
    }

    const parlays: SuggestedParlay[] = (data ?? []).map((row: any) => ({
      id: row.id,
      game_id: row.game_id,
      game_date: row.game_date ?? date,
      parlay_type: row.parlay_type,
      legs: row.legs ?? [],
      combined_model_prob: row.combined_model_prob,
      correlation_boost: row.correlation_boost,
      narrative: row.narrative,
      confidence: row.confidence ?? "C",
      tags: row.tags ?? [],
      sgp_odds: row.sgp_odds,
    }));

    return NextResponse.json(
      { parlays } as SuggestedParlaysResponse,
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error: any) {
    console.error("[Suggested Parlays API] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500 }
    );
  }
}
