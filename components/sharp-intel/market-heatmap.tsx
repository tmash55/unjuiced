"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useActivePlays } from "@/hooks/use-active-plays";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";
import { PickCardV2 } from "./pick-card-v2";
import { useSignalPreferences } from "@/hooks/use-signal-preferences";
import { ChevronDown, Activity, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface GameGroup {
  key: string;
  title: string;
  sport: string;
  gameStartTime: string | null;
  plays: ActivePlay[];
  maxScore: number;
  totalVolume: number;
  totalSharps: number;
  heatScore: number;
  consensus: "strong" | "lean" | "split";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatGameTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

function getHeatConfig(heat: number) {
  if (heat >= 85)
    return {
      bar: "bg-red-500",
      badge: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
      label: "HOT",
      scoreBg: (s: number) => s >= 90 ? "bg-red-500" : "bg-orange-500",
    };
  if (heat >= 70)
    return {
      bar: "bg-orange-500",
      badge: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20",
      label: "ACTIVE",
      scoreBg: (s: number) => s >= 90 ? "bg-red-500" : s >= 75 ? "bg-orange-500" : "bg-amber-500",
    };
  if (heat >= 55)
    return {
      bar: "bg-amber-500",
      badge: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
      label: "WARM",
      scoreBg: (_s: number) => "bg-amber-500",
    };
  return {
    bar: "bg-neutral-400 dark:bg-neutral-700",
    badge: "bg-neutral-100 dark:bg-neutral-800 text-neutral-500",
    label: "WATCH",
    scoreBg: (_s: number) => "bg-neutral-500",
  };
}

function computeConsensus(plays: ActivePlay[]): "strong" | "lean" | "split" {
  if (plays.some((p) => p.conflicting_signal === true)) return "split";
  const top = Math.max(...plays.map((p) => p.play_score));
  return top >= 85 ? "strong" : "lean";
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-base font-black text-neutral-900 dark:text-white tabular-nums leading-none">
        {value}
      </span>
      <span className="text-[10px] text-neutral-400 uppercase tracking-wider mt-1">{label}</span>
    </div>
  );
}

// ── GameHeatCard ─────────────────────────────────────────────────────────────

function GameHeatCard({
  game,
  bankroll,
  riskTolerance,
}: {
  game: GameGroup;
  bankroll?: number | null;
  riskTolerance?: "conservative" | "moderate" | "aggressive";
}) {
  const [expanded, setExpanded] = useState(false);
  const heat = getHeatConfig(game.heatScore);
  const timeStr = formatGameTime(game.gameStartTime);

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden transition-all duration-200",
        "border border-neutral-200/60 dark:border-neutral-800/60",
        "bg-white dark:bg-neutral-900",
        game.heatScore >= 70 && "shadow-sm",
      )}
    >
      {/* Heat indicator bar — left stripe using flex */}
      <div className="flex">
        <div className={cn("w-1 shrink-0 rounded-l-xl", heat.bar)} />

        <div className="flex-1 min-w-0">
          {/* Clickable header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left px-4 py-3.5 group"
          >
            {/* Row 1: Sport + time + heat badge + chevron */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  {game.sport}
                </span>
                {timeStr && (
                  <>
                    <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                    <span className="text-neutral-400 dark:text-neutral-500">{timeStr}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {game.consensus === "split" && (
                  <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    SPLIT
                  </span>
                )}
                {game.consensus === "strong" && (
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">
                    Aligned
                  </span>
                )}
                <span className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded", heat.badge)}>
                  {heat.label}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 shrink-0",
                    expanded && "rotate-180",
                  )}
                />
              </div>
            </div>

            {/* Row 2: Game title */}
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight leading-snug mb-3">
              {game.title}
            </h3>

            {/* Row 3: Stats strip */}
            <div className="flex items-center gap-3 flex-wrap text-[11px]">
              {/* Top score badge */}
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white",
                    heat.scoreBg(game.maxScore),
                  )}
                >
                  {game.maxScore}
                </div>
                <span className="text-neutral-400">top score</span>
              </div>

              <span className="h-3 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />

              <span className="flex items-center gap-1 text-neutral-500">
                <Activity className="w-3 h-3 shrink-0" />
                <span className="font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">
                  {game.plays.length}
                </span>
                {game.plays.length === 1 ? "play" : "plays"}
              </span>

              <span className="h-3 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />

              <span className="flex items-center gap-1 text-neutral-500">
                <Users className="w-3 h-3 shrink-0" />
                <span className="font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">
                  {game.totalSharps}
                </span>
                sharps
              </span>

              <span className="h-3 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />

              <span className="flex items-center gap-1 text-neutral-500">
                <TrendingUp className="w-3 h-3 shrink-0" />
                <span className="font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">
                  {formatMoney(game.totalVolume)}
                </span>
              </span>
            </div>
          </button>

          {/* Expanded: individual plays */}
          {expanded && (
            <div className="border-t border-neutral-200/60 dark:border-neutral-800/40 p-3 space-y-2">
              {game.plays.map((play) => (
                <PickCardV2
                  key={play.id}
                  play={play}
                  bankroll={bankroll}
                  riskTolerance={riskTolerance}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function HeatmapSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 overflow-hidden animate-pulse"
        >
          <div className="flex">
            <div className="w-1 shrink-0 rounded-l-xl bg-neutral-200 dark:bg-neutral-800" />
            <div className="flex-1 px-4 py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-24 bg-neutral-200/80 dark:bg-neutral-800/60 rounded" />
                <div className="h-4 w-14 bg-neutral-200/60 dark:bg-neutral-800/40 rounded-full" />
              </div>
              <div className="h-4 w-3/4 bg-neutral-200/80 dark:bg-neutral-800/60 rounded" />
              <div className="flex gap-3">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-3 w-16 bg-neutral-100 dark:bg-neutral-800/30 rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface MarketHeatmapProps {
  selectedSport?: string;
  excludedSports?: string[];
}

export function MarketHeatmap({ selectedSport = "", excludedSports = [] }: MarketHeatmapProps) {
  const { prefs } = useSignalPreferences();
  const bankroll = prefs.bankroll ?? null;
  const riskTolerance =
    (prefs.risk_tolerance as "conservative" | "moderate" | "aggressive") ?? "moderate";
  const hideAfter = prefs.signal_hide_delay ?? -1;

  const { data, isLoading, isError } = useActivePlays({
    sport: selectedSport || null,
    hideAfterHours: hideAfter,
  });

  const allPlays = data?.plays ?? [];

  // Client-side excluded sports filter
  const plays = excludedSports.length
    ? allPlays.filter((p) => !excludedSports.includes(p.sport))
    : allPlays;

  // Group plays by event (event_slug is the stable game identifier)
  const gameGroups = useMemo<GameGroup[]>(() => {
    const groups = new Map<string, GameGroup>();

    for (const play of plays) {
      const key = play.event_slug || play.market_title || play.condition_id;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: play.market_title,
          sport: play.sport,
          gameStartTime: play.game_start_time,
          plays: [],
          maxScore: 0,
          totalVolume: 0,
          totalSharps: 0,
          heatScore: 0,
          consensus: "lean",
        });
      }
      const g = groups.get(key)!;
      g.plays.push(play);
      g.maxScore = Math.max(g.maxScore, play.play_score);
      g.totalVolume += parseFloat(play.total_sharp_volume ?? "0");
      g.totalSharps += play.sharp_count;
    }

    // Finalize heat score (weighted by max score, play count, and sharp count)
    for (const g of groups.values()) {
      g.heatScore = Math.min(
        100,
        g.maxScore * 0.65 + Math.min(g.plays.length * 8, 20) + Math.min(g.totalSharps * 1.5, 15),
      );
      g.consensus = computeConsensus(g.plays);
      // Sort plays within each game by score descending
      g.plays.sort((a, b) => b.play_score - a.play_score);
    }

    return Array.from(groups.values()).sort((a, b) => b.heatScore - a.heatScore);
  }, [plays]);

  // Summary stats
  const totalPlays = plays.length;
  const totalSharps = gameGroups.reduce((sum, g) => sum + g.totalSharps, 0);
  const mostActiveSport = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const play of plays) {
      counts[play.sport] = (counts[play.sport] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top?.[0]?.toUpperCase() ?? "—";
  }, [plays]);

  // Summary stats bar — show even while loading if we have cached data
  const showStats = !isLoading || totalPlays > 0;

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      {showStats && (
        <div className="flex items-center gap-4 sm:gap-6 px-1 pt-0.5 pb-1 border-b border-neutral-100 dark:border-neutral-800/40">
          <StatPill label="Active plays" value={totalPlays} />
          <span className="h-7 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <StatPill label="Sharp signals" value={totalSharps} />
          <span className="h-7 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <StatPill label="Most active" value={mostActiveSport} />
          {!isLoading && gameGroups.length > 0 && (
            <>
              <span className="h-7 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
              <StatPill label="Games" value={gameGroups.length} />
            </>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && <HeatmapSkeleton />}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-red-400">Failed to load market data.</p>
          <p className="text-xs text-neutral-600 mt-1">Please try again.</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && gameGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-neutral-400">No active markets found</p>
          <p className="text-xs text-neutral-600 mt-1">Try adjusting your sport filter</p>
        </div>
      )}

      {/* Game cards */}
      {!isLoading && !isError && gameGroups.length > 0 && (
        <div className="space-y-2" data-tour="markets-heatmap">
          {gameGroups.map((game) => (
            <GameHeatCard
              key={game.key}
              game={game}
              bankroll={bankroll}
              riskTolerance={riskTolerance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
