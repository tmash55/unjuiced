"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAlternateLines, AlternateLine, BookOdds } from "@/hooks/use-alternate-lines";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { Zap, TrendingUp, ExternalLink, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

// Sharp books used for fair odds calculation
const SHARP_BOOKS = ["pinnacle", "circa", "bookmaker"];

interface AlternateLinesMatrixProps {
  eventId: string | null;       // Event/game ID
  selKey: string | null;        // Player UUID from sel_key
  playerId: number | null;      // NBA player ID
  market: string | null;
  originalLine: number | null;  // The original line from profile (for fetching, doesn't change)
  activeLine: number | null;    // The currently active line (for highlighting, can change)
  className?: string;
  onLineSelect?: (line: number) => void;
}

const getHitRateColorClass = (value: number | null) => {
  if (value === null) return "text-neutral-400 dark:text-neutral-500";
  if (value >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 60) return "text-emerald-500 dark:text-emerald-500";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  if (value >= 35) return "text-orange-500 dark:text-orange-400";
  return "text-red-500 dark:text-red-400";
};

const getHitRateBgClass = (value: number | null) => {
  if (value === null) return "bg-neutral-100 dark:bg-neutral-800";
  if (value >= 75) return "bg-emerald-100 dark:bg-emerald-900/30";
  if (value >= 60) return "bg-emerald-50 dark:bg-emerald-900/20";
  if (value >= 50) return "bg-amber-50 dark:bg-amber-900/20";
  if (value >= 35) return "bg-orange-50 dark:bg-orange-900/20";
  return "bg-red-50 dark:bg-red-900/20";
};

const formatOdds = (price: number | null) => {
  if (price === null) return "—";
  return price > 0 ? `+${price}` : String(price);
};

const getBookLogo = (bookKey: string): string | null => {
  const info = getSportsbookById(bookKey);
  return info?.image?.light || null;
};

const getBookName = (bookKey: string): string => {
  const info = getSportsbookById(bookKey);
  return info?.name || bookKey.toUpperCase();
};

export function AlternateLinesMatrix({
  eventId,
  selKey,
  playerId,
  market,
  originalLine,
  activeLine,
  className,
  onLineSelect,
}: AlternateLinesMatrixProps) {
  const [collapsed, setCollapsed] = useState(false);
  
  // Use new Redis keys for fetching alternate lines
  const { lines, isLoading, error } = useAlternateLines({
    eventId,
    selKey,
    playerId,
    market,
    currentLine: originalLine,
    enabled: !!eventId && !!selKey && !!playerId && !!market,
  });
  
  // Override isCurrentLine based on activeLine for highlighting
  const linesWithActiveHighlight = lines.map(line => ({
    ...line,
    isCurrentLine: line.line === activeLine,
  }));

  if (isLoading) {
    return (
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-cyan-200 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Loading alternate lines...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 p-6 shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <p className="text-sm text-red-500 font-medium">Failed to load alternate lines</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 p-6 shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">No alternate lines available</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
      {/* Header - Premium Design */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-cyan-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-cyan-900/10" />
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-cyan-500 to-teal-600 shadow-sm shadow-cyan-500/30" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                    Alternate Lines
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 text-xs font-bold">
                    {lines.length} lines
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  Hit rates across different lines
                </p>
              </div>
            </div>
          
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
            >
              <ChevronDown className={cn(
                "h-4 w-4 text-neutral-500 transition-transform",
                !collapsed && "rotate-180"
              )} />
            </button>
          </div>
        </div>
      </div>

      {/* Table - Premium */}
      {!collapsed && (
        <div className="overflow-x-auto max-h-[400px]">
          <table className="min-w-full">
            <thead className="sticky top-0 z-10 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm">
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Line
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  L5
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  L10
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  L20
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  SZN
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Odds
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  <Tooltip content="Expected Value calculated using sharp book odds (Pinnacle, Circa)" side="top">
                    <span className="cursor-help">EV</span>
                  </Tooltip>
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Edge
                </th>
              </tr>
            </thead>
            <tbody>
              {linesWithActiveHighlight.map((line, index) => (
                <AlternateLineRow 
                  key={line.line} 
                  line={line} 
                  onLineSelect={onLineSelect}
                  isEven={index % 2 === 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AlternateLineRow({ line, onLineSelect, isEven = false }: { line: AlternateLine; onLineSelect?: (line: number) => void; isEven?: boolean }) {
  return (
    <tr
      onClick={() => onLineSelect?.(line.line)}
      className={cn(
        "group transition-colors border-b border-neutral-100/50 dark:border-neutral-800/50 last:border-0",
        onLineSelect && "cursor-pointer",
        line.isCurrentLine 
          ? "bg-brand/10 dark:bg-brand/20 border-l-2 border-l-brand"
          : isEven
            ? "bg-neutral-50/50 dark:bg-neutral-800/20"
            : "bg-white dark:bg-neutral-900/20",
        !line.isCurrentLine && "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30"
      )}
    >
      {/* Line */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-bold tabular-nums",
            line.isCurrentLine 
              ? "text-brand dark:text-brand" 
              : "text-neutral-900 dark:text-white"
          )}>
            {line.line}+
          </span>
          {line.isCurrentLine && (
            <span className="text-[9px] font-bold uppercase text-brand bg-brand/10 dark:bg-brand/20 px-1.5 py-0.5 rounded">
              Active
            </span>
          )}
        </div>
      </td>

      {/* L5 */}
      <td className="px-3 py-2.5 text-center">
        <span className={cn(
          "text-xs font-bold tabular-nums",
          getHitRateColorClass(line.l5Pct)
        )}>
          {line.l5Pct !== null ? `${line.l5Pct}%` : "—"}
        </span>
      </td>

      {/* L10 */}
      <td className="px-3 py-2.5 text-center">
        <span className={cn(
          "text-xs font-bold tabular-nums",
          getHitRateColorClass(line.l10Pct)
        )}>
          {line.l10Pct !== null ? `${line.l10Pct}%` : "—"}
        </span>
      </td>

      {/* L20 */}
      <td className="px-3 py-2.5 text-center">
        <span className={cn(
          "text-xs font-bold tabular-nums",
          getHitRateColorClass(line.l20Pct)
        )}>
          {line.l20Pct !== null ? `${line.l20Pct}%` : "—"}
        </span>
      </td>

      {/* Season */}
      <td className="px-3 py-2.5 text-center">
        <span className={cn(
          "text-xs font-bold tabular-nums",
          getHitRateColorClass(line.seasonPct)
        )}>
          {line.seasonPct !== null ? `${line.seasonPct}%` : "—"}
        </span>
      </td>

      {/* Odds Dropdown */}
      <td className="px-3 py-2.5">
        <div className="flex justify-center">
          <OddsDropdownCell books={line.books} bestBook={line.bestBook} />
        </div>
      </td>

      {/* EV % */}
      <td className="px-3 py-2.5 text-center">
        {line.evPercent !== null ? (
          <Tooltip
            content={
              <div className="text-xs">
                <div className="font-semibold mb-1">Expected Value</div>
                <div>Fair Odds: {line.fairOdds !== null ? (line.fairOdds > 0 ? `+${line.fairOdds}` : line.fairOdds) : "—"}</div>
                <div>Sharp Book: {line.sharpBook ? line.sharpBook.charAt(0).toUpperCase() + line.sharpBook.slice(1) : "—"}</div>
              </div>
            }
            side="top"
          >
            <span className={cn(
              "inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold tabular-nums cursor-help",
              line.evPercent > 0
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
            )}>
              {line.evPercent > 0 ? "+" : ""}{line.evPercent.toFixed(1)}%
            </span>
          </Tooltip>
        ) : (
          <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>
        )}
      </td>

      {/* Edge */}
      <td className="px-3 py-2.5 text-center">
        {line.edge ? (
          <Tooltip
            content={
              line.edge === "strong"
                ? "Strong edge: Hit rate significantly exceeds implied odds"
                : "Moderate edge: Hit rate exceeds implied odds"
            }
            side="top"
          >
            <span className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-help shadow-sm",
              line.edge === "strong"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                : "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
            )}>
              <Zap className="h-3 w-3" />
              {line.edge === "strong" ? "Strong" : "Edge"}
            </span>
          </Tooltip>
        ) : (
          <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>
        )}
      </td>
    </tr>
  );
}

// Odds dropdown component for each line
function OddsDropdownCell({ books, bestBook }: { books: BookOdds[]; bestBook: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!books || books.length === 0) {
    return <span className="text-xs text-neutral-400">—</span>;
  }

  // Sort books by price (best odds first for overs)
  const sortedBooks = [...books].sort((a, b) => b.price - a.price);
  const bestBookData = sortedBooks[0];
  const bestBookLogo = getBookLogo(bestBookData.book);
  const bestBookName = getBookName(bestBookData.book);

  const handleBookClick = (book: BookOdds, e: React.MouseEvent) => {
    e.stopPropagation();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile && book.mobileUrl ? book.mobileUrl : book.url;
    
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      // Fallback to sportsbook homepage
      const sportsbookInfo = getSportsbookById(book.book);
      if (sportsbookInfo?.links?.desktop) {
        window.open(sportsbookInfo.links.desktop, "_blank", "noopener,noreferrer");
      }
    }
  };

  const hasMultipleBooks = sortedBooks.length > 1;
  
  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasMultipleBooks) {
            setIsOpen(!isOpen);
          } else {
            handleBookClick(bestBookData, e);
          }
        }}
        className={cn(
          "group flex items-center justify-center gap-2 min-w-[100px] px-3 py-1.5 rounded-md transition-all cursor-pointer active:scale-95",
          "bg-neutral-100/80 dark:bg-neutral-700/50 border border-neutral-200/50 dark:border-neutral-600/50",
          "hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700",
          isOpen && "ring-1 ring-brand/50 border-brand/50"
        )}
      >
        {bestBookLogo && (
          <div className="h-5 w-5 rounded overflow-hidden shrink-0">
            <img
              src={bestBookLogo}
              alt={bestBookName}
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <span className="text-xs font-bold text-neutral-900 dark:text-white tabular-nums min-w-[45px] text-center">
          {formatOdds(bestBookData.price)}
        </span>
        {/* Always show chevron space to maintain consistent width */}
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform",
          hasMultipleBooks ? "text-neutral-400" : "text-transparent",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 right-0 min-w-[200px] rounded-lg border border-neutral-200/60 bg-white shadow-xl dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden">
          <div className="py-1 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
            {sortedBooks.map((book, idx) => {
              const logo = getBookLogo(book.book);
              const name = getBookName(book.book);
              const isBest = idx === 0;

              const hasLink = book.url || book.mobileUrl;
              
              return (
                <button
                  key={book.book}
                  type="button"
                  onClick={(e) => handleBookClick(book, e)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 text-left transition-all group/item",
                    "hover:bg-neutral-100 dark:hover:bg-neutral-700",
                    isBest && "bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-l-emerald-500",
                    hasLink && "cursor-pointer"
                  )}
                >
                  {logo ? (
                    <div className="h-5 w-5 rounded overflow-hidden shrink-0">
                      <img
                        src={logo}
                        alt={name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-600 shrink-0" />
                  )}
                  <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 flex-1 truncate flex items-center gap-1">
                    {name}
                    {book.isSharp && (
                      <ShieldCheck className="h-3 w-3 text-blue-500 dark:text-blue-400 shrink-0" />
                    )}
                  </span>
                  <span className={cn(
                    "text-xs font-bold tabular-nums",
                    isBest 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-neutral-900 dark:text-white"
                  )}>
                    {formatOdds(book.price)}
                  </span>
                  {hasLink && (
                    <ExternalLink className="h-3 w-3 text-neutral-400 group-hover/item:text-emerald-500 dark:group-hover/item:text-emerald-400 shrink-0 transition-colors" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

