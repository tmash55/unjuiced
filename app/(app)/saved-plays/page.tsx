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
  onDragStart?: (ids: string[]) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isMobile?: boolean;
  dragPreviewRef?: React.RefObject<HTMLDivElement | null>;
  refreshedOdds?: RefreshedFavoriteOdds | null;
  priceChange?: FavoriteChange | null;
}

function FavoriteRow({ 
  favorite, 
  isSelected, 
  selectedIds,
  onToggleSelect, 
  onRemove, 
  onDragStart,
  onDragEnd,
  isDragging,
  isMobile,
  dragPreviewRef,
  refreshedOdds,
  priceChange,
}: FavoriteRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const savedBestOdds = getBestOdds(favorite.books_snapshot);
  // Use refreshed odds if available, otherwise fall back to saved snapshot
  const bestOdds = refreshedOdds?.best 
    ? { bookId: refreshedOdds.best.book, price: refreshedOdds.best.price }
    : savedBestOdds;
  // Use stream price change if available, otherwise check if odds different from saved
  const oddsChanged = priceChange?.priceDirection || (refreshedOdds?.best && savedBestOdds && refreshedOdds.best.price !== savedBestOdds.price);
  const priceDirection = priceChange?.priceDirection;
  
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
  const sortedBooks = allBookOdds.slice(0, 4);
  const totalBooks = allBookOdds.length;
  const remainingBooks = totalBooks - sortedBooks.length;
  const hasRefreshedOdds = refreshedOdds?.allBooks && Object.keys(refreshedOdds.allBooks).length > 0;
  
  const playerOrTeam = favorite.player_name || favorite.home_team || "Unknown";
  const marketDisplay = formatMarketLabelShort(favorite.market) || favorite.market;
  const lineDisplay = favorite.line !== null ? favorite.line : "";
  const sideDisplay = formatSide(favorite.side);
  const timeLabel = formatFavoriteTime(favorite.start_time || favorite.game_date);
  
  return (
    <div 
      className={cn(
        "border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 group/row transition-opacity",
        isDragging && "opacity-50 bg-emerald-50/50 dark:bg-emerald-900/10"
      )}
      draggable={!isMobile}
      onDragStart={(e) => {
        // If this row is selected, drag all selected items; otherwise just this one
        const idsToTransfer = isSelected && selectedIds.size > 1 
          ? Array.from(selectedIds) 
          : [favorite.id];
        e.dataTransfer.setData("favoriteIds", JSON.stringify(idsToTransfer));
        e.dataTransfer.effectAllowed = "copy";
        
        // Set custom drag image for multi-select
        if (idsToTransfer.length > 1 && dragPreviewRef?.current) {
          // Update the preview content
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
      <div
        className={cn(
          "flex items-start gap-3 px-4 py-3.5 transition-colors",
          isExpanded && "bg-neutral-50/60 dark:bg-neutral-800/30"
        )}
      >
        {/* Drag handle (desktop only) */}
        {!isMobile && (
          <div className="pt-0.5 cursor-grab active:cursor-grabbing text-neutral-300 dark:text-neutral-600 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        
        {/* Checkbox */}
        <div 
          className="pt-0.5"
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
        
        {/* Play info */}
        <div 
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="font-medium text-sm text-neutral-900 dark:text-white truncate">
            {playerOrTeam}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {sideDisplay} {lineDisplay} {marketDisplay}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </div>
        </div>
        
        {/* Best odds + book */}
        {bestOdds && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openBetLink(favorite.books_snapshot?.[bestOdds.bookId]);
            }}
            className={cn(
              "flex flex-col items-end shrink-0 hover:opacity-80 transition-all",
              // Flash animation when price changes
              priceDirection === "up" && "animate-pulse-green",
              priceDirection === "down" && "animate-pulse-amber"
            )}
          >
            <div className="flex items-center gap-1">
              {/* Only show arrows briefly when price changes (from stream), then fade */}
              {priceDirection && (
                <span className={cn(
                  "text-[9px] font-medium px-1 py-0.5 rounded animate-fade-out",
                  priceDirection === "up"
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                )}>
                  {priceDirection === "up" ? "↑" : "↓"}
                </span>
              )}
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatOdds(bestOdds.price)}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {getBookLogo(bestOdds.bookId) && (
                <img 
                  src={getBookLogo(bestOdds.bookId)!} 
                  alt={getBookName(bestOdds.bookId)} 
                  className="h-3.5 w-3.5 object-contain"
                />
              )}
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                {getBookName(bestOdds.bookId)}
              </span>
            </div>
          </button>
        )}
        
        {/* Trash icon - visible on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover/row:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        
        {/* Expand chevron */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 -mr-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      
      {/* Expanded state */}
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
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2 space-y-1">
                <div className="px-2 pt-1 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                    Best available odds
                  </span>
                  {hasRefreshedOdds && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      LIVE
                    </span>
                  )}
                </div>
                {sortedBooks.map(({ bookId, data }) => (
                  <button
                    key={bookId}
                    onClick={() => openBetLink(data)}
                    className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {getBookLogo(bookId) && (
                        <img 
                          src={getBookLogo(bookId)!} 
                          alt={getBookName(bookId)} 
                          className="h-4 w-4 object-contain"
                        />
                      )}
                      <span className="text-xs text-neutral-600 dark:text-neutral-300">
                        {getBookName(bookId)}
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs font-medium",
                      data.price === bestOdds?.price 
                        ? "text-emerald-600 dark:text-emerald-400" 
                        : "text-neutral-600 dark:text-neutral-300"
                    )}>
                      {formatOdds(data.price)}
                    </span>
                  </button>
                ))}
                {remainingBooks > 0 && (
                  <div className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center pt-1">
                    +{remainingBooks} more book{remainingBooks !== 1 ? "s" : ""}
                  </div>
                )}
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
const getSortedSgpOdds = (cache: Record<string, { price?: string; links?: { desktop: string; mobile: string }; error?: string }> | null): BookOddsData[] => {
  if (!cache) return [];
  
  return Object.entries(cache)
    .filter(([, data]) => data.price && !data.error)
    .map(([bookId, data]) => ({
      bookId,
      odds: parseInt(data.price!.replace("+", ""), 10),
      hasDeepLink: !!(data.links?.desktop || data.links?.mobile),
    }))
    .filter(item => !isNaN(item.odds))
    .sort((a, b) => b.odds - a.odds);
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
  
  // Calculate edge (best vs average)
  const edge = useMemo(() => {
    if (bookOdds.length < 2 || !bestOdds) return null;
    return calculateEdge(bestOdds.odds, bookOdds.map(b => b.odds));
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
      {/* Card header */}
      <div
        className={cn(
          "px-4 py-3 cursor-pointer transition-colors",
          isExpanded && "border-b border-neutral-100 dark:border-neutral-800"
        )}
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          {/* Color indicator */}
          <div className={cn("w-1 min-h-[56px] rounded-full self-stretch", getColorClass(betslip.color))} />
          
          {/* Slip info */}
          <div className="flex-1 min-w-0">
            {/* Title row with badge */}
            <div className="flex items-center gap-2">
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
                  className="flex-1 px-2 py-1 -mx-2 -my-1 text-sm font-medium bg-neutral-100 dark:bg-neutral-800 rounded border-none outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              ) : (
                <span className="font-medium text-sm text-neutral-900 dark:text-white truncate">
                  {betslip.name}
                </span>
              )}
              
              {/* SGP/SGP+ Badge */}
              {betTypeInfo && !isEditing && (
                <span 
                  className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  title={betTypeInfo.tooltip}
                >
                  {betTypeInfo.label}
                </span>
              )}
              
              {/* Price uncertainty indicator */}
              {priceUncertain && hasMultipleLegs && !isEditing && (
                <span 
                  className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                  title={hasMarketMovement ? "Market moved - price may have changed" : legsChanged ? "Legs changed - price needs update" : "Price may be outdated"}
                >
                  {isFetchingOdds ? "Confirming..." : hasMarketMovement ? "Market moved" : legsChanged ? "Legs changed" : "Refresh"}
                </span>
              )}
            </div>
            
            {/* Meta row */}
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {legCount} play{legCount !== 1 ? "s" : ""} · Updated {lastUpdated}
            </div>
            
            {/* Inline leg previews (collapsed state only) */}
            {!isExpanded && previewLegs.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {previewLegs.map((fav, i) => (
                  <div key={i} className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                    <span className="text-neutral-400 dark:text-neutral-500">•</span>{" "}
                    {formatLegPreview(fav)}
                  </div>
                ))}
                {remainingLegs > 0 && (
                  <div className="text-xs text-neutral-400 dark:text-neutral-500">
                    +{remainingLegs} more
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right side: Odds + Actions */}
          <div className="flex items-start gap-2 shrink-0">
            {/* Odds display (collapsed only) */}
            {!isExpanded && bestOdds && (
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatOdds(bestOdds.odds)}
                </div>
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 flex items-center justify-end gap-1">
                  {getBookLogo(bestOdds.bookId) && (
                    <img 
                      src={getBookLogo(bestOdds.bookId)!} 
                      alt="" 
                      className="h-3 w-3 object-contain"
                    />
                  )}
                  {getBookName(bestOdds.bookId)}
                </div>
                {/* Edge indicator */}
                {edge !== null && edge >= 5 && (
                  <div className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-0.5">
                    ▲ +{edge.toFixed(0)}% vs avg
                  </div>
                )}
              </div>
            )}
            
            {/* CTA button (collapsed only) */}
            {!isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors flex items-center gap-1"
              >
                Open
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-0.5">
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
              
              {/* Expand chevron with rotation */}
              <motion.button 
                className="p-1 text-neutral-400"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>
        
        {/* Book availability (collapsed only, when we have data) */}
        {!isExpanded && totalAvailableBooks > 0 && (
          <div className="mt-2 ml-4 text-[10px] text-neutral-400 dark:text-neutral-500">
            Available at{" "}
            {top3Books.slice(0, 3).map((book, i) => (
              <span key={book.bookId}>
                {i > 0 && " · "}
                {getBookName(book.bookId)}
              </span>
            ))}
            {totalAvailableBooks > 3 && ` +${totalAvailableBooks - 3} more`}
          </div>
        )}
      </div>
      
      {/* Expanded content */}
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
              
              {/* ═══════════════════════════════════════════════════════════════
                  ZONE 1: PARLAY ODDS
                  ═══════════════════════════════════════════════════════════════ */}
              {hasMultipleLegs && (
                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
                  {/* Section header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
                        Parlay Odds
                      </span>
                      {edge !== null && edge >= 5 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                          +{edge.toFixed(0)}% edge
                        </span>
                      )}
                      {/* Price uncertainty badge */}
                      {priceUncertain && (
                        <span 
                          className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                          title="Price may have changed since last confirmation"
                        >
                          {hasMarketMovement ? "Market moved" : legsChanged ? "Legs changed" : "May have changed"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Last confirmed time */}
                      {oddsUpdatedAgo && (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                          Confirmed {oddsUpdatedAgo}
                        </span>
                      )}
                      {/* Refresh button */}
                      {isFetchingOdds ? (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Confirming...
                        </span>
                      ) : (
                        <button
                          onClick={handleRefreshOdds}
                          className={cn(
                            "text-[10px] font-medium transition-colors",
                            priceUncertain 
                              ? "text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300" 
                              : "text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                          )}
                        >
                          {priceUncertain ? "Confirm price" : "Refresh"}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {bookOdds.length > 0 ? (
                    <>
                      {/* Book rows */}
                      <div className="space-y-1">
                        {(showAllBooks ? bookOdds : top3Books).map((book, i) => {
                          const isBest = i === 0;
                          const isAfterTop3 = i === 3;
                          return (
                            <div key={book.bookId}>
                              {/* Divider after top 3 when showing all */}
                              {isAfterTop3 && (
                                <div className="border-t border-neutral-200 dark:border-neutral-700 my-2" />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openBookLink(book.bookId);
                                }}
                                className={cn(
                                  "flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all group",
                                  isBest 
                                    ? "bg-emerald-100/80 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shadow-sm" 
                                    : "hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
                                )}
                              >
                                <div className="flex items-center gap-2.5">
                                  {getBookLogo(book.bookId) ? (
                                    <img 
                                      src={getBookLogo(book.bookId)!} 
                                      alt="" 
                                      className={cn("object-contain", isBest ? "h-6 w-6" : "h-5 w-5")}
                                    />
                                  ) : (
                                    <div className={cn("rounded bg-neutral-200 dark:bg-neutral-700", isBest ? "h-6 w-6" : "h-5 w-5")} />
                                  )}
                                  <span className={cn(
                                    "text-neutral-900 dark:text-white",
                                    isBest ? "text-sm font-medium" : "text-sm"
                                  )}>
                                    {getBookName(book.bookId)}
                                  </span>
                                  {isBest && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500 text-white uppercase">
                                      Best
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "font-semibold tabular-nums",
                                    isBest ? "text-base text-emerald-600 dark:text-emerald-400" : "text-sm text-neutral-600 dark:text-neutral-300"
                                  )}>
                                    {formatOdds(book.odds)}
                                  </span>
                                  <ExternalLink className={cn(
                                    "transition-opacity",
                                    isBest ? "h-4 w-4 text-emerald-500 opacity-60 group-hover:opacity-100" : "h-3.5 w-3.5 text-neutral-400 opacity-0 group-hover:opacity-100"
                                  )} />
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Footer: View all / Not available */}
                      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                        {totalAvailableBooks > 3 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAllBooks(!showAllBooks);
                            }}
                            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            {showAllBooks ? "Show less" : `View all (${totalAvailableBooks})`}
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
                    <div className="text-center py-4">
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        No parlay odds available
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                        Try refreshing or check individual leg odds
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════
                  ZONE 2: LEGS
                  ═══════════════════════════════════════════════════════════════ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
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
                          className="flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-neutral-900 dark:text-white">
                              {fav.player_name || fav.home_team || "Unknown"}
                            </span>
                            <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-2">
                              {formatSide(fav.side)}{fav.line} {formatMarketLabelShort(fav.market) || fav.market}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveLeg(fav.id);
                            }}
                            className="p-1.5 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-6">
                    No plays in this betslip
                  </p>
                )}
              </div>
              
              {/* ═══════════════════════════════════════════════════════════════
                  ZONE 3: ACTIONS
                  ═══════════════════════════════════════════════════════════════ */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex gap-2">
                  {/* Primary: Compare (disabled if no odds) */}
                  {hasMultipleLegs && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (bookOdds.length > 0) onQuickCompare();
                      }}
                      disabled={bookOdds.length === 0}
                      title={bookOdds.length === 0 ? "No parlay odds available" : undefined}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                        bookOdds.length > 0 
                          ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm" 
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                      )}
                    >
                      <BarChart3 className="h-4 w-4" />
                      Compare odds
                    </button>
                  )}
                  
                  {/* Secondary: Copy */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopySlip();
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 active:bg-neutral-100 dark:active:bg-neutral-700 transition-all",
                      !hasMultipleLegs && "flex-1"
                    )}
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  
                  {/* Secondary: Share */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare();
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 active:bg-neutral-100 dark:active:bg-neutral-700 transition-all"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
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
    await addToBetslip({
      betslip_id: betslipId,
      favorite_ids: Array.from(selectedIds),
    });
    toast.success(`Added ${selectedCount} play${selectedCount !== 1 ? "s" : ""} to ${slip?.name || "betslip"}`);
    setSelectedIds(new Set());
    setShowAddModal(false);
    
    // Fetch SGP odds for the updated betslip (if it now has 2+ legs)
    const newLegCount = (slip?.items?.length || 0) + selectedCount;
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
    
    await addToBetslip({
      betslip_id: betslipId,
      favorite_ids: favoriteIds,
    });
    
    const count = favoriteIds.length;
    if (count === 1) {
      const fav = favorites.find(f => f.id === favoriteIds[0]);
      const playerName = fav?.player_name || fav?.home_team || "Play";
      toast.success(`Added ${playerName} to ${slip?.name || "betslip"}`);
    } else {
      toast.success(`Added ${count} plays to ${slip?.name || "betslip"}`);
    }
    
    // Clear selection after drop
    setSelectedIds(new Set());
    
    // Fetch SGP odds for the updated betslip (if it now has 2+ legs)
    const newLegCount = (slip?.items?.length || 0) + favoriteIds.length;
    if (newLegCount >= 2) {
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
  
  // Render favorites list
  const renderFavorites = () => (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Saved Plays</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {favorites.length} saved play{favorites.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!isMobile && favorites.length > 0 && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Drag to add to betslip
          </p>
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
          {favorites.map((favorite) => (
            <FavoriteRow
              key={favorite.id}
              favorite={favorite}
              isSelected={selectedIds.has(favorite.id)}
              selectedIds={selectedIds}
              onToggleSelect={() => toggleSelect(favorite.id)}
              onRemove={() => handleRemove(favorite.id)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              isDragging={dragState.favoriteIds.includes(favorite.id)}
              isMobile={isMobile}
              dragPreviewRef={dragPreviewRef}
              refreshedOdds={refreshedOddsMap.get(favorite.id)}
              priceChange={streamChanges.get(favorite.id)}
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
