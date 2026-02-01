"use client";

import React, { useState, useMemo, useCallback } from "react";
import { X, Loader2, ExternalLink, ChevronDown, Heart } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { PlayerHeadshot } from "@/components/player-headshot";
import { useOddsLadder, type LineData } from "@/hooks/use-odds-ladder";
import { useOddsLine, type BookOddsDetail } from "@/hooks/use-odds-line";
import { useFavorites, createFavoriteKey } from "@/hooks/use-favorites";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabel } from "@/lib/data/markets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { HitRateProfile } from "@/lib/hit-rates-schema";

// =============================================================================
// TYPES
// =============================================================================

interface OddsLadderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: HitRateProfile | null;
}

// =============================================================================
// HELPERS
// =============================================================================

const formatOdds = (price: number | null): string => {
  if (price === null) return "—";
  if (price >= 0) return `+${price}`;
  return String(price);
};

const getBookLogo = (bookId: string): string | null => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};

const getBookName = (bookId: string): string => {
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

const getBookFallbackUrl = (bookId: string): string | null => {
  const sb = getSportsbookById(bookId);
  if (!sb) return null;
  return sb.affiliateLink || sb.links?.desktop || null;
};

// =============================================================================
// LINE SELECTOR COMPONENT
// =============================================================================

function LineSelector({
  lines,
  selectedLine,
  onSelectLine,
  primaryLine,
}: {
  lines: LineData[];
  selectedLine: number | null;
  onSelectLine: (line: number) => void;
  primaryLine: number | null;
}) {
  if (lines.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2">
      {lines.map((lineData) => {
        const isSelected = lineData.line === selectedLine;
        const isPrimary = lineData.line === primaryLine;
        
        return (
          <button
            key={lineData.line}
            onClick={() => onSelectLine(lineData.line)}
            className={cn(
              "relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              "border",
              isSelected
                ? "bg-brand text-white border-brand shadow-md"
                : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-brand/50 hover:bg-neutral-50 dark:hover:bg-neutral-700",
            )}
          >
            {lineData.line}
            {isPrimary && !isSelected && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// BOOK ROW COMPONENT
// =============================================================================

function BookRow({
  book,
  isBest,
  onClickOver,
  onClickUnder,
}: {
  book: BookOddsDetail;
  isBest: boolean;
  onClickOver?: () => void;
  onClickUnder?: () => void;
}) {
  const logo = getBookLogo(book.book);
  const name = getBookName(book.book);
  
  const handleOverClick = useCallback(() => {
    const link = book.link_over || getBookFallbackUrl(book.book);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
    onClickOver?.();
  }, [book, onClickOver]);
  
  const handleUnderClick = useCallback(() => {
    const link = book.link_under || getBookFallbackUrl(book.book);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
    onClickUnder?.();
  }, [book, onClickUnder]);
  
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
        isBest
          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
          : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
      )}
    >
      {/* Book info */}
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt={name} className="w-8 h-8 rounded-lg object-contain" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        )}
        <div>
          <div className="font-medium text-neutral-900 dark:text-white">{name}</div>
          {isBest && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              BEST
            </span>
          )}
        </div>
      </div>
      
      {/* Odds */}
      <div className="flex items-center gap-4">
        {/* Over */}
        <button
          onClick={handleOverClick}
          disabled={book.over === null}
          className={cn(
            "flex flex-col items-center min-w-[60px] px-3 py-1.5 rounded-lg transition-all",
            book.over !== null
              ? "hover:bg-emerald-100 dark:hover:bg-emerald-900/30 cursor-pointer"
              : "opacity-50 cursor-default"
          )}
        >
          <span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">Over</span>
          <span className={cn(
            "font-bold",
            book.over !== null && book.over >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-neutral-900 dark:text-white"
          )}>
            {formatOdds(book.over)}
          </span>
        </button>
        
        {/* Under */}
        <button
          onClick={handleUnderClick}
          disabled={book.under === null}
          className={cn(
            "flex flex-col items-center min-w-[60px] px-3 py-1.5 rounded-lg transition-all",
            book.under !== null
              ? "hover:bg-rose-100 dark:hover:bg-rose-900/30 cursor-pointer"
              : "opacity-50 cursor-default"
          )}
        >
          <span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">Under</span>
          <span className={cn(
            "font-bold",
            book.under !== null && book.under >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-neutral-900 dark:text-white"
          )}>
            {formatOdds(book.under)}
          </span>
        </button>
        
        {/* External link indicator */}
        <ExternalLink className="w-4 h-4 text-neutral-400" />
      </div>
    </div>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Line selector skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-16 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        ))}
      </div>
      
      {/* Books skeleton */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
              <div className="w-24 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
            <div className="flex gap-4">
              <div className="w-14 h-8 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="w-14 h-8 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function OddsLadderDrawer({ open, onOpenChange, row }: OddsLadderDrawerProps) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [showAllBooks, setShowAllBooks] = useState(false);
  
  // Fetch ladder data - use selKey which matches Redis key format (linesidx, booksidx)
  const {
    data: ladderData,
    isLoading: ladderLoading,
    error: ladderError,
  } = useOddsLadder({
    eventId: row?.eventId ?? null,
    market: row?.market ?? null,
    playerId: row?.selKey ?? null,
    enabled: open && !!row,
  });
  
  // Set initial selected line when ladder loads
  React.useEffect(() => {
    if (ladderData?.lines && ladderData.lines.length > 0) {
      // Try to use the row's line first, then primary_line, then first available
      const targetLine = row?.line ?? ladderData.primary_line;
      const matchingLine = ladderData.lines.find(l => l.line === targetLine);
      
      if (matchingLine) {
        setSelectedLine(matchingLine.line);
      } else {
        // Find closest line
        const sortedLines = [...ladderData.lines].sort(
          (a, b) => Math.abs(a.line - (targetLine || 0)) - Math.abs(b.line - (targetLine || 0))
        );
        setSelectedLine(sortedLines[0]?.line ?? null);
      }
    }
  }, [ladderData, row?.line]);
  
  // Fetch detailed line data when user selects a line or wants all books
  const {
    data: lineData,
    isLoading: lineLoading,
  } = useOddsLine({
    eventId: row?.eventId ?? null,
    market: row?.market ?? null,
    playerId: row?.selKey ?? null,
    line: selectedLine,
    enabled: open && !!row && selectedLine !== null && showAllBooks,
  });
  
  // Favorites
  const { favoriteKeys, toggleFavorite, isToggling } = useFavorites();
  
  // Check if current selection is favorited
  const favoriteKey = useMemo(() => {
    if (!row || selectedLine === null) return null;
    return createFavoriteKey({
      event_id: row.eventId || row.gameId || "",
      type: "player",
      player_id: String(row.playerId),
      market: row.market,
      line: selectedLine,
      side: "over",
    });
  }, [row, selectedLine]);
  
  const isFavorited = favoriteKey ? favoriteKeys.has(favoriteKey) : false;
  
  // Handle add to favorites
  const handleAddToFavorites = useCallback(async () => {
    if (!row || selectedLine === null) return;
    
    try {
      const result = await toggleFavorite({
        type: "player",
        sport: "nba",
        event_id: row.eventId || row.gameId || "",
        game_date: row.gameDate,
        home_team: row.homeTeamName,
        away_team: row.awayTeamName,
        player_id: String(row.playerId),
        player_name: row.playerName,
        player_team: row.teamAbbr || row.teamName,
        player_position: row.position,
        market: row.market,
        line: selectedLine,
        side: "over",
        odds_selection_id: row.oddsSelectionId,
        source: "odds-ladder",
      });
      
      if (result.action === "added") {
        toast.success("Added to My Plays");
      } else if (result.action === "removed") {
        toast.success("Removed from My Plays");
      }
    } catch (err: any) {
      if (err.message?.includes("logged in")) {
        toast.error("Sign in to save plays");
      } else {
        toast.error("Failed to update");
      }
    }
  }, [row, selectedLine, toggleFavorite]);
  
  // Get current line data from ladder or detailed fetch
  const currentLineData = useMemo(() => {
    if (selectedLine === null) return null;
    
    // If we have detailed line data and showAllBooks is true, use that
    if (showAllBooks && lineData) {
      return {
        line: lineData.line,
        best: lineData.best,
        books: lineData.books,
        book_count: lineData.book_count,
      };
    }
    
    // Otherwise use ladder data (top_books only)
    const ladderLine = ladderData?.lines.find(l => l.line === selectedLine);
    if (!ladderLine) return null;
    
    return {
      line: ladderLine.line,
      best: ladderLine.best,
      books: ladderLine.top_books.map(b => ({
        ...b,
        sgp_over: null,
        sgp_under: null,
      })) as BookOddsDetail[],
      book_count: ladderLine.book_count,
    };
  }, [selectedLine, ladderData, lineData, showAllBooks]);
  
  // Reset state when drawer closes
  React.useEffect(() => {
    if (!open) {
      setSelectedLine(null);
      setShowAllBooks(false);
    }
  }, [open]);
  
  const marketLabel = row?.market ? formatMarketLabel(row.market) : "";
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col" hideCloseButton>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <SheetHeader className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {row && (
                  <div 
                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm"
                    style={{ 
                      background: row.primaryColor && row.secondaryColor 
                        ? `linear-gradient(180deg, ${row.primaryColor} 0%, ${row.primaryColor} 55%, ${row.secondaryColor} 100%)`
                        : row.primaryColor || undefined 
                    }}
                  >
                    <PlayerHeadshot
                      nbaPlayerId={row.playerId}
                      name={row.playerName}
                      size="small"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <SheetTitle className="text-lg">
                    {row?.playerName || "Player"}
                  </SheetTitle>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {row?.teamAbbr || row?.teamName} • {marketLabel}
                  </p>
                </div>
              </div>
              <SheetClose className="rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="w-5 h-5" />
              </SheetClose>
            </div>
          </SheetHeader>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Loading state */}
          {ladderLoading && <LoadingSkeleton />}
          
          {/* Error state */}
          {ladderError && (
            <div className="text-center py-8">
              <p className="text-neutral-500 dark:text-neutral-400">
                Failed to load odds. Please try again.
              </p>
            </div>
          )}
          
          {/* Empty state */}
          {!ladderLoading && !ladderError && ladderData?.lines.length === 0 && (
            <div className="text-center py-8">
              <p className="text-neutral-500 dark:text-neutral-400">
                No odds available for this player.
              </p>
            </div>
          )}
          
          {/* Ladder content */}
          {!ladderLoading && ladderData && ladderData.lines.length > 0 && (
            <>
              {/* Line Selector */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Select Line
                </h3>
                <LineSelector
                  lines={ladderData.lines}
                  selectedLine={selectedLine}
                  onSelectLine={setSelectedLine}
                  primaryLine={row?.line ?? ladderData.primary_line}
                />
              </div>
              
              {/* Books for selected line */}
              {currentLineData && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                      Odds by Sportsbook
                    </h3>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {currentLineData.book_count} books
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {currentLineData.books.map((book, idx) => (
                      <BookRow
                        key={book.book}
                        book={book}
                        isBest={idx === 0 && currentLineData.best?.book === book.book}
                      />
                    ))}
                  </div>
                  
                  {/* View all books button */}
                  {!showAllBooks && currentLineData.book_count > currentLineData.books.length && (
                    <button
                      onClick={() => setShowAllBooks(true)}
                      className="w-full mt-3 py-2 text-sm font-medium text-brand hover:text-brand/80 transition-colors flex items-center justify-center gap-1"
                    >
                      {lineLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          View all {currentLineData.book_count} books
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        {row && selectedLine !== null && (
          <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 p-4">
            <button
              onClick={handleAddToFavorites}
              disabled={isToggling}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all",
                isFavorited
                  ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                  : "bg-brand text-white hover:bg-brand/90"
              )}
            >
              {isToggling ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Heart className={cn("w-5 h-5", isFavorited && "fill-current")} />
                  {isFavorited ? "Remove from My Plays" : "Add to My Plays"}
                </>
              )}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
