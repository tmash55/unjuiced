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
  stableKey: string | null;  // The stable key from odds_selection_id
  playerId: number | null;
  market: string | null;
  currentLine: number | null;
  className?: string;
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
  stableKey,
  playerId,
  market,
  currentLine,
  className,
}: AlternateLinesMatrixProps) {
  const [collapsed, setCollapsed] = useState(false);
  
  const { lines, isLoading, error } = useAlternateLines({
    stableKey,
    playerId,
    market,
    currentLine,
    enabled: !!stableKey && !!playerId && !!market,
  });

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading alternate lines...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <p className="text-sm text-red-500">Failed to load alternate lines</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No alternate lines available</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden shadow-sm", className)}>
      {/* Header - Premium Design */}
      <div className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100/50 dark:from-neutral-800/50 dark:via-neutral-800/30 dark:to-neutral-800/50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent" />
        
        {/* Content */}
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600" />
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                  Alternate Lines & Odds
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                  Compare lines across sportsbooks
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Lines Count Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200/50 dark:ring-emerald-800/50">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                  {lines.length} Lines
                </span>
              </div>
              
              {/* Collapse Button */}
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all active:scale-95"
              >
                {collapsed ? (
                  <ChevronDown className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-b from-neutral-50 to-neutral-100/50 dark:from-neutral-800/80 dark:to-neutral-800/50 backdrop-blur-sm">
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  Line
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  L5
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  L10
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  L20
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  Season
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  Best Odds
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  <Tooltip content="Expected Value calculated using sharp book odds (Pinnacle, Circa)" side="top">
                    <span className="cursor-help">EV %</span>
                  </Tooltip>
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  Edge
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/60 dark:divide-neutral-700/40">
              {lines.map((line) => (
                <AlternateLineRow key={line.line} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AlternateLineRow({ line }: { line: AlternateLine }) {
  return (
    <tr
      className={cn(
        "group transition-all duration-200",
        line.isCurrentLine 
          ? "bg-gradient-to-r from-brand/10 via-brand/5 to-transparent dark:from-brand/20 dark:via-brand/10 dark:to-transparent border-l-[3px] border-l-brand shadow-sm"
          : "hover:bg-gradient-to-r hover:from-neutral-50 hover:via-white hover:to-neutral-50 dark:hover:from-neutral-800/40 dark:hover:via-neutral-800/20 dark:hover:to-neutral-800/40"
      )}
    >
      {/* Line */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-base font-bold tabular-nums",
            line.isCurrentLine 
              ? "text-brand dark:text-brand" 
              : "text-neutral-900 dark:text-white"
          )}>
            {line.line}+
          </span>
          {line.isCurrentLine && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-brand bg-brand/10 dark:bg-brand/20 px-2 py-0.5 rounded-full ring-1 ring-brand/30">
              Active
            </span>
          )}
        </div>
      </td>

      {/* L5 */}
      <td className="px-3 py-3.5 text-center">
        <span className={cn(
          "inline-flex items-center justify-center min-w-[48px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
          getHitRateBgClass(line.l5Pct),
          getHitRateColorClass(line.l5Pct),
          "ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
        )}>
          {line.l5Pct !== null ? `${line.l5Pct}%` : "—"}
        </span>
      </td>

      {/* L10 */}
      <td className="px-3 py-3.5 text-center">
        <span className={cn(
          "inline-flex items-center justify-center min-w-[48px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
          getHitRateBgClass(line.l10Pct),
          getHitRateColorClass(line.l10Pct),
          "ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
        )}>
          {line.l10Pct !== null ? `${line.l10Pct}%` : "—"}
        </span>
      </td>

      {/* L20 */}
      <td className="px-3 py-3.5 text-center">
        <span className={cn(
          "inline-flex items-center justify-center min-w-[48px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
          getHitRateBgClass(line.l20Pct),
          getHitRateColorClass(line.l20Pct),
          "ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
        )}>
          {line.l20Pct !== null ? `${line.l20Pct}%` : "—"}
        </span>
      </td>

      {/* Season */}
      <td className="px-3 py-3.5 text-center">
        <span className={cn(
          "inline-flex items-center justify-center min-w-[48px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
          getHitRateBgClass(line.seasonPct),
          getHitRateColorClass(line.seasonPct),
          "ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
        )}>
          {line.seasonPct !== null ? `${line.seasonPct}%` : "—"}
        </span>
      </td>

      {/* Odds Dropdown */}
      <td className="px-4 py-3.5">
        <OddsDropdownCell books={line.books} bestBook={line.bestBook} />
      </td>

      {/* EV % */}
      <td className="px-4 py-3.5 text-center">
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
              "inline-flex items-center justify-center min-w-[52px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ring-1",
              line.evPercent > 0
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 ring-emerald-200/50 dark:ring-emerald-700/50"
                : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-red-200/50 dark:ring-red-700/50"
            )}>
              {line.evPercent > 0 ? "+" : ""}{line.evPercent.toFixed(1)}%
            </span>
          </Tooltip>
        ) : (
          <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>
        )}
      </td>

      {/* Edge */}
      <td className="px-4 py-3.5 text-center">
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
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all shadow-sm",
              line.edge === "strong"
                ? "bg-emerald-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-500/30"
                : "bg-amber-500 text-white ring-2 ring-amber-400/50 shadow-amber-500/30"
            )}>
              <Zap className="h-3.5 w-3.5" />
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (sortedBooks.length > 1) {
            // Multiple books - toggle dropdown
            setIsOpen(!isOpen);
          } else {
            // Single book - go directly to the URL
            handleBookClick(bestBookData, e);
          }
        }}
        className={cn(
          "group flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all w-full cursor-pointer active:scale-95",
          "bg-gradient-to-br from-neutral-100 to-neutral-200/50 dark:from-neutral-700/50 dark:to-neutral-700/30",
          "hover:from-emerald-50 hover:to-emerald-100/50 dark:hover:from-emerald-950/30 dark:hover:to-emerald-900/20",
          "hover:ring-2 hover:ring-emerald-500/20 hover:shadow-md",
          isOpen && "ring-2 ring-brand/50 shadow-lg"
        )}
      >
        {bestBookLogo && (
          <div className="h-5 w-5 rounded overflow-hidden shrink-0 ring-1 ring-neutral-300/50 dark:ring-neutral-600/50">
            <img
              src={bestBookLogo}
              alt={bestBookName}
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">
          {formatOdds(bestBookData.price)}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-neutral-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
      </button>

      {/* Dropdown - Premium Design */}
      {isOpen && (
        <div className="absolute z-50 mt-2 right-0 min-w-[200px] rounded-xl border border-neutral-200/60 bg-white shadow-2xl dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden">
          <div className="py-1.5 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
            {sortedBooks.map((book, idx) => {
              const logo = getBookLogo(book.book);
              const name = getBookName(book.book);
              const isBest = idx === 0;

              return (
                <button
                  key={book.book}
                  type="button"
                  onClick={(e) => handleBookClick(book, e)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-all group/item",
                    "hover:bg-neutral-100 dark:hover:bg-neutral-700",
                    isBest && "bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-l-2 border-l-emerald-500"
                  )}
                >
                  {logo ? (
                    <div className="h-6 w-6 rounded overflow-hidden shrink-0 ring-1 ring-neutral-200 dark:ring-neutral-700">
                      <img
                        src={logo}
                        alt={name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded bg-neutral-200 dark:bg-neutral-600 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 flex-1 truncate flex items-center gap-1.5">
                    {name}
                    {book.isSharp && (
                      <Tooltip content="Sharp book - Used for fair odds calculation" side="top">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                      </Tooltip>
                    )}
                  </span>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    isBest 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-neutral-900 dark:text-white"
                  )}>
                    {formatOdds(book.price)}
                  </span>
                  {(book.url || book.mobileUrl) && (
                    <ExternalLink className="h-3.5 w-3.5 text-neutral-400 group-hover/item:text-emerald-600 dark:group-hover/item:text-emerald-400 shrink-0 transition-colors" />
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

