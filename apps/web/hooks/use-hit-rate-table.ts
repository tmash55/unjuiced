"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HitRateProfile, HitRateResponse, RawHitRateProfile } from "@/lib/hit-rates-schema";

// Valid sort fields
export type HitRateSortField = "line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank";

export interface UseHitRateTableOptions {
  date?: string;
  market?: string;
  minHitRate?: number;
  limit?: number;
  offset?: number;
  search?: string; // Player name search (server-side)
  playerId?: number; // Filter by specific player ID (nba_player_id)
  sort?: HitRateSortField; // Sort field for server-side sorting
  sortDir?: "asc" | "desc"; // Sort direction
  enabled?: boolean;
  useV2?: boolean; // Use optimized v2 API with Redis caching
}

interface HitRateTableResult {
  rows: HitRateProfile[];
  count: number;
  meta: HitRateResponse["meta"] & { cacheHit?: boolean; responseTime?: number };
}

// Timeout wrapper for fetch - prevents hanging on slow/failed requests
const fetchWithTimeout = async (url: string, timeoutMs: number = 12000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
};

async function fetchHitRateTable(params: UseHitRateTableOptions = {}): Promise<HitRateTableResult> {
  const searchParams = new URLSearchParams();
  if (params.date) searchParams.set("date", params.date);
  if (params.market) searchParams.set("market", params.market);
  if (typeof params.minHitRate === "number") searchParams.set("minHitRate", String(params.minHitRate));
  if (typeof params.limit === "number") searchParams.set("limit", String(params.limit));
  if (typeof params.offset === "number") searchParams.set("offset", String(params.offset));
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (typeof params.playerId === "number") searchParams.set("playerId", String(params.playerId));
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);

  // Use v2 API by default for better performance (Redis cached)
  const apiPath = params.useV2 !== false ? "/api/nba/hit-rates/v2" : "/api/nba/hit-rates";
  const url = `${apiPath}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  
  // Reduced timeout - v2 API should be fast with caching
  // Falls back gracefully on timeout
  const res = await fetchWithTimeout(url, 12000);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load hit rates");
  }

  const payload: HitRateResponse = await res.json();
  return {
    rows: (payload.data || []).map(mapHitRateProfile),
    count: payload.count,
    meta: payload.meta,
  };
}

function mapHitRateProfile(profile: RawHitRateProfile): HitRateProfile {
  const player = profile.nba_players_hr;
  const game = profile.nba_games_hr;
  const team = profile.nba_teams;
  const matchup = profile.matchup;
  return {
    id: profile.id,
    playerId: player?.nba_player_id ?? profile.player_id,
    playerName: player?.name || profile.team_name || "Unknown",
    teamId: profile.team_id ?? null,
    teamAbbr: profile.team_abbr ?? null,
    teamName: profile.team_name ?? null,
    opponentTeamId: profile.opponent_team_id ?? null,
    opponentTeamAbbr: profile.opponent_team_abbr ?? null,
    opponentTeamName: profile.opponent_team_name ?? null,
    market: profile.market,
    line: profile.line,
    gameId: profile.game_id ?? null,
    eventId: profile.event_id ?? null,
    hitStreak: profile.hit_streak,
    last5Pct: profile.last_5_pct,
    last10Pct: profile.last_10_pct,
    last20Pct: profile.last_20_pct,
    seasonPct: profile.season_pct,
    h2hPct: profile.h2h_pct,
    h2hAvg: profile.h2h_avg,
    h2hGames: profile.h2h_games,
    last5Avg: profile.last_5_avg,
    last10Avg: profile.last_10_avg,
    last20Avg: profile.last_20_avg,
    seasonAvg: profile.season_avg,
    spread: profile.spread,
    total: profile.total,
    injuryStatus: profile.injury_status,
    injuryNotes: profile.injury_notes,
    // Prefer depth_chart_pos (PG, SG, SF, PF, C) over generic position (G, F, C)
    position: player?.depth_chart_pos ?? player?.position ?? profile.position,
    jerseyNumber: player?.jersey_number ?? profile.jersey_number,
    gameDate: game?.game_date ?? profile.game_date,
    startTime: game?.start_time ?? profile.start_time ?? profile.commence_time ?? null,
    gameStatus: game?.game_status ?? null,
    // gameLogs removed - fetched separately via usePlayerBoxScores for drilldown
    homeTeamName: game?.home_team_name ?? null,
    awayTeamName: game?.away_team_name ?? null,
    primaryColor: team?.primary_color ?? null,
    secondaryColor: team?.secondary_color ?? null,
    accentColor: team?.accent_color ?? null,
    isPrimetime: profile.is_primetime ?? null,
    nationalBroadcast: profile.national_broadcast ?? null,
    homeAway: profile.home_away ?? null,
    oddsSelectionId: profile.odds_selection_id ?? null,
    selKey: profile.sel_key ?? null,
    // Matchup data
    matchupRank: matchup?.matchup_rank ?? null,
    matchupRankLabel: matchup?.rank_label ?? null,
    matchupAvgAllowed: matchup?.avg_allowed ?? null,
    matchupQuality: matchup?.matchup_quality ?? null,
    // Best odds from Redis
    bestOdds: profile.best_odds ?? null,
    books: profile.books ?? 0,
  };
}

// Get today's date in YYYY-MM-DD format for comparison
function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Check if a game date is today
function isToday(gameDate: string | null): boolean {
  if (!gameDate) return false;
  const today = getTodayDateString();
  return gameDate.startsWith(today);
}

// Client-side sort function for instant UI response
// Always prioritizes today's games first, then sorts by the specified field
function sortRows(rows: HitRateProfile[], sort: HitRateSortField | null, sortDir: "asc" | "desc"): HitRateProfile[] {
  if (rows.length === 0) return rows;
  
  const fieldMap: Record<HitRateSortField, keyof HitRateProfile> = {
    line: "line",
    l5Avg: "last5Avg",
    l10Avg: "last10Avg",
    seasonAvg: "seasonAvg",
    streak: "hitStreak",
    l5Pct: "last5Pct",
    l10Pct: "last10Pct",
    l20Pct: "last20Pct",
    seasonPct: "seasonPct",
    h2hPct: "h2hPct",
    matchupRank: "matchupRank",
  };
  
  // Default to L5 percentage descending if no sort specified
  const effectiveSort = sort ?? "l5Pct";
  const effectiveDir = sortDir ?? "desc";
  const multiplier = effectiveDir === "asc" ? 1 : -1;
  const field = fieldMap[effectiveSort];
  
  return [...rows].sort((a, b) => {
    // FIRST: Prioritize today's games over tomorrow's
    const aIsToday = isToday(a.gameDate);
    const bIsToday = isToday(b.gameDate);
    
    if (aIsToday && !bIsToday) return -1; // a (today) comes first
    if (!aIsToday && bIsToday) return 1;  // b (today) comes first
    
    // SECOND: Sort by the specified field within the same day group
    const aVal = a[field] as number | null;
    const bVal = b[field] as number | null;
    
    // ALWAYS push nulls to the END of the list
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;  // a goes after b
    if (bVal === null) return -1; // b goes after a
    
    return (aVal - bVal) * multiplier;
  });
}

export function useHitRateTable(options: UseHitRateTableOptions = {}) {
  const { date, market, minHitRate, limit, offset, search, playerId, sort, sortDir, enabled = true } = options;

  // NOTE: Sort is NOT in the query key - sorting is done client-side for instant response
  // The API returns data pre-sorted by has_odds + L10, client re-sorts as needed
  const queryResult = useQuery<HitRateTableResult>({
    queryKey: ["hit-rate-table", { date, market, minHitRate, limit, offset, search, playerId }],
    queryFn: () => fetchHitRateTable({ date, market, minHitRate, limit, offset, search, playerId }),
    enabled,
    staleTime: 60_000, // 60 seconds - reduce unnecessary refetches
    gcTime: 5 * 60_000, // 5 minutes - keep data longer
    refetchOnWindowFocus: false, // Prevent reload when switching tabs
    refetchOnReconnect: false, // Don't refetch on network reconnect
  });

  const rawRows = queryResult.data?.rows ?? [];
  const count = queryResult.data?.count ?? 0;
  const meta = queryResult.data?.meta;
  const availableDates = meta?.availableDates ?? [];

  // Client-side sorting - instant response, no refetch
  // Always applies sorting: prioritizes today's games, then sorts by field (default: L5 desc)
  const rows = useMemo(() => {
    return sortRows(rawRows, sort ?? null, sortDir ?? "desc");
  }, [rawRows, sort, sortDir]);

  return useMemo(
    () => ({
      rows,
      count,
      meta,
      availableDates,
      isLoading: queryResult.isLoading,
      isFetching: queryResult.isFetching,
      error: queryResult.error as Error | null,
      refetch: queryResult.refetch,
    }),
    [rows, count, meta, availableDates, queryResult.isLoading, queryResult.isFetching, queryResult.error, queryResult.refetch]
  );
}
