"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, ChevronUp, ChevronDown, ChevronsUpDown, Clock3, Flame, Info, HeartPulse, Loader2, Search, ShieldCheck, Target, Trophy, X, ArrowDown, SlidersHorizontal, Check, User } from "lucide-react";
import Chart from "@/icons/chart";
// Disabled: usePrefetchPlayer was causing excessive API calls on hover
// import { usePrefetchPlayer } from "@/hooks/use-prefetch-player";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { OddsDropdown } from "@/components/hit-rates/odds-dropdown";
// MiniSparkline removed - using color-coded percentage cells instead for performance
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { usePlayerBoxScores, type BoxScoreGame } from "@/hooks/use-player-box-scores";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import { getTeamLogoUrl, getStandardAbbreviation } from "@/lib/data/team-mappings";
import { getHitRateTableConfig } from "@/lib/hit-rates/table-config";
import { Checkbox } from "@/components/ui/checkbox";

// Map of combo market keys to their full descriptions (only abbreviated combos need tooltips)
const COMBO_MARKET_DESCRIPTIONS: Record<string, string> = {
  "player_points_rebounds_assists": "Points + Rebounds + Assists",
  "player_points_rebounds": "Points + Rebounds",
  "player_points_assists": "Points + Assists",
  "player_rebounds_assists": "Rebounds + Assists",
};

// Check if a market is a combo market that needs a tooltip
const getMarketTooltip = (market: string): string | null => {
  return COMBO_MARKET_DESCRIPTIONS[market] || null;
};

type SortField = "line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank";
type SortDirection = "asc" | "desc";

// Market options for filter
const DEFAULT_MARKET_OPTIONS = [
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
  { value: "player_turnovers", label: "Turnovers" },
];

// Position options for filter
const POSITION_OPTIONS = [
  { value: "PG", label: "Point Guard" },
  { value: "SG", label: "Shooting Guard" },
  { value: "SF", label: "Small Forward" },
  { value: "PF", label: "Power Forward" },
  { value: "C", label: "Center" },
];

// Max matchup rank value (0 = all/disabled)
const MAX_MATCHUP_RANK_LIMIT = 30;

interface HitRateTableProps {
  sport?: "nba" | "mlb" | "wnba";
  rows: HitRateProfile[];
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: HitRateProfile) => void;
  // Pagination props
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  totalCount?: number;
  // Filter props
  selectedMarkets: string[];
  marketOptions?: Array<{ value: string; label: string }>;
  onMarketsChange: (markets: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Sort props
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  // Scroll position restoration
  scrollRef?: React.RefObject<HTMLDivElement>;
  initialScrollTop?: number;
  // Advanced filter props (controlled from parent)
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (value: boolean) => void;
  // Callback to report which profiles have odds
  onOddsAvailabilityChange?: (idsWithOdds: Set<string>) => void;
  // Optional upgrade banner to show after filters (for gated access)
  upgradeBanner?: React.ReactNode;
  // Optional content to render after the table (for blurred preview rows)
  bottomContent?: React.ReactNode;
  // Index after which rows should be blurred (for gated access preview)
  blurAfterIndex?: number;
  // Optional games filter element
  gamesFilter?: React.ReactNode;
}

const formatPercentage = (value: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
};

const formatRoundedPercentage = (value: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
};

const formatOddsPrice = (price: number | null | undefined) => {
  if (price === null || price === undefined) return "—";
  return price > 0 ? `+${price}` : `${price}`;
};

const getPrimaryHitRate = (row: HitRateProfile) => row.last10Pct ?? row.last5Pct ?? row.last20Pct ?? row.seasonPct;

const getHitRateTextColor = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "text-neutral-500 dark:text-neutral-400";
  if (value >= 70) return "text-emerald-500 dark:text-emerald-400";
  if (value >= 50) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
};

const getStreakDisplay = (streak: number | null | undefined) => {
  if (streak === null || streak === undefined) return "—";
  if (streak > 0) return `W ${streak}`;
  if (streak < 0) return `L ${Math.abs(streak)}`;
  return "0";
};

const getStreakColor = (streak: number | null | undefined) => {
  if (streak === null || streak === undefined || streak === 0) return "text-neutral-500 dark:text-neutral-400";
  return streak > 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400";
};

const getMarketStatValue = (game: BoxScoreGame, market: string): number => {
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
    case "player_hits": return game.mlbHits ?? 0;
    case "player_home_runs": return game.mlbHomeRuns ?? 0;
    case "player_runs_scored": return game.mlbRunsScored ?? 0;
    case "player_rbi": return game.mlbRbi ?? 0;
    case "player_total_bases": return game.mlbTotalBases ?? 0;
    case "pitcher_strikeouts": return game.mlbPitcherStrikeouts ?? 0;
    default: return game.pts;
  }
};

type RecentTrendMap = Record<string, BoxScoreGame[]>;

async function fetchRecentTrends(
  sport: "nba" | "wnba",
  playerIds: number[]
): Promise<RecentTrendMap> {
  if (playerIds.length === 0) return {};

  const params = new URLSearchParams();
  params.set("playerIds", playerIds.join(","));
  params.set("limit", "10");

  const res = await fetch(`/api/${sport}/hit-rates/recent-trends?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load recent trends");
  }

  const payload = await res.json();
  return payload.trends ?? {};
}

const getContextPillClass = (rank: number | null, sport: "nba" | "mlb" | "wnba") => {
  const tier = getMatchupTier(rank, getDefenseTotalTeams(sport));
  switch (tier) {
    case "elite":
      return "border-[color-mix(in_oklab,var(--accent)_38%,transparent)] bg-[color-mix(in_oklab,var(--accent)_17%,var(--card))] text-[color-mix(in_oklab,var(--accent)_92%,var(--text))]";
    case "strong":
      return "border-[color-mix(in_oklab,var(--accent)_24%,transparent)] bg-[color-mix(in_oklab,var(--accent)_9%,var(--card))] text-[color-mix(in_oklab,var(--accent)_78%,var(--text))]";
    case "bad":
      return "border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-300";
    case "worst":
      return "border-red-500/35 bg-red-500/15 text-red-600 dark:text-red-200";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400";
  }
};

const getPacePillClass = (label: "pace_up" | "pace_down" | "neutral" | null | undefined) => {
  if (label === "pace_up") {
    return "border-[color-mix(in_oklab,var(--accent)_28%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,var(--card))] text-[color-mix(in_oklab,var(--accent)_82%,var(--text))]";
  }
  if (label === "pace_down") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300";
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400";
};

// Hit rate badge class - matches alternate lines matrix colors
const hitRateBadgeClass = (value: number | null) => {
  if (value === null || value === undefined) {
    return "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500";
  }
  if (value >= 75) {
    return "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
  if (value >= 60) {
    return "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-500";
  }
  if (value >= 50) {
    return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400";
  }
  if (value >= 35) {
    return "bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400";
  }
  return "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400";
};

// Get progress bar color based on hit rate
const getProgressBarColor = (value: number | null) => {
  if (value === null || value === undefined) return "bg-neutral-300 dark:bg-neutral-600";
  if (value >= 75) return "bg-emerald-500";
  if (value >= 60) return "bg-emerald-400";
  if (value >= 50) return "bg-amber-400";
  if (value >= 35) return "bg-orange-400";
  return "bg-red-400";
};

const getHitRateHeatClass = (value: number | null) => {
  if (value === null || value === undefined) {
    return "bg-neutral-50 text-neutral-500 dark:bg-neutral-900/80 dark:text-neutral-500";
  }
  if (value >= 75) {
    return "bg-[color-mix(in_oklab,var(--accent)_27%,var(--card))] text-[color-mix(in_oklab,var(--accent)_95%,var(--text))]";
  }
  if (value >= 60) {
    return "bg-[color-mix(in_oklab,var(--accent)_18%,var(--card))] text-[color-mix(in_oklab,var(--accent)_82%,var(--text))]";
  }
  if (value >= 50) {
    return "bg-amber-500/18 text-amber-600 dark:text-amber-300";
  }
  if (value >= 35) {
    return "bg-orange-500/18 text-orange-600 dark:text-orange-300";
  }
  return "bg-red-500/18 text-red-600 dark:text-red-300";
};

const getHitRateBorderClass = (value: number | null) => {
  if (value === null || value === undefined) return "border-neutral-200/70 dark:border-neutral-800/80";
  if (value >= 60) return "border-[color-mix(in_oklab,var(--accent)_24%,transparent)]";
  if (value >= 50) return "border-amber-500/20";
  if (value >= 35) return "border-orange-500/20";
  return "border-red-500/20";
};

const formatHitRateCount = (value: number | null, sampleSize?: number | null) => {
  if (value === null || value === undefined || !sampleSize || sampleSize <= 0) return null;
  const hits = Math.round((value / 100) * sampleSize);
  return `${hits}/${sampleSize}`;
};

// Heat-map hit rate cell with sample count.
const HitRateCell = ({ 
  value, 
  sampleSize,
  subLabel,
  isBlurred = false 
}: { 
  value: number | null; 
  sampleSize?: number | null;
  subLabel?: string;
  isBlurred?: boolean;
}) => {
  const count = formatHitRateCount(value, sampleSize);
  const secondary = count ?? subLabel ?? "—";
  
  return (
    <div
      className={cn(
        "mx-auto flex min-h-[58px] w-full max-w-[88px] flex-col items-center justify-center rounded-md border px-2 py-2 text-center transition-colors duration-200",
        getHitRateHeatClass(value),
        getHitRateBorderClass(value),
        isBlurred && "blur-[3px] opacity-60"
      )}
    >
      <span className="text-[15px] font-black leading-none tabular-nums">
        {value !== null && value !== undefined ? `${Math.round(value)}%` : "—"}
      </span>
      <span className="mt-1 text-[11px] font-bold leading-none tabular-nums opacity-75">
        {secondary}
      </span>
    </div>
  );
};

const MiniSignalBar = ({ value }: { value: number | null }) => {
  const percentage = Math.min(100, Math.max(0, value ?? 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <div
        className={cn("h-full rounded-full transition-all duration-300", getProgressBarColor(value))}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const MetricRail = ({ label, value }: { label: string; value: number | null }) => (
  <div className="min-w-0">
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-500">
        {label}
      </span>
      <span className={cn("text-sm font-black tabular-nums", getHitRateTextColor(value))}>
        {formatRoundedPercentage(value)}
      </span>
    </div>
    <MiniSignalBar value={value} />
  </div>
);

const RecentTrendBars = ({
  row,
  games,
  isLoading,
  isBlurred = false,
  sport,
}: {
  row: HitRateProfile;
  games: BoxScoreGame[] | undefined;
  isLoading: boolean;
  isBlurred?: boolean;
  sport: "nba" | "mlb" | "wnba";
}) => {
  if (isBlurred) {
    return (
      <div className="flex h-20 items-end gap-1.5 opacity-45 blur-[2px]">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex flex-1 items-end">
            <div className="w-full rounded-sm bg-neutral-300 dark:bg-neutral-700" style={{ height: `${14 + (index % 5) * 5}px` }} />
          </div>
        ))}
      </div>
    );
  }

  if (sport === "mlb") {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-neutral-200/70 bg-neutral-50/70 px-3 text-[11px] font-bold text-neutral-400 dark:border-neutral-800/70 dark:bg-neutral-900/70">
        Game logs soon
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-20 items-end gap-1.5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex flex-1 items-end">
            <div className="w-full animate-pulse rounded-sm bg-neutral-200 dark:bg-neutral-800" style={{ height: `${16 + (index % 4) * 7}px` }} />
          </div>
        ))}
      </div>
    );
  }

  const chartGames = (games ?? []).slice(0, 10).reverse();
  if (chartGames.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-neutral-200/70 bg-neutral-50/70 px-3 text-[11px] font-bold text-neutral-400 dark:border-neutral-800/70 dark:bg-neutral-900/70">
        No recent games
      </div>
    );
  }

  const values = chartGames.map((game) => getMarketStatValue(game, row.market));
  const maxValue = Math.max(row.line ?? 0, ...values, 1);
  const linePercent = row.line !== null ? Math.min(92, Math.max(10, (row.line / maxValue) * 88)) : null;

  return (
    <div className="relative h-20 rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-2 pb-2 pt-3 dark:border-neutral-800/70 dark:bg-neutral-950/55">
      {linePercent !== null && (
        <div
          className="pointer-events-none absolute left-2 right-2 border-t border-dashed border-brand/50"
          style={{ bottom: `${linePercent}%` }}
        >
          <span className="absolute -right-1 -top-2.5 rounded-[4px] border border-brand/25 bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] px-1 text-[9px] font-black tabular-nums text-brand">
            {row.line}
          </span>
        </div>
      )}
      <div className="relative flex h-full items-end gap-1.5">
        {chartGames.map((game, index) => {
          const value = getMarketStatValue(game, row.market);
          const hit = row.line !== null ? value >= row.line : false;
          const height = Math.max(10, (value / maxValue) * 56);
          const date = new Date(`${game.date}T00:00:00`);
          const dateLabel = Number.isNaN(date.getTime())
            ? game.date
            : date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });

          return (
            <Tooltip
              key={`${game.gameId}-${index}`}
              side="top"
              content={`${dateLabel} ${game.homeAway === "H" ? "vs" : "@"} ${game.opponentAbbr || "OPP"}: ${value}`}
            >
              <div className="group/trend flex min-w-0 flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-sm transition-all duration-200 group-hover/trend:translate-y-[-1px]",
                    hit
                      ? "bg-[linear-gradient(180deg,var(--accent-weak),var(--accent-strong))]"
                      : "bg-[linear-gradient(180deg,#fb7185,#dc2626)]"
                  )}
                  style={{ height }}
                />
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

const DailyInsightCard = ({
  icon,
  label,
  primary,
  secondary,
  accent = "brand",
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary: string;
  accent?: "brand" | "emerald" | "amber" | "red";
}) => {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
      : accent === "amber"
        ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
        : accent === "red"
          ? "text-red-500 bg-red-500/10 border-red-500/20"
          : "text-brand bg-brand/10 border-brand/20";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-neutral-200/80 bg-white/80 p-3.5 shadow-sm ring-1 ring-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md dark:border-neutral-800/80 dark:bg-neutral-900/70 dark:ring-white/[0.03]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", accentClass)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-500">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-black text-neutral-950 dark:text-white">
            {primary}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {secondary}
          </p>
        </div>
      </div>
    </div>
  );
};

export const DailyInsightStrip = ({
  rows,
  totalCount,
  sport,
}: {
  rows: HitRateProfile[];
  totalCount?: number;
  sport: "nba" | "mlb" | "wnba";
}) => {
  const insights = useMemo(() => {
    const usableRows = rows.filter((row) => !isPlayerOut(row.injuryStatus));
    const byL10 = [...usableRows]
      .filter((row) => row.last10Pct !== null)
      .sort((a, b) => (b.last10Pct ?? -1) - (a.last10Pct ?? -1) || (b.last10Avg ?? -1) - (a.last10Avg ?? -1));
    const byOdds = [...usableRows]
      .filter((row) => row.bestOdds)
      .sort((a, b) => (b.bestOdds?.price ?? -9999) - (a.bestOdds?.price ?? -9999));
    const byStreak = [...usableRows]
      .filter((row) => row.hitStreak !== null && row.hitStreak !== 0)
      .sort((a, b) => (b.hitStreak ?? -9999) - (a.hitStreak ?? -9999));
    const byWeakDefense = [...usableRows]
      .filter((row) => row.matchupRank !== null)
      .sort((a, b) => (b.matchupRank ?? -1) - (a.matchupRank ?? -1) || (getPrimaryHitRate(b) ?? -1) - (getPrimaryHitRate(a) ?? -1));
    const gameCount = new Set(usableRows.map((row) => row.gameId).filter(Boolean)).size;
    const propsCount = totalCount ?? rows.length;

    return {
      bestL10: byL10[0] ?? null,
      bestOdds: byOdds[0] ?? null,
      hotStreak: byStreak[0] ?? null,
      weakDefense: byWeakDefense[0] ?? null,
      gameCount,
      propsCount,
    };
  }, [rows, totalCount]);

  const sportLabel = sport.toUpperCase();
  const defenseTotalTeams = getDefenseTotalTeams(sport);
  const bestL10 = insights.bestL10;
  const bestOdds = insights.bestOdds;
  const hotStreak = insights.hotStreak;
  const weakDefense = insights.weakDefense;

  return (
    <div className="border-b border-neutral-200/80 bg-gradient-to-r from-neutral-50 via-white to-neutral-50 px-5 py-4 dark:border-neutral-800/80 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_1.15fr_0.95fr] md:grid-cols-2">
        <DailyInsightCard
          icon={<Trophy className="h-4 w-4" />}
          label="Highest L10"
          primary={bestL10 ? bestL10.playerName : "No signal yet"}
          secondary={bestL10 ? `${formatRoundedPercentage(bestL10.last10Pct)} on ${bestL10.line ?? "—"}+ ${formatMarketLabel(bestL10.market)}` : "Waiting on hit-rate rows"}
          accent="emerald"
        />
        <DailyInsightCard
          icon={<Target className="h-4 w-4" />}
          label="Best Odds"
          primary={bestOdds ? `${formatOddsPrice(bestOdds.bestOdds?.price)} ${bestOdds.playerName}` : "No odds yet"}
          secondary={bestOdds ? `${bestOdds.bestOdds?.book ?? "Book"} on ${bestOdds.line ?? "—"}+` : "Books will appear as feeds update"}
          accent={bestOdds && (bestOdds.bestOdds?.price ?? 0) > 0 ? "emerald" : "brand"}
        />
        <DailyInsightCard
          icon={<Flame className="h-4 w-4" />}
          label="Hot Streak"
          primary={hotStreak ? hotStreak.playerName : "No active run"}
          secondary={hotStreak ? `${getStreakDisplay(hotStreak.hitStreak)} on ${formatMarketLabel(hotStreak.market)}` : "Streaks reset as lines move"}
          accent="amber"
        />
        <DailyInsightCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Weak Defense"
          primary={weakDefense ? `${weakDefense.playerName} vs ${weakDefense.opponentTeamAbbr ?? "OPP"}` : "No DvP yet"}
          secondary={weakDefense ? `Opponent rank ${weakDefense.matchupRank}/${defenseTotalTeams}, L10 ${formatRoundedPercentage(weakDefense.last10Pct)}` : "Needs matchup ranks for this slate"}
          accent="brand"
        />
        <DailyInsightCard
          icon={<Clock3 className="h-4 w-4" />}
          label={`${sportLabel} Slate`}
          primary={`${insights.gameCount || "All"} games`}
          secondary={`${insights.propsCount} props in this view`}
          accent="brand"
        />
      </div>
    </div>
  );
};

const ExpandedRowPanel = ({
  row,
  sport,
  onOpenFullReport,
}: {
  row: HitRateProfile;
  sport: "nba" | "mlb" | "wnba";
  onOpenFullReport?: (row: HitRateProfile) => void;
}) => {
  const boxScoreSport = sport === "wnba" ? "wnba" : "nba";
  const { games: recentGames, isLoading: recentGamesLoading } = usePlayerBoxScores({
    playerId: row.playerId,
    sport: boxScoreSport,
    limit: 10,
    enabled: sport !== "mlb" && !!row.playerId,
  });
  const avgDelta = row.last10Avg !== null && row.line !== null ? row.last10Avg - row.line : null;
  const defenseTotalTeams = getDefenseTotalTeams(sport);
  const chartGames = useMemo(() => recentGames.slice(0, 10).reverse(), [recentGames]);
  const maxChartValue = useMemo(() => {
    const values = chartGames.map((game) => getMarketStatValue(game, row.market));
    const maxValue = Math.max(row.line ?? 0, ...values, 1);
    return Math.ceil(maxValue * 1.15);
  }, [chartGames, row.line, row.market]);
  const matchupText = row.matchupRank !== null
    ? row.matchupRank >= 21
      ? "Favorable defense"
      : row.matchupRank <= 10
        ? "Tough defense"
        : "Neutral defense"
    : "No defense rank";

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1.35fr_0.85fr_0.85fr]">
      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 ring-1 ring-black/[0.02] dark:border-neutral-800/80 dark:bg-neutral-950/70 dark:ring-white/[0.03]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-neutral-950 dark:text-white">
              Recent performance
            </p>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Last 10 games against {row.line ?? "—"}+ {formatMarketLabel(row.market)}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            Avg {row.last10Avg !== null ? row.last10Avg.toFixed(1) : "—"}
          </div>
        </div>

        <div className="relative mb-4 min-h-[180px] rounded-xl border border-neutral-200/70 bg-white/70 px-4 pb-3 pt-5 dark:border-neutral-800/70 dark:bg-neutral-900/70">
          {row.line !== null && (
            <div className="pointer-events-none absolute left-4 right-4 border-t border-dashed border-brand/60" style={{ bottom: `${12 + Math.min(86, Math.max(8, (row.line / maxChartValue) * 82))}%` }}>
              <span className="absolute -left-1 -top-3 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                {row.line}
              </span>
            </div>
          )}

          {sport === "mlb" ? (
            <div className="flex h-[145px] items-center justify-center text-center">
              <div>
                <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">Recent bars need MLB row game logs</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Tracked in the data notes for a batched table RPC.</p>
              </div>
            </div>
          ) : recentGamesLoading ? (
            <div className="flex h-[145px] items-end gap-2">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full animate-pulse rounded-t-md bg-neutral-200 dark:bg-neutral-800" style={{ height: `${38 + (index % 4) * 18}px` }} />
                  <div className="h-3 w-8 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                </div>
              ))}
            </div>
          ) : chartGames.length > 0 ? (
            <div className="flex h-[145px] items-end gap-2">
              {chartGames.map((game) => {
                const statValue = getMarketStatValue(game, row.market);
                const hit = row.line !== null ? statValue >= row.line : false;
                const height = Math.max(14, (statValue / maxChartValue) * 112);
                const date = new Date(`${game.date}T00:00:00`);
                const dateLabel = date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
                return (
                  <div key={game.gameId} className="group/bar flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className={cn("text-[10px] font-black tabular-nums", hit ? "text-emerald-500" : "text-red-500")}>
                      {statValue}
                    </span>
                    <div
                      className={cn(
                        "w-full max-w-8 rounded-t-md shadow-sm transition-all duration-200 group-hover/bar:scale-x-110",
                        hit
                          ? "bg-gradient-to-t from-emerald-700 to-emerald-400"
                          : "bg-gradient-to-t from-red-700 to-red-400"
                      )}
                      style={{ height }}
                    />
                    <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500">{dateLabel}</span>
                    {game.opponentAbbr && (
                      <img src={getTeamLogoUrl(game.opponentAbbr, sport)} alt={game.opponentAbbr} className="h-4 w-4 object-contain opacity-80" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[145px] items-center justify-center text-center">
              <div>
                <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">No recent games found</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">This will populate after box scores are available.</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricRail label="L5" value={row.last5Pct} />
          <MetricRail label="L10" value={row.last10Pct} />
          <MetricRail label="L20" value={row.last20Pct} />
          <MetricRail label="Season" value={row.seasonPct} />
        </div>
        <div className="mt-4 grid gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200/70 bg-white/70 px-3 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/70">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">L10 edge</span>
            <span className={cn("mt-1 block text-sm font-black tabular-nums", avgDelta === null ? "text-neutral-400" : avgDelta >= 0 ? "text-emerald-500" : "text-red-500")}>
              {avgDelta === null ? "—" : `${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(1)}`}
            </span>
          </div>
          <div className="rounded-lg border border-neutral-200/70 bg-white/70 px-3 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/70">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Streak</span>
            <span className={cn("mt-1 block text-sm font-black", getStreakColor(row.hitStreak))}>
              {getStreakDisplay(row.hitStreak)}
            </span>
          </div>
          <div className="rounded-lg border border-neutral-200/70 bg-white/70 px-3 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/70">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">H2H</span>
            <span className={cn("mt-1 block text-sm font-black tabular-nums", getHitRateTextColor(row.h2hPct))}>
              {formatRoundedPercentage(row.h2hPct)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/70">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand" />
          <p className="text-sm font-black text-neutral-950 dark:text-white">Matchup context</p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Opponent</span>
            <span className="inline-flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
              {row.opponentTeamAbbr && (
                <img src={getTeamLogoUrl(row.opponentTeamAbbr, sport)} alt={row.opponentTeamAbbr} className="h-5 w-5 object-contain" />
              )}
              {row.homeAway === "H" ? "vs" : "@"} {row.opponentTeamAbbr ?? row.opponentTeamName ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Defense rank</span>
            <span className={cn("font-black tabular-nums", getMatchupRankColor(row.matchupRank, sport))}>
              {row.matchupRank !== null ? `${row.matchupRank}/${defenseTotalTeams}` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Avg allowed</span>
            <span className="font-bold tabular-nums text-neutral-900 dark:text-white">
              {row.matchupAvgAllowed !== null ? row.matchupAvgAllowed.toFixed(1) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Read</span>
            <span className="font-bold text-neutral-900 dark:text-white">{matchupText}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Pace context</span>
            <span className={cn("font-bold tabular-nums", row.paceContext?.paceLabel === "pace_up" ? "text-emerald-500" : row.paceContext?.paceLabel === "pace_down" ? "text-amber-500" : "text-neutral-900 dark:text-white")}>
              {row.paceContext?.opponentRecent.l5Rank
                ? `Opp #${row.paceContext.opponentRecent.l5Rank}`
                : row.paceContext?.matchupL5Pace !== null && row.paceContext?.matchupL5Pace !== undefined
                  ? row.paceContext.matchupL5Pace.toFixed(1)
                  : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/70">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand" />
          <p className="text-sm font-black text-neutral-950 dark:text-white">Market pulse</p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Best over</span>
            <span className={cn("font-black tabular-nums", row.bestOdds ? "text-emerald-500" : "text-neutral-400")}>
              {formatOddsPrice(row.bestOdds?.price)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Book</span>
            <span className="font-bold capitalize text-neutral-900 dark:text-white">{row.bestOdds?.book ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Game time</span>
            <span className="font-bold text-neutral-900 dark:text-white">{formatGameTime(row.gameStatus, row.gameDate)}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenFullReport?.(row)}
            className="mt-2 w-full rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-xs font-black text-brand transition-all duration-200 hover:bg-brand/15 active:scale-[0.98]"
          >
            Open full player report
          </button>
        </div>
      </div>
    </div>
  );
};

const formatDate = (value: string | null) => {
  if (!value) return "TBD";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

// Check if a game date is tomorrow (in ET timezone)
const isTomorrow = (gameDate: string | null): boolean => {
  if (!gameDate) return false;
  
  // Get today's date in ET
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayET = etFormatter.format(now);
  
  // Get tomorrow's date in ET
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowET = etFormatter.format(tomorrow);
  
  return gameDate === tomorrowET;
};

// Check if a game has started (10 minutes after scheduled time)
const hasGameStarted = (gameStatus: string | null, gameDate: string | null): boolean => {
  if (!gameStatus || !gameDate) return false;
  
  // Try to parse scheduled time like "7:00 pm ET" or "7:00 PM ET"
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch) {
    // Can't parse as scheduled time - might be in progress status, hide odds
    return true;
  }
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  // Create scheduled game time in ET
  // Note: Using -05:00 for EST, games during EDT would be -04:00
  const scheduledTime = new Date(`${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
  
  // Add 10 minutes buffer
  const bufferMs = 10 * 60 * 1000;
  const gameStartedTime = new Date(scheduledTime.getTime() + bufferMs);
  
  // Compare to current time
  return Date.now() > gameStartedTime.getTime();
};

// Convert ET time string (e.g., "7:00 pm ET") to user's local timezone
const formatGameTime = (gameStatus: string | null, gameDate: string | null) => {
  if (!gameStatus) return "TBD";
  
  // Check if it's a final score or other non-time status
  if (gameStatus.toLowerCase().includes("final")) return gameStatus;
  
  // Try to parse time like "7:00 pm ET" or "7:00 PM ET"
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch || !gameDate) return gameStatus.replace(/\s*ET$/i, "").trim();
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  // Create a date object in ET (Eastern Time)
  // ET is UTC-5 (EST) or UTC-4 (EDT)
  const etDate = new Date(`${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
  
  // Format in user's local timezone
  return etDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatSpread = (spread: number | null) => {
  if (spread === null || spread === undefined) return "—";
  return spread > 0 ? `+${spread}` : spread.toString();
};

// Get color class for average vs line comparison
const getAvgColorClass = (avg: number | null, line: number | null) => {
  if (avg === null || line === null) return "text-neutral-700 dark:text-neutral-300";
  if (avg > line) return "text-emerald-600 dark:text-emerald-400"; // Green - over the line
  if (avg < line) return "text-red-500 dark:text-red-400"; // Red - under the line
  return "text-neutral-700 dark:text-neutral-300"; // Neutral - exactly at the line
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

const formatPosition = (position: string | null) => {
  if (!position) return "—";
  return position; // Now just return the position code (PG, SG, SF, PF, C, etc.)
};

const getPositionLabel = (position: string | null): string => {
  if (!position) return "Unknown";
  return POSITION_LABELS[position] || position;
};

const getStatusBorderClass = (status: string | null) => {
  // All players get the same neutral border - no colored borders
  return "border border-neutral-200 dark:border-neutral-700";
};

const isPlayerOut = (status: string | null) => status === "out";

// Get injury icon color class based on status
const getInjuryIconColorClass = (status: string | null): string => {
  if (!status || status === "active" || status === "available") return "";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game_time_decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "";
};

// Check if player has an injury status worth showing
const hasInjuryStatus = (status: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s !== "active" && s !== "available";
};

// Get matchup tier based on rank (5-tier system)
// LOW rank (1-10) = tough defense = HARD for player (red)
// HIGH rank (21-30) = weak defense = GOOD for player (green)
type MatchupTier = "elite" | "strong" | "neutral" | "bad" | "worst" | null;

const getDefenseTotalTeams = (sport: "nba" | "mlb" | "wnba") => sport === "wnba" ? 13 : 30;

const getMatchupTier = (rank: number | null, totalTeams = 30): MatchupTier => {
  if (rank === null) return null;
  const toughEliteCutoff = Math.max(1, Math.floor(totalTeams * 0.17));
  const toughCutoff = Math.ceil(totalTeams / 3);
  const favorableCutoff = totalTeams - toughCutoff + 1;
  const favorableEliteCutoff = totalTeams - toughEliteCutoff + 1;

  if (rank <= toughEliteCutoff) return "worst";
  if (rank <= toughCutoff) return "bad";
  if (rank >= favorableEliteCutoff) return "elite";
  if (rank >= favorableCutoff) return "strong";
  return "neutral";
};

// Get matchup background classes (5-tier system) - More vivid for top/bottom 5
const getMatchupBgClass = (rank: number | null, sport: "nba" | "mlb" | "wnba" = "nba"): string => {
  const tier = getMatchupTier(rank, getDefenseTotalTeams(sport));
  if (!tier) return "";
  switch (tier) {
    case "elite":
      // Bold green - easiest matchup (26-30)
      return "bg-emerald-200 dark:bg-emerald-700/40 ring-1 ring-emerald-400/50 dark:ring-emerald-500/30";
    case "strong":
      return "bg-emerald-50 dark:bg-emerald-900/20";
    case "neutral":
      return "bg-neutral-100/40 dark:bg-neutral-700/20";
    case "bad":
      return "bg-red-50 dark:bg-red-900/20";
    case "worst":
      // Bold red - toughest matchup (1-5)
      return "bg-red-200 dark:bg-red-700/40 ring-1 ring-red-400/50 dark:ring-red-500/30";
    default:
      return "";
  }
};

// Get matchup rank text color (5-tier system)
const getMatchupRankColor = (rank: number | null, sport: "nba" | "mlb" | "wnba" = "nba"): string => {
  const tier = getMatchupTier(rank, getDefenseTotalTeams(sport));
  if (!tier) return "text-neutral-500 dark:text-neutral-400";
  switch (tier) {
    case "elite":
      // Bold green text - easiest matchup
      return "text-emerald-800 dark:text-emerald-200 font-bold";
    case "strong":
      return "text-emerald-600 dark:text-emerald-400";
    case "neutral":
      return "text-neutral-500 dark:text-neutral-400";
    case "bad":
      return "text-red-500 dark:text-red-400";
    case "worst":
      // Bold red text - toughest matchup
      return "text-red-800 dark:text-red-200 font-bold";
    default:
      return "text-neutral-500 dark:text-neutral-400";
  }
};

// Column definitions for sortable headers
const SORTABLE_COLUMNS: { key: SortField; label: string }[] = [
  { key: "line", label: "Prop" },
  { key: "l5Avg", label: "L5 Avg" },
  { key: "l10Avg", label: "L10 Avg" },
  { key: "seasonAvg", label: "Season Avg" },
  { key: "streak", label: "Streak" },
  { key: "l5Pct", label: "L5" },
  { key: "l10Pct", label: "L10" },
  { key: "l20Pct", label: "L20" },
  { key: "seasonPct", label: "Season" },
];

const getSortValue = (row: HitRateProfile, field: SortField): number | null => {
  switch (field) {
    case "line": return row.line;
    case "l5Avg": return row.last5Avg;
    case "l10Avg": return row.last10Avg;
    case "seasonAvg": return row.seasonAvg;
    case "streak": return row.hitStreak;
    case "l5Pct": return row.last5Pct;
    case "l10Pct": return row.last10Pct;
    case "l20Pct": return row.last20Pct;
    case "seasonPct": return row.seasonPct;
    case "h2hPct": return row.h2hPct;
    case "matchupRank": return row.matchupRank;
    default: return null;
  }
};

export function HitRateTable({ 
  sport = "nba",
  rows, 
  loading, 
  error, 
  onRowClick,
  hasMore,
  onLoadMore,
  isLoadingMore,
  totalCount,
  selectedMarkets,
  marketOptions,
  onMarketsChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
  scrollRef,
  initialScrollTop,
  hideNoOdds: hideNoOddsControlled,
  onHideNoOddsChange,
  onOddsAvailabilityChange,
  upgradeBanner,
  bottomContent,
  blurAfterIndex,
  gamesFilter,
}: HitRateTableProps) {
  const effectiveMarketOptions =
    marketOptions && marketOptions.length > 0 ? marketOptions : DEFAULT_MARKET_OPTIONS;
  const tableConfig = getHitRateTableConfig(sport);
  const seasonPctHeaderLabel = tableConfig.seasonPctLabel;
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Disabled: Prefetch was causing excessive API calls on every row hover
  // const prefetchPlayer = usePrefetchPlayer();
  
  // Advanced filter states
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [maxMatchupRank, setMaxMatchupRank] = useState<number>(0); // 0 = all
  // Support both controlled and uncontrolled hideNoOdds
  // Default to false so we show all players while odds are loading
  const [hideNoOddsInternal, setHideNoOddsInternal] = useState(false);
  const hideNoOdds = hideNoOddsControlled ?? hideNoOddsInternal;
  const setHideNoOdds = onHideNoOddsChange ?? setHideNoOddsInternal;
  const filterPopupRef = useRef<HTMLDivElement>(null);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  
  // Check if any advanced filters are active
  const hasActiveFilters = selectedPositions.size > 0 || maxMatchupRank > 0 || hideNoOdds;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMarketDropdownOpen(false);
      }
      if (filterPopupRef.current && !filterPopupRef.current.contains(e.target as Node)) {
        setShowFilterPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Toggle position selection
  const togglePosition = useCallback((pos: string) => {
    setSelectedPositions(prev => {
      const next = new Set(prev);
      if (next.has(pos)) {
        next.delete(pos);
      } else {
        next.add(pos);
      }
      return next;
    });
  }, []);
  
  // Reset all advanced filters
  const resetFilters = useCallback(() => {
    setSelectedPositions(new Set());
    setMaxMatchupRank(0);
    setHideNoOdds(false);
  }, [setHideNoOdds]);

  // Restore scroll position when returning from drilldown
  useEffect(() => {
    if (scrollRef?.current && initialScrollTop !== undefined && initialScrollTop > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: initialScrollTop, behavior: "instant" });
      });
    }
  }, [initialScrollTop, scrollRef]);

  const toggleMarket = useCallback((value: string) => {
    onMarketsChange(
      selectedMarkets.includes(value) 
        ? selectedMarkets.filter((v) => v !== value) 
        : [...selectedMarkets, value]
    );
  }, [selectedMarkets, onMarketsChange]);

  const selectAllMarkets = useCallback(() => {
    onMarketsChange(effectiveMarketOptions.map((o) => o.value));
  }, [effectiveMarketOptions, onMarketsChange]);

  const deselectAllMarkets = useCallback(() => {
    // Default back to points when deselecting all
    onMarketsChange([effectiveMarketOptions[0]?.value || "player_points"]);
  }, [effectiveMarketOptions, onMarketsChange]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      const newDirection = sortDirection === "asc" ? "desc" : "asc";
      onSortChange(field, newDirection);
    } else {
      // New field - always default to descending
      // For matchupRank: desc = best matchups first (30, 29, 28... = weak defense)
      // For all other fields: desc = highest values first
      onSortChange(field, "desc");
    }
  }, [sortField, sortDirection, onSortChange]);
  
  // Apply advanced filters only (sorting is consolidated in sortedRows)
  const filteredRows = useMemo(() => {
    let result = rows;
    
    // Filter by position
    if (selectedPositions.size > 0) {
      result = result.filter(row => {
        const pos = row.position?.toUpperCase();
        if (!pos) return false;
        // Handle positions like "G" (guard) matching PG/SG, "F" matching SF/PF
        if (pos === "G") return selectedPositions.has("PG") || selectedPositions.has("SG");
        if (pos === "F") return selectedPositions.has("SF") || selectedPositions.has("PF");
        return selectedPositions.has(pos);
      });
    }
    
    // Filter by matchup rank (top N best matchups = highest ranks = weakest defense)
    // With our logic: high rank (21-30) = good for player, low rank (1-10) = bad for player
    // So "top 10 matchups" means ranks 21-30 (the 10 easiest matchups)
    if (maxMatchupRank > 0) {
      const minRankThreshold = 31 - maxMatchupRank; // top 10 = ranks >= 21, top 5 = ranks >= 26
      result = result.filter(row => 
        row.matchupRank !== null && row.matchupRank >= minRankThreshold
      );
    }
    
    // Note: hideNoOdds filter is applied in render since odds are fetched separately
    
    return result;
  }, [rows, selectedPositions, maxMatchupRank]);

  // Odds are now loaded directly from the main API via bestOdds field
  // No separate odds fetch needed - bestodds:nba keys provide the best price
  const oddsLoading = loading; // Odds load with the main data
  
  // Sort rows: All sorting consolidated here
  // Priority: 1) "Out" players to bottom, 2) Primary sort field, 3) Odds availability (tiebreaker)
  const sortedRows = useMemo(() => {
    // Get sort field mapping
    const fieldMap: Record<string, keyof HitRateProfile> = {
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
    
    const sortFieldKey = sortField ? fieldMap[sortField] : null;
    const multiplier = sortDirection === "asc" ? 1 : -1;
    
    return [...filteredRows].sort((a, b) => {
      // 0. ALWAYS push "out" players to the bottom
      const aIsOut = a.injuryStatus?.toLowerCase() === "out";
      const bIsOut = b.injuryStatus?.toLowerCase() === "out";
      if (aIsOut && !bIsOut) return 1;
      if (!aIsOut && bIsOut) return -1;
      
      // 1. PRIMARY SORT: by user's selected field (L10%, etc.)
      if (sortFieldKey) {
        const aVal = a[sortFieldKey] as number | null;
        const bVal = b[sortFieldKey] as number | null;
        
        // Push nulls to the end (regardless of sort direction)
        if (aVal === null && bVal !== null) return 1;
        if (aVal !== null && bVal === null) return -1;
        
        // If both have values, compare them
        if (aVal !== null && bVal !== null) {
          const diff = (aVal - bVal) * multiplier;
          if (diff !== 0) return diff;
        }
        // If both are null, fall through to secondary sort
      }
      
      // 2. SECONDARY SORT (tiebreaker): prefer rows with odds
      // Only apply when data has finished loading
      if (!oddsLoading) {
        const aHasOdds = !!a.bestOdds;
        const bHasOdds = !!b.bestOdds;
        
        if (aHasOdds && !bHasOdds) return -1;
        if (!aHasOdds && bHasOdds) return 1;
      }
      
      return 0;
    });
  }, [filteredRows, oddsLoading, sortField, sortDirection]);

  const displayedRows = useMemo(() => {
    if (!hideNoOdds || oddsLoading) return sortedRows;
    return sortedRows.filter((row) => !!row.bestOdds);
  }, [hideNoOdds, oddsLoading, sortedRows]);

  const recentTrendSport = sport === "wnba" ? "wnba" : sport === "nba" ? "nba" : null;
  const recentTrendPlayerIds = useMemo(() => {
    if (!recentTrendSport) return [];
    return Array.from(new Set(displayedRows.slice(0, 60).map((row) => row.playerId).filter(Boolean)));
  }, [displayedRows, recentTrendSport]);

  const recentTrendsQuery = useQuery<RecentTrendMap>({
    queryKey: ["hit-rate-recent-trends", recentTrendSport, recentTrendPlayerIds.join(",")],
    queryFn: () => fetchRecentTrends(recentTrendSport!, recentTrendPlayerIds),
    enabled: !!recentTrendSport && recentTrendPlayerIds.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Report which profiles have odds (for filtering in other components like sidebar)
  // Use a ref to track previous value and avoid infinite loops
  const prevOddsIdsRef = useRef<string>("");
  
  useEffect(() => {
    if (!onOddsAvailabilityChange || oddsLoading) return;
    
    const idsWithOdds = new Set<string>();
    for (const row of rows) {
      // Only count as having odds if bestOdds is present from the API
      if (row.oddsSelectionId && row.bestOdds) {
        idsWithOdds.add(row.oddsSelectionId);
      }
    }
    
    // Only call callback if the set actually changed
    const idsString = Array.from(idsWithOdds).sort().join(",");
    if (idsString !== prevOddsIdsRef.current) {
      prevOddsIdsRef.current = idsString;
      onOddsAvailabilityChange(idsWithOdds);
    }
  }, [rows, oddsLoading, onOddsAvailabilityChange]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3.5 w-3.5" />
      : <ChevronDown className="h-3.5 w-3.5" />;
  };

  // Render filter bar component (extracted for reuse) - Premium styling
  // z-[20] ensures dropdowns appear above the sticky table header (z-[5])
  const filterBar = (
    <div className="relative z-[20] flex items-center gap-4 px-5 py-3.5 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-r from-white via-neutral-50/50 to-white dark:from-neutral-900 dark:via-neutral-800/30 dark:to-neutral-900 shrink-0 backdrop-blur-sm">
        {/* Markets Dropdown - Premium */}
        <div ref={dropdownRef} className="relative z-[9998]">
          <button
            type="button"
            onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 w-[190px]",
              "bg-white dark:bg-neutral-800/90 shadow-sm hover:shadow-md",
              "border border-neutral-200/80 dark:border-neutral-700/80",
              "ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
              marketDropdownOpen && "ring-2 ring-brand/30 border-brand/50"
            )}
          >
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {selectedMarkets.length === 0
                ? "No markets"
                : selectedMarkets.length === effectiveMarketOptions.length
                ? "All Markets"
                : selectedMarkets.length === 1
                ? effectiveMarketOptions.find((o) => o.value === selectedMarkets[0])?.label ?? "1 selected"
                : selectedMarkets.length === 2
                ? selectedMarkets.map((m) => effectiveMarketOptions.find((o) => o.value === m)?.label).filter(Boolean).join(", ")
                : `${selectedMarkets.length} selected`}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform duration-200 shrink-0", marketDropdownOpen && "rotate-180 text-brand")} />
          </button>

          {marketDropdownOpen && (
            <div className="absolute left-0 top-full z-[9999] mt-2 w-[220px] rounded-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-xl p-2 shadow-2xl dark:border-neutral-700/80 dark:bg-neutral-900/95 ring-1 ring-black/5 dark:ring-white/5">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2 mb-2 px-1">
                <button type="button" onClick={selectAllMarkets} className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors">
                  Select All
                </button>
                <button type="button" onClick={deselectAllMarkets} className="text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors">
                  Clear All
                </button>
              </div>
              <div className="flex flex-col gap-0.5 max-h-64 overflow-auto">
                {effectiveMarketOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                    <Checkbox checked={selectedMarkets.includes(opt.value)} onCheckedChange={() => toggleMarket(opt.value)} />
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Games Filter Dropdown */}
        {gamesFilter}

        {/* Search Input - Premium */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search player or team..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full pl-10 pr-9 py-2.5 text-sm rounded-xl shadow-sm",
              "bg-white dark:bg-neutral-800/90",
              "border border-neutral-200/80 dark:border-neutral-700/80",
              "ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
              "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
              "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50",
              "dark:text-white transition-all duration-200"
            )}
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Advanced Filters Button - Premium */}
        <div ref={filterPopupRef} className="relative z-[9998]">
          <button
            type="button"
            onClick={() => setShowFilterPopup(!showFilterPopup)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200",
              showFilterPopup || hasActiveFilters
                ? "bg-brand/10 border-brand/40 text-brand shadow-sm shadow-brand/10 dark:bg-brand/20 dark:border-brand/50"
                : "bg-white dark:bg-neutral-800/90 border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-sm hover:shadow-md",
              "border ring-1 ring-black/[0.03] dark:ring-white/[0.03]"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            )}
          </button>

          {/* Filter Popup - Premium */}
          {showFilterPopup && (
            <div className="absolute right-0 top-full z-[9999] mt-2 w-[340px] rounded-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-xl shadow-2xl dark:border-neutral-700/80 dark:bg-neutral-900/95 overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
              {/* Header with gradient */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-800/50 dark:to-neutral-900">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">Advanced Filters</span>
                <button 
                  onClick={() => setShowFilterPopup(false)}
                  className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>

              {/* Position Filter */}
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <div className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-3">
                  Position
                </div>
                <div className="flex flex-wrap gap-2">
                  {POSITION_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => togglePosition(value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all duration-200",
                        selectedPositions.has(value)
                          ? "bg-gradient-to-r from-brand to-brand/90 text-white shadow-md shadow-brand/20"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200/60 dark:border-neutral-700/60"
                      )}
                    >
                      {selectedPositions.has(value) && <Check className="w-3 h-3" />}
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Matchup Rank Filter - Number Input */}
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Top Matchups Only
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {maxMatchupRank > 0 ? `Showing top ${maxMatchupRank} matchups` : "Showing all matchups"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMaxMatchupRank(Math.max(0, maxMatchupRank - 1))}
                      disabled={maxMatchupRank === 0}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-xl border transition-all duration-200",
                        maxMatchupRank === 0
                          ? "border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:shadow-sm"
                      )}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={MAX_MATCHUP_RANK_LIMIT}
                      value={maxMatchupRank || ""}
                      placeholder="All"
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 0) {
                          setMaxMatchupRank(0);
                        } else {
                          setMaxMatchupRank(Math.min(val, MAX_MATCHUP_RANK_LIMIT));
                        }
                      }}
                      className="w-16 h-8 text-center text-sm font-bold rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxMatchupRank(Math.min(MAX_MATCHUP_RANK_LIMIT, maxMatchupRank + 1))}
                      disabled={maxMatchupRank >= MAX_MATCHUP_RANK_LIMIT}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-xl border transition-all duration-200",
                        maxMatchupRank >= MAX_MATCHUP_RANK_LIMIT
                          ? "border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:shadow-sm"
                      )}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Hide No Odds Toggle */}
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Hide Players Without Odds
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Only show props with available betting lines
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hideNoOdds}
                    onClick={() => setHideNoOdds(!hideNoOdds)}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 dark:focus:ring-offset-neutral-900",
                      hideNoOdds ? "bg-gradient-to-r from-brand to-brand/90 shadow-inner" : "bg-neutral-200 dark:bg-neutral-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-all duration-200",
                        hideNoOdds ? "translate-x-[26px]" : "translate-x-1"
                      )}
                    />
                  </button>
                </label>
              </div>

              {/* Reset Button */}
              {hasActiveFilters && (
                <div className="px-5 py-3 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/50 dark:to-neutral-800/30">
                  <button
                    onClick={resetFilters}
                    className="w-full py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-xl hover:bg-white dark:hover:bg-neutral-800 transition-all duration-200 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Count indicator - Premium pill style */}
        <div className="ml-auto px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          {hasActiveFilters || selectedMarkets.length < effectiveMarketOptions.length ? (
            // Filters active - show filtered count
            <>{displayedRows.length} props</>
          ) : totalCount !== undefined ? (
            // All markets, no filters - show pagination info
            <>{rows.length} of {totalCount} props</>
          ) : (
            <>{rows.length} props</>
          )}
          </span>
        </div>
      </div>
  );

  // Loading state - Premium
  if (loading) {
    return (
      <div className="flex flex-col h-full rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
        {filterBar}
        <div className="flex items-center justify-center py-16 flex-1 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
          <div className="text-center">
            <div className="relative inline-flex">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand/30 border-t-brand" />
              <Chart className="absolute inset-0 m-auto h-5 w-5 text-brand/60" />
            </div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-4">Loading hit rates...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state - Premium
  if (error) {
    return (
      <div className="flex flex-col h-full rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
        {filterBar}
        <div className="flex items-center justify-center py-16 flex-1">
          <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50 to-red-100/50 p-6 text-red-800 dark:border-red-900/40 dark:from-red-950/40 dark:to-red-900/20 dark:text-red-200 shadow-sm max-w-sm">
            <p className="font-bold text-lg">Unable to load hit rates</p>
            <p className="text-sm mt-2 opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no markets selected or no data) - Premium
  if (!rows.length) {
    return (
      <div className="flex flex-col h-full rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
        {filterBar}
        <div className="flex items-center justify-center py-20 flex-1 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center mb-5 shadow-sm border border-neutral-200/50 dark:border-neutral-700/50 mx-auto">
              <Chart className="h-8 w-8 text-neutral-400 dark:text-neutral-500" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
              {selectedMarkets.length === 0 ? "No markets selected" : "No hit rates available"}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {selectedMarkets.length === 0 
                ? "Select one or more markets from the dropdown above."
                : "Check back closer to tip-off or adjust your filters."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
      {filterBar}
      
      {/* Optional upgrade banner for gated access */}
      {upgradeBanner}

      {/* Table - Premium styling */}
      <div ref={scrollRef} className="overflow-auto flex-1 rounded-b-2xl">
      <table className="min-w-full table-fixed border-separate border-spacing-y-1 text-sm">
          <colgroup>
            {tableConfig.columnWidths.map((width, idx) => (
              <col key={`hr-col-${idx}`} style={{ width }} />
            ))}
          </colgroup>
        <thead className="sticky top-0 z-[5]">
          <tr className="bg-gradient-to-r from-neutral-50 via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-800/50 dark:to-neutral-900 backdrop-blur-sm">
            {/* Non-sortable columns */}
            <th className="h-14 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80">
              Player
            </th>
            {/* Sortable: Matchup */}
            <th
              onClick={() => handleSort("matchupRank")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                Matchup
                <SortIcon field="matchupRank" />
              </div>
            </th>
            
            {/* Sortable: Prop (line) */}
            <th
              onClick={() => handleSort("line")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                Prop
                <SortIcon field="line" />
              </div>
            </th>

            <th className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80">
              Recent (10)
            </th>
            
            {/* Sortable: Streak */}
            <th
              onClick={() => handleSort("streak")}
              className="h-14 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <Tooltip content="Hit Streak - Consecutive games hitting this line" side="top">
                <div className="flex items-center justify-center gap-0.5">
                  <span>Str</span>
                <SortIcon field="streak" />
              </div>
              </Tooltip>
            </th>
            
            {/* Sortable: L5 */}
            <th
              onClick={() => handleSort("l5Pct")}
              className="h-14 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200 w-16 min-w-[64px]"
            >
              <div className="flex items-center justify-center gap-1">
                L5
                <SortIcon field="l5Pct" />
              </div>
            </th>
            
            {/* Sortable: L10 */}
            <th
              onClick={() => handleSort("l10Pct")}
              className="h-14 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                L10
                <SortIcon field="l10Pct" />
              </div>
            </th>
            
            {/* Sortable: L20 */}
            <th
              onClick={() => handleSort("l20Pct")}
              className="h-14 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                L20
                <SortIcon field="l20Pct" />
              </div>
            </th>
            
            {/* Sortable: 25/26 % (Season %) */}
            <th
              onClick={() => handleSort("seasonPct")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                {seasonPctHeaderLabel}
                <SortIcon field="seasonPct" />
              </div>
            </th>
            
            {/* H2H % (Head to Head) */}
            <th
              onClick={() => handleSort("h2hPct")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                H2H
                <SortIcon field="h2hPct" />
              </div>
            </th>
            
            {/* Defensive context columns */}
            <th className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80">
              DEF Rank
            </th>
            <th className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80">
              <Tooltip content="Opponent defense allowed per game to this player's position for the selected market." side="top">
                <span className="cursor-help">Allowed</span>
              </Tooltip>
            </th>
            <th className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80">
              Pace
            </th>

            {/* Non-sortable: Odds (last column) */}
            <th className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80">
              Odds
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedRows.map((row, idx) => {
            const opponent = row.opponentTeamAbbr ?? row.opponentTeamName ?? "Opponent";
            const matchup = row.teamAbbr ? `${row.teamAbbr} vs ${opponent}` : opponent;
            const isHighConfidence = (row.last10Pct ?? 0) >= 70;
            // Use composite key with index to guarantee uniqueness
            // (same player can have duplicate profiles for same game in data)
            const rowKey = `${row.id}-${row.gameId ?? "no-game"}-${row.market}-${idx}`;
            const isExpanded = expandedRowKey === rowKey;
            const rowSport = sport === "mlb" ? "mlb" : sport === "wnba" ? "wnba" : "nba";
            const defenseTotalTeamsForRow = getDefenseTotalTeams(rowSport);
            
            // Check if this row should be blurred (for gated access)
            const isBlurred = blurAfterIndex !== undefined && idx >= blurAfterIndex;

            return (
              <React.Fragment key={rowKey}>
              <tr
                onClick={() => !isBlurred && onRowClick?.(row)}
                className={cn(
                  "group overflow-hidden transition-all duration-200",
                  idx % 2 === 0 ? "bg-white/90 dark:bg-neutral-950/70" : "bg-neutral-50/90 dark:bg-neutral-900/70",
                  "shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
                  isExpanded && "bg-brand/[0.05] shadow-[inset_4px_0_0_0_var(--color-brand),inset_0_0_0_1px_rgba(14,165,233,0.28)] dark:bg-brand/10",
                  isBlurred 
                    ? "cursor-default select-none pointer-events-none" 
                    : "cursor-pointer hover:bg-brand/[0.045] dark:hover:bg-brand/10 hover:shadow-[inset_4px_0_0_0_rgba(14,165,233,0.55),inset_0_0_0_1px_rgba(14,165,233,0.24)]",
                  // isHighConfidence && !isBlurred && "shadow-[inset_4px_0_0_0_rgba(16,185,129,0.6)]"
                )}
              >
                {/* Player Column: Headshot + Name + Position/Jersey */}
                <td className="rounded-l-xl px-3 py-4">
                  {isBlurred ? (
                    // Blurred placeholder content
                    <div className="flex items-center gap-3 opacity-50">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-xs font-black tabular-nums text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                        {idx + 1}
                      </span>
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                        <User className="h-7 w-7 text-neutral-400 dark:text-neutral-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-neutral-400 dark:text-neutral-500 leading-tight blur-[2px]">
                            Player Name
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium blur-[2px]">
                          <span>Team</span>
                          <span className="text-neutral-300 dark:text-neutral-600">•</span>
                          <span>Position</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Normal content
                    <div className={cn(
                      "flex items-center gap-3",
                      isPlayerOut(row.injuryStatus) && "opacity-50"
                    )}>
                      <span className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-black tabular-nums transition-all duration-200",
                        isExpanded
                          ? "border-brand/40 bg-brand/15 text-brand"
                          : "border-neutral-200 bg-white text-neutral-500 group-hover:border-brand/30 group-hover:text-brand dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                      )}>
                        {idx + 1}
                      </span>
                      {(() => {
                        const hasInjury = row.injuryStatus && row.injuryStatus !== "active" && row.injuryStatus !== "available";
                        const injuryTooltip = hasInjury
                          ? `${row.injuryStatus!.charAt(0).toUpperCase() + row.injuryStatus!.slice(1)}${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                          : "";
                        
                        const headshotElement = (
                          <div 
                            className={cn(
                              "relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm transition-transform duration-150 group-hover:scale-[1.03]",
                              hasInjury && "cursor-pointer",
                              getStatusBorderClass(row.injuryStatus)
                            )}
                            style={{ 
                              background: row.primaryColor && row.secondaryColor 
                                ? `linear-gradient(180deg, ${row.primaryColor} 0%, ${row.primaryColor} 55%, ${row.secondaryColor} 100%)`
                                : row.primaryColor || undefined 
                            }}
                          >
                            <PlayerHeadshot
                              sport={sport}
                              nbaPlayerId={row.nbaPlayerId ?? row.playerId}
                              mlbPlayerId={row.playerId}
                              name={row.playerName}
                              size="small"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        );

                        return hasInjury ? (
                          <Tooltip content={injuryTooltip} side="right">
                            {headshotElement}
                          </Tooltip>
                        ) : (
                          headshotElement
                        );
                      })()}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">
                            {row.playerName}
                          </span>
                          {hasInjuryStatus(row.injuryStatus) && (() => {
                            const isGLeague = row.injuryNotes?.toLowerCase().includes("g league") || 
                                              row.injuryNotes?.toLowerCase().includes("g-league") ||
                                              row.injuryNotes?.toLowerCase().includes("gleague");
                            return (
                              <Tooltip 
                                content={isGLeague 
                                  ? `G League${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                                  : `${row.injuryStatus!.charAt(0).toUpperCase() + row.injuryStatus!.slice(1)}${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                                }
                                side="top"
                              >
                                {isGLeague ? (
                                  <ArrowDown className="h-4 w-4 cursor-help text-blue-500" />
                                ) : (
                                  <HeartPulse className={cn(
                                    "h-4 w-4 cursor-help",
                                    getInjuryIconColorClass(row.injuryStatus)
                                  )} />
                                )}
                              </Tooltip>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
                          {row.teamAbbr && (
                            <img
                              src={getTeamLogoUrl(row.teamAbbr, sport)}
                              alt={row.teamAbbr}
                              className="h-4 w-4 object-contain"
                            />
                          )}
                          <Tooltip content={getPositionLabel(row.position)} side="top">
                            <span className="cursor-help">{formatPosition(row.position)}</span>
                          </Tooltip>
                          <span className="text-neutral-300 dark:text-neutral-600">•</span>
                          <span>#{row.jerseyNumber ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </td>

                {/* Matchup Column */}
                <td className={cn(
                  "px-3 py-5 text-center rounded-lg",
                  isBlurred ? "" : getMatchupBgClass(row.matchupRank, rowSport)
                )}>
                  {isBlurred ? (
                    // Blurred placeholder
                    <div className="flex flex-col items-center gap-1.5 opacity-50 blur-[2px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-xs text-neutral-400 font-medium">vs</span>
                        <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400">—</span>
                    </div>
                  ) : (
                    // Normal content
                    <div className="flex flex-col items-center gap-1.5">
                      {/* Tomorrow label */}
                      {isTomorrow(row.gameDate) && (
                        <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          Tomorrow
                        </span>
                      )}
                      
                      {/* Opponent with vs/@ */}
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-xs text-neutral-400 font-medium">
                          {row.homeAway === "H" ? "vs" : "@"}
                        </span>
                        {row.opponentTeamAbbr && (
                          <img
                            src={getTeamLogoUrl(row.opponentTeamAbbr, sport)}
                            alt={row.opponentTeamAbbr}
                            className={cn(
                              "object-contain",
                              sport === "wnba" ? "h-9 w-9" : "h-6 w-6"
                            )}
                          />
                        )}
                      </div>
                      
                      {/* DvP Rank Number */}
                      {row.matchupRank !== null && (
                        <span className={cn(
                          "text-xs font-bold mt-0.5 tabular-nums",
                          getMatchupRankColor(row.matchupRank, rowSport)
                        )}>
                          {row.matchupRank}/{defenseTotalTeamsForRow} DEF
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Prop Column */}
                <td className="px-3 py-4 align-middle text-center">
                  {isBlurred ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800/50 opacity-50 blur-[2px]">
                      <span className="font-semibold">00.0+</span>
                      PTS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                      {row.line !== null && (
                        <span className="font-semibold text-neutral-900 dark:text-white">{row.line}+</span>
                      )}
                      {formatMarketLabel(row.market)}
                      {getMarketTooltip(row.market) && (
                        <Tooltip content={getMarketTooltip(row.market)!}>
                          <Info className="h-3 w-3 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 cursor-help" />
                        </Tooltip>
                      )}
                    </span>
                  )}
                </td>

                {/* Recent trend bars */}
                <td className="px-3 py-3 align-middle">
                  <RecentTrendBars
                    row={row}
                    games={recentTrendsQuery.data?.[String(row.playerId)]}
                    isLoading={recentTrendsQuery.isLoading || recentTrendsQuery.isFetching}
                    isBlurred={isBlurred}
                    sport={rowSport}
                  />
                </td>

                {/* Streak Column */}
                <td className="px-1 py-5 align-middle text-center">
                  {isBlurred ? (
                    <span className="text-sm font-medium text-neutral-400 opacity-50 blur-[2px]">0</span>
                  ) : row.hitStreak !== null && row.hitStreak !== undefined ? (
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {row.hitStreak}
                    </span>
                  ) : (
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">—</span>
                  )}
                </td>

                {/* L5 % - Premium cell with progress bar */}
                <td className="px-1 py-3 align-middle text-center">
                  <HitRateCell value={row.last5Pct} sampleSize={5} isBlurred={isBlurred} />
                </td>

                {/* L10 % - Premium cell with progress bar */}
                <td className="px-1 py-3 align-middle text-center">
                  <HitRateCell value={row.last10Pct} sampleSize={10} isBlurred={isBlurred} />
                </td>

                {/* L20 % - Premium cell with progress bar */}
                <td className="px-1 py-3 align-middle text-center">
                  <HitRateCell value={row.last20Pct} sampleSize={20} isBlurred={isBlurred} />
                </td>

                {/* Season % - Premium cell with progress bar */}
                <td className="px-1 py-3 align-middle text-center">
                  <HitRateCell value={row.seasonPct} sampleSize={row.seasonGames} subLabel="SZN" isBlurred={isBlurred} />
                </td>
                
                {/* H2H % - Premium cell with progress bar */}
                <td className="px-1 py-3 align-middle text-center">
                  <HitRateCell value={row.h2hPct} sampleSize={row.h2hGames} isBlurred={isBlurred} />
                </td>

                {/* Defensive context: rank vs position */}
                <td className="px-2 py-5 align-middle text-center">
                  <span
                    className={cn(
                      "inline-flex min-w-[58px] items-center justify-center rounded-md border px-2 py-1 text-xs font-black tabular-nums",
                      isBlurred ? "opacity-50 blur-[2px]" : getContextPillClass(row.matchupRank, rowSport)
                    )}
                  >
                    {isBlurred ? "—" : row.matchupRank !== null ? `${row.matchupRank}/${defenseTotalTeamsForRow}` : "—"}
                  </span>
                </td>

                {/* Defensive context: average allowed */}
                <td className="px-2 py-5 align-middle text-center">
                  <Tooltip
                    content={`Opponent defense allowed per game to ${formatPosition(row.position)} for ${formatMarketLabel(row.market)}.`}
                    side="top"
                  >
                    <span
                      className={cn(
                        "inline-flex min-w-[58px] items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-bold tabular-nums text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-300",
                        isBlurred && "opacity-50 blur-[2px]"
                      )}
                    >
                      {isBlurred ? "00.0" : row.matchupAvgAllowed !== null ? row.matchupAvgAllowed.toFixed(1) : "—"}
                    </span>
                  </Tooltip>
                </td>

                {/* Game context: pace */}
                <td className="px-2 py-5 align-middle text-center">
                  <Tooltip
                    side="top"
                    content={
                      row.paceContext
                        ? `Opponent L5 pace #${row.paceContext.opponentRecent.l5Rank ?? "—"} (${row.paceContext.opponentRecent.l5 ?? "—"}), L10 #${row.paceContext.opponentRecent.l10Rank ?? "—"} (${row.paceContext.opponentRecent.l10 ?? "—"}), matchup L5 ${row.paceContext.matchupL5Pace ?? "—"} / ${row.paceContext.confidence} confidence`
                        : "Pace context unavailable"
                    }
                  >
                    <span
                      className={cn(
                        "inline-flex min-w-[56px] items-center justify-center rounded-md border px-2 py-1 text-xs font-black tabular-nums",
                        isBlurred ? "opacity-50 blur-[2px]" : getPacePillClass(row.paceContext?.paceLabel)
                      )}
                    >
                      {isBlurred ? "—" : row.paceContext?.opponentRecent.l5Rank ? `#${row.paceContext.opponentRecent.l5Rank}` : "—"}
                    </span>
                  </Tooltip>
                </td>
                
                {/* Odds Column (last column) */}
                <td className="rounded-r-xl px-3 py-5 align-middle text-center">
                  {isBlurred ? (
                    <span className="text-xs text-neutral-400 opacity-50 blur-[2px]">+000</span>
                  ) : hasGameStarted(row.gameStatus, row.gameDate) ? (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <OddsDropdown
                        sport={sport === "wnba" ? "wnba" : "nba"}
                        eventId={row.eventId}
                        market={row.market}
                        selKey={row.selKey}
                        line={row.line}
                        bestOdds={row.bestOdds}
                        loading={oddsLoading}
                      />
                      <button
                        type="button"
                        aria-label={isExpanded ? "Collapse row insights" : "Expand row insights"}
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedRowKey(isExpanded ? null : rowKey);
                        }}
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 active:scale-[0.96]",
                          isExpanded
                            ? "border-brand/40 bg-brand/15 text-brand"
                            : "border-neutral-200 bg-white text-neutral-500 hover:border-brand/30 hover:text-brand dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                        )}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {isExpanded && !isBlurred && (
                <tr className="border-b border-brand/20 bg-brand/[0.025] dark:bg-brand/[0.06]">
                  <td colSpan={tableConfig.columnWidths.length} className="p-0" onClick={(event) => event.stopPropagation()}>
                    <ExpandedRowPanel
                      row={row}
                      sport={rowSport}
                      onOpenFullReport={onRowClick}
                    />
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      
      {/* Load More Button - Premium */}
      {hasMore && onLoadMore && (
        <div className="sticky bottom-0 flex items-center justify-center py-5 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-neutral-900 dark:via-neutral-900/95">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className={cn(
              "flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200",
              "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
              "hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:shadow-lg",
              "border border-neutral-200/80 dark:border-neutral-700/80",
              "shadow-md ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
              isLoadingMore && "opacity-70 cursor-not-allowed"
            )}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More
                {totalCount !== undefined && (
                  <span className="text-neutral-400 dark:text-neutral-500">
                    ({rows.length} of {totalCount})
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Optional bottom content (for gated CTA) */}
      {bottomContent}
      </div>
    </div>
  );
}
