"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  InjuryImpactRow as InjuryImpactRowType,
  AvailableLine,
  AvailableTeammate,
  TeammateOutStats,
  useAvailableLines,
  useAvailableTeammates,
  useTeammateOutStatsMutation,
  getOpportunityGradeColor,
  getStatBoostColor,
  getHitRateColor,
  getMarketDisplayName,
  formatInjuryStatus,
} from "@/hooks/use-injury-impact";
import { getGradeColor, OddsData } from "@/hooks/use-cheat-sheet";
import { OddsDropdownCell } from "./odds-dropdown-cell";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { 
  ChevronDown, 
  ChevronUp,
  AlertTriangle, 
  Users, 
  Loader2, 
  Check, 
  X,
  Plus,
  UserMinus,
  Lock,
  BarChart3,
  Pin,
  HeartPulse,
} from "lucide-react";
import Chart from "@/icons/chart";
import { Heart } from "@/components/icons/heart";
import { HeartFill } from "@/components/icons/heart-fill";
import { CheatSheetFilterState } from "./cheat-sheet-filters";
import { InjuryImpactStatsModal } from "./injury-impact-stats-modal";
import { useFavorites, createFavoriteKey, type AddFavoriteParams } from "@/hooks/use-favorites";
import { usePrefetchPlayer } from "@/hooks/use-prefetch-player";

// ============================================================
// Row State Management
// ============================================================

interface RowState {
  // Current selections (can be modified by user)
  selectedMarket: string;
  selectedLine: number;
  selectedTeammateIds: number[];
  
  // Current stats (recalculated when selections change)
  currentStats: {
    games: number;
    hits: number;
    hitRate: number | null;
    avgStatWhenOut: number;
    avgStatOverall: number;
    statBoost: number;
    statBoostPct: number | null;
    // Minutes
    avgMinutesWhenOut: number;
    avgMinutesOverall: number;
    minutesBoost: number;
    // Usage & Shooting
    usageWhenOut: number;
    usageOverall: number;
    usageBoost: number;
    fgaWhenOut: number;
    fgaOverall: number;
    fgaBoost: number;
    fg3aWhenOut: number;
    fg3aOverall: number;
    fg3aBoost: number;
    // Rebounds
    orebWhenOut: number;
    orebOverall: number;
    orebBoost: number;
    drebWhenOut: number;
    drebOverall: number;
    drebBoost: number;
    rebWhenOut: number;
    rebOverall: number;
    rebBoost: number;
    // Playmaking
    passesWhenOut: number;
    passesOverall: number;
    passesBoost: number;
    potentialAstWhenOut: number;
    potentialAstOverall: number;
    potentialAstBoost: number;
  };
  
  // Has user modified this row from defaults?
  isModified: boolean;
}

function initRowState(row: InjuryImpactRowType): RowState {
  return {
    selectedMarket: row.market,
    selectedLine: row.line,
    selectedTeammateIds: [row.defaultTeammateId],
    currentStats: {
      games: row.gamesWithTeammateOut,
      hits: row.hits,
      hitRate: row.hitRate,
      avgStatWhenOut: row.avgStatWhenOut,
      avgStatOverall: row.avgStatOverall,
      statBoost: row.statBoost,
      statBoostPct: row.statBoostPct,
      // Minutes
      avgMinutesWhenOut: row.avgMinutesWhenOut,
      avgMinutesOverall: row.avgMinutesOverall,
      minutesBoost: row.minutesBoost,
      // Usage & Shooting
      usageWhenOut: row.usageWhenOut,
      usageOverall: row.usageOverall,
      usageBoost: row.usageBoost,
      fgaWhenOut: row.fgaWhenOut,
      fgaOverall: row.fgaOverall,
      fgaBoost: row.fgaBoost,
      fg3aWhenOut: row.fg3aWhenOut,
      fg3aOverall: row.fg3aOverall,
      fg3aBoost: row.fg3aBoost,
      // Rebounds
      orebWhenOut: row.orebWhenOut,
      orebOverall: row.orebOverall,
      orebBoost: row.orebBoost,
      drebWhenOut: row.drebWhenOut,
      drebOverall: row.drebOverall,
      drebBoost: row.drebBoost,
      rebWhenOut: row.rebWhenOut,
      rebOverall: row.rebOverall,
      rebBoost: row.rebBoost,
      // Playmaking
      passesWhenOut: row.passesWhenOut,
      passesOverall: row.passesOverall,
      passesBoost: row.passesBoost,
      potentialAstWhenOut: row.potentialAstWhenOut,
      potentialAstOverall: row.potentialAstOverall,
      potentialAstBoost: row.potentialAstBoost,
    },
    isModified: false,
  };
}

// ============================================================
// Main Table Component
// ============================================================

interface InjuryImpactTableProps {
  rows: InjuryImpactRowType[];
  isLoading: boolean;
  oddsData?: Record<string, OddsData>;
  isLoadingOdds?: boolean;
  filters: CheatSheetFilterState;
  onFiltersChange: (filters: CheatSheetFilterState) => void;
  onGlossaryOpen: () => void;
  /** Click handler for player name to open hit rate modal */
  onPlayerClick?: (row: InjuryImpactRowType) => void;
  sport?: string;
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (value: boolean) => void;
  isGated?: boolean; // If true, hide interactive features
}

export function InjuryImpactTable({
  rows,
  isLoading,
  oddsData,
  isLoadingOdds,
  filters,
  onFiltersChange,
  onGlossaryOpen,
  onPlayerClick,
  sport = "nba",
  hideNoOdds = true,
  onHideNoOddsChange,
  isGated = false,
}: InjuryImpactTableProps) {
  // Prefetch player data on hover for faster modal opens
  const prefetchPlayer = usePrefetchPlayer();
  
  // Row states for each row (keyed by unique row identifier)
  const [rowStates, setRowStates] = useState<Map<string, RowState>>(new Map());
  
  // Track rows with open dropdowns - these should not be re-sorted
  const [pinnedRows, setPinnedRows] = useState<Set<string>>(new Set());
  
  // Callback for rows to register/unregister as pinned
  const setPinned = useCallback((key: string, pinned: boolean) => {
    setPinnedRows(prev => {
      const next = new Set(prev);
      if (pinned) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);
  
  // Initialize row states when rows change
  useEffect(() => {
    const newStates = new Map<string, RowState>();
    rows.forEach(row => {
      const key = getRowKey(row);
      // Preserve existing state if row was modified, otherwise reinitialize
      const existing = rowStates.get(key);
      if (existing?.isModified) {
        newStates.set(key, existing);
      } else {
        newStates.set(key, initRowState(row));
      }
    });
    setRowStates(newStates);
  }, [rows]);
  
  // Update a single row's state
  const updateRowState = useCallback((key: string, update: Partial<RowState>) => {
    setRowStates(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(key);
      if (current) {
        newMap.set(key, { ...current, ...update, isModified: true });
      }
      return newMap;
    });
  }, []);

  // Sorting - default to hit rate descending (highest first)
  const [sortField, setSortField] = useState<string>("hitRate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Helper to check if a row has live odds in Redis
  const hasLiveOdds = (row: InjuryImpactRowType): boolean => {
    if (!oddsData || !row.oddsSelectionId) return false;
    const odds = oddsData[row.oddsSelectionId];
    // Check if odds object exists AND has actual betting odds (bestOver or bestUnder)
    return odds !== null && 
           odds !== undefined && 
           (odds.bestOver !== null || odds.bestUnder !== null);
  };

  // Count rows without odds for the toggle label
  const noOddsCount = useMemo(() => {
    if (!oddsData) return 0;
    return rows.filter(row => !hasLiveOdds(row)).length;
  }, [rows, oddsData]);

  // Sort rows - preserve positions of pinned rows (open dropdowns) and modified rows (user customized)
  const sortedRows = useMemo(() => {
    // First filter out rows without odds if hideNoOdds is true
    let filteredRows = rows;
    if (hideNoOdds && oddsData) {
      filteredRows = rows.filter(row => hasLiveOdds(row));
    }

    // Separate rows into categories:
    // 1. Pinned (actively editing - open dropdowns/modals)
    // 2. Modified (user has customized teammates or market)
    // 3. Normal (default state)
    const pinnedRowsList: InjuryImpactRowType[] = [];
    const modifiedRowsList: InjuryImpactRowType[] = [];
    const normalRows: InjuryImpactRowType[] = [];

    filteredRows.forEach(row => {
      const key = getRowKey(row);
      const isPinned = pinnedRows.has(key);
      const isModified = rowStates.get(key)?.isModified ?? false;

      if (isPinned) {
        pinnedRowsList.push(row);
      } else if (isModified) {
        modifiedRowsList.push(row);
      } else {
        normalRows.push(row);
      }
    });

    // Sort function for both modified and normal rows
    const sortFn = (a: InjuryImpactRowType, b: InjuryImpactRowType) => {
      // Push rows without live odds to the bottom (for when hideNoOdds is false)
      if (!hideNoOdds) {
        const aHasOdds = hasLiveOdds(a);
        const bHasOdds = hasLiveOdds(b);
        if (aHasOdds && !bHasOdds) return -1;
        if (!aHasOdds && bHasOdds) return 1;
      }
      let comparison = 0;
      const aState = rowStates.get(getRowKey(a));
      const bState = rowStates.get(getRowKey(b));

      switch (sortField) {
        case "opportunityGrade":
          const gradeOrder = { A: 1, B: 2, C: 3, D: 4 };
          comparison = (gradeOrder[a.opportunityGrade as keyof typeof gradeOrder] || 5) -
                       (gradeOrder[b.opportunityGrade as keyof typeof gradeOrder] || 5);
          break;
        case "hitRate":
          const aHit = aState?.currentStats.hitRate ?? a.hitRate ?? 0;
          const bHit = bState?.currentStats.hitRate ?? b.hitRate ?? 0;
          comparison = bHit - aHit;
          break;
        case "statBoost":
          const aBoost = aState?.currentStats.statBoost ?? a.statBoost ?? 0;
          const bBoost = bState?.currentStats.statBoost ?? b.statBoost ?? 0;
          comparison = bBoost - aBoost;
          break;
        case "gamesWithTeammateOut":
          const aGames = aState?.currentStats.games ?? a.gamesWithTeammateOut ?? 0;
          const bGames = bState?.currentStats.games ?? b.gamesWithTeammateOut ?? 0;
          comparison = bGames - aGames;
          break;
        case "playerName":
          comparison = a.playerName.localeCompare(b.playerName);
          break;
        case "teammateName":
          comparison = a.defaultTeammateName.localeCompare(b.defaultTeammateName);
          break;
        case "confidenceScore":
          comparison = (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
          break;
        case "odds":
          // Sort by best over American odds from live data (higher is better: +200 > +100 > -100 > -200)
          const aOdds = oddsData?.[a.oddsSelectionId ?? ""];
          const bOdds = oddsData?.[b.oddsSelectionId ?? ""];
          comparison = (bOdds?.bestOver?.price ?? -9999) - (aOdds?.bestOver?.price ?? -9999);
          break;
        default:
          break;
      }

      return sortDir === "desc" ? comparison : -comparison;
    };

    // Sort modified rows among themselves
    modifiedRowsList.sort(sortFn);
    // Sort normal rows
    normalRows.sort(sortFn);

    // Final order: Pinned (editing) > Modified (customized) > Normal
    return [...pinnedRowsList, ...modifiedRowsList, ...normalRows];
  }, [rows, rowStates, sortField, sortDir, oddsData, hideNoOdds, pinnedRows]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      // Default to descending for numeric fields (highest first), ascending for text fields
      const numericFields = ["hitRate", "statBoost", "gamesWithTeammateOut", "confidenceScore", "opportunityGrade", "odds"];
      setSortDir(numericFields.includes(field) ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (field !== sortField) {
      return <ChevronDown className="w-3 h-3 text-neutral-400" />;
    }
    return sortDir === "desc" 
      ? <ChevronDown className="w-3 h-3 text-brand" />
      : <ChevronUp className="w-3 h-3 text-brand" />;
  };
  
  const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
    >
      {children}
      <SortIcon field={field} />
    </button>
  );

  // Early return for loading state - premium style
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-center py-20 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
          <div className="text-center">
            <div className="relative inline-flex">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-red-500/30 border-t-red-500" />
              <HeartPulse className="absolute inset-0 m-auto h-5 w-5 text-red-500/60" />
            </div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-4">Loading injury impacts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
      {/* Scrollable Table Container */}
      <div className="overflow-auto max-h-[calc(100vh-200px)] min-h-[500px]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm">
              <th className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[160px] bg-neutral-50/95 dark:bg-neutral-800/95">
                Player
              </th>
              <th className="h-11 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[150px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <SortButton field="teammateName">Teammate Out</SortButton>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[95px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <div className="w-full flex items-center justify-center">Prop</div>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[70px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <SortButton field="hitRate">Hit %</SortButton>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[100px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <Tooltip content="Season Avg → Avg When Out (Boost)">
                  <div className="w-full flex items-center justify-center cursor-help">Avg / Boost</div>
                </Tooltip>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[50px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <SortButton field="gamesWithTeammateOut">Gms</SortButton>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[85px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <Tooltip content="Key opportunity stat when teammate is out">
                  <div className="w-full flex items-center justify-center cursor-help">Key Stat</div>
                </Tooltip>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[95px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <Tooltip content="Minutes and Usage when teammate is out vs season average">
                  <div className="w-full flex items-center justify-center cursor-help">Min / Usg</div>
                </Tooltip>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[80px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <SortButton field="confidenceScore">Grade</SortButton>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[75px] bg-neutral-50/95 dark:bg-neutral-800/95">
                <SortButton field="odds">Odds</SortButton>
              </th>
              <th className="h-11 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 w-12 bg-neutral-50/95 dark:bg-neutral-800/95">
                Action
              </th>
            </tr>
          </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={11} className="py-20 text-center bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
                <div className="max-w-sm mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-950/30 flex items-center justify-center mb-5 shadow-sm border border-red-200/50 dark:border-red-700/30 mx-auto">
                    <HeartPulse className="h-8 w-8 text-red-400 dark:text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    No injury impact opportunities
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Try adjusting your filters or check back when there are more injuries reported
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            sortedRows.map((row, idx) => {
              const key = getRowKey(row);
              const rowState = rowStates.get(key) || initRowState(row);
              const rowBg = idx % 2 === 0 
                ? 'bg-white dark:bg-neutral-900' 
                : 'bg-neutral-50/50 dark:bg-neutral-800/20';
              const liveOdds = row.oddsSelectionId && oddsData ? oddsData[row.oddsSelectionId] || null : null;
              
              const isPinned = pinnedRows.has(key) || rowState.isModified;
              
              return (
                <InjuryImpactRow
                  key={key}
                  row={row}
                  state={rowState}
                  rowBg={rowBg}
                  onStateChange={(update) => updateRowState(key, update)}
                  onPinChange={(pinned) => setPinned(key, pinned)}
                  liveOdds={liveOdds}
                  isGated={isGated}
                  isPinned={isPinned}
                  onPlayerClick={onPlayerClick}
                />
              );
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function getRowKey(row: InjuryImpactRowType): string {
  return `${row.playerId}-${row.market}-${row.gameId}`;
}

// Stats structure for key stat lookup (can be from row or currentStats)
interface SecondaryStats {
  fgaWhenOut: number;
  fgaOverall: number;
  fgaBoost: number;
  fg3aWhenOut: number;
  fg3aOverall: number;
  fg3aBoost: number;
  rebWhenOut: number;
  rebOverall: number;
  rebBoost: number;
  passesWhenOut: number;
  passesOverall: number;
  passesBoost: number;
  potentialAstWhenOut: number;
  potentialAstOverall: number;
  potentialAstBoost: number;
}

// Get the key stat label and values based on market
function getKeyStatForMarket(market: string, stats: SecondaryStats): {
  label: string;
  overall: number;
  whenOut: number;
  boost: number;
} {
  switch (market) {
    // Points markets → FGA (more shots = more points)
    case "player_points":
      return {
        label: "FGA",
        overall: stats.fgaOverall,
        whenOut: stats.fgaWhenOut,
        boost: stats.fgaBoost,
      };
    
    // Threes → 3PA
    case "player_threes_made":
      return {
        label: "3PA",
        overall: stats.fg3aOverall,
        whenOut: stats.fg3aWhenOut,
        boost: stats.fg3aBoost,
      };
    
    // Assists → Passes (more ball handling = more assist opportunities)
    case "player_assists":
      return {
        label: "PASS",
        overall: stats.passesOverall,
        whenOut: stats.passesWhenOut,
        boost: stats.passesBoost,
      };
    
    // Rebounds → Total rebounds (OREB + DREB combined effect)
    case "player_rebounds":
      return {
        label: "REB",
        overall: stats.rebOverall,
        whenOut: stats.rebWhenOut,
        boost: stats.rebBoost,
      };
    
    // Combo markets with assists → Potential Assists
    case "player_points_assists":
    case "player_rebounds_assists":
      return {
        label: "POT AST",
        overall: stats.potentialAstOverall,
        whenOut: stats.potentialAstWhenOut,
        boost: stats.potentialAstBoost,
      };
    
    // Combo markets with rebounds → Total rebounds
    case "player_points_rebounds":
      return {
        label: "REB",
        overall: stats.rebOverall,
        whenOut: stats.rebWhenOut,
        boost: stats.rebBoost,
      };
    
    // PRA → FGA (general offensive involvement)
    case "player_points_rebounds_assists":
      return {
        label: "FGA",
        overall: stats.fgaOverall,
        whenOut: stats.fgaWhenOut,
        boost: stats.fgaBoost,
      };
    
    // Default fallback to FGA
    default:
      return {
        label: "FGA",
        overall: stats.fgaOverall,
        whenOut: stats.fgaWhenOut,
        boost: stats.fgaBoost,
      };
  }
}

// Key Stat Cell Component - Shows dynamic stat based on market
function KeyStatCell({ 
  market, 
  stats, 
  isRecalculating 
}: { 
  market: string; 
  stats: SecondaryStats;
  isRecalculating?: boolean;
}) {
  const keyStat = getKeyStatForMarket(market, stats);
  
  return (
    <td className="px-2 py-2 text-center">
      <div className="relative inline-flex flex-col items-center min-h-[44px] justify-center">
        <div className={cn(
          "flex flex-col items-center transition-opacity duration-150",
          isRecalculating && "opacity-40"
        )}>
          {/* Label */}
          <span className="text-[10px] text-neutral-500 font-medium mb-0.5">
            {keyStat.label}
          </span>
          {/* Overall → When Out */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-neutral-500 dark:text-neutral-500 tabular-nums">
              {keyStat.overall.toFixed(1)}
            </span>
            <span className="text-neutral-400 dark:text-neutral-600 text-[10px]">→</span>
            <span className="text-xs text-neutral-700 dark:text-neutral-300 tabular-nums font-medium">
              {keyStat.whenOut.toFixed(1)}
            </span>
          </div>
          {/* Boost */}
          <span className={cn(
            "text-[10px] font-semibold tabular-nums",
            keyStat.boost > 0 ? "text-green-500 dark:text-green-400" : keyStat.boost < 0 ? "text-red-500 dark:text-red-400" : "text-neutral-500"
          )}>
            {keyStat.boost > 0 ? "+" : ""}{keyStat.boost.toFixed(1)}
          </span>
        </div>
        {isRecalculating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-3 h-3 animate-spin text-brand" />
          </div>
        )}
      </div>
    </td>
  );
}

// ============================================================
// Individual Row Component
// ============================================================

interface InjuryImpactRowProps {
  row: InjuryImpactRowType;
  state: RowState;
  rowBg: string;
  onStateChange: (update: Partial<RowState>) => void;
  onPinChange: (pinned: boolean) => void;
  liveOdds: OddsData | null;
  isGated?: boolean;
  isPinned?: boolean;
  /** Click handler for player name to open hit rate modal */
  onPlayerClick?: (row: InjuryImpactRowType) => void;
}

function InjuryImpactRow({
  row,
  state,
  rowBg,
  onStateChange,
  onPinChange,
  liveOdds,
  isGated = false,
  isPinned = false,
  onPlayerClick,
}: InjuryImpactRowProps) {
  // Prefetch player data on hover for faster modal opens
  const prefetchPlayer = usePrefetchPlayer();
  
  // Dropdown states
  const [showMarketDropdown, setShowMarketDropdown] = useState(false);
  const [showTeammateDropdown, setShowTeammateDropdown] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  
  // Use ref to store the callback to avoid infinite loops
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  
  // Notify parent when any dropdown or modal is open/closed
  useEffect(() => {
    const isOpen = showMarketDropdown || showTeammateDropdown || showStatsModal;
    onPinChangeRef.current(isOpen);
  }, [showMarketDropdown, showTeammateDropdown, showStatsModal]);
  
  // Refs for click outside
  const marketDropdownRef = useRef<HTMLDivElement>(null);
  const teammateDropdownRef = useRef<HTMLDivElement>(null);
  
  // Lazy-load available lines when market dropdown opens
  const { lines, isLoading: linesLoading } = useAvailableLines(
    row.playerId,
    row.gameDate,
    showMarketDropdown
  );
  
  // Lazy-load available teammates when teammate dropdown opens
  const { teammates, isLoading: teammatesLoading } = useAvailableTeammates(
    row.playerId,
    state.selectedMarket,
    showTeammateDropdown
  );
  
  // Mutation for recalculating stats
  const statsMutation = useTeammateOutStatsMutation();
  
  // Favorites
  const { isFavorited, toggleFavorite, isLoggedIn } = useFavorites();
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  
  // Build favorite params for this row
  const buildFavoriteParams = useCallback((): AddFavoriteParams => {
    // Get best price info from live odds
    const bestPrice = liveOdds?.bestOver?.price ?? null;
    const bestBook = liveOdds?.bestOver?.book ?? null;
    
    // Build books snapshot from allLines if available
    let booksSnapshot: Record<string, any> | null = null;
    if (liveOdds?.allLines?.length) {
      const matchingLine = liveOdds.allLines.find(l => l.line === state.selectedLine);
      if (matchingLine?.books && Object.keys(matchingLine.books).length > 0) {
        booksSnapshot = {};
        Object.entries(matchingLine.books).forEach(([bookKey, bookData]) => {
          if (bookData.over) {
            booksSnapshot![bookKey] = {
              price: bookData.over.price,
              u: bookData.over.url || null,
              m: bookData.over.mobileUrl || null,
              sgp: bookData.over.sgp || null, // Include SGP token
            };
          }
        });
      }
    }
    
    // If we still don't have books snapshot but we have bestOver, save that at minimum
    if (!booksSnapshot && bestBook && liveOdds?.bestOver) {
      booksSnapshot = {
        [bestBook]: {
          price: bestPrice,
          u: liveOdds.bestOver.url || null,
          m: liveOdds.bestOver.mobileUrl || null,
          sgp: liveOdds.bestOver.sgp || null, // Include SGP token
        },
      };
    }
    
    // Build odds_key for Redis lookups: odds:{sport}:{eventId}:{market}
    const eventId = row.eventId || `game_${row.gameId}`;
    const oddsKey = `odds:nba:${eventId}:${state.selectedMarket}`;
    
    return {
      type: "player",
      sport: "nba",
      event_id: eventId,
      game_date: row.gameDate,
      home_team: null,
      away_team: null,
      start_time: null,
      player_id: String(row.playerId),
      player_name: row.playerName,
      player_team: row.teamAbbr,
      player_position: row.playerPosition,
      market: state.selectedMarket,
      line: state.selectedLine,
      side: "over",
      odds_key: oddsKey,
      odds_selection_id: row.oddsSelectionId,
      books_snapshot: booksSnapshot,
      best_price_at_save: bestPrice,
      best_book_at_save: bestBook,
      source: "injury_impact",
    };
  }, [row, state.selectedMarket, state.selectedLine, liveOdds]);
  
  // Check if this row is favorited
  const isRowFavorited = useMemo(() => {
    return isFavorited({
      event_id: row.eventId || `game_${row.gameId}`,
      type: "player",
      player_id: String(row.playerId),
      market: state.selectedMarket,
      line: state.selectedLine,
      side: "over",
    });
  }, [isFavorited, row.eventId, row.gameId, row.playerId, state.selectedMarket, state.selectedLine]);
  
  // Handle favorite toggle
  const handleToggleFavorite = async () => {
    if (!isLoggedIn) return;
    setIsTogglingFavorite(true);
    try {
      await toggleFavorite(buildFavoriteParams());
    } finally {
      setIsTogglingFavorite(false);
    }
  };
  
  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(event.target as Node)) {
        setShowMarketDropdown(false);
      }
      if (teammateDropdownRef.current && !teammateDropdownRef.current.contains(event.target as Node)) {
        setShowTeammateDropdown(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Handle market selection
  const handleMarketSelect = async (line: AvailableLine) => {
    setShowMarketDropdown(false);
    setIsRecalculating(true);
    
    try {
      const result = await statsMutation.mutateAsync({
        playerId: row.playerId,
        teammateIds: state.selectedTeammateIds,
        market: line.market,
        line: line.line,
      });
      
      onStateChange({
        selectedMarket: line.market,
        selectedLine: line.line,
        currentStats: {
          games: result.stats.games,
          hits: result.stats.hits,
          hitRate: result.stats.hitRate,
          avgStatWhenOut: result.stats.avgStat,
          avgStatOverall: result.stats.avgStatOverall,
          statBoost: result.stats.statBoost,
          statBoostPct: result.stats.statBoostPct,
          // Minutes
          avgMinutesWhenOut: result.stats.avgMinutes,
          avgMinutesOverall: result.stats.avgMinutesOverall,
          minutesBoost: result.stats.minutesBoost,
          // Usage & Shooting
          usageWhenOut: result.stats.usageWhenOut,
          usageOverall: result.stats.usageOverall,
          usageBoost: result.stats.usageBoost,
          fgaWhenOut: result.stats.fgaWhenOut,
          fgaOverall: result.stats.fgaOverall,
          fgaBoost: result.stats.fgaBoost,
          fg3aWhenOut: result.stats.fg3aWhenOut,
          fg3aOverall: result.stats.fg3aOverall,
          fg3aBoost: result.stats.fg3aBoost,
          // Rebounds
          orebWhenOut: result.stats.orebWhenOut,
          orebOverall: result.stats.orebOverall,
          orebBoost: result.stats.orebBoost,
          drebWhenOut: result.stats.drebWhenOut,
          drebOverall: result.stats.drebOverall,
          drebBoost: result.stats.drebBoost,
          rebWhenOut: result.stats.rebWhenOut,
          rebOverall: result.stats.rebOverall,
          rebBoost: result.stats.rebBoost,
          // Playmaking
          passesWhenOut: result.stats.passesWhenOut,
          passesOverall: result.stats.passesOverall,
          passesBoost: result.stats.passesBoost,
          potentialAstWhenOut: result.stats.potentialAstWhenOut,
          potentialAstOverall: result.stats.potentialAstOverall,
          potentialAstBoost: result.stats.potentialAstBoost,
        },
      });
    } catch (error) {
      console.error("Failed to recalculate stats:", error);
    } finally {
      setIsRecalculating(false);
    }
  };
  
  // Handle teammate toggle with optimistic UI
  const handleTeammateToggle = async (teammateId: number) => {
    const newIds = state.selectedTeammateIds.includes(teammateId)
      ? state.selectedTeammateIds.filter(id => id !== teammateId)
      : [...state.selectedTeammateIds, teammateId];
    
    // Don't allow empty selection
    if (newIds.length === 0) return;
    
    // Optimistic update - immediately update selected teammates
    onStateChange({ selectedTeammateIds: newIds });
    setIsRecalculating(true);
    
    try {
      const result = await statsMutation.mutateAsync({
        playerId: row.playerId,
        teammateIds: newIds,
        market: state.selectedMarket,
        line: state.selectedLine,
      });
      
      onStateChange({
        currentStats: {
          games: result.stats.games,
          hits: result.stats.hits,
          hitRate: result.stats.hitRate,
          avgStatWhenOut: result.stats.avgStat,
          avgStatOverall: result.stats.avgStatOverall,
          statBoost: result.stats.statBoost,
          statBoostPct: result.stats.statBoostPct,
          // Minutes
          avgMinutesWhenOut: result.stats.avgMinutes,
          avgMinutesOverall: result.stats.avgMinutesOverall,
          minutesBoost: result.stats.minutesBoost,
          // Usage & Shooting
          usageWhenOut: result.stats.usageWhenOut,
          usageOverall: result.stats.usageOverall,
          usageBoost: result.stats.usageBoost,
          fgaWhenOut: result.stats.fgaWhenOut,
          fgaOverall: result.stats.fgaOverall,
          fgaBoost: result.stats.fgaBoost,
          fg3aWhenOut: result.stats.fg3aWhenOut,
          fg3aOverall: result.stats.fg3aOverall,
          fg3aBoost: result.stats.fg3aBoost,
          // Rebounds
          orebWhenOut: result.stats.orebWhenOut,
          orebOverall: result.stats.orebOverall,
          orebBoost: result.stats.orebBoost,
          drebWhenOut: result.stats.drebWhenOut,
          drebOverall: result.stats.drebOverall,
          drebBoost: result.stats.drebBoost,
          rebWhenOut: result.stats.rebWhenOut,
          rebOverall: result.stats.rebOverall,
          rebBoost: result.stats.rebBoost,
          // Playmaking
          passesWhenOut: result.stats.passesWhenOut,
          passesOverall: result.stats.passesOverall,
          passesBoost: result.stats.passesBoost,
          potentialAstWhenOut: result.stats.potentialAstWhenOut,
          potentialAstOverall: result.stats.potentialAstOverall,
          potentialAstBoost: result.stats.potentialAstBoost,
        },
      });
    } catch (error) {
      console.error("Failed to recalculate stats:", error);
      // Revert on error
      onStateChange({ selectedTeammateIds: state.selectedTeammateIds });
    } finally {
      setIsRecalculating(false);
    }
  };
  
  // Get selected teammates info
  const selectedTeammateNames = useMemo(() => {
    if (!teammates.length) {
      // Fallback to default teammate if dropdown hasn't loaded yet
      if (state.selectedTeammateIds.includes(row.defaultTeammateId)) {
        return [{ name: row.defaultTeammateName, status: row.defaultTeammateInjuryStatus }];
      }
      return [];
    }
    
    return state.selectedTeammateIds.map(id => {
      const t = teammates.find(tm => tm.teammateId === id);
      return t 
        ? { name: t.teammateName, status: t.currentInjuryStatus }
        : { name: "Unknown", status: null };
    });
  }, [teammates, state.selectedTeammateIds, row]);

  const injuryInfo = formatInjuryStatus(row.defaultTeammateInjuryStatus);
  const stats = state.currentStats;

  return (
    <tr className={cn(
      rowBg,
      "group hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors",
      isPinned && "border-l-2 border-l-brand bg-brand/5 dark:bg-brand/10"
    )}>
      {/* Player Column */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {/* Player headshot with team color gradient */}
          <div 
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm transition-transform duration-150 group-hover:scale-[1.03]"
            style={{ 
              background: row.primaryColor && row.secondaryColor 
                ? `linear-gradient(180deg, ${row.primaryColor} 0%, ${row.primaryColor} 55%, ${row.secondaryColor} 100%)`
                : row.primaryColor || "#6b7280"
            }}
          >
            <PlayerHeadshot
              nbaPlayerId={row.playerId}
              name={row.playerName}
              size="small"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium text-sm truncate">
              {onPlayerClick ? (
                <Tooltip content="View Profile" side="top">
                  <button
                    type="button"
                    onMouseEnter={() => prefetchPlayer(row.playerId)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayerClick(row);
                    }}
                    className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline transition-colors text-left truncate"
                  >
                    {row.playerName}
                  </button>
                </Tooltip>
              ) : (
                <span className="text-neutral-900 dark:text-white truncate">
                  {row.playerName}
                </span>
              )}
              {isPinned && (
                <Tooltip content="Customized - pinned to top">
                  <span className="flex items-center justify-center h-4 w-4 rounded bg-brand/20 text-brand">
                    <Pin className="h-2.5 w-2.5" />
                  </span>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              {row.teamAbbr && (
                <img
                  src={`/team-logos/nba/${row.teamAbbr.toUpperCase()}.svg`}
                  alt={row.teamAbbr}
                  className="h-4 w-4 object-contain"
                />
              )}
              <span>{row.playerPosition}</span>
              <span className="text-neutral-400">
                {row.homeAway === "home" ? "vs" : "@"} {row.opponentAbbr}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Teammate(s) Out Column - Interactive */}
      <td className="px-2 py-2">
        <div className="relative" ref={teammateDropdownRef}>
          <button
            onClick={() => setShowTeammateDropdown(!showTeammateDropdown)}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors w-full text-left",
              "hover:bg-neutral-100 dark:hover:bg-neutral-800",
              showTeammateDropdown && "bg-neutral-100 dark:bg-neutral-800"
            )}
          >
            <UserMinus className="w-4 h-4 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              {/* Show first teammate */}
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "px-1 py-0.5 rounded text-[9px] font-bold shrink-0",
                  injuryInfo.color
                )}>
                  {injuryInfo.label}
                </span>
                <span className="font-medium text-sm text-neutral-900 dark:text-white truncate">
                  {selectedTeammateNames[0]?.name || row.defaultTeammateName}
                </span>
              </div>
              
              {/* Show additional selected teammates */}
              {state.selectedTeammateIds.length > 1 && (
                <div className="text-xs text-neutral-500 mt-0.5">
                  +{state.selectedTeammateIds.length - 1} more selected
                </div>
              )}
              
              {/* Show "add more" hint if others are injured */}
              {state.selectedTeammateIds.length === 1 && row.otherInjuredTeammatesCount > 0 && (
                <div className="text-xs text-brand mt-0.5">
                  +{row.otherInjuredTeammatesCount} more injured
                </div>
              )}
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-neutral-400 shrink-0 transition-transform",
              showTeammateDropdown && "rotate-180"
            )} />
          </button>
          
          {/* Teammate Dropdown */}
          {showTeammateDropdown && (
            <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Select Teammates
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  Stats show when ALL selected are out
                </div>
              </div>
              
              <div className="max-h-60 overflow-y-auto">
                {teammatesLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-neutral-400" />
                  </div>
                ) : teammates.length === 0 ? (
                  <div className="p-4 text-center text-neutral-500 text-sm">
                    No teammate data available
                  </div>
                ) : (
                  teammates.map((teammate) => {
                    const isSelected = state.selectedTeammateIds.includes(teammate.teammateId);
                    const statusInfo = teammate.currentInjuryStatus 
                      ? formatInjuryStatus(teammate.currentInjuryStatus)
                      : null;
                    
                    return (
                      <button
                        key={teammate.teammateId}
                        onClick={() => handleTeammateToggle(teammate.teammateId)}
                        className={cn(
                          "w-full px-3 py-2.5 flex items-center gap-3 transition-all duration-150",
                          "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                          isSelected && "bg-brand/10 dark:bg-brand/20"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center shrink-0",
                          "transition-all duration-150 ease-out",
                          isSelected 
                            ? "bg-brand border-2 border-brand scale-100" 
                            : "border-2 border-neutral-300 dark:border-neutral-600 scale-100 hover:border-brand"
                        )}>
                          <Check className={cn(
                            "w-3 h-3 text-white transition-all duration-150",
                            isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75"
                          )} />
                        </div>
                        
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            {statusInfo && (
                              <span className={cn(
                                "px-1 py-0.5 rounded text-[9px] font-bold shrink-0",
                                statusInfo.color
                              )}>
                                {statusInfo.label}
                              </span>
                            )}
                            <span className="font-medium text-sm text-neutral-900 dark:text-white truncate">
                              {teammate.teammateName}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {teammate.teammatePosition}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500">
                            {teammate.avgMinutes.toFixed(1)} min • {teammate.gamesOut} games out
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Prop Column - Interactive Market Dropdown */}
      <td className="px-2 py-2">
        <div className="relative flex justify-center" ref={marketDropdownRef}>
          <button
            onClick={() => setShowMarketDropdown(!showMarketDropdown)}
            className={cn(
              "inline-flex flex-col items-center px-3 py-1.5 rounded-lg transition-colors",
              "hover:bg-neutral-100 dark:hover:bg-neutral-800",
              showMarketDropdown && "bg-neutral-100 dark:bg-neutral-800"
            )}
          >
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm text-neutral-900 dark:text-white">
                {state.selectedLine}
              </span>
              <ChevronDown className={cn(
                "w-3 h-3 text-neutral-400 transition-transform",
                showMarketDropdown && "rotate-180"
              )} />
            </div>
            <span className="text-xs text-neutral-500">
              {getMarketDisplayName(state.selectedMarket)}
            </span>
          </button>
          
          {/* Market Dropdown */}
          {showMarketDropdown && (
            <div className="absolute top-full mt-1 z-50 w-48 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Change Market
                </div>
              </div>
              
              {/* Upgrade banner for gated users */}
              {isGated && (
                <div className="px-3 py-2 bg-brand/10 border-b border-brand/20">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                    <Lock className="w-3 h-3 text-brand shrink-0" />
                    <span><a href="/pricing" className="font-semibold text-brand hover:underline">Upgrade</a> to change markets</span>
                  </div>
                </div>
              )}
              
              <div className={cn("max-h-48 overflow-y-auto", isGated && "opacity-50 pointer-events-none")}>
                {linesLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-neutral-400" />
                  </div>
                ) : lines.length === 0 ? (
                  <div className="p-4 text-center text-neutral-500 text-sm">
                    No other lines available
                  </div>
                ) : (
                  lines.map((line) => {
                    const isSelected = line.market === state.selectedMarket && line.line === state.selectedLine;
                    
                    return (
                      <button
                        key={`${line.market}-${line.line}`}
                        onClick={() => !isGated && handleMarketSelect(line)}
                        disabled={isGated}
                        className={cn(
                          "w-full px-3 py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors",
                          isSelected && "bg-brand/10 dark:bg-brand/20"
                        )}
                      >
                        <span className="font-medium text-sm text-neutral-900 dark:text-white">
                          {line.marketDisplay}
                        </span>
                        <span className="text-sm text-neutral-500">
                          {line.line}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-brand ml-2" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Hit Rate Column */}
      <td className="px-2 py-2 text-center">
        <Tooltip content={`${stats.hits}/${stats.games} games hit when selected teammate(s) out`}>
          <div className="relative inline-flex flex-col items-center min-w-[48px] min-h-[36px] justify-center">
            <div className={cn(
              "flex flex-col items-center transition-opacity duration-150",
              isRecalculating && "opacity-40"
            )}>
              <span className={cn(
                "font-bold text-sm",
                getHitRateColor(stats.hitRate)
              )}>
                {stats.hitRate !== null ? `${(stats.hitRate * 100).toFixed(0)}%` : "—"}
              </span>
              <span className="text-xs text-neutral-500">
                {stats.hits}/{stats.games}
              </span>
            </div>
            {isRecalculating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-brand" />
              </div>
            )}
          </div>
        </Tooltip>
      </td>

      {/* Avg When Out Column - Shows season avg → avg when out (boost) */}
      <td className="px-2 py-2 text-center">
        <div className="relative inline-flex flex-col items-center min-h-[36px] justify-center">
          <div className={cn(
            "flex flex-col items-center transition-opacity duration-150",
            isRecalculating && "opacity-40"
          )}>
            {/* Main row: Season Avg → Avg When Out */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-500 dark:text-neutral-500 tabular-nums">
                {stats.avgStatOverall.toFixed(1)}
              </span>
              <span className="text-neutral-400 dark:text-neutral-500">→</span>
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
                {stats.avgStatWhenOut.toFixed(1)}
              </span>
            </div>
            {/* Boost amount with percentage */}
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-xs font-bold tabular-nums",
                getStatBoostColor(stats.statBoost)
              )}>
                {stats.statBoost > 0 ? "+" : ""}{stats.statBoost.toFixed(1)}
              </span>
              <span className={cn(
                "text-[10px] tabular-nums",
                stats.statBoostPct !== null && stats.statBoostPct > 0 ? "text-green-600/80 dark:text-green-400/70" : 
                stats.statBoostPct !== null && stats.statBoostPct < 0 ? "text-red-600/80 dark:text-red-400/70" : "text-neutral-500"
              )}>
                ({stats.statBoostPct !== null && stats.statBoostPct > 0 ? "+" : ""}
                {stats.statBoostPct?.toFixed(0)}%)
              </span>
            </div>
          </div>
          {isRecalculating && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-brand" />
            </div>
          )}
        </div>
      </td>

      {/* Sample Size Column */}
      <td className="px-2 py-2 text-center">
        <div className="relative inline-flex items-center justify-center min-w-[32px] min-h-[24px]">
          <span className={cn(
            "text-sm transition-opacity duration-150",
            stats.games >= 5 ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-500",
            isRecalculating && "opacity-40"
          )}>
            {stats.games}
          </span>
          {isRecalculating && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-3 h-3 animate-spin text-brand" />
            </div>
          )}
        </div>
      </td>

      {/* Key Stat Column - Dynamic based on market */}
      <KeyStatCell 
        market={state.selectedMarket} 
        stats={stats} 
        isRecalculating={isRecalculating}
      />

      {/* Minutes / Usage Column - Shows season avg → avg when out */}
      <td className="px-2 py-2 text-center">
        <Tooltip content={
          <div className="space-y-2 min-w-[140px]">
            <div className="text-xs font-semibold text-neutral-300 border-b border-neutral-700 pb-1">
              Additional Stats
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-400">FGA</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500">{stats.fgaOverall.toFixed(1)}</span>
                  <span className="text-neutral-600">→</span>
                  <span className="text-neutral-200 font-medium">{stats.fgaWhenOut.toFixed(1)}</span>
                  <span className={cn(
                    "font-semibold",
                    stats.fgaBoost > 0 ? "text-green-400" : stats.fgaBoost < 0 ? "text-red-400" : "text-neutral-500"
                  )}>
                    {stats.fgaBoost > 0 ? "+" : ""}{stats.fgaBoost.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-400">3PA</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500">{stats.fg3aOverall.toFixed(1)}</span>
                  <span className="text-neutral-600">→</span>
                  <span className="text-neutral-200 font-medium">{stats.fg3aWhenOut.toFixed(1)}</span>
                  <span className={cn(
                    "font-semibold",
                    stats.fg3aBoost > 0 ? "text-green-400" : stats.fg3aBoost < 0 ? "text-red-400" : "text-neutral-500"
                  )}>
                    {stats.fg3aBoost > 0 ? "+" : ""}{stats.fg3aBoost.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        }>
          <div className="relative inline-flex flex-col items-center gap-0.5 min-h-[40px] justify-center">
            <div className={cn(
              "flex flex-col items-center gap-0.5 transition-opacity duration-150",
              isRecalculating && "opacity-40"
            )}>
              {/* Minutes: overall → when out (boost) */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-500 w-7">MIN</span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-500 tabular-nums">{stats.avgMinutesOverall.toFixed(0)}</span>
                <span className="text-neutral-400 dark:text-neutral-600 text-[10px]">→</span>
                <span className="text-xs text-neutral-700 dark:text-neutral-300 tabular-nums font-medium">{stats.avgMinutesWhenOut.toFixed(0)}</span>
                <span className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  stats.minutesBoost > 0 ? "text-green-500 dark:text-green-400" : stats.minutesBoost < 0 ? "text-red-500 dark:text-red-400" : "text-neutral-500"
                )}>
                  {stats.minutesBoost > 0 ? "+" : ""}{stats.minutesBoost.toFixed(1)}
                </span>
              </div>
              {/* Usage: overall → when out (boost) - multiply by 100 to convert decimal to % */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-500 w-7">USG</span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-500 tabular-nums">{(stats.usageOverall * 100).toFixed(0)}%</span>
                <span className="text-neutral-400 dark:text-neutral-600 text-[10px]">→</span>
                <span className="text-xs text-neutral-700 dark:text-neutral-300 tabular-nums font-medium">{(stats.usageWhenOut * 100).toFixed(0)}%</span>
                <span className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  stats.usageBoost > 0 ? "text-green-500 dark:text-green-400" : stats.usageBoost < 0 ? "text-red-500 dark:text-red-400" : "text-neutral-500"
                )}>
                  {stats.usageBoost > 0 ? "+" : ""}{(stats.usageBoost * 100).toFixed(1)}
                </span>
              </div>
            </div>
            {isRecalculating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-3 h-3 animate-spin text-brand" />
              </div>
            )}
          </div>
        </Tooltip>
      </td>

      {/* Grade Column - matching hit rate sheet style */}
      <td className="px-2 py-2 text-center">
        <div className="flex justify-center">
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-bold",
            getGradeColor(row.opportunityGrade as "A+" | "A" | "B+" | "B" | "C")
          )}>
            <span>{row.opportunityGrade}</span>
            <span className="opacity-70 text-xs">({Math.round(row.confidenceScore)})</span>
          </div>
        </div>
      </td>

      {/* Odds Column - Live from Redis */}
      <td className="px-3 py-2">
        <div className="flex justify-center">
          <OddsDropdownCell
            odds={liveOdds}
            line={row.line}
            isLive={liveOdds?.live}
          />
        </div>
      </td>

      {/* Action Column - View Full Stats + Favorites */}
      <td className="px-2 py-2">
        <div className="flex items-center justify-center gap-1">
          <Tooltip content="View all stat boosts" side="left">
            <button
              onClick={() => setShowStatsModal(true)}
              className="p-2 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </Tooltip>
          
          {/* Favorites Button */}
          {!isLoggedIn ? (
            <Tooltip content="Sign in to save favorites" side="left">
              <button
                disabled
                className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 opacity-50 cursor-not-allowed"
              >
                <Heart className="w-4 h-4 text-neutral-400" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content={isRowFavorited ? "Remove from favorites" : "Add to favorites"} side="left">
              <button
                onClick={handleToggleFavorite}
                disabled={isTogglingFavorite}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isRowFavorited
                    ? "bg-red-500/10 hover:bg-red-500/20"
                    : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                )}
              >
                {isTogglingFavorite ? (
                  <HeartFill className="w-4 h-4 text-red-400 animate-pulse" />
                ) : isRowFavorited ? (
                  <HeartFill className="w-4 h-4 text-red-500" />
                ) : (
                  <Heart className="w-4 h-4 text-neutral-400 hover:text-red-400" />
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </td>

      {/* Stats Modal */}
      <InjuryImpactStatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        playerName={row.playerName}
        playerId={row.playerId}
        teamAbbr={row.teamAbbr}
        teammateNames={teammates
          .filter(t => state.selectedTeammateIds.includes(t.teammateId))
          .map(t => t.teammateName)
          .length > 0 
            ? teammates
                .filter(t => state.selectedTeammateIds.includes(t.teammateId))
                .map(t => t.teammateName)
            : [row.defaultTeammateName]
        }
        market={state.selectedMarket}
        line={state.selectedLine}
        stats={state.currentStats}
      />
    </tr>
  );
}
