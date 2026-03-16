"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Trophy, TrendingUp } from "lucide-react";
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";
import type { WhaleSignal, BookOdds } from "@/lib/polymarket/types";
import { InsiderCard } from "./insider-card";
import { KellySizer } from "./kelly-sizer";
import { PriceChart } from "./price-chart";

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function centsToAmerican(price: number): string {
  if (price <= 0 || price >= 1) return "—";
  if (price <= 0.5) return `+${Math.round((1 / price - 1) * 100)}`;
  return `-${Math.round((price / (1 - price)) * 100)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getScoreAccent(score: number) {
  if (score >= 8) return {
    border: "border-l-amber-500",
    scoreBg: "bg-amber-500/20",
    scoreText: "text-amber-300",
    ringColor: "stroke-amber-500",
    ringTrack: "stroke-amber-500/20",
  };
  if (score >= 6) return {
    border: "border-l-emerald-500",
    scoreBg: "bg-emerald-500/15",
    scoreText: "text-emerald-400",
    ringColor: "stroke-emerald-500",
    ringTrack: "stroke-emerald-500/20",
  };
  if (score >= 4) return {
    border: "border-l-sky-500",
    scoreBg: "bg-sky-500/15",
    scoreText: "text-sky-400",
    ringColor: "stroke-sky-500",
    ringTrack: "stroke-sky-500/20",
  };
  return {
    border: "border-l-neutral-600",
    scoreBg: "bg-neutral-700/50",
    scoreText: "text-neutral-400",
    ringColor: "stroke-neutral-500",
    ringTrack: "stroke-neutral-500/20",
  };
}

function ScoreRing({ score, label, accent }: { score: number; label: string; accent: ReturnType<typeof getScoreAccent> }) {
  const pct = Math.min(score / 10, 1);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="3" className={accent.ringTrack} />
        <circle
          cx="22" cy="22" r={r} fill="none" strokeWidth="3"
          className={accent.ringColor}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-xs font-bold leading-none", accent.scoreText)}>
          {score.toFixed(1)}
        </span>
        <span className="text-[8px] text-neutral-500 leading-none mt-0.5">{label}</span>
      </div>
    </div>
  );
}

export function SignalCard({ signal }: { signal: WhaleSignal }) {
  const [booksOpen, setBooksOpen] = useState(false);

  const polyImplied = signal.implied_probability ?? signal.entry_price;
  const bookImplied = signal.best_book_decimal ? 1 / signal.best_book_decimal : null;

  const score = signal.signal_score ?? 0;
  const scoreLabel = signal.signal_label ?? "👀";
  const accent = getScoreAccent(score);

  const shares = signal.entry_price > 0
    ? Math.round(signal.bet_size / signal.entry_price)
    : 0;
  const priceCents = Math.round(signal.entry_price * 100);
  const americanOdds = centsToAmerican(signal.entry_price);
  const isPositive = americanOdds.startsWith("+");

  const allBooks: BookOdds[] = signal.all_book_odds ?? [];

  // Find best book odds for highlighting
  const bestBookId = allBooks.length > 0
    ? allBooks.reduce((best, b) => {
        const bAm = b.american ?? (b.decimal ? (1/b.decimal <= 0.5 ? Math.round((1/(1/b.decimal) - 1)*100) : -Math.round(((1/b.decimal)/(1 - 1/b.decimal))*100)) : -9999);
        const bestAm = best.american ?? -9999;
        return bAm > bestAm ? b : best;
      }, allBooks[0]).book
    : null;

  return (
    <div className={cn(
      "rounded-xl border border-neutral-800/60 border-l-[3px] transition-all duration-200",
      "bg-gradient-to-br from-neutral-900/80 via-neutral-900/60 to-neutral-950/80",
      "hover:from-neutral-800/80 hover:via-neutral-900/60 hover:to-neutral-900/80",
      "hover:shadow-lg hover:shadow-black/20",
      accent.border
    )}>
      {/* Top section */}
      <div className="p-4 pb-3 space-y-3">
        {/* Row 1: Score ring + Insider + Timestamp + Result */}
        <div className="flex items-center gap-3">
          <ScoreRing score={score} label={scoreLabel} accent={accent} />
          <div className="flex-1 min-w-0">
            <InsiderCard
              walletAddress={signal.wallet_address}
              tier={signal.wallet_tier ?? signal.tier ?? "C"}
              roi={signal.wallet_roi}
              record={signal.wallet_record}
            />
            <div className="text-[10px] text-neutral-500 mt-1">{timeAgo(signal.created_at)}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {signal.resolved && signal.result && (
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-lg",
                signal.result === "win"
                  ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
              )}>
                {signal.result === "win" ? "W" : "L"}
                {signal.pnl != null && ` ${signal.pnl >= 0 ? "+" : ""}${formatMoney(signal.pnl)}`}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Market title + badges */}
        <div>
          <h3 className="text-[15px] font-semibold text-white leading-snug tracking-tight">
            {signal.market_title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            {signal.sport && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-md">
                <SportIcon sport={signal.sport} className="w-3 h-3" />
                {signal.sport}
              </span>
            )}
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
              signal.side === "YES"
                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                : "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
            )}>
              {signal.side === "YES" ? "BUY" : "SELL"}
            </span>
          </div>
        </div>

        {/* Row 3: Hero stats */}
        <div className="bg-neutral-800/40 rounded-lg px-3.5 py-2.5 ring-1 ring-neutral-700/50">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-bold text-white tabular-nums tracking-tight">
              {shares.toLocaleString()}
            </span>
            <span className="text-sm text-neutral-400">shares</span>
            <span className="text-neutral-600">·</span>
            <span className="text-base font-semibold text-neutral-200 tabular-nums">
              {formatMoney(signal.bet_size)}
            </span>
            <span className="text-sm text-neutral-500">
              @ {priceCents}¢
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs">
            <span className={cn(
              "font-bold tabular-nums text-sm",
              isPositive ? "text-emerald-400" : "text-white"
            )}>
              {americanOdds}
            </span>
            {signal.stake_vs_avg != null && (
              <span className={cn(
                "inline-flex items-center gap-1 font-medium",
                signal.stake_vs_avg >= 2 ? "text-amber-400" : "text-neutral-400"
              )}>
                <TrendingUp className="w-3 h-3" />
                {signal.stake_vs_avg}x avg
              </span>
            )}
            {signal.best_book && signal.best_book_decimal && (() => {
              const sb = getSportsbookById(signal.best_book);
              const bestOdds = centsToAmerican(1 / signal.best_book_decimal);
              const bestPositive = bestOdds.startsWith("+");
              return (
                <span className="inline-flex items-center gap-1.5 text-neutral-400">
                  <Trophy className="w-3 h-3 text-amber-500/70" />
                  <span className={cn("font-bold tabular-nums", bestPositive ? "text-emerald-400" : "text-white")}>
                    {bestOdds}
                  </span>
                  {sb?.image?.light && (
                    <img src={sb.image.light} alt={sb.name} className="h-4 w-4 rounded object-contain" />
                  )}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Price chart */}
        {signal.token_id && (
          <div>
            <span className="text-[10px] text-neutral-500">Price</span>
            <PriceChart tokenId={signal.token_id} entryPrice={signal.entry_price} />
          </div>
        )}
      </div>

      {/* All-books dropdown */}
      {allBooks.length > 0 && (
        <div className="border-t border-neutral-800/50">
          <button
            onClick={() => setBooksOpen(!booksOpen)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors",
              "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30",
              booksOpen && "text-neutral-300"
            )}
          >
            <span className="font-medium">{allBooks.length} book{allBooks.length !== 1 ? "s" : ""} available</span>
            <motion.div
              animate={{ rotate: booksOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </button>
          <AnimatePresence>
            {booksOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-1">
                  {allBooks.map((b, i) => {
                    const sb = getSportsbookById(b.book);
                    const bookAmerican = b.american != null
                      ? (b.american > 0 ? `+${b.american}` : `${b.american}`)
                      : b.decimal != null
                        ? centsToAmerican(1 / b.decimal)
                        : "—";
                    const isBest = b.book === bestBookId;
                    const oddsPositive = bookAmerican.startsWith("+");

                    return (
                      <div
                        key={`${b.book}-${i}`}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors",
                          isBest
                            ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                            : "bg-neutral-800/40 hover:bg-neutral-800/60"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          {sb?.image?.light ? (
                            <img
                              src={sb.image.light}
                              alt={sb.name}
                              className="h-5 w-5 rounded object-contain"
                            />
                          ) : (
                            <div className="h-5 w-5 rounded bg-neutral-700 flex items-center justify-center text-[8px] font-bold text-neutral-400">
                              {(b.displayBook ?? b.book).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className={cn(
                            "font-medium truncate",
                            isBest ? "text-emerald-300" : "text-neutral-300"
                          )}>
                            {sb?.name ?? b.displayBook ?? b.book}
                          </span>
                          {isBest && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              BEST
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "font-bold tabular-nums",
                          isBest
                            ? "text-emerald-400"
                            : oddsPositive
                              ? "text-emerald-400"
                              : "text-white"
                        )}>
                          {bookAmerican}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Kelly sizing */}
      {polyImplied && bookImplied && (
        <div className="border-t border-neutral-800/50 px-4 py-2.5">
          <KellySizer polyImplied={polyImplied} bookImplied={bookImplied} />
        </div>
      )}
    </div>
  );
}
