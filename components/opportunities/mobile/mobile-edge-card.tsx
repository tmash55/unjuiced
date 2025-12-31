"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, TrendingUp } from "lucide-react";
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
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  bankroll?: number;
  kellyPercent?: number;
}

export function MobileEdgeCard({
  opportunity,
  onBetClick,
  onPlayerClick,
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
      "bg-white dark:bg-neutral-900",
      "border-b border-neutral-200/70 dark:border-neutral-800/70",
      "transition-colors duration-150"
    )}>
      {/* Main Card Content - Always Visible */}
      <div 
        className="px-4 py-3"
        onClick={onToggleExpand}
      >
        {/* Top Row: Sport, Time, Edge Badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{getSportEmoji(opp.sport)}</span>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
              {opp.sport}
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              • {formatGameTime(opp.gameStart)}
            </span>
          </div>
          
          {/* Edge Badge */}
          <div className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full",
            getEdgeBgColor(opp.edgePct)
          )}>
            <TrendingUp className="w-3 h-3" />
            <span className={cn("text-sm font-bold", getEdgeColor(opp.edgePct))}>
              {opp.edgePct !== null ? `${opp.edgePct.toFixed(1)}%` : "—"}
            </span>
          </div>
        </div>
        
        {/* Selection & Market Row */}
        <div className="mb-3">
          {isPlayerProp ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayerClick?.(opp);
              }}
              className="text-left"
            >
              <span className="text-base font-semibold text-neutral-900 dark:text-white hover:text-brand transition-colors">
                {opp.player}
              </span>
            </button>
          ) : (
            <span className="text-base font-semibold text-neutral-900 dark:text-white">
              {selectionDisplay}
            </span>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm text-neutral-600 dark:text-neutral-300 font-medium">
              {sideDisplay} {lineDisplay}
            </span>
            <span className="text-neutral-400">•</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {marketDisplay}
            </span>
          </div>
        </div>
        
        {/* Bottom Row: Best Book, Odds, Stake, Expand */}
        <div className="flex items-center justify-between">
          {/* Best Book + Odds */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBetClick?.(opp);
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl",
                "bg-neutral-100 dark:bg-neutral-800",
                "hover:bg-neutral-200 dark:hover:bg-neutral-700",
                "active:scale-[0.98] transition-all duration-150"
              )}
            >
              {bestBookLogo ? (
                <img 
                  src={bestBookLogo} 
                  alt={bestBookInfo?.name || opp.bestBook} 
                  className="w-5 h-5 rounded object-contain"
                />
              ) : (
                <div className="w-5 h-5 rounded bg-neutral-300 dark:bg-neutral-600" />
              )}
              <span className="text-base font-bold text-neutral-900 dark:text-white">
                {formatOdds(opp.bestPrice)}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
            </button>
            
            {/* Fair Odds */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-medium text-neutral-400 uppercase">Fair</span>
              <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                {opp.fairAmerican || "—"}
              </span>
            </div>
          </div>
          
          {/* Stake + Expand */}
          <div className="flex items-center gap-3">
            {recStake > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-medium text-neutral-400 uppercase">Stake</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  ${recStake}
                </span>
              </div>
            )}
            
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Expanded Section - Book Comparison */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Divider */}
              <div className="h-px bg-neutral-200 dark:bg-neutral-800 mb-3" />
              
              {/* Book Comparison Grid */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  All Books
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  {opp.allBooks.slice(0, 6).map((book, idx) => {
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
                          "flex items-center justify-between px-3 py-2 rounded-lg",
                          "transition-colors duration-150",
                          isBest 
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                            : "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {bookLogo ? (
                            <img 
                              src={bookLogo} 
                              alt={bookInfo?.name || book.book} 
                              className="w-4 h-4 rounded object-contain"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded bg-neutral-300 dark:bg-neutral-600" />
                          )}
                          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 truncate max-w-[60px]">
                            {bookInfo?.name || book.book}
                          </span>
                        </div>
                        <span className={cn(
                          "text-sm font-bold",
                          isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-200"
                        )}>
                          {formatOdds(book.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                {opp.allBooks.length > 6 && (
                  <p className="text-xs text-neutral-400 text-center mt-2">
                    +{opp.allBooks.length - 6} more books
                  </p>
                )}
              </div>
              
              {/* Filter Badge (if custom model) */}
              {opp.filterName && (
                <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Model:</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand">
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

