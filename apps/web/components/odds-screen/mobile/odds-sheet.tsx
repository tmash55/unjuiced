"use client";

import React, { useMemo } from "react";
import { X, ExternalLink, Star, ChevronRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import type { OddsScreenItem, OddsScreenEvent, OddsPrice } from "../types/odds-screen-types";
import { getSportsbookById, getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { useFavorites, AddFavoriteParams, BookSnapshot } from "@/hooks/use-favorites";

interface OddsSheetProps {
  item: OddsScreenItem;
  side: "over" | "under";
  sport: string;
  market: string;
  event: OddsScreenEvent;
  isOpen: boolean;
  onClose: () => void;
}

// Format American odds
function formatOdds(price: number | undefined | null): string {
  if (price === undefined || price === null) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
}

// Format line (e.g., o4.5, u4.5) - returns empty for moneyline/yes-no (line = 0)
function formatLine(side: "over" | "under", line: number | undefined): string {
  if (line === undefined || line === 0) return "";
  const prefix = side === "over" ? "o" : "u";
  return `${prefix}${line}`;
}

// Get sportsbook logo
function getBookLogo(bookId: string): string | null {
  const book = getSportsbookById(bookId);
  return book?.image?.square || book?.image?.light || null;
}

// Get sportsbook name
function getBookName(bookId: string): string {
  const book = getSportsbookById(bookId);
  return book?.name || bookId;
}

interface BookOdds {
  bookId: string;
  name: string;
  logo: string | null;
  price: number;
  line: number;
  link?: string | null;
  mobileLink?: string | null;
  sgp?: string | null;
  isBest: boolean;
}

export function OddsSheet({ item, side, sport, market, event, isOpen, onClose }: OddsSheetProps) {
  // Favorites hook
  const { toggleFavorite, isFavorited, isToggling, isLoggedIn } = useFavorites();

  // Get best odds for this side
  const bestOdds = item.odds?.best?.[side];

  // Collect all book odds for this side (filtered to matching line only)
  const bookOddsList = useMemo<BookOdds[]>(() => {
    if (!item.odds?.books) return [];

    // Get the target line we're showing (from best odds)
    const targetLine = bestOdds?.line;

    const result: BookOdds[] = [];

    // Iterate through all books in the odds data
    Object.entries(item.odds.books).forEach(([bookId, bookData]) => {
      const sideOdds = bookData?.[side];
      if (!sideOdds?.price) return;

      // Only include books that match the target line
      // Different lines are different bets and shouldn't be mixed
      if (targetLine !== undefined && sideOdds.line !== targetLine) return;

      const bookMeta = getSportsbookById(bookId);
      
      result.push({
        bookId,
        name: bookMeta?.name || bookId,
        logo: getBookLogo(bookId),
        price: sideOdds.price,
        line: sideOdds.line,
        link: sideOdds.link,
        mobileLink: sideOdds.mobileLink,
        sgp: sideOdds.sgp,
        isBest: bestOdds?.book === bookId && bestOdds?.price === sideOdds.price,
      });
    });

    // Sort by price (best odds first - for positive odds, higher is better; for negative odds, less negative is better)
    result.sort((a, b) => {
      // Convert to implied probability for comparison
      // Higher price is better for both positive and negative odds
      return b.price - a.price;
    });

    return result;
  }, [item.odds, side, bestOdds]);

  // Build favorite params
  const buildFavoriteParams = useMemo((): AddFavoriteParams | null => {
    if (!bestOdds) return null;

    const isPlayer = item.entity?.type === "player";
    
    // Build books snapshot
    const booksSnapshot: Record<string, BookSnapshot> = {};
    bookOddsList.forEach((book) => {
      booksSnapshot[book.bookId] = {
        price: book.price,
        u: book.link || null,
        m: book.mobileLink || null,
        sgp: book.sgp || null,
      };
    });

    return {
      type: isPlayer ? "player" : "game",
      sport,
      event_id: event.id || "",
      game_date: event.startTime?.split("T")[0] || null,
      home_team: event.homeTeam || null,
      away_team: event.awayTeam || null,
      start_time: event.startTime || null,
      player_id: isPlayer ? item.entity?.id || null : null,
      player_name: isPlayer ? item.entity?.name || null : null,
      player_team: item.entity?.team || null,
      player_position: item.entity?.details || null,
      market,
      line: bestOdds.line ?? null,
      side,
      books_snapshot: booksSnapshot,
      best_price_at_save: bestOdds.price ?? null,
      best_book_at_save: bestOdds.book || null,
      source: "mobile_odds",
    };
  }, [item, side, sport, market, event, bestOdds, bookOddsList]);

  // Check if currently favorited
  const isCurrentlyFavorited = useMemo(() => {
    if (!buildFavoriteParams) return false;
    return isFavorited({
      event_id: buildFavoriteParams.event_id,
      type: buildFavoriteParams.type,
      market: buildFavoriteParams.market,
      side: buildFavoriteParams.side,
      line: buildFavoriteParams.line,
      player_id: buildFavoriteParams.player_id,
    });
  }, [buildFavoriteParams, isFavorited]);

  // Handle favorite toggle
  const handleFavoriteToggle = () => {
    if (!isLoggedIn || !buildFavoriteParams) return;
    toggleFavorite(buildFavoriteParams);
  };

  // Handle clicking on a book row
  const handleBookClick = (book: BookOdds) => {
    // Prefer mobile link on mobile devices
    const link = book.mobileLink || book.link;
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 rounded-t-3xl max-h-[85vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {item.entity.name}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {/* Hide "Over/Under 0" for moneyline/yes-no markets */}
                    {bestOdds?.line !== 0 && bestOdds?.line !== undefined && (
                      <>{side === "over" ? "Over" : "Under"} {bestOdds.line} • </>
                    )}
                    {bookOddsList.length} sportsbook{bookOddsList.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Favorite Button */}
                  <button
                    onClick={handleFavoriteToggle}
                    disabled={isToggling || !buildFavoriteParams}
                    className={cn(
                      "p-2.5 rounded-xl transition-all active:scale-[0.95]",
                      isCurrentlyFavorited
                        ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-red-400",
                      (isToggling || !buildFavoriteParams) && "opacity-50 cursor-not-allowed"
                    )}
                    title={isCurrentlyFavorited ? "Remove from My Plays" : "Add to My Plays"}
                  >
                    <Heart className={cn("w-5 h-5", isCurrentlyFavorited && "fill-current")} />
                  </button>
                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors active:scale-[0.95]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Book List */}
            <div className="overflow-y-auto max-h-[60vh] pb-safe">
              {bookOddsList.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-neutral-500 dark:text-neutral-400">
                    No odds available for this selection
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {bookOddsList.map((book, index) => (
                    <button
                      key={book.bookId}
                      onClick={() => handleBookClick(book)}
                      disabled={!book.link && !book.mobileLink}
                      className={cn(
                        "w-full px-5 py-4 flex items-center justify-between transition-colors",
                        (book.link || book.mobileLink)
                          ? "active:bg-neutral-50 dark:active:bg-neutral-800"
                          : "cursor-default"
                      )}
                    >
                      {/* Left: Book Info */}
                      <div className="flex items-center gap-3">
                        {/* Rank Badge */}
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                          index === 0 
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                        )}>
                          {index + 1}
                        </div>

                        {/* Book Logo */}
                        {book.logo ? (
                          <img
                            src={book.logo}
                            alt={book.name}
                            className="w-8 h-8 rounded-lg object-contain"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-500">
                            {book.name.charAt(0)}
                          </div>
                        )}

                        {/* Book Name */}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-medium text-neutral-900 dark:text-white">
                              {book.name}
                            </span>
                            {book.isBest && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
                                Best
                              </span>
                            )}
                          </div>
                          {/* Always reserve space for "Open in app" to maintain alignment */}
                          <span className={cn(
                            "text-xs flex items-center gap-1 h-4",
                            (book.link || book.mobileLink) ? "text-neutral-400" : "text-transparent"
                          )}>
                            <ExternalLink className="w-3 h-3" />
                            Open in app
                          </span>
                        </div>
                      </div>

                      {/* Right: Odds */}
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "px-3 py-2 rounded-xl text-right min-w-[72px]",
                          book.isBest
                            ? "bg-emerald-100 dark:bg-emerald-900/30"
                            : "bg-neutral-100 dark:bg-neutral-800"
                        )}>
                          <div className={cn(
                            "text-lg font-bold tabular-nums",
                            book.isBest
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-neutral-900 dark:text-white"
                          )}>
                            {formatOdds(book.price)}
                          </div>
                          {formatLine(side, book.line) && (
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">
                              {formatLine(side, book.line)}
                            </div>
                          )}
                        </div>

                        {/* Always render chevron to maintain alignment, but invisible when no link */}
                        <ChevronRight className={cn(
                          "w-5 h-5",
                          (book.link || book.mobileLink) ? "text-neutral-400" : "text-transparent"
                        )} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Safe area padding for bottom */}
            <div className="h-safe-area-inset-bottom" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
