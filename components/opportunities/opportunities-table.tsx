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
import { 
  ChevronRight,
  ChevronUp, 
  ChevronDown,
  ExternalLink, 
  TrendingUp,
  Eye,
  EyeOff,
  DollarSign,
  GripVertical,
} from "lucide-react";
import { getKellyStakeDisplay } from "@/lib/utils/kelly";
import { usePrefetchPlayerByOddsId } from "@/hooks/use-prefetch-player";

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
   * Callback when column order changes (for saving to preferences).
   */
  onColumnOrderChange?: (newOrder: string[]) => void;
}

type SortField = 'edge' | 'time';
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
}: OpportunitiesTableProps) {
  // Prefetch player data on hover for faster modal opens
  const prefetchPlayer = usePrefetchPlayerByOddsId();
  
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
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            onClick={() => handleSort('edge')}
          >
            <div className="flex items-center justify-center gap-1">
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
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            League
          </SortableColumnHeader>
        );
      case 'time':
        return (
          <SortableColumnHeader
            key="time"
            id="time"
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            Selection
          </SortableColumnHeader>
        );
      case 'line':
        return (
          <SortableColumnHeader
            key="line"
            id="line"
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            Line
          </SortableColumnHeader>
        );
      case 'market':
        return (
          <SortableColumnHeader
            key="market"
            id="market"
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            Market
          </SortableColumnHeader>
        );
      case 'best-book':
        return (
          <SortableColumnHeader
            key="best-book"
            id="best-book"
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            Best Book
          </SortableColumnHeader>
        );
      case 'reference':
        return (
          <SortableColumnHeader
            key="reference"
            id="reference"
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            <div className="flex items-center justify-center gap-1">
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
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            <div className="flex items-center justify-center gap-1">
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
            </div>
          </SortableColumnHeader>
        );
      case 'stake':
        return (
          <SortableColumnHeader
            key="stake"
            id="stake"
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            <div className="flex items-center justify-center gap-1">
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
            </div>
          </SortableColumnHeader>
        );
      case 'filter':
        return (
          <SortableColumnHeader
            key="filter"
            id="filter"
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800"
          >
            Filter
          </SortableColumnHeader>
        );
      case 'action':
        return (
          <SortableColumnHeader
            key="action"
            id="action"
            className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-neutral-200 dark:border-neutral-800"
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
      bestBooksWithPrice: { book: string; price: number; decimal: number; link: string | null }[];
      dateStr: string;
      timeStr: string;
      isHiddenRow: boolean;
      sortedBooks: { book: string; price: number; decimal: number; link: string | null }[];
    }
  ) => {
    const { isExpanded, showLogos, bestBooksWithPrice, dateStr, timeStr, isHiddenRow, sortedBooks } = helpers;
    
    switch (colId) {
      case 'edge':
        return (
          <td key="edge" className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRow(opp.id);
                }}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-md transition-all shrink-0",
                  "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                  "text-neutral-500 dark:text-neutral-400",
                  isExpanded && "bg-neutral-100 dark:bg-neutral-800"
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
                "inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-bold",
                (opp.edgePct ?? 0) >= 10 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                (opp.edgePct ?? 0) >= 5 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              )}>
                <span className="text-[10px]">▲</span>
                +{(opp.edgePct ?? 0).toFixed(1)}%
              </span>
            </div>
          </td>
        );
      
      case 'league':
        return (
          <td key="league" className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              <SportIcon sport={opp.sport} className="h-3.5 w-3.5" />
              {opp.sport.toUpperCase()}
            </div>
          </td>
        );
      
      case 'time':
        return (
          <td key="time" className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            <div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">{dateStr}</div>
              {timeStr && <div className="text-xs text-neutral-500 dark:text-neutral-500">{timeStr}</div>}
            </div>
          </td>
        );
      
      case 'selection':
        const isGameProp = opp.player === "game_total" || opp.player === "Game" || !opp.player;
        const canShowProfile = !isGameProp && opp.sport === "nba" && opp.playerId && onPlayerClick;
        
        return (
          <td 
            key="selection" 
            className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50"
            onClick={(e) => {
              // Stop propagation at the cell level if clicking on a player with profile
              if (canShowProfile && e.target !== e.currentTarget) {
                e.stopPropagation();
              }
            }}
          >
            <div className="text-sm md:text-base font-medium text-neutral-900 dark:text-neutral-100">
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
                    className="text-left text-blue-500/80 dark:text-blue-400/70 hover:text-blue-600 dark:hover:text-blue-300 hover:underline transition-colors"
                    type="button"
                  >
                    {opp.player}
                    {opp.position && (
                      <span className="text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 font-normal ml-1">
                        ({opp.position})
                      </span>
                    )}
                  </button>
                </Tooltip>
              ) : (
                <>
                  {isGameProp ? "Game" : opp.player}
                  {opp.position && (
                    <span className="text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 font-normal ml-1">
                      ({opp.position})
                    </span>
                  )}
                </>
              )}
            </div>
            {opp.awayTeam && opp.homeTeam && (
              <div className="flex items-center gap-1 text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {showLogos && (
                  <img
                    src={getTeamLogoUrl(opp.awayTeam, opp.sport)}
                    alt={opp.awayTeam}
                    className="w-4 h-4 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className={cn(
                  opp.team === opp.awayTeam && "font-semibold text-neutral-900 dark:text-neutral-100"
                )}>
                  {opp.awayTeam}
                </span>
                <span className="mx-0.5">@</span>
                {showLogos && (
                  <img
                    src={getTeamLogoUrl(opp.homeTeam, opp.sport)}
                    alt={opp.homeTeam}
                    className="w-4 h-4 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className={cn(
                  opp.team === opp.homeTeam && "font-semibold text-neutral-900 dark:text-neutral-100"
                )}>
                  {opp.homeTeam}
                </span>
              </div>
            )}
          </td>
        );
      
      case 'line':
        return (
          <td key="line" className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
              {opp.side === "yes" ? "Yes" : 
               opp.side === "no" ? "No" : 
               `${opp.side === "over" ? "O" : "U"} ${opp.line}`}
            </span>
          </td>
        );
      
      case 'market':
        return (
          <td key="market" className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300 truncate max-w-[130px]">
              {opp.marketDisplay ? shortenPeriodPrefix(opp.marketDisplay) : formatMarketName(opp.market)}
            </span>
          </td>
        );
      
      case 'best-book':
        return (
          <td key="best-book" className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center -space-x-1">
                {bestBooksWithPrice.slice(0, 3).map((book) => {
                  const bookLogo = getBookLogo(book.book);
                  return bookLogo ? (
                    <img 
                      key={book.book}
                      src={bookLogo} 
                      alt={getBookName(book.book)} 
                      className="h-6 w-6 object-contain"
                      title={getBookName(book.book)}
                    />
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
              <div className="flex flex-col items-center leading-tight">
                <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                  {opp.bestPrice}
                </div>
              </div>
            </div>
          </td>
        );
      
      case 'reference':
        return (
          <td key="reference" className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            {(() => {
              const sharpBooksCount = opp.sharpBooks?.length || 0;
              const shouldShowLogos = 
                comparisonMode === "book" || 
                comparisonMode === "next_best" || 
                (isCustomMode && sharpBooksCount <= 3 && sharpBooksCount > 0);
              
              return (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-bold text-base text-neutral-700 dark:text-neutral-300">
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
          <td key="fair" className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            <span className="font-bold text-base text-neutral-700 dark:text-neutral-300">
              {opp.fairAmerican || opp.sharpPrice || "—"}
            </span>
          </td>
        );
      
      case 'stake':
        return (
          <td key="stake" className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
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
              });
              
              if (stake <= 0) {
                return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
              }
              
              return (
                <Tooltip content={`Full Kelly: ${kellyPct.toFixed(1)}% • ${(kellyPercent || 25)}% Kelly: ${display}`}>
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span className="font-semibold text-sm">{display.replace('$', '')}</span>
                  </div>
                </Tooltip>
              );
            })()}
          </td>
        );
      
      case 'filter':
        return (
          <td key="filter" className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
            {opp.filterId && opp.filterId !== "default" ? (
              <Tooltip content={opp.filterName || "Custom Filter"}>
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--tertiary)]/10 text-[var(--tertiary)] text-xs font-medium">
                  <span className="flex -space-x-1">
                    {parseSports(opp.filterIcon || "").slice(0, 2).map((sport, idx) => (
                      <span key={`${opp.id}-${sport}-${idx}`} className="rounded-full ring-1 ring-white dark:ring-neutral-800">
                        <SportIcon sport={sport} className="w-4 h-4" />
                      </span>
                    ))}
                    {parseSports(opp.filterIcon || "").length > 2 && (
                      <span className="text-[9px] text-neutral-500 ml-1">
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
          <td key="action" className="p-2 text-center border-b border-neutral-200/50 dark:border-neutral-800/50">
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
                        className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:ring-offset-1 transition-all font-medium text-sm"
                      >
                        <span>Bet</span>
                        <ExternalLink className="h-3.5 w-3.5" />
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
                        className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:ring-offset-1 transition-all font-medium text-sm"
                      >
                        <span>Bet</span>
                        <ChevronDown className="h-3.5 w-3.5" />
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
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:ring-offset-1 transition-all"
                  >
                    {isHidden?.(opp.id) ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
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
      setSortDirection(field === 'edge' ? 'desc' : 'asc');
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
      let aValue: number;
      let bValue: number;

      if (sortField === 'edge') {
        aValue = a.edgePct ?? 0;
        bValue = b.edgePct ?? 0;
      } else {
        aValue = a.gameStart ? new Date(a.gameStart).getTime() : 0;
        bValue = b.gameStart ? new Date(b.gameStart).getTime() : 0;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
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
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-14 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-12 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="space-y-1">
          <div className="w-12 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-16 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="space-y-1.5">
          <div className="w-32 h-4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-24 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
        </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-20 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            </div>
          </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-14 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                </div>
      </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
              </div>
      </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
      </td>
      <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex justify-center">
          <div className="w-16 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      </div>
      </td>
      <td className="p-2 border-b border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex justify-center gap-2">
          <div className="w-12 h-7 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="w-7 h-7 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
      </td>
    </tr>
  );

  if (isLoading) {
    return (
      <div className="overflow-auto max-h-[calc(100vh-300px)] rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            {filteredColumnOrder.map(colId => (
              <col key={colId} style={{ width: columnWidths[colId] || 100 }} />
            ))}
          </colgroup>
          <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-[5]">
            <tr>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">Edge %</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">League</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">Time</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">Selection</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">Line</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">Market</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">Best Book</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">Reference</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">Fair</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">Filter</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-neutral-200 dark:border-neutral-800">Action</th>
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
        className="overflow-auto max-h-[calc(100vh-300px)] rounded-xl border border-neutral-200 dark:border-neutral-800"
      >
        <table className="min-w-full text-sm table-fixed">
        {/* Dynamic column widths based on column order */}
        <colgroup>
          {filteredColumnOrder.map(colId => (
            <col key={colId} style={{ width: columnWidths[colId] || 100 }} />
          ))}
        </colgroup>
        <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-[5]">
          <SortableContext items={filteredColumnOrder} strategy={horizontalListSortingStrategy}>
          <tr>
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
            
            return (
              <React.Fragment key={opp.id}>
                <tr
                  onClick={() => toggleRow(opp.id)}
                  className={cn(
                    "group/row transition-colors cursor-pointer hover:!bg-neutral-100 dark:hover:!bg-neutral-800/50",
                    index % 2 === 0 ? "table-row-even" : "table-row-odd",
                    isHiddenRow && "opacity-40 bg-neutral-100/50 dark:bg-neutral-800/30"
                  )}
                >
                  {filteredColumnOrder.map(colId => 
                    renderColumnCell(colId, opp, {
                      isExpanded,
                      showLogos,
                      bestBooksWithPrice,
                      dateStr,
                      timeStr,
                      isHiddenRow: isHiddenRow ?? false,
                      sortedBooks,
                    })
                  )}
                </tr>

                {/* Expanded Row - All Books */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        index % 2 === 0 ? "table-row-even" : "table-row-odd"
                      )}
                    >
                      <td colSpan={filteredColumnOrder.length} className="px-4 py-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          {sortedBooks.map((book) => {
                            const bookLogo = getBookLogo(book.book);
                            const isBest = book.decimal === opp.bestDecimal;
                            const hasLink = !!book.link || !!getBookFallbackUrl(book.book);
                            
                            return (
                              <Tooltip 
                                key={`${opp.id}-${book.book}`}
                                content={
                                  book.limits?.max 
                                    ? `${getBookName(book.book)} • Max: $${book.limits.max.toLocaleString()}${hasLink ? ' • Click to place bet' : ''}`
                                    : hasLink ? `Place bet on ${getBookName(book.book)}` : `${getBookName(book.book)} - No link available`
                                }
                              >
                                <button
                                  onClick={() => openLink(book.book, book.link)}
                                  disabled={!hasLink}
                                  className={cn(
                                    "flex items-center gap-2.5 px-4 py-3 rounded-lg border transition-all",
                                    hasLink ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                                    isBest
                                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 shadow-sm"
                                      : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md"
                                  )}
                                >
                                  {bookLogo && (
                                    <img
                                      src={bookLogo}
                                      alt={book.book}
                                      className="h-6 w-6 object-contain shrink-0"
                                    />
                                  )}
                                  <div className="flex flex-col items-start">
                                    <span className={cn(
                                      "text-base font-bold",
                                      isBest
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-neutral-900 dark:text-neutral-100"
                                    )}>
                                      {book.priceFormatted}
                                    </span>
                                    {book.limits?.max && (
                                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                                        Max ${book.limits.max >= 1000 ? `${(book.limits.max / 1000).toFixed(0)}k` : book.limits.max}
                                      </span>
                                    )}
                                  </div>
                                  {hasLink && (
                                    <ExternalLink className="h-4 w-4 text-neutral-400 dark:text-neutral-500 ml-1" />
                                  )}
                                </button>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </td>
                    </motion.tr>
                  )}
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
