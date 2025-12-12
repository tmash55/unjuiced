import { useQuery } from "@tanstack/react-query";
import type { DvpRankingsResponse, DvpTeamRanking } from "@/app/api/nba/dvp-rankings/route";

export type { DvpTeamRanking, DvpRankingsResponse };

// Stat options with labels
export const DVP_STATS = [
  { value: "pts", label: "Points", abbr: "PTS", field: "ptsAvg", rankField: "ptsRank", l5Field: "l5PtsAvg" },
  { value: "reb", label: "Rebounds", abbr: "REB", field: "rebAvg", rankField: "rebRank", l5Field: "l5RebAvg" },
  { value: "ast", label: "Assists", abbr: "AST", field: "astAvg", rankField: "astRank", l5Field: "l5AstAvg" },
  { value: "fg3m", label: "3PM", abbr: "3PM", field: "fg3mAvg", rankField: null, l5Field: "l5Fg3mAvg" },
  { value: "stl", label: "Steals", abbr: "STL", field: "stlAvg", rankField: null, l5Field: null },
  { value: "blk", label: "Blocks", abbr: "BLK", field: "blkAvg", rankField: null, l5Field: null },
  { value: "tov", label: "Turnovers", abbr: "TO", field: "tovAvg", rankField: null, l5Field: null },
  { value: "pra", label: "PRA", abbr: "PRA", field: "praAvg", rankField: "praRank", l5Field: "l5PraAvg" },
  { value: "pr", label: "P+R", abbr: "P+R", field: "prAvg", rankField: null, l5Field: null },
  { value: "pa", label: "P+A", abbr: "P+A", field: "paAvg", rankField: null, l5Field: null },
  { value: "ra", label: "R+A", abbr: "R+A", field: "raAvg", rankField: null, l5Field: null },
  { value: "bs", label: "B+S", abbr: "B+S", field: "bsAvg", rankField: null, l5Field: null },
] as const;

export type DvpStatKey = typeof DVP_STATS[number]["value"];

interface UseDvpRankingsOptions {
  position: string;
  season?: string;
  enabled?: boolean;
}

async function fetchDvpRankings(position: string, season?: string): Promise<DvpRankingsResponse> {
  const params = new URLSearchParams();
  params.set("position", position);
  if (season) params.set("season", season);

  const res = await fetch(`/api/nba/dvp-rankings?${params.toString()}`);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch DvP rankings: ${res.status}`);
  }
  
  return res.json();
}

export function useDvpRankings({ position, season, enabled = true }: UseDvpRankingsOptions) {
  const query = useQuery({
    queryKey: ["dvp-rankings", position, season],
    queryFn: () => fetchDvpRankings(position, season),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  return {
    teams: query.data?.teams ?? [],
    position: query.data?.position ?? position,
    season: query.data?.season ?? "2025-26",
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

// Helper to get rank color based on our matchup logic
// Lower rank (1-10) = strong defense = tough for player = RED
// Higher rank (21-30) = weak defense = good for player = GREEN
export function getDvpRankColor(rank: number | null): string {
  if (rank === null) return "text-neutral-500";
  if (rank <= 10) return "text-red-600 dark:text-red-400";
  if (rank >= 21) return "text-emerald-600 dark:text-emerald-400";
  return "text-neutral-600 dark:text-neutral-400";
}

export function getDvpRankBg(rank: number | null): string {
  if (rank === null) return "";
  if (rank <= 5) return "bg-red-100 dark:bg-red-900/30";
  if (rank <= 10) return "bg-red-50 dark:bg-red-900/20";
  if (rank >= 26) return "bg-emerald-100 dark:bg-emerald-900/30";
  if (rank >= 21) return "bg-emerald-50 dark:bg-emerald-900/20";
  return "";
}

// Get trend indicator comparing season avg to L5 avg
export function getTrendIndicator(seasonAvg: number | null, l5Avg: number | null): {
  direction: "up" | "down" | "neutral";
  diff: number;
} {
  if (seasonAvg === null || l5Avg === null) {
    return { direction: "neutral", diff: 0 };
  }
  
  const diff = l5Avg - seasonAvg;
  const threshold = 1; // Need at least 1 point difference to show trend
  
  if (diff >= threshold) return { direction: "up", diff };
  if (diff <= -threshold) return { direction: "down", diff };
  return { direction: "neutral", diff };
}

