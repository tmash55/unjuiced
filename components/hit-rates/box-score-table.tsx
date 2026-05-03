"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePlayerBoxScores, BoxScoreGame, SeasonSummary } from "@/hooks/use-player-box-scores";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { formatMarketLabel } from "@/lib/data/markets";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

interface BoxScoreTableProps {
  sport?: "nba" | "mlb";
  playerId: number | null;
  market?: string | null;
  currentLine?: number | null;
  season?: string;
  className?: string;
  variant?: "default" | "modal";
  // Optional pre-fetched data to avoid duplicate API calls
  prefetchedGames?: BoxScoreGame[];
  prefetchedSeasonSummary?: SeasonSummary | null;
}

type SortField =
  | "date"
  | "pts"
  | "reb"
  | "ast"
  | "pra"
  | "fg3m"
  | "stl"
  | "blk"
  | "minutes"
  | "plusMinus"
  | "marketStat"
  | "hits"
  | "homeRuns"
  | "runs"
  | "rbi"
  | "totalBases"
  | "hitsAllowed"
  | "strikeouts"
  | "outs"
  | "innings"
  | "plateAppearances"
  | "walks"
  | "battingAvg"
  | "obp"
  | "slg"
  | "earnedRuns"
  | "whip";
type SortDirection = "asc" | "desc";

// Get the stat value based on market
const getMarketStat = (game: BoxScoreGame, market: string | null | undefined): number => {
  if (!market) return game.pts;
  
  switch (market) {
    case "player_points": return game.pts;
    case "player_rebounds": return game.reb;
    case "player_assists": return game.ast;
    case "player_threes_made": return game.fg3m;
    case "player_steals": return game.stl;
    case "player_blocks": return game.blk;
    case "player_points_rebounds_assists": return game.pra;
    case "player_points_rebounds": return game.pr;
    case "player_points_assists": return game.pa;
    case "player_rebounds_assists": return game.ra;
    case "player_blocks_steals": return game.bs;
    case "player_hits": return game.mlbHits ?? 0;
    case "player_home_runs": return game.mlbHomeRuns ?? 0;
    case "player_runs_scored": return game.mlbRunsScored ?? 0;
    case "player_rbi": return game.mlbRbi ?? 0;
    case "player_rbis": return game.mlbRbi ?? 0;
    case "player_total_bases": return game.mlbTotalBases ?? 0;
    case "player_hits__runs__rbis": return (game.mlbHits ?? 0) + (game.mlbRunsScored ?? 0) + (game.mlbRbi ?? 0);
    case "player_strikeouts":
    case "pitcher_strikeouts": return game.mlbPitcherStrikeouts ?? 0;
    case "player_hits_allowed":
    case "pitcher_hits_allowed": return game.mlbHitsAllowed ?? 0;
    case "player_earned_runs":
    case "pitcher_earned_runs": return game.mlbEarnedRuns ?? 0;
    case "player_outs":
    case "pitcher_outs":
    case "pitcher_outs_recorded": return game.mlbPitcherOuts ?? Math.round((game.mlbInningsPitched ?? 0) * 3);
    case "player_walks_allowed":
    case "pitcher_walks":
    case "pitcher_walks_allowed": return game.mlbWalks ?? 0;
    default: return game.pts;
  }
};

const MLB_PITCHER_MARKETS = new Set([
  "player_strikeouts",
  "pitcher_strikeouts",
  "player_hits_allowed",
  "pitcher_hits_allowed",
  "player_earned_runs",
  "pitcher_earned_runs",
  "player_outs",
  "pitcher_outs",
  "pitcher_outs_recorded",
  "player_walks_allowed",
  "pitcher_walks",
  "pitcher_walks_allowed",
]);

const isMlbPitcherMarket = (market: string | null | undefined) => {
  return !!market && MLB_PITCHER_MARKETS.has(market);
};

// Format date as "Sun 11/30"
const formatGameDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.getMonth() + 1;
  const dayNum = date.getDate();
  return `${day} ${month}/${dayNum}`;
};

const formatMlbRate = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const normalized = value > 1 ? value / 1000 : value;
  return normalized.toFixed(3).replace(/^0/, "");
};

const getMlbBattingAvg = (game: BoxScoreGame) => {
  if (game.mlbBattingAvg !== null && game.mlbBattingAvg !== undefined) return game.mlbBattingAvg;
  const atBats = game.mlbAtBats ?? 0;
  return atBats > 0 ? (game.mlbHits ?? 0) / atBats : null;
};

const getMlbObp = (game: BoxScoreGame) => {
  if (game.mlbObp !== null && game.mlbObp !== undefined) return game.mlbObp;
  const plateAppearances = game.mlbPlateAppearances ?? 0;
  return plateAppearances > 0 ? ((game.mlbHits ?? 0) + (game.mlbWalks ?? 0)) / plateAppearances : null;
};

const getMlbSlg = (game: BoxScoreGame) => {
  if (game.mlbSlg !== null && game.mlbSlg !== undefined) return game.mlbSlg;
  const atBats = game.mlbAtBats ?? 0;
  return atBats > 0 ? (game.mlbTotalBases ?? 0) / atBats : null;
};

const formatInningsPitched = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const whole = Math.trunc(value);
  let outs = Math.round((value - whole) * 3);
  if (outs >= 3) return `${whole + 1}.0`;
  return `${whole}.${outs}`;
};

const getPitcherOuts = (game: BoxScoreGame) => {
  return game.mlbPitcherOuts ?? Math.round((game.mlbInningsPitched ?? 0) * 3);
};

export function BoxScoreTable({
  sport = "nba",
  playerId,
  market,
  currentLine,
  season,
  className,
  variant = "default",
  prefetchedGames,
  prefetchedSeasonSummary,
}: BoxScoreTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const isMlb = sport === "mlb";
  const isModal = variant === "modal";

  const wrapperClass = isModal
    ? "rounded-lg border border-border bg-card shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] overflow-hidden"
    : "rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5";
  const headerWrapperClass = isModal
    ? "border-b border-border px-4 py-3"
    : "relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60";
  const accentBarClass = isModal
    ? "h-7 w-1 rounded-full bg-brand"
    : "h-10 w-1.5 rounded-full bg-gradient-to-b from-sky-500 to-blue-600 shadow-sm shadow-sky-500/30";
  const titleClass = isModal
    ? "text-sm font-black text-foreground tracking-tight"
    : "text-lg font-bold text-neutral-900 dark:text-white tracking-tight";
  const pillClass = isModal
    ? "px-2 py-0.5 rounded-md bg-brand/10 text-brand text-[10px] font-bold tabular-nums"
    : "px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 text-xs font-bold";
  const subtitleClass = isModal
    ? "text-[11px] text-muted-foreground font-medium"
    : "text-xs text-neutral-500 dark:text-neutral-400 font-medium";
  const theadClass = isModal
    ? "sticky top-0 z-10 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm"
    : "sticky top-0 z-10 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm";
  const thBaseClass = isModal
    ? "px-2 py-2.5 text-center font-black text-muted-foreground uppercase text-[10px] tracking-wide"
    : "px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide";
  const thBaseLeftClass = isModal
    ? "px-3 py-2.5 text-left font-black text-muted-foreground uppercase text-[10px] tracking-wide"
    : "px-3 py-2.5 text-left font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide";
  const thSortableHoverClass = isModal
    ? "cursor-pointer hover:text-foreground"
    : "cursor-pointer hover:text-neutral-800 dark:hover:text-white";
  const tdMutedClass = isModal
    ? "px-2 py-2 text-center text-foreground/80"
    : "px-2 py-2 text-center text-neutral-700 dark:text-neutral-300";
  const tdMutedTabularClass = isModal
    ? "px-2 py-2 text-center text-foreground/80 tabular-nums"
    : "px-2 py-2 text-center text-neutral-700 dark:text-neutral-300 tabular-nums";
  const rowAltClass = isModal
    ? "bg-white dark:bg-neutral-900/40"
    : "bg-white dark:bg-neutral-800";
  const rowAltAltClass = isModal
    ? "bg-neutral-50/50 dark:bg-neutral-800/30"
    : "bg-neutral-50/70 dark:bg-neutral-800/70";
  const rowDividerClass = isModal
    ? "border-b border-border/60"
    : "border-b border-neutral-100 dark:border-neutral-700/50";
  const rowHoverClass = isModal
    ? "hover:bg-brand/8"
    : "hover:bg-blue-50/50 dark:hover:bg-blue-900/10";
  const tfootClass = isModal
    ? "sticky bottom-0 z-10 bg-neutral-100 dark:bg-neutral-800/80 border-t border-border"
    : "sticky bottom-0 z-10 bg-neutral-100 dark:bg-neutral-700 border-t-2 border-neutral-300 dark:border-neutral-500";
  const tfootStatClass = isModal
    ? "px-2 py-2.5 text-center text-foreground/80"
    : "px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200";
  const tfootMutedClass = isModal
    ? "px-2 py-2.5 text-center text-muted-foreground"
    : "px-2 py-2.5 text-center text-neutral-400 dark:text-neutral-500";
  const tfootHighlightClass = isModal
    ? "px-2 py-2.5 text-center text-foreground font-black"
    : "px-2 py-2.5 text-center text-neutral-900 dark:text-white";
  const tfootLabelClass = isModal
    ? "px-3 py-2.5 text-left text-foreground"
    : "px-3 py-2.5 text-left text-neutral-700 dark:text-neutral-200";
  const headerGradientOverlay = isModal ? null : (
    <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-sky-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-sky-900/10" />
  );

  // Only fetch if we don't have prefetched data
  const { games: fetchedGames, seasonSummary: fetchedSeasonSummary, isLoading, error } = usePlayerBoxScores({
    playerId,
    season,
    limit: 50,
    enabled: sport === "nba" && !!playerId && !prefetchedGames,
  });

  // Use prefetched data if available, otherwise use fetched data
  const games = prefetchedGames ?? fetchedGames;
  const seasonSummary = prefetchedSeasonSummary !== undefined ? prefetchedSeasonSummary : fetchedSeasonSummary;

  // Sort games
  const sortedGames = useMemo(() => {
    const sorted = [...games].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "date":
          aVal = a.date;
          bVal = b.date;
          break;
        case "marketStat":
          aVal = getMarketStat(a, market);
          bVal = getMarketStat(b, market);
          break;
        case "hits":
          aVal = a.mlbHits ?? 0;
          bVal = b.mlbHits ?? 0;
          break;
        case "homeRuns":
          aVal = a.mlbHomeRuns ?? 0;
          bVal = b.mlbHomeRuns ?? 0;
          break;
        case "runs":
          aVal = a.mlbRunsScored ?? 0;
          bVal = b.mlbRunsScored ?? 0;
          break;
        case "rbi":
          aVal = a.mlbRbi ?? 0;
          bVal = b.mlbRbi ?? 0;
          break;
        case "totalBases":
          aVal = a.mlbTotalBases ?? 0;
          bVal = b.mlbTotalBases ?? 0;
          break;
        case "hitsAllowed":
          aVal = a.mlbHitsAllowed ?? 0;
          bVal = b.mlbHitsAllowed ?? 0;
          break;
        case "strikeouts":
          aVal = isMlbPitcherMarket(market) ? a.mlbPitcherStrikeouts ?? 0 : a.mlbStrikeOuts ?? 0;
          bVal = isMlbPitcherMarket(market) ? b.mlbPitcherStrikeouts ?? 0 : b.mlbStrikeOuts ?? 0;
          break;
        case "outs":
          aVal = getPitcherOuts(a);
          bVal = getPitcherOuts(b);
          break;
        case "innings":
          aVal = a.mlbInningsPitched ?? 0;
          bVal = b.mlbInningsPitched ?? 0;
          break;
        case "plateAppearances":
          aVal = a.mlbPlateAppearances ?? 0;
          bVal = b.mlbPlateAppearances ?? 0;
          break;
        case "walks":
          aVal = a.mlbWalks ?? 0;
          bVal = b.mlbWalks ?? 0;
          break;
        case "battingAvg":
          aVal = getMlbBattingAvg(a) ?? 0;
          bVal = getMlbBattingAvg(b) ?? 0;
          break;
        case "obp":
          aVal = getMlbObp(a) ?? 0;
          bVal = getMlbObp(b) ?? 0;
          break;
        case "slg":
          aVal = getMlbSlg(a) ?? 0;
          bVal = getMlbSlg(b) ?? 0;
          break;
        case "earnedRuns":
          aVal = a.mlbEarnedRuns ?? 0;
          bVal = b.mlbEarnedRuns ?? 0;
          break;
        case "whip":
          aVal = a.mlbWhipGame ?? 0;
          bVal = b.mlbWhipGame ?? 0;
          break;
        case "pts":
          aVal = a.pts;
          bVal = b.pts;
          break;
        case "reb":
          aVal = a.reb;
          bVal = b.reb;
          break;
        case "ast":
          aVal = a.ast;
          bVal = b.ast;
          break;
        case "pra":
          aVal = a.pra;
          bVal = b.pra;
          break;
        case "fg3m":
          aVal = a.fg3m;
          bVal = b.fg3m;
          break;
        case "stl":
          aVal = a.stl;
          bVal = b.stl;
          break;
        case "blk":
          aVal = a.blk;
          bVal = b.blk;
          break;
        case "minutes":
          aVal = a.minutes;
          bVal = b.minutes;
          break;
        case "plusMinus":
          aVal = a.plusMinus;
          bVal = b.plusMinus;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      
      return sortDirection === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return sorted;
  }, [games, market, sortField, sortDirection]);

  // Calculate averages for footer - must be before early returns
  const averages = useMemo(() => {
    if (isMlb) return null;
    if (games.length === 0) return null;
    
    const sum = games.reduce((acc, g) => ({
      minutes: acc.minutes + (g.minutes || 0),
      fgm: acc.fgm + g.fgm,
      fga: acc.fga + g.fga,
      fg3m: acc.fg3m + g.fg3m,
      fg3a: acc.fg3a + g.fg3a,
      ftm: acc.ftm + g.ftm,
      fta: acc.fta + g.fta,
      reb: acc.reb + g.reb,
      ast: acc.ast + g.ast,
      blk: acc.blk + g.blk,
      stl: acc.stl + g.stl,
      pf: acc.pf + (g.fouls || 0),
      tov: acc.tov + (g.tov || 0),
      pts: acc.pts + g.pts,
      oreb: acc.oreb + (g.oreb || 0),
      dreb: acc.dreb + (g.dreb || 0),
      plusMinus: acc.plusMinus + (g.plusMinus || 0),
    }), { minutes: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, blk: 0, stl: 0, pf: 0, tov: 0, pts: 0, oreb: 0, dreb: 0, plusMinus: 0 });

    const n = games.length;
    return {
      minutes: (sum.minutes / n).toFixed(1),
      fgm: (sum.fgm / n).toFixed(1),
      fga: (sum.fga / n).toFixed(1),
      fg3m: (sum.fg3m / n).toFixed(1),
      fg3a: (sum.fg3a / n).toFixed(1),
      ftm: (sum.ftm / n).toFixed(1),
      fta: (sum.fta / n).toFixed(1),
      reb: (sum.reb / n).toFixed(1),
      ast: (sum.ast / n).toFixed(1),
      blk: (sum.blk / n).toFixed(1),
      stl: (sum.stl / n).toFixed(1),
      pf: (sum.pf / n).toFixed(1),
      tov: (sum.tov / n).toFixed(1),
      pts: (sum.pts / n).toFixed(1),
      oreb: (sum.oreb / n).toFixed(1),
      dreb: (sum.dreb / n).toFixed(1),
      plusMinus: (sum.plusMinus / n).toFixed(1),
    };
  }, [games, isMlb]);

  const mlbAverages = useMemo(() => {
    if (!isMlb || games.length === 0) return null;
    const n = games.length;
    const sum = games.reduce(
      (acc, g) => ({
        marketStat: acc.marketStat + getMarketStat(g, market),
        hits: acc.hits + (g.mlbHits ?? 0),
        homeRuns: acc.homeRuns + (g.mlbHomeRuns ?? 0),
        runs: acc.runs + (g.mlbRunsScored ?? 0),
        rbi: acc.rbi + (g.mlbRbi ?? 0),
        totalBases: acc.totalBases + (g.mlbTotalBases ?? 0),
        strikeouts: acc.strikeouts + (g.mlbPitcherStrikeouts ?? 0),
        outs: acc.outs + getPitcherOuts(g),
        innings: acc.innings + (g.mlbInningsPitched ?? 0),
        walks: acc.walks + (g.mlbWalks ?? 0),
        batterStrikeouts: acc.batterStrikeouts + (g.mlbStrikeOuts ?? 0),
        hitsAllowed: acc.hitsAllowed + (g.mlbHitsAllowed ?? 0),
        earnedRuns: acc.earnedRuns + (g.mlbEarnedRuns ?? 0),
        whip: acc.whip + (g.mlbWhipGame ?? 0),
        atBats: acc.atBats + (g.mlbAtBats ?? 0),
        plateAppearances: acc.plateAppearances + (g.mlbPlateAppearances ?? 0),
      }),
      {
        marketStat: 0,
        hits: 0,
        homeRuns: 0,
        runs: 0,
        rbi: 0,
        totalBases: 0,
        strikeouts: 0,
        outs: 0,
        innings: 0,
        walks: 0,
        batterStrikeouts: 0,
        hitsAllowed: 0,
        earnedRuns: 0,
        whip: 0,
        atBats: 0,
        plateAppearances: 0,
      }
    );

    return {
      marketStat: (sum.marketStat / n).toFixed(1),
      hits: (sum.hits / n).toFixed(1),
      homeRuns: (sum.homeRuns / n).toFixed(1),
      runs: (sum.runs / n).toFixed(1),
      rbi: (sum.rbi / n).toFixed(1),
      totalBases: (sum.totalBases / n).toFixed(1),
      strikeouts: (sum.strikeouts / n).toFixed(1),
      outs: (sum.outs / n).toFixed(1),
      innings: formatInningsPitched(sum.innings / n),
      walks: (sum.walks / n).toFixed(1),
      batterStrikeouts: (sum.batterStrikeouts / n).toFixed(1),
      hitsAllowed: (sum.hitsAllowed / n).toFixed(1),
      earnedRuns: (sum.earnedRuns / n).toFixed(1),
      era: sum.innings > 0 ? ((sum.earnedRuns * 9) / sum.innings).toFixed(2) : "-",
      whip: sum.innings > 0 ? ((sum.walks + sum.hitsAllowed) / sum.innings).toFixed(2) : "-",
      kMinusBb: ((sum.strikeouts - sum.walks) / n).toFixed(1),
      battingAvg: formatMlbRate(sum.atBats > 0 ? sum.hits / sum.atBats : null),
      obp: formatMlbRate(sum.plateAppearances > 0 ? (sum.hits + sum.walks) / sum.plateAppearances : null),
      slg: formatMlbRate(sum.atBats > 0 ? sum.totalBases / sum.atBats : null),
    };
  }, [games, isMlb, market]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <div className={cn(wrapperClass, className)}>
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <div className={cn("h-8 w-8 rounded-full animate-spin border-2", isModal ? "border-border border-t-brand" : "border-sky-200 border-t-sky-500")} />
            <span className={cn("text-sm font-medium", isModal ? "text-muted-foreground" : "text-neutral-500 dark:text-neutral-400")}>Loading box scores...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(wrapperClass, "p-6", className)}>
        <p className="text-sm text-red-500 font-medium">Failed to load box scores</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className={cn(wrapperClass, "p-6", className)}>
        <p className={cn("text-sm font-medium", isModal ? "text-muted-foreground" : "text-neutral-500 dark:text-neutral-400")}>No box score data available</p>
      </div>
    );
  }

  if (isMlb) {
    const isPitcherMarket = isMlbPitcherMarket(market);
    return (
      <div className={cn(wrapperClass, className)}>
        <div className="relative overflow-hidden">
          {headerGradientOverlay}
          <div className={headerWrapperClass}>
            <div className="flex items-center gap-3">
              <div className={accentBarClass} />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={titleClass}>Game Log</h2>
                  <span className={pillClass}>
                    {games.length} games
                  </span>
                </div>
                <p className={subtitleClass}>
                  MLB historical game logs
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
            <table className="min-w-full text-xs">
              <thead className={theadClass}>
                <tr>
                  <th
                    className={cn(thBaseLeftClass, thSortableHoverClass)}
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      DATE <SortIcon field="date" />
                    </div>
                  </th>
                  <th className={thBaseClass}>
                    OPP
                  </th>
                  <th className={thBaseClass}>
                    RESULT
                  </th>
                  <th
                    className={cn(thBaseClass, thSortableHoverClass)}
                    onClick={() => handleSort("marketStat")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {formatMarketLabel(market || "")} <SortIcon field="marketStat" />
                    </div>
                  </th>
                  {isPitcherMarket ? (
                    <>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("innings")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          IP <SortIcon field="innings" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("outs")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          OUTS <SortIcon field="outs" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("strikeouts")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          K <SortIcon field="strikeouts" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("hitsAllowed")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          H <SortIcon field="hitsAllowed" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("earnedRuns")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          ER <SortIcon field="earnedRuns" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("walks")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          BB <SortIcon field="walks" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("whip")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          WHIP <SortIcon field="whip" />
                        </div>
                      </th>
                      <th className={thBaseClass}>
                        ERA
                      </th>
                      <th className={thBaseClass}>
                        K-BB
                      </th>
                    </>
                  ) : (
                    <>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("plateAppearances")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          PA <SortIcon field="plateAppearances" />
                        </div>
                      </th>
                      <th className={thBaseClass}>
                        AB
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("hits")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          H <SortIcon field="hits" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("homeRuns")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          HR <SortIcon field="homeRuns" />
                        </div>
                      </th>
                      <th className={thBaseClass}>
                        R
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("rbi")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          RBI <SortIcon field="rbi" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("totalBases")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          TB <SortIcon field="totalBases" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("walks")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          BB <SortIcon field="walks" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("strikeouts")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          SO <SortIcon field="strikeouts" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("battingAvg")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          AVG <SortIcon field="battingAvg" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("obp")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          OBP <SortIcon field="obp" />
                        </div>
                      </th>
                      <th
                        className={cn(thBaseClass, thSortableHoverClass)}
                        onClick={() => handleSort("slg")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          SLG <SortIcon field="slg" />
                        </div>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedGames.map((game, idx) => {
                  const marketStat = getMarketStat(game, market);
                  const isOverLine = currentLine != null && marketStat >= currentLine;
                  return (
                    <tr
                      key={game.gameId}
                      className={cn(
                        "transition-colors", rowHoverClass, rowDividerClass,
                        idx % 2 === 0 ? rowAltClass : rowAltAltClass
                      )}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={cn("font-medium", isModal ? "text-foreground" : "text-neutral-700 dark:text-neutral-200")}>{formatGameDate(game.date)}</span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <span className={cn("text-[10px]", isModal ? "text-muted-foreground" : "text-neutral-400")}>{game.homeAway === "H" ? "vs" : "@"}</span>
                          <img
                            src={getTeamLogoUrl(game.opponentAbbr, "mlb")}
                            alt={game.opponentAbbr}
                            className="w-4 h-4 object-contain"
                          />
                          <span className={cn("font-medium text-[10px]", isModal ? "text-foreground/80" : "text-neutral-700 dark:text-neutral-300")}>{game.opponentAbbr}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <span className={cn("font-bold", game.result === "W" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                          {game.result}
                        </span>
                        <span className={cn("ml-1 text-[10px]", isModal ? "text-muted-foreground" : "text-neutral-500 dark:text-neutral-400")}>{game.teamScore}-{game.opponentScore}</span>
                      </td>
                      <td className={cn("px-2 py-2 text-center font-bold", isOverLine ? "text-emerald-600 dark:text-emerald-400" : isModal ? "text-foreground" : "text-neutral-900 dark:text-white")}>
                        {marketStat}
                      </td>
                      {isPitcherMarket ? (
                        <>
                          <td className={tdMutedClass}>{formatInningsPitched(game.mlbInningsPitched)}</td>
                          <td className={tdMutedClass}>{getPitcherOuts(game)}</td>
                          <td className={tdMutedClass}>{game.mlbPitcherStrikeouts ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbHitsAllowed ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbEarnedRuns ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbWalks ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbWhipGame?.toFixed(2) ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbEraGame?.toFixed(2) ?? "-"}</td>
                          <td className={tdMutedClass}>
                            {game.mlbPitcherStrikeouts != null && game.mlbWalks != null ? game.mlbPitcherStrikeouts - game.mlbWalks : "-"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={tdMutedClass}>{game.mlbPlateAppearances ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbAtBats ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbHits ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbHomeRuns ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbRunsScored ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbRbi ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbTotalBases ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbWalks ?? "-"}</td>
                          <td className={tdMutedClass}>{game.mlbStrikeOuts ?? "-"}</td>
                          <td className={tdMutedTabularClass}>{formatMlbRate(getMlbBattingAvg(game))}</td>
                          <td className={tdMutedTabularClass}>{formatMlbRate(getMlbObp(game))}</td>
                          <td className={tdMutedTabularClass}>{formatMlbRate(getMlbSlg(game))}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {mlbAverages && (
                <tfoot className={tfootClass}>
                  <tr className="font-bold">
                    <td className={tfootLabelClass}>AVERAGES</td>
                    <td className={tfootMutedClass}>—</td>
                    <td className={tfootMutedClass}>—</td>
                    <td className={tfootHighlightClass}>{mlbAverages.marketStat}</td>
                    {isPitcherMarket ? (
                      <>
                        <td className={tfootStatClass}>{mlbAverages.innings}</td>
                        <td className={tfootStatClass}>{mlbAverages.outs}</td>
                        <td className={tfootStatClass}>{mlbAverages.strikeouts}</td>
                        <td className={tfootStatClass}>{mlbAverages.hitsAllowed}</td>
                        <td className={tfootStatClass}>{mlbAverages.earnedRuns}</td>
                        <td className={tfootStatClass}>{mlbAverages.walks}</td>
                        <td className={tfootStatClass}>{mlbAverages.whip}</td>
                        <td className={tfootStatClass}>{mlbAverages.era}</td>
                        <td className={tfootStatClass}>{mlbAverages.kMinusBb}</td>
                      </>
                    ) : (
                      <>
                        <td className={tfootStatClass}>—</td>
                        <td className={tfootStatClass}>—</td>
                        <td className={tfootStatClass}>{mlbAverages.hits}</td>
                        <td className={tfootStatClass}>{mlbAverages.homeRuns}</td>
                        <td className={tfootStatClass}>{mlbAverages.runs}</td>
                        <td className={tfootStatClass}>{mlbAverages.rbi}</td>
                        <td className={tfootStatClass}>{mlbAverages.totalBases}</td>
                        <td className={tfootStatClass}>{mlbAverages.walks}</td>
                        <td className={tfootStatClass}>{mlbAverages.batterStrikeouts}</td>
                        <td className={tfootStatClass}>{mlbAverages.battingAvg}</td>
                        <td className={tfootStatClass}>{mlbAverages.obp}</td>
                        <td className={tfootStatClass}>{mlbAverages.slg}</td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(wrapperClass, className)}>
      <div className="relative overflow-hidden">
        {headerGradientOverlay}
        <div className={headerWrapperClass}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={accentBarClass} />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={titleClass}>
                    Game Log
                  </h2>
                  <span className={pillClass}>
                    {games.length} games
                  </span>
                </div>
                <p className={subtitleClass}>
                  Full season box scores
                  {seasonSummary && <span className="ml-2">· {seasonSummary.record}</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
          <table className="min-w-full text-xs">
            <thead className={theadClass}>
              <tr>
                <th 
                  className={cn(thBaseLeftClass, thSortableHoverClass)}
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    DATE <SortIcon field="date" />
                  </div>
                </th>
                <th className={thBaseClass}>
                  OPP
                </th>
                <th className={thBaseClass}>
                  RESULT
                </th>
                <th 
                  className={cn(thBaseClass, thSortableHoverClass)}
                  onClick={() => handleSort("minutes")}
                >
                  <div className="flex items-center justify-center gap-1">
                    MIN <SortIcon field="minutes" />
                  </div>
                </th>
                <th 
                  className={cn(thBaseClass, thSortableHoverClass)}
                  onClick={() => handleSort("pts")}
                >
                  <div className="flex items-center justify-center gap-1">
                    PTS <SortIcon field="pts" />
                  </div>
                </th>
                <th className={thBaseClass}>
                  FG
                </th>
                <th className={thBaseClass}>
                  3PT
                </th>
                <th className={thBaseClass}>
                  FT
                </th>
                <th 
                  className={cn(thBaseClass, thSortableHoverClass)}
                  onClick={() => handleSort("reb")}
                >
                  <div className="flex items-center justify-center gap-1">
                    REB <SortIcon field="reb" />
                  </div>
                </th>
                <th 
                  className={cn(thBaseClass, thSortableHoverClass)}
                  onClick={() => handleSort("ast")}
                >
                  <div className="flex items-center justify-center gap-1">
                    AST <SortIcon field="ast" />
                  </div>
                </th>
                <th className={thBaseClass}>
                  TO
                </th>
                <th 
                  className={cn(thBaseClass, thSortableHoverClass)}
                  onClick={() => handleSort("stl")}
                >
                  <div className="flex items-center justify-center gap-1">
                    STL <SortIcon field="stl" />
                  </div>
                </th>
                <th 
                  className={cn(thBaseClass, thSortableHoverClass)}
                  onClick={() => handleSort("blk")}
                >
                  <div className="flex items-center justify-center gap-1">
                    BLK <SortIcon field="blk" />
                  </div>
                </th>
                <th className={thBaseClass}>
                  OREB
                </th>
                <th className={thBaseClass}>
                  DREB
                </th>
                <th className={thBaseClass}>
                  PF
                </th>
                <th 
                  className={cn(thBaseClass, thSortableHoverClass)}
                  onClick={() => handleSort("plusMinus")}
                >
                  <div className="flex items-center justify-center gap-1">
                    +/- <SortIcon field="plusMinus" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGames.map((game, idx) => {
                const marketStat = getMarketStat(game, market);
                const isOverLine = currentLine != null && marketStat > currentLine;
                
                return (
                  <tr 
                    key={game.gameId}
                    className={cn(
                      "transition-colors", rowHoverClass, rowDividerClass,
                      idx % 2 === 0 ? rowAltClass : rowAltAltClass
                    )}
                  >
                    {/* Date - Day + Date format */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={cn("font-medium", isModal ? "text-foreground" : "text-neutral-700 dark:text-neutral-200")}>
                        {formatGameDate(game.date)}
                      </span>
                    </td>

                    {/* Opponent */}
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <span className={cn("text-[10px]", isModal ? "text-muted-foreground" : "text-neutral-400")}>
                          {game.homeAway === "H" ? "vs" : "@"}
                        </span>
                        <img
                          src={getTeamLogoUrl(game.opponentAbbr, "nba")}
                          alt={game.opponentAbbr}
                          className="w-4 h-4 object-contain"
                        />
                        <span className={cn("font-medium text-[10px]", isModal ? "text-foreground/80" : "text-neutral-700 dark:text-neutral-300")}>
                          {game.opponentAbbr}
                        </span>
                      </div>
                    </td>

                    {/* Result - W/L with score */}
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <span className={cn(
                        "font-bold",
                        game.result === "W" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                      )}>
                        {game.result}
                      </span>
                      <span className={cn("ml-1 text-[10px]", isModal ? "text-muted-foreground" : "text-neutral-500 dark:text-neutral-400")}>
                        {game.teamScore}-{game.opponentScore}
                      </span>
                    </td>

                    {/* Minutes */}
                    <td className={isModal ? "px-2 py-2 text-center text-foreground/80" : "px-2 py-2 text-center text-neutral-600 dark:text-neutral-300"}>
                      {game.minutes?.toFixed(0) ?? "—"}
                    </td>

                    {/* Points */}
                    <td className={cn(
                      "px-2 py-2 text-center font-bold",
                      market === "player_points" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isModal ? "text-foreground" : "text-neutral-900 dark:text-white"
                    )}>
                      {game.pts}
                    </td>

                    {/* FG */}
                    <td className={isModal ? "px-2 py-2 text-center text-foreground/80" : "px-2 py-2 text-center text-neutral-600 dark:text-neutral-300"}>
                      {game.fgm}-{game.fga}
                    </td>

                    {/* 3PT */}
                    <td className={isModal ? "px-2 py-2 text-center text-foreground/80" : "px-2 py-2 text-center text-neutral-600 dark:text-neutral-300"}>
                      {game.fg3m}-{game.fg3a}
                    </td>

                    {/* FT */}
                    <td className={isModal ? "px-2 py-2 text-center text-foreground/80" : "px-2 py-2 text-center text-neutral-600 dark:text-neutral-300"}>
                      {game.ftm}-{game.fta}
                    </td>

                    {/* Rebounds */}
                    <td className={cn(
                      "px-2 py-2 text-center font-medium",
                      market === "player_rebounds" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isModal ? "text-foreground" : "text-neutral-900 dark:text-white"
                    )}>
                      {game.reb}
                    </td>

                    {/* Assists */}
                    <td className={cn(
                      "px-2 py-2 text-center font-medium",
                      market === "player_assists" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isModal ? "text-foreground" : "text-neutral-900 dark:text-white"
                    )}>
                      {game.ast}
                    </td>

                    {/* Turnovers */}
                    <td className={isModal ? "px-2 py-2 text-center text-foreground/80" : "px-2 py-2 text-center text-neutral-600 dark:text-neutral-300"}>
                      {game.tov ?? 0}
                    </td>

                    {/* Steals */}
                    <td className={cn(
                      "px-2 py-2 text-center",
                      market === "player_steals" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : isModal ? "text-foreground/80" : "text-neutral-600 dark:text-neutral-300"
                    )}>
                      {game.stl}
                    </td>

                    {/* Blocks */}
                    <td className={cn(
                      "px-2 py-2 text-center",
                      market === "player_blocks" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : isModal ? "text-foreground/80" : "text-neutral-600 dark:text-neutral-300"
                    )}>
                      {game.blk}
                    </td>

                    {/* Offensive Rebounds */}
                    <td className={isModal ? "px-2 py-2 text-center text-foreground/80" : "px-2 py-2 text-center text-neutral-600 dark:text-neutral-300"}>
                      {game.oreb ?? 0}
                    </td>

                    {/* Defensive Rebounds */}
                    <td className={isModal ? "px-2 py-2 text-center text-foreground/80" : "px-2 py-2 text-center text-neutral-600 dark:text-neutral-300"}>
                      {game.dreb ?? 0}
                    </td>

                    {/* Personal Fouls */}
                    <td className={isModal ? "px-2 py-2 text-center text-foreground/80" : "px-2 py-2 text-center text-neutral-600 dark:text-neutral-300"}>
                      {game.fouls ?? 0}
                    </td>

                    {/* Plus/Minus */}
                    <td className={cn(
                      "px-2 py-2 text-center font-medium",
                      (game.plusMinus ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" :
                      (game.plusMinus ?? 0) < 0 ? "text-red-500 dark:text-red-400" :
                      isModal ? "text-foreground/80" : "text-neutral-600 dark:text-neutral-300"
                    )}>
                      {game.plusMinus != null ? (game.plusMinus > 0 ? `+${game.plusMinus}` : game.plusMinus) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Averages Footer Row - inside same table for alignment */}
            {averages && (
              <tfoot className={tfootClass}>
                <tr className="font-bold">
                  <td className={cn(tfootLabelClass, "whitespace-nowrap")}>
                    AVERAGES
                  </td>
                  <td className={tfootMutedClass}>
                    —
                  </td>
                  <td className={tfootMutedClass}>
                    —
                  </td>
                  <td className={tfootStatClass}>
                    {averages.minutes}
                  </td>
                  <td className={tfootHighlightClass}>
                    {averages.pts}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.fgm}-{averages.fga}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.fg3m}-{averages.fg3a}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.ftm}-{averages.fta}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.reb}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.ast}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.tov}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.stl}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.blk}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.oreb ?? "—"}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.dreb ?? "—"}
                  </td>
                  <td className={tfootStatClass}>
                    {averages.pf}
                  </td>
                  <td className={cn(
                    "px-2 py-2.5 text-center font-medium",
                    parseFloat(averages.plusMinus ?? "0") > 0 ? "text-emerald-600 dark:text-emerald-400" :
                    parseFloat(averages.plusMinus ?? "0") < 0 ? "text-red-500 dark:text-red-400" :
                    isModal ? "text-foreground/80" : "text-neutral-700 dark:text-neutral-200"
                  )}>
                    {averages.plusMinus != null ? (parseFloat(averages.plusMinus) > 0 ? `+${averages.plusMinus}` : averages.plusMinus) : "—"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
