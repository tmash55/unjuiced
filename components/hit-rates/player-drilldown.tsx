"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, HeartPulse, X, Pencil } from "lucide-react";
import { PlayerHeadshot } from "@/components/player-headshot";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import { AlternateLinesMatrix } from "./alternate-lines-matrix";
import { PositionVsTeam } from "./position-vs-team";
import { GameLogChart } from "./game-log-chart";
import { TeamRoster } from "./team-roster";
import { BoxScoreTable } from "./box-score-table";
import { ChartFilters, ChartFiltersState, DEFAULT_FILTERS, applyChartFilters } from "./chart-filters";
import { InjuryReport, InjuryFilter } from "./injury-report";
import { usePlayerBoxScores } from "@/hooks/use-player-box-scores";
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

type GameCountFilter = 5 | 10 | 20 | "season";

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

export function PlayerDrilldown({ profile: initialProfile, allPlayerProfiles = [], onBack, onMarketChange }: PlayerDrilldownProps) {
  const [selectedMarket, setSelectedMarketInternal] = useState<string>(initialProfile.market);
  
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
  
  // Quick filters (can be combined)
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());

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
    
    const result = [...marketMap.values()].sort((a, b) => {
      const aIndex = MARKET_ORDER.indexOf(a.market);
      const bIndex = MARKET_ORDER.indexOf(b.market);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    // Debug: check for duplicates
    const markets = result.map(r => r.market);
    const uniqueMarkets = [...new Set(markets)];
    if (markets.length !== uniqueMarkets.length) {
      console.warn('[Drilldown] Duplicate markets after dedupe:', markets);
    }
    
    return result;
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
  const teammatesOutByGame = useMemo(() => {
    const map = new Map<string, Set<number>>();
    const gameLogs = profile.gameLogs as Array<{ game_id?: string; teammates_out?: Array<{ player_id: number }> }> | null;
    
    if (!gameLogs) return map;
    
    for (const log of gameLogs) {
      if (log.game_id && log.teammates_out) {
        const normalizedId = log.game_id.replace(/^0+/, ""); // Remove leading zeros
        const playerIds = new Set(log.teammates_out.map(t => t.player_id));
        map.set(normalizedId, playerIds);
      }
    }
    return map;
  }, [profile.gameLogs]);

  // Filter games based on quick filters, chart filters, injury filters, THEN limit by game count
  // This way "L5 + Win" shows the last 5 wins, not wins from the last 5 games
  const filteredGames = useMemo(() => {
    if (boxScoreGames.length === 0) return [];
    
    let games = [...boxScoreGames];
    
    // First, apply quick filters
    if (quickFilters.size > 0) {
      games = games.filter(game => {
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
    }
    
    // Then apply chart filters
    games = applyChartFilters(games, chartFilters);
    
    // Apply injury filters (with/without specific players)
    if (injuryFilters.length > 0) {
      games = games.filter(game => {
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
    }
    
    // Finally, limit by game count
    if (gameCount !== "season") {
      games = games.slice(0, gameCount);
    }
    
    return games;
  }, [boxScoreGames, gameCount, quickFilters, chartFilters, injuryFilters, teammatesOutByGame]);

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

  // Calculate hit rates for ALL markets based on current game count filter
  // This allows the market selector to show dynamic hit rates
  const marketHitRates = useMemo(() => {
    if (boxScoreGames.length === 0) return new Map<string, number | null>();
    
    const rates = new Map<string, number | null>();
    const gamesToUse = gameCount === "season" ? boxScoreGames : boxScoreGames.slice(0, gameCount);
    
    for (const marketProfile of allPlayerProfiles) {
      const line = marketProfile.line;
      if (line === null || gamesToUse.length === 0) {
        rates.set(marketProfile.market, null);
        continue;
      }
      
      const stats = gamesToUse.map(g => getMarketStat(g, marketProfile.market));
      const hits = stats.filter(s => s >= line).length;
      const hitRate = (hits / stats.length) * 100;
      rates.set(marketProfile.market, Math.round(hitRate));
    }
    
    return rates;
  }, [boxScoreGames, gameCount, allPlayerProfiles]);

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
    <div className="h-full overflow-auto pr-3 drilldown-scroll">
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
                   profile.injuryStatus.toLowerCase() !== "active" && (
                    <Tooltip 
                      content={
                        <div className="min-w-[160px] p-1">
                          <div className="flex items-center gap-2 mb-1">
                            <HeartPulse className={cn("h-4 w-4", getInjuryIconColor(profile.injuryStatus))} />
                            <span className={cn(
                              "text-sm font-bold uppercase tracking-wide",
                              getInjuryIconColor(profile.injuryStatus)
                            )}>
                              {profile.injuryStatus}
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
                      <HeartPulse className={cn(
                        "h-5 w-5 cursor-help",
                        getInjuryIconColor(profile.injuryStatus)
                      )} />
                    </Tooltip>
                  )}
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
                RIGHT SECTION - Stat Cluster
                ════════════════════════════════════════════════════════════════ */}
            <div className="flex items-center gap-4 p-4 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80">
              {/* Hit Rates Grid - Clickable to change chart view */}
              <div className="grid grid-cols-2 gap-1.5">
            {[
                  { label: "L5", value: profile.last5Pct, count: 5 as const },
                  { label: "L10", value: profile.last10Pct, count: 10 as const },
                  { label: "L20", value: profile.last20Pct, count: 20 as const },
                  { label: "SZN", value: profile.seasonPct, count: "season" as const },
                ].map((stat) => {
                  const isSelected = gameCount === stat.count;
                  return (
                    <button
                      type="button"
                key={stat.label}
                      onClick={() => setGameCount(stat.count)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
                        "border cursor-pointer",
                        isSelected 
                          ? "bg-brand/10 dark:bg-brand/20 border-brand ring-1 ring-brand/30" 
                          : "bg-white dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                      )}
              >
                      <span className={cn(
                        "text-[10px] font-semibold uppercase w-6",
                        isSelected ? "text-brand" : "text-neutral-400"
                      )}>
                  {stat.label}
                </span>
                      <span className={cn("text-sm font-bold tabular-nums", getPctColor(stat.value))}>
                  {stat.value !== null ? `${stat.value.toFixed(0)}%` : "—"}
                </span>
                    </button>
                  );
                })}
              </div>

              {/* Current Prop - Hero Element (Editable) */}
              <div className="relative">
                <Tooltip 
                  content={
                    <div className="text-center p-1">
                      <div className="font-semibold text-neutral-100">Click to edit line</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        Or drag the chart line to adjust
                      </div>
          </div>
                  } 
                  side="left"
                >
          <div 
                    className={cn(
                      "flex flex-col items-center justify-center px-5 py-3 rounded-xl shadow-md min-w-[100px] transition-all cursor-pointer",
                      customLine !== null 
                        ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900" 
                        : "hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-white dark:hover:ring-offset-neutral-900"
                    )}
            style={{ 
                      background: `linear-gradient(135deg, ${profile.primaryColor || '#6366f1'} 0%, ${profile.secondaryColor || profile.primaryColor || '#4f46e5'} 100%)`,
                    }}
                    onClick={() => {
                      if (!isEditingLine) {
                        setEditValue(String(activeLine ?? profile.line ?? ""));
                        setIsEditingLine(true);
                      }
                    }}
                  >
                    {isEditingLine ? (
                      // Editing mode - show input
                      <div className="flex flex-col items-center">
                        <input
                          type="number"
                          step="0.5"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => {
                            const parsed = parseFloat(editValue);
                            if (!isNaN(parsed) && parsed >= 0) {
                              setCustomLine(parsed);
                            }
                            setIsEditingLine(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const parsed = parseFloat(editValue);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setCustomLine(parsed);
                              }
                              setIsEditingLine(false);
                            } else if (e.key === "Escape") {
                              setIsEditingLine(false);
                            }
                          }}
                          autoFocus
                          className="w-16 text-2xl font-black text-center bg-white/20 text-white rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-white/50 placeholder-white/50"
                          placeholder="0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider mt-1">
                          {formatMarketLabel(profile.market)}
                        </span>
                      </div>
                    ) : (
                      // Display mode
                      <>
                        <div className="flex items-center gap-1">
                          <Pencil className="h-3 w-3 text-white/50" />
                          <span className="text-2xl font-black text-white tracking-tight leading-none">
                            {activeLine}+
            </span>
                        </div>
                        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider mt-1">
              {formatMarketLabel(profile.market)}
            </span>
                      </>
                    )}
                  </div>
                </Tooltip>
                {/* Reset button when custom line is set */}
                {customLine !== null && !isEditingLine && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomLine(null);
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full shadow-lg transition-colors"
                    title={`Reset to ${profile.line}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MARKET SELECTOR STRIP
          ═══════════════════════════════════════════════════════════════════ */}
      {sortedMarkets.length > 1 && (
        <div className="mb-4 -mx-3 px-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700">
            {sortedMarkets.map((marketProfile, idx) => {
              const isActive = marketProfile.market === selectedMarket;
              // Use dynamic hit rate based on game count filter, fallback to stored value if loading
              const dynamicHitRate = marketHitRates.get(marketProfile.market);
              const hitRate = dynamicHitRate ?? marketProfile.last10Pct;
              
              return (
                <button
                  key={`${marketProfile.market}-${idx}`}
                  type="button"
                  onClick={() => setSelectedMarket(marketProfile.market)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shrink-0",
                    isActive
                      ? "bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 shadow-sm"
                      : "bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  {/* Line + Market */}
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      isActive ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400"
                    )}>
                      {marketProfile.line}+
                    </span>
                    <span className={cn(
                      "text-xs font-medium uppercase",
                      isActive ? "text-neutral-700 dark:text-neutral-300" : "text-neutral-500 dark:text-neutral-500"
                    )}>
                      {formatMarketLabel(marketProfile.market)}
                    </span>
                  </div>
                  
                  {/* Hit Rate Badge - Dynamic based on game count */}
                  {hitRate !== null && (
                    <span className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded tabular-nums transition-colors",
                      hitRate >= 70
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : hitRate >= 50
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                    )}>
                      {hitRate}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - BAR CHART
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 p-6">
        {/* Chart Header with filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Game Log
            </h2>
            {/* Game Count Filter */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
              {([5, 10, 20, "season"] as GameCountFilter[]).map((count) => {
                const numericCount = count === "season" ? totalGamesAvailable : count;
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
                      "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                      gameCount === count
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                        : isDisabled
                          ? "text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    {displayCount}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Chart Stats */}
          <div className="flex items-center gap-4">
            {/* Chart Average */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-neutral-400 dark:text-neutral-500">Chart Avg:</span>
              <span className={cn(
                "font-bold",
                chartStats.avg !== null && activeLine !== null
                  ? chartStats.avg > activeLine
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-neutral-900 dark:text-white"
                  : "text-neutral-900 dark:text-white"
              )}>
                {chartStats.avg?.toFixed(1) ?? "—"}
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700" />

            {/* Chart Hit Rate with hits count */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-neutral-400 dark:text-neutral-500">Hit Rate:</span>
              <span className={cn(
                "font-bold",
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
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                ({chartStats.hits}/{chartStats.total})
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700" />

            {/* Season Avg */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-neutral-400 dark:text-neutral-500">Szn Avg:</span>
              <span className="font-bold text-neutral-600 dark:text-neutral-300">
              {profile.seasonAvg?.toFixed(1) ?? "—"}
            </span>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        {boxScoresLoading ? (
          <div className="flex items-center justify-center h-64 text-neutral-400">
            <div className="animate-pulse">Loading game data...</div>
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

      {/* ═══════════════════════════════════════════════════════════════════
          CHART FILTERS - Scrollable mini charts
          ═══════════════════════════════════════════════════════════════════ */}
      {!boxScoresLoading && boxScoreGames.length > 0 && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 p-6">
          <ChartFilters
            games={gameCount === "season" ? boxScoreGames : boxScoreGames.slice(0, gameCount)}
            filters={chartFilters}
            onFiltersChange={setChartFilters}
          market={profile.market}
        />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          POSITION VS TEAM
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <PositionVsTeam
          position={profile.position}
          opponentTeamId={profile.opponentTeamId}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          market={profile.market}
          currentLine={profile.line}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          INJURY REPORT (Current Game Injuries)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <InjuryReport
          playerTeamId={profile.teamId}
          opponentTeamId={profile.opponentTeamId}
          currentPlayerId={profile.playerId}
          filters={injuryFilters}
          onFiltersChange={setInjuryFilters}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TEAM ROSTERS (Depth Chart)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <TeamRoster
          playerTeamId={profile.teamId}
          opponentTeamId={profile.opponentTeamId}
          currentPlayerId={profile.playerId}
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
          currentLine={profile.line}
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
