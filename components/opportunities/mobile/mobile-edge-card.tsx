"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, ExternalLink, EyeOff, Eye, Zap } from "lucide-react";
import { Heart } from "@/components/icons/heart";
import { HeartFill } from "@/components/icons/heart-fill";
import { cn } from "@/lib/utils";
import { Opportunity } from "@/lib/types/opportunities";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getLeagueName } from "@/lib/data/sports";
import { formatMarketLabel } from "@/lib/data/markets";
import { motion, AnimatePresence } from "framer-motion";
import { getKellyStakeDisplay, americanToDecimal, applyBoostToDecimalOdds } from "@/lib/utils/kelly";
import { useFavorites } from "@/hooks/use-favorites";

// Helper to get sportsbook logo
const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

// Format odds with + prefix for positive
const formatOdds = (price: number | string | undefined): string => {
  if (price === undefined || price === null) return "—";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "—";
  return num > 0 ? `+${Math.round(num)}` : `${Math.round(num)}`;
};

// Get color for edge percentage
function getEdgeColor(edge: number | null): string {
  if (edge === null) return "text-neutral-500";
  if (edge >= 10) return "text-emerald-500 dark:text-emerald-400";
  if (edge >= 5) return "text-emerald-400 dark:text-emerald-300";
  if (edge >= 3) return "text-amber-500 dark:text-amber-400";
  return "text-neutral-500";
}

// Get background color for edge badge
function getEdgeBgColor(edge: number | null): string {
  if (edge === null) return "bg-neutral-100 dark:bg-neutral-800";
  if (edge >= 10) return "bg-emerald-500/15 dark:bg-emerald-500/20";
  if (edge >= 5) return "bg-emerald-400/15 dark:bg-emerald-400/20";
  if (edge >= 3) return "bg-amber-500/15 dark:bg-amber-500/20";
  return "bg-neutral-100 dark:bg-neutral-800";
}

// Format time relative to now
function formatGameTime(gameStart: string | null): string {
  if (!gameStart) return "—";
  const start = new Date(gameStart);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 0) return "Live";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours}h`;
  }
  // Show day of week + time
  return start.toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

// Get sport icon/emoji
function getSportEmoji(sport: string): string {
  switch (sport?.toLowerCase()) {
    case "nba":
    case "wnba":
    case "ncaab":
      return "🏀";
    case "nfl":
    case "ncaaf":
      return "🏈";
    case "nhl":
      return "🏒";
    case "mlb":
      return "⚾";
    case "soccer":
    case "soccer_epl":
      return "⚽";
    default:
      return "🎯";
  }
}

interface MobileEdgeCardProps {
  opportunity: Opportunity;
  onBetClick?: (opportunity: Opportunity) => void;
  onPlayerClick?: (opportunity: Opportunity) => void;
  onHide?: (opportunity: Opportunity) => void;
  onUnhide?: (opportunity: Opportunity) => void;
  isHidden?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  bankroll?: number;
  kellyPercent?: number;
  boostPercent?: number;
}

export function MobileEdgeCard({
  opportunity,
  onBetClick,
  onPlayerClick,
  onHide,
  onUnhide,
  isHidden = false,
  isExpanded = false,
  onToggleExpand,
  bankroll = 0,
  kellyPercent = 25,
  boostPercent = 0,
}: MobileEdgeCardProps) {
  const opp = opportunity;
  
  // Favorites state
  const [isToggling, setIsToggling] = useState(false);
  const { toggleFavorite, isFavorited, isLoggedIn } = useFavorites();
  
  // Check if this opportunity is favorited
  const isFav = isFavorited({
    event_id: opp.eventId,
    type: opp.player && opp.player !== opp.homeTeam && opp.player !== opp.awayTeam ? 'player' : 'game',
    player_id: opp.playerId || null,
    market: opp.market,
    line: opp.line ?? null,
    side: opp.side,
  });
  
  // Handle toggle favorite
  // Only includes fields that exist in the user_favorites database table
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn || isToggling) return;
    
    setIsToggling(true);
    try {
      // Convert allBooks to books_snapshot format
      // Schema: { book_id: { price, u?, m?, sgp? } }
      const booksSnapshot: Record<string, { price: number; u?: string | null; m?: string | null; sgp?: string | null }> = {};
      for (const book of opp.allBooks || []) {
        booksSnapshot[book.book] = {
          price: book.price,
          u: book.link ?? null,
          m: book.mobileLink ?? null,
          sgp: book.sgp ?? null,
        };
      }
      
      const isPlayerProp = opp.player && opp.player !== opp.homeTeam && opp.player !== opp.awayTeam;
      
      // Parse best price to number
      let bestPrice: number | null = null;
      if (typeof opp.bestPrice === 'string') {
        bestPrice = parseInt(opp.bestPrice.replace('+', ''), 10);
      } else if (typeof opp.bestPrice === 'number') {
        bestPrice = opp.bestPrice;
      } else if (opp.bestDecimal) {
        bestPrice = opp.bestDecimal > 2 
          ? Math.round((opp.bestDecimal - 1) * 100) 
          : Math.round(-100 / (opp.bestDecimal - 1));
      }
      
      // Build odds_key for Redis lookups: sport:eventId:market:player|side|line
      const playerKey = opp.player?.toLowerCase().replace(/\s+/g, '_') || 'game';
      const oddsKey = `${opp.sport}:${opp.eventId}:${opp.market}:${playerKey}|${opp.side}|${opp.line ?? 0}`;
      
      await toggleFavorite({
        type: isPlayerProp ? 'player' : 'game',
        sport: opp.sport,
        event_id: opp.eventId,
        game_date: opp.gameStart ? new Date(opp.gameStart).toISOString().split('T')[0] : null,
        home_team: opp.homeTeam || null,
        away_team: opp.awayTeam || null,
        start_time: opp.gameStart || null,
        player_id: opp.playerId || null,
        player_name: opp.player || null,
        player_team: opp.team || null,
        player_position: opp.position || null,
        market: opp.market,
        line: opp.line ?? null,
        side: opp.side,
        odds_key: oddsKey,
        odds_selection_id: opp.id,
        books_snapshot: Object.keys(booksSnapshot).length > 0 ? booksSnapshot : null,
        best_price_at_save: bestPrice,
        best_book_at_save: opp.bestBook || null,
        source: 'edge_finder_mobile',
      });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setIsToggling(false);
    }
  };
  
  // Apply boost to edge percentage
  const baseEdge = opp.edgePct ?? 0;
  const boostedEdge = boostPercent > 0 ? baseEdge * (1 + boostPercent / 100) : baseEdge;
  
  // Calculate recommended stake with boost
  const recStake = useMemo(() => {
    if (bankroll <= 0) return 0;
    
    // Get best odds and fair odds from opportunity
    const bestPriceStr = opp.bestPrice || "";
    const fairPriceStr = opp.fairAmerican || opp.sharpPrice || "";
    
    if (!bestPriceStr || !fairPriceStr) {
      // Fallback to original kellyFraction if no price data
      const kellyFraction = opp.kellyFraction ?? 0;
      const adjustedKelly = kellyFraction * (kellyPercent / 100);
      return Math.max(1, Math.round(bankroll * adjustedKelly));
    }
    
    const bestOdds = parseInt(bestPriceStr.toString().replace('+', ''), 10);
    const fairOdds = parseInt(fairPriceStr.toString().replace('+', ''), 10);
    
    if (isNaN(bestOdds) || isNaN(fairOdds) || bestOdds === 0 || fairOdds === 0) {
      // Fallback to original kellyFraction
      const kellyFraction = opp.kellyFraction ?? 0;
      const adjustedKelly = kellyFraction * (kellyPercent / 100);
      return Math.max(1, Math.round(bankroll * adjustedKelly));
    }
    
    const { stake } = getKellyStakeDisplay({
      bankroll,
      bestOdds,
      fairOdds,
      kellyPercent,
      boostPercent,
    });
    
    return stake > 0 ? Math.max(1, Math.round(stake)) : 0;
  }, [bankroll, kellyPercent, boostPercent, opp.bestPrice, opp.fairAmerican, opp.sharpPrice, opp.kellyFraction]);
  
  // Get best book info
  const bestBookInfo = getSportsbookById(opp.bestBook);
  const bestBookLogo = getBookLogo(opp.bestBook);
  
  // Determine if this is a player prop
  const isPlayerProp = opp.player && opp.player !== opp.homeTeam && opp.player !== opp.awayTeam;
  
  // Format the selection display
  const selectionDisplay = isPlayerProp 
    ? opp.player 
    : `${opp.awayTeam} @ ${opp.homeTeam}`;
  
  // Format the market display
  const marketDisplay = formatMarketLabel(opp.market) || opp.market?.replace(/_/g, " ");
  const sideDisplay = opp.side === "over" ? "Over" : opp.side === "under" ? "Under" : opp.side;
  const lineDisplay = opp.line !== undefined && opp.line !== null ? opp.line : "";
  
  return (
    <div className={cn(
      "mx-3 mb-2 rounded-lg overflow-hidden",
      "bg-white dark:bg-neutral-900",
      "border border-neutral-200/80 dark:border-neutral-800",
      "transition-all duration-200",
      // Hidden state - like desktop
      isHidden && "opacity-40 bg-neutral-100/50 dark:bg-neutral-800/30"
    )}>
      {/* Header - Two rows */}
      <div className="px-2.5 py-1.5 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/60 dark:to-neutral-800/30">
        {/* Row 1: Sport + Game + Time + Edge */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Sport + Game + Time */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 text-[9px]">
            <span className="text-xs shrink-0">{getSportEmoji(opp.sport)}</span>
            <span className="font-bold text-neutral-600 dark:text-neutral-300 uppercase shrink-0">
              {getLeagueName(opp.sport)}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600">•</span>
            <span className="text-neutral-500 dark:text-neutral-400 truncate">
              {opp.awayTeam} @ {opp.homeTeam}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600 shrink-0">•</span>
            <span className="text-neutral-400 dark:text-neutral-500 shrink-0">
              {formatGameTime(opp.gameStart)}
            </span>
          </div>
          
          {/* Right: Edge Badge + Favorite + Hide/Unhide */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "px-2 py-1 rounded-full flex items-center justify-center",
              getEdgeBgColor(boostedEdge),
              // Amber ring when boosted
              boostPercent > 0 && "ring-1 ring-amber-400/50"
            )}>
              <span className={cn("text-[10px] font-bold tabular-nums leading-none", getEdgeColor(boostedEdge))}>
                {boostPercent > 0 && <span className="text-amber-500 mr-0.5">⚡</span>}
                +{boostedEdge.toFixed(1)}%
              </span>
            </div>
            
            {/* Add to Betslip Button */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={!isLoggedIn || isToggling}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                !isLoggedIn && "opacity-50 cursor-not-allowed",
                isFav 
                  ? "bg-red-500/10 hover:bg-red-500/20" 
                  : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
              title={!isLoggedIn ? "Sign in to save to betslip" : isFav ? "Remove from betslip" : "Add to betslip"}
            >
              {isToggling ? (
                <HeartFill className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              ) : isFav ? (
                <HeartFill className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Heart className="w-3.5 h-3.5 text-neutral-400 hover:text-red-400" />
              )}
            </button>
            
            {/* Hide/Unhide toggle */}
            {isHidden && onUnhide ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnhide(opp);
                }}
                className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors"
                title="Unhide this edge"
              >
                <Eye className="w-3 h-3 text-neutral-400" />
              </button>
            ) : onHide ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHide(opp);
                }}
                className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors"
                title="Hide this edge"
              >
                <EyeOff className="w-3 h-3 text-neutral-400" />
              </button>
            ) : null}
          </div>
        </div>
        
        {/* Row 2: Market + Model badge */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
            {marketDisplay}
          </span>
          {opp.filterName && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 truncate max-w-[120px]">
              {opp.filterName}
            </span>
          )}
        </div>
      </div>
      
      {/* Main Content - Compact & Tappable to expand */}
      <div 
        className="px-2.5 py-2 cursor-pointer active:bg-neutral-50 dark:active:bg-neutral-800/50 transition-colors"
        onClick={onToggleExpand}
      >
        {/* Player/Selection + Line */}
        <div className="flex items-baseline gap-1.5 mb-2">
          {isPlayerProp ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayerClick?.(opp);
              }}
              className="text-left"
            >
              <span className="text-[14px] font-bold text-neutral-900 dark:text-white hover:text-brand transition-colors leading-tight">
                {opp.player}
              </span>
            </button>
          ) : (
            <span className="text-[14px] font-bold text-neutral-900 dark:text-white leading-tight">
              {selectionDisplay}
            </span>
          )}
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            {sideDisplay} {lineDisplay}
          </span>
        </div>
        
        {/* Action Row - Odds left, BET right */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Book + Odds + Expand indicator */}
          <div className="flex items-center gap-2">
            {bestBookLogo ? (
              <img 
                src={bestBookLogo} 
                alt={bestBookInfo?.name || opp.bestBook} 
                className="w-4 h-4 rounded object-contain"
              />
            ) : (
              <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
            )}
            <span className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">
              {formatOdds(opp.bestPrice)}
            </span>
            {/* Expand indicator */}
            <div className={cn(
              "p-1 rounded transition-colors",
              isExpanded 
                ? "bg-neutral-200 dark:bg-neutral-700" 
                : "bg-neutral-100 dark:bg-neutral-800"
            )}>
              {isExpanded ? (
                <ChevronUp className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              )}
            </div>
          </div>
          
          {/* Right: Rec Stake + Bet Button */}
          <div className="flex items-center gap-2">
            {recStake > 0 && (
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-0.5">
                {boostPercent > 0 && <Zap className="w-3 h-3 text-amber-500" />}
                <span className="text-[9px] uppercase">Rec </span>
                <span className={cn(
                  "font-bold tabular-nums",
                  boostPercent > 0 
                    ? "text-amber-600 dark:text-amber-400" 
                    : "text-emerald-600 dark:text-emerald-400"
                )}>${recStake}</span>
              </span>
            )}
            
            {/* Bet Button - Compact */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBetClick?.(opp);
              }}
              className={cn(
                "flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg",
                "bg-brand text-white text-xs font-bold",
                "hover:bg-brand/90 active:scale-[0.97] transition-all duration-150"
              )}
            >
              <span>BET</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Expanded Section - All Odds */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-neutral-200/60 dark:border-neutral-800"
          >
            <div className="px-2.5 py-2 bg-neutral-50/50 dark:bg-neutral-950/30">
              {/* Compact odds info row */}
              {(opp.sharpPrice || opp.fairAmerican) && (
                <div className="flex items-center justify-between gap-3 mb-2 px-1">
                  {/* Model/Reference Odds */}
                  {opp.sharpPrice && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">
                        {opp.filterName ? "Model" : "Ref"}
                      </span>
                      <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {opp.sharpPrice}
                      </span>
                    </div>
                  )}
                  
                  {/* Fair Odds + Hit % */}
                  {opp.fairAmerican && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">
                        Fair
                      </span>
                      <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {opp.fairAmerican}
                      </span>
                      {opp.trueProbability != null && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ({(opp.trueProbability * 100).toFixed(0)}% hit)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Book Comparison Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  Compare Odds
                </span>
                <span className="text-[9px] text-neutral-400">
                  {opp.nBooks} book{opp.nBooks !== 1 ? "s" : ""}
                </span>
              </div>
              
              {/* Book Comparison Grid - 2 Columns */}
              <div className="grid grid-cols-2 gap-1">
                {opp.allBooks.map((book, idx) => {
                  const bookInfo = getSportsbookById(book.book);
                  const bookLogo = getBookLogo(book.book);
                  const isBest = book.book === opp.bestBook;
                  
                  return (
                    <button
                      key={`${book.book}-${idx}`}
                      type="button"
                      onClick={() => {
                        // On mobile, prefer the deep link (mobileLink) to open the app directly
                        const link = book.mobileLink || book.link;
                        if (link) window.open(link, "_blank");
                      }}
                      className={cn(
                        "flex items-center justify-between px-1.5 py-1 rounded-md",
                        "transition-all duration-100 active:scale-[0.98]",
                        isBest 
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-800/60"
                          : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800"
                      )}
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {bookLogo ? (
                          <img 
                            src={bookLogo} 
                            alt={bookInfo?.name || book.book} 
                            className="w-3 h-3 rounded object-contain shrink-0"
                          />
                        ) : (
                          <div className="w-3 h-3 rounded bg-neutral-300 dark:bg-neutral-600 shrink-0" />
                        )}
                        <span className={cn(
                          "text-[10px] font-medium truncate",
                          isBest ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-600 dark:text-neutral-300"
                        )}>
                          {bookInfo?.name || book.book}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[11px] font-bold tabular-nums shrink-0 ml-1",
                        isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                      )}>
                        {formatOdds(book.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

