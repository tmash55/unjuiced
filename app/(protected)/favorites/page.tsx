"use client";

import { useState, useMemo, useCallback } from "react";
import { useFavorites, Favorite, BookSnapshot } from "@/hooks/use-favorites";
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
} from "lucide-react";
import { HeartFill } from "@/components/icons/heart-fill";
import { getSportsbookById } from "@/lib/data/sportsbooks";
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
// PLAY CARD WITH EXPANDABLE ODDS
// ============================================================================

function PlayCard({
  favorite,
  isSelected,
  onToggle,
  onRemove,
  isRemoving,
  selectedBook,
}: {
  favorite: Favorite;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  isRemoving: boolean;
  selectedBook: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const initials = getInitials(favorite.player_name);
  const avatarColor = getAvatarColor(favorite.player_name);
  const lastName = favorite.player_name?.split(" ").pop() || "Unknown";
  const side = formatSide(favorite.side);
  const hasLine = favorite.line !== null && favorite.line !== undefined;
  const marketLabel = formatMarketLabelShort(favorite.market);
  const normalizedSport = normalizeSport(favorite.sport);

  const displayBook = selectedBook || favorite.best_book_at_save;
  const displayPrice = selectedBook && favorite.books_snapshot?.[selectedBook]?.price
    ? favorite.books_snapshot[selectedBook].price
    : favorite.best_price_at_save;
  const bookLogo = getBookLogo(displayBook);
  
  const bookData = displayBook ? favorite.books_snapshot?.[displayBook] : null;
  const betLink = bookData?.u || null;
  const hasOddsAtBook = !selectedBook || favorite.books_snapshot?.[selectedBook];

  // Sort books by odds for expanded view
  const sortedBooks = useMemo(() => {
    if (!favorite.books_snapshot) return [];
    return Object.entries(favorite.books_snapshot)
      .filter(([_, data]) => data.price)
      .sort((a, b) => (b[1].price || 0) - (a[1].price || 0));
  }, [favorite.books_snapshot]);

  const bookCount = sortedBooks.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "group relative rounded-xl transition-all overflow-hidden",
        "bg-white dark:bg-neutral-900",
        "border",
        isSelected
          ? "border-brand ring-2 ring-brand/20"
          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
        !hasOddsAtBook && selectedBook && "opacity-50"
      )}
    >
      {/* Main Row */}
      <div className="flex items-center gap-4 p-4">
        {/* Checkbox */}
      <button
          onClick={onToggle}
        className={cn(
            "shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
          isSelected
            ? "bg-brand border-brand text-white"
            : "border-neutral-300 dark:border-neutral-600 hover:border-brand"
        )}
      >
          {isSelected && <Check className="w-4 h-4" />}
      </button>

        {/* Sport Icon */}
        <div className={cn(
          "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
          "bg-neutral-100 dark:bg-neutral-800"
        )}>
          <SportIcon sport={normalizedSport} className="w-4 h-4 text-neutral-500" />
        </div>

        {/* Player Avatar */}
        <div className={cn(
          "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          "bg-gradient-to-br shadow-sm",
          avatarColor
        )}>
          <span className="text-xs font-bold text-white tracking-tight">{initials}</span>
        </div>

        {/* Player + Bet Info */}
      <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              {lastName}
          </span>
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase">
              {favorite.player_team || ""}
            </span>
        </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {marketLabel}
          </span>
            {hasLine && (
              <span className={cn(
                "text-sm font-semibold",
                side === "o" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
              )}>
                {side}{favorite.line}
            </span>
          )}
        </div>
      </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
            "shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs",
            "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700",
            "text-neutral-600 dark:text-neutral-400"
          )}
        >
          <span>{bookCount} books</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Odds + Bet Button */}
        {betLink ? (
          <a
            href={betLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
              "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20",
              "ring-1 ring-emerald-200 dark:ring-emerald-500/30"
            )}
          >
            {bookLogo && (
              <Image src={bookLogo} alt={displayBook || ""} width={18} height={18} className="w-[18px] h-[18px] object-contain rounded" />
            )}
            <span className={cn(
              "text-sm font-bold tabular-nums",
              displayPrice && displayPrice >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
            )}>
              {formatOdds(displayPrice)}
              </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
          </a>
        ) : (
          <div className="shrink-0 flex items-center gap-2 px-3 py-2">
            {bookLogo && (
              <Image src={bookLogo} alt={displayBook || ""} width={18} height={18} className="w-[18px] h-[18px] object-contain rounded" />
            )}
            <span className="text-sm font-bold tabular-nums text-neutral-600 dark:text-neutral-400">
              {formatOdds(displayPrice)}
            </span>
          </div>
        )}

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={isRemoving}
          className={cn(
            "shrink-0 p-2 rounded-lg transition-all",
            "opacity-0 group-hover:opacity-100",
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

      {/* Expanded Odds View */}
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
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  All Sportsbook Odds
    </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {sortedBooks.map(([bookId, data], index) => {
                    const logo = getBookLogo(bookId);
                    const link = data.u;
                    const isBest = index === 0;
                    
  return (
                      <a
                        key={bookId}
                        href={link || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
        className={cn(
                          "flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all",
                          "border",
                          isBest
                            ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
                            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300",
                          !link && "cursor-default"
        )}
      >
                        {logo && (
                          <Image src={logo} alt={bookId} width={16} height={16} className="w-4 h-4 object-contain rounded" />
                        )}
                        <span className={cn(
                          "text-xs font-bold tabular-nums",
                          isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                        )}>
                          {formatOdds(data.price)}
                        </span>
                        {isBest && (
                          <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1 rounded">
                            BEST
                          </span>
                        )}
                        {link && <ArrowUpRight className="w-3 h-3 text-neutral-400 ml-auto" />}
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
// LIVE PARLAY BUILDER PANEL
// ============================================================================

function ParlayBuilder({
  selectedFavorites,
  allBooks,
  selectedBook,
  onBookChange,
  onClearSelection,
  onCreateSlip,
  isCreatingSlip,
}: {
  selectedFavorites: Favorite[];
  allBooks: string[];
  selectedBook: string | null;
  onBookChange: (book: string | null) => void;
  onClearSelection: () => void;
  onCreateSlip: () => void;
  isCreatingSlip: boolean;
}) {
  const [stake, setStake] = useState<string>("25");
  const [copied, setCopied] = useState(false);

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
      ? `\n\nParlay: ${formatOdds(currentParlay.odds)} @ ${getBookName(currentParlay.book)}`
      : "";
    
    navigator.clipboard.writeText(text + parlayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bestBook = parlayByBook[0];
  const displayBook = selectedBook || bestBook?.book;

  if (selectedFavorites.length < 2) {
  return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <Calculator className="w-7 h-7 text-neutral-400" />
        </div>
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          Select 2+ plays
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          to see live parlay odds
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand" />
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              Parlay Builder
            </span>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {selectedFavorites.length} legs
              </span>
        </div>
      </div>

      {/* Book Selector */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 block">
          Sportsbook
        </label>
        <div className="flex flex-wrap gap-2">
          {parlayByBook.slice(0, 6).map(({ book, odds }, index) => {
            const logo = getBookLogo(book);
            const isSelected = book === displayBook;
            const isBest = index === 0;
            
            return (
              <button
                key={book}
                onClick={() => onBookChange(book === selectedBook ? null : book)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
                  "border",
                  isSelected
                    ? "bg-brand/10 border-brand text-brand"
                    : isBest
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
                      : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                )}
              >
                {logo && (
                  <Image src={logo} alt={book} width={16} height={16} className="w-4 h-4 object-contain rounded" />
                )}
                <span className={cn(
                  "text-xs font-bold tabular-nums",
                  isSelected ? "text-brand" : isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400"
                )}>
                  {formatOdds(odds)}
                </span>
                {isBest && !isSelected && (
                  <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-1 rounded">
                    BEST
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>

      {/* Live Odds Display */}
      <div className="flex-1 p-4">
        {currentParlay ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <motion.div
                key={currentParlay.odds}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-black text-neutral-900 dark:text-white tabular-nums"
              >
                {formatOdds(currentParlay.odds)}
              </motion.div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center justify-center gap-1.5">
                {(() => {
                  const logo = getBookLogo(currentParlay.book);
                  return logo ? (
                    <Image src={logo} alt={currentParlay.book} width={14} height={14} className="w-3.5 h-3.5 object-contain rounded" />
                  ) : null;
                })()}
                {getBookName(currentParlay.book)}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block">
                Stake
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">$</span>
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className={cn(
                    "w-full pl-7 pr-4 py-2.5 rounded-lg text-sm font-semibold",
                    "bg-neutral-100 dark:bg-neutral-800",
                    "border border-neutral-200 dark:border-neutral-700",
                    "focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent",
                    "text-neutral-900 dark:text-white"
                  )}
                />
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-700 dark:text-emerald-400">To Win</span>
                <motion.span
                  key={payout}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
                >
                  ${payout.toFixed(2)}
                </motion.span>
              </div>
            </div>

            {bestBook && bestBook.book !== currentParlay.book && (
              <div className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                <span className="text-emerald-600 dark:text-emerald-400">{getBookName(bestBook.book)}</span>
                {" "}offers {formatOdds(bestBook.odds)} ({bestBook.odds - currentParlay.odds > 0 ? "+" : ""}{bestBook.odds - currentParlay.odds})
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-neutral-500">
            No book has all legs
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
        <button
          onClick={onCreateSlip}
          disabled={isCreatingSlip}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
            "bg-brand text-white hover:bg-brand/90",
            isCreatingSlip && "opacity-50 cursor-not-allowed"
          )}
        >
          {isCreatingSlip ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FolderPlus className="w-4 h-4" />
          )}
          Save as Slip
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onClearSelection}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BETSLIP CARD
// ============================================================================

function BetslipCard({
  slip,
  onDelete,
  onRemoveItem,
  isDeleting,
}: {
  slip: Betslip;
  onDelete: () => void;
  onRemoveItem: (favoriteId: string) => void;
  isDeleting: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const items = slip.items || [];
  const colorClass = getColorClass(slip.color);

  // Calculate best parlay odds from items
  const parlayOdds = useMemo(() => {
    if (items.length < 2) return null;
    
    const allBooks = new Set<string>();
    items.forEach(item => {
      if (item.favorite?.books_snapshot) {
        Object.keys(item.favorite.books_snapshot).forEach(b => allBooks.add(b));
      }
    });

    const results: { book: string; odds: number }[] = [];
    allBooks.forEach(book => {
      let totalDecimal = 1;
      let hasAll = true;
      
      items.forEach(item => {
        const price = item.favorite?.books_snapshot?.[book]?.price;
        if (price) {
          const decimal = price > 0 ? 1 + price / 100 : 1 + 100 / Math.abs(price);
          totalDecimal *= decimal;
        } else {
          hasAll = false;
        }
      });

      if (hasAll) {
        const american = totalDecimal >= 2
          ? Math.round((totalDecimal - 1) * 100)
          : Math.round(-100 / (totalDecimal - 1));
        results.push({ book, odds: american });
      }
    });

    return results.sort((a, b) => b.odds - a.odds)[0] || null;
  }, [items]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className={cn("w-3 h-3 rounded-full shrink-0", colorClass)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900 dark:text-white truncate">
              {slip.name}
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {items.length} {items.length === 1 ? "leg" : "legs"}
                    </span>
                  </div>
          {parlayOdds && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {(() => {
                const logo = getBookLogo(parlayOdds.book);
                return logo ? (
                  <Image src={logo} alt={parlayOdds.book} width={12} height={12} className="w-3 h-3 rounded" />
                ) : null;
              })()}
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatOdds(parlayOdds.odds)}
              </span>
                  </div>
                )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
        </div>
              </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {items.length === 0 ? (
                <div className="py-4 text-center text-sm text-neutral-500">
                  No plays in this slip yet
                </div>
              ) : (
                items.map((item) => {
                  const fav = item.favorite;
                  if (!fav) return null;
                  
                  const initials = getInitials(fav.player_name);
                  const avatarColor = getAvatarColor(fav.player_name);
                  const side = formatSide(fav.side);
                  
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50"
                    >
                      <div className={cn(
                        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                        "bg-gradient-to-br shadow-sm text-xs font-bold text-white",
                        avatarColor
                      )}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-neutral-900 dark:text-white truncate block">
                          {fav.player_name}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatMarketLabelShort(fav.market)} {side}{fav.line}
                  </span>
                </div>
                      <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatOdds(fav.best_price_at_save)}
                      </span>
                      <button
                        onClick={() => onRemoveItem(item.favorite_id)}
                        className="p-1 rounded text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
// MOBILE PARLAY SHEET
// ============================================================================

function MobileParlaySheet({
  selectedFavorites,
  allBooks,
  selectedBook,
  onBookChange,
  onClearSelection,
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
  isExpanded: boolean;
  onToggle: () => void;
  onCreateSlip: () => void;
  isCreatingSlip: boolean;
}) {
  const [stake, setStake] = useState<string>("25");
  const [copied, setCopied] = useState(false);

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
    navigator.clipboard.writeText(text);
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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 rounded-t-2xl shadow-2xl"
    >
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10">
            <Zap className="w-4 h-4 text-brand" />
      </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-neutral-900 dark:text-white">
              {selectedFavorites.length} Leg Parlay
            </div>
            {currentParlay && (
              <div className="text-xs text-neutral-500 flex items-center gap-1.5">
                {(() => {
                  const logo = getBookLogo(currentParlay.book);
                  return logo ? <Image src={logo} alt="" width={12} height={12} className="w-3 h-3 rounded" /> : null;
                })()}
                {getBookName(currentParlay.book)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {currentParlay && (
            <span className="text-lg font-bold text-brand tabular-nums">{formatOdds(currentParlay.odds)}</span>
          )}
          {isExpanded ? <ChevronDown className="w-5 h-5 text-neutral-400" /> : <ChevronUp className="w-5 h-5 text-neutral-400" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {parlayByBook.slice(0, 6).map(({ book, odds }, index) => {
                  const logo = getBookLogo(book);
                  const isSelected = book === (selectedBook || bestBook?.book);
                  const isBest = index === 0;
                  
                  return (
                    <button
                      key={book}
                      onClick={() => onBookChange(book === selectedBook ? null : book)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all border",
                        isSelected ? "bg-brand/10 border-brand" : "bg-neutral-100 dark:bg-neutral-800 border-transparent"
                      )}
                    >
                      {logo && <Image src={logo} alt={book} width={16} height={16} className="w-4 h-4 rounded" />}
                      <span className={cn("text-xs font-bold tabular-nums", isSelected ? "text-brand" : "text-neutral-600 dark:text-neutral-400")}>
                        {formatOdds(odds)}
                      </span>
                      {isBest && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 px-1 rounded">BEST</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-500 mb-1 block">Stake</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-lg text-sm font-semibold bg-neutral-100 dark:bg-neutral-800 border-0 focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-500 mb-1 block">To Win</label>
                  <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">${payout.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onCreateSlip}
                  disabled={isCreatingSlip}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white"
                >
                  {isCreatingSlip ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  Save Slip
                </button>
                <button
                  onClick={handleCopy}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <button onClick={onClearSelection} className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-500">
                  Clear
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
// EMPTY STATES
// ============================================================================

function EmptyPlaysState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center mb-6">
        <Heart className="w-9 h-9 text-neutral-400" />
      </div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
        No saved plays yet
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400 text-center max-w-sm mb-6">
        Save plays from the Edge Finder, Odds Screen, or Cheat Sheets to start building parlays
      </p>
          <Link
        href="/edge-finder"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-colors"
          >
        Find Plays
        <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
  );
}

function EmptySlipsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center mb-6">
        <Layers className="w-9 h-9 text-neutral-400" />
      </div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
        No slips yet
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400 text-center max-w-sm mb-6">
        Create slips to organize your plays into parlays
      </p>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create First Slip
      </button>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function FavoritesPage() {
  const { favorites, isLoading: loadingFavorites, removeFavorite } = useFavorites();
  const {
    betslips,
    isLoading: loadingBetslips,
    createBetslip,
    isCreating,
    deleteBetslip,
    isDeleting,
    addToBetslip,
    removeFromBetslip,
  } = useBetslips();

  const [activeTab, setActiveTab] = useState<"plays" | "slips">("plays");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingSlipId, setDeletingSlipId] = useState<string | null>(null);

  const uniqueBooks = useMemo(() => getUniqueBooks(favorites), [favorites]);

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
    if (selectedIds.size === favorites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(favorites.map((f) => f.id)));
    }
  }, [selectedIds.size, favorites]);

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

  const selectedFavorites = useMemo(
    () => favorites.filter((f) => selectedIds.has(f.id)),
    [favorites, selectedIds]
  );

  const allSelected = favorites.length > 0 && selectedIds.size === favorites.length;
  const isLoading = loadingFavorites || loadingBetslips;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <MaxWidthWrapper className="pt-24 md:pt-28 pb-32 lg:pb-16">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-sm">
              <HeartFill className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
              My Plays
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("plays")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === "plays"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            All Plays
            {favorites.length > 0 && (
              <span className="ml-1.5 text-xs text-neutral-400">({favorites.length})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("slips")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === "slips"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            My Slips
            {betslips.length > 0 && (
              <span className="ml-1.5 text-xs text-neutral-400">({betslips.length})</span>
            )}
          </button>
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
              {/* Actions Bar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                      className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-brand transition-colors"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                {selectedIds.size > 0 && (
                      <span className="text-xs text-neutral-400">{selectedIds.size} selected</span>
                    )}
                  </div>
                  {selectedIds.size > 0 && (
                    <AddToSlipDropdown
                      betslips={betslips}
                      onAddToSlip={handleAddToExistingSlip}
                      onCreateNew={() => setShowCreateModal(true)}
                      selectedCount={selectedIds.size}
                    />
                )}
              </div>

                {/* Plays */}
              <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                {favorites.map((favorite) => (
                      <PlayCard
                    key={favorite.id}
                    favorite={favorite}
                        isSelected={selectedIds.has(favorite.id)}
                        onToggle={() => handleToggle(favorite.id)}
                    onRemove={() => handleRemove(favorite.id)}
                    isRemoving={removingId === favorite.id}
                        selectedBook={selectedBook}
                  />
                ))}
                  </AnimatePresence>
              </div>
            </div>

              {/* Right: Parlay Builder (Desktop) */}
              <div className="hidden lg:block w-80 shrink-0">
                <div className="sticky top-28 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                  <ParlayBuilder
                selectedFavorites={selectedFavorites}
                    allBooks={uniqueBooks}
                    selectedBook={selectedBook}
                    onBookChange={setSelectedBook}
                    onClearSelection={handleClearSelection}
                    onCreateSlip={() => setShowCreateModal(true)}
                    isCreatingSlip={isCreating}
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
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-neutral-500">{betslips.length} slip{betslips.length !== 1 && "s"}</span>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Slip
                </button>
              </div>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {betslips.map((slip) => (
                    <BetslipCard
                      key={slip.id}
                      slip={slip}
                      onDelete={() => handleDeleteSlip(slip.id)}
                      onRemoveItem={(favId) => handleRemoveFromSlip(slip.id, favId)}
                      isDeleting={deletingSlipId === slip.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )
        )}
      </MaxWidthWrapper>

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
    </div>
  );
}
