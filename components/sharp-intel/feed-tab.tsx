"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { WhaleSignal } from "@/lib/polymarket/types";
import { FollowButton } from "./follow-button";
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  ChevronDown,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 15_000;
const CLUSTER_WINDOW_MS = 20 * 60 * 1000;
const CLUSTER_THRESHOLD = 2;
const SURGE_WINDOW_MS = 5 * 60 * 1000;
const SURGE_THRESHOLD = 3;
const FEED_LAST_VIEWED_KEY = "sharp-intel-feed-last-viewed";

const SPORT_OPTIONS = [
  { label: "All", value: "" },
  { label: "NBA", value: "nba" },
  { label: "MLB", value: "mlb" },
  { label: "NHL", value: "nhl" },
  { label: "NFL", value: "nfl" },
  { label: "Soccer", value: "soccer" },
  { label: "Tennis", value: "tennis" },
  { label: "MMA", value: "mma" },
  { label: "Golf", value: "golf" },
];

const TIER_OPTIONS = [
  { label: "All", value: "" },
  { label: "S", value: "S" },
  { label: "A", value: "A" },
  { label: "B", value: "B" },
  { label: "C", value: "C" },
];

const ACTION_OPTIONS = [
  { label: "All", value: "" },
  { label: "BUY", value: "BUY" },
  { label: "SELL", value: "SELL" },
];

const MIN_AMOUNT_OPTIONS = [
  { label: "Any size", value: 0 },
  { label: "$500+", value: 500 },
  { label: "$1k+", value: 1000 },
  { label: "$5k+", value: 5000 },
  { label: "$10k+", value: 10000 },
  { label: "$25k+", value: 25000 },
];

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, {
  stripe: string;
  badge: string;
  badgeText: string;
  cardBg: string;
  border: string;
  glow: boolean;
}> = {
  S: {
    stripe: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-500",
    badgeText: "text-amber-500",
    cardBg: "bg-amber-500/[0.03] dark:bg-amber-500/[0.04]",
    border: "border-amber-500/30 dark:border-amber-500/25",
    glow: true,
  },
  A: {
    stripe: "bg-violet-500",
    badge: "bg-violet-500/15 text-violet-400",
    badgeText: "text-violet-400",
    cardBg: "",
    border: "border-neutral-200/60 dark:border-neutral-800/60",
    glow: false,
  },
  B: {
    stripe: "bg-sky-500",
    badge: "bg-sky-500/15 text-sky-400",
    badgeText: "text-sky-400",
    cardBg: "",
    border: "border-neutral-200/60 dark:border-neutral-800/60",
    glow: false,
  },
  C: {
    stripe: "bg-neutral-400 dark:bg-neutral-600",
    badge: "bg-neutral-500/15 text-neutral-400",
    badgeText: "text-neutral-400",
    cardBg: "",
    border: "border-neutral-200/60 dark:border-neutral-800/60",
    glow: false,
  },
};

function getTierConfig(tier: string | null | undefined) {
  return TIER_CONFIG[tier?.toUpperCase() ?? ""] ?? TIER_CONFIG.C;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPrice(p: number): string {
  return `${(p * 100).toFixed(0)}¢`;
}

function formatTimeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

function formatWalletId(addr: string): string {
  return `#${addr.slice(0, 4).toUpperCase()}`;
}

// ── Cluster detection ─────────────────────────────────────────────────────────

function buildClusterMap(signals: WhaleSignal[]): Map<string, number> {
  const counts = new Map<string, number>();
  const cutoff = Date.now() - CLUSTER_WINDOW_MS;
  for (const s of signals) {
    const key = s.condition_id ?? s.market_title;
    if (!key) continue;
    const ts = new Date(s.created_at).getTime();
    if (ts < cutoff) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// ── Surge detection ───────────────────────────────────────────────────────────

interface SurgeGroup {
  key: string;
  signals: WhaleSignal[];
  market: string;
  tiers: string[];
}

function buildSurgeGroups(signals: WhaleSignal[]): SurgeGroup[] {
  const groups = new Map<string, WhaleSignal[]>();
  const cutoff = Date.now() - SURGE_WINDOW_MS;

  for (const s of signals) {
    const key = s.condition_id ?? s.market_title;
    if (!key) continue;
    if (new Date(s.created_at).getTime() < cutoff) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const result: SurgeGroup[] = [];
  for (const [key, sigs] of groups.entries()) {
    if (sigs.length < SURGE_THRESHOLD) continue;
    const market = sigs[0].event_title ?? sigs[0].market_title ?? key;
    const tiers = [...new Set(
      sigs.map(s => s.wallet_tier ?? s.tier?.toUpperCase()).filter(Boolean) as string[]
    )].sort();
    result.push({ key, signals: sigs, market, tiers });
  }

  return result.sort((a, b) => b.signals.length - a.signals.length);
}

// ── Surge Alert Banner ────────────────────────────────────────────────────────

function SurgeAlertBanner({ surges }: { surges: SurgeGroup[] }) {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const visible = surges.filter(s => !dismissedKeys.has(s.key));
  const top = visible[0];

  useEffect(() => {
    if (!top) return;
    const key = top.key;
    const timer = setTimeout(() => {
      setDismissedKeys(d => new Set([...d, key]));
    }, 30_000);
    return () => clearTimeout(timer);
  }, [top?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!top) return null;

  const tierColors: Record<string, string> = {
    S: "text-amber-500",
    A: "text-violet-400",
    B: "text-sky-400",
    C: "text-neutral-400",
  };

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden cursor-pointer select-none",
        "border border-amber-500/35 dark:border-amber-500/25",
        "bg-amber-500/[0.05] dark:bg-amber-500/[0.04]",
        "shadow-[inset_0_1px_0_rgba(251,191,36,0.1)]",
      )}
      onClick={() => setDismissedKeys(d => new Set([...d, top.key]))}
    >
      {/* Pulsing inner border overlay */}
      <div className="absolute inset-0 rounded-xl border border-amber-400/20 animate-[surgePulse_2s_ease-in-out_infinite] pointer-events-none" />

      <div className="relative flex items-start gap-3 px-3.5 py-3">
        <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-500/12 border border-amber-500/20 flex items-center justify-center mt-px">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Surge
            </span>
            <span className="h-3 w-px bg-amber-500/25 shrink-0" />
            <span className="text-[10px] text-amber-600/70 dark:text-amber-400/60 tabular-nums">
              {top.signals.length} sharps · 5 min
            </span>
            <div className="flex items-center gap-1">
              {top.tiers.slice(0, 4).map(tier => (
                <span
                  key={tier}
                  className={cn(
                    "text-[9px] font-black px-1 py-px rounded bg-amber-500/10",
                    tierColors[tier] ?? "text-neutral-400",
                  )}
                >
                  {tier}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[12px] font-bold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight line-clamp-1">
            {top.market}
          </p>
        </div>

        <button
          className="shrink-0 -mr-0.5 p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          onClick={e => {
            e.stopPropagation();
            setDismissedKeys(d => new Set([...d, top.key]));
          }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {visible.length > 1 && (
        <div className="border-t border-amber-500/10 px-3.5 py-1.5 text-[10px] text-amber-600/60 dark:text-amber-400/50">
          +{visible.length - 1} more {visible.length - 1 === 1 ? "surge" : "surges"} active
        </div>
      )}
    </div>
  );
}

// ── P&L Ticker ────────────────────────────────────────────────────────────────

function PnLTicker({ signals }: { signals: WhaleSignal[] }) {
  const resolved = useMemo(
    () => signals.filter(s => s.pnl !== null && s.result !== null),
    [signals],
  );

  if (resolved.length === 0) return null;

  const totalPnl = resolved.reduce((sum, s) => sum + (s.pnl ?? 0), 0);
  const isPositive = totalPnl >= 0;
  const winCount = resolved.filter(s => s.result === "win").length;
  const lossCount = resolved.filter(s => s.result === "loss").length;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] border",
        "animate-[pnlReveal_0.4s_cubic-bezier(0.16,1,0.3,1)_both]",
        isPositive
          ? "bg-emerald-500/[0.05] border-emerald-500/20 shadow-[inset_0_1px_0_rgba(16,185,129,0.08)]"
          : "bg-red-500/[0.05] border-red-500/20 shadow-[inset_0_1px_0_rgba(239,68,68,0.08)]",
      )}
    >
      <TrendingUp
        className={cn("w-3 h-3 shrink-0", isPositive ? "text-emerald-500" : "text-red-500")}
      />
      <span className="text-neutral-600 dark:text-neutral-400">Sharp wallets</span>
      <span
        className={cn(
          "font-black font-mono tabular-nums",
          isPositive
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        )}
      >
        {isPositive ? "+" : ""}{formatAmount(totalPnl)}
      </span>
      <span className="text-neutral-400 dark:text-neutral-500">
        on {resolved.length} resolved
      </span>
      {(winCount > 0 || lossCount > 0) && (
        <>
          <span className="h-3 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0 ml-auto" />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
            {winCount}W
          </span>
          <span className="text-red-500 dark:text-red-400 font-semibold tabular-nums">
            {lossCount}L
          </span>
        </>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SignalSkeleton({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="flex overflow-hidden rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 animate-pulse"
        >
          <div className="w-1 shrink-0 rounded-l-xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex-1 px-3.5 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-6 bg-neutral-200 dark:bg-neutral-800/70 rounded" />
              <div className="h-4 w-10 bg-neutral-200 dark:bg-neutral-800/60 rounded" />
              <div className="ml-auto h-3 w-12 bg-neutral-100 dark:bg-neutral-800/40 rounded" />
            </div>
            <div className="h-3.5 w-3/4 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
            <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-800/30 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
        <Activity className="w-5 h-5 text-neutral-400" />
      </div>
      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
        No signals yet
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-[200px]">
        Watching for sharp wallet activity — updates every 15 seconds
      </p>
    </div>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────

interface SignalCardProps {
  signal: WhaleSignal;
  isNew: boolean;
  clusterCount: number;
  isFollowing: boolean;
  onToggleFollow: (addr: string) => void;
  onSelectWallet?: (addr: string) => void;
}

function SignalCard({
  signal,
  isNew,
  clusterCount,
  isFollowing,
  onToggleFollow,
  onSelectWallet,
}: SignalCardProps) {
  const walletTier = signal.wallet_tier ?? (signal.tier?.toUpperCase() as string);
  const tc = getTierConfig(walletTier);
  const isBuy = signal.side?.toUpperCase() === "BUY";
  const isSTier = walletTier === "S";
  const isCTier = walletTier === "C";
  const isClustered = clusterCount >= CLUSTER_THRESHOLD;
  const displayId = formatWalletId(signal.wallet_address);
  const market = signal.event_title ?? signal.market_title;
  const outcome = signal.outcome;

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("button[data-follow]")) return;
    onSelectWallet?.(signal.wallet_address);
  }

  // ── C-tier: single-line compact row ──────────────────────────────────────
  if (isCTier) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors duration-150 cursor-pointer",
          "border-neutral-100 dark:border-neutral-800/40",
          "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
          isNew && "animate-[feedSlideIn_0.35s_cubic-bezier(0.16,1,0.3,1)_both]",
        )}
        onClick={handleCardClick}
      >
        <div className="w-0.5 h-4 rounded-full bg-neutral-300 dark:bg-neutral-700 shrink-0" />
        <span className={cn("font-mono text-[10px] font-bold tabular-nums shrink-0", tc.badgeText)}>
          {displayId}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[9px] font-black uppercase shrink-0",
            isBuy ? "text-emerald-500" : "text-red-400",
          )}
        >
          {isBuy ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
          {signal.side}
        </span>
        <span className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate min-w-0">
          {market}
        </span>
        <span className="font-mono text-[10px] font-semibold tabular-nums text-neutral-500 dark:text-neutral-500 shrink-0 ml-auto">
          {formatAmount(signal.bet_size)}
        </span>
        <span className="text-[10px] text-neutral-300 dark:text-neutral-700 shrink-0">
          {formatTimeAgo(signal.created_at)}
        </span>
      </div>
    );
  }

  // ── S/A/B-tier: full card ────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border transition-all duration-200",
        "cursor-pointer active:scale-[0.998]",
        isSTier ? [tc.border, tc.cardBg] : tc.border,
        "bg-white dark:bg-neutral-900",
        "hover:border-neutral-300/80 dark:hover:border-neutral-700/60",
        isSTier && "shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]",
        isNew && "animate-[feedSlideIn_0.35s_cubic-bezier(0.16,1,0.3,1)_both]",
      )}
      onClick={handleCardClick}
    >
      {/* Tier stripe */}
      <div className={cn("w-1 shrink-0 rounded-l-xl", tc.stripe)} />

      {/* Content */}
      <div className={cn("flex-1 min-w-0 px-3", isSTier ? "py-3" : "py-2.5")}>
        {/* Row 1: tier badge + action + meta + time */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-px rounded text-[9px] font-black",
              tc.badge,
            )}
          >
            {walletTier ?? "?"}
          </span>

          <span className={cn("font-mono text-[11px] font-bold tabular-nums", tc.badgeText)}>
            {displayId}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-black uppercase",
              isBuy
                ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/12 text-red-600 dark:text-red-400",
            )}
          >
            {isBuy ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {signal.side ?? "—"}
          </span>

          {signal.sport && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {signal.sport}
            </span>
          )}

          {isClustered && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-black bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Zap className="w-2 h-2" />
              {clusterCount}
            </span>
          )}

          <span className="ml-auto flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {formatTimeAgo(signal.created_at)}
          </span>
        </div>

        {/* Row 2: Market question — S-tier gets larger text */}
        <p
          className={cn(
            "font-semibold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight line-clamp-2 mb-1",
            isSTier ? "text-[13px]" : "text-[12px]",
          )}
        >
          {market}
        </p>

        {/* Row 3: outcome + amount + price + follow */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 truncate max-w-[140px]">
            {outcome}
          </span>

          <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>

          <span className="font-mono text-[11px] font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatAmount(signal.bet_size)}
          </span>

          <span
            className={cn(
              "font-mono text-[10px] font-semibold tabular-nums",
              isBuy
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400",
            )}
          >
            @ {formatPrice(signal.entry_price)}
          </span>

          {isSTier && signal.wallet_roi != null && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span
                className={cn(
                  "text-[10px] font-mono font-semibold tabular-nums",
                  signal.wallet_roi >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400",
                )}
              >
                {signal.wallet_roi >= 0 ? "+" : ""}
                {signal.wallet_roi.toFixed(1)}% ROI
              </span>
            </>
          )}

          <div className="ml-auto shrink-0" data-follow>
            <FollowButton
              isFollowing={isFollowing}
              onToggle={() => onToggleFollow(signal.wallet_address)}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live pulse indicator ──────────────────────────────────────────────────────

function LivePulse({
  isRefreshing,
  recentCount,
}: {
  isRefreshing: boolean;
  recentCount?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            isRefreshing ? "animate-ping bg-sky-400" : "animate-ping bg-emerald-400",
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            isRefreshing ? "bg-sky-500" : "bg-emerald-500",
          )}
        />
      </span>
      <span
        className={cn(
          "text-[10px] font-medium",
          isRefreshing
            ? "text-sky-500 dark:text-sky-400"
            : "text-emerald-500 dark:text-emerald-400",
        )}
      >
        {isRefreshing
          ? "Updating…"
          : recentCount != null
          ? `Live · ${recentCount} last hour`
          : "Live"}
      </span>
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({
  signals,
  unreadCount,
}: {
  signals: WhaleSignal[];
  unreadCount: number;
}) {
  const buyCount = signals.filter((s) => s.side?.toUpperCase() === "BUY").length;
  const sellCount = signals.filter((s) => s.side?.toUpperCase() === "SELL").length;
  const sTierCount = signals.filter(
    (s) => (s.wallet_tier ?? s.tier?.toUpperCase()) === "S",
  ).length;
  const totalVolume = signals.reduce((sum, s) => sum + (s.bet_size ?? 0), 0);

  if (signals.length === 0) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 px-0.5">
      <span className="tabular-nums text-neutral-600 dark:text-neutral-300 font-semibold">
        {signals.length}
      </span>
      <span>signals</span>

      {unreadCount > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[9px] font-black animate-[newBadgePop_0.3s_cubic-bezier(0.16,1,0.3,1)_both]">
          {unreadCount} new
        </span>
      )}

      {buyCount > 0 && (
        <>
          <span className="h-3 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {buyCount}
            </span>
            <span className="text-neutral-400">buy</span>
          </span>
        </>
      )}

      {sellCount > 0 && (
        <>
          <span className="h-3 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <span className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
              {sellCount}
            </span>
            <span className="text-neutral-400">sell</span>
          </span>
        </>
      )}

      {sTierCount > 0 && (
        <>
          <span className="h-3 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
            <Zap className="w-3 h-3" />
            {sTierCount} S-tier
          </span>
        </>
      )}

      <span className="ml-auto font-mono tabular-nums text-neutral-500">
        {formatAmount(totalVolume)} vol
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface FeedTabProps {
  followedWallets?: string[];
  onToggleFollow?: (walletAddress: string) => void;
  onSelectWallet?: (walletAddress: string) => void;
  /** Fires when unread signal count changes — use to show tab badge */
  onUnreadCountChange?: (count: number) => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function FeedTab({
  followedWallets = [],
  onToggleFollow,
  onSelectWallet,
  onUnreadCountChange,
}: FeedTabProps) {
  const [tier, setTier] = useState("");
  const [sport, setSport] = useState("");
  const [action, setAction] = useState("");
  const [minAmount, setMinAmount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const seenIdsRef = useRef<Set<number>>(new Set());
  const lastViewedRef = useRef<number>(0);

  // Load last-viewed timestamp on mount; save current time on unmount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(FEED_LAST_VIEWED_KEY);
    if (stored) lastViewedRef.current = parseInt(stored, 10) || 0;
    return () => {
      localStorage.setItem(FEED_LAST_VIEWED_KEY, String(Date.now()));
    };
  }, []);

  const params = new URLSearchParams({ limit: "60", sort: "recent", resolved: "false" });
  if (tier) params.set("tier", tier);
  if (sport) params.set("sport", sport);
  if (minAmount > 0) params.set("minStake", String(minAmount));

  const { data, isLoading, isValidating, error } = useSWR<{
    signals: WhaleSignal[];
    total: number;
  }>(`/api/polymarket/feed?${params}`, fetcher, {
    refreshInterval: REFRESH_INTERVAL,
    revalidateOnFocus: false,
  });

  const allSignals: WhaleSignal[] = data?.signals ?? [];

  const signals = useMemo(() => {
    if (!action) return allSignals;
    return allSignals.filter((s) => s.side?.toUpperCase() === action.toUpperCase());
  }, [allSignals, action]);

  const clusterMap = useMemo(() => buildClusterMap(signals), [signals]);
  const surgeGroups = useMemo(() => buildSurgeGroups(signals), [signals]);

  const newIds = useMemo(() => {
    const fresh = new Set<number>();
    for (const s of signals) {
      if (!seenIdsRef.current.has(s.id)) fresh.add(s.id);
    }
    for (const s of signals) seenIdsRef.current.add(s.id);
    return fresh;
  }, [signals]);

  // Unread count: signals newer than last-viewed timestamp
  useEffect(() => {
    if (lastViewedRef.current === 0) return;
    const count = signals.filter(
      s => new Date(s.created_at).getTime() > lastViewedRef.current,
    ).length;
    setUnreadCount(count);
    onUnreadCountChange?.(count);
  }, [signals, onUnreadCountChange]);

  const handleToggleFollow = useCallback(
    (addr: string) => { onToggleFollow?.(addr); },
    [onToggleFollow],
  );

  const currentMinAmountLabel =
    MIN_AMOUNT_OPTIONS.find((o) => o.value === minAmount)?.label ?? "Any size";

  const recentSignalCount = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    return signals.filter(s => new Date(s.created_at).getTime() > cutoff).length;
  }, [signals]);

  // Partition signals by tier
  const sTierSignals = signals.filter(
    s => (s.wallet_tier ?? s.tier?.toUpperCase()) === "S",
  );
  const abTierSignals = signals.filter(s => {
    const t = s.wallet_tier ?? s.tier?.toUpperCase();
    return t === "A" || t === "B";
  });
  const cTierSignals = signals.filter(
    s => (s.wallet_tier ?? s.tier?.toUpperCase()) === "C",
  );

  function renderCard(signal: WhaleSignal) {
    const clusterKey = signal.condition_id ?? signal.market_title;
    const clusterCount = clusterKey ? (clusterMap.get(clusterKey) ?? 1) : 1;
    return (
      <SignalCard
        key={signal.id}
        signal={signal}
        isNew={newIds.has(signal.id)}
        clusterCount={clusterCount}
        isFollowing={followedWallets.includes(signal.wallet_address)}
        onToggleFollow={handleToggleFollow}
        onSelectWallet={onSelectWallet}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Surge Alert Banner */}
      {surgeGroups.length > 0 && <SurgeAlertBanner surges={surgeGroups} />}

      {/* P&L Ticker */}
      {!isLoading && signals.length > 0 && <PnLTicker signals={signals} />}

      {/* Filter row 1: sport pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {SPORT_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSport(s.value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all duration-150",
              sport === s.value
                ? "bg-sky-500 text-white"
                : "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filter row 2: tier + action + min amount + live indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-900/60 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-800/30">
          {TIER_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTier(t.value)}
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all duration-150 whitespace-nowrap",
                tier === t.value
                  ? "bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
                t.value === "S" && tier === "S" && "text-amber-600 dark:text-amber-500",
                t.value === "A" && tier === "A" && "text-violet-600 dark:text-violet-400",
                t.value === "B" && tier === "B" && "text-sky-600 dark:text-sky-400",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-700/50 hidden sm:block" />

        <div className="flex items-center gap-1">
          {ACTION_OPTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAction(a.value)}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all duration-150",
                action === a.value
                  ? a.value === "BUY"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25"
                    : a.value === "SELL"
                    ? "bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/25"
                    : "bg-sky-500 text-white"
                  : "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/30 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 outline-none hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
            <Users className="w-3 h-3 text-neutral-400" />
            <span className="hidden sm:inline">{currentMinAmountLabel}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[130px] p-1">
            {MIN_AMOUNT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setMinAmount(opt.value)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium cursor-pointer",
                  minAmount === opt.value &&
                    "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100",
                )}
              >
                {opt.label}
                {minAmount === opt.value && (
                  <svg className="h-3 w-3 ml-auto text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <LivePulse
          isRefreshing={isValidating && !isLoading}
          recentCount={!isLoading ? recentSignalCount : undefined}
        />
      </div>

      {/* Summary bar */}
      {!isLoading && signals.length > 0 && (
        <SummaryBar signals={signals} unreadCount={unreadCount} />
      )}

      {/* Loading state */}
      {isLoading && <SignalSkeleton n={5} />}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-red-400 font-medium">Failed to load feed</p>
          <p className="text-xs text-neutral-500 mt-1">Check your connection and try again</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && signals.length === 0 && <EmptyFeed />}

      {/* Signal cards — tiered hierarchy: S first, then A/B, then C compact */}
      {!isLoading && !error && signals.length > 0 && (
        <div className="space-y-2">
          {/* S-tier: premium treatment with extra breathing room */}
          {sTierSignals.length > 0 && (
            <div className="space-y-1.5">
              {sTierSignals.map(renderCard)}
            </div>
          )}

          {/* A + B-tier: standard cards */}
          {abTierSignals.length > 0 && (
            <div className={cn("space-y-1.5", sTierSignals.length > 0 && "pt-0.5")}>
              {abTierSignals.map(renderCard)}
            </div>
          )}

          {/* C-tier: compact single-line entries under a divider */}
          {cTierSignals.length > 0 && (
            <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800/40">
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600 mb-1 px-0.5">
                Lower tier
              </p>
              <div className="space-y-0.5">
                {cTierSignals.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
