"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { TierBadge } from "./tier-badge";
import { KellySizer } from "./kelly-sizer";
import type { GameSignal, GameOutcome } from "./game-feed";

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatOdds(american: number): string {
  return american >= 0 ? `+${american}` : `${american}`;
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

const confidenceConfig = {
  strong: { label: "Strong", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500" },
  lean: { label: "Lean", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-500" },
  split: { label: "Split", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-500" },
};

function FlowBar({ outcomes, totalDollars }: { outcomes: GameOutcome[]; totalDollars: number }) {
  if (outcomes.length < 2 || totalDollars === 0) {
    return (
      <div className="w-full h-2 rounded-full bg-emerald-500/60" />
    );
  }

  const pct = (outcomes[0].total_dollars / totalDollars) * 100;

  return (
    <div className="w-full h-2 rounded-full bg-neutral-700 overflow-hidden flex">
      <div
        className="h-full bg-emerald-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
      <div
        className="h-full bg-red-500/60 transition-all duration-500"
        style={{ width: `${100 - pct}%` }}
      />
    </div>
  );
}

export function GameCard({ game }: { game: GameSignal }) {
  const [expanded, setExpanded] = useState(false);
  const conf = confidenceConfig[game.confidence];
  const majority = game.outcomes[0];
  const minority = game.outcomes.length > 1 ? game.outcomes[1] : null;

  // Kelly inputs from majority side
  const polyImplied = majority.avg_entry_price;
  const bookImplied = majority.best_book_decimal
    ? 1 / majority.best_book_decimal
    : null;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3 transition-colors",
        conf.border,
        "bg-neutral-900/60 hover:bg-neutral-900/80"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {game.sport && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                {game.sport}
              </span>
            )}
            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", conf.bg, conf.color)}>
              {conf.label}
            </span>
            {game.resolved && game.consensus_result !== "pending" && (
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  game.consensus_result === "win"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                )}
              >
                {game.consensus_result === "win" ? "✓ WIN" : "✗ LOSS"}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-neutral-100 mt-1.5 leading-tight">
            {game.market_title}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-neutral-500">{timeAgo(game.last_signal_at)}</div>
        </div>
      </div>

      {/* Flow visualization */}
      <div className="space-y-2">
        {/* Majority side */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", conf.dot)} />
            <span className="text-neutral-200 font-medium">{majority.outcome}</span>
            <span className="text-emerald-400 font-bold">{game.flow_pct}%</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <span>{majority.sharp_count} sharp{majority.sharp_count !== 1 ? "s" : ""}</span>
            {majority.whale_count > 0 && (
              <span>· {majority.whale_count} whale{majority.whale_count !== 1 ? "s" : ""}</span>
            )}
            <span className="text-neutral-300 font-semibold">{formatMoney(majority.total_dollars)}</span>
          </div>
        </div>

        <FlowBar outcomes={game.outcomes} totalDollars={game.total_dollars} />

        {/* Minority side (if exists) */}
        {minority && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/60" />
              <span className="text-neutral-400">{minority.outcome}</span>
              <span className="text-red-400">{100 - game.flow_pct}%</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-500">
              <span>{minority.sharp_count} sharp{minority.sharp_count !== 1 ? "s" : ""}</span>
              <span className="text-neutral-400">{formatMoney(minority.total_dollars)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action row: best odds + Kelly */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {majority.best_book && majority.best_book_price && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-neutral-500">Best odds:</span>
              <span className="text-sky-400 font-bold">{majority.best_book_price}</span>
              <span className="text-neutral-600 capitalize">{majority.best_book}</span>
            </div>
          )}
        </div>
        {polyImplied && bookImplied && (
          <KellySizer polyImplied={polyImplied} bookImplied={bookImplied} compact />
        )}
      </div>

      {/* Expand/collapse individual bets */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors w-full"
      >
        {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        <span>
          {expanded ? "Hide" : "Show"} {game.total_bets} individual bet{game.total_bets !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Expanded: individual bets */}
      {expanded && (
        <div className="space-y-2 pt-1 border-t border-neutral-800">
          {game.outcomes.map((outcome) => (
            <div key={outcome.outcome} className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mt-2">
                {outcome.outcome} ({outcome.total_bets} bets)
              </div>
              {outcome.bets.map((bet, i) => (
                <div
                  key={`${bet.anon_id}-${i}`}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-neutral-800/50"
                >
                  <div className="flex items-center gap-2">
                    <TierBadge tier={bet.tier} size="xs" />
                    <span className="text-neutral-400 font-mono">{bet.anon_id}</span>
                    <span className="text-neutral-200 font-semibold">{formatMoney(bet.bet_size)}</span>
                    {bet.american_odds && (
                      <span className="text-neutral-500">@ {formatOdds(bet.american_odds)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {bet.result && (
                      <span
                        className={cn(
                          "font-bold",
                          bet.result === "win" ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {bet.result === "win" ? "W" : "L"}
                      </span>
                    )}
                    <span className="text-neutral-600">{timeAgo(bet.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
