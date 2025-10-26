"use client";

import React from "react";
import { EVRow, formatEV, getBestEV } from "@/lib/ev-schema";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";

interface EVTableProps {
  data: EVRow[];
  isPro: boolean;
}

export function EVTable({ data, isPro }: EVTableProps) {
  // Detect mobile for deep linking
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth < 768;
  };

  const openBet = (row: EVRow) => {
    const link = isMobile() && row.links.mobile 
      ? row.links.mobile 
      : row.links.desktop || row.links.mobile;
    
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const getSportsbookLogo = (bookId: string) => {
    const book = getSportsbookById(bookId);
    return book?.image?.square || book?.image?.light;
  };

  const getSportsbookName = (bookId: string) => {
    const book = getSportsbookById(bookId);
    return book?.name || bookId;
  };

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : String(odds);
  };

  const humanizeMarket = (mkt: string) => {
    return mkt
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-lg font-medium text-neutral-900 dark:text-white">
          No EV opportunities found
        </div>
        <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Try selecting a different sport or scope
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Sport
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Market
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Line
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Side
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Sportsbook
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Odds
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              EV%
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const ev = getBestEV(row);
            const logo = getSportsbookLogo(row.book);
            const bookName = getSportsbookName(row.book);

            return (
              <tr
                key={row.seid}
                className={cn(
                  "border-b border-neutral-200 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900",
                  idx % 2 === 0 && "bg-neutral-50/50 dark:bg-neutral-900/50"
                )}
              >
                {/* Sport */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                    {row.sport.toUpperCase()}
                  </span>
                </td>

                {/* Market */}
                <td className="px-4 py-3 text-sm text-neutral-900 dark:text-white">
                  {humanizeMarket(row.mkt)}
                </td>

                {/* Line */}
                <td className="px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {row.line}
                </td>

                {/* Side */}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                      row.side === "over"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    )}
                  >
                    {row.side.toUpperCase()}
                  </span>
                </td>

                {/* Sportsbook */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {logo && (
                      <img
                        src={logo}
                        alt={bookName}
                        className="h-5 w-5 object-contain"
                      />
                    )}
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {bookName}
                    </span>
                  </div>
                </td>

                {/* Odds */}
                <td className="px-4 py-3 text-sm font-bold text-neutral-900 dark:text-white">
                  {formatOdds(row.odds.am)}
                </td>

                {/* EV% */}
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-sm font-bold",
                      ev >= 5
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : ev >= 3
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
                    )}
                  >
                    {formatEV(ev)}
                  </span>
                </td>

                {/* Action */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openBet(row)}
                    disabled={!row.links.desktop && !row.links.mobile}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      row.links.desktop || row.links.mobile
                        ? "bg-brand text-white hover:bg-brand/90"
                        : "cursor-not-allowed bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-600"
                    )}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Bet Now
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

