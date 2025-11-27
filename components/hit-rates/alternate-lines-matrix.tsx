"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAlternateLines, AlternateLine, BookOdds } from "@/hooks/use-alternate-lines";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { Zap, TrendingUp, ExternalLink, ChevronDown } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

interface AlternateLinesMatrixProps {
  sid: string | null;
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
  sid,
  playerId,
  market,
  currentLine,
  className,
}: AlternateLinesMatrixProps) {
  const { lines, isLoading, error } = useAlternateLines({
    sid,
    playerId,
    market,
    currentLine,
    enabled: !!sid && !!playerId && !!market,
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
    <div className={cn("rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-neutral-500" />
            Alternate Lines
          </h3>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {lines.length} lines available
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Line
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                L5
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                L10
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                L20
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Season
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Odds
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Edge
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {lines.map((line) => (
              <AlternateLineRow key={line.line} line={line} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlternateLineRow({ line }: { line: AlternateLine }) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/30",
        line.isCurrentLine && "bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-l-blue-500"
      )}
    >
      {/* Line */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold text-neutral-900 dark:text-white",
            line.isCurrentLine && "text-blue-600 dark:text-blue-400"
          )}>
            {line.line}+
          </span>
          {line.isCurrentLine && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
              Current
            </span>
          )}
        </div>
      </td>

      {/* L5 */}
      <td className="px-3 py-3 text-center">
        <span className={cn(
          "inline-block min-w-[42px] px-2 py-1 rounded text-xs font-semibold",
          getHitRateBgClass(line.l5Pct),
          getHitRateColorClass(line.l5Pct)
        )}>
          {line.l5Pct !== null ? `${line.l5Pct}%` : "—"}
        </span>
      </td>

      {/* L10 */}
      <td className="px-3 py-3 text-center">
        <span className={cn(
          "inline-block min-w-[42px] px-2 py-1 rounded text-xs font-semibold",
          getHitRateBgClass(line.l10Pct),
          getHitRateColorClass(line.l10Pct)
        )}>
          {line.l10Pct !== null ? `${line.l10Pct}%` : "—"}
        </span>
      </td>

      {/* L20 */}
      <td className="px-3 py-3 text-center">
        <span className={cn(
          "inline-block min-w-[42px] px-2 py-1 rounded text-xs font-semibold",
          getHitRateBgClass(line.l20Pct),
          getHitRateColorClass(line.l20Pct)
        )}>
          {line.l20Pct !== null ? `${line.l20Pct}%` : "—"}
        </span>
      </td>

      {/* Season */}
      <td className="px-3 py-3 text-center">
        <span className={cn(
          "inline-block min-w-[42px] px-2 py-1 rounded text-xs font-semibold",
          getHitRateBgClass(line.seasonPct),
          getHitRateColorClass(line.seasonPct)
        )}>
          {line.seasonPct !== null ? `${line.seasonPct}%` : "—"}
        </span>
      </td>

      {/* Odds Dropdown */}
      <td className="px-4 py-3">
        <OddsDropdownCell books={line.books} bestBook={line.bestBook} />
      </td>

      {/* Edge */}
      <td className="px-3 py-3 text-center">
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
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide",
              line.edge === "strong"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
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

  // Sort books by price (best odds first)
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
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all w-full",
          "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600",
          sortedBooks.length > 1 && "cursor-pointer",
          sortedBooks.length === 1 && "cursor-default",
          isOpen && "ring-2 ring-blue-500/50"
        )}
      >
        {bestBookLogo && (
          <img
            src={bestBookLogo}
            alt={bestBookName}
            className="h-4 w-4 object-contain"
          />
        )}
        <span className="text-xs font-semibold text-neutral-900 dark:text-white">
          {formatOdds(bestBookData.price)}
        </span>
        {sortedBooks.length > 1 && (
          <ChevronDown className={cn(
            "h-3 w-3 text-neutral-400 transition-transform",
            isOpen && "rotate-180"
          )} />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 right-0 min-w-[180px] rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800 overflow-hidden">
          <div className="py-1 max-h-[200px] overflow-y-auto">
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
                    "flex items-center gap-2 w-full px-3 py-2 text-left transition-colors",
                    "hover:bg-neutral-100 dark:hover:bg-neutral-700",
                    isBest && "bg-emerald-50 dark:bg-emerald-900/20"
                  )}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt={name}
                      className="h-5 w-5 object-contain shrink-0"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-600 shrink-0" />
                  )}
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200 flex-1 truncate">
                    {name}
                  </span>
                  <span className={cn(
                    "text-xs font-semibold",
                    isBest 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-neutral-900 dark:text-white"
                  )}>
                    {formatOdds(book.price)}
                  </span>
                  {(book.url || book.mobileUrl) && (
                    <ExternalLink className="h-3 w-3 text-neutral-400 shrink-0" />
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

