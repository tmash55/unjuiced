import { useQuery } from "@tanstack/react-query";

// Zone data from the RPC
export interface ShotZone {
  zone: string;
  display_name: string;
  player_fgm: number;
  player_fga: number;
  player_fg_pct: number;
  player_points: number;
  player_pct_of_total: number;
  opponent_def_rank: number | null;
  opponent_opp_fg_pct: number | null;
  matchup_rating: "favorable" | "neutral" | "tough" | "N/A";
  matchup_color: "green" | "yellow" | "red" | "gray";
}

export interface ShotZoneMatchupResponse {
  player: {
    id: number;
    name: string;
    team_id: number;
    team_name: string;
    team_abbr: string;
    total_points: number;
    season: string;
  };
  opponent: {
    team_id: number;
    team_name: string;
    team_abbr: string;
  };
  zones: ShotZone[];
  summary: {
    total_zones_shown: number;
    favorable_zones: number;
    neutral_zones: number;
    tough_zones: number;
    favorable_pct_of_points: number;
    neutral_pct_of_points: number;
    tough_pct_of_points: number;
  };
  methodology: {
    data_source: string;
    defense_ranking: string;
    matchup_ratings: string;
  };
}

interface UseShotZoneMatchupOptions {
  playerId: number | null | undefined;
  opponentTeamId: number | null | undefined;
  season?: string;
  enabled?: boolean;
}

export function useShotZoneMatchup({
  playerId,
  opponentTeamId,
  season = "2025-26",
  enabled = true,
}: UseShotZoneMatchupOptions) {
  return useQuery<ShotZoneMatchupResponse, Error>({
    queryKey: ["shot-zone-matchup", playerId, opponentTeamId, season],
    queryFn: async () => {
      if (!playerId || !opponentTeamId) {
        throw new Error("Player ID and Opponent Team ID are required.");
      }
      const res = await fetch(
        `/api/nba/shot-zone-matchup?playerId=${playerId}&opponentTeamId=${opponentTeamId}&season=${season}`
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch shot zone matchup");
      }
      return res.json();
    },
    enabled: enabled && !!playerId && !!opponentTeamId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Helper to map zone names from RPC to our component zone IDs
export function mapZoneToId(zoneName: string): string {
  const mapping: Record<string, string> = {
    "Restricted Area": "rim",
    "In The Paint (Non-RA)": "paint",
    "In The Paint": "paint",
    "Mid-Range": "midRange",
    "Left Corner 3": "corner3Left",
    "Right Corner 3": "corner3Right",
    "Above the Break 3": "aboveBreak3",
    "Above Break 3": "aboveBreak3",
  };
  return mapping[zoneName] || zoneName.toLowerCase().replace(/\s+/g, "");
}

