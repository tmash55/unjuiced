"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useActivePlays } from "@/hooks/use-active-plays";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";
import { useSignalPreferences } from "@/hooks/use-signal-preferences";
import { PlayCard } from "./play-card";
import { Loader2, TrendingUp, Zap, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Sport filter pills ───────────────────────────────────────────────────────

const SPORT_OPTIONS: { label: string; value: string }[] = [
  { label: "All Sports", value: "" },
  { label: "NBA", value: "nba" },
  { label: "MLB", value: "mlb" },
  { label: "NHL", value: "nhl" },
  { label: "NFL", value: "nfl" },
  { label: "Soccer", value: "soccer" },
  { label: "Tennis", value: "tennis" },
  { label: "MMA", value: "mma" },
  { label: "Golf", value: "golf" },
];

const LABEL_OPTIONS: { label: string; value: string; color?: string }[] = [
  { label: "All", value: "" },
  { label: "NUCLEAR", value: "NUCLEAR", color: "text-red-500" },
  { label: "STRONG", value: "STRONG", color: "text-orange-500" },
  { label: "LEAN", value: "LEAN", color: "text-sky-500" },
  { label: "WATCH", value: "WATCH", color: "text-neutral-400" },
];

const MIN_SCORE_OPTIONS: { label: string; value: number }[] = [
  { label: "All scores", value: 0 },
  { label: "60+", value: 60 },
  { label: "75+", value: 75 },
  { label: "85+", value: 85 },
  { label: "90+", value: 90 },
];

const SORT_OPTIONS: { label: string; value: "score" | "newest" | "edge" }[] = [
  { label: "Score", value: "score" },
  { label: "Newest", value: "newest" },
  { label: "Edge", value: "edge" },
];

// ── Skeleton loader ──────────────────────────────────────────────────────────

function PlayCardSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 p-3.5 animate-pulse"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-neutral-200 dark:bg-neutral-800/60 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-16 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
              <div className="h-3.5 w-3/4 bg-neutral-200 dark:bg-neutral-800/40 rounded" />
              <div className="h-2.5 w-1/2 bg-neutral-100 dark:bg-neutral-800/30 rounded" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/30 flex gap-4">
            <div className="h-2.5 w-16 bg-neutral-200 dark:bg-neutral-800/40 rounded" />
            <div className="h-2.5 w-12 bg-neutral-200 dark:bg-neutral-800/30 rounded" />
            <div className="h-2.5 w-14 bg-neutral-100 dark:bg-neutral-800/20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Summary stat ─────────────────────────────────────────────────────────────

function SummaryChip({
  count,
  label,
  color,
  icon,
}: {
  count: number;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <span className={cn("flex items-center gap-1 font-bold text-[11px]", color)}>
      {icon}
      {count} {label}
    </span>
  );
}

// ── Score filter segmented control ───────────────────────────────────────────

function ScoreSegmented({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-900/60 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-800/30">
      {MIN_SCORE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-150 whitespace-nowrap",
            value === opt.value
              ? "bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-neutral-100"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export interface PlaysTabProps {
  onSelectPlay?: (play: ActivePlay) => void;
  selectedPlayId?: number | null;
  /** Embed mode — used when rendered inside the right-panel detail view */
  compact?: boolean;
}

export function PlaysTab({
  onSelectPlay,
  selectedPlayId,
  compact = false,
}: PlaysTabProps) {
  const [sport, setSport] = useState("");
  const [label, setLabel] = useState("");
  const [minScore, setMinScore] = useState(60);
  const [sort, setSort] = useState<"score" | "newest" | "edge">("score");

  const { prefs } = useSignalPreferences();
  const hideAfter = prefs.signal_hide_delay ?? -1;

  const { data, isLoading, isFetching, error } = useActivePlays({
    minScore,
    sport: sport || null,
    label: label || null,
    sort,
    hideAfterHours: hideAfter,
  });

  const plays = useMemo(() => data?.plays ?? [], [data]);

  // Filter: suppress "clear" conflict weaker side (double-check client-side)
  const filteredPlays = useMemo(
    () =>
      plays.filter((p) => {
        const opp = p.opposing_side_summary;
        if (opp?.conflict_status === "clear" && p.conflicting_signal === true) {
          return false;
        }
        return true;
      }),
    [plays]
  );

  const nuclearCount = filteredPlays.filter((p) => (p.combined_score ?? p.play_score ?? 0) >= 90).length;
  const strongCount = filteredPlays.filter((p) => {
    const s = p.combined_score ?? p.play_score ?? 0;
    return s >= 75 && s < 90;
  }).length;
  const splitCount = filteredPlays.filter(
    (p) => p.opposing_side_summary?.conflict_status === "split"
  ).length;

  const currentSort = SORT_OPTIONS.find((s) => s.value === sort) ?? SORT_OPTIONS[0];

  return (
    <div className="space-y-3">
      {/* Trust / accuracy banner */}
      {!compact && (
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200/60 dark:border-neutral-800/60 px-4 py-3">
          <div className="flex items-start gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <Shield className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-px" />
            <span>
              Plays scored{" "}
              <span className="font-bold text-neutral-700 dark:text-neutral-200">
                85+
              </span>{" "}
              have historically hit{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                67.4%
              </span>{" "}
              across 20,000+ signals.{" "}
              <span className="text-neutral-400 dark:text-neutral-500">
                90+ hits at{" "}
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                72.2%
              </span>
              .
            </span>
          </div>
        </div>
      )}

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
                : "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filter row 2: min score + label + sort */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Min score segmented */}
        <ScoreSegmented value={minScore} onChange={setMinScore} />

        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700/50 hidden sm:block" />

        {/* Label pills */}
        <div className="flex items-center gap-1">
          {LABEL_OPTIONS.map((l) => (
            <button
              key={l.value}
              onClick={() => setLabel(l.value)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all duration-150",
                label === l.value
                  ? l.value === "NUCLEAR"
                    ? "bg-red-500/15 text-red-500 ring-1 ring-red-500/25"
                    : l.value === "STRONG"
                    ? "bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/25"
                    : l.value === "LEAN"
                    ? "bg-sky-500/15 text-sky-500 ring-1 ring-sky-500/25"
                    : l.value === "WATCH"
                    ? "bg-neutral-500/15 text-neutral-400 ring-1 ring-neutral-500/25"
                    : "bg-sky-500 text-white"
                  : "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Sort dropdown + live indicator */}
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/30 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 outline-none hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
              <svg
                className="h-3 w-3 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5m4.5 4.5V4.5"
                />
              </svg>
              <span className="hidden sm:inline">{currentSort.label}</span>
              <svg
                className="h-3 w-3 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px] p-1">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium cursor-pointer",
                    sort === opt.value &&
                      "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  )}
                >
                  {opt.label}
                  {sort === opt.value && (
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
        </div>
      </div>

      {/* Summary chips */}
      {!isLoading && filteredPlays.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="tabular-nums">{filteredPlays.length} active</span>
          <SummaryChip
            count={nuclearCount}
            label="Nuclear"
            color="text-red-500"
            icon={<Zap className="w-3 h-3" />}
          />
          <SummaryChip
            count={strongCount}
            label="Strong"
            color="text-orange-500"
            icon={<TrendingUp className="w-3 h-3" />}
          />
          {splitCount > 0 && (
            <span className="text-amber-500 font-semibold">
              {splitCount} split
            </span>
          )}
        </div>
      )}

      {/* States */}
      {isLoading && <PlayCardSkeleton n={4} />}

      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-red-400 font-medium">
            Failed to load plays
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Check your connection and try again
          </p>
        </div>
      )}

      {!isLoading && !error && filteredPlays.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
            <svg
              className="w-5 h-5 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            No active plays
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-[200px]">
            Lower the minimum score or select a different sport
          </p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && !error && filteredPlays.length > 0 && (
        <div className="space-y-2">
          {filteredPlays.map((play, idx) => (
            <PlayCard
              key={play.id}
              play={play}
              isSelected={selectedPlayId === play.id}
              onSelect={onSelectPlay}
              animationDelay={Math.min(idx * 40, 200)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
