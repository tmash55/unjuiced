"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Opportunity } from "@/lib/types/opportunities";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabel } from "@/lib/data/markets";
import { motion, AnimatePresence } from "framer-motion";

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
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  bankroll?: number;
  kellyPercent?: number;
}

export function MobileEdgeCard({
  opportunity,
  onBetClick,
  onPlayerClick,
  onHide,
  isExpanded = false,
  onToggleExpand,
  bankroll = 0,
  kellyPercent = 25,
}: MobileEdgeCardProps) {
  const opp = opportunity;
  
  // Calculate recommended stake
  const kellyFraction = opp.kellyFraction ?? 0;
  const adjustedKelly = kellyFraction * (kellyPercent / 100);
  const recStake = bankroll > 0 ? Math.max(1, Math.round(bankroll * adjustedKelly)) : 0;
  
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
      "mx-3 mb-2.5 rounded-xl overflow-hidden",
      "bg-white dark:bg-neutral-900",
      "border border-neutral-200/80 dark:border-neutral-800",
      "shadow-sm dark:shadow-neutral-950/30",
      "transition-all duration-200"
    )}>
      {/* Header - Sport, Matchup, Time, Market, Edge */}
      <div className="px-3 py-2 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/60 dark:to-neutral-800/30">
        {/* Row 1: Sport, Game, Time, Edge */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Sport + Matchup + Time */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm shrink-0">{getSportEmoji(opp.sport)}</span>
            <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
              <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase">
                {opp.sport}
              </span>
              <span className="text-neutral-300 dark:text-neutral-600 text-[10px]">•</span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                {opp.awayTeam} @ {opp.homeTeam}
              </span>
              <span className="text-neutral-300 dark:text-neutral-600 text-[10px]">•</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                {formatGameTime(opp.gameStart)}
              </span>
            </div>
          </div>
          
          {/* Right: Edge Badge */}
          <div className={cn(
            "px-2 py-0.5 rounded-full shrink-0",
            getEdgeBgColor(opp.edgePct)
          )}>
            <span className={cn("text-[11px] font-bold tabular-nums", getEdgeColor(opp.edgePct))}>
              +{opp.edgePct !== null ? opp.edgePct.toFixed(1) : "—"}%
            </span>
          </div>
        </div>
        
        {/* Row 2: Market */}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200 tracking-wide">
            {marketDisplay}
          </span>
          {onHide && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onHide(opp);
              }}
              className="p-1 -mr-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors"
              title="Hide this edge"
            >
              <EyeOff className="w-3 h-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300" />
            </button>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="px-3 py-2.5">
        {/* Player/Selection + Line */}
        <div className="flex items-baseline gap-1.5 mb-2.5">
          {isPlayerProp ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayerClick?.(opp);
              }}
              className="text-left"
            >
              <span className="text-[15px] font-bold text-neutral-900 dark:text-white hover:text-brand transition-colors leading-tight">
                {opp.player}
              </span>
            </button>
          ) : (
            <span className="text-[15px] font-bold text-neutral-900 dark:text-white leading-tight">
              {selectionDisplay}
            </span>
          )}
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {sideDisplay} {lineDisplay}
          </span>
        </div>
        
        {/* Action Row - Redesigned hierarchy */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Odds (informational) */}
          <div className="flex items-center gap-2">
            {bestBookLogo ? (
              <img 
                src={bestBookLogo} 
                alt={bestBookInfo?.name || opp.bestBook} 
                className="w-5 h-5 rounded object-contain"
              />
            ) : (
              <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700" />
            )}
            <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
              {formatOdds(opp.bestPrice)}
            </span>
          </div>
          
          {/* Right: Bet CTA (hero) */}
          <div className="flex items-center gap-2">
            {/* Rec Stake */}
            {recStake > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-medium">Rec</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ${recStake}
                </span>
              </div>
            )}
            
            {/* Bet Button - Hero */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBetClick?.(opp);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl",
                "bg-brand text-white text-sm font-bold",
                "shadow-lg shadow-brand/25",
                "hover:bg-brand/90 active:scale-[0.97] transition-all duration-150"
              )}
            >
              <span>BET</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {/* Expand Button */}
          <button
            type="button"
            onClick={onToggleExpand}
            className={cn(
              "p-1.5 rounded-lg transition-colors shrink-0",
              isExpanded 
                ? "bg-neutral-200 dark:bg-neutral-700" 
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            )}
          </button>
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
            <div className="px-3 py-2.5 bg-neutral-50/50 dark:bg-neutral-950/30">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  All Books
                </span>
                {opp.fairAmerican && (
                  <span className="text-[10px] text-neutral-500">
                    Fair <span className="font-bold text-neutral-700 dark:text-neutral-200 tabular-nums">{opp.fairAmerican}</span>
                  </span>
                )}
              </div>
              
              {/* Book Comparison Grid - 2 Columns */}
              <div className="grid grid-cols-2 gap-1.5">
                {opp.allBooks.map((book, idx) => {
                  const bookInfo = getSportsbookById(book.book);
                  const bookLogo = getBookLogo(book.book);
                  const isBest = book.book === opp.bestBook;
                  
                  return (
                    <button
                      key={`${book.book}-${idx}`}
                      type="button"
                      onClick={() => {
                        if (book.link) window.open(book.link, "_blank");
                      }}
                      className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-lg",
                        "transition-all duration-100 active:scale-[0.98]",
                        isBest 
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-800/60"
                          : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800"
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {bookLogo ? (
                          <img 
                            src={bookLogo} 
                            alt={bookInfo?.name || book.book} 
                            className="w-3.5 h-3.5 rounded object-contain shrink-0"
                          />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded bg-neutral-300 dark:bg-neutral-600 shrink-0" />
                        )}
                        <span className={cn(
                          "text-[11px] font-medium truncate",
                          isBest ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-600 dark:text-neutral-300"
                        )}>
                          {bookInfo?.shortName || bookInfo?.name || book.book}
                        </span>
                      </div>
                      <span className={cn(
                        "text-xs font-bold tabular-nums shrink-0 ml-1",
                        isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                      )}>
                        {formatOdds(book.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {/* Filter Badge (if custom model) */}
              {opp.filterName && (
                <div className="mt-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-neutral-400 uppercase font-semibold">Model</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                      {opp.filterName}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

