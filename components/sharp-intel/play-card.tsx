"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";
import { ChevronDown, Users, TrendingUp, Clock, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Score styling ────────────────────────────────────────────────────────────

export function getScoreStyle(score: number) {
  if (score >= 90)
    return {
      badge: "bg-red-500 text-white shadow-red-500/25 shadow-md",
      label: "NUCLEAR",
      labelColor: "text-red-500 dark:text-red-400",
      border: "border-red-500/25 dark:border-red-500/20",
      ring: "ring-red-500/15",
    };
  if (score >= 75)
    return {
      badge: "bg-orange-500 text-white shadow-orange-500/20 shadow-sm",
      label: "STRONG",
      labelColor: "text-orange-500 dark:text-orange-400",
      border: "border-orange-500/20 dark:border-orange-500/15",
      ring: "ring-orange-500/15",
    };
  if (score >= 60)
    return {
      badge: "bg-sky-500 text-white",
      label: "LEAN",
      labelColor: "text-sky-500 dark:text-sky-400",
      border: "border-sky-500/20 dark:border-sky-500/15",
      ring: "ring-sky-500/15",
    };
  if (score >= 45)
    return {
      badge: "bg-neutral-500 text-white",
      label: "WATCH",
      labelColor: "text-neutral-500 dark:text-neutral-400",
      border: "border-neutral-300/60 dark:border-neutral-700/40",
      ring: "ring-neutral-500/10",
    };
  return {
    badge: "bg-neutral-700 text-neutral-300",
    label: "INFO",
    labelColor: "text-neutral-500 dark:text-neutral-500",
    border: "border-neutral-300/40 dark:border-neutral-700/30",
    ring: "ring-neutral-600/10",
  };
}

// ── Sentiment indicator ──────────────────────────────────────────────────────

function SentimentBar({ sentiment }: { sentiment: ActivePlay["net_sentiment"] }) {
  if (!sentiment) return null;

  const config = {
    strong_yes: { label: "Strong Yes", color: "bg-emerald-500", pct: 85 },
    lean_yes: { label: "Lean Yes", color: "bg-emerald-400", pct: 65 },
    split: { label: "Split", color: "bg-amber-400", pct: 50 },
    lean_no: { label: "Lean No", color: "bg-red-400", pct: 35 },
    strong_no: { label: "Strong No", color: "bg-red-500", pct: 15 },
  }[sentiment] ?? { label: "—", color: "bg-neutral-500", pct: 50 };

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", config.color)}
          style={{ width: `${config.pct}%` }}
        />
      </div>
      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{config.label}</span>
    </div>
  );
}

// ── Wallet tier badges ───────────────────────────────────────────────────────

function WalletTierBadges({ topWallets }: { topWallets: ActivePlay["top_wallets"] }) {
  if (!topWallets || topWallets.length === 0) return null;

  const tierConfig: Record<string, { bg: string; text: string }> = {
    S: { bg: "bg-amber-500/15", text: "text-amber-500" },
    A: { bg: "bg-violet-500/15", text: "text-violet-400" },
    B: { bg: "bg-sky-500/15", text: "text-sky-400" },
    C: { bg: "bg-neutral-500/15", text: "text-neutral-400" },
  };

  // Count per tier
  const counts: Record<string, number> = {};
  for (const w of topWallets) {
    counts[w.tier] = (counts[w.tier] ?? 0) + 1;
  }

  return (
    <div className="flex items-center gap-1">
      {(["S", "A", "B"] as const).map((tier) => {
        const count = counts[tier];
        if (!count) return null;
        const c = tierConfig[tier];
        return (
          <span
            key={tier}
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black",
              c.bg,
              c.text
            )}
          >
            {tier}
            <span className="opacity-70">×{count}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── Volume formatter ─────────────────────────────────────────────────────────

function formatVolume(v: number | string | null): string {
  if (!v) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatEdge(v: string | null): string {
  if (!v) return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

// ── Split conflict banner ────────────────────────────────────────────────────

function SplitBanner({ opp }: { opp: NonNullable<ActivePlay["opposing_side_summary"]> }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20 text-[10px]">
      <svg
        className="w-3 h-3 text-amber-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        />
      </svg>
      <span className="text-amber-600 dark:text-amber-400 font-medium">
        Sharps divided
      </span>
      {opp.opposing_outcome && (
        <span className="text-neutral-500 dark:text-neutral-400">
          · Other side ({opp.opposing_outcome})
          {opp.opposing_score != null && (
            <span className="font-mono font-bold ml-1 text-neutral-400">
              {opp.opposing_score}
            </span>
          )}
          {opp.score_gap != null && (
            <span className="ml-1 text-neutral-500">
              gap {opp.score_gap}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

// ── Main card ────────────────────────────────────────────────────────────────

export interface PlayCardProps {
  play: ActivePlay;
  isSelected?: boolean;
  onSelect?: (play: ActivePlay) => void;
  /** Whether the card can be expanded inline (default: true) */
  expandable?: boolean;
  animationDelay?: number;
}

export function PlayCard({
  play,
  isSelected,
  onSelect,
  expandable = true,
  animationDelay = 0,
}: PlayCardProps) {
  const [expanded, setExpanded] = useState(false);

  const score = play.combined_score ?? play.play_score ?? 0;
  const ss = getScoreStyle(score);
  const opp = play.opposing_side_summary;
  const isSplit = opp?.conflict_status === "split";
  const walletCount = play.wallet_count ?? play.sharp_count ?? 0;
  const volume = play.total_volume ?? play.total_sharp_volume;
  const edge = play.estimated_edge;
  const lastSignal = play.last_signal_at ?? play.latest_signal_at;
  const question = play.market_question ?? play.market_title ?? "";
  const side = play.recommended_side ?? play.outcome ?? "";

  function handleClick() {
    onSelect?.(play);
    if (expandable) setExpanded((e) => !e);
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden",
        "transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "active:scale-[0.998]",
        isSplit
          ? "border-amber-500/25 dark:border-amber-500/20"
          : isSelected
          ? cn("border-sky-500/30 ring-1", ss.ring)
          : score >= 90
          ? ss.border
          : score >= 75
          ? ss.border
          : "border-neutral-200/60 dark:border-neutral-800/60",
        "hover:border-neutral-300/80 dark:hover:border-neutral-700/60",
        "[animation-delay:var(--delay)] opacity-0 animate-[fadeInUp_0.3s_ease_forwards]"
      )}
      style={{ "--delay": `${animationDelay}ms` } as React.CSSProperties}
    >
      <button
        onClick={handleClick}
        className="w-full text-left p-3.5 group"
        aria-expanded={expanded}
      >
        {/* Row 1: Score badge + market info + chevron */}
        <div className="flex items-start gap-3">
          {/* Score badge */}
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0",
              ss.badge
            )}
          >
            <span className="text-base font-black leading-none tabular-nums font-mono">
              {score}
            </span>
          </div>

          {/* Market info */}
          <div className="flex-1 min-w-0">
            {/* Label row */}
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span
                className={cn(
                  "text-[9px] font-black uppercase tracking-wider",
                  ss.labelColor
                )}
              >
                {play.play_label ?? ss.label}
              </span>
              {isSplit && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/12 text-amber-500 ring-1 ring-amber-500/20">
                  SPLIT
                </span>
              )}
              <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                {play.sport}
              </span>
              {play.league && play.league !== play.sport && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">·</span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    {play.league}
                  </span>
                </>
              )}
            </div>

            {/* Question */}
            <h3 className="text-[13px] font-bold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight line-clamp-2">
              {question}
            </h3>

            {/* Recommended side */}
            <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 mt-0.5 truncate">
              {side}
            </p>
          </div>

          {/* Chevron */}
          {expandable && (
            <ChevronDown
              className={cn(
                "w-4 h-4 text-neutral-400 transition-transform duration-200 shrink-0 mt-0.5",
                expanded && "rotate-180"
              )}
            />
          )}
        </div>

        {/* Row 2: Stats bar */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/40">
          {/* Wallet count + tier badges */}
          <span className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <Users className="w-3 h-3" />
            <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
              {walletCount}
            </span>
            <span className="text-neutral-400 dark:text-neutral-500">
              {walletCount === 1 ? "sharp" : "sharps"}
            </span>
          </span>

          {/* Tier badges */}
          <WalletTierBadges topWallets={play.top_wallets} />

          {/* Volume */}
          {volume && (
            <span className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="font-mono font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
                {formatVolume(volume)}
              </span>
              <span className="text-neutral-400 dark:text-neutral-500">vol</span>
            </span>
          )}

          {/* Edge */}
          {edge && parseFloat(edge) !== 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <TrendingUp className="w-3 h-3 text-neutral-400" />
              <span
                className={cn(
                  "font-mono font-bold tabular-nums",
                  parseFloat(edge) > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                )}
              >
                {formatEdge(edge)}
              </span>
            </span>
          )}

          {/* Time since last signal */}
          <span className="flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500 ml-auto">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(lastSignal)}
          </span>
        </div>

        {/* Sentiment bar */}
        {play.net_sentiment && (
          <div className="mt-2">
            <SentimentBar sentiment={play.net_sentiment} />
          </div>
        )}
      </button>

      {/* Expanded section */}
      {expandable && expanded && (
        <div className="border-t border-neutral-100 dark:border-neutral-800/40">
          {/* Split conflict banner */}
          {isSplit && opp && (
            <div className="px-3.5 pt-3">
              <SplitBanner opp={opp} />
            </div>
          )}

          <div className="px-3.5 py-3 space-y-3">
            {/* Wallet tier breakdown */}
            {(play.s_tier_count != null || play.a_tier_count != null || play.b_tier_count != null) && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                  Sharp Wallets
                </p>
                <div className="flex items-center gap-3">
                  {(play.s_tier_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/15 text-amber-500">
                        S
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        ×{play.s_tier_count}
                      </span>
                    </span>
                  )}
                  {(play.a_tier_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-violet-500/15 text-violet-400">
                        A
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        ×{play.a_tier_count}
                      </span>
                    </span>
                  )}
                  {(play.b_tier_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-sky-500/15 text-sky-400">
                        B
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        ×{play.b_tier_count}
                      </span>
                    </span>
                  )}
                  {play.signal_ids && play.signal_ids.length > 0 && (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      · {play.signal_ids.length} total signals
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Top wallets list */}
            {play.top_wallets && play.top_wallets.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                  Top Insiders
                </p>
                <div className="space-y-1">
                  {play.top_wallets.slice(0, 5).map((w, i) => {
                    const tierColors: Record<string, string> = {
                      S: "bg-amber-500/15 text-amber-500",
                      A: "bg-violet-500/15 text-violet-400",
                      B: "bg-sky-500/15 text-sky-400",
                      C: "bg-neutral-500/15 text-neutral-400",
                    };
                    return (
                      <div
                        key={`${w.wallet_address}-${i}`}
                        className="flex items-center gap-2 py-1"
                      >
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black",
                            tierColors[w.tier] ?? tierColors.C
                          )}
                        >
                          {w.tier}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 tabular-nums">
                          #{w.wallet_address.slice(0, 6).toUpperCase()}
                        </span>
                        {w.score > 0 && (
                          <span className="ml-auto font-mono text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">
                            {w.score}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Market data */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {play.current_poly_price && (
                <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 px-2.5 py-2">
                  <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-0.5">
                    Poly Price
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                    {(parseFloat(play.current_poly_price) * 100).toFixed(0)}¢
                  </p>
                </div>
              )}
              {play.avg_entry_price && (
                <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 px-2.5 py-2">
                  <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-0.5">
                    Avg Entry
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                    {(parseFloat(play.avg_entry_price) * 100).toFixed(0)}¢
                  </p>
                </div>
              )}
              {play.estimated_true_prob && (
                <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 px-2.5 py-2">
                  <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-0.5">
                    True Prob
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                    {(parseFloat(play.estimated_true_prob) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
              {edge && (
                <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 px-2.5 py-2">
                  <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-0.5">
                    Edge
                  </p>
                  <p
                    className={cn(
                      "text-sm font-bold font-mono tabular-nums",
                      parseFloat(edge) > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400"
                    )}
                  >
                    {formatEdge(edge)}
                  </p>
                </div>
              )}
            </div>

            {/* Pricing chart placeholder */}
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/40 dark:border-neutral-700/20 h-[80px] flex items-center justify-center">
              <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
                  />
                </svg>
                Price chart
              </div>
            </div>

            {/* Polymarket link */}
            {play.event_slug && (
              <a
                href={`https://polymarket.com/event/${play.event_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center justify-center gap-1.5 w-full py-2 rounded-lg",
                  "text-[11px] font-semibold",
                  "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300",
                  "hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                )}
              >
                View on Polymarket
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </a>
            )}

            {/* Timestamps */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-800/40">
              <span>
                First:{" "}
                <span className="font-mono tabular-nums">
                  {formatTimeAgo(play.first_signal_at)}
                </span>
              </span>
              <span>
                Last:{" "}
                <span className="font-mono tabular-nums">
                  {formatTimeAgo(lastSignal)}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
