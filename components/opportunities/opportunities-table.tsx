"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

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
  isPro?: boolean;
  showEV?: boolean;
  showHidden?: boolean;
  onRowClick?: (opp: Opportunity) => void;
  onHideEdge?: (params: HideEdgeParams) => void;
  onUnhideEdge?: (edgeKey: string) => void;
  isHidden?: (edgeKey: string) => boolean;
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
 * Main table component styled like V1
 */
export function OpportunitiesTable({
  opportunities,
  isLoading,
  isPro = true,
  showEV = false,
  showHidden = false,
  onRowClick,
  onHideEdge,
  onUnhideEdge,
  isHidden,
  comparisonMode = "average",
  comparisonLabel,
  excludedBooks = [],
  isCustomMode = false,
}: OpportunitiesTableProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading opportunities...</p>
        </div>
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

  return (
    <div
      ref={tableRef}
      className="overflow-auto max-h-[calc(100vh-300px)] rounded-xl border border-neutral-200 dark:border-neutral-800"
    >
      <table className="min-w-full text-sm table-fixed">
        {/* Column widths: Edge%, League, Time, Player, Line, Market, Best Book, Reference, [Fair], Filter, Action */}
        <colgroup>
          <col style={{ width: 100 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 100 }} />
          {comparisonMode !== "next_best" && <col style={{ width: 100 }} />}
          <col style={{ width: 130 }} />
          <col style={{ width: 90 }} />
        </colgroup>
        <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-[5]">
          <tr>
            <th 
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
            </th>
            <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
              League
              </th>
            <th 
              className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              onClick={() => handleSort('time')}
            >
              <div className="flex items-center gap-1">
                <span>Time</span>
                {sortField === 'time' && (
                  sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </th>
            <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">
              Selection
            </th>
            <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
              Line
            </th>
            <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">
              Market
            </th>
            <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
              Best Book
            </th>
            <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
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
            </th>
            {comparisonMode !== "next_best" && (
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
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
              </th>
            )}
            <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
              Filter
            </th>
            <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-neutral-200 dark:border-neutral-800">
              Action
              </th>
          </tr>
        </thead>
        <tbody>
          {sortedOpportunities.map((opp, index) => {
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
                  {/* Edge % */}
                  <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
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

                  {/* League */}
                  <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      <SportIcon sport={opp.sport} className="h-3.5 w-3.5" />
                      {opp.sport.toUpperCase()}
                    </div>
                  </td>

                  {/* Time */}
                  <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">{dateStr}</div>
                      {timeStr && <div className="text-xs text-neutral-500 dark:text-neutral-500">{timeStr}</div>}
                    </div>
                  </td>

                  {/* Player */}
                  <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                    <div className="text-sm md:text-base font-medium text-neutral-900 dark:text-neutral-100">
                      {/* Handle game props like "game_total" - show cleaner name */}
                      {opp.player === "game_total" || opp.player === "Game" || !opp.player 
                        ? "Game" 
                        : opp.player}
                      {opp.position && (
                        <span className="text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 font-normal ml-1">
                          ({opp.position})
                        </span>
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

                  {/* Line */}
                  <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                      {/* Handle yes/no markets (overtime, etc.) */}
                      {opp.side === "yes" ? "Yes" : 
                       opp.side === "no" ? "No" : 
                       `${opp.side === "over" ? "O" : "U"} ${opp.line}`}
                    </span>
                  </td>

                  {/* Market */}
                  <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300 truncate max-w-[130px]">
                      {opp.marketDisplay ? shortenPeriodPrefix(opp.marketDisplay) : formatMarketName(opp.market)}
                    </span>
                  </td>

                  {/* Best Book */}
                  <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
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

                  {/* Sharp Odds (Reference/Average/Model) */}
                  <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                    {(() => {
                      const sharpBooksCount = opp.sharpBooks?.length || 0;
                      
                      // Show logos for:
                      // - Book mode or next_best mode (always)
                      // - Custom mode when ≤3 books
                      const shouldShowLogos = 
                        comparisonMode === "book" || 
                        comparisonMode === "next_best" || 
                        (isCustomMode && sharpBooksCount <= 3 && sharpBooksCount > 0);
                      
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-base text-neutral-700 dark:text-neutral-300">
                            {opp.sharpPrice || "—"}
                          </span>
                          {/* Sportsbook logos */}
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

                  {/* Fair Odds (Devigged) - hidden for next_best mode */}
                  {comparisonMode !== "next_best" && (
                    <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="font-bold text-base text-neutral-700 dark:text-neutral-300">
                        {opp.fairAmerican || opp.sharpPrice || "—"}
                      </span>
                    </td>
                  )}

                  {/* Filter Indicator */}
                  <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
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

                  {/* Action */}
                  <td className="p-2 text-center border-b border-neutral-200/50 dark:border-neutral-800/50">
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
                      
                      {/* Hide/Unhide Button */}
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
                      <td colSpan={comparisonMode === "next_best" ? 10 : 11} className="px-4 py-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
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
  );
}
