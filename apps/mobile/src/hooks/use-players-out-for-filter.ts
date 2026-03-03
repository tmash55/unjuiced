import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/auth-provider";

export interface PlayerOutInfo {
  player_id: number;
  name: string;
  position: string | null;
  games_out: number;
  avg_pts: number | null;
  avg_reb: number | null;
  avg_ast: number | null;
}

interface PlayersOutForFilterResponse {
  player_id: number;
  team_id: number;
  teammates_out: PlayerOutInfo[];
  opponents_out: PlayerOutInfo[];
}

type UsePlayersOutForFilterOptions = {
  playerId: number;
  season?: string;
  enabled?: boolean;
};

export function usePlayersOutForFilter(options: UsePlayersOutForFilterOptions) {
  const { user } = useAuth();
  const { playerId, season = "2025-26", enabled = true } = options;

  return useQuery<PlayersOutForFilterResponse | null>({
    queryKey: ["players-out-for-filter", user?.id, playerId, season],
    queryFn: async () => {
      if (!playerId) return null;
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
    enabled: enabled && Number.isFinite(playerId) && playerId > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
