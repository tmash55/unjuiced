"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  ArrowLeft, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown,
  Target,
  Calendar,
  Users,
  Activity,
  Minus,
  Plus,
  RotateCcw,
  ChevronRight,
  ExternalLink,
  Check,
  DollarSign,
  LineChart,
  ListOrdered,
  SlidersHorizontal,
  HeartPulse,
  AlertTriangle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import ChartIcon from "@/icons/chart";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { formatMarketLabel, formatMarketLabelShort } from "@/lib/data/markets";
import { usePlayerBoxScores } from "@/hooks/use-player-box-scores";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// Helper to get sportsbook logo
const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};
import { useHitRateOdds } from "@/hooks/use-hit-rate-odds";
import { usePositionVsTeam } from "@/hooks/use-position-vs-team";
import { useMatchupRanks } from "@/hooks/use-matchup-ranks";
import { useGameRosters, TeamRosterPlayer } from "@/hooks/use-team-roster";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

type GameCountFilter = 5 | 10 | 20 | "season" | "h2h";

// Injury status helpers
const getInjuryColor = (status: string | null): string => {
  if (!status ||status === "active" || status === "available") return "text-emerald-600 dark:text-emerald-400";
  if (status === "out") return "text-red-600 dark:text-red-400";
  if (status === "questionable" || status === "doubtful") return "text-amber-600 dark:text-amber-500";
  if (status === "probable") return "text-blue-600 dark:text-blue-400";
  return "text-neutral-500";
};

const getInjuryBgColor = (status: string | null): string => {
  if (!status || status === "active" || status === "available") return "";
  if (status === "out") return "bg-red-50/50 dark:bg-red-900/10";
  if (status === "questionable" || status === "doubtful") return "bg-amber-50/50 dark:bg-amber-900/10";
  if (status === "probable") return "bg-blue-50/50 dark:bg-blue-900/10";
  return "";
};

// Consistent market ordering for player drilldown
const MARKET_ORDER = [
  // Primary stats
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes_made",
  // Combo lines
  "player_points_rebounds_assists",
  "player_points_rebounds",
  "player_points_assists",
  "player_rebounds_assists",
  // Defense & other
  "player_steals",
  "player_blocks",
  "player_blocks_steals",
  "player_turnovers",
];

interface MobilePlayerDrilldownProps {
  profile: HitRateProfile;
  allPlayerProfiles?: HitRateProfile[];
  onBack: () => void;
  onMarketChange?: (market: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const formatOdds = (price: number): string => {
  return price > 0 ? `+${price}` : `${price}`;
};

const getPctColor = (value: number | null) => {
  if (value === null) return "text-neutral-500";
  if (value >= 70) return "text-emerald-500";
  if (value >= 50) return "text-amber-500";
  return "text-red-500";
};

const getPctBgColor = (value: number | null) => {
  if (value === null) return "bg-neutral-100 dark:bg-neutral-800";
  if (value >= 70) return "bg-emerald-50 dark:bg-emerald-900/20";
  if (value >= 50) return "bg-amber-50 dark:bg-amber-900/20";
  return "bg-red-50 dark:bg-red-900/20";
};

// Map market names to box score field names
const MARKET_TO_FIELD: Record<string, string> = {
  "player_points": "pts",
  "player_rebounds": "reb",
  "player_assists": "ast",
  "player_points_rebounds_assists": "pra",
  "player_points_rebounds": "pr",
  "player_points_assists": "pa",
  "player_rebounds_assists": "ra",
  "player_threes_made": "fg3m",
  "player_steals": "stl",
  "player_blocks": "blk",
  "player_turnovers": "tov",
  "player_blocks_steals": "blk_stl",
};

// Get the stat value for a market from a box score game
const getMarketStat = (game: any, market: string): number => {
  const field = MARKET_TO_FIELD[market];
  if (!field) return 0;
  
  // Handle combo stats
  if (field === "pra") return (game.pts ?? 0) + (game.reb ?? 0) + (game.ast ?? 0);
  if (field === "pr") return (game.pts ?? 0) + (game.reb ?? 0);
  if (field === "pa") return (game.pts ?? 0) + (game.ast ?? 0);
  if (field === "ra") return (game.reb ?? 0) + (game.ast ?? 0);
  if (field === "blk_stl") return (game.blk ?? 0) + (game.stl ?? 0);
  
  return game[field] ?? 0;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMBO STAT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Check if market is a combo market
const isComboMarket = (market: string): boolean => {
  return [
    "player_points_rebounds_assists",
    "player_points_rebounds",
    "player_points_assists",
    "player_rebounds_assists",
    "player_blocks_steals"
  ].includes(market);
};

// Get component stats for combo markets
interface ComboStatSegment {
  value: number;
  label: string;
}

const getComboSegments = (gameData: any, market: string): ComboStatSegment[] => {
  switch (market) {
    case "player_points_rebounds_assists":
      return [
        { value: gameData.pts || 0, label: "P" },
        { value: gameData.reb || 0, label: "R" },
        { value: gameData.ast || 0, label: "A" },
      ];
    case "player_points_rebounds":
      return [
        { value: gameData.pts || 0, label: "P" },
        { value: gameData.reb || 0, label: "R" },
      ];
    case "player_points_assists":
      return [
        { value: gameData.pts || 0, label: "P" },
        { value: gameData.ast || 0, label: "A" },
      ];
    case "player_rebounds_assists":
      return [
        { value: gameData.reb || 0, label: "R" },
        { value: gameData.ast || 0, label: "A" },
      ];
    case "player_blocks_steals":
      return [
        { value: gameData.blk || 0, label: "BLK" },
        { value: gameData.stl || 0, label: "STL" },
      ];
    default:
      return [];
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GAME LOG BAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface GameBarProps {
  stat: number;
  line: number;
  maxStat: number;
  date: string;
  opponent?: string;
  homeAway?: string;
  isHit: boolean;
  index: number;
  potentialReb?: number;
  market: string;
  gameData?: any; // Full game data for dialog
  teammatesOut?: Array<{ player_id: number; name: string; avg: number | null }>; // Teammates out
}

function GameBar({ stat, line, maxStat, date, opponent, homeAway, isHit, index, potentialReb, market, gameData, teammatesOut }: GameBarProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const heightPct = Math.max(2, (stat / maxStat) * 100);
  const isHome = homeAway === "H";
  
  // Check if we should show potential rebounds (only if > 0 and > actual stat)
  const showPotential = market === "player_rebounds" && 
    potentialReb !== null && 
    potentialReb !== undefined && 
    potentialReb > 0 && 
    potentialReb > stat;
  const potentialHeightPct = showPotential ? Math.max(2, ((potentialReb ?? 0) / maxStat) * 100) : 0;
  
  // Check if we should show 3PA for 3PM market (only if > 0 and > actual 3PM)
  const show3PA = market === "player_threes_made" && 
    gameData?.fg3a !== null && 
    gameData?.fg3a !== undefined && 
    gameData.fg3a > 0 && 
    gameData.fg3a > stat;
  const fg3aHeightPct = show3PA ? Math.max(2, ((gameData?.fg3a ?? 0) / maxStat) * 100) : 0;
  
  // Format date for display
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  
  return (
    <>
    <button
      type="button"
      className="relative flex-1 flex flex-col items-center group"
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onClick={() => {
        if (gameData) {
          setShowDialog(true);
        }
      }}
    >
      {/* Bar container with stat on top of bar */}
      <div className="relative w-full h-64 flex flex-col items-center justify-end">
        {/* Line marker */}
        <div 
          className="absolute left-0 right-0 border-t border-dashed border-neutral-400 dark:border-neutral-500 z-10"
          style={{ bottom: `${(line / maxStat) * 100}%` }}
        />
        
        {/* Potential Rebounds - Faded overlay (only for rebounds market) */}
        {showPotential && potentialReb > 0 && (
          <>
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-300 bg-neutral-400/30 dark:bg-neutral-500/30"
              style={{ 
                height: `${potentialHeightPct}%`,
              }}
            />
            {/* Potential Reb value - faded text above potential bar */}
            <div 
              className="absolute text-[8px] font-semibold text-neutral-400 dark:text-neutral-500 z-10"
              style={{ bottom: `${potentialHeightPct + 2}%` }}
            >
              {potentialReb}
            </div>
          </>
        )}
        
        {/* 3PA - Faded overlay (only for 3PM market) */}
        {show3PA && gameData?.fg3a > 0 && (
          <>
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-300 bg-neutral-400/30 dark:bg-neutral-500/30"
              style={{ 
                height: `${fg3aHeightPct}%`,
              }}
            />
            {/* 3PA value - faded text above 3PA bar */}
            <div 
              className="absolute text-[8px] font-semibold text-neutral-400 dark:text-neutral-500 z-10"
              style={{ bottom: `${fg3aHeightPct + 2}%` }}
            >
              {gameData.fg3a}
            </div>
          </>
        )}
        
        {/* Stat value positioned on top of bar */}
        <div 
          className={cn(
            "absolute text-[9px] font-bold transition-all duration-150 z-10",
            isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
            isPressed && "scale-110"
          )}
          style={{ bottom: `${heightPct + 2}%` }}
        >
          {stat}
        </div>
        
        {/* Bar - Stacked for combo markets, solid for single stat */}
        {isComboMarket(market) && gameData ? (
          // Stacked bar for combo markets - P at bottom, then R, then A on top
          <div
            className={cn(
              "w-full rounded-t-sm transition-all duration-300 ease-out relative z-[1] flex flex-col-reverse overflow-hidden",
              isHit 
                ? "bg-emerald-500 dark:bg-emerald-400" 
                : "bg-red-400 dark:bg-red-500",
              isPressed && "opacity-80"
            )}
            style={{ 
              height: `${heightPct}%`,
              animationDelay: `${index * 50}ms`
            }}
          >
            {getComboSegments(gameData, market).map((segment, idx) => {
              const segmentHeightPct = (segment.value / stat) * 100;
              const isLast = idx === getComboSegments(gameData, market).length - 1;
              return (
                <div
                  key={segment.label}
                  className="flex flex-col items-center justify-center relative"
                  style={{ 
                    height: `${segmentHeightPct}%`,
                    backgroundColor: isHit 
                      ? `rgba(16, 185, 129, ${0.7 + (idx * 0.15)})` // Lighter shades for visual separation
                      : `rgba(239, 68, 68, ${0.7 + (idx * 0.15)})`,
                    borderTop: !isLast ? '1px solid rgba(255,255,255,0.2)' : 'none'
                  }}
                >
                  {/* Value and abbreviation stacked */}
                  <span className="text-[8px] font-bold text-white drop-shadow-sm">
                    {segment.value}
                  </span>
                  <span className="text-[6px] font-semibold text-white/80 uppercase tracking-wide">
                    {segment.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          // Solid bar for single stat markets
          <div
            className={cn(
              "w-full rounded-t-sm transition-all duration-300 ease-out relative z-[1]",
              isHit 
                ? "bg-emerald-500 dark:bg-emerald-400" 
                : "bg-red-400 dark:bg-red-500",
              isPressed && "opacity-80"
            )}
            style={{ 
              height: `${heightPct}%`,
              animationDelay: `${index * 50}ms`
            }}
          />
        )}
      </div>
      
      {/* Opponent: vs/@ + logo stacked */}
      <div className="mt-1 flex flex-col items-center gap-0.5">
        {opponent && (
          <span className="text-[7px] font-medium text-neutral-400">
            {isHome ? "vs" : "@"}
          </span>
        )}
        {opponent ? (
          <img
            src={`/team-logos/nba/${opponent.toUpperCase()}.svg`}
            alt={opponent}
            className="h-3.5 w-3.5 object-contain opacity-70"
          />
        ) : (
          <span className="text-[8px] text-neutral-400">
            {date ? date.slice(5) : "—"}
          </span>
        )}
      </div>
      
      {/* Tooltip on press */}
      {isPressed && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 px-2 py-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] font-bold rounded shadow-lg whitespace-nowrap">
          {stat} {isHit ? "✓" : "✗"}
        </div>
      )}
    </button>

    {/* Game Stats Dialog */}
    {showDialog && gameData && (
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end"
        onClick={() => setShowDialog(false)}
      >
        <div
          className="w-full bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl border-t border-neutral-200 dark:border-neutral-700 animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              {opponent && (
                <img
                  src={`/team-logos/nba/${opponent.toUpperCase()}.svg`}
                  alt={opponent}
                  className="h-5 w-5 object-contain"
                />
              )}
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {formatDate(date)} {isHome ? "vs" : "@"} {opponent}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowDialog(false)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-4 w-4 text-neutral-500" />
            </button>
          </div>

          {/* Stats */}
          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {/* Main Stat */}
            <div className="flex items-baseline gap-2 pb-3 border-b border-neutral-200 dark:border-neutral-700">
              <span className={cn(
                "text-3xl font-black tracking-tight",
                isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
              )}>
                {stat}
              </span>
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                {market === "player_points" ? "pts" : market === "player_rebounds" ? "reb" : market === "player_assists" ? "ast" : market.replace("player_", "")}
              </span>
              <div className="flex-1" />
              <div className={cn(
                "px-2 py-1 rounded text-xs font-bold",
                gameData.result === "W" 
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                  : "bg-red-500/20 text-red-500 dark:text-red-400"
              )}>
                {gameData.result} {gameData.result === "W" ? "+" : ""}{Math.abs(gameData.margin || 0)}
              </div>
            </div>

            {/* Common Stats */}
            <div className="space-y-2">
              <StatRow label="Minutes" value={Math.round(gameData.minutes)} />
              <StatRow label="Fouls" value={gameData.fouls} />
            </div>

            {/* Market-specific stats */}
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 space-y-2">
              {market === "player_rebounds" && (
                <>
                  <StatRow label="OREB" value={gameData.oreb} />
                  <StatRow label="DREB" value={gameData.dreb} />
                  <StatRow label="Total REB" value={gameData.reb} />
                  <StatRow label="Chances" value={gameData.potentialReb} />
                </>
              )}
              {market === "player_points" && (
                <>
                  <StatRow label="FG" value={`${gameData.fgm}/${gameData.fga}`} subValue={`${Math.round(gameData.fgPct * 100)}%`} />
                  <StatRow label="3PT" value={`${gameData.fg3m}/${gameData.fg3a}`} subValue={`${Math.round(gameData.fg3Pct * 100)}%`} />
                  <StatRow label="FT" value={`${gameData.ftm}/${gameData.fta}`} subValue={`${Math.round(gameData.ftPct * 100)}%`} />
                </>
              )}
              {market === "player_assists" && (
                <>
                  <StatRow label="Assists" value={gameData.ast} />
                  <StatRow label="Passes" value={gameData.passes} />
                  <StatRow label="Turnovers" value={gameData.tov} />
                  <StatRow label="AST/TO" value={gameData.tov > 0 ? (gameData.ast / gameData.tov).toFixed(1) : "∞"} />
                  <StatRow label="Pace" value={Math.round(gameData.pace)} />
                </>
              )}
              {market === "player_threes_made" && (
                <>
                  <StatRow label="3PT" value={`${gameData.fg3m}/${gameData.fg3a}`} subValue={`${Math.round(gameData.fg3Pct * 100)}%`} />
                  <StatRow label="FG" value={`${gameData.fgm}/${gameData.fga}`} subValue={`${Math.round(gameData.fgPct * 100)}%`} />
                </>
              )}
              {(market === "player_steals" || market === "player_blocks" || market === "player_blocks_steals") && (
                <>
                  <StatRow label="Steals" value={gameData.stl} />
                  <StatRow label="Blocks" value={gameData.blk} />
                  {market === "player_blocks_steals" && <StatRow label="Blk+Stl" value={gameData.bs} />}
                  <StatRow label="DEF Rating" value={Math.round(gameData.defRating)} />
                </>
              )}
              {market === "player_points_assists" && (
                <>
                  <StatRow label="Points" value={gameData.pts} />
                  <StatRow label="Assists" value={gameData.ast} />
                  <StatRow label="P+A Total" value={gameData.pa} />
                </>
              )}
              {market === "player_points_rebounds" && (
                <>
                  <StatRow label="Points" value={gameData.pts} />
                  <StatRow label="Rebounds" value={gameData.reb} />
                  <StatRow label="P+R Total" value={gameData.pr} />
                </>
              )}
              {market === "player_rebounds_assists" && (
                <>
                  <StatRow label="Rebounds" value={gameData.reb} />
                  <StatRow label="Assists" value={gameData.ast} />
                  <StatRow label="R+A Total" value={gameData.ra} />
                </>
              )}
              {market === "player_points_rebounds_assists" && (
                <>
                  <StatRow label="Points" value={gameData.pts} />
                  <StatRow label="Rebounds" value={gameData.reb} />
                  <StatRow label="Assists" value={gameData.ast} />
                  <div className="my-2 border-t border-neutral-200 dark:border-neutral-700" />
                  <StatRow label="PRA Total" value={gameData.pra} />
                  <StatRow label="Usage" value={`${Math.round(gameData.usagePct)}%`} />
                </>
              )}
              {market === "player_turnovers" && (
                <>
                  <StatRow label="Turnovers" value={gameData.tov} />
                  <StatRow label="Assists" value={gameData.ast} />
                  <StatRow label="AST/TO" value={gameData.tov > 0 ? (gameData.ast / gameData.tov).toFixed(1) : "∞"} />
                  <StatRow label="Passes" value={gameData.passes} />
                  <StatRow label="Usage" value={`${Math.round(gameData.usagePct)}%`} />
                </>
              )}
            </div>

            {/* Teammates Out */}
            {teammatesOut && teammatesOut.length > 0 && (
              <div className="pt-3 mt-3 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Teammates Out
                  </span>
                  {teammatesOut.length > 3 && (
                    <span className="text-[9px] font-medium text-amber-500 dark:text-amber-400">
                      +{teammatesOut.length - 3} more
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {teammatesOut
                    .sort((a, b) => {
                      // Sort by avg (highest first), then by name
                      if (a.avg !== null && b.avg !== null) return b.avg - a.avg;
                      if (a.avg !== null) return -1;
                      if (b.avg !== null) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .slice(0, 3)
                    .map((teammate) => {
                      // Color code based on impact (avg value)
                      const getAvgColor = (avg: number | null) => {
                        if (avg === null) return "text-neutral-500 dark:text-neutral-400";
                        if (avg >= 15) return "text-amber-500 dark:text-amber-400"; // High impact
                        if (avg >= 8) return "text-orange-500 dark:text-orange-400"; // Medium
                        return "text-neutral-500 dark:text-neutral-400"; // Low
                      };

                      return (
                        <div
                          key={teammate.player_id}
                          className="flex items-center justify-between text-xs bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-2 py-1.5"
                        >
                          <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate flex-1">
                            {teammate.name}
                          </span>
                          <span className={cn("font-bold text-xs ml-2", getAvgColor(teammate.avg))}>
                            {teammate.avg !== null ? `${teammate.avg.toFixed(1)} avg` : "—"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowDialog(false)}
              className="w-full mt-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg font-medium text-sm active:scale-[0.98] transition-transform"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// StatRow component for dialog
function StatRow({ label, value, subValue }: { label: string; value: string | number; subValue?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
        {subValue && <span className="font-normal text-neutral-500 dark:text-neutral-400 ml-1.5">({subValue})</span>}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO BAR CHART COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface HeroBarChartProps {
  games: Array<{
    date: string;
    market_stat: number;
    opponent_abbr?: string;
    win_loss?: string;
    home_away?: string;
    potential_reb?: number;
    fg3a?: number; // Add 3PA for chart
    full_game_data?: any; // Full game data for dialog
    teammates_out?: Array<{ player_id: number; name: string; avg: number | null }>; // Teammates out for dialog
  }>;
  line: number;
  avg: number;
  gameCount: GameCountFilter;
  onGameCountChange: (count: GameCountFilter) => void;
  // Quick filters
  quickFilters: Set<string>;
  onQuickFilterToggle: (filter: string) => void;
  onQuickFiltersClear: () => void;
  totalGamesCount: number;
  market: string; // Add market to determine if rebounds
}

function HeroBarChart({ 
  games, 
  line, 
  avg, 
  gameCount, 
  onGameCountChange,
  quickFilters,
  onQuickFilterToggle,
  onQuickFiltersClear,
  totalGamesCount,
  market
}: HeroBarChartProps) {
  const displayGames = useMemo(() => {
    const count = gameCount === "season" || gameCount === "h2h" ? games.length : gameCount;
    return games.slice(0, count).reverse(); // Oldest on left, newest on right
  }, [games, gameCount]);
  
  const maxStat = useMemo(() => {
    // For rebounds market, include potential rebounds in max calculation
    // For 3PM market, include 3PA in max calculation
    let stats: number[];
    if (market === "player_rebounds") {
      stats = displayGames.map(g => Math.max(g.market_stat, g.potential_reb ?? 0));
    } else if (market === "player_threes_made") {
      stats = displayGames.map(g => Math.max(g.market_stat, g.fg3a ?? 0));
    } else {
      stats = displayGames.map(g => g.market_stat);
    }
    return Math.max(...stats, line * 1.3, 1); // At least 1 to avoid division issues
  }, [displayGames, line, market]);
  
  // Calculate nice Y-axis ticks
  const yAxisTicks = useMemo(() => {
    const max = Math.ceil(maxStat);
    const step = max <= 10 ? 2 : max <= 30 ? 5 : 10;
    const ticks = [];
    for (let i = 0; i <= max; i += step) {
      ticks.push(i);
    }
    if (ticks[ticks.length - 1] < max) {
      ticks.push(Math.ceil(max / step) * step);
    }
    return ticks;
  }, [maxStat]);
  
  const chartDomainMax = yAxisTicks[yAxisTicks.length - 1] || maxStat;
  
  const hitCount = displayGames.filter(g => g.market_stat >= line).length;
  const hitPct = displayGames.length > 0 ? Math.round((hitCount / displayGames.length) * 100) : 0;

  const quickFilterChips = [
    { id: "home", label: "Home" },
    { id: "away", label: "Away" },
    { id: "win", label: "W" },
    { id: "loss", label: "L" },
    { id: "high_mins", label: "30+" },
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
            Game Log
          </span>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>Avg: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{avg.toFixed(1)}</span></span>
            <span className="text-neutral-300 dark:text-neutral-600">|</span>
            <span>Line: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{line}</span></span>
          </div>
        </div>
        <div className={cn(
          "px-2 py-0.5 rounded-full text-xs font-bold",
          hitPct >= 70 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
          hitPct >= 50 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
          "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        )}>
          {hitPct}%
        </div>
      </div>
      
      {/* Bar Chart with Y-Axis */}
      <div className="px-2 pt-6 pb-2">
        {displayGames.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
            No games match filters
          </div>
        ) : (
          <div className="flex items-start">
            {/* Y-Axis - with bottom padding to align with bar area only */}
            <div className="flex flex-col justify-between h-64 pr-1.5">
              {[...yAxisTicks].reverse().map((tick) => (
                <span 
                  key={tick} 
                  className="text-[9px] text-neutral-400 text-right w-5 leading-none"
                >
                  {tick}
                </span>
              ))}
            </div>
            
            {/* Chart Area */}
            <div className="flex-1">
              {/* Bars */}
              <div className="flex items-end gap-1">
                {displayGames.map((game, idx) => (
                  <GameBar
                    key={`${game.date}-${idx}`}
                    stat={game.market_stat}
                    line={line}
                    maxStat={chartDomainMax}
                    date={game.date}
                    opponent={game.opponent_abbr}
                    homeAway={game.home_away}
                    isHit={game.market_stat >= line}
                    index={idx}
                    potentialReb={game.potential_reb}
                    market={market}
                    gameData={game.full_game_data}
                    teammatesOut={game.teammates_out}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Filters Row - Below Chart */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-100 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-800/20">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {quickFilterChips.map((chip) => {
            const isActive = quickFilters.has(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onQuickFilterToggle(chip.id)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all active:scale-95",
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                )}
              >
                {chip.label}
              </button>
            );
          })}
          {quickFilters.size > 0 && (
            <button
              type="button"
              onClick={onQuickFiltersClear}
              className="px-1.5 py-1 text-[9px] font-medium text-red-500 hover:text-red-600"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Filter status */}
        {quickFilters.size > 0 && (
          <span className="text-[9px] text-neutral-400 shrink-0 ml-2">
            {displayGames.length}/{totalGamesCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ODDS BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function OddsBadge({ 
  type, 
  price, 
  book,
  mobileUrl 
}: { 
  type: "over" | "under";
  price: number;
  book: string;
  mobileUrl?: string | null;
}) {
  const logo = getBookLogo(book);
  
  const handleClick = (e: React.MouseEvent) => {
    if (mobileUrl) {
      e.stopPropagation();
      window.open(mobileUrl, "_blank");
    }
  };
  
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!mobileUrl}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
        type === "over" 
          ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40" 
          : "bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40",
        mobileUrl && "active:scale-[0.98] cursor-pointer"
      )}
    >
      {logo && (
        <img src={logo} alt={book} className="h-4 w-4 rounded object-contain" />
      )}
      <span className={cn(
        "text-sm font-bold",
        type === "over" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
      )}>
        {type === "over" ? "O" : "U"} {formatOdds(price)}
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION HISTORY SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PositionHistorySectionProps {
  position: string;
  opponentTeamId: number;
  opponentTeamAbbr: string;
  selectedMarket: string;
  effectiveLine: number;
}

function PositionHistorySection({ 
  position, 
  opponentTeamId, 
  opponentTeamAbbr, 
  selectedMarket,
  effectiveLine 
}: PositionHistorySectionProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [gameLimit, setGameLimit] = useState<5 | 10 | 20 | 82>(10);
  const [minMinutes, setMinMinutes] = useState<number>(0);

  // Fetch recent games for this position vs opponent for the selected market
  const { players: allPlayers, isLoading, totalGames } = usePositionVsTeam({
    position,
    opponentTeamId,
    market: selectedMarket,
    limit: gameLimit,
    enabled: !!position && !!opponentTeamId && !!selectedMarket,
  });

  // Filter by minutes
  const players = useMemo(() => {
    if (minMinutes === 0) return allPlayers;
    return allPlayers.filter(p => p.minutes >= minMinutes);
  }, [allPlayers, minMinutes]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-4">
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 border-2 border-neutral-300 border-t-brand rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    return null; // Don't show section if no data
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            {position}s vs {opponentTeamAbbr} (Last {Math.min(totalGames, gameLimit)} games)
          </h3>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Recent performances by {position}s against {opponentTeamAbbr}
            {minMinutes > 0 && <span className="ml-1">• {minMinutes}+ min</span>}
          </p>
        </div>
        
        {/* Filter Button */}
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors active:scale-95"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Vertical box-score style list */}
      <div className="space-y-1">
        {players.map((player, idx) => {
          // Check if stat is over/under the current line
          const isOver = player.stat >= effectiveLine;
          
          return (
            <div
              key={`${player.playerName}-${idx}`}
              className="flex items-center gap-2 p-2.5 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60"
            >
              {/* Player Info */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="h-9 w-9 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700">
                    <PlayerHeadshot
                      nbaPlayerId={player.playerId}
                      name={player.playerName}
                      size="tiny"
                      className="h-full w-full object-cover scale-150 translate-y-1"
                    />
                  </div>
                  {/* Team logo badge */}
                  <img
                    src={`/team-logos/nba/${player.teamAbbr.toUpperCase()}.svg`}
                    alt={player.teamAbbr}
                    className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {player.playerName}
                  </div>
                  <div className="text-[9px] text-neutral-500 dark:text-neutral-400">
                    {player.teamAbbr} • {new Date(player.gameDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>

              {/* Stats - Simplified columns: Minutes, Line, Market Total */}
              <div className="flex items-center gap-4 shrink-0">
                {/* Minutes */}
                <div className="flex flex-col items-center w-10">
                  <span className="text-[9px] text-neutral-400 uppercase font-medium">Min</span>
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    {player.minutes}
                  </span>
                </div>

                {/* Line (hardcoded N/A for now) */}
                <div className="flex flex-col items-center w-10">
                  <span className="text-[9px] text-neutral-400 uppercase font-medium">Line</span>
                  <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    N/A
                  </span>
                </div>
                
                {/* Market Total - Color coded based on current line */}
                <div className="flex flex-col items-center w-12">
                  <span className="text-[9px] text-neutral-400 uppercase font-medium">
                    {formatMarketLabel(selectedMarket).split("+")[0].split(" ")[0]}
                  </span>
                  <span className={cn(
                    "text-lg font-bold",
                    isOver 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {player.stat}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-3 pt-3 border-t border-neutral-200/60 dark:border-neutral-700/60 grid grid-cols-2 gap-3">
        <div className="text-center">
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">Avg {formatMarketLabel(selectedMarket).split("+")[0]}</div>
          <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            {players.length > 0 ? (players.reduce((sum, p) => sum + p.stat, 0) / players.length).toFixed(1) : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">Avg Minutes</div>
          <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            {players.length > 0 ? (players.reduce((sum, p) => sum + p.minutes, 0) / players.length).toFixed(1) : "—"}'
          </div>
        </div>
      </div>

      {/* Filter Bottom Sheet */}
      {showFilters && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
          onClick={() => setShowFilters(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl border-t border-neutral-200 dark:border-neutral-700 overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            </div>
            
            {/* Header */}
            <div className="px-4 pb-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Filter Games
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Customize which games to show
              </p>
            </div>

            {/* Filters */}
            <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Game Count Filter */}
              <div>
                <label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 block">
                  Number of Games
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 5, label: "L5" },
                    { value: 10, label: "L10" },
                    { value: 20, label: "L20" },
                    { value: 82, label: "Season" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGameLimit(option.value as 5 | 10 | 20 | 82)}
                      className={cn(
                        "px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                        gameLimit === option.value
                          ? "bg-brand text-white shadow-sm"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes Filter */}
              <div>
                <label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 block">
                  Minimum Minutes Played
                </label>
                <div className="space-y-3">
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="5"
                    value={minMinutes}
                    onChange={(e) => setMinMinutes(Number(e.target.value))}
                    className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-brand"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">Any</span>
                    <span className="font-bold text-brand">{minMinutes}+ minutes</span>
                    <span className="text-neutral-500 dark:text-neutral-400">40+</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[0, 10, 20, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setMinMinutes(mins)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          minMinutes === mins
                            ? "bg-brand/20 text-brand border border-brand"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-transparent"
                        )}
                      >
                        {mins === 0 ? "Any" : `${mins}+`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setGameLimit(10);
                  setMinMinutes(0);
                }}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE INJURY ROSTER ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface MobileRosterPlayerRowProps {
  player: TeamRosterPlayer;
  isCurrentPlayer: boolean;
  onInjuryClick: () => void;
  withFilter: boolean;
  withoutFilter: boolean;
  onToggleWith: () => void;
  onToggleWithout: () => void;
}

function MobileRosterPlayerRow({ 
  player, 
  isCurrentPlayer, 
  onInjuryClick,
  withFilter,
  withoutFilter,
  onToggleWith,
  onToggleWithout
}: MobileRosterPlayerRowProps) {
  const hasInjury = player.injuryStatus && player.injuryStatus !== "active" && player.injuryStatus !== "available";
  const injuryColor = getInjuryColor(player.injuryStatus);
  const injuryBgColor = getInjuryBgColor(player.injuryStatus);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all",
        isCurrentPlayer && "opacity-60 pointer-events-none",
        injuryBgColor
      )}
    >
      {/* Player Headshot */}
      <div className="relative shrink-0">
        <div className="h-9 w-9 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600">
          <PlayerHeadshot
            nbaPlayerId={player.playerId}
            name={player.name}
            size="tiny"
            className="h-full w-full object-cover scale-150 translate-y-1"
          />
        </div>
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        {/* Name + Position on same line */}
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-xs font-semibold truncate",
            isCurrentPlayer ? "text-brand" : "text-neutral-900 dark:text-neutral-100"
          )}>
            {player.name}
          </span>
          <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-medium shrink-0">
            {player.position}
          </span>
          {isCurrentPlayer && (
            <span className="text-[8px] font-bold text-brand px-1 py-0.5 rounded bg-brand/10 shrink-0">
              YOU
            </span>
          )}
        </div>
        {/* Stats below */}
        <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">
          <span>{player.avgMinutes ? player.avgMinutes.toFixed(1) : "0.0"} min</span>
          <span className="text-neutral-300 dark:text-neutral-700">•</span>
          <span className="font-semibold">{player.avgPoints ? player.avgPoints.toFixed(1) : "0.0"} pts</span>
        </div>
      </div>

      {/* Injury Status Badge (compact) */}
      {hasInjury && (
        <button
          type="button"
          onClick={onInjuryClick}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 active:scale-95 transition-transform shrink-0"
        >
          <HeartPulse className={cn("h-2.5 w-2.5", injuryColor)} />
          <span className={cn("text-[8px] font-bold uppercase", injuryColor)}>
            {player.injuryStatus}
          </span>
        </button>
      )}

      {/* With/Without Toggles - moved to the right */}
      {!isCurrentPlayer && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleWith}
            className={cn(
              "w-8 h-6 flex items-center justify-center rounded text-[9px] font-bold transition-all active:scale-95",
              withFilter
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700"
            )}
          >
            W
          </button>
          <button
            type="button"
            onClick={onToggleWithout}
            className={cn(
              "w-8 h-6 flex items-center justify-center rounded text-[8px] font-bold transition-all active:scale-95",
              withoutFilter
                ? "bg-red-500 text-white shadow-sm"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700"
            )}
          >
            W/O
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFENSE VS POSITION TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface DefenseVsPositionTabProps {
  profile: HitRateProfile;
  effectiveLine: number;
  selectedMarket: string;
}

function DefenseVsPositionTab({ profile, effectiveLine, selectedMarket }: DefenseVsPositionTabProps) {
  // Get player's actual position from depth chart (PG, SG, SF, PF, C) or fallback to general position
  const playerPosition = useMemo(() => {
    // The profile might have depth_chart_pos or position
    // depth_chart_pos is more specific (PG, SG, SF, PF, C)
    // position is more general (G, F, C)
    const pos = profile.position;
    if (!pos) return "PG";
    
    // If it's already a specific position, use it
    if (["PG", "SG", "SF", "PF", "C"].includes(pos)) {
      return pos;
    }
    
    // Map general positions to specific ones
    if (pos === "G") return "PG";
    if (pos === "F") return "SF";
    if (pos === "C") return "C";
    
    return "PG"; // Default fallback
  }, [profile.position]);

  
  // Define all markets to show - grouped by category
  const marketStatsByCategory = useMemo(() => ({
    scoring: [
      { market: "player_points", label: "Points", abbr: "PTS" },
      { market: "player_threes_made", label: "Three Pointers", abbr: "3PM" },
    ],
    playmaking: [
      { market: "player_assists", label: "Assists", abbr: "AST" },
      { market: "player_points_rebounds_assists", label: "Points + Rebounds + Assists", abbr: "PRA" },
      { market: "player_points_assists", label: "Points + Assists", abbr: "PA" },
      { market: "player_points_rebounds", label: "Points + Rebounds", abbr: "PR" },
    ],
    rebounding: [
      { market: "player_rebounds", label: "Rebounds", abbr: "REB" },
      { market: "player_rebounds_assists", label: "Rebounds + Assists", abbr: "RA" },
    ],
    defensive: [
      { market: "player_steals", label: "Steals", abbr: "STL" },
      { market: "player_blocks", label: "Blocks", abbr: "BLK" },
      { market: "player_blocks_steals", label: "Blocks + Steals", abbr: "BS" },
    ],
  }), []);

  // Flatten for fetching all markets
  const allMarkets = useMemo(() => 
    Object.values(marketStatsByCategory).flat().map(m => m.market),
    [marketStatsByCategory]
  );

  // Fetch matchup ranks for all markets using player's actual position
  const { markets: matchupRanks, isLoading: ranksLoading, isFetching: ranksFetching } = useMatchupRanks({
    playerId: profile.playerId,
    opponentTeamId: profile.opponentTeamId!,
    position: playerPosition,
    markets: allMarkets,
    enabled: !!profile.playerId && !!profile.opponentTeamId && !!playerPosition,
  });
  
  // Get the current market's rank
  const currentMarketRank = useMemo(() => {
    return matchupRanks.find(m => m.market === selectedMarket);
  }, [matchupRanks, selectedMarket]);

  // Get rank color for DvP badge
  const getRankColor = (rank: number | null | undefined) => {
    if (!rank) return { bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-600 dark:text-neutral-400", dot: "bg-neutral-400" };
    if (rank <= 10) return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" };
    if (rank >= 21) return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" };
    return { bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-600 dark:text-neutral-400", dot: "bg-neutral-400" };
  };

  const rankColors = getRankColor(currentMarketRank?.rank);
  
  return (
    <div className="space-y-4 pb-6">
      {/* Premium Hero Header - Billion Dollar Design */}
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm dark:shadow-none">
        {/* Sophisticated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-white dark:from-neutral-900 dark:via-neutral-850 dark:to-neutral-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.06),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.12),transparent_60%)]" />
        
        {/* Subtle Top Highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neutral-200/50 dark:via-white/10 to-transparent" />
        
        {/* Content Container */}
        <div className="relative px-6 pt-6 pb-5">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-5">
            {/* Left: Logo + Title */}
            <div className="flex items-center gap-4 flex-1">
              {/* Premium Team Logo Container */}
              <div className="relative shrink-0">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-brand/8 dark:bg-brand/15 blur-xl rounded-full" />
                {/* Logo Box */}
                <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-white to-neutral-50 dark:from-white/8 dark:to-white/4 border border-neutral-200/80 dark:border-white/10 flex items-center justify-center shadow-md dark:shadow-lg dark:shadow-black/20">
                  <img
                    src={`/team-logos/nba/${profile.opponentTeamAbbr?.toUpperCase()}.svg`}
                    alt={profile.opponentTeamAbbr ?? ""}
                    className="h-10 w-10 object-contain drop-shadow-sm dark:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]"
                  />
                </div>
              </div>
              
              {/* Title Stack */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
                    Matchup Analysis
                  </span>
                  <div className="h-0.5 w-0.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                  <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                    2025-26
                  </span>
                </div>
                <h2 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight leading-tight">
                  Defense vs {playerPosition}
                </h2>
              </div>
            </div>
          </div>
          
          {/* Bottom Section: Team Name + DvP Rank */}
          <div className="flex items-center justify-between gap-3">
            {/* Team Indicator */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 flex items-center justify-center">
                <span className="text-xs font-black text-neutral-700 dark:text-neutral-300">
                  {profile.opponentTeamAbbr}
                </span>
              </div>
              <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
              <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                {profile.opponentTeamAbbr} Defense
              </span>
            </div>
            
            {/* DvP Rank Badge - Premium Pill */}
            {currentMarketRank && (
              <div className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-sm transition-all",
                rankColors.bg,
                "border-neutral-200 dark:border-neutral-700/50"
              )}>
                {/* Rank */}
                <div className="flex items-center gap-1.5">
                  <div className={cn("h-1.5 w-1.5 rounded-full shadow-sm", rankColors.dot)} />
                  <span className={cn("text-sm font-black tracking-tight", rankColors.text)}>
                    #{currentMarketRank.rank}
                  </span>
                </div>
                
                {/* Avg (if available) */}
                {currentMarketRank.avgAllowed && (
                  <>
                    <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600/50" />
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("text-sm font-bold", rankColors.text)}>
                        {currentMarketRank.avgAllowed.toFixed(1)}
                      </span>
                      <span className={cn("text-[10px] font-medium opacity-70", rankColors.text)}>
                        avg
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Position History vs Opponent */}
      <PositionHistorySection
        position={playerPosition}
        opponentTeamId={profile.opponentTeamId!}
        opponentTeamAbbr={profile.opponentTeamAbbr!}
        selectedMarket={selectedMarket}
        effectiveLine={effectiveLine}
      />
      
      {/* Market Stats Grid - Premium Cards */}
      <div className="space-y-4">
          {/* Scoring */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Scoring
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {marketStatsByCategory.scoring.map((stat) => {
                const matchupData = matchupRanks.find(m => m.market === stat.market);
                return (
                  <MarketStatCard
                    key={stat.market}
                    market={stat.market}
                    label={stat.label}
                    abbr={stat.abbr}
                    position={playerPosition}
                    opponentTeamId={profile.opponentTeamId!}
                    currentLine={stat.market === selectedMarket ? effectiveLine : null}
                    isActive={stat.market === selectedMarket}
                    matchupRank={matchupData?.rank ?? null}
                    avgAllowed={matchupData?.avgAllowed ?? null}
                    isLoadingRank={ranksFetching}
                  />
                );
              })}
            </div>
          </div>

          {/* Playmaking */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Playmaking
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {marketStatsByCategory.playmaking.map((stat) => {
                const matchupData = matchupRanks.find(m => m.market === stat.market);
                return (
                  <MarketStatCard
                    key={stat.market}
                    market={stat.market}
                    label={stat.label}
                    abbr={stat.abbr}
                    position={playerPosition}
                    opponentTeamId={profile.opponentTeamId!}
                    currentLine={stat.market === selectedMarket ? effectiveLine : null}
                    isActive={stat.market === selectedMarket}
                    matchupRank={matchupData?.rank ?? null}
                    avgAllowed={matchupData?.avgAllowed ?? null}
                    isLoadingRank={ranksFetching}
                  />
                );
              })}
            </div>
          </div>

          {/* Rebounding */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Rebounding
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {marketStatsByCategory.rebounding.map((stat) => {
                const matchupData = matchupRanks.find(m => m.market === stat.market);
                return (
                  <MarketStatCard
                    key={stat.market}
                    market={stat.market}
                    label={stat.label}
                    abbr={stat.abbr}
                    position={playerPosition}
                    opponentTeamId={profile.opponentTeamId!}
                    currentLine={stat.market === selectedMarket ? effectiveLine : null}
                    isActive={stat.market === selectedMarket}
                    matchupRank={matchupData?.rank ?? null}
                    avgAllowed={matchupData?.avgAllowed ?? null}
                    isLoadingRank={ranksFetching}
                  />
                );
              })}
            </div>
          </div>

          {/* Defensive */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Defensive
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {marketStatsByCategory.defensive.map((stat) => {
                const matchupData = matchupRanks.find(m => m.market === stat.market);
                return (
                  <MarketStatCard
                    key={stat.market}
                    market={stat.market}
                    label={stat.label}
                    abbr={stat.abbr}
                    position={playerPosition}
                    opponentTeamId={profile.opponentTeamId!}
                    currentLine={stat.market === selectedMarket ? effectiveLine : null}
                    isActive={stat.market === selectedMarket}
                    matchupRank={matchupData?.rank ?? null}
                    avgAllowed={matchupData?.avgAllowed ?? null}
                    isLoadingRank={ranksFetching}
                  />
                );
              })}
            </div>
          </div>
        </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface MarketStatCardProps {
  market: string;
  label: string;
  abbr: string;
  position: string;
  opponentTeamId: number;
  currentLine: number | null;
  isActive: boolean;
  matchupRank: number | null;
  avgAllowed: number | null;
  isLoadingRank: boolean;
}

function MarketStatCard({ 
  market, 
  label, 
  abbr, 
  position, 
  opponentTeamId, 
  currentLine, 
  isActive, 
  matchupRank,
  avgAllowed,
  isLoadingRank 
}: MarketStatCardProps) {
  const { avgStat, totalGames, isLoading } = usePositionVsTeam({
    position,
    opponentTeamId,
    market,
    limit: 50,
    enabled: !!position && !!opponentTeamId && !!market,
  });

  // Use the actual rank from API
  const rank = matchupRank;
  
  // Use avgAllowed from matchup data if available, otherwise fall back to avgStat
  const displayAvg = avgAllowed ?? avgStat;

  // Determine if above or below line
  const vsLine = useMemo(() => {
    if (!currentLine || !displayAvg) return null;
    return displayAvg >= currentLine ? "above" : "below";
  }, [displayAvg, currentLine]);

  // Get rank color
  const getRankColor = (rank: number | null) => {
    if (!rank) return "text-neutral-500";
    if (rank <= 7) return "text-emerald-600 dark:text-emerald-400"; // Good matchup (weak defense)
    if (rank >= 24) return "text-red-600 dark:text-red-400"; // Bad matchup (strong defense)
    return "text-neutral-600 dark:text-neutral-400"; // Neutral
  };

  const getRankBg = (rank: number | null) => {
    if (!rank) return "bg-neutral-100 dark:bg-neutral-800";
    if (rank <= 7) return "bg-emerald-100 dark:bg-emerald-900/30";
    if (rank >= 24) return "bg-red-100 dark:bg-red-900/30";
    return "bg-neutral-100 dark:bg-neutral-800";
  };

  if (isLoading || isLoadingRank) {
    return (
      <div className={cn(
        "rounded-2xl border p-4 flex flex-col items-center justify-center min-h-[110px]",
        isActive 
          ? "border-brand bg-gradient-to-br from-brand/5 to-brand/10" 
          : "border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-800/50 dark:to-neutral-800/30"
      )}>
        <div className="h-4 w-4 border-2 border-neutral-300 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 flex flex-col transition-all min-h-[110px] relative overflow-hidden",
        isActive 
          ? "border-brand bg-gradient-to-br from-brand/5 to-brand/10 shadow-md shadow-brand/10" 
          : "border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-br from-white to-neutral-50/50 dark:from-neutral-800/50 dark:to-neutral-800/30 hover:shadow-sm"
      )}
    >
      {/* Active indicator stripe */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand/50 via-brand to-brand/50" />
      )}
      
      {/* Stat Value - Hero */}
      <div className="text-center mb-2">
        <div className="text-3xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight leading-none">
          {displayAvg ? displayAvg.toFixed(1) : "—"}
        </div>
      </div>
      
      {/* Market Label */}
      <div className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider text-center mb-2">
        {abbr}
      </div>
      
      {/* Rank with Meter */}
      <div className="flex items-center justify-center gap-1.5">
        {/* Rank Meter Dot */}
        {rank && rank <= 10 && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />}
        {rank && rank > 10 && rank <= 20 && <div className="h-1.5 w-1.5 rounded-full bg-neutral-400" />}
        {rank && rank > 20 && <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />}
        
        {/* Rank Text */}
        <div className={cn(
          "text-xs font-bold",
          getRankColor(rank)
        )}>
          {rank ? `#${rank}` : "—"}
        </div>
      </div>
      
      {/* Above/Below Line Indicator */}
      {vsLine && isActive && (
        <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-neutral-200/50 dark:border-neutral-700/50">
          {vsLine === "above" ? (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                Above {currentLine}
              </span>
            </>
          ) : (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                Below {currentLine}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function MobilePlayerDrilldown({ 
  profile: initialProfile, 
  allPlayerProfiles = [], 
  onBack, 
  onMarketChange 
}: MobilePlayerDrilldownProps) {
  const [selectedMarket, setSelectedMarket] = useState(initialProfile.market);
  const [gameCount, setGameCount] = useState<GameCountFilter>(10);
  const [showMarketPicker, setShowMarketPicker] = useState(false);
  const [showAllOdds, setShowAllOdds] = useState(false);
  const [showAllLines, setShowAllLines] = useState(false);
  const [expandedLineBooks, setExpandedLineBooks] = useState<Set<number>>(new Set());
  const [customLine, setCustomLine] = useState<number | null>(null);
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [lineInputValue, setLineInputValue] = useState("");
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"chart" | "matchup" | "injuries" | "stats" | "odds">("chart");
  const [selectedInjuryPlayer, setSelectedInjuryPlayer] = useState<TeamRosterPlayer | null>(null);
  
  // Injury filter state - track with/without for each player
  type InjuryFilterMode = "with" | "without" | null;
  interface InjuryFilter {
    playerId: number;
    mode: InjuryFilterMode;
  }
  const [injuryFilters, setInjuryFilters] = useState<InjuryFilter[]>([]);
  
  // Team collapse state
  const [playerTeamCollapsed, setPlayerTeamCollapsed] = useState(false);
  const [opponentTeamCollapsed, setOpponentTeamCollapsed] = useState(false);
  
  // Handler for toggling injury filters
  const handleInjuryFilterToggle = useCallback((playerId: number, mode: InjuryFilterMode) => {
    setInjuryFilters(prev => {
      const existing = prev.find(f => f.playerId === playerId);
      
      if (mode === null) {
        // Remove filter
        return prev.filter(f => f.playerId !== playerId);
      }
      
      if (existing) {
        // Update existing filter
        return prev.map(f => f.playerId === playerId ? { playerId, mode } : f);
      }
      
      // Add new filter
      return [...prev, { playerId, mode }];
    });
  }, []);
  
  // Get current profile based on selected market
  const profile = useMemo(() => {
    const found = allPlayerProfiles.find(p => p.market === selectedMarket);
    return found || initialProfile;
  }, [allPlayerProfiles, selectedMarket, initialProfile]);
  
  // Sort available markets
  const sortedMarkets = useMemo(() => {
    if (allPlayerProfiles.length === 0) return [initialProfile];
    const marketMap = new Map<string, HitRateProfile>();
    for (const p of allPlayerProfiles) {
      const existing = marketMap.get(p.market);
      if (!existing || (p.line !== null && existing.line === null)) {
        marketMap.set(p.market, p);
      }
    }
    return [...marketMap.values()].sort((a, b) => {
      const aIdx = MARKET_ORDER.indexOf(a.market);
      const bIdx = MARKET_ORDER.indexOf(b.market);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
  }, [allPlayerProfiles, initialProfile]);
  
  // Fetch box scores
  const { games: boxScoreGames, isLoading } = usePlayerBoxScores({
    playerId: profile.playerId,
    limit: 50,
  });
  
  // Build a map of gameId -> teammates out (player IDs who were out for that game)
  const teammatesOutByGame = useMemo(() => {
    const map = new Map<string, Set<number>>();
    const gameLogs = profile.gameLogs as Array<{ game_id?: string; teammates_out?: Array<{ player_id: number }> }> | null;
    
    if (!gameLogs) return map;
    
    for (const gameLog of gameLogs) {
      if (!gameLog.game_id) continue;
      const gameId = String(gameLog.game_id).replace(/^0+/, "");
      const outSet = new Set<number>();
      
      if (gameLog.teammates_out) {
        for (const out of gameLog.teammates_out) {
          if (out.player_id) {
            outSet.add(out.player_id);
          }
        }
      }
      
      map.set(gameId, outSet);
    }
    
    return map;
  }, [profile.gameLogs]);
  
  // Fetch team rosters for injury report (and for filter labels)
  const { playerTeam, opponentTeam, isLoading: rostersLoading } = useGameRosters({
    playerTeamId: profile.teamId,
    opponentTeamId: profile.opponentTeamId,
    season: "2025-26",
    // Always load if we have injury filters OR if on the injuries tab
    enabled: (injuryFilters.length > 0 || activeTab === "injuries") && !!profile.teamId && !!profile.opponentTeamId,
  });
  
  // Fetch odds
  const { getOdds } = useHitRateOdds({
    rows: [{ oddsSelectionId: profile.oddsSelectionId, line: profile.line }],
    enabled: !!profile.oddsSelectionId,
  });
  
  const fullOddsData = getOdds(profile.oddsSelectionId);
  
  // Get odds for the current line (custom or original)
  // Note: We use profile.line here since baseLine depends on avg which isn't computed yet
  const odds = useMemo(() => {
    if (!fullOddsData) return null;
    
    // If using a custom line different from the profile line, try to find odds for that line
    if (customLine !== null && customLine !== profile.line) {
      // Look for the custom line in allLines
      let lineOdds = fullOddsData.allLines?.find(l => l.line === customLine);
      
      // If not found and it's a whole number, try the .5 below (e.g., 12 → 11.5)
      if (!lineOdds && Number.isInteger(customLine)) {
        const halfLineBelow = customLine - 0.5;
        lineOdds = fullOddsData.allLines?.find(l => l.line === halfLineBelow);
        if (lineOdds) {
          return {
            bestOver: lineOdds.bestOver,
            bestUnder: lineOdds.bestUnder,
            isAltLine: true,
            matchedLine: halfLineBelow, // Track which line we matched
          };
        }
      }
      
      // If still not found, try .5 above (e.g., 12 → 12.5)
      if (!lineOdds && Number.isInteger(customLine)) {
        const halfLineAbove = customLine + 0.5;
        lineOdds = fullOddsData.allLines?.find(l => l.line === halfLineAbove);
        if (lineOdds) {
          return {
            bestOver: lineOdds.bestOver,
            bestUnder: lineOdds.bestUnder,
            isAltLine: true,
            matchedLine: halfLineAbove,
          };
        }
      }
      
      if (lineOdds) {
        return {
          bestOver: lineOdds.bestOver,
          bestUnder: lineOdds.bestUnder,
          isAltLine: true,
        };
      }
      
      // No odds found for this custom line
      return {
        bestOver: null,
        bestUnder: null,
        isAltLine: true,
        noOddsForLine: true,
      };
    }
    
    // Use the primary line odds
    return {
      bestOver: fullOddsData.bestOver,
      bestUnder: fullOddsData.bestUnder,
      isAltLine: false,
    };
  }, [fullOddsData, customLine, profile.line]);
  
  // Process game logs for chart
  const chartGames = useMemo(() => {
    if (!boxScoreGames) return [];
    
    // Create a map of game_id to teammates_out from profile.gameLogs
    const gameLogs = profile.gameLogs as Array<{ 
      game_id?: string; 
      teammates_out?: Array<{ 
        player_id: number; 
        name: string; 
        avg: number | null;
      }> 
    }> | null;
    
    const teammatesOutMap = new Map<string, Array<{ player_id: number; name: string; avg: number | null }>>();
    if (gameLogs) {
      for (const log of gameLogs) {
        if (log.game_id && log.teammates_out) {
          // Normalize game ID by removing leading zeros
          const normalizedId = log.game_id.replace(/^0+/, "");
          teammatesOutMap.set(normalizedId, log.teammates_out);
        }
      }
    }
    
    return boxScoreGames.map(g => {
      // Normalize game ID for lookup
      const normalizedGameId = String(g.gameId || "").replace(/^0+/, "");
      const teammatesOut = teammatesOutMap.get(normalizedGameId) || [];
      
      return {
        date: g.date,
        market_stat: getMarketStat(g, profile.market),
        opponent_abbr: g.opponentAbbr,
        win_loss: g.result,
        home_away: g.homeAway,
        margin: g.margin,
        minutes: g.minutes,
        potential_reb: g.potentialReb ?? 0, // Add potential rebounds for chart
        fg3a: g.fg3a ?? 0, // Add 3PA for chart
        full_game_data: g, // Include full game data for dialog
        teammates_out: teammatesOut, // Add teammates out for dialog
      };
    });
  }, [boxScoreGames, profile.market, profile.gameLogs]);
  
  // Filter games based on quick filters AND injury filters
  const filteredChartGames = useMemo(() => {
    let games = chartGames;
    
    // Apply quick filters
    if (quickFilters.size > 0) {
      games = games.filter(game => {
        // Home/Away
        if (quickFilters.has("home") && game.home_away !== "H") return false;
        if (quickFilters.has("away") && game.home_away !== "A") return false;
        
        // Win/Loss
        if (quickFilters.has("win") && game.win_loss !== "W") return false;
        if (quickFilters.has("loss") && game.win_loss !== "L") return false;
        
        // Win by 10+ / Lost by 10+
        const margin = typeof game.margin === 'number' ? game.margin : parseInt(String(game.margin)) || 0;
        if (quickFilters.has("wonBy10") && (game.win_loss !== "W" || margin < 10)) return false;
        if (quickFilters.has("lostBy10") && (game.win_loss !== "L" || Math.abs(margin) < 10)) return false;
        
        // 30+ Minutes
        const mins = typeof game.minutes === 'number' ? game.minutes : parseFloat(String(game.minutes)) || 0;
        if (quickFilters.has("high_mins") && mins < 30) return false;
        
        return true;
      });
    }
    
    // Apply injury filters (with/without specific players)
    if (injuryFilters.length > 0 && boxScoreGames) {
      games = games.filter((game, idx) => {
        // Get the corresponding box score game to get the gameId
        const boxScoreGame = boxScoreGames[idx];
        if (!boxScoreGame || !boxScoreGame.gameId) return true;
        
        const gameIdStr = String(boxScoreGame.gameId);
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
    }
    
    // Filter by opponent if H2H is selected
    if (gameCount === "h2h" && profile.opponentTeamAbbr) {
      games = games.filter(game => game.opponent_abbr === profile.opponentTeamAbbr);
    }
    
    return games;
  }, [chartGames, quickFilters, injuryFilters, boxScoreGames, teammatesOutByGame, gameCount, profile.opponentTeamAbbr]);
  
  // Calculate average from filtered games
  const avg = useMemo(() => {
    const count = gameCount === "season" || gameCount === "h2h" ? filteredChartGames.length : gameCount;
    const games = filteredChartGames.slice(0, count);
    if (games.length === 0) return 0;
    return games.reduce((sum, g) => sum + g.market_stat, 0) / games.length;
  }, [filteredChartGames, gameCount]);
  
  // Use custom line if set, otherwise profile line, otherwise calculated avg
  const baseLine = profile.line ?? Math.round(avg);
  const effectiveLine = customLine ?? baseLine;
  
  // Calculate hit rate for current filters (shown in header when filters are active)
  const filteredHitRate = useMemo(() => {
    const count = gameCount === "season" || gameCount === "h2h" ? filteredChartGames.length : gameCount;
    const games = filteredChartGames.slice(0, count);
    if (games.length === 0) return { hits: 0, total: 0, pct: null };
    
    const hits = games.filter(g => g.market_stat >= effectiveLine).length;
    const pct = Math.round((hits / games.length) * 100);
    
    return { hits, total: games.length, pct };
  }, [filteredChartGames, gameCount, effectiveLine]);
  
  // Reset custom line when market changes
  useEffect(() => {
    setCustomLine(null);
  }, [selectedMarket]);
  
  // Team colors
  const primaryColor = profile.primaryColor || "#374151";
  const secondaryColor = profile.secondaryColor || primaryColor;

  const handleMarketChange = (market: string) => {
    setSelectedMarket(market);
    onMarketChange?.(market);
    setShowMarketPicker(false);
  };
  
  // Toggle quick filter with mutual exclusivity
  const toggleQuickFilter = useCallback((filter: string) => {
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
  }, []);
  
  // Calculate hit rates for current line
  const calculateHitRate = useCallback((games: typeof chartGames, line: number) => {
    if (games.length === 0) return null;
    const hits = games.filter(g => g.market_stat >= line).length;
    return Math.round((hits / games.length) * 100);
  }, []);
  
  const customHitRates = useMemo(() => {
    const line = effectiveLine;
    
    // Filter games for H2H (games against current opponent)
    const h2hGames = chartGames.filter(g => g.opponent_abbr === profile.opponentTeamAbbr);
    
    return {
      l5: calculateHitRate(filteredChartGames.slice(0, 5), line),
      l10: calculateHitRate(filteredChartGames.slice(0, 10), line),
      l20: calculateHitRate(filteredChartGames.slice(0, 20), line),
      season: calculateHitRate(filteredChartGames, line),
      h2h: calculateHitRate(h2hGames, line),
    };
  }, [filteredChartGames, chartGames, effectiveLine, calculateHitRate, profile.opponentTeamAbbr]);
  
  // Adjust line by step (0.5 for most markets)
  const adjustLine = (delta: number) => {
    const step = 0.5;
    const current = customLine ?? baseLine;
    const newLine = Math.max(0, current + (delta * step));
    setCustomLine(newLine);
  };
  
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-20">
      {/* ═══════════════════════════════════════════════════════════════════
          STICKY HEADER - Centered Player Info
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-14 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200/60 dark:border-neutral-800/60 shadow-sm">
        {/* ═══ ROW 1: Back Button + Centered Player Info ═══ */}
        <div className="relative flex items-center px-3 py-3">
          {/* Back Button - absolute positioned */}
          <button
            type="button"
            onClick={onBack}
            className="absolute left-3 p-1.5 -ml-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors active:scale-95 z-10"
          >
            <ArrowLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          
          {/* Centered Player Info */}
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-12">
            {/* Player Avatar */}
            <div 
              className="shrink-0 w-12 h-12 rounded-full p-[2px] shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
              }}
            >
              <div 
                className="w-full h-full rounded-full overflow-hidden relative"
                style={{ background: primaryColor }}
              >
                <div className="absolute inset-0 flex items-center justify-center scale-[1.4] translate-y-[10%]">
                  <PlayerHeadshot
                    nbaPlayerId={profile.playerId}
                    name={profile.playerName}
                    size="small"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
            
            {/* Player Name */}
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 text-center leading-tight">
              {profile.playerName}
            </h1>
            
            {/* Team & Matchup */}
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <img
                src={`/team-logos/nba/${profile.teamAbbr?.toUpperCase()}.svg`}
                alt={profile.teamAbbr ?? ""}
                className="h-3.5 w-3.5 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
              <span className="font-medium">{profile.position}</span>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <span>vs {profile.opponentTeamAbbr}</span>
            </div>
          </div>
        </div>
        
        {/* ═══ ROW 2: Hit Rate Badges - Compact Horizontal ═══ */}
        <div className="flex items-center justify-center gap-1 px-3 pb-2">
          {[
            { label: "L5", pct: customLine !== null ? customHitRates.l5 : profile.last5Pct, count: 5 as GameCountFilter },
            { label: "L10", pct: customLine !== null ? customHitRates.l10 : profile.last10Pct, count: 10 as GameCountFilter },
            { label: "L20", pct: customLine !== null ? customHitRates.l20 : profile.last20Pct, count: 20 as GameCountFilter },
            { label: "SZN", pct: customLine !== null ? customHitRates.season : profile.seasonPct, count: "season" as GameCountFilter },
            { label: "H2H", pct: customLine !== null ? customHitRates.h2h : profile.h2hPct, count: "h2h" as GameCountFilter },
          ].map((item, idx) => {
            const isSelected = gameCount === item.count;
            
            return (
              <React.Fragment key={item.label}>
                {idx > 0 && (
                  <span className="text-[10px] text-neutral-300 dark:text-neutral-600">|</span>
                )}
                <button
                  type="button"
                  onClick={() => setGameCount(item.count)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-md whitespace-nowrap transition-all active:scale-95",
                    isSelected
                      ? "bg-brand/15 border border-brand/30"
                      : "bg-transparent border border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-medium",
                    isSelected ? "text-brand" : "text-neutral-500"
                  )}>
                    {item.label}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold",
                    item.pct !== null && item.pct >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                    item.pct !== null && item.pct >= 50 ? "text-amber-600 dark:text-amber-400" :
                    item.pct !== null ? "text-red-500 dark:text-red-400" : "text-neutral-400"
                  )}>
                    {item.pct !== null ? `${Math.round(item.pct)}%` : "—"}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
        
        {/* ═══ ACTIVE FILTERS INDICATOR ═══ */}
        {(quickFilters.size > 0 || injuryFilters.length > 0) && (
          <div className="px-3 pb-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
            <div className="flex items-center justify-between gap-2">
              {/* Filter Labels */}
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold shrink-0">
                  Filters:
                </span>
                
                {/* Quick Filters */}
                {Array.from(quickFilters).map((filter) => {
                  const labels: Record<string, string> = {
                    home: "Home",
                    away: "Away",
                    win: "Wins",
                    loss: "Losses",
                    wonBy10: "Won 10+",
                    lostBy10: "Lost 10+",
                    high_mins: "30+ Min",
                  };
                  return (
                    <span key={filter} className="text-[9px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium">
                      {labels[filter] || filter}
                    </span>
                  );
                })}
                
                {/* Injury Filters */}
                {injuryFilters.map((filter) => {
                  const player = playerTeam?.players.find(p => p.playerId === filter.playerId) || 
                                opponentTeam?.players.find(p => p.playerId === filter.playerId);
                  if (!player) return null;
                  
                  const lastName = player.name.split(" ").pop() || player.name;
                  return (
                    <span 
                      key={filter.playerId}
                      className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded font-medium",
                        filter.mode === "with" 
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-500/15 text-red-600 dark:text-red-400"
                      )}
                    >
                      {filter.mode === "with" ? "W/" : "W/O"} {lastName}
                    </span>
                  );
                })}
              </div>
              
              {/* Filtered Hit Rate */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
                  {filteredHitRate.hits}/{filteredHitRate.total}
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  filteredHitRate.pct !== null && filteredHitRate.pct >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                  filteredHitRate.pct !== null && filteredHitRate.pct >= 50 ? "text-amber-600 dark:text-amber-400" :
                  "text-red-500 dark:text-red-400"
                )}>
                  {filteredHitRate.pct ?? "—"}%
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* ═══ Market Selector - Horizontal Scrollable Pills ═══ */}
        <div className="flex items-center gap-1.5 px-3 pb-2.5 overflow-x-auto scrollbar-hide border-t border-neutral-100 dark:border-neutral-800/50 pt-2">
          {sortedMarkets.map((prof) => {
            const isActive = prof.market === selectedMarket;
            const profLine = prof.line ?? 0;
            return (
              <button
                key={prof.market}
                type="button"
                onClick={() => handleMarketChange(prof.market)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 transition-all active:scale-95 border",
                  isActive
                    ? "bg-brand text-white border-brand shadow-sm"
                    : "bg-white dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                )}
              >
                <span className="text-xs font-semibold">
                  {formatMarketLabelShort(prof.market)}
                </span>
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive ? "opacity-80" : "opacity-60"
                )}>
                  {isActive && customLine !== null ? customLine : profLine}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Market Picker - Bottom Sheet Modal */}
      {showMarketPicker && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMarketPicker(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl border-t border-neutral-200 dark:border-neutral-700 overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            </div>
            
            {/* Line Adjuster Section */}
            <div className="px-4 pb-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatMarketLabel(profile.market)}
                  </h3>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Adjust line to see updated hit rates
                  </p>
                </div>
                {customLine !== null && (
                  <button
                    type="button"
                    onClick={() => setCustomLine(null)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-neutral-500 hover:text-brand transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
              
              {/* Line Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => adjustLine(-1)}
                  className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center active:scale-95 transition-transform border border-neutral-200 dark:border-neutral-700"
                >
                  <Minus className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                </button>
                
                <div className="flex flex-col items-center min-w-[100px]">
                  {isEditingLine ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={lineInputValue}
                        onChange={(e) => setLineInputValue(e.target.value)}
                        onBlur={() => {
                          const parsed = parseFloat(lineInputValue);
                          if (!isNaN(parsed) && parsed >= 0) {
                            setCustomLine(parsed);
                          }
                          setIsEditingLine(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const parsed = parseFloat(lineInputValue);
                            if (!isNaN(parsed) && parsed >= 0) {
                              setCustomLine(parsed);
                            }
                            setIsEditingLine(false);
                          } else if (e.key === "Escape") {
                            setIsEditingLine(false);
                          }
                        }}
                        autoFocus
                        className="w-16 text-center text-2xl font-bold bg-white dark:bg-neutral-800 border-2 border-brand rounded-lg py-1 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                      <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">+</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setLineInputValue(String(effectiveLine));
                        setIsEditingLine(true);
                      }}
                      className="px-3 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors active:scale-95"
                    >
                      <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {effectiveLine}+
                      </span>
                    </button>
                  )}
                  {customLine !== null && customLine !== baseLine && !isEditingLine && (
                    <span className="text-[10px] text-neutral-400">
                      Original: {baseLine}+
                    </span>
                  )}
                  {!isEditingLine && (
                    <span className="text-[9px] text-neutral-400 mt-0.5">
                      Tap to edit
                    </span>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => adjustLine(1)}
                  className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center active:scale-95 transition-transform border border-neutral-200 dark:border-neutral-700"
                >
                  <Plus className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                </button>
              </div>
              
              {/* Live Hit Rate Preview */}
              <div className="flex items-center justify-center gap-2 mt-3">
                {[
                  { label: "L5", pct: customHitRates.l5 },
                  { label: "L10", pct: customHitRates.l10 },
                  { label: "L20", pct: customHitRates.l20 },
                  { label: "SZN", pct: customHitRates.season },
                ].map((item, idx) => (
                  <React.Fragment key={item.label}>
                    {idx > 0 && <span className="text-[10px] text-neutral-300">|</span>}
                    <div className="flex items-center gap-1 px-1.5 py-0.5">
                      <span className="text-[10px] text-neutral-500">{item.label}</span>
                      <span className={cn(
                        "text-[10px] font-bold",
                        item.pct !== null && item.pct >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                        item.pct !== null && item.pct >= 50 ? "text-amber-600 dark:text-amber-400" :
                        "text-red-500 dark:text-red-400"
                      )}>
                        {item.pct ?? "—"}%
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                Change Market
              </h3>
            </div>
            
            {/* Market List */}
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
              {sortedMarkets.map((m) => (
                <button
                  key={m.market}
                  type="button"
                  onClick={() => handleMarketChange(m.market)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3",
                    "text-left transition-colors border-b border-neutral-100 dark:border-neutral-800/50",
                    m.market === selectedMarket
                      ? "bg-brand/10"
                      : "active:bg-neutral-50 dark:active:bg-neutral-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {m.market === selectedMarket && (
                      <div className="w-2 h-2 rounded-full bg-brand" />
                    )}
                    <span className={cn(
                      "text-sm font-medium",
                      m.market === selectedMarket 
                        ? "text-brand" 
                        : "text-neutral-700 dark:text-neutral-300"
                    )}>
                      {formatMarketLabel(m.market)}
                    </span>
                  </div>
                  {m.line !== null && (
                    <span className={cn(
                      "text-sm font-semibold",
                      m.market === selectedMarket 
                        ? "text-brand" 
                        : "text-neutral-500"
                    )}>
                      {m.line}+
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            {/* Safe area padding for iOS */}
            <div className="h-6" />
          </div>
        </div>
      )}
      
      {/* All Odds - Bottom Sheet Modal */}
      {showAllOdds && fullOddsData?.allLines && (() => {
        // Calculate hit rates for each line using chartGames
        const calcHitRates = (line: number) => {
          const l5 = chartGames.slice(0, 5);
          const l10 = chartGames.slice(0, 10);
          const l20 = chartGames.slice(0, 20);
          const szn = chartGames;
          
          const calc = (games: typeof chartGames) => {
            if (games.length === 0) return null;
            return Math.round((games.filter(g => g.market_stat >= line).length / games.length) * 100);
          };
          
          return {
            l5: calc(l5),
            l10: calc(l10),
            l20: calc(l20),
            szn: calc(szn),
          };
        };
        
        // Get hit rate color
        const getHitRateColor = (pct: number | null) => {
          if (pct === null) return "text-neutral-400";
          if (pct >= 70) return "text-emerald-600 dark:text-emerald-400";
          if (pct >= 50) return "text-amber-600 dark:text-amber-400";
          return "text-red-500 dark:text-red-400";
        };
        
        const sortedLines = [...fullOddsData.allLines].sort((a, b) => a.line - b.line);
        
        // Show only lines within range of selected, with expand option
        const linesToShow = showAllLines 
          ? sortedLines 
          : sortedLines.filter(l => Math.abs(l.line - effectiveLine) <= 2);
        
        return (
          <div 
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => { setShowAllOdds(false); setShowAllLines(false); setExpandedLineBooks(new Set()); }}
          >
            <div 
              className="absolute bottom-0 left-0 right-0 bg-neutral-50 dark:bg-neutral-950 rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              </div>
              
              {/* Header - Player Name + Market */}
              <div className="px-4 pt-1 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {profile.playerName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {formatMarketLabel(profile.market)}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-700">•</span>
                      <span className="text-[11px] text-neutral-400">
                        {fullOddsData.allLines.length} lines
                      </span>
                    </div>
                  </div>
                  {fullOddsData.live && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">LIVE</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Lines List */}
              <div className="max-h-[50vh] overflow-y-auto overscroll-contain">
                {linesToShow.map((lineData) => {
                  const isCurrentLine = lineData.line === effectiveLine;
                  const isPrimaryLine = lineData.line === profile.line;
                  const hitRates = calcHitRates(lineData.line);
                  
                  // Get books for over/under
                  const overBooks = lineData.books 
                    ? Object.entries(lineData.books).filter(([, o]) => o.over).sort((a, b) => (b[1].over?.price ?? -999) - (a[1].over?.price ?? -999))
                    : [];
                  const underBooks = lineData.books 
                    ? Object.entries(lineData.books).filter(([, o]) => o.under).sort((a, b) => (b[1].under?.price ?? -999) - (a[1].under?.price ?? -999))
                    : [];
                  
                  return (
                    <div 
                      key={lineData.line}
                      className={cn(
                        "mx-4 mb-2 rounded-xl overflow-hidden transition-all",
                        isCurrentLine 
                          ? "bg-brand/10 ring-2 ring-brand/40 dark:ring-brand/30" 
                          : "bg-white dark:bg-neutral-900 ring-1 ring-neutral-200/60 dark:ring-neutral-800"
                      )}
                    >
                      {/* Line Header Row */}
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2">
                          {/* Active indicator bar */}
                          {isCurrentLine && (
                            <div className="w-1 h-6 rounded-full bg-brand" />
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-base font-bold tabular-nums",
                                isCurrentLine ? "text-brand" : "text-neutral-900 dark:text-white"
                              )}>
                                {lineData.line}+
                              </span>
                              {isPrimaryLine && (
                                <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 uppercase">
                                  Main
                                </span>
                              )}
                              {isCurrentLine && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-semibold rounded-full bg-brand text-white uppercase">
                                  <Check className="h-2.5 w-2.5" /> Active
                                </span>
                              )}
                            </div>
                            {/* Hit Rates Row */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={cn("text-[10px] font-medium", getHitRateColor(hitRates.l10))}>
                                L10: {hitRates.l10 ?? "—"}%
                              </span>
                              <span className="text-neutral-300 dark:text-neutral-700 text-[10px]">|</span>
                              <span className={cn("text-[10px]", getHitRateColor(hitRates.l20))}>
                                L20: {hitRates.l20 ?? "—"}%
                              </span>
                              <span className="text-neutral-300 dark:text-neutral-700 text-[10px]">|</span>
                              <span className={cn("text-[10px]", getHitRateColor(hitRates.szn))}>
                                SZN: {hitRates.szn ?? "—"}%
                              </span>
                            </div>
                          </div>
                        </div>
                        {!isCurrentLine && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomLine(lineData.line === profile.line ? null : lineData.line);
                              setShowAllOdds(false);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 active:scale-95 transition-transform"
                          >
                            Select
                          </button>
                        )}
                      </div>
                      
                      {/* Compact Odds Row */}
                      {(() => {
                        const isExpanded = expandedLineBooks.has(lineData.line);
                        const hasMoreBooks = overBooks.length > 3 || underBooks.length > 3;
                        const displayOverBooks = isExpanded ? overBooks : overBooks.slice(0, 3);
                        const displayUnderBooks = isExpanded ? underBooks : underBooks.slice(0, 3);
                        
                        return (
                          <div className="px-3 pb-2.5 pt-0.5 space-y-1.5">
                            {/* Over Row */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase w-8">Over</span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {displayOverBooks.map(([book, bookOdds], idx) => {
                                  const isBest = idx === 0;
                                  return (
                                    <button
                                      key={`${book}-over`}
                                      type="button"
                                      onClick={() => bookOdds.over?.mobileUrl && window.open(bookOdds.over.mobileUrl, "_blank", "noopener,noreferrer")}
                                      className={cn(
                                        "flex items-center gap-1 px-1.5 py-0.5 rounded transition-all active:scale-95",
                                        isBest 
                                          ? "bg-emerald-500/15 dark:bg-emerald-500/20" 
                                          : "bg-neutral-100 dark:bg-neutral-800"
                                      )}
                                    >
                                      {getBookLogo(book) ? (
                                        <img src={getBookLogo(book)!} alt={book} className="h-3 w-3 rounded object-contain" />
                                      ) : (
                                        <span className="text-[8px] font-medium text-neutral-400 w-3">{book.slice(0,2)}</span>
                                      )}
                                      <span className={cn(
                                        "text-[10px] font-bold tabular-nums",
                                        isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400"
                                      )}>
                                        {bookOdds.over?.price && bookOdds.over.price > 0 ? "+" : ""}{bookOdds.over?.price}
                                      </span>
                                      {isBest && (
                                        <span className="text-[7px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Best</span>
                                      )}
                                    </button>
                                  );
                                })}
                                {overBooks.length === 0 && (
                                  <span className="text-[9px] text-neutral-400">—</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Under Row */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-semibold text-red-500 dark:text-red-400 uppercase w-8">Under</span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {displayUnderBooks.map(([book, bookOdds], idx) => {
                                  const isBest = idx === 0;
                                  return (
                                    <button
                                      key={`${book}-under`}
                                      type="button"
                                      onClick={() => bookOdds.under?.mobileUrl && window.open(bookOdds.under.mobileUrl, "_blank", "noopener,noreferrer")}
                                      className={cn(
                                        "flex items-center gap-1 px-1.5 py-0.5 rounded transition-all active:scale-95",
                                        isBest 
                                          ? "bg-red-500/15 dark:bg-red-500/20" 
                                          : "bg-neutral-100 dark:bg-neutral-800"
                                      )}
                                    >
                                      {getBookLogo(book) ? (
                                        <img src={getBookLogo(book)!} alt={book} className="h-3 w-3 rounded object-contain" />
                                      ) : (
                                        <span className="text-[8px] font-medium text-neutral-400 w-3">{book.slice(0,2)}</span>
                                      )}
                                      <span className={cn(
                                        "text-[10px] font-bold tabular-nums",
                                        isBest ? "text-red-600 dark:text-red-400" : "text-neutral-600 dark:text-neutral-400"
                                      )}>
                                        {bookOdds.under?.price && bookOdds.under.price > 0 ? "+" : ""}{bookOdds.under?.price}
                                      </span>
                                      {isBest && (
                                        <span className="text-[7px] font-bold text-red-600 dark:text-red-400 uppercase">Best</span>
                                      )}
                                    </button>
                                  );
                                })}
                                {underBooks.length === 0 && (
                                  <span className="text-[9px] text-neutral-400">—</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Expand/Collapse Button */}
                            {hasMoreBooks && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedLineBooks(prev => {
                                    const next = new Set(prev);
                                    if (next.has(lineData.line)) {
                                      next.delete(lineData.line);
                                    } else {
                                      next.add(lineData.line);
                                    }
                                    return next;
                                  });
                                }}
                                className="flex items-center gap-1 text-[9px] font-medium text-brand hover:text-brand/80 transition-colors mt-1"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="h-3 w-3 rotate-180" />
                                    Show less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    +{Math.max(overBooks.length - 3, 0) + Math.max(underBooks.length - 3, 0)} more books
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                
                {/* Show All Lines Button */}
                {!showAllLines && sortedLines.length > linesToShow.length && (
                  <button
                    type="button"
                    onClick={() => setShowAllLines(true)}
                    className="w-full py-2.5 text-center text-xs font-medium text-brand hover:text-brand/80 transition-colors"
                  >
                    Show all {sortedLines.length} lines
                  </button>
                )}
              </div>
              
              {/* Safe area padding for iOS */}
              <div className="h-8" />
            </div>
          </div>
        );
      })()}
      
      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT AREA
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        
        {/* ═══ CHART TAB ═══ */}
        {activeTab === "chart" && (
          <>
            {/* Hero Bar Chart - uses filtered games */}
            <HeroBarChart 
              games={filteredChartGames}
              line={effectiveLine}
              avg={avg}
              gameCount={gameCount}
              onGameCountChange={setGameCount}
              quickFilters={quickFilters}
              onQuickFilterToggle={toggleQuickFilter}
              onQuickFiltersClear={() => setQuickFilters(new Set())}
              totalGamesCount={chartGames.length}
              market={profile.market}
            />
        
            {/* ═══ LINE CONTROL BAR - Premium Clean Design ═══ */}
            <div className="bg-gradient-to-br from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-900/50 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden shadow-sm">
              
              {/* Line Adjuster - Featured */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                      Line
                    </div>
                    <div className="text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
                      {effectiveLine}+ {formatMarketLabel(profile.market).split(" ")[0]}
                    </div>
                  </div>
                  
                  {/* Compact Line Adjuster */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustLine(-1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 active:scale-95 transition-all hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <Minus className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                    </button>
                    
                    {isEditingLine ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={lineInputValue}
                        onChange={(e) => setLineInputValue(e.target.value)}
                        onBlur={() => {
                          const parsed = parseFloat(lineInputValue);
                          if (!isNaN(parsed) && parsed >= 0) {
                            setCustomLine(parsed);
                          }
                          setIsEditingLine(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const parsed = parseFloat(lineInputValue);
                            if (!isNaN(parsed) && parsed >= 0) {
                              setCustomLine(parsed);
                            }
                            setIsEditingLine(false);
                          } else if (e.key === "Escape") {
                            setIsEditingLine(false);
                          }
                        }}
                        autoFocus
                        className="w-16 h-10 text-center text-base font-bold bg-white dark:bg-neutral-900 text-brand border border-brand rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setLineInputValue(String(effectiveLine));
                          setIsEditingLine(true);
                        }}
                        className="w-16 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-brand dark:hover:border-brand transition-all"
                      >
                        <span className={cn(
                          "text-base font-bold",
                          customLine !== null ? "text-brand" : "text-neutral-900 dark:text-neutral-100"
                        )}>
                          {effectiveLine}
                        </span>
                      </button>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => adjustLine(1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 active:scale-95 transition-all hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <Plus className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                    </button>
                  </div>
                </div>
                
                {/* Reset Button */}
                {customLine !== null && customLine !== baseLine && (
                  <button
                    type="button"
                    onClick={() => setCustomLine(null)}
                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to {baseLine}
                  </button>
                )}
              </div>
              
              {/* Best Odds - Premium Cards */}
              <div className="px-4 pb-4">
                <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Best Odds
                  {odds?.isAltLine && <span className="ml-2 text-amber-600 dark:text-amber-400">Alt Line</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Over */}
                  <button
                    type="button"
                    onClick={() => odds?.bestOver?.mobileUrl && window.open(odds.bestOver.mobileUrl, "_blank", "noopener,noreferrer")}
                    disabled={!odds?.bestOver}
                    className={cn(
                      "p-3 rounded-xl transition-all active:scale-[0.98]",
                      odds?.bestOver 
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/30" 
                        : "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/30 opacity-50"
                    )}
                  >
                    <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">OVER {effectiveLine}+</div>
                    {odds?.bestOver ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {odds.bestOver.price > 0 ? "+" : ""}{odds.bestOver.price}
                        </span>
                        {getBookLogo(odds.bestOver.book) && (
                          <img src={getBookLogo(odds.bestOver.book)!} alt={odds.bestOver.book} className="h-5 w-5 rounded" />
                        )}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-neutral-400">No odds</div>
                    )}
                  </button>
                  
                  {/* Under */}
                  <button
                    type="button"
                    onClick={() => odds?.bestUnder?.mobileUrl && window.open(odds.bestUnder.mobileUrl, "_blank", "noopener,noreferrer")}
                    disabled={!odds?.bestUnder}
                    className={cn(
                      "p-3 rounded-xl transition-all active:scale-[0.98]",
                      odds?.bestUnder 
                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/30" 
                        : "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/30 opacity-50"
                    )}
                  >
                    <div className="text-[10px] font-medium text-red-500 dark:text-red-400 mb-1">UNDER {effectiveLine}+</div>
                    {odds?.bestUnder ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-red-500 dark:text-red-400">
                          {odds.bestUnder.price > 0 ? "+" : ""}{odds.bestUnder.price}
                        </span>
                        {getBookLogo(odds.bestUnder.book) && (
                          <img src={getBookLogo(odds.bestUnder.book)!} alt={odds.bestUnder.book} className="h-5 w-5 rounded" />
                        )}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-neutral-400">No odds</div>
                    )}
                  </button>
                </div>
                
                {/* View All Odds Link */}
                {fullOddsData?.allLines && fullOddsData.allLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllOdds(true)}
                    className="w-full mt-2 py-2 text-xs font-semibold text-brand hover:text-brand/80 transition-colors flex items-center justify-center gap-1"
                  >
                    View All Odds
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              
            </div>
          </>
        )}
        
        {/* ═══ MATCHUP TAB ═══ */}
        {activeTab === "matchup" && (
          <DefenseVsPositionTab 
            profile={profile} 
            effectiveLine={effectiveLine}
            selectedMarket={selectedMarket}
          />
        )}
        
        {/* ═══ INJURIES TAB ═══ */}
        {activeTab === "injuries" && (
          <div className="space-y-3">
            {rostersLoading ? (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-8">
                <div className="flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-neutral-300 border-t-brand rounded-full animate-spin" />
                </div>
              </div>
            ) : (
              <>
                {/* Player's Team */}
                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
                  {/* Team Header */}
                  <button
                    type="button"
                    onClick={() => setPlayerTeamCollapsed(!playerTeamCollapsed)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700 active:bg-neutral-100 dark:active:bg-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={`/team-logos/nba/${playerTeam.teamAbbr.toUpperCase()}.svg`}
                        alt={playerTeam.teamAbbr}
                        className="h-8 w-8 object-contain"
                      />
                      <div className="flex-1 text-left">
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {playerTeam.teamName}
                        </h3>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {playerTeam.players.length} players
                        </p>
                      </div>
                      <div className="text-[10px] font-medium text-neutral-500">
                        Your Team
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-neutral-400 transition-transform",
                        playerTeamCollapsed && "rotate-180"
                      )} />
                    </div>
                  </button>

                  {/* Player List */}
                  {!playerTeamCollapsed && (
                    <div className="p-3 space-y-3">
                    {(() => {
                      // Organize players by category
                      const activeRotation: TeamRosterPlayer[] = [];
                      const bench: TeamRosterPlayer[] = [];
                      const injured: TeamRosterPlayer[] = [];
                      const gtd: TeamRosterPlayer[] = [];
                      
                      for (const player of playerTeam.players) {
                        const hasInjury = player.injuryStatus && player.injuryStatus !== "active" && player.injuryStatus !== "available";
                        const avgMins = player.avgMinutes || 0;
                        
                        if (hasInjury) {
                          const status = player.injuryStatus?.toLowerCase() || "";
                          if (status.includes("out")) {
                            injured.push(player);
                          } else if (status.includes("questionable") || status.includes("gtd") || status.includes("game time")) {
                            gtd.push(player);
                          } else {
                            // Probable, day-to-day, etc - categorize by minutes
                            if (avgMins >= 20) {
                              activeRotation.push(player);
                            } else {
                              bench.push(player);
                            }
                          }
                        } else {
                          // Healthy players - categorize by minutes
                          if (avgMins >= 20) {
                            activeRotation.push(player);
                          } else {
                            bench.push(player);
                          }
                        }
                      }
                      
                      // Sort each category by minutes (descending)
                      const sortByMinutes = (a: TeamRosterPlayer, b: TeamRosterPlayer) => (b.avgMinutes || 0) - (a.avgMinutes || 0);
                      activeRotation.sort(sortByMinutes);
                      bench.sort(sortByMinutes);
                      injured.sort(sortByMinutes);
                      gtd.sort(sortByMinutes);
                      
                      return (
                        <>
                          {/* Active Rotation */}
                          {activeRotation.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase text-neutral-400 dark:text-neutral-500 mb-1.5 px-1">
                                Active Rotation ({activeRotation.length})
                              </div>
                              <div className="space-y-1">
                                {activeRotation.map((player) => {
                                  const filter = injuryFilters.find(f => f.playerId === player.playerId);
                                  return (
                                    <MobileRosterPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      isCurrentPlayer={player.playerId === profile.playerId}
                                      onInjuryClick={() => setSelectedInjuryPlayer(player)}
                                      withFilter={filter?.mode === "with"}
                                      withoutFilter={filter?.mode === "without"}
                                      onToggleWith={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "with" ? null : "with")}
                                      onToggleWithout={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "without" ? null : "without")}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Game-Time Decision */}
                          {gtd.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase text-amber-500 dark:text-amber-400 mb-1.5 px-1">
                                Game-Time Decision ({gtd.length})
                              </div>
                              <div className="space-y-1">
                                {gtd.map((player) => {
                                  const filter = injuryFilters.find(f => f.playerId === player.playerId);
                                  return (
                                    <MobileRosterPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      isCurrentPlayer={player.playerId === profile.playerId}
                                      onInjuryClick={() => setSelectedInjuryPlayer(player)}
                                      withFilter={filter?.mode === "with"}
                                      withoutFilter={filter?.mode === "without"}
                                      onToggleWith={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "with" ? null : "with")}
                                      onToggleWithout={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "without" ? null : "without")}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Bench / Low Impact */}
                          {bench.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase text-neutral-400 dark:text-neutral-500 mb-1.5 px-1">
                                Bench ({bench.length})
                              </div>
                              <div className="space-y-1">
                                {bench.map((player) => {
                                  const filter = injuryFilters.find(f => f.playerId === player.playerId);
                                  return (
                                    <MobileRosterPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      isCurrentPlayer={player.playerId === profile.playerId}
                                      onInjuryClick={() => setSelectedInjuryPlayer(player)}
                                      withFilter={filter?.mode === "with"}
                                      withoutFilter={filter?.mode === "without"}
                                      onToggleWith={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "with" ? null : "with")}
                                      onToggleWithout={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "without" ? null : "without")}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Injured Players */}
                          {injured.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase text-red-500 dark:text-red-400 mb-1.5 px-1">
                                Injured ({injured.length})
                              </div>
                              <div className="space-y-1">
                                {injured.map((player) => {
                                  const filter = injuryFilters.find(f => f.playerId === player.playerId);
                                  return (
                                    <MobileRosterPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      isCurrentPlayer={player.playerId === profile.playerId}
                                      onInjuryClick={() => setSelectedInjuryPlayer(player)}
                                      withFilter={filter?.mode === "with"}
                                      withoutFilter={filter?.mode === "without"}
                                      onToggleWith={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "with" ? null : "with")}
                                      onToggleWithout={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "without" ? null : "without")}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    </div>
                  )}
                </div>

                {/* Opponent's Team */}
                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
                  {/* Team Header */}
                  <button
                    type="button"
                    onClick={() => setOpponentTeamCollapsed(!opponentTeamCollapsed)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700 active:bg-neutral-100 dark:active:bg-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={`/team-logos/nba/${opponentTeam.teamAbbr.toUpperCase()}.svg`}
                        alt={opponentTeam.teamAbbr}
                        className="h-8 w-8 object-contain"
                      />
                      <div className="flex-1 text-left">
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {opponentTeam.teamName}
                        </h3>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {opponentTeam.players.length} players
                        </p>
                      </div>
                      <div className="text-[10px] font-medium text-neutral-500">
                        Opponent
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-neutral-400 transition-transform",
                        opponentTeamCollapsed && "rotate-180"
                      )} />
                    </div>
                  </button>

                  {/* Player List */}
                  {!opponentTeamCollapsed && (
                    <div className="p-3 space-y-3">
                    {(() => {
                      // Organize players by category
                      const activeRotation: TeamRosterPlayer[] = [];
                      const bench: TeamRosterPlayer[] = [];
                      const injured: TeamRosterPlayer[] = [];
                      const gtd: TeamRosterPlayer[] = [];
                      
                      for (const player of opponentTeam.players) {
                        const hasInjury = player.injuryStatus && player.injuryStatus !== "active" && player.injuryStatus !== "available";
                        const avgMins = player.avgMinutes || 0;
                        
                        if (hasInjury) {
                          const status = player.injuryStatus?.toLowerCase() || "";
                          if (status.includes("out")) {
                            injured.push(player);
                          } else if (status.includes("questionable") || status.includes("gtd") || status.includes("game time")) {
                            gtd.push(player);
                          } else {
                            // Probable, day-to-day, etc - categorize by minutes
                            if (avgMins >= 20) {
                              activeRotation.push(player);
                            } else {
                              bench.push(player);
                            }
                          }
                        } else {
                          // Healthy players - categorize by minutes
                          if (avgMins >= 20) {
                            activeRotation.push(player);
                          } else {
                            bench.push(player);
                          }
                        }
                      }
                      
                      // Sort each category by minutes (descending)
                      const sortByMinutes = (a: TeamRosterPlayer, b: TeamRosterPlayer) => (b.avgMinutes || 0) - (a.avgMinutes || 0);
                      activeRotation.sort(sortByMinutes);
                      bench.sort(sortByMinutes);
                      injured.sort(sortByMinutes);
                      gtd.sort(sortByMinutes);
                      
                      return (
                        <>
                          {/* Active Rotation */}
                          {activeRotation.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase text-neutral-400 dark:text-neutral-500 mb-1.5 px-1">
                                Active Rotation ({activeRotation.length})
                              </div>
                              <div className="space-y-1">
                                {activeRotation.map((player) => {
                                  const filter = injuryFilters.find(f => f.playerId === player.playerId);
                                  return (
                                    <MobileRosterPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      isCurrentPlayer={false}
                                      onInjuryClick={() => setSelectedInjuryPlayer(player)}
                                      withFilter={filter?.mode === "with"}
                                      withoutFilter={filter?.mode === "without"}
                                      onToggleWith={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "with" ? null : "with")}
                                      onToggleWithout={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "without" ? null : "without")}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Game-Time Decision */}
                          {gtd.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase text-amber-500 dark:text-amber-400 mb-1.5 px-1">
                                Game-Time Decision ({gtd.length})
                              </div>
                              <div className="space-y-1">
                                {gtd.map((player) => {
                                  const filter = injuryFilters.find(f => f.playerId === player.playerId);
                                  return (
                                    <MobileRosterPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      isCurrentPlayer={false}
                                      onInjuryClick={() => setSelectedInjuryPlayer(player)}
                                      withFilter={filter?.mode === "with"}
                                      withoutFilter={filter?.mode === "without"}
                                      onToggleWith={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "with" ? null : "with")}
                                      onToggleWithout={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "without" ? null : "without")}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Bench / Low Impact */}
                          {bench.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase text-neutral-400 dark:text-neutral-500 mb-1.5 px-1">
                                Bench ({bench.length})
                              </div>
                              <div className="space-y-1">
                                {bench.map((player) => {
                                  const filter = injuryFilters.find(f => f.playerId === player.playerId);
                                  return (
                                    <MobileRosterPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      isCurrentPlayer={false}
                                      onInjuryClick={() => setSelectedInjuryPlayer(player)}
                                      withFilter={filter?.mode === "with"}
                                      withoutFilter={filter?.mode === "without"}
                                      onToggleWith={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "with" ? null : "with")}
                                      onToggleWithout={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "without" ? null : "without")}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Injured Players */}
                          {injured.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase text-red-500 dark:text-red-400 mb-1.5 px-1">
                                Injured ({injured.length})
                              </div>
                              <div className="space-y-1">
                                {injured.map((player) => {
                                  const filter = injuryFilters.find(f => f.playerId === player.playerId);
                                  return (
                                    <MobileRosterPlayerRow
                                      key={player.playerId}
                                      player={player}
                                      isCurrentPlayer={false}
                                      onInjuryClick={() => setSelectedInjuryPlayer(player)}
                                      withFilter={filter?.mode === "with"}
                                      withoutFilter={filter?.mode === "without"}
                                      onToggleWith={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "with" ? null : "with")}
                                      onToggleWithout={() => handleInjuryFilterToggle(player.playerId, filter?.mode === "without" ? null : "without")}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Injury Detail Modal */}
            {selectedInjuryPlayer && (
              <div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end"
                onClick={() => setSelectedInjuryPlayer(null)}
              >
                <div
                  className="w-full bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl border-t border-neutral-200 dark:border-neutral-700 animate-in slide-in-from-bottom duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn("h-4 w-4", getInjuryColor(selectedInjuryPlayer.injuryStatus))} />
                      <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                        Injury Report
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedInjuryPlayer(null)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <X className="h-4 w-4 text-neutral-500" />
                    </button>
                  </div>

                  {/* Player Info */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm font-bold text-neutral-600 dark:text-neutral-400">
                        {selectedInjuryPlayer.jerseyNumber ?? "—"}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                          {selectedInjuryPlayer.name}
                        </h4>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          {selectedInjuryPlayer.position} • {selectedInjuryPlayer.avgMinutes ? selectedInjuryPlayer.avgMinutes.toFixed(1) : "0.0"} min/game
                        </p>
                      </div>
                    </div>

                    {/* Injury Status */}
                    <div className={cn(
                      "p-4 rounded-xl border",
                      getInjuryBgColor(selectedInjuryPlayer.injuryStatus),
                      "border-neutral-200 dark:border-neutral-700"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <HeartPulse className={cn("h-4 w-4", getInjuryColor(selectedInjuryPlayer.injuryStatus))} />
                        <span className={cn("text-sm font-bold uppercase", getInjuryColor(selectedInjuryPlayer.injuryStatus))}>
                          {selectedInjuryPlayer.injuryStatus}
                        </span>
                      </div>
                      {selectedInjuryPlayer.injuryNotes && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">
                          {selectedInjuryPlayer.injuryNotes}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">PPG</div>
                        <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                          {selectedInjuryPlayer.avgPoints ? selectedInjuryPlayer.avgPoints.toFixed(1) : "0.0"}
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">RPG</div>
                        <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                          {selectedInjuryPlayer.avgRebounds ? selectedInjuryPlayer.avgRebounds.toFixed(1) : "0.0"}
                        </div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">APG</div>
                        <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                          {selectedInjuryPlayer.avgAssists ? selectedInjuryPlayer.avgAssists.toFixed(1) : "0.0"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* ═══ STATS TAB ═══ */}
        {activeTab === "stats" && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-4">
              <div className="flex items-center gap-2 mb-4">
                <ListOrdered className="h-4 w-4 text-brand" />
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
                  Game Log
                </span>
              </div>
              
              {/* Stats Table */}
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full min-w-[400px] text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left py-2 font-semibold text-neutral-500">Date</th>
                      <th className="text-left py-2 font-semibold text-neutral-500">Opp</th>
                      <th className="text-center py-2 font-semibold text-neutral-500">Min</th>
                      <th className="text-center py-2 font-semibold text-neutral-500">{formatMarketLabel(profile.market).split(" ")[0]}</th>
                      <th className="text-center py-2 font-semibold text-neutral-500">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartGames.slice(0, 10).map((game, idx) => {
                      const isHit = game.market_stat >= effectiveLine;
                      return (
                        <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800/50">
                          <td className="py-2 text-neutral-600 dark:text-neutral-400">{game.date?.slice(5) ?? "—"}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-neutral-400 text-[10px]">{game.home_away === "H" ? "vs" : "@"}</span>
                              <img 
                                src={`/team-logos/nba/${game.opponent_abbr?.toUpperCase()}.svg`} 
                                alt="" 
                                className="h-4 w-4 object-contain"
                              />
                            </div>
                          </td>
                          <td className="py-2 text-center text-neutral-600 dark:text-neutral-400">{typeof game.minutes === 'number' ? game.minutes.toFixed(0) : game.minutes}</td>
                          <td className={cn(
                            "py-2 text-center font-bold",
                            isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                          )}>
                            {game.market_stat}
                          </td>
                          <td className="py-2 text-center">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium",
                              game.win_loss === "W" 
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"
                            )}>
                              {game.win_loss}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {chartGames.length > 10 && (
                <p className="text-center text-[10px] text-neutral-400 mt-3">Showing last 10 of {chartGames.length} games</p>
              )}
            </div>
          </div>
        )}
        
        {/* ═══ ODDS TAB ═══ */}
        {activeTab === "odds" && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-brand" />
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
                    Best Odds
                  </span>
                </div>
                <span className="text-xs text-neutral-400">
                  {effectiveLine}+ {formatMarketLabel(profile.market)}
                </span>
              </div>
              
              {/* Current Line Odds */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Over */}
                <button
                  type="button"
                  onClick={() => odds?.bestOver?.mobileUrl && window.open(odds.bestOver.mobileUrl, "_blank", "noopener,noreferrer")}
                  className={cn(
                    "p-3 rounded-xl transition-all active:scale-[0.98]",
                    "bg-emerald-50 dark:bg-emerald-900/20",
                    "border border-emerald-200/60 dark:border-emerald-700/30"
                  )}
                >
                  <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">OVER {effectiveLine}+</div>
                  {odds?.bestOver ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {odds.bestOver.price > 0 ? "+" : ""}{odds.bestOver.price}
                      </span>
                      {getBookLogo(odds.bestOver.book) && (
                        <img src={getBookLogo(odds.bestOver.book)!} alt={odds.bestOver.book} className="h-5 w-5 rounded" />
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-neutral-400">No odds</div>
                  )}
                </button>
                
                {/* Under */}
                <button
                  type="button"
                  onClick={() => odds?.bestUnder?.mobileUrl && window.open(odds.bestUnder.mobileUrl, "_blank", "noopener,noreferrer")}
                  className={cn(
                    "p-3 rounded-xl transition-all active:scale-[0.98]",
                    "bg-red-50 dark:bg-red-900/20",
                    "border border-red-200/60 dark:border-red-700/30"
                  )}
                >
                  <div className="text-[10px] font-medium text-red-500 dark:text-red-400 mb-1">UNDER {effectiveLine}+</div>
                  {odds?.bestUnder ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-red-500 dark:text-red-400">
                        {odds.bestUnder.price > 0 ? "+" : ""}{odds.bestUnder.price}
                      </span>
                      {getBookLogo(odds.bestUnder.book) && (
                        <img src={getBookLogo(odds.bestUnder.book)!} alt={odds.bestUnder.book} className="h-5 w-5 rounded" />
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-neutral-400">No odds</div>
                  )}
                </button>
              </div>
              
              {/* View All Lines Button */}
              {fullOddsData?.allLines && fullOddsData.allLines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllOdds(true)}
                  className="w-full py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-300 active:scale-[0.98] transition-transform"
                >
                  Compare All {fullOddsData.allLines.length} Lines
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-brand border-t-transparent rounded-full" />
          </div>
        )}
        
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          STICKY BOTTOM NAVIGATION TABS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 border-t border-neutral-200/60 dark:border-neutral-800/60 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { id: "chart" as const, label: "Chart", icon: null, customIcon: true },
            { id: "matchup" as const, label: "Matchup", icon: Target, customIcon: false },
            { id: "injuries" as const, label: "Injuries", icon: Users, customIcon: false },
            { id: "stats" as const, label: "Stats", icon: ListOrdered, customIcon: false },
            { id: "odds" as const, label: "Odds", icon: DollarSign, customIcon: false },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all active:scale-95 flex-1 max-w-[80px]",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                )}
              >
                {tab.customIcon ? (
                  <ChartIcon className={cn(
                    "h-5 w-5",
                    isActive && "text-brand"
                  )} />
                ) : tab.icon && (
                  <tab.icon className={cn(
                    "h-5 w-5",
                    isActive && "text-brand"
                  )} />
                )}
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive && "text-brand"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

