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
import { ExternalLink, X, AlertCircle, Pencil, Check, ChevronDown, RotateCcw, BarChart3, Users, Target, Zap, Lock } from "lucide-react";
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
    player_id: nba_player_id,
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
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-0 shadow-2xl rounded-2xl">
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
                STICKY HEADER - Billion Dollar Design
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="sticky top-0 z-50 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
              {/* Top Section - Player Info + Season Stats */}
              <div 
                className="relative"
                style={{ 
                  background: profile?.primaryColor 
                    ? `linear-gradient(135deg, ${profile.primaryColor}15 0%, transparent 70%)`
                    : undefined
                }}
              >
                {/* Close button */}
                <button
                  onClick={() => onOpenChange(false)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors z-10"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="px-4 sm:px-5 pt-4 pb-3">
                  <div className="flex items-start gap-4">
                    {/* Left: Headshot + Basic Info */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div 
                        className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden shadow-lg shrink-0 ring-2 ring-white/50 dark:ring-neutral-800"
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

                      <div className="flex flex-col gap-0.5 min-w-0 pr-10 sm:pr-0">
                        <DialogTitle className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white leading-tight truncate">
                          {displayName}
                        </DialogTitle>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {displayTeam && (
                            <div className="flex items-center gap-1">
                              <img
                                src={`/team-logos/nba/${displayTeam.toUpperCase()}.svg`}
                                alt={displayTeam}
                                className="h-3.5 w-3.5 object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                              <span className="font-semibold">{displayTeam}</span>
                            </div>
                          )}
                          {displayPosition && (
                            <>
                              <span className="text-neutral-300 dark:text-neutral-600">•</span>
                              <span className="font-medium">{displayPosition}</span>
                            </>
                          )}
                          {displayJersey && (
                            <>
                              <span className="text-neutral-300 dark:text-neutral-600">•</span>
                              <span>#{displayJersey}</span>
                            </>
                          )}
                        </div>
                        {/* Next Game */}
                        {profile?.gameDate && (
                          <div className="flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                            <span className="uppercase tracking-wide font-medium">Next:</span>
                            <span className="font-medium">{profile.homeAway === "H" ? "vs" : "@"}</span>
                            {profile.opponentTeamAbbr && (
                              <img
                                src={`/team-logos/nba/${profile.opponentTeamAbbr.toUpperCase()}.svg`}
                                alt={profile.opponentTeamAbbr}
                                className="h-3 w-3 object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                            <span className="font-semibold">{profile.opponentTeamAbbr}</span>
                            <span>•</span>
                            <span>{profile.gameStatus}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Season Stats Card (ESPN-style) */}
                    {seasonSummary && (
                      <div className="hidden sm:flex flex-col items-center gap-1 mr-8">
                        <div className="flex items-stretch gap-2">
                          <div className="flex flex-col items-center justify-center px-2 min-w-[48px]">
                            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">PTS</span>
                            <span className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">{seasonSummary.avgPoints.toFixed(1)}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center px-2 min-w-[48px]">
                            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">REB</span>
                            <span className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">{seasonSummary.avgRebounds.toFixed(1)}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center px-2 min-w-[48px]">
                            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">AST</span>
                            <span className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">{seasonSummary.avgAssists.toFixed(1)}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center px-2 min-w-[48px]">
                            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">FG%</span>
                            <span className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">{seasonSummary.fgPct.toFixed(1)}</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Season Averages</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile Season Stats */}
                  {seasonSummary && (
                    <div className="flex sm:hidden flex-col items-center gap-1 mt-3">
                      <div className="flex items-stretch justify-center gap-2 w-full">
                        <div className="flex flex-col items-center justify-center px-2">
                          <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">PTS</span>
                          <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{seasonSummary.avgPoints.toFixed(1)}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center px-2">
                          <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">REB</span>
                          <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{seasonSummary.avgRebounds.toFixed(1)}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center px-2">
                          <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">AST</span>
                          <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{seasonSummary.avgAssists.toFixed(1)}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center px-2">
                          <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">FG%</span>
                          <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{seasonSummary.fgPct.toFixed(1)}</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Season Averages</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Section - Prop Controls */}
              <div className="px-4 sm:px-5 py-3 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800/50">
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Market Dropdown + Line Chip */}
                  <div className="flex items-center gap-2">
                    {/* Market Dropdown */}
                    <div className="relative" ref={marketDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-semibold text-neutral-900 dark:text-white hover:bg-neutral-500 dark:hover:bg-neutral-750 transition-colors shadow-sm"
                      >
                        {formatMarketLabel(currentMarket)}
                        <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform", isMarketDropdownOpen && "rotate-180")} />
                      </button>
                      {isMarketDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 z-[9999] min-w-[160px] p-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-2xl">
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
                                "w-full px-3 py-2.5 text-left text-sm font-medium rounded-md transition-colors",
                                m === currentMarket
                                  ? "bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand"
                                  : "text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700"
                              )}
                            >
                              {formatMarketLabel(m)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Line Chip */}
                    <div 
                      className={cn(
                        "relative flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-md transition-all cursor-pointer",
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
                    <div className="flex items-center gap-1">
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

                  {/* Right: Hit Rate Strip */}
                  <div className="hidden sm:flex items-center gap-0.5 overflow-x-auto">
                    {[
                      { label: "L5", value: dynamicHitRates.l5, count: 5 as const },
                      { label: "L10", value: dynamicHitRates.l10, count: 10 as const },
                      { label: "L20", value: dynamicHitRates.l20, count: 20 as const },
                      { label: "SZN", value: dynamicHitRates.season, count: "season" as const },
                      { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" as const },
                    ].map((stat, idx) => {
                      const isSelected = gameCount === stat.count;
                      return (
                        <React.Fragment key={stat.label}>
                          {idx > 0 && <span className="text-neutral-200 dark:text-neutral-700 text-xs">|</span>}
                          <button
                            type="button"
                            onClick={() => setGameCount(stat.count)}
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-1 rounded transition-all text-[11px]",
                              isSelected 
                                ? "bg-brand/10 dark:bg-brand/15" 
                                : "hover:bg-white dark:hover:bg-neutral-800"
                            )}
                          >
                            <span className={cn(
                              "font-semibold tabular-nums",
                              isSelected ? "text-brand" : "text-neutral-400 dark:text-neutral-500"
                            )}>
                              {stat.label}
                            </span>
                            <span className={cn(
                              "font-bold tabular-nums",
                              isSelected 
                                ? getPctColor(stat.value)
                                : stat.value !== null && stat.value >= 70 
                                  ? "text-emerald-600/80 dark:text-emerald-400/80" 
                                  : stat.value !== null && stat.value >= 50 
                                    ? "text-amber-600/80 dark:text-amber-400/80" 
                                    : "text-red-500/80 dark:text-red-400/80"
                            )}>
                              {stat.value != null ? `${stat.value}%` : "—"}
                            </span>
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Hit Rate Strip */}
                <div className="flex sm:hidden items-center justify-center gap-0.5 mt-2 overflow-x-auto">
                  {[
                    { label: "L5", value: dynamicHitRates.l5, count: 5 as const },
                    { label: "L10", value: dynamicHitRates.l10, count: 10 as const },
                    { label: "L20", value: dynamicHitRates.l20, count: 20 as const },
                    { label: "SZN", value: dynamicHitRates.season, count: "season" as const },
                    { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" as const },
                  ].map((stat, idx) => {
                    const isSelected = gameCount === stat.count;
                    return (
                      <React.Fragment key={stat.label}>
                        {idx > 0 && <span className="text-neutral-200 dark:text-neutral-700 text-xs">|</span>}
                        <button
                          type="button"
                          onClick={() => setGameCount(stat.count)}
                          className={cn(
                            "flex items-center gap-0.5 px-1 py-0.5 rounded transition-all text-[10px]",
                            isSelected 
                              ? "bg-brand/10 dark:bg-brand/15" 
                              : "hover:bg-white dark:hover:bg-neutral-800"
                          )}
                        >
                          <span className={cn(
                            "font-semibold",
                            isSelected ? "text-brand" : "text-neutral-400 dark:text-neutral-500"
                          )}>
                            {stat.label}
                          </span>
                          <span className={cn(
                            "font-bold tabular-nums",
                            isSelected 
                              ? getPctColor(stat.value)
                              : stat.value !== null && stat.value >= 70 
                                ? "text-emerald-600/80 dark:text-emerald-400/80" 
                                : stat.value !== null && stat.value >= 50 
                                  ? "text-amber-600/80 dark:text-amber-400/80" 
                                  : "text-red-500/80 dark:text-red-400/80"
                          )}>
                            {stat.value != null ? `${stat.value}%` : "—"}
                          </span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                TAB NAVIGATION
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="shrink-0 px-4 sm:px-5 py-2 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-800/30">
              <div className="flex items-center gap-1 overflow-x-auto">
                {[
                  { id: "gamelog" as const, label: "Game Log", icon: BarChart3, locked: false },
                  { id: "matchup" as const, label: "Matchup", icon: Target, locked: true },
                  { id: "playstyle" as const, label: "Play Style", icon: Zap, locked: true },
                  { id: "correlation" as const, label: "Correlation", icon: Users, locked: true },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <Tooltip
                      key={tab.id}
                      content={tab.locked ? "Pro feature - Coming soon" : tab.label}
                      side="bottom"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                          isActive
                            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
                            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-800/50"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.locked && !isActive && (
                          <Lock className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
                        )}
                      </button>
                    </Tooltip>
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
                  {/* Chart Section */}
                  <div className="rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden shadow-sm w-full max-w-full relative z-0">
                    <div className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100/50 dark:from-neutral-800/50 dark:via-neutral-800/30 dark:to-neutral-800/50" />
                      <div className="relative px-4 sm:px-5 py-3 sm:py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-500 to-blue-600" />
                            <div>
                              <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">Game Log</h2>
                              <p className="text-[10px] sm:text-xs text-neutral-500 mt-0.5">Performance history</p>
                            </div>
                          </div>
                          
                          {/* Chart Stats */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
                              <span className="text-[9px] sm:text-[10px] font-semibold uppercase text-neutral-400">Avg</span>
                              <span className={cn(
                                "text-base sm:text-lg font-bold tabular-nums",
                                chartStats.avg && chartStats.avg > activeLine ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                              )}>
                                {chartStats.avg?.toFixed(1) ?? "—"}
                              </span>
                            </div>
                            <div className={cn(
                              "flex flex-col items-center px-3 py-1.5 rounded-lg ring-1",
                              getPctBgColor(chartStats.hitRate),
                              chartStats.hitRate !== null
                                ? chartStats.hitRate >= 70 ? "ring-emerald-200/50 dark:ring-emerald-700/50"
                                  : chartStats.hitRate >= 50 ? "ring-amber-200/50 dark:ring-amber-700/50"
                                  : "ring-red-200/50 dark:ring-red-700/50"
                                : "ring-neutral-200/50 dark:ring-neutral-700/50"
                            )}>
                              <span className="text-[9px] sm:text-[10px] font-semibold uppercase text-neutral-400">Hit Rate</span>
                              <span className={cn("text-base sm:text-lg font-bold tabular-nums", getPctColor(chartStats.hitRate))}>
                                {chartStats.hitRate !== null ? `${chartStats.hitRate}%` : "—"}
                              </span>
                            </div>
                            <div className="text-xs text-neutral-500 hidden sm:block">
                              {chartStats.hits}/{chartStats.total}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chart - Horizontally scrollable for many games */}
                    <div className="relative">
                      <div className="p-3 sm:p-4 overflow-x-auto max-w-full">
                        <div style={{ width: filteredGames.length > 15 ? `${filteredGames.length * 40}px` : '100%', minWidth: '100%' }}>
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
                <div className="space-y-6">
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
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  PLAY STYLE TAB - Play Type & Shooting Analysis
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "playstyle" && (
                <div className="space-y-6">
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
                  />
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  CORRELATION TAB - Teammate Correlations
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "correlation" && (
                <PlayerCorrelations
                  playerId={profilePlayerId ?? null}
                  market={currentMarket}
                  line={activeLine}
                  gameId={profile?.gameId}
                  playerName={profilePlayerName}
                />
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                FOOTER - View Full Profile CTA
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-neutral-200/50 dark:border-neutral-800/50">
              <Link
                href={`/hit-rates/nba/player/${nba_player_id}?market=${currentMarket}`}
                target="_blank"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                onClick={() => onOpenChange(false)}
              >
                View Full Hit Rate Profile
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
