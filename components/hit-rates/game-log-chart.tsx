"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { TrendingUp, TrendingDown, Home, Plane } from "lucide-react";

interface TeammateOut {
  player_id: number;
  name: string;
  avg: number | null;
}

interface GameLog {
  game_id?: string;
  date: string;
  opponent_team_id?: number;
  home_away?: "H" | "A";
  market_stat: number;
  min?: string | number;
  minutes?: string | number;
  supporting_stats?: {
    minutes?: string;
    fgm?: number;
    fga?: number;
    fg3m?: number;
    fg3a?: number;
    ftm?: number;
    fta?: number;
    usage?: number;
  };
  teammates_out?: TeammateOut[];
  win_loss?: "W" | "L";
  margin?: string;
}

interface GameLogChartProps {
  gameLogs: GameLog[] | null;
  line: number | null;
  seasonAvg: number | null;
  market: string;
  teamPrimaryColor?: string | null;
  className?: string;
}

// Get short market label for tooltip
const getShortMarketLabel = (market: string): string => {
  const labels: Record<string, string> = {
    player_points: "pts",
    player_rebounds: "reb",
    player_assists: "ast",
    player_threes_made: "3pm",
    player_blocks: "blk",
    player_steals: "stl",
    player_turnovers: "tov",
    player_points_rebounds_assists: "pra",
    player_points_rebounds: "pr",
    player_points_assists: "pa",
    player_rebounds_assists: "ra",
    player_blocks_steals: "bs",
  };
  return labels[market] || "stat";
};

// Team ID to abbreviation mapping (common teams)
const TEAM_ID_TO_ABBR: Record<number, string> = {
  1610612737: "ATL", 1610612738: "BOS", 1610612739: "CLE", 1610612740: "NOP",
  1610612741: "CHI", 1610612742: "DAL", 1610612743: "DEN", 1610612744: "GSW",
  1610612745: "HOU", 1610612746: "LAC", 1610612747: "LAL", 1610612748: "MIA",
  1610612749: "MIL", 1610612750: "MIN", 1610612751: "BKN", 1610612752: "NYK",
  1610612753: "ORL", 1610612754: "IND", 1610612755: "PHI", 1610612756: "PHX",
  1610612757: "POR", 1610612758: "SAC", 1610612759: "SAS", 1610612760: "OKC",
  1610612761: "TOR", 1610612762: "UTA", 1610612763: "MEM", 1610612764: "WAS",
  1610612765: "DET", 1610612766: "CHA",
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
};

export function GameLogChart({
  gameLogs,
  line,
  seasonAvg,
  market,
  teamPrimaryColor,
  className,
}: GameLogChartProps) {
  const marketLabel = getShortMarketLabel(market);
  // Process and reverse game logs (most recent on right)
  const games = useMemo(() => {
    if (!gameLogs || gameLogs.length === 0) return [];
    return [...gameLogs].reverse(); // Oldest first, most recent on right
  }, [gameLogs]);

  // Calculate chart dimensions
  const maxStat = useMemo(() => {
    if (games.length === 0) return 40;
    const max = Math.max(...games.map(g => g.market_stat));
    // Round up to nearest 5 or 10 for nice scale
    return Math.ceil(max / 5) * 5 + 5;
  }, [games]);

  const chartHeight = 200;
  // Adjust bar width based on number of games
  const barWidth = games.length <= 5 ? 48 : games.length <= 10 ? 36 : games.length <= 20 ? 24 : 16;
  const barGap = games.length <= 10 ? 3 : 2;

  if (!gameLogs || gameLogs.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 text-neutral-400", className)}>
        No game log data available
      </div>
    );
  }

  // Calculate line position as percentage
  const linePosition = line !== null ? (line / maxStat) * 100 : null;

  return (
    <div className={cn("relative", className)}>
      {/* Y-Axis Labels */}
      <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-[10px] text-neutral-400 font-medium">
        <span>{maxStat}</span>
        <span>{Math.round(maxStat / 2)}</span>
        <span>0</span>
      </div>

      {/* Chart Area */}
      <div className="ml-10 relative" style={{ height: chartHeight }}>
        {/* Bottom Line Only */}
        <div className="absolute bottom-0 left-0 right-0 border-b border-neutral-200 dark:border-neutral-700" />

        {/* Line Threshold */}
        {linePosition !== null && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-primary dark:border-primary-weak z-10"
            style={{ bottom: `${linePosition}%` }}
          >
            <span className="absolute -left-1 -translate-y-1/2 bg-primary dark:bg-primary-weak text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded">
              {line}
            </span>
          </div>
        )}

        {/* Bars */}
        <div className="absolute inset-0 flex items-end justify-center gap-3">
          {games.map((game, idx) => {
            const barHeightPx = (game.market_stat / maxStat) * chartHeight;
            const isHit = line !== null && game.market_stat > line;
            const opponentAbbr = game.opponent_team_id 
              ? TEAM_ID_TO_ABBR[game.opponent_team_id] 
              : null;
            const opponentLogo = opponentAbbr ? getTeamLogoUrl(opponentAbbr, "nba") : null;

            // Get supporting stats if available
            const stats = game.supporting_stats;
            // Check multiple possible field names for minutes
            const minutes = stats?.minutes || game.min || game.minutes;
            
            // Tooltip content - Premium design
            const tooltipContent = (
              <div className="min-w-[200px] bg-neutral-900 dark:bg-neutral-950 rounded-xl p-4 shadow-2xl border border-neutral-800">
                {/* Header: Date + Result */}
                <div className="flex items-center justify-between gap-4 mb-3">
                  <span className="text-sm font-semibold text-white">
                    {formatDate(game.date)} {game.home_away === "H" ? "vs" : "@"} {opponentAbbr || "OPP"}
                  </span>
                  {game.win_loss && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-full",
                      game.win_loss === "W" 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-red-500/20 text-red-400"
                    )}>
                      {game.win_loss === "W" ? `W${game.margin ? ` ${game.margin}` : ""}` : `L${game.margin ? ` ${game.margin}` : ""}`}
                    </span>
                  )}
                </div>

                {/* Main Stat - Hero */}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-black text-white tracking-tight">{game.market_stat}</span>
                  <span className="text-sm font-medium text-neutral-400">pts</span>
                </div>

                {/* Stats Grid */}
                <div className="space-y-2">
                  {/* Minutes */}
                  {minutes && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Minutes</span>
                      <span className="text-xs font-semibold text-neutral-300">{minutes}</span>
                    </div>
                  )}

                  {/* Shooting Stats (if available) */}
                  {stats && (
                    <>
                      {stats.fgm !== undefined && stats.fga !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">FG</span>
                          <span className="text-xs font-semibold text-neutral-300">
                            {stats.fgm}/{stats.fga} <span className="text-neutral-500">({stats.fga > 0 ? Math.round((stats.fgm / stats.fga) * 100) : 0}%)</span>
                          </span>
                        </div>
                      )}
                      {stats.fg3m !== undefined && stats.fg3a !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">3PT</span>
                          <span className="text-xs font-semibold text-neutral-300">
                            {stats.fg3m}/{stats.fg3a} <span className="text-neutral-500">({stats.fg3a > 0 ? Math.round((stats.fg3m / stats.fg3a) * 100) : 0}%)</span>
                          </span>
                        </div>
                      )}
                      {stats.ftm !== undefined && stats.fta !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">FT</span>
                          <span className="text-xs font-semibold text-neutral-300">
                            {stats.ftm}/{stats.fta} <span className="text-neutral-500">({stats.fta > 0 ? Math.round((stats.ftm / stats.fta) * 100) : 0}%)</span>
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Teammates Out */}
                {game.teammates_out && game.teammates_out.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-800">
                    <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                      Did Not Play
                    </div>
                    <div className="space-y-1.5">
                      {[...game.teammates_out]
                        .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
                        .slice(0, 3)
                        .map((teammate) => (
                        <div key={teammate.player_id} className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400 truncate max-w-[120px]">
                            {teammate.name}
                          </span>
                          <span className="text-xs font-semibold text-neutral-300">
                            {teammate.avg !== null ? `(${teammate.avg.toFixed(1)})` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Line comparison - Footer */}
                {line !== null && (
                  <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">Line</span>
                      <span className="text-sm font-bold text-white">{line}</span>
                    </div>
                    <span className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full",
                      isHit 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-red-500/20 text-red-400"
                    )}>
                      {isHit ? "✓ OVER" : "✗ UNDER"}
                    </span>
                  </div>
                )}
              </div>
            );

            return (
              <Tooltip key={game.game_id || idx} content={tooltipContent} side="top">
                <div
                  className="relative flex flex-col items-end justify-end cursor-pointer group"
                  style={{ width: barWidth, height: chartHeight }}
                >
                  {/* Bar */}
                  <div
                    className={cn(
                      "w-full rounded-t-lg transition-all duration-200 group-hover:opacity-90 relative flex items-start justify-center",
                      isHit
                        ? "bg-gradient-to-t from-emerald-500 to-emerald-400 dark:from-emerald-600 dark:to-emerald-500"
                        : "bg-gradient-to-t from-red-500 to-red-400 dark:from-red-600 dark:to-red-500"
                    )}
                    style={{ 
                      height: game.market_stat === 0 ? 8 : Math.max(barHeightPx, 24),
                      boxShadow: isHit 
                        ? "0 -2px 8px rgba(16, 185, 129, 0.3)" 
                        : undefined
                    }}
                  >
                    {/* Stat value inside bar (or above for 0) */}
                    {game.market_stat > 0 && (
                      <span className="text-xs font-bold text-white mt-1 drop-shadow-sm">
                        {game.market_stat}
                      </span>
                    )}
                  </div>
                  
                  {/* Value above bar for 0 */}
                  {game.market_stat === 0 && (
                    <span className="absolute text-xs font-bold text-neutral-500 -translate-x-1/2 left-1/2" style={{ bottom: 12 }}>
                      0
                    </span>
                  )}

                  {/* Home/Away indicator */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
                    {opponentLogo ? (
                      <img
                        src={opponentLogo}
                        alt={opponentAbbr || ""}
                        className="w-4 h-4 object-contain opacity-60 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <span className="text-[10px] text-neutral-400">
                        {game.home_away === "H" ? "H" : "A"}
                      </span>
                    )}
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* X-Axis - Dates */}
      <div className="ml-10 mt-8 flex justify-center gap-3">
        {games.map((game, idx) => (
          <div
            key={game.game_id || idx}
            className="text-[9px] text-neutral-400 text-center font-medium"
            style={{ width: barWidth }}
          >
            {formatShortDate(game.date)}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="ml-10 mt-4 flex items-center justify-center gap-6 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gradient-to-t from-emerald-500 to-emerald-400" />
          <span className="text-neutral-500 dark:text-neutral-400">Over</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gradient-to-t from-red-500 to-red-400" />
          <span className="text-neutral-500 dark:text-neutral-400">Under</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 border-t-2 border-dashed border-primary dark:border-primary-weak" />
          <span className="text-neutral-500 dark:text-neutral-400">Line ({line})</span>
        </div>
      </div>
    </div>
  );
}

