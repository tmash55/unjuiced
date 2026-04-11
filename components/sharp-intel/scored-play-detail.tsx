"use client";

import { cn } from "@/lib/utils";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";
import { TierBadge } from "./tier-badge";
import { ExternalLink, Users, DollarSign, TrendingUp, Clock, Zap, BarChart3, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import useSWR from "swr";
import { useSignalPreferences } from "@/hooks/use-signal-preferences";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatPrice(p: string | number | null): string {
  if (!p) return "—";
  const n = typeof p === "string" ? parseFloat(p) : p;
  return `${(n * 100).toFixed(1)}¢`;
}

function getScoreColor(score: number) {
  if (score >= 90) return { bg: "bg-red-500", text: "text-red-500", bar: "bg-red-500" };
  if (score >= 75) return { bg: "bg-orange-500", text: "text-orange-500", bar: "bg-orange-500" };
  if (score >= 60) return { bg: "bg-amber-500", text: "text-amber-500", bar: "bg-amber-500" };
  if (score >= 45) return { bg: "bg-neutral-500", text: "text-neutral-400", bar: "bg-neutral-500" };
  return { bg: "bg-neutral-700", text: "text-neutral-500", bar: "bg-neutral-600" };
}

const SPORT_EMOJI: Record<string, string> = {
  nba: "🏀", mlb: "⚾", nhl: "🏒", soccer: "⚽", tennis: "🎾", mma: "🥊", golf: "⛳",
};

// Kelly calculator
function calculateKelly(play: ActivePlay, bankroll: number, risk: string, maxPct = 5) {
  const p = parseFloat(play.estimated_true_prob ?? "0");
  const price = parseFloat(play.current_poly_price ?? "0");
  if (!bankroll || !p || !price || price >= 1) return null;
  const b = (1 / price) - 1;
  const q = 1 - p;
  const fk = (b * p - q) / b;
  if (fk <= 0) return null;
  const fracs: Record<string, number> = { conservative: 0.25, moderate: 0.5, aggressive: 1.0 };
  const pct = Math.min(fk * (fracs[risk] ?? 0.5), maxPct / 100);
  return { amount: Math.round(bankroll * pct), pct: (pct * 100).toFixed(1) };
}

interface SignalRow {
  id: number;
  wallet_address: string;
  wallet_tier: string;
  pseudonym: string | null;
  bet_amount: string;
  bet_price: string;
  side: string;
  position_action: string;
  bet_time: string;
  play_score: number;
  convergence_count: number;
}

export function ScoredPlayDetail({ play }: { play: ActivePlay }) {
  const sc = getScoreColor(play.play_score);
  const edge = parseFloat(play.estimated_edge ?? "0");
  const volume = parseFloat(play.total_sharp_volume ?? "0");
  const price = parseFloat(play.current_poly_price ?? "0");
  const trueProb = parseFloat(play.estimated_true_prob ?? "0");
  const { prefs } = useSignalPreferences();
  const bankroll = (prefs as any)?.bankroll ?? null;
  const risk = (prefs as any)?.risk_tolerance ?? "moderate";

  // Fetch signals for this play
  const signalIds = play.signal_ids ?? [];
  const { data: signalsData } = useSWR(
    signalIds.length > 0 ? `/api/polymarket/feed?ids=${signalIds.join(",")}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const signals: SignalRow[] = signalsData?.signals ?? [];

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{SPORT_EMOJI[play.sport] ?? "🎯"}</span>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{play.sport}</span>
          {play.game_date && <span className="text-[10px] text-neutral-500">{play.game_date}</span>}
        </div>
        <h2 className="text-base font-bold text-neutral-900 dark:text-white leading-tight">{play.market_title}</h2>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn("text-sm font-bold", play.side === "BUY" ? "text-emerald-500" : "text-red-500")}>
            {play.side} {play.outcome}
          </span>
          <span className="text-sm text-neutral-400">@ {formatPrice(play.current_poly_price)}</span>
        </div>
      </div>

      {/* Score hero */}
      <div className="flex items-center gap-4">
        <div className={cn("w-16 h-16 rounded-2xl flex flex-col items-center justify-center", sc.bg)}>
          <span className="text-2xl font-black text-white leading-none">{play.play_score}</span>
        </div>
        <div>
          <span className={cn("text-sm font-black uppercase", sc.text)}>{play.play_label}</span>
          <div className="h-2 w-32 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mt-1.5">
            <div className={cn("h-full rounded-full", sc.bar)} style={{ width: `${play.play_score}%` }} />
          </div>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 p-3">
          <span className="text-[10px] text-neutral-500 block">Sharps</span>
          <span className="text-lg font-black text-neutral-900 dark:text-white">{play.sharp_count}</span>
          <div className="flex items-center gap-1.5 mt-1">
            {play.s_tier_count > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/15 text-amber-500">S×{play.s_tier_count}</span>}
            {play.a_tier_count > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-500/15 text-purple-400">A×{play.a_tier_count}</span>}
            {play.b_tier_count > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">B×{play.b_tier_count}</span>}
          </div>
        </div>
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 p-3">
          <span className="text-[10px] text-neutral-500 block">Volume</span>
          <span className="text-lg font-black text-neutral-900 dark:text-white">{formatVolume(volume)}</span>
          <span className="text-[10px] text-neutral-400 block mt-1">avg entry {formatPrice(play.avg_entry_price)}</span>
        </div>
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 p-3">
          <span className="text-[10px] text-neutral-500 block">True Prob</span>
          <span className="text-lg font-black text-neutral-900 dark:text-white">
            {trueProb > 0 ? `${(trueProb * 100).toFixed(1)}%` : "—"}
          </span>
          <span className="text-[10px] text-neutral-400 block mt-1">market {formatPrice(play.current_poly_price)}</span>
        </div>
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 p-3">
          <span className="text-[10px] text-neutral-500 block">Edge</span>
          <span className={cn("text-lg font-black", edge > 0 ? "text-emerald-500" : edge < 0 ? "text-red-500" : "text-neutral-400")}>
            {edge > 0 ? "+" : ""}{edge.toFixed(1)}%
          </span>
          <span className="text-[10px] text-neutral-400 block mt-1">model vs market</span>
        </div>
      </div>

      {/* Kelly sizing */}
      {bankroll && (
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">Bet Sizing (Kelly)</span>
          <div className="grid grid-cols-3 gap-2">
            {(["conservative", "moderate", "aggressive"] as const).map((r) => {
              const k = calculateKelly(play, bankroll, r);
              if (!k) return <div key={r} className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 p-2 text-center text-[10px] text-neutral-400">No edge</div>;
              return (
                <div key={r} className={cn("rounded-lg p-2.5 text-center", r === risk ? "bg-brand/10 ring-1 ring-brand/20" : "bg-neutral-50 dark:bg-neutral-800/40")}>
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">{r}</span>
                  <span className={cn("text-sm font-black block mt-0.5", r === risk ? "text-brand" : "text-neutral-900 dark:text-white")}>
                    ${k.amount.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-neutral-400">{k.pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Signal timeline */}
      {signals.length > 0 && (
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">Signal Timeline ({signals.length})</span>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {signals.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/30">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.side === "BUY" ? "bg-emerald-500" : "bg-red-500")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-neutral-900 dark:text-white truncate">{s.pseudonym || `${s.wallet_address.slice(0, 6)}...`}</span>
                    <TierBadge tier={s.wallet_tier} />
                    <span className={cn("font-bold", s.side === "BUY" ? "text-emerald-500" : "text-red-500")}>{s.side}</span>
                    <span className="text-neutral-400">{formatVolume(parseFloat(s.bet_amount ?? "0"))}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                    <span>@ {formatPrice(s.bet_price)}</span>
                    <span>{s.position_action?.replace(/_/g, " ")}</span>
                    <span>{formatDistanceToNow(new Date(s.bet_time), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-neutral-100 dark:border-neutral-800/40">
        <span>First: {formatDistanceToNow(new Date(play.first_signal_at), { addSuffix: true })}</span>
        <span>Last: {formatDistanceToNow(new Date(play.latest_signal_at), { addSuffix: true })}</span>
      </div>

      {/* Polymarket link */}
      {play.event_slug && (
        <a
          href={`https://polymarket.com/event/${play.event_slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
        >
          View on Polymarket <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
