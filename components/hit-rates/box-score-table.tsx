"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePlayerBoxScores, BoxScoreGame, SeasonSummary } from "@/hooks/use-player-box-scores";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

interface BoxScoreTableProps {
  playerId: number | null;
  market?: string | null;
  currentLine?: number | null;
  season?: string;
  className?: string;
  // Optional pre-fetched data to avoid duplicate API calls
  prefetchedGames?: BoxScoreGame[];
  prefetchedSeasonSummary?: SeasonSummary | null;
}

type SortField = "date" | "pts" | "reb" | "ast" | "pra" | "fg3m" | "stl" | "blk" | "minutes" | "plusMinus";
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

  // Only fetch if we don't have prefetched data
  const { games: fetchedGames, seasonSummary: fetchedSeasonSummary, isLoading, error } = usePlayerBoxScores({
    playerId,
    season,
    limit: 50,
    enabled: !!playerId && !prefetchedGames,
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
  }, [games]);

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
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading box scores...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <p className="text-sm text-red-500">Failed to load box scores</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No box score data available</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden shadow-sm", className)}>
      {/* Header - Matches other components */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50 to-transparent dark:from-neutral-800/50 dark:to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1 rounded-full bg-gradient-to-b from-blue-500 to-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                Game Log
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                {games.length} games this season
                {seasonSummary && <span className="ml-2">· {seasonSummary.record}</span>}
              </p>
            </div>
          </div>
          
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-700">
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

