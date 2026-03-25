"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";
import { PlayerCard } from "./player-card";
import { MobileGlossarySheet } from "./mobile-glossary-sheet";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import type { NbaGame } from "@/hooks/use-nba-games";
import { useHitRateOdds } from "@/hooks/use-hit-rate-odds";

const MARKET_OPTIONS = [
  { value: "player_points", label: "Points" },
  { value: "player_rebounds", label: "Rebounds" },
  { value: "player_assists", label: "Assists" },
  { value: "player_points_rebounds_assists", label: "PRA" },
  { value: "player_points_rebounds", label: "P+R" },
  { value: "player_points_assists", label: "P+A" },
  { value: "player_rebounds_assists", label: "R+A" },
  { value: "player_threes_made", label: "3PM" },
  { value: "player_steals", label: "Steals" },
  { value: "player_blocks", label: "Blocks" },
  { value: "player_blocks_steals", label: "Blk+Stl" },
  { value: "player_turnovers", label: "TO" },
];

const SORT_OPTIONS: Array<{ value: string; label: string; field: string; dir: "asc" | "desc" }> = [
  { value: "l10Pct_desc", label: "L10 % (Best)", field: "l10Pct", dir: "desc" },
  { value: "l10Pct_asc", label: "L10 % (Worst)", field: "l10Pct", dir: "asc" },
  { value: "l5Pct_desc", label: "L5 % (Best)", field: "l5Pct", dir: "desc" },
  { value: "l5Pct_asc", label: "L5 % (Worst)", field: "l5Pct", dir: "asc" },
  { value: "l20Pct_desc", label: "L20 % (Best)", field: "l20Pct", dir: "desc" },
  { value: "l20Pct_asc", label: "L20 % (Worst)", field: "l20Pct", dir: "asc" },
  { value: "seasonPct_desc", label: "Season % (Best)", field: "seasonPct", dir: "desc" },
  { value: "seasonPct_asc", label: "Season % (Worst)", field: "seasonPct", dir: "asc" },
  { value: "dvp_desc", label: "DvP (Weakest D → Strongest)", field: "matchupRank", dir: "desc" }, // 30→1: Best matchups first
  { value: "dvp_asc", label: "DvP (Strongest D → Weakest)", field: "matchupRank", dir: "asc" }, // 1→30: Toughest matchups first
  { value: "line_desc", label: "Line (High → Low)", field: "line", dir: "desc" },
  { value: "line_asc", label: "Line (Low → High)", field: "line", dir: "asc" },
  { value: "name_asc", label: "Player Name (A → Z)", field: "name", dir: "asc" },
  { value: "name_desc", label: "Player Name (Z → A)", field: "name", dir: "desc" },
];

interface MobileHitRatesProps {
  rows: HitRateProfile[];
  games: NbaGame[];
  loading: boolean;
  error?: string | null;
  onPlayerClick: (player: HitRateProfile) => void;
  // Controlled state from parent (to persist across drilldown navigation)
  selectedMarkets: string[];
  onMarketsChange: (markets: string[]) => void;
  sortField: string;
  onSortChange: (sort: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedGameIds: string[];
  onGameIdsChange: (gameIds: string[]) => void;
  // Hide players from games that have started (when no specific games selected)
  startedGameIds?: Set<string>;
  // Auth gating - blur cards after this index
  blurAfterIndex?: number;
  // Max rows to show (for gated view)
  maxRows?: number;
  // Hide load more button
  hideLoadMore?: boolean;
  // Bottom content (e.g. upgrade CTA)
  bottomContent?: React.ReactNode;
  // Upgrade banner to show in header (for free users)
  upgradeBanner?: React.ReactNode;
  // Hide players without odds
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (hide: boolean) => void;
}

export function MobileHitRates({
  rows,
  games,
  loading,
  error,
  onPlayerClick,
  selectedMarkets,
  onMarketsChange,
  sortField,
  onSortChange,
  searchQuery,
  onSearchChange,
  selectedGameIds,
  onGameIdsChange,
  startedGameIds,
  blurAfterIndex,
  maxRows,
  hideLoadMore = false,
  bottomContent,
  upgradeBanner,
  hideNoOdds = false, // Default OFF - show all players while odds load
  onHideNoOddsChange,
}: MobileHitRatesProps) {
  // Filter state (only local state for game selection and visible count)
  // selectedGameIds and onGameIdsChange now come from props (controlled by parent)
  const [visibleCount, setVisibleCount] = useState(50);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  // Reset visible count when filters change (so each filter shows fresh results)
  React.useEffect(() => {
    setVisibleCount(50);
  }, [selectedMarkets, selectedGameIds, sortField, searchQuery, hideNoOdds]);

  // Transform games for header with team tricodes for logos and date
  const gameOptions = useMemo(() => 
    games.map(g => ({
      id: g.game_id,
      label: `${g.away_team_tricode} @ ${g.home_team_tricode}`,
      time: g.game_status ?? "TBD",
      awayTeam: g.away_team_tricode,
      homeTeam: g.home_team_tricode,
      date: g.game_date, // YYYY-MM-DD format
    })),
    [games]
  );

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let result = rows;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.playerName.toLowerCase().includes(query) ||
        r.teamAbbr?.toLowerCase().includes(query)
      );
    }
    
    // Market filter
    if (selectedMarkets.length > 0 && selectedMarkets.length < MARKET_OPTIONS.length) {
      result = result.filter(r => selectedMarkets.includes(r.market));
    }
    
    // Game filter
    if (selectedGameIds.length > 0) {
      const normalizeId = (id: string | number | null) => 
        String(id ?? "").replace(/^0+/, "") || "0";
      const normalizedIds = selectedGameIds.map(normalizeId);
      result = result.filter(r => normalizedIds.includes(normalizeId(r.gameId)));
    } else if (startedGameIds && startedGameIds.size > 0) {
      // No specific games selected - hide players from games that have already started
      const normalizeId = (id: string | number | null) => 
        String(id ?? "").replace(/^0+/, "") || "0";
      result = result.filter(r => {
        if (!r.gameId) return true; // Keep rows without gameId
        return !startedGameIds.has(normalizeId(r.gameId));
      });
    }
    
    // Note: hideNoOdds filter is applied in render since odds are fetched separately
    
    // Sort - parse field and direction from sortField (e.g., "l10Pct_desc")
    const sortOption = SORT_OPTIONS.find(o => o.value === sortField);
    const field = sortOption?.field ?? "l10Pct";
    const dir = sortOption?.dir ?? "desc";
    
    result = [...result].sort((a, b) => {
      // Push "out" players to the bottom regardless of sort order
      const aIsOut = a.injuryStatus?.toLowerCase() === "out";
      const bIsOut = b.injuryStatus?.toLowerCase() === "out";
      if (aIsOut && !bIsOut) return 1;
      if (!aIsOut && bIsOut) return -1;
      
      // Push players without odds to the bottom (after "out" players are handled)
      const aHasOdds = !!a.oddsSelectionId;
      const bHasOdds = !!b.oddsSelectionId;
      if (aHasOdds && !bHasOdds) return -1;
      if (!aHasOdds && bHasOdds) return 1;
      
      let comparison = 0;
      
      if (field === "name") {
        // Sort by player name alphabetically
        const nameA = a.playerName?.toLowerCase() ?? "";
        const nameB = b.playerName?.toLowerCase() ?? "";
        comparison = nameA.localeCompare(nameB);
      } else {
        // Sort by numeric value
        const getValue = (row: HitRateProfile) => {
          switch (field) {
            case "l5Pct": return row.last5Pct ?? -1;
            case "l10Pct": return row.last10Pct ?? -1;
            case "l20Pct": return row.last20Pct ?? -1;
            case "seasonPct": return row.seasonPct ?? -1;
            case "line": return row.line ?? -1;
            case "matchupRank": return row.matchupRank ?? 999; // Use 999 for null ranks (worst)
            default: return row.last10Pct ?? -1;
          }
        };
        comparison = getValue(a) - getValue(b);
      }
      
      // Apply direction
      return dir === "desc" ? -comparison : comparison;
    });
    
    return result;
  }, [rows, searchQuery, selectedMarkets, selectedGameIds, sortField, startedGameIds]);

  // Fetch odds for ALL filtered rows (not just visible ones)
  // This matches desktop behavior - we need to know which players have odds
  // before we can properly paginate/display them
  const { getOdds, isLoading: oddsLoading, isLoadingMore } = useHitRateOdds({
    rows: filteredRows.map((r) => ({ 
      oddsSelectionId: r.oddsSelectionId, 
      line: r.line 
    })),
    enabled: filteredRows.length > 0,
  });

  // When hideNoOdds is enabled, filter to only rows with actual odds BEFORE pagination
  // This ensures we show 50 players WITH odds, not 50 random players
  const rowsForDisplay = useMemo(() => {
    if (!hideNoOdds) {
      return filteredRows;
    }
    
    return filteredRows.filter(row => {
      const odds = getOdds?.(row.oddsSelectionId);
      
      // If we have odds data, check if there are valid lines
      if (odds) {
        return !!(odds.bestOver || odds.bestUnder);
      }

      // Fallback to bestOdds from API (desktop parity)
      if (row.bestOdds) {
        return true;
      }
      
      // If no odds data yet:
      // If we are still loading (initial or background), keep the row tentatively
      // otherwise assume it has no odds
      if (oddsLoading || isLoadingMore) {
        return true;
      }
      
      return false;
    });
  }, [filteredRows, hideNoOdds, oddsLoading, isLoadingMore, getOdds]);

  // Paginated rows (respect maxRows if set)
  const effectiveLimit = maxRows !== undefined ? Math.min(maxRows, visibleCount) : visibleCount;
  const visibleRows = useMemo(() => 
    rowsForDisplay.slice(0, effectiveLimit),
    [rowsForDisplay, effectiveLimit]
  );

  const hasMore = !hideLoadMore && rowsForDisplay.length > visibleCount;

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + 50);
  }, []);

  // Loading state - Premium
  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand/30 border-t-brand" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-brand/60 animate-pulse" />
            </div>
          </div>
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Loading hit rates...</span>
        </div>
      </div>
    );
  }

  // Error state - Premium
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900 flex items-center justify-center p-4">
        <div className="text-center p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200/80 dark:border-red-800/50">
          <p className="text-red-600 dark:text-red-400 font-bold">Error loading data</p>
          <p className="text-sm text-red-500 dark:text-red-400/80 mt-2">{error}</p>
        </div>
      </div>
    );
  }
  
  // Calculate header height for content padding
  // Expanded: Filter rows (3 rows × ~44px) + sport tabs (~36px) = ~168px
  // With upgrade banner: add ~56px
  // Collapsed: Single minimal row = ~40px
  const UPGRADE_BANNER_HEIGHT = upgradeBanner ? 56 : 0;
  const FILTER_HEADER_HEIGHT = isHeaderCollapsed ? 40 : (168 + UPGRADE_BANNER_HEIGHT);

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-neutral-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 overflow-x-hidden">
      {/* Fixed Header - stays at top when scrolling - below layout's h-12 mobile header */}
      <div className="fixed top-12 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-lg shadow-lg shadow-black/[0.03] dark:shadow-black/20 border-b border-neutral-200/50 dark:border-neutral-800/50">
        <MobileHeader
          sport="nba"
          selectedGameIds={selectedGameIds}
          games={gameOptions}
          onGamesChange={onGameIdsChange}
          selectedMarkets={selectedMarkets}
          marketOptions={MARKET_OPTIONS}
          onMarketsChange={onMarketsChange}
          sortField={sortField}
          sortOptions={SORT_OPTIONS}
          onSortChange={onSortChange}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          isCollapsed={isHeaderCollapsed}
          onCollapsedChange={setIsHeaderCollapsed}
          upgradeBanner={upgradeBanner}
          onGlossaryClick={() => setShowGlossary(true)}
          hideNoOdds={hideNoOdds}
          onHideNoOddsChange={onHideNoOddsChange}
        />
      </div>
      
      {/* Spacer for fixed header - adjusts based on collapsed state */}
      <div 
        className="transition-all duration-200"
        style={{ height: `${FILTER_HEADER_HEIGHT}px` }} 
      />
      
      {/* Player Cards - Premium */}
      <div className="pb-24">
        {visibleRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center mb-5 shadow-lg shadow-black/5 dark:shadow-black/30 border border-neutral-200/50 dark:border-neutral-700/50">
              <Loader2 className="h-7 w-7 text-neutral-400 dark:text-neutral-500" />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 font-medium text-center">
              No props match your filters
            </p>
            <button
              type="button"
              onClick={() => {
                onMarketsChange(["player_points"]); // Reset to just Points
                onGameIdsChange([]);
                onSearchChange("");
              }}
              className="mt-4 px-5 py-2.5 text-sm font-bold text-brand bg-brand/10 rounded-xl hover:bg-brand/15 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {visibleRows.map((row, idx) => {
              const oddsFromHook = getOdds?.(row.oddsSelectionId);
              const hookBestOver = oddsFromHook?.bestOver ?? null;
              const hookBestUnder = oddsFromHook?.bestUnder ?? null;
              
              // Prefer Redis best odds from the hit-rates v2 API for display (matches drilldown/My Plays)
              // Use hook data only for link enrichment when the book matches.
              const bestOverFromRow = row.bestOdds
                ? {
                    price: row.bestOdds.price,
                    book: row.bestOdds.book,
                    url: hookBestOver?.book === row.bestOdds.book ? hookBestOver.url ?? null : null,
                    mobileUrl: hookBestOver?.book === row.bestOdds.book ? hookBestOver.mobileUrl ?? null : null,
                    sgp: hookBestOver?.book === row.bestOdds.book ? hookBestOver.sgp ?? null : null,
                  }
                : null;
              
              const odds = bestOverFromRow
                ? { bestOver: bestOverFromRow, bestUnder: null }
                : (oddsFromHook && (hookBestOver || hookBestUnder) ? oddsFromHook : null);
              
              // Note: hideNoOdds filtering is now done BEFORE pagination in rowsForDisplay
              // So all rows here should already have odds if hideNoOdds is enabled
              
              return (
              <PlayerCard
                key={`${row.id}-${row.market}`}
                profile={row}
                  odds={odds}
                onCardClick={() => onPlayerClick(row)}
                onAddToSlip={() => {
                  // TODO: Implement add to slip
                }}
                isFirst={idx === 0}
                isBlurred={blurAfterIndex !== undefined && idx >= blurAfterIndex}
              />
              );
            })}
            
            {/* Bottom Content (e.g. upgrade CTA) */}
            {bottomContent}
            
            {/* Load More - Premium */}
            {hasMore && (
              <div className="flex justify-center py-6 px-4">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className={cn(
                    "px-8 py-3 text-sm font-bold rounded-2xl",
                    "text-brand bg-white dark:bg-neutral-800",
                    "border border-neutral-200/80 dark:border-neutral-700/80",
                    "shadow-lg shadow-black/[0.03] dark:shadow-black/20",
                    "active:scale-[0.98] transition-all duration-200",
                    "hover:shadow-xl"
                  )}
                >
                  Load more ({rowsForDisplay.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Glossary Modal */}
      <MobileGlossarySheet isOpen={showGlossary} onClose={() => setShowGlossary(false)} />
    </div>
  );
}
