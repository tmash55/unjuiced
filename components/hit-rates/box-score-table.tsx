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
  | "strikeouts"
  | "innings";
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
    case "player_total_bases": return game.mlbTotalBases ?? 0;
    case "pitcher_strikeouts": return game.mlbPitcherStrikeouts ?? 0;
    default: return game.pts;
  }
};

// Format date as "Sun 11/30"
const formatGameDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.getMonth() + 1;
  const dayNum = date.getDate();
  return `${day} ${month}/${dayNum}`;
};

export function BoxScoreTable({
  sport = "nba",
  playerId,
  market,
  currentLine,
  season,
  className,
  prefetchedGames,
  prefetchedSeasonSummary,
}: BoxScoreTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const isMlb = sport === "mlb";

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
        case "strikeouts":
          aVal = a.mlbPitcherStrikeouts ?? 0;
          bVal = b.mlbPitcherStrikeouts ?? 0;
          break;
        case "innings":
          aVal = a.mlbInningsPitched ?? 0;
          bVal = b.mlbInningsPitched ?? 0;
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
  }, [games, sortField, sortDirection]);

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
        innings: acc.innings + (g.mlbInningsPitched ?? 0),
        walks: acc.walks + (g.mlbWalks ?? 0),
      }),
      {
        marketStat: 0,
        hits: 0,
        homeRuns: 0,
        runs: 0,
        rbi: 0,
        totalBases: 0,
        strikeouts: 0,
        innings: 0,
        walks: 0,
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
      innings: (sum.innings / n).toFixed(1),
      walks: (sum.walks / n).toFixed(1),
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
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Loading box scores...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 p-6 shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <p className="text-sm text-red-500 font-medium">Failed to load box scores</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 p-6 shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">No box score data available</p>
      </div>
    );
  }

  if (isMlb) {
    const isPitcherMarket = market === "pitcher_strikeouts";
    return (
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-sky-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-sky-900/10" />
          <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-sky-500 to-blue-600 shadow-sm shadow-sky-500/30" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">Game Log</h2>
                  <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 text-xs font-bold">
                    {games.length} games
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  MLB historical game logs
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm">
                <tr>
                  <th
                    className="px-3 py-2.5 text-left font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      DATE <SortIcon field="date" />
                    </div>
                  </th>
                  <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                    OPP
                  </th>
                  <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                    RESULT
                  </th>
                  <th
                    className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                    onClick={() => handleSort("marketStat")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {formatMarketLabel(market || "")} <SortIcon field="marketStat" />
                    </div>
                  </th>
                  {isPitcherMarket ? (
                    <>
                      <th
                        className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                        onClick={() => handleSort("innings")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          IP <SortIcon field="innings" />
                        </div>
                      </th>
                      <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                        H
                      </th>
                      <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                        ER
                      </th>
                      <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                        BB
                      </th>
                      <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                        WHIP
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                        AB
                      </th>
                      <th
                        className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                        onClick={() => handleSort("hits")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          H <SortIcon field="hits" />
                        </div>
                      </th>
                      <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                        R
                      </th>
                      <th
                        className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                        onClick={() => handleSort("rbi")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          RBI <SortIcon field="rbi" />
                        </div>
                      </th>
                      <th
                        className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                        onClick={() => handleSort("totalBases")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          TB <SortIcon field="totalBases" />
                        </div>
                      </th>
                      <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                        BB
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
                        "transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border-b border-neutral-100 dark:border-neutral-700/50",
                        idx % 2 === 0 ? "bg-white dark:bg-neutral-800" : "bg-neutral-50/70 dark:bg-neutral-800/70"
                      )}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-medium text-neutral-700 dark:text-neutral-200">{formatGameDate(game.date)}</span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-neutral-400 text-[10px]">{game.homeAway === "H" ? "vs" : "@"}</span>
                          <img
                            src={getTeamLogoUrl(game.opponentAbbr, "mlb")}
                            alt={game.opponentAbbr}
                            className="w-4 h-4 object-contain"
                          />
                          <span className="font-medium text-neutral-700 dark:text-neutral-300 text-[10px]">{game.opponentAbbr}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <span className={cn("font-bold", game.result === "W" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                          {game.result}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400 ml-1 text-[10px]">{game.teamScore}-{game.opponentScore}</span>
                      </td>
                      <td className={cn("px-2 py-2 text-center font-bold", isOverLine ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white")}>
                        {marketStat}
                      </td>
                      {isPitcherMarket ? (
                        <>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbInningsPitched?.toFixed(1) ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbHitsAllowed ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbEarnedRuns ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbWalks ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbWhipGame?.toFixed(2) ?? "-"}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbAtBats ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbHits ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbRunsScored ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbRbi ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbTotalBases ?? "-"}</td>
                          <td className="px-2 py-2 text-center text-neutral-700 dark:text-neutral-300">{game.mlbWalks ?? "-"}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {mlbAverages && (
                <tfoot className="sticky bottom-0 z-10 bg-neutral-100 dark:bg-neutral-700 border-t-2 border-neutral-300 dark:border-neutral-500">
                  <tr className="font-bold">
                    <td className="px-3 py-2.5 text-left text-neutral-700 dark:text-neutral-200">AVERAGES</td>
                    <td className="px-2 py-2.5 text-center text-neutral-400 dark:text-neutral-500">—</td>
                    <td className="px-2 py-2.5 text-center text-neutral-400 dark:text-neutral-500">—</td>
                    <td className="px-2 py-2.5 text-center text-neutral-900 dark:text-white">{mlbAverages.marketStat}</td>
                    {isPitcherMarket ? (
                      <>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">{mlbAverages.innings}</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">—</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">—</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">{mlbAverages.walks}</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">—</td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">—</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">{mlbAverages.hits}</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">{mlbAverages.runs}</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">{mlbAverages.rbi}</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">{mlbAverages.totalBases}</td>
                        <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">{mlbAverages.walks}</td>
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
    <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
      {/* Header - Premium Design */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-sky-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-sky-900/10" />
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-sky-500 to-blue-600 shadow-sm shadow-sky-500/30" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                    Game Log
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 text-xs font-bold">
                    {games.length} games
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  Full season box scores
                  {seasonSummary && <span className="ml-2">· {seasonSummary.record}</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm">
              <tr>
                <th 
                  className="px-3 py-2.5 text-left font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    DATE <SortIcon field="date" />
                  </div>
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  OPP
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  RESULT
                </th>
                <th 
                  className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                  onClick={() => handleSort("minutes")}
                >
                  <div className="flex items-center justify-center gap-1">
                    MIN <SortIcon field="minutes" />
                  </div>
                </th>
                <th 
                  className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                  onClick={() => handleSort("pts")}
                >
                  <div className="flex items-center justify-center gap-1">
                    PTS <SortIcon field="pts" />
                  </div>
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  FG
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  3PT
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  FT
                </th>
                <th 
                  className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                  onClick={() => handleSort("reb")}
                >
                  <div className="flex items-center justify-center gap-1">
                    REB <SortIcon field="reb" />
                  </div>
                </th>
                <th 
                  className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                  onClick={() => handleSort("ast")}
                >
                  <div className="flex items-center justify-center gap-1">
                    AST <SortIcon field="ast" />
                  </div>
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  TO
                </th>
                <th 
                  className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                  onClick={() => handleSort("stl")}
                >
                  <div className="flex items-center justify-center gap-1">
                    STL <SortIcon field="stl" />
                  </div>
                </th>
                <th 
                  className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
                  onClick={() => handleSort("blk")}
                >
                  <div className="flex items-center justify-center gap-1">
                    BLK <SortIcon field="blk" />
                  </div>
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  OREB
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  DREB
                </th>
                <th className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide">
                  PF
                </th>
                <th 
                  className="px-2 py-2.5 text-center font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[10px] tracking-wide cursor-pointer hover:text-neutral-800 dark:hover:text-white"
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
                      "transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border-b border-neutral-100 dark:border-neutral-700/50",
                      idx % 2 === 0 ? "bg-white dark:bg-neutral-800" : "bg-neutral-50/70 dark:bg-neutral-800/70"
                    )}
                  >
                    {/* Date - Day + Date format */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium text-neutral-700 dark:text-neutral-200">
                        {formatGameDate(game.date)}
                      </span>
                    </td>

                    {/* Opponent */}
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-neutral-400 text-[10px]">
                          {game.homeAway === "H" ? "vs" : "@"}
                        </span>
                        <img
                          src={getTeamLogoUrl(game.opponentAbbr, "nba")}
                          alt={game.opponentAbbr}
                          className="w-4 h-4 object-contain"
                        />
                        <span className="font-medium text-neutral-700 dark:text-neutral-300 text-[10px]">
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
                      <span className="text-neutral-500 dark:text-neutral-400 ml-1 text-[10px]">
                        {game.teamScore}-{game.opponentScore}
                      </span>
                    </td>

                    {/* Minutes */}
                    <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                      {game.minutes?.toFixed(0) ?? "—"}
                    </td>

                    {/* Points */}
                    <td className={cn(
                      "px-2 py-2 text-center font-bold",
                      market === "player_points" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : "text-neutral-900 dark:text-white"
                    )}>
                      {game.pts}
                    </td>

                    {/* FG */}
                    <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                      {game.fgm}-{game.fga}
                    </td>

                    {/* 3PT */}
                    <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                      {game.fg3m}-{game.fg3a}
                    </td>

                    {/* FT */}
                    <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                      {game.ftm}-{game.fta}
                    </td>

                    {/* Rebounds */}
                    <td className={cn(
                      "px-2 py-2 text-center font-medium",
                      market === "player_rebounds" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : "text-neutral-900 dark:text-white"
                    )}>
                      {game.reb}
                    </td>

                    {/* Assists */}
                    <td className={cn(
                      "px-2 py-2 text-center font-medium",
                      market === "player_assists" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : "text-neutral-900 dark:text-white"
                    )}>
                      {game.ast}
                    </td>

                    {/* Turnovers */}
                    <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                      {game.tov ?? 0}
                    </td>

                    {/* Steals */}
                    <td className={cn(
                      "px-2 py-2 text-center",
                      market === "player_steals" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400 font-medium" 
                        : "text-neutral-600 dark:text-neutral-300"
                    )}>
                      {game.stl}
                    </td>

                    {/* Blocks */}
                    <td className={cn(
                      "px-2 py-2 text-center",
                      market === "player_blocks" && isOverLine 
                        ? "text-emerald-600 dark:text-emerald-400 font-medium" 
                        : "text-neutral-600 dark:text-neutral-300"
                    )}>
                      {game.blk}
                    </td>

                    {/* Offensive Rebounds */}
                    <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                      {game.oreb ?? 0}
                    </td>

                    {/* Defensive Rebounds */}
                    <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                      {game.dreb ?? 0}
                    </td>

                    {/* Personal Fouls */}
                    <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                      {game.fouls ?? 0}
                    </td>

                    {/* Plus/Minus */}
                    <td className={cn(
                      "px-2 py-2 text-center font-medium",
                      (game.plusMinus ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" :
                      (game.plusMinus ?? 0) < 0 ? "text-red-500 dark:text-red-400" :
                      "text-neutral-600 dark:text-neutral-300"
                    )}>
                      {game.plusMinus != null ? (game.plusMinus > 0 ? `+${game.plusMinus}` : game.plusMinus) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Averages Footer Row - inside same table for alignment */}
            {averages && (
              <tfoot className="sticky bottom-0 z-10 bg-neutral-100 dark:bg-neutral-700 border-t-2 border-neutral-300 dark:border-neutral-500">
                <tr className="font-bold">
                  <td className="px-3 py-2.5 text-left text-neutral-700 dark:text-neutral-200 whitespace-nowrap">
                    AVERAGES
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-400 dark:text-neutral-500">
                    —
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-400 dark:text-neutral-500">
                    —
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.minutes}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-900 dark:text-white">
                    {averages.pts}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.fgm}-{averages.fga}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.fg3m}-{averages.fg3a}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.ftm}-{averages.fta}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.reb}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.ast}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.tov}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.stl}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.blk}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.oreb ?? "—"}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.dreb ?? "—"}
                  </td>
                  <td className="px-2 py-2.5 text-center text-neutral-700 dark:text-neutral-200">
                    {averages.pf}
                  </td>
                  <td className={cn(
                    "px-2 py-2.5 text-center font-medium",
                    parseFloat(averages.plusMinus ?? "0") > 0 ? "text-emerald-600 dark:text-emerald-400" :
                    parseFloat(averages.plusMinus ?? "0") < 0 ? "text-red-500 dark:text-red-400" :
                    "text-neutral-700 dark:text-neutral-200"
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
