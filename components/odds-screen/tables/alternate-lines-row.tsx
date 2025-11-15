"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
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
  columnOrder: string[]; // Main column order (entity, event, best-line, average-line)
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
    const selectedLink = isMobile ? (mobileLink || desktopLink) : (desktopLink || mobileLink);
    
    // Debug logging (development only)
    if (process.env.NODE_ENV === 'development' && (desktopLink || mobileLink)) {
      console.log('[AlternateLines] Link selection:', {
        isMobile,
        desktopLink: desktopLink ? desktopLink.substring(0, 50) + '...' : 'none',
        mobileLink: mobileLink ? mobileLink.substring(0, 50) + '...' : 'none',
        selected: selectedLink ? selectedLink.substring(0, 50) + '...' : 'none'
      });
    }
    
    return selectedLink || undefined;
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
      <tr className="bg-neutral-50/50 dark:bg-neutral-900/50">
        <td colSpan={100} className="px-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Loading alternate lines...
            </span>
          </div>
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <tr className="bg-red-50/50 dark:bg-red-900/10">
        <td colSpan={100} className="px-4 py-4">
          <div className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-600 dark:text-red-400">
              Failed to load alternates: {error}
            </span>
          </div>
        </td>
      </tr>
    );
  }

  if (alternates.length === 0) {
    return (
      <tr className="bg-neutral-50/50 dark:bg-neutral-900/50">
        <td colSpan={100} className="px-4 py-4">
          <div className="flex items-center justify-center">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
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
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className={cn(
            "border-l-2 border-blue-400 dark:border-blue-600",
            index % 2 === 0 
              ? "bg-[#F0F9FF] dark:bg-[#0D1626]" 
              : "bg-[#FCFDFF] dark:bg-[#0C121A]"
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
                    "px-4 py-2 text-left sticky left-0 z-10",
                    index % 2 === 0 
                      ? "bg-[#F0F9FF] dark:bg-[#0D1626]" 
                      : "bg-[#FCFDFF] dark:bg-[#0C121A]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {/* Add left padding to align with expand button space */}
                    <div className="w-6 shrink-0" />
                    <div className="h-4 w-0.5 bg-blue-400 dark:bg-blue-600" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Alt Line
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">
                      {formatLine(alt.ln, 'over')} / {formatLine(alt.ln, 'under')}
                    </span>
                  </div>
                </td>
              );
            }
            
            // Event column - empty for now
            if (colId === 'event') {
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
                    <div className="px-2 py-1 text-xs rounded border bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400">-</div>
                  )
                }
                const sb = getSportsbookById(best.bk)
                const bookData = alt.books?.[best.bk]?.[side]
                const link = getPreferredLink(bookData?.u, bookData?.m)
                const content = (
                  <div className="flex items-center justify-center gap-1">
                    {sb?.image?.light && (
                      <img src={sb.image.light} alt={sb.name} className="w-3.5 h-3.5 object-contain" />
                    )}
                    <span className="font-semibold">
                      <span className="opacity-75">{side === 'over' ? `o${alt.ln}` : `u${alt.ln}`}</span>
                      <span className="ml-1">{formatOdds(best.price)}</span>
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
                        className="best-line best-line--sm w-full"
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
                  <div className="space-y-1 text-center">
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
                <td key={colId} className="px-3 py-2">
                  <div className="space-y-1 text-center">
                    <div className="avg-line avg-line--sm">
                      {avgOver !== null ? (
                        <>
                          <span className="opacity-75">o{alt.ln}</span>
                          <span className="font-semibold">/{formatOdds(avgOver)}</span>
                        </>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500">-</span>
                      )}
                    </div>
                    <div className="avg-line avg-line--sm">
                      {avgUnder !== null ? (
                        <>
                          <span className="opacity-75">u{alt.ln}</span>
                          <span className="font-semibold">/{formatOdds(avgUnder)}</span>
                        </>
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
                  <div className="text-center text-xs text-neutral-400 dark:text-neutral-600">-</div>
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
                <div className="sportsbook-cell sportsbook-cell--sm text-center text-xs text-neutral-400 dark:text-neutral-600">-</div>
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
                      'sportsbook-cell sportsbook-cell--sm block w-full mx-auto cursor-pointer font-medium',
                      isBest && 'sportsbook-cell--highlighted'
                    )}
                  >
                    <div className="text-center">
                      <div className="text-xs font-medium">
                        <span className="opacity-75">{side === 'over' ? `o${alt.ln}` : `u${alt.ln}`}</span>
                        <span className="ml-1 font-semibold">{formatOdds(entry.price)}</span>
                      </div>
                    </div>
                  </button>
                </Tooltip>
              );
            };

            return (
              <td key={bookId} className="px-2 py-2 w-auto whitespace-nowrap align-top">
                <div className="flex flex-col gap-1">
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








