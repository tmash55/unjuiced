"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// =============================================================================
// TYPES
// =============================================================================

// Simple best odds structure from the main API
interface SimpleBestOdds {
  book: string;
  price: number;
  updated_at: number;
}

// Book odds from the API
interface BookOddsDetail {
  book: string;
  over: number | null;
  under: number | null;
  link_over?: string | null;
  link_under?: string | null;
}

interface OddsLineResponse {
  line: number;
  best: {
    book: string;
    over: number | null;
    under: number | null;
  } | null;
  books: BookOddsDetail[];
  book_count: number;
  updated_at: number;
}

interface OddsDropdownProps {
  // Row data for fetching odds
  eventId?: string | null;
  market?: string | null;
  selKey?: string | null;
  line?: number | null;
  // Fallback: simple best odds from the main API when full odds aren't loaded
  bestOdds?: SimpleBestOdds | null;
  // Loading state for initial data
  loading?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

const formatOdds = (price: number | null): string => {
  if (price === null) return "—";
  if (price >= 0) return `+${price}`;
  return String(price);
};

const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};

const getBookName = (bookId?: string): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

const getBookFallbackUrl = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  if (!sb) return null;
  return sb.affiliateLink || sb.links?.desktop || null;
};

// =============================================================================
// COMPONENT
// =============================================================================

export function OddsDropdown({ 
  eventId, 
  market, 
  selKey, 
  line, 
  bestOdds, 
  loading: initialLoading 
}: OddsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oddsData, setOddsData] = useState<OddsLineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  // Detect if user is on mobile device
  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Extract player UUID from selKey (e.g., "uuid:over:20.5" -> "uuid")
  const playerId = useMemo(() => {
    if (!selKey) return null;
    return selKey.includes(':') ? selKey.split(':')[0] : selKey;
  }, [selKey]);

  // Fetch odds - called on mount to show fresh odds immediately
  const fetchOdds = useCallback(async () => {
    if (!eventId || !market || !playerId || line === null || line === undefined) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        event_id: eventId,
        market: market,
        player_id: playerId,
        line: String(line),
      });

      const response = await fetch(`/api/nba/props/odds-line?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch odds");
      }

      const data: OddsLineResponse = await response.json();
      setOddsData(data);
      hasFetched.current = true;
    } catch (err) {
      setError("Failed to load odds");
      console.error("[OddsDropdown] Error fetching odds:", err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, market, playerId, line]);

  // Fetch odds on mount to show fresh odds in the button immediately
  useEffect(() => {
    if (!hasFetched.current && eventId && market && playerId && line !== null && line !== undefined) {
      fetchOdds();
    }
  }, [eventId, market, playerId, line, fetchOdds]);

  // Handle toggle - just open/close, odds already fetched
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  }, [isOpen]);

  // Handle book click - open link
  const handleBookClick = useCallback((book: BookOddsDetail, side: "over" | "under", e: React.MouseEvent) => {
    e.stopPropagation();
    
    const link = side === "over" 
      ? (book.link_over || getBookFallbackUrl(book.book))
      : (book.link_under || getBookFallbackUrl(book.book));
    
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  }, []);

  // Loading state (initial)
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
    );
  }

  // Sort books by best over price
  const sortedBooks = useMemo(() => {
    if (!oddsData?.books) return [];
    return [...oddsData.books].sort((a, b) => {
      const aPrice = a.over ?? a.under ?? -Infinity;
      const bPrice = b.over ?? b.under ?? -Infinity;
      return bPrice - aPrice;
    });
  }, [oddsData?.books]);

  // Use the actual best odds from detailed data if available, otherwise fall back to summary
  const displayBestOdds = useMemo(() => {
    // If we have fetched detailed data, use the actual best from that
    if (sortedBooks.length > 0) {
      const actualBest = sortedBooks[0];
      const bestPrice = actualBest.over ?? actualBest.under;
      if (bestPrice !== null) {
        return {
          book: actualBest.book,
          price: bestPrice,
        };
      }
    }
    // Fall back to the summary bestOdds from the API
    return bestOdds;
  }, [sortedBooks, bestOdds]);

  // Show loading state while fetching fresh odds
  const isFetchingFreshOdds = isLoading && !hasFetched.current;

  // No best odds available at all (and not loading)
  if (!isFetchingFreshOdds && !displayBestOdds?.book && !displayBestOdds?.price) {
    return (
      <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
    );
  }

  const bestBookLogo = displayBestOdds ? getBookLogo(displayBestOdds.book) : null;
  const bestBookName = displayBestOdds ? getBookName(displayBestOdds.book) : "";

  return (
    <div ref={dropdownRef} className="relative inline-flex">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isFetchingFreshOdds}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-all",
          "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700",
          "text-neutral-900 dark:text-white",
          isFetchingFreshOdds && "opacity-70"
        )}
      >
        {isFetchingFreshOdds ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            <span className="text-neutral-400">...</span>
          </>
        ) : (
          <>
            {bestBookLogo && (
              <img
                src={bestBookLogo}
                alt={bestBookName}
                className="h-4 w-4 rounded object-contain"
              />
            )}
            <span>{formatOdds(displayBestOdds?.price ?? null)}</span>
          </>
        )}
        <ChevronDown className={cn(
          "h-3.5 w-3.5 opacity-50 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-[70] mt-1 min-w-[320px] rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
          {/* Header */}
          <div className="mb-2 px-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
            <span>Line: {line}</span>
            {oddsData && (
              <span>{oddsData.book_count} books</span>
            )}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="py-4 text-center text-sm text-neutral-500">
              {error}
            </div>
          )}

          {/* Books list */}
          {!isLoading && !error && sortedBooks.length > 0 && (
            <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
              {/* Column headers */}
              <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-700 mb-1">
                <span>Sportsbook</span>
                <div className="flex gap-2">
                  <span className="min-w-[60px] text-center">Over</span>
                  <span className="min-w-[60px] text-center">Under</span>
                </div>
              </div>

              {sortedBooks.map((book, idx) => {
                const bookLogo = getBookLogo(book.book);
                const bookName = getBookName(book.book);
                const isBest = idx === 0;
                const hasOverLink = book.over !== null && (book.link_over || getBookFallbackUrl(book.book));
                const hasUnderLink = book.under !== null && (book.link_under || getBookFallbackUrl(book.book));
                
                return (
                  <div
                    key={book.book}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2 py-1.5 transition-colors",
                      isBest && "bg-emerald-50 dark:bg-emerald-900/20"
                    )}
                  >
                    {/* Book info */}
                    <div className="flex items-center gap-2 min-w-0">
                      {bookLogo ? (
                        <img
                          src={bookLogo}
                          alt={bookName}
                          className="h-5 w-5 rounded object-contain flex-shrink-0"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">
                        {bookName}
                      </span>
                      {isBest && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                          Best
                        </span>
                      )}
                    </div>

                    {/* Over/Under prices */}
                    <div className="flex gap-2">
                      {/* Over */}
                      <button
                        onClick={(e) => handleBookClick(book, "over", e)}
                        disabled={book.over === null || !hasOverLink}
                        className={cn(
                          "min-w-[60px] px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1",
                          book.over !== null && hasOverLink
                            ? "hover:bg-emerald-100 dark:hover:bg-emerald-900/30 cursor-pointer"
                            : "opacity-40 cursor-default",
                          book.over !== null && book.over >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-700 dark:text-neutral-300"
                        )}
                        title={hasOverLink ? "Click to place bet" : undefined}
                      >
                        {formatOdds(book.over)}
                        {hasOverLink && <ExternalLink className="w-3 h-3 opacity-60" />}
                      </button>

                      {/* Under */}
                      <button
                        onClick={(e) => handleBookClick(book, "under", e)}
                        disabled={book.under === null || !hasUnderLink}
                        className={cn(
                          "min-w-[60px] px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1",
                          book.under !== null && hasUnderLink
                            ? "hover:bg-rose-100 dark:hover:bg-rose-900/30 cursor-pointer"
                            : "opacity-40 cursor-default",
                          book.under !== null && book.under >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-700 dark:text-neutral-300"
                        )}
                        title={hasUnderLink ? "Click to place bet" : undefined}
                      >
                        {formatOdds(book.under)}
                        {hasUnderLink && <ExternalLink className="w-3 h-3 opacity-60" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state - show best odds as fallback */}
          {!isLoading && !error && sortedBooks.length === 0 && oddsData && (
            <div className="py-3 px-2">
              {bestOdds ? (
                <div className="flex items-center justify-between rounded-md px-2 py-2 bg-emerald-50 dark:bg-emerald-900/20">
                  <div className="flex items-center gap-2">
                    {getBookLogo(bestOdds.book) ? (
                      <img
                        src={getBookLogo(bestOdds.book)!}
                        alt={getBookName(bestOdds.book)}
                        className="h-5 w-5 rounded object-contain"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700" />
                    )}
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {getBookName(bestOdds.book)}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                      Best
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = getBookFallbackUrl(bestOdds.book);
                      if (link) window.open(link, "_blank", "noopener,noreferrer");
                    }}
                    className="min-w-[60px] px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 cursor-pointer text-emerald-600 dark:text-emerald-400"
                  >
                    {formatOdds(bestOdds.price)}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-neutral-500">No odds available</p>
              )}
              <p className="mt-2 text-center text-[10px] text-neutral-400">
                Full book comparison unavailable
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
