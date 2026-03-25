"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMlbMatchupContext } from "@/hooks/use-mlb-matchup-context";
import { MlbHotZoneMatchup } from "@/components/hit-rates/mlb/mlb-hot-zone-matchup";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface MlbBatterSectionsSkeletonProps {
  playerId: number | null;
  gameId: number | null;
  market: string;
  battingHand?: string | null;
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  accent?: "emerald" | "cyan" | "amber" | "violet";
  children: ReactNode;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MLB_LEAGUE_AVG = {
  exitVelo: 88.8,
  hardHitPct: 36.4,
  barrelPct: 7.5,
  sweetSpotPct: 33.0,
  sprintSpeed: 27.0,
  xwOBA: 0.316,
} as const;

const CARD_ACCENT_CLASS: Record<NonNullable<SectionCardProps["accent"]>, string> = {
  emerald:
    "from-emerald-500/25 via-emerald-400/10 to-transparent dark:from-emerald-400/25 dark:via-emerald-300/10",
  cyan:
    "from-cyan-500/25 via-blue-400/10 to-transparent dark:from-cyan-400/25 dark:via-blue-300/10",
  amber:
    "from-amber-500/25 via-orange-400/10 to-transparent dark:from-amber-400/25 dark:via-orange-300/10",
  violet:
    "from-indigo-500/25 via-violet-400/10 to-transparent dark:from-indigo-400/25 dark:via-violet-300/10",
};

// ─── Reusable Sub-Components ────────────────────────────────────────────────────

function SectionCard({ title, subtitle, accent = "cyan", children }: SectionCardProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/95 dark:border-neutral-700/60 dark:bg-neutral-900/65 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br opacity-90",
          CARD_ACCENT_CLASS[accent]
        )}
      />
      <div className="pointer-events-none absolute right-[-20%] top-[-35%] h-40 w-40 rounded-full bg-white/60 blur-3xl dark:bg-white/10" />
      <header className="relative px-5 py-4 border-b border-neutral-200/70 dark:border-neutral-700/60 bg-gradient-to-r from-white/80 via-white/65 to-white/45 dark:from-neutral-900/75 dark:via-neutral-900/65 dark:to-neutral-900/35 backdrop-blur-sm">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
          Matchup Lens
        </p>
        <h3 className="text-sm font-black tracking-wide text-neutral-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{subtitle}</p>
        )}
      </header>
      <div className="relative p-5">{children}</div>
    </section>
  );
}

function FieldRow({ label, value = "-" }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-white/75 dark:bg-neutral-900/55 px-3 py-2.5 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-neutral-900 dark:text-white tabular-nums">
        {value}
      </span>
    </div>
  );
}

function TonePill({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "yellow" | "red";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        tone === "green" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        tone === "yellow" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        tone === "red" &&
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      )}
    >
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300/70 dark:border-neutral-700/60 bg-neutral-50/70 dark:bg-neutral-900/40 py-8">
      <p className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {message}
      </p>
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(70, Math.min(130, value));
  const tone: "green" | "yellow" | "red" =
    value > 105 ? "green" : value < 95 ? "red" : "yellow";

  // Center is at 50%; each unit away from 100 maps proportionally across half the bar
  const deviation = clamped - 100;
  const fillPct = Math.abs(deviation) * (50 / 30);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/50 px-3 py-2.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 w-14 shrink-0">
        {label}
      </span>
      <div className="relative flex-1 h-6 rounded-full border border-neutral-200/80 dark:border-neutral-700/70 bg-neutral-100/90 dark:bg-neutral-800/80 overflow-hidden">
        {/* Center line at 100 */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-neutral-400/90 dark:bg-neutral-500/90 z-10" />
        {deviation !== 0 && (
          <div
            className={cn(
              "absolute top-0 bottom-0 rounded-full shadow-inner",
              tone === "green" && "bg-gradient-to-r from-emerald-500/85 to-emerald-300/70",
              tone === "yellow" && "bg-gradient-to-r from-amber-500/85 to-amber-300/70",
              tone === "red" && "bg-gradient-to-r from-red-500/85 to-red-300/70",
            )}
            style={
              deviation > 0
                ? { left: "50%", width: `${fillPct}%` }
                : { right: "50%", width: `${fillPct}%` }
            }
          />
        )}
      </div>
      <span
        className={cn(
          "text-xs font-black tabular-nums w-10 text-right shrink-0",
          tone === "green" && "text-emerald-600 dark:text-emerald-400",
          tone === "yellow" && "text-amber-600 dark:text-amber-400",
          tone === "red" && "text-red-600 dark:text-red-400",
        )}
      >
        {Math.round(value)}
      </span>
    </div>
  );
}

function AdvancedMetricRow({
  label,
  value,
  leagueAvg,
}: {
  label: string;
  value: number | null;
  leagueAvg: number;
}) {
  if (value === null) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/50 px-3 py-2.5">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
        <span className="text-sm font-semibold text-neutral-400 tabular-nums">-</span>
      </div>
    );
  }

  const pctDiff = leagueAvg !== 0 ? ((value - leagueAvg) / Math.abs(leagueAvg)) * 100 : 0;
  const direction: "above" | "avg" | "below" =
    pctDiff > 2 ? "above" : pctDiff < -2 ? "below" : "avg";

  const arrow = direction === "above" ? "▲" : direction === "below" ? "▼" : "●";
  const arrowColor =
    direction === "above"
      ? "text-emerald-500 dark:text-emerald-400"
      : direction === "below"
        ? "text-red-500 dark:text-red-400"
        : "text-amber-500 dark:text-amber-400";
  const delta = Math.abs(pctDiff);

  const formatted = label.includes("xwOBA")
    ? value.toFixed(3)
    : label.includes("%")
      ? `${value.toFixed(1)}%`
      : label.includes("Speed")
        ? `${value.toFixed(1)} ft/s`
        : label.includes("Velo")
          ? `${value.toFixed(1)} mph`
          : value.toFixed(1);
  const formattedLeagueAvg = label.includes("xwOBA")
    ? leagueAvg.toFixed(3)
    : label.includes("%")
      ? `${leagueAvg.toFixed(1)}%`
      : label.includes("Speed")
        ? `${leagueAvg.toFixed(1)} ft/s`
        : label.includes("Velo")
          ? `${leagueAvg.toFixed(1)} mph`
          : leagueAvg.toFixed(1);

  return (
    <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white tabular-nums">
            {formatted}
          </span>
          <span className={cn("text-[10px] font-bold", arrowColor)}>{arrow}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-neutral-200/90 dark:bg-neutral-700/80 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              direction === "above" && "bg-emerald-500/80",
              direction === "avg" && "bg-amber-500/80",
              direction === "below" && "bg-red-500/80"
            )}
            style={{ width: `${Math.max(8, Math.min(100, delta * 5))}%` }}
          />
        </div>
        <span className={cn("text-[10px] font-bold uppercase tracking-wide", arrowColor)}>
          {delta.toFixed(0)}% vs Avg
        </span>
      </div>
      <div className="mt-1 text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
        League Avg:{" "}
        <span className="tabular-nums">
          {formattedLeagueAvg}
        </span>
      </div>
      <div className="sr-only">
        League average value: {leagueAvg}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
}

function formatInt(value: unknown): string {
  const numeric = asNumber(value);
  if (numeric === null) return "-";
  return `${Math.round(numeric)}`;
}

function formatDecimal(value: unknown, digits: number): string {
  const numeric = asNumber(value);
  if (numeric === null) return "-";
  return numeric.toFixed(digits);
}

function formatBattingAverage(value: unknown): string {
  const numeric = asNumber(value);
  if (numeric === null) return "-";
  const normalized = numeric > 1 ? numeric / 1000 : numeric;
  if (!Number.isFinite(normalized) || normalized < 0) return "-";
  return normalized.toFixed(3).replace(/^0/, "");
}

function getBallparkFactor(
  market: string,
  factors: Array<{
    factor_type: string | null;
    factor_overall: number | null;
    factor_vs_lhb: number | null;
    factor_vs_rhb: number | null;
    season: number | null;
  }> | null,
  battingHand?: string | null,
): { factorType: string; valueText: string } {
  if (!factors || factors.length === 0) {
    return { factorType: "-", valueText: "-" };
  }

  const marketHints: Record<string, string[]> = {
    player_hits: ["hit"],
    player_home_runs: ["home_run", "hr"],
    player_runs_scored: ["run"],
    player_rbi: ["rbi", "run"],
    player_total_bases: ["total_base", "slug", "extra_base"],
  };

  const latestSeason = factors.reduce((max, row) => {
    if (typeof row.season === "number") return Math.max(max, row.season);
    return max;
  }, 0);
  const seasonFactors =
    latestSeason > 0 ? factors.filter((row) => row.season === latestSeason) : factors;

  const hints = marketHints[market] ?? [];
  const matched =
    seasonFactors.find((row) => {
      const type = (row.factor_type ?? "").toLowerCase();
      return hints.some((hint) => type.includes(hint));
    }) ?? seasonFactors[0];

  if (!matched) {
    return { factorType: "-", valueText: "-" };
  }

  const factorValue =
    battingHand === "L"
      ? (matched.factor_vs_lhb ?? matched.factor_overall)
      : battingHand === "R"
        ? (matched.factor_vs_rhb ?? matched.factor_overall)
        : (matched.factor_overall ?? matched.factor_vs_lhb ?? matched.factor_vs_rhb);

  const numeric = asNumber(factorValue);
  if (numeric === null) {
    return {
      factorType: matched.factor_type ?? "-",
      valueText: "-",
    };
  }

  const context = numeric >= 1.05 ? "Hitter+" : numeric <= 0.95 ? "Pitcher+" : "Neutral";

  return {
    factorType: matched.factor_type ?? "-",
    valueText: `${numeric.toFixed(2)}x (${context})`,
  };
}

function normalizeFactor(raw: number): number {
  return raw < 2 ? raw * 100 : raw;
}

function getAllBallparkFactors(
  factors: Array<{
    factor_type: string | null;
    factor_overall: number | null;
    factor_vs_lhb: number | null;
    factor_vs_rhb: number | null;
    season: number | null;
  }> | null,
  battingHand?: string | null,
): Array<{ label: string; value: number }> {
  if (!factors || factors.length === 0) return [];

  const latestSeason = factors.reduce((max, row) => {
    if (typeof row.season === "number") return Math.max(max, row.season);
    return max;
  }, 0);
  const seasonFactors =
    latestSeason > 0 ? factors.filter((row) => row.season === latestSeason) : factors;

  const typeMap: Record<string, string> = {
    home_run: "HR",
    hr: "HR",
    run: "Runs",
    runs: "Runs",
    hit: "Hits",
    hits: "Hits",
    strikeout: "SO",
    so: "SO",
  };

  const results: Array<{ label: string; value: number }> = [];
  const seen = new Set<string>();

  for (const row of seasonFactors) {
    const type = (row.factor_type ?? "").toLowerCase();
    const label = Object.entries(typeMap).find(([hint]) => type.includes(hint))?.[1];
    if (!label || seen.has(label)) continue;
    seen.add(label);

    const factorValue =
      battingHand === "L"
        ? (row.factor_vs_lhb ?? row.factor_overall)
        : battingHand === "R"
          ? (row.factor_vs_rhb ?? row.factor_overall)
          : row.factor_overall;

    const numeric = asNumber(factorValue);
    if (numeric !== null) {
      results.push({ label, value: normalizeFactor(numeric) });
    }
  }

  const order = ["HR", "Runs", "Hits", "SO"];
  return results.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

interface BvpSeasonRow {
  season: number;
  pa: number;
  avg: string;
}

function parseBvpSeasons(raw: Array<Record<string, unknown>> | null): BvpSeasonRow[] {
  if (!raw || raw.length === 0) return [];
  return raw
    .map((row) => {
      const season = asNumber(row.season ?? row.year);
      const pa = asNumber(row.plate_appearances ?? row.pa ?? row.at_bats);
      const avg = formatBattingAverage(row.avg ?? row.batting_average);
      if (season === null) return null;
      return { season, pa: pa ?? 0, avg };
    })
    .filter((r): r is BvpSeasonRow => r !== null)
    .sort((a, b) => b.season - a.season)
    .slice(0, 2);
}

interface BatterAdvancedProfileParsed {
  exitVelo: number | null;
  hardHitPct: number | null;
  barrelPct: number | null;
  sweetSpotPct: number | null;
  sprintSpeed: number | null;
  xwOBA: number | null;
}

function parseBatterAdvancedProfile(
  raw: Array<Record<string, unknown>> | null,
): BatterAdvancedProfileParsed {
  const empty: BatterAdvancedProfileParsed = {
    exitVelo: null,
    hardHitPct: null,
    barrelPct: null,
    sweetSpotPct: null,
    sprintSpeed: null,
    xwOBA: null,
  };
  if (!raw || raw.length === 0) return empty;

  const sorted = [...raw].sort((a, b) => {
    const sa = asNumber(a.season ?? a.year) ?? 0;
    const sb = asNumber(b.season ?? b.year) ?? 0;
    return sb - sa;
  });
  const row = sorted[0];

  return {
    exitVelo: asNumber(row.avg_exit_velocity ?? row.exit_velocity ?? row.ev),
    hardHitPct: asNumber(row.hard_hit_pct ?? row.hard_hit_percent ?? row.hard_hit_rate),
    barrelPct: asNumber(row.barrel_pct ?? row.barrel_percent ?? row.barrel_rate),
    sweetSpotPct: asNumber(row.sweet_spot_pct ?? row.sweet_spot_percent),
    sprintSpeed: asNumber(row.sprint_speed ?? row.speed),
    xwOBA: asNumber(row.xwoba ?? row.x_woba ?? row.expected_woba),
  };
}

interface PitcherAdvancedProfileParsed {
  evAllowed: number | null;
  hardHitPct: number | null;
  barrelPct: number | null;
  gbPct: number | null;
  xBA: number | null;
  xwOBA: number | null;
}

function parsePitcherAdvancedProfile(
  raw: Record<string, unknown> | null,
): PitcherAdvancedProfileParsed {
  const empty: PitcherAdvancedProfileParsed = {
    evAllowed: null,
    hardHitPct: null,
    barrelPct: null,
    gbPct: null,
    xBA: null,
    xwOBA: null,
  };
  if (!raw) return empty;

  return {
    evAllowed: asNumber(raw.avg_exit_velocity ?? raw.exit_velocity ?? raw.ev_allowed ?? raw.ev),
    hardHitPct: asNumber(raw.hard_hit_pct ?? raw.hard_hit_percent),
    barrelPct: asNumber(raw.barrel_pct ?? raw.barrel_percent),
    gbPct: asNumber(raw.ground_ball_pct ?? raw.gb_pct ?? raw.gb_percent),
    xBA: asNumber(raw.xba ?? raw.x_ba ?? raw.expected_ba),
    xwOBA: asNumber(raw.xwoba ?? raw.x_woba ?? raw.expected_woba),
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function MlbBatterSectionsSkeleton({
  playerId,
  gameId,
  market,
  battingHand,
}: MlbBatterSectionsSkeletonProps) {
  const hasRequiredIds = typeof playerId === "number" && typeof gameId === "number";
  const { data, isLoading, isError } = useMlbMatchupContext({
    playerId,
    gameId,
    enabled: hasRequiredIds,
  });

  // ── Loading state: 4 skeleton rectangles in 2x2 grid ──
  if (isLoading) {
    return (
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="relative h-64 overflow-hidden rounded-3xl border border-neutral-200/70 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  // ── Error state: single centered message ──
  if (isError) {
    return (
      <div className="mt-6 rounded-3xl border border-red-200/60 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/20 p-6">
        <p className="text-center text-sm font-semibold text-red-600 dark:text-red-300">
          Unable to load matchup context. Please try again later.
        </p>
      </div>
    );
  }

  // ── Derived data ──
  const pitcher = data?.opposing_pitcher ?? null;
  const pitcherName = pitcher?.name ?? null;
  const pitcherJersey = pitcher?.jersey_number;
  const pitchHand = asString(
    (pitcher as Record<string, unknown> | null)?.pitch_hand,
  );

  const pitcherStats = data?.pitcher_stats ?? [];
  const latestPitcherSeason = pitcherStats[0] ?? null;
  const prevPitcherSeason = pitcherStats[1] ?? null;

  const pitcherAdvanced = parsePitcherAdvancedProfile(data?.pitcher_statcast ?? null);
  const bvpCareer = data?.bvp_career ?? null;
  const bvpSeasons = parseBvpSeasons(data?.bvp_seasons ?? null);
  const batterAdvanced = parseBatterAdvancedProfile(data?.batter_statcast ?? null);
  const parkFactors = getAllBallparkFactors(data?.ballpark_factors ?? null, battingHand);

  const venueName = data?.venue_name ?? null;
  const dayNight = data?.day_night;
  const hasPitcher = pitcherName !== null;

  const hasPitcherAdvancedMetrics =
    pitcherAdvanced.evAllowed !== null ||
    pitcherAdvanced.hardHitPct !== null ||
    pitcherAdvanced.barrelPct !== null ||
    pitcherAdvanced.gbPct !== null ||
    pitcherAdvanced.xBA !== null ||
    pitcherAdvanced.xwOBA !== null;

  const hasBatterAdvancedMetrics =
    batterAdvanced.exitVelo !== null ||
    batterAdvanced.hardHitPct !== null ||
    batterAdvanced.barrelPct !== null ||
    batterAdvanced.sweetSpotPct !== null ||
    batterAdvanced.sprintSpeed !== null ||
    batterAdvanced.xwOBA !== null;

  // Keep getBallparkFactor available (used elsewhere via import pattern)
  void getBallparkFactor;
  void market;

  return (
    <div className="relative mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Card 1: Opposing Pitcher ── */}
      <SectionCard
        title={
          hasPitcher
            ? `${pitcherName}${pitcherJersey != null ? ` #${pitcherJersey}` : ""}`
            : "Opposing Pitcher"
        }
        subtitle="Opposing Pitcher"
        accent="emerald"
      >
        {!hasPitcher ? (
          <EmptyState message="Pitcher not yet announced" />
        ) : (
          <div className="space-y-4">
            {pitchHand && (
              <div className="flex items-center gap-2">
                <TonePill
                  label={pitchHand === "L" ? "LHP" : "RHP"}
                  tone={pitchHand === "L" ? "yellow" : "green"}
                />
                {latestPitcherSeason?.season ? (
                  <span className="rounded-full border border-neutral-200/70 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 dark:border-neutral-700/60 dark:bg-neutral-900/55 dark:text-neutral-300">
                    {latestPitcherSeason.season} split
                  </span>
                ) : null}
              </div>
            )}

            {latestPitcherSeason && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                  {latestPitcherSeason.season
                    ? `${latestPitcherSeason.season} Performance`
                    : "Season Stats"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="ERA" value={formatDecimal(latestPitcherSeason.era, 2)} />
                  <FieldRow label="WHIP" value={formatDecimal(latestPitcherSeason.whip, 2)} />
                  <FieldRow label="K/9" value={formatDecimal(latestPitcherSeason.k_per_9, 1)} />
                  <FieldRow label="BB/9" value={formatDecimal(latestPitcherSeason.bb_per_9, 1)} />
                  <FieldRow
                    label="IP"
                    value={formatDecimal(latestPitcherSeason.innings_pitched, 1)}
                  />
                  <FieldRow label="GS" value={formatInt(latestPitcherSeason.games_started)} />
                </div>
              </div>
            )}

            {hasPitcherAdvancedMetrics && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                  Advanced Metrics
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow
                    label="EV Allowed"
                    value={
                      pitcherAdvanced.evAllowed !== null
                        ? `${pitcherAdvanced.evAllowed.toFixed(1)} mph`
                        : "-"
                    }
                  />
                  <FieldRow
                    label="Hard Hit%"
                    value={
                      pitcherAdvanced.hardHitPct !== null
                        ? `${pitcherAdvanced.hardHitPct.toFixed(1)}%`
                        : "-"
                    }
                  />
                  <FieldRow
                    label="Barrel%"
                    value={
                      pitcherAdvanced.barrelPct !== null
                        ? `${pitcherAdvanced.barrelPct.toFixed(1)}%`
                        : "-"
                    }
                  />
                  <FieldRow
                    label="GB%"
                    value={
                      pitcherAdvanced.gbPct !== null
                        ? `${pitcherAdvanced.gbPct.toFixed(1)}%`
                        : "-"
                    }
                  />
                  <FieldRow
                    label="xBA"
                    value={pitcherAdvanced.xBA !== null ? pitcherAdvanced.xBA.toFixed(3) : "-"}
                  />
                  <FieldRow
                    label="xwOBA"
                    value={
                      pitcherAdvanced.xwOBA !== null ? pitcherAdvanced.xwOBA.toFixed(3) : "-"
                    }
                  />
                </div>
              </div>
            )}

            {prevPitcherSeason && (
              <p className="rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-neutral-50/80 dark:bg-neutral-900/45 px-3 py-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {prevPitcherSeason.season}: {formatDecimal(prevPitcherSeason.era, 2)} ERA,{" "}
                {formatDecimal(prevPitcherSeason.whip, 2)} WHIP
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Card 2: Ballpark Context ── */}
      <SectionCard
        title="Ballpark Context"
        subtitle={
          venueName
            ? `${venueName}${dayNight ? ` · ${dayNight === "D" ? "Day Game" : dayNight === "N" ? "Night Game" : dayNight}` : ""}`
            : undefined
        }
        accent="cyan"
      >
        {parkFactors.length === 0 ? (
          <EmptyState
            message={
              venueName
                ? `${venueName} — Park factor data unavailable`
                : "Park factor data unavailable"
            }
          />
        ) : (
          <div className="space-y-2">
            {parkFactors.map((f) => (
              <FactorBar key={f.label} label={f.label} value={f.value} />
            ))}
            <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-neutral-50/80 dark:bg-neutral-900/45 px-3 py-2 text-[10px] font-semibold tracking-wide text-neutral-500 dark:text-neutral-400 text-center">
              100 = League Avg
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Card 3: Head to Head / BvP ── */}
      <SectionCard
        title="Head to Head"
        subtitle={hasPitcher ? `vs ${pitcherName}` : undefined}
        accent="amber"
      >
        {!hasPitcher ? (
          <EmptyState message="Matchup data available after lineups are set" />
        ) : !bvpCareer ? (
          <div className="space-y-2">
            <EmptyState message="No career matchup history" />
            <p className="text-center text-[11px] text-neutral-400 dark:text-neutral-500">
              First time facing this pitcher
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <FieldRow label="PA" value={formatInt(bvpCareer.plate_appearances)} />
              <FieldRow label="AVG" value={formatBattingAverage(bvpCareer.avg)} />
              <FieldRow label="HR" value={formatInt(bvpCareer.home_runs)} />
              <FieldRow label="K" value={formatInt(bvpCareer.strike_outs)} />
              <FieldRow label="BB" value={formatInt(bvpCareer.base_on_balls)} />
              <FieldRow label="SLG" value={formatBattingAverage(bvpCareer.slg)} />
            </div>

            {bvpSeasons.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 mb-1.5">
                  By Season
                </p>
                <div className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/60 overflow-hidden bg-white/65 dark:bg-neutral-900/45">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-100/80 dark:bg-neutral-800/80">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          Season
                        </th>
                        <th className="px-3 py-2 font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          PA
                        </th>
                        <th className="px-3 py-2 font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          AVG
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bvpSeasons.map((s) => (
                        <tr
                          key={s.season}
                          className="border-t border-neutral-200/60 dark:border-neutral-800/70"
                        >
                          <td className="px-3 py-2 font-semibold text-neutral-700 dark:text-neutral-200">
                            {s.season}
                          </td>
                          <td className="px-3 py-2 text-neutral-900 dark:text-white tabular-nums">
                            {s.pa}
                          </td>
                          <td className="px-3 py-2 text-neutral-900 dark:text-white tabular-nums">
                            {s.avg}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Card 4: Batter Advanced Profile ── */}
      <SectionCard
        title="Batter Advanced Profile"
        subtitle="Advanced contact and speed metrics vs league average"
        accent="violet"
      >
        {!hasBatterAdvancedMetrics ? (
          <EmptyState message="Advanced profile data unavailable" />
        ) : (
          <div className="space-y-2">
            <AdvancedMetricRow
              label="Exit Velo"
              value={batterAdvanced.exitVelo}
              leagueAvg={MLB_LEAGUE_AVG.exitVelo}
            />
            <AdvancedMetricRow
              label="Hard Hit%"
              value={batterAdvanced.hardHitPct}
              leagueAvg={MLB_LEAGUE_AVG.hardHitPct}
            />
            <AdvancedMetricRow
              label="Barrel%"
              value={batterAdvanced.barrelPct}
              leagueAvg={MLB_LEAGUE_AVG.barrelPct}
            />
            <AdvancedMetricRow
              label="Sweet Spot%"
              value={batterAdvanced.sweetSpotPct}
              leagueAvg={MLB_LEAGUE_AVG.sweetSpotPct}
            />
            <AdvancedMetricRow
              label="Sprint Speed"
              value={batterAdvanced.sprintSpeed}
              leagueAvg={MLB_LEAGUE_AVG.sprintSpeed}
            />
            <AdvancedMetricRow
              label="xwOBA"
              value={batterAdvanced.xwOBA}
              leagueAvg={MLB_LEAGUE_AVG.xwOBA}
            />
            <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-neutral-50/80 dark:bg-neutral-900/45 px-3 py-2 text-[10px] font-semibold tracking-wide text-neutral-500 dark:text-neutral-400 text-center">
              Above Avg (green) · Avg (amber) · Below Avg (red)
            </div>
          </div>
        )}
      </SectionCard>

      <div className="lg:col-span-2">
        <MlbHotZoneMatchup
          batterId={playerId}
          pitcherId={pitcher?.player_id ?? null}
        />
      </div>
    </div>
  );
}
