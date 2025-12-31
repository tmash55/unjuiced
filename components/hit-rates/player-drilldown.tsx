"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, HeartPulse, X, Pencil, TrendingUp, ChevronLeft, ChevronRight, Grid3X3, LayoutList, ArrowDown } from "lucide-react";
import { PlayerHeadshot } from "@/components/player-headshot";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { AlternateLinesMatrix } from "./alternate-lines-matrix";
import { PlayerCorrelations } from "./player-correlations";
import { PositionVsTeam } from "./position-vs-team";
import { DefensiveAnalysis } from "./defensive-analysis";
import { GameLogChart } from "./game-log-chart";
import { TeamRoster } from "./team-roster";
import { BoxScoreTable } from "./box-score-table";
import { ChartFilters, ChartFiltersState, DEFAULT_FILTERS, applyChartFilters } from "./chart-filters";
import { RosterAndInjuries, InjuryFilter } from "./roster-and-injuries";
import { PlayTypeAnalysis } from "./play-type-analysis";
import { ShootingZones } from "./shooting-zones";
import { usePlayerBoxScores } from "@/hooks/use-player-box-scores";
import { usePlayerGamesWithInjuries } from "@/hooks/use-injury-context";
import { Tooltip } from "@/components/tooltip";

// Injury status color helpers
const getInjuryIconColor = (status: string | null): string => {
  if (!status) return "text-amber-500";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "text-amber-500"; // fallback
};

// Position labels for display
const POSITION_LABELS: Record<string, string> = {
  'PG': 'Point Guard',
  'SG': 'Shooting Guard',
  'SF': 'Small Forward',
  'PF': 'Power Forward',
  'C': 'Center',
  'G': 'Guard',
  'F': 'Forward',
  'GF': 'Guard-Forward',
  'FC': 'Forward-Center',
};

const getPositionLabel = (position: string | null): string => {
  if (!position) return "Unknown";
  return POSITION_LABELS[position] || position;
};

type GameCountFilter = 5 | 10 | 20 | "season" | "h2h";

// Market display order
const MARKET_ORDER = [
  "player_points",
  "player_rebounds", 
  "player_assists",
  "player_points_rebounds_assists",
  "player_points_rebounds",
  "player_points_assists",
  "player_rebounds_assists",
  "player_threes_made",
  "player_steals",
  "player_blocks",
  "player_turnovers",
  "player_blocks_steals",
];

interface PlayerDrilldownProps {
  profile: HitRateProfile;
  allPlayerProfiles?: HitRateProfile[]; // All profiles for this player (different markets)
  onBack: () => void;
  onMarketChange?: (market: string) => void; // Callback when market changes (for persisting preference)
}

// Format percentage with color class
const getPctColor = (value: number | null) => {
  if (value === null) return "text-neutral-500";
  if (value >= 70) return "text-emerald-500";
  if (value >= 50) return "text-amber-500";
  return "text-red-500";
};

// Market hit rate data structure
interface MarketHitRateData {
  hitRate: number | null;
  hits: number;
  total: number;
  expectedTotal: number;
}

// Quick filter labels for display
const QUICK_FILTER_LABELS: Record<string, string> = {
  "home": "Home",
  "away": "Away",
  "wins": "Wins",
  "losses": "Losses",
  "30min": "30+ Min",
  "primetime": "Primetime",
};

// Market Selector Strip Component with sticky behavior and arrow navigation
interface MarketSelectorStripProps {
  sortedMarkets: HitRateProfile[];
  selectedMarket: string;
  setSelectedMarket: (market: string) => void;
  marketHitRates: Map<string, MarketHitRateData>;
  // Custom line for the selected market
  customLine: number | null;
  // Filter props
  quickFilters: Set<string>;
  chartFilters: ChartFiltersState;
  injuryFilters: InjuryFilter[];
  onClearAllFilters: () => void;
  onRemoveQuickFilter: (filter: string) => void;
  onRemoveInjuryFilter: (playerId: number) => void;
}

function MarketSelectorStrip({ 
  sortedMarkets, 
  selectedMarket, 
  setSelectedMarket, 
  marketHitRates,
  customLine,
  quickFilters,
  chartFilters,
  injuryFilters,
  onClearAllFilters,
  onRemoveQuickFilter,
  onRemoveInjuryFilter,
}: MarketSelectorStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Update arrow visibility on scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  // Check arrows on mount and when markets change
  useEffect(() => {
    handleScroll();
    // Also check after a small delay for layout to settle
    const timer = setTimeout(handleScroll, 100);
    return () => clearTimeout(timer);
  }, [handleScroll, sortedMarkets]);

  // Scroll handlers
  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };

  return (
    <div className="relative mt-3 pt-3 border-t border-neutral-200/60 dark:border-neutral-700/60">
      <div className="relative px-1">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            type="button"
            onClick={scrollLeft}
            className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full shadow-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-6"
        >
          {sortedMarkets.map((marketProfile, idx) => {
            const isActive = marketProfile.market === selectedMarket;
            // Use dynamic hit rate based on filtered games
            const rateData = marketHitRates.get(marketProfile.market);
            const hitRate = rateData?.hitRate ?? marketProfile.last10Pct;
            const isFilteredSample = rateData && rateData.total < rateData.expectedTotal;
            
            // Show custom line if this is the selected market and customLine is set
            const displayLine = isActive && customLine !== null ? customLine : marketProfile.line;
            const hasCustomLine = isActive && customLine !== null && customLine !== marketProfile.line;

            return (
              <button
                key={`${marketProfile.market}-${idx}`}
                type="button"
                onClick={() => setSelectedMarket(marketProfile.market)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all shrink-0",
                  isActive
                    ? "bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 shadow-sm"
                    : "bg-neutral-100/50 dark:bg-neutral-800/50 border-neutral-200/60 dark:border-neutral-700/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600"
                )}
              >
                {/* Line + Market */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      isActive ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400",
                      hasCustomLine && "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {displayLine}+
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium uppercase",
                      isActive ? "text-neutral-700 dark:text-neutral-300" : "text-neutral-500 dark:text-neutral-500"
                    )}
                  >
                    {formatMarketLabel(marketProfile.market)}
                  </span>
                </div>

                {/* Hit Rate Badge - Dynamic based on filtered games */}
                {rateData && rateData.total > 0 ? (
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "text-xs font-semibold px-1.5 py-0.5 rounded tabular-nums transition-colors",
                        hitRate !== null && hitRate >= 70
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : hitRate !== null && hitRate >= 50
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      )}
                    >
                      {hitRate !== null ? `${hitRate}%` : "—"}
                    </span>
                    {/* Show sample size when filtered */}
                    {isFilteredSample && (
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium tabular-nums">
                        {rateData.hits}/{rateData.total}
                      </span>
                    )}
                  </div>
                ) : hitRate !== null ? (
                  <span
                    className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded tabular-nums transition-colors",
                      hitRate >= 70
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : hitRate >= 50
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                    )}
                  >
                    {hitRate}%
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            type="button"
            onClick={scrollRight}
            className="absolute -right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full shadow-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
          </button>
        )}
      </div>
      
      {/* Active Filters Bar - Shows when filters are applied */}
      <ActiveFiltersBar
        quickFilters={quickFilters}
        chartFilters={chartFilters}
        injuryFilters={injuryFilters}
        onClearAll={onClearAllFilters}
        onRemoveQuickFilter={onRemoveQuickFilter}
        onRemoveInjuryFilter={onRemoveInjuryFilter}
      />
    </div>
  );
}

// Active Filters Bar Component - Shows active filters with remove buttons
interface ActiveFiltersBarProps {
  quickFilters: Set<string>;
  chartFilters: ChartFiltersState;
  injuryFilters: InjuryFilter[];
  onClearAll: () => void;
  onRemoveQuickFilter: (filter: string) => void;
  onRemoveInjuryFilter: (playerId: number) => void;
}

function ActiveFiltersBar({
  quickFilters,
  chartFilters,
  injuryFilters,
  onClearAll,
  onRemoveQuickFilter,
  onRemoveInjuryFilter,
}: ActiveFiltersBarProps) {
  // Count active chart filters
  const activeChartFiltersCount = [
    chartFilters.minutes,
    chartFilters.usage,
    chartFilters.points,
    chartFilters.rebounds,
    chartFilters.assists,
    chartFilters.fg3m,
    chartFilters.fg3a,
    chartFilters.steals,
    chartFilters.blocks,
    chartFilters.turnovers,
    chartFilters.fga,
    chartFilters.fgm,
    chartFilters.fta,
    chartFilters.ftm,
    chartFilters.plusMinus,
    chartFilters.tsPct,
    chartFilters.efgPct,
    chartFilters.oreb,
    chartFilters.dreb,
    chartFilters.potentialReb,
    chartFilters.passes,
    chartFilters.homeAway,
    chartFilters.winLoss,
    chartFilters.daysRest,
  ].filter(Boolean).length;

  const hasActiveFilters = quickFilters.size > 0 || activeChartFiltersCount > 0 || injuryFilters.length > 0;

  if (!hasActiveFilters) return null;

  return (
    <div className="mt-2 pt-2 border-t border-neutral-200/40 dark:border-neutral-700/40">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter Icon + Label */}
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>Filtered:</span>
        </div>
        
        {/* Quick Filters */}
        {Array.from(quickFilters).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onRemoveQuickFilter(filter)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all text-[11px] font-medium group"
          >
            <span>{QUICK_FILTER_LABELS[filter] || filter}</span>
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        ))}

        {/* Chart Filters - Show individual filters with their values */}
        {chartFilters.minutes && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>Minutes: {Math.round(chartFilters.minutes.min)}-{Math.round(chartFilters.minutes.max)}</span>
          </div>
        )}
        {chartFilters.usage && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>Usage: {Math.round(chartFilters.usage.min * 100)}%-{Math.round(chartFilters.usage.max * 100)}%</span>
          </div>
        )}
        {chartFilters.points && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>PTS: {Math.round(chartFilters.points.min)}-{Math.round(chartFilters.points.max)}</span>
          </div>
        )}
        {chartFilters.rebounds && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>REB: {Math.round(chartFilters.rebounds.min)}-{Math.round(chartFilters.rebounds.max)}</span>
          </div>
        )}
        {chartFilters.assists && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>AST: {Math.round(chartFilters.assists.min)}-{Math.round(chartFilters.assists.max)}</span>
          </div>
        )}
        {chartFilters.fg3m && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>3PM: {Math.round(chartFilters.fg3m.min)}-{Math.round(chartFilters.fg3m.max)}</span>
          </div>
        )}
        {chartFilters.fg3a && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>3PA: {Math.round(chartFilters.fg3a.min)}-{Math.round(chartFilters.fg3a.max)}</span>
          </div>
        )}
        {chartFilters.steals && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>STL: {Math.round(chartFilters.steals.min)}-{Math.round(chartFilters.steals.max)}</span>
          </div>
        )}
        {chartFilters.blocks && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>BLK: {Math.round(chartFilters.blocks.min)}-{Math.round(chartFilters.blocks.max)}</span>
          </div>
        )}
        {chartFilters.turnovers && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>TOV: {Math.round(chartFilters.turnovers.min)}-{Math.round(chartFilters.turnovers.max)}</span>
          </div>
        )}
        {chartFilters.plusMinus && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>+/-: {Math.round(chartFilters.plusMinus.min)} to {Math.round(chartFilters.plusMinus.max)}</span>
          </div>
        )}
        {chartFilters.tsPct && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>TS%: {Math.round(chartFilters.tsPct.min)}%-{Math.round(chartFilters.tsPct.max)}%</span>
          </div>
        )}
        {chartFilters.efgPct && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>eFG%: {Math.round(chartFilters.efgPct.min)}%-{Math.round(chartFilters.efgPct.max)}%</span>
          </div>
        )}
        {chartFilters.homeAway && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>{chartFilters.homeAway === "home" ? "Home" : "Away"} Games</span>
          </div>
        )}
        {chartFilters.winLoss && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
            <span>{chartFilters.winLoss === "win" ? "Wins" : "Losses"} Only</span>
          </div>
        )}

        {/* Injury Filters */}
        {injuryFilters.map((filter) => (
          <button
            key={filter.playerId}
            type="button"
            onClick={() => onRemoveInjuryFilter(filter.playerId)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-md transition-all text-[11px] font-medium group",
              filter.mode === "with"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
            )}
          >
            <span>{filter.mode === "with" ? "+" : "−"} {filter.playerName.split(" ").pop()}</span>
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        ))}

        {/* Clear All Button */}
        <button
          type="button"
          onClick={onClearAll}
          className="ml-auto px-2 py-0.5 rounded-md text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export function PlayerDrilldown({ profile: initialProfile, allPlayerProfiles = [], onBack, onMarketChange }: PlayerDrilldownProps) {
  const [selectedMarket, setSelectedMarketInternal] = useState<string>(initialProfile.market);
  
  // Ref for the scroll container - used to scroll to top when switching players
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Wrap setSelectedMarket to also notify parent
  const setSelectedMarket = useCallback((market: string) => {
    setSelectedMarketInternal(market);
    onMarketChange?.(market);
  }, [onMarketChange]);
  const [gameCount, setGameCount] = useState<GameCountFilter>(10);
  const [customLine, setCustomLine] = useState<number | null>(null);
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [chartFilters, setChartFilters] = useState<ChartFiltersState>(DEFAULT_FILTERS);
  const [injuryFilters, setInjuryFilters] = useState<InjuryFilter[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Quick filters (can be combined)
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());
  
  // Scroll to top when player changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [initialProfile.playerId]);

  // Get the current profile based on selected market
  const profile = useMemo(() => {
    const found = allPlayerProfiles.find(p => p.market === selectedMarket);
    return found || initialProfile;
  }, [allPlayerProfiles, selectedMarket, initialProfile]);

  // Sort available markets by the predefined order
  // Deduplicate by market (player might have profiles for today AND tomorrow)
  const sortedMarkets = useMemo(() => {
    if (allPlayerProfiles.length === 0) return [initialProfile];
    
    // Dedupe: prefer profile with a line, then prefer today's game
    const marketMap = new Map<string, HitRateProfile>();
    for (const p of allPlayerProfiles) {
      const existing = marketMap.get(p.market);
      if (!existing) {
        marketMap.set(p.market, p);
      } else {
        // Prefer profile with a line over one without
        const existingHasLine = existing.line !== null;
        const currentHasLine = p.line !== null;
        if (!existingHasLine && currentHasLine) {
          marketMap.set(p.market, p);
        }
      }
    }
    
    return [...marketMap.values()].sort((a, b) => {
      const aIndex = MARKET_ORDER.indexOf(a.market);
      const bIndex = MARKET_ORDER.indexOf(b.market);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }, [allPlayerProfiles, initialProfile]);

  // Reset to initial market and custom line when player changes
  useEffect(() => {
    setSelectedMarketInternal(initialProfile.market);
    setCustomLine(null);
    setChartFilters(DEFAULT_FILTERS);
    setInjuryFilters([]);
    setQuickFilters(new Set());
  }, [initialProfile.playerId]);

  // Reset custom line and filters when market changes
  useEffect(() => {
    setCustomLine(null);
    setChartFilters(DEFAULT_FILTERS);
    setQuickFilters(new Set());
  }, [selectedMarket]);

  // Fetch box scores for this player (used for chart and table)
  const { games: boxScoreGames, seasonSummary, isLoading: boxScoresLoading } = usePlayerBoxScores({
    playerId: profile.playerId,
    limit: 50, // Get plenty of games for season view
  });
  
  // Fetch games with injury context (for accurate teammates_out data across ALL games)
  // This replaces the limited gameLogs data from the profile
  const { games: gamesWithInjuries, isLoading: injuryGamesLoading } = usePlayerGamesWithInjuries({
    playerId: profile.playerId,
    enabled: !!profile.playerId,
  });

  // Fetch odds for current profile
  const { data: oddsData } = useQuery({
    queryKey: ["profile-odds", profile.oddsSelectionId, profile.line],
    queryFn: async () => {
      if (!profile.oddsSelectionId) return null;
      const res = await fetch("/api/nba/hit-rates/odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selections: [{ stableKey: profile.oddsSelectionId, line: profile.line }]
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.odds?.[profile.oddsSelectionId] || null;
    },
    enabled: !!profile.oddsSelectionId,
    staleTime: 30_000,
  });

  // Memoize the allBooks extraction from odds data
  // When custom line is set, find the closest available line
  const oddsForChart = useMemo(() => {
    if (!oddsData) return null;
    
    const activeLine = customLine ?? profile.line;
    const allLines = oddsData.allLines || [];
    
    // Find exact line or closest line that's <= the active line (for over odds)
    let lineData = allLines.find((l: any) => l.line === activeLine);
    let closestLine: number | null = null;
    
    if (!lineData && allLines.length > 0 && activeLine !== null) {
      // Find the closest line that's <= activeLine (best for "over" bets)
      const sortedLines = [...allLines].sort((a: any, b: any) => b.line - a.line);
      const closestLineData = sortedLines.find((l: any) => l.line <= activeLine);
      
      // If no line below, get the lowest available line
      lineData = closestLineData || sortedLines[sortedLines.length - 1];
      closestLine = lineData?.line ?? null;
    }
    
    let allBooks: { over: any[]; under: any[] } | undefined;
    let bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null } | null = null;
    let bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null } | null = null;
    
    if (lineData?.books) {
      const overBooks: { book: string; price: number; url: string | null; mobileUrl: string | null }[] = [];
      const underBooks: { book: string; price: number; url: string | null; mobileUrl: string | null }[] = [];
      
      for (const [bookId, bookOdds] of Object.entries(lineData.books as Record<string, any>)) {
        if (bookOdds.over) {
          overBooks.push({
            book: bookId,
            price: bookOdds.over.price,
            url: bookOdds.over.url || null,
            mobileUrl: bookOdds.over.mobileUrl || null,
          });
        }
        if (bookOdds.under) {
          underBooks.push({
            book: bookId,
            price: bookOdds.under.price,
            url: bookOdds.under.url || null,
            mobileUrl: bookOdds.under.mobileUrl || null,
          });
        }
      }
      
      // Sort by price (better odds first)
      overBooks.sort((a, b) => b.price - a.price);
      underBooks.sort((a, b) => b.price - a.price);
      
      allBooks = { over: overBooks, under: underBooks };
      bestOver = overBooks[0] || null;
      bestUnder = underBooks[0] || null;
    }
    
    // Use line-specific best odds, or fall back to primary line odds
    return {
      bestOver: bestOver || oddsData.bestOver,
      bestUnder: bestUnder || oddsData.bestUnder,
      allBooks,
      // Include the actual line we found odds for (for display purposes)
      oddsLine: closestLine ?? (lineData?.line as number | undefined) ?? null,
      isClosestLine: closestLine !== null && closestLine !== activeLine,
    };
  }, [oddsData, customLine, profile.line]);

  // Get total available games
  const totalGamesAvailable = boxScoreGames.length;

  // Quick filter toggle helper
  const toggleQuickFilter = (filter: string) => {
    setQuickFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        // Handle mutual exclusivity
        if (filter === "home") next.delete("away");
        if (filter === "away") next.delete("home");
        if (filter === "win") { next.delete("loss"); next.delete("lostBy10"); }
        if (filter === "loss") { next.delete("win"); next.delete("wonBy10"); }
        if (filter === "wonBy10") { next.delete("loss"); next.delete("lostBy10"); }
        if (filter === "lostBy10") { next.delete("win"); next.delete("wonBy10"); }
        next.add(filter);
      }
      return next;
    });
  };

  // Build a map of gameId -> teammates out (player IDs who were out for that game)
  // Uses the full injury context data from get_player_games_with_injuries RPC
  // which includes ALL games, not just the last 20 from gameLogs
  const teammatesOutByGame = useMemo(() => {
    const map = new Map<string, Set<number>>();
    
    // Prefer the full injury context data if available
    if (gamesWithInjuries && gamesWithInjuries.length > 0) {
      for (const game of gamesWithInjuries) {
        if (game.game_id && game.teammates_out && game.teammates_out.length > 0) {
          const normalizedId = String(game.game_id).replace(/^0+/, "");
          const playerIds = new Set(game.teammates_out.map(t => t.player_id));
          map.set(normalizedId, playerIds);
        }
      }
    } else {
      // Fallback to gameLogs from profile if injury data not yet loaded
      const gameLogs = profile.gameLogs as Array<{ game_id?: string; teammates_out?: Array<{ player_id: number }> }> | null;
      if (gameLogs) {
        for (const log of gameLogs) {
          if (log.game_id && log.teammates_out) {
            const normalizedId = log.game_id.replace(/^0+/, "");
            const playerIds = new Set(log.teammates_out.map(t => t.player_id));
            map.set(normalizedId, playerIds);
          }
        }
      }
    }
    
    return map;
  }, [gamesWithInjuries, profile.gameLogs]);

  // Helper function to apply quick filters
  const applyQuickFilters = (games: typeof boxScoreGames) => {
    if (quickFilters.size === 0) return games;
    
    return games.filter(game => {
      // Home/Away
      if (quickFilters.has("home") && game.homeAway !== "H") return false;
      if (quickFilters.has("away") && game.homeAway !== "A") return false;
      
      // Win/Loss
      if (quickFilters.has("win") && game.result !== "W") return false;
      if (quickFilters.has("loss") && game.result !== "L") return false;
      
      // Win by 10+ / Lost by 10+
      const margin = parseInt(String(game.margin)) || 0;
      if (quickFilters.has("wonBy10") && (game.result !== "W" || margin < 10)) return false;
      if (quickFilters.has("lostBy10") && (game.result !== "L" || Math.abs(margin) < 10)) return false;
      
      // Primetime (nationally televised) - check if field exists
      if (quickFilters.has("primetime") && !(game as any).nationalBroadcast) return false;
      
      return true;
    });
  };

  // Helper function to apply injury filters
  const applyInjuryFilters = (games: typeof boxScoreGames) => {
    if (injuryFilters.length === 0) return games;
    
    return games.filter(game => {
      const gameIdStr = game.gameId ? String(game.gameId) : "";
      const normalizedGameId = gameIdStr.replace(/^0+/, "");
      const playersOutThisGame = teammatesOutByGame.get(normalizedGameId) || new Set<number>();
      
      for (const filter of injuryFilters) {
        const wasPlayerOut = playersOutThisGame.has(filter.playerId);
        
        if (filter.mode === "with") {
          // "With" = player was playing (NOT out) 
          if (wasPlayerOut) return false;
        } else if (filter.mode === "without") {
          // "Without" = player was out
          if (!wasPlayerOut) return false;
        }
      }
      return true;
    });
  };

  // Helper function to apply game count/H2H filter
  const applyGameCountFilter = (games: typeof boxScoreGames) => {
    let result = games;
    
    // Filter by opponent if H2H is selected
    if (gameCount === "h2h" && profile.opponentTeamAbbr) {
      result = result.filter(game => game.opponentAbbr === profile.opponentTeamAbbr);
    }
    
    // Limit by game count (not for season or h2h which show all matching games)
    if (gameCount !== "season" && gameCount !== "h2h") {
      result = result.slice(0, gameCount);
    }
    
    return result;
  };

  // Games for ChartFilters histograms - applies quick + injury filters but NOT chart filters
  // This way when you filter "without Sam Merrill", the histogram shows only those games
  const gamesForChartFilters = useMemo(() => {
    if (boxScoreGames.length === 0) return [];
    
    let games = [...boxScoreGames];
    games = applyQuickFilters(games);
    games = applyInjuryFilters(games);
    games = applyGameCountFilter(games);
    
    return games;
  }, [boxScoreGames, gameCount, quickFilters, injuryFilters, teammatesOutByGame, profile.opponentTeamAbbr]);

  // Filter games based on quick filters, chart filters, injury filters, THEN limit by game count
  // This way "L5 + Win" shows the last 5 wins, not wins from the last 5 games
  const filteredGames = useMemo(() => {
    if (boxScoreGames.length === 0) return [];
    
    let games = [...boxScoreGames];
    
    // Apply quick filters
    games = applyQuickFilters(games);
    
    // Apply chart filters
    games = applyChartFilters(games, chartFilters);
    
    // Apply injury filters
    games = applyInjuryFilters(games);
    
    // Apply game count filter
    games = applyGameCountFilter(games);
    
    return games;
  }, [boxScoreGames, gameCount, quickFilters, chartFilters, injuryFilters, teammatesOutByGame, profile.opponentTeamAbbr]);

  // Get stat value from a game based on market
  const getMarketStat = (game: typeof boxScoreGames[0], market: string): number => {
    switch (market) {
      case "player_points": return game.pts;
      case "player_rebounds": return game.reb;
      case "player_assists": return game.ast;
      case "player_threes_made": return game.fg3m;
      case "player_steals": return game.stl;
      case "player_blocks": return game.blk;
      case "player_turnovers": return game.tov;
      case "player_points_rebounds_assists": return game.pra;
      case "player_points_rebounds": return game.pr;
      case "player_points_assists": return game.pa;
      case "player_rebounds_assists": return game.ra;
      case "player_blocks_steals": return game.bs;
      default: return game.pts;
    }
  };

  // The active line (custom or profile default)
  const activeLine = customLine ?? profile.line;

  // Calculate dynamic hit rates for L5, L10, L20, Season, H2H based on activeLine
  // This recalculates when the user changes the line
  const dynamicHitRates = useMemo(() => {
    if (boxScoreGames.length === 0 || activeLine === null) {
      return {
        l5: profile.last5Pct,
        l10: profile.last10Pct,
        l20: profile.last20Pct,
        season: profile.seasonPct,
        h2h: profile.h2hPct,
      };
    }
    
    // If no custom line or custom line equals original, use profile values
    if (customLine === null || customLine === profile.line) {
      return {
        l5: profile.last5Pct,
        l10: profile.last10Pct,
        l20: profile.last20Pct,
        season: profile.seasonPct,
        h2h: profile.h2hPct,
      };
    }
    
    // Recalculate with custom line
    const calculateHitRate = (games: typeof boxScoreGames) => {
      if (games.length === 0) return null;
      const stats = games.map(g => getMarketStat(g, profile.market));
      const hits = stats.filter(s => s >= activeLine).length;
      return Math.round((hits / stats.length) * 100);
    };
    
    // Sort games by date descending for L5, L10, L20
    const sortedGames = [...boxScoreGames].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // H2H games against current opponent
    const h2hGames = boxScoreGames.filter(g => g.opponentAbbr === profile.opponentTeamAbbr);
    
    return {
      l5: calculateHitRate(sortedGames.slice(0, 5)),
      l10: calculateHitRate(sortedGames.slice(0, 10)),
      l20: calculateHitRate(sortedGames.slice(0, 20)),
      season: calculateHitRate(boxScoreGames),
      h2h: calculateHitRate(h2hGames),
    };
  }, [boxScoreGames, activeLine, customLine, profile.line, profile.last5Pct, profile.last10Pct, profile.last20Pct, profile.seasonPct, profile.h2hPct, profile.market, profile.opponentTeamAbbr]);

  // Calculate hit rates for ALL markets based on FILTERED games
  // This allows the market selector to show dynamic hit rates that reflect active filters
  // Uses activeLine for the currently selected market (to reflect custom line changes)
  const marketHitRates = useMemo(() => {
    if (boxScoreGames.length === 0) return new Map<string, MarketHitRateData>();
    
    const rates = new Map<string, MarketHitRateData>();
    
    // Expected total based on game count filter
    const expectedTotal = gameCount === "season" 
      ? boxScoreGames.length 
      : gameCount === "h2h" 
        ? boxScoreGames.filter(g => g.opponentAbbr === profile.opponentTeamAbbr).length
        : Math.min(gameCount as number, boxScoreGames.length);
    
    // Use filtered games for accurate hit rate calculation
    const gamesToUse = filteredGames;
    
    for (const marketProfile of allPlayerProfiles) {
      // Use activeLine for the selected market, otherwise use the profile's line
      const isSelectedMarket = marketProfile.market === selectedMarket;
      const line = isSelectedMarket ? activeLine : marketProfile.line;
      
      if (line === null || gamesToUse.length === 0) {
        rates.set(marketProfile.market, { hitRate: null, hits: 0, total: gamesToUse.length, expectedTotal });
        continue;
      }
      
      const stats = gamesToUse.map(g => getMarketStat(g, marketProfile.market));
      const hits = stats.filter(s => s >= line).length;
      const hitRate = stats.length > 0 ? (hits / stats.length) * 100 : null;
      rates.set(marketProfile.market, { 
        hitRate: hitRate !== null ? Math.round(hitRate) : null, 
        hits, 
        total: stats.length,
        expectedTotal
      });
    }
    
    return rates;
  }, [boxScoreGames, filteredGames, gameCount, allPlayerProfiles, profile.opponentTeamAbbr, selectedMarket, activeLine]);

  // Calculate chart stats (for filtered games)
  // Always calculate average even if no line, but only calculate hit rate if line exists
  const chartStats = useMemo(() => {
    if (filteredGames.length === 0) {
      return { avg: null, hitRate: null, hits: 0, total: 0 };
    }
    
    const stats = filteredGames.map(g => getMarketStat(g, profile.market));
    const avg = stats.reduce((a, b) => a + b, 0) / stats.length;
    
    // Only calculate hit rate if we have a line
    if (activeLine === null) {
      return {
        avg: Math.round(avg * 10) / 10,
        hitRate: null,
        hits: 0,
        total: stats.length,
      };
    }
    
    // >= so that hitting exactly the line counts as a hit (e.g., 1 block when line is 1)
    const hits = stats.filter(s => s >= activeLine).length;
    const hitRate = (hits / stats.length) * 100;
    
    return {
      avg: Math.round(avg * 10) / 10,
      hitRate: Math.round(hitRate),
      hits,
      total: stats.length,
    };
  }, [filteredGames, profile.market, activeLine]);

  return (
    <div ref={scrollContainerRef} className="h-full overflow-auto pr-3 drilldown-scroll">
      {/* ═══════════════════════════════════════════════════════════════════
          STICKY PLAYER HEADER - Unified Two-Section Card
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 -mx-3 px-3 pb-4 pt-1 bg-gradient-to-b from-white via-white to-white/95 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-950/95 backdrop-blur-sm">
        <div 
          className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm"
          style={{ 
            background: profile.primaryColor 
              ? `linear-gradient(135deg, ${profile.primaryColor}08 0%, transparent 50%)`
              : undefined
          }}
        >
          <div className="flex items-stretch">
            {/* ════════════════════════════════════════════════════════════════
                LEFT SECTION - Identity Cluster
                ════════════════════════════════════════════════════════════════ */}
            <div className="flex-1 flex items-center gap-5 p-4 bg-white/50 dark:bg-neutral-900/50">
              {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
                className="p-2 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Player Headshot */}
          <div 
                className="h-[72px] w-[72px] rounded-xl overflow-hidden shadow-lg shrink-0 ring-2 ring-white dark:ring-neutral-800"
            style={{ 
              background: profile.primaryColor && profile.secondaryColor 
                ? `linear-gradient(180deg, ${profile.primaryColor} 0%, ${profile.secondaryColor} 100%)`
                : profile.primaryColor || '#374151'
            }}
          >
            <PlayerHeadshot
              nbaPlayerId={profile.playerId}
              name={profile.playerName}
              size="small"
              className="h-full w-full object-cover"
            />
          </div>

              {/* Player Info Stack */}
              <div className="flex flex-col gap-1">
                {/* Name + Injury Icon */}
            <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">
                {profile.playerName}
              </h1>
                  {profile.injuryStatus && 
                   profile.injuryStatus.toLowerCase() !== "available" && 
                   profile.injuryStatus.toLowerCase() !== "active" && (() => {
                    const isGLeague = profile.injuryNotes?.toLowerCase().includes("g league") || 
                                      profile.injuryNotes?.toLowerCase().includes("g-league") ||
                                      profile.injuryNotes?.toLowerCase().includes("gleague");
                    return (
                    <Tooltip 
                      content={
                        <div className="min-w-[160px] p-1">
                          <div className="flex items-center gap-2 mb-1">
                            {isGLeague ? (
                              <ArrowDown className="h-4 w-4 text-blue-400" />
                            ) : (
                              <HeartPulse className={cn("h-4 w-4", getInjuryIconColor(profile.injuryStatus))} />
                            )}
                            <span className={cn(
                              "text-sm font-bold uppercase tracking-wide",
                              isGLeague ? "text-blue-400" : getInjuryIconColor(profile.injuryStatus)
                            )}>
                              {isGLeague ? "G League" : profile.injuryStatus}
              </span>
            </div>
                          {profile.injuryNotes && (
                            <p className="text-xs text-neutral-300 leading-relaxed">
                              {profile.injuryNotes}
                            </p>
                          )}
                        </div>
                      }
                      side="right"
                    >
                      {isGLeague ? (
                        <ArrowDown className="h-5 w-5 cursor-help text-blue-500" />
                      ) : (
                        <HeartPulse className={cn(
                          "h-5 w-5 cursor-help",
                          getInjuryIconColor(profile.injuryStatus)
                        )} />
                      )}
                    </Tooltip>
                    );
                  })()}
                </div>
                
                {/* Position + Jersey + Team */}
                <div className="flex items-center gap-2 text-sm">
                  <Tooltip content={getPositionLabel(profile.position)} side="bottom">
                    <span className="font-medium text-neutral-600 dark:text-neutral-400 cursor-help">
                      {profile.position}
                    </span>
                  </Tooltip>
                  <span className="text-neutral-300 dark:text-neutral-600">•</span>
                  <span className="font-medium text-neutral-600 dark:text-neutral-400">
                    #{profile.jerseyNumber ?? "—"}
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-600">•</span>
                  {profile.teamAbbr && (
                    <div className="flex items-center gap-1.5">
                      <img
                        src={`/team-logos/nba/${profile.teamAbbr.toUpperCase()}.svg`}
                        alt={profile.teamAbbr}
                        className="h-4 w-4 object-contain"
                      />
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        {profile.teamAbbr}
              </span>
            </div>
                  )}
                </div>
                
                {/* Matchup + Game Time */}
                <div className="flex items-center gap-2 text-sm mt-0.5">
                  {/* Matchup with logos */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800">
                    {profile.teamAbbr && (
                      <img
                        src={`/team-logos/nba/${profile.teamAbbr.toUpperCase()}.svg`}
                        alt={profile.teamAbbr}
                        className="h-4 w-4 object-contain"
                      />
                    )}
                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                      {profile.homeAway === "H" ? "vs" : "@"}
                    </span>
              {profile.opponentTeamAbbr && (
                <img
                  src={`/team-logos/nba/${profile.opponentTeamAbbr.toUpperCase()}.svg`}
                  alt={profile.opponentTeamAbbr}
                  className="h-4 w-4 object-contain"
                />
              )}
                    <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      {profile.opponentTeamAbbr}
                    </span>
                  </div>
                  {/* Game Time */}
                  <span className="text-xs text-neutral-500 dark:text-neutral-500">
                    {profile.gameStatus}
                  </span>
            </div>
          </div>
        </div>

            {/* ════════════════════════════════════════════════════════════════
                RIGHT SECTION - Two Row Premium Layout
                ════════════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-3 pl-6 pr-4 py-3 border-l border-neutral-200 dark:border-neutral-800">
              {/* ROW 1: Primary Prop Chip */}
              <div className="flex items-center gap-3">
                {/* Main Prop Chip - Hero Element */}
                <Tooltip 
                  content={
                    <div className="text-center p-1">
                      <div className="font-semibold text-neutral-100">Click to edit line</div>
                      <div className="text-xs text-neutral-400 mt-0.5">Or drag the chart line to adjust</div>
                    </div>
                  } 
                  side="bottom"
                >
                  <div 
                    className={cn(
                      "relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer",
                      customLine !== null && customLine !== profile.line
                        ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900" 
                        : "hover:shadow-xl hover:scale-[1.02]"
                    )}
                    style={{ 
                      backgroundColor: profile.primaryColor || '#6366f1',
                    }}
                    onClick={() => {
                      if (!isEditingLine) {
                        setEditValue(String(activeLine ?? profile.line ?? ""));
                        setIsEditingLine(true);
                      }
                    }}
                  >
                    {/* Line + Market */}
                    {isEditingLine ? (
                      <input
                        type="number"
                        step="0.5"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                          const parsed = parseFloat(editValue);
                          if (!isNaN(parsed) && parsed >= 0 && parsed !== profile.line) {
                            setCustomLine(parsed);
                          } else if (parsed === profile.line) {
                            setCustomLine(null);
                          }
                          setIsEditingLine(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const parsed = parseFloat(editValue);
                            if (!isNaN(parsed) && parsed >= 0 && parsed !== profile.line) {
                              setCustomLine(parsed);
                            } else if (parsed === profile.line) {
                              setCustomLine(null);
                            }
                            setIsEditingLine(false);
                          } else if (e.key === "Escape") {
                            setIsEditingLine(false);
                          }
                        }}
                        autoFocus
                        className="w-16 text-lg font-black text-center bg-white/20 text-white rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-white/50 placeholder-white/50"
                        placeholder="0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-lg font-black text-white tracking-tight">
                        {activeLine}+ {formatMarketLabel(profile.market)}
                </span>
                    )}
                    
                    {/* Pencil Icon - after market name */}
                    {!isEditingLine && (
                      <Pencil className="h-3.5 w-3.5 text-white/50" />
                    )}
                    
                    {/* Reset button - only show if custom line is different from original */}
                    {customLine !== null && customLine !== profile.line && !isEditingLine && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomLine(null);
                        }}
                        className="ml-1 p-0.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        title={`Reset to ${profile.line}`}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    )}
                  </div>
                </Tooltip>
                
                {/* Odds Section */}
                <div className="flex items-center gap-2">
                  {/* Over Odds */}
                  {oddsForChart?.bestOver ? (
                    <button
                      type="button"
                      onClick={() => oddsForChart.bestOver?.mobileUrl && window.open(oddsForChart.bestOver.mobileUrl, "_blank", "noopener,noreferrer")}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-brand/40 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-all cursor-pointer"
                    >
                      {(() => {
                        const sb = getSportsbookById(oddsForChart.bestOver.book);
                        return sb?.image?.light ? (
                          <img src={sb.image.light} alt={sb.name} className="h-4 w-4 object-contain" />
                        ) : (
                          <span className="text-[10px] font-medium text-neutral-500">{oddsForChart.bestOver.book}</span>
                        );
                      })()}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">O</span>
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          oddsForChart.bestOver.price > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                        )}>
                          {oddsForChart.bestOver.price > 0 ? `+${oddsForChart.bestOver.price}` : oddsForChart.bestOver.price}
                </span>
              </div>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">O</span>
                      <span className="text-sm font-bold tabular-nums text-neutral-400 dark:text-neutral-500">—</span>
                    </div>
                  )}
                  
                  {/* Under Odds */}
                  {oddsForChart?.bestUnder ? (
                    <button
                      type="button"
                      onClick={() => oddsForChart.bestUnder?.mobileUrl && window.open(oddsForChart.bestUnder.mobileUrl, "_blank", "noopener,noreferrer")}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-brand/40 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-all cursor-pointer"
                    >
                      {(() => {
                        const sb = getSportsbookById(oddsForChart.bestUnder.book);
                        return sb?.image?.light ? (
                          <img src={sb.image.light} alt={sb.name} className="h-4 w-4 object-contain" />
                        ) : (
                          <span className="text-[10px] font-medium text-neutral-500">{oddsForChart.bestUnder.book}</span>
                        );
                      })()}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">U</span>
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          oddsForChart.bestUnder.price > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300"
                        )}>
                          {oddsForChart.bestUnder.price > 0 ? `+${oddsForChart.bestUnder.price}` : oddsForChart.bestUnder.price}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">U</span>
                      <span className="text-sm font-bold tabular-nums text-neutral-400 dark:text-neutral-500">—</span>
                    </div>
                  )}
                </div>
          </div>

              {/* ROW 2: Hit Rate Strip - Flat, Subordinate - Uses dynamicHitRates for custom line */}
              <div className="flex items-center gap-0.5">
                {[
                  { label: "L5", value: dynamicHitRates.l5, count: 5 as const },
                  { label: "L10", value: dynamicHitRates.l10, count: 10 as const },
                  { label: "L20", value: dynamicHitRates.l20, count: 20 as const },
                  { label: "SZN", value: dynamicHitRates.season, count: "season" as const },
                  { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" as const },
                ].map((stat, idx) => {
                  const isSelected = gameCount === stat.count;
                  return (
                    <React.Fragment key={stat.label}>
                      {idx > 0 && (
                        <span className="text-neutral-300 dark:text-neutral-600 px-1">|</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setGameCount(stat.count)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all cursor-pointer",
                          isSelected 
                            ? "bg-brand/10 dark:bg-brand/15" 
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        )}
                      >
                        <span className={cn(
                          "text-[11px] font-semibold tabular-nums",
                          isSelected ? "text-brand" : "text-neutral-400 dark:text-neutral-500"
                        )}>
                          {stat.label}
            </span>
                        <span className={cn(
                          "text-[11px] font-bold tabular-nums",
                          isSelected 
                            ? getPctColor(stat.value)
                            : stat.value !== null && stat.value >= 70 
                              ? "text-emerald-600/70 dark:text-emerald-400/70" 
                              : stat.value !== null && stat.value >= 50 
                                ? "text-amber-600/70 dark:text-amber-400/70" 
                                : "text-red-500/70 dark:text-red-400/70"
                        )}>
                          {stat.value != null ? `${stat.value.toFixed(0)}%` : "—"}
            </span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
            MARKET SELECTOR STRIP - Inside sticky header
          ═══════════════════════════════════════════════════════════════════ */}
        {sortedMarkets.length > 1 && (
          <MarketSelectorStrip 
            sortedMarkets={sortedMarkets}
            selectedMarket={selectedMarket}
            setSelectedMarket={setSelectedMarket}
            marketHitRates={marketHitRates}
            customLine={customLine}
            quickFilters={quickFilters}
            chartFilters={chartFilters}
            injuryFilters={injuryFilters}
            onClearAllFilters={() => {
              setQuickFilters(new Set());
              setChartFilters(DEFAULT_FILTERS);
              setInjuryFilters([]);
            }}
            onRemoveQuickFilter={(filter) => {
              const newFilters = new Set(quickFilters);
              newFilters.delete(filter);
              setQuickFilters(newFilters);
            }}
            onRemoveInjuryFilter={(playerId) => {
              setInjuryFilters(injuryFilters.filter(f => f.playerId !== playerId));
            }}
          />
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - BAR CHART (Premium Design)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden shadow-sm">
        {/* Header - Premium Design */}
        <div className="relative overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100/50 dark:from-neutral-800/50 dark:via-neutral-800/30 dark:to-neutral-800/50" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
          
          {/* Content */}
          <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
                  <div className="h-10 w-1 rounded-full bg-gradient-to-b from-blue-500 to-blue-600" />
                  <div>
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
              Game Log
            </h2>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                      Performance history & trends
                    </p>
                  </div>
                </div>
                
                {/* Game Count Filter - Premium Pills */}
                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-700/50 rounded-lg p-0.5 ml-2">
              {([5, 10, 20, "season"] as GameCountFilter[]).map((count) => {
                    const numericCount = count === "season" ? totalGamesAvailable : (typeof count === 'number' ? count : 0);
                const isDisabled = numericCount > totalGamesAvailable;
                const displayCount = count === "season" 
                  ? `All (${totalGamesAvailable})` 
                  : `L${count}`;
                
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => !isDisabled && setGameCount(count)}
                    disabled={isDisabled}
                    className={cn(
                          "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                      gameCount === count
                            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-600/50"
                        : isDisabled
                          ? "text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                    )}
                  >
                    {displayCount}
                  </button>
                );
              })}
            </div>
          </div>
          
              {/* Chart Stats - Premium Cards */}
              <div className="flex items-center gap-3">
                {/* Chart Average */}
                <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                    Avg
                  </span>
                  <span className={cn(
                    "text-lg font-bold tabular-nums",
                    chartStats.avg !== null && activeLine !== null
                      ? chartStats.avg > activeLine
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-neutral-900 dark:text-white"
                      : "text-neutral-900 dark:text-white"
                  )}>
                    {chartStats.avg?.toFixed(1) ?? "—"}
                  </span>
                </div>

                {/* Chart Hit Rate */}
                <div className={cn(
                  "flex flex-col items-center px-4 py-2 rounded-lg ring-1",
                  chartStats.hitRate !== null
                    ? chartStats.hitRate >= 70
                      ? "bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200/50 dark:ring-emerald-700/50"
                      : chartStats.hitRate >= 50
                        ? "bg-amber-50 dark:bg-amber-900/20 ring-amber-200/50 dark:ring-amber-700/50"
                        : "bg-red-50 dark:bg-red-900/20 ring-red-200/50 dark:ring-red-700/50"
                    : "bg-neutral-50 dark:bg-neutral-700/30 ring-neutral-200/50 dark:ring-neutral-700/50"
                )}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                    Hit Rate
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-lg font-bold tabular-nums",
                      chartStats.hitRate !== null
                        ? chartStats.hitRate >= 70
                          ? "text-emerald-600 dark:text-emerald-400"
                          : chartStats.hitRate >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-500 dark:text-red-400"
                        : "text-neutral-900 dark:text-white"
                    )}>
                      {chartStats.hitRate !== null ? `${chartStats.hitRate}%` : "—"}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                      {chartStats.hits}/{chartStats.total}
                    </span>
                  </div>
                </div>

                {/* Season Avg */}
                <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                    Season
                  </span>
                  <span className="text-lg font-bold text-neutral-600 dark:text-neutral-300 tabular-nums">
              {profile.seasonAvg?.toFixed(1) ?? "—"}
            </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bar Chart Content */}
        <div className="p-5">
        {boxScoresLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="h-6 w-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                <span className="text-sm text-neutral-500">Loading game data...</span>
              </div>
          </div>
        ) : (
          <GameLogChart
            games={filteredGames}
              line={customLine ?? profile.line}
            market={profile.market}
            profileGameLogs={profile.gameLogs as any}
              onLineChange={setCustomLine}
              quickFilters={quickFilters}
              onQuickFilterToggle={toggleQuickFilter}
              onQuickFiltersClear={() => setQuickFilters(new Set())}
              odds={oddsForChart}
            />
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CHART FILTERS - Scrollable mini charts (Premium Design)
          ═══════════════════════════════════════════════════════════════════ */}
      {!boxScoresLoading && boxScoreGames.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100/50 dark:from-neutral-800/50 dark:via-neutral-800/30 dark:to-neutral-800/50" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-purple-500/5 via-transparent to-transparent" />
            <div className="relative px-5 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-1 rounded-full bg-gradient-to-b from-purple-500 to-purple-600" />
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                      Advanced Filters
                    </h2>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                      Filter by performance metrics
                    </p>
                  </div>
                </div>
                
                {/* View Toggle Button */}
              <button
                type="button"
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                    filtersExpanded
                      ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400"
                      : "bg-neutral-100 dark:bg-neutral-700/50 border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-500"
                  )}
                >
                  {filtersExpanded ? (
                    <>
                      <LayoutList className="h-3.5 w-3.5" />
                      <span>Scroll View</span>
                    </>
                  ) : (
                    <>
                      <Grid3X3 className="h-3.5 w-3.5" />
                      <span>View All</span>
                    </>
                  )}
              </button>
          </div>
        </div>
      </div>
          <div className="p-5">
            <ChartFilters
              games={gamesForChartFilters}
              filters={chartFilters}
              onFiltersChange={setChartFilters}
              market={profile.market}
              isExpanded={filtersExpanded}
              onExpandedChange={setFiltersExpanded}
              hideControls={true}
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TEAM ROSTERS & INJURIES (Combined)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <RosterAndInjuries
          playerTeamId={profile.teamId}
          opponentTeamId={profile.opponentTeamId}
          currentPlayerId={profile.playerId}
          filters={injuryFilters}
          onFiltersChange={setInjuryFilters}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MATCHUP ANALYSIS - Two Column Layout (Defense vs Position)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Defensive Analysis */}
        <DefensiveAnalysis
          playerId={profile.playerId}
          opponentTeamId={profile.opponentTeamId}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          position={profile.position}
        />

        {/* Right Column: Position vs Team Game Log */}
        <PositionVsTeam
          position={profile.position}
          opponentTeamId={profile.opponentTeamId}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          market={profile.market}
          currentLine={profile.line}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PLAY TYPE & SHOOTING ZONES - Two Column Layout
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Play Type Analysis */}
        <PlayTypeAnalysis
          playerId={profile.playerId}
          opponentTeamId={profile.opponentTeamId}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          playerName={profile.playerName}
        />
        
        {/* Right Column: Shooting Zones */}
        <ShootingZones
          playerId={profile.playerId}
          opponentTeamId={profile.opponentTeamId}
          playerName={profile.playerName}
          opponentTeamAbbr={profile.opponentTeamAbbr}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PLAYER CORRELATIONS (Teammate Analysis)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <PlayerCorrelations
          playerId={profile.playerId}
          market={profile.market}
          line={activeLine}
          gameId={profile.gameId}
          playerName={profile.playerName}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ALTERNATE LINES MATRIX
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <AlternateLinesMatrix
          stableKey={profile.oddsSelectionId}
          playerId={profile.playerId}
          market={profile.market}
          originalLine={profile.line}
          activeLine={activeLine}
          onLineSelect={(line) => {
            // If selecting the original line, clear custom line
            if (line === profile.line) {
              setCustomLine(null);
            } else {
              setCustomLine(line);
            }
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOX SCORE TABLE (Full Game Log)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <BoxScoreTable
          playerId={profile.playerId}
          market={profile.market}
          currentLine={profile.line}
          prefetchedGames={boxScoreGames}
          prefetchedSeasonSummary={seasonSummary}
        />
      </div>
    </div>
  );
}
