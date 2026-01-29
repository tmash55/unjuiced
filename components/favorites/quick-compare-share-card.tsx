"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";

export interface ShareLeg {
  playerName: string;
  market: string;
  line: number;
  side: string;
}

export interface ShareBookOdds {
  bookId: string;
  price: string;
}

interface QuickCompareShareCardProps {
  /** Array of legs in this combo */
  legs: ShareLeg[];
  /** Best book info */
  bestBookId: string;
  bestOdds: string;
  /** Secondary books (2-3 max) */
  secondaryBooks?: ShareBookOdds[];
}

const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

const getBookName = (bookId?: string): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

const formatOdds = (price: number | string | null | undefined): string => {
  if (price === undefined || price === null) return "—";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (Number.isNaN(num)) return "—";
  return num > 0 ? `+${Math.round(num)}` : `${Math.round(num)}`;
};

const formatSide = (side: string): string => {
  if (side === "over" || side === "o") return "O";
  if (side === "under" || side === "u") return "U";
  if (side === "yes") return "Yes";
  if (side === "no") return "No";
  return side.charAt(0).toUpperCase();
};

export function QuickCompareShareCard({
  legs,
  bestBookId,
  bestOdds,
  secondaryBooks = [],
}: QuickCompareShareCardProps) {
  const totalLegs = legs.length;
  const bestBookLogo = getBookLogo(bestBookId);
  const bestBookName = getBookName(bestBookId);

  // Take max 3 secondary books
  const displaySecondary = useMemo(() => {
    return secondaryBooks.slice(0, 3);
  }, [secondaryBooks]);

  return (
    <div 
      className="w-[400px] bg-[#0a0a0a] text-white overflow-hidden flex flex-col"
      style={{ aspectRatio: "4/5" }}
    >
      {/* Gradient accent bar */}
      <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />

      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">
          {totalLegs}-leg combo
        </h1>
        <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">
          Quick Compare
        </div>
      </div>

      {/* Legs Summary */}
      <div className="mx-5 mb-4 space-y-1.5 shrink-0">
        {legs.map((leg, i) => (
          <div 
            key={i}
            className="px-3 py-2 rounded-lg bg-neutral-900/60 border border-neutral-800/50"
          >
            <div className="text-sm font-medium truncate">{leg.playerName}</div>
            <div className="text-[11px] text-neutral-500">
              {formatSide(leg.side)} {leg.line} {leg.market}
            </div>
          </div>
        ))}
      </div>

      {/* Best Odds Hero */}
      <div className="mx-5 mb-3 p-4 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-emerald-800/40 shrink-0">
        <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium mb-2">
          Best Price
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {bestBookLogo ? (
              <img src={bestBookLogo} alt={bestBookName} className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-neutral-800 flex items-center justify-center text-xs font-bold">
                {bestBookName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-xs text-neutral-400">{bestBookName}</div>
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 tabular-nums">
            {formatOdds(bestOdds)}
          </div>
        </div>
      </div>

      {/* Secondary Books */}
      {displaySecondary.length > 0 && (
        <div className="mx-5 mb-3 space-y-1 shrink-0">
          {displaySecondary.map((book) => {
            const logo = getBookLogo(book.bookId);
            const name = getBookName(book.bookId);
            return (
              <div 
                key={book.bookId}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-900/40"
              >
                <div className="flex items-center gap-2">
                  {logo ? (
                    <img src={logo} alt={name} className="h-5 w-5 object-contain" />
                  ) : (
                    <span className="text-[9px] text-neutral-600 font-medium">{name.slice(0, 3)}</span>
                  )}
                  <span className="text-xs text-neutral-400">{name}</span>
                </div>
                <span className="text-sm font-semibold text-neutral-300 tabular-nums">
                  {formatOdds(book.price)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer - Branding */}
      <div className="px-5 py-4 flex items-center justify-center border-t border-neutral-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Unjuiced" className="h-5 w-5 object-contain opacity-80" />
          <span className="text-xs font-semibold text-neutral-300">unjuiced.bet</span>
        </div>
      </div>
    </div>
  );
}
