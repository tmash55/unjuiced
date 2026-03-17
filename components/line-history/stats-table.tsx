"use client";

import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  formatOdds,
  computeMoveValue,
  classForMove,
  formatMove,
  relativeTime,
  formatAbsoluteTime,
  parseIsoTimestamp,
} from "@/lib/line-history/utils";
import type { LineHistoryBookData } from "@/lib/odds/line-history";

interface StatsTableProps {
  bookIds: string[];
  bookDataById: Record<string, LineHistoryBookData>;
  isMobile: boolean;
}

export function StatsTable({ bookIds, bookDataById, isMobile }: StatsTableProps) {
  if (bookIds.length === 0) return null;

  const rows = bookIds
    .map((bookId) => {
      const bookData = bookDataById[bookId];
      const meta = getSportsbookById(bookId);
      const name = meta?.name || bookId;
      const color = meta?.brandColor || "#16a34a";
      const logo = meta?.image?.square || meta?.image?.light || null;
      const entries = bookData?.entries || [];
      const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
      const currentDisplayPrice = latestEntry?.price ?? bookData?.currentPrice ?? null;
      const openPrice = entries.length > 0 ? entries[0].price : bookData?.olv.price ?? null;
      const moveValue = computeMoveValue(openPrice, currentDisplayPrice);
      const updatedEpoch =
        latestEntry?.timestamp ??
        parseIsoTimestamp(bookData?.updated) ??
        bookData?.clv.timestamp ??
        bookData?.olv.timestamp ??
        null;

      return {
        bookId,
        bookData,
        name,
        color,
        logo,
        entries,
        currentDisplayPrice,
        moveValue,
        updatedEpoch,
        points: entries.length,
      };
    })
    .sort((a, b) => {
      const aCurrent = a.currentDisplayPrice;
      const bCurrent = b.currentDisplayPrice;
      if (aCurrent != null && bCurrent != null && aCurrent !== bCurrent) return bCurrent - aCurrent;
      if (aCurrent != null && bCurrent == null) return -1;
      if (aCurrent == null && bCurrent != null) return 1;
      return a.name.localeCompare(b.name);
    });

  if (isMobile) {
    return (
      <div className="space-y-2">
        {rows.map((row) => {
          const isNoHistory = row.bookData && (row.bookData.status !== "ok" || row.points === 0);
          return (
            <div key={row.bookId} className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/85 dark:bg-white/[0.04] px-2.5 py-2 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  {row.logo && <img src={row.logo} alt="" className="w-3.5 h-3.5 object-contain" />}
                  <span className="text-[11px] font-semibold truncate">{row.name}</span>
                  {isNoHistory && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10 text-amber-500 dark:text-amber-300 text-[8px] font-semibold">
                      No history
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] font-semibold tabular-nums", classForMove(row.moveValue))}>
                  {formatMove(row.moveValue)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1.5 text-[9px]">
                <div className="rounded-lg bg-neutral-50/80 dark:bg-white/[0.03] px-1.5 py-1.5"><p className="text-neutral-500">OLV</p><p className="font-semibold tabular-nums">{formatOdds(row.bookData?.olv.price ?? null)}</p></div>
                <div className="rounded-lg bg-neutral-50/80 dark:bg-white/[0.03] px-1.5 py-1.5"><p className="text-neutral-500">CLV</p><p className="font-semibold tabular-nums">{formatOdds(row.bookData?.clv.price ?? null)}</p></div>
                <div className="rounded-lg bg-neutral-50/80 dark:bg-white/[0.03] px-1.5 py-1.5"><p className="text-neutral-500">Current</p><p className="font-semibold tabular-nums">{formatOdds(row.currentDisplayPrice)}</p></div>
                <div className="rounded-lg bg-neutral-50/80 dark:bg-white/[0.03] px-1.5 py-1.5"><p className="text-neutral-500">Age</p><p className="text-neutral-400">{row.updatedEpoch ? relativeTime(row.updatedEpoch) : "—"}</p></div>
                <div className="rounded-lg bg-neutral-50/80 dark:bg-white/[0.03] px-1.5 py-1.5"><p className="text-neutral-500">Pts</p><p className="text-neutral-400 tabular-nums">{row.points > 0 ? row.points : "—"}</p></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-white/[0.03]">
      <table className="w-full text-[11px] min-w-[760px]">
        <thead>
          <tr className="text-neutral-500 border-b border-neutral-200/70 dark:border-neutral-800/70 bg-neutral-50/90 dark:bg-white/[0.03]">
            <th className="text-left font-medium py-2.5 pr-3 pl-3">Book</th>
            <th className="text-right font-medium py-2.5 px-2">OLV</th>
            <th className="text-right font-medium py-2.5 px-2">CLV</th>
            <th className="text-right font-medium py-2.5 px-2">Current</th>
            <th className="text-right font-medium py-2.5 px-2">Move</th>
            <th className="text-right font-medium py-2.5 px-2">Age</th>
            <th className="text-right font-medium py-2.5 pl-2 pr-3">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isNoHistory = row.bookData && (row.bookData.status !== "ok" || row.points === 0);
            return (
              <tr key={row.bookId} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-b-0">
                <td className="py-2 pr-3 pl-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                    {row.logo && <img src={row.logo} alt="" className="w-4 h-4 object-contain" />}
                    <span className="font-medium truncate">{row.name}</span>
                    {isNoHistory && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10 text-amber-500 dark:text-amber-300 text-[9px] font-semibold">
                        No history
                      </span>
                    )}
                  </div>
                  {row.updatedEpoch && (
                    <div className="text-[10px] text-neutral-500 mt-0.5">{formatAbsoluteTime(row.updatedEpoch)}</div>
                  )}
                </td>
                <td className="text-right tabular-nums py-2 px-2 font-semibold text-neutral-900 dark:text-white">{formatOdds(row.bookData?.olv.price ?? null)}</td>
                <td className="text-right tabular-nums py-2 px-2 font-semibold text-neutral-900 dark:text-white">{formatOdds(row.bookData?.clv.price ?? null)}</td>
                <td className="text-right tabular-nums py-2 px-2 font-semibold text-neutral-900 dark:text-white">{formatOdds(row.currentDisplayPrice)}</td>
                <td className={cn("text-right tabular-nums py-2 px-2 font-semibold", classForMove(row.moveValue))}>
                  {formatMove(row.moveValue)}
                </td>
                <td className="text-right py-2 px-2 text-neutral-500">{row.updatedEpoch ? relativeTime(row.updatedEpoch) : "—"}</td>
                <td className="text-right tabular-nums py-2 pl-2 pr-3 text-neutral-400">{row.points > 0 ? row.points : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
