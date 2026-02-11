"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Hit Rate Matrix Hook
 * 
 * Fetches hit rates across fixed point thresholds (5, 10, 15...50) for all players.
 * Includes DvP data, primary line, and odds at each threshold.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ThresholdData {
  line: number;
  actualLine: number | null; // The actual sportsbook line used (may differ from threshold)
  hitRate: number | null;    // Keep for context
  hits: number;
  games: number;
  // Odds data
  bestOdds: number | null;       // American odds (display)
  bestDecimal: number | null;    // Decimal odds (calculation)
  bestBook: string | null;
  oddsLink: string | null;
  // Edge calculation (odds-based: best vs market average)
  avgDecimal: number | null;     // Average across all books
  edgePct: number | null;        // ((best/avg) - 1) * 100
  bookCount: number;             // Number of books with odds
  isBestCell: boolean;           // True if this is the best edge cell in the row
}

export interface HitRateMatrixRow {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  position: string;
  eventId: string;
  gameId: number | null;  // Numeric game ID for matching with useNbaGames
  selKey: string;
  gameDate: string;
  opponentAbbr: string;
  homeAway: string;
  dvpRank: number | null;
  dvpQuality: "favorable" | "neutral" | "unfavorable" | null;
  primaryLine: number | null;
  thresholds: ThresholdData[];
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface HitRateMatrixResponse {
  rows: HitRateMatrixRow[];
  market: string;
  timeWindow: string;
  thresholdLines: number[];
  count: number;
}

export type HitRateMatrixTimeWindow = "last_5" | "last_10" | "last_20" | "season";

export interface UseHitRateMatrixOptions {
  market?: string;
  gameDate?: string;
  timeWindow?: HitRateMatrixTimeWindow;
  positions?: string[];
  enabled?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const HIT_RATE_MATRIX_MARKETS = [
  { value: "player_points", label: "Points", abbr: "PTS" },
  { value: "player_rebounds", label: "Rebounds", abbr: "REB" },
  { value: "player_assists", label: "Assists", abbr: "AST" },
  { value: "player_points_rebounds_assists", label: "PRA", abbr: "PRA" },
  { value: "player_points_rebounds", label: "P+R", abbr: "P+R" },
  { value: "player_points_assists", label: "P+A", abbr: "P+A" },
  { value: "player_rebounds_assists", label: "R+A", abbr: "R+A" },
  { value: "player_threes_made", label: "3PM", abbr: "3PM" },
  { value: "player_steals", label: "Steals", abbr: "STL" },
  { value: "player_blocks", label: "Blocks", abbr: "BLK" },
  { value: "player_blocks_steals", label: "Blk+Stl", abbr: "B+S" },
];

export const TIME_WINDOW_OPTIONS = [
  { value: "last_5" as const, label: "Last 5", shortLabel: "L5" },
  { value: "last_10" as const, label: "Last 10", shortLabel: "L10" },
  { value: "last_20" as const, label: "Last 20", shortLabel: "L20" },
  { value: "season" as const, label: "Season", shortLabel: "SZN" },
];

export const POSITION_OPTIONS = [
  { value: "PG", label: "Point Guard" },
  { value: "SG", label: "Shooting Guard" },
  { value: "SF", label: "Small Forward" },
  { value: "PF", label: "Power Forward" },
  { value: "C", label: "Center" },
];

/**
 * Convert decimal odds back to American odds for display
 * 2.50 → +150
 * 1.67 → -149
 */
export function decimalToAmerican(decimal: number | null): number | null {
  if (decimal === null || decimal <= 1) return null;
  if (decimal >= 2) {
    // Positive American odds
    return Math.round((decimal - 1) * 100);
  } else {
    // Negative American odds
    return Math.round(-100 / (decimal - 1));
  }
}

// =============================================================================
// FETCH FUNCTION
// =============================================================================

async function fetchHitRateMatrix(options: UseHitRateMatrixOptions): Promise<HitRateMatrixResponse> {
  const res = await fetch("/api/nba/hit-rate-matrix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      market: options.market || "player_points",
      gameDate: options.gameDate,
      timeWindow: options.timeWindow || "last_10",
      positions: options.positions,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch hit rate matrix");
  }

  return res.json();
}

// =============================================================================
// HOOK
// =============================================================================

export function useHitRateMatrix(options: UseHitRateMatrixOptions = {}) {
  const { market = "player_points", gameDate, timeWindow = "last_10", positions, enabled = true } = options;

  const query = useQuery<HitRateMatrixResponse>({
    queryKey: ["hit-rate-matrix", market, gameDate, timeWindow, positions],
    queryFn: () => fetchHitRateMatrix({ market, gameDate, timeWindow, positions }),
    enabled,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });

  return {
    rows: query.data?.rows ?? [],
    market: query.data?.market ?? market,
    timeWindow: query.data?.timeWindow ?? timeWindow,
    thresholdLines: query.data?.thresholdLines ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get cell background color based on HIT RATE (heat map)
 * This is the ONLY thing that drives cell background color.
 * Saturated enough for white text to be readable.
 */
export function getHitRateBackground(hitRate: number | null): string {
  if (hitRate === null) return "bg-neutral-400/40 dark:bg-neutral-700/50";
  
  // 80-100% → strong green
  if (hitRate >= 80) return "bg-emerald-600 dark:bg-emerald-700";
  // 70-79% → good green
  if (hitRate >= 70) return "bg-emerald-500/85 dark:bg-emerald-600/85";
  // 60-69% → muted green
  if (hitRate >= 60) return "bg-emerald-500/65 dark:bg-emerald-600/65";
  // 50-59% → neutral
  if (hitRate >= 50) return "bg-neutral-500/55 dark:bg-neutral-600/55";
  // 40-49% → muted red
  if (hitRate >= 40) return "bg-red-500/55 dark:bg-red-600/55";
  // <40% → red
  return "bg-red-600/60 dark:bg-red-700/60";
}

/**
 * Get text color for hit rate - PRIMARY number, high contrast
 * This is the anchor number that users scan first.
 */
export function getHitRateTextColor(hitRate: number | null): string {
  if (hitRate === null) return "text-neutral-400 dark:text-neutral-500";
  
  // High contrast for readability
  if (hitRate >= 70) return "text-emerald-800 dark:text-emerald-300";
  if (hitRate >= 50) return "text-neutral-700 dark:text-neutral-300";
  return "text-red-700 dark:text-red-400";
}

/**
 * Get color class for DvP rank badge
 */
export function getDvpColor(quality: "favorable" | "neutral" | "unfavorable" | null): string {
  switch (quality) {
    case "favorable": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "unfavorable": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "neutral": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    default: return "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400";
  }
}

/**
 * Format odds with +/- sign
 */
export function formatOdds(odds: number | null): string {
  if (odds === null) return "—";
  return odds > 0 ? `+${odds}` : String(odds);
}

/**
 * Get text color for edge percentage - used in badge only
 * Edge = best price vs market average (odds-based)
 * Thresholds: 5%+ strong, 2-5% moderate, 0-2% slight, negative muted
 */
export function getEdgeTextColor(edgePct: number | null): string {
  if (edgePct === null) return "text-neutral-400 dark:text-neutral-500";
  if (edgePct >= 5) return "text-emerald-600 dark:text-emerald-400"; // Strong value
  if (edgePct >= 2) return "text-emerald-500/70 dark:text-emerald-400/70"; // Moderate value
  if (edgePct > 0) return "text-neutral-500 dark:text-neutral-400"; // Slight edge
  return "text-neutral-400 dark:text-neutral-500"; // No edge or negative
}

/**
 * Format edge percentage - concise
 */
export function formatEdge(edgePct: number | null): string {
  if (edgePct === null) return "—";
  const sign = edgePct >= 0 ? "+" : "";
  return `${sign}${edgePct}%`;
}

/**
 * Check if a cell is a "dead zone" (no odds or significantly negative edge)
 */
export function isDeadZone(bookCount: number, edgePct: number | null): boolean {
  // No books = no odds data
  if (bookCount === 0) return true;
  // Only 1 book = can't calculate edge (no comparison)
  if (bookCount < 2 && edgePct === null) return true;
  return false;
}

/**
 * Get best line data from a row's thresholds
 */
export function getBestLineFromRow(thresholds: ThresholdData[]): ThresholdData | null {
  let best: ThresholdData | null = null;
  let bestEdge = -Infinity;
  
  for (const t of thresholds) {
    if (t.edgePct !== null && t.edgePct > 0 && t.edgePct > bestEdge && t.bestOdds !== null) {
      bestEdge = t.edgePct;
      best = t;
    }
  }
  return best;
}
