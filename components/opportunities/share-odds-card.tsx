"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";

export interface ShareBookOffer {
  bookId: string;
  price: number | string | null | undefined;
}

interface ShareOddsCardProps {
  /** Player or selection name */
  playerName: string;
  /** Market label (e.g., "Points", "Rebounds") */
  market: string;
  /** Sport abbreviation */
  sport: string;
  /** Line value */
  line: number;
  /** Current side being bet */
  side: "over" | "under" | "yes" | "no";
  /** Best book ID */
  bestBookId: string;
  /** Best odds (American format string) */
  bestOdds: string;
  /** Edge percentage */
  edgePercent: number;
  /** Fair odds (American format string) */
  fairOdds?: string | null;
  /** Sharp reference odds */
  sharpOdds?: string | null;
  /** Reference/model label (e.g., "Pinnacle", "Market Average", "vs DK(PTS)") */
  referenceLabel?: string;
  /** Event matchup (e.g., "NYK @ TOR") */
  eventLabel?: string;
  /** Game time (ISO string or formatted) */
  timeLabel?: string;
  /** Over side books */
  overBooks?: ShareBookOffer[];
  /** Under side books */
  underBooks?: ShareBookOffer[];
  /** Accent color theme */
  accent?: "amber" | "emerald";
}

const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

const getBookName = (bookId?: string): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

const formatOdds = (price: number | string | null | undefined): string => {
  if (price === undefined || price === null) return "—";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (Number.isNaN(num)) return "—";
  return num > 0 ? `+${Math.round(num)}` : `${Math.round(num)}`;
};

const toNumber = (price: number | string | null | undefined): number | null => {
  if (price === undefined || price === null) return null;
  const num = typeof price === "string" ? parseFloat(price) : price;
  return Number.isNaN(num) ? null : num;
};

// Format timestamp nicely
const formatTime = (timeStr?: string): string => {
  if (!timeStr) return "";
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const timeOptions: Intl.DateTimeFormatOptions = { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    };
    const time = date.toLocaleTimeString('en-US', timeOptions);
    
    if (isToday) return `Today ${time}`;
    if (isTomorrow) return `Tomorrow ${time}`;
    
    const dateOptions: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric' 
    };
    return `${date.toLocaleDateString('en-US', dateOptions)} · ${time}`;
  } catch {
    return timeStr;
  }
};

// Check if reference is Pinnacle-based
const isPinnacleRef = (label?: string): boolean => {
  if (!label) return false;
  const lower = label.toLowerCase();
  return lower.includes("pinnacle") || lower.includes("pinn");
};

// Priority books to always show if available (besides best book)
const PRIORITY_BOOKS = ["fanduel", "draftkings", "betmgm", "caesars", "pinnacle"];

export function ShareOddsCard({
  playerName,
  market,
  sport,
  line,
  side,
  bestBookId,
  bestOdds,
  edgePercent,
  fairOdds,
  sharpOdds,
  referenceLabel = "Market Average",
  eventLabel,
  timeLabel,
  overBooks = [],
  underBooks = [],
  accent = "emerald",
}: ShareOddsCardProps) {
  // Total book count for indicator
  const totalBooks = useMemo(() => {
    const allBookIds = new Set<string>();
    overBooks.forEach((b) => allBookIds.add(b.bookId));
    underBooks.forEach((b) => allBookIds.add(b.bookId));
    return allBookIds.size;
  }, [overBooks, underBooks]);

  // Get top 4 books, prioritizing best odds + popular books
  const displayBooks = useMemo(() => {
    const allBookIds = new Set<string>();
    overBooks.forEach((b) => allBookIds.add(b.bookId));
    underBooks.forEach((b) => allBookIds.add(b.bookId));

    const rows = Array.from(allBookIds).map((bookId) => {
      const over = overBooks.find((b) => b.bookId === bookId);
      const under = underBooks.find((b) => b.bookId === bookId);
      const overNum = toNumber(over?.price) ?? -99999;
      const underNum = toNumber(under?.price) ?? -99999;
      const maxOdds = Math.max(overNum, underNum);
      const isPriority = PRIORITY_BOOKS.some(p => bookId.toLowerCase().includes(p));
      return { bookId, over, under, overNum, underNum, maxOdds, isPriority };
    });

    // Sort: best odds first, then priority books, then rest
    rows.sort((a, b) => {
      // Best odds always first
      if (a.maxOdds !== b.maxOdds) return b.maxOdds - a.maxOdds;
      // Priority books next
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      return 0;
    });

    // Take top 4, but ensure we include Pinnacle if it exists
    const top4 = rows.slice(0, 4);
    const pinnacleRow = rows.find(r => r.bookId.toLowerCase().includes("pinnacle"));
    if (pinnacleRow && !top4.includes(pinnacleRow)) {
      top4[3] = pinnacleRow; // Replace 4th with Pinnacle
    }

    return top4;
  }, [overBooks, underBooks]);

  // Find best odds for highlighting
  const bestOverOdds = useMemo(() => {
    const prices = overBooks.map((b) => toNumber(b.price)).filter((p): p is number => p !== null);
    return prices.length > 0 ? Math.max(...prices) : null;
  }, [overBooks]);

  const bestUnderOdds = useMemo(() => {
    const prices = underBooks.map((b) => toNumber(b.price)).filter((p): p is number => p !== null);
    return prices.length > 0 ? Math.max(...prices) : null;
  }, [underBooks]);

  const bestBookLogo = getBookLogo(bestBookId);
  const bestBookName = getBookName(bestBookId);
  const formattedTime = formatTime(timeLabel);
  
  // Clean up reference label (remove "vs " prefix if present)
  const cleanRefLabel = referenceLabel.replace(/^vs\s+/i, "");
  const isPinnacle = isPinnacleRef(referenceLabel);
  const pinnacleLogoUrl = getBookLogo("pinnacle");

  const remainingBooks = totalBooks - displayBooks.length;

  return (
    <div 
      className="w-[min(400px,calc(100vw-2rem))] bg-[#0a0a0a] text-white overflow-hidden"
    >
      {/* Gradient accent bar */}
      <div className={cn(
        "h-1.5 w-full",
        accent === "emerald" 
          ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400"
          : "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500"
      )} />

      {/* Header - Sport & Event Context */}
      <div className="px-4 sm:px-5 pt-3 sm:pt-4 pb-1.5 sm:pb-2">
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-neutral-400 font-medium uppercase tracking-wider">
          <span>{sport}</span>
          <span className="text-neutral-600">•</span>
          <span className="truncate">{market}</span>
        </div>
        {(eventLabel || formattedTime) && (
          <div className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5 sm:mt-1">
            {eventLabel}{eventLabel && formattedTime ? " · " : ""}{formattedTime}
          </div>
        )}
      </div>

      {/* Player Name - Hero */}
      <div className="px-4 sm:px-5 pb-2 sm:pb-3">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{playerName}</h1>
        <div className="text-xs sm:text-sm text-neutral-400 mt-0.5">
          {side === "over" ? "Over" : side === "under" ? "Under" : side === "yes" ? "Yes" : "No"} {line}
        </div>
      </div>

      {/* Edge Indicator */}
      <div className="mx-4 sm:mx-5 mb-2 sm:mb-3 p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {bestBookLogo ? (
              <img src={bestBookLogo} alt={bestBookName} className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-contain" />
            ) : (
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-neutral-800 flex items-center justify-center text-xs font-bold">
                {bestBookName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-base sm:text-lg font-bold">{bestOdds}</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-500">{bestBookName}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={cn(
              "text-lg sm:text-xl font-black tabular-nums",
              accent === "emerald" ? "text-emerald-400" : "text-amber-400"
            )}>
              +{edgePercent.toFixed(1)}%
            </div>
            <div className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wide">Edge</div>
          </div>
        </div>
      </div>

      {/* Reference Section */}
      <div className="mx-4 sm:mx-5 mb-2 sm:mb-3 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-neutral-900/60 border border-neutral-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider font-medium">Reference</span>
            {isPinnacle && pinnacleLogoUrl && (
              <div className="flex items-center gap-1">
                <img 
                  src={pinnacleLogoUrl} 
                  alt="Pinnacle" 
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 object-contain opacity-70 grayscale" 
                />
                <span className="text-[8px] sm:text-[9px] text-neutral-600 uppercase">Sharp</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[11px] sm:text-[12px] text-neutral-300">
              {!isPinnacle && <span className="text-neutral-500 mr-1">{cleanRefLabel} ·</span>}
              {fairOdds && <span className="font-semibold">Fair: {fairOdds}</span>}
            </div>
            {sharpOdds && (
              <div className="text-[9px] sm:text-[10px] text-neutral-500 mt-0.5">
                Sharp{isPinnacle ? " (Pinnacle)" : ""}: {sharpOdds}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Odds Comparison - Top 4 books only */}
      <div className="mx-4 sm:mx-5 pb-1">
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-1 sm:mb-1.5 px-1">
          <span>Over {line}</span>
          <span>Book</span>
          <span>Under {line}</span>
        </div>
        
        <div className="space-y-0.5 sm:space-y-1">
          {displayBooks.map((row) => {
            const logo = getBookLogo(row.bookId);
            const isOverBest = row.overNum === bestOverOdds && bestOverOdds !== null;
            const isUnderBest = row.underNum === bestUnderOdds && bestUnderOdds !== null;
            const hasBestOdds = isOverBest || isUnderBest;
            
            return (
              <div 
                key={row.bookId} 
                className={cn(
                  "grid grid-cols-[1fr_28px_1fr] sm:grid-cols-[1fr_32px_1fr] items-center gap-1 py-0.5 sm:py-1 px-1.5 sm:px-2 rounded-lg bg-neutral-900/40",
                  !hasBestOdds && "opacity-70"
                )}
              >
                {/* Over odds */}
                <div className={cn(
                  "text-[11px] sm:text-[12px] font-semibold tabular-nums text-left",
                  isOverBest ? "text-emerald-400" : "text-neutral-500"
                )}>
                  {formatOdds(row.over?.price)}
                </div>
                
                {/* Book logo */}
                <div className="flex items-center justify-center">
                  {logo ? (
                    <img src={logo} alt={row.bookId} className="h-4 w-4 sm:h-5 sm:w-5 object-contain" />
                  ) : (
                    <span className="text-[7px] sm:text-[8px] text-neutral-600 font-medium">{row.bookId.slice(0, 3)}</span>
                  )}
                </div>
                
                {/* Under odds */}
                <div className={cn(
                  "text-[11px] sm:text-[12px] font-semibold tabular-nums text-right",
                  isUnderBest ? "text-blue-400" : "text-neutral-500"
                )}>
                  {formatOdds(row.under?.price)}
                </div>
              </div>
            );
          })}
        </div>

        {/* More books indicator */}
        {remainingBooks > 0 && (
          <div className="text-center text-[10px] sm:text-[11px] text-neutral-500 mt-1.5 sm:mt-2">
            +{remainingBooks} more book{remainingBooks !== 1 ? "s" : ""} · {totalBooks} total
          </div>
        )}
      </div>

      {/* Footer - Branding */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-center border-t border-neutral-800/50 mt-2">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Unjuiced" className="h-4 w-4 sm:h-5 sm:w-5 object-contain opacity-80" />
          <span className="text-[11px] sm:text-xs font-semibold text-neutral-300">unjuiced.bet</span>
        </div>
      </div>
    </div>
  );
}
