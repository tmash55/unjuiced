"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";
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
  strong: {
    label: "Strong",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-l-emerald-500",
    ringBorder: "border-emerald-500/30",
    dot: "bg-emerald-500",
    barFrom: "from-emerald-500",
  },
  lean: {
    label: "Lean",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-l-amber-500",
    ringBorder: "border-amber-500/30",
    dot: "bg-amber-500",
    barFrom: "from-amber-500",
  },
  split: {
    label: "Split",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-l-red-500",
    ringBorder: "border-red-500/30",
    dot: "bg-red-500",
    barFrom: "from-red-500",
  },
};

function FlowBar({ outcomes, totalDollars, conf }: { outcomes: GameOutcome[]; totalDollars: number; conf: typeof confidenceConfig.strong }) {
  if (outcomes.length < 2 || totalDollars === 0) {
    return (
      <div className="w-full h-2.5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full bg-gradient-to-r", conf.barFrom, "to-emerald-500/60")} />
      </div>
    );
  }

  const pct = (outcomes[0].total_dollars / totalDollars) * 100;

  return (
    <div className="w-full h-2.5 rounded-full bg-neutral-800 overflow-hidden flex">
      <motion.div
        className={cn("h-full bg-gradient-to-r", conf.barFrom, "to-emerald-400/80")}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.div
        className="h-full bg-gradient-to-r from-red-500/50 to-red-500/30"
        initial={{ width: 0 }}
        animate={{ width: `${100 - pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export function GameCard({ game }: { game: GameSignal }) {
  const [expanded, setExpanded] = useState(false);
  const conf = confidenceConfig[game.confidence];
  const majority = game.outcomes[0];
  const minority = game.outcomes.length > 1 ? game.outcomes[1] : null;

  const polyImplied = majority.avg_entry_price;
  const bookImplied = majority.best_book_decimal
    ? 1 / majority.best_book_decimal
    : null;

  const bestBookSb = majority.best_book ? getSportsbookById(majority.best_book) : null;

  return (
    <div className={cn(
      "rounded-xl border border-neutral-800/60 border-l-[3px] transition-all duration-200",
      "bg-gradient-to-br from-neutral-900/80 via-neutral-900/60 to-neutral-950/80",
      "hover:from-neutral-800/80 hover:via-neutral-900/60 hover:to-neutral-900/80",
      "hover:shadow-lg hover:shadow-black/20",
      conf.border
    )}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {game.sport && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-md">
                  <SportIcon sport={game.sport} className="w-3 h-3" />
                  {game.sport}
                </span>
              )}
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ring-1",
                conf.bg, conf.color, conf.ringBorder
              )}>
                {conf.label}
              </span>
              {game.resolved && game.consensus_result !== "pending" && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-md ring-1",
                  game.consensus_result === "win"
                    ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
                    : "bg-red-500/15 text-red-400 ring-red-500/30"
                )}>
                  {game.consensus_result === "win" ? "✓ WIN" : "✗ LOSS"}
                </span>
              )}
            </div>
            <h3 className="text-[15px] font-semibold text-white mt-2 leading-snug tracking-tight">
              {game.market_title}
            </h3>
          </div>
          <span className="text-[10px] text-neutral-500 shrink-0 mt-1">{timeAgo(game.last_signal_at)}</span>
        </div>

        {/* Flow visualization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", conf.dot)} />
              <span className="text-neutral-200 font-medium">{majority.outcome}</span>
              <span className={cn("font-bold tabular-nums", conf.color)}>{game.flow_pct}%</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-400">
              <span>{majority.sharp_count} sharp{majority.sharp_count !== 1 ? "s" : ""}</span>
              {majority.whale_count > 0 && (
                <span>· {majority.whale_count} 🐋</span>
              )}
              <span className="text-neutral-200 font-semibold tabular-nums">{formatMoney(majority.total_dollars)}</span>
            </div>
          </div>

          <FlowBar outcomes={game.outcomes} totalDollars={game.total_dollars} conf={conf} />

          {minority && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="text-neutral-500">{minority.outcome}</span>
                <span className="text-red-400 tabular-nums">{100 - game.flow_pct}%</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-500">
                <span>{minority.sharp_count} sharp{minority.sharp_count !== 1 ? "s" : ""}</span>
                <span className="text-neutral-400 tabular-nums">{formatMoney(minority.total_dollars)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Best odds + Kelly */}
        <div className="flex items-center justify-between">
          {majority.best_book && majority.best_book_price && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">Best:</span>
              <span className={cn(
                "font-bold tabular-nums",
                majority.best_book_price.startsWith("+") ? "text-emerald-400" : "text-white"
              )}>
                {majority.best_book_price}
              </span>
              {bestBookSb?.image?.light ? (
                <img src={bestBookSb.image.light} alt={bestBookSb.name} className="h-4 w-4 rounded object-contain" />
              ) : (
                <span className="text-neutral-500 capitalize">{majority.best_book}</span>
              )}
            </div>
          )}
          {polyImplied && bookImplied && (
            <KellySizer polyImplied={polyImplied} bookImplied={bookImplied} compact />
          )}
        </div>
      </div>

      {/* Expand individual bets */}
      <div className="border-t border-neutral-800/50">
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors",
            "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30",
            expanded && "text-neutral-300"
          )}
        >
          <span className="font-medium">
            {expanded ? "Hide" : "Show"} {game.total_bets} individual bet{game.total_bets !== 1 ? "s" : ""}
          </span>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-3">
                {game.outcomes.map((outcome) => (
                  <div key={outcome.outcome} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mt-1 px-1">
                      {outcome.outcome} ({outcome.total_bets} bets)
                    </div>
                    {outcome.bets.map((bet, i) => {
                      const betBookSb = (bet as any).book ? getSportsbookById((bet as any).book) : null;
                      return (
                        <div
                          key={`${bet.anon_id}-${i}`}
                          className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-neutral-800/40 hover:bg-neutral-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <TierBadge tier={bet.tier} size="xs" />
                            <span className="text-neutral-400 font-mono text-[11px]">{bet.anon_id}</span>
                            <span className="text-neutral-200 font-semibold tabular-nums">{formatMoney(bet.bet_size)}</span>
                            {bet.american_odds && (
                              <span className={cn(
                                "tabular-nums font-medium",
                                bet.american_odds >= 0 ? "text-emerald-400" : "text-neutral-400"
                              )}>
                                @ {formatOdds(bet.american_odds)}
                              </span>
                            )}
                            {betBookSb?.image?.light && (
                              <img src={betBookSb.image.light} alt={betBookSb.name} className="h-3.5 w-3.5 rounded object-contain" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {bet.result && (
                              <span className={cn(
                                "font-bold text-[10px] px-1.5 py-0.5 rounded",
                                bet.result === "win"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-red-500/15 text-red-400"
                              )}>
                                {bet.result === "win" ? "W" : "L"}
                              </span>
                            )}
                            <span className="text-neutral-600 text-[10px]">{timeAgo(bet.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
