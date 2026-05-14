"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  HeartPulse,
  X,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  LayoutList,
  ArrowDown,
} from "lucide-react";
import { PlayerHeadshot } from "@/components/player-headshot";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { AlternateLinesMatrix } from "./alternate-lines-matrix";
import { PlayerCorrelations } from "./player-correlations";
import { PositionVsTeam } from "./position-vs-team";
import { DefensiveAnalysis } from "./defensive-analysis";
import { GameLogChart } from "./game-log-chart";
import { TeamRoster } from "./team-roster";
import { BoxScoreTable } from "./box-score-table";
import {
  ChartFilters,
  ChartFiltersState,
  DEFAULT_FILTERS,
  applyChartFilters,
} from "./chart-filters";
import {
  FilterDrawer,
  FilterButton,
  PlayTypeFilter,
  ShotZoneFilter,
} from "./filter-drawer";
import { ShareChartButton } from "./share-chart-button";
import { RosterAndInjuries, InjuryFilter } from "./roster-and-injuries";
import {
  InjuryReportTooltipContent,
  isGLeagueAssignment,
} from "./injury-report-tooltip";
import { PlayTypeAnalysis } from "./play-type-analysis";
import { ShootingZones } from "./shooting-zones";
import { BasketballShotLocationMap } from "./basketball-shot-location-map";
import { type HeaderGameCountFilter } from "@/components/hit-rates/header-hit-rate-strip";
import {
  DrilldownHeaderRightPanel,
  type HeaderOddsCardConfig,
} from "@/components/hit-rates/header-right-panel";
import { usePlayerBoxScores } from "@/hooks/use-player-box-scores";
import { useStateLink } from "@/hooks/use-state-link";
import {
  usePlayerGamesWithInjuries,
  usePlayersOutForFilter,
} from "@/hooks/use-injury-context";
import { useDvpRankings } from "@/hooks/use-dvp-rankings";
import { useTeamRoster } from "@/hooks/use-team-roster";
import { usePlayTypeMatchup } from "@/hooks/use-play-type-matchup";
import { useShotZoneMatchup } from "@/hooks/use-shot-zone-matchup";
import { useTeamPlayTypeRanks } from "@/hooks/use-team-play-type-ranks";
import { useTeamShotZoneRanks } from "@/hooks/use-team-shot-zone-ranks";
import { Tooltip } from "@/components/tooltip";
import {
  useFavorites,
  type AddFavoriteParams,
  type BookSnapshot,
} from "@/hooks/use-favorites";
import { useOddsLine } from "@/hooks/use-odds-line";

// Injury status color helpers
const getInjuryIconColor = (status: string | null): string => {
  if (!status) return "text-amber-500";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision")
    return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "text-amber-500"; // fallback
};

// Position labels for display
const POSITION_LABELS: Record<string, string> = {
  PG: "Point Guard",
  SG: "Shooting Guard",
  SF: "Small Forward",
  PF: "Power Forward",
  C: "Center",
  G: "Guard",
  F: "Forward",
  GF: "Guard-Forward",
  FC: "Forward-Center",
};

const getPositionLabel = (position: string | null): string => {
  if (!position) return "Unknown";
  return POSITION_LABELS[position] || position;
};

type GameCountFilter = HeaderGameCountFilter;

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
  sport?: "nba" | "wnba";
}

// Format percentage with color class
const getPctColor = (value: number | null) => {
  if (value === null) return "text-neutral-500";
  if (value >= 70) return "text-emerald-500";
  if (value >= 50) return "text-amber-500";
  return "text-red-500";
};

// Market hit rate data structure
export interface MarketHitRateData {
  hitRate: number | null;
  hits: number;
  total: number;
  expectedTotal: number;
}

// Quick filter labels for display
const QUICK_FILTER_LABELS: Record<string, string> = {
  home: "Home",
  away: "Away",
  wins: "Wins",
  losses: "Losses",
  "30min": "30+ Min",
  primetime: "Primetime",
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
  playTypeFilters?: PlayTypeFilter[];
  shotZoneFilters?: ShotZoneFilter[];
  onClearAllFilters: () => void;
  onRemoveQuickFilter: (filter: string) => void;
  onRemoveInjuryFilter: (playerId: number) => void;
  onRemovePlayTypeFilter?: (playType: string) => void;
  onRemoveShotZoneFilter?: (zone: string) => void;
  // Sample size
  filteredGamesCount?: number;
  totalGamesCount?: number;
}

export function MarketSelectorStrip({
  sortedMarkets,
  selectedMarket,
  setSelectedMarket,
  marketHitRates,
  customLine,
  quickFilters,
  chartFilters,
  injuryFilters,
  playTypeFilters = [],
  shotZoneFilters = [],
  onClearAllFilters,
  onRemoveQuickFilter,
  onRemoveInjuryFilter,
  onRemovePlayTypeFilter,
  onRemoveShotZoneFilter,
  filteredGamesCount,
  totalGamesCount,
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
    <div className="relative mt-3 border-t border-neutral-200/60 pt-3 dark:border-neutral-700/60">
      <div className="relative px-1">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            type="button"
            onClick={scrollLeft}
            className="absolute top-1/2 -left-1 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-lg transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <ChevronLeft className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto px-6"
        >
          {sortedMarkets.map((marketProfile, idx) => {
            const isActive = marketProfile.market === selectedMarket;
            // Use dynamic hit rate based on filtered games
            const rateData = marketHitRates.get(marketProfile.market);
            const hitRate = rateData?.hitRate ?? marketProfile.last10Pct;
            const isFilteredSample =
              rateData && rateData.total < rateData.expectedTotal;

            // Show custom line if this is the selected market and customLine is set
            const displayLine =
              isActive && customLine !== null ? customLine : marketProfile.line;
            const hasCustomLine =
              isActive &&
              customLine !== null &&
              customLine !== marketProfile.line;

            return (
              <button
                key={`${marketProfile.market}-${idx}`}
                type="button"
                onClick={() => setSelectedMarket(marketProfile.market)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 transition-all",
                  isActive
                    ? "border-neutral-300 bg-white shadow-sm dark:border-neutral-600 dark:bg-neutral-800"
                    : "border-neutral-200/60 bg-neutral-100/50 hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:hover:border-neutral-600 dark:hover:bg-neutral-800",
                )}
              >
                {/* Line + Market */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      isActive
                        ? "text-neutral-900 dark:text-white"
                        : "text-neutral-600 dark:text-neutral-400",
                      hasCustomLine && "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {displayLine}+
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium uppercase",
                      isActive
                        ? "text-neutral-700 dark:text-neutral-300"
                        : "text-neutral-500 dark:text-neutral-500",
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
                        "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                        hitRate !== null && hitRate >= 70
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : hitRate !== null && hitRate >= 50
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
                      )}
                    >
                      {hitRate !== null ? `${hitRate}%` : "—"}
                    </span>
                    {/* Show sample size when filtered */}
                    {isFilteredSample && (
                      <span className="text-[10px] font-medium text-neutral-400 tabular-nums dark:text-neutral-500">
                        {rateData.hits}/{rateData.total}
                      </span>
                    )}
                  </div>
                ) : hitRate !== null ? (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                      hitRate >= 70
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : hitRate >= 50
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
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
            className="absolute top-1/2 -right-1 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-lg transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
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
        playTypeFilters={playTypeFilters}
        shotZoneFilters={shotZoneFilters}
        onClearAll={onClearAllFilters}
        onRemoveQuickFilter={onRemoveQuickFilter}
        onRemoveInjuryFilter={onRemoveInjuryFilter}
        onRemovePlayTypeFilter={onRemovePlayTypeFilter}
        onRemoveShotZoneFilter={onRemoveShotZoneFilter}
        filteredGamesCount={filteredGamesCount}
        totalGamesCount={totalGamesCount}
      />
    </div>
  );
}

// Active Filters Bar Component - Shows active filters with remove buttons
interface ActiveFiltersBarProps {
  quickFilters: Set<string>;
  chartFilters: ChartFiltersState;
  injuryFilters: InjuryFilter[];
  playTypeFilters?: PlayTypeFilter[];
  shotZoneFilters?: ShotZoneFilter[];
  onClearAll: () => void;
  onRemoveQuickFilter: (filter: string) => void;
  onRemoveInjuryFilter: (playerId: number) => void;
  onRemovePlayTypeFilter?: (playType: string) => void;
  onRemoveShotZoneFilter?: (zone: string) => void;
  // Sample size info
  filteredGamesCount?: number;
  totalGamesCount?: number;
}

function ActiveFiltersBar({
  quickFilters,
  chartFilters,
  injuryFilters,
  playTypeFilters = [],
  shotZoneFilters = [],
  onClearAll,
  onRemoveQuickFilter,
  onRemoveInjuryFilter,
  onRemovePlayTypeFilter,
  onRemoveShotZoneFilter,
  filteredGamesCount,
  totalGamesCount,
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

  const hasActiveFilters =
    quickFilters.size > 0 ||
    activeChartFiltersCount > 0 ||
    injuryFilters.length > 0 ||
    playTypeFilters.length > 0 ||
    shotZoneFilters.length > 0;

  if (!hasActiveFilters) return null;

  return (
    <div className="mt-2 border-t border-neutral-200/40 pt-2 dark:border-neutral-700/40">
      <div className="flex flex-wrap items-center gap-2">
        {/* Sample Size Info - Muted, left side */}
        {filteredGamesCount !== undefined &&
          totalGamesCount !== undefined &&
          filteredGamesCount < totalGamesCount && (
            <span className="text-[10px] font-medium text-neutral-400 tabular-nums dark:text-neutral-500">
              Showing {filteredGamesCount} of {totalGamesCount} games
            </span>
          )}

        {/* Divider */}
        {filteredGamesCount !== undefined &&
          totalGamesCount !== undefined &&
          filteredGamesCount < totalGamesCount && (
            <span className="text-neutral-300 dark:text-neutral-600">·</span>
          )}

        {/* Quick Filters */}
        {Array.from(quickFilters).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onRemoveQuickFilter(filter)}
            className="group flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 transition-all hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
          >
            <span>{QUICK_FILTER_LABELS[filter] || filter}</span>
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        ))}

        {/* Chart Filters - Show individual filters with their values */}
        {chartFilters.minutes && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              Minutes: {Math.round(chartFilters.minutes.min)}-
              {Math.round(chartFilters.minutes.max)}
            </span>
          </div>
        )}
        {chartFilters.usage && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              Usage: {Math.round(chartFilters.usage.min * 100)}%-
              {Math.round(chartFilters.usage.max * 100)}%
            </span>
          </div>
        )}
        {chartFilters.points && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              PTS: {Math.round(chartFilters.points.min)}-
              {Math.round(chartFilters.points.max)}
            </span>
          </div>
        )}
        {chartFilters.rebounds && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              REB: {Math.round(chartFilters.rebounds.min)}-
              {Math.round(chartFilters.rebounds.max)}
            </span>
          </div>
        )}
        {chartFilters.assists && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              AST: {Math.round(chartFilters.assists.min)}-
              {Math.round(chartFilters.assists.max)}
            </span>
          </div>
        )}
        {chartFilters.fg3m && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              3PM: {Math.round(chartFilters.fg3m.min)}-
              {Math.round(chartFilters.fg3m.max)}
            </span>
          </div>
        )}
        {chartFilters.fg3a && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              3PA: {Math.round(chartFilters.fg3a.min)}-
              {Math.round(chartFilters.fg3a.max)}
            </span>
          </div>
        )}
        {chartFilters.steals && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              STL: {Math.round(chartFilters.steals.min)}-
              {Math.round(chartFilters.steals.max)}
            </span>
          </div>
        )}
        {chartFilters.blocks && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              BLK: {Math.round(chartFilters.blocks.min)}-
              {Math.round(chartFilters.blocks.max)}
            </span>
          </div>
        )}
        {chartFilters.turnovers && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              TOV: {Math.round(chartFilters.turnovers.min)}-
              {Math.round(chartFilters.turnovers.max)}
            </span>
          </div>
        )}
        {chartFilters.plusMinus && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              +/-: {Math.round(chartFilters.plusMinus.min)} to{" "}
              {Math.round(chartFilters.plusMinus.max)}
            </span>
          </div>
        )}
        {chartFilters.tsPct && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              TS%: {Math.round(chartFilters.tsPct.min)}%-
              {Math.round(chartFilters.tsPct.max)}%
            </span>
          </div>
        )}
        {chartFilters.efgPct && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              eFG%: {Math.round(chartFilters.efgPct.min)}%-
              {Math.round(chartFilters.efgPct.max)}%
            </span>
          </div>
        )}
        {chartFilters.homeAway && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              {chartFilters.homeAway === "home" ? "Home" : "Away"} Games
            </span>
          </div>
        )}
        {chartFilters.winLoss && (
          <div className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <span>
              {chartFilters.winLoss === "win" ? "Wins" : "Losses"} Only
            </span>
          </div>
        )}

        {/* Injury Filters */}
        {injuryFilters.map((filter) => (
          <button
            key={filter.playerId}
            type="button"
            onClick={() => onRemoveInjuryFilter(filter.playerId)}
            className={cn(
              "group flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all",
              filter.mode === "with"
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50",
            )}
          >
            <span>
              {filter.mode === "with" ? "+" : "−"}{" "}
              {filter.playerName.split(" ").pop()}
            </span>
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        ))}

        {/* Play Type Filters */}
        {playTypeFilters.map((filter) => (
          <button
            key={filter.playType}
            type="button"
            onClick={() => onRemovePlayTypeFilter?.(filter.playType)}
            className={cn(
              "group flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all",
              filter.label === "favorable"
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                : filter.label === "tough"
                  ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50",
            )}
          >
            <span>
              {filter.playType.replace(/([A-Z])/g, " $1").trim()}:{" "}
              {filter.label === "favorable"
                ? "Soft"
                : filter.label === "tough"
                  ? "Tough"
                  : "Mid"}
            </span>
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        ))}

        {/* Shot Zone Filters */}
        {shotZoneFilters.map((filter) => (
          <button
            key={filter.zone}
            type="button"
            onClick={() => onRemoveShotZoneFilter?.(filter.zone)}
            className={cn(
              "group flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all",
              filter.label === "favorable"
                ? "bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50"
                : filter.label === "tough"
                  ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50"
                  : "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50",
            )}
          >
            <span>
              {filter.zone}:{" "}
              {filter.label === "favorable"
                ? "Soft"
                : filter.label === "tough"
                  ? "Tough"
                  : "Mid"}
            </span>
            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        ))}

        {/* Clear All Button */}
        <button
          type="button"
          onClick={onClearAll}
          className="ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold text-red-600 transition-all hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export function PlayerDrilldown({
  profile: initialProfile,
  allPlayerProfiles = [],
  onBack,
  onMarketChange,
  sport = "nba",
}: PlayerDrilldownProps) {
  const applyState = useStateLink();
  const [selectedMarket, setSelectedMarketInternal] = useState<string>(
    initialProfile.market,
  );

  // Ref for the scroll container - used to scroll to top when switching players
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ref for chart capture area - used by ShareChartButton (includes header + chart)
  const chartCaptureRef = useRef<HTMLDivElement>(null);

  // State to track when we're capturing (to hide certain UI elements)
  const [isCapturingChart, setIsCapturingChart] = useState(false);

  // Wrap setSelectedMarket to also notify parent
  const setSelectedMarket = useCallback(
    (market: string) => {
      setSelectedMarketInternal(market);
      onMarketChange?.(market);
    },
    [onMarketChange],
  );
  const [gameCount, setGameCount] = useState<GameCountFilter>(10);
  const [customLine, setCustomLine] = useState<number | null>(null);
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [chartFilters, setChartFilters] =
    useState<ChartFiltersState>(DEFAULT_FILTERS);
  const [injuryFilters, setInjuryFilters] = useState<InjuryFilter[]>([]);
  const [rosterSeason, setRosterSeason] = useState("2026");
  const [playTypeFilters, setPlayTypeFilters] = useState<PlayTypeFilter[]>([]);
  const [shotZoneFilters, setShotZoneFilters] = useState<ShotZoneFilter[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);

  // Quick filters (can be combined)
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());

  // Favorites hook for adding to My Plays
  const { isFavorited, toggleFavorite, isToggling, isLoggedIn } =
    useFavorites();

  // Scroll to top when player changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [initialProfile.playerId]);

  // Get the current profile based on selected market
  const profile = useMemo(() => {
    const found = allPlayerProfiles.find((p) => p.market === selectedMarket);
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
    setRosterSeason("2026");
    setQuickFilters(new Set());
  }, [initialProfile.playerId]);

  const handleRosterSeasonChange = useCallback((season: string) => {
    setRosterSeason(season);
    setInjuryFilters([]);
  }, []);

  // Reset custom line when market changes (line values are market-specific)
  // BUT preserve filters - users shouldn't have to re-apply filters for each market
  useEffect(() => {
    setCustomLine(null);
    // Filters persist across market changes for better UX flow
  }, [selectedMarket]);

  // Fetch box scores for this player (used for chart and table)
  const {
    games: boxScoreGames,
    seasonSummary,
    isLoading: boxScoresLoading,
  } = usePlayerBoxScores({
    playerId: profile.playerId,
    sport,
    limit: 100, // Full NBA season is ~82 games
  });

  // Fetch games with injury context (for accurate teammates_out data across ALL games)
  // This replaces the limited gameLogs data from the profile
  const { games: gamesWithInjuries, isLoading: injuryGamesLoading } =
    usePlayerGamesWithInjuries({
      playerId: profile.playerId,
      sport,
      enabled: !!profile.playerId,
    });

  // Fetch players out data - provides avg_pts, avg_reb, avg_ast for teammates who were out
  // This replaces the avg data that was previously in profile.gameLogs
  const { data: playersOutData } = usePlayersOutForFilter({
    playerId: profile.playerId,
    sport,
    enabled: !!profile.playerId,
  });

  // Fetch team roster to get current injury status for teammates
  const { players: rosterPlayers } = useTeamRoster({
    teamId: profile.teamId,
    sport,
    season: sport === "wnba" ? rosterSeason : undefined,
    enabled: !!profile.teamId,
  });

  // Build a lookup map of player_id -> injury status from roster
  const injuryStatusMap = useMemo(() => {
    const map = new Map<
      number,
      { status: string | null; avg: number | null }
    >();
    for (const p of rosterPlayers) {
      // Get the appropriate avg based on market
      const m = profile.market?.toLowerCase() || "";
      const avg =
        m.includes("point") || m.includes("pts")
          ? p.avgPoints
          : m.includes("rebound") || m.includes("reb")
            ? p.avgRebounds
            : m.includes("assist") || m.includes("ast")
              ? p.avgAssists
              : p.avgPoints;
      map.set(p.playerId, { status: p.injuryStatus, avg });
    }
    return map;
  }, [rosterPlayers, profile.market]);

  // Fetch DvP rankings for the player's position - used for opponent rank in chart tooltip
  const { teams: dvpTeams } = useDvpRankings({
    position: profile.position || "PG",
    sport,
    season: sport === "wnba" ? "2026" : undefined,
    enabled: !!profile.position,
  });

  // Fetch play type matchup for current opponent - used in filter drawer Matchup tab
  const { data: playTypeMatchupData } = usePlayTypeMatchup({
    playerId: profile.playerId,
    opponentTeamId: profile.opponentTeamId,
    enabled: sport !== "wnba" && !!profile.playerId && !!profile.opponentTeamId,
  });

  // Fetch shot zone matchup for current opponent - used in filter drawer Matchup tab
  const { data: shotZoneMatchupData } = useShotZoneMatchup({
    playerId: profile.playerId,
    opponentTeamId: profile.opponentTeamId,
    sport,
    season: sport === "wnba" ? "2025" : undefined,
    enabled: !!profile.playerId && !!profile.opponentTeamId,
  });

  // Fetch all teams' play type ranks - used for filtering games by opponent defense
  const {
    playTypes: playTypeRanks,
    displayNames: playTypeDisplayNames,
    isAvailable: playTypeRanksAvailable,
  } = useTeamPlayTypeRanks({
    enabled: sport !== "wnba",
  });

  // Fetch all teams' shot zone ranks - used for filtering games by opponent defense
  const { zones: shotZoneRanks, isAvailable: shotZoneRanksAvailable } =
    useTeamShotZoneRanks({
      sport,
      season: sport === "wnba" ? "2025" : undefined,
    });

  // Build play type ranks map for chart overlay lines: playType -> teamAbbr -> rank
  const playTypeRanksMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    if (!playTypeRanks || playTypeRanks.length === 0) return map;

    for (const pt of playTypeRanks) {
      const teamMap = new Map<string, number>();
      for (const team of pt.teams) {
        teamMap.set(team.teamAbbr, team.pppRank);
      }
      map.set(pt.playType, teamMap);
    }
    return map;
  }, [playTypeRanks]);

  // Build shot zone ranks map for chart overlay lines: zone -> teamAbbr -> rank
  const shotZoneRanksMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    if (!shotZoneRanks || shotZoneRanks.length === 0) return map;

    for (const zone of shotZoneRanks) {
      const teamMap = new Map<string, number>();
      for (const team of zone.teams) {
        teamMap.set(team.teamAbbr, team.rank);
      }
      map.set(zone.zone, teamMap);
    }
    return map;
  }, [shotZoneRanks]);

  // Build active matchup filter lines for chart overlay
  const activeMatchupFilterLines = useMemo(() => {
    const lines: Array<{
      type: "playType" | "shotZone";
      key: string;
      label: "tough" | "neutral" | "favorable";
      displayName: string;
      color: string;
    }> = [];

    // Colors for each filter type
    const playTypeColors = [
      "#f97316",
      "#22c55e",
      "#3b82f6",
      "#a855f7",
      "#ec4899",
    ];
    const shotZoneColors = [
      "#14b8a6",
      "#f59e0b",
      "#6366f1",
      "#84cc16",
      "#ef4444",
    ];

    playTypeFilters.forEach((filter, idx) => {
      const displayName =
        playTypeDisplayNames[filter.playType] ||
        filter.playType.replace(/([A-Z])/g, " $1").trim();
      lines.push({
        type: "playType",
        key: filter.playType,
        label: filter.label,
        displayName,
        color: playTypeColors[idx % playTypeColors.length],
      });
    });

    shotZoneFilters.forEach((filter, idx) => {
      lines.push({
        type: "shotZone",
        key: filter.zone,
        label: filter.label,
        displayName: filter.zone,
        color: shotZoneColors[idx % shotZoneColors.length],
      });
    });

    return lines;
  }, [playTypeFilters, shotZoneFilters, playTypeDisplayNames]);

  // Build opponent DvP rank lookup map based on current market
  const opponentDvpRanks = useMemo(() => {
    const map = new Map<number, number | null>();
    if (!dvpTeams || dvpTeams.length === 0) return map;

    // Determine which rank field to use based on the current market
    const market = profile.market?.toLowerCase() || "";
    let rankField: keyof (typeof dvpTeams)[0] = "ptsRank";

    if (market.includes("rebound") || market.includes("reb")) {
      rankField = "rebRank";
    } else if (market.includes("assist") || market.includes("ast")) {
      rankField = "astRank";
    } else if (
      market.includes("three") ||
      market.includes("3pm") ||
      market.includes("fg3")
    ) {
      rankField = "fg3mRank";
    } else if (market.includes("steal") || market.includes("stl")) {
      rankField = "stlRank";
    } else if (market.includes("block") || market.includes("blk")) {
      rankField = "blkRank";
    } else if (market.includes("pra") || market.includes("pts_rebs_asts")) {
      rankField = "praRank";
    }

    for (const team of dvpTeams) {
      map.set(team.teamId, team[rankField] as number | null);
    }
    return map;
  }, [dvpTeams, profile.market]);

  // Fetch odds for current profile using new Redis keys
  const activeLine = customLine ?? profile.line;
  const { data: oddsLineData } = useOddsLine({
    sport,
    eventId: profile.eventId,
    market: profile.market,
    playerId: profile.selKey, // Player UUID from selKey
    line: activeLine,
    includeSgp: true,
    enabled:
      !!profile.eventId &&
      !!profile.market &&
      !!profile.selKey &&
      activeLine !== null,
  });

  // Transform odds line data to format expected by the header
  const oddsForChart = useMemo(() => {
    // Extract best over/under from the books list
    const overBooks: {
      book: string;
      price: number;
      url: string | null;
      mobileUrl: string | null;
    }[] = [];
    const underBooks: {
      book: string;
      price: number;
      url: string | null;
      mobileUrl: string | null;
    }[] = [];

    for (const book of oddsLineData?.books || []) {
      if (book.over !== null) {
        overBooks.push({
          book: book.book,
          price: book.over,
          url: book.link_over || null,
          mobileUrl: book.link_over || null, // Use same link for both
        });
      }
      if (book.under !== null) {
        underBooks.push({
          book: book.book,
          price: book.under,
          url: book.link_under || null,
          mobileUrl: book.link_under || null, // Use same link for both
        });
      }
    }

    // Sort by price (better odds first)
    overBooks.sort((a, b) => b.price - a.price);
    underBooks.sort((a, b) => b.price - a.price);

    const isProfileLine = activeLine !== null && activeLine === profile.line;
    const profileBestOver =
      isProfileLine && profile.bestOdds
        ? {
            book: profile.bestOdds.book,
            price: profile.bestOdds.price,
            url: null,
            mobileUrl: null,
          }
        : null;

    const bestOver = overBooks[0] || profileBestOver;
    const bestUnder = underBooks[0] || null;

    if (!bestOver && !bestUnder && !oddsLineData) return null;

    return {
      bestOver,
      bestUnder,
      allBooks: { over: overBooks, under: underBooks },
      oddsLine: oddsLineData?.line ?? activeLine,
      isClosestLine: false,
    };
  }, [activeLine, oddsLineData, profile.bestOdds, profile.line]);

  // Build favorite params helper
  const buildFavoriteParams = useCallback(
    (side: "over" | "under"): AddFavoriteParams | null => {
      const favoriteEventId = profile.eventId ?? profile.gameId;
      if (!favoriteEventId) return null;

      const currentLine = customLine ?? profile.line;
      const bestOdds =
        side === "over" ? oddsForChart?.bestOver : oddsForChart?.bestUnder;

      // Build books_snapshot for this specific side from oddsLineData
      let booksSnapshot: Record<string, BookSnapshot> | null = null;
      if (oddsLineData?.books) {
        const snapshot: Record<string, BookSnapshot> = {};
        for (const book of oddsLineData.books) {
          const price = side === "over" ? book.over : book.under;
          const link = side === "over" ? book.link_over : book.link_under;
          const sgp = side === "over" ? book.sgp_over : book.sgp_under;
          if (price !== null) {
            snapshot[book.book] = {
              price,
              u: link || null,
              m: link || null, // Use same link for both
              sgp: sgp || null,
            };
          }
        }
        if (Object.keys(snapshot).length > 0) {
          booksSnapshot = snapshot;
        }
      }

      // Build odds_key from eventId and market (new key format)
      const oddsKey = profile.eventId
        ? `odds:${sport}:${profile.eventId}:${profile.market}`
        : null;

      // Build odds_selection_id using selKey
      const oddsSelectionId = profile.selKey
        ? `${profile.selKey}:${currentLine}:${side}`
        : null;

      return {
        type: "player",
        sport,
        event_id: favoriteEventId,
        game_date: profile.gameDate,
        home_team: profile.homeTeamName?.split(" ").pop() || null, // Extract team abbr from name
        away_team: profile.awayTeamName?.split(" ").pop() || null,
        start_time: profile.startTime ?? null,
        player_id: String(profile.playerId),
        player_name: profile.playerName,
        player_team: profile.teamAbbr,
        player_position: profile.position,
        market: profile.market,
        line: currentLine,
        side,
        odds_key: oddsKey,
        odds_selection_id: oddsSelectionId,
        books_snapshot: booksSnapshot,
        best_price_at_save: bestOdds?.price ?? null,
        best_book_at_save: bestOdds?.book ?? null,
        source: "hit_rates",
      };
    },
    [profile, sport, customLine, oddsForChart, oddsLineData],
  );

  // Check if current selection is favorited
  const isOverFavorited = useMemo(() => {
    const params = buildFavoriteParams("over");
    if (!params) return false;
    return isFavorited({
      event_id: params.event_id,
      type: params.type,
      market: params.market,
      side: params.side,
      player_id: params.player_id,
      line: params.line,
    });
  }, [buildFavoriteParams, isFavorited]);

  const isUnderFavorited = useMemo(() => {
    const params = buildFavoriteParams("under");
    if (!params) return false;
    return isFavorited({
      event_id: params.event_id,
      type: params.type,
      market: params.market,
      side: params.side,
      player_id: params.player_id,
      line: params.line,
    });
  }, [buildFavoriteParams, isFavorited]);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback(
    async (side: "over" | "under") => {
      const params = buildFavoriteParams(side);
      if (!params) return;
      console.info("[hit-rates favorite] toggle", {
        player: params.player_name,
        market: params.market,
        side,
        eventId: params.event_id,
        profileEventId: profile.eventId,
        profileGameId: profile.gameId,
        books: Object.keys(params.books_snapshot ?? {}).length,
        sgpBooks: Object.values(params.books_snapshot ?? {}).filter(
          (book) => !!book?.sgp,
        ).length,
      });
      await toggleFavorite(params);
    },
    [buildFavoriteParams, profile.eventId, profile.gameId, toggleFavorite],
  );

  // Get total available games
  const totalGamesAvailable = boxScoreGames.length;

  // Quick filter toggle helper
  const toggleQuickFilter = (filter: string) => {
    setQuickFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        // Handle mutual exclusivity
        if (filter === "home") next.delete("away");
        if (filter === "away") next.delete("home");
        if (filter === "win") {
          next.delete("loss");
          next.delete("lostBy10");
        }
        if (filter === "loss") {
          next.delete("win");
          next.delete("wonBy10");
        }
        if (filter === "wonBy10") {
          next.delete("loss");
          next.delete("lostBy10");
        }
        if (filter === "lostBy10") {
          next.delete("win");
          next.delete("wonBy10");
        }
        next.add(filter);
      }
      return next;
    });
  };

  // Build a map of gameId -> teammates out (player IDs who were out for that game)
  // Uses the full injury context data from get_player_games_with_injuries RPC
  const teammatesOutByGame = useMemo(() => {
    const map = new Map<string, Set<number>>();

    if (gamesWithInjuries && gamesWithInjuries.length > 0) {
      for (const game of gamesWithInjuries) {
        if (
          game.game_id &&
          game.teammates_out &&
          game.teammates_out.length > 0
        ) {
          const normalizedId = String(game.game_id).replace(/^0+/, "");
          const playerIds = new Set(game.teammates_out.map((t) => t.player_id));
          map.set(normalizedId, playerIds);
        }
      }
    }

    return map;
  }, [gamesWithInjuries]);

  // Transform gamesWithInjuries into the format expected by GameLogChart
  // This provides teammates_out data for ALL games, not just recent ones
  const profileGameLogsForChart = useMemo(() => {
    // Build a lookup of player_id -> avg from playersOutData (NBA path: has avg_pts/reb/ast).
    // Map the appropriate stat based on the current market.
    const playerAvgMap = new Map<number, number | null>();

    const computeAvgForMarket = (
      avgPts: number | null | undefined,
      avgReb: number | null | undefined,
      avgAst: number | null | undefined,
    ): number | null => {
      const m = profile.market?.toLowerCase() || "";
      if (
        m.includes("pra") ||
        m.includes("pts_reb_ast") ||
        m.includes("pts_rebs_asts")
      ) {
        return (avgPts ?? 0) + (avgReb ?? 0) + (avgAst ?? 0);
      }
      if (m === "pts_reb" || m.includes("pts_rebs")) {
        return (avgPts ?? 0) + (avgReb ?? 0);
      }
      if (m === "pts_ast" || m.includes("pts_asts")) {
        return (avgPts ?? 0) + (avgAst ?? 0);
      }
      if (m === "reb_ast" || m.includes("rebs_asts")) {
        return (avgReb ?? 0) + (avgAst ?? 0);
      }
      if (m.includes("point") || m.includes("pts")) return avgPts ?? null;
      if (m.includes("rebound") || m.includes("reb")) return avgReb ?? null;
      if (m.includes("assist") || m.includes("ast")) return avgAst ?? null;
      return avgPts ?? null;
    };

    if (playersOutData?.teammates_out) {
      for (const t of playersOutData.teammates_out) {
        if (t.player_id) {
          playerAvgMap.set(
            t.player_id,
            computeAvgForMarket(t.avg_pts, t.avg_reb, t.avg_ast),
          );
        }
      }
    }

    // WNBA path: avgs are embedded directly on each game's teammates_out
    // (no separate players-out RPC). Fill the map from there as a fallback.
    if (gamesWithInjuries) {
      for (const game of gamesWithInjuries) {
        for (const t of game.teammates_out ?? []) {
          if (t.player_id && !playerAvgMap.has(t.player_id)) {
            playerAvgMap.set(
              t.player_id,
              computeAvgForMarket(t.avg_pts, t.avg_reb, t.avg_ast),
            );
          }
        }
      }
    }

    if (gamesWithInjuries && gamesWithInjuries.length > 0) {
      return gamesWithInjuries.map((game) => ({
        game_id: game.game_id,
        date: game.game_date,
        teammates_out:
          game.teammates_out?.map((t) => ({
            player_id: t.player_id,
            nba_player_id: t.nba_player_id ?? null,
            name: t.name,
            avg: playerAvgMap.get(t.player_id) ?? null,
          })) || [],
      }));
    }

    return [];
  }, [gamesWithInjuries, playersOutData, profile.market]);

  // Helper function to apply quick filters
  const applyQuickFilters = (games: typeof boxScoreGames) => {
    if (quickFilters.size === 0) return games;

    // Check if any DvP filter is active
    const hasDvpFilter =
      quickFilters.has("dvpTough") ||
      quickFilters.has("dvpAverage") ||
      quickFilters.has("dvpWeak");

    return games.filter((game) => {
      // Home/Away
      if (quickFilters.has("home") && game.homeAway !== "H") return false;
      if (quickFilters.has("away") && game.homeAway !== "A") return false;

      // Win/Loss
      if (quickFilters.has("win") && game.result !== "W") return false;
      if (quickFilters.has("loss") && game.result !== "L") return false;

      // Win by 10+ / Lost by 10+
      const margin = parseInt(String(game.margin)) || 0;
      if (quickFilters.has("wonBy10") && (game.result !== "W" || margin < 10))
        return false;
      if (
        quickFilters.has("lostBy10") &&
        (game.result !== "L" || Math.abs(margin) < 10)
      )
        return false;

      // Primetime (nationally televised) - check if field exists
      if (quickFilters.has("primetime") && !(game as any).nationalBroadcast)
        return false;

      // DvP rank filters - opponent defense strength
      if (hasDvpFilter) {
        const dvpRank = opponentDvpRanks.get(game.opponentTeamId);
        if (dvpRank === undefined || dvpRank === null) return false; // Skip games without DvP data

        // Check if game matches ANY of the active DvP filters (OR logic)
        const matchesDvpFilter =
          (quickFilters.has("dvpTough") && dvpRank >= 1 && dvpRank <= 10) ||
          (quickFilters.has("dvpAverage") && dvpRank >= 11 && dvpRank <= 20) ||
          (quickFilters.has("dvpWeak") && dvpRank >= 21 && dvpRank <= 30);
        if (!matchesDvpFilter) return false;
      }

      return true;
    });
  };

  // Helper function to apply injury filters
  const applyInjuryFilters = (games: typeof boxScoreGames) => {
    if (injuryFilters.length === 0) return games;

    return games.filter((game) => {
      const gameIdStr = game.gameId ? String(game.gameId) : "";
      const normalizedGameId = gameIdStr.replace(/^0+/, "");
      const playersOutThisGame =
        teammatesOutByGame.get(normalizedGameId) || new Set<number>();

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
      result = result.filter(
        (game) => game.opponentAbbr === profile.opponentTeamAbbr,
      );
    }

    // Limit by game count (not for season or h2h which show all matching games)
    if (gameCount !== "season" && gameCount !== "h2h") {
      result = result.slice(0, gameCount);
    }

    return result;
  };

  // Helper function to apply play type defense filters
  const applyPlayTypeFilters = (games: typeof boxScoreGames) => {
    if (playTypeFilters.length === 0 || playTypeRanks.length === 0)
      return games;

    return games.filter((game) => {
      const opponentAbbr = game.opponentAbbr;
      if (!opponentAbbr) return true; // Keep game if no opponent info

      // Check each play type filter
      for (const filter of playTypeFilters) {
        const playTypeData = playTypeRanks.find(
          (pt) => pt.playType === filter.playType,
        );
        if (!playTypeData) continue;

        const teamData = playTypeData.teams.find(
          (t) => t.teamAbbr === opponentAbbr,
        );
        if (!teamData) continue;

        const rank = teamData.pppRank;
        const matchupLabel =
          rank <= 10 ? "tough" : rank >= 21 ? "favorable" : "neutral";

        // If this game's opponent doesn't match the filter label, exclude the game
        if (matchupLabel !== filter.label) return false;
      }

      return true;
    });
  };

  // Helper function to apply shot zone defense filters
  const applyShotZoneFilters = (games: typeof boxScoreGames) => {
    if (shotZoneFilters.length === 0 || shotZoneRanks.length === 0)
      return games;

    return games.filter((game) => {
      const opponentAbbr = game.opponentAbbr;
      if (!opponentAbbr) return true; // Keep game if no opponent info

      // Check each shot zone filter
      for (const filter of shotZoneFilters) {
        const zoneData = shotZoneRanks.find((z) => z.zone === filter.zone);
        if (!zoneData) continue;

        const teamData = zoneData.teams.find(
          (t) => t.teamAbbr === opponentAbbr,
        );
        if (!teamData) continue;

        const rank = teamData.rank;
        const matchupLabel =
          rank <= 10 ? "tough" : rank >= 21 ? "favorable" : "neutral";

        // If this game's opponent doesn't match the filter label, exclude the game
        if (matchupLabel !== filter.label) return false;
      }

      return true;
    });
  };

  // Games for ChartFilters histograms - applies quick + injury filters but NOT chart filters
  // This way when you filter "without Sam Merrill", the histogram shows only those games
  const gamesForChartFilters = useMemo(() => {
    if (boxScoreGames.length === 0) return [];

    let games = [...boxScoreGames];
    games = applyQuickFilters(games);
    games = applyInjuryFilters(games);
    games = applyPlayTypeFilters(games);
    games = applyShotZoneFilters(games);
    games = applyGameCountFilter(games);

    return games;
  }, [
    boxScoreGames,
    gameCount,
    quickFilters,
    injuryFilters,
    playTypeFilters,
    shotZoneFilters,
    playTypeRanks,
    shotZoneRanks,
    teammatesOutByGame,
    profile.opponentTeamAbbr,
    opponentDvpRanks,
  ]);

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

    // Apply play type defense filters
    games = applyPlayTypeFilters(games);

    // Apply shot zone defense filters
    games = applyShotZoneFilters(games);

    // Apply game count filter
    games = applyGameCountFilter(games);

    return games;
  }, [
    boxScoreGames,
    gameCount,
    quickFilters,
    chartFilters,
    injuryFilters,
    playTypeFilters,
    shotZoneFilters,
    playTypeRanks,
    shotZoneRanks,
    teammatesOutByGame,
    profile.opponentTeamAbbr,
    opponentDvpRanks,
  ]);

  // Get stat value from a game based on market
  const getMarketStat = (
    game: (typeof boxScoreGames)[0],
    market: string,
  ): number => {
    switch (market) {
      case "player_points":
        return game.pts;
      case "player_rebounds":
        return game.reb;
      case "player_assists":
        return game.ast;
      case "player_threes_made":
        return game.fg3m;
      case "player_steals":
        return game.stl;
      case "player_blocks":
        return game.blk;
      case "player_turnovers":
        return game.tov;
      case "player_points_rebounds_assists":
        return game.pra;
      case "player_points_rebounds":
        return game.pr;
      case "player_points_assists":
        return game.pa;
      case "player_rebounds_assists":
        return game.ra;
      case "player_blocks_steals":
        return game.bs;
      default:
        return game.pts;
    }
  };

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
      const stats = games.map((g) => getMarketStat(g, profile.market));
      const hits = stats.filter((s) => s >= activeLine).length;
      return Math.round((hits / stats.length) * 100);
    };

    // Sort games by date descending for L5, L10, L20
    const sortedGames = [...boxScoreGames].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // H2H games against current opponent
    const h2hGames = boxScoreGames.filter(
      (g) => g.opponentAbbr === profile.opponentTeamAbbr,
    );

    return {
      l5: calculateHitRate(sortedGames.slice(0, 5)),
      l10: calculateHitRate(sortedGames.slice(0, 10)),
      l20: calculateHitRate(sortedGames.slice(0, 20)),
      season: calculateHitRate(boxScoreGames),
      h2h: calculateHitRate(h2hGames),
    };
  }, [
    boxScoreGames,
    activeLine,
    customLine,
    profile.line,
    profile.last5Pct,
    profile.last10Pct,
    profile.last20Pct,
    profile.seasonPct,
    profile.h2hPct,
    profile.market,
    profile.opponentTeamAbbr,
  ]);

  // Calculate hit rates for ALL markets based on FILTERED games
  // This allows the market selector to show dynamic hit rates that reflect active filters
  // Uses activeLine for the currently selected market (to reflect custom line changes)
  const marketHitRates = useMemo(() => {
    if (boxScoreGames.length === 0) return new Map<string, MarketHitRateData>();

    const rates = new Map<string, MarketHitRateData>();

    // Expected total based on game count filter
    const expectedTotal =
      gameCount === "season"
        ? boxScoreGames.length
        : gameCount === "h2h"
          ? boxScoreGames.filter(
              (g) => g.opponentAbbr === profile.opponentTeamAbbr,
            ).length
          : Math.min(gameCount as number, boxScoreGames.length);

    // Use filtered games for accurate hit rate calculation
    const gamesToUse = filteredGames;

    for (const marketProfile of allPlayerProfiles) {
      // Use activeLine for the selected market, otherwise use the profile's line
      const isSelectedMarket = marketProfile.market === selectedMarket;
      const line = isSelectedMarket ? activeLine : marketProfile.line;

      if (line === null || gamesToUse.length === 0) {
        rates.set(marketProfile.market, {
          hitRate: null,
          hits: 0,
          total: gamesToUse.length,
          expectedTotal,
        });
        continue;
      }

      const stats = gamesToUse.map((g) =>
        getMarketStat(g, marketProfile.market),
      );
      const hits = stats.filter((s) => s >= line).length;
      const hitRate = stats.length > 0 ? (hits / stats.length) * 100 : null;
      rates.set(marketProfile.market, {
        hitRate: hitRate !== null ? Math.round(hitRate) : null,
        hits,
        total: stats.length,
        expectedTotal,
      });
    }

    return rates;
  }, [
    boxScoreGames,
    filteredGames,
    gameCount,
    allPlayerProfiles,
    profile.opponentTeamAbbr,
    selectedMarket,
    activeLine,
  ]);

  // Calculate baseline stats (UNFILTERED - just game count applied)
  // This is what we compare filtered results against
  const baselineStats = useMemo(() => {
    // Get games with just game count filter applied (no quick/chart/injury filters)
    let games = [...boxScoreGames];

    // Apply game count filter
    if (gameCount === "h2h" && profile.opponentTeamAbbr) {
      games = games.filter((g) => g.opponentAbbr === profile.opponentTeamAbbr);
    } else if (gameCount !== "season" && gameCount !== "h2h") {
      games = games.slice(0, gameCount);
    }

    if (games.length === 0) {
      return {
        avg: null,
        hitRate: null,
        hits: 0,
        total: 0,
        usage: null,
        minutes: null,
        fga: null,
      };
    }

    const stats = games.map((g) => getMarketStat(g, profile.market));
    const avg = stats.reduce((a, b) => a + b, 0) / stats.length;

    // Calculate additional context stats
    const usageAvg =
      games.reduce((sum, g) => sum + (g.usagePct || 0), 0) / games.length;
    const minutesAvg =
      games.reduce((sum, g) => sum + (g.minutes || 0), 0) / games.length;
    const fgaAvg =
      games.reduce((sum, g) => sum + (g.fga || 0), 0) / games.length;
    const rebAvg =
      games.reduce((sum, g) => sum + (g.reb || 0), 0) / games.length;
    const astAvg =
      games.reduce((sum, g) => sum + (g.ast || 0), 0) / games.length;
    const fg3aAvg =
      games.reduce((sum, g) => sum + (g.fg3a || 0), 0) / games.length;
    const fg3mAvg =
      games.reduce((sum, g) => sum + (g.fg3m || 0), 0) / games.length;
    const ftaAvg =
      games.reduce((sum, g) => sum + (g.fta || 0), 0) / games.length;
    const ptsAvg =
      games.reduce((sum, g) => sum + (g.pts || 0), 0) / games.length;

    if (activeLine === null) {
      return {
        avg: Math.round(avg * 10) / 10,
        hitRate: null,
        hits: 0,
        total: stats.length,
        usage: Math.round(usageAvg * 100 * 10) / 10, // usagePct is 0-1, convert to %
        minutes: Math.round(minutesAvg * 10) / 10,
        fga: Math.round(fgaAvg * 10) / 10,
        reb: Math.round(rebAvg * 10) / 10,
        ast: Math.round(astAvg * 10) / 10,
        fg3a: Math.round(fg3aAvg * 10) / 10,
        fg3m: Math.round(fg3mAvg * 10) / 10,
        fta: Math.round(ftaAvg * 10) / 10,
        pts: Math.round(ptsAvg * 10) / 10,
      };
    }

    const hits = stats.filter((s) => s >= activeLine).length;
    const hitRate = (hits / stats.length) * 100;

    return {
      avg: Math.round(avg * 10) / 10,
      hitRate: Math.round(hitRate),
      hits,
      total: stats.length,
      usage: Math.round(usageAvg * 100 * 10) / 10,
      minutes: Math.round(minutesAvg * 10) / 10,
      fga: Math.round(fgaAvg * 10) / 10,
      reb: Math.round(rebAvg * 10) / 10,
      ast: Math.round(astAvg * 10) / 10,
      fg3a: Math.round(fg3aAvg * 10) / 10,
      fg3m: Math.round(fg3mAvg * 10) / 10,
      fta: Math.round(ftaAvg * 10) / 10,
      pts: Math.round(ptsAvg * 10) / 10,
    };
  }, [
    boxScoreGames,
    gameCount,
    profile.market,
    profile.opponentTeamAbbr,
    activeLine,
  ]);

  // Calculate chart stats (for filtered games)
  // Always calculate average even if no line, but only calculate hit rate if line exists
  const chartStats = useMemo(() => {
    if (filteredGames.length === 0) {
      return {
        avg: null,
        hitRate: null,
        hits: 0,
        total: 0,
        usage: null,
        minutes: null,
        fga: null,
      };
    }

    const stats = filteredGames.map((g) => getMarketStat(g, profile.market));
    const avg = stats.reduce((a, b) => a + b, 0) / stats.length;

    // Calculate additional context stats
    const usageAvg =
      filteredGames.reduce((sum, g) => sum + (g.usagePct || 0), 0) /
      filteredGames.length;
    const minutesAvg =
      filteredGames.reduce((sum, g) => sum + (g.minutes || 0), 0) /
      filteredGames.length;
    const fgaAvg =
      filteredGames.reduce((sum, g) => sum + (g.fga || 0), 0) /
      filteredGames.length;
    const rebAvg =
      filteredGames.reduce((sum, g) => sum + (g.reb || 0), 0) /
      filteredGames.length;
    const astAvg =
      filteredGames.reduce((sum, g) => sum + (g.ast || 0), 0) /
      filteredGames.length;
    const fg3aAvg =
      filteredGames.reduce((sum, g) => sum + (g.fg3a || 0), 0) /
      filteredGames.length;
    const fg3mAvg =
      filteredGames.reduce((sum, g) => sum + (g.fg3m || 0), 0) /
      filteredGames.length;
    const ftaAvg =
      filteredGames.reduce((sum, g) => sum + (g.fta || 0), 0) /
      filteredGames.length;
    const ptsAvg =
      filteredGames.reduce((sum, g) => sum + (g.pts || 0), 0) /
      filteredGames.length;

    // Only calculate hit rate if we have a line
    if (activeLine === null) {
      return {
        avg: Math.round(avg * 10) / 10,
        hitRate: null,
        hits: 0,
        total: stats.length,
        usage: Math.round(usageAvg * 100 * 10) / 10,
        minutes: Math.round(minutesAvg * 10) / 10,
        fga: Math.round(fgaAvg * 10) / 10,
        reb: Math.round(rebAvg * 10) / 10,
        ast: Math.round(astAvg * 10) / 10,
        fg3a: Math.round(fg3aAvg * 10) / 10,
        fg3m: Math.round(fg3mAvg * 10) / 10,
        fta: Math.round(ftaAvg * 10) / 10,
        pts: Math.round(ptsAvg * 10) / 10,
      };
    }

    // >= so that hitting exactly the line counts as a hit (e.g., 1 block when line is 1)
    const hits = stats.filter((s) => s >= activeLine).length;
    const hitRate = (hits / stats.length) * 100;

    return {
      avg: Math.round(avg * 10) / 10,
      hitRate: Math.round(hitRate),
      hits,
      total: stats.length,
      usage: Math.round(usageAvg * 100 * 10) / 10,
      minutes: Math.round(minutesAvg * 10) / 10,
      fga: Math.round(fgaAvg * 10) / 10,
      reb: Math.round(rebAvg * 10) / 10,
      ast: Math.round(astAvg * 10) / 10,
      fg3a: Math.round(fg3aAvg * 10) / 10,
      fg3m: Math.round(fg3mAvg * 10) / 10,
      fta: Math.round(ftaAvg * 10) / 10,
      pts: Math.round(ptsAvg * 10) / 10,
    };
  }, [filteredGames, profile.market, activeLine]);

  // Check if we have active filters (to show comparison panel)
  const hasActiveFilters =
    quickFilters.size > 0 ||
    injuryFilters.length > 0 ||
    playTypeFilters.length > 0 ||
    shotZoneFilters.length > 0 ||
    [
      chartFilters.minutes,
      chartFilters.usage,
      chartFilters.points,
      chartFilters.rebounds,
      chartFilters.assists,
      chartFilters.fg3m,
      chartFilters.fg3a,
      chartFilters.fga,
    ].some(Boolean);

  const startEditingLine = useCallback(() => {
    if (isEditingLine) return;
    setEditValue(String(activeLine ?? profile.line ?? ""));
    setIsEditingLine(true);
  }, [isEditingLine, activeLine, profile.line]);

  const commitEditedLine = useCallback(() => {
    const parsed = parseFloat(editValue);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed !== profile.line) {
      setCustomLine(parsed);
    } else if (parsed === profile.line) {
      setCustomLine(null);
    }
    setIsEditingLine(false);
  }, [editValue, profile.line]);

  const cancelEditingLine = useCallback(() => {
    setIsEditingLine(false);
  }, []);

  const overSportsbook = useMemo(
    () =>
      oddsForChart?.bestOver
        ? getSportsbookById(oddsForChart.bestOver.book)
        : null,
    [oddsForChart?.bestOver],
  );
  const underSportsbook = useMemo(
    () =>
      oddsForChart?.bestUnder
        ? getSportsbookById(oddsForChart.bestUnder.book)
        : null,
    [oddsForChart?.bestUnder],
  );

  const headerOddsCards = useMemo<
    [HeaderOddsCardConfig, HeaderOddsCardConfig]
  >(() => {
    const overUrl = oddsForChart?.bestOver?.mobileUrl ?? undefined;
    const underUrl = oddsForChart?.bestUnder?.mobileUrl ?? undefined;

    const overCard: HeaderOddsCardConfig = {
      sideLabel: "O",
      bookLogoSrc: overSportsbook?.image?.light ?? null,
      bookName: overSportsbook?.name ?? oddsForChart?.bestOver?.book ?? null,
      bookFallbackLabel: overSportsbook?.image?.light
        ? null
        : (oddsForChart?.bestOver?.book ?? null),
      priceText:
        oddsForChart?.bestOver == null
          ? null
          : oddsForChart.bestOver.price > 0
            ? `+${oddsForChart.bestOver.price}`
            : `${oddsForChart.bestOver.price}`,
      priceClassName:
        oddsForChart?.bestOver == null
          ? undefined
          : oddsForChart.bestOver.price > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-neutral-700 dark:text-neutral-300",
      onClick: overUrl
        ? () =>
            window.open(
              applyState(overUrl) || overUrl,
              "_blank",
              "noopener,noreferrer",
            )
        : undefined,
      favorite:
        isLoggedIn && (profile.eventId ?? profile.gameId)
          ? {
              active: isOverFavorited,
              tooltip: isOverFavorited
                ? "Remove from My Plays"
                : "Add Over to My Plays",
              disabled: isToggling,
              onToggle: () => {
                void handleToggleFavorite("over");
              },
            }
          : undefined,
    };

    const underCard: HeaderOddsCardConfig = {
      sideLabel: "U",
      bookLogoSrc: underSportsbook?.image?.light ?? null,
      bookName: underSportsbook?.name ?? oddsForChart?.bestUnder?.book ?? null,
      bookFallbackLabel: underSportsbook?.image?.light
        ? null
        : (oddsForChart?.bestUnder?.book ?? null),
      priceText:
        oddsForChart?.bestUnder == null
          ? null
          : oddsForChart.bestUnder.price > 0
            ? `+${oddsForChart.bestUnder.price}`
            : `${oddsForChart.bestUnder.price}`,
      priceClassName:
        oddsForChart?.bestUnder == null
          ? undefined
          : oddsForChart.bestUnder.price > 0
            ? "text-red-600 dark:text-red-400"
            : "text-neutral-700 dark:text-neutral-300",
      onClick: underUrl
        ? () =>
            window.open(
              applyState(underUrl) || underUrl,
              "_blank",
              "noopener,noreferrer",
            )
        : undefined,
      favorite:
        isLoggedIn && (profile.eventId ?? profile.gameId)
          ? {
              active: isUnderFavorited,
              tooltip: isUnderFavorited
                ? "Remove from My Plays"
                : "Add Under to My Plays",
              disabled: isToggling,
              onToggle: () => {
                void handleToggleFavorite("under");
              },
            }
          : undefined,
    };

    return [overCard, underCard];
  }, [
    overSportsbook,
    underSportsbook,
    oddsForChart,
    isLoggedIn,
    profile.gameId,
    isOverFavorited,
    isUnderFavorited,
    isToggling,
    handleToggleFavorite,
  ]);

  return (
    <div
      ref={scrollContainerRef}
      className="drilldown-scroll h-full overflow-auto pr-3"
    >
      {/* Capture Wrapper - Contains header + chart for sharing */}
      <div ref={chartCaptureRef}>
        {/* ═══════════════════════════════════════════════════════════════════
          STICKY PLAYER HEADER - Premium Design
          ═══════════════════════════════════════════════════════════════════ */}
        <div className="sticky top-0 z-40 -mx-3 bg-gradient-to-b from-white via-white to-white/95 px-3 pt-1 pb-4 backdrop-blur-xl dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-950/95">
          <div
            className="overflow-hidden rounded-2xl border border-neutral-200/80 shadow-lg ring-1 ring-black/5 dark:border-neutral-800/80 dark:ring-white/5"
            style={{
              background: profile.primaryColor
                ? `linear-gradient(135deg, ${profile.primaryColor}15 0%, ${profile.primaryColor}05 40%, transparent 70%)`
                : undefined,
            }}
          >
            <div className="flex items-stretch">
              {/* ════════════════════════════════════════════════════════════════
                LEFT SECTION - Identity Cluster - Premium
                ════════════════════════════════════════════════════════════════ */}
              <div className="flex flex-1 items-center gap-5 bg-gradient-to-r from-white/60 via-white/40 to-transparent p-5 dark:from-neutral-900/60 dark:via-neutral-900/40 dark:to-transparent">
                {/* Back Button - Premium (hidden on capture) */}
                <button
                  type="button"
                  onClick={onBack}
                  data-hide-on-capture
                  className={cn(
                    "shrink-0 rounded-xl p-2.5 text-neutral-400 backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/80 hover:text-neutral-900 active:scale-95 dark:hover:bg-neutral-800/80 dark:hover:text-white",
                    isCapturingChart && "opacity-0",
                  )}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                {/* Player Headshot - Premium */}
                <div
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl shadow-xl ring-2 ring-white transition-transform hover:scale-105 dark:ring-neutral-700"
                  style={{
                    background:
                      profile.primaryColor && profile.secondaryColor
                        ? `linear-gradient(180deg, ${profile.primaryColor} 0%, ${profile.secondaryColor} 100%)`
                        : profile.primaryColor || "#374151",
                  }}
                >
                  <PlayerHeadshot
                    sport={sport}
                    nbaPlayerId={profile.nbaPlayerId ?? profile.playerId}
                    name={profile.playerName}
                    size="small"
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Player Info Stack - Premium */}
                <div className="flex flex-col gap-1.5">
                  {/* Name + Injury Icon */}
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl leading-tight font-bold tracking-tight text-neutral-900 dark:text-white">
                      {profile.playerName}
                    </h1>
                    {profile.injuryStatus &&
                      profile.injuryStatus.toLowerCase() !== "available" &&
                      profile.injuryStatus.toLowerCase() !== "active" &&
                      (() => {
                        const isGLeague = isGLeagueAssignment(
                          profile.injuryNotes,
                        );
                        return (
                          <Tooltip
                            content={
                              <InjuryReportTooltipContent
                                playerName={profile.playerName}
                                status={profile.injuryStatus}
                                notes={profile.injuryNotes}
                                updatedAt={profile.injuryUpdatedAt}
                                returnDate={profile.injuryReturnDate}
                                source={profile.injurySource}
                                rawStatus={profile.injuryRawStatus}
                              />
                            }
                            side="right"
                            contentClassName="p-0"
                          >
                            {isGLeague ? (
                              <ArrowDown className="h-5 w-5 cursor-help text-blue-500" />
                            ) : (
                              <HeartPulse
                                className={cn(
                                  "h-5 w-5 cursor-help",
                                  getInjuryIconColor(profile.injuryStatus),
                                )}
                              />
                            )}
                          </Tooltip>
                        );
                      })()}
                  </div>

                  {/* Position + Jersey + Team - Premium Badges */}
                  <div className="flex items-center gap-2 text-xs">
                    {profile.teamAbbr && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-neutral-100/80 px-2.5 py-1 dark:bg-neutral-800/50">
                        <img
                          src={getTeamLogoUrl(profile.teamAbbr, sport)}
                          alt={profile.teamAbbr}
                          className="h-4 w-4 object-contain"
                        />
                        <span className="font-bold text-neutral-700 dark:text-neutral-300">
                          {profile.teamAbbr}
                        </span>
                      </div>
                    )}
                    <Tooltip
                      content={getPositionLabel(profile.position)}
                      side="bottom"
                    >
                      <span className="cursor-help rounded-lg bg-neutral-100/80 px-2.5 py-1 font-semibold text-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-400">
                        {profile.position}
                      </span>
                    </Tooltip>
                    <span className="font-medium text-neutral-400">
                      #{profile.jerseyNumber ?? "—"}
                    </span>
                  </div>

                  {/* Matchup + Game Time - Premium Badge */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-emerald-200/50 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1.5 dark:border-emerald-700/30 dark:from-emerald-900/20 dark:to-teal-900/20">
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
                        Next
                      </span>
                      {profile.teamAbbr && (
                        <img
                          src={getTeamLogoUrl(profile.teamAbbr, sport)}
                          alt={profile.teamAbbr}
                          className="h-4 w-4 object-contain"
                        />
                      )}
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                        {profile.homeAway === "H" ? "vs" : "@"}
                      </span>
                      {profile.opponentTeamAbbr && (
                        <img
                          src={getTeamLogoUrl(profile.opponentTeamAbbr, sport)}
                          alt={profile.opponentTeamAbbr}
                          className="h-4 w-4 object-contain"
                        />
                      )}
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        {profile.opponentTeamAbbr}
                      </span>
                      <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
                        •
                      </span>
                      <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                        {profile.gameStatus}
                      </span>
                    </div>

                    {/* DvP Badge for Upcoming Opponent */}
                    {(() => {
                      const upcomingDvpRank = profile.opponentTeamId
                        ? opponentDvpRanks.get(profile.opponentTeamId)
                        : null;
                      if (
                        upcomingDvpRank === null ||
                        upcomingDvpRank === undefined
                      )
                        return null;

                      const getDvpBadgeColor = (rank: number) => {
                        if (rank <= 10)
                          return "from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 border-red-200/60 dark:border-red-700/40 text-red-600 dark:text-red-400";
                        if (rank <= 20)
                          return "from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 border-amber-200/60 dark:border-amber-700/40 text-amber-600 dark:text-amber-400";
                        return "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border-emerald-200/60 dark:border-emerald-700/40 text-emerald-600 dark:text-emerald-400";
                      };

                      const getDvpLabel = (rank: number) => {
                        if (rank <= 10) return "Tough";
                        if (rank <= 20) return "Average";
                        return "Favorable";
                      };

                      return (
                        <Tooltip
                          content={
                            <div className="min-w-[180px] p-2">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  DvP Rank #{upcomingDvpRank}
                                </span>
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                    upcomingDvpRank <= 10
                                      ? "bg-red-500/20 text-red-400"
                                      : upcomingDvpRank <= 20
                                        ? "bg-amber-500/20 text-amber-400"
                                        : "bg-emerald-500/20 text-emerald-400",
                                  )}
                                >
                                  {getDvpLabel(upcomingDvpRank)}
                                </span>
                              </div>
                              <p className="text-[10px] leading-relaxed text-neutral-400">
                                {profile.opponentTeamAbbr} ranks{" "}
                                <span className="font-semibold text-white">
                                  #{upcomingDvpRank}
                                </span>{" "}
                                in allowing {formatMarketLabel(profile.market)}{" "}
                                to {profile.position}s this season.
                                {upcomingDvpRank <= 10 &&
                                  " This is a tough matchup."}
                                {upcomingDvpRank > 20 &&
                                  " This is a favorable matchup."}
                              </p>
                            </div>
                          }
                          side="bottom"
                        >
                          <div
                            className={cn(
                              "flex cursor-help items-center gap-1.5 rounded-full border bg-gradient-to-r px-2.5 py-1 transition-all hover:scale-105",
                              getDvpBadgeColor(upcomingDvpRank),
                            )}
                          >
                            <span className="text-[9px] font-bold tracking-wide uppercase opacity-70">
                              DvP
                            </span>
                            <span className="text-[11px] font-black">
                              #{upcomingDvpRank}
                            </span>
                          </div>
                        </Tooltip>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════════
                RIGHT SECTION - Premium Stats Layout
                ════════════════════════════════════════════════════════════════ */}
              <DrilldownHeaderRightPanel
                primaryColor={profile.primaryColor}
                lineText={`${activeLine !== null ? `${activeLine}+` : "-"} ${formatMarketLabel(profile.market)}`}
                lineEditor={{
                  enabled: true,
                  isEditing: isEditingLine,
                  editValue,
                  placeholder: "0",
                  tooltipContent: (
                    <div className="p-1 text-center">
                      <div className="font-semibold text-neutral-100">
                        Click to edit line
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-400">
                        Or drag the chart line to adjust
                      </div>
                    </div>
                  ),
                  showReset: customLine !== null && customLine !== profile.line,
                  resetTitle: `Reset to ${profile.line}`,
                  onStartEditing: startEditingLine,
                  onEditValueChange: setEditValue,
                  onCommitEditing: commitEditedLine,
                  onCancelEditing: cancelEditingLine,
                  onReset: () => setCustomLine(null),
                }}
                oddsCards={headerOddsCards}
                stripItems={[
                  { label: "L5", value: dynamicHitRates.l5, count: 5 },
                  { label: "L10", value: dynamicHitRates.l10, count: 10 },
                  { label: "L20", value: dynamicHitRates.l20, count: 20 },
                  {
                    label: "SZN",
                    value: dynamicHitRates.season,
                    count: "season",
                  },
                  { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" },
                ]}
                selectedStrip={gameCount}
                onSelectStrip={(count) =>
                  setGameCount(count as GameCountFilter)
                }
              />
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
              playTypeFilters={playTypeFilters}
              shotZoneFilters={shotZoneFilters}
              onClearAllFilters={() => {
                setQuickFilters(new Set());
                setChartFilters(DEFAULT_FILTERS);
                setInjuryFilters([]);
                setPlayTypeFilters([]);
                setShotZoneFilters([]);
              }}
              onRemoveQuickFilter={(filter) => {
                const newFilters = new Set(quickFilters);
                newFilters.delete(filter);
                setQuickFilters(newFilters);
              }}
              onRemoveInjuryFilter={(playerId) => {
                setInjuryFilters(
                  injuryFilters.filter((f) => f.playerId !== playerId),
                );
              }}
              onRemovePlayTypeFilter={(playType) => {
                setPlayTypeFilters(
                  playTypeFilters.filter((f) => f.playType !== playType),
                );
              }}
              onRemoveShotZoneFilter={(zone) => {
                setShotZoneFilters(
                  shotZoneFilters.filter((f) => f.zone !== zone),
                );
              }}
              filteredGamesCount={chartStats.total}
              totalGamesCount={totalGamesAvailable}
            />
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
          CONTEXT BAR - Primary Control Cluster Above Chart
          ═══════════════════════════════════════════════════════════════════ */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-lg ring-1 ring-black/5 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:ring-white/5">
          {/* Context Bar - Single Row Control Cluster */}
          <div className="border-b border-neutral-200/60 bg-gradient-to-r from-neutral-50/50 to-white px-5 py-4 dark:border-neutral-700/60 dark:from-neutral-800/50 dark:to-neutral-900">
            <div className="flex items-center justify-between gap-4">
              {/* LEFT: Sample Size Tabs + Hit Rate */}
              <div className="flex items-center gap-4">
                {/* L5/L10/L20/Season Tabs - Compact */}
                <div className="flex items-center gap-0.5 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
                  {([5, 10, 20, "season"] as GameCountFilter[]).map((count) => {
                    const numericCount =
                      count === "season"
                        ? totalGamesAvailable
                        : typeof count === "number"
                          ? count
                          : 0;
                    const isDisabled = numericCount > totalGamesAvailable;
                    const displayCount =
                      count === "season" ? "All" : `L${count}`;

                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => !isDisabled && setGameCount(count)}
                        disabled={isDisabled}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                          gameCount === count
                            ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                            : isDisabled
                              ? "cursor-not-allowed text-neutral-300 dark:text-neutral-600"
                              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300",
                        )}
                      >
                        {displayCount}
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />

                {/* Hit Rate + Games - Merged Display */}
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2",
                    chartStats.hitRate !== null && chartStats.hitRate >= 70
                      ? "bg-emerald-50 ring-1 ring-emerald-200/50 dark:bg-emerald-900/20 dark:ring-emerald-700/30"
                      : chartStats.hitRate !== null && chartStats.hitRate >= 50
                        ? "bg-amber-50 ring-1 ring-amber-200/50 dark:bg-amber-900/20 dark:ring-amber-700/30"
                        : chartStats.hitRate !== null
                          ? "bg-red-50 ring-1 ring-red-200/50 dark:bg-red-900/20 dark:ring-red-700/30"
                          : "bg-neutral-50 ring-1 ring-neutral-200/50 dark:bg-neutral-800 dark:ring-neutral-700/30",
                  )}
                >
                  <span
                    className={cn(
                      "text-2xl font-black tracking-tight tabular-nums",
                      chartStats.hitRate !== null
                        ? chartStats.hitRate >= 70
                          ? "text-emerald-600 dark:text-emerald-400"
                          : chartStats.hitRate >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-500 dark:text-red-400"
                        : "text-neutral-400",
                    )}
                  >
                    {chartStats.hitRate !== null
                      ? `${chartStats.hitRate}%`
                      : "—"}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                      Hit Rate
                    </span>
                    <span className="text-xs font-semibold text-neutral-600 tabular-nums dark:text-neutral-300">
                      {chartStats.hits}/{chartStats.total} games
                    </span>
                  </div>
                </div>

                {/* Average - Compact */}
                <div className="flex items-center gap-1.5 rounded-xl bg-neutral-50 px-3 py-2 ring-1 ring-neutral-200/50 dark:bg-neutral-800/50 dark:ring-neutral-700/30">
                  <span className="text-[10px] font-bold tracking-wide text-neutral-400 uppercase">
                    Avg
                  </span>
                  <span
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      chartStats.avg !== null &&
                        activeLine !== null &&
                        chartStats.avg > activeLine
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-neutral-700 dark:text-neutral-300",
                    )}
                  >
                    {chartStats.avg?.toFixed(1) ?? "—"}
                  </span>
                </div>
              </div>

              {/* RIGHT: Share + Filters Buttons (hidden on capture) */}
              <div
                className={cn(
                  "flex items-center gap-2",
                  isCapturingChart && "opacity-0",
                )}
                data-hide-on-capture
              >
                <ShareChartButton
                  targetRef={chartCaptureRef}
                  playerName={profile.playerName}
                  market={profile.market}
                  compact
                  onCaptureStart={() => setIsCapturingChart(true)}
                  onCaptureEnd={() => setIsCapturingChart(false)}
                  gameRange={
                    gameCount === "season"
                      ? "Season"
                      : gameCount === "h2h"
                        ? `vs ${profile.opponentTeamAbbr}`
                        : `L${gameCount}`
                  }
                  stats={{
                    hitRate: chartStats.hitRate,
                    avg: chartStats.avg,
                    gamesCount: chartStats.total,
                    line: activeLine,
                  }}
                  activeFilters={[
                    ...Array.from(quickFilters).map((f) => ({
                      type: "quick" as const,
                      label:
                        f === "home"
                          ? "Home"
                          : f === "away"
                            ? "Away"
                            : f === "win"
                              ? "Wins"
                              : f === "loss"
                                ? "Losses"
                                : f === "wonBy10"
                                  ? "Won 10+"
                                  : f === "lostBy10"
                                    ? "Lost 10+"
                                    : f,
                    })),
                    ...injuryFilters.map((f) => ({
                      type: "injury" as const,
                      label: `${f.mode === "without" ? "w/o" : "w/"} ${f.playerName?.split(" ").pop()}`,
                    })),
                    ...playTypeFilters.map((f) => ({
                      type: "playType" as const,
                      label: `${f.playType} ${f.label}`,
                    })),
                    ...shotZoneFilters.map((f) => ({
                      type: "shotZone" as const,
                      label: `${f.zone} ${f.label}`,
                    })),
                    ...(chartFilters.minutes
                      ? [
                          {
                            type: "chart" as const,
                            label: `Min ${chartFilters.minutes.min}-${chartFilters.minutes.max}`,
                          },
                        ]
                      : []),
                    ...(chartFilters.usage
                      ? [
                          {
                            type: "chart" as const,
                            label: `Usage ${Math.round(chartFilters.usage.min * 100)}-${Math.round(chartFilters.usage.max * 100)}%`,
                          },
                        ]
                      : []),
                  ]}
                />
                <FilterButton
                  onClick={() => setFilterDrawerOpen(true)}
                  activeCount={
                    quickFilters.size +
                    injuryFilters.length +
                    playTypeFilters.length +
                    shotZoneFilters.length +
                    [
                      chartFilters.minutes,
                      chartFilters.usage,
                      chartFilters.points,
                      chartFilters.rebounds,
                      chartFilters.assists,
                      chartFilters.fg3m,
                      chartFilters.fg3a,
                      chartFilters.fga,
                    ].filter(Boolean).length
                  }
                />
              </div>
            </div>

            {/* Active Injury/Lineup Context Chip - Below main row when active */}
            {injuryFilters.length > 0 && (
              <div className="mt-3 border-t border-neutral-200/50 pt-3 dark:border-neutral-700/50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wide text-neutral-400 uppercase">
                    Lineup:
                  </span>
                  {injuryFilters.map((filter) => (
                    <button
                      key={filter.playerId}
                      type="button"
                      onClick={() => setFilterDrawerOpen(true)}
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                        filter.mode === "without"
                          ? "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300"
                          : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
                      )}
                    >
                      <span>
                        {filter.mode === "without" ? "Without" : "With"}
                      </span>
                      <span className="font-bold">{filter.playerName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bar Chart Content + Comparison Panel */}
          <div
            className={cn(
              "flex gap-4 p-5",
              hasActiveFilters ? "flex-col lg:flex-row lg:items-stretch" : "",
            )}
          >
            {/* Chart - Takes 70% when comparison is shown, vertically centered */}
            <div
              className={cn(
                "flex flex-col",
                hasActiveFilters ? "lg:w-[70%] lg:justify-center" : "w-full",
              )}
            >
              {boxScoresLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="flex animate-pulse flex-col items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
                    <span className="text-sm text-neutral-500">
                      Loading game data...
                    </span>
                  </div>
                </div>
              ) : (
                <GameLogChart
                  sport={sport}
                  games={filteredGames}
                  line={customLine ?? profile.line}
                  market={profile.market}
                  upcomingGameDate={profile.gameDate}
                  upcomingOpponentAbbr={profile.opponentTeamAbbr}
                  upcomingHomeAway={profile.homeAway}
                  profileGameLogs={profileGameLogsForChart as any}
                  onLineChange={setCustomLine}
                  quickFilters={quickFilters}
                  onQuickFilterToggle={toggleQuickFilter}
                  onQuickFiltersClear={() => setQuickFilters(new Set())}
                  odds={oddsForChart}
                  opponentDvpRanks={opponentDvpRanks}
                  playTypeRanksMap={playTypeRanksMap}
                  shotZoneRanksMap={shotZoneRanksMap}
                  activeMatchupFilters={activeMatchupFilterLines}
                />
              )}
            </div>

            {/* Comparison Panel - 30% width when filters active */}
            {hasActiveFilters && !boxScoresLoading && (
              <div className="flex flex-col justify-center lg:w-[30%] lg:border-l lg:border-neutral-200/60 lg:pl-4 lg:dark:border-neutral-700/60">
                <div className="rounded-xl border border-neutral-200/60 bg-gradient-to-br from-neutral-50 to-white p-4 dark:border-neutral-700/60 dark:from-neutral-800/50 dark:to-neutral-900">
                  {/* Header */}
                  <div className="mb-4 flex items-center gap-2 border-b border-neutral-200/60 pb-3 dark:border-neutral-700/60">
                    <div className="from-brand h-6 w-1 rounded-full bg-gradient-to-b to-purple-500" />
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                        Filter Impact
                      </h3>
                      <p className="text-[10px] text-neutral-500">
                        Baseline vs Filtered
                      </p>
                    </div>
                  </div>

                  {/* Comparison Table */}
                  <div className="space-y-3">
                    {/* Column Headers */}
                    <div className="grid grid-cols-3 gap-2 border-b border-neutral-200/40 pb-2 text-[9px] font-bold tracking-wider text-neutral-400 uppercase dark:border-neutral-700/40">
                      <span>Stat</span>
                      <span className="text-center">Baseline</span>
                      <span className="text-right">Filtered</span>
                    </div>

                    {/* Hit Rate Row */}
                    <div className="grid grid-cols-3 items-center gap-2">
                      <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                        Hit Rate
                      </span>
                      <span className="text-center text-sm font-bold text-neutral-500 tabular-nums">
                        {baselineStats.hitRate !== null
                          ? `${baselineStats.hitRate}%`
                          : "—"}
                      </span>
                      <div className="flex items-center justify-end gap-1 text-right">
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            chartStats.hitRate !== null &&
                              baselineStats.hitRate !== null
                              ? chartStats.hitRate > baselineStats.hitRate
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.hitRate < baselineStats.hitRate
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-neutral-600 dark:text-neutral-300"
                              : "text-neutral-600 dark:text-neutral-300",
                          )}
                        >
                          {chartStats.hitRate !== null
                            ? `${chartStats.hitRate}%`
                            : "—"}
                        </span>
                        {chartStats.hitRate !== null &&
                          baselineStats.hitRate !== null &&
                          chartStats.hitRate !== baselineStats.hitRate && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                chartStats.hitRate > baselineStats.hitRate
                                  ? "text-emerald-500"
                                  : "text-red-500",
                              )}
                            >
                              {chartStats.hitRate > baselineStats.hitRate
                                ? "+"
                                : ""}
                              {chartStats.hitRate - baselineStats.hitRate}
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Average Row */}
                    <div className="grid grid-cols-3 items-center gap-2">
                      <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                        Average
                      </span>
                      <span className="text-center text-sm font-bold text-neutral-500 tabular-nums">
                        {baselineStats.avg?.toFixed(1) ?? "—"}
                      </span>
                      <div className="flex items-center justify-end gap-1 text-right">
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            chartStats.avg !== null &&
                              baselineStats.avg !== null
                              ? chartStats.avg > baselineStats.avg
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.avg < baselineStats.avg
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-neutral-600 dark:text-neutral-300"
                              : "text-neutral-600 dark:text-neutral-300",
                          )}
                        >
                          {chartStats.avg?.toFixed(1) ?? "—"}
                        </span>
                        {chartStats.avg !== null &&
                          baselineStats.avg !== null &&
                          chartStats.avg !== baselineStats.avg && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                chartStats.avg > baselineStats.avg
                                  ? "text-emerald-500"
                                  : "text-red-500",
                              )}
                            >
                              {chartStats.avg > baselineStats.avg ? "+" : ""}
                              {(chartStats.avg - baselineStats.avg).toFixed(1)}
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Games Row */}
                    <div className="grid grid-cols-3 items-center gap-2">
                      <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                        Games
                      </span>
                      <span className="text-center text-sm font-bold text-neutral-500 tabular-nums">
                        {baselineStats.total}
                      </span>
                      <div className="flex items-center justify-end gap-1 text-right">
                        <span className="text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                          {chartStats.total}
                        </span>
                        {chartStats.total !== baselineStats.total && (
                          <span className="text-[10px] font-semibold text-neutral-400">
                            ({chartStats.total < baselineStats.total ? "" : "+"}
                            {chartStats.total - baselineStats.total})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="my-2 h-px bg-neutral-200/60 dark:bg-neutral-700/60" />

                    {/* Minutes Row */}
                    <div className="grid grid-cols-3 items-center gap-2">
                      <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                        Minutes
                      </span>
                      <span className="text-center text-xs font-semibold text-neutral-400 tabular-nums">
                        {baselineStats.minutes?.toFixed(1) ?? "—"}
                      </span>
                      <div className="flex items-center justify-end gap-1 text-right">
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            chartStats.minutes !== null &&
                              baselineStats.minutes !== null
                              ? chartStats.minutes > baselineStats.minutes
                                ? "text-emerald-500 dark:text-emerald-400"
                                : chartStats.minutes < baselineStats.minutes
                                  ? "text-red-400"
                                  : "text-neutral-500"
                              : "text-neutral-500",
                          )}
                        >
                          {chartStats.minutes?.toFixed(1) ?? "—"}
                        </span>
                      </div>
                    </div>

                    {/* Usage Row */}
                    <div className="grid grid-cols-3 items-center gap-2">
                      <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                        Usage %
                      </span>
                      <span className="text-center text-xs font-semibold text-neutral-400 tabular-nums">
                        {baselineStats.usage !== null
                          ? `${baselineStats.usage.toFixed(1)}%`
                          : "—"}
                      </span>
                      <div className="flex items-center justify-end gap-1 text-right">
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            chartStats.usage !== null &&
                              baselineStats.usage !== null
                              ? chartStats.usage > baselineStats.usage
                                ? "text-emerald-500 dark:text-emerald-400"
                                : chartStats.usage < baselineStats.usage
                                  ? "text-red-400"
                                  : "text-neutral-500"
                              : "text-neutral-500",
                          )}
                        >
                          {chartStats.usage !== null
                            ? `${chartStats.usage.toFixed(1)}%`
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {/* FGA Row */}
                    <div className="grid grid-cols-3 items-center gap-2">
                      <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                        FGA
                      </span>
                      <span className="text-center text-xs font-semibold text-neutral-400 tabular-nums">
                        {baselineStats.fga?.toFixed(1) ?? "—"}
                      </span>
                      <div className="flex items-center justify-end gap-1 text-right">
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            chartStats.fga !== null &&
                              baselineStats.fga !== null
                              ? chartStats.fga > baselineStats.fga
                                ? "text-emerald-500 dark:text-emerald-400"
                                : chartStats.fga < baselineStats.fga
                                  ? "text-red-400"
                                  : "text-neutral-500"
                              : "text-neutral-500",
                          )}
                        >
                          {chartStats.fga?.toFixed(1) ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* View All Stats Button */}
                  <div className="mt-4 border-t border-neutral-200/60 pt-3 dark:border-neutral-700/60">
                    <button
                      type="button"
                      onClick={() => setComparisonModalOpen(true)}
                      className="text-brand bg-brand/10 hover:bg-brand/20 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      View All Stats
                    </button>

                    {/* Filter Summary */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Array.from(quickFilters)
                        .slice(0, 3)
                        .map((filter) => (
                          <span
                            key={filter}
                            className="bg-brand/10 text-brand rounded px-1.5 py-0.5 text-[9px] font-semibold"
                          >
                            {QUICK_FILTER_LABELS[filter] || filter}
                          </span>
                        ))}
                      {injuryFilters.slice(0, 2).map((f) => (
                        <span
                          key={f.playerId}
                          className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                        >
                          {f.mode === "without" ? "−" : "+"}{" "}
                          {f.playerName.split(" ").pop()}
                        </span>
                      ))}
                      {(quickFilters.size > 3 || injuryFilters.length > 2) && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium text-neutral-400">
                          +
                          {Math.max(0, quickFilters.size - 3) +
                            Math.max(0, injuryFilters.length - 2)}{" "}
                          more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* End of chartCaptureRef wrapper */}

      {/* ═══════════════════════════════════════════════════════════════════
          TEAM ROSTERS & INJURIES (Combined) - Collapsible
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <RosterAndInjuries
          playerTeamId={profile.teamId}
          opponentTeamId={profile.opponentTeamId}
          currentPlayerId={profile.playerId}
          filters={injuryFilters}
          onFiltersChange={setInjuryFilters}
          season={sport === "wnba" ? rosterSeason : undefined}
          onSeasonChange={
            sport === "wnba" ? handleRosterSeasonChange : undefined
          }
          sport={sport}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MATCHUP ANALYSIS - Two Column Layout (Defense vs Position)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Defensive Analysis */}
        <DefensiveAnalysis
          playerId={profile.playerId}
          opponentTeamId={profile.opponentTeamId}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          position={profile.position}
          sport={sport}
        />

        {/* Right Column: Position vs Team Game Log */}
        <PositionVsTeam
          position={profile.position}
          opponentTeamId={profile.opponentTeamId}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          market={profile.market}
          currentLine={profile.line}
          sport={sport}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PLAY TYPE & SHOOTING ZONES - Two Column Layout
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Play Type Analysis */}
        <PlayTypeAnalysis
          playerId={profile.playerId}
          opponentTeamId={profile.opponentTeamId}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          playerName={profile.playerName}
          sport={sport}
        />

        {/* Right Column: Shooting Zones */}
        <ShootingZones
          playerId={profile.playerId}
          opponentTeamId={profile.opponentTeamId}
          playerName={profile.playerName}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          sport={sport}
        />
      </div>

      <div className="mt-6">
        <BasketballShotLocationMap
          sport={sport}
          playerId={profile.playerId}
          playerName={profile.playerName}
          season={sport === "wnba" ? undefined : "2025-26"}
          seasonType="Regular Season"
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
          gameDate={profile.gameDate}
          homeTeamName={profile.homeTeamName}
          awayTeamName={profile.awayTeamName}
          startTime={profile.startTime}
          anchorTeam={profile.teamAbbr || profile.teamName}
          playerName={profile.playerName}
          sport={sport}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ALTERNATE LINES MATRIX
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <AlternateLinesMatrix
          sport={sport}
          eventId={profile.eventId}
          selKey={profile.selKey}
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
          sport={sport}
          playerId={profile.playerId}
          market={profile.market}
          currentLine={profile.line}
          prefetchedGames={boxScoreGames}
          prefetchedSeasonSummary={seasonSummary}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FULL STATS COMPARISON MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {comparisonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setComparisonModalOpen(false)}
          />

          {/* Modal */}
          <div className="relative mx-4 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
            {/* Header */}
            <div className="from-brand/5 flex items-center justify-between border-b border-neutral-200 bg-gradient-to-r to-purple-500/5 px-6 py-4 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="bg-brand/10 rounded-xl p-2">
                  <svg
                    className="text-brand h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Full Stats Comparison
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Baseline ({baselineStats.total} games) vs Filtered (
                    {chartStats.total} games)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComparisonModalOpen(false)}
                className="rounded-lg p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[calc(85vh-80px)] overflow-y-auto p-6">
              {/* Active Filters Summary */}
              <div className="mb-6 rounded-xl border border-neutral-200/60 bg-neutral-50 p-4 dark:border-neutral-700/60 dark:bg-neutral-800/50">
                <p className="mb-2 text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                  Active Filters
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(quickFilters).map((filter) => (
                    <span
                      key={filter}
                      className="bg-brand/10 text-brand rounded-lg px-2 py-1 text-xs font-semibold"
                    >
                      {QUICK_FILTER_LABELS[filter] || filter}
                    </span>
                  ))}
                  {injuryFilters.map((f) => (
                    <span
                      key={f.playerId}
                      className="rounded-lg bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                    >
                      {f.mode === "without" ? "Without" : "With"} {f.playerName}
                    </span>
                  ))}
                  {chartFilters.minutes && (
                    <span className="rounded-lg bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                      Minutes: {chartFilters.minutes.min.toFixed(0)}-
                      {chartFilters.minutes.max.toFixed(0)}
                    </span>
                  )}
                  {chartFilters.usage && (
                    <span className="rounded-lg bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                      Usage: {(chartFilters.usage.min * 100).toFixed(0)}%-
                      {(chartFilters.usage.max * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="space-y-6">
                {/* Primary Stats */}
                <div>
                  <h3 className="mb-3 text-xs font-bold tracking-wider text-neutral-400 uppercase">
                    Primary Stats
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500">
                            Stat
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-neutral-500">
                            Baseline
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-neutral-500">
                            Filtered
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-neutral-500">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                        {/* Hit Rate */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            Hit Rate
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.hitRate !== null
                              ? `${baselineStats.hitRate}%`
                              : "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.hitRate !== null &&
                                baselineStats.hitRate !== null
                                ? chartStats.hitRate > baselineStats.hitRate
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : chartStats.hitRate < baselineStats.hitRate
                                    ? "text-red-500 dark:text-red-400"
                                    : "text-neutral-600 dark:text-neutral-300"
                                : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.hitRate !== null
                              ? `${chartStats.hitRate}%`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.hitRate !== null &&
                              baselineStats.hitRate !== null && (
                                <span
                                  className={cn(
                                    "rounded-lg px-2 py-1 text-xs font-bold",
                                    chartStats.hitRate > baselineStats.hitRate
                                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : chartStats.hitRate <
                                          baselineStats.hitRate
                                        ? "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
                                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
                                  )}
                                >
                                  {chartStats.hitRate > baselineStats.hitRate
                                    ? "+"
                                    : ""}
                                  {chartStats.hitRate - baselineStats.hitRate}%
                                </span>
                              )}
                          </td>
                        </tr>
                        {/* Points */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            Points
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.pts?.toFixed(1) ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.pts &&
                                baselineStats.pts &&
                                chartStats.pts > baselineStats.pts
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.pts &&
                                    baselineStats.pts &&
                                    chartStats.pts < baselineStats.pts
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.pts?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.pts && baselineStats.pts && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.pts > baselineStats.pts
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.pts < baselineStats.pts
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.pts > baselineStats.pts ? "+" : ""}
                                {(chartStats.pts - baselineStats.pts).toFixed(
                                  1,
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* Rebounds */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            Rebounds
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.reb?.toFixed(1) ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.reb &&
                                baselineStats.reb &&
                                chartStats.reb > baselineStats.reb
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.reb &&
                                    baselineStats.reb &&
                                    chartStats.reb < baselineStats.reb
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.reb?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.reb && baselineStats.reb && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.reb > baselineStats.reb
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.reb < baselineStats.reb
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.reb > baselineStats.reb ? "+" : ""}
                                {(chartStats.reb - baselineStats.reb).toFixed(
                                  1,
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* Assists */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            Assists
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.ast?.toFixed(1) ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.ast &&
                                baselineStats.ast &&
                                chartStats.ast > baselineStats.ast
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.ast &&
                                    baselineStats.ast &&
                                    chartStats.ast < baselineStats.ast
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.ast?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.ast && baselineStats.ast && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.ast > baselineStats.ast
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.ast < baselineStats.ast
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.ast > baselineStats.ast ? "+" : ""}
                                {(chartStats.ast - baselineStats.ast).toFixed(
                                  1,
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Shooting Stats */}
                <div>
                  <h3 className="mb-3 text-xs font-bold tracking-wider text-neutral-400 uppercase">
                    Shooting
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500">
                            Stat
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-neutral-500">
                            Baseline
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-neutral-500">
                            Filtered
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-neutral-500">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                        {/* FGA */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            FGA
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.fga?.toFixed(1) ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.fga &&
                                baselineStats.fga &&
                                chartStats.fga > baselineStats.fga
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.fga &&
                                    baselineStats.fga &&
                                    chartStats.fga < baselineStats.fga
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.fga?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.fga && baselineStats.fga && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.fga > baselineStats.fga
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.fga < baselineStats.fga
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.fga > baselineStats.fga ? "+" : ""}
                                {(chartStats.fga - baselineStats.fga).toFixed(
                                  1,
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* 3PA */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            3PA
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.fg3a?.toFixed(1) ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.fg3a &&
                                baselineStats.fg3a &&
                                chartStats.fg3a > baselineStats.fg3a
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.fg3a &&
                                    baselineStats.fg3a &&
                                    chartStats.fg3a < baselineStats.fg3a
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.fg3a?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.fg3a && baselineStats.fg3a && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.fg3a > baselineStats.fg3a
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.fg3a < baselineStats.fg3a
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.fg3a > baselineStats.fg3a
                                  ? "+"
                                  : ""}
                                {(chartStats.fg3a - baselineStats.fg3a).toFixed(
                                  1,
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* 3PM */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            3PM
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.fg3m?.toFixed(1) ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.fg3m &&
                                baselineStats.fg3m &&
                                chartStats.fg3m > baselineStats.fg3m
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.fg3m &&
                                    baselineStats.fg3m &&
                                    chartStats.fg3m < baselineStats.fg3m
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.fg3m?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.fg3m && baselineStats.fg3m && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.fg3m > baselineStats.fg3m
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.fg3m < baselineStats.fg3m
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.fg3m > baselineStats.fg3m
                                  ? "+"
                                  : ""}
                                {(chartStats.fg3m - baselineStats.fg3m).toFixed(
                                  1,
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* FTA */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            FTA
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.fta?.toFixed(1) ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.fta &&
                                baselineStats.fta &&
                                chartStats.fta > baselineStats.fta
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.fta &&
                                    baselineStats.fta &&
                                    chartStats.fta < baselineStats.fta
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.fta?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.fta && baselineStats.fta && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.fta > baselineStats.fta
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.fta < baselineStats.fta
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.fta > baselineStats.fta ? "+" : ""}
                                {(chartStats.fta - baselineStats.fta).toFixed(
                                  1,
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Role & Context Stats */}
                <div>
                  <h3 className="mb-3 text-xs font-bold tracking-wider text-neutral-400 uppercase">
                    Role & Context
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500">
                            Stat
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-neutral-500">
                            Baseline
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-neutral-500">
                            Filtered
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-neutral-500">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                        {/* Minutes */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            Minutes
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.minutes?.toFixed(1) ?? "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.minutes &&
                                baselineStats.minutes &&
                                chartStats.minutes > baselineStats.minutes
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.minutes &&
                                    baselineStats.minutes &&
                                    chartStats.minutes < baselineStats.minutes
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.minutes?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.minutes && baselineStats.minutes && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.minutes > baselineStats.minutes
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.minutes < baselineStats.minutes
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.minutes > baselineStats.minutes
                                  ? "+"
                                  : ""}
                                {(
                                  chartStats.minutes - baselineStats.minutes
                                ).toFixed(1)}
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* Usage */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            Usage %
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.usage !== null
                              ? `${baselineStats.usage.toFixed(1)}%`
                              : "—"}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-center text-sm font-bold tabular-nums",
                              chartStats.usage &&
                                baselineStats.usage &&
                                chartStats.usage > baselineStats.usage
                                ? "text-emerald-600 dark:text-emerald-400"
                                : chartStats.usage &&
                                    baselineStats.usage &&
                                    chartStats.usage < baselineStats.usage
                                  ? "text-red-500"
                                  : "text-neutral-600 dark:text-neutral-300",
                            )}
                          >
                            {chartStats.usage !== null
                              ? `${chartStats.usage.toFixed(1)}%`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {chartStats.usage && baselineStats.usage && (
                              <span
                                className={cn(
                                  "rounded-lg px-2 py-1 text-xs font-bold",
                                  chartStats.usage > baselineStats.usage
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                                    : chartStats.usage < baselineStats.usage
                                      ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                      : "bg-neutral-100 text-neutral-500",
                                )}
                              >
                                {chartStats.usage > baselineStats.usage
                                  ? "+"
                                  : ""}
                                {(
                                  chartStats.usage - baselineStats.usage
                                ).toFixed(1)}
                                %
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* Games */}
                        <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-white">
                            Sample Size
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {baselineStats.total} games
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {chartStats.total} games
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-bold text-neutral-500 dark:bg-neutral-800">
                              {chartStats.total - baselineStats.total}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FILTER DRAWER (Right Slide-Over Panel)
          ═══════════════════════════════════════════════════════════════════ */}
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        quickFilters={quickFilters}
        onQuickFilterToggle={toggleQuickFilter}
        onQuickFiltersClear={() => setQuickFilters(new Set())}
        chartFilters={chartFilters}
        onChartFiltersChange={setChartFilters}
        gamesForFilters={gamesForChartFilters}
        allSeasonGames={boxScoreGames}
        market={profile.market}
        sport={sport === "wnba" ? "wnba" : "nba"}
        hasDvpData={opponentDvpRanks.size > 0}
        playTypeMatchup={playTypeMatchupData}
        shotZoneMatchup={shotZoneMatchupData}
        opponentTeamAbbr={profile.opponentTeamAbbr}
        // Play type and shot zone ranks for filtering
        playTypeRanks={playTypeRanks}
        playTypeDisplayNames={playTypeDisplayNames}
        shotZoneRanks={shotZoneRanks}
        playTypeFilters={playTypeFilters}
        onPlayTypeFiltersChange={setPlayTypeFilters}
        shotZoneFilters={shotZoneFilters}
        onShotZoneFiltersChange={setShotZoneFilters}
        activeQuickFiltersCount={quickFilters.size}
        activeChartFiltersCount={
          [
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
          ].filter(Boolean).length
        }
        activeInjuryFiltersCount={injuryFilters.length}
        // Lineup Context - Pass injury filters for teammate filtering
        injuryFilters={injuryFilters}
        onInjuryFiltersChange={setInjuryFilters}
        availableTeammates={
          playersOutData?.teammates_out?.map((t) => {
            const m = profile.market?.toLowerCase() || "";
            const marketAvg =
              m.includes("point") || m.includes("pts")
                ? t.avg_pts
                : m.includes("rebound") || m.includes("reb")
                  ? t.avg_reb
                  : m.includes("assist") || m.includes("ast")
                    ? t.avg_ast
                    : t.avg_pts;
            // Get injury status and season avg from roster data
            const rosterInfo = injuryStatusMap.get(t.player_id);
            return {
              playerId: t.player_id,
              nbaPlayerId: t.nba_player_id ?? null,
              name: t.name,
              teamId: profile.teamId,
              gamesOut: t.games_out ?? 0,
              avgImpact: marketAvg,
              seasonAvg: rosterInfo?.avg ?? marketAvg,
              injuryStatus: rosterInfo?.status ?? null,
            };
          }) ?? []
        }
        // Filter Impact Preview
        filteredGamesCount={chartStats.total}
        totalGamesCount={totalGamesAvailable}
        filteredHitRate={chartStats.hitRate}
      />
    </div>
  );
}
