import { useQuery } from "@tanstack/react-query";
import type { DvpRankingsResponse, DvpTeamRanking } from "@/app/api/nba/dvp-rankings/route";

export type { DvpTeamRanking, DvpRankingsResponse };

// Sample size / time window options
export const DVP_SAMPLE_SIZES = [
  { value: "season", label: "Season", prefix: "" },
  { value: "l5", label: "Last 5", prefix: "l5" },
  { value: "l10", label: "Last 10", prefix: "l10" },
  { value: "l15", label: "Last 15", prefix: "l15" },
  { value: "l20", label: "Last 20", prefix: "l20" },
] as const;

export type DvpSampleSize = typeof DVP_SAMPLE_SIZES[number]["value"];

// Basic stats with all fields
export const DVP_BASIC_STATS = [
  { 
    value: "pts", 
    label: "Points", 
    abbr: "PTS", 
    field: "ptsAvg", 
    rankField: "ptsRank",
    l5Field: "l5PtsAvg",
    l10Field: "l10PtsAvg",
    l15Field: "l15PtsAvg",
    l20Field: "l20PtsAvg",
    minField: "minPts",
    maxField: "maxPts",
  },
  { 
    value: "reb", 
    label: "Rebounds", 
    abbr: "REB", 
    field: "rebAvg", 
    rankField: "rebRank",
    l5Field: "l5RebAvg",
    l10Field: "l10RebAvg",
    l15Field: "l15RebAvg",
    l20Field: "l20RebAvg",
    minField: "minReb",
    maxField: "maxReb",
  },
  { 
    value: "ast", 
    label: "Assists", 
    abbr: "AST", 
    field: "astAvg", 
    rankField: "astRank",
    l5Field: "l5AstAvg",
    l10Field: "l10AstAvg",
    l15Field: "l15AstAvg",
    l20Field: "l20AstAvg",
    minField: "minAst",
    maxField: "maxAst",
  },
  { 
    value: "fg3m", 
    label: "3PM", 
    abbr: "3PM", 
    field: "fg3mAvg", 
    rankField: "fg3mRank",
    l5Field: "l5Fg3mAvg",
    l10Field: "l10Fg3mAvg",
    l15Field: "l15Fg3mAvg",
    l20Field: "l20Fg3mAvg",
    minField: "minFg3m",
    maxField: "maxFg3m",
  },
  { 
    value: "stl", 
    label: "Steals", 
    abbr: "STL", 
    field: "stlAvg", 
    rankField: "stlRank",
    l5Field: "l5StlAvg",
    l10Field: "l10StlAvg",
    l15Field: "l15StlAvg",
    l20Field: "l20StlAvg",
    minField: "minStl",
    maxField: "maxStl",
  },
  { 
    value: "blk", 
    label: "Blocks", 
    abbr: "BLK", 
    field: "blkAvg", 
    rankField: "blkRank",
    l5Field: "l5BlkAvg",
    l10Field: "l10BlkAvg",
    l15Field: "l15BlkAvg",
    l20Field: "l20BlkAvg",
    minField: "minBlk",
    maxField: "maxBlk",
  },
  { 
    value: "tov", 
    label: "Turnovers", 
    abbr: "TO", 
    field: "tovAvg", 
    rankField: "tovRank",
    l5Field: "l5TovAvg",
    l10Field: "l10TovAvg",
    l15Field: "l15TovAvg",
    l20Field: "l20TovAvg",
    minField: "minTov",
    maxField: "maxTov",
  },
] as const;

// Combo stats
export const DVP_COMBO_STATS = [
  { 
    value: "pra", 
    label: "PRA", 
    abbr: "PRA", 
    tooltip: "Points + Rebounds + Assists",
    field: "praAvg", 
    rankField: null,
    l5Field: "l5PraAvg",
    l10Field: "l10PraAvg",
    l15Field: "l15PraAvg",
    l20Field: "l20PraAvg",
    minField: "minPra",
    maxField: "maxPra",
  },
  { 
    value: "pr", 
    label: "P+R", 
    abbr: "P+R", 
    tooltip: "Points + Rebounds",
    field: "prAvg", 
    rankField: null,
    l5Field: "l5PrAvg",
    l10Field: "l10PrAvg",
    l15Field: "l15PrAvg",
    l20Field: "l20PrAvg",
    minField: "minPr",
    maxField: "maxPr",
  },
  { 
    value: "pa", 
    label: "P+A", 
    abbr: "P+A", 
    tooltip: "Points + Assists",
    field: "paAvg", 
    rankField: null,
    l5Field: "l5PaAvg",
    l10Field: "l10PaAvg",
    l15Field: "l15PaAvg",
    l20Field: "l20PaAvg",
    minField: "minPa",
    maxField: "maxPa",
  },
  { 
    value: "ra", 
    label: "R+A", 
    abbr: "R+A", 
    tooltip: "Rebounds + Assists",
    field: "raAvg", 
    rankField: null,
    l5Field: "l5RaAvg",
    l10Field: "l10RaAvg",
    l15Field: "l15RaAvg",
    l20Field: "l20RaAvg",
    minField: "minRa",
    maxField: "maxRa",
  },
  { 
    value: "bs", 
    label: "BLK+STL", 
    abbr: "BLK+STL", 
    tooltip: "Blocks + Steals",
    field: "bsAvg", 
    rankField: null,
    l5Field: "l5BsAvg",
    l10Field: "l10BsAvg",
    l15Field: "l15BsAvg",
    l20Field: "l20BsAvg",
    minField: "minBs",
    maxField: "maxBs",
  },
  { 
    value: "dd2", 
    label: "DD%", 
    abbr: "DD%", 
    tooltip: "Double-Double Percentage",
    field: "dd2Pct", 
    rankField: "dd2PctRank",
    l5Field: null,
    l10Field: null,
    l15Field: null,
    l20Field: null,
    minField: null,
    maxField: null,
  },
] as const;

// Advanced/shooting stats
export const DVP_ADVANCED_STATS = [
  { 
    value: "fgPct", 
    label: "FG%", 
    abbr: "FG%", 
    tooltip: "Field Goal Percentage Allowed",
    field: "fgPct", 
    rankField: "fgPctRank",
    minField: "minFgPct",
    maxField: "maxFgPct",
    isPercentage: true,
  },
  { 
    value: "fg3Pct", 
    label: "3PT%", 
    abbr: "3PT%", 
    tooltip: "3-Point Percentage Allowed",
    field: "fg3Pct", 
    rankField: "fg3PctRank",
    minField: "minFg3Pct",
    maxField: "maxFg3Pct",
    isPercentage: true,
  },
  { 
    value: "ftPct", 
    label: "FT%", 
    abbr: "FT%", 
    tooltip: "Free Throw Percentage Allowed",
    field: "ftPct", 
    rankField: "ftPctRank",
    minField: null,
    maxField: null,
    isPercentage: true,
  },
  { 
    value: "fga", 
    label: "FGA", 
    abbr: "FGA", 
    tooltip: "Field Goal Attempts Allowed",
    field: "fgaAvg", 
    rankField: "fgaRank",
    minField: "minFga",
    maxField: "maxFga",
    isPercentage: false,
  },
  { 
    value: "fg3a", 
    label: "3PA", 
    abbr: "3PA", 
    tooltip: "3-Point Attempts Allowed",
    field: "fg3aAvg", 
    rankField: "fg3aRank",
    minField: null,
    maxField: null,
    isPercentage: false,
  },
  { 
    value: "fta", 
    label: "FTA", 
    abbr: "FTA", 
    tooltip: "Free Throw Attempts Allowed",
    field: "ftaAvg", 
    rankField: "ftaRank",
    minField: "minFta",
    maxField: "maxFta",
    isPercentage: false,
  },
  { 
    value: "minutes", 
    label: "Minutes", 
    abbr: "MIN", 
    tooltip: "Minutes Allowed to Position",
    field: "minutesAvg", 
    rankField: "minutesRank",
    minField: "minMinutes",
    maxField: "maxMinutes",
    isPercentage: false,
  },
  { 
    value: "oreb", 
    label: "OREB", 
    abbr: "OREB", 
    tooltip: "Offensive Rebounds Allowed",
    field: "orebAvg", 
    rankField: "orebRank",
    minField: null,
    maxField: null,
    isPercentage: false,
  },
  { 
    value: "dreb", 
    label: "DREB", 
    abbr: "DREB", 
    tooltip: "Defensive Rebounds Allowed",
    field: "drebAvg", 
    rankField: "drebRank",
    minField: null,
    maxField: null,
    isPercentage: false,
  },
] as const;

// Combined stats list for lookups
export const DVP_STATS = [...DVP_BASIC_STATS, ...DVP_COMBO_STATS] as const;

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

// Get heatmap color based on value within min/max range
// Higher value = allows more = good matchup = GREEN
// Lower value = allows less = tough matchup = RED
export function getHeatmapBg(value: number | null, min: number | null, max: number | null): string {
  if (value === null || min === null || max === null) return "";
  if (min === max) return "";
  
  const range = max - min;
  const normalized = (value - min) / range; // 0 to 1, where 1 is max (allows most)
  
  if (normalized >= 0.8) return "bg-emerald-100 dark:bg-emerald-900/40";
  if (normalized >= 0.6) return "bg-emerald-50 dark:bg-emerald-900/20";
  if (normalized <= 0.2) return "bg-red-100 dark:bg-red-900/40";
  if (normalized <= 0.4) return "bg-red-50 dark:bg-red-900/20";
  return "";
}

export function getHeatmapText(value: number | null, min: number | null, max: number | null): string {
  if (value === null || min === null || max === null) return "text-neutral-600 dark:text-neutral-400";
  if (min === max) return "text-neutral-600 dark:text-neutral-400";
  
  const range = max - min;
  const normalized = (value - min) / range;
  
  if (normalized >= 0.8) return "text-emerald-700 dark:text-emerald-300";
  if (normalized >= 0.6) return "text-emerald-600 dark:text-emerald-400";
  if (normalized <= 0.2) return "text-red-700 dark:text-red-300";
  if (normalized <= 0.4) return "text-red-600 dark:text-red-400";
  return "text-neutral-600 dark:text-neutral-400";
}

// Get trend indicator comparing season avg to sample avg
export function getTrendIndicator(
  seasonAvg: number | null, 
  sampleAvg: number | null,
  threshold: number = 1
): {
  direction: "up" | "down" | "neutral";
  diff: number;
  pctChange: number;
} {
  if (seasonAvg === null || sampleAvg === null || seasonAvg === 0) {
    return { direction: "neutral", diff: 0, pctChange: 0 };
  }
  
  const diff = sampleAvg - seasonAvg;
  const pctChange = (diff / seasonAvg) * 100;
  
  if (diff >= threshold) return { direction: "up", diff, pctChange };
  if (diff <= -threshold) return { direction: "down", diff, pctChange };
  return { direction: "neutral", diff, pctChange };
}

// Get the correct field name based on sample size
export function getFieldForSampleSize(
  baseStat: typeof DVP_BASIC_STATS[number] | typeof DVP_COMBO_STATS[number],
  sampleSize: DvpSampleSize
): keyof DvpTeamRanking {
  if (sampleSize === "season") return baseStat.field as keyof DvpTeamRanking;
  
  const fieldMap: Record<string, keyof typeof baseStat> = {
    l5: "l5Field",
    l10: "l10Field",
    l15: "l15Field",
    l20: "l20Field",
  };
  
  const fieldKey = fieldMap[sampleSize];
  if (!fieldKey) return baseStat.field as keyof DvpTeamRanking;
  
  const field = baseStat[fieldKey as keyof typeof baseStat];
  return (field || baseStat.field) as keyof DvpTeamRanking;
}
