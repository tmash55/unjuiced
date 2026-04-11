"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";
import { TierBadge } from "./tier-badge";
import {
  ChevronDown,
  ExternalLink,
  Users,
  TrendingUp,
  Clock,
  Zap,
  DollarSign,
  BarChart3,
} from "lucide-react";

// ── Score badge colors ───────────────────────────────────────────────────────

function getScoreStyle(score: number) {
  if (score >= 90) return { bg: "bg-red-500", text: "text-white", glow: "shadow-red-500/30 shadow-lg", label: "NUCLEAR", labelColor: "text-red-500" };
  if (score >= 75) return { bg: "bg-orange-500", text: "text-white", glow: "shadow-orange-500/20 shadow-md", label: "STRONG", labelColor: "text-orange-500" };
  if (score >= 60) return { bg: "bg-amber-500", text: "text-white", glow: "", label: "LEAN", labelColor: "text-amber-500" };
  if (score >= 45) return { bg: "bg-neutral-500", text: "text-white", glow: "", label: "WATCH", labelColor: "text-neutral-400" };
  return { bg: "bg-neutral-700", text: "text-neutral-300", glow: "", label: "INFO", labelColor: "text-neutral-500" };
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatPrice(p: string | number | null): string {
  if (!p) return "—";
  const n = typeof p === "string" ? parseFloat(p) : p;
  return `${(n * 100).toFixed(0)}¢`;
}

// ── Sport icons ──────────────────────────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  nba: "🏀", mlb: "⚾", nhl: "🏒", soccer: "⚽", tennis: "🎾", mma: "🥊", golf: "⛳", football: "🏈",
};

// ── Kelly Calculator ─────────────────────────────────────────────────────────

function calculateKelly(play: ActivePlay, bankroll: number, riskTolerance: "conservative" | "moderate" | "aggressive", maxBetPct = 5) {
  const p = parseFloat(play.estimated_true_prob ?? "0");
  const price = parseFloat(play.current_poly_price ?? "0");
  if (!bankroll || !p || !price || price >= 1) return null;

  const b = (1 / price) - 1;
  const q = 1 - p;
  const fullKelly = (b * p - q) / b;
  if (fullKelly <= 0) return null;

  const fractions = { conservative: 0.25, moderate: 0.5, aggressive: 1.0 };
  const fraction = fractions[riskTolerance] ?? 0.5;
  const kellyPct = fullKelly * fraction;
  const maxPct = maxBetPct / 100;
  const cappedPct = Math.min(kellyPct, maxPct);

  return {
    betAmount: Math.round(bankroll * cappedPct),
    kellyPct: (cappedPct * 100).toFixed(1),
    edge: ((p - price) * 100).toFixed(1),
  };
}

// ── Main Card ────────────────────────────────────────────────────────────────

export function PickCardV2({
  play,
  bankroll,
  riskTolerance = "moderate",
  isSelected,
  onSelect,
}: {
  play: ActivePlay;
  bankroll?: number | null;
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ss = getScoreStyle(play.play_score);
  const volume = parseFloat(play.total_sharp_volume ?? "0");
  const edge = parseFloat(play.estimated_edge ?? "0");
  const price = parseFloat(play.current_poly_price ?? "0");
  const kelly = bankroll ? calculateKelly(play, bankroll, riskTolerance) : null;
  const opp = play.opposing_side_summary;
  const isSplit = opp?.conflict_status === "split";

  return (
    <div className={cn(
      "rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden transition-all",
      isSplit ? "border-amber-500/30 bg-neutral-50/50 dark:bg-neutral-900/80" :
      isSelected ? "border-brand ring-1 ring-brand/20" : play.play_score >= 90 ? "border-red-500/30" : play.play_score >= 75 ? "border-orange-500/20" : "border-neutral-200/60 dark:border-neutral-800/60"
    )}>
      <button onClick={() => { onSelect?.(); setExpanded(!expanded); }} className="w-full text-left p-4 group">
        {/* Row 1: Score + Market + Sport */}
        <div className="flex items-start gap-3">
          {/* Score badge */}
          <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0", ss.bg, ss.glow)}>
            <span className={cn("text-lg font-black leading-none", ss.text)}>{play.play_score}</span>
          </div>

          {/* Market info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={cn("text-[10px] font-black uppercase tracking-wider", ss.labelColor)}>{ss.label}</span>
              {isSplit && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/20">
                  SPLIT
                </span>
              )}
              <span className="text-[10px] text-neutral-400">{SPORT_EMOJI[play.sport] ?? "🎯"} {play.sport.toUpperCase()}</span>
              {play.game_date && (
                <span className="text-[10px] text-neutral-400">· {play.game_date}</span>
              )}
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight truncate">
              {play.market_title}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn(
                "text-[11px] font-bold",
                play.side === "BUY" ? "text-emerald-500" : "text-red-500"
              )}>
                {play.side} {play.outcome}
              </span>
              <span className="text-[10px] text-neutral-400">@ {formatPrice(play.current_poly_price)}</span>
              {isSplit && opp && (
                <span className="text-[10px] text-amber-500 font-medium">
                  · Split {play.play_score} / {opp.opposing_score} vs {opp.opposing_outcome}
                </span>
              )}
            </div>
          </div>

          <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform shrink-0 mt-1", expanded && "rotate-180")} />
        </div>

        {/* Row 2: Key stats bar */}
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/40">
          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Users className="w-3 h-3" />
            <span className="font-bold text-neutral-300">{play.sharp_count}</span> sharps
          </span>
          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
            <DollarSign className="w-3 h-3" />
            <span className="font-bold text-neutral-300">{formatVolume(volume)}</span> wagered
          </span>
          {edge !== 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <TrendingUp className="w-3 h-3 text-neutral-400" />
              <span className={cn("font-bold", edge > 0 ? "text-emerald-500" : "text-red-500")}>
                {edge > 0 ? "+" : ""}{edge.toFixed(1)}% edge
              </span>
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(play.latest_signal_at)}
          </span>
        </div>

        {/* Row 3: Kelly bet sizing */}
        {kelly && (
          <div className="mt-2 pt-2 border-t border-neutral-100/50 dark:border-neutral-800/20">
            <div className="flex items-center gap-2 text-[11px]">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-neutral-500">Suggested bet:</span>
              <span className="font-black text-neutral-900 dark:text-white">${kelly.betAmount.toLocaleString()}</span>
              <span className="text-neutral-400">({kelly.kellyPct}% Kelly)</span>
            </div>
          </div>
        )}
        {!bankroll && (
          <div className="mt-2 pt-2 border-t border-neutral-100/50 dark:border-neutral-800/20">
            <span className="text-[10px] text-neutral-400">Set bankroll in Settings to see bet sizes</span>
          </div>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-neutral-200/60 dark:border-neutral-800/40 p-4 space-y-4">
          {/* Tier breakdown */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">Sharp Wallets</span>
            <div className="flex items-center gap-3 text-[11px]">
              {play.s_tier_count > 0 && <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/15 text-amber-500">S</span> ×{play.s_tier_count}</span>}
              {play.a_tier_count > 0 && <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/15 text-purple-400">A</span> ×{play.a_tier_count}</span>}
              {play.b_tier_count > 0 && <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/15 text-blue-400">B</span> ×{play.b_tier_count}</span>}
              <span className="text-neutral-400">· {play.signal_ids?.length ?? 0} signals total</span>
            </div>
          </div>

          {/* Market context */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">Market</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-neutral-500 block">Poly Price</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{formatPrice(play.current_poly_price)}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 block">Avg Entry</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{formatPrice(play.avg_entry_price)}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 block">True Prob</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {play.estimated_true_prob ? `${(parseFloat(play.estimated_true_prob) * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 block">Edge</span>
                <span className={cn("text-sm font-bold", edge > 0 ? "text-emerald-500" : edge < 0 ? "text-red-500" : "text-neutral-400")}>
                  {edge > 0 ? "+" : ""}{edge.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Kelly sizing detail */}
          {bankroll && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">Bet Sizing (Kelly)</span>
              <div className="grid grid-cols-3 gap-2">
                {(["conservative", "moderate", "aggressive"] as const).map((risk) => {
                  const k = calculateKelly(play, bankroll, risk);
                  if (!k) return null;
                  return (
                    <div key={risk} className={cn(
                      "rounded-lg p-2.5 text-center",
                      risk === riskTolerance ? "bg-brand/10 ring-1 ring-brand/20" : "bg-neutral-50 dark:bg-neutral-800/40"
                    )}>
                      <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">{risk}</span>
                      <span className={cn("text-sm font-black block mt-0.5", risk === riskTolerance ? "text-brand" : "text-neutral-900 dark:text-white")}>
                        ${k.betAmount.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-neutral-400">{k.kellyPct}% of bankroll</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Polymarket link */}
          {play.event_slug && (
            <a
              href={`https://polymarket.com/event/${play.event_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              View on Polymarket <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Timeline info */}
          <div className="flex items-center justify-between text-[10px] text-neutral-400">
            <span>First signal: {formatTimeAgo(play.first_signal_at)}</span>
            <span>Last signal: {formatTimeAgo(play.latest_signal_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
