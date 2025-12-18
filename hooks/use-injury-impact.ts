import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Injury Impact Cheat Sheet Hooks
 * 
 * This module provides hooks for fetching and managing injury impact data.
 * 
 * Flow:
 * 1. useInjuryImpactCheatsheet() - Initial page load, returns full table data
 * 2. useAvailableLines() - When user clicks market dropdown on a row
 * 3. useAvailableTeammates() - When user clicks teammate dropdown
 * 4. useTeammateOutStats() - When user changes market OR teammates (mutation)
 */

// ============================================================
// Types
// ============================================================

export interface InjuryImpactRow {
  // Player info
  playerId: number;
  playerName: string;
  teamAbbr: string;
  teamId: number;
  playerPosition: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  
  // Game info
  gameDate: string;
  gameId: number;
  opponentAbbr: string;
  opponentId: number;
  homeAway: string;
  
  // Bet info
  market: string;
  line: number;
  overOdds: string | null;
  overOddsDecimal: number | null;
  oddsSelectionId: string | null;
  eventId: string | null;
  
  // Default injured teammate
  defaultTeammateId: number;
  defaultTeammateName: string;
  defaultTeammatePosition: string;
  defaultTeammateInjuryStatus: string;
  defaultTeammateInjuryNotes: string | null;
  defaultTeammateAvgMinutes: number;
  defaultTeammateAvgPts: number;
  defaultTeammateAvgReb: number;
  defaultTeammateAvgAst: number;
  
  // Stats when teammate is out
  gamesWithTeammateOut: number;
  hits: number;
  hitRate: number | null;
  avgStatWhenOut: number;
  avgStatOverall: number;
  statBoost: number;
  statBoostPct: number | null;
  avgMinutesWhenOut: number;
  avgMinutesOverall: number;
  minutesBoost: number;
  
  // Additional stat boosts
  usageWhenOut: number;
  usageOverall: number;
  usageBoost: number;
  fgaWhenOut: number;
  fgaOverall: number;
  fgaBoost: number;
  fg3aWhenOut: number;
  fg3aOverall: number;
  fg3aBoost: number;
  
  // Rebound stats
  orebWhenOut: number;
  orebOverall: number;
  orebBoost: number;
  drebWhenOut: number;
  drebOverall: number;
  drebBoost: number;
  rebWhenOut: number;
  rebOverall: number;
  rebBoost: number;
  
  // Playmaking stats
  passesWhenOut: number;
  passesOverall: number;
  passesBoost: number;
  potentialAstWhenOut: number;
  potentialAstOverall: number;
  potentialAstBoost: number;
  
  // Additional info
  otherInjuredTeammatesCount: number;
  opportunityGrade: string;
  confidenceScore: number;
}

export interface AvailableLine {
  market: string;
  marketDisplay: string;
  line: number;
  overOdds: string | null;
  overOddsDecimal: number | null;
  underOdds: string | null;
  underOddsDecimal: number | null;
}

export interface AvailableTeammate {
  teammateId: number;
  teammateName: string;
  teammatePosition: string;
  currentInjuryStatus: string | null;
  currentInjuryNotes: string | null;
  gamesOut: number;
  avgMinutes: number;
  avgPts: number;
  avgReb: number;
  avgAst: number;
  isCurrentlyInjured: boolean;
}

export interface TeammateOutStats {
  games: number;
  hits: number;
  hitRate: number | null;
  avgStat: number;
  avgStatOverall: number;
  statBoost: number;
  statBoostPct: number | null;
  avgMinutes: number;
  avgMinutesOverall: number;
  minutesBoost: number;
  // Additional stats
  usageWhenOut: number;
  usageOverall: number;
  usageBoost: number;
  fgaWhenOut: number;
  fgaOverall: number;
  fgaBoost: number;
  fg3aWhenOut: number;
  fg3aOverall: number;
  fg3aBoost: number;
  // Rebound stats
  orebWhenOut: number;
  orebOverall: number;
  orebBoost: number;
  drebWhenOut: number;
  drebOverall: number;
  drebBoost: number;
  rebWhenOut: number;
  rebOverall: number;
  rebBoost: number;
  // Playmaking stats
  passesWhenOut: number;
  passesOverall: number;
  passesBoost: number;
  potentialAstWhenOut: number;
  potentialAstOverall: number;
  potentialAstBoost: number;
  // Game arrays
  gameDates: string[];
  gameStats: number[];
}

// ============================================================
// Fetchers
// ============================================================

async function fetchInjuryImpactCheatsheet(options: {
  dates?: string[];
  markets?: string[];
  minGames?: number;
  minTeammateMinutes?: number;
}): Promise<{ rows: InjuryImpactRow[]; markets: string[] }> {
  const res = await fetch("/api/nba/injury-impact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch injury impact data");
  }

  return res.json();
}

async function fetchAvailableLines(
  playerId: number,
  gameDate?: string
): Promise<{ lines: AvailableLine[] }> {
  const res = await fetch("/api/nba/injury-impact/available-lines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, gameDate }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch available lines");
  }

  return res.json();
}

async function fetchAvailableTeammates(
  playerId: number,
  market: string
): Promise<{ teammates: AvailableTeammate[] }> {
  const res = await fetch("/api/nba/injury-impact/available-teammates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, market }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch available teammates");
  }

  return res.json();
}

async function fetchTeammateOutStats(params: {
  playerId: number;
  teammateIds: number[];
  market: string;
  line: number;
}): Promise<{ stats: TeammateOutStats }> {
  const res = await fetch("/api/nba/injury-impact/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to calculate stats");
  }

  return res.json();
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook 1: Main cheatsheet data
 * Call on page load and when market tab changes
 */
export function useInjuryImpactCheatsheet(options: {
  dates?: string[];
  markets?: string[];
  minGames?: number;
  minTeammateMinutes?: number;
  enabled?: boolean;
}) {
  const { enabled = true, ...fetchOptions } = options;

  const query = useQuery({
    queryKey: ["injury-impact-cheatsheet", fetchOptions],
    queryFn: () => fetchInjuryImpactCheatsheet(fetchOptions),
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
    enabled,
  });

  return {
    rows: query.data?.rows ?? [],
    markets: query.data?.markets ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Hook 1b: Fetch live odds for injury impact rows
 * Uses the same odds API as the hit rate cheat sheet
 */
export function useInjuryImpactOdds(rows: InjuryImpactRow[] | undefined) {
  const selections = (rows || [])
    .filter((row) => row.oddsSelectionId)
    .map((row) => ({
      stableKey: row.oddsSelectionId!,
      line: row.line,
    }));

  return useQuery({
    queryKey: ["injury-impact-odds", selections.map((s) => s.stableKey).sort()],
    queryFn: async () => {
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
    },
    enabled: selections.length > 0,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for live odds
  });
}

/**
 * Hook 2: Available lines for a player
 * Call when user clicks market dropdown on a row
 */
export function useAvailableLines(
  playerId: number | null,
  gameDate?: string,
  enabled = true
) {
  const query = useQuery({
    queryKey: ["injury-impact-available-lines", playerId, gameDate],
    queryFn: () => fetchAvailableLines(playerId!, gameDate),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: enabled && playerId !== null,
  });

  return {
    lines: query.data?.lines ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

/**
 * Hook 3: Available teammates for a player
 * Call when user clicks teammate dropdown
 */
export function useAvailableTeammates(
  playerId: number | null,
  market: string | null,
  enabled = true
) {
  const query = useQuery({
    queryKey: ["injury-impact-available-teammates", playerId, market],
    queryFn: () => fetchAvailableTeammates(playerId!, market!),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: enabled && playerId !== null && market !== null,
  });

  return {
    teammates: query.data?.teammates ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

/**
 * Hook 4: Calculate stats for selected teammates
 * Use as a mutation when user changes market or teammates
 */
export function useTeammateOutStatsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchTeammateOutStats,
    onSuccess: (data, variables) => {
      // Optionally cache the result
      queryClient.setQueryData(
        ["injury-impact-stats", variables.playerId, variables.teammateIds, variables.market, variables.line],
        data
      );
    },
  });
}

/**
 * Hook 4 Alternative: Query-based stats fetching
 * Use when you want automatic refetching on param changes
 */
export function useTeammateOutStats(params: {
  playerId: number | null;
  teammateIds: number[];
  market: string | null;
  line: number | null;
  enabled?: boolean;
}) {
  const { playerId, teammateIds, market, line, enabled = true } = params;

  const query = useQuery({
    queryKey: ["injury-impact-stats", playerId, teammateIds, market, line],
    queryFn: () => fetchTeammateOutStats({
      playerId: playerId!,
      teammateIds,
      market: market!,
      line: line!,
    }),
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    enabled: enabled && playerId !== null && market !== null && line !== null && teammateIds.length > 0,
  });

  return {
    stats: query.data?.stats ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get color for opportunity grade
 */
export function getOpportunityGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "B":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "C":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "D":
    default:
      return "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
  }
}

/**
 * Get color for stat boost
 */
export function getStatBoostColor(boost: number): string {
  if (boost >= 3) return "text-green-400";
  if (boost >= 1) return "text-green-300";
  if (boost > 0) return "text-green-200";
  if (boost < -1) return "text-red-400";
  if (boost < 0) return "text-red-300";
  return "text-neutral-400";
}

/**
 * Get color for hit rate
 */
export function getHitRateColor(hitRate: number | null): string {
  if (hitRate === null) return "text-neutral-400";
  if (hitRate >= 0.8) return "text-green-400";
  if (hitRate >= 0.7) return "text-green-300";
  if (hitRate >= 0.6) return "text-yellow-400";
  if (hitRate >= 0.5) return "text-yellow-300";
  return "text-red-400";
}

/**
 * Format market display name
 */
export function getMarketDisplayName(market: string): string {
  const names: Record<string, string> = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes_made: "Threes",
    player_steals: "Steals",
    player_blocks: "Blocks",
    player_turnovers: "Turnovers",
    player_points_rebounds_assists: "PTS+REB+AST",
    player_points_rebounds: "PTS+REB",
    player_points_assists: "PTS+AST",
    player_rebounds_assists: "REB+AST",
    player_blocks_steals: "BLK+STL",
  };
  return names[market] || market;
}

/**
 * Format injury status for display
 */
export function formatInjuryStatus(status: string): {
  label: string;
  color: string;
} {
  const lower = status.toLowerCase();
  if (lower === "out") {
    return { label: "OUT", color: "bg-red-500/20 text-red-400" };
  }
  if (lower === "doubtful") {
    return { label: "DTD", color: "bg-orange-500/20 text-orange-400" };
  }
  if (lower === "questionable") {
    return { label: "GTD", color: "bg-yellow-500/20 text-yellow-400" };
  }
  return { label: status.toUpperCase(), color: "bg-neutral-500/20 text-neutral-400" };
}

// Market options for filters
export const INJURY_IMPACT_MARKETS = [
  { value: "player_points", label: "Points" },
  { value: "player_rebounds", label: "Rebounds" },
  { value: "player_assists", label: "Assists" },
  { value: "player_threes_made", label: "Threes" },
  { value: "player_points_rebounds_assists", label: "PTS+REB+AST" },
  { value: "player_points_rebounds", label: "PTS+REB" },
  { value: "player_points_assists", label: "PTS+AST" },
  { value: "player_rebounds_assists", label: "REB+AST" },
  { value: "player_steals", label: "Steals" },
  { value: "player_blocks", label: "Blocks" },
  { value: "player_blocks_steals", label: "BLK+STL" },
];

