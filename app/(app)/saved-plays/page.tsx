"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useFavorites, Favorite, BookSnapshot } from "@/hooks/use-favorites";
import { useBetslips, Betslip, getColorClass, calculateLegsHash, SgpOddsResponse } from "@/hooks/use-betslips";
import { useFavoritesStream, type FavoriteChange } from "@/hooks/use-favorites-stream";
import { useIsMobile } from "@/hooks/use-media-query";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabelShort } from "@/lib/data/markets";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Heart,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Layers,
  BarChart3,
  Search,
  X,
  Edit3,
  GripVertical,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Eye,
  Share2,
} from "lucide-react";

// ============================================================================
// HELPERS
// ============================================================================

const formatOdds = (price: number | string | null | undefined): string => {
  if (price === null || price === undefined) return "—";
  const num = typeof price === "string" ? parseInt(price, 10) : price;
  if (isNaN(num)) return "—";
  return num >= 0 ? `+${num}` : `${num}`;
};

const formatSide = (side: string): string => {
  if (side === "over" || side === "o") return "O";
  if (side === "under" || side === "u") return "U";
  if (side === "yes") return "Yes";
  if (side === "no") return "No";
  return side.charAt(0).toUpperCase();
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

const formatFavoriteTime = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const dayLabel = isToday
    ? "Today"
    : new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${dayLabel} ${timeLabel}`;
};

const getBestOdds = (snapshot: Record<string, BookSnapshot> | null): { bookId: string; price: number } | null => {
  if (!snapshot) return null;
  let best: { bookId: string; price: number } | null = null;
  Object.entries(snapshot).forEach(([bookId, data]) => {
    if (data.price && (!best || data.price > best.price)) {
      best = { bookId, price: data.price };
    }
  });
  return best;
};

const getSortedBooks = (snapshot: Record<string, BookSnapshot> | null, limit = 5): { bookId: string; data: BookSnapshot }[] => {
  if (!snapshot) return [];
  return Object.entries(snapshot)
    .filter(([, data]) => data.price)
    .sort((a, b) => (b[1].price || 0) - (a[1].price || 0))
    .slice(0, limit)
    .map(([bookId, data]) => ({ bookId, data }));
};

const openBetLink = (snapshot?: BookSnapshot | null) => {
  if (!snapshot) return;
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
  const link = isMobile ? (snapshot.m || snapshot.u) : (snapshot.u || snapshot.m);
  if (link) window.open(link, "_blank");
};

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
};

const formatLegPreview = (fav: Favorite): string => {
  const player = fav.player_name || fav.home_team || "Unknown";
  const side = formatSide(fav.side);
  const line = fav.line !== null ? fav.line : "";
  const market = formatMarketLabelShort(fav.market) || fav.market;
  return `${player} ${side} ${line} ${market}`.trim();
};

// ============================================================================
// DRAG & DROP CONTEXT
// ============================================================================

interface DragState {
  favoriteIds: string[];
  isDragging: boolean;
}

// ============================================================================
// FAVORITE ROW COMPONENT
// ============================================================================

interface RefreshedFavoriteOdds {
  best: { price: number; book: string } | null;
  allBooks: Record<string, { price: number; link: string | null; sgp: string | null }>;
}

interface FavoriteRowProps {
  favorite: Favorite;
  isSelected: boolean;
  selectedIds: Set<string>;
  onToggleSelect: () => void;
  onRemove: () => void;
  onAddToBetslip?: () => void;
  onDragStart?: (ids: string[]) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isMobile?: boolean;
  dragPreviewRef?: React.RefObject<HTMLDivElement | null>;
  refreshedOdds?: RefreshedFavoriteOdds | null;
  priceChange?: FavoriteChange | null;
  /** Average odds across all books for edge calculation */
  avgPrice?: number | null;
}

function FavoriteRow({ 
  favorite, 
  isSelected, 
  selectedIds,
  onToggleSelect, 
  onRemove,
  onAddToBetslip,
  onDragStart,
  onDragEnd,
  isDragging,
  isMobile,
  dragPreviewRef,
  refreshedOdds,
  priceChange,
  avgPrice,
}: FavoriteRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllBooks, setShowAllBooks] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const savedBestOdds = getBestOdds(favorite.books_snapshot);
  // Use refreshed odds if available, otherwise fall back to saved snapshot
  const bestOdds = refreshedOdds?.best 
    ? { bookId: refreshedOdds.best.book, price: refreshedOdds.best.price }
    : savedBestOdds;
  // Use stream price change if available, otherwise check if odds different from saved
  const oddsChanged = priceChange?.priceDirection || (refreshedOdds?.best && savedBestOdds && refreshedOdds.best.price !== savedBestOdds.price);
  const priceDirection = priceChange?.priceDirection;
  
  // Calculate edge vs average
  const edge = useMemo(() => {
    if (!bestOdds?.price || !avgPrice) return null;
    const bestDecimal = bestOdds.price >= 0 ? (bestOdds.price / 100) + 1 : (100 / Math.abs(bestOdds.price)) + 1;
    const avgDecimal = avgPrice >= 0 ? (avgPrice / 100) + 1 : (100 / Math.abs(avgPrice)) + 1;
    if (avgDecimal <= 1) return null;
    return ((bestDecimal - avgDecimal) / avgDecimal) * 100;
  }, [bestOdds?.price, avgPrice]);
  
  // Get sorted books - use refreshed odds if available, otherwise saved snapshot
  // Returns same structure as getSortedBooks: { bookId: string; data: BookSnapshot }[]
  const getEffectiveBookOdds = (): { bookId: string; data: BookSnapshot }[] => {
    if (refreshedOdds?.allBooks && Object.keys(refreshedOdds.allBooks).length > 0) {
      // Use refreshed odds - convert to BookSnapshot format
      return Object.entries(refreshedOdds.allBooks)
        .map(([bookId, oddsData]) => ({ 
          bookId, 
          data: { 
            price: oddsData.price, 
            u: oddsData.link, 
            m: null, 
            sgp: oddsData.sgp 
          } as BookSnapshot 
        }))
        .sort((a, b) => {
          const aPrice = a.data.price || 0;
          const bPrice = b.data.price || 0;
          if (aPrice >= 0 && bPrice >= 0) return bPrice - aPrice;
          if (aPrice < 0 && bPrice < 0) return bPrice - aPrice;
          return bPrice - aPrice;
        });
    }
    // Fall back to saved snapshot
    return getSortedBooks(favorite.books_snapshot, 999);
  };
  
  const allBookOdds = getEffectiveBookOdds();
  const displayedBooks = showAllBooks ? allBookOdds : allBookOdds.slice(0, 5); // Show top 5 by default
  const totalBooks = allBookOdds.length;
  const hasMoreBooks = totalBooks > 5;
  const hasRefreshedOdds = refreshedOdds?.allBooks && Object.keys(refreshedOdds.allBooks).length > 0;
  
  // Freshness indicator
  const isLive = hasRefreshedOdds; // LIVE = odds updated via SSE stream
  
  const playerOrTeam = favorite.player_name || favorite.home_team || "Unknown";
  const marketDisplay = formatMarketLabelShort(favorite.market) || favorite.market;
  const lineDisplay = favorite.line !== null ? favorite.line : "";
  const sideDisplay = formatSide(favorite.side);
  const timeLabel = formatFavoriteTime(favorite.start_time || favorite.game_date);
  
  // Copy play text to clipboard
  const handleCopy = async () => {
    const text = `${playerOrTeam} ${sideDisplay}${lineDisplay} ${marketDisplay} ${bestOdds ? formatOdds(bestOdds.price) : ""} ${bestOdds ? getBookName(bestOdds.bookId) : ""}`.trim();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div 
      className={cn(
        "border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 group/row transition-opacity",
        isDragging && "opacity-50 bg-emerald-50/50 dark:bg-emerald-900/10",
        isSelected && "bg-emerald-50/30 dark:bg-emerald-900/10"
      )}
      draggable={!isMobile}
      onDragStart={(e) => {
        const idsToTransfer = isSelected && selectedIds.size > 1 
          ? Array.from(selectedIds) 
          : [favorite.id];
        e.dataTransfer.setData("favoriteIds", JSON.stringify(idsToTransfer));
        e.dataTransfer.effectAllowed = "copy";
        
        if (idsToTransfer.length > 1 && dragPreviewRef?.current) {
          const countEl = dragPreviewRef.current.querySelector('[data-drag-count]');
          const labelEl = dragPreviewRef.current.querySelector('[data-drag-label]');
          if (countEl) countEl.textContent = String(idsToTransfer.length);
          if (labelEl) labelEl.textContent = `${idsToTransfer.length} plays`;
          e.dataTransfer.setDragImage(dragPreviewRef.current, 100, 30);
        }
        onDragStart?.(idsToTransfer);
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      {/* Main row - Hierarchy: 1) Value signal 2) Best odds 3) Context */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors group/main",
          isExpanded && "bg-neutral-50/50 dark:bg-neutral-800/20"
        )}
      >
        {/* Drag handle (desktop only) */}
        {!isMobile && (
          <div className="cursor-grab active:cursor-grabbing text-neutral-300 dark:text-neutral-600 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        
        {/* Checkbox */}
        <div 
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleSelect();
            }
          }}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4"
          />
        </div>
        
        {/* Play info - clickable to expand */}
        <div 
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Context (quiet) - Player + Prop */}
          <div className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
            {playerOrTeam}
          </div>
          <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            {sideDisplay} {lineDisplay} {marketDisplay}
            {timeLabel && ` · ${timeLabel}`}
          </div>
        </div>
        
        {/* 1️⃣ VALUE SIGNAL (primary) - Edge % - Should pop first */}
        {edge !== null && edge >= 3 && (
          <div className="shrink-0 text-right">
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              ▲ +{edge.toFixed(0)}%
            </div>
            <div className="text-[9px] text-neutral-400 dark:text-neutral-500">
              vs avg ({totalBooks})
            </div>
          </div>
        )}
        
        {/* 2️⃣ BEST ODDS (secondary) - Price chip with BEST indicator */}
        {bestOdds && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const refreshedLink = refreshedOdds?.allBooks?.[bestOdds.bookId]?.link;
              if (refreshedLink) {
                window.open(refreshedLink, "_blank");
              } else {
                openBetLink(favorite.books_snapshot?.[bestOdds.bookId]);
              }
            }}
            className={cn(
              "relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg shrink-0 transition-all group/chip",
              "bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
              priceDirection === "up" && "ring-2 ring-emerald-400/50",
              priceDirection === "down" && "ring-2 ring-amber-400/50"
            )}
            title={`Bet at ${getBookName(bestOdds.bookId)}`}
          >
            {/* BEST indicator when edge is good */}
            {edge !== null && edge >= 5 && (
              <span className="absolute -top-1.5 -left-1 px-1 py-0.5 text-[7px] font-bold bg-emerald-500 text-white rounded uppercase leading-none">
                Best
              </span>
            )}
            {priceDirection && (
              <span className={cn(
                "text-[9px] font-medium",
                priceDirection === "up" ? "text-emerald-500" : "text-amber-500"
              )}>
                {priceDirection === "up" ? "↑" : "↓"}
              </span>
            )}
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatOdds(bestOdds.price)}
            </span>
            {getBookLogo(bestOdds.bookId) && (
              <img 
                src={getBookLogo(bestOdds.bookId)!} 
                alt={getBookName(bestOdds.bookId)} 
                className="h-3.5 w-3.5 object-contain"
              />
            )}
            {/* Subtle "+" affordance on hover */}
            <Plus className="h-3 w-3 text-emerald-500/0 group-hover/chip:text-emerald-500/70 transition-colors" />
          </button>
        )}
        
        {/* Expand chevron */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            isExpanded 
              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300" 
              : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          )}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      
      {/* Expanded state - shows odds comparison + quick actions */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className={cn("px-4 pb-3", isMobile ? "pl-11" : "pl-14")}>
              <div className="bg-neutral-50 dark:bg-neutral-800/40 rounded-lg p-3">
                {/* Header: Premium "Best Price by Book" + LIVE indicator */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Best Price by Book
                    </span>
                    {isLive && (
                      <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    {totalBooks} book{totalBooks !== 1 ? "s" : ""} tracked
                  </span>
                </div>
                
                {/* Book rows - Bloomberg-style tight alignment */}
                <div className="space-y-0.5">
                  {displayedBooks.map(({ bookId, data }, i) => {
                    const isBest = i === 0;
                    return (
                      <button
                        key={bookId}
                        onClick={() => {
                          const refreshedLink = refreshedOdds?.allBooks?.[bookId]?.link;
                          if (refreshedLink) {
                            window.open(refreshedLink, "_blank");
                          } else {
                            openBetLink(data);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between w-full px-2 py-1.5 rounded-md transition-colors group/book",
                          isBest 
                            ? "bg-emerald-50/80 dark:bg-emerald-900/20" 
                            : "hover:bg-neutral-100/50 dark:hover:bg-neutral-700/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {getBookLogo(bookId) ? (
                            <img 
                              src={getBookLogo(bookId)!} 
                              alt="" 
                              className={cn("object-contain", isBest ? "h-4 w-4" : "h-3.5 w-3.5 opacity-70")}
                            />
                          ) : (
                            <div className={cn("rounded bg-neutral-200 dark:bg-neutral-700", isBest ? "h-4 w-4" : "h-3.5 w-3.5")} />
                          )}
                          <span className={cn(
                            "text-xs",
                            isBest 
                              ? "font-medium text-neutral-900 dark:text-white" 
                              : "text-neutral-500 dark:text-neutral-500"
                          )}>
                            {getBookName(bookId)}
                          </span>
                          {isBest && (
                            <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-500 text-white rounded uppercase">
                              Best
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-xs tabular-nums text-right min-w-[48px]",
                            isBest 
                              ? "font-bold text-emerald-600 dark:text-emerald-400" 
                              : "text-neutral-400 dark:text-neutral-500"
                          )}>
                            {formatOdds(data.price)}
                          </span>
                          <ExternalLink className={cn(
                            "h-3 w-3 transition-opacity",
                            isBest 
                              ? "text-emerald-400 opacity-50 group-hover/book:opacity-100" 
                              : "text-neutral-300 dark:text-neutral-600 opacity-0 group-hover/book:opacity-100"
                          )} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {/* View all / Show less toggle */}
                {hasMoreBooks && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllBooks(!showAllBooks);
                    }}
                    className="w-full mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700 text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                  >
                    {showAllBooks ? "Show less" : `View all ${totalBooks} books`}
                  </button>
                )}
                
                {/* Quick actions strip */}
                <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-700">
                  {onAddToBetslip && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToBetslip();
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add to betslip
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy();
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// BETSLIP CARD HELPERS
// ============================================================================

interface BookOddsData {
  bookId: string;
  odds: number;
  hasDeepLink: boolean;
  hasAllLegs?: boolean; // True if book has odds for all legs
  legsSupported?: number; // Number of legs this book supports
  totalLegs?: number; // Total legs in betslip
}

// Calculate parlay odds from individual favorites for ALL books
const calculateAllParlayOdds = (favorites: Favorite[]): BookOddsData[] => {
  if (favorites.length < 2) return [];
  
  // Get all books that have odds for ALL legs
  const allBooks = new Set<string>();
  favorites.forEach(fav => {
    if (fav.books_snapshot) {
      Object.keys(fav.books_snapshot).forEach(book => allBooks.add(book));
    }
  });
  
  const results: BookOddsData[] = [];
  
  allBooks.forEach(bookId => {
    let parlayDecimal = 1;
    let hasAllLegs = true;
    
    favorites.forEach(fav => {
      const bookData = fav.books_snapshot?.[bookId];
      if (!bookData?.price) {
        hasAllLegs = false;
        return;
      }
      const american = bookData.price;
      const decimal = american > 0 ? (american / 100) + 1 : (100 / Math.abs(american)) + 1;
      parlayDecimal *= decimal;
    });
    
    if (hasAllLegs && parlayDecimal > 1) {
      const american = parlayDecimal >= 2 
        ? Math.round((parlayDecimal - 1) * 100)
        : Math.round(-100 / (parlayDecimal - 1));
      
      results.push({ bookId, odds: american, hasDeepLink: false });
    }
  });
  
  return results.sort((a, b) => b.odds - a.odds);
};

// Get SGP odds sorted by best odds
// Books with all legs come first, partial legs come after (greyed out)
const getSortedSgpOdds = (cache: Record<string, { 
  price?: string; 
  links?: { desktop: string; mobile: string }; 
  error?: string;
  has_all_legs?: boolean;
  legs_supported?: number;
  total_legs?: number;
}> | null): BookOddsData[] => {
  if (!cache) return [];
  
  return Object.entries(cache)
    .filter(([, data]) => data.price && !data.error)
    .map(([bookId, data]) => ({
      bookId,
      odds: parseInt(data.price!.replace("+", ""), 10),
      hasDeepLink: !!(data.links?.desktop || data.links?.mobile),
      hasAllLegs: data.has_all_legs ?? true, // Default to true for backwards compat
      legsSupported: data.legs_supported,
      totalLegs: data.total_legs,
    }))
    .filter(item => !isNaN(item.odds))
    // Sort: books with all legs first (by odds), then partial legs (by odds)
    .sort((a, b) => {
      // Full support books come first
      if (a.hasAllLegs && !b.hasAllLegs) return -1;
      if (!a.hasAllLegs && b.hasAllLegs) return 1;
      // Within same category, sort by odds (highest first)
      return b.odds - a.odds;
    });
};

// Get unavailable books from SGP cache
const getUnavailableBooks = (cache: Record<string, { price?: string; error?: string }> | null): string[] => {
  if (!cache) return [];
  return Object.entries(cache)
    .filter(([, data]) => data.error || !data.price)
    .map(([bookId]) => bookId);
};

// Get bet type label
const getBetTypeLabel = (betType: string | null, legCount: number): { label: string; tooltip: string } | null => {
  if (legCount < 2) return null;
  
  if (betType === "sgp") {
    return { label: "SGP", tooltip: "Same Game Parlay – all legs from one game" };
  }
  if (betType === "sgp_plus") {
    return { label: "SGP+", tooltip: "SGP+ – legs from multiple games" };
  }
  
  return null;
};

// Calculate edge percentage (best odds vs average)
const calculateEdge = (bestOdds: number, allOdds: number[]): number | null => {
  if (allOdds.length < 2) return null;
  
  // Convert to implied probabilities
  const toProb = (american: number) => 
    american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);
  
  const bestProb = toProb(bestOdds);
  const avgProb = allOdds.reduce((sum, o) => sum + toProb(o), 0) / allOdds.length;
  
  // Edge = how much better best is vs average
  const edge = ((avgProb - bestProb) / avgProb) * 100;
  return edge > 0 ? edge : null;
};

// Check if odds are stale
const isOddsStale = (updatedAt: string | null, thresholdMinutes = 10): boolean => {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - updated.getTime()) / 60000;
  return diffMinutes > thresholdMinutes;
};

// Format time since update
const formatTimeSince = (dateStr: string | null): string | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return `${Math.floor(diffSeconds / 3600)}h ago`;
};

// Constants for passive refresh
const PASSIVE_REFRESH_MIN_INTERVAL_MS = 20000; // 20 seconds between refreshes
const PASSIVE_REFRESH_STALE_THRESHOLD_MS = 30000; // Consider stale after 30s for passive refresh

// ============================================================================
// BETSLIP CARD COMPONENT
// ============================================================================

interface BetslipCardProps {
  betslip: Betslip;
  onDelete: () => void;
  onRename: (name: string) => void;
  onQuickCompare: () => void;
  onRemoveLeg: (favoriteId: string) => void;
  onFetchOdds: (forceRefresh?: boolean) => Promise<SgpOddsResponse | void>;
  isFetchingOdds?: boolean;
  onDrop?: (favoriteIds: string[]) => void;
  isDropTarget?: boolean;
  dragCount?: number;
  /** Map of favorite ID to refreshed odds (for leg-level "market moved" detection) */
  refreshedOddsMap?: Map<string, RefreshedFavoriteOdds | null>;
  /** Map of favorite ID to price change direction */
  changesMap?: Map<string, FavoriteChange>;
}

function BetslipCard({ 
  betslip, 
  onDelete, 
  onRename, 
  onQuickCompare, 
  onRemoveLeg, 
  onFetchOdds, 
  isFetchingOdds, 
  onDrop, 
  isDropTarget, 
  dragCount = 1,
  refreshedOddsMap,
  changesMap,
}: BetslipCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(betslip.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllBooks, setShowAllBooks] = useState(false);
  
  // Track legs hash for detecting when legs are added/removed
  const [lastFetchedLegsHash, setLastFetchedLegsHash] = useState<string | null>(null);
  const lastPassiveRefreshRef = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const items = betslip.items || [];
  const legCount = items.length || betslip.legs_count || 0;
  const lastUpdated = formatRelativeTime(betslip.updated_at);
  const favorites = items.map(item => item.favorite).filter(Boolean) as Favorite[];
  
  // Get up to 2 leg previews
  const previewLegs = favorites.slice(0, 2);
  const remainingLegs = legCount - previewLegs.length;
  
  // Calculate current legs hash
  const currentLegsHash = useMemo(() => calculateLegsHash(items), [items]);
  
  // Detect if legs changed since last fetch
  const legsChanged = lastFetchedLegsHash !== null && lastFetchedLegsHash !== currentLegsHash;
  
  // Detect if any individual leg's odds moved (from SSE stream)
  const legsWithMovement = useMemo(() => {
    if (!changesMap) return new Set<string>();
    const moved = new Set<string>();
    for (const item of items) {
      const favId = item.favorite?.id;
      if (favId && changesMap.has(favId)) {
        moved.add(favId);
      }
    }
    return moved;
  }, [items, changesMap]);
  
  const hasMarketMovement = legsWithMovement.size > 0;
  
  // Calculate odds
  const sgpOdds = useMemo(() => getSortedSgpOdds(betslip.sgp_odds_cache), [betslip.sgp_odds_cache]);
  const parlayOdds = useMemo(() => calculateAllParlayOdds(favorites), [favorites]);
  const unavailableBooks = useMemo(() => getUnavailableBooks(betslip.sgp_odds_cache), [betslip.sgp_odds_cache]);
  const betTypeInfo = getBetTypeLabel(betslip.bet_type, legCount);
  
  // Determine which odds to use
  const hasMultipleLegs = legCount >= 2;
  const bookOdds = sgpOdds.length > 0 ? sgpOdds : parlayOdds;
  const bestOdds = bookOdds[0] || null;
  const top3Books = bookOdds.slice(0, 3);
  const totalAvailableBooks = bookOdds.length;
  
  // Calculate edge (best vs average) - only use books with ALL legs
  const edge = useMemo(() => {
    // Filter to only books with all legs for accurate average
    const fullLegsBooks = bookOdds.filter(b => b.hasAllLegs !== false);
    if (fullLegsBooks.length < 2 || !bestOdds) return null;
    // Only calculate if best book has all legs
    if (bestOdds.hasAllLegs === false) return null;
    return calculateEdge(bestOdds.odds, fullLegsBooks.map(b => b.odds));
  }, [bookOdds, bestOdds]);
  
  // Check staleness
  const oddsAgeMs = betslip.sgp_odds_updated_at 
    ? Date.now() - new Date(betslip.sgp_odds_updated_at).getTime()
    : null;
  const oddsStale = oddsAgeMs !== null && oddsAgeMs > PASSIVE_REFRESH_STALE_THRESHOLD_MS;
  const oddsUpdatedAgo = formatTimeSince(betslip.sgp_odds_updated_at);
  
  // Determine if price may have changed (show warning badge)
  const priceUncertain = legsChanged || hasMarketMovement || oddsStale;
  
  // Passive refresh with Intersection Observer + rate limiting
  useEffect(() => {
    if (!cardRef.current || !hasMultipleLegs) return;
    
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        if (isFetchingOdds) return;
        
        const now = Date.now();
        const timeSinceLastRefresh = now - lastPassiveRefreshRef.current;
        
        // Rate limit: min interval between passive refreshes
        if (timeSinceLastRefresh < PASSIVE_REFRESH_MIN_INTERVAL_MS) return;
        
        // Only refresh if something changed (legs changed, market moved, or stale)
        const needsRefresh = legsChanged || hasMarketMovement || oddsStale || !betslip.sgp_odds_cache;
        if (!needsRefresh) return;
        
        // Passive refresh (not forced - can use short Redis cache)
        lastPassiveRefreshRef.current = now;
        try {
          const result = await onFetchOdds(false);
          if (result?.legs_hash) {
            setLastFetchedLegsHash(result.legs_hash);
          }
        } catch (e) {
          console.warn("[BetslipCard] Passive refresh failed:", e);
        }
      },
      { threshold: 0.5 } // 50% visible
    );
    
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [hasMultipleLegs, isFetchingOdds, legsChanged, hasMarketMovement, oddsStale, betslip.sgp_odds_cache, onFetchOdds]);

  // Handle manual refresh (user-triggered, force refresh)
  const handleRefreshOdds = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await onFetchOdds(true);
      if (result?.legs_hash) {
        setLastFetchedLegsHash(result.legs_hash);
      }
      lastPassiveRefreshRef.current = Date.now();
      toast.success("Price confirmed");
    } catch (err) {
      toast.error("Failed to refresh odds");
    }
  };
  
  const handleSaveName = () => {
    if (editName.trim() && editName !== betslip.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };
  
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const favoriteIdsJson = e.dataTransfer.getData("favoriteIds");
    if (favoriteIdsJson && onDrop) {
      try {
        const favoriteIds = JSON.parse(favoriteIdsJson) as string[];
        onDrop(favoriteIds);
      } catch {
        // Fallback
      }
    }
  };
  
  const handleCopySlip = async () => {
    const betTypeText = betTypeInfo ? ` ${betTypeInfo.label}` : "";
    const legsText = favorites.map(fav => {
      const player = fav.player_name || fav.home_team || "Unknown";
      const side = formatSide(fav.side);
      const line = fav.line !== null ? fav.line : "";
      const market = formatMarketLabelShort(fav.market) || fav.market;
      return `${player} ${side}${line} ${market}`;
    }).join("\n");
    
    const oddsText = bestOdds ? `\nBest odds: ${formatOdds(bestOdds.odds)} (${getBookName(bestOdds.bookId)})` : "";
    const edgeText = edge !== null && edge >= 5 ? `\n+${edge.toFixed(0)}% vs market` : "";
    const text = `${betslip.name}${betTypeText} (${legCount} legs)\n\n${legsText}${oddsText}${edgeText}\n\nunjuiced.bet`;
    
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShare = async () => {
    // TODO: Generate share image
    toast.info("Share image coming soon");
  };
  
  const openBookLink = (bookId: string) => {
    const bookData = betslip.sgp_odds_cache?.[bookId];
    if (!bookData?.links) {
      // Fallback to sportsbook site
      const sb = getSportsbookById(bookId);
      const link = sb?.links?.desktop || sb?.links?.mobile;
      if (link) window.open(link, "_blank");
      return;
    }
    const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
    const link = isMobile ? (bookData.links.mobile || bookData.links.desktop) : (bookData.links.desktop || bookData.links.mobile);
    if (link) window.open(link, "_blank");
  };
  
  // Calculate average odds for context
  const avgOdds = useMemo(() => {
    const fullLegsBooks = bookOdds.filter(b => b.hasAllLegs !== false);
    if (fullLegsBooks.length < 2) return null;
    const sum = fullLegsBooks.reduce((acc, b) => acc + b.odds, 0);
    return Math.round(sum / fullLegsBooks.length);
  }, [bookOdds]);

  return (
    <div 
      ref={cardRef}
      className={cn(
        "border rounded-xl overflow-hidden bg-white dark:bg-neutral-900 transition-all",
        isDragOver 
          ? "border-emerald-500 ring-2 ring-emerald-500/20 scale-[1.01]" 
          : "border-neutral-200 dark:border-neutral-800",
        isDropTarget && !isDragOver && "border-dashed"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Card header - NEW HIERARCHY DESIGN */}
      <div
        className={cn(
          "cursor-pointer transition-colors",
          isExpanded && "border-b border-neutral-100 dark:border-neutral-800"
        )}
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        {/* Top bar: Title + Status Tags + Actions */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Color indicator */}
            <div className={cn("w-1 h-5 rounded-full shrink-0", getColorClass(betslip.color))} />
            
            {/* Title */}
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setEditName(betslip.name);
                    setIsEditing(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="flex-1 px-2 py-1 text-sm font-medium bg-neutral-100 dark:bg-neutral-800 rounded border-none outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            ) : (
              <span className="font-medium text-sm text-neutral-900 dark:text-white truncate">
                {betslip.name}
              </span>
            )}
            
            {/* SGP/SGP+ Badge - muted status tag */}
            {betTypeInfo && !isEditing && (
              <span 
                className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                title={betTypeInfo.tooltip}
              >
                {betTypeInfo.label}
              </span>
            )}
          </div>
          
          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Refresh icon button */}
            {hasMultipleLegs && !isExpanded && (
              <button
                onClick={handleRefreshOdds}
                disabled={isFetchingOdds}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  priceUncertain 
                    ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20" 
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
                title={priceUncertain ? "Price may have changed - click to refresh" : "Refresh odds"}
              >
                {isFetchingOdds ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className={cn("h-3.5 w-3.5", priceUncertain && "animate-pulse")} />
                )}
              </button>
            )}
            
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setMenuOpen(false);
                  setIsEditing(true);
                }}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }} 
                  className="text-red-500 focus:text-red-500"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <motion.button 
              className="p-1 text-neutral-400"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
        
        {/* Main content area (collapsed only) - Simplified for "Is this worth opening?" */}
        {!isExpanded && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between gap-4">
              {/* LEFT: Value Signal (Hero) - Answer ONE question */}
              <div className="flex-1 min-w-0">
                {bestOdds ? (
                  <>
                    {/* Hero Odds + Badge */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                        {formatOdds(bestOdds.odds)}
                      </span>
                      {edge !== null && edge >= 5 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                          Best Price
                        </span>
                      )}
                    </div>
                    
                    {/* Single value explainer (one line max) */}
                    {edge !== null && edge >= 5 ? (
                      <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                        ▲ +{edge.toFixed(0)}% vs Market Avg
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                        Tracked across {bookOdds.filter(b => b.hasAllLegs !== false).length} book{bookOdds.filter(b => b.hasAllLegs !== false).length !== 1 ? 's' : ''}
                      </div>
                    )}
                    
                    {/* Minimal context */}
                    <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2">
                      {legCount} play{legCount !== 1 ? "s" : ""}
                      {oddsUpdatedAgo && <span> · {oddsUpdatedAgo}</span>}
                    </div>
                  </>
                ) : hasMultipleLegs ? (
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">
                    {isFetchingOdds ? "Loading odds..." : "Tap to compare odds"}
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    {legCount} play{legCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
              
              {/* RIGHT: Book + Action - Clean and secondary */}
              {bestOdds && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openBookLink(bestOdds.bookId);
                  }}
                  className="shrink-0 flex items-center gap-2 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors group"
                >
                  {getBookLogo(bestOdds.bookId) && (
                    <img 
                      src={getBookLogo(bestOdds.bookId)!} 
                      alt={getBookName(bestOdds.bookId)} 
                      className="h-6 w-6 object-contain"
                    />
                  )}
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Open
                  </span>
                  <ExternalLink className="h-3 w-3 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Expanded content - Visual continuation, not replacement */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-5">
              
              {/* Hero continuation - keeps visual continuity */}
              {bestOdds && hasMultipleLegs && (
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatOdds(bestOdds.odds)}
                      </span>
                      {edge !== null && edge >= 5 && (
                        <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                          +{edge.toFixed(0)}% vs avg
                        </span>
                      )}
                    </div>
                    {/* Edge bar with label */}
                    {edge !== null && edge >= 5 && (
                      <div className="mt-2">
                        <div className="h-1 w-32 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-300 dark:bg-emerald-700 rounded-full transition-all"
                            style={{ width: `${Math.min(edge, 100)}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1">
                          Odds advantage vs market
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {oddsUpdatedAgo && (
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        {oddsUpdatedAgo}
                      </span>
                    )}
                    <button
                      onClick={handleRefreshOdds}
                      disabled={isFetchingOdds}
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        priceUncertain 
                          ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20" 
                          : "text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      {isFetchingOdds ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════
                  ZONE 1: BEST ODDS BY SPORTSBOOK
                  ═══════════════════════════════════════════════════════════════ */}
              {hasMultipleLegs && (
                <div>
                  {/* Section header - cleaner */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Best Odds by Sportsbook
                    </span>
                    {priceUncertain && (
                      <span className="text-[10px] text-amber-500 dark:text-amber-400">
                        {hasMarketMovement ? "Market moved" : "May have changed"}
                      </span>
                    )}
                  </div>
                  
                  {bookOdds.length > 0 ? (
                    <>
                      {/* Book rows - refined styling */}
                      <div className="space-y-1">
                        {(showAllBooks ? bookOdds : top3Books).map((book, i) => {
                          const isBest = i === 0 && book.hasAllLegs !== false;
                          const isPartialLegs = book.hasAllLegs === false;
                          const isAfterTop3 = i === 3;
                          return (
                            <div key={book.bookId}>
                              {isAfterTop3 && (
                                <div className="border-t border-neutral-100 dark:border-neutral-800 my-2" />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openBookLink(book.bookId);
                                }}
                                className={cn(
                                  "flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all group",
                                  isPartialLegs
                                    ? "opacity-40 hover:opacity-60"
                                    : isBest 
                                      ? "bg-emerald-50/60 dark:bg-emerald-900/20 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" 
                                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  {getBookLogo(book.bookId) ? (
                                    <img 
                                      src={getBookLogo(book.bookId)!} 
                                      alt="" 
                                      className={cn(
                                        "object-contain h-5 w-5",
                                        isPartialLegs && "grayscale"
                                      )}
                                    />
                                  ) : (
                                    <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700" />
                                  )}
                                  <span className={cn(
                                    "text-sm",
                                    isPartialLegs 
                                      ? "text-neutral-400 dark:text-neutral-500" 
                                      : isBest
                                        ? "font-medium text-neutral-900 dark:text-white"
                                        : "text-neutral-600 dark:text-neutral-400"
                                  )}>
                                    {getBookName(book.bookId)}
                                  </span>
                                  {isBest && !isPartialLegs && (
                                    <span className="px-1 py-0.5 text-[9px] font-semibold rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 uppercase">
                                      Best
                                    </span>
                                  )}
                                  {isPartialLegs && book.legsSupported !== undefined && book.totalLegs !== undefined && (
                                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                      {book.legsSupported}/{book.totalLegs} legs
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "tabular-nums",
                                    isPartialLegs 
                                      ? "text-sm text-neutral-400 dark:text-neutral-500 line-through"
                                      : isBest 
                                        ? "text-base font-semibold text-emerald-600 dark:text-emerald-400" 
                                        : "text-sm text-neutral-500 dark:text-neutral-400"
                                  )}>
                                    {formatOdds(book.odds)}
                                  </span>
                                  {!isPartialLegs && (
                                    <ExternalLink className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Footer */}
                      <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                        {totalAvailableBooks > 3 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAllBooks(!showAllBooks);
                            }}
                            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                          >
                            {showAllBooks ? "Show less" : `View all ${totalAvailableBooks} books`}
                          </button>
                        )}
                        {unavailableBooks.length > 0 && (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-auto">
                            Not available: {unavailableBooks.slice(0, 2).map(b => getBookName(b)).join(", ")}
                            {unavailableBooks.length > 2 && ` +${unavailableBooks.length - 2}`}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 bg-neutral-50 dark:bg-neutral-800/30 rounded-lg">
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        No parlay odds available
                      </p>
                      <button
                        onClick={handleRefreshOdds}
                        disabled={isFetchingOdds}
                        className="mt-2 text-xs text-blue-500 hover:text-blue-600"
                      >
                        {isFetchingOdds ? "Loading..." : "Refresh odds"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════
                  ZONE 2: LEGS - Focus on what they need to do
                  ═══════════════════════════════════════════════════════════════ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Legs ({legCount})
                  </span>
                </div>
                {items.length > 0 ? (
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const fav = item.favorite;
                      if (!fav) return null;
                      return (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            {/* Player name - slightly reduced weight */}
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">
                              {fav.player_name || fav.home_team || "Unknown"}
                            </span>
                            {/* Prop line - higher contrast, this is what matters */}
                            <span className="text-sm font-medium text-neutral-900 dark:text-white ml-2">
                              {formatSide(fav.side)}{fav.line} {formatMarketLabelShort(fav.market) || fav.market}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveLeg(fav.id);
                            }}
                            className="p-1.5 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 rounded transition-all"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-6">
                    No plays in this betslip
                  </p>
                )}
              </div>
              
              {/* ═══════════════════════════════════════════════════════════════
                  ZONE 3: ACTIONS - Compare is the money feature
                  ═══════════════════════════════════════════════════════════════ */}
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex gap-2">
                  {/* Primary: Compare Odds - THE money feature */}
                  {hasMultipleLegs && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (bookOdds.length > 0) onQuickCompare();
                      }}
                      disabled={bookOdds.length === 0}
                      title={bookOdds.length === 0 ? "No parlay odds available" : undefined}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group",
                        bookOdds.length > 0 
                          ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm hover:shadow-md" 
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                      )}
                    >
                      <BarChart3 className={cn(
                        "h-4 w-4 transition-transform",
                        bookOdds.length > 0 && "group-hover:scale-110"
                      )} />
                      Compare Odds
                    </button>
                  )}
                  
                  {/* Secondary actions - muted */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopySlip();
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all",
                      !hasMultipleLegs && "flex-1"
                    )}
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                </div>
              </div>
              
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Drop hint when not expanded */}
      {!isExpanded && isDragOver && (
        <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-600 dark:text-emerald-400 text-center">
          Drop to add {dragCount > 1 ? `${dragCount} plays` : "play"} to {betslip.name}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EMPTY STATES
// ============================================================================

function FavoritesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <Heart className="h-6 w-6 text-neutral-400" />
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
        No saved plays yet
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-[220px]">
        Tap the heart on any play to save it here
      </p>
      <Link
        href="/positive-ev"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Search className="h-4 w-4" />
        Browse +EV
      </Link>
    </div>
  );
}

function BetslipsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <Layers className="h-6 w-6 text-neutral-400" />
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
        No betslips yet
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-[220px]">
        Select plays to create your first one
      </p>
    </div>
  );
}

// ============================================================================
// ADD TO BETSLIP MODAL
// ============================================================================

interface AddToBetslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  betslips: Betslip[];
  onAddToExisting: (betslipId: string) => void;
  onCreateNew: (name: string) => void;
  isLoading: boolean;
}

function AddToBetslipModal({
  isOpen,
  onClose,
  selectedCount,
  betslips,
  onAddToExisting,
  onCreateNew,
  isLoading,
}: AddToBetslipModalProps) {
  const [view, setView] = useState<"choose" | "new">("choose");
  const [newName, setNewName] = useState("");
  const [selectedBetslip, setSelectedBetslip] = useState<string | null>(null);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
              {view === "choose" ? "Add to betslip" : "New betslip"}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {selectedCount} play{selectedCount !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {view === "choose" ? (
            <div className="space-y-2">
              {/* Create new option */}
              <button
                onClick={() => setView("new")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <Plus className="h-5 w-5 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                  Create new betslip
                </span>
              </button>
              
              {/* Existing betslips */}
              {betslips.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mt-4 mb-2">
                    Or add to existing
                  </div>
                  {betslips.map((slip) => (
                    <button
                      key={slip.id}
                      onClick={() => setSelectedBetslip(slip.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors",
                        selectedBetslip === slip.id
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10"
                          : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      )}
                    >
                      <div className={cn("w-2 h-6 rounded-full", getColorClass(slip.color))} />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {slip.name}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {slip.legs_count} play{slip.legs_count !== 1 ? "s" : ""}
                        </div>
                      </div>
                      {selectedBetslip === slip.id && (
                        <Check className="h-4 w-4 text-emerald-500" />
                      )}
                    </button>
                  ))}
                </>
              )}
              
              {/* Add button */}
              {selectedBetslip && (
                <button
                  onClick={() => onAddToExisting(selectedBetslip)}
                  disabled={isLoading}
                  className="w-full mt-4 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white text-sm font-semibold transition-colors"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Add to betslip"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Betslip name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Betslip"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setView("choose")}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => onCreateNew(newName || "My Betslip")}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white text-sm font-semibold transition-colors"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Create"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function FavoritesPage() {
  const { favorites, removeFavorite, refreshOdds, isRefreshingOdds, isLoading: favoritesLoading } = useFavorites();
  const { 
    betslips, 
    isLoading: betslipsLoading, 
    createBetslip, 
    isCreating,
    updateBetslip,
    deleteBetslip,
    addToBetslip,
    isAddingItems,
    removeFromBetslip,
    fetchSgpOdds,
    isFetchingSgpOdds,
  } = useBetslips();
  const isMobile = useIsMobile();
  
  // Refs
  const dragPreviewRef = useRef<HTMLDivElement>(null);
  
  // State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<"favorites" | "betslips">("favorites");
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragState, setDragState] = useState<DragState>({ favoriteIds: [], isDragging: false });
  const [fetchingBetslipId, setFetchingBetslipId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"edge" | "time" | "odds">("edge");
  
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  
  // Handler for fetching SGP odds for a specific betslip
  const handleFetchSgpOdds = useCallback(async (betslipId: string, forceRefresh = false): Promise<SgpOddsResponse | void> => {
    setFetchingBetslipId(betslipId);
    try {
      const result = await fetchSgpOdds({ betslipId, forceRefresh });
      return result;
    } finally {
      setFetchingBetslipId(null);
    }
  }, [fetchSgpOdds]);
  
  // Live streaming odds via SSE (auto-refresh in background)
  const {
    refreshedOdds: streamRefreshedOdds,
    changes: streamChanges,
  } = useFavoritesStream({
    favorites,
    refreshOdds,
    enabled: true,
  });
  
  // Convert stream data to the format expected by FavoriteRow
  const refreshedOddsMap = useMemo(() => {
    const map = new Map<string, RefreshedFavoriteOdds | null>();
    for (const [id, data] of streamRefreshedOdds) {
      if (data) {
        map.set(id, {
          best: data.best ? { price: data.best.price, book: data.best.book } : null,
          allBooks: data.allBooks,
        });
      } else {
        map.set(id, null);
      }
    }
    return map;
  }, [streamRefreshedOdds]);
  
  // Handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  const handleRemove = useCallback(async (id: string) => {
    const fav = favorites.find(f => f.id === id);
    const playerName = fav?.player_name || fav?.home_team || "Play";
    
    await removeFavorite(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success(`Removed ${playerName}`);
  }, [removeFavorite, favorites]);
  
  const handleAddToExisting = useCallback(async (betslipId: string) => {
    const slip = betslips.find(b => b.id === betslipId);
    const result = await addToBetslip({
      betslip_id: betslipId,
      favorite_ids: Array.from(selectedIds),
    });
    
    // Show appropriate feedback based on result
    const addedCount = result.added.length;
    const skippedCount = result.skipped.length;
    const replacedCount = result.replaced.length;
    
    if (addedCount > 0) {
      toast.success(`Added ${addedCount} play${addedCount !== 1 ? "s" : ""} to ${slip?.name || "betslip"}`);
    }
    
    if (skippedCount > 0) {
      const skippedNames = result.skipped
        .map(s => s.playerName ? `${s.playerName} (${s.market})` : "play")
        .slice(0, 2)
        .join(", ");
      toast.warning(
        `Skipped ${skippedCount}: ${skippedNames}${skippedCount > 2 ? "..." : ""} - same player/market already in betslip`,
        { duration: 5000 }
      );
    }
    
    if (replacedCount > 0) {
      const replacedNames = result.replaced
        .map(r => `${r.playerName || "play"}: ${r.reason}`)
        .slice(0, 2)
        .join("; ");
      toast.info(`Updated ${replacedCount}: ${replacedNames}`, { duration: 4000 });
    }
    
    setSelectedIds(new Set());
    setShowAddModal(false);
    
    // Fetch SGP odds for the updated betslip (if it now has 2+ legs)
    const newLegCount = (slip?.items?.length || 0) + addedCount + replacedCount;
    if (newLegCount >= 2) {
      setTimeout(() => {
        handleFetchSgpOdds(betslipId, true).catch(console.error);
      }, 500);
    }
  }, [selectedIds, selectedCount, betslips, addToBetslip, handleFetchSgpOdds]);
  
  const handleCreateNew = useCallback(async (name: string) => {
    const newBetslip = await createBetslip({
      name,
      favorite_ids: Array.from(selectedIds),
    });
    toast.success(`Created "${name}" with ${selectedCount} play${selectedCount !== 1 ? "s" : ""}`);
    setSelectedIds(new Set());
    setShowAddModal(false);
    
    // Fetch SGP odds for the new betslip (if it has 2+ legs)
    if (selectedCount >= 2 && newBetslip?.id) {
      setTimeout(() => {
        handleFetchSgpOdds(newBetslip.id, true).catch(console.error);
      }, 500);
    }
  }, [selectedIds, selectedCount, createBetslip, handleFetchSgpOdds]);
  
  const handleDeleteBetslip = useCallback(async (id: string) => {
    const slip = betslips.find(b => b.id === id);
    await deleteBetslip(id);
    toast.success(`Deleted "${slip?.name}"`);
  }, [betslips, deleteBetslip]);
  
  const handleRenameBetslip = useCallback(async (id: string, name: string) => {
    await updateBetslip({ id, name });
    toast.success("Betslip renamed");
  }, [updateBetslip]);
  
  // Drag & drop handlers
  const handleDragStart = useCallback((favoriteIds: string[]) => {
    setDragState({ favoriteIds, isDragging: true });
  }, []);
  
  const handleDragEnd = useCallback(() => {
    setDragState({ favoriteIds: [], isDragging: false });
  }, []);
  
  const handleDropOnBetslip = useCallback(async (betslipId: string, favoriteIds: string[]) => {
    const slip = betslips.find(b => b.id === betslipId);
    
    const result = await addToBetslip({
      betslip_id: betslipId,
      favorite_ids: favoriteIds,
    });
    
    // Show feedback based on result
    const addedCount = result.added.length;
    const skippedCount = result.skipped.length;
    const replacedCount = result.replaced.length;
    
    if (addedCount > 0) {
      if (addedCount === 1) {
        const fav = favorites.find(f => f.id === result.added[0]);
        const playerName = fav?.player_name || fav?.home_team || "Play";
        toast.success(`Added ${playerName} to ${slip?.name || "betslip"}`);
      } else {
        toast.success(`Added ${addedCount} plays to ${slip?.name || "betslip"}`);
      }
    }
    
    if (skippedCount > 0) {
      const skippedNames = result.skipped
        .map(s => s.playerName || "play")
        .slice(0, 2)
        .join(", ");
      toast.warning(
        `Skipped ${skippedNames}${skippedCount > 2 ? ` +${skippedCount - 2} more` : ""} - same player/market already in betslip`,
        { duration: 5000 }
      );
    }
    
    if (replacedCount > 0) {
      toast.info(
        `Updated ${replacedCount} selection${replacedCount !== 1 ? "s" : ""} to higher line`,
        { duration: 4000 }
      );
    }
    
    // Clear selection after drop
    setSelectedIds(new Set());
    
    // Fetch SGP odds for the updated betslip (if it now has 2+ legs)
    const actualAdded = addedCount + replacedCount;
    const newLegCount = (slip?.items?.length || 0) + actualAdded;
    if (newLegCount >= 2 && actualAdded > 0) {
      // Small delay to let the query cache invalidate first
      setTimeout(() => {
        handleFetchSgpOdds(betslipId, true).catch(console.error);
      }, 500);
    }
  }, [betslips, favorites, addToBetslip, handleFetchSgpOdds]);
  
  const handleQuickCompare = useCallback((betslipId: string) => {
    // TODO: Open Quick Compare panel with betslip items
    toast.info("Quick Compare coming soon");
  }, []);
  
  const handleRemoveLegFromBetslip = useCallback(async (betslipId: string, favoriteId: string) => {
    await removeFromBetslip({ betslipId, favoriteId });
    toast.success("Leg removed from betslip");
  }, [removeFromBetslip]);
  
  const isLoading = favoritesLoading || betslipsLoading;
  
  // Calculate average price for a favorite across all books
  const getAvgPrice = useCallback((favorite: Favorite): number | null => {
    const refreshed = refreshedOddsMap.get(favorite.id);
    const books = refreshed?.allBooks 
      ? Object.values(refreshed.allBooks).map(b => b.price).filter(Boolean)
      : favorite.books_snapshot 
        ? Object.values(favorite.books_snapshot).map(b => b?.price).filter(Boolean) as number[]
        : [];
    if (books.length < 2) return null;
    return Math.round(books.reduce((a, b) => a + b, 0) / books.length);
  }, [refreshedOddsMap]);

  // Calculate edge for a favorite (for sorting)
  const getEdge = useCallback((favorite: Favorite): number => {
    const avgPrice = getAvgPrice(favorite);
    const refreshed = refreshedOddsMap.get(favorite.id);
    const bestPrice = refreshed?.best?.price ?? getBestOdds(favorite.books_snapshot)?.price;
    if (!bestPrice || !avgPrice) return 0;
    const bestDecimal = bestPrice >= 0 ? (bestPrice / 100) + 1 : (100 / Math.abs(bestPrice)) + 1;
    const avgDecimal = avgPrice >= 0 ? (avgPrice / 100) + 1 : (100 / Math.abs(avgPrice)) + 1;
    if (avgDecimal <= 1) return 0;
    return ((bestDecimal - avgDecimal) / avgDecimal) * 100;
  }, [getAvgPrice, refreshedOddsMap]);

  // Sort favorites based on current sort option
  const sortedFavorites = useMemo(() => {
    const sorted = [...favorites];
    switch (sortBy) {
      case "edge":
        return sorted.sort((a, b) => getEdge(b) - getEdge(a));
      case "odds":
        const getOdds = (f: Favorite) => {
          const refreshed = refreshedOddsMap.get(f.id);
          return refreshed?.best?.price ?? getBestOdds(f.books_snapshot)?.price ?? -9999;
        };
        return sorted.sort((a, b) => getOdds(b) - getOdds(a));
      case "time":
      default:
        return sorted; // Default order (most recent)
    }
  }, [favorites, sortBy, getEdge, refreshedOddsMap]);

  // Add single play to first available betslip (or create new)
  const handleAddSingleToBetslip = useCallback(async (favoriteId: string) => {
    const fav = favorites.find(f => f.id === favoriteId);
    const playerName = fav?.player_name || fav?.home_team || "Play";
    
    if (betslips.length === 0) {
      // Create a new betslip with this play
      const name = playerName.slice(0, 20);
      await createBetslip({ 
        name, 
        favorite_ids: [favoriteId] 
      });
      toast.success("Created new betslip");
    } else {
      // Add to first betslip
      const result = await addToBetslip({ 
        betslip_id: betslips[0].id, 
        favorite_ids: [favoriteId] 
      });
      
      if (result.added.length > 0) {
        toast.success(`Added ${playerName} to ${betslips[0].name}`);
      } else if (result.skipped.length > 0) {
        const skip = result.skipped[0];
        toast.warning(
          `${playerName} not added: ${skip.reason}`,
          { duration: 4000 }
        );
      } else if (result.replaced.length > 0) {
        toast.info(
          `Updated ${playerName} to higher line in ${betslips[0].name}`,
          { duration: 4000 }
        );
      }
    }
  }, [betslips, favorites, createBetslip, addToBetslip]);
  
  // Render favorites list
  const renderFavorites = () => (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Header - shows selection mode when 2+ selected */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          {selectedIds.size >= 2 ? (
            <>
              <h2 className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                {selectedIds.size} selected
              </h2>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Clear selection
              </button>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Saved Plays</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {favorites.length} saved play{favorites.length !== 1 ? "s" : ""}
              </p>
            </>
          )}
        </div>
        
        {/* Right side: Sort dropdown or Selection actions */}
        {selectedIds.size >= 2 ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              Add to betslip
            </button>
          </div>
        ) : favorites.length > 1 && (
          <div className="flex items-center gap-3">
            {!isMobile && (
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Drag to add
              </span>
            )}
            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "edge" | "time" | "odds")}
              className="text-[11px] text-neutral-500 dark:text-neutral-400 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="edge">Highest Edge</option>
              <option value="odds">Best Odds</option>
              <option value="time">Recently Added</option>
            </select>
          </div>
        )}
      </div>
      
      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : favorites.length === 0 ? (
        <FavoritesEmptyState />
      ) : (
        <div>
          {sortedFavorites.map((favorite, index) => (
            <FavoriteRow
              key={favorite.id}
              favorite={favorite}
              isSelected={selectedIds.has(favorite.id)}
              selectedIds={selectedIds}
              onToggleSelect={() => toggleSelect(favorite.id)}
              onRemove={() => handleRemove(favorite.id)}
              onAddToBetslip={() => handleAddSingleToBetslip(favorite.id)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              isDragging={dragState.favoriteIds.includes(favorite.id)}
              isMobile={isMobile}
              dragPreviewRef={dragPreviewRef}
              refreshedOdds={refreshedOddsMap.get(favorite.id)}
              priceChange={streamChanges.get(favorite.id)}
              avgPrice={getAvgPrice(favorite)}
            />
          ))}
        </div>
      )}
    </div>
  );
  
  // Render betslips list
  const renderBetslips = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Betslips</h2>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!hasSelection}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            hasSelection
              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
          )}
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>
      
      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : betslips.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <BetslipsEmptyState />
        </div>
      ) : (
        <div className="space-y-3">
          {betslips.map((betslip) => (
            <BetslipCard
              key={betslip.id}
              betslip={betslip}
              onDelete={() => handleDeleteBetslip(betslip.id)}
              onRename={(name) => handleRenameBetslip(betslip.id, name)}
              onQuickCompare={() => handleQuickCompare(betslip.id)}
              onRemoveLeg={(favoriteId) => handleRemoveLegFromBetslip(betslip.id, favoriteId)}
              onFetchOdds={(forceRefresh) => handleFetchSgpOdds(betslip.id, forceRefresh)}
              isFetchingOdds={fetchingBetslipId === betslip.id}
              onDrop={(favoriteIds) => handleDropOnBetslip(betslip.id, favoriteIds)}
              isDropTarget={dragState.isDragging}
              dragCount={dragState.favoriteIds.length}
              refreshedOddsMap={refreshedOddsMap}
              changesMap={streamChanges}
            />
          ))}
        </div>
      )}
    </div>
  );
  
  return (
    <MaxWidthWrapper className="py-6">
      {/* Mobile: Segmented control */}
      {isMobile && (
        <div className="flex p-1 mb-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          <button
            onClick={() => setMobileTab("favorites")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              mobileTab === "favorites"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400"
            )}
          >
            Saved Plays
          </button>
          <button
            onClick={() => setMobileTab("betslips")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              mobileTab === "betslips"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400"
            )}
          >
            Betslips
          </button>
        </div>
      )}
      
      {/* Desktop: Two columns / Mobile: Single column */}
      {isMobile ? (
        <div>
          {mobileTab === "favorites" ? renderFavorites() : renderBetslips()}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Favorites */}
          <div>{renderFavorites()}</div>
          
          {/* Right: Betslips */}
          <div>{renderBetslips()}</div>
        </div>
      )}
      
      {/* Sticky action bar */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900 dark:bg-white rounded-full shadow-lg">
              <span className="text-sm text-white dark:text-neutral-900">
                {selectedCount} selected
              </span>
              <div className="w-px h-4 bg-neutral-700 dark:bg-neutral-300" />
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add to betslip
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 text-neutral-400 hover:text-white dark:hover:text-neutral-900 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Add to betslip modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddToBetslipModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            selectedCount={selectedCount}
            betslips={betslips}
            onAddToExisting={handleAddToExisting}
            onCreateNew={handleCreateNew}
            isLoading={isCreating || isAddingItems}
          />
        )}
      </AnimatePresence>
      
      {/* Custom drag preview for multi-select */}
      <div
        ref={dragPreviewRef}
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none"
        aria-hidden="true"
      >
        <div className="relative">
          {/* Stacked cards effect */}
          <div className="absolute top-1 left-1 w-[200px] h-[52px] bg-neutral-200 dark:bg-neutral-700 rounded-lg opacity-60" />
          <div className="absolute top-0.5 left-0.5 w-[200px] h-[52px] bg-neutral-100 dark:bg-neutral-800 rounded-lg opacity-80" />
          
          {/* Main card */}
          <div className="relative w-[200px] bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-lg px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold" data-drag-count>
                3
              </div>
              <span className="text-sm font-medium text-neutral-900 dark:text-white" data-drag-label>
                3 plays
              </span>
            </div>
          </div>
        </div>
      </div>
    </MaxWidthWrapper>
  );
}
