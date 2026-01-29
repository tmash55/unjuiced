"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useFavorites, Favorite, BookSnapshot } from "@/hooks/use-favorites";
import { useBetslips, Betslip } from "@/hooks/use-betslips";
import { useIsMobile } from "@/hooks/use-media-query";
import { useSgpQuoteStream, favoritesToSgpLegs, SgpBookOdds } from "@/hooks/use-sgp-quote-stream";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabelShort } from "@/lib/data/markets";
import { Tooltip } from "@/components/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  X,
  Globe,
  ChevronRight,
  Heart,
  MoreVertical,
  Trash2,
  ArrowRight,
  Search,
  Plus,
  Layers,
  BarChart3,
  ExternalLink,
  Loader2,
  Share2,
  Copy,
  Check,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { HeartFill } from "@/components/icons/heart-fill";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ============================================================================
// TYPES
// ============================================================================

type ActionView = 
  | "list"           // Default favorites list
  | "quick-add"      // Shortcut when user has exactly 1 betslip
  | "action-chooser" // The 3 options
  | "select-slip"    // Existing betslip selector
  | "new-slip"       // Create new betslip form
  | "compare";       // Quick compare view

interface SgpOddsResult {
  price?: string;
  links?: { desktop: string; mobile: string };
  limits?: { max?: number; min?: number };
  error?: string;
  legsSupported?: number;
  totalLegs?: number;
}

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

const openBetLink = (snapshot: BookSnapshot | undefined) => {
  if (!snapshot) return;
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
  const link = isMobile ? (snapshot.m || snapshot.u) : (snapshot.u || snapshot.m);
  if (link) window.open(link, "_blank");
};

const openSgpLink = (links?: { desktop?: string; mobile?: string } | null, bookId?: string) => {
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
  
  // Try API links first
  let link = links ? (isMobile ? (links.mobile || links.desktop) : (links.desktop || links.mobile)) : null;
  
  // Fallback to sportsbook default links if no API link
  if (!link && bookId) {
    const sportsbook = getSportsbookById(bookId);
    if (sportsbook?.links) {
      link = isMobile ? (sportsbook.links.mobile || sportsbook.links.desktop) : (sportsbook.links.desktop || sportsbook.links.mobile);
    }
  }
  
  if (link) {
    window.open(link, "_blank", "noopener,noreferrer");
  }
};

// Check if we have direct SGP links (not just fallback)
const hasSgpLink = (links?: { desktop?: string; mobile?: string } | null): boolean => {
  return !!(links?.desktop || links?.mobile);
};

// Get best book and odds from snapshot
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

// Get sorted books by price (best first)
const getSortedBooks = (snapshot: Record<string, BookSnapshot> | null, limit = 4): Array<{ bookId: string; data: BookSnapshot }> => {
  if (!snapshot) return [];
  return Object.entries(snapshot)
    .filter(([_, data]) => data.price)
    .sort((a, b) => b[1].price - a[1].price)
    .slice(0, limit)
    .map(([bookId, data]) => ({ bookId, data }));
};

// Get books that have SGP tokens for all selected favorites
const getBooksWithSgpSupport = (favorites: Favorite[]): { full: string[]; partial: Map<string, number> } => {
  if (favorites.length === 0) return { full: [], partial: new Map() };
  
  // Get all books that have SGP tokens for each favorite
  const bookSets = favorites.map(f => {
    const books = new Set<string>();
    if (f.books_snapshot) {
      Object.entries(f.books_snapshot).forEach(([bookId, data]) => {
        if (data.sgp) books.add(bookId);
      });
    }
    return books;
  });
  
  // Find books that appear in all sets (full support)
  const allBooks = new Set<string>();
  bookSets.forEach(set => set.forEach(book => allBooks.add(book)));
  
  const full: string[] = [];
  const partial = new Map<string, number>();
  
  allBooks.forEach(book => {
    const count = bookSets.filter(set => set.has(book)).length;
    if (count === favorites.length) {
      full.push(book);
    } else if (count > 0) {
      partial.set(book, count);
    }
  });
  
  return { full, partial };
};

// Auto-suggest betslip name based on selected favorites
const suggestBetslipName = (favorites: Favorite[]): string => {
  const sports = new Set(favorites.map(f => f.sport?.toUpperCase()));
  const sportLabel = sports.size === 1 ? [...sports][0] : "Mixed";
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${sportLabel} - ${date}`;
};

// ============================================================================
// FAVORITE ROW COMPONENT
// ============================================================================

interface FavoriteRowProps {
  favorite: Favorite;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
}

function FavoriteRow({ favorite, isSelected, onToggleSelect, onRemove }: FavoriteRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const bestOdds = getBestOdds(favorite.books_snapshot);
  const sortedBooks = getSortedBooks(favorite.books_snapshot, 4);
  const totalBooks = favorite.books_snapshot ? Object.keys(favorite.books_snapshot).filter(k => favorite.books_snapshot![k].price).length : 0;
  const remainingBooks = totalBooks - sortedBooks.length;
  
  // Format display
  const playerOrTeam = favorite.player_name || favorite.home_team || "Unknown";
  const marketDisplay = formatMarketLabelShort(favorite.market) || favorite.market;
  const lineDisplay = favorite.line !== null ? favorite.line : "";
  const sideDisplay = formatSide(favorite.side);
  const timeLabel = formatFavoriteTime(favorite.start_time || favorite.game_date);
  
  return (
    <div className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 group/row">
      {/* Main row - collapsed state */}
      <div
        className={cn(
          "flex items-start gap-3 px-4 py-3 transition-colors",
          isExpanded && "bg-neutral-50/60 dark:bg-neutral-800/30"
        )}
      >
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
            className="flex flex-col items-end shrink-0 hover:opacity-80 transition-opacity"
          >
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {formatOdds(bestOdds.price)}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {getBookLogo(bestOdds.bookId) ? (
                <img 
                  src={getBookLogo(bestOdds.bookId)!} 
                  alt={getBookName(bestOdds.bookId)} 
                  className="h-3.5 w-3.5 object-contain"
                />
              ) : null}
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
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
      
      {/* Expanded state - other books */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pl-11">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2 space-y-1">
                <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  Best available odds
                </div>
                {sortedBooks.map(({ bookId, data }) => (
                  <button
                    key={bookId}
                    onClick={() => openBetLink(data)}
                    className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {getBookLogo(bookId) ? (
                        <img 
                          src={getBookLogo(bookId)!} 
                          alt={getBookName(bookId)} 
                          className="h-4 w-4 object-contain"
                        />
                      ) : null}
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
                
                {/* Remove action */}
                <button
                  onClick={onRemove}
                  className="flex items-center justify-center gap-1 w-full mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <Heart className="h-6 w-6 text-neutral-400" />
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
        No favorites yet
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-[200px]">
        Tap the heart on any play to save it here
      </p>
      <Link
        href="/today"
        onClick={onClose}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Search className="h-4 w-4" />
        Find Plays
      </Link>
    </div>
  );
}

// ============================================================================
// QUICK ADD PANEL - Shortcut when user has exactly 1 betslip
// ============================================================================

interface QuickAddPanelProps {
  betslipName: string;
  selectedCount: number;
  onQuickAdd: () => void;
  onMoreOptions: () => void;
  onBack: () => void;
  isLoading: boolean;
}

function QuickAddPanel({ betslipName, selectedCount, onQuickAdd, onMoreOptions, onBack, isLoading }: QuickAddPanelProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header with back button */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <button 
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      
      <div className="flex-1 px-4 py-6">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
          Add to "{betslipName}"?
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
          {selectedCount} play{selectedCount !== 1 ? "s" : ""} selected
        </p>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onQuickAdd}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add"
            )}
          </button>
          <button
            onClick={onMoreOptions}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            More options
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACTION PANEL - The 3 options chooser
// ============================================================================

interface ActionPanelProps {
  selectedCount: number;
  hasBetslips: boolean;
  onSelectExisting: () => void;
  onCreateNew: () => void;
  onCompare: () => void;
  onBack: () => void;
}

function ActionPanel({ selectedCount, hasBetslips, onSelectExisting, onCreateNew, onCompare, onBack }: ActionPanelProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header with back button */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <button 
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      
      <div className="flex-1 px-4 py-6">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
          Next step
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
          {selectedCount} play{selectedCount !== 1 ? "s" : ""} selected
        </p>
        
        <div className="space-y-2">
          {/* Compare odds & bet now - PRIMARY action, moved to top */}
          <button
            onClick={onCompare}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Compare odds & bet now
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-emerald-500" />
          </button>
          
          {/* Add to existing betslip */}
          {hasBetslips && (
            <button
              onClick={onSelectExisting}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                  Add to existing betslip
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-400" />
            </button>
          )}
          
          {/* Create new betslip */}
          <button
            onClick={onCreateNew}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-neutral-400" />
              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                Create new betslip
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BETSLIP SELECTOR
// ============================================================================

interface BetslipSelectorProps {
  betslips: Betslip[];
  selectedCount: number;
  onSelect: (betslipId: string) => void;
  onBack: () => void;
  isLoading: boolean;
}

function BetslipSelector({ betslips, selectedCount, onSelect, onBack, isLoading }: BetslipSelectorProps) {
  const [selectedSlipId, setSelectedSlipId] = useState<string | null>(null);
  
  return (
    <div className="flex-1 flex flex-col">
      {/* Header with back button */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <button 
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">
          Select a betslip
        </h3>
        
        <div className="space-y-2">
          {betslips.map((slip) => (
            <button
              key={slip.id}
              onClick={() => setSelectedSlipId(slip.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors",
                selectedSlipId === slip.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                selectedSlipId === slip.id
                  ? "border-emerald-500"
                  : "border-neutral-300 dark:border-neutral-600"
              )}>
                {selectedSlipId === slip.id && (
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                  {slip.name}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">
                  ({slip.legs_count || 0} play{(slip.legs_count || 0) !== 1 ? "s" : ""})
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <button
          onClick={() => selectedSlipId && onSelect(selectedSlipId)}
          disabled={!selectedSlipId || isLoading}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
            selectedSlipId && !isLoading
              ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            `Add ${selectedCount} play${selectedCount !== 1 ? "s" : ""} to slip`
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// NEW BETSLIP FORM
// ============================================================================

interface NewBetslipFormProps {
  suggestedName: string;
  selectedCount: number;
  onCreate: (name: string) => void;
  onBack: () => void;
  isLoading: boolean;
}

function NewBetslipForm({ suggestedName, selectedCount, onCreate, onBack, isLoading }: NewBetslipFormProps) {
  const [name, setName] = useState(suggestedName);
  
  return (
    <div className="flex-1 flex flex-col">
      {/* Header with back button */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <button 
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      
      <div className="flex-1 px-4 py-6">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">
          Create new betslip
        </h3>
        
        <div>
          <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
            Slip name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Betslip"
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <button
          onClick={() => onCreate(name || "My Betslip")}
          disabled={isLoading}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
            !isLoading
              ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            `Create & add ${selectedCount} play${selectedCount !== 1 ? "s" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// QUICK COMPARE PANEL
// ============================================================================

interface QuickComparePanelProps {
  selectedFavorites: Favorite[];
  compareOdds: Record<string, SgpOddsResult>;
  isLoading: boolean;
  isStreaming: boolean;
  booksPending: string[];
  onBack: () => void;
  onRetry?: () => void;
  fromCache?: boolean;
}

function QuickComparePanel({ 
  selectedFavorites, 
  compareOdds, 
  isLoading, 
  isStreaming,
  booksPending,
  onBack,
  onRetry,
  fromCache,
}: QuickComparePanelProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showLegs, setShowLegs] = useState(false);
  const [copied, setCopied] = useState(false);
  const totalLegs = selectedFavorites.length;
  
  // Filter and sort: only books with valid odds, sorted by best odds descending
  const validBooks = useMemo(() => {
    return Object.entries(compareOdds)
      .map(([bookId, result]) => ({ bookId, ...result }))
      .filter(b => b.price && !b.error)
      .sort((a, b) => {
        if (a.price && b.price) {
          return parseInt(b.price) - parseInt(a.price);
        }
        return 0;
      });
  }, [compareOdds]);
  
  // Books with errors (for collapsed footer)
  const errorBooks = useMemo(() => {
    return Object.entries(compareOdds)
      .map(([bookId, result]) => ({ bookId, ...result }))
      .filter(b => b.error || !b.price);
  }, [compareOdds]);
  
  // Get best price and books that have it
  const bestPriceInfo = useMemo(() => {
    if (validBooks.length === 0) return null;
    const bestPrice = validBooks[0].price;
    const bestPriceNum = parseInt(bestPrice || "0");
    const booksWithBest = validBooks.filter(b => parseInt(b.price || "0") === bestPriceNum);
    return {
      price: bestPrice,
      bookIds: booksWithBest.map(b => b.bookId),
      bookNames: booksWithBest.map(b => getBookName(b.bookId)),
    };
  }, [validBooks]);
  
  // Separate best tier books from rest
  const { bestTierBooks, otherBooks } = useMemo(() => {
    if (!bestPriceInfo) return { bestTierBooks: [], otherBooks: validBooks };
    const bestSet = new Set(bestPriceInfo.bookIds);
    return {
      bestTierBooks: validBooks.filter(b => bestSet.has(b.bookId)),
      otherBooks: validBooks.filter(b => !bestSet.has(b.bookId)),
    };
  }, [validBooks, bestPriceInfo]);
  
  // Generate share text
  const shareText = useMemo(() => {
    if (!bestPriceInfo) return "";
    const bestBookName = bestPriceInfo.bookNames[0];
    
    // Format each leg
    const legsText = selectedFavorites.map(fav => {
      const name = fav.player_name || fav.home_team || "Unknown";
      const market = formatMarketLabelShort(fav.market) || fav.market;
      return `• ${name} ${formatSide(fav.side)} ${fav.line} ${market}`;
    }).join("\n");
    
    return `${totalLegs}-leg combo\n\n${legsText}\n\nBest odds: ${formatOdds(bestPriceInfo.price)} (${bestBookName})\nvia unjuiced.bet`;
  }, [totalLegs, bestPriceInfo, selectedFavorites]);
  
  // Copy text to clipboard
  const handleCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
      setShowShareMenu(false);
    } catch {
      toast.error("Failed to copy");
    }
  }, [shareText]);
  
  return (
    <div className="flex-1 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {totalLegs}-leg combo
              </h3>
            </div>
          </div>
          
          {/* Right: Share + View legs */}
          <div className="flex items-center gap-1">
            {/* View legs toggle */}
            <button
              onClick={() => setShowLegs(!showLegs)}
              className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              {showLegs ? "Hide legs" : "View legs"}
            </button>
            
            {/* Share dropdown */}
            <Tooltip content="Share" side="bottom">
              <DropdownMenu open={showShareMenu} onOpenChange={setShowShareMenu}>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                    <Share2 className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleCopyText}>
                    {copied ? (
                      <Check className="h-4 w-4 mr-2 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy text
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="opacity-50">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Share image
                    <span className="ml-auto text-[10px] text-neutral-400">Soon</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Tooltip>
          </div>
        </div>
        
        {/* Collapsible legs list */}
        <AnimatePresence>
          {showLegs && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1">
                {selectedFavorites.map((fav) => (
                  <div key={fav.id} className="text-xs text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {fav.player_name || fav.home_team || "Unknown"}
                    </span>
                    {" · "}
                    {formatSide(fav.side)} {fav.line} {formatMarketLabelShort(fav.market) || fav.market}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && !isStreaming && Object.keys(compareOdds).length === 0 ? (
          // Initial loading state with skeleton
          <div className="px-4 py-6">
            <div className="flex items-center gap-2 mb-6">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              <span className="text-sm text-neutral-500">Fetching parlay odds...</span>
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-20 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : validBooks.length === 0 && !isStreaming && booksPending.length === 0 ? (
          // No books available
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
              <BarChart3 className="h-5 w-5 text-neutral-400" />
            </div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              No books currently support this combo
            </p>
            <button
              onClick={onBack}
              className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Modify selection
            </button>
          </div>
        ) : (
          <div className="px-4 py-4">
            {/* Best price callout (only if more than 1 book) */}
            {bestPriceInfo && validBooks.length > 1 && (
              <div className="mb-4 text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Best price: </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatOdds(bestPriceInfo.price)}
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {" "}({bestPriceInfo.bookNames.join(", ")})
                </span>
              </div>
            )}
            
            {/* Best tier books */}
            {bestTierBooks.length > 0 && (
              <div className="space-y-2">
                {bestTierBooks.map(({ bookId, price, links }, index) => (
                  <div
                    key={bookId}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getBookLogo(bookId) ? (
                        <img 
                          src={getBookLogo(bookId)!} 
                          alt={getBookName(bookId)} 
                          className="h-6 w-6 object-contain"
                        />
                      ) : null}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-white">
                          {getBookName(bookId)}
                        </span>
                        {/* Only show "Best" pill on first row */}
                        {index === 0 && validBooks.length > 1 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            Best
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        openSgpLink(links, bookId);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                        hasSgpLink(links)
                          ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white"
                          : "bg-neutral-200 hover:bg-neutral-300 active:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:active:bg-neutral-500 text-neutral-600 dark:text-neutral-300"
                      )}
                    >
                      {formatOdds(price)}
                      {hasSgpLink(links) ? (
                        <ExternalLink className="h-3.5 w-3.5" />
                      ) : (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Divider between best and other books */}
            {bestTierBooks.length > 0 && otherBooks.length > 0 && (
              <div className="my-3 border-t border-neutral-100 dark:border-neutral-800" />
            )}
            
            {/* Other books */}
            {otherBooks.length > 0 && (
              <div className="space-y-2">
                {otherBooks.map(({ bookId, price, links }) => (
                  <div
                    key={bookId}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getBookLogo(bookId) ? (
                        <img 
                          src={getBookLogo(bookId)!} 
                          alt={getBookName(bookId)} 
                          className="h-6 w-6 object-contain"
                        />
                      ) : null}
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {getBookName(bookId)}
                      </span>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        openSgpLink(links, bookId);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                        hasSgpLink(links)
                          ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white"
                          : "bg-neutral-200 hover:bg-neutral-300 active:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:active:bg-neutral-500 text-neutral-600 dark:text-neutral-300"
                      )}
                    >
                      {formatOdds(price)}
                      {hasSgpLink(links) ? (
                        <ExternalLink className="h-3.5 w-3.5" />
                      ) : (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pending books skeleton (streaming state) */}
            {booksPending.length > 0 && (
              <div className="space-y-2 mt-2">
                {validBooks.length > 0 && (
                  <div className="my-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isStreaming ? (
                        <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-amber-400" />
                      )}
                      <span className="text-xs text-neutral-400">
                        {isStreaming 
                          ? `Still loading ${booksPending.length} book${booksPending.length !== 1 ? "s" : ""}...`
                          : `${booksPending.length} book${booksPending.length !== 1 ? "s" : ""} timed out`
                        }
                      </span>
                    </div>
                    {!isStreaming && onRetry && (
                      <button 
                        onClick={onRetry}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                  </div>
                )}
                {booksPending.map(bookId => (
                  <div
                    key={bookId}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-lg border bg-neutral-50/50 dark:bg-neutral-800/30",
                      isStreaming 
                        ? "border-neutral-200 dark:border-neutral-700" 
                        : "border-amber-200 dark:border-amber-800/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {getBookLogo(bookId) ? (
                        <img 
                          src={getBookLogo(bookId)!} 
                          alt={getBookName(bookId)} 
                          className="h-6 w-6 object-contain opacity-50"
                        />
                      ) : (
                        <div className="h-6 w-6 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                      )}
                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                        {getBookName(bookId)}
                      </span>
                    </div>
                    {isStreaming ? (
                      <div className="h-8 w-20 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">Timed out</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Collapsed error footer */}
            {errorBooks.length > 0 && !isStreaming && (
              <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
                No odds found at: {errorBooks.map(b => getBookName(b.bookId)).join(" · ")}
              </p>
            )}
            
            {/* Cache indicator */}
            {fromCache && !isStreaming && (
              <div className="mt-4 flex items-center justify-between text-xs text-neutral-400">
                <span>Cached result</span>
                {onRetry && (
                  <button 
                    onClick={onRetry}
                    className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer with back button */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <button
          onClick={onBack}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to selection
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DRAWER COMPONENT
// ============================================================================

interface FavoritesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FavoritesDrawer({ open, onOpenChange }: FavoritesDrawerProps) {
  const router = useRouter();
  const { favorites, removeFavorite, isLoading } = useFavorites();
  const { betslips, addToBetslip, createBetslip } = useBetslips();
  const isMobile = useIsMobile();
  
  // View state
  const [actionView, setActionView] = useState<ActionView>("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  
  // SGP Quote streaming hook
  const {
    quotes: compareOdds,
    isLoading: isLoadingCompare,
    isStreaming,
    booksPending,
    fromCache,
    fetchQuotes,
    reset: resetCompareOdds,
  } = useSgpQuoteStream();
  
  // Get selected favorites
  const selectedFavorites = useMemo(() => {
    return favorites.filter(f => selectedIds.has(f.id));
  }, [favorites, selectedIds]);
  
  // Reset state when drawer closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setSelectedIds(new Set());
      setActionView("list");
      resetCompareOdds();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, resetCompareOdds]);
  
  // Pre-warm cache when 2+ favorites are selected
  const preWarmRef = useRef<boolean>(false);
  const prevSelectedCountRef = useRef<number>(0);
  
  useEffect(() => {
    const currentCount = selectedFavorites.length;
    const prevCount = prevSelectedCountRef.current;
    prevSelectedCountRef.current = currentCount;
    
    // Pre-warm when selection grows to 2 or more
    if (currentCount >= 2 && prevCount < 2 && !preWarmRef.current) {
      preWarmRef.current = true;
      
      const { full: booksWithFullSupport } = getBooksWithSgpSupport(selectedFavorites);
      if (booksWithFullSupport.length > 0) {
        // Convert to legs and fetch in background (prefetch mode)
        const legs = favoritesToSgpLegs(selectedFavorites);
        // Only fetch top 5 priority books for pre-warming
        const priorityBooks = booksWithFullSupport.slice(0, 5);
        fetchQuotes(legs, priorityBooks, true).catch(() => {
          // Ignore prefetch errors
        });
      }
    }
    
    // Reset prewarm flag when selection drops below 2
    if (currentCount < 2) {
      preWarmRef.current = false;
    }
  }, [selectedFavorites, fetchQuotes]);
  
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
    const favorite = favorites.find(f => f.id === id);
    const playerName = favorite?.player_name || favorite?.home_team || "Play";
    
    try {
      await removeFavorite(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      
      toast.success(`Removed ${playerName}`);
    } catch (err) {
      console.error("Failed to remove favorite:", err);
      toast.error("Failed to remove");
    }
  }, [removeFavorite, favorites]);
  
  // Add to existing betslip
  const handleAddToExisting = useCallback(async (betslipId: string) => {
    setIsProcessing(true);
    try {
      const slip = betslips.find(b => b.id === betslipId);
      await addToBetslip({
        betslip_id: betslipId,
        favorite_ids: Array.from(selectedIds),
      });
      
      toast.success(`Added ${selectedIds.size} play${selectedIds.size !== 1 ? "s" : ""} to ${slip?.name || "betslip"}`, {
        action: {
          label: "View",
          onClick: () => router.push("/favorites"),
        },
      });
      
      setSelectedIds(new Set());
      setActionView("list");
      handleOpenChange(false);
    } catch (err) {
      console.error("Failed to add to betslip:", err);
      toast.error("Failed to add to betslip");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, betslips, addToBetslip, handleOpenChange, router]);
  
  // Create new betslip
  const handleCreateNew = useCallback(async (name: string) => {
    setIsProcessing(true);
    try {
      await createBetslip({
        name,
        favorite_ids: Array.from(selectedIds),
      });
      
      toast.success(`Created "${name}" with ${selectedIds.size} play${selectedIds.size !== 1 ? "s" : ""}`, {
        action: {
          label: "View",
          onClick: () => router.push("/favorites"),
        },
      });
      
      setSelectedIds(new Set());
      setActionView("list");
      handleOpenChange(false);
    } catch (err) {
      console.error("Failed to create betslip:", err);
      toast.error("Failed to create betslip");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, createBetslip, handleOpenChange, router]);
  
  // Fetch SGP odds for compare using streaming endpoint
  const fetchCompareOdds = useCallback(async () => {
    if (selectedFavorites.length < 2) {
      toast.error("Select at least 2 plays to compare parlay odds");
      return;
    }
    
    const { full: booksWithFullSupport } = getBooksWithSgpSupport(selectedFavorites);
    
    if (booksWithFullSupport.length === 0) {
      toast.error("No sportsbooks support all selected legs as a parlay");
      return;
    }
    
    // Convert favorites to SGP legs format
    const legs = favoritesToSgpLegs(selectedFavorites);
    
    // Fetch using streaming hook
    await fetchQuotes(legs, booksWithFullSupport);
  }, [selectedFavorites, fetchQuotes]);
  
  // Handle compare view navigation
  const handleGoToCompare = useCallback(() => {
    setActionView("compare");
    fetchCompareOdds();
  }, [fetchCompareOdds]);
  
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const hasBetslips = betslips.length > 0;
  
  // Determine if we should show quick-add shortcut (exactly 1 betslip)
  const singleBetslip = betslips.length === 1 ? betslips[0] : null;
  
  // Handle Continue button - decide between quick-add and action-chooser
  const handleContinue = useCallback(() => {
    if (singleBetslip) {
      setActionView("quick-add");
    } else {
      setActionView("action-chooser");
    }
  }, [singleBetslip]);
  
  // Render content based on view
  const renderContent = () => {
    switch (actionView) {
      case "quick-add":
        return singleBetslip ? (
          <QuickAddPanel
            betslipName={singleBetslip.name}
            selectedCount={selectedCount}
            onQuickAdd={() => handleAddToExisting(singleBetslip.id)}
            onMoreOptions={() => setActionView("action-chooser")}
            onBack={() => setActionView("list")}
            isLoading={isProcessing}
          />
        ) : null;
      
      case "action-chooser":
        return (
          <ActionPanel
            selectedCount={selectedCount}
            hasBetslips={hasBetslips}
            onSelectExisting={() => setActionView("select-slip")}
            onCreateNew={() => setActionView("new-slip")}
            onCompare={handleGoToCompare}
            onBack={() => setActionView("list")}
          />
        );
      
      case "select-slip":
        return (
          <BetslipSelector
            betslips={betslips}
            selectedCount={selectedCount}
            onSelect={handleAddToExisting}
            onBack={() => setActionView("action-chooser")}
            isLoading={isProcessing}
          />
        );
      
      case "new-slip":
        return (
          <NewBetslipForm
            suggestedName={suggestBetslipName(selectedFavorites)}
            selectedCount={selectedCount}
            onCreate={handleCreateNew}
            onBack={() => setActionView("action-chooser")}
            isLoading={isProcessing}
          />
        );
      
      case "compare":
        return (
          <QuickComparePanel
            selectedFavorites={selectedFavorites}
            compareOdds={compareOdds}
            isLoading={isLoadingCompare}
            isStreaming={isStreaming}
            booksPending={booksPending}
            fromCache={fromCache}
            onBack={() => {
              resetCompareOdds();
              setActionView("action-chooser");
            }}
            onRetry={fetchCompareOdds}
          />
        );
      
      default:
        return (
          <>
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-300 border-t-neutral-600" />
                </div>
              ) : favorites.length === 0 ? (
                <EmptyState onClose={() => handleOpenChange(false)} />
              ) : (
                <div>
                  {favorites.map((favorite) => (
                    <FavoriteRow
                      key={favorite.id}
                      favorite={favorite}
                      isSelected={selectedIds.has(favorite.id)}
                      onToggleSelect={() => toggleSelect(favorite.id)}
                      onRemove={() => handleRemove(favorite.id)}
                    />
                  ))}
                </div>
              )}
            </div>
            
            {/* Sticky Action Bar */}
            {favorites.length > 0 && (
              <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
                {hasSelection && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 text-center">
                    {selectedCount} selected
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleContinue}
                    disabled={!hasSelection}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                      hasSelection
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                    )}
                  >
                    Continue
                  </button>
                  
                  <Link
                    href="/favorites"
                    onClick={() => handleOpenChange(false)}
                    className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    View All
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </>
        );
    }
  };
  
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent 
        side={isMobile ? "bottom" : "right"}
        hideCloseButton
        className={cn(
          "p-0 flex flex-col",
          isMobile 
            ? "h-[85vh] max-h-[85vh] rounded-t-2xl" 
            : "w-full sm:w-[400px] sm:max-w-[400px]"
        )}
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          </div>
        )}
        
        {/* Header - only show on list view */}
        {actionView === "list" && (
          <SheetHeader className={cn(
            "px-4 border-b border-neutral-200 dark:border-neutral-800",
            isMobile ? "py-3" : "py-4"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-lg font-semibold">Favorites</SheetTitle>
                {favorites.length > 0 && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {favorites.length} saved play{favorites.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {favorites.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-500 focus:text-red-500"
                        onClick={() => {
                          favorites.forEach(f => removeFavorite(f.id));
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <SheetClose asChild>
                  <button className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </button>
                </SheetClose>
              </div>
            </div>
          </SheetHeader>
        )}
        
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// FAVORITES DRAWER WITH TRIGGER (for navbar)
// ============================================================================

interface FavoritesDrawerTriggerProps {
  className?: string;
}

export function FavoritesDrawerTrigger({ className }: FavoritesDrawerTriggerProps) {
  const [open, setOpen] = useState(false);
  const { favorites, isLoggedIn } = useFavorites();
  
  const count = favorites.length;
  const hasItems = count > 0;
  
  if (!isLoggedIn) {
    return (
      <Tooltip content="Sign in to save favorites" side="bottom">
        <button
          disabled
          className={cn(
            "relative p-2 rounded-lg transition-all duration-200 opacity-50 cursor-not-allowed",
            "text-neutral-400",
            className
          )}
        >
          <Heart className="h-5 w-5" />
        </button>
      </Tooltip>
    );
  }
  
  return (
    <>
      <Tooltip content={hasItems ? `${count} saved pick${count !== 1 ? 's' : ''}` : "Your saved picks"} side="bottom">
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "relative p-2 rounded-lg transition-all duration-200",
            "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
            hasItems 
              ? "text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300" 
              : "text-neutral-500 dark:text-neutral-400 hover:text-[#0EA5E9] dark:hover:text-[#7DD3FC]",
            className
          )}
        >
          {hasItems ? (
            <HeartFill className="h-5 w-5" />
          ) : (
            <Heart className="h-5 w-5" />
          )}
          
          {/* Count Badge */}
          {hasItems && (
            <span className={cn(
              "absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center",
              "rounded-full bg-red-500 px-1 text-[10px] font-bold text-white",
              count > 9 && "px-1.5"
            )}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </Tooltip>
      
      <FavoritesDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

// Mobile version
export function MobileFavoritesDrawerTrigger({ className }: FavoritesDrawerTriggerProps) {
  const [open, setOpen] = useState(false);
  const { favorites, isLoggedIn } = useFavorites();
  
  const count = favorites.length;
  const hasItems = count > 0;
  
  if (!isLoggedIn) {
    return (
      <button
        disabled
        className={cn(
          "relative p-2 rounded-lg transition-all duration-200 opacity-50 cursor-not-allowed",
          "text-neutral-400",
          className
        )}
      >
        <Heart className="h-5 w-5" />
      </button>
    );
  }
  
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "relative p-2 rounded-lg transition-all duration-200",
          "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
          hasItems 
            ? "text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300" 
            : "text-neutral-500 dark:text-neutral-400 hover:text-[#0EA5E9] dark:hover:text-[#7DD3FC]",
          className
        )}
      >
        {hasItems ? (
          <HeartFill className="h-5 w-5" />
        ) : (
          <Heart className="h-5 w-5" />
        )}
        
        {/* Count Badge */}
        {hasItems && (
          <span className={cn(
            "absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center",
            "rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          )}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      
      <FavoritesDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
