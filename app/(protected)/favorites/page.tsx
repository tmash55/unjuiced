"use client";

import { useState, useMemo, useCallback } from "react";
import { useFavorites, Favorite, BookSnapshot } from "@/hooks/use-favorites";
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
  ExternalLink,
  Calendar,
  Share2,
  Copy,
  Check,
  Zap,
  Filter,
  ArrowUpRight,
  Sparkles,
  ShoppingCart,
  X,
  Link2,
  Plus
} from "lucide-react";
import { HeartFill } from "@/components/icons/heart-fill";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";
import { formatMarketLabelShort } from "@/lib/data/markets";

// ============================================================================
// TYPES
// ============================================================================

type GroupedFavorites = Map<string, Favorite[]>;

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
  if (side === "yes") return "y";
  if (side === "no") return "n";
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

// Get unique sportsbooks from all favorites
const getUniqueBooks = (favorites: Favorite[]): string[] => {
  const books = new Set<string>();
  favorites.forEach((fav) => {
    if (fav.books_snapshot) {
      Object.keys(fav.books_snapshot).forEach((book) => books.add(book));
    }
    if (fav.best_book_at_save) {
      books.add(fav.best_book_at_save);
    }
  });
  return Array.from(books);
};

// Group favorites by event_id for SGP
const groupByEvent = (favorites: Favorite[]): GroupedFavorites => {
  const grouped = new Map<string, Favorite[]>();
  favorites.forEach((fav) => {
    const existing = grouped.get(fav.event_id) || [];
    existing.push(fav);
    grouped.set(fav.event_id, existing);
  });
  return grouped;
};

// Calculate parlay odds (simple multiplication for non-SGP)
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
      const decimal =
        american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
      totalDecimal *= decimal;
      legCount++;
    } else {
      missingLegs++;
    }
  }

  if (legCount === 0) return null;

  const americanOdds =
    totalDecimal >= 2
      ? Math.round((totalDecimal - 1) * 100)
      : Math.round(-100 / (totalDecimal - 1));

  return { odds: americanOdds, legCount, missingLegs };
};

// Get initials from name
const getInitials = (name: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Get consistent color from name
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
  const hash = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Normalize sport for SportIcon
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

// ============================================================================
// COMPONENTS
// ============================================================================

// Player Avatar with initials
function PlayerAvatar({ name }: { name: string | null }) {
  const initials = getInitials(name);
  const color = getAvatarColor(name);

  return (
    <div
      className={cn(
        "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        "bg-gradient-to-br shadow-sm",
        color
      )}
    >
      <span className="text-xs font-bold text-white tracking-tight">
        {initials}
      </span>
    </div>
  );
}

// Book odds chip
function BookOddsChip({
  bookId,
  price,
  isBest,
  link,
  mobileLink,
}: {
  bookId: string;
  price: number;
  isBest: boolean;
  link?: string | null;
  mobileLink?: string | null;
}) {
  const logo = getBookLogo(bookId);
  const name = getBookName(bookId);

  // Use mobile link on mobile, desktop link otherwise
  const href = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    ? (mobileLink || link)
    : link;

  return (
    <a
      href={href || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
        "border",
        isBest
          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
          : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
      )}
    >
      {logo && (
        <Image
          src={logo}
          alt={name}
          width={16}
          height={16}
          className="w-4 h-4 object-contain rounded"
        />
      )}
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          isBest
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-neutral-600 dark:text-neutral-300"
        )}
      >
        {formatOdds(price)}
      </span>
      {href && <ArrowUpRight className="w-3 h-3 text-neutral-400" />}
    </a>
  );
}

// Single favorite row with expanded odds
function FavoriteRow({
  favorite,
  onRemove,
  isRemoving,
  isSelected,
  onSelect,
  showAllOdds,
  filterBook,
}: {
  favorite: Favorite;
  onRemove: () => void;
  isRemoving: boolean;
  isSelected: boolean;
  onSelect: () => void;
  showAllOdds: boolean;
  filterBook: string | null;
}) {
  const lastName = favorite.player_name?.split(" ").pop() || "Unknown";
  const marketLabel = formatMarketLabelShort(favorite.market);
  const side = formatSide(favorite.side);
  const hasLine = favorite.line !== null && favorite.line !== undefined;
  const normalizedSport = normalizeSport(favorite.sport);

  // Get all book odds sorted by price (best first)
  const bookOdds = useMemo(() => {
    if (!favorite.books_snapshot) return [];
    return Object.entries(favorite.books_snapshot)
      .filter(([_, data]) => data?.price)
      .sort((a, b) => (b[1]?.price || 0) - (a[1]?.price || 0));
  }, [favorite.books_snapshot]);

  // Find best price
  const bestPrice = bookOdds.length > 0 ? bookOdds[0][1]?.price : null;

  // Filter by book if needed
  const displayOdds = filterBook
    ? bookOdds.filter(([book]) => book === filterBook)
    : bookOdds;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      className={cn(
        "group relative flex flex-col rounded-xl border transition-all",
        "bg-white dark:bg-neutral-900",
        isSelected
          ? "border-brand ring-2 ring-brand/20"
          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
        isRemoving && "opacity-50 pointer-events-none"
      )}
    >
      {/* Main Row */}
      <div className="flex items-center gap-4 p-4">
        {/* Checkbox */}
        <button
          onClick={onSelect}
          className={cn(
            "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
            isSelected
              ? "bg-brand border-brand text-white"
              : "border-neutral-300 dark:border-neutral-600 hover:border-brand"
          )}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </button>

        {/* Sport Badge */}
        <div
          className={cn(
            "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
            "bg-neutral-100 dark:bg-white/5"
          )}
        >
          <SportIcon
            sport={normalizedSport}
            className="w-4 h-4 text-neutral-500"
          />
        </div>

        {/* Avatar */}
        <PlayerAvatar name={favorite.player_name} />

        {/* Player + Bet Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-neutral-900 dark:text-white truncate">
              {lastName}
            </span>
            {favorite.player_team && (
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase">
                {favorite.player_team}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">
              {marketLabel}
            </span>
            {hasLine && (
              <span
                className={cn(
                  "font-semibold",
                  side === "o"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                )}
              >
                {side}
                {favorite.line}
              </span>
            )}
          </div>
          {favorite.home_team && favorite.away_team && (
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {favorite.away_team} @ {favorite.home_team}
            </div>
          )}
        </div>

        {/* Best Odds (collapsed view) */}
        {!showAllOdds && displayOdds.length > 0 && (
          <div className="shrink-0 flex items-center gap-2">
            <BookOddsChip
              bookId={displayOdds[0][0]}
              price={displayOdds[0][1]?.price || 0}
              isBest={displayOdds[0][1]?.price === bestPrice}
              link={displayOdds[0][1]?.u}
              mobileLink={displayOdds[0][1]?.m}
            />
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
            "text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50",
            "opacity-0 group-hover:opacity-100",
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

      {/* Expanded Odds (all books) */}
      {showAllOdds && displayOdds.length > 0 && (
        <div className="px-4 pb-4 pt-0">
          <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            {displayOdds.map(([book, data]) => (
              <BookOddsChip
                key={book}
                bookId={book}
                price={data?.price || 0}
                isBest={data?.price === bestPrice}
                link={data?.u}
                mobileLink={data?.m}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// SGP Group indicator
function SGPGroupBadge({ count, eventId }: { count: number; eventId: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800">
      <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        SGP Eligible ({count} legs from same game)
      </span>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center shadow-inner">
          <Heart className="w-9 h-9 text-neutral-300 dark:text-neutral-600" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
        Your betslip is empty
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400 text-center max-w-md mb-8">
        Start by saving picks from the Edge Finder or Cheat Sheets.
        Build your perfect parlay here!
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/edge-finder"
          className={cn(
            "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl",
            "bg-gradient-to-r from-neutral-900 to-neutral-800 text-white font-semibold",
            "hover:from-neutral-800 hover:to-neutral-700 transition-all",
            "dark:from-white dark:to-neutral-100 dark:text-neutral-900",
            "shadow-sm"
          )}
        >
          Edge Finder
          <ChevronRight className="w-4 h-4" />
        </Link>
        <Link
          href="/cheatsheets/nba/hit-rates"
          className={cn(
            "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-semibold",
            "hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          )}
        >
          Cheat Sheets
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// Best Value Parlay Card
function BestValueParlayCard({
  favorites,
  selectedIds,
}: {
  favorites: Favorite[];
  selectedIds: Set<string>;
}) {
  const selectedFavorites = favorites.filter((f) => selectedIds.has(f.id));
  const books = getUniqueBooks(selectedFavorites);

  const parlayOdds = useMemo(() => {
    return books
      .map((book) => {
        const result = calculateParlayOdds(selectedFavorites, book);
        if (!result) return null;
        return { book, ...result };
      })
      .filter(
        (x): x is { book: string; odds: number; legCount: number; missingLegs: number } =>
          x !== null && x.legCount > 0
      )
      .sort((a, b) => b.odds - a.odds);
  }, [selectedFavorites, books]);

  // Check for SGP eligibility
  const grouped = groupByEvent(selectedFavorites);
  const sgpGroups = Array.from(grouped.entries()).filter(
    ([_, items]) => items.length >= 2
  );

  if (selectedFavorites.length < 2) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-brand" />
          <h3 className="font-semibold text-neutral-900 dark:text-white">
            Best Value Parlays
          </h3>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
          Select 2+ picks to see parlay odds
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-800/50 dark:to-neutral-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand" />
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Best Value Parlays
            </h3>
          </div>
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-full">
            {selectedFavorites.length} legs
          </span>
        </div>
      </div>

      {/* SGP Warning */}
      {sgpGroups.length > 0 && (
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                SGP legs detected
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {sgpGroups.length} game{sgpGroups.length > 1 ? "s" : ""} with
                correlated legs. Actual odds may vary.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Book Odds List */}
      <div className="p-4 space-y-2">
        {parlayOdds.slice(0, 5).map(({ book, odds, legCount, missingLegs }, index) => {
          const bookData = getSportsbookById(book);
          const logo = bookData?.image?.square || bookData?.image?.light;
          const isTop = index === 0;

          return (
            <div
              key={book}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                isTop
                  ? "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 ring-1 ring-emerald-200 dark:ring-emerald-500/30"
                  : "bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              )}
            >
              {logo && (
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white dark:bg-neutral-700 flex items-center justify-center shrink-0 shadow-sm">
                  <Image
                    src={logo}
                    alt={book}
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {bookData?.name || book}
                </span>
                {missingLegs > 0 && (
                  <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">
                    ({legCount}/{selectedFavorites.length} legs)
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-base font-bold tabular-nums",
                  isTop
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-neutral-700 dark:text-neutral-300"
                )}
              >
                {formatOdds(odds)}
              </span>
              {isTop && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  Best
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Book Filter Pills
function BookFilterPills({
  books,
  selected,
  onSelect,
}: {
  books: string[];
  selected: string | null;
  onSelect: (book: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
          !selected
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
        )}
      >
        All Books
      </button>
      {books.slice(0, 8).map((book) => {
        const bookData = getSportsbookById(book);
        const logo = bookData?.image?.square || bookData?.image?.light;

        return (
          <button
            key={book}
            onClick={() => onSelect(selected === book ? null : book)}
            className={cn(
              "shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
              selected === book
                ? "bg-neutral-900 dark:bg-white ring-2 ring-neutral-900 dark:ring-white"
                : "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            )}
          >
            {logo && (
              <Image
                src={logo}
                alt={book}
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                selected === book
                  ? "text-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-400"
              )}
            >
              {bookData?.name || book}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Share Slip Modal
function ShareModal({
  isOpen,
  onClose,
  favorites,
  selectedIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  favorites: Favorite[];
  selectedIds: Set<string>;
}) {
  const [copied, setCopied] = useState(false);
  const selected = favorites.filter((f) => selectedIds.has(f.id));

  // Generate share text
  const shareText = useMemo(() => {
    if (selected.length === 0) return "";
    
    const legs = selected.map(f => {
      const lastName = f.player_name?.split(" ").pop() || "Unknown";
      const market = formatMarketLabelShort(f.market);
      const side = formatSide(f.side);
      return `${lastName} ${market} ${side}${f.line || ""}`;
    }).join(" | ");
    
    return `🎯 My picks: ${legs}\n\nBuilt with Unjuiced`;
  }, [selected]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-brand" />
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                Share Your Picks
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          <div className="p-5">
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 mb-4">
              <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                {shareText}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all",
                  copied
                    ? "bg-emerald-500 text-white"
                    : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Text
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-4">
              Share links with tracking coming soon!
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function FavoritesPage() {
  const { favorites, isLoading, removeFavorite } = useFavorites();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAllOdds, setShowAllOdds] = useState(false);
  const [filterBook, setFilterBook] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Get unique books
  const uniqueBooks = useMemo(() => getUniqueBooks(favorites), [favorites]);

  // Handlers
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

  const handleSelect = useCallback((id: string) => {
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

  const handleClearSelected = useCallback(async () => {
    if (!confirm("Remove all selected picks?")) return;
    const idsToRemove = Array.from(selectedIds);
    for (const id of idsToRemove) {
      await handleRemove(id);
    }
  }, [selectedIds, handleRemove]);

  const selectedFavorites = useMemo(
    () => favorites.filter((f) => selectedIds.has(f.id)),
    [favorites, selectedIds]
  );

  const allSelected =
    favorites.length > 0 && selectedIds.size === favorites.length;

  // Group by event for SGP display
  const grouped = groupByEvent(favorites);
  const sgpEvents = Array.from(grouped.entries()).filter(
    ([_, items]) => items.length >= 2
  );

  return (
    <div className="min-h-screen pb-16 bg-neutral-50 dark:bg-neutral-950">
      <MaxWidthWrapper className="pt-24 md:pt-28">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-sm">
                  <HeartFill className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
                  My Plays
                </h1>
                {favorites.length > 0 && (
                  <span className="text-neutral-400 dark:text-neutral-500 text-lg font-medium">
                    ({favorites.length})
                  </span>
                )}
              </div>
              <p className="text-neutral-500 dark:text-neutral-400">
                Compare odds across books and build your perfect parlay
              </p>
            </div>

            {favorites.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAllOdds(!showAllOdds)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                    showAllOdds
                      ? "bg-brand text-white"
                      : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                  )}
                >
                  <Filter className="w-4 h-4" />
                  {showAllOdds ? "Hide Odds" : "Show All Odds"}
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  disabled={selectedIds.size === 0}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                    "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700",
                    selectedIds.size === 0
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-neutral-300"
                  )}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            )}
          </div>

          {/* Book Filter */}
          {favorites.length > 0 && uniqueBooks.length > 1 && (
            <BookFilterPills
              books={uniqueBooks}
              selected={filterBook}
              onSelect={setFilterBook}
            />
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
          </div>
        ) : favorites.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4">
              {/* Actions Bar */}
              <div className="flex items-center justify-between py-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-brand transition-colors"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>

                {selectedIds.size > 0 && (
                  <button
                    onClick={handleClearSelected}
                    className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Selected ({selectedIds.size})
                  </button>
                )}
              </div>

              {/* Favorites List */}
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {favorites.map((favorite) => (
                    <FavoriteRow
                      key={favorite.id}
                      favorite={favorite}
                      onRemove={() => handleRemove(favorite.id)}
                      isRemoving={removingId === favorite.id}
                      isSelected={selectedIds.has(favorite.id)}
                      onSelect={() => handleSelect(favorite.id)}
                      showAllOdds={showAllOdds}
                      filterBook={filterBook}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <BestValueParlayCard
                favorites={favorites}
                selectedIds={selectedIds}
              />

              {/* Quick Links */}
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
                  Find More Picks
                </h3>
                <div className="space-y-2">
                  <Link
                    href="/edge-finder"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-brand" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        Edge Finder
                      </span>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        +EV opportunities
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
                  </Link>
                  <Link
                    href="/cheatsheets/nba/hit-rates"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <ExternalLink className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        Cheat Sheets
                      </span>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Hit rates & trends
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </MaxWidthWrapper>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        favorites={favorites}
        selectedIds={selectedIds}
      />
    </div>
  );
}
