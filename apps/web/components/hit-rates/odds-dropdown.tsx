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

  // Loading state (initial)
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
    );
  }

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
      {/* Minimal trigger — ghost pill with brand accent on hover */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isFetchingFreshOdds}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums transition-all",
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          "hover:bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]",
          isOpen && "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-[var(--primary)]",
          isFetchingFreshOdds && "opacity-60"
        )}
      >
        {isFetchingFreshOdds ? (
          <Loader2 className="h-4 w-4 animate-spin opacity-50" />
        ) : (
          <>
            {bestBookLogo && (
              <img
                src={bestBookLogo}
                alt={bestBookName}
                className="h-5 w-5 rounded-sm object-contain"
              />
            )}
            <span>{formatOdds(displayBestOdds?.price ?? null)}</span>
          </>
        )}
        <ChevronDown className={cn(
          "h-3.5 w-3.5 opacity-40 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown panel — compact, brand-aware, responsive */}
      {isOpen && (
        <div className="absolute right-0 top-full z-[70] mt-1 w-[280px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_60%,var(--card))]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Line {line}
            </span>
            {oddsData && (
              <span className="text-[10px] font-medium text-[var(--text-muted)]">
                {oddsData.book_count} books
              </span>
            )}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="py-4 text-center text-xs text-[var(--text-muted)]">
              {error}
            </div>
          )}

          {/* Books list */}
          {!isLoading && !error && sortedBooks.length > 0 && (
            <div className="max-h-[220px] overflow-y-auto scrollbar-thin">
              {/* Column headers */}
              <div className="flex items-center justify-between px-3 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-[var(--text-muted)] sticky top-0 bg-[var(--card)]">
                <span>Book</span>
                <div className="flex">
                  <span className="w-14 text-center">Over</span>
                  <span className="w-14 text-center">Under</span>
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
                      "flex items-center justify-between px-3 py-1.5 transition-colors",
                      isBest
                        ? "bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]"
                        : "hover:bg-[color-mix(in_oklab,var(--primary)_4%,transparent)]"
                    )}
                  >
                    {/* Book info */}
                    <div className="flex items-center gap-2 min-w-0">
                      {bookLogo ? (
                        <img
                          src={bookLogo}
                          alt={bookName}
                          className="h-4 w-4 rounded-sm object-contain flex-shrink-0"
                        />
                      ) : (
                        <div className="h-4 w-4 rounded-sm bg-neutral-200 dark:bg-neutral-700 flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {bookName}
                      </span>
                      {isBest && (
                        <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                          Best
                        </span>
                      )}
                    </div>

                    {/* Over/Under prices */}
                    <div className="flex">
                      <button
                        onClick={(e) => handleBookClick(book, "over", e)}
                        disabled={book.over === null || !hasOverLink}
                        className={cn(
                          "w-14 py-1 rounded text-xs font-semibold tabular-nums transition-colors flex items-center justify-center gap-0.5",
                          book.over !== null && hasOverLink
                            ? "cursor-pointer hover:bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
                            : "opacity-30 cursor-default",
                          isBest && book.over !== null
                            ? "text-[var(--accent-strong)]"
                            : "text-[var(--text-primary)]"
                        )}
                        title={hasOverLink ? "Click to place bet" : undefined}
                      >
                        {formatOdds(book.over)}
                        {hasOverLink && <ExternalLink className="w-2.5 h-2.5 opacity-40" />}
                      </button>

                      <button
                        onClick={(e) => handleBookClick(book, "under", e)}
                        disabled={book.under === null || !hasUnderLink}
                        className={cn(
                          "w-14 py-1 rounded text-xs font-semibold tabular-nums transition-colors flex items-center justify-center gap-0.5",
                          book.under !== null && hasUnderLink
                            ? "cursor-pointer hover:bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]"
                            : "opacity-30 cursor-default",
                          "text-[var(--text-primary)]"
                        )}
                        title={hasUnderLink ? "Click to place bet" : undefined}
                      >
                        {formatOdds(book.under)}
                        {hasUnderLink && <ExternalLink className="w-2.5 h-2.5 opacity-40" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state - show best odds as fallback */}
          {!isLoading && !error && sortedBooks.length === 0 && oddsData && (
            <div className="p-3">
              {bestOdds ? (
                <div className="flex items-center justify-between rounded-lg px-2.5 py-2 bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]">
                  <div className="flex items-center gap-2">
                    {getBookLogo(bestOdds.book) ? (
                      <img
                        src={getBookLogo(bestOdds.book)!}
                        alt={getBookName(bestOdds.book)}
                        className="h-4 w-4 rounded-sm object-contain"
                      />
                    ) : (
                      <div className="h-4 w-4 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
                    )}
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {getBookName(bestOdds.book)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = getBookFallbackUrl(bestOdds.book);
                      if (link) window.open(link, "_blank", "noopener,noreferrer");
                    }}
                    className="px-2 py-1 rounded text-xs font-semibold tabular-nums transition-colors flex items-center gap-1 cursor-pointer hover:bg-[color-mix(in_oklab,var(--accent)_15%,transparent)]"
                    style={{ color: "var(--accent-strong)" }}
                  >
                    {formatOdds(bestOdds.price)}
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </button>
                </div>
              ) : (
                <p className="text-center text-xs text-[var(--text-muted)]">No odds available</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
