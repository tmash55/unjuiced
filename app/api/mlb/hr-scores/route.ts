import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HRScorePlayer {
  player_id: number | null;
  player_name: string;
  team_abbr: string;
  hr_score: number;
  score_tier: string;
  // Sub-scores (0-100)
  batter_power_score: number;
  pitcher_vuln_score: number;
  park_factor_score: number;
  environment_score: number;
  matchup_context_score: number;
  // Matchup
  opp_pitcher_name: string | null;
  opp_pitcher_hand: string | null;
  bat_hand: string | null;
  venue_name: string | null;
  // Statcast
  barrel_pct: number | null;
  max_exit_velo: number | null;
  hard_hit_pct: number | null;
  iso: number | null;
  // Park & weather
  park_hr_factor: number | null;
  temperature_f: number | null;
  wind_label: string | null;
  env_boost: string | null;
  // Matchup context
  platoon_advantage: boolean | null;
  bvp_pa: number | null;
  bvp_hr: number | null;
  // Surge
  surge_direction: string | null;
  surge_barrel_pct_7d: number | null;
  surge_hr_7d: number | null;
  // Odds
  best_odds_american: number | null;
  best_odds_book: string | null;
  best_odds_link: string | null;
  best_odds_mobile_link: string | null;
  // Model
  model_implied_prob: number | null;
  odds_implied_prob: number | null;
  edge_pct: number | null;
  // Extra
  all_book_odds: Record<string, any> | null;
  hr_streak: number | null;
  hr_last_3_games: number | null;
  game_date: string;
}

export interface HRScoreResponse {
  players: HRScorePlayer[];
  meta: {
    date: string;
    totalPlayers: number;
    availableDates: string[];
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const targetDate = dateParam || getETDate();

    const sb = createServerSupabaseClient();

    const { data, error } = await sb
      .from("mlb_hr_scores")
      .select("*")
      .eq("game_date", targetDate)
      .order("hr_score", { ascending: false });

    if (error) {
      console.error("[HR Scores API] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch HR scores", details: error.message },
        { status: 500 }
      );
    }

    const players = (data ?? []) as HRScorePlayer[];

    // Fetch available dates from hr_scores table
    const today = getETDate();
    const { data: dateRows } = await sb
      .from("mlb_hr_scores")
      .select("game_date")
      .gte("game_date", today)
      .order("game_date", { ascending: true });

    const availableDates = [
      ...new Set((dateRows ?? []).map((r: { game_date: string }) => r.game_date)),
    ] as string[];

    const response: HRScoreResponse = {
      players,
      meta: {
        date: targetDate,
        totalPlayers: players.length,
        availableDates,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err: any) {
    console.error("[HR Scores API]", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
