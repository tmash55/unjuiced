"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { WhaleSignal, BookOdds } from "@/lib/polymarket/types";
import { InsiderCard } from "./insider-card";
import { KellySizer } from "./kelly-sizer";
import { ChevronDown, ChevronUp } from "lucide-react";

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/** Convert Polymarket price (0-1) to American odds string */
function centsToAmerican(price: number): string {
  if (price <= 0 || price >= 1) return "—";
  if (price <= 0.5) return `+${Math.round((1 / price - 1) * 100)}`;
  return `-${Math.round((price / (1 - price)) * 100)}`;
}

export function SignalCard({ signal }: { signal: WhaleSignal }) {
  const [booksOpen, setBooksOpen] = useState(false);

  const polyImplied = signal.implied_probability ?? signal.entry_price;
  const bookImplied = signal.best_book_decimal ? 1 / signal.best_book_decimal : null;

  const score = signal.signal_score ?? 0;
  const scoreLabel = signal.signal_label ?? "👀";

  const shares = signal.entry_price > 0
    ? Math.round(signal.bet_size / signal.entry_price)
    : 0;
  const priceCents = Math.round(signal.entry_price * 100);
  const americanOdds = centsToAmerican(signal.entry_price);

  const allBooks: BookOdds[] = signal.all_book_odds ?? [];

  const scoreBorder =
    score >= 8
      ? "border-amber-500/40 hover:border-amber-500/60"
      : score >= 6
        ? "border-sky-500/30 hover:border-sky-500/50"
        : "border-neutral-800 hover:border-neutral-700";

  return (
    <div className={cn("rounded-lg border bg-neutral-900/60 p-4 space-y-3 transition-colors", scoreBorder)}>
      {/* Row 1: Score + Insider + Result */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold",
              score >= 8
                ? "bg-amber-500/20 text-amber-300"
                : score >= 6
                  ? "bg-sky-500/15 text-sky-400"
                  : score >= 4
                    ? "bg-neutral-700/50 text-neutral-300"
                    : "bg-neutral-800/50 text-neutral-500"
            )}
          >
            <span>{scoreLabel}</span>
            <span>{score.toFixed(1)}</span>
          </div>
          <InsiderCard
            walletAddress={signal.wallet_address}
            tier={signal.wallet_tier ?? signal.tier ?? "C"}
            roi={signal.wallet_roi}
            record={signal.wallet_record}
          />
        </div>
        {signal.resolved && signal.result && (
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded",
              signal.result === "win"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            )}
          >
            {signal.result === "win" ? "W" : "L"}
            {signal.pnl != null && ` ${signal.pnl >= 0 ? "+" : ""}${formatMoney(signal.pnl)}`}
          </span>
        )}
      </div>

      {/* Row 2: Market title + side */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-100 leading-tight">
          {signal.market_title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          {signal.sport && (
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
              {signal.sport}
            </span>
          )}
          <span
            className={cn(
              "text-xs font-bold",
              signal.side === "YES" ? "text-emerald-400" : "text-red-400"
            )}
          >
            {signal.side}
          </span>
        </div>
      </div>

      {/* Row 3: Shares & Entry — the hero line */}
      <div className="bg-neutral-800/50 rounded-md px-3 py-2">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg font-bold text-neutral-100">
            {shares.toLocaleString()} shares
          </span>
          <span className="text-neutral-500">·</span>
          <span className="text-sm font-semibold text-neutral-200">
            {formatMoney(signal.bet_size)}
          </span>
          <span className="text-sm text-neutral-400">
            at {priceCents}¢
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs">
          <span className="text-sky-400 font-semibold">{americanOdds}</span>
          {/* TODO: Fetch and show live/current Polymarket price here */}
          {signal.stake_vs_avg != null && (
            <span className={cn(
              "font-medium",
              signal.stake_vs_avg >= 2 ? "text-amber-400" : "text-neutral-400"
            )}>
              {signal.stake_vs_avg}x avg
            </span>
          )}
          {signal.best_book && signal.best_book_decimal && (
            <span className="text-neutral-400">
              Best: <span className="text-sky-400 font-semibold">
                {centsToAmerican(1 / signal.best_book_decimal)}
              </span>
              <span className="text-neutral-600 ml-1">{signal.best_book}</span>
            </span>
          )}
        </div>
      </div>

      {/* Row 4: All-books odds (collapsible) */}
      {allBooks.length > 0 && (
        <div>
          <button
            onClick={() => setBooksOpen(!booksOpen)}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {booksOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{allBooks.length} book{allBooks.length !== 1 ? "s" : ""} available</span>
          </button>
          {booksOpen && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {allBooks.map((b, i) => {
                const bookAmerican = b.american != null
                  ? (b.american > 0 ? `+${b.american}` : `${b.american}`)
                  : b.decimal != null
                    ? centsToAmerican(1 / b.decimal)
                    : "—";
                return (
                  <div
                    key={`${b.book}-${i}`}
                    className="flex items-center justify-between bg-neutral-800/60 rounded px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-neutral-300 font-medium truncate mr-2">
                      {b.displayBook ?? b.book}
                    </span>
                    <span className="text-sky-400 font-bold whitespace-nowrap">
                      {bookAmerican}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Kelly sizing */}
      {polyImplied && bookImplied && (
        <KellySizer polyImplied={polyImplied} bookImplied={bookImplied} />
      )}

      {/* Timestamp */}
      <div className="text-[10px] text-neutral-600">
        {new Date(signal.created_at).toLocaleString()}
      </div>
    </div>
  );
}
