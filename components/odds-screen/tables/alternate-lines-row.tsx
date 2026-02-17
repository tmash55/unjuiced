"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Layers } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import { getSportsbookById } from "@/lib/data/sportsbooks";

interface AlternateLine {
  ln: number; // Line value
  books: Record<string, {
    over?: { price: number; u?: string; m?: string }; // u = desktop URL, m = mobile URL
    under?: { price: number; u?: string; m?: string };
  }>;
  best?: {
    over?: { bk: string; price: number };
    under?: { bk: string; price: number };
  };
  avg?: {
    over?: number;
    under?: number;
  };
}

interface AlternateLinesRowProps {
  alternates: AlternateLine[];
  loading: boolean;
  error: string | null;
  columnOrder: string[]; // Main column order (entity, time, best-line, average-line)
  sportsbookOrder: string[]; // Sportsbook column order
  primaryLine?: number;
  onOddsClick?: (line: number, side: 'over' | 'under', book: string) => void;
  isPro?: boolean;
  setShowProGate?: (show: boolean) => void;
}

export function AlternateLinesRow({
  alternates,
  loading,
  error,
  columnOrder,
  sportsbookOrder,
  primaryLine,
  onOddsClick,
  isPro = false,
  setShowProGate,
}: AlternateLinesRowProps) {
  const formatOdds = (price: number) => {
    return price > 0 ? `+${price}` : `${price}`;
  };

  const formatLine = (line: number, side: 'over' | 'under') => {
    return side === 'over' ? `o${line}` : `u${line}`;
  };

  // Helper to get preferred link based on device type
  const getPreferredLink = (desktopLink?: string, mobileLink?: string) => {
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
    return isMobile ? (mobileLink || desktopLink || undefined) : (desktopLink || mobileLink || undefined);
  };

  // Helpers for average/best on alternates
  const americanToProb = (odds: number) => {
    if (odds > 0) return 100 / (odds + 100);
    return Math.abs(odds) / (Math.abs(odds) + 100);
  };

  const probToAmerican = (p: number) => {
    if (!Number.isFinite(p) || p <= 0) return 0;
    if (p >= 0.5) return -Math.round((p / (1 - p)) * 100);
    return Math.round(((1 - p) / p) * 100);
  };

  const calcAvgPrice = (books: Array<number>): number | null => {
    const valid = books.filter((x) => Number.isFinite(x));
    if (valid.length === 0) return null;
    const probs = valid.map(americanToProb);
    const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
    return probToAmerican(avgProb);
  };

  const getBest = (books: Array<{ price: number; bk: string }>) => {
    if (!books.length) return null;
    // Higher American odds are better for the bettor (e.g., -105 > -120; +130 > +120)
    return books.reduce((best, cur) => (cur.price > best.price ? cur : best));
  };

  if (loading) {
    return (
      <tr className="bg-gradient-to-r from-blue-50/30 via-white to-blue-50/30 dark:from-blue-950/20 dark:via-neutral-900 dark:to-blue-950/20">
        <td colSpan={100} className="px-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <div className="relative w-6 h-6">
              <div className="absolute inset-0 rounded-full border-2 border-blue-200 dark:border-blue-800" />
              <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Loading alternate lines...
            </span>
          </div>
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <tr className="bg-gradient-to-r from-red-50/50 via-red-50/30 to-red-50/50 dark:from-red-950/30 dark:via-red-950/20 dark:to-red-950/30">
        <td colSpan={100} className="px-4 py-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/50 dark:to-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              Failed to load alternates: {error}
            </span>
          </div>
        </td>
      </tr>
    );
  }

  if (alternates.length === 0) {
    return (
      <tr className="bg-gradient-to-r from-neutral-50/50 via-white to-neutral-50/50 dark:from-neutral-800/30 dark:via-neutral-900 dark:to-neutral-800/30">
        <td colSpan={100} className="px-4 py-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-800/50 flex items-center justify-center">
              <Layers className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
            </div>
            <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              No alternate lines available
            </span>
          </div>
        </td>
      </tr>
    );
  }

  // Sort alternates by line value (already filtered on backend, but double-check)
  const sortedAlternates = [...alternates]
    .filter(alt => alt.ln !== primaryLine) // Exclude primary line
    .sort((a, b) => a.ln - b.ln);

  return (
    <>
      {sortedAlternates.map((alt, index) => (
        <motion.tr
          key={`alt-${alt.ln}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15, delay: index * 0.02 }}
          className={cn(
            "border-l-2 border-blue-400/80 dark:border-blue-500/60 transition-colors duration-200",
            "hover:bg-gradient-to-r hover:from-blue-100/60 hover:to-blue-50/30 dark:hover:from-blue-950/50 dark:hover:to-blue-950/20",
            index % 2 === 0 
              ? "bg-gradient-to-r from-blue-50/40 to-white dark:from-blue-950/30 dark:to-neutral-900" 
              : "bg-white dark:bg-neutral-900/80"
          )}
        >
          {/* Render columns in the same order as main table */}
          {columnOrder.map((colId) => {
            // Entity column - show "Alt Line" label with line value
            if (colId === 'entity') {
              return (
                <td 
                  key={colId} 
                  className={cn(
                    "px-4 py-2.5 text-left sticky left-0 z-[5] border-r border-neutral-100/50 dark:border-neutral-800/30",
                    // Solid backgrounds for sticky column (no transparency!)
                    index % 2 === 0 
                      ? "bg-blue-50 dark:bg-slate-800" 
                      : "bg-white dark:bg-neutral-900"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Add left padding to align with expand button space */}
                    <div className="w-6 shrink-0" />
                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-blue-100/60 dark:bg-blue-900/30 border border-blue-200/50 dark:border-blue-700/30">
                      <div className="h-3 w-0.5 rounded-full bg-blue-400 dark:bg-blue-500" />
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                        Alt Line
                      </span>
                    </div>
                    <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 tabular-nums">
                      {formatLine(alt.ln, 'over')} / {formatLine(alt.ln, 'under')}
                    </span>
                  </div>
                </td>
              );
            }
            
            // Time/Event columns - empty for alternate lines
            if (colId === 'event' || colId === 'time') {
              return <td key={colId} className="px-4 py-2" />;
            }
            
            // Best line column - show best odds with sportsbook icon + deep link
            if (colId === 'best-line') {
              // Build book list
              const overBooks: Array<{ price: number; bk: string }> = [];
              const underBooks: Array<{ price: number; bk: string }> = [];
              Object.entries(alt.books || {}).forEach(([bk, v]) => {
                if (v?.over && Number.isFinite(v.over.price)) overBooks.push({ price: v.over.price, bk });
                if (v?.under && Number.isFinite(v.under.price)) underBooks.push({ price: v.under.price, bk });
              });
              const bestOver = getBest(overBooks);
              const bestUnder = getBest(underBooks);
              const renderBestButton = (best: { price: number; bk: string } | null, side: 'over' | 'under') => {
                if (!best) {
                  return (
                    <div className="px-2 py-1.5 text-xs rounded-lg border bg-neutral-50/50 dark:bg-neutral-800/50 border-neutral-200/50 dark:border-neutral-700/50 text-neutral-400 dark:text-neutral-500 text-center">-</div>
                  )
                }
                const sb = getSportsbookById(best.bk)
                const bookData = alt.books?.[best.bk]?.[side]
                const link = getPreferredLink(bookData?.u, bookData?.m)
                const content = (
                  <div className="flex items-center justify-center gap-1.5">
                    {sb?.image?.square && (
                      <img src={sb.image.square} alt={sb.name} className="w-4 h-4 object-contain rounded" />
                    )}
                    <span className="font-semibold text-xs">
                      <span className="opacity-70 tabular-nums">{side === 'over' ? `o${alt.ln}` : `u${alt.ln}`}</span>
                      <span className="ml-1 tabular-nums">{formatOdds(best.price)}</span>
                    </span>
                  </div>
                )
                if (link) {
                  return (
                    <Tooltip content={`Place bet on ${sb?.name ?? 'Sportsbook'}`}>
                      <button
                        onClick={() => {
                            window.open(link, '_blank', 'noopener,noreferrer')
                        }}
                        className="best-line best-line--sm w-full hover:scale-[1.02] active:scale-[0.98] transition-transform"
                      >
                        {content}
                      </button>
                    </Tooltip>
                  )
                }
                return (
                  <div className="best-line best-line--sm">{content}</div>
                )
              }

              return (
                <td key={colId} className="px-3 py-2">
                  <div className="space-y-1.5 text-center">
                    {renderBestButton(bestOver, 'over')}
                    {renderBestButton(bestUnder, 'under')}
                  </div>
                </td>
              );
            }
            
            // Average line column - could show average odds
            if (colId === 'average-line') {
              const overList: number[] = [];
              const underList: number[] = [];
              Object.values(alt.books || {}).forEach((v) => {
                if (v?.over && Number.isFinite(v.over.price)) overList.push(v.over.price);
                if (v?.under && Number.isFinite(v.under.price)) underList.push(v.under.price);
              });
              const avgOver = calcAvgPrice(overList);
              const avgUnder = calcAvgPrice(underList);
              return (
                <td key={colId} className="px-3 py-2 hidden sm:table-cell">
                  <div className="space-y-1.5 text-center">
                    <div className="avg-line avg-line--sm">
                      {avgOver !== null ? (
                        <span className="tabular-nums">
                          <span className="opacity-70">o{alt.ln}</span>
                          <span className="font-semibold ml-0.5">{formatOdds(avgOver)}</span>
                        </span>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500">-</span>
                      )}
                    </div>
                    <div className="avg-line avg-line--sm">
                      {avgUnder !== null ? (
                        <span className="tabular-nums">
                          <span className="opacity-70">u{alt.ln}</span>
                          <span className="font-semibold ml-0.5">{formatOdds(avgUnder)}</span>
                        </span>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500">-</span>
                      )}
                    </div>
                  </div>
                </td>
              );
            }
            
            return null;
          })}

          {/* Sportsbook Columns - in the same order as main table */}
          {sportsbookOrder.map((bookId) => {
            const bookData = alt.books[bookId];

            if (!bookData || (!bookData.over && !bookData.under)) {
              return (
                <td key={bookId} className="px-2 py-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="px-2 py-1.5 text-center text-xs text-neutral-300 dark:text-neutral-600 bg-neutral-50/30 dark:bg-neutral-800/20 rounded-md">-</div>
                    <div className="px-2 py-1.5 text-center text-xs text-neutral-300 dark:text-neutral-600 bg-neutral-50/30 dark:bg-neutral-800/20 rounded-md">-</div>
                  </div>
                </td>
              );
            }

            // Compute best prices for highlighting
            const bestOver = Object.values(alt.books || {}).reduce((m, v) => (v?.over && Number.isFinite(v.over.price) ? Math.max(m, v.over.price) : m), -Infinity);
            const bestUnder = Object.values(alt.books || {}).reduce((m, v) => (v?.under && Number.isFinite(v.under.price) ? Math.max(m, v.under.price) : m), -Infinity);
            const isBestOver = !!bookData.over && Number.isFinite(bookData.over.price) && bookData.over.price === bestOver;
            const isBestUnder = !!bookData.under && Number.isFinite(bookData.under.price) && bookData.under.price === bestUnder;
            const sb = getSportsbookById(bookId);

            const renderBookOdds = (side: 'over' | 'under') => {
              const entry = bookData[side];
              if (!entry) return (
                <div className="px-2 py-1.5 text-center text-xs text-neutral-300 dark:text-neutral-600 bg-neutral-50/30 dark:bg-neutral-800/20 rounded-md">-</div>
              );

              const isBest = side === 'over' ? isBestOver : isBestUnder;
              const link = getPreferredLink(entry.u, entry.m);

              return (
                <Tooltip content={`Place bet on ${sb?.name ?? 'Sportsbook'}`}>
                  <button
                    onClick={() => {
                      if (link) {
                        window.open(link, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className={cn(
                      'sportsbook-cell sportsbook-cell--sm block w-full mx-auto cursor-pointer font-medium rounded-md transition-all',
                      'hover:scale-[1.02] active:scale-[0.98]',
                      isBest && 'sportsbook-cell--highlighted'
                    )}
                  >
                    <div className="text-center">
                      <div className="text-xs font-medium tabular-nums">
                        <span className="opacity-70">{side === 'over' ? `o${alt.ln}` : `u${alt.ln}`}</span>
                        <span className="ml-1 font-semibold">{formatOdds(entry.price)}</span>
                      </div>
                    </div>
                  </button>
                </Tooltip>
              );
            };

            return (
              <td key={bookId} className="px-2 py-2 w-auto whitespace-nowrap align-top">
                <div className="flex flex-col gap-1.5">
                  {renderBookOdds('over')}
                  {renderBookOdds('under')}
                </div>
              </td>
            );
          })}
        </motion.tr>
      ))}
    </>
  );
}







