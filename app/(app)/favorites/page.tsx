"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useFavorites, Favorite, BookSnapshot, RefreshedOdds, RefreshOddsResponse } from "@/hooks/use-favorites";
import { useBetslips, Betslip, BETSLIP_COLORS, getColorClass } from "@/hooks/use-betslips";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { 
  Heart, 
  Trash2, 
  Loader2, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Share2,
  Copy,
  Check,
  Zap,
  ArrowUpRight,
  X,
  Plus,
  Calculator,
  Layers,
  MoreHorizontal,
  Edit3,
  FolderPlus,
  Filter,
  TrendingUp,
  Calendar,
  Trophy,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Twitter,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { HeartFill } from "@/components/icons/heart-fill";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SportIcon } from "@/components/icons/sport-icons";
import { formatMarketLabelShort } from "@/lib/data/markets";

// ============================================================================
// HELPERS
// ============================================================================

const formatOdds = (price: number | null | undefined): string => {
  if (price === null || price === undefined) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
};

const formatSide = (side: string): string => {
  if (side === "over" || side === "o") return "o";
  if (side === "under" || side === "u") return "u";
  return side.charAt(0).toLowerCase();
};

const getBookLogo = (bookId?: string | null): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

const getBookName = (bookId?: string | null): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

const getUniqueBooks = (favorites: Favorite[]): string[] => {
  const books = new Set<string>();
  favorites.forEach((fav) => {
    if (fav.books_snapshot) {
      Object.keys(fav.books_snapshot).forEach((book) => books.add(book));
    }
  });
  return Array.from(books);
};

const calculateParlayOdds = (
  favorites: Favorite[],
  bookId: string
): { odds: number; legCount: number; missingLegs: number } | null => {
  let totalDecimal = 1;
  let legCount = 0;
  let missingLegs = 0;

  for (const fav of favorites) {
    const bookData = fav.books_snapshot?.[bookId];
    if (bookData?.price) {
      const american = bookData.price;
      const decimal = american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
      totalDecimal *= decimal;
      legCount++;
    } else {
      missingLegs++;
    }
  }

  if (legCount === 0) return null;

  const americanOdds = totalDecimal >= 2
    ? Math.round((totalDecimal - 1) * 100)
    : Math.round(-100 / (totalDecimal - 1));

  return { odds: americanOdds, legCount, missingLegs };
};

const getInitials = (name: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

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

const normalizeSport = (sport: string | null): string => {
  if (!sport) return "nba";
  const sportMap: Record<string, string> = {
    nba: "basketball_nba",
    nfl: "americanfootball_nfl",
    nhl: "icehockey_nhl",
    mlb: "baseball_mlb",
  };
  return sportMap[sport.toLowerCase()] || sport;
};

// ============================================================================
// PLAY CARD WITH EXPANDABLE ODDS - PREMIUM VERSION
// ============================================================================

function PlayCard({
  favorite,
  isSelected,
  onToggle,
  onRemove,
  isRemoving,
  selectedBook,
  liveOdds,
}: {
  favorite: Favorite;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  isRemoving: boolean;
  selectedBook: string | null;
  liveOdds?: RefreshedOdds | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const initials = getInitials(favorite.player_name);
  const avatarColor = getAvatarColor(favorite.player_name);
  const lastName = favorite.player_name?.split(" ").pop() || "Unknown";
  const fullName = favorite.player_name || "Unknown";
  const side = formatSide(favorite.side);
  const hasLine = favorite.line !== null && favorite.line !== undefined;
  const marketLabel = formatMarketLabelShort(favorite.market);
  const normalizedSport = normalizeSport(favorite.sport);

  // Use live odds if available, otherwise saved odds
  const savedPrice = favorite.best_price_at_save;
  const livePrice = liveOdds?.current_best_price;
  const liveBestBook = liveOdds?.current_best_book;
  const hasLiveOdds = liveOdds?.is_available && livePrice !== null && livePrice !== undefined;
  
  // Calculate odds movement
  const oddsMovement = hasLiveOdds && savedPrice 
    ? livePrice - savedPrice 
    : null;
  const oddsImproved = oddsMovement !== null && oddsMovement > 0;
  const oddsDeclined = oddsMovement !== null && oddsMovement < 0;

  const displayBook = selectedBook || (hasLiveOdds ? liveBestBook : favorite.best_book_at_save);
  const displayPrice = selectedBook && favorite.books_snapshot?.[selectedBook]?.price
    ? favorite.books_snapshot[selectedBook].price
    : (hasLiveOdds ? livePrice : savedPrice);
  const bookLogo = getBookLogo(displayBook);
  
  const bookData = displayBook ? favorite.books_snapshot?.[displayBook] : null;
  const betLink = bookData?.u || null;
  const hasOddsAtBook = !selectedBook || favorite.books_snapshot?.[selectedBook];

  // Sort books by odds for expanded view - prefer live odds when available
  const sortedBooks = useMemo(() => {
    // If we have live odds, use those as they're more current
    if (liveOdds?.all_books && liveOdds.all_books.length > 0) {
      return liveOdds.all_books
        .filter(book => book.price)
        .sort((a, b) => (b.price || 0) - (a.price || 0))
        .map(book => [book.book, { 
          price: book.price, 
          u: book.link, 
          sgp: book.sgp 
        }] as [string, BookSnapshot]);
    }
    // Fall back to saved snapshot
    if (!favorite.books_snapshot) return [];
    return Object.entries(favorite.books_snapshot)
      .filter(([_, data]) => data.price)
      .sort((a, b) => (b[1].price || 0) - (a[1].price || 0));
  }, [favorite.books_snapshot, liveOdds]);

  const bookCount = sortedBooks.length;
  const bestBook = sortedBooks[0];
  const oddsSpread = sortedBooks.length >= 2 
    ? (sortedBooks[0][1].price || 0) - (sortedBooks[sortedBooks.length - 1][1].price || 0)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "group relative rounded-2xl transition-all overflow-hidden",
        "bg-white dark:bg-neutral-900/80 backdrop-blur-sm",
        "border shadow-sm",
        isSelected
          ? "border-brand ring-2 ring-brand/20 shadow-brand/10"
          : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md",
        !hasOddsAtBook && selectedBook && "opacity-50"
      )}
    >
      {/* Selection indicator bar */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand to-brand/70" />
      )}
      
      {/* Main Row */}
      <div className="flex items-center gap-3 md:gap-4 p-4">
        {/* Checkbox with animation */}
        <motion.button
          onClick={onToggle}
          whileTap={{ scale: 0.9 }}
        className={cn(
            "shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all",
          isSelected
              ? "bg-brand border-brand text-white shadow-sm shadow-brand/30"
              : "border-neutral-300 dark:border-neutral-600 hover:border-brand hover:bg-brand/5"
        )}
      >
          <AnimatePresence mode="wait">
        {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-4 h-4" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Sport Icon Badge */}
        <div className={cn(
          "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
          "bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-800/50",
          "ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
        )}>
          <SportIcon sport={normalizedSport} className="w-4.5 h-4.5 text-neutral-600 dark:text-neutral-400" />
        </div>

        {/* Player Avatar with glow effect when selected */}
        <div className="relative shrink-0">
          {isSelected && (
            <div className={cn("absolute inset-0 rounded-full blur-md opacity-50 bg-gradient-to-br", avatarColor)} />
          )}
          <div className={cn(
            "relative w-11 h-11 rounded-full flex items-center justify-center",
            "bg-gradient-to-br shadow-md ring-2 ring-white/20",
            avatarColor
          )}>
            <span className="text-sm font-bold text-white tracking-tight">{initials}</span>
          </div>
        </div>

        {/* Player + Bet Info */}
      <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[15px] font-semibold text-neutral-900 dark:text-white truncate">
              {fullName}
          </span>
          {favorite.player_team && (
              <span className="hidden sm:inline-flex text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
              {favorite.player_team}
            </span>
          )}
        </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {marketLabel}
          </span>
            {hasLine && (
              <span className={cn(
                "text-sm font-bold px-1.5 py-0.5 rounded-md",
                side === "o" 
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" 
                  : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
              )}>
                {side}{favorite.line}
            </span>
          )}
        </div>
      </div>

        {/* Best Odds Display */}
        <div className="hidden md:flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
        {bookLogo && (
              <div className="w-5 h-5 rounded overflow-hidden bg-white dark:bg-neutral-800 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
                <Image src={bookLogo} alt={displayBook || ""} width={20} height={20} className="w-full h-full object-contain" />
              </div>
            )}
            <span className={cn(
              "text-lg font-bold tabular-nums",
              displayPrice && displayPrice >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
            )}>
              {formatOdds(displayPrice)}
            </span>
            {/* Odds Movement Indicator */}
            {oddsMovement !== null && oddsMovement !== 0 && (
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5",
                oddsImproved 
                  ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20"
                  : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20"
              )}>
                {oddsImproved ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5 rotate-180" />}
                {oddsImproved ? "+" : ""}{oddsMovement}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasLiveOdds && (
              <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                Live
              </span>
            )}
            {oddsSpread > 10 && (
              <span className="text-[10px] text-neutral-400">
                {bookCount} books • {oddsSpread}pt spread
              </span>
            )}
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-xs font-medium",
            isExpanded
              ? "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 ring-1 ring-violet-200/50 dark:ring-violet-500/30"
              : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
          )}
        >
          <span>{bookCount}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Bet Link */}
        {betLink && (
          <a
            href={betLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-xs font-semibold",
              "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/25",
              "md:hidden"
            )}
          >
            <span>{formatOdds(displayPrice)}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Desktop Bet Button */}
        {betLink && (
          <a
            href={betLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "hidden md:flex shrink-0 items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all text-sm font-semibold",
              "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
              "text-white shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30"
            )}
          >
            Bet
            <ArrowRight className="w-4 h-4" />
          </a>
        )}

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={isRemoving}
          className={cn(
            "shrink-0 p-2 rounded-xl transition-all",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            "text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10",
            isRemoving && "opacity-100"
          )}
        >
          {isRemoving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded Odds View - Premium Grid */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              <div className="bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-800/50 dark:to-neutral-800/30 rounded-xl p-4 ring-1 ring-neutral-200/50 dark:ring-neutral-700/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                      All Sportsbook Odds
                    </span>
                    {hasLiveOdds && (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-md uppercase">
                        Live
                      </span>
                    )}
    </div>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    Best to worst →
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {sortedBooks.map(([bookId, data], index) => {
                    const logo = getBookLogo(bookId);
                    const link = data.u;
                    const isBest = index === 0;
                    const bookName = getBookName(bookId);
                    
                    return (
                      <a
                        key={bookId}
                        href={link || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "group/book flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all",
                          "border",
                          isBest
                            ? "bg-gradient-to-br from-emerald-50 to-emerald-50/50 dark:from-emerald-500/15 dark:to-emerald-500/5 border-emerald-200/80 dark:border-emerald-500/30 ring-1 ring-emerald-100 dark:ring-emerald-500/10"
                            : "bg-white dark:bg-neutral-900/50 border-neutral-200/80 dark:border-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                          !link && "cursor-default opacity-75"
                        )}
                      >
                        {logo ? (
                          <div className="shrink-0 w-6 h-6 rounded-lg overflow-hidden bg-white dark:bg-neutral-800 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
                            <Image src={logo} alt={bookId} width={24} height={24} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="shrink-0 w-6 h-6 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "block text-sm font-bold tabular-nums",
                            isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-800 dark:text-neutral-200"
                          )}>
                            {formatOdds(data.price)}
                          </span>
                          <span className="block text-[10px] text-neutral-500 dark:text-neutral-500 truncate">
                            {bookName}
                          </span>
                        </div>
                        {isBest && (
                          <span className="shrink-0 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-md uppercase">
                            Best
                          </span>
                        )}
                        {link && !isBest && (
                          <ExternalLink className="shrink-0 w-3 h-3 text-neutral-400 opacity-0 group-hover/book:opacity-100 transition-opacity" />
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// LEGS CAROUSEL - Arrow navigation for selected legs
// ============================================================================

function LegsCarousel({ 
  favorites, 
  liveOddsCache 
}: { 
  favorites: Favorite[]; 
  liveOddsCache?: Record<string, RefreshedOdds>;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const visibleCount = 3; // Show 3 legs at a time
  
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex + visibleCount < favorites.length;
  
  const visibleFavorites = favorites.slice(currentIndex, currentIndex + visibleCount);
  
  const goBack = () => {
    if (canGoBack) setCurrentIndex(prev => Math.max(0, prev - 1));
  };
  
  const goForward = () => {
    if (canGoForward) setCurrentIndex(prev => Math.min(favorites.length - visibleCount, prev + 1));
  };

  // Reset index if favorites change
  useEffect(() => {
    setCurrentIndex(0);
  }, [favorites.length]);

  if (favorites.length === 0) return null;

  return (
    <div className="border-b border-neutral-100 dark:border-neutral-800/50">
      {/* Header with count and arrows */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-50 dark:border-neutral-800/30">
        <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          {favorites.length} Leg{favorites.length !== 1 ? 's' : ''}
        </span>
        {favorites.length > visibleCount && (
          <div className="flex items-center gap-1">
            <button
              onClick={goBack}
              disabled={!canGoBack}
        className={cn(
                "w-5 h-5 rounded flex items-center justify-center transition-colors",
                canGoBack 
                  ? "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" 
                  : "text-neutral-300 dark:text-neutral-700 cursor-not-allowed"
              )}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-[9px] text-neutral-400 tabular-nums min-w-[32px] text-center">
              {currentIndex + 1}-{Math.min(currentIndex + visibleCount, favorites.length)}
            </span>
            <button
              onClick={goForward}
              disabled={!canGoForward}
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center transition-colors",
                canGoForward 
                  ? "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" 
                  : "text-neutral-300 dark:text-neutral-700 cursor-not-allowed"
              )}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      
      {/* Visible legs */}
      <AnimatePresence mode="popLayout">
        {visibleFavorites.map((fav, localIndex) => {
          const globalIndex = currentIndex + localIndex;
          const side = formatSide(fav.side);
          const initials = getInitials(fav.player_name);
          const avatarColor = getAvatarColor(fav.player_name);
          
          // Get live odds for this favorite
          const liveData = liveOddsCache?.[fav.id];
          const livePrice = liveData?.current_best_price;
          const savedPrice = fav.best_price_at_save;
          const displayPrice = livePrice ?? savedPrice;
          const hasLive = liveData?.is_available && livePrice !== null && livePrice !== undefined;
          
          return (
            <motion.div 
              key={fav.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 px-3 py-2 border-b border-neutral-50 dark:border-neutral-800/30 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
            >
              <span className="w-4 h-4 rounded-full bg-neutral-200 dark:bg-neutral-700/80 flex items-center justify-center text-[9px] font-bold text-neutral-500 shrink-0">
                {globalIndex + 1}
              </span>
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br text-[8px] font-bold text-white shrink-0", avatarColor)}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-200 truncate block">
                  {fav.player_name || "Unknown"}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {formatMarketLabelShort(fav.market)} <span className={side === 'o' ? 'text-emerald-500' : 'text-red-500'}>{side}{fav.line}</span>
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className={cn(
                  "text-[11px] font-semibold tabular-nums",
                  hasLive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-300"
                )}>
                  {formatOdds(displayPrice)}
                </span>
                {hasLive && (
                  <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">•</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// LIVE PARLAY BUILDER PANEL - PREMIUM VERSION WITH SGP DETECTION
// ============================================================================

type BetType = 'single' | 'parlay' | 'sgp' | 'sgp_plus';

function classifyBetType(favorites: Favorite[]): BetType {
  if (favorites.length === 0 || favorites.length === 1) return 'single';
  
  // Group legs by event_id
  const eventGroups: Record<string, number> = {};
  for (const fav of favorites) {
    const eventId = fav.event_id;
    eventGroups[eventId] = (eventGroups[eventId] || 0) + 1;
  }
  
  const eventIds = Object.keys(eventGroups);
  const sgpEvents = eventIds.filter(id => eventGroups[id] >= 2);
  
  if (sgpEvents.length === 0) {
    // No event has 2+ legs - it's a regular parlay
    return 'parlay';
  } else if (sgpEvents.length === 1 && eventIds.length === 1) {
    // All legs are from the same game - it's a pure SGP
    return 'sgp';
  } else {
    // Multiple events with at least one having 2+ legs - it's SGP+
    return 'sgp_plus';
  }
}

function getBetTypeInfo(betType: BetType): { label: string; color: string; bg: string; icon: string } {
  switch (betType) {
    case 'single':
      return { label: 'Single', color: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800', icon: '1' };
    case 'parlay':
      return { label: 'Parlay', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/20', icon: '×' };
    case 'sgp':
      return { label: 'SGP', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20', icon: '⚡' };
    case 'sgp_plus':
      return { label: 'SGP+', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/20', icon: '🔥' };
  }
}

// SGP odds cache type for ParlayBuilder
interface ParlayBuilderSgpCache {
  [bookId: string]: {
    price: number | null;
    link: string | null;
    limits?: {
      max?: number;
      min?: number;
    };
    error?: string;
  };
}

function ParlayBuilder({
  selectedFavorites,
  allBooks,
  selectedBook,
  onBookChange,
  onClearSelection,
  onDeleteSelected,
  isDeletingSelected,
  onCreateSlip,
  isCreatingSlip,
  onCopyParlay,
  sharedSgpCache,
  onUpdateSgpCache,
  liveOddsCache,
}: {
  selectedFavorites: Favorite[];
  allBooks: string[];
  selectedBook: string | null;
  onBookChange: (book: string | null) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  isDeletingSelected: boolean;
  onCreateSlip: () => void;
  isCreatingSlip: boolean;
  onCopyParlay?: () => void;
  sharedSgpCache?: ParlayBuilderSgpCache | null;
  onUpdateSgpCache?: (favoriteIds: string[], cache: ParlayBuilderSgpCache) => void;
  liveOddsCache?: Record<string, RefreshedOdds>;
}) {
  const [stake, setStake] = useState<string>("25");
  const [copied, setCopied] = useState(false);
  const [localSgpCache, setLocalSgpCache] = useState<ParlayBuilderSgpCache>({});
  const [isFetchingSgp, setIsFetchingSgp] = useState(false);
  const [hasFetchedSgp, setHasFetchedSgp] = useState(false);
  const [isFetchingDeeplink, setIsFetchingDeeplink] = useState(false);
  const [fetchedDeeplinks, setFetchedDeeplinks] = useState<Record<string, { desktop?: string; mobile?: string } | null>>({});

  // Use shared cache if available, otherwise use local
  const sgpOddsCache = sharedSgpCache && Object.keys(sharedSgpCache).length > 0 
    ? sharedSgpCache 
    : localSgpCache;

  // Classify bet type
  const betType = useMemo(() => classifyBetType(selectedFavorites), [selectedFavorites]);
  const betTypeInfo = getBetTypeInfo(betType);
  const needsSgpOdds = betType === 'sgp' || betType === 'sgp_plus';
  
  // Parse SGP price string to number (handles "+2755", "-150", "+2666.98", etc.)
  const parseSgpPrice = (priceStr: string | undefined): number | null => {
    if (!priceStr) return null;
    // Keep digits, minus sign, and decimal point
    const cleaned = priceStr.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    // Round to nearest integer for American odds
    return priceStr.startsWith('-') ? -Math.abs(Math.round(num)) : Math.round(num);
  };
  
  // Fetch SGP odds from vendor for selected favorites
  const fetchSgpOddsForFavorites = useCallback(async () => {
    if (!needsSgpOdds || selectedFavorites.length < 2) return;
    
    setIsFetchingSgp(true);
    setHasFetchedSgp(true);
    
    try {
      // Collect SGP tokens for each book
      const bookTokensMap = new Map<string, string[]>();
      const sgpBooks = allBooks.filter(book => {
        // Check if this book supports SGP (has sgp tokens in at least 2 favorites)
        const tokensCount = selectedFavorites.filter(f => f.books_snapshot?.[book]?.sgp).length;
        return tokensCount >= 2;
      });
      
      for (const book of sgpBooks) {
        const tokens: string[] = [];
        for (const fav of selectedFavorites) {
          const sgpToken = fav.books_snapshot?.[book]?.sgp;
          if (sgpToken) tokens.push(sgpToken);
        }
        if (tokens.length >= 2) {
          bookTokensMap.set(book, tokens);
        }
      }
      
      // Fetch from API for each book
      const results: ParlayBuilderSgpCache = {};
      
      await Promise.all(
        Array.from(bookTokensMap.entries()).map(async ([bookId, tokens]) => {
          try {
            const response = await fetch(`/api/v2/sgp-odds-direct`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ book_id: bookId, sgp_tokens: tokens }),
            });
            
            if (response.ok) {
              const data = await response.json();
              results[bookId] = {
                price: parseSgpPrice(data.price),
                link: data.links?.desktop || data.links?.mobile || null,
                limits: data.limits,
              };
            } else {
              results[bookId] = { price: null, link: null, error: 'Failed to fetch' };
            }
          } catch {
            results[bookId] = { price: null, link: null, error: 'Network error' };
          }
        })
      );
      
      // Update local cache
      setLocalSgpCache(results);
      
      // Update shared cache if callback provided
      if (onUpdateSgpCache) {
        onUpdateSgpCache(selectedFavorites.map(f => f.id), results);
      }
    } catch (error) {
      console.error('[ParlayBuilder] SGP fetch error:', error);
    } finally {
      setIsFetchingSgp(false);
    }
  }, [needsSgpOdds, selectedFavorites, allBooks, onUpdateSgpCache]);
  
  // Auto-fetch SGP odds when needed
  useEffect(() => {
    if (needsSgpOdds && selectedFavorites.length >= 2 && !hasFetchedSgp && !isFetchingSgp) {
      fetchSgpOddsForFavorites();
    }
  }, [needsSgpOdds, selectedFavorites.length, hasFetchedSgp, isFetchingSgp, fetchSgpOddsForFavorites]);
  
  // Reset local SGP cache when favorites change (but check shared cache first)
  useEffect(() => {
    // If we have valid shared cache, mark as fetched
    if (sharedSgpCache && Object.keys(sharedSgpCache).length > 0) {
      setHasFetchedSgp(true);
    } else {
      setLocalSgpCache({});
      setHasFetchedSgp(false);
    }
    setFetchedDeeplinks({});
  }, [selectedFavorites.map(f => f.id).join(','), sharedSgpCache]);

  // Fetch deeplink on-demand when user clicks Bet (for regular parlays or missing links)
  const fetchDeeplinkAndRedirect = useCallback(async (bookId: string) => {
    // Check if we already have the deeplink cached (from SGP fetch or previous click)
    const cachedSgpLink = sgpOddsCache[bookId]?.link;
    if (cachedSgpLink) {
      window.open(cachedSgpLink, '_blank');
      return;
    }
    
    if (fetchedDeeplinks[bookId]) {
      const links = fetchedDeeplinks[bookId];
      const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const link = isMobile ? (links?.mobile || links?.desktop) : (links?.desktop || links?.mobile);
      if (link) {
        window.open(link, '_blank');
        return;
      }
    }
    
    // Get SGP tokens from the favorites - try both sgp field and odds_selection_id
    const sgpTokens = selectedFavorites
      .map(fav => {
        // First try the sgp field in books_snapshot
        const sgpToken = fav.books_snapshot?.[bookId]?.sgp;
        if (sgpToken) return sgpToken;
        // Fall back to odds_selection_id if available
        return fav.odds_selection_id;
      })
      .filter(Boolean) as string[];
    
    console.log('[ParlayBuilder] SGP tokens for', bookId, ':', sgpTokens);
    
    if (sgpTokens.length === 0 || sgpTokens.length < selectedFavorites.length) {
      console.log('[ParlayBuilder] Missing SGP tokens, falling back to homepage');
      // No SGP tokens available, fall back to sportsbook homepage
      const bookMeta = getSportsbookById(bookId);
      const homeLink = bookMeta?.links?.desktop || bookMeta?.links?.mobile || bookMeta?.affiliateLink;
      if (homeLink) window.open(homeLink, '_blank');
      return;
    }
    
    setIsFetchingDeeplink(true);
    try {
      console.log('[ParlayBuilder] Fetching SGP odds for', bookId, 'with tokens:', sgpTokens);
      const response = await fetch('/api/v2/sgp-odds-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          sgp_tokens: sgpTokens,
        }),
      });
      
      console.log('[ParlayBuilder] API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[ParlayBuilder] API response data:', data);
        const links = data.links || null;
        
        // Cache the fetched links
        setFetchedDeeplinks(prev => ({ ...prev, [bookId]: links }));
        
        if (links) {
          const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          const link = isMobile ? (links.mobile || links.desktop) : (links.desktop || links.mobile);
          if (link) {
            window.open(link, '_blank');
            return;
          }
        }
      }
      
      // Fallback to sportsbook homepage if no deeplink available
      console.log('[ParlayBuilder] No deeplink in response, falling back to homepage');
      const bookMeta = getSportsbookById(bookId);
      const homeLink = bookMeta?.links?.desktop || bookMeta?.links?.mobile || bookMeta?.affiliateLink;
      if (homeLink) window.open(homeLink, '_blank');
    } catch (error) {
      console.error('[ParlayBuilder] Failed to fetch deeplink:', error);
      // Fallback to sportsbook homepage
      const bookMeta = getSportsbookById(bookId);
      const homeLink = bookMeta?.links?.desktop || bookMeta?.links?.mobile || bookMeta?.affiliateLink;
      if (homeLink) window.open(homeLink, '_blank');
    } finally {
      setIsFetchingDeeplink(false);
    }
  }, [selectedFavorites, sgpOddsCache, fetchedDeeplinks]);

  const parlayByBook = useMemo(() => {
    if (selectedFavorites.length < 2) return [];
    
    return allBooks
      .map(book => {
        const result = calculateParlayOdds(selectedFavorites, book);
        if (!result) return null;
        return { book, ...result };
      })
      .filter((x): x is { book: string; odds: number; legCount: number; missingLegs: number } => 
        x !== null && x.legCount === selectedFavorites.length
      )
      .sort((a, b) => b.odds - a.odds);
  }, [selectedFavorites, allBooks]);

  const currentParlay = useMemo(() => {
    if (!selectedBook) return parlayByBook[0] || null;
    return parlayByBook.find(p => p.book === selectedBook) || null;
  }, [parlayByBook, selectedBook]);

  const stakeNum = parseFloat(stake) || 0;
  const payout = useMemo(() => {
    if (!currentParlay || stakeNum <= 0) return 0;
    const decimal = currentParlay.odds > 0 
      ? 1 + currentParlay.odds / 100 
      : 1 + 100 / Math.abs(currentParlay.odds);
    return stakeNum * decimal;
  }, [currentParlay, stakeNum]);

  const handleCopy = () => {
    const text = selectedFavorites.map(f => {
      const side = formatSide(f.side);
      return `${f.player_name} ${formatMarketLabelShort(f.market)} ${side}${f.line || ""}`;
    }).join("\n");
    
    const parlayText = currentParlay 
      ? `\n\n${betTypeInfo.label}: ${formatOdds(currentParlay.odds)} @ ${getBookName(currentParlay.book)}`
      : "";
    
    navigator.clipboard.writeText(text + parlayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopyParlay?.();
  };

  const bestBook = parlayByBook[0];
  const displayBook = selectedBook || bestBook?.book;

  // Empty state - clean version
  if (selectedFavorites.length < 2) {
  return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-800/30">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
              Parlay Builder
            </span>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
            <Calculator className="w-5 h-5 text-neutral-400" />
          </div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Select 2+ plays
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
            to build a parlay and compare odds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with bet type badge */}
      <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
              Parlay Builder
              </span>
          </div>
          <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide", betTypeInfo.bg, betTypeInfo.color)}>
            <span>{betTypeInfo.icon}</span>
            <span>{betTypeInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Selected Legs - With arrow navigation */}
      <LegsCarousel 
        favorites={selectedFavorites} 
        liveOddsCache={liveOddsCache} 
      />

      {/* Book Selector - Compact chips */}
      <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
              Compare Books
            </span>
            {needsSgpOdds && isFetchingSgp && (
              <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {needsSgpOdds && Object.keys(sgpOddsCache).length > 0 && (
              <button
                onClick={fetchSgpOddsForFavorites}
                disabled={isFetchingSgp}
                className="text-[9px] text-brand hover:underline"
              >
                Refresh
              </button>
            )}
            <span className="text-[9px] text-neutral-400">{parlayByBook.length} available</span>
        </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {parlayByBook.slice(0, 8).map(({ book, odds }, index) => {
            const logo = getBookLogo(book);
            const isSelected = book === displayBook;
            const isBest = index === 0;
            
            // Use SGP odds from cache if available
            const sgpData = needsSgpOdds ? sgpOddsCache[book] : null;
            const displayOddsValue = sgpData?.price ?? odds;
            const hasSgpLink = !!sgpData?.link;
            const maxLimit = sgpData?.limits?.max;
            
            // Build tooltip
            const tooltipText = `${getBookName(book)}: ${formatOdds(displayOddsValue)}${hasSgpLink ? ' (SGP)' : ''}${maxLimit ? ` • Max: $${maxLimit.toLocaleString()}` : ''}`;
            
            return (
              <button
                key={book}
                onClick={() => onBookChange(book === selectedBook ? null : book)}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-1 rounded-md transition-all text-[10px]",
                  "border",
                  isSelected
                    ? "bg-brand/10 border-brand"
                    : isBest
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/30"
                      : "bg-white dark:bg-neutral-800/50 border-neutral-200/60 dark:border-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-600"
                )}
                title={tooltipText}
              >
                {logo && (
                  <div className="w-3.5 h-3.5 rounded overflow-hidden bg-white dark:bg-neutral-900">
                    <Image src={logo} alt={book} width={14} height={14} className="w-full h-full object-contain" />
                  </div>
                )}
                <span className={cn(
                  "font-bold tabular-nums",
                  isSelected ? "text-brand" : isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400"
                )}>
                  {formatOdds(displayOddsValue)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Odds Display - Compact */}
      <div className="flex-1 px-3 py-3">
        {currentParlay ? (() => {
          // Get SGP data for current book
          const sgpData = needsSgpOdds ? sgpOddsCache[currentParlay.book] : null;
          const displayOdds = sgpData?.price ?? currentParlay.odds;
          const sgpLink = sgpData?.link;
          const betLink = sgpLink;
          const bookMeta = getSportsbookById(currentParlay.book);
          const homeLink = bookMeta?.links?.desktop || bookMeta?.links?.mobile || bookMeta?.affiliateLink;
          const bookName = getBookName(currentParlay.book);
          
          const effectivePayout = stakeNum <= 0 ? 0 : (() => {
            const decimal = displayOdds > 0 
              ? 1 + displayOdds / 100 
              : 1 + 100 / Math.abs(displayOdds);
            return stakeNum * decimal;
          })();
          
          return (
            <div className="space-y-3">
              {/* Odds display - Compact */}
              <div className="text-center py-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 mb-1.5">
                  {(() => {
                    const logo = getBookLogo(currentParlay.book);
                    return logo ? (
                      <div className="w-3.5 h-3.5 rounded overflow-hidden">
                        <Image src={logo} alt={currentParlay.book} width={14} height={14} className="w-full h-full object-contain" />
                      </div>
                    ) : null;
                  })()}
                  <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                    {bookName}
                  </span>
                  {needsSgpOdds && sgpLink && (
                    <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1 rounded">
                      SGP
                    </span>
                  )}
                </div>
                <motion.div
                  key={displayOdds}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={cn(
                    "text-4xl font-black tabular-nums tracking-tight",
                    displayOdds >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                  )}
                >
                  {formatOdds(displayOdds)}
                </motion.div>
                
                {/* SGP status */}
                {needsSgpOdds && !sgpLink && (
                  <p className="text-[9px] text-amber-600/80 dark:text-amber-400/80 mt-1 flex items-center justify-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Estimated odds
                  </p>
                )}
                {needsSgpOdds && sgpLink && (
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" />
                      Live SGP odds from {bookName}
                    </p>
                    {sgpData?.limits?.max && (
                      <span className="text-[9px] text-neutral-400">• Max: ${sgpData.limits.max.toLocaleString()}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Stake & Payout - Compact */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1 block">
                    Stake
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">$</span>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className={cn(
                        "w-full pl-6 pr-2 py-2 rounded-lg text-sm font-bold",
                        "bg-neutral-100 dark:bg-neutral-800",
                        "border border-neutral-200/60 dark:border-neutral-700/50",
                        "focus:outline-none focus:ring-1 focus:ring-brand focus:border-transparent",
                        "text-neutral-900 dark:text-white"
                      )}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1 block">
                    To Win
                  </label>
                  <div className="px-2.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-200/50 dark:ring-emerald-500/20">
                    <motion.span
                      key={effectivePayout}
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums"
                    >
                      ${effectivePayout.toFixed(2)}
                    </motion.span>
                  </div>
                </div>
              </div>
              
              {/* Bet Button - Compact */}
              {betLink ? (
                <a
                  href={betLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  Bet on {bookName}
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              ) : selectedFavorites.length >= 2 ? (
                <button
                  onClick={() => fetchDeeplinkAndRedirect(currentParlay.book)}
                  disabled={isFetchingDeeplink}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-500 text-white transition-colors"
                >
                  {isFetchingDeeplink ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Bet on {bookName}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              ) : homeLink ? (
                <a
                  href={homeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Visit {bookName}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}

              {/* Better odds hint - Compact */}
              {bestBook && bestBook.book !== currentParlay.book && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <Trophy className="w-3 h-3 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    <span className="font-semibold">{getBookName(bestBook.book)}</span>: {formatOdds(needsSgpOdds && sgpOddsCache[bestBook.book]?.price ? sgpOddsCache[bestBook.book].price : bestBook.odds)}
                  </p>
                </div>
              )}
            </div>
          );
        })() : (
          <div className="text-center py-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">No book has all {selectedFavorites.length} legs</p>
          </div>
        )}
      </div>

      {/* Actions - Compact */}
      <div className="px-3 py-2.5 border-t border-neutral-100 dark:border-neutral-800/50 space-y-2">
        <button
          onClick={onCreateSlip}
          disabled={isCreatingSlip}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors",
            "bg-brand hover:bg-brand/90 text-white",
            isCreatingSlip && "opacity-50 cursor-not-allowed"
          )}
        >
          {isCreatingSlip ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FolderPlus className="w-3.5 h-3.5" />
          )}
          Save as Slip
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onClearSelection}
            className="flex-1 py-1.5 rounded-md text-[11px] font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onDeleteSelected}
            disabled={isDeletingSelected}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {isDeletingSelected ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BETSLIP CARD - WITH SGP API INTEGRATION
// ============================================================================

function BetslipCard({
  slip,
  onDelete,
  onRemoveItem,
  isDeleting,
  onFetchSgpOdds,
  isFetchingSgpOdds,
  sharedSgpCache,
}: {
  slip: Betslip;
  onDelete: () => void;
  onRemoveItem: (favoriteId: string) => void;
  isDeleting: boolean;
  onFetchSgpOdds?: (betslipId: string, forceRefresh?: boolean) => Promise<void>;
  isFetchingSgpOdds?: boolean;
  sharedSgpCache?: ParlayBuilderSgpCache | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasFetchedSgp, setHasFetchedSgp] = useState(false);
  const [isFetchingDeeplink, setIsFetchingDeeplink] = useState(false);
  const [fetchedDeeplinks, setFetchedDeeplinks] = useState<Record<string, { desktop?: string; mobile?: string } | null>>({});
  const items = slip.items || [];
  const colorClass = getColorClass(slip.color);
  
  // Classify bet type
  const betType = useMemo((): BetType => {
    const favorites = items.map(i => i.favorite).filter(Boolean) as Favorite[];
    return classifyBetType(favorites);
  }, [items]);
  const betTypeInfo = getBetTypeInfo(betType);
  
  // Check if we need SGP odds
  const needsSgpOdds = betType === 'sgp' || betType === 'sgp_plus';
  
  // Use shared cache if available and matches this slip's items, otherwise use slip's own cache
  const hasSharedCache = sharedSgpCache && Object.keys(sharedSgpCache).length > 0;
  const effectiveSgpCache = hasSharedCache ? sharedSgpCache : slip.sgp_odds_cache;
  
  const hasSgpCache = !!effectiveSgpCache && Object.keys(effectiveSgpCache).length > 0;
  const sgpCacheAge = hasSharedCache 
    ? 0 // Shared cache is always fresh (managed by parent)
    : slip.sgp_odds_updated_at 
      ? Date.now() - new Date(slip.sgp_odds_updated_at).getTime()
      : Infinity;
  const isSgpCacheStale = sgpCacheAge > 5 * 60 * 1000; // 5 minutes
  
  // Auto-fetch SGP odds when needed
  useEffect(() => {
    if (needsSgpOdds && onFetchSgpOdds && !isFetchingSgpOdds && !hasFetchedSgp && (!hasSgpCache || isSgpCacheStale)) {
      setHasFetchedSgp(true);
      onFetchSgpOdds(slip.id, false).catch(console.error);
    }
  }, [needsSgpOdds, onFetchSgpOdds, isFetchingSgpOdds, hasFetchedSgp, hasSgpCache, isSgpCacheStale, slip.id]);
  
  // Fetch deeplink on-demand for regular parlays (when user clicks Bet)
  const fetchDeeplinkAndRedirect = useCallback(async (bookId: string) => {
    // Check if we already have the deeplink cached
    if (fetchedDeeplinks[bookId]) {
      const links = fetchedDeeplinks[bookId];
      const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const link = isMobile ? (links?.mobile || links?.desktop) : (links?.desktop || links?.mobile);
      if (link) {
        window.open(link, '_blank');
        return;
      }
    }
    
    // Get SGP tokens from the items - try both sgp field and odds_selection_id
    const sgpTokens = items
      .map(item => {
        const fav = item.favorite;
        if (!fav) return null;
        // First try the sgp field in books_snapshot
        const sgpToken = fav.books_snapshot?.[bookId]?.sgp;
        if (sgpToken) return sgpToken;
        // Fall back to odds_selection_id if available
        return fav.odds_selection_id;
      })
      .filter(Boolean) as string[];
    
    console.log('[BetslipCard] SGP tokens for', bookId, ':', sgpTokens);
    
    if (sgpTokens.length === 0 || sgpTokens.length < items.length) {
      console.log('[BetslipCard] Missing SGP tokens, falling back to homepage');
      // No SGP tokens available, fall back to sportsbook homepage
      const bookMeta = getSportsbookById(bookId);
      const homeLink = bookMeta?.links?.desktop || bookMeta?.links?.mobile || bookMeta?.affiliateLink;
      if (homeLink) window.open(homeLink, '_blank');
      return;
    }
    
    setIsFetchingDeeplink(true);
    try {
      console.log('[BetslipCard] Fetching SGP odds for', bookId, 'with tokens:', sgpTokens);
      const response = await fetch('/api/v2/sgp-odds-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          sgp_tokens: sgpTokens,
        }),
      });
      
      console.log('[BetslipCard] API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[BetslipCard] API response data:', data);
        const links = data.links || null;
        
        // Cache the fetched links
        setFetchedDeeplinks(prev => ({ ...prev, [bookId]: links }));
        
        if (links) {
          const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          const link = isMobile ? (links.mobile || links.desktop) : (links.desktop || links.mobile);
          if (link) {
            window.open(link, '_blank');
            return;
          }
        }
      }
      
      // Fallback to sportsbook homepage if no deeplink available
      console.log('[BetslipCard] No deeplink in response, falling back to homepage');
      const bookMeta = getSportsbookById(bookId);
      const homeLink = bookMeta?.links?.desktop || bookMeta?.links?.mobile || bookMeta?.affiliateLink;
      if (homeLink) window.open(homeLink, '_blank');
    } catch (error) {
      console.error('[BetslipCard] Failed to fetch deeplink:', error);
      // Fallback to sportsbook homepage
      const bookMeta = getSportsbookById(bookId);
      const homeLink = bookMeta?.links?.desktop || bookMeta?.links?.mobile || bookMeta?.affiliateLink;
      if (homeLink) window.open(homeLink, '_blank');
    } finally {
      setIsFetchingDeeplink(false);
    }
  }, [items, fetchedDeeplinks]);

  // Calculate parlay odds per book with leg counts
  const bookOddsData = useMemo(() => {
    if (items.length === 0) return [];
    
    const allBooks = new Set<string>();
    items.forEach(item => {
      if (item.favorite?.books_snapshot) {
        Object.keys(item.favorite.books_snapshot).forEach(b => allBooks.add(b));
      }
    });

    const results: { book: string; odds: number | null; legCount: number; hasAll: boolean }[] = [];
    allBooks.forEach(book => {
      let totalDecimal = 1;
      let legCount = 0;
      
      items.forEach(item => {
        const price = item.favorite?.books_snapshot?.[book]?.price;
        if (price) {
          const decimal = price > 0 ? 1 + price / 100 : 1 + 100 / Math.abs(price);
          totalDecimal *= decimal;
          legCount++;
        }
      });

      if (legCount > 0) {
        const american = totalDecimal >= 2
          ? Math.round((totalDecimal - 1) * 100)
          : Math.round(-100 / (totalDecimal - 1));
        results.push({ 
          book, 
          odds: american, 
          legCount, 
          hasAll: legCount === items.length 
        });
      }
    });

    // Sort: complete books first (by odds), then partial books (by leg count)
    return results.sort((a, b) => {
      if (a.hasAll && !b.hasAll) return -1;
      if (!a.hasAll && b.hasAll) return 1;
      if (a.hasAll && b.hasAll) return (b.odds || 0) - (a.odds || 0);
      return b.legCount - a.legCount;
    });
  }, [items]);

  // Get current display book (selected or best)
  const displayBook = selectedBook || bookOddsData.find(b => b.hasAll)?.book || bookOddsData[0]?.book || null;
  const currentBookData = bookOddsData.find(b => b.book === displayBook);

  // Get odds for display book
  const getOddsForBook = (bookId: string | null, fav: Favorite | null | undefined) => {
    if (!bookId || !fav?.books_snapshot) return fav?.best_price_at_save || null;
    return fav.books_snapshot[bookId]?.price || null;
  };
  
  // Get SGP odds and link for display book (if available from cache)
  const sgpOddsForBook = needsSgpOdds ? effectiveSgpCache?.[displayBook || ''] : null;
  // Handle both cache formats: shared cache has 'link', database cache has 'links'
  const sgpLinkForBook = sgpOddsForBook 
    ? ('link' in sgpOddsForBook && sgpOddsForBook.link) 
      || ('links' in sgpOddsForBook && (sgpOddsForBook.links?.desktop || sgpOddsForBook.links?.mobile)) 
      || null
    : null;
  // Parse SGP price - handles both number (from shared cache) and string (from database cache)
  const parseSgpPrice = (price: string | number | null | undefined): number | null => {
    if (price === null || price === undefined) return null;
    if (typeof price === 'number') return price;
    // Keep digits, minus sign, and decimal point
    const cleaned = price.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    // Round to nearest integer for American odds
    return price.startsWith('-') ? -Math.abs(Math.round(num)) : Math.round(num);
  };
  const sgpPriceForBook = parseSgpPrice(sgpOddsForBook?.price);
  
  // Copy slip to clipboard
  const handleCopy = useCallback(() => {
    const text = items.map((item, i) => {
      const fav = item.favorite;
      if (!fav) return '';
      const side = formatSide(fav.side);
      return `${i + 1}. ${fav.player_name} ${formatMarketLabelShort(fav.market)} ${side}${fav.line || ''}`;
    }).filter(Boolean).join('\n');
    
    const oddsText = currentBookData ? `\n\n${betTypeInfo.label}: ${formatOdds(sgpPriceForBook ?? currentBookData.odds)} @ ${getBookName(displayBook || '')}` : '';
    
    navigator.clipboard.writeText(`${slip.name}\n${text}${oddsText}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [items, slip.name, betTypeInfo.label, currentBookData, displayBook, sgpOddsForBook]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "rounded-2xl border overflow-hidden transition-all h-full flex flex-col",
        "bg-white dark:bg-neutral-900/80 backdrop-blur-sm",
        isExpanded 
          ? "border-neutral-300 dark:border-neutral-700 shadow-lg" 
          : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md"
      )}
    >
      {/* Color accent bar */}
      <div className={cn("h-1 shrink-0", colorClass)} />
      
      {/* Header */}
      <div className="p-3 pb-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {slip.name}
              </span>
              <span className={cn(
                "shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase",
                betTypeInfo.bg, betTypeInfo.color
              )}>
                {items.length > 1 ? betTypeInfo.label : items.length === 1 ? '1' : '0'}
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {items.length} {items.length === 1 ? "leg" : "legs"}
            </span>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isDeleting}
              className="p-1 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Sportsbook Selector with Odds */}
      {items.length > 0 && (
        <div className="px-3 pb-2 shrink-0">
          <div className="flex flex-wrap gap-1">
            {bookOddsData.slice(0, 6).map(({ book, odds, legCount, hasAll }) => {
              const logo = getBookLogo(book);
              const isSelected = book === displayBook;
              const isBest = bookOddsData.findIndex(b => b.hasAll) === bookOddsData.findIndex(b => b.book === book);
              
              // Use SGP odds from cache if available for this book
              const sgpOddsForThisBook = needsSgpOdds ? effectiveSgpCache?.[book] : null;
              const sgpPriceForThisBook = parseSgpPrice(sgpOddsForThisBook?.price);
              const displayOddsValue = sgpPriceForThisBook ?? odds;
              // Check for link in either format (shared cache uses 'link', database uses 'links')
              const hasSgpLink = sgpOddsForThisBook 
                ? (('link' in sgpOddsForThisBook && !!sgpOddsForThisBook.link) || ('links' in sgpOddsForThisBook && !!sgpOddsForThisBook.links))
                : false;
              const maxLimit = sgpOddsForThisBook?.limits?.max;
              
              // Build tooltip text
              const tooltipText = hasAll 
                ? `${getBookName(book)}: ${formatOdds(displayOddsValue)}${hasSgpLink ? ' (SGP)' : ''}${maxLimit ? ` • Max: $${maxLimit.toLocaleString()}` : ''}`
                : `${getBookName(book)}: ${legCount}/${items.length} legs`;
              
              return (
                <button
                  key={book}
                  onClick={() => setSelectedBook(book === selectedBook ? null : book)}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all text-[10px]",
                    isSelected
                      ? "bg-brand/10 ring-1 ring-brand"
                      : hasAll
                        ? isBest 
                          ? "bg-emerald-50 dark:bg-emerald-500/15 ring-1 ring-emerald-200/50 dark:ring-emerald-500/20"
                          : "bg-neutral-100 dark:bg-neutral-800"
                        : "bg-neutral-100/50 dark:bg-neutral-800/30 opacity-50"
                  )}
                  title={tooltipText}
                >
                  {logo && (
                    <div className="w-4 h-4 rounded overflow-hidden bg-white dark:bg-neutral-900">
                      <Image src={logo} alt={book} width={16} height={16} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <span className={cn(
                    "font-bold tabular-nums",
                    isSelected ? "text-brand" : hasAll ? (isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400") : "text-neutral-400"
                  )}>
                    {hasAll ? formatOdds(displayOddsValue) : `${legCount}/${items.length}`}
                  </span>
                  {isBest && hasAll && <Trophy className="w-2.5 h-2.5 text-emerald-500" />}
                </button>
              );
            })}
            {bookOddsData.length > 6 && (
              <span className="flex items-center px-1.5 py-1 text-[10px] text-neutral-400">
                +{bookOddsData.length - 6}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Leg List */}
      <div className="flex-1 px-3 pb-2 overflow-hidden">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-4 rounded-xl bg-neutral-50/50 dark:bg-neutral-800/20">
            <Layers className="w-6 h-6 text-neutral-300 dark:text-neutral-600 mb-1" />
            <p className="text-[11px] text-neutral-400">Empty slip</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.slice(0, isExpanded ? items.length : 4).map((item, index) => {
              const fav = item.favorite;
              if (!fav) return null;
              
              const initials = getInitials(fav.player_name);
              const avatarColor = getAvatarColor(fav.player_name);
              const side = formatSide(fav.side);
              const lastName = fav.player_name?.split(" ").pop() || "";
              const bookOdds = getOddsForBook(displayBook, fav);
              const hasOddsAtBook = bookOdds !== null;
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-lg transition-all",
                    "bg-neutral-50/80 dark:bg-neutral-800/40",
                    !hasOddsAtBook && "opacity-50"
                  )}
                >
                  <div className={cn(
                    "shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                    "bg-gradient-to-br text-[9px] font-bold text-white",
                    avatarColor
                  )}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-100 truncate block">
                      {lastName}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                        {formatMarketLabelShort(fav.market)}
                      </span>
                      <span className={cn(
                        "text-[10px] font-semibold",
                        side === 'o' ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                      )}>
                        {side}{fav.line}
                    </span>
                  </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn(
                      "text-[11px] font-bold tabular-nums block",
                      hasOddsAtBook ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 line-through"
                    )}>
                      {hasOddsAtBook ? formatOdds(bookOdds) : formatOdds(fav.best_price_at_save)}
                    </span>
                    {!hasOddsAtBook && (
                      <span className="text-[9px] text-amber-500">N/A</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.favorite_id);
                    }}
                    className="shrink-0 p-1 rounded text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                    title="Remove leg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Footer */}
      {items.length > 0 && (
        <div className="px-3 pb-3 pt-1 shrink-0 space-y-2">
          {/* Expand/Collapse for more than 4 legs */}
          {items.length > 4 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/30 text-neutral-500 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/50 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span className="text-[10px] font-medium">Show less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span className="text-[10px] font-medium">+{items.length - 4} more</span>
                </>
              )}
            </button>
          )}
          
          {/* Total Odds Display with Bet Button */}
          {currentBookData && (() => {
            // Only use SGP link for direct bet - don't fall back to individual leg link for parlays
            // Individual leg links would only add one leg, not the full parlay
            const betLink = sgpLinkForBook;
            const displayOdds = sgpPriceForBook ?? currentBookData.odds;
            
            return (
              <div className={cn(
                "flex items-center gap-2 p-2.5 rounded-xl",
                currentBookData.hasAll
                  ? "bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-500/15 dark:to-emerald-500/5 ring-1 ring-emerald-200/50 dark:ring-emerald-500/20"
                  : "bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200/50 dark:ring-amber-500/20"
              )}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {(() => {
                    const logo = getBookLogo(displayBook || '');
                    return logo ? (
                      <div className="w-6 h-6 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50 shrink-0">
                        <Image src={logo} alt={displayBook || ''} width={24} height={24} className="w-full h-full object-contain" />
                      </div>
                    ) : null;
                  })()}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {currentBookData.hasAll ? betTypeInfo.label : `${currentBookData.legCount}/${items.length}`}
                      </span>
                      {needsSgpOdds && isFetchingSgpOdds && (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-400" />
                      )}
                      {needsSgpOdds && sgpLinkForBook && (
                        <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1 rounded">
                          SGP
                        </span>
                      )}
                      {/* Max Limit Display */}
                      {sgpOddsForBook?.limits?.max && (
                        <span className="text-[8px] font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1 rounded">
                          Max ${sgpOddsForBook.limits.max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-base font-black tabular-nums",
                      currentBookData.hasAll ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                    )}>
                      {formatOdds(displayOdds)}
                    </span>
                  </div>
                </div>
                
                {/* Partial Badge or Bet Button */}
                {!currentBookData.hasAll ? (
                  <span className="shrink-0 text-[9px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded">
                    Partial
                  </span>
                ) : betLink ? (
                  // SGP/SGP+ with cached deeplink
                  <a
                    href={betLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                  >
                    Bet
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : items.length >= 2 ? (
                  // Parlay/SGP without cached link - fetch on click
                  <button
                    onClick={() => displayBook && fetchDeeplinkAndRedirect(displayBook)}
                    disabled={isFetchingDeeplink}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-emerald-400 disabled:to-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                  >
                    {isFetchingDeeplink ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Bet
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                ) : (() => {
                  // Single bet or no link - fallback to homepage
                  const bookMeta = getSportsbookById(displayBook || '');
                  const homeLink = bookMeta?.links?.desktop || bookMeta?.links?.mobile || bookMeta?.affiliateLink;
                  const bookName = getBookName(displayBook || '');
                  
                  // For single bets, try to use the leg's direct link first
                  const singleBetLink = items.length === 1 
                    ? items[0]?.favorite?.books_snapshot?.[displayBook || '']?.u 
                    : null;
                  
                  return singleBetLink ? (
                    <a
                      href={singleBetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                    >
                      Bet
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  ) : homeLink ? (
                    <a
                      href={homeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                      title={`No deeplink available for ${bookName}. Opens ${bookName} homepage.`}
                    >
                      Visit
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="shrink-0 text-[9px] text-neutral-400 px-2">
                      No link
                    </span>
                  );
                })()}
              </div>
            );
          })()}
          
          {/* Action Buttons Row */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-xs font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              className="flex items-center justify-center gap-1 p-2 rounded-lg text-neutral-400 hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/10 transition-colors"
              title="Share on Twitter"
            >
              <Twitter className="w-3.5 h-3.5" />
            </button>
            <button
              className="flex items-center justify-center gap-1 p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Share"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// CREATE SLIP MODAL
// ============================================================================

function CreateSlipModal({
  isOpen,
  onClose,
  onCreate,
  isCreating,
  selectedCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
  isCreating: boolean;
  selectedCount: number;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("yellow");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), color);
    setName("");
    setColor("yellow");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
              Create New Slip
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              {selectedCount} plays will be added
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
                  Slip Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Monday Night Picks"
                  className={cn(
                    "w-full px-4 py-2.5 rounded-lg text-sm",
                    "bg-neutral-100 dark:bg-neutral-800",
                    "border border-neutral-200 dark:border-neutral-700",
                    "focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent",
                    "text-neutral-900 dark:text-white placeholder:text-neutral-400"
                  )}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
                  Color
                </label>
                <div className="flex gap-2">
                  {BETSLIP_COLORS.map((c) => (
              <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        c.class,
                        color === c.id && "ring-2 ring-offset-2 ring-neutral-900 dark:ring-white dark:ring-offset-neutral-900"
                      )}
                    />
                  ))}
                  </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                "bg-brand text-white hover:bg-brand/90",
                (!name.trim() || isCreating) && "opacity-50 cursor-not-allowed"
                )}
              >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Slip"}
              </button>
              </div>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================================================
// ADD TO SLIP DROPDOWN
// ============================================================================

function AddToSlipDropdown({
  betslips,
  onAddToSlip,
  onCreateNew,
  selectedCount,
}: {
  betslips: Betslip[];
  onAddToSlip: (slipId: string) => void;
  onCreateNew: () => void;
  selectedCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add to Slip
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full mt-2 right-0 z-50 w-56 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
            >
              <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={() => {
                    onCreateNew();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-brand hover:bg-brand/10 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create New Slip
                </button>
              </div>
              {betslips.length > 0 && (
                <div className="p-2 max-h-48 overflow-y-auto">
                  <p className="text-xs text-neutral-500 px-3 py-1">Add to existing</p>
                  {betslips.map((slip) => (
                    <button
                      key={slip.id}
                      onClick={() => {
                        onAddToSlip(slip.id);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <div className={cn("w-2.5 h-2.5 rounded-full", getColorClass(slip.color))} />
                      <span className="truncate flex-1">{slip.name}</span>
                      <span className="text-xs text-neutral-400">{slip.items?.length || 0}</span>
                    </button>
                  ))}
            </div>
          )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
        </div>
  );
}

// ============================================================================
// MOBILE PARLAY SHEET - PREMIUM VERSION WITH SGP SUPPORT
// ============================================================================

function MobileParlaySheet({
  selectedFavorites,
  allBooks,
  selectedBook,
  onBookChange,
  onClearSelection,
  onDeleteSelected,
  isDeletingSelected,
  isExpanded,
  onToggle,
  onCreateSlip,
  isCreatingSlip,
}: {
  selectedFavorites: Favorite[];
  allBooks: string[];
  selectedBook: string | null;
  onBookChange: (book: string | null) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  isDeletingSelected: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onCreateSlip: () => void;
  isCreatingSlip: boolean;
}) {
  const [stake, setStake] = useState<string>("25");
  const [copied, setCopied] = useState(false);

  // Classify bet type
  const betType = useMemo(() => classifyBetType(selectedFavorites), [selectedFavorites]);
  const betTypeInfo = getBetTypeInfo(betType);

  const parlayByBook = useMemo(() => {
    if (selectedFavorites.length < 2) return [];
    
    return allBooks
      .map(book => {
        const result = calculateParlayOdds(selectedFavorites, book);
        if (!result) return null;
        return { book, ...result };
      })
      .filter((x): x is { book: string; odds: number; legCount: number; missingLegs: number } => 
        x !== null && x.legCount === selectedFavorites.length
      )
      .sort((a, b) => b.odds - a.odds);
  }, [selectedFavorites, allBooks]);

  const currentParlay = useMemo(() => {
    if (!selectedBook) return parlayByBook[0] || null;
    return parlayByBook.find(p => p.book === selectedBook) || null;
  }, [parlayByBook, selectedBook]);

  const stakeNum = parseFloat(stake) || 0;
  const payout = useMemo(() => {
    if (!currentParlay || stakeNum <= 0) return 0;
    const decimal = currentParlay.odds > 0 
      ? 1 + currentParlay.odds / 100 
      : 1 + 100 / Math.abs(currentParlay.odds);
    return stakeNum * decimal;
  }, [currentParlay, stakeNum]);

  const handleCopy = () => {
    const text = selectedFavorites.map(f => {
      const side = formatSide(f.side);
      return `${f.player_name} ${formatMarketLabelShort(f.market)} ${side}${f.line || ""}`;
    }).join("\n");
    const parlayText = currentParlay 
      ? `\n\n${betTypeInfo.label}: ${formatOdds(currentParlay.odds)} @ ${getBookName(currentParlay.book)}`
      : "";
    navigator.clipboard.writeText(text + parlayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (selectedFavorites.length < 2) return null;

  const bestBook = parlayByBook[0];

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-neutral-900 border-t border-neutral-200/80 dark:border-neutral-800/80 rounded-t-3xl shadow-2xl shadow-black/20"
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
      </div>
      
      {/* Header - always visible */}
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand/70 rounded-xl blur-md opacity-50" />
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-brand to-brand/80 shadow-lg shadow-brand/25">
              <Zap className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-neutral-900 dark:text-white">
                {selectedFavorites.length} Legs
              </span>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase", betTypeInfo.bg, betTypeInfo.color)}>
                {betTypeInfo.label}
                  </span>
            </div>
            {currentParlay && (
              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                {(() => {
                  const logo = getBookLogo(currentParlay.book);
                  return logo ? (
                    <div className="w-3.5 h-3.5 rounded overflow-hidden">
                      <Image src={logo} alt="" width={14} height={14} className="w-full h-full object-contain" />
                    </div>
                  ) : null;
                })()}
                {getBookName(currentParlay.book)}
                </div>
              )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {currentParlay && (
            <motion.span 
              key={currentParlay.odds}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className={cn(
                "text-xl font-black tabular-nums tracking-tight",
                currentParlay.odds >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
              )}
            >
              {formatOdds(currentParlay.odds)}
            </motion.span>
          )}
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
            isExpanded ? "bg-neutral-200 dark:bg-neutral-700" : "bg-neutral-100 dark:bg-neutral-800"
          )}>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-neutral-600 dark:text-neutral-400" /> : <ChevronUp className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-6 space-y-4">
              {/* Legs preview */}
              <div className="flex flex-wrap gap-1.5">
                {selectedFavorites.slice(0, 4).map((fav, i) => {
                  const initials = getInitials(fav.player_name);
                  const avatarColor = getAvatarColor(fav.player_name);
                  return (
                    <div key={fav.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br text-[8px] font-bold text-white", avatarColor)}>
                        {initials}
                      </div>
                      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 truncate max-w-[60px]">
                        {fav.player_name?.split(" ").pop()}
                      </span>
                    </div>
                  );
                })}
                {selectedFavorites.length > 4 && (
                  <div className="flex items-center px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                    <span className="text-[11px] font-medium text-neutral-500">+{selectedFavorites.length - 4}</span>
                  </div>
                )}
              </div>
              
              {/* Book chips */}
              <div className="flex flex-wrap gap-1.5">
                {parlayByBook.slice(0, 6).map(({ book, odds }, index) => {
                  const logo = getBookLogo(book);
                  const isSelected = book === (selectedBook || bestBook?.book);
                  const isBest = index === 0;
                  
                  return (
              <button
                      key={book}
                      onClick={() => onBookChange(book === selectedBook ? null : book)}
                className={cn(
                        "flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition-all",
                        isSelected 
                          ? "bg-brand/10 ring-2 ring-brand" 
                          : isBest
                            ? "bg-emerald-50 dark:bg-emerald-500/15 ring-1 ring-emerald-200 dark:ring-emerald-500/30"
                            : "bg-neutral-100 dark:bg-neutral-800"
                      )}
                    >
                      {logo && (
                        <div className="w-5 h-5 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
                          <Image src={logo} alt={book} width={20} height={20} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <span className={cn(
                        "text-xs font-bold tabular-nums",
                        isSelected ? "text-brand" : isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400"
                      )}>
                        {formatOdds(odds)}
                      </span>
                      {isBest && <Trophy className="w-3 h-3 text-emerald-500" />}
              </button>
                  );
                })}
            </div>

              {/* Stake & Payout */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">Stake</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">$</span>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm font-bold bg-neutral-100 dark:bg-neutral-800 border-0 focus:ring-2 focus:ring-brand text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1.5 block">To Win</label>
                  <div className="px-3 py-2.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/15 dark:to-emerald-500/5 ring-1 ring-emerald-200/50 dark:ring-emerald-500/20">
                    <motion.span 
                      key={payout}
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums"
                    >
                      ${payout.toFixed(2)}
                    </motion.span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={onCreateSlip}
                  disabled={isCreatingSlip}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
                    "bg-gradient-to-r from-brand to-brand/90 text-white shadow-lg shadow-brand/25",
                    isCreatingSlip && "opacity-50"
                  )}
                >
                  {isCreatingSlip ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  Save Slip
                </button>
                <button
                  onClick={handleCopy}
                  className="w-12 flex items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button 
                  onClick={onClearSelection} 
                  className="w-12 flex items-center justify-center rounded-xl text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
                <button 
                  onClick={onDeleteSelected}
                  disabled={isDeletingSelected}
                  className="w-12 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                  title="Delete selected"
                >
                  {isDeletingSelected ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
        </div>
              
              {/* Share buttons */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Share</span>
                <button className="p-1.5 rounded-lg text-neutral-400 hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/10 transition-colors">
                  <Twitter className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg text-neutral-400 hover:text-[#5865F2] hover:bg-[#5865F2]/10 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
      </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// EMPTY STATES - PREMIUM VERSION
// ============================================================================

function EmptyPlaysState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-3xl blur-2xl" />
        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-500/20 dark:to-pink-500/20 ring-1 ring-rose-200/50 dark:ring-rose-500/30 flex items-center justify-center">
          <HeartFill className="w-10 h-10 text-rose-500" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
        No saved plays yet
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400 text-center max-w-sm mb-8">
        Save plays from the Edge Finder, Odds Screen, or Cheat Sheets to start building parlays
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
          href="/edge-finder"
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand to-brand/90 text-white shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30 transition-all"
          >
          <TrendingUp className="w-4 h-4" />
          Edge Finder
          <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
          href="/positive-ev"
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 ring-1 ring-neutral-200 dark:ring-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
          >
          <Zap className="w-4 h-4 text-amber-500" />
          Positive EV
          </Link>
        </div>
    </div>
  );
}

function EmptySlipsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-3xl blur-2xl" />
        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/20 dark:to-purple-500/20 ring-1 ring-violet-200/50 dark:ring-violet-500/30 flex items-center justify-center">
          <Layers className="w-10 h-10 text-violet-500" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
        No slips yet
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400 text-center max-w-sm mb-8">
        Create slips to organize your plays into parlays and track your bets
      </p>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
      >
        <Plus className="w-4 h-4" />
        Create First Slip
      </button>
      
      {/* Tip */}
      <div className="mt-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200/50 dark:ring-amber-500/20 max-w-sm">
        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
          Pro Tip
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400/80">
          Save plays from different games together to create multi-game parlays, or from the same game for SGP bets
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function FavoritesPage() {
  const { favorites, isLoading: loadingFavorites, removeFavorite, refreshOdds, isRefreshingOdds } = useFavorites();
  const {
    betslips,
    isLoading: loadingBetslips,
    createBetslip,
    isCreating,
    deleteBetslip,
    isDeleting,
    addToBetslip,
    removeFromBetslip,
    fetchSgpOdds,
    isFetchingSgpOdds,
  } = useBetslips();

  const [activeTab, setActiveTab] = useState<"plays" | "slips">("plays");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingSlipId, setDeletingSlipId] = useState<string | null>(null);
  
  // Live odds cache - stores refreshed odds by favorite ID
  const [liveOddsCache, setLiveOddsCache] = useState<Record<string, RefreshedOdds>>({});
  const [liveOddsLastRefreshed, setLiveOddsLastRefreshed] = useState<number | null>(null);
  
  // Shared SGP odds cache - keyed by sorted favorite IDs to share across components
  const [sharedSgpCache, setSharedSgpCache] = useState<{
    key: string;
    cache: ParlayBuilderSgpCache;
    fetchedAt: number;
  } | null>(null);
  
  // Generate a stable cache key from favorite IDs
  const getCacheKey = useCallback((favoriteIds: string[]) => {
    return [...favoriteIds].sort().join('|');
  }, []);
  
  // Check if cache is valid for given favorites (max 5 min staleness)
  const getValidCache = useCallback((favoriteIds: string[]) => {
    if (!sharedSgpCache) return null;
    const key = getCacheKey(favoriteIds);
    if (sharedSgpCache.key !== key) return null;
    // Cache is valid for 5 minutes
    if (Date.now() - sharedSgpCache.fetchedAt > 5 * 60 * 1000) return null;
    return sharedSgpCache.cache;
  }, [sharedSgpCache, getCacheKey]);
  
  // Update the shared cache
  const updateSharedCache = useCallback((favoriteIds: string[], cache: ParlayBuilderSgpCache) => {
    const key = getCacheKey(favoriteIds);
    setSharedSgpCache({ key, cache, fetchedAt: Date.now() });
  }, [getCacheKey]);
  
  // Filter & Sort state
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'odds' | 'game_time'>('date');
  const [showFilters, setShowFilters] = useState(false);

  const uniqueBooks = useMemo(() => getUniqueBooks(favorites), [favorites]);
  
  // Get unique sports from favorites
  const uniqueSports = useMemo(() => {
    const sports = new Set<string>();
    favorites.forEach(f => {
      if (f.sport) sports.add(f.sport);
    });
    return Array.from(sports);
  }, [favorites]);
  
  // Filter and sort favorites
  const filteredFavorites = useMemo(() => {
    let result = [...favorites];
    
    // Apply sport filter
    if (sportFilter) {
      result = result.filter(f => f.sport === sportFilter);
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'odds':
        result.sort((a, b) => (b.best_price_at_save || -9999) - (a.best_price_at_save || -9999));
        break;
      case 'game_time':
        result.sort((a, b) => {
          const dateA = a.game_date ? new Date(a.game_date).getTime() : 0;
          const dateB = b.game_date ? new Date(b.game_date).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case 'date':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    
    return result;
  }, [favorites, sportFilter, sortBy]);

  const handleRemove = useCallback(async (id: string) => {
    setRemovingId(id);
    try {
      await removeFavorite(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setRemovingId(null);
    }
  }, [removeFavorite]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const filtered = filteredFavorites;
    const allFilteredSelected = filtered.every(f => selectedIds.has(f.id));
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((f) => f.id)));
    }
  }, [filteredFavorites, selectedIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleCreateSlip = useCallback(async (name: string, color: string) => {
    try {
      await createBetslip({
        name,
        color,
        favorite_ids: Array.from(selectedIds),
      });
      setShowCreateModal(false);
      setSelectedIds(new Set());
      setActiveTab("slips");
    } catch (error) {
      console.error("Failed to create slip:", error);
    }
  }, [createBetslip, selectedIds]);

  const handleAddToExistingSlip = useCallback(async (slipId: string) => {
    try {
      await addToBetslip({
        betslip_id: slipId,
        favorite_ids: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Failed to add to slip:", error);
    }
  }, [addToBetslip, selectedIds]);

  // Refresh live odds for all favorites (or selected ones)
  const handleRefreshOdds = useCallback(async (favoriteIds?: string[]) => {
    try {
      const response = await refreshOdds(favoriteIds) as RefreshOddsResponse;
      if (response?.refreshed) {
        const newCache: Record<string, RefreshedOdds> = {};
        response.refreshed.forEach(odds => {
          newCache[odds.favorite_id] = odds;
        });
        setLiveOddsCache(prev => ({ ...prev, ...newCache }));
        setLiveOddsLastRefreshed(Date.now());
      }
    } catch (error) {
      console.error("Failed to refresh odds:", error);
    }
  }, [refreshOdds]);

  const handleDeleteSlip = useCallback(async (slipId: string) => {
    setDeletingSlipId(slipId);
    try {
      await deleteBetslip(slipId);
    } finally {
      setDeletingSlipId(null);
    }
  }, [deleteBetslip]);

  const handleRemoveFromSlip = useCallback(async (slipId: string, favoriteId: string) => {
    try {
      await removeFromBetslip({ betslipId: slipId, favoriteId });
    } catch (error) {
      console.error("Failed to remove from slip:", error);
    }
  }, [removeFromBetslip]);

  // Delete selected favorites
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeletingSelected(true);
    try {
      // Delete each selected favorite
      const deletePromises = Array.from(selectedIds).map(id => removeFavorite(id));
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      setShowDeleteConfirmation(false);
    } catch (error) {
      console.error("Failed to delete favorites:", error);
    } finally {
      setIsDeletingSelected(false);
    }
  }, [selectedIds, removeFavorite]);

  const selectedFavorites = useMemo(
    () => favorites.filter((f) => selectedIds.has(f.id)),
    [favorites, selectedIds]
  );

  const allSelected = filteredFavorites.length > 0 && filteredFavorites.every(f => selectedIds.has(f.id));
  const isLoading = loadingFavorites || loadingBetslips;

  // Calculate stats for the header
  const stats = useMemo(() => {
    const bestOdds = favorites.reduce((best, fav) => {
      const price = fav.best_price_at_save;
      if (price && (!best || price > best)) return price;
      return best;
    }, null as number | null);
    
    const uniqueSports = new Set(favorites.map(f => f.sport)).size;
    const todayCount = favorites.filter(f => {
      if (!f.game_date) return false;
      const gameDate = new Date(f.game_date);
      const today = new Date();
      return gameDate.toDateString() === today.toDateString();
    }).length;
    
    return { bestOdds, uniqueSports, todayCount };
  }, [favorites]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-100 via-neutral-50 to-white dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      {/* Compact Header */}
      <div className="border-b border-neutral-200/50 dark:border-neutral-800/50 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-900">
        <MaxWidthWrapper className="pt-4 pb-3">
          <div className="flex items-center justify-between gap-4">
            {/* Title Section */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/20">
                <HeartFill className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                  My Plays
            </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:block">
                  Build parlays and track your selections
                </p>
              </div>
            </div>

            {/* Stats Pills - Inline */}
            {favorites.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20">
                  <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {stats.bestOdds ? formatOdds(stats.bestOdds) : "—"}
              </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200/50 dark:border-violet-500/20">
                  <Layers className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                    {favorites.length}
                  </span>
                </div>
                {stats.todayCount > 0 && (
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
                    <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {stats.todayCount}
                    </span>
                  </div>
            )}
          </div>
            )}
          </div>
        </MaxWidthWrapper>
      </div>

      <div className="mx-auto w-full max-w-screen-2xl px-3 lg:px-10 pt-4 pb-32 lg:pb-16">
        {/* Compact Tabs */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200/50 dark:border-neutral-700/50">
            <button
              onClick={() => setActiveTab("plays")}
              className={cn(
                "relative px-4 py-2 rounded-md text-sm font-semibold transition-all",
                activeTab === "plays"
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <span className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                All Plays
              </span>
              {favorites.length > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                  activeTab === "plays"
                    ? "bg-rose-500 text-white"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                )}>
                  {favorites.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("slips")}
              className={cn(
                "relative px-4 py-2 rounded-md text-sm font-semibold transition-all",
                activeTab === "slips"
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                My Slips
              </span>
              {betslips.length > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                  activeTab === "slips"
                    ? "bg-violet-500 text-white"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                )}>
                  {betslips.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Selection indicator */}
          {activeTab === "plays" && selectedIds.size > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand/10 dark:bg-brand/20 border border-brand/20"
            >
              <Check className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs font-semibold text-brand">{selectedIds.size} selected</span>
            </motion.div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
          </div>
        ) : activeTab === "plays" ? (
          favorites.length === 0 ? (
            <EmptyPlaysState />
          ) : (
            <div className="flex gap-6">
              {/* Left: Plays List */}
              <div className="flex-1 min-w-0">
                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-white/50 dark:bg-neutral-900/50 border border-neutral-200/50 dark:border-neutral-800/50">
                  {/* Sport Filter Pills */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSportFilter(null)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        !sportFilter
                          ? "bg-brand text-white shadow-sm"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}
                    >
                      All
                    </button>
                    {uniqueSports.map(sport => (
                      <button
                        key={sport}
                        onClick={() => setSportFilter(sport === sportFilter ? null : sport)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          sport === sportFilter
                            ? "bg-brand text-white shadow-sm"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        )}
                      >
                        <SportIcon sport={normalizeSport(sport)} className="w-3.5 h-3.5" />
                        {sport.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  
                  <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
                  
                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">Sort</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'date' | 'odds' | 'game_time')}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-medium",
                        "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
                        "border-none focus:ring-2 focus:ring-brand cursor-pointer"
                      )}
                    >
                      <option value="date">Date Added</option>
                      <option value="odds">Best Odds</option>
                      <option value="game_time">Game Time</option>
                    </select>
                  </div>
                  
                  <div className="flex-1" />
                  
                  {/* Refresh Odds Button */}
                  <button
                    onClick={() => handleRefreshOdds()}
                    disabled={isRefreshingOdds || favorites.length === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                      "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300",
                      "hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200/60 dark:border-neutral-700/60",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    title={liveOddsLastRefreshed ? `Last refreshed: ${new Date(liveOddsLastRefreshed).toLocaleTimeString()}` : "Refresh all odds"}
                  >
                    <RefreshCw className={cn("w-3 h-3", isRefreshingOdds && "animate-spin")} />
                    {isRefreshingOdds ? "Refreshing..." : "Refresh Odds"}
                  </button>
                  
                  {/* Results count */}
                  <span className="text-xs text-neutral-500">
                    {filteredFavorites.length} of {favorites.length} plays
                  </span>
                </div>
                
              {/* Actions Bar */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                      className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-brand transition-colors"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                {selectedIds.size > 0 && (
                      <span className="text-xs text-neutral-400">{selectedIds.size} selected</span>
                    )}
                  </div>
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <AddToSlipDropdown
                        betslips={betslips}
                        onAddToSlip={handleAddToExistingSlip}
                        onCreateNew={() => setShowCreateModal(true)}
                        selectedCount={selectedIds.size}
                      />
                  <button
                        onClick={() => setShowDeleteConfirmation(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800/50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                        Delete
                  </button>
                    </div>
                )}
              </div>

                {/* Plays */}
              <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filteredFavorites.map((favorite) => (
                      <PlayCard
                    key={favorite.id}
                    favorite={favorite}
                        isSelected={selectedIds.has(favorite.id)}
                        onToggle={() => handleToggle(favorite.id)}
                    onRemove={() => handleRemove(favorite.id)}
                    isRemoving={removingId === favorite.id}
                        selectedBook={selectedBook}
                        liveOdds={liveOddsCache[favorite.id]}
                  />
                ))}
                  </AnimatePresence>
                  
                  {/* Empty filter state */}
                  {filteredFavorites.length === 0 && favorites.length > 0 && (
                    <div className="text-center py-12">
                      <Filter className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">No plays match your filters</p>
                      <button
                        onClick={() => {
                          setSportFilter(null);
                          setSortBy('date');
                        }}
                        className="mt-2 text-xs font-medium text-brand hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
              </div>
            </div>

              {/* Right: Parlay Builder (Desktop) */}
              <div className="hidden lg:block w-[360px] shrink-0">
                <div className="sticky top-20 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
                  <ParlayBuilder
                selectedFavorites={selectedFavorites}
                    allBooks={uniqueBooks}
                    selectedBook={selectedBook}
                    onBookChange={setSelectedBook}
                    onClearSelection={handleClearSelection}
                    onDeleteSelected={() => setShowDeleteConfirmation(true)}
                    isDeletingSelected={isDeletingSelected}
                    onCreateSlip={() => setShowCreateModal(true)}
                    isCreatingSlip={isCreating}
                    sharedSgpCache={getValidCache(selectedFavorites.map(f => f.id))}
                    onUpdateSgpCache={updateSharedCache}
                    liveOddsCache={liveOddsCache}
              />
            </div>
          </div>
            </div>
          )
        ) : (
          /* Slips Tab */
          betslips.length === 0 ? (
            <EmptySlipsState onCreate={() => setShowCreateModal(true)} />
          ) : (
            <div>
              {/* Slips Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-4 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50/50 dark:from-violet-500/10 dark:to-purple-500/5 ring-1 ring-violet-200/50 dark:ring-violet-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {betslips.length} Betslip{betslips.length !== 1 && "s"}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {betslips.reduce((sum, slip) => sum + (slip.items?.length || 0), 0)} total legs across all slips
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Slip
                </button>
              </div>
              
              {/* Slips Grid - 2 columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {betslips.map((slip) => (
                    <BetslipCard
                      key={slip.id}
                      slip={slip}
                      onDelete={() => handleDeleteSlip(slip.id)}
                      onRemoveItem={(favId) => handleRemoveFromSlip(slip.id, favId)}
                      isDeleting={deletingSlipId === slip.id}
                      onFetchSgpOdds={async (betslipId, forceRefresh) => {
                        await fetchSgpOdds({ betslipId, forceRefresh });
                      }}
                      isFetchingSgpOdds={isFetchingSgpOdds}
                      sharedSgpCache={getValidCache(slip.items?.map(i => i.favorite_id) || [])}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )
        )}
      </div>

      {/* Mobile Parlay Sheet */}
      {activeTab === "plays" && (
        <div className="lg:hidden">
          <AnimatePresence>
            {selectedFavorites.length >= 2 && (
              <MobileParlaySheet
                selectedFavorites={selectedFavorites}
                allBooks={uniqueBooks}
                selectedBook={selectedBook}
                onBookChange={setSelectedBook}
                onClearSelection={handleClearSelection}
                onDeleteSelected={() => setShowDeleteConfirmation(true)}
                isDeletingSelected={isDeletingSelected}
                isExpanded={mobileSheetExpanded}
                onToggle={() => setMobileSheetExpanded(!mobileSheetExpanded)}
                onCreateSlip={() => setShowCreateModal(true)}
                isCreatingSlip={isCreating}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Create Slip Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateSlipModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateSlip}
            isCreating={isCreating}
            selectedCount={selectedIds.size}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent className="sm:max-w-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 shadow-2xl rounded-2xl overflow-hidden">
          {/* Red accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-red-500 to-rose-600" />
          
          <div className="p-6">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40 shadow-lg ring-1 ring-red-200/50 dark:ring-red-800/50">
                <Trash2 className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center">
              <DialogTitle className="mb-2 text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                Delete {selectedIds.size} Play{selectedIds.size === 1 ? '' : 's'}?
              </DialogTitle>
              <DialogDescription className="mb-6 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {selectedIds.size === 1 
                  ? "This play will be permanently removed from your favorites."
                  : `These ${selectedIds.size} plays will be permanently removed from your favorites.`
                } This action cannot be undone.
              </DialogDescription>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="flex-1 h-11 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeletingSelected}
                className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25 transition-all hover:shadow-red-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingSelected && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeletingSelected ? "Deleting..." : `Delete ${selectedIds.size} Play${selectedIds.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
