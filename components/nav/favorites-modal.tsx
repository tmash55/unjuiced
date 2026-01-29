"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import { useFavorites, Favorite } from "@/hooks/use-favorites";
import { useBetslips, Betslip, getColorClass, BETSLIP_COLORS } from "@/hooks/use-betslips";
import { HeartFill } from "@/components/icons/heart-fill";
import { Heart } from "@/components/icons/heart";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { X, ChevronRight, ChevronDown, Loader2, Sparkles, Share2, Trash2, Check, Copy, MessageCircle, Link2, AlertTriangle, Flame, Star, TrendingUp, Zap, Plus, MoreVertical, Layers, BookmarkIcon, ArrowRight, Trophy, Info, RefreshCw, ExternalLink } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
import { formatMarketLabelShort } from "@/lib/data/markets";
import { getSportsbookById, sportsbooksNew } from "@/lib/data/sportsbooks";

// Helper to format side display
const formatSide = (side: string): string => {
  if (side === "over" || side === "o") return "o";
  if (side === "under" || side === "u") return "u";
  if (side === "yes") return "y";
  if (side === "no") return "n";
  return side.charAt(0).toLowerCase();
};

// Helper to format odds
const formatOdds = (price: number | null): string => {
  if (price === null) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
};

// Get first initial from name
const getInitials = (name: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Get a consistent color based on name
const getAvatarColor = (name: string | null): string => {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-amber-500",
    "from-pink-500 to-rose-500",
    "from-indigo-500 to-blue-600",
  ];
  if (!name) return colors[0];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Get sportsbook logo
const getBookLogo = (bookId?: string | null): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

// Map sport strings to SportIcon format
const normalizeSport = (sport: string | null): string => {
  if (!sport) return "nba";
  const sportMap: Record<string, string> = {
    nba: "basketball_nba",
    nfl: "americanfootball_nfl",
    nhl: "icehockey_nhl",
    mlb: "baseball_mlb",
    ncaab: "basketball_ncaab",
    ncaaf: "americanfootball_ncaaf",
    soccer_epl: "soccer_epl",
  };
  return sportMap[sport.toLowerCase()] || sport;
};

// Get all unique books from favorites with coverage info
const getUniqueBooks = (favorites: Favorite[]): string[] => {
  const books = new Set<string>();
  favorites.forEach(fav => {
    if (fav.books_snapshot) {
      Object.keys(fav.books_snapshot).forEach(book => books.add(book));
    }
    if (fav.best_book_at_save) {
      books.add(fav.best_book_at_save);
    }
  });
  return Array.from(books);
};

// Get book with best coverage (most legs available)
const getBestCoverageBook = (favorites: Favorite[], books: string[]): string | null => {
  if (books.length === 0) return null;
  let bestBook = books[0];
  let bestCount = 0;
  
  books.forEach(book => {
    const count = favorites.filter(f => f.books_snapshot?.[book]).length;
    if (count > bestCount) {
      bestCount = count;
      bestBook = book;
    }
  });
  
  return bestBook;
};

// Calculate parlay odds for a book
const calculateParlayOdds = (favorites: Favorite[], bookId: string): { odds: number; legCount: number } | null => {
  let totalDecimal = 1;
  let legCount = 0;
  
  for (const fav of favorites) {
    const bookData = fav.books_snapshot?.[bookId];
    if (bookData?.price) {
      // Convert American to decimal
      const american = bookData.price;
      const decimal = american > 0 ? 1 + (american / 100) : 1 + (100 / Math.abs(american));
      totalDecimal *= decimal;
      legCount++;
    }
  }
  
  if (legCount === 0) return null;
  
  // Convert back to American
  const americanOdds = totalDecimal >= 2 
    ? Math.round((totalDecimal - 1) * 100)
    : Math.round(-100 / (totalDecimal - 1));
  
  return { odds: americanOdds, legCount };
};

// Get all books across all favorites with coverage info
const getAllBooksWithCoverage = (favorites: Favorite[]) => {
  const bookMap = new Map<string, { hasAll: boolean; legCount: number; totalLegs: number; odds: number | null }>();
  
  // First pass: count legs per book
  for (const fav of favorites) {
    if (fav.books_snapshot) {
      for (const [bookId, bookData] of Object.entries(fav.books_snapshot)) {
        if (!bookMap.has(bookId)) {
          bookMap.set(bookId, { hasAll: false, legCount: 0, totalLegs: favorites.length, odds: null });
        }
        const entry = bookMap.get(bookId)!;
        if (bookData?.price) {
          entry.legCount++;
        }
      }
    }
  }
  
  // Second pass: calculate odds for each book
  for (const [bookId, entry] of bookMap.entries()) {
    const result = calculateParlayOdds(favorites, bookId);
    entry.odds = result?.odds ?? null;
    entry.hasAll = entry.legCount === favorites.length;
  }
  
  // Sort: complete books with best odds first, then partial books
  return Array.from(bookMap.entries())
    .map(([bookId, data]) => ({ bookId, ...data }))
    .sort((a, b) => {
      if (a.hasAll && !b.hasAll) return -1;
      if (!a.hasAll && b.hasAll) return 1;
      if (a.hasAll && b.hasAll) {
        return (b.odds || 0) - (a.odds || 0);
      }
      return b.legCount - a.legCount;
    });
};

// Sportsbook Selector Dropdown (like competitor - dark theme)
function SportsbookSelector({
  favorites,
  selectedBook,
  onSelectBook,
  isExpanded,
  onToggleExpand
}: {
  favorites: Favorite[];
  selectedBook: string | null;
  onSelectBook: (bookId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const booksWithCoverage = useMemo(() => getAllBooksWithCoverage(favorites), [favorites]);
  const selectedBookData = booksWithCoverage.find(b => b.bookId === selectedBook);
  const bookMeta = selectedBook ? getSportsbookById(selectedBook) : null;
  const bookLogo = bookMeta?.image?.square || bookMeta?.image?.light;
  
  // Get complete books (books with all legs)
  const completeBooks = booksWithCoverage.filter(b => b.hasAll);
  const partialBooks = booksWithCoverage.filter(b => !b.hasAll);
  
  if (favorites.length === 0) return null;
  
  return (
    <div className="bg-neutral-900 dark:bg-neutral-900 border-b border-white/5">
      {/* Selected Book Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium text-neutral-400">Sportsbooks</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedBook && bookLogo && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5">
              <Image src={bookLogo} alt={selectedBook} width={20} height={20} className="w-5 h-5 rounded" />
              <span className="text-xs font-semibold text-neutral-300">
                {selectedBookData?.legCount}/{favorites.length}
              </span>
              {selectedBookData?.odds && (
                <span className={cn(
                  "text-sm font-bold tabular-nums",
                  selectedBookData.odds >= 0 ? "text-emerald-400" : "text-neutral-300"
                )}>
                  {formatOdds(selectedBookData.odds)}
                </span>
              )}
            </div>
          )}
          <ChevronDown className={cn(
            "w-4 h-4 text-neutral-500 transition-transform",
            isExpanded && "rotate-180"
          )} />
        </div>
      </button>
      
      {/* Expanded Dropdown */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="py-2 px-3 max-h-[280px] overflow-y-auto bg-neutral-800/50">
              {/* Complete Books Section */}
              {completeBooks.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-semibold text-emerald-400 px-2 mb-1 uppercase tracking-wider">
                    All Legs Available
                  </div>
                  {completeBooks.map(book => {
                    const meta = getSportsbookById(book.bookId);
                    const logo = meta?.image?.square || meta?.image?.light;
                    const isSelected = selectedBook === book.bookId;
                    
                    return (
                      <button
                        key={book.bookId}
                        onClick={() => onSelectBook(book.bookId)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all",
                          isSelected 
                            ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" 
                            : "hover:bg-white/[0.03]"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          {logo && (
                            <Image src={logo} alt={book.bookId} width={24} height={24} className="w-6 h-6 rounded" />
                          )}
                          <span className={cn(
                            "text-sm font-medium",
                            isSelected ? "text-emerald-300" : "text-neutral-300"
                          )}>
                            {meta?.name || book.bookId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-semibold",
                            isSelected ? "text-emerald-400" : "text-neutral-500"
                          )}>
                            {book.legCount}/{favorites.length}
                          </span>
                          {book.odds && (
                            <span className={cn(
                              "text-sm font-bold tabular-nums",
                              book.odds >= 0 ? "text-emerald-400" : "text-neutral-300"
                            )}>
                              {formatOdds(book.odds)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              
              {/* Partial Books Section */}
              {partialBooks.length > 0 && (
                <div>
                  {completeBooks.length > 0 && (
                    <div className="text-[10px] font-semibold text-neutral-500 px-2 mb-1 mt-2 uppercase tracking-wider">
                      Partial Coverage
                    </div>
                  )}
                  {partialBooks.map(book => {
                    const meta = getSportsbookById(book.bookId);
                    const logo = meta?.image?.square || meta?.image?.light;
                    const isSelected = selectedBook === book.bookId;
                    
                    return (
                      <button
                        key={book.bookId}
                        onClick={() => onSelectBook(book.bookId)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all opacity-60",
                          isSelected 
                            ? "bg-amber-500/10 ring-1 ring-amber-500/30 opacity-100" 
                            : "hover:bg-white/[0.03] hover:opacity-80"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          {logo && (
                            <Image src={logo} alt={book.bookId} width={20} height={20} className="w-5 h-5 rounded opacity-60" />
                          )}
                          <span className={cn(
                            "text-sm font-medium",
                            isSelected ? "text-amber-300" : "text-neutral-400"
                          )}>
                            {meta?.name || book.bookId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-semibold",
                            isSelected ? "text-amber-400" : "text-neutral-500"
                          )}>
                            {book.legCount}/{favorites.length}
                          </span>
                          {book.odds && (
                            <span className="text-sm font-medium tabular-nums text-neutral-500">
                              {formatOdds(book.odds)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Single Pick Card (like competitor)
function PickCard({
  favorite,
  selectedBook,
  onRemove,
  isRemoving
}: {
  favorite: Favorite;
  selectedBook: string | null;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const side = formatSide(favorite.side);
  const marketLabel = formatMarketLabelShort(favorite.market);
  const normalizedSport = normalizeSport(favorite.sport);
  
  // Get game display
  const gameDisplay = favorite.away_team && favorite.home_team 
    ? `${favorite.away_team} @ ${favorite.home_team}`
    : favorite.home_team || favorite.away_team || "";
  
  // Get odds for selected book and top 4 other books
  const allBooks = useMemo(() => {
    if (!favorite.books_snapshot) return [];
    return Object.entries(favorite.books_snapshot)
      .filter(([_, data]) => data?.price)
      .map(([bookId, data]) => ({
        bookId,
        price: data.price,
        url: data.u || null,
        isSelected: bookId === selectedBook
      }))
      .sort((a, b) => {
        if (a.isSelected) return -1;
        if (b.isSelected) return 1;
        return (b.price || 0) - (a.price || 0);
      });
  }, [favorite.books_snapshot, selectedBook]);
  
  const displayBooks = allBooks.slice(0, 4);
  const moreCount = Math.max(0, allBooks.length - 4);
  
  // Get deeplink for selected book
  const selectedBookData = selectedBook ? favorite.books_snapshot?.[selectedBook] : null;
  const betLink = selectedBookData?.u || null;
  
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "relative bg-neutral-800/50 dark:bg-neutral-800/50 rounded-xl overflow-hidden",
        isRemoving && "opacity-40 pointer-events-none"
      )}
    >
      {/* Game Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <SportIcon sport={normalizedSport} className="w-4 h-4 text-rose-400" />
        <span className="text-xs font-medium text-neutral-400 dark:text-neutral-400">
          {gameDisplay}
        </span>
      </div>
      
      {/* Pick Content */}
      <div className="flex items-start justify-between px-3 pb-2">
        <div className="flex items-start gap-2.5">
          {/* Bar indicator */}
          <div className="w-1 h-10 rounded-full bg-neutral-600 mt-0.5" />
          
          <div>
            {/* Player Name + Market */}
            <div className="text-sm font-semibold text-white leading-tight">
              {favorite.player_name} - {marketLabel}
            </div>
            {/* Line */}
            <div className={cn(
              "text-xs font-medium mt-0.5",
              side === "o" ? "text-emerald-400" : "text-red-400"
            )}>
              {side === "o" ? "Over" : "Under"} {favorite.line}
            </div>
          </div>
        </div>
        
        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors"
        >
          {isRemoving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {/* Odds Row */}
      <div className="flex items-center gap-1 px-3 pb-3 overflow-x-auto scrollbar-none">
        {displayBooks.map(book => {
          const meta = getSportsbookById(book.bookId);
          const logo = meta?.image?.square || meta?.image?.light;
          
          return (
            <div
              key={book.bookId}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 rounded-lg shrink-0",
                book.isSelected 
                  ? "bg-white/10 ring-1 ring-white/20" 
                  : "bg-neutral-700/50"
              )}
            >
              {logo && (
                <Image src={logo} alt={book.bookId} width={16} height={16} className="w-4 h-4 rounded" />
              )}
              <span className={cn(
                "text-xs font-semibold tabular-nums",
                book.price && book.price >= 0 ? "text-emerald-400" : "text-neutral-300"
              )}>
                {book.price ? formatOdds(book.price) : "—"}
              </span>
            </div>
          );
        })}
        
        {moreCount > 0 && (
          <span className="text-[10px] font-medium text-neutral-500 px-2 shrink-0">
            +{moreCount} more
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Individual favorite item
function FavoriteItem({ 
  favorite, 
  onRemove,
  isRemoving,
  isSelected,
  onToggleSelect,
  filterBook
}: { 
  favorite: Favorite; 
  onRemove: () => void;
  isRemoving: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  filterBook: string | null;
}) {
  const initials = getInitials(favorite.player_name);
  const avatarColor = getAvatarColor(favorite.player_name);
  const fullName = favorite.player_name || "Unknown";
  const side = formatSide(favorite.side);
  const hasLine = favorite.line !== null && favorite.line !== undefined;
  const marketLabel = formatMarketLabelShort(favorite.market);
  const normalizedSport = normalizeSport(favorite.sport);
  
  // Get the book to display (filtered or best)
  const displayBook = filterBook || favorite.best_book_at_save;
  const displayPrice = filterBook && favorite.books_snapshot?.[filterBook]?.price 
    ? favorite.books_snapshot[filterBook].price 
    : favorite.best_price_at_save;
  const bookLogo = getBookLogo(displayBook);
  
  // Get bet link for the displayed book
  const bookData = displayBook ? favorite.books_snapshot?.[displayBook] : null;
  const betLink = bookData?.u || null; // Desktop link
  
  // Check if this book has odds for filtered book
  const hasOddsForBook = !filterBook || favorite.books_snapshot?.[filterBook];
  
  if (filterBook && !hasOddsForBook) return null;
  
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ 
        opacity: { duration: 0.15, ease: "easeOut" },
        layout: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }
      }}
      className={cn(
        "group relative flex items-center gap-2.5 px-3 py-2",
        "transition-all duration-150",
        isRemoving && "opacity-40 pointer-events-none",
        isSelected 
          ? "bg-brand/5 dark:bg-brand/10" 
          : "hover:bg-neutral-50 dark:hover:bg-white/[0.02]"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={cn(
          "shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all",
          isSelected 
            ? "bg-brand text-white" 
            : "border border-neutral-300 dark:border-neutral-600 hover:border-brand bg-white dark:bg-neutral-800"
        )}
      >
        {isSelected && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </button>
      
      {/* Avatar with initials */}
      <div className={cn(
        "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
        "bg-gradient-to-br text-[10px] font-bold text-white",
        avatarColor
      )}>
        {initials}
      </div>
      
      {/* Player + Bet Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate">
            {fullName}
          </span>
          <SportIcon sport={normalizedSport} className="w-3 h-3 text-neutral-400 shrink-0" />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {marketLabel}
          </span>
          {hasLine && (
            <span className={cn(
              "text-[11px] font-semibold",
              side === "o" 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-red-500 dark:text-red-400"
            )}>
              {side}{favorite.line}
            </span>
          )}
        </div>
      </div>
      
      {/* Odds + Bet Button */}
      {betLink ? (
        <a
          href={betLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1.5 shrink-0 px-2 py-1.5 rounded-lg transition-all",
            "bg-emerald-50 dark:bg-emerald-500/10",
            "hover:bg-emerald-100 dark:hover:bg-emerald-500/20",
            "ring-1 ring-emerald-200/50 dark:ring-emerald-500/20"
          )}
        >
          {bookLogo && (
            <div className="w-4 h-4 rounded overflow-hidden">
              <Image
                src={bookLogo}
                alt={displayBook || ""}
                width={16}
                height={16}
                className="w-4 h-4 object-contain"
              />
            </div>
          )}
          {displayPrice && (
            <span className={cn(
              "text-xs font-bold tabular-nums",
              displayPrice >= 0 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-neutral-700 dark:text-neutral-300"
            )}>
              {formatOdds(displayPrice)}
            </span>
          )}
          <ArrowRight className="w-3 h-3 text-emerald-500" />
        </a>
      ) : (
        <div className="flex items-center gap-1 shrink-0 px-1.5 py-1 rounded-md bg-neutral-50 dark:bg-neutral-800/50">
          {bookLogo && (
            <div className="w-4 h-4 rounded overflow-hidden">
              <Image
                src={bookLogo}
                alt={displayBook || ""}
                width={16}
                height={16}
                className="w-4 h-4 object-contain"
              />
            </div>
          )}
          {displayPrice && (
            <span className={cn(
              "text-xs font-bold tabular-nums",
              displayPrice >= 0 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-neutral-600 dark:text-neutral-400"
            )}>
              {formatOdds(displayPrice)}
            </span>
          )}
        </div>
      )}
      
      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        disabled={isRemoving}
        className={cn(
          "shrink-0 p-1.5 rounded-lg transition-all duration-150",
          "opacity-0 group-hover:opacity-100",
          "text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10",
          isRemoving && "opacity-100"
        )}
      >
        {isRemoving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
      </button>
    </motion.div>
  );
}

// Empty state (dark theme)
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 bg-neutral-900">
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-2xl bg-neutral-800 flex items-center justify-center ring-1 ring-white/10">
          <Heart className="w-9 h-9 text-neutral-600" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/30 ring-1 ring-white/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-white text-center">
        No picks saved yet
      </h3>
      <p className="text-sm text-neutral-400 text-center mt-2 max-w-[260px] leading-relaxed">
        Tap the <span className="text-rose-400">❤️</span> on any edge to start building your winning parlay
      </p>
    </div>
  );
}

// Best Value Parlays Section - HERO SECTION
function BestValueParlays({ 
  favorites, 
  selectedIds 
}: { 
  favorites: Favorite[];
  selectedIds: Set<string>;
}) {
  const selectedFavorites = favorites.filter(f => selectedIds.has(f.id));
  const books = getUniqueBooks(selectedFavorites);
  
  // Calculate parlay odds for each book
  const parlayOdds = useMemo(() => {
    return books
      .map(book => {
        const result = calculateParlayOdds(selectedFavorites, book);
        if (!result) return null;
        return { book, ...result };
      })
      .filter((x): x is { book: string; odds: number; legCount: number } => x !== null && x.legCount === selectedFavorites.length)
      .sort((a, b) => b.odds - a.odds); // Best odds first
  }, [selectedFavorites, books]);
  
  if (selectedFavorites.length < 2 || parlayOdds.length === 0) return null;
  
  const topOdds = parlayOdds[0]?.odds || 0;
  const secondOdds = parlayOdds[1]?.odds || 0;
  const edgeVsSecond = topOdds > 0 && secondOdds > 0 ? topOdds - secondOdds : 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-b from-emerald-50 via-emerald-50/50 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/5 dark:to-transparent border-t border-emerald-200/60 dark:border-emerald-500/20"
    >
      {/* Hero Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
          <Trophy className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              Best Value Parlays
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full">
              {selectedFavorites.length} legs
            </span>
          </div>
          <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">
            Compare parlay odds across books
          </p>
        </div>
        {edgeVsSecond > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20 ring-1 ring-emerald-200/80 dark:ring-emerald-500/30">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              +{edgeVsSecond} edge
            </span>
          </div>
        )}
      </div>
      
      {/* Parlay Cards */}
      <div className="px-4 pb-4 space-y-2">
        {parlayOdds.slice(0, 3).map(({ book, odds, legCount }, index) => {
          const bookData = getSportsbookById(book);
          const logo = bookData?.image?.square || bookData?.image?.light;
          const isTop = index === 0;
          
          return (
            <motion.div
              key={book}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all cursor-pointer",
                isTop 
                  ? "bg-gradient-to-r from-white to-emerald-50/50 dark:from-emerald-500/20 dark:to-emerald-500/10 ring-2 ring-emerald-300 dark:ring-emerald-500/40 shadow-lg shadow-emerald-500/10" 
                  : "bg-white/80 dark:bg-white/[0.04] ring-1 ring-neutral-200/80 dark:ring-neutral-700/50 hover:ring-neutral-300 dark:hover:ring-neutral-600"
              )}
            >
              {/* Rank indicator */}
              <div className={cn(
                "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                isTop 
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm" 
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
              )}>
                {index + 1}
              </div>
              
              {logo && (
                <div className={cn(
                  "w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm",
                  isTop 
                    ? "bg-white ring-1 ring-emerald-200/50" 
                    : "bg-neutral-50 dark:bg-neutral-800 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
                )}>
                  <Image src={logo} alt={book} width={28} height={28} className="w-7 h-7 object-contain" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-bold",
                    isTop ? "text-emerald-800 dark:text-emerald-300" : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {bookData?.name || book}
                  </span>
                  {isTop && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded">
                      <Star className="w-3 h-3 fill-current" />
                      BEST
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {legCount === selectedFavorites.length ? "All legs available" : `${legCount} of ${selectedFavorites.length} legs`}
                </span>
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-lg font-bold tabular-nums",
                  isTop ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400"
                )}>
                  {formatOdds(odds)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Helper to get readable market label for slips
const getReadableMarket = (market: string): string => {
  const labels: Record<string, string> = {
    'player_points': 'Points',
    'player_rebounds': 'Rebounds',
    'player_assists': 'Assists',
    'player_threes': '3PM',
    'player_pra': 'PRA',
    'player_pr': 'Pts+Reb',
    'player_pa': 'Pts+Ast',
    'player_ra': 'Reb+Ast',
    'player_steals': 'Steals',
    'player_blocks': 'Blocks',
    'player_turnovers': 'Turnovers',
    'player_double_double': 'Double Double',
    'player_triple_double': 'Triple Double',
    'player_passing_yards': 'Pass Yds',
    'player_rushing_yards': 'Rush Yds',
    'player_receiving_yards': 'Rec Yds',
    'player_receptions': 'Receptions',
    'player_touchdowns': 'TD',
    'player_first_td': '1st TD',
    'player_anytime_td': 'TD',
    'player_pass_tds': 'Pass TDs',
    'player_interceptions': 'INTs',
    'player_completions': 'Completions',
    'batter_hits': 'Hits',
    'batter_runs': 'Runs',
    'batter_rbis': 'RBIs',
    'batter_total_bases': 'Total Bases',
    'batter_home_runs': 'Home Runs',
    'pitcher_strikeouts': 'Strikeouts',
  };
  const short = formatMarketLabelShort(market);
  return labels[market] || short || market.replace(/_/g, ' ');
};

// Slip Card Component
function SlipCard({ 
  slip, 
  onDelete,
  onRemoveLeg,
  onFetchSgpOdds,
  selectedFavoriteIds,
  onAddSelected,
  isRemovingLeg,
  isFetchingSgpOdds
}: { 
  slip: Betslip; 
  onDelete: () => void;
  onRemoveLeg: (favoriteId: string) => void;
  onFetchSgpOdds: (forceRefresh?: boolean) => Promise<void>;
  selectedFavoriteIds: Set<string>;
  onAddSelected: () => void;
  isRemovingLeg: boolean;
  isFetchingSgpOdds: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [removingLegId, setRemovingLegId] = useState<string | null>(null);
  const [showAllBooks, setShowAllBooks] = useState(false);
  const [showIncompleteBooks, setShowIncompleteBooks] = useState(false);
  const [hasFetchedSgp, setHasFetchedSgp] = useState(false);
  
  const colorClass = getColorClass(slip.color);
  const items = slip.items || [];
  const playerNames = items
    .map(item => item.favorite?.player_name)
    .filter(Boolean)
    .slice(0, 3);
  const moreCount = items.length - 3;
  
  // Get all unique books across all legs
  const allBooks = useMemo(() => {
    const books = new Set<string>();
    items.forEach(item => {
      if (item.favorite?.books_snapshot) {
        Object.keys(item.favorite.books_snapshot).forEach(b => books.add(b));
      }
    });
    return Array.from(books);
  }, [items]);
  
  // Calculate parlay odds from items for each book
  const parlayOdds = useMemo(() => {
    if (items.length < 1) return null;
    
    const results: { book: string; odds: number; legs: number; legPrices: (number | null)[] }[] = [];
    allBooks.forEach(book => {
      let totalDecimal = 1;
      let legCount = 0;
      const legPrices: (number | null)[] = [];
      
      items.forEach(item => {
        const price = item.favorite?.books_snapshot?.[book]?.price;
        legPrices.push(price || null);
        if (price) {
          const decimal = price > 0 ? 1 + (price / 100) : 1 + (100 / Math.abs(price));
          totalDecimal *= decimal;
          legCount++;
        }
      });
      
      if (legCount === items.length) {
        const american = totalDecimal >= 2 
          ? Math.round((totalDecimal - 1) * 100)
          : Math.round(-100 / (totalDecimal - 1));
        results.push({ book, odds: american, legs: legCount, legPrices });
      }
    });
    
    return results.sort((a, b) => b.odds - a.odds);
  }, [items, allBooks]);
  
  // Handle remove leg
  const handleRemoveLeg = async (favoriteId: string) => {
    setRemovingLegId(favoriteId);
    await onRemoveLeg(favoriteId);
    setRemovingLegId(null);
  };
  
  // Classify bet type based on event IDs (must be before useEffect that references it)
  const betType = useMemo((): 'individual' | 'parlay' | 'sgp' | 'sgp_plus' => {
    if (items.length === 0) return 'individual';
    if (items.length === 1) return 'individual';
    
    // Group legs by event_id
    const eventGroups = new Map<string, typeof items>();
    items.forEach(item => {
      const eventId = item.favorite?.event_id || 'unknown';
      if (!eventGroups.has(eventId)) {
        eventGroups.set(eventId, []);
      }
      eventGroups.get(eventId)!.push(item);
    });
    
    const groupSizes = Array.from(eventGroups.values()).map(g => g.length);
    const sgpGroups = groupSizes.filter(size => size >= 2); // Groups with 2+ legs (SGPs)
    const singleLegGroups = groupSizes.filter(size => size === 1); // Groups with 1 leg
    
    // All legs from same game = SGP
    if (eventGroups.size === 1 && items.length >= 2) {
      return 'sgp';
    }
    
    // Has at least one SGP group + other legs = SGP+
    if (sgpGroups.length >= 1 && (sgpGroups.length >= 2 || singleLegGroups.length >= 1)) {
      return 'sgp_plus';
    }
    
    // Multiple games, no SGP groups = Regular Parlay
    return 'parlay';
  }, [items]);
  
  // Check if SGP odds cache is stale (> 5 minutes old)
  const sgpCacheAge = slip.sgp_odds_updated_at 
    ? Date.now() - new Date(slip.sgp_odds_updated_at).getTime()
    : Infinity;
  const isSgpCacheStale = sgpCacheAge > 5 * 60 * 1000; // 5 minutes
  const hasSgpCache = !!slip.sgp_odds_cache && Object.keys(slip.sgp_odds_cache).length > 0;
  
  // Auto-fetch SGP odds when card is expanded for SGP/SGP+ bets
  useEffect(() => {
    const needsSgpFetch = (betType === 'sgp' || betType === 'sgp_plus') && 
                          isExpanded && 
                          !isFetchingSgpOdds &&
                          (!hasSgpCache || isSgpCacheStale) &&
                          !hasFetchedSgp;
    
    if (needsSgpFetch) {
      setHasFetchedSgp(true);
      onFetchSgpOdds(false).catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, betType, hasSgpCache, isSgpCacheStale]);
  
  // Reset fetch flag when card is collapsed
  useEffect(() => {
    if (!isExpanded) {
      setHasFetchedSgp(false);
    }
  }, [isExpanded]);
  
  // Get bet type display info
  const betTypeInfo = useMemo(() => {
    switch (betType) {
      case 'individual':
        return { label: 'Single', color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' };
      case 'parlay':
        return { label: 'Parlay', color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' };
      case 'sgp':
        return { label: 'SGP', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' };
      case 'sgp_plus':
        return { label: 'SGP+', color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' };
    }
  }, [betType]);
  
  // For SGP/SGP+ bets, merge API odds with frontend odds for display
  const displayOdds = useMemo(() => {
    // For parlay and individual, use frontend calculation
    if (betType === 'individual' || betType === 'parlay') {
      return parlayOdds;
    }
    
    // For SGP/SGP+, use cached API odds if available
    if (hasSgpCache && slip.sgp_odds_cache) {
      const sgpResults: { book: string; odds: number; legs: number; fromApi: boolean; links?: { desktop: string; mobile: string }; limits?: { max?: number; min?: number }; error?: string }[] = [];
      
      for (const [bookId, data] of Object.entries(slip.sgp_odds_cache)) {
        if (data.error) {
          // Skip books with errors for now (could show them differently)
          continue;
        }
        if (data.price) {
          // Parse American odds string to number (handles "+2755", "+2666.98", etc.)
          const cleaned = data.price.replace(/[^0-9.\-]/g, '');
          const oddsNum = Math.round(parseFloat(cleaned));
          const isNegative = data.price.startsWith('-');
          const finalOdds = isNegative ? -Math.abs(oddsNum) : oddsNum;
          
          sgpResults.push({
            book: bookId,
            odds: finalOdds,
            legs: items.length, // All legs available if we got a price
            fromApi: true,
            links: data.links,
            limits: data.limits,
          });
        }
      }
      
      // Sort by odds (best first)
      return sgpResults.sort((a, b) => b.odds - a.odds);
    }
    
    // Fall back to frontend calculation while loading
    return parlayOdds?.map(p => ({ ...p, fromApi: false }));
  }, [betType, hasSgpCache, slip.sgp_odds_cache, parlayOdds, items.length]);
  
  return (
    <div className={cn(
      "rounded-xl border transition-all overflow-hidden",
      isExpanded 
        ? "bg-neutral-50 dark:bg-neutral-800 border-violet-300 dark:border-violet-500/40 ring-1 ring-violet-200/50 dark:ring-violet-500/20" 
        : "bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-600"
    )}>
      {/* Card Header */}
      <div
        onClick={() => {
          const newExpanded = !isExpanded;
          setIsExpanded(newExpanded);
          if (!newExpanded) {
            setShowAllBooks(false);
            setShowIncompleteBooks(false);
          }
        }}
        className="w-full flex items-center gap-3 p-3 cursor-pointer"
      >
        <div className={cn("w-3 h-3 rounded-full shrink-0", colorClass)} />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              {slip.name}
            </span>
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">
              {items.length} {items.length === 1 ? 'leg' : 'legs'}
            </span>
            {items.length > 0 && (
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", betTypeInfo.bg, betTypeInfo.color)}>
                {betTypeInfo.label}
              </span>
            )}
          </div>
          {playerNames.length > 0 && !isExpanded && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {playerNames.join(", ")}{moreCount > 0 ? ` +${moreCount}` : ""}
            </p>
          )}
        </div>
        
        {/* Best Odds Badge with Book Logo */}
        {displayOdds && displayOdds[0] && (
          <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
            {(() => {
              const best = displayOdds[0];
              const bookData = getSportsbookById(best.book);
              const logo = bookData?.image?.square || bookData?.image?.light;
              return logo ? (
                <Image 
                  src={logo} 
                  alt={best.book} 
                  width={18} 
                  height={18} 
                  className="w-[18px] h-[18px] object-contain rounded" 
                />
              ) : null;
            })()}
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {displayOdds[0].odds >= 0 ? `+${displayOdds[0].odds}` : displayOdds[0].odds}
            </span>
          </div>
        )}
        
        {/* Expand/Collapse indicator */}
        <ChevronRight className={cn(
          "w-4 h-4 text-neutral-400 transition-transform",
          isExpanded && "rotate-90"
        )} />
        
        {/* Menu Button */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-neutral-400" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border shadow-lg overflow-hidden z-20 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                {selectedFavoriteIds.size > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSelected();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add {selectedFavoriteIds.size} selected
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Slip
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Expanded Content - Premium 2-Column Layout */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-neutral-100 dark:border-neutral-700/50">
              {items.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center mb-3">
                    <Layers className="w-5 h-5 text-neutral-400" />
                  </div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    No legs yet
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Add plays from the All Props tab
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-neutral-100 dark:divide-neutral-700/50">
                  {/* Left Column - Legs */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                        Legs ({items.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item, idx) => {
                        const fav = item.favorite;
                        if (!fav) return null;
                        const side = fav.side === "over" ? "o" : fav.side === "under" ? "u" : fav.side?.charAt(0) || "";
                        const isRemoving = removingLegId === fav.id;
                        
                        return (
                          <div 
                            key={item.id} 
                            className={cn(
                              "group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all",
                              "bg-neutral-50 dark:bg-neutral-700/30",
                              "hover:bg-neutral-100 dark:hover:bg-neutral-700/50",
                              isRemoving && "opacity-50"
                            )}
                          >
                            <span className="text-[10px] font-bold text-neutral-400 w-4">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                                  {fav.player_name || "Unknown"}
                                </span>
                                {fav.player_team && (
                                  <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-200/50 dark:bg-neutral-600/50 px-1 rounded">
                                    {fav.player_team}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                  {getReadableMarket(fav.market)}
                                </span>
                                <span className={cn(
                                  "text-[11px] font-bold px-1 rounded",
                                  side === "o" 
                                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" 
                                    : "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
                                )}>
                                  {side}{fav.line}
                                </span>
                              </div>
                            </div>
                            
                            {/* Remove leg button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveLeg(fav.id);
                              }}
                              disabled={isRemoving || isRemovingLeg}
                              className={cn(
                                "shrink-0 p-1 rounded transition-all",
                                "opacity-0 group-hover:opacity-100",
                                "text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                              )}
                            >
                              {isRemoving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Right Column - Sportsbook Odds */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                          {betType === 'individual' ? 'Odds' : betType === 'sgp' ? 'SGP Odds' : betType === 'sgp_plus' ? 'SGP+ Odds' : 'Parlay Odds'}
                        </span>
                        {betType === 'parlay' && (
                          <Tooltip content="Calculated by multiplying individual leg odds">
                            <Info className="w-3 h-3 text-neutral-400 cursor-help" />
                          </Tooltip>
                        )}
                        {(betType === 'sgp' || betType === 'sgp_plus') && hasSgpCache && (
                          <Tooltip content={`Live odds from sportsbooks • Updated ${Math.round(sgpCacheAge / 60000)}m ago`}>
                            <Check className="w-3 h-3 text-emerald-500" />
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Refresh button for SGP/SGP+ */}
                        {(betType === 'sgp' || betType === 'sgp_plus') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onFetchSgpOdds(true);
                            }}
                            disabled={isFetchingSgpOdds}
                            className={cn(
                              "p-1 rounded-md transition-colors",
                              "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
                              "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
                              "disabled:opacity-50"
                            )}
                            title="Refresh odds"
                          >
                            <RefreshCw className={cn("w-3 h-3", isFetchingSgpOdds && "animate-spin")} />
                          </button>
                        )}
                        {displayOdds && displayOdds.length > 0 && (() => {
                          const completeCount = displayOdds.filter(p => p.legs === items.length).length;
                          const incompleteCount = displayOdds.filter(p => p.legs < items.length).length;
                          return (
                            <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {completeCount} {completeCount === 1 ? 'book' : 'books'}
                              {incompleteCount > 0 && !showIncompleteBooks && (
                                <span className="text-neutral-400 dark:text-neutral-500"> (+{incompleteCount})</span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Loading state for SGP fetch */}
                    {isFetchingSgpOdds && (betType === 'sgp' || betType === 'sgp_plus') && !hasSgpCache ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 animate-spin text-amber-500 mx-auto mb-2" />
                          <p className="text-[11px] text-neutral-400">Fetching live odds...</p>
                        </div>
                      </div>
                    ) : !displayOdds || displayOdds.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-neutral-400">
                          No complete odds available
                        </p>
                      </div>
                    ) : (() => {
                      // Separate complete and incomplete odds
                      const completeOdds = displayOdds.filter(p => p.legs === items.length);
                      const incompleteOdds = displayOdds.filter(p => p.legs < items.length);
                      const oddsToShow = showIncompleteBooks 
                        ? displayOdds 
                        : completeOdds;
                      const visibleOdds = showAllBooks ? oddsToShow : oddsToShow.slice(0, 5);
                      
                      return (
                      <div className="space-y-1.5">
                        {visibleOdds.length === 0 ? (
                          <div className="text-center py-3">
                            <p className="text-xs text-neutral-400">
                              No books have all {items.length} legs
                            </p>
                            {incompleteOdds.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowIncompleteBooks(true);
                                }}
                                className="mt-2 text-[11px] font-medium text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
                              >
                                Show {incompleteOdds.length} partial {incompleteOdds.length === 1 ? 'book' : 'books'}
                              </button>
                            )}
                          </div>
                        ) : (
                        <>
                        {visibleOdds.map((oddData, index) => {
                          const { book, odds, legs } = oddData;
                          const fromApi = 'fromApi' in oddData ? oddData.fromApi : false;
                          const apiLinks = 'links' in oddData ? oddData.links : undefined;
                          const limits = 'limits' in oddData ? oddData.limits : undefined;
                          
                          const bookData = getSportsbookById(book);
                          const logo = bookData?.image?.square || bookData?.image?.light;
                          const isTop = index === 0;
                          const isComplete = legs === items.length;
                          
                          // Use API deeplink if available, otherwise fall back to leg link
                          const betLink = apiLinks?.desktop || 
                            items.find(item => item.favorite?.books_snapshot?.[book]?.u)?.favorite?.books_snapshot?.[book]?.u || 
                            null;
                          
                          const content = (
                            <>
                              {/* Rank */}
                              <span className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                isTop && isComplete
                                  ? "bg-emerald-500 text-white"
                                  : "bg-neutral-600 dark:bg-neutral-600 text-neutral-300 dark:text-neutral-400"
                              )}>
                                {index + 1}
                              </span>
                              
                              {/* Book Logo & Name */}
                              {logo && (
                                <div className="w-6 h-6 rounded-lg overflow-hidden bg-white dark:bg-neutral-700 flex items-center justify-center shadow-sm ring-1 ring-black/5 dark:ring-white/5 shrink-0">
                                  <Image src={logo} alt={book} width={20} height={20} className="w-5 h-5 object-contain" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className={cn(
                                  "text-xs font-semibold truncate block",
                                  isTop && isComplete ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-700 dark:text-neutral-200"
                                )}>
                                  {bookData?.name || book}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {!isComplete && (
                                    <span className="text-[9px] text-neutral-400">
                                      {legs}/{items.length} legs
                                    </span>
                                  )}
                                  {limits?.max && (
                                    <span className="text-[9px] text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-1 rounded">
                                      Max ${limits.max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Odds */}
                              <div className="text-right shrink-0 flex items-center gap-2">
                                <div>
                                  <span className={cn(
                                    "text-sm font-bold tabular-nums",
                                    isTop && isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-300"
                                  )}>
                                    {odds >= 0 ? `+${odds}` : odds}
                                  </span>
                                  {isTop && isComplete && (
                                    <div className="flex items-center justify-end gap-0.5 mt-0.5">
                                      <Star className="w-2.5 h-2.5 text-emerald-500 fill-current" />
                                      <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        BEST
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {/* Bet Arrow */}
                                {betLink && (
                                  <ArrowRight className={cn(
                                    "w-4 h-4 shrink-0 transition-all",
                                    isTop && isComplete 
                                      ? "text-emerald-500 group-hover/book:translate-x-0.5" 
                                      : "text-neutral-400 group-hover/book:text-neutral-200 group-hover/book:translate-x-0.5"
                                  )} />
                                )}
                              </div>
                            </>
                          );
                          
                          // Wrap in link if bet link is available
                          if (betLink) {
                            return (
                              <a
                                key={book}
                                href={betLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "group/book flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all cursor-pointer",
                                  isTop && isComplete
                                    ? "bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10 ring-1 ring-emerald-300/50 dark:ring-emerald-500/40 hover:ring-emerald-400/70 dark:hover:ring-emerald-400/60" 
                                    : "bg-neutral-100/80 dark:bg-neutral-800/80 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80",
                                  !isComplete && "opacity-60"
                                )}
                              >
                                {content}
                              </a>
                            );
                          }
                          
                          return (
                            <div
                              key={book}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all",
                                isTop && isComplete
                                  ? "bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10 ring-1 ring-emerald-300/50 dark:ring-emerald-500/40" 
                                  : "bg-neutral-100/80 dark:bg-neutral-800/80",
                                !isComplete && "opacity-60"
                              )}
                            >
                              {content}
                            </div>
                          );
                        })}
                        </>
                        )}
                        
                        {/* Show more complete books button */}
                        {oddsToShow.length > 5 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAllBooks(!showAllBooks);
                            }}
                            className="w-full text-[11px] font-medium text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 text-center pt-2 pb-1 transition-colors"
                          >
                            {showAllBooks ? (
                              <span className="flex items-center justify-center gap-1">
                                <ChevronRight className="w-3 h-3 -rotate-90" />
                                Show less
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-1">
                                <ChevronRight className="w-3 h-3 rotate-90" />
                                +{oddsToShow.length - 5} more
                              </span>
                            )}
                          </button>
                        )}
                        
                        {/* Toggle for showing incomplete books */}
                        {incompleteOdds.length > 0 && completeOdds.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowIncompleteBooks(!showIncompleteBooks);
                              if (!showIncompleteBooks) setShowAllBooks(false); // Reset when toggling
                            }}
                            className={cn(
                              "w-full flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-neutral-200/50 dark:border-neutral-700/50",
                              "text-[10px] font-medium transition-colors",
                              showIncompleteBooks 
                                ? "text-amber-600 dark:text-amber-400" 
                                : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                            )}
                          >
                            {showIncompleteBooks ? (
                              <>
                                <Check className="w-3 h-3" />
                                Showing partial books
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Show {incompleteOdds.length} partial {incompleteOdds.length === 1 ? 'book' : 'books'}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      );
                    })()}
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

export function FavoritesModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"plays" | "slips">("plays");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterBook, setFilterBook] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showNewSlipForm, setShowNewSlipForm] = useState(false);
  const [newSlipName, setNewSlipName] = useState("");
  const [newSlipColor, setNewSlipColor] = useState("yellow");
  const [showAddToSlipMenu, setShowAddToSlipMenu] = useState(false);
  const [isAddingToSlip, setIsAddingToSlip] = useState(false);
  // New: Sportsbook selector state
  const [isSportsbookSelectorOpen, setIsSportsbookSelectorOpen] = useState(false);
  const [selectedSportsbook, setSelectedSportsbook] = useState<string | null>(null);
  
  const { favorites, isLoading, isLoggedIn, removeFavorite } = useFavorites();
  const { 
    betslips, 
    isLoading: isLoadingSlips, 
    createBetslip, 
    isCreating,
    deleteBetslip,
    addToBetslip,
    removeFromBetslip,
    isRemovingItem,
    fetchSgpOdds,
    isFetchingSgpOdds
  } = useBetslips();
  
  const count = favorites.length;
  const hasItems = count > 0;
  const uniqueBooks = useMemo(() => getUniqueBooks(favorites), [favorites]);
  const bestCoverageBook = useMemo(() => getBestCoverageBook(favorites, uniqueBooks), [favorites, uniqueBooks]);
  
  // Auto-select best sportsbook when favorites change
  const booksWithCoverage = useMemo(() => getAllBooksWithCoverage(favorites), [favorites]);
  
  useEffect(() => {
    if (favorites.length > 0 && !selectedSportsbook) {
      // Auto-select first complete book with best odds, or best partial
      const bestBook = booksWithCoverage[0]?.bookId || null;
      setSelectedSportsbook(bestBook);
    }
  }, [favorites, booksWithCoverage, selectedSportsbook]);
  
  // Get current parlay data for selected sportsbook
  const currentParlayData = useMemo(() => {
    if (!selectedSportsbook || favorites.length === 0) return null;
    const result = calculateParlayOdds(favorites, selectedSportsbook);
    return result;
  }, [selectedSportsbook, favorites]);
  
  // Get deeplink for bet button
  const getBetDeeplink = useCallback(() => {
    if (!selectedSportsbook || favorites.length === 0) return null;
    // For single leg, use the direct link
    if (favorites.length === 1) {
      return favorites[0].books_snapshot?.[selectedSportsbook]?.u || null;
    }
    // For multiple legs, would need SGP link - fallback to first leg's link for now
    const firstLegWithLink = favorites.find(f => f.books_snapshot?.[selectedSportsbook]?.u);
    return firstLegWithLink?.books_snapshot?.[selectedSportsbook]?.u || null;
  }, [selectedSportsbook, favorites]);
  
  // Build mode: calculate best parlay odds for selected items
  const buildModeData = useMemo(() => {
    if (selectedIds.size < 2) return null;
    
    const selected = favorites.filter(f => selectedIds.has(f.id));
    const books = getUniqueBooks(selected);
    
    const parlayByBook = books
      .map(book => {
        const result = calculateParlayOdds(selected, book);
        if (!result || result.legCount !== selected.length) return null;
        return { book, ...result };
      })
      .filter((x): x is { book: string; odds: number; legCount: number } => x !== null)
      .sort((a, b) => b.odds - a.odds);
    
    return {
      count: selectedIds.size,
      bestBook: parlayByBook[0]?.book || null,
      bestOdds: parlayByBook[0]?.odds || null,
      parlayByBook
    };
  }, [favorites, selectedIds]);
  
  // Handle remove single
  const handleRemove = async (favoriteId: string) => {
    setRemovingId(favoriteId);
    try {
      await removeFavorite(favoriteId);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(favoriteId);
        return next;
      });
    } finally {
      setRemovingId(null);
    }
  };
  
  // Handle remove selected
  const handleRemoveSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsClearing(true);
    try {
      for (const id of selectedIds) {
        await removeFavorite(id);
      }
      setSelectedIds(new Set());
    } finally {
      setIsClearing(false);
    }
  };
  
  // Handle add selected to existing slip
  const handleAddToSlip = async (slipId: string) => {
    if (selectedIds.size === 0) return;
    setIsAddingToSlip(true);
    try {
      await addToBetslip({
        betslip_id: slipId,
        favorite_ids: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
      setShowAddToSlipMenu(false);
    } finally {
      setIsAddingToSlip(false);
    }
  };
  
  // Handle create new slip with selected
  const handleCreateSlipWithSelected = async () => {
    if (selectedIds.size === 0) return;
    // Switch to slips tab and show new slip form
    setActiveTab("slips");
    setShowNewSlipForm(true);
  };
  
  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === favorites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(favorites.map(f => f.id)));
    }
  };
  
  // Clear all (called after confirmation)
  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      for (const fav of favorites) {
        await removeFavorite(fav.id);
      }
      setSelectedIds(new Set());
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };
  
  // Generate share text
  const getShareText = () => {
    const selected = selectedIds.size > 0 
      ? favorites.filter(f => selectedIds.has(f.id)) 
      : favorites;
    
    if (selected.length === 0) return "";
    
    const legs = selected.map(f => {
      const playerName = f.player_name || "Unknown";
      const market = formatMarketLabelShort(f.market);
      const side = formatSide(f.side);
      return `${playerName} ${market} ${side}${f.line || ""}`;
    }).join(" | ");
    
    return `🎯 My plays: ${legs}\n\nBuilt with @UnjuicedApp`;
  };
  
  // Share handlers (placeholders for now)
  const handleCopyLink = () => {
    // TODO: Generate shareable link
    alert("Share links coming soon!");
    setShowShareMenu(false);
  };
  
  const handleCopyText = async () => {
    const text = getShareText();
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
    setShowShareMenu(false);
  };
  
  const handleShareX = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
    setShowShareMenu(false);
  };
  
  const handleShareSMS = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`sms:?body=${text}`, "_self");
    setShowShareMenu(false);
  };
  
  if (!isLoggedIn) {
    return (
      <Tooltip content="Sign in to save plays" side="bottom">
        <button
          disabled
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200",
            "bg-neutral-100 dark:bg-white/5 opacity-50 cursor-not-allowed"
          )}
        >
          <Heart className="h-4 w-4 text-neutral-400" />
        </button>
      </Tooltip>
    );
  }
  
  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
          "bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10",
          hasItems && "bg-gradient-to-br from-rose-50 to-red-50 hover:from-rose-100 hover:to-red-100 dark:from-rose-500/10 dark:to-red-500/10 dark:hover:from-rose-500/20 dark:hover:to-red-500/20 ring-1 ring-rose-200/50 dark:ring-rose-500/20"
        )}
      >
        {hasItems ? (
          <HeartFill className="h-4 w-4 text-rose-500" />
        ) : (
          <Heart className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        )}
        
        {/* Count Badge */}
        <AnimatePresence>
          {hasItems && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={cn(
                "absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center",
                "rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1.5 text-[10px] font-bold text-white shadow-lg shadow-rose-500/40 ring-2 ring-white dark:ring-neutral-900"
              )}
            >
              {count > 99 ? "99+" : count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      
      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                "fixed z-50 w-full max-w-[580px] max-h-[85vh] overflow-hidden",
                "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                "rounded-2xl shadow-2xl ring-1 ring-black/[0.08]",
                "bg-white dark:bg-neutral-900 dark:ring-white/[0.08]",
                // Mobile: bottom sheet
                "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0",
                "max-sm:max-w-none max-sm:rounded-b-none max-sm:max-h-[90vh]"
              )}
            >
              {/* Compact Header - Like competitor */}
              <div className="relative overflow-hidden shrink-0 bg-neutral-900 dark:bg-neutral-900">
                {/* Gradient accent bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 via-pink-500 to-red-500" />
                
                <div className="flex items-center justify-between px-4 py-3.5">
                  <h2 className="text-lg font-bold text-white">
                    My Picks
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Share Button */}
                    <button
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4 text-neutral-400" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Tab Navigation - Dark theme consistent */}
              <div className="flex bg-neutral-900 dark:bg-neutral-900 border-b border-white/5 shrink-0">
                <button
                  onClick={() => setActiveTab("plays")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all relative",
                    activeTab === "plays"
                      ? "text-white"
                      : "text-neutral-400 hover:text-neutral-300"
                  )}
                >
                  <Heart className={cn("w-3.5 h-3.5", activeTab === "plays" && "text-rose-400")} />
                  Picks
                  {count > 0 && (
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                      activeTab === "plays" 
                        ? "bg-rose-500 text-white" 
                        : "bg-white/10 text-neutral-400"
                    )}>
                      {count}
                    </span>
                  )}
                  <div className={cn(
                    "absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-rose-500 transition-opacity duration-200",
                    activeTab === "plays" ? "opacity-100" : "opacity-0"
                  )} />
                </button>
                <button
                  onClick={() => setActiveTab("slips")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all relative",
                    activeTab === "slips"
                      ? "text-white"
                      : "text-neutral-400 hover:text-neutral-300"
                  )}
                >
                  <Layers className={cn("w-3.5 h-3.5", activeTab === "slips" && "text-violet-400")} />
                  Slips
                  {betslips.length > 0 && (
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                      activeTab === "slips" 
                        ? "bg-violet-500 text-white" 
                        : "bg-white/10 text-neutral-400"
                    )}>
                      {betslips.length}
                    </span>
                  )}
                  <div className={cn(
                    "absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-violet-500 transition-opacity duration-200",
                    activeTab === "slips" ? "opacity-100" : "opacity-0"
                  )} />
                </button>
              </div>
              
              {/* ============ PLAYS TAB CONTENT (NEW BLENDED DESIGN) ============ */}
              {activeTab === "plays" && (
                <>
              {/* Sportsbook Selector (like competitor) */}
              {hasItems && (
                <SportsbookSelector
                  favorites={favorites}
                  selectedBook={selectedSportsbook}
                  onSelectBook={(bookId) => {
                    setSelectedSportsbook(bookId);
                    setIsSportsbookSelectorOpen(false);
                  }}
                  isExpanded={isSportsbookSelectorOpen}
                  onToggleExpand={() => setIsSportsbookSelectorOpen(!isSportsbookSelectorOpen)}
                />
              )}
              
              {/* Pick Cards Content */}
              <div className="flex-1 overflow-y-auto bg-neutral-900 dark:bg-neutral-900 max-h-[45vh] max-sm:max-h-[40vh]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="relative inline-flex">
                        <div className="h-10 w-10 animate-spin rounded-full border-3 border-solid border-rose-200 dark:border-rose-500/30 border-t-rose-500" />
                        <HeartFill className="absolute inset-0 m-auto h-4 w-4 text-rose-400" />
                      </div>
                      <p className="text-xs font-medium text-neutral-400 mt-3">Loading picks...</p>
                    </div>
                  </div>
                ) : !hasItems ? (
                  <>
                    <EmptyState />
                    {/* View Full Page Link - Empty State */}
                    <div className="px-3 pb-3">
                      <Link
                        href="/saved-plays"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-white/5 text-xs font-medium text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02] transition-colors group"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>View Full Page & Manage Slips</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="p-3 space-y-2">
                    <AnimatePresence initial={false} mode="sync">
                      {favorites.map((favorite) => (
                        <PickCard
                          key={favorite.id}
                          favorite={favorite}
                          selectedBook={selectedSportsbook}
                          onRemove={() => handleRemove(favorite.id)}
                          isRemoving={removingId === favorite.id}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              
              {/* Footer Actions - BET BUTTON + CLEAR ALL (like competitor - dark theme) */}
              {hasItems && (
                <div className="shrink-0 bg-neutral-900 dark:bg-neutral-900 space-y-3">
                  <div className="px-3 pt-3 space-y-3">
                    {/* BET Button - Only show if we have a selected book with odds */}
                    {selectedSportsbook && currentParlayData && (
                      <a
                        href={getBetDeeplink() || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-semibold text-white transition-all",
                          "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
                          "shadow-lg shadow-emerald-500/20"
                        )}
                      >
                        {(() => {
                          const meta = getSportsbookById(selectedSportsbook);
                          const logo = meta?.image?.square || meta?.image?.light;
                          return (
                            <>
                              {logo && <Image src={logo} alt={selectedSportsbook} width={20} height={20} className="w-5 h-5 rounded" />}
                              <span className="text-sm">ADD TO BETSLIP</span>
                              <span className="text-base font-bold tabular-nums px-2 py-0.5 rounded bg-white/20">
                                {formatOdds(currentParlayData.odds)}
                              </span>
                            </>
                          );
                        })()}
                      </a>
                    )}
                    
                    {/* CLEAR ALL Button */}
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-white/5"
                    >
                      <Trash2 className="w-4 h-4" />
                      CLEAR ALL
                    </button>
                  </div>
                  
                  {/* View Full Page Link */}
                  <Link
                    href="/saved-plays"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/5 text-xs font-medium text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02] transition-colors group"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>View Full Page & Manage Slips</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              )}
              
              {/* Selection Action Bar - Shows when items selected */}
              {hasItems && selectedIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="shrink-0 border-t border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2"
                >
                  {/* Selection Info + Buttons in one row */}
                  <div className="flex items-center gap-2">
                    {/* Selection count */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-5 h-5 rounded bg-brand/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-brand" />
                      </div>
                      <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                        {selectedIds.size}
                      </span>
                    </div>
                    
                    {/* Parlay Odds */}
                    {buildModeData && buildModeData.bestOdds && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 shrink-0">
                        {(() => {
                          const bookLogo = buildModeData.bestBook 
                            ? getBookLogo(buildModeData.bestBook) 
                            : null;
                          return bookLogo ? (
                            <Image
                              src={bookLogo}
                              alt={buildModeData.bestBook || ""}
                              width={14}
                              height={14}
                              className="w-3.5 h-3.5 object-contain rounded"
                            />
                          ) : null;
                        })()}
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatOdds(buildModeData.bestOdds)}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex-1" />
                    
                    {/* Action Buttons - Compact */}
                    {/* New Slip Button */}
                    <button
                      onClick={handleCreateSlipWithSelected}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg",
                        "text-xs font-semibold transition-all",
                        "bg-brand text-white hover:bg-brand/90"
                      )}
                    >
                      <Plus className="w-3 h-3" />
                      New
                    </button>
                    
                    {/* Add to Slip Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowAddToSlipMenu(!showAddToSlipMenu)}
                        disabled={betslips.length === 0 || isAddingToSlip}
                        className={cn(
                          "flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg",
                          "text-xs font-semibold transition-all",
                          "bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700",
                          "text-neutral-700 dark:text-neutral-300",
                          "hover:bg-neutral-200 dark:hover:bg-neutral-700",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {isAddingToSlip ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Layers className="w-3 h-3" />
                            Add
                            <ChevronRight className={cn(
                              "w-3 h-3 transition-transform",
                              showAddToSlipMenu && "rotate-90"
                            )} />
                          </>
                        )}
                      </button>
                      
                      {/* Add to Slip Menu */}
                      <AnimatePresence>
                        {showAddToSlipMenu && betslips.length > 0 && (
                          <>
                            <div 
                              className="fixed inset-0 z-[5]" 
                              onClick={() => setShowAddToSlipMenu(false)}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.15 }}
                              className={cn(
                                "absolute left-0 right-0 bottom-full mb-2 rounded-xl border shadow-lg overflow-hidden z-10",
                                "bg-white border-neutral-200",
                                "dark:bg-neutral-800 dark:border-neutral-700",
                                "max-h-[200px] overflow-y-auto"
                              )}
                            >
                              <div className="p-1.5">
                                {betslips.map((slip) => {
                                  const colorClass = getColorClass(slip.color);
                                  return (
                                    <button
                                      key={slip.id}
                                      onClick={() => handleAddToSlip(slip.id)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                    >
                                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorClass)} />
                                      <span className="font-medium truncate flex-1 text-left">{slip.name}</span>
                                      <span className="text-[10px] text-neutral-400 shrink-0">{slip.legs_count} legs</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      onClick={handleRemoveSelected}
                      disabled={isClearing}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        "bg-red-50 dark:bg-red-500/10",
                        "text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20",
                        "disabled:opacity-50"
                      )}
                    >
                      {isClearing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
              
              {/* Footer Actions - Show when no items selected or < 2 selected */}
              {hasItems && (!buildModeData || buildModeData.count < 2) && (
                <div className="border-t border-neutral-100 dark:border-white/5 p-4 space-y-3">
                  {/* Quick Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Share Button with Menu */}
                      <div className="relative">
                        <button
                          onClick={() => setShowShareMenu(!showShareMenu)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Share
                        </button>
                        
                        {/* Share Menu Dropdown */}
                        <AnimatePresence>
                          {showShareMenu && (
                            <>
                              {/* Invisible backdrop to close menu */}
                              <div 
                                className="fixed inset-0 z-[5]" 
                                onClick={() => setShowShareMenu(false)}
                              />
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className={cn(
                                  "absolute left-0 bottom-full mb-2 w-48 rounded-xl border shadow-lg overflow-hidden z-10",
                                  "bg-white border-neutral-200",
                                  "dark:bg-neutral-800 dark:border-neutral-700"
                                )}
                              >
                              <div className="p-1">
                                <button
                                  onClick={handleCopyText}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                >
                                  <Copy className="w-4 h-4 text-neutral-400" />
                                  Copy Text
                                </button>
                                <button
                                  onClick={handleCopyLink}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                >
                                  <Link2 className="w-4 h-4 text-neutral-400" />
                                  <span>Copy Link</span>
                                  <span className="ml-auto text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">Soon</span>
                                </button>
                                <div className="h-px bg-neutral-100 dark:bg-neutral-700 my-1" />
                                <button
                                  onClick={handleShareX}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                >
                                  <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                  </svg>
                                  Share to X
                                </button>
                                <button
                                  onClick={handleShareSMS}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                >
                                  <MessageCircle className="w-4 h-4 text-neutral-400" />
                                  Share via SMS
                                </button>
                              </div>
                            </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    
                    {/* Clear Button */}
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </div>
                  
                  {/* Primary CTA */}
                  <Link
                    href="/saved-plays"
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full py-3.5 rounded-xl",
                      "text-sm font-semibold transition-all duration-200",
                      "bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white",
                      "hover:from-neutral-800 hover:via-neutral-700 hover:to-neutral-800",
                      "dark:from-white dark:via-neutral-100 dark:to-white dark:text-neutral-900",
                      "dark:hover:from-neutral-100 dark:hover:via-neutral-50 dark:hover:to-neutral-100",
                      "shadow-lg shadow-neutral-900/20 dark:shadow-white/20",
                      "ring-1 ring-black/10 dark:ring-white/20"
                    )}
                  >
                    View All Plays & Betslips
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
                </>
              )}
              
              {/* ============ SLIPS TAB CONTENT ============ */}
              {activeTab === "slips" && (
                <div className="flex flex-col h-full">
                  {/* Slips Header */}
                  <div className="px-4 py-3 border-b border-neutral-100 dark:border-white/5 flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      Bet Slips
                    </span>
                    <button
                      onClick={() => setShowNewSlipForm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Slip
                    </button>
                  </div>
                  
                  {/* Slips List */}
                  <div className="flex-1 overflow-y-auto max-h-[50vh]">
                    {isLoadingSlips ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                          <div className="relative inline-flex">
                            <div className="h-10 w-10 animate-spin rounded-full border-3 border-solid border-violet-200 dark:border-violet-500/30 border-t-violet-500" />
                            <Layers className="absolute inset-0 m-auto h-4 w-4 text-violet-400" />
                          </div>
                          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-3">Loading slips...</p>
                        </div>
                      </div>
                    ) : betslips.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="relative mb-5">
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/20 flex items-center justify-center shadow-lg shadow-violet-500/10 ring-1 ring-violet-200/50 dark:ring-violet-500/20">
                            <Layers className="w-9 h-9 text-violet-300 dark:text-violet-600" />
                          </div>
                          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 ring-1 ring-white/30">
                            <Plus className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-neutral-800 dark:text-white text-center">
                          No bet slips yet
                        </h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mt-2 max-w-[240px] leading-relaxed">
                          Create a slip to organize your plays into winning parlays
                        </p>
                        <button
                          onClick={() => setShowNewSlipForm(true)}
                          className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/25"
                        >
                          <Plus className="w-4 h-4" />
                          Create Your First Slip
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {betslips.map((slip) => (
                          <SlipCard 
                            key={slip.id} 
                            slip={slip} 
                            onDelete={() => deleteBetslip(slip.id)}
                            onRemoveLeg={(favoriteId) => removeFromBetslip({ betslipId: slip.id, favoriteId })}
                            onFetchSgpOdds={async (forceRefresh) => {
                              await fetchSgpOdds({ betslipId: slip.id, forceRefresh });
                            }}
                            isRemovingLeg={isRemovingItem}
                            isFetchingSgpOdds={isFetchingSgpOdds}
                            selectedFavoriteIds={selectedIds}
                            onAddSelected={() => {
                              if (selectedIds.size > 0) {
                                addToBetslip({ 
                                  betslip_id: slip.id, 
                                  favorite_ids: Array.from(selectedIds) 
                                });
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* New Slip Form */}
                  <AnimatePresence>
                    {showNewSlipForm && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute inset-x-0 bottom-0 p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 rounded-b-2xl shadow-lg"
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">
                              Slip Name
                            </label>
                            <input
                              type="text"
                              value={newSlipName}
                              onChange={(e) => setNewSlipName(e.target.value)}
                              placeholder="e.g., NFL Sunday Parlay"
                              className={cn(
                                "w-full px-3 py-2 rounded-lg text-sm",
                                "bg-neutral-100 dark:bg-neutral-800",
                                "border border-neutral-200 dark:border-neutral-700",
                                "focus:outline-none focus:ring-2 focus:ring-brand",
                                "placeholder:text-neutral-400"
                              )}
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block">
                              Color
                            </label>
                            <div className="flex gap-2">
                              {BETSLIP_COLORS.map((color) => (
                                <button
                                  key={color.id}
                                  onClick={() => setNewSlipColor(color.id)}
                                  className={cn(
                                    "w-7 h-7 rounded-full transition-all",
                                    color.class,
                                    newSlipColor === color.id 
                                      ? "ring-2 ring-offset-2 ring-neutral-900 dark:ring-white dark:ring-offset-neutral-900" 
                                      : "hover:scale-110"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => {
                                setShowNewSlipForm(false);
                                setNewSlipName("");
                                setNewSlipColor("yellow");
                              }}
                              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={async () => {
                                if (!newSlipName.trim()) return;
                                await createBetslip({
                                  name: newSlipName.trim(),
                                  color: newSlipColor,
                                  favorite_ids: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
                                });
                                setShowNewSlipForm(false);
                                setNewSlipName("");
                                setNewSlipColor("yellow");
                                setSelectedIds(new Set());
                              }}
                              disabled={!newSlipName.trim() || isCreating}
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                                "bg-brand text-white hover:bg-brand/90",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                              )}
                            >
                              {isCreating ? (
                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                              ) : selectedIds.size > 0 ? (
                                `Create with ${selectedIds.size} plays`
                              ) : (
                                "Create Slip"
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Clear Confirmation Dialog */}
              <AnimatePresence>
                {showClearConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[2px] rounded-2xl"
                    onClick={() => !isClearing && setShowClearConfirm(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "w-[280px] rounded-xl border shadow-xl overflow-hidden",
                        "bg-white border-neutral-200",
                        "dark:bg-neutral-800 dark:border-neutral-700"
                      )}
                    >
                      <div className="p-5 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-4">
                          <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
                          Clear All Plays?
                        </h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
                          This will remove all {count} {count === 1 ? 'play' : 'plays'}. This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            disabled={isClearing}
                            className={cn(
                              "flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors",
                              "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                              "dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600",
                              isClearing && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleClearAll}
                            disabled={isClearing}
                            className={cn(
                              "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                              "bg-red-500 text-white hover:bg-red-600",
                              isClearing && "opacity-70"
                            )}
                          >
                            {isClearing ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Clearing...
                              </span>
                            ) : (
                              "Clear All"
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
