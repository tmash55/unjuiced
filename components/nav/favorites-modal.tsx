"use client";

import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import { useFavorites, Favorite } from "@/hooks/use-favorites";
import { useBetslips, Betslip, getColorClass, BETSLIP_COLORS } from "@/hooks/use-betslips";
import { HeartFill } from "@/components/icons/heart-fill";
import { Heart } from "@/components/icons/heart";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { X, ChevronRight, Loader2, Sparkles, Share2, Trash2, Check, Copy, MessageCircle, Link2, AlertTriangle, Flame, Star, TrendingUp, Zap, Plus, MoreVertical, Layers, BookmarkIcon, ArrowRight, Trophy } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
import { formatMarketLabelShort } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";

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
  const lastName = favorite.player_name?.split(" ").pop() || "Unknown";
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
        "group relative flex items-center gap-3 px-4 py-3",
        "transition-all duration-150",
        isRemoving && "opacity-40 pointer-events-none",
        isSelected 
          ? "bg-gradient-to-r from-brand/5 to-brand/10 dark:from-brand/10 dark:to-brand/20" 
          : "hover:bg-neutral-50/80 dark:hover:bg-white/[0.02]"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={cn(
          "shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all",
          isSelected 
            ? "bg-gradient-to-br from-brand to-brand/80 shadow-sm shadow-brand/30 text-white" 
            : "border border-neutral-300 dark:border-neutral-600 hover:border-brand bg-white dark:bg-neutral-800"
        )}
      >
        {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>
      
      {/* Avatar with initials + sport badge */}
      <div className="relative shrink-0">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          "bg-gradient-to-br shadow-md ring-1 ring-white/20",
          avatarColor
        )}>
          <span className="text-xs font-bold text-white tracking-tight">
            {initials}
          </span>
        </div>
        {/* Sport badge overlay */}
        <div className={cn(
          "absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center",
          "bg-white dark:bg-neutral-800 shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
        )}>
          <SportIcon sport={normalizedSport} className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
        </div>
      </div>
      
      {/* Player + Bet Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
            {lastName}
          </span>
          {favorite.player_team && (
            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
              {favorite.player_team}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {marketLabel}
          </span>
          {hasLine && (
            <span className={cn(
              "text-xs font-bold px-1.5 py-0.5 rounded",
              side === "o" 
                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" 
                : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
            )}>
              {side}{favorite.line}
            </span>
          )}
        </div>
      </div>
      
      {/* Best Odds Section - Premium Bet Button */}
      {betLink ? (
        <a
          href={betLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl transition-all",
            "bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-500/15 dark:to-emerald-500/5",
            "hover:from-emerald-100 hover:to-emerald-50 dark:hover:from-emerald-500/20 dark:hover:to-emerald-500/10",
            "ring-1 ring-emerald-200/80 dark:ring-emerald-500/30",
            "shadow-sm group/bet"
          )}
        >
          {bookLogo && (
            <div className="w-6 h-6 rounded-lg overflow-hidden bg-white dark:bg-neutral-800 flex items-center justify-center shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <Image
                src={bookLogo}
                alt={displayBook || ""}
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            </div>
          )}
          {displayPrice && (
            <span className={cn(
              "text-sm font-bold tabular-nums",
              displayPrice >= 0 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-neutral-700 dark:text-neutral-300"
            )}>
              {formatOdds(displayPrice)}
            </span>
          )}
          <ArrowRight className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover/bet:opacity-100 group-hover/bet:translate-x-0.5 transition-all" />
        </a>
      ) : (
        <div className="flex items-center gap-2 shrink-0 px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
          {bookLogo && (
            <div className="w-5 h-5 rounded overflow-hidden bg-white dark:bg-neutral-800 flex items-center justify-center">
              <Image
                src={bookLogo}
                alt={displayBook || ""}
                width={18}
                height={18}
                className="w-[18px] h-[18px] object-contain"
              />
            </div>
          )}
          {displayPrice && (
            <span className={cn(
              "text-sm font-bold tabular-nums",
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

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-100 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/20 flex items-center justify-center shadow-lg shadow-rose-500/10 ring-1 ring-rose-200/50 dark:ring-rose-500/20">
          <Heart className="w-9 h-9 text-rose-300 dark:text-rose-600" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 ring-1 ring-white/30">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-neutral-800 dark:text-white text-center">
        No plays saved yet
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mt-2 max-w-[260px] leading-relaxed">
        Tap the <span className="text-rose-500">❤️</span> on any edge to start building your winning parlay
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

// Slip Card Component
function SlipCard({ 
  slip, 
  onDelete,
  selectedFavoriteIds,
  onAddSelected
}: { 
  slip: Betslip; 
  onDelete: () => void;
  selectedFavoriteIds: Set<string>;
  onAddSelected: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const colorClass = getColorClass(slip.color);
  const items = slip.items || [];
  const playerNames = items
    .map(item => item.favorite?.player_name?.split(" ").pop())
    .filter(Boolean)
    .slice(0, 3);
  const moreCount = items.length - 3;
  
  // Calculate parlay odds from items
  const parlayOdds = useMemo(() => {
    if (items.length < 2) return null;
    
    const books = new Set<string>();
    items.forEach(item => {
      if (item.favorite?.books_snapshot) {
        Object.keys(item.favorite.books_snapshot).forEach(b => books.add(b));
      }
    });
    
    const results: { book: string; odds: number; legs: number }[] = [];
    books.forEach(book => {
      let totalDecimal = 1;
      let legCount = 0;
      
      items.forEach(item => {
        const price = item.favorite?.books_snapshot?.[book]?.price;
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
        results.push({ book, odds: american, legs: legCount });
      }
    });
    
    return results.sort((a, b) => b.odds - a.odds).slice(0, 3);
  }, [items]);
  
  const bestOdds = parlayOdds?.[0];
  
  return (
    <div className={cn(
      "rounded-xl border transition-all",
      "bg-white dark:bg-neutral-800/50",
      "border-neutral-200 dark:border-neutral-700/50",
      "hover:border-neutral-300 dark:hover:border-neutral-600"
    )}>
      {/* Card Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 cursor-pointer"
      >
        <div className={cn("w-3 h-3 rounded-full shrink-0", colorClass)} />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              {slip.name}
            </span>
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">
              {items.length} props
            </span>
          </div>
          {playerNames.length > 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {playerNames.join(", ")}{moreCount > 0 ? ` +${moreCount}` : ""}
            </p>
          )}
        </div>
        
        {/* Best Odds Badge with Book Logo */}
        {bestOdds && (
          <div className="shrink-0 flex items-center gap-1.5">
            {(() => {
              const bookData = getSportsbookById(bestOdds.book);
              const logo = bookData?.image?.square || bookData?.image?.light;
              return logo ? (
                <Image 
                  src={logo} 
                  alt={bestOdds.book} 
                  width={18} 
                  height={18} 
                  className="w-[18px] h-[18px] object-contain rounded" 
                />
              ) : null;
            })()}
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {bestOdds.odds >= 0 ? `+${bestOdds.odds}` : bestOdds.odds}
            </span>
          </div>
        )}
        
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
              <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border shadow-lg overflow-hidden z-20 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                {selectedFavoriteIds.size > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSelected();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                  >
                    Add {selectedFavoriteIds.size} selected
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  Delete Slip
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-neutral-100 dark:border-neutral-700/50">
              {/* Best Value Parlays */}
              {parlayOdds && parlayOdds.length > 0 && (
                <div className="pt-3 space-y-1.5">
                  <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Best Value Parlays
                  </span>
                  {parlayOdds.map(({ book, odds, legs }, index) => {
                    const bookData = getSportsbookById(book);
                    const logo = bookData?.image?.square || bookData?.image?.light;
                    const isTop = index === 0;
                    
                    return (
                      <div
                        key={book}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-2 rounded-lg",
                          isTop 
                            ? "bg-emerald-50 dark:bg-emerald-500/10" 
                            : "bg-neutral-50 dark:bg-neutral-700/30"
                        )}
                      >
                        {logo && (
                          <Image src={logo} alt={book} width={18} height={18} className="w-[18px] h-[18px] object-contain rounded" />
                        )}
                        <span className="flex-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                          {bookData?.name || book}
                        </span>
                        <span className="text-[10px] text-neutral-400">{legs}/{items.length}</span>
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          isTop ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400"
                        )}>
                          {odds >= 0 ? `+${odds}` : odds}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Items Preview */}
              {items.length > 0 && (
                <div className="pt-3 space-y-1">
                  <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Legs
                  </span>
                  {items.slice(0, 5).map((item) => {
                    const fav = item.favorite;
                    if (!fav) return null;
                    const side = fav.side === "over" ? "o" : fav.side === "under" ? "u" : fav.side.charAt(0);
                    return (
                      <div key={item.id} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {fav.player_name?.split(" ").pop()}
                        </span>
                        <span>{formatMarketLabelShort(fav.market)}</span>
                        <span className={cn(
                          "font-semibold",
                          side === "o" ? "text-emerald-600" : "text-red-500"
                        )}>
                          {side}{fav.line}
                        </span>
                      </div>
                    );
                  })}
                  {items.length > 5 && (
                    <p className="text-[10px] text-neutral-400">+{items.length - 5} more</p>
                  )}
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
  
  const { favorites, isLoading, isLoggedIn, removeFavorite } = useFavorites();
  const { 
    betslips, 
    isLoading: isLoadingSlips, 
    createBetslip, 
    isCreating,
    deleteBetslip,
    addToBetslip 
  } = useBetslips();
  
  const count = favorites.length;
  const hasItems = count > 0;
  const uniqueBooks = useMemo(() => getUniqueBooks(favorites), [favorites]);
  const bestCoverageBook = useMemo(() => getBestCoverageBook(favorites, uniqueBooks), [favorites, uniqueBooks]);
  
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
      const lastName = f.player_name?.split(" ").pop() || "Unknown";
      const market = formatMarketLabelShort(f.market);
      const side = formatSide(f.side);
      return `${lastName} ${market} ${side}${f.line || ""}`;
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
                "bg-gradient-to-b from-white to-neutral-50/80",
                "dark:from-neutral-900 dark:to-neutral-950/80 dark:ring-white/[0.08]",
                // Mobile: bottom sheet
                "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0",
                "max-sm:max-w-none max-sm:rounded-b-none max-sm:max-h-[90vh]"
              )}
            >
              {/* Premium Header */}
              <div className="relative overflow-hidden">
                {/* Gradient accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-red-500" />
                
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/25 ring-1 ring-white/20">
                      <HeartFill className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                        My Props
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          {count} {count === 1 ? 'play' : 'plays'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          {betslips.length} {betslips.length === 1 ? 'slip' : 'slips'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <X className="w-5 h-5 text-neutral-400" />
                  </button>
                </div>
              </div>
              
              {/* Tab Navigation */}
              <div className="flex px-4 border-b border-neutral-100 dark:border-white/5">
                <button
                  onClick={() => setActiveTab("plays")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all relative",
                    activeTab === "plays"
                      ? "text-neutral-900 dark:text-white"
                      : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                  )}
                >
                  <Heart className={cn("w-4 h-4", activeTab === "plays" && "text-rose-500")} />
                  All Props
                  {count > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors",
                      activeTab === "plays" 
                        ? "bg-gradient-to-r from-rose-500 to-red-500 text-white" 
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                    )}>
                      {count}
                    </span>
                  )}
                  <div className={cn(
                    "absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r from-rose-500 to-red-500 transition-opacity duration-200",
                    activeTab === "plays" ? "opacity-100" : "opacity-0"
                  )} />
                </button>
                <button
                  onClick={() => setActiveTab("slips")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all relative",
                    activeTab === "slips"
                      ? "text-neutral-900 dark:text-white"
                      : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                  )}
                >
                  <Layers className={cn("w-4 h-4", activeTab === "slips" && "text-violet-500")} />
                  Slips
                  {betslips.length > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors",
                      activeTab === "slips" 
                        ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white" 
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                    )}>
                      {betslips.length}
                    </span>
                  )}
                  <div className={cn(
                    "absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-opacity duration-200",
                    activeTab === "slips" ? "opacity-100" : "opacity-0"
                  )} />
                </button>
              </div>
              
              {/* ============ PLAYS TAB CONTENT ============ */}
              {activeTab === "plays" && (
                <>
              {/* Book Filter Tabs - More Actionable */}
              {hasItems && uniqueBooks.length > 1 && (
                <div className="px-4 py-3 border-b border-neutral-100 dark:border-white/5">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      onClick={() => setFilterBook(null)}
                      className={cn(
                        "shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        !filterBook 
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" 
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-400 dark:hover:bg-white/10"
                      )}
                    >
                      All Books
                    </button>
                    {uniqueBooks.slice(0, 8).map(book => {
                      const bookData = getSportsbookById(book);
                      const logo = bookData?.image?.square || bookData?.image?.light;
                      const legsWithBook = favorites.filter(f => f.books_snapshot?.[book]).length;
                      const isAllAvailable = legsWithBook === count;
                      const isBestCoverage = book === bestCoverageBook;
                      
                      return (
                        <button
                          key={book}
                          onClick={() => setFilterBook(filterBook === book ? null : book)}
                          className={cn(
                            "shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
                            filterBook === book
                              ? "bg-neutral-900 dark:bg-white ring-2 ring-neutral-900 dark:ring-white"
                              : isBestCoverage && isAllAvailable
                                ? "bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-200 dark:ring-emerald-500/30"
                                : "bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10"
                          )}
                        >
                          {logo && (
                            <Image src={logo} alt={book} width={16} height={16} className="w-4 h-4 object-contain" />
                          )}
                          <span className={cn(
                            "text-[10px] font-medium whitespace-nowrap",
                            filterBook === book
                              ? "text-white dark:text-neutral-900"
                              : isBestCoverage && isAllAvailable
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-neutral-500 dark:text-neutral-400"
                          )}>
                            {isAllAvailable ? (
                              <span className="flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                All
                              </span>
                            ) : (
                              `${legsWithBook}/${count}`
                            )}
                          </span>
                          {isBestCoverage && isAllAvailable && filterBook !== book && (
                            <Star className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Build Mode Header */}
              {hasItems && (
                <div className="px-4 py-2 border-b border-neutral-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-brand" />
                    <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                      {selectedIds.size === 0 
                        ? "Select plays to build a slip" 
                        : `${selectedIds.size} ${selectedIds.size === 1 ? 'play' : 'plays'} selected`
                      }
                    </span>
                  </div>
                  <button
                    onClick={toggleSelectAll}
                    className="text-[11px] font-medium text-brand hover:text-brand/80 transition-colors"
                  >
                    {selectedIds.size === favorites.length ? "Clear" : "Select All"}
                  </button>
                </div>
              )}
              
              {/* Content */}
              <div className={cn(
                "overflow-y-auto",
                selectedIds.size >= 2 ? "max-h-[35vh] max-sm:max-h-[30vh]" : "max-h-[50vh] max-sm:max-h-[45vh]"
              )}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="relative inline-flex">
                        <div className="h-10 w-10 animate-spin rounded-full border-3 border-solid border-rose-200 dark:border-rose-500/30 border-t-rose-500" />
                        <HeartFill className="absolute inset-0 m-auto h-4 w-4 text-rose-400" />
                      </div>
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-3">Loading plays...</p>
                    </div>
                  </div>
                ) : !hasItems ? (
                  <EmptyState />
                ) : (
                  <AnimatePresence initial={false} mode="sync">
                    {favorites.map((favorite) => (
                      <FavoriteItem
                        key={favorite.id}
                        favorite={favorite}
                        onRemove={() => handleRemove(favorite.id)}
                        isRemoving={removingId === favorite.id}
                        isSelected={selectedIds.has(favorite.id)}
                        onToggleSelect={() => toggleSelect(favorite.id)}
                        filterBook={filterBook}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
              
              {/* Best Value Parlays */}
              {hasItems && selectedIds.size >= 2 && (
                <BestValueParlays favorites={favorites} selectedIds={selectedIds} />
              )}
              
              {/* Selection Action Bar - Shows when items selected */}
              {hasItems && selectedIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800/50 p-3"
                >
                  {/* Selection Info */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-brand" />
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {selectedIds.size} {selectedIds.size === 1 ? 'play' : 'plays'} selected
                      </span>
                    </div>
                    {buildModeData && buildModeData.bestOdds && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                        {(() => {
                          const bookLogo = buildModeData.bestBook 
                            ? getBookLogo(buildModeData.bestBook) 
                            : null;
                          return bookLogo ? (
                            <Image
                              src={bookLogo}
                              alt={buildModeData.bestBook || ""}
                              width={16}
                              height={16}
                              className="w-4 h-4 object-contain rounded"
                            />
                          ) : null;
                        })()}
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatOdds(buildModeData.bestOdds)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* New Slip Button */}
                    <button
                      onClick={handleCreateSlipWithSelected}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                        "text-sm font-semibold transition-all",
                        "bg-brand text-white hover:bg-brand/90",
                        "shadow-sm"
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      New Slip
                    </button>
                    
                    {/* Add to Slip Dropdown */}
                    <div className="relative flex-1">
                      <button
                        onClick={() => setShowAddToSlipMenu(!showAddToSlipMenu)}
                        disabled={betslips.length === 0 || isAddingToSlip}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                          "text-sm font-semibold transition-all",
                          "bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600",
                          "text-neutral-700 dark:text-neutral-200",
                          "hover:bg-neutral-50 dark:hover:bg-neutral-600",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {isAddingToSlip ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Layers className="w-4 h-4" />
                            Add to Slip
                            <ChevronRight className={cn(
                              "w-3.5 h-3.5 transition-transform",
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
                        "p-2.5 rounded-xl transition-all",
                        "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30",
                        "text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20",
                        "disabled:opacity-50"
                      )}
                    >
                      {isClearing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
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
                    href="/favorites"
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
