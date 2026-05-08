"use client";

import { useQuery } from "@tanstack/react-query";

export interface MlbGameWeather {
  temperature_f: number | null;
  wind_speed_mph: number | null;
  wind_relative_deg: number | null;
  wind_label: string | null;
  wind_impact: string | null;
  hr_impact_score: number | null;
  precip_probability: number | null;
  cloud_cover_pct: number | null;
  roof_type: string | null;
  venue_name: string | null;
}

export interface MlbGameOdds {
  home_ml: string | null;
  away_ml: string | null;
  total: number | null;
  total_over_price: string | null;
  total_under_price: string | null;
  spread: number | null;
  spread_home_price: string | null;
  spread_away_price: string | null;
  home_total: number | null;
  home_total_over_price: string | null;
  home_total_under_price: string | null;
  away_total: number | null;
  away_total_over_price: string | null;
  away_total_under_price: string | null;
}

export interface MlbGameLiveState {
  current_pitcher_id: number | null;
  current_pitcher_name: string | null;
  current_batter_id: number | null;
  current_batter_name: string | null;
  current_inning: number | null;
  current_inning_half: "top" | "bottom" | null;
  current_outs: number | null;
  current_balls: number | null;
  current_strikes: number | null;
  runners_on_base: { first: boolean; second: boolean; third: boolean } | null;
  current_batting_order: number | null;
  on_deck_name: string | null;
  in_hole_name: string | null;
  last_play_description: string | null;
  live_feed_updated_at: string | null;
}

export interface MlbGame {
  game_id: string;
  game_date: string;
  game_datetime: string | null;
  doubleheader: string | null;
  game_num: number | null;
  home_team_name: string;
  away_team_name: string;
  home_team_tricode: string;
  away_team_tricode: string;
  home_team_score: number | null;
  away_team_score: number | null;
  home_team_record: string | null;
  away_team_record: string | null;
  game_status: string;
  final_inning: number | null;
  venue_id: number | null;
  odds_game_id: string | null;
  home_probable_pitcher: string | null;
  away_probable_pitcher: string | null;
  home_probable_pitcher_id: number | null;
  away_probable_pitcher_id: number | null;
  is_primetime: boolean | null;
  national_broadcast: string | null;
  neutral_site: boolean | null;
  season_type: string | null;
  weather: MlbGameWeather | null;
  park_factor: number | null;
  odds: MlbGameOdds | null;
  // Final game results
  winning_pitcher: string | null;
  losing_pitcher: string | null;
  save_pitcher: string | null;
  // Live game state (populated by VPS poller for in-progress games)
  live: MlbGameLiveState | null;
}

interface GamesResponse {
  games: MlbGame[];
  dates: string[];
  primaryDate: string;
}

async function fetchMlbGames(): Promise<GamesResponse> {
  const res = await fetch("/api/mlb/games", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch games");
  return res.json();
}

export function useMlbGames(enabled = true) {
  const query = useQuery<GamesResponse>({
    queryKey: ["mlb-games"],
    queryFn: fetchMlbGames,
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    // Poll every 30 seconds to pick up live game state changes
    refetchInterval: 30_000,
  });

  return {
    games: query.data?.games || [],
    gamesDates: query.data?.dates || [],
    primaryDate: query.data?.primaryDate || null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
