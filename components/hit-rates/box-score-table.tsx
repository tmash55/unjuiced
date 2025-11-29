"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePlayerBoxScores, BoxScoreGame, SeasonSummary } from "@/hooks/use-player-box-scores";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { Table2, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

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

// Format date as "Nov 28"
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    <div className={cn("rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Game Log
            </h3>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              ({games.length} games)
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Season Summary Pills */}
            {seasonSummary && (
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                  {seasonSummary.record}
                </span>
                <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                  {seasonSummary.avgPoints} PPG
                </span>
              </div>
            )}
            
            {/* Toggle Advanced */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                "text-xs px-2 py-1 rounded transition-colors",
                showAdvanced 
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600"
              )}
            >
              {showAdvanced ? "Basic" : "Advanced"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-800">
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th 
                className="px-3 py-2 text-left font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center gap-1">
                  Date <SortIcon field="date" />
                </div>
              </th>
              <th className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400">
                OPP
              </th>
              <th className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400">
                W/L
              </th>
              <th 
                className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => handleSort("minutes")}
              >
                <div className="flex items-center justify-center gap-1">
                  MIN <SortIcon field="minutes" />
                </div>
              </th>
              <th 
                className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => handleSort("pts")}
              >
                <div className="flex items-center justify-center gap-1">
                  PTS <SortIcon field="pts" />
                </div>
              </th>
              <th 
                className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => handleSort("reb")}
              >
                <div className="flex items-center justify-center gap-1">
                  REB <SortIcon field="reb" />
                </div>
              </th>
              <th 
                className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => handleSort("ast")}
              >
                <div className="flex items-center justify-center gap-1">
                  AST <SortIcon field="ast" />
                </div>
              </th>
              <th 
                className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => handleSort("fg3m")}
              >
                <div className="flex items-center justify-center gap-1">
                  3PM <SortIcon field="fg3m" />
                </div>
              </th>
              <th 
                className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => handleSort("stl")}
              >
                <div className="flex items-center justify-center gap-1">
                  STL <SortIcon field="stl" />
                </div>
              </th>
              <th 
                className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => handleSort("blk")}
              >
                <div className="flex items-center justify-center gap-1">
                  BLK <SortIcon field="blk" />
                </div>
              </th>
              {showAdvanced && (
                <>
                  <th className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400">
                    FG
                  </th>
                  <th className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400">
                    3P
                  </th>
                  <th className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400">
                    FT
                  </th>
                  <th 
                    className="px-2 py-2 text-center font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200"
                    onClick={() => handleSort("plusMinus")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      +/- <SortIcon field="plusMinus" />
                    </div>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {sortedGames.map((game, idx) => {
              const marketStat = getMarketStat(game, market);
              const isOverLine = currentLine != null && marketStat > currentLine;
              
              return (
                <tr 
                  key={game.gameId}
                  className={cn(
                    "transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/30",
                    idx % 2 === 0 ? "bg-white dark:bg-neutral-800" : "bg-neutral-50/50 dark:bg-neutral-800/50"
                  )}
                >
                  {/* Date */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-medium text-neutral-700 dark:text-neutral-200">
                      {formatDate(game.date)}
                    </span>
                  </td>

                  {/* Opponent */}
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-neutral-400 text-[10px]">
                        {game.homeAway === "H" ? "vs" : "@"}
                      </span>
                      <img
                        src={getTeamLogoUrl(game.opponentAbbr, "nba")}
                        alt={game.opponentAbbr}
                        className="w-4 h-4 object-contain"
                      />
                    </div>
                  </td>

                  {/* Result */}
                  <td className="px-2 py-2 text-center">
                    <span className={cn(
                      "font-semibold",
                      game.result === "W" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                    )}>
                      {game.result}
                    </span>
                    <span className="text-neutral-400 ml-0.5 text-[10px]">
                      {game.margin > 0 ? `+${game.margin}` : game.margin}
                    </span>
                  </td>

                  {/* Minutes */}
                  <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                    {game.minutes?.toFixed(0) ?? "—"}
                  </td>

                  {/* Points */}
                  <td className={cn(
                    "px-2 py-2 text-center font-semibold",
                    market === "player_points" && isOverLine 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-neutral-900 dark:text-white"
                  )}>
                    {game.pts}
                  </td>

                  {/* Rebounds */}
                  <td className={cn(
                    "px-2 py-2 text-center font-semibold",
                    market === "player_rebounds" && isOverLine 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-neutral-900 dark:text-white"
                  )}>
                    {game.reb}
                  </td>

                  {/* Assists */}
                  <td className={cn(
                    "px-2 py-2 text-center font-semibold",
                    market === "player_assists" && isOverLine 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-neutral-900 dark:text-white"
                  )}>
                    {game.ast}
                  </td>

                  {/* 3PM */}
                  <td className={cn(
                    "px-2 py-2 text-center",
                    market === "player_threes_made" && isOverLine 
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold" 
                      : "text-neutral-600 dark:text-neutral-300"
                  )}>
                    {game.fg3m}
                  </td>

                  {/* Steals */}
                  <td className={cn(
                    "px-2 py-2 text-center",
                    market === "player_steals" && isOverLine 
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold" 
                      : "text-neutral-600 dark:text-neutral-300"
                  )}>
                    {game.stl}
                  </td>

                  {/* Blocks */}
                  <td className={cn(
                    "px-2 py-2 text-center",
                    market === "player_blocks" && isOverLine 
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold" 
                      : "text-neutral-600 dark:text-neutral-300"
                  )}>
                    {game.blk}
                  </td>

                  {showAdvanced && (
                    <>
                      {/* FG */}
                      <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                        {game.fgm}-{game.fga}
                      </td>

                      {/* 3P */}
                      <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                        {game.fg3m}-{game.fg3a}
                      </td>

                      {/* FT */}
                      <td className="px-2 py-2 text-center text-neutral-600 dark:text-neutral-300">
                        {game.ftm}-{game.fta}
                      </td>

                      {/* +/- */}
                      <td className={cn(
                        "px-2 py-2 text-center font-medium",
                        game.plusMinus > 0 
                          ? "text-emerald-600 dark:text-emerald-400" 
                          : game.plusMinus < 0 
                            ? "text-red-500 dark:text-red-400"
                            : "text-neutral-500"
                      )}>
                        {game.plusMinus > 0 ? `+${game.plusMinus}` : game.plusMinus}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Season Summary Footer */}
      {seasonSummary && (
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">Season Averages:</span>
            <StatPill label="PTS" value={seasonSummary.avgPoints} />
            <StatPill label="REB" value={seasonSummary.avgRebounds} />
            <StatPill label="AST" value={seasonSummary.avgAssists} />
            <StatPill label="3PM" value={seasonSummary.avgThrees} />
            <StatPill label="MIN" value={seasonSummary.avgMinutes} />
            {showAdvanced && (
              <>
                <StatPill label="FG%" value={seasonSummary.fgPct} suffix="%" />
                <StatPill label="3P%" value={seasonSummary.fg3Pct} suffix="%" />
                <StatPill label="FT%" value={seasonSummary.ftPct} suffix="%" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-neutral-400 dark:text-neutral-500">{label}</span>
      <span className="font-semibold text-neutral-900 dark:text-white">
        {value?.toFixed(1) ?? "—"}{suffix}
      </span>
    </div>
  );
}

