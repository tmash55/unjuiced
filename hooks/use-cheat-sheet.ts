"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import type { CheatSheetRow } from "@/app/api/nba/cheat-sheet/route";

// Re-export the type for convenience
export type { CheatSheetRow };

// Filter options
export type TimeWindow = "last_5_pct" | "last_10_pct" | "last_20_pct" | "season_pct";

export interface CheatSheetFilters {
  timeWindow?: TimeWindow;
  minHitRate?: number;
  oddsFloor?: number;
  oddsCeiling?: number;
  markets?: string[];
  dates?: string[];
}

interface CheatSheetResponse {
  rows: CheatSheetRow[];
  count: number;
}

// Market options for filtering
export const CHEAT_SHEET_MARKETS = [
  { value: "player_points", label: "Points" },
  { value: "player_rebounds", label: "Rebounds" },
  { value: "player_assists", label: "Assists" },
  { value: "player_points_rebounds_assists", label: "Pts + Reb + Ast" },
  { value: "player_points_rebounds", label: "Pts + Reb" },
  { value: "player_points_assists", label: "Pts + Ast" },
  { value: "player_rebounds_assists", label: "Reb + Ast" },
  { value: "player_threes_made", label: "3-Pointers" },
  { value: "player_steals", label: "Steals" },
  { value: "player_blocks", label: "Blocks" },
  { value: "player_blocks_steals", label: "Blk + Stl" },
  { value: "player_turnovers", label: "Turnovers" },
] as const;

// Time window options
export const TIME_WINDOW_OPTIONS = [
  { value: "last_5_pct" as TimeWindow, label: "Last 5", shortLabel: "L5" },
  { value: "last_10_pct" as TimeWindow, label: "Last 10", shortLabel: "L10" },
  { value: "last_20_pct" as TimeWindow, label: "Last 20", shortLabel: "L20" },
  { value: "season_pct" as TimeWindow, label: "Season", shortLabel: "SZN" },
] as const;

// Hit rate filter options
export const HIT_RATE_OPTIONS = [
  { value: 0.70, label: "70%+" },
  { value: 0.75, label: "75%+" },
  { value: 0.80, label: "80%+" },
  { value: 0.85, label: "85%+" },
  { value: 0.90, label: "90%+" },
] as const;

// Confidence grade colors
export function getGradeColor(grade: CheatSheetRow["confidenceGrade"]) {
  switch (grade) {
    case "A+":
      return "text-emerald-500 bg-emerald-500/10";
    case "A":
      return "text-green-500 bg-green-500/10";
    case "B+":
      return "text-yellow-500 bg-yellow-500/10";
    case "B":
      return "text-orange-500 bg-orange-500/10";
    case "C":
      return "text-neutral-500 bg-neutral-500/10";
    default:
      return "text-neutral-500 bg-neutral-500/10";
  }
}

// Trend indicator
export function getTrendInfo(trend: CheatSheetRow["trend"]) {
  switch (trend) {
    case "hot":
      return { label: "Hot", color: "text-red-500", icon: "🔥" };
    case "improving":
      return { label: "Improving", color: "text-green-500", icon: "📈" };
    case "stable":
      return { label: "Stable", color: "text-neutral-500", icon: "➡️" };
    case "declining":
      return { label: "Declining", color: "text-orange-500", icon: "📉" };
    case "cold":
      return { label: "Cold", color: "text-blue-500", icon: "❄️" };
    default:
      return { label: "Unknown", color: "text-neutral-500", icon: "—" };
  }
}

// Matchup quality colors
export function getMatchupColor(quality: CheatSheetRow["matchupQuality"]) {
  switch (quality) {
    case "favorable":
      return "text-green-500 bg-green-500/10";
    case "neutral":
      return "text-neutral-500 bg-neutral-500/10";
    case "unfavorable":
      return "text-red-500 bg-red-500/10";
    default:
      return "text-neutral-500 bg-neutral-500/10";
  }
}

// Format hit rate as percentage
export function formatHitRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

// Format edge
export function formatEdge(edge: number | null | undefined): string {
  if (edge == null) return "—";
  const sign = edge >= 0 ? "+" : "";
  return `${sign}${edge.toFixed(1)}`;
}

// Format odds
export function formatOdds(odds: string | null | undefined): string {
  if (!odds) return "—";
  return odds;
}

// Market display name
export function getMarketLabel(market: string): string {
  const found = CHEAT_SHEET_MARKETS.find((m) => m.value === market);
  return found?.label || market;
}

// Fetch cheat sheet data
async function fetchCheatSheet(filters: CheatSheetFilters): Promise<CheatSheetResponse> {
  const response = await fetch("/api/nba/cheat-sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(filters),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch cheat sheet data");
  }

  return response.json();
}

// Main hook
export function useCheatSheet(filters: CheatSheetFilters = {}) {
  return useQuery({
    queryKey: ["cheat-sheet", filters],
    queryFn: () => fetchCheatSheet(filters),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute for fresh odds
  });
}

// Hook to fetch odds for cheat sheet rows
interface OddsSelection {
  stableKey: string;
  line?: number;
}

export interface OddsData {
  stableKey: string;
  primaryLine: number | null;
  currentLine: number | null;
  bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
  bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
  allLines: Array<{
    line: number;
    bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
    bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
    books: Record<string, { over?: { price: number; url: string | null; mobileUrl: string | null }; under?: { price: number; url: string | null; mobileUrl: string | null } }>;
  }>;
  live: boolean;
  timestamp: number | null;
}

async function fetchOdds(selections: OddsSelection[]): Promise<Record<string, OddsData>> {
  if (!selections.length) return {};

  const response = await fetch("/api/nba/hit-rates/odds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selections }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch odds");
  }

  const data = await response.json();
  return data.odds || {};
}

// Hook to fetch live odds for cheat sheet rows
export function useCheatSheetOdds(rows: CheatSheetRow[] | undefined) {
  const selections: OddsSelection[] = (rows || [])
    .filter((row) => row.oddsSelectionId)
    .map((row) => ({
      stableKey: row.oddsSelectionId!,
      line: row.line,
    }));

  return useQuery({
    queryKey: ["cheat-sheet-odds", selections.map((s) => s.stableKey).sort()],
    queryFn: () => fetchOdds(selections),
    enabled: selections.length > 0,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for live odds
  });
}

