"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePlayerCorrelations, TeammateCorrelation, TeammateGameLog, HitRateStats } from "@/hooks/use-player-correlations";
import { useHitRateOdds, LineOdds } from "@/hooks/use-hit-rate-odds";
import { useFavorites, createFavoriteKey, type BookSnapshot } from "@/hooks/use-favorites";
import { PlayerHeadshot } from "@/components/player-headshot";
import { OddsDropdown } from "@/components/hit-rates/odds-dropdown";
import { formatMarketLabel } from "@/lib/data/markets";
import { Tooltip } from "@/components/tooltip";
import { toast } from "sonner";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Home, 
  Plane, 
  ChevronDown,
  ChevronUp,
  Flame,
  Snowflake,
  Minus,
  Info,
  AlertTriangle,
  ArrowUpDown,
  SlidersHorizontal,
  Check,
  X,
  LayoutGrid,
  List,
  HeartPulse,
  Heart,
  Loader2,
  ArrowDown,
} from "lucide-react";

interface PlayerCorrelationsProps {
  playerId: number | null;
  market: string | null;
  line: number | null;
  gameId?: string | number | null; // For fetching odds data
  gameDate?: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  startTime?: string | null;
  anchorTeam?: string | null;
  playerName?: string;
  className?: string;
}

// All available teammate markets
type TeammateMarket = 
  | "all" | "points" | "rebounds" | "assists" 
  | "threes" | "steals" | "blocks" | "turnovers"
  | "pra" | "pointsRebounds" | "pointsAssists" | "reboundsAssists" | "blocksSteals";

// Sort options
type SortOption = "hitRate" | "boost" | "sample";

// Market configuration
const TEAMMATE_MARKETS: { key: TeammateMarket; label: string; abbr: string }[] = [
  { key: "all", label: "All Stats", abbr: "ALL" },
  { key: "points", label: "Points", abbr: "PTS" },
  { key: "rebounds", label: "Rebounds", abbr: "REB" },
  { key: "assists", label: "Assists", abbr: "AST" },
  { key: "threes", label: "Threes", abbr: "3PM" },
  { key: "steals", label: "Steals", abbr: "STL" },
  { key: "blocks", label: "Blocks", abbr: "BLK" },
  { key: "turnovers", label: "Turnovers", abbr: "TO" },
  { key: "pra", label: "PRA", abbr: "PRA" },
  { key: "pointsRebounds", label: "Pts+Reb", abbr: "PR" },
  { key: "pointsAssists", label: "Pts+Ast", abbr: "PA" },
  { key: "reboundsAssists", label: "Reb+Ast", abbr: "RA" },
  { key: "blocksSteals", label: "Blk+Stl", abbr: "BS" },
];

const STAT_MARKETS = TEAMMATE_MARKETS.filter(m => m.key !== "all");

const MARKET_LABELS: Record<TeammateMarket, string> = {
  all: "All",
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
  threes: "3PM",
  steals: "STL",
  blocks: "BLK",
  turnovers: "TO",
  pra: "PRA",
  pointsRebounds: "PR",
  pointsAssists: "PA",
  reboundsAssists: "RA",
  blocksSteals: "BS",
};

const TEAMMATE_MARKET_TO_DB: Record<Exclude<TeammateMarket, "all">, string> = {
  points: "player_points",
  rebounds: "player_rebounds",
  assists: "player_assists",
  threes: "player_threes_made",
  steals: "player_steals",
  blocks: "player_blocks",
  turnovers: "player_turnovers",
  pra: "player_points_rebounds_assists",
  pointsRebounds: "player_points_rebounds",
  pointsAssists: "player_points_assists",
  reboundsAssists: "player_rebounds_assists",
  blocksSteals: "player_blocks_steals",
};

// Toggle for correlation odds/favorite controls.
const SHOW_CORRELATION_ACTIONS = true;

// Injury status helpers
const hasInjuryStatus = (status?: string | null): boolean => {
  if (!status) return false;
  const lower = status.toLowerCase();
  return lower !== "active" && lower !== "available" && lower !== "";
};

const getInjuryIconColor = (status?: string | null): string => {
  if (!status) return "text-neutral-400";
  const lower = status.toLowerCase();
  if (lower === "out" || lower === "inactive") return "text-red-500";
  if (lower === "questionable" || lower === "doubtful") return "text-amber-500";
  if (lower === "probable" || lower === "day-to-day") return "text-emerald-500";
  return "text-neutral-400";
};

const isGLeagueAssignment = (notes?: string | null): boolean => {
  if (!notes) return false;
  const lower = notes.toLowerCase();
  return lower.includes("g league") || lower.includes("g-league") || lower.includes("gleague");
};

const getCorrelationOddsStableKey = (hitRateData?: HitRateStats | null): string | null => {
  if (!hitRateData) return null;
  if (hitRateData.selectionId) return hitRateData.selectionId;
  if (hitRateData.selKey && hitRateData.lineUsed !== null && hitRateData.lineUsed !== undefined) {
    return `${hitRateData.selKey}:${hitRateData.lineUsed}:over`;
  }
  return null;
};

// Helper to get stat value from game log
const getStatFromGameLog = (
  stats: TeammateCorrelation["gameLogs"][0]["stats"], 
  market: TeammateMarket
): number => {
  const mapping: Record<Exclude<TeammateMarket, "all">, keyof typeof stats> = {
    points: "pts",
    rebounds: "reb",
    assists: "ast",
    threes: "fg3m",
    steals: "stl",
    blocks: "blk",
    turnovers: "tov",
    pra: "pra",
    pointsRebounds: "pr",
    pointsAssists: "pa",
    reboundsAssists: "ra",
    blocksSteals: "bs",
  };
  if (market === "all") return 0;
  return stats[mapping[market]] ?? 0;
};

// Calculate hit rate from filtered game logs
const calculateHitRateFromLogs = (
  gameLogs: TeammateGameLog[],
  market: TeammateMarket,
  lineUsed: number | null | undefined
): { pct: number | null; timesHit: number; games: number } => {
  if (market === "all" || gameLogs.length === 0) {
    return { pct: null, timesHit: 0, games: 0 };
  }
  
  const isTurnovers = market === "turnovers";
  const relevantGames = gameLogs.filter(g => g.anchorHit);
  
  if (relevantGames.length === 0) {
    return { pct: null, timesHit: 0, games: 0 };
  }
  
  // Handle missing or invalid line - use 0.5 as minimum (any positive stat is a hit)
  const effectiveLine = (lineUsed != null && lineUsed > 0) ? lineUsed : 0.5;
  
  let timesHit = 0;
  for (const game of relevantGames) {
    const statValue = getStatFromGameLog(game.stats, market);
    const isHit = isTurnovers ? statValue <= effectiveLine : statValue >= effectiveLine;
    if (isHit) timesHit++;
  }
  
  const pct = Math.round((timesHit / relevantGames.length) * 100);
  return { pct, timesHit, games: relevantGames.length };
};

// Strength level types
type StrengthLevel = "hot" | "warm" | "neutral" | "cold" | "low";

const getStrengthLevel = (hitRate: number | null, sampleSize: number): StrengthLevel => {
  if (hitRate === null || sampleSize < 3) return "low";
  if (hitRate >= 70 && sampleSize >= 3) return "hot";
  if (hitRate >= 50 && sampleSize >= 3) return "warm";
  if (hitRate <= 35 && sampleSize >= 3) return "cold";
  return "neutral";
};

const getStrengthConfig = (level: StrengthLevel) => {
  switch (level) {
    case "hot":
      return { 
        label: "HOT", 
        color: "text-emerald-500", 
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        icon: Flame,
        iconColor: "text-emerald-500"
      };
    case "warm":
      return { 
        label: "WARM", 
        color: "text-amber-500", 
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        icon: TrendingUp,
        iconColor: "text-amber-500"
      };
    case "cold":
      return { 
        label: "COLD", 
        color: "text-blue-400", 
        bg: "bg-blue-500/10",
        border: "border-blue-500/30",
        icon: Snowflake,
        iconColor: "text-blue-400"
      };
    case "neutral":
      return { 
        label: "NEUTRAL", 
        color: "text-neutral-400", 
        bg: "bg-neutral-500/10",
        border: "border-neutral-500/20",
        icon: Minus,
        iconColor: "text-neutral-400"
      };
    default:
      return { 
        label: "", 
        color: "text-neutral-400", 
        bg: "bg-neutral-500/10",
        border: "border-neutral-500/20",
        icon: AlertTriangle,
        iconColor: "text-neutral-400"
      };
  }
};

// Get color class based on hit rate
const getHitRateColor = (pct: number | null) => {
  if (pct === null) return "text-neutral-400";
  if (pct >= 70) return "text-emerald-500";
  if (pct >= 50) return "text-amber-500";
  if (pct >= 40) return "text-orange-400";
  return "text-red-400";
};

// Get best markets for a teammate
const getBestMarkets = (
  teammate: TeammateCorrelation, 
  locationFilter: "all" | "home" | "away",
  limit: number = 3
): { market: TeammateMarket; pct: number; line: number; games: number }[] => {
  const results: { market: TeammateMarket; pct: number; line: number; games: number }[] = [];
  
  const filteredLogs = locationFilter === "all" 
    ? teammate.gameLogs 
    : teammate.gameLogs.filter(g => g.homeAway === locationFilter);
  
  for (const { key } of STAT_MARKETS) {
    const stat = teammate[key as Exclude<TeammateMarket, "all">];
    if (!stat?.hitRateWhenAnchorHits) continue;
    
    // Use effective line with fallback
    const effectiveLine = (stat.hitRateWhenAnchorHits.lineUsed != null && stat.hitRateWhenAnchorHits.lineUsed > 0) 
      ? stat.hitRateWhenAnchorHits.lineUsed 
      : 0.5;
    
    // Always calculate from game logs for consistency
    const recalc = calculateHitRateFromLogs(
      filteredLogs,
      key as TeammateMarket,
      effectiveLine
    );
    
    const pct = recalc.pct;
    const games = recalc.games;
    
    if (pct !== null && games >= 3) {
      results.push({ 
        market: key as TeammateMarket, 
        pct, 
        line: effectiveLine,
        games
      });
    }
  }
  
  return results.sort((a, b) => b.pct - a.pct).slice(0, limit);
};

// ═══════════════════════════════════════════════════════════════════════════
// ALL STATS GRID VIEW - Full Width Dashboard Style
// ═══════════════════════════════════════════════════════════════════════════

const AllStatsGridRow = ({ 
  teammate, 
  anchorPlayerName,
  locationFilter,
  isEven,
  minHitRate,
  selectedMarkets,
}: { 
  teammate: TeammateCorrelation;
  anchorPlayerName?: string;
  locationFilter: "all" | "home" | "away";
  isEven: boolean;
  minHitRate: number;
  selectedMarkets: Set<TeammateMarket>;
}) => {
  const bestMarkets = useMemo(() => getBestMarkets(teammate, locationFilter, 1), [teammate, locationFilter]);
  const hasBestMarket = bestMarkets.length > 0 && bestMarkets[0].pct >= 70;
  
  const filteredLogs = useMemo(() => {
    if (locationFilter === "all") return teammate.gameLogs;
    return teammate.gameLogs.filter(g => g.homeAway === locationFilter);
  }, [teammate.gameLogs, locationFilter]);

  // Get markets to display (only selected ones)
  const marketsToShow = STAT_MARKETS.filter(m => selectedMarkets.has(m.key));

  return (
    <div 
      className={cn(
        "grid grid-cols-[160px_1fr] border-b border-neutral-100 dark:border-neutral-800/40 last:border-0",
        isEven ? "bg-neutral-50/40 dark:bg-neutral-900/30" : "bg-white dark:bg-neutral-900/10",
        "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors"
      )}
    >
      {/* Player Column - Fixed */}
      <div className="flex items-center gap-3 px-4 py-3 border-r border-neutral-100 dark:border-neutral-800/40">
        <div className="relative shrink-0">
          <PlayerHeadshot
            nbaPlayerId={teammate.playerId}
            name={teammate.playerName}
            size="tiny"
            className="w-8 h-8 rounded-full"
          />
          {hasBestMarket && (
            <Flame className="absolute -top-0.5 -right-0.5 w-3 h-3 text-amber-500" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
              {teammate.playerName}
            </span>
            {/* Injury Icon */}
            {hasInjuryStatus(teammate.injuryStatus) && (() => {
              const isGL = isGLeagueAssignment(teammate.injuryNotes);
              return (
                <Tooltip
                  content={isGL 
                    ? `G League${teammate.injuryNotes ? ` - ${teammate.injuryNotes}` : ""}`
                    : `${teammate.injuryStatus?.charAt(0).toUpperCase()}${teammate.injuryStatus?.slice(1).toLowerCase()}${teammate.injuryNotes ? ` - ${teammate.injuryNotes}` : ""}`
                  }
                  side="right"
                >
                  {isGL ? (
                    <ArrowDown className="h-3 w-3 shrink-0 cursor-help text-blue-500" />
                  ) : (
                    <HeartPulse className={cn(
                      "h-3 w-3 shrink-0 cursor-help",
                      getInjuryIconColor(teammate.injuryStatus)
                    )} />
                  )}
                </Tooltip>
              );
            })()}
          </div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {teammate.position} • {teammate.minutesAvg?.toFixed(0)} min
          </div>
        </div>
      </div>

      {/* Stats Grid - Fills remaining space */}
      <div 
        className="grid gap-1 px-3 py-2"
        style={{ gridTemplateColumns: `repeat(${marketsToShow.length}, 1fr)` }}
      >
        {marketsToShow.map(({ key, abbr }) => {
          const stat = teammate[key as Exclude<TeammateMarket, "all">];
          if (!stat?.hitRateWhenAnchorHits) {
            return (
              <div key={key} className="text-center py-2 rounded bg-neutral-50/50 dark:bg-neutral-800/20">
                <div className="text-[9px] font-medium text-neutral-300 dark:text-neutral-600">{abbr}</div>
                <div className="text-xs text-neutral-300 dark:text-neutral-600 mt-0.5">—</div>
              </div>
            );
          }
          
          // Use effective line with fallback for players without sportsbook lines
          const effectiveLine = (stat.hitRateWhenAnchorHits.lineUsed != null && stat.hitRateWhenAnchorHits.lineUsed > 0) 
            ? stat.hitRateWhenAnchorHits.lineUsed 
            : 0.5;
          
          // Always calculate from game logs to ensure consistency with sparkbars
          const isTurnovers = key === "turnovers";
          const relevantGames = filteredLogs.filter(g => g.anchorHit);
          
          let pct: number | null;
          let games: number;
          let timesHit: number;
          
          if (relevantGames.length === 0) {
            pct = null;
            games = 0;
            timesHit = 0;
          } else {
            games = relevantGames.length;
            timesHit = relevantGames.filter(game => {
              const val = getStatFromGameLog(game.stats, key as TeammateMarket);
              return isTurnovers ? val <= effectiveLine : val >= effectiveLine;
            }).length;
            pct = Math.round((timesHit / games) * 100);
          }
          
          // Skip if below min hit rate threshold
          if (minHitRate > 0 && (pct === null || pct < minHitRate)) {
            return (
              <div key={key} className="text-center py-2 rounded bg-neutral-50/30 dark:bg-neutral-800/10 opacity-40">
                <div className="text-[9px] font-medium text-neutral-300 dark:text-neutral-600">{abbr}</div>
                <div className="text-xs text-neutral-300 dark:text-neutral-600 mt-0.5">{pct ?? "—"}%</div>
              </div>
            );
          }
          
          const isStrong = pct !== null && pct >= 70 && games >= 3;
          const isWarm = pct !== null && pct >= 50 && pct < 70 && games >= 3;
          const isCold = pct !== null && pct <= 35 && games >= 3;
          const isBest = bestMarkets[0]?.market === key;
          
          return (
            <Tooltip
              key={key}
              content={`${abbr} ${effectiveLine}+: ${pct}% (${games} games)`}
            >
              <div 
                className={cn(
                  "text-center py-2 rounded cursor-help transition-all border",
                  isStrong 
                    ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800" 
                    : isWarm
                      ? "bg-amber-50/50 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/50"
                      : isCold
                        ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200/50 dark:border-blue-800/50"
                        : "bg-neutral-50/50 dark:bg-neutral-800/30 border-transparent",
                  isBest && isStrong && "ring-2 ring-emerald-400/60 dark:ring-emerald-500/40"
                )}
              >
                <div className="text-[9px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase">{abbr}</div>
                <div className={cn("text-sm font-bold tabular-nums mt-0.5", getHitRateColor(pct))}>
                  {pct !== null ? `${pct}%` : "—"}
                </div>
                <div className="text-[8px] text-neutral-400 mt-0.5">
                  {effectiveLine}+
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE STAT CARD VIEW - Beautiful Card Layout
// ═══════════════════════════════════════════════════════════════════════════

interface CorrelationFavoritePayload {
  teammate: TeammateCorrelation;
  marketKey: string;
  hitRateData: HitRateStats;
  effectiveLine: number;
  liveOdds: LineOdds | null;
}

const TeammateCard = ({ 
  teammate, 
  selectedMarket,
  anchorPlayerName,
  locationFilter,
  isExpanded,
  onToggle,
  getOdds,
  favoriteKeys,
  togglingFavoriteKey,
  onToggleFavorite,
  oddsLoading,
  fallbackEventId,
}: { 
  teammate: TeammateCorrelation;
  selectedMarket: Exclude<TeammateMarket, "all">;
  anchorPlayerName?: string;
  locationFilter: "all" | "home" | "away";
  isExpanded: boolean;
  onToggle: () => void;
  getOdds: (selectionId: string | null) => LineOdds | null;
  favoriteKeys: Set<string>;
  togglingFavoriteKey: string | null;
  onToggleFavorite: (payload: CorrelationFavoritePayload, e: React.MouseEvent) => Promise<void>;
  oddsLoading: boolean;
  fallbackEventId?: string | null;
}) => {
  const statData = teammate[selectedMarket];
  const hitRateData = statData?.hitRateWhenAnchorHits;
  const marketLabel = MARKET_LABELS[selectedMarket];
  const marketKey = TEAMMATE_MARKET_TO_DB[selectedMarket];
  
  // Get live odds from Redis using selection ID
  const oddsStableKey = getCorrelationOddsStableKey(hitRateData);
  const liveOdds = oddsStableKey ? getOdds(oddsStableKey) : null;

  const filteredLogs = useMemo(() => {
    if (locationFilter === "all") return teammate.gameLogs;
    return teammate.gameLogs.filter(g => g.homeAway === locationFilter);
  }, [teammate.gameLogs, locationFilter]);

  // Use consistent line for both sparkbar and percentage
  const effectiveLine = (hitRateData?.lineUsed != null && hitRateData.lineUsed > 0) 
    ? hitRateData.lineUsed 
    : 0.5;
  
  const eventId = hitRateData?.eventId ?? fallbackEventId ?? null;
  const canFavorite = !!eventId && (!!hitRateData?.selKey || !!hitRateData?.selectionId);
  const favoriteKey = canFavorite
    ? createFavoriteKey({
        event_id: eventId!,
        type: "player",
        player_id: String(teammate.playerId),
        market: marketKey,
        line: effectiveLine,
        side: "over",
      })
    : null;
  const isFavorited = favoriteKey ? favoriteKeys.has(favoriteKey) : false;
  const isTogglingFavorite = favoriteKey ? togglingFavoriteKey === favoriteKey : false;
  
  const bestOdds = liveOdds?.bestOver
    ? {
        book: liveOdds.bestOver.book,
        price: liveOdds.bestOver.price,
        updated_at: liveOdds.timestamp ?? Date.now(),
      }
    : null;

  // Sparkbar data - uses same effectiveLine as percentage
  const sparkData = useMemo(() => {
    return filteredLogs
      .filter(g => g.anchorHit)
      .slice(0, 8)
      .reverse()
      .map(game => {
        const val = getStatFromGameLog(game.stats, selectedMarket);
        const isHit = selectedMarket === "turnovers" 
          ? val <= effectiveLine 
          : val >= effectiveLine;
        return isHit;
      });
  }, [filteredLogs, selectedMarket, effectiveLine]);

  // Derive timesHit / games / pct directly from sparkData so display matches the bars
  const games = sparkData.length;
  const timesHit = sparkData.filter(Boolean).length;
  const hitPct = games > 0 ? Math.round((timesHit / games) * 100) : null;

  const strength = getStrengthLevel(hitPct, games);
  const config = getStrengthConfig(strength);
  const Icon = config.icon;

  const boost = statData?.diff ?? null;
  const hasBoost = boost !== null && Math.abs(boost) >= 0.3;

  if (!statData || !hitRateData) return null;

  return (
    <div 
      className={cn(
        "rounded-2xl border overflow-visible transition-all cursor-pointer",
        "border-neutral-200/60 dark:border-neutral-700/40",
        "bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-900/80",
        "shadow-sm shadow-neutral-200/50 dark:shadow-neutral-900/30",
        "hover:shadow-md hover:shadow-neutral-300/40 dark:hover:shadow-neutral-900/50 hover:border-neutral-300/60 dark:hover:border-neutral-600/50",
        isExpanded && "ring-2 ring-purple-500/20 shadow-purple-100 dark:shadow-purple-900/20"
      )}
      onClick={onToggle}
    >
      {/* Card Header */}
      <div className="px-3 py-2.5 flex items-start justify-between gap-2">
        {/* Left: Player Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayerHeadshot
            nbaPlayerId={teammate.playerId}
            name={teammate.playerName}
            size="small"
            className="w-10 h-10 rounded-full shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {teammate.playerName}
              </span>
              {/* Injury Icon */}
              {hasInjuryStatus(teammate.injuryStatus) && (() => {
                const isGL = isGLeagueAssignment(teammate.injuryNotes);
                return (
                  <Tooltip
                    content={isGL 
                      ? `G League${teammate.injuryNotes ? ` - ${teammate.injuryNotes}` : ""}`
                      : `${teammate.injuryStatus?.charAt(0).toUpperCase()}${teammate.injuryStatus?.slice(1).toLowerCase()}${teammate.injuryNotes ? ` - ${teammate.injuryNotes}` : ""}`
                    }
                    side="top"
                  >
                    {isGL ? (
                      <ArrowDown className="h-3.5 w-3.5 shrink-0 cursor-help text-blue-500" />
                    ) : (
                      <HeartPulse className={cn(
                        "h-3.5 w-3.5 shrink-0 cursor-help",
                        getInjuryIconColor(teammate.injuryStatus)
                      )} />
                    )}
                  </Tooltip>
                );
              })()}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {teammate.position} • {teammate.minutesAvg?.toFixed(0)} min/g
            </div>
          </div>
        </div>

        {/* Right: Actions + Strength */}
        <div className="flex items-center gap-1.5 shrink-0">
          {SHOW_CORRELATION_ACTIONS && (
            <>
              <OddsDropdown
                eventId={eventId}
                market={marketKey}
                selKey={hitRateData.selKey || hitRateData.selectionId}
                line={effectiveLine}
                bestOdds={bestOdds}
                loading={oddsLoading}
              />
              <Tooltip
                content={
                  !canFavorite
                    ? "No live market to save"
                    : isFavorited
                      ? "Remove from My Plays"
                      : "Add to My Plays"
                }
                side="top"
              >
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite({ teammate, marketKey, hitRateData, effectiveLine, liveOdds }, e)}
                  disabled={!canFavorite || isTogglingFavorite}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    isFavorited
                      ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      : "text-neutral-300 hover:text-rose-400 hover:bg-neutral-100 dark:text-neutral-600 dark:hover:text-rose-400 dark:hover:bg-neutral-800",
                    (!canFavorite || isTogglingFavorite) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isTogglingFavorite ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className={cn("h-4 w-4", isFavorited && "fill-current")} />
                  )}
                </button>
              </Tooltip>
            </>
          )}
          {strength !== "low" && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0",
              config.bg, config.color
            )}>
              <Icon className={cn("w-3 h-3", config.iconColor)} />
              {config.label}
            </div>
          )}
        </div>
      </div>

      {/* Hit Rate Section */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn("text-3xl font-black tabular-nums", getHitRateColor(hitPct))}>
            {hitPct !== null ? `${hitPct}%` : "—"}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              hit {effectiveLine}+ {marketLabel}
            </span>
          </div>
        </div>
        <div className="text-[11px] text-neutral-400 mt-0.5">
          {timesHit}/{games} games when {anchorPlayerName?.split(' ').slice(-1)[0]} hits
        </div>

        {/* Sparkbar - refined spacing and sizing */}
        {sparkData.length > 0 && (
          <div className="flex items-end gap-1 h-2.5 mt-2.5">
            {sparkData.map((hit, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 rounded-sm transition-all",
                  hit ? "bg-emerald-500 h-full" : "bg-red-400/80 h-1.5"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats Row - Stripe-like pill design */}
      <div className="px-3 py-2.5 border-t border-neutral-100/80 dark:border-neutral-800/30 flex items-center gap-2 flex-wrap">
        {/* Avg When Hit Pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/60">
          <span className="text-[10px] font-medium text-neutral-400 uppercase">Avg</span>
          <span className="text-xs font-bold text-neutral-900 dark:text-white tabular-nums">
            {statData.avgWhenHit?.toFixed(1) ?? "—"}
          </span>
          {hasBoost && (
            <span className={cn(
              "text-[10px] font-bold tabular-nums",
              boost! > 0 ? "text-emerald-500" : "text-red-400"
            )}>
              ({boost! > 0 ? "+" : ""}{boost!.toFixed(1)})
            </span>
          )}
        </div>

        {/* Season Avg Pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/60">
          <span className="text-[10px] font-medium text-neutral-400 uppercase">Season</span>
          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 tabular-nums">
            {statData.avgOverall?.toFixed(1) ?? "—"}
          </span>
        </div>

        {/* Sample Pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/60">
          <span className="text-[10px] font-medium text-neutral-400 uppercase">Sample</span>
          <span className={cn(
            "text-xs font-bold tabular-nums",
            games < 5 ? "text-amber-500" : "text-neutral-600 dark:text-neutral-300"
          )}>
            {games}
          </span>
        </div>
      </div>

      {/* Expanded Section */}
      {isExpanded && (
        <div className="px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/30 border-t border-neutral-100 dark:border-neutral-800/50">
          {/* Detailed Stats Grid */}
          <div className="grid grid-cols-4 gap-2 mb-2.5">
            {[
              { label: "When Hit", value: statData.avgWhenHit?.toFixed(1) ?? "—", color: "text-emerald-600 dark:text-emerald-400" },
              { label: "When Miss", value: statData.avgWhenMiss?.toFixed(1) ?? "—", color: "text-neutral-500" },
              { label: "Boost", value: boost !== null ? `${boost > 0 ? "+" : ""}${boost.toFixed(1)}` : "—", 
                color: boost !== null && boost > 0 ? "text-emerald-500" : boost !== null && boost < 0 ? "text-red-500" : "text-neutral-400" },
              { label: "Sample", value: `${teammate.sample.whenAnchorHits}`, color: teammate.sample.whenAnchorHits < 5 ? "text-amber-500" : "text-neutral-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className="text-[9px] font-medium text-neutral-400 uppercase">{label}</div>
                <div className={cn("text-xs font-bold tabular-nums", color)}>{value}</div>
              </div>
            ))}
          </div>

          {/* Other Markets */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700/50">
            <div className="text-[9px] font-medium text-neutral-400 uppercase mb-1.5">Other Markets</div>
            <div className="flex flex-wrap gap-1">
              {STAT_MARKETS.filter(m => m.key !== selectedMarket).slice(0, 6).map(({ key, abbr }) => {
                const stat = teammate[key as Exclude<TeammateMarket, "all">];
                if (!stat?.hitRateWhenAnchorHits) return null;
                const pct = stat.hitRateWhenAnchorHits.pct;
                return (
                  <div 
                    key={key}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      pct !== null && pct >= 70 
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    )}
                  >
                    {abbr} {pct ?? 0}%
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE STAT TABLE ROW - Compact Table View
// ═══════════════════════════════════════════════════════════════════════════

const StatTableRow = ({ 
  teammate, 
  selectedMarket,
  anchorPlayerName,
  locationFilter,
  isEven,
  getOdds,
  favoriteKeys,
  togglingFavoriteKey,
  onToggleFavorite,
  oddsLoading,
  fallbackEventId,
}: { 
  teammate: TeammateCorrelation;
  selectedMarket: Exclude<TeammateMarket, "all">;
  anchorPlayerName?: string;
  locationFilter: "all" | "home" | "away";
  isEven: boolean;
  getOdds: (selectionId: string | null) => LineOdds | null;
  favoriteKeys: Set<string>;
  togglingFavoriteKey: string | null;
  onToggleFavorite: (payload: CorrelationFavoritePayload, e: React.MouseEvent) => Promise<void>;
  oddsLoading: boolean;
  fallbackEventId?: string | null;
}) => {
  const tableGridClass = SHOW_CORRELATION_ACTIONS
    ? "grid grid-cols-[180px_80px_100px_70px_70px_50px_70px_70px] items-center gap-2"
    : "grid grid-cols-[180px_80px_100px_70px_70px_50px_70px] items-center gap-2";
  const statData = teammate[selectedMarket];
  const hitRateData = statData?.hitRateWhenAnchorHits;
  const marketLabel = MARKET_LABELS[selectedMarket];
  const marketKey = TEAMMATE_MARKET_TO_DB[selectedMarket];
  
  // Get live odds from Redis using selection ID
  const oddsStableKey = getCorrelationOddsStableKey(hitRateData);
  const liveOdds = oddsStableKey ? getOdds(oddsStableKey) : null;

  const filteredLogs = useMemo(() => {
    if (locationFilter === "all") return teammate.gameLogs;
    return teammate.gameLogs.filter(g => g.homeAway === locationFilter);
  }, [teammate.gameLogs, locationFilter]);

  // Use consistent line for both sparkbar and percentage
  const effectiveLine = (hitRateData?.lineUsed != null && hitRateData.lineUsed > 0) 
    ? hitRateData.lineUsed 
    : 0.5;
  
  const eventId = hitRateData?.eventId ?? fallbackEventId ?? null;
  const canFavorite = !!eventId && (!!hitRateData?.selKey || !!hitRateData?.selectionId);
  const favoriteKey = canFavorite
    ? createFavoriteKey({
        event_id: eventId!,
        type: "player",
        player_id: String(teammate.playerId),
        market: marketKey,
        line: effectiveLine,
        side: "over",
      })
    : null;
  const isFavorited = favoriteKey ? favoriteKeys.has(favoriteKey) : false;
  const isTogglingFavorite = favoriteKey ? togglingFavoriteKey === favoriteKey : false;
  
  const bestOdds = liveOdds?.bestOver
    ? {
        book: liveOdds.bestOver.book,
        price: liveOdds.bestOver.price,
        updated_at: liveOdds.timestamp ?? Date.now(),
      }
    : null;

  // Sparkbar data - uses same effectiveLine as percentage
  const sparkData = useMemo(() => {
    return filteredLogs
      .filter(g => g.anchorHit)
      .slice(0, 8)
      .reverse()
      .map(game => {
        const val = getStatFromGameLog(game.stats, selectedMarket);
        const isHit = selectedMarket === "turnovers" 
          ? val <= effectiveLine 
          : val >= effectiveLine;
        return isHit;
      });
  }, [filteredLogs, selectedMarket, effectiveLine]);

  // Derive timesHit / games / pct directly from sparkData so display matches the bars
  const games = sparkData.length;
  const timesHit = sparkData.filter(Boolean).length;
  const hitPct = games > 0 ? Math.round((timesHit / games) * 100) : null;

  const strength = getStrengthLevel(hitPct, games);
  const config = getStrengthConfig(strength);
  const boost = statData?.diff ?? null;

  if (!statData || !hitRateData) return null;

  return (
    <div 
      className={cn(
        tableGridClass,
        "px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800/40 last:border-0",
        isEven ? "bg-neutral-50/40 dark:bg-neutral-900/30" : "bg-white dark:bg-neutral-900/10",
        "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors"
      )}
    >
      {/* Player */}
      <div className="flex items-center gap-2.5 min-w-0">
        <PlayerHeadshot
          nbaPlayerId={teammate.playerId}
          name={teammate.playerName}
          size="tiny"
          className="w-8 h-8 rounded-full shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
              {teammate.playerName}
            </span>
            {SHOW_CORRELATION_ACTIONS && (
              <Tooltip
                content={
                  !canFavorite
                    ? "No live market to save"
                    : isFavorited
                      ? "Remove from My Plays"
                      : "Add to My Plays"
                }
                side="top"
              >
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite({ teammate, marketKey, hitRateData, effectiveLine, liveOdds }, e)}
                  disabled={!canFavorite || isTogglingFavorite}
                  className={cn(
                    "p-1 rounded transition-all",
                    isFavorited
                      ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      : "text-neutral-300 hover:text-rose-400 hover:bg-neutral-100 dark:text-neutral-600 dark:hover:text-rose-400 dark:hover:bg-neutral-800",
                    (!canFavorite || isTogglingFavorite) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isTogglingFavorite ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Heart className={cn("h-3 w-3", isFavorited && "fill-current")} />
                  )}
                </button>
              </Tooltip>
            )}
            {/* Injury Icon */}
            {hasInjuryStatus(teammate.injuryStatus) && (() => {
              const isGL = isGLeagueAssignment(teammate.injuryNotes);
              return (
                <Tooltip
                  content={isGL 
                    ? `G League${teammate.injuryNotes ? ` - ${teammate.injuryNotes}` : ""}`
                    : `${teammate.injuryStatus?.charAt(0).toUpperCase()}${teammate.injuryStatus?.slice(1).toLowerCase()}${teammate.injuryNotes ? ` - ${teammate.injuryNotes}` : ""}`
                  }
                  side="top"
                >
                  {isGL ? (
                    <ArrowDown className="h-3 w-3 shrink-0 cursor-help text-blue-500" />
                  ) : (
                    <HeartPulse className={cn(
                      "h-3 w-3 shrink-0 cursor-help",
                      getInjuryIconColor(teammate.injuryStatus)
                    )} />
                  )}
                </Tooltip>
              );
            })()}
          </div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {teammate.position} • {teammate.minutesAvg?.toFixed(0)} min
          </div>
        </div>
      </div>

      {/* Line */}
      <div className="text-center">
        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 tabular-nums">
          {effectiveLine}+ {marketLabel}
        </span>
      </div>

      {/* Hit Rate */}
      <div className="flex items-center justify-center gap-2">
        <span className={cn("text-lg font-black tabular-nums", getHitRateColor(hitPct))}>
          {hitPct !== null ? `${hitPct}%` : "—"}
        </span>
        <span className="text-[10px] text-neutral-400 tabular-nums">
          {timesHit}/{games}
        </span>
      </div>

      {/* Avg When Hit */}
      <div className="text-center">
        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
          {statData.avgWhenHit?.toFixed(1) ?? "—"}
        </span>
      </div>

      {/* Boost */}
      <div className="text-center">
        {boost !== null && Math.abs(boost) >= 0.2 ? (
          <span className={cn(
            "text-xs font-bold tabular-nums",
            boost > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
          )}>
            {boost > 0 ? "+" : ""}{boost.toFixed(1)}
          </span>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        )}
      </div>

      {/* Sample */}
      <div className="text-center">
        <span className={cn(
          "text-xs font-medium tabular-nums",
          games < 5 ? "text-amber-500" : "text-neutral-500"
        )}>
          {games}
        </span>
      </div>

      {/* Spark + Strength */}
      <div className="flex items-center justify-end gap-2">
        {sparkData.length > 0 && (
          <div className="flex items-end gap-px h-4">
            {sparkData.map((hit, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 rounded-[1px]",
                  hit ? "bg-emerald-500 h-full" : "bg-red-400 h-2.5"
                )}
              />
            ))}
          </div>
        )}
        {strength !== "low" && (
          <span className={cn("text-[9px] font-bold uppercase", config.color)}>
            {config.label}
          </span>
        )}
      </div>

      {SHOW_CORRELATION_ACTIONS && (
        <div className="flex items-center justify-center">
          <OddsDropdown
            eventId={eventId}
            market={marketKey}
            selKey={hitRateData.selKey || hitRateData.selectionId}
            line={effectiveLine}
            bestOdds={bestOdds}
            loading={oddsLoading}
          />
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function PlayerCorrelations({
  playerId,
  market,
  line,
  gameId,
  gameDate,
  homeTeamName,
  awayTeamName,
  startTime,
  anchorTeam,
  playerName,
  className,
}: PlayerCorrelationsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<TeammateMarket>("points");
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [showOnlyStrong, setShowOnlyStrong] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("hitRate");
  const [locationFilter, setLocationFilter] = useState<"all" | "home" | "away">("all");
  const [gameFilter, setGameFilter] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  
  // Filter popover state
  const [showFilters, setShowFilters] = useState(false);
  const [minHitRate, setMinHitRate] = useState<number>(0);
  const [selectedMarkets, setSelectedMarkets] = useState<Set<TeammateMarket>>(new Set(STAT_MARKETS.map(m => m.key)));
  const [togglingFavoriteKey, setTogglingFavoriteKey] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const { favoriteKeys, toggleFavorite, isLoggedIn } = useFavorites();
  const tableHeaderGridClass = SHOW_CORRELATION_ACTIONS
    ? "grid grid-cols-[180px_80px_100px_70px_70px_50px_70px_70px] items-center gap-2"
    : "grid grid-cols-[180px_80px_100px_70px_70px_50px_70px] items-center gap-2";
  
  // Close filter on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    };
    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilters]);
  
  // Toggle market selection
  const toggleMarket = (market: TeammateMarket) => {
    setSelectedMarkets(prev => {
      const next = new Set(prev);
      if (next.has(market)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(market);
      } else {
        next.add(market);
      }
      return next;
    });
  };
  
  // Select/deselect all markets
  const selectAllMarkets = () => {
    setSelectedMarkets(new Set(STAT_MARKETS.map(m => m.key)));
  };
  
  const hasActiveFilters = minHitRate > 0 || selectedMarkets.size < STAT_MARKETS.length;

  const { 
    anchorPerformance, 
    teammateCorrelations, 
    isLoading, 
    error 
  } = usePlayerCorrelations({
    playerId,
    market,
    line,
    // Only pass gameId if we have a valid line - the RPC with odds needs a line in the DB
    gameId: line !== null ? gameId : null,
    lastNGames: gameFilter,
    enabled: !!playerId && !!market && line !== null && line > 0,
  });
  const fallbackEventId = gameId != null ? String(gameId) : null;

  // Build selection IDs for odds fetching from all teammate market data
  const oddsSelections = useMemo(() => {
    const selections: { oddsSelectionId: string; line: number | null }[] = [];
    const seen = new Set<string>();
    
    for (const teammate of teammateCorrelations) {
      // Check all markets for selection IDs
      const markets = [
        teammate.points,
        teammate.rebounds,
        teammate.assists,
        teammate.threes,
        teammate.steals,
        teammate.blocks,
        teammate.turnovers,
        teammate.pra,
        teammate.pointsRebounds,
        teammate.pointsAssists,
        teammate.reboundsAssists,
        teammate.blocksSteals,
      ];
      
      for (const marketData of markets) {
        const hr = marketData?.hitRateWhenAnchorHits;
        const stableKey = getCorrelationOddsStableKey(hr);
        if (stableKey && !seen.has(stableKey)) {
          seen.add(stableKey);
          selections.push({
            oddsSelectionId: stableKey,
            line: hr?.lineUsed ?? null,
          });
        }
      }
    }
    
    return selections;
  }, [teammateCorrelations]);

  // Fetch live odds using the selection IDs
  const { getOdds, isLoading: oddsLoading } = useHitRateOdds({
    rows: oddsSelections,
    enabled: oddsSelections.length > 0,
  });

  const handleToggleFavorite = useCallback(async (
    payload: CorrelationFavoritePayload,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (!isLoggedIn) {
      toast.error("Sign in to save plays");
      return;
    }

    const { teammate, marketKey, hitRateData, effectiveLine, liveOdds } = payload;
    const eventId = hitRateData.eventId ?? (gameId ? String(gameId) : null);

    if (!eventId) {
      toast.error("No live event available for this correlation");
      return;
    }

    const lineValue = Number.isFinite(effectiveLine) ? Number(effectiveLine.toFixed(1)) : 0.5;
    const favoriteKey = createFavoriteKey({
      event_id: eventId,
      type: "player",
      player_id: String(teammate.playerId),
      market: marketKey,
      line: lineValue,
      side: "over",
    });

    setTogglingFavoriteKey(favoriteKey);

    try {
      const bestOver = liveOdds?.bestOver;
      const booksSnapshot: Record<string, BookSnapshot> | null = bestOver
        ? {
            [bestOver.book]: {
              price: bestOver.price,
              u: bestOver.url ?? null,
              m: bestOver.mobileUrl ?? null,
              sgp: bestOver.sgp ?? null,
            },
          }
        : null;

      const oddsSelectionId = hitRateData.selKey
        ? `${hitRateData.selKey}:${lineValue}:over`
        : hitRateData.selectionId ?? null;

      const result = await toggleFavorite({
        type: "player",
        sport: "nba",
        event_id: eventId,
        game_date: gameDate ?? null,
        home_team: homeTeamName ?? null,
        away_team: awayTeamName ?? null,
        start_time: startTime ?? null,
        player_id: String(teammate.playerId),
        player_name: teammate.playerName,
        player_team: anchorTeam ?? null,
        player_position: teammate.position,
        market: marketKey,
        line: lineValue,
        side: "over",
        odds_key: `odds:nba:${eventId}:${marketKey}`,
        odds_selection_id: oddsSelectionId,
        books_snapshot: booksSnapshot,
        best_price_at_save: bestOver?.price ?? null,
        best_book_at_save: bestOver?.book ?? null,
        source: "correlations",
      });

      if (result.action === "added") {
        toast.success("Added to My Plays");
      } else if (result.action === "removed") {
        toast.success("Removed from My Plays");
      }
    } catch (err: any) {
      if (err.message === "Already in favorites") {
        toast.info("Already in My Plays");
      } else if (err.message?.includes("logged in")) {
        toast.error("Sign in to save plays");
      } else {
        toast.error("Failed to update");
      }
    } finally {
      setTogglingFavoriteKey(null);
    }
  }, [anchorTeam, awayTeamName, gameDate, gameId, homeTeamName, isLoggedIn, startTime, toggleFavorite]);

  // Filter and sort teammates
  const sortedTeammates = useMemo(() => {
    let filtered = teammateCorrelations.map(t => ({
      ...t,
      gameLogs: locationFilter === "all" 
        ? t.gameLogs 
        : t.gameLogs.filter(g => g.homeAway === locationFilter)
    }));
    
    // Filter out teammates without valid line data
    filtered = filtered.filter(t => {
      if (selectedMarket === "all") {
        // In all view, at least one selected market must have valid line data
        return STAT_MARKETS.some(({ key }) => {
          if (!selectedMarkets.has(key)) return false;
          const stat = t[key as Exclude<TeammateMarket, "all">];
          const hitRate = stat?.hitRateWhenAnchorHits;
          return hitRate?.lineUsed != null && hitRate.lineUsed > 0 && (hitRate?.games ?? 0) >= 1;
        });
      } else {
        const stat = t[selectedMarket as Exclude<TeammateMarket, "all">];
        const hitRate = stat?.hitRateWhenAnchorHits;
        return hitRate?.lineUsed != null && hitRate.lineUsed > 0 && (hitRate?.games ?? 0) >= 1;
      }
    });
    
    // Filter by minimum hit rate (if set)
    if (minHitRate > 0) {
      filtered = filtered.filter(t => {
        if (selectedMarket === "all") {
          // In all view, check if ANY selected market meets threshold
          return STAT_MARKETS.some(({ key }) => {
            if (!selectedMarkets.has(key)) return false;
            const stat = t[key as Exclude<TeammateMarket, "all">];
            const pct = stat?.hitRateWhenAnchorHits?.pct;
            return pct != null && pct >= minHitRate;
          });
        } else {
          const stat = t[selectedMarket as Exclude<TeammateMarket, "all">];
          const pct = stat?.hitRateWhenAnchorHits?.pct;
          return pct != null && pct >= minHitRate;
        }
      });
    }
    
    // Sort
    return filtered.sort((a, b) => {
      if (selectedMarket === "all") {
        const aBest = getBestMarkets(a, locationFilter, 1)[0];
        const bBest = getBestMarkets(b, locationFilter, 1)[0];
        return (bBest?.pct ?? -1) - (aBest?.pct ?? -1);
      }
      
      const aStat = a[selectedMarket as Exclude<TeammateMarket, "all">];
      const bStat = b[selectedMarket as Exclude<TeammateMarket, "all">];
      
      switch (sortBy) {
        case "hitRate":
          return (bStat?.hitRateWhenAnchorHits?.pct ?? -1) - (aStat?.hitRateWhenAnchorHits?.pct ?? -1);
        case "boost":
          return (bStat?.diff ?? -999) - (aStat?.diff ?? -999);
        case "sample":
          return (bStat?.hitRateWhenAnchorHits?.games ?? 0) - (aStat?.hitRateWhenAnchorHits?.games ?? 0);
        default:
          return (bStat?.hitRateWhenAnchorHits?.pct ?? -1) - (aStat?.hitRateWhenAnchorHits?.pct ?? -1);
      }
    });
  }, [teammateCorrelations, selectedMarket, minHitRate, selectedMarkets, sortBy, locationFilter]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500 font-medium">Loading correlations...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !anchorPerformance || teammateCorrelations.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 p-6 shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <Users className="h-4 w-4" />
          <span className="text-sm font-medium">No correlation data available</span>
        </div>
      </div>
    );
  }

  const isAllView = selectedMarket === "all";
  const anchorLastName = playerName?.split(' ').slice(-1)[0] || "anchor";

  return (
    <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
      {/* ═══════════════════════════════════════════════════════════════════
          PREMIUM HEADER - Matches other sections with color bar
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-emerald-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-emerald-900/10" />
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          {/* Main Header Row */}
          <div className="flex items-start justify-between gap-6">
            {/* LEFT ZONE - Color bar + Context & Target Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Color bar - premium emerald gradient */}
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 shadow-sm shadow-emerald-500/30 shrink-0" />
              <div className="flex-1 min-w-0">
                {/* BIG Headline - Focal Point (now first) */}
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  When {playerName} hits{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">{line}+ {formatMarketLabel(market || "")}</span>
                </h2>
                
                {/* Subheading - Teammate Correlations (now second) */}
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                  Teammate Correlations
                  {anchorPerformance && (
                    <span className="ml-2">
                      · <span className={cn("font-bold", getHitRateColor(anchorPerformance.hitRate))}>
                        {anchorPerformance.hitRate ?? 0}%
                      </span> hit rate · {anchorPerformance.display}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* RIGHT ZONE - Collapse Button */}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
            >
              <ChevronDown className={cn(
                "h-4 w-4 text-neutral-500 transition-transform",
                !collapsed && "rotate-180"
              )} />
            </button>
          </div>
          
          {/* Game Filter Row - Below header when expanded */}
          {!collapsed && anchorPerformance && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-200/50 dark:border-neutral-700/50">
              <div className="flex items-center gap-2">
                {/* Game Filter Toggle */}
                <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
                {[
                  { value: null, label: "Season" },
                  { value: 20, label: "L20" },
                  { value: 10, label: "L10" },
                  { value: 5, label: "L5" },
                ].map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setGameFilter(value)}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all",
                      gameFilter === value
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              </div>
              
              {/* Home/Away Splits */}
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <Home className="w-3 h-3 text-neutral-400" />
                  <span className={cn("font-bold tabular-nums", getHitRateColor(anchorPerformance.splits.home.hitRate))}>
                    {anchorPerformance.splits.home.hitRate ?? "—"}%
                  </span>
                  <span className="text-neutral-400">{anchorPerformance.splits.home.display}</span>
                </div>
                <span className="text-neutral-300 dark:text-neutral-600">·</span>
                <div className="flex items-center gap-1">
                  <Plane className="w-3 h-3 text-neutral-400" />
                  <span className={cn("font-bold tabular-nums", getHitRateColor(anchorPerformance.splits.away.hitRate))}>
                    {anchorPerformance.splits.away.hitRate ?? "—"}%
                  </span>
                  <span className="text-neutral-400">{anchorPerformance.splits.away.display}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* ═══════════════════════════════════════════════════════════════════
              STAT SELECTOR NAV - Elevated Pill Design
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="px-5 py-2.5 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4">
            {/* Stat Pills - Show all markets with wrap */}
            <div className="flex items-center gap-1 flex-wrap bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 pl-1.5">
              {TEAMMATE_MARKETS.map(({ key, abbr }) => (
                <button
                  key={key}
                  onClick={() => setSelectedMarket(key)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all",
                    selectedMarket === key
                      ? key === "all"
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-500"
                        : "bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-lg ring-1 ring-neutral-200 dark:ring-neutral-500"
                      : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-white/60 dark:hover:bg-neutral-700/60"
                  )}
                >
                  {abbr}
                </button>
              ))}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Filter Button - Always show */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg transition-all border",
                    showFilters || hasActiveFilters
                      ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                      : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
                  )}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Filters
                  {hasActiveFilters && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  )}
                </button>
                  
                  {/* Filter Popover - Opens upward to avoid container overflow */}
                  {showFilters && (
                  <div className="absolute bottom-full right-0 mb-1.5 w-[300px] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
                    {/* Reset - Now at top since dropdown opens upward */}
                    {hasActiveFilters && (
                      <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                        <button
                          onClick={() => {
                            setMinHitRate(0);
                            selectAllMarkets();
                          }}
                          className="w-full py-2 text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          Reset Filters
                        </button>
                      </div>
                    )}
                    
                    {/* Markets Selection */}
                    <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                          Markets to Show
                        </span>
                        <button
                          onClick={selectAllMarkets}
                          className="text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          Select All
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {STAT_MARKETS.map(({ key, abbr }) => (
                          <button
                            key={key}
                            onClick={() => toggleMarket(key)}
                            className={cn(
                              "flex items-center justify-center gap-1 py-2 text-[10px] font-semibold rounded-lg transition-all",
                              selectedMarkets.has(key)
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-1 ring-purple-200 dark:ring-purple-800"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            )}
                          >
                            {selectedMarkets.has(key) && <Check className="w-2.5 h-2.5" />}
                            {abbr}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Min Hit Rate */}
                    <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                        Minimum Hit Rate
                      </div>
                      <div className="flex items-center gap-1">
                        {[0, 50, 60, 70, 80].map((val) => (
                          <button
                            key={val}
                            onClick={() => setMinHitRate(val)}
                            className={cn(
                              "flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all",
                              minHitRate === val
                                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            )}
                          >
                            {val === 0 ? "All" : `${val}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Header - Now at bottom */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50/50 dark:bg-neutral-800/30">
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Filter Options</span>
                      <button 
                        onClick={() => setShowFilters(false)}
                        className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-neutral-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* View Toggle - only show when not in "all" mode */}
              {selectedMarket !== "all" && (
                <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode("card")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all",
                      viewMode === "card"
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <LayoutGrid className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all",
                      viewMode === "table"
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <List className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Legend - Compact */}
              <div className="hidden lg:flex items-center gap-2 text-[9px] text-neutral-400">
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Hot</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Warm</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Cold</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hairline divider below tabs */}
          <div className="h-px bg-gradient-to-r from-transparent via-neutral-200 dark:via-neutral-700 to-transparent" />

          {/* Content */}
          <div className="max-h-[450px] overflow-y-auto">
            {sortedTeammates.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-neutral-400">
                No correlations match your filters
              </div>
            ) : isAllView ? (
              // ═══ ALL STATS GRID VIEW ═══
              (() => {
                const marketsToShow = STAT_MARKETS.filter(m => selectedMarkets.has(m.key));
                return (
                  <div>
                    {/* Grid Header */}
                    <div className="grid grid-cols-[160px_1fr] border-b border-neutral-300 dark:border-neutral-600 bg-neutral-200 dark:bg-neutral-800 sticky top-0 z-10">
                      <div className="px-4 py-2.5 border-r border-neutral-300 dark:border-neutral-600">
                        <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">Player</span>
                      </div>
                      <div 
                        className="grid gap-1 px-3 py-2.5"
                        style={{ gridTemplateColumns: `repeat(${marketsToShow.length}, 1fr)` }}
                      >
                        {marketsToShow.map(({ abbr }) => (
                          <div key={abbr} className="text-center">
                            <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase">{abbr}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {sortedTeammates.map((teammate, idx) => (
                      <AllStatsGridRow
                        key={teammate.playerId}
                        teammate={teammate}
                        anchorPlayerName={playerName}
                        locationFilter={locationFilter}
                        isEven={idx % 2 === 0}
                        minHitRate={minHitRate}
                        selectedMarkets={selectedMarkets}
                      />
                    ))}
                  </div>
                );
              })()
            ) : viewMode === "card" ? (
              // ═══ SINGLE STAT CARD VIEW ═══
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedTeammates.map((teammate) => (
                  <TeammateCard
                    key={teammate.playerId}
                    teammate={teammate}
                    selectedMarket={selectedMarket as Exclude<TeammateMarket, "all">}
                    anchorPlayerName={playerName}
                    locationFilter={locationFilter}
                    isExpanded={expandedCard === teammate.playerId}
                    onToggle={() => setExpandedCard(
                      expandedCard === teammate.playerId ? null : teammate.playerId
                    )}
                    getOdds={getOdds}
                    favoriteKeys={favoriteKeys}
                    togglingFavoriteKey={togglingFavoriteKey}
                    onToggleFavorite={handleToggleFavorite}
                    oddsLoading={oddsLoading}
                    fallbackEventId={fallbackEventId}
                  />
                ))}
              </div>
            ) : (
              // ═══ SINGLE STAT TABLE VIEW ═══
              <div>
                {/* Table Header */}
                <div className={cn(tableHeaderGridClass, "px-3 py-2 bg-neutral-200 dark:bg-neutral-800 border-b border-neutral-300 dark:border-neutral-600 sticky top-0 z-10")}>
                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase">Player</span>
                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase text-center">Line</span>
                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase text-center">Hit Rate</span>
                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase text-center">Avg</span>
                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase text-center">Boost</span>
                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase text-center">N</span>
                  <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase text-center">Trend</span>
                  {SHOW_CORRELATION_ACTIONS && (
                    <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase text-center">Odds</span>
                  )}
                </div>
                
                {sortedTeammates.map((teammate, idx) => (
                  <StatTableRow
                    key={teammate.playerId}
                    teammate={teammate}
                    selectedMarket={selectedMarket as Exclude<TeammateMarket, "all">}
                    anchorPlayerName={playerName}
                    locationFilter={locationFilter}
                    isEven={idx % 2 === 0}
                    getOdds={getOdds}
                    favoriteKeys={favoriteKeys}
                    togglingFavoriteKey={togglingFavoriteKey}
                    onToggleFavorite={handleToggleFavorite}
                    oddsLoading={oddsLoading}
                    fallbackEventId={fallbackEventId}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
