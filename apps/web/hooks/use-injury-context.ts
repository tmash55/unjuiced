"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";

// Player who was out during games
export interface PlayerOutInfo {
  player_id: number;
  name: string;
  position: string | null;
  team_id?: number; // Only for opponents
  games_out: number;
  avg_pts: number | null;
  avg_reb: number | null;
  avg_ast: number | null;
}

// Response from get_players_out_for_filter RPC
export interface PlayersOutForFilterResponse {
  player_id: number;
  team_id: number;
  teammates_out: PlayerOutInfo[];
  opponents_out: PlayerOutInfo[];
}

// Game with injury context
export interface GameWithInjuries {
  game_id: string;
  game_date: string;
  opponent_team_id: number;
  home_away: "H" | "A";
  result: "W" | "L";
  pts: number;
  reb: number;
  ast: number;
  fg3m: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  minutes: number;
  pra: number;
  pr: number;
  pa: number;
  ra: number;
  bs: number;
  teammates_out: Array<{
    player_id: number;
    name: string;
    position: string | null;
    reason: string | null;
  }>;
  opponents_out: Array<{
    player_id: number;
    name: string;
    position: string | null;
    reason: string | null;
  }>;
}

// Response from get_player_games_with_injuries RPC
export interface PlayerGamesWithInjuriesResponse {
  player_id: number;
  team_id: number;
  season: string;
  filter_player_id: number | null;
  total_games: number;
  games: GameWithInjuries[];
}

// Hook options
export interface UsePlayersOutForFilterOptions {
  playerId: number | null;
  season?: string;
  enabled?: boolean;
}

export interface UsePlayerGamesWithInjuriesOptions {
  playerId: number | null;
  season?: string;
  filterPlayerId?: number | null;
  enabled?: boolean;
}

// Create Supabase client
function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Hook to get all players who were out during a player's games
 * Used to populate the injury filter dropdown
 */
export function usePlayersOutForFilter(options: UsePlayersOutForFilterOptions) {
  const { playerId, season = "2025-26", enabled = true } = options;

  const query = useQuery<PlayersOutForFilterResponse | null>({
    queryKey: ["players-out-for-filter", playerId, season],
    queryFn: async () => {
      if (!playerId) return null;
      
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("get_players_out_for_filter", {
        p_player_id: playerId,
        p_season: season,
      });

      if (error) {
        console.error("[usePlayersOutForFilter] RPC error:", error.message);
        throw error;
      }

      return data as PlayersOutForFilterResponse;
    },
    enabled: enabled && playerId !== null,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
  });

  return {
    data: query.data,
    teammatesOut: query.data?.teammates_out ?? [],
    opponentsOut: query.data?.opponents_out ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Hook to get all games for a player with injury context
 * Each game includes who was out (teammates and opponents)
 */
export function usePlayerGamesWithInjuries(options: UsePlayerGamesWithInjuriesOptions) {
  const { playerId, season = "2025-26", filterPlayerId, enabled = true } = options;

  const query = useQuery<PlayerGamesWithInjuriesResponse | null>({
    queryKey: ["player-games-with-injuries", playerId, season, filterPlayerId],
    queryFn: async () => {
      if (!playerId) return null;

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("get_player_games_with_injuries", {
        p_player_id: playerId,
        p_season: season,
        p_filter_player_id: filterPlayerId ?? null,
      });

      if (error) {
        console.error("[usePlayerGamesWithInjuries] RPC error:", error.message);
        throw error;
      }

      return data as PlayerGamesWithInjuriesResponse;
    },
    enabled: enabled && playerId !== null,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  return {
    data: query.data,
    games: query.data?.games ?? [],
    totalGames: query.data?.total_games ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Calculate averages for a subset of games
 */
export function calculateGameAverages(games: GameWithInjuries[]) {
  if (games.length === 0) {
    return {
      gamesPlayed: 0,
      avgPts: 0,
      avgReb: 0,
      avgAst: 0,
      avgPra: 0,
      avgFg3m: 0,
      avgStl: 0,
      avgBlk: 0,
      avgMinutes: 0,
    };
  }

  const sum = games.reduce(
    (acc, g) => ({
      pts: acc.pts + g.pts,
      reb: acc.reb + g.reb,
      ast: acc.ast + g.ast,
      pra: acc.pra + g.pra,
      fg3m: acc.fg3m + g.fg3m,
      stl: acc.stl + g.stl,
      blk: acc.blk + g.blk,
      minutes: acc.minutes + g.minutes,
    }),
    { pts: 0, reb: 0, ast: 0, pra: 0, fg3m: 0, stl: 0, blk: 0, minutes: 0 }
  );

  const count = games.length;
  return {
    gamesPlayed: count,
    avgPts: Math.round((sum.pts / count) * 10) / 10,
    avgReb: Math.round((sum.reb / count) * 10) / 10,
    avgAst: Math.round((sum.ast / count) * 10) / 10,
    avgPra: Math.round((sum.pra / count) * 10) / 10,
    avgFg3m: Math.round((sum.fg3m / count) * 10) / 10,
    avgStl: Math.round((sum.stl / count) * 10) / 10,
    avgBlk: Math.round((sum.blk / count) * 10) / 10,
    avgMinutes: Math.round((sum.minutes / count) * 10) / 10,
  };
}

/**
 * Filter games by player availability
 * mode: "with" = games where player played, "without" = games where player was out
 */
export function filterGamesByPlayerAvailability(
  games: GameWithInjuries[],
  playerId: number,
  mode: "with" | "without",
  isTeammate: boolean
) {
  return games.filter((game) => {
    const outList = isTeammate ? game.teammates_out : game.opponents_out;
    const wasOut = outList.some((p) => p.player_id === playerId);
    
    if (mode === "without") {
      // Show games where this player was OUT
      return wasOut;
    } else {
      // Show games where this player PLAYED (was not out)
      return !wasOut;
    }
  });
}

