"use client";

import { cn } from "@/lib/utils";
import type { WhaleSignal } from "@/lib/polymarket/types";
import { InsiderCard } from "./insider-card";
import { KellySizer } from "./kelly-sizer";

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatOdds(decimal: number): string {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `-${Math.round(100 / (decimal - 1))}`;
}

export function SignalCard({ signal }: { signal: WhaleSignal }) {
  const anonId = `#${signal.wallet_address.slice(0, 4).toUpperCase()}`;
  const polyImplied = signal.implied_probability ?? signal.entry_price;
  const bookImplied = signal.best_book_decimal ? 1 / signal.best_book_decimal : null;

  const score = signal.signal_score ?? 0;
  const scoreLabel = signal.signal_label ?? "👀";

  const scoreBorder =
    score >= 8
      ? "border-amber-500/40 hover:border-amber-500/60"
      : score >= 6
        ? "border-sky-500/30 hover:border-sky-500/50"
        : "border-neutral-800 hover:border-neutral-700";

  return (
    <div className={cn("rounded-lg border bg-neutral-900/60 p-4 space-y-3 transition-colors", scoreBorder)}>
      {/* Header: score + insider + result */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Score badge */}
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

      {/* Market info */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-100 leading-tight">
          {signal.market_title}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
          {signal.sport && (
            <span className="uppercase">{signal.sport}</span>
          )}
          <span
            className={cn(
              "font-bold",
              signal.side === "YES" ? "text-emerald-400" : "text-red-400"
            )}
          >
            {signal.side}
          </span>
          <span>@ {(signal.entry_price * 100).toFixed(0)}¢</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-neutral-400">
        <div>
          <span className="text-neutral-500">Stake: </span>
          <span className="text-neutral-200 font-semibold">{formatMoney(signal.bet_size)}</span>
        </div>
        {signal.stake_vs_avg != null && (
          <div>
            <span className="text-neutral-500">vs Avg: </span>
            <span
              className={cn(
                "font-semibold",
                signal.stake_vs_avg >= 2 ? "text-amber-400" : "text-neutral-300"
              )}
            >
              {signal.stake_vs_avg}x
            </span>
          </div>
        )}
        {signal.best_book && signal.best_book_decimal && (
          <div>
            <span className="text-neutral-500">Best: </span>
            <span className="text-sky-400 font-semibold">
              {formatOdds(signal.best_book_decimal)}
            </span>
            <span className="text-neutral-600 ml-1">{signal.best_book}</span>
          </div>
        )}
      </div>

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
