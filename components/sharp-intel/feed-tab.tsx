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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 15_000; // 15s
const CLUSTER_WINDOW_MS = 20 * 60 * 1000; // 20 min
const CLUSTER_THRESHOLD = 2; // 2+ signals on same market = cluster

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
  const isClustered = clusterCount >= CLUSTER_THRESHOLD;
  const displayId = formatWalletId(signal.wallet_address);
  const market = signal.event_title ?? signal.market_title;
  const outcome = signal.outcome;

  function handleCardClick(e: React.MouseEvent) {
    // Don't open wallet panel if clicking the follow button
    const target = e.target as HTMLElement;
    if (target.closest("button[data-follow]")) return;
    onSelectWallet?.(signal.wallet_address);
  }

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border transition-all duration-200",
        "cursor-pointer",
        "active:scale-[0.998]",
        isSTier ? [tc.border, tc.cardBg] : tc.border,
        "bg-white dark:bg-neutral-900",
        "hover:border-neutral-300/80 dark:hover:border-neutral-700/60",
        isNew && "animate-[feedSlideIn_0.35s_cubic-bezier(0.16,1,0.3,1)_both]",
      )}
      onClick={handleCardClick}
    >
      {/* Tier stripe */}
      <div className={cn("w-1 shrink-0 rounded-l-xl", tc.stripe)} />

      {/* Content */}
      <div className="flex-1 min-w-0 px-3 py-2.5">
        {/* Row 1: tier badge + action + meta + time */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {/* Wallet tier */}
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-px rounded text-[9px] font-black",
              tc.badge,
            )}
          >
            {walletTier ?? "?"}
          </span>

          {/* Wallet ID */}
          <span className={cn("font-mono text-[11px] font-bold tabular-nums", tc.badgeText)}>
            {displayId}
          </span>

          {/* Action */}
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-black uppercase",
              isBuy
                ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/12 text-red-600 dark:text-red-400",
            )}
          >
            {isBuy ? (
              <TrendingUp className="w-2.5 h-2.5" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5" />
            )}
            {signal.side ?? "—"}
          </span>

          {/* Sport */}
          {signal.sport && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {signal.sport}
            </span>
          )}

          {/* Cluster badge */}
          {isClustered && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-black bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Zap className="w-2 h-2" />
              {clusterCount} signals
            </span>
          )}

          {/* Timestamp */}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {formatTimeAgo(signal.created_at)}
          </span>
        </div>

        {/* Row 2: Market / question */}
        <p className="text-[12px] font-semibold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight line-clamp-2 mb-1">
          {market}
        </p>

        {/* Row 3: outcome + amount + price + follow */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Outcome */}
          <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 truncate max-w-[140px]">
            {outcome}
          </span>

          <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>

          {/* Amount */}
          <span className="font-mono text-[11px] font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatAmount(signal.bet_size)}
          </span>

          {/* Price */}
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

          {/* S-tier wallet ROI — surface extra context */}
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

          {/* Follow button */}
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

function LivePulse({ isRefreshing }: { isRefreshing: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            isRefreshing
              ? "animate-ping bg-sky-400"
              : "animate-ping bg-emerald-400",
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
        {isRefreshing ? "Updating…" : "Live"}
      </span>
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ signals }: { signals: WhaleSignal[] }) {
  const buyCount = signals.filter((s) => s.side?.toUpperCase() === "BUY").length;
  const sellCount = signals.filter((s) => s.side?.toUpperCase() === "SELL").length;
  const sTierCount = signals.filter((s) => (s.wallet_tier ?? s.tier?.toUpperCase()) === "S").length;
  const totalVolume = signals.reduce((sum, s) => sum + (s.bet_size ?? 0), 0);

  if (signals.length === 0) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 px-0.5">
      <span className="tabular-nums text-neutral-600 dark:text-neutral-300 font-semibold">
        {signals.length}
      </span>
      <span>signals</span>

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
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function FeedTab({
  followedWallets = [],
  onToggleFollow,
  onSelectWallet,
}: FeedTabProps) {
  const [tier, setTier] = useState("");
  const [sport, setSport] = useState("");
  const [action, setAction] = useState("");
  const [minAmount, setMinAmount] = useState(0);

  // Track previously seen signal IDs for new-signal animation
  const seenIdsRef = useRef<Set<number>>(new Set());

  // Build API URL
  const params = new URLSearchParams({
    limit: "60",
    sort: "recent",
    resolved: "false",
  });
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

  // Client-side action filter (API doesn't have side param)
  const signals = useMemo(() => {
    if (!action) return allSignals;
    return allSignals.filter(
      (s) => s.side?.toUpperCase() === action.toUpperCase(),
    );
  }, [allSignals, action]);

  // Cluster detection
  const clusterMap = useMemo(() => buildClusterMap(signals), [signals]);

  // Track which signals are "new" (appeared since last render)
  const newIds = useMemo(() => {
    const fresh = new Set<number>();
    for (const s of signals) {
      if (!seenIdsRef.current.has(s.id)) {
        fresh.add(s.id);
      }
    }
    // Update seen set
    for (const s of signals) {
      seenIdsRef.current.add(s.id);
    }
    return fresh;
  }, [signals]);

  const handleToggleFollow = useCallback(
    (addr: string) => {
      onToggleFollow?.(addr);
    },
    [onToggleFollow],
  );

  const currentMinAmountLabel =
    MIN_AMOUNT_OPTIONS.find((o) => o.value === minAmount)?.label ?? "Any size";

  return (
    <div className="space-y-2.5">
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
        {/* Tier segmented */}
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

        {/* Action pills */}
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

        {/* Min amount dropdown */}
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
                  <svg
                    className="h-3 w-3 ml-auto text-sky-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Live indicator */}
        <LivePulse isRefreshing={isValidating && !isLoading} />
      </div>

      {/* Summary bar */}
      {!isLoading && signals.length > 0 && <SummaryBar signals={signals} />}

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

      {/* Signal cards */}
      {!isLoading && !error && signals.length > 0 && (
        <div className="space-y-1.5">
          {signals.map((signal) => {
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
          })}
        </div>
      )}
    </div>
  );
}
