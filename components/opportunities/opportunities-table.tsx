"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  type Opportunity,
  formatEdge,
  formatMarketName,
  shortenPeriodPrefix,
} from "@/lib/types/opportunities";
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";
import { parseSports } from "@/lib/types/filter-presets";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";
import { getLeagueName } from "@/lib/data/sports";
import { 
  ChevronRight,
  ChevronUp, 
  ChevronDown,
  ExternalLink, 
  TrendingUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Zap,
} from "lucide-react";
import { Heart } from "@/components/icons/heart";
import { HeartFill } from "@/components/icons/heart-fill";
import { getKellyStakeDisplay } from "@/lib/utils/kelly";
import { usePrefetchPlayerByOddsId } from "@/hooks/use-prefetch-player";
import { useFavorites } from "@/hooks/use-favorites";

// dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Loading messages for edge finder
const EDGE_LOADING_MESSAGES = [
  "Removing the juice...",
  "Finding sharp lines...",
  "Scanning sportsbooks...",
  "Calculating edges...",
  "Comparing to sharp books...",
  "Analyzing market odds...",
];

interface HideEdgeParams {
  edgeKey: string;
  eventId?: string;
  eventDate?: string;
  sport?: string;
  playerName?: string;
  market?: string;
  line?: number;
  autoUnhideHours?: number;
}

interface OpportunitiesTableProps {
  opportunities: Opportunity[];
  isLoading?: boolean;
  isFetching?: boolean;
  isPro?: boolean;
  showEV?: boolean;
  showHidden?: boolean;
  onRowClick?: (opp: Opportunity) => void;
  onHideEdge?: (params: HideEdgeParams) => void;
  onUnhideEdge?: (edgeKey: string) => void;
  isHidden?: (edgeKey: string) => boolean;
  /**
   * Callback when a player name is clicked (for opening hit rate modal)
   */
  onPlayerClick?: (params: { odds_player_id: string; player_name: string; market: string; event_id: string; line: number; odds?: { over?: { price: number; line: number; book?: string; mobileLink?: string | null }; under?: { price: number; line: number; book?: string; mobileLink?: string | null } } }) => void;
  /**
   * Comparison mode for dynamic column headers
   * - "book" with comparisonLabel = show book name (e.g., "FanDuel")
   * - "next_best" = show "Next Best" 
   * - "average" = show "Average"
   * - undefined when in custom mode (isCustomMode = true)
   */
  comparisonMode?: "book" | "next_best" | "average";
  comparisonLabel?: string; // Book name when mode is "book"
  /**
   * Books that are excluded/unselected in user preferences.
   * Used to filter which book logos to show in the "Best Book" column.
   * Empty array = show all books.
   */
  excludedBooks?: string[];
  /**
   * Whether custom filter mode is active.
   * When true, shows "Model" column with logos for ≤3 books.
   */
  isCustomMode?: boolean;
  /**
   * User's bankroll for Kelly stake calculation.
   * If not provided or 0, Stake column won't be shown.
   */
  bankroll?: number;
  /**
   * Kelly percentage for bet sizing (e.g., 25 = quarter Kelly).
   * Defaults to 25% if not provided or 0.
   */
  kellyPercent?: number;
  /**
   * Column order for drag-and-drop customization.
   * Default order: edge, league, time, selection, line, market, best-book, reference, fair, stake, filter, action
   */
  columnOrder?: string[];
  /**
   * Profit boost percentage (from sportsbook promotions).
   * When set, boosts the displayed edge % by this amount.
   * E.g., boostPercent=30 means a 10% edge displays as 13% (10% * 1.3)
   */
  boostPercent?: number;
  /**
   * Callback when column order changes (for saving to preferences).
   */
  onColumnOrderChange?: (newOrder: string[]) => void;
  /**
   * Whether auto-refresh (SSE streaming) is enabled.
   */
  autoRefresh?: boolean;
  /**
   * Map of opportunity IDs to change directions (for highlighting updates).
   */
  streamChanges?: Map<string, { edge?: "up" | "down"; price?: "up" | "down" }>;
  /**
   * Set of opportunity IDs that were just added (for highlighting new rows).
   */
  streamAdded?: Set<string>;
  /**
   * Set of opportunity IDs that are stale/unavailable.
   */
  streamStale?: Set<string>;
}

type SortField = 'edge' | 'time' | 'fair' | 'stake' | 'filter';
type SortDirection = 'asc' | 'desc';

const TABLE_SCROLL_KEY = 'edgeFinderV2_tableScrollTop';

// Helper to choose link based on device
const chooseBookLink = (desktop?: string | null, mobile?: string | null, fallback?: string | null) => {
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
  return isMobile ? (mobile || desktop || fallback || undefined) : (desktop || mobile || fallback || undefined);
};

// Get team logo URL
const getTeamLogoUrl = (teamName: string, sport: string): string => {
  if (!teamName) return '';
  const abbr = getStandardAbbreviation(teamName, sport);
  const logoSport = sport.toLowerCase() === 'ncaab' ? 'ncaaf' : sport;
  return `/team-logos/${logoSport}/${abbr.toUpperCase()}.svg`;
};

// Check if sport has team logos
const hasTeamLogos = (sportKey: string): boolean => {
  const sportsWithLogos = ['nfl', 'nhl', 'nba', 'ncaaf', 'ncaab'];
  return sportsWithLogos.includes(sportKey.toLowerCase());
};

// Format odds display
const formatOdds = (price: string | number) => {
  const num = typeof price === 'string' ? parseInt(price, 10) : price;
  return num > 0 ? `+${num}` : String(num);
};

// Get sportsbook logo
const getBookLogo = (bookId?: string) => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.image?.dark || sb?.image?.square || sb?.image?.long || null;
};

// Get sportsbook name
const getBookName = (bookId?: string) => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

// Get fallback URL for book
const getBookFallbackUrl = (bookId?: string): string | undefined => {
  if (!bookId) return undefined;
  const sb = getSportsbookById(bookId);
  if (!sb) return undefined;
  const base = (sb.affiliate && sb.affiliateLink) ? sb.affiliateLink : (sb.links?.desktop || undefined);
  if (!base) return undefined;
  if (sb.requiresState && base.includes("{state}")) return base.replace(/\{state\}/g, "nj");
  return base;
};

/**
 * Sortable column header component for drag-and-drop reordering
 */
function SortableColumnHeader({
  id,
  children,
  className,
  onClick,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        className,
        isDragging ? 'z-50' : '',
        "group relative"
      )}
      {...attributes}
    >
      <div className="flex items-center justify-center">
        {/* Column content */}
        <div
          className="flex-1"
          onClick={(e) => {
            if (!isDragging && onClick) {
              onClick();
            }
          }}
        >
          {children}
        </div>
        {/* Drag handle - right side */}
        <div
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
        </div>
      </div>
    </th>
  );
}

/**
 * Main table component styled like V1
 */
export function OpportunitiesTable({
  opportunities,
  isLoading,
  isFetching = false,
  isPro = true,
  showEV = false,
  showHidden = false,
  onRowClick,
  onHideEdge,
  onUnhideEdge,
  isHidden,
  onPlayerClick,
  comparisonMode = "average",
  comparisonLabel,
  excludedBooks = [],
  isCustomMode = false,
  bankroll = 0,
  kellyPercent = 25, // Default to quarter Kelly
  columnOrder: propColumnOrder,
  onColumnOrderChange,
  boostPercent = 0,
  // Streaming props for real-time updates
  autoRefresh = false,
  streamChanges,
  streamAdded,
  streamStale,
}: OpportunitiesTableProps) {
  // Prefetch player data on hover for faster modal opens
  const prefetchPlayer = usePrefetchPlayerByOddsId();
  
  // Track which rows are currently being toggled (for loading state)
  const [togglingRows, setTogglingRows] = useState<Set<string>>(new Set());
  
  // Favorites hook for betslip functionality
  const { toggleFavorite, isFavorited, isLoggedIn } = useFavorites();
  
  // Helper to convert opportunity to favorite params
  // Only includes fields that exist in the user_favorites database table
  const oppToFavoriteParams = (opp: Opportunity) => {
    // Convert allBooks to books_snapshot format
    // Schema: { book_id: { price, u?, m?, sgp? } }
    const booksSnapshot: Record<string, { price: number; u?: string | null; m?: string | null; sgp?: string | null }> = {};
    for (const book of opp.allBooks || []) {
      booksSnapshot[book.book] = {
        price: book.price,
        u: book.link ?? null,
        m: book.mobileLink ?? null,
        sgp: book.sgp ?? null,
      };
    }
    
    const isPlayerProp = opp.player && opp.player !== opp.homeTeam && opp.player !== opp.awayTeam;
    
    // Parse best price to number
    let bestPrice: number | null = null;
    if (typeof opp.bestPrice === 'string') {
      bestPrice = parseInt(opp.bestPrice.replace('+', ''), 10);
    } else if (typeof opp.bestPrice === 'number') {
      bestPrice = opp.bestPrice;
    } else if (opp.bestDecimal) {
      // Convert decimal to American if needed
      bestPrice = opp.bestDecimal > 2 
        ? Math.round((opp.bestDecimal - 1) * 100) 
        : Math.round(-100 / (opp.bestDecimal - 1));
    }
    
    // Build odds_key for Redis lookups: sport:eventId:market:player|side|line
    // This allows fetching current odds from Redis later
    const playerKey = opp.player?.toLowerCase().replace(/\s+/g, '_') || 'game';
    const oddsKey = `${opp.sport}:${opp.eventId}:${opp.market}:${playerKey}|${opp.side}|${opp.line ?? 0}`;
    
    return {
      type: (isPlayerProp ? 'player' : 'game') as 'player' | 'game',
      sport: opp.sport,
      event_id: opp.eventId,
      game_date: opp.gameStart ? new Date(opp.gameStart).toISOString().split('T')[0] : null,
      home_team: opp.homeTeam || null,
      away_team: opp.awayTeam || null,
      start_time: opp.gameStart || null,
      player_id: opp.playerId || null,
      player_name: opp.player || null,
      player_team: opp.team || null,
      player_position: opp.position || null,
      market: opp.market,
      line: opp.line ?? null,
      side: opp.side,
      odds_key: oddsKey,
      odds_selection_id: opp.id, // The composite ID from the opportunity
      books_snapshot: Object.keys(booksSnapshot).length > 0 ? booksSnapshot : null,
      best_price_at_save: bestPrice,
      best_book_at_save: opp.bestBook || null,
      source: 'edge_finder',
    };
  };
  
  // Handle toggling a favorite
  const handleToggleFavorite = async (opp: Opportunity) => {
    if (!isLoggedIn) return;
    
    const key = opp.id;
    setTogglingRows(prev => new Set(prev).add(key));
    
    try {
      await toggleFavorite(oppToFavoriteParams(opp));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setTogglingRows(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };
  
  // Check if an opportunity is favorited
  const isOppFavorited = (opp: Opportunity) => {
    return isFavorited({
      event_id: opp.eventId,
      type: (opp.player && opp.player !== opp.homeTeam && opp.player !== opp.awayTeam) ? 'player' : 'game',
      player_id: opp.playerId || null,
      market: opp.market,
      line: opp.line ?? null,
      side: opp.side,
    });
  };
  
  // Default column order
  const defaultColumnOrder = ['edge', 'league', 'time', 'selection', 'line', 'market', 'best-book', 'reference', 'fair', 'stake', 'filter', 'action'];
  
  // Local state for column order (for drag-and-drop)
  const [localColumnOrder, setLocalColumnOrder] = useState<string[]>(propColumnOrder || defaultColumnOrder);
  
  // Sync with prop changes
  useEffect(() => {
    if (propColumnOrder) {
      setLocalColumnOrder(propColumnOrder);
    }
  }, [propColumnOrder]);
  
  // Determine if we should show the Stake column (only if bankroll is set)
  const showStakeColumn = bankroll > 0;
  
  // Filter out conditional columns based on current settings
  const filteredColumnOrder = useMemo(() => {
    return localColumnOrder.filter(col => {
      // Hide 'fair' column when in next_best mode
      if (col === 'fair' && comparisonMode === 'next_best') return false;
      // Hide 'stake' column if no bankroll
      if (col === 'stake' && !showStakeColumn) return false;
      return true;
    });
  }, [localColumnOrder, comparisonMode, showStakeColumn]);
  
  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle column reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = filteredColumnOrder.indexOf(active.id as string);
    const newIndex = filteredColumnOrder.indexOf(over.id as string);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(filteredColumnOrder, oldIndex, newIndex);
      setLocalColumnOrder(newOrder);
      onColumnOrderChange?.(newOrder);
    }
  };
  
  // Column width configuration
  const columnWidths: Record<string, number> = {
    'edge': 100,
    'league': 80,
    'time': 100,
    'selection': 200,
    'line': 80,
    'market': 140,
    'best-book': 150,
    'reference': 100,
    'fair': 100,
    'stake': 85,
    'filter': 130,
    'action': 90,
  };
  
  // Helper function to render column header
  const renderColumnHeader = (colId: string) => {
    switch (colId) {
      case 'edge':
        return (
          <SortableColumnHeader
            key="edge"
            id="edge"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors"
            onClick={() => handleSort('edge')}
          >
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-amber-500" />
              <span>Edge %</span>
              <Tooltip content="Edge vs market average or sharp reference. Calculated using decimal odds.">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-hidden
                >
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z"
                  />
                </svg>
              </Tooltip>
              {sortField === 'edge' && (
                sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </SortableColumnHeader>
        );
      case 'league':
        return (
          <SortableColumnHeader
            key="league"
            id="league"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700"
          >
            League
          </SortableColumnHeader>
        );
      case 'time':
        return (
          <SortableColumnHeader
            key="time"
            id="time"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors"
            onClick={() => handleSort('time')}
          >
            <div className="flex items-center gap-1">
              <span>Time</span>
              {sortField === 'time' && (
                sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </SortableColumnHeader>
        );
      case 'selection':
        return (
          <SortableColumnHeader
            key="selection"
            id="selection"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700"
          >
            Selection
          </SortableColumnHeader>
        );
      case 'line':
        return (
          <SortableColumnHeader
            key="line"
            id="line"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700"
          >
            Line
          </SortableColumnHeader>
        );
      case 'market':
        return (
          <SortableColumnHeader
            key="market"
            id="market"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700"
          >
            Market
          </SortableColumnHeader>
        );
      case 'best-book':
        return (
          <SortableColumnHeader
            key="best-book"
            id="best-book"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700"
          >
            Best Book
          </SortableColumnHeader>
        );
      case 'reference':
        return (
          <SortableColumnHeader
            key="reference"
            id="reference"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700"
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>{referenceColumnLabel}</span>
              <Tooltip content={referenceColumnTooltip}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-hidden
                >
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z"
                  />
                </svg>
              </Tooltip>
            </div>
          </SortableColumnHeader>
        );
      case 'fair':
        return (
          <SortableColumnHeader
            key="fair"
            id="fair"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors"
            onClick={() => handleSort('fair')}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>Fair</span>
              <Tooltip content="Devigged fair odds (no-vig true probability). Calculated from both sides of the market when available.">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-hidden
                >
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z"
                  />
                </svg>
              </Tooltip>
              {sortField === 'fair' && (
                sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </SortableColumnHeader>
        );
      case 'stake':
        return (
          <SortableColumnHeader
            key="stake"
            id="stake"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors"
            onClick={() => handleSort('stake')}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>Stake</span>
              <Tooltip content={`Recommended bet size based on Kelly Criterion (${kellyPercent || 25}% Kelly). Uses your bankroll of $${bankroll.toLocaleString()}.`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-hidden
                >
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z"
                  />
                </svg>
              </Tooltip>
              {sortField === 'stake' && (
                sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </SortableColumnHeader>
        );
      case 'filter':
        return (
          <SortableColumnHeader
            key="filter"
            id="filter"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors"
            onClick={() => handleSort('filter')}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>Filter</span>
              {sortField === 'filter' && (
                sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </SortableColumnHeader>
        );
      case 'action':
        return (
          <SortableColumnHeader
            key="action"
            id="action"
            className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700"
          >
            Action
          </SortableColumnHeader>
        );
      default:
        return null;
    }
  };
  
  // Helper function to render body cell for each column
  const renderColumnCell = (
    colId: string,
    opp: Opportunity,
    helpers: {
      isExpanded: boolean;
      showLogos: boolean;
      bestBooksWithPrice: { book: string; price: number; decimal: number; link: string | null; limits?: { max?: number; min?: number } | null }[];
      dateStr: string;
      timeStr: string;
      isToday: boolean;
      isHiddenRow: boolean;
      sortedBooks: { book: string; price: number; decimal: number; link: string | null; limits?: { max?: number; min?: number } | null }[];
    }
  ) => {
    const { isExpanded, showLogos, bestBooksWithPrice, dateStr, timeStr, isToday, isHiddenRow, sortedBooks } = helpers;
    
    switch (colId) {
      case 'edge':
        // Apply boost to edge percentage
        const baseEdge = opp.edgePct ?? 0;
        const boostedEdge = boostPercent > 0 ? baseEdge * (1 + boostPercent / 100) : baseEdge;
        const displayEdge = boostedEdge;
        
        return (
          <td key="edge" className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRow(opp.id);
                }}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shrink-0",
                  "hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 hover:scale-110",
                  "text-neutral-400 dark:text-neutral-500",
                  isExpanded && "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rotate-90"
                )}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              </button>
              <span className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-bold shadow-sm border",
                // Use boosted edge for styling thresholds
                displayEdge >= 10 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50" :
                displayEdge >= 5 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200/50 dark:border-green-800/50" :
                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/50",
                // Amber glow when boosted
                boostPercent > 0 && "ring-1 ring-amber-400/30"
              )}>
                {boostPercent > 0 && <span className="text-[8px] text-amber-500 mr-0.5">⚡</span>}
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 0L12 10H0L6 0Z" />
                </svg>
                +{displayEdge.toFixed(1)}%
              </span>
            </div>
          </td>
        );
      
      case 'league':
        return (
          <td key="league" className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
            <div className="flex items-center gap-2">
              <SportIcon sport={opp.sport} className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
              <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
                {getLeagueName(opp.sport)}
              </span>
            </div>
          </td>
        );
      
      case 'time':
        return (
          <td key="time" className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
            <div className="flex flex-col">
              <span className={cn(
                "text-sm font-semibold tracking-tight",
                isToday ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
              )}>
                {dateStr}
              </span>
              {timeStr && (
                <span className="text-xs text-neutral-500 dark:text-neutral-500 tabular-nums">
                  {timeStr}
                </span>
              )}
            </div>
          </td>
        );
      
      case 'selection':
        const isGameProp = opp.player === "game_total" || opp.player === "Game" || !opp.player;
        const canShowProfile = !isGameProp && opp.sport === "nba" && opp.playerId && onPlayerClick;
        
        return (
          <td 
            key="selection" 
            className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50"
            onClick={(e) => {
              // Stop propagation at the cell level if clicking on a player with profile
              if (canShowProfile && e.target !== e.currentTarget) {
                e.stopPropagation();
              }
            }}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                {canShowProfile ? (
                  <Tooltip content="View Profile">
                    <button
                      onMouseEnter={() => opp.playerId && prefetchPlayer(opp.playerId)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onPlayerClick?.({
                          odds_player_id: opp.playerId!,
                          player_name: opp.player,
                          market: opp.market,
                          event_id: opp.eventId,
                          line: opp.line, // Pass the specific line from edge finder
                          odds: {
                            [opp.side]: {
                              price: parseInt(opp.bestPrice?.replace('+', '') || '0', 10), // American odds as integer
                              line: opp.line,
                              book: opp.bestBook,
                              mobileLink: opp.bestLink,
                            }
                          } as any,
                        });
                      }}
                      className="text-[15px] font-semibold text-neutral-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-300 hover:underline tracking-tight transition-colors"
                      type="button"
                    >
                      {opp.player}
                    </button>
                  </Tooltip>
                ) : (
                  <span className="text-[15px] font-semibold text-neutral-900 dark:text-white tracking-tight">
                    {isGameProp ? "Game" : opp.player}
                  </span>
                )}
                {opp.position && (
                  <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                    {opp.position}
                  </span>
                )}
              </div>
              {opp.awayTeam && opp.homeTeam && (
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {showLogos && (
                    <img
                      src={getTeamLogoUrl(opp.awayTeam, opp.sport)}
                      alt={opp.awayTeam}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <span className={cn(
                    "transition-colors",
                    opp.team === opp.awayTeam && "font-semibold text-neutral-700 dark:text-neutral-200"
                  )}>
                    {opp.awayTeam}
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-600">@</span>
                  {showLogos && (
                    <img
                      src={getTeamLogoUrl(opp.homeTeam, opp.sport)}
                      alt={opp.homeTeam}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <span className={cn(
                    "transition-colors",
                    opp.team === opp.homeTeam && "font-semibold text-neutral-700 dark:text-neutral-200"
                  )}>
                    {opp.homeTeam}
                  </span>
                </div>
              )}
            </div>
          </td>
        );
      
      case 'line':
        return (
          <td key="line" className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-800/50 border border-neutral-200/50 dark:border-neutral-700/50 text-neutral-700 dark:text-neutral-300 shadow-sm">
              {opp.side === "yes" ? "Yes" : 
               opp.side === "no" ? "No" : 
               `${opp.side === "over" ? "O" : "U"} ${opp.line}`}
            </span>
          </td>
        );
      
      case 'market':
        return (
          <td key="market" className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 truncate block max-w-[120px]">
              {opp.marketDisplay ? shortenPeriodPrefix(opp.marketDisplay) : formatMarketName(opp.market)}
            </span>
          </td>
        );
      
      case 'best-book':
        // Find limits from the best book(s) - use first book with limits
        const bestBookLimits = bestBooksWithPrice.find(b => b.limits?.max)?.limits;
        return (
          <td key="best-book" className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center -space-x-1">
                {bestBooksWithPrice.slice(0, 3).map((book) => {
                  const bookLogo = getBookLogo(book.book);
                  const bookName = getBookName(book.book);
                  const maxLimit = book.limits?.max;
                  return bookLogo ? (
                    <Tooltip 
                      key={book.book}
                      content={maxLimit ? `${bookName} • Max: $${maxLimit.toLocaleString()}` : bookName}
                    >
                      <img 
                        src={bookLogo} 
                        alt={bookName} 
                        className="h-6 w-6 object-contain rounded-md"
                      />
                    </Tooltip>
                  ) : null;
                })}
                {bestBooksWithPrice.length > 3 && (
                  <div className="h-6 w-6 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400">
                      +{bestBooksWithPrice.length - 3}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[17px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                  {opp.bestPrice}
                </span>
                {bestBookLimits?.max && (
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                    Max ${bestBookLimits.max >= 1000 ? `${(bestBookLimits.max / 1000).toFixed(0)}k` : bestBookLimits.max}
                  </span>
                )}
              </div>
            </div>
          </td>
        );
      
      case 'reference':
        return (
          <td key="reference" className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
            {(() => {
              const sharpBooksCount = opp.sharpBooks?.length || 0;
              const shouldShowLogos = 
                comparisonMode === "book" || 
                comparisonMode === "next_best" || 
                (isCustomMode && sharpBooksCount <= 3 && sharpBooksCount > 0);
              
              return (
                <div className="flex flex-col items-center">
                  <span className="text-[15px] font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                    {opp.sharpPrice || "—"}
                  </span>
                  {shouldShowLogos && opp.sharpBooks && opp.sharpBooks.length > 0 && (
                    <div className="flex items-center -space-x-1">
                      {opp.sharpBooks.slice(0, 3).map((book) => {
                        const bookLogo = getBookLogo(book);
                        return bookLogo ? (
                          <img 
                            key={book}
                            src={bookLogo} 
                            alt={getBookName(book)} 
                            className="h-4 w-4 object-contain"
                            title={getBookName(book)}
                          />
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </td>
        );
      
      case 'fair':
        return (
          <td key="fair" className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
            <span className="text-[15px] font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
              {opp.fairAmerican || opp.sharpPrice || "—"}
            </span>
          </td>
        );
      
      case 'stake':
        return (
          <td key="stake" className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
            {(() => {
              const bestPriceStr = opp.bestPrice || "";
              const fairPriceStr = opp.fairAmerican || opp.sharpPrice || "";
              
              if (!bestPriceStr || !fairPriceStr) {
                return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
              }
              
              const bestOdds = parseInt(bestPriceStr.replace('+', ''), 10);
              const fairOdds = parseInt(fairPriceStr.replace('+', ''), 10);
              
              if (isNaN(bestOdds) || isNaN(fairOdds) || bestOdds === 0 || fairOdds === 0) {
                return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
              }
              
              const { stake, display, kellyPct } = getKellyStakeDisplay({
                bankroll,
                bestOdds,
                fairOdds,
                kellyPercent: kellyPercent || 25,
                boostPercent: boostPercent || 0,
              });
              
              if (stake <= 0) {
                return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
              }
              
              const tooltipContent = boostPercent > 0
                ? `Full Kelly: ${kellyPct.toFixed(1)}% • ${(kellyPercent || 25)}% Kelly: ${display} • +${boostPercent}% boosted`
                : `Full Kelly: ${kellyPct.toFixed(1)}% • ${(kellyPercent || 25)}% Kelly: ${display}`;
              
              return (
                <Tooltip content={tooltipContent}>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums cursor-help",
                    "text-amber-600 dark:text-amber-400"
                  )}>
                    {boostPercent > 0 && <Zap className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                    {display}
                  </span>
                </Tooltip>
              );
            })()}
          </td>
        );
      
      case 'filter':
        return (
          <td key="filter" className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
            {opp.filterId && opp.filterId !== "default" ? (
              <Tooltip content={opp.filterName || "Custom Filter"}>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-xs font-semibold shadow-sm">
                  <span className="flex -space-x-1">
                    {parseSports(opp.filterIcon || "").slice(0, 2).map((sport, idx) => (
                      <span key={`${opp.id}-${sport}-${idx}`} className="rounded-full ring-1 ring-amber-100 dark:ring-amber-900/50">
                        <SportIcon sport={sport} className="w-4 h-4" />
                      </span>
                    ))}
                    {parseSports(opp.filterIcon || "").length > 2 && (
                      <span className="text-[9px] text-amber-600 dark:text-amber-500 ml-1 font-medium">
                        +{parseSports(opp.filterIcon || "").length - 2}
                      </span>
                    )}
                  </span>
                  <span className="max-w-[80px] truncate">{opp.filterName}</span>
                </div>
              </Tooltip>
            ) : opp.filterName ? (
              <Tooltip content={opp.filterName}>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  {opp.filterName}
                </span>
              </Tooltip>
            ) : (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>
            )}
          </td>
        );
      
      case 'action':
        return (
          <td key="action" className="px-3 py-3 text-center border-b border-neutral-200/50 dark:border-neutral-800/50">
            <div className="relative flex items-center justify-center gap-2">
              {bestBooksWithPrice.length > 0 && (
                <>
                  {bestBooksWithPrice.length === 1 ? (
                    <Tooltip content={`Place bet on ${getBookName(opp.bestBook)}`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLink(opp.bestBook, opp.bestLink);
                        }}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg",
                          "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700",
                          "text-white font-semibold text-xs shadow-sm",
                          "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                          "transition-all duration-200",
                          "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-1"
                        )}
                      >
                        <span>Bet</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </Tooltip>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenBetDropdown(openBetDropdown === opp.id ? null : opp.id);
                        }}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg",
                          "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700",
                          "text-white font-semibold text-xs shadow-sm",
                          "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                          "transition-all duration-200",
                          "focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-1"
                        )}
                      >
                        <span>Bet</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      
                      {openBetDropdown === opp.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg py-1">
                          {bestBooksWithPrice.map((book) => {
                            const bookLogo = getBookLogo(book.book);
                            return (
                              <button
                                key={book.book}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLink(book.book, book.link);
                                  setOpenBetDropdown(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left"
                              >
                                {bookLogo && (
                                  <img src={bookLogo} alt={book.book} className="h-5 w-5 object-contain" />
                                )}
                                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                  {getBookName(book.book)}
                                </span>
                                <ExternalLink className="h-3 w-3 ml-auto text-neutral-400" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              
              {/* Add to Betslip Button */}
              {!isLoggedIn ? (
                <Tooltip content="Sign in to save to betslip" side="left">
                  <button
                    type="button"
                    disabled
                    className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 opacity-50 cursor-not-allowed"
                  >
                    <Heart className="w-4 h-4 text-neutral-400" />
                  </button>
                </Tooltip>
              ) : (
                <Tooltip content={isOppFavorited(opp) ? "Remove from betslip" : "Add to betslip"} side="left">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(opp);
                    }}
                    disabled={togglingRows.has(opp.id)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all duration-200",
                      "hover:scale-110 active:scale-95",
                      isOppFavorited(opp)
                        ? "bg-red-500/10 hover:bg-red-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    )}
                  >
                    {togglingRows.has(opp.id) ? (
                      <HeartFill className="w-4 h-4 text-red-400 animate-pulse" />
                    ) : isOppFavorited(opp) ? (
                      <HeartFill className="w-4 h-4 text-red-500" />
                    ) : (
                      <Heart className="w-4 h-4 text-neutral-400 hover:text-red-400" />
                    )}
                  </button>
                </Tooltip>
              )}
              
              {onHideEdge && onUnhideEdge && (
                <Tooltip content={isHidden?.(opp.id) ? "Unhide this edge" : "Hide this edge"}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isHidden?.(opp.id)) {
                        onUnhideEdge(opp.id);
                      } else {
                        onHideEdge({
                          edgeKey: opp.id,
                          eventId: opp.eventId,
                          eventDate: opp.gameStart,
                          sport: opp.sport,
                          playerName: opp.player,
                          market: opp.market,
                          line: opp.line,
                          autoUnhideHours: 24
                        });
                      }
                    }}
                    className="p-1.5 rounded-lg transition-all duration-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-110 active:scale-95"
                  >
                    {isHidden?.(opp.id) ? (
                      <Eye className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    )}
                  </button>
                </Tooltip>
              )}
            </div>
          </td>
        );
      
      default:
        return null;
    }
  };
  
  // Dynamic column header based on comparison mode
  const referenceColumnLabel = isCustomMode
    ? "Model"
    : comparisonMode === "book" && comparisonLabel
    ? comparisonLabel
    : comparisonMode === "next_best"
    ? "Next Best"
    : comparisonMode === "average"
    ? "Average"
    : "Reference";
  
  const referenceColumnTooltip = isCustomMode
    ? "Blended odds from your custom model's reference books"
    : comparisonMode === "book" && comparisonLabel
    ? `Odds from ${comparisonLabel} used as reference for edge calculation`
    : comparisonMode === "next_best"
    ? "Second-best available odds (after the best book)"
    : comparisonMode === "average"
    ? "Average odds across all sharp books"
    : "Sharp reference odds used for edge calculation";

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('edge');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [openBetDropdown, setOpenBetDropdown] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRestoredRef = useRef(false);

  // Restore scroll position
  useEffect(() => {
    if (tableScrollRestoredRef.current) return;
    if (isLoading) return;
    const container = tableRef.current;
    if (!container) return;
    const saved = sessionStorage.getItem(TABLE_SCROLL_KEY);
    if (saved) {
      container.scrollTop = parseInt(saved, 10);
    }
    tableScrollRestoredRef.current = true;
  }, [isLoading, opportunities.length]);

  // Save scroll position
  useEffect(() => {
    const container = tableRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        sessionStorage.setItem(TABLE_SCROLL_KEY, container.scrollTop.toString());
      });
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [opportunities.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openBetDropdown) {
        setOpenBetDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openBetDropdown]);

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // Default to desc for edge, stake, and fair (show highest first)
      setSortDirection(field === 'edge' || field === 'stake' || field === 'fair' ? 'desc' : 'asc');
    }
  };

  // Filter hidden and sort opportunities
  const sortedOpportunities = React.useMemo(() => {
    // Filter out hidden opportunities (unless showHidden is true)
    let filtered = opportunities;
    if (!showHidden && isHidden) {
      filtered = opportunities.filter(opp => !isHidden(opp.id));
    }
    
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'edge':
          aValue = a.edgePct ?? 0;
          bValue = b.edgePct ?? 0;
          break;
        case 'time':
          aValue = a.gameStart ? new Date(a.gameStart).getTime() : 0;
          bValue = b.gameStart ? new Date(b.gameStart).getTime() : 0;
          break;
        case 'fair':
          aValue = a.fairDecimal ?? 0;
          bValue = b.fairDecimal ?? 0;
          break;
        case 'stake':
          // Sort by kelly fraction (higher kelly = larger stake)
          aValue = a.kellyFraction ?? 0;
          bValue = b.kellyFraction ?? 0;
          break;
        case 'filter':
          // Sort alphabetically by filter name
          aValue = a.filterName?.toLowerCase() ?? '';
          bValue = b.filterName?.toLowerCase() ?? '';
          if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });
    return sorted;
  }, [opportunities, sortField, sortDirection, showHidden, isHidden]);

  const openLink = (bookId?: string, link?: string | null) => {
    const fallback = getBookFallbackUrl(bookId);
    const target = link || fallback;
    if (!target) return;
    sessionStorage.setItem('edgeFinder_scrollPos', window.scrollY.toString());
    try {
      window.open(target, '_blank', 'noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes');
    } catch {void 0;}
  };

  // Rotating loading message state
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  useEffect(() => {
    if (!isLoading && !isFetching) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % EDGE_LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading, isFetching]);

  // Skeleton row component for reuse
  const SkeletonRow = ({ index }: { index: number }) => (
    <tr className={index % 2 === 0 ? "table-row-even" : "table-row-odd"}>
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-14 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-12 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="space-y-1">
          <div className="w-12 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-16 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="space-y-1.5">
          <div className="w-32 h-4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-24 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
        </td>
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-20 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            </div>
          </td>
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
                <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-14 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                </div>
      </td>
      {/* Reference */}
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
              </div>
      </td>
      {/* Fair - hidden in next_best mode */}
      {comparisonMode !== "next_best" && (
        <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
          <div className="flex justify-center">
            <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      )}
      {/* Stake */}
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-16 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      </div>
      </td>
      {/* Filter */}
      <td className="p-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-16 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
      </td>
      {/* Action */}
      <td className="p-2 border-b border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex justify-center gap-2">
          <div className="w-12 h-7 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-7 h-7 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-7 h-7 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
      </td>
    </tr>
  );

  if (isLoading) {
    return (
      <div className="overflow-auto max-h-[calc(100vh-300px)] rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 shadow-sm">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            {filteredColumnOrder.map(colId => (
              <col key={colId} style={{ width: columnWidths[colId] || 100 }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[5]">
            <tr className="bg-gradient-to-r from-neutral-50 via-neutral-50 to-amber-50/30 dark:from-neutral-900 dark:via-neutral-900 dark:to-amber-950/20">
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Edge %</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">League</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700">Time</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700">Selection</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Line</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Market</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700">Best Book</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">{referenceColumnLabel}</th>
              {comparisonMode !== "next_best" && (
                <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Fair</th>
              )}
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Stake</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Filter</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {/* Loading message row */}
            <tr>
              <td colSpan={filteredColumnOrder.length} className="p-0 border-b border-neutral-200/50 dark:border-neutral-800/50">
                <div className="flex items-center justify-center py-3 bg-neutral-50/50 dark:bg-neutral-800/30">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand border-t-transparent" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={loadingMessageIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm text-neutral-500 dark:text-neutral-400"
                      >
                        {EDGE_LOADING_MESSAGES[loadingMessageIndex]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </td>
            </tr>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={`initial-skeleton-${i}`} index={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">No edges found</p>
        <p className="text-sm text-muted-foreground">
            Try adjusting your filters to see more opportunities
        </p>
        </div>
      </div>
    );
  }

  // When switching filters, show loading state instead of stale data
  const showLoadingState = isFetching;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={tableRef}
        className="overflow-auto max-h-[calc(100vh-300px)] rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 shadow-sm"
      >
        <table className="min-w-full text-sm table-fixed">
        {/* Dynamic column widths based on column order */}
        <colgroup>
          {filteredColumnOrder.map(colId => (
            <col key={colId} style={{ width: columnWidths[colId] || 100 }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-[5]">
          <SortableContext items={filteredColumnOrder} strategy={horizontalListSortingStrategy}>
          <tr className="bg-gradient-to-r from-neutral-50 via-neutral-50 to-amber-50/30 dark:from-neutral-900 dark:via-neutral-900 dark:to-amber-950/20">
            {filteredColumnOrder.map(colId => renderColumnHeader(colId))}
          </tr>
          </SortableContext>
        </thead>
        <tbody>
          {/* Skeleton loading state */}
          {showLoadingState && (
            <>
              {/* Loading message row */}
              <tr>
                <td colSpan={filteredColumnOrder.length} className="p-0 border-b border-neutral-200/50 dark:border-neutral-800/50">
                  <div className="flex items-center justify-center py-3 bg-neutral-50/50 dark:bg-neutral-800/30">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand border-t-transparent" />
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={loadingMessageIndex}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-sm text-neutral-500 dark:text-neutral-400"
                        >
                          {EDGE_LOADING_MESSAGES[loadingMessageIndex]}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>
                </td>
              </tr>
              {/* Skeleton rows */}
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={`skeleton-${i}`} index={i} />
              ))}
            </>
          )}
          {!showLoadingState && sortedOpportunities.map((opp, index) => {
            const isExpanded = expandedRows.has(opp.id);
            const showLogos = hasTeamLogos(opp.sport);
            const bestLogo = getBookLogo(opp.bestBook);
            
            // Find all books with best price, filtered to only show user-selected books
            const allBestBooks = opp.allBooks?.filter(b => b.decimal === opp.bestDecimal) || [];
            const bestBooksWithPrice = excludedBooks.length > 0
              ? allBestBooks.filter(b => !excludedBooks.includes(normalizeSportsbookId(b.book)))
              : allBestBooks;
            
            // Format game time
            const gameDate = opp.gameStart ? new Date(opp.gameStart) : null;
            const isToday = gameDate ? (() => {
              const today = new Date();
              return gameDate.getDate() === today.getDate() &&
                     gameDate.getMonth() === today.getMonth() &&
                     gameDate.getFullYear() === today.getFullYear();
            })() : false;
            const dateStr = gameDate ? (isToday ? 'Today' : gameDate.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })) : 'TBD';
            const timeStr = gameDate ? gameDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

            // Calculate average from all books
            const avgDecimal = opp.allBooks && opp.allBooks.length > 0
              ? opp.allBooks.reduce((sum, b) => sum + b.decimal, 0) / opp.allBooks.length
              : null;
            let avgAmerican: string | null = null;
            if (avgDecimal) {
              if (avgDecimal >= 2) {
                avgAmerican = `+${Math.round((avgDecimal - 1) * 100)}`;
              } else {
                avgAmerican = `${Math.round(-100 / (avgDecimal - 1))}`;
              }
            }

            // Find next best book
            const sortedBooks = [...(opp.allBooks || [])].sort((a, b) => b.decimal - a.decimal);
            const nextBestBook = sortedBooks.find(b => b.decimal < opp.bestDecimal);

            const isHiddenRow = showHidden && isHidden?.(opp.id);
            
            // Streaming state for this row
            const isStale = autoRefresh && streamStale?.has(opp.id);
            const isNewlyAdded = autoRefresh && streamAdded?.has(opp.id);
            const hasChange = autoRefresh && streamChanges?.has(opp.id);
            const change = hasChange ? streamChanges?.get(opp.id) : undefined;
            
            return (
              <React.Fragment key={opp.id}>
                <tr
                  onClick={() => toggleRow(opp.id)}
                  className={cn(
                    "group/row transition-all duration-200 cursor-pointer",
                    "hover:bg-gradient-to-r hover:from-amber-50/80 hover:to-amber-50/20 dark:hover:from-amber-950/40 dark:hover:to-amber-950/10",
                    index % 2 === 0 
                      ? "bg-white dark:bg-neutral-900" 
                      : "bg-neutral-100/70 dark:bg-neutral-800/40",
                    isExpanded && "!bg-gradient-to-r !from-amber-50 !to-amber-50/30 dark:!from-amber-950/50 dark:!to-amber-950/20",
                    isHiddenRow && "opacity-40",
                    // Streaming states
                    isStale && "opacity-40 line-through",
                    isNewlyAdded && "animate-pulse bg-emerald-50/50 dark:bg-emerald-950/30",
                    hasChange && change?.edge === "up" && "bg-emerald-50/80 dark:bg-emerald-950/40",
                    hasChange && change?.edge === "down" && "bg-red-50/80 dark:bg-red-950/40"
                  )}
                >
                  {filteredColumnOrder.map(colId => 
                    renderColumnCell(colId, opp, {
                      isExpanded,
                      showLogos,
                      bestBooksWithPrice,
                      dateStr,
                      timeStr,
                      isToday,
                      isHiddenRow: isHiddenRow ?? false,
                      sortedBooks,
                    })
                  )}
                </tr>

                {/* Expanded Row - Premium Odds Comparison */}
                <AnimatePresence>
                  {isExpanded && (() => {
                    // Get current side and opposite side data
                    const isOverSide = opp.side === "over" || opp.side === "yes";
                    const currentSideBooks = sortedBooks;
                    const oppositeSideBooks = opp.oppositeSide?.allBooks || [];
                    
                    // Get all unique book IDs from both sides
                    const allBookIds = new Set<string>();
                    currentSideBooks.forEach(b => allBookIds.add(b.book));
                    oppositeSideBooks.forEach(b => allBookIds.add(b.book));
                    
                    // Create maps for quick lookup
                    const currentSideMap = new Map(currentSideBooks.map(b => [b.book, b]));
                    const oppositeSideMap = new Map(oppositeSideBooks.map(b => [b.book, b]));
                    
                    // Sort books by best odds on the +edge side
                    const sortedBookIds = Array.from(allBookIds).sort((a, b) => {
                      const aBook = currentSideMap.get(a);
                      const bBook = currentSideMap.get(b);
                      return (bBook?.decimal || 0) - (aBook?.decimal || 0);
                    });
                    
                    // Determine which row is Over and which is Under
                    const overMap = isOverSide ? currentSideMap : oppositeSideMap;
                    const underMap = isOverSide ? oppositeSideMap : currentSideMap;
                    
                    // Calculate best and average for each side
                    const overBooks = Array.from(overMap.values());
                    const underBooks = Array.from(underMap.values());
                    const bestOver = overBooks.length > 0 ? Math.max(...overBooks.map(b => b.decimal)) : null;
                    const bestUnder = underBooks.length > 0 ? Math.max(...underBooks.map(b => b.decimal)) : null;
                    
                    // Calculate average using implied probabilities (correct method)
                    const calcAvgAmerican = (books: typeof overBooks) => {
                      if (books.length === 0) return null;
                      const avgDecimal = books.reduce((sum, b) => sum + b.decimal, 0) / books.length;
                      if (avgDecimal >= 2) {
                        return `+${Math.round((avgDecimal - 1) * 100)}`;
                      } else {
                        return `${Math.round(-100 / (avgDecimal - 1))}`;
                      }
                    };
                    const avgOver = calcAvgAmerican(overBooks);
                    const avgUnder = calcAvgAmerican(underBooks);
                    
                    // Find best book for highlighting
                    const bestOverBook = overBooks.find(b => b.decimal === bestOver);
                    const bestUnderBook = underBooks.find(b => b.decimal === bestUnder);
                    
                    return (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      >
                        <td colSpan={filteredColumnOrder.length} className="p-0">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-gradient-to-b from-neutral-50 to-neutral-100/80 dark:from-neutral-900 dark:to-neutral-950 border-b border-neutral-200 dark:border-neutral-800"
                          >
                            {/* Full Width Container */}
                            <div className="w-full flex flex-col items-center">
                              {/* Header Row with Gradient Accent */}
                              <div className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-white/50 dark:bg-neutral-900/50">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                                    Market Odds Comparison
                                  </span>
                                </div>
                                <div className="flex-1 h-px bg-gradient-to-r from-neutral-200 dark:from-neutral-700 to-transparent" />
                                <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-500">
                                  <span>Line: <strong className="text-neutral-700 dark:text-neutral-300">{opp.line}</strong></span>
                                  <span className="w-px h-3 bg-neutral-300 dark:bg-neutral-700" />
                                  <span>Fair: <strong className="text-amber-600 dark:text-amber-400">{opp.fairAmerican || opp.sharpPrice}</strong></span>
                                </div>
                              </div>

                              {/* Odds Table - Centered */}
                              <div className="flex w-full justify-center">
                                <div className="flex max-w-full">
                                  {/* Fixed Left Column - Side Labels */}
                                  <div className="flex-shrink-0 w-28 border-r border-neutral-200/60 dark:border-neutral-800/60 bg-white/30 dark:bg-black/20">
                                    {/* Header spacer */}
                                    <div className="h-12 border-b border-neutral-200/40 dark:border-neutral-800/40" />
                                    {/* Over Label */}
                                    <div className={cn(
                                      "h-11 flex items-center px-4 border-b border-neutral-200/40 dark:border-neutral-800/40",
                                      isOverSide && "bg-amber-50/50 dark:bg-amber-950/20"
                                    )}>
                                      <div className="flex flex-col">
                                        <span className={cn(
                                          "text-sm font-semibold tracking-tight",
                                          isOverSide ? "text-amber-600 dark:text-amber-400" : "text-neutral-700 dark:text-neutral-300"
                                        )}>
                                          Over
                                        </span>
                                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 -mt-0.5">{opp.line}</span>
                                      </div>
                                    </div>
                                    {/* Under Label */}
                                    <div className={cn(
                                      "h-11 flex items-center px-4",
                                      !isOverSide && "bg-amber-50/50 dark:bg-amber-950/20"
                                    )}>
                                      <div className="flex flex-col">
                                        <span className={cn(
                                          "text-sm font-semibold tracking-tight",
                                          !isOverSide ? "text-amber-600 dark:text-amber-400" : "text-neutral-700 dark:text-neutral-300"
                                        )}>
                                          Under
                                        </span>
                                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 -mt-0.5">{opp.line}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Fixed Best Column */}
                                  <div className="flex-shrink-0 w-20 border-r border-neutral-200/60 dark:border-neutral-800/60 bg-amber-50/30 dark:bg-amber-950/10">
                                    <div className="h-12 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Best</span>
                                    </div>
                                    <div className={cn(
                                      "h-11 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40",
                                      isOverSide && "bg-amber-100/50 dark:bg-amber-900/20"
                                    )}>
                                      {bestOver !== null && bestOverBook && (
                                        <Tooltip content={`Best odds at ${getBookName(bestOverBook.book)}`}>
                                          <div className="flex items-center gap-1">
                                            {getBookLogo(bestOverBook.book) && (
                                              <img src={getBookLogo(bestOverBook.book)!} alt="" className="w-4 h-4 object-contain opacity-60" />
                                            )}
                                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                                              {bestOverBook.priceFormatted}
                                            </span>
                                          </div>
                                        </Tooltip>
                                      )}
                                    </div>
                                    <div className={cn(
                                      "h-11 flex items-center justify-center",
                                      !isOverSide && "bg-amber-100/50 dark:bg-amber-900/20"
                                    )}>
                                      {bestUnder !== null && bestUnderBook && (
                                        <Tooltip content={`Best odds at ${getBookName(bestUnderBook.book)}`}>
                                          <div className="flex items-center gap-1">
                                            {getBookLogo(bestUnderBook.book) && (
                                              <img src={getBookLogo(bestUnderBook.book)!} alt="" className="w-4 h-4 object-contain opacity-60" />
                                            )}
                                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                                              {bestUnderBook.priceFormatted}
                                            </span>
                                          </div>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </div>

                                  {/* Fixed Average Column */}
                                  <div className="flex-shrink-0 w-16 border-r border-neutral-200/60 dark:border-neutral-800/60">
                                    <div className="h-12 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Avg</span>
                                    </div>
                                    <div className="h-11 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                                        {avgOver || "—"}
                                      </span>
                                    </div>
                                    <div className="h-11 flex items-center justify-center">
                                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                                        {avgUnder || "—"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Scrollable Sportsbooks */}
                                  <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent hover:scrollbar-thumb-neutral-400 dark:hover:scrollbar-thumb-neutral-600">
                                    <div className="inline-flex min-w-full">
                                      {sortedBookIds.map((bookId) => {
                                        const bookLogo = getBookLogo(bookId);
                                        const overOffer = overMap.get(bookId);
                                        const underOffer = underMap.get(bookId);
                                        const isOverBest = overOffer && overOffer.decimal === bestOver;
                                        const isUnderBest = underOffer && underOffer.decimal === bestUnder;
                                        
                                        return (
                                          <div 
                                            key={`${opp.id}-${bookId}`} 
                                            className={cn(
                                              "flex-shrink-0 w-[72px] border-r border-neutral-100 dark:border-neutral-800/40 last:border-r-0",
                                              "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30 transition-colors"
                                            )}
                                          >
                                            {/* Book Logo Header */}
                                            <div className="h-12 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40 px-2">
                                              <Tooltip content={getBookName(bookId)}>
                                                {bookLogo ? (
                                                  <img
                                                    src={bookLogo}
                                                    alt={bookId}
                                                    className="h-6 w-6 object-contain opacity-90 hover:opacity-100 transition-opacity"
                                                  />
                                                ) : (
                                                  <span className="text-[10px] font-medium text-neutral-500 truncate">
                                                    {getBookName(bookId)?.slice(0, 6)}
                                                  </span>
                                                )}
                                              </Tooltip>
                                            </div>
                                            {/* Over Odds */}
                                            <div className={cn(
                                              "h-11 flex flex-col items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40",
                                              isOverBest && "bg-amber-50 dark:bg-amber-950/30"
                                            )}>
                                              {overOffer ? (
                                                <>
                                                  <button
                                                    onClick={() => openLink(bookId, overOffer.link)}
                                                    className={cn(
                                                      "text-sm font-semibold tabular-nums transition-all px-2 py-1 rounded",
                                                      "hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:scale-105",
                                                      isOverBest
                                                        ? "text-amber-600 dark:text-amber-400 font-bold"
                                                        : "text-neutral-700 dark:text-neutral-300"
                                                    )}
                                                  >
                                                    {overOffer.priceFormatted}
                                                  </button>
                                                  {overOffer.limits?.max && (
                                                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                                                      Max ${overOffer.limits.max >= 1000 ? `${(overOffer.limits.max / 1000).toFixed(0)}k` : overOffer.limits.max}
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                <span className="text-neutral-300 dark:text-neutral-700">—</span>
                                              )}
                                            </div>
                                            {/* Under Odds */}
                                            <div className={cn(
                                              "h-11 flex flex-col items-center justify-center",
                                              isUnderBest && "bg-amber-50 dark:bg-amber-950/30"
                                            )}>
                                              {underOffer ? (
                                                <>
                                                  <button
                                                    onClick={() => openLink(bookId, underOffer.link)}
                                                    className={cn(
                                                      "text-sm font-semibold tabular-nums transition-all px-2 py-1 rounded",
                                                      "hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:scale-105",
                                                      isUnderBest
                                                        ? "text-amber-600 dark:text-amber-400 font-bold"
                                                        : "text-neutral-700 dark:text-neutral-300"
                                                    )}
                                                  >
                                                    {underOffer.priceFormatted}
                                                  </button>
                                                  {underOffer.limits?.max && (
                                                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                                                      Max ${underOffer.limits.max >= 1000 ? `${(underOffer.limits.max / 1000).toFixed(0)}k` : underOffer.limits.max}
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                <span className="text-neutral-300 dark:text-neutral-700">—</span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </motion.tr>
                    );
                  })()}
                </AnimatePresence>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    </DndContext>
  );
}
