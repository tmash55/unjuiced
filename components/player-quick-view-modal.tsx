"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { usePlayerLookup } from "@/hooks/use-player-lookup";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import { usePlayerBoxScores, BoxScoreGame } from "@/hooks/use-player-box-scores";
import { GameLogChart } from "@/components/hit-rates/game-log-chart";
import { BoxScoreTable } from "@/components/hit-rates/box-score-table";
import { PositionVsTeam } from "@/components/hit-rates/position-vs-team";
import { DefensiveAnalysis } from "@/components/hit-rates/defensive-analysis";
import { PlayTypeAnalysis } from "@/components/hit-rates/play-type-analysis";
import { ShootingZones } from "@/components/hit-rates/shooting-zones";
import { PlayerCorrelations } from "@/components/hit-rates/player-correlations";
import { LoadingState } from "@/components/common/loading-state";
import { ExternalLink, X, AlertCircle, Pencil, Check, ChevronDown, RotateCcw, BarChart3, Users, Target, Zap, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import Link from "next/link";

// Tab type for modal navigation
type ModalTab = "gamelog" | "matchup" | "playstyle" | "correlation";

interface OddsData {
  over?: {
    price: number;
    line: number;
    book?: string;
    mobileLink?: string | null;
  };
  under?: {
    price: number;
    line: number;
    book?: string;
    mobileLink?: string | null;
  };
}

interface AlternateLineOdds {
  ln: number;
  over?: { price: number; book?: string; mobileLink?: string | null };
  under?: { price: number; book?: string; mobileLink?: string | null };
}

interface PlayerQuickViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  odds_player_id?: string;
  player_name?: string;
  /** Direct NBA player ID - when provided, skips the lookup API call */
  nba_player_id?: number;
  initial_market?: string;
  /** Pre-select this line when opening (e.g., from edge finder alternate lines) */
  initial_line?: number;
  onMarketChange?: (market: string) => void;
  /** Pass odds directly from the odds screen for real-time updates */
  odds?: OddsData;
  /** Event ID for fetching alternate lines */
  event_id?: string;
}

// Color helpers matching drilldown
const getPctColor = (value: number | null) => {
  if (value === null) return "text-neutral-500";
  if (value >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
};

const getPctBgColor = (value: number | null) => {
  if (value === null) return "bg-neutral-50 dark:bg-neutral-800";
  if (value >= 70) return "bg-emerald-50 dark:bg-emerald-900/20";
  if (value >= 50) return "bg-amber-50 dark:bg-amber-900/20";
  return "bg-red-50 dark:bg-red-900/20";
};

// Get market stat from box score
const getMarketStat = (game: BoxScoreGame, market: string): number => {
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

// Fallback markets - ordered by popularity
const FALLBACK_MARKETS = [
  "player_points", 
  "player_rebounds", 
  "player_assists", 
  "player_threes_made",
  "player_points_rebounds_assists", 
  "player_points_rebounds", 
  "player_points_assists",
  "player_rebounds_assists", 
  "player_steals", 
  "player_blocks", 
  "player_blocks_steals", 
  "player_turnovers",
];

type GameCountFilter = 5 | 10 | 20 | "season" | "h2h";

export function PlayerQuickViewModal({
  open,
  onOpenChange,
  odds_player_id,
  player_name,
  nba_player_id: directNbaPlayerId,
  initial_market,
  initial_line,
  onMarketChange,
  odds,
  event_id,
}: PlayerQuickViewModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Check if user has Hit Rate access for advanced tabs (hit_rate or pro plan)
  const { user } = useAuth();
  const { hasAccess: hasAdvancedAccess } = useHasHitRateAccess();
  const isAuthenticated = !!user;

  // Data fetching - skip lookup if nba_player_id is provided directly
  const needsLookup = !directNbaPlayerId && !!(odds_player_id || player_name);
  const { data: lookupData, isLoading: isLoadingLookup } = usePlayerLookup({
    odds_player_id,
    player_name,
    enabled: open && needsLookup,
  });

  // Use direct ID if provided, otherwise use looked up ID
  const nba_player_id = directNbaPlayerId || lookupData?.player?.nba_player_id;
  const playerInfo = lookupData?.player;

  // Fetch profiles and box scores in PARALLEL (not sequential)
  // Only fetch when we have a player ID
  const { rows: profiles, isLoading: isLoadingProfiles } = useHitRateTable({
    playerId: nba_player_id,
    enabled: open && !!nba_player_id,
    limit: 20, // Reduced from 50 - we only need current markets
  });

  // Limit box scores to last 25 games for faster loading
  const { games: boxScoreGames, seasonSummary, isLoading: isLoadingBoxScores } = usePlayerBoxScores({
    playerId: nba_player_id || null,
    enabled: open && !!nba_player_id,
    limit: 25, // Only fetch last 25 games for modal (full drilldown can load more)
  });

  // Profile & market selection
  const hasUpcomingProfile = profiles.length > 0;
  
  // Sort markets by preferred order
  const availableMarkets = useMemo(() => {
    const profileMarkets = hasUpcomingProfile ? profiles.map(p => p.market) : FALLBACK_MARKETS;
    // Sort by FALLBACK_MARKETS order (preferred display order)
    return [...profileMarkets].sort((a, b) => {
      const indexA = FALLBACK_MARKETS.indexOf(a);
      const indexB = FALLBACK_MARKETS.indexOf(b);
      // If not in FALLBACK_MARKETS, put at end
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [hasUpcomingProfile, profiles]);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(initial_market || null);
  
  // Only sync initial_market on mount or when it changes from parent
  // If the initial_market isn't available (e.g., double doubles), fall back to player_points
  useEffect(() => {
    if (initial_market && availableMarkets.length > 0) {
      if (availableMarkets.includes(initial_market)) {
        setSelectedMarket(initial_market);
      } else {
        // Fallback to player_points if initial market isn't available
        const fallbackMarket = availableMarkets.includes("player_points") 
          ? "player_points" 
          : availableMarkets[0];
        setSelectedMarket(fallbackMarket);
      }
    }
  }, [initial_market, availableMarkets]);
  
  // Set default market if none selected
  useEffect(() => {
    if (!selectedMarket && availableMarkets.length > 0) {
      setSelectedMarket(availableMarkets[0]);
    }
  }, [selectedMarket, availableMarkets]);

  const currentMarket = selectedMarket || availableMarkets[0] || "player_points";

  // Fetch alternate lines using React Query for caching
  const playerKey = player_name?.toLowerCase().replace(/ /g, "_") || "";
  const { data: alternatesData } = useQuery({
    queryKey: ["modal-alternates", event_id, playerKey, currentMarket],
    queryFn: async () => {
      if (!event_id || !playerKey) return [];
      
      const params = new URLSearchParams({
        sport: "nba",
        eventId: event_id,
        market: currentMarket,
        player: playerKey,
      });
      
      const response = await fetch(`/api/v2/props/alternates?${params.toString()}`);
      if (!response.ok) return [];
      
      const result = await response.json();
      const allLines = result.lines || result.all_lines || [];
      
      // Transform to simpler structure for odds lookup
      return allLines.map((line: any) => {
        let bestOver: AlternateLineOdds["over"] = undefined;
        let bestUnder: AlternateLineOdds["under"] = undefined;
        
        Object.entries(line.books || {}).forEach(([bookId, bookData]: [string, any]) => {
          if (bookData.over && (!bestOver || bookData.over.price > bestOver.price)) {
            bestOver = {
              price: bookData.over.price,
              book: bookId,
              mobileLink: bookData.over.m || bookData.over.u || null,
            };
          }
          if (bookData.under && (!bestUnder || bookData.under.price > bestUnder.price)) {
            bestUnder = {
              price: bookData.under.price,
              book: bookId,
              mobileLink: bookData.under.m || bookData.under.u || null,
            };
          }
        });
        
        return { ln: line.ln, over: bestOver, under: bestUnder };
      }) as AlternateLineOdds[];
    },
    enabled: open && !!event_id && !!playerKey,
    staleTime: 30_000, // 30 seconds - odds can change
    gcTime: 5 * 60_000, // 5 minutes
  });
  const alternateLines = alternatesData || [];

  const profile = profiles.find((p) => p.market === currentMarket) || profiles[0];

  // Line state - initialize with initial_line if provided (e.g., from edge finder)
  const [customLine, setCustomLine] = useState<number | null>(initial_line ?? null);
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [editValue, setEditValue] = useState("");
  
  // Market dropdown state
  const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState(false);
  const marketDropdownRef = useRef<HTMLDivElement>(null);

  // Close market dropdown when clicking outside
  useEffect(() => {
    if (!isMarketDropdownOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(e.target as Node)) {
        setIsMarketDropdownOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMarketDropdownOpen]);

  // Update customLine when initial_line changes (e.g., clicking different player in edge finder)
  useEffect(() => {
    if (initial_line !== undefined && initial_line !== null) {
      setCustomLine(initial_line);
    }
  }, [initial_line]);
  
  const defaultLine = useMemo(() => {
    // Priority: profile line -> odds line -> calculated from box scores
    if (profile?.line) return profile.line;
    if (odds?.over?.line) return odds.over.line;
    if (odds?.under?.line) return odds.under.line;
    if (boxScoreGames.length === 0) return 10;
    const recentGames = boxScoreGames.slice(0, 10);
    const avg = recentGames.reduce((sum, g) => sum + getMarketStat(g, currentMarket), 0) / recentGames.length;
    return Math.round(avg * 2) / 2;
  }, [profile, odds, boxScoreGames, currentMarket]);

  const activeLine = customLine ?? defaultLine;

  // Compute odds for the current line (from alternates or original odds)
  // Always look up in alternates first since market may have changed
  const activeOdds = useMemo(() => {
    const targetLine = customLine ?? defaultLine;
    
    // First, try to find exact match in alternates for current market
    const exactMatch = alternateLines.find(alt => alt.ln === targetLine);
    if (exactMatch) {
      return {
        over: exactMatch.over ? {
          price: exactMatch.over.price,
          line: exactMatch.ln,
          book: exactMatch.over.book,
          mobileLink: exactMatch.over.mobileLink,
        } : undefined,
        under: exactMatch.under ? {
          price: exactMatch.under.price,
          line: exactMatch.ln,
          book: exactMatch.under.book,
          mobileLink: exactMatch.under.mobileLink,
        } : undefined,
      };
    }
    
    // Look for closest line if no exact match
    if (alternateLines.length > 0) {
      const sortedByDistance = [...alternateLines].sort((a, b) => 
        Math.abs(a.ln - targetLine) - Math.abs(b.ln - targetLine)
      );
      const closest = sortedByDistance[0];
      // Only use closest if within 1.5 points
      if (closest && Math.abs(closest.ln - targetLine) <= 1.5) {
        return {
          over: closest.over ? {
            price: closest.over.price,
            line: closest.ln,
            book: closest.over.book,
            mobileLink: closest.over.mobileLink,
          } : undefined,
          under: closest.under ? {
            price: closest.under.price,
            line: closest.ln,
            book: closest.under.book,
            mobileLink: closest.under.mobileLink,
          } : undefined,
        };
      }
    }
    
    // Fall back to original odds ONLY if we haven't changed markets
    // (i.e., customLine is null and odds line matches defaultLine)
    if (customLine === null && odds) {
      const oddsLine = odds.over?.line ?? odds.under?.line;
      if (oddsLine === defaultLine) {
        return odds;
      }
    }
    
    // No odds available for this market/line
    return null;
  }, [customLine, defaultLine, odds, alternateLines]);

  // Transform activeOdds into GameLogChart format
  const oddsForChart = useMemo(() => {
    if (!activeOdds) return null;

    return {
      bestOver: activeOdds.over ? {
        book: activeOdds.over.book || 'unknown',
        price: activeOdds.over.price,
        url: activeOdds.over.mobileLink || null,
        mobileUrl: activeOdds.over.mobileLink || null,
      } : null,
      bestUnder: activeOdds.under ? {
        book: activeOdds.under.book || 'unknown',
        price: activeOdds.under.price,
        url: activeOdds.under.mobileLink || null,
        mobileUrl: activeOdds.under.mobileLink || null,
      } : null,
      oddsLine: activeOdds.over?.line || activeOdds.under?.line || activeLine,
      isClosestLine: false,
    };
  }, [activeOdds, activeLine]);

  // Game count filter
  const [gameCount, setGameCount] = useState<GameCountFilter>(10);
  
  // Active tab for modal navigation
  const [activeTab, setActiveTab] = useState<ModalTab>("gamelog");

  // Get profile data for advanced tabs
  const profilePlayerId = profile?.playerId || nba_player_id;
  const profilePosition = profile?.position || "";
  const profileOpponentTeamId = profile?.opponentTeamId || null;
  const profileOpponentTeamAbbr = profile?.opponentTeamAbbr || "";
  const profilePlayerName = profile?.playerName || player_name || "";

  useEffect(() => {
    setCustomLine(null);
    setIsEditingLine(false);
    setGameCount(10);
  }, [selectedMarket]);

  // Sort games by date descending
  const sortedGames = useMemo(() => {
    return [...boxScoreGames].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [boxScoreGames]);

  // Filtered games based on count
  const filteredGames = useMemo(() => {
    if (gameCount === "season") return sortedGames;
    if (gameCount === "h2h") {
      if (profile?.opponentTeamAbbr) {
        return sortedGames.filter(g => g.opponentAbbr === profile.opponentTeamAbbr);
      }
      return []; // No H2H data without opponent
    }
    return sortedGames.slice(0, gameCount as number);
  }, [sortedGames, gameCount, profile?.opponentTeamAbbr]);

  // Calculate hit rates
  const dynamicHitRates = useMemo(() => {
    if (sortedGames.length === 0) return { l5: null, l10: null, l20: null, season: null, h2h: null };

    const calculateHitRate = (games: BoxScoreGame[]) => {
      if (games.length === 0) return null;
      const stats = games.map(g => getMarketStat(g, currentMarket));
      const hits = stats.filter(s => s >= activeLine).length;
      return Math.round((hits / stats.length) * 100);
    };

    // H2H games against current opponent
    const h2hGames = profile?.opponentTeamAbbr 
      ? sortedGames.filter(g => g.opponentAbbr === profile.opponentTeamAbbr)
      : [];

    return {
      l5: calculateHitRate(sortedGames.slice(0, 5)),
      l10: calculateHitRate(sortedGames.slice(0, 10)),
      l20: calculateHitRate(sortedGames.slice(0, 20)),
      season: calculateHitRate(sortedGames),
      h2h: calculateHitRate(h2hGames),
    };
  }, [sortedGames, activeLine, currentMarket, profile?.opponentTeamAbbr]);

  // Chart stats
  const chartStats = useMemo(() => {
    if (filteredGames.length === 0) return { avg: null, hitRate: null, hits: 0, total: 0 };
    const stats = filteredGames.map(g => getMarketStat(g, currentMarket));
    const avg = stats.reduce((a, b) => a + b, 0) / stats.length;
    const hits = stats.filter(s => s >= activeLine).length;
    return {
      avg: Math.round(avg * 10) / 10,
      hitRate: Math.round((hits / stats.length) * 100),
      hits,
      total: stats.length,
    };
  }, [filteredGames, currentMarket, activeLine]);

  // Only wait for lookup if we don't have a direct ID
  const isLoading = (needsLookup && isLoadingLookup) || isLoadingProfiles || isLoadingBoxScores;
  // hasData is true if:
  // - We have a direct nba_player_id with profile or box scores, OR
  // - We looked up and found the player with profile or box scores
  const hasData = (directNbaPlayerId || lookupData?.found) && (hasUpcomingProfile || boxScoreGames.length > 0);

  // Display info - prefer profile data, then lookup data, then passed props
  const displayName = profile?.playerName || playerInfo?.name || player_name || "Unknown Player";
  const displayTeam = profile?.teamAbbr || playerInfo?.team_abbr || "";
  const displayPosition = profile?.position || playerInfo?.depth_chart_pos || playerInfo?.position || "";
  const displayJersey = profile?.jerseyNumber || playerInfo?.jersey_number;

  const handleLineEdit = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val)) setCustomLine(val);
    setIsEditingLine(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-hidden border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-950 dark:to-neutral-900 p-0 shadow-2xl rounded-2xl ring-1 ring-black/5 dark:ring-white/5">
        {isLoading ? (
          <div className="py-20 px-6">
            <DialogTitle className="sr-only">Loading Player Profile</DialogTitle>
            <LoadingState message="Loading player profile..." />
          </div>
        ) : !hasData ? (
          <div className="py-20 px-6 text-center">
            <DialogTitle className="text-lg font-semibold mb-2">Player Not Found</DialogTitle>
            <p className="text-muted-foreground">Unable to load data for this player.</p>
          </div>
        ) : (
          <div className="flex flex-col max-h-[92vh] overflow-hidden w-full">
            {/* ═══════════════════════════════════════════════════════════════════
                STICKY HEADER - Premium Design
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-white to-white/95 dark:from-neutral-950 dark:to-neutral-950/95 backdrop-blur-xl border-b border-neutral-200/80 dark:border-neutral-800/80">
              {/* Top Section - Player Info + Season Stats */}
              <div 
                className="relative overflow-hidden"
                style={{ 
                  background: profile?.primaryColor 
                    ? `linear-gradient(135deg, ${profile.primaryColor}20 0%, ${profile.primaryColor}05 40%, transparent 70%)`
                    : undefined
                }}
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-white/50 dark:via-neutral-950/30 dark:to-neutral-950/50" />
                
                {/* Close button */}
                <button
                  onClick={() => onOpenChange(false)}
                  className="absolute top-3 right-3 p-2 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-white/80 dark:hover:text-white dark:hover:bg-neutral-800/80 transition-all hover:scale-105 active:scale-95 z-10 backdrop-blur-sm"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="relative px-4 sm:px-6 pt-5 pb-4">
                  <div className="flex items-start gap-4">
                    {/* Left: Headshot + Basic Info */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div 
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden shadow-xl shrink-0 ring-2 ring-white dark:ring-neutral-700 transition-transform hover:scale-105"
                        style={{ 
                          background: profile?.primaryColor && profile?.secondaryColor 
                            ? `linear-gradient(180deg, ${profile.primaryColor} 0%, ${profile.secondaryColor} 100%)`
                            : profile?.primaryColor || '#374151'
                        }}
                      >
                        <PlayerHeadshot
                          nbaPlayerId={nba_player_id || null}
                          name={displayName}
                          size="small"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="flex flex-col gap-1 min-w-0 pr-10 sm:pr-0">
                        <DialogTitle className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white leading-tight truncate tracking-tight">
                          {displayName}
                        </DialogTitle>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          {displayTeam && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50">
                              <img
                                src={`/team-logos/nba/${displayTeam.toUpperCase()}.svg`}
                                alt={displayTeam}
                                className="h-4 w-4 object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">{displayTeam}</span>
                            </div>
                          )}
                          {displayPosition && (
                            <span className="px-2 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50 font-semibold text-neutral-600 dark:text-neutral-400">
                              {displayPosition}
                            </span>
                          )}
                          {displayJersey && (
                            <span className="font-medium text-neutral-400">#{displayJersey}</span>
                          )}
                        </div>
                        {/* Next Game - Premium Badge */}
                        {profile?.gameDate && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-700/30">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] uppercase tracking-wide font-bold text-emerald-700 dark:text-emerald-400">Next</span>
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">{profile.homeAway === "H" ? "vs" : "@"}</span>
                              {profile.opponentTeamAbbr && (
                                <img
                                  src={`/team-logos/nba/${profile.opponentTeamAbbr.toUpperCase()}.svg`}
                                  alt={profile.opponentTeamAbbr}
                                  className="h-3.5 w-3.5 object-contain"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{profile.opponentTeamAbbr}</span>
                              <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">•</span>
                              <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">{profile.gameStatus}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Season Stats Card - Premium Glass Design */}
                    {seasonSummary && (
                      <div className="hidden sm:flex flex-col items-center gap-1.5 mr-8">
                        <div className="flex items-stretch gap-1 p-1.5 rounded-xl bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50 shadow-sm">
                          {[
                            { label: "PTS", value: seasonSummary.avgPoints },
                            { label: "REB", value: seasonSummary.avgRebounds },
                            { label: "AST", value: seasonSummary.avgAssists },
                            { label: "FG%", value: seasonSummary.fgPct },
                          ].map((stat, idx) => (
                            <div 
                              key={stat.label}
                              className={cn(
                                "flex flex-col items-center justify-center px-3 py-1.5 min-w-[52px] rounded-lg transition-colors",
                                idx === 0 && "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20"
                              )}
                            >
                              <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{stat.label}</span>
                              <span className={cn(
                                "text-lg font-bold tabular-nums tracking-tight",
                                idx === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                              )}>
                                {stat.value.toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Season Averages</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile Season Stats - Premium Grid */}
                  {seasonSummary && (
                    <div className="flex sm:hidden flex-col items-center gap-2 mt-4">
                      <div className="grid grid-cols-4 gap-1 w-full max-w-xs p-1.5 rounded-xl bg-white/60 dark:bg-neutral-800/40 backdrop-blur-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
                        {[
                          { label: "PTS", value: seasonSummary.avgPoints, highlight: true },
                          { label: "REB", value: seasonSummary.avgRebounds, highlight: false },
                          { label: "AST", value: seasonSummary.avgAssists, highlight: false },
                          { label: "FG%", value: seasonSummary.fgPct, highlight: false },
                        ].map((stat) => (
                          <div 
                            key={stat.label}
                            className={cn(
                              "flex flex-col items-center justify-center py-2 rounded-lg",
                              stat.highlight && "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30"
                            )}
                          >
                            <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{stat.label}</span>
                            <span className={cn(
                              "text-base font-bold tabular-nums",
                              stat.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                            )}>
                              {stat.value.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <span className="text-[7px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Season Averages</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Section - Prop Controls - Premium Glass */}
              <div className="px-4 sm:px-6 py-3 bg-gradient-to-r from-neutral-50/80 via-white/60 to-neutral-50/80 dark:from-neutral-900/60 dark:via-neutral-800/40 dark:to-neutral-900/60 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                  {/* Left: Market Dropdown + Line Chip */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Market Dropdown - Premium */}
                    <div className="relative" ref={marketDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-xs sm:text-sm font-bold text-neutral-900 dark:text-white hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                      >
                        <span className="text-emerald-600 dark:text-emerald-400">{formatMarketLabel(currentMarket)}</span>
                        <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform duration-200", isMarketDropdownOpen && "rotate-180")} />
                      </button>
                      {isMarketDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 z-[9999] min-w-[180px] p-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 backdrop-blur-xl">
                          <div className="max-h-[280px] overflow-y-auto">
                            {availableMarkets.map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setSelectedMarket(m);
                                  onMarketChange?.(m);
                                  setIsMarketDropdownOpen(false);
                                }}
                                className={cn(
                                  "w-full px-3 py-2.5 text-left text-sm font-semibold rounded-lg transition-all",
                                  m === currentMarket
                                    ? "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/50 dark:ring-emerald-700/30"
                                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
                                )}
                              >
                                {formatMarketLabel(m)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Line Chip */}
                    <div
                      className={cn(
                        "relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-md transition-all cursor-pointer",
                        customLine !== null && customLine !== defaultLine
                          ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-neutral-950" 
                          : "hover:shadow-lg"
                      )}
                      style={{ backgroundColor: profile?.primaryColor || '#6366f1' }}
                      onClick={() => {
                        if (!isEditingLine) {
                          setEditValue(String(activeLine));
                          setIsEditingLine(true);
                        }
                      }}
                    >
                      {isEditingLine ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleLineEdit(); }}
                            onBlur={handleLineEdit}
                            className="w-12 px-1.5 py-0.5 text-sm font-bold text-neutral-900 bg-white rounded text-center"
                            autoFocus
                          />
                          <button onClick={handleLineEdit} className="p-0.5 text-white hover:bg-white/20 rounded">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-base font-bold text-white tabular-nums">{activeLine}+</span>
                          <Pencil className="h-3 w-3 text-white/60" />
                        </>
                      )}
                    </div>

                    {/* Reset Line Button - Only shown when line is customized */}
                    {customLine !== null && customLine !== defaultLine && (
                      <button
                        type="button"
                        onClick={() => setCustomLine(null)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-750 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        title="Reset to original line"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span className="hidden sm:inline">Reset</span>
                      </button>
                    )}

                    {/* Odds */}
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      {activeOdds?.over ? (
                        <button
                          type="button"
                          onClick={() => activeOdds.over?.mobileLink && window.open(activeOdds.over.mobileLink, "_blank", "noopener,noreferrer")}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-all text-xs",
                            activeOdds.over?.mobileLink && "hover:border-emerald-400/50 cursor-pointer"
                          )}
                        >
                          {activeOdds.over.book && (() => {
                            const sb = getSportsbookById(activeOdds.over.book);
                            return sb?.image?.light ? (
                              <img src={sb.image.light} alt={sb.name} className="h-3.5 w-3.5 object-contain" />
                            ) : null;
                          })()}
                          <span className="font-medium text-neutral-400">O</span>
                          <span className={cn(
                            "font-bold tabular-nums",
                            activeOdds.over.price > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                          )}>
                            {activeOdds.over.price > 0 ? `+${activeOdds.over.price}` : activeOdds.over.price}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
                          <span className="font-medium text-neutral-400">O</span>
                          <span className="font-bold tabular-nums text-neutral-400">—</span>
                        </div>
                      )}
                      {activeOdds?.under ? (
                        <button
                          type="button"
                          onClick={() => activeOdds.under?.mobileLink && window.open(activeOdds.under.mobileLink, "_blank", "noopener,noreferrer")}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-all text-xs",
                            activeOdds.under?.mobileLink && "hover:border-red-400/50 cursor-pointer"
                          )}
                        >
                          {activeOdds.under.book && (() => {
                            const sb = getSportsbookById(activeOdds.under.book);
                            return sb?.image?.light ? (
                              <img src={sb.image.light} alt={sb.name} className="h-3.5 w-3.5 object-contain" />
                            ) : null;
                          })()}
                          <span className="font-medium text-neutral-400">U</span>
                          <span className={cn(
                            "font-bold tabular-nums",
                            activeOdds.under.price > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300"
                          )}>
                            {activeOdds.under.price > 0 ? `+${activeOdds.under.price}` : activeOdds.under.price}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
                          <span className="font-medium text-neutral-400">U</span>
                          <span className="font-bold tabular-nums text-neutral-400">—</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Hit Rate Strip - Premium Pills */}
                  <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/30">
                    {[
                      { label: "L5", value: dynamicHitRates.l5, count: 5 as const },
                      { label: "L10", value: dynamicHitRates.l10, count: 10 as const },
                      { label: "L20", value: dynamicHitRates.l20, count: 20 as const },
                      { label: "SZN", value: dynamicHitRates.season, count: "season" as const },
                      { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" as const },
                    ].map((stat) => {
                      const isSelected = gameCount === stat.count;
                      const hitColor = stat.value !== null && stat.value >= 70 
                        ? "emerald" 
                        : stat.value !== null && stat.value >= 50 
                          ? "amber" 
                          : "red";
                      return (
                        <button
                          key={stat.label}
                          type="button"
                          onClick={() => setGameCount(stat.count)}
                          className={cn(
                            "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold",
                            isSelected 
                              ? "bg-white dark:bg-neutral-800 shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50" 
                              : "hover:bg-white/50 dark:hover:bg-neutral-800/50"
                          )}
                        >
                          <span className={cn(
                            "font-bold tabular-nums tracking-tight",
                            isSelected ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500"
                          )}>
                            {stat.label}
                          </span>
                          <span className={cn(
                            "font-bold tabular-nums",
                            hitColor === "emerald" && "text-emerald-600 dark:text-emerald-400",
                            hitColor === "amber" && "text-amber-600 dark:text-amber-400",
                            hitColor === "red" && "text-red-500 dark:text-red-400",
                            stat.value === null && "text-neutral-400 dark:text-neutral-500"
                          )}>
                            {stat.value != null ? `${stat.value}%` : "—"}
                          </span>
                          {isSelected && (
                            <div className={cn(
                              "absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full",
                              hitColor === "emerald" && "bg-emerald-500",
                              hitColor === "amber" && "bg-amber-500",
                              hitColor === "red" && "bg-red-500",
                              stat.value === null && "bg-neutral-400"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Hit Rate Strip - Premium Touch Targets */}
                <div className="flex sm:hidden items-center justify-center gap-1 mt-3 p-1 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40 overflow-x-auto">
                  {[
                    { label: "L5", value: dynamicHitRates.l5, count: 5 as const },
                    { label: "L10", value: dynamicHitRates.l10, count: 10 as const },
                    { label: "L20", value: dynamicHitRates.l20, count: 20 as const },
                    { label: "SZN", value: dynamicHitRates.season, count: "season" as const },
                    { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" as const },
                  ].map((stat) => {
                    const isSelected = gameCount === stat.count;
                    const hitColor = stat.value !== null && stat.value >= 70 
                      ? "emerald" 
                      : stat.value !== null && stat.value >= 50 
                        ? "amber" 
                        : "red";
                    return (
                      <button
                        key={stat.label}
                        type="button"
                        onClick={() => setGameCount(stat.count)}
                        className={cn(
                          "relative flex flex-col items-center justify-center px-2.5 py-2 rounded-lg transition-all min-w-[52px]",
                          isSelected 
                            ? "bg-white dark:bg-neutral-800 shadow-sm ring-1 ring-neutral-200/60 dark:ring-neutral-700/60" 
                            : "active:scale-95"
                        )}
                      >
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wide",
                          isSelected ? "text-neutral-600 dark:text-neutral-300" : "text-neutral-400 dark:text-neutral-500"
                        )}>
                          {stat.label}
                        </span>
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          hitColor === "emerald" && "text-emerald-600 dark:text-emerald-400",
                          hitColor === "amber" && "text-amber-600 dark:text-amber-400",
                          hitColor === "red" && "text-red-500 dark:text-red-400",
                          stat.value === null && "text-neutral-400 dark:text-neutral-500"
                        )}>
                          {stat.value != null ? `${stat.value}%` : "—"}
                        </span>
                        {isSelected && (
                          <div className={cn(
                            "absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full",
                            hitColor === "emerald" && "bg-emerald-500",
                            hitColor === "amber" && "bg-amber-500",
                            hitColor === "red" && "bg-red-500",
                            stat.value === null && "bg-neutral-400"
                          )} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile CTA: quick access to full hit rate card */}
                <div className="sm:hidden mt-2">
                  {hasAdvancedAccess ? (
                    <Link
                      href={`/hit-rates/nba/player/${nba_player_id}?market=${currentMarket}`}
                      target="_blank"
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      onClick={() => onOpenChange(false)}
                    >
                      View Full Hit Rate Card
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <Link
                      href="/pricing"
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-colors"
                      onClick={() => onOpenChange(false)}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {isAuthenticated ? "Upgrade for Full Hit Rate Card" : "Try Free for Full Hit Rate Card"}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                TAB NAVIGATION - Premium Style
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="shrink-0 px-4 sm:px-6 pt-2.5 pb-3 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-gradient-to-r from-white via-neutral-50/50 to-white dark:from-neutral-900 dark:via-neutral-800/30 dark:to-neutral-900 overflow-hidden">
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
                {[
                  { id: "gamelog" as const, label: "Game Log", mobileLabel: "Log", icon: BarChart3, proOnly: false },
                  { id: "matchup" as const, label: "Matchup", mobileLabel: "Match", icon: Target, proOnly: true },
                  { id: "playstyle" as const, label: "Play Style", mobileLabel: "Style", icon: Zap, proOnly: true },
                  { id: "correlation" as const, label: "Correlation", mobileLabel: "Corr", icon: Users, proOnly: true },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                        isActive
                          ? "bg-white dark:bg-neutral-800 text-emerald-700 dark:text-emerald-400 shadow-md ring-1 ring-emerald-200/50 dark:ring-emerald-700/30"
                          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-white/60 dark:hover:bg-neutral-800/60 active:scale-95"
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400 dark:text-neutral-500"
                      )} />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.mobileLabel}</span>
                      {tab.proOnly && !hasAdvancedAccess && (
                        <span className="ml-1 px-1.5 py-0.5 text-[8px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md shadow-sm">
                          SCOUT
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                SCROLLABLE CONTENT
                ═══════════════════════════════════════════════════════════════════ */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-4 space-y-5 min-w-0 relative z-0 min-h-[400px]">
              {/* Notice for future games */}
              {!hasUpcomingProfile && activeTab === "gamelog" && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    No upcoming game profile found. Showing historical stats.
                  </p>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  GAME LOG TAB
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "gamelog" && (
                <>
                  {/* Chart Section - Premium Card */}
                  <div className="rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5 w-full max-w-full relative z-0">
                    <div className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-emerald-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-emerald-900/10" />
                      <div className="relative px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-200/60 dark:border-neutral-700/60">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 shadow-sm shadow-emerald-500/30" />
                            <div>
                              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">Game Log</h2>
                              <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-medium">Performance history</p>
                            </div>
                          </div>
                          
                          {/* Chart Stats - Premium */}
                          <div className="flex items-center gap-1.5 sm:gap-3">
                            <div className="flex flex-col items-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white dark:bg-neutral-700/40 ring-1 ring-neutral-200/60 dark:ring-neutral-600/40 shadow-sm">
                              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-neutral-400">Avg</span>
                              <span className={cn(
                                "text-base sm:text-xl font-bold tabular-nums tracking-tight",
                                chartStats.avg && chartStats.avg > activeLine ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                              )}>
                                {chartStats.avg?.toFixed(1) ?? "—"}
                              </span>
                            </div>
                            <div className={cn(
                              "flex flex-col items-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl ring-1 shadow-sm",
                              chartStats.hitRate !== null && chartStats.hitRate >= 70 
                                ? "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 ring-emerald-200/60 dark:ring-emerald-700/40"
                                : chartStats.hitRate !== null && chartStats.hitRate >= 50 
                                  ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 ring-amber-200/60 dark:ring-amber-700/40"
                                  : chartStats.hitRate !== null
                                    ? "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 ring-red-200/60 dark:ring-red-700/40"
                                    : "bg-neutral-50 dark:bg-neutral-700/30 ring-neutral-200/50 dark:ring-neutral-700/50"
                            )}>
                              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-neutral-400">Hit Rate</span>
                              <span className={cn("text-base sm:text-xl font-bold tabular-nums tracking-tight", getPctColor(chartStats.hitRate))}>
                                {chartStats.hitRate !== null ? `${chartStats.hitRate}%` : "—"}
                              </span>
                            </div>
                            <div className="hidden sm:flex flex-col items-center text-xs text-neutral-500">
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">{chartStats.hits}/{chartStats.total}</span>
                              <span className="text-[9px]">games</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="p-3 sm:p-4">
                      {filteredGames.length > 0 ? (
                        <GameLogChart
                          games={filteredGames}
                          market={currentMarket}
                          line={activeLine}
                          onLineChange={setCustomLine}
                          odds={oddsForChart}
                          profileGameLogs={profile?.gameLogs as any}
                        />
                      ) : (
                        <div className="py-12 text-center text-sm text-neutral-500">No game data available</div>
                      )}
                    </div>
                  </div>

                  {/* Box Score Table */}
                  {nba_player_id && (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200/60 dark:border-neutral-700/60">
                      <BoxScoreTable
                        playerId={nba_player_id}
                        market={currentMarket}
                        currentLine={activeLine}
                      />
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  MATCHUP TAB - Defense vs Position Analysis
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "matchup" && (
                <div className="relative">
                  {/* Pro gate overlay */}
                  {!hasAdvancedAccess && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md rounded-xl">
                      <div className="flex flex-col items-center gap-4 p-6 max-w-sm text-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20">
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                            Matchup Analysis
                          </h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            See how this player performs against the opposing defense with detailed positional matchup data.
                          </p>
                        </div>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow"
                        >
                          <Lock className="w-4 h-4" />
                          {isAuthenticated ? "Upgrade to Scout" : "Try Free"}
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <div className={cn("space-y-6", !hasAdvancedAccess && "pointer-events-none select-none")}>
                    {/* Defensive Analysis Matrix */}
                    <DefensiveAnalysis
                      playerId={profilePlayerId ?? 0}
                      opponentTeamId={profileOpponentTeamId}
                      opponentTeamAbbr={profileOpponentTeamAbbr}
                      position={profilePosition}
                    />
                    
                    {/* Position vs Team Game Log */}
                    <PositionVsTeam
                      position={profilePosition}
                      opponentTeamId={profileOpponentTeamId}
                      opponentTeamAbbr={profileOpponentTeamAbbr}
                      market={currentMarket}
                      currentLine={activeLine}
                    />
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  PLAY STYLE TAB - Play Type & Shooting Analysis
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "playstyle" && (
                <div className="relative">
                  {/* Pro gate overlay */}
                  {!hasAdvancedAccess && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md rounded-xl">
                      <div className="flex flex-col items-center gap-4 p-6 max-w-sm text-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20">
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                            Play Style Analysis
                          </h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Explore play type breakdowns and shooting zone charts to understand how this player scores.
                          </p>
                        </div>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow"
                        >
                          <Lock className="w-4 h-4" />
                          {isAuthenticated ? "Upgrade to Scout" : "Try Free"}
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <div className={cn("space-y-6", !hasAdvancedAccess && "pointer-events-none select-none")}>
                    <PlayTypeAnalysis
                      playerId={profilePlayerId ?? null}
                      opponentTeamId={profileOpponentTeamId}
                      opponentTeamAbbr={profileOpponentTeamAbbr}
                      playerName={profilePlayerName}
                    />
                    <ShootingZones
                      playerId={profilePlayerId}
                      opponentTeamId={profileOpponentTeamId}
                      playerName={profilePlayerName}
                      opponentTeamAbbr={profileOpponentTeamAbbr}
                      showSideTable
                    />
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  CORRELATION TAB - Teammate Correlations
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "correlation" && (
                <div className="relative">
                  {/* Pro gate overlay */}
                  {!hasAdvancedAccess && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md rounded-xl">
                      <div className="flex flex-col items-center gap-4 p-6 max-w-sm text-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20">
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                            Player Correlations
                          </h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Discover which teammates boost or hurt this player&apos;s performance for smarter parlays.
                          </p>
                        </div>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow"
                        >
                          <Lock className="w-4 h-4" />
                          {isAuthenticated ? "Upgrade to Scout" : "Try Free"}
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <div className={cn(!hasAdvancedAccess && "pointer-events-none select-none")}>
                    <PlayerCorrelations
                      playerId={profilePlayerId ?? null}
                      market={currentMarket}
                      line={activeLine}
                      gameId={profile?.gameId}
                      gameDate={profile?.gameDate}
                      homeTeamName={profile?.homeTeamName}
                      awayTeamName={profile?.awayTeamName}
                      startTime={profile?.startTime}
                      anchorTeam={profile?.teamAbbr || profile?.teamName}
                      playerName={profilePlayerName}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                FOOTER - View Full Profile CTA
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-neutral-200/50 dark:border-neutral-800/50">
              {hasAdvancedAccess ? (
                <Link
                  href={`/hit-rates/nba/player/${nba_player_id}?market=${currentMarket}`}
                  target="_blank"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  View Full Hit Rate Profile
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isAuthenticated ? "Upgrade to Scout for Full Profile" : "Try Free for Full Profile"}
                </Link>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
