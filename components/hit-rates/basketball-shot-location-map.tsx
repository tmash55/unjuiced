"use client";

import React, { useMemo, useState } from "react";
import { RotateCcw, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBasketballShotLocations,
  type BasketballShotMadeFilter,
  type BasketballShotLocationsSport,
} from "@/hooks/use-basketball-shot-locations";
import type { BasketballShotLocation } from "@/app/api/basketball/shot-locations/route";

type WindowKey = "l5" | "l10" | "l20" | "season";
type PeriodKey = "all" | "h1" | "h2" | "q1" | "q2" | "q3" | "q4";
type WnbaSeasonKey = "2025" | "2026";

interface BasketballShotLocationMapProps {
  sport?: BasketballShotLocationsSport;
  playerId?: number | null;
  playerName?: string | null;
  season?: string | null;
  seasonType?: string | null;
  gameId?: string | number | null;
  className?: string;
  compact?: boolean;
}

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string; lastNGames: number | null }> = [
  { key: "l5", label: "L5", lastNGames: 5 },
  { key: "l10", label: "L10", lastNGames: 10 },
  { key: "l20", label: "L20", lastNGames: 20 },
  { key: "season", label: "Season", lastNGames: null },
];

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string; period?: number; half?: 1 | 2 }> = [
  { key: "all", label: "All" },
  { key: "h1", label: "1H", half: 1 },
  { key: "h2", label: "2H", half: 2 },
  { key: "q1", label: "Q1", period: 1 },
  { key: "q2", label: "Q2", period: 2 },
  { key: "q3", label: "Q3", period: 3 },
  { key: "q4", label: "Q4", period: 4 },
];

const MADE_FILTERS: Array<{ key: BasketballShotMadeFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "made", label: "Makes" },
  { key: "missed", label: "Misses" },
];

const WNBA_SEASONS: Array<{ key: WnbaSeasonKey; label: string }> = [
  { key: "2025", label: "2025" },
  { key: "2026", label: "2026" },
];

function defaultSeason(sport: BasketballShotLocationsSport) {
  return sport === "wnba" ? "2026" : "2025-26";
}

function mapShotToCourt(shot: BasketballShotLocation) {
  const x = typeof shot.loc_x === "number" ? Math.max(12, Math.min(488, 250 + shot.loc_x)) : 250;
  const y = typeof shot.loc_y === "number" ? Math.max(18, Math.min(452, 420 - shot.loc_y)) : 420;
  return { x, y };
}

function shotColor(shot: BasketballShotLocation) {
  if (shot.shot_made) return shot.shot_type === "3PT Field Goal" ? "#22d3ee" : "#10b981";
  return "#f43f5e";
}

function formatPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${Math.round(value * 100)}%`;
}

function ShotDot({ shot, compact }: { shot: BasketballShotLocation; compact: boolean }) {
  const { x, y } = mapShotToCourt(shot);
  const made = Boolean(shot.shot_made);
  const color = shotColor(shot);
  const radius = compact ? 3.5 : 4.5;
  const label = [
    shot.game_date,
    shot.period ? `Q${shot.period}` : null,
    shot.clock?.display,
    shot.action_type || shot.shot_type,
    made ? "Made" : "Missed",
    shot.shot_distance != null ? `${shot.shot_distance} ft` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <g className="group">
      <circle
        cx={x}
        cy={y}
        r={radius + 5}
        fill={color}
        opacity={0.08}
        className="transition-opacity group-hover:opacity-25"
      />
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={made ? color : "transparent"}
        stroke={color}
        strokeWidth={made ? 1.2 : 2}
        className="transition-transform group-hover:scale-125"
      >
        <title>{label}</title>
      </circle>
    </g>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-800 dark:bg-neutral-950/60">
      <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 text-sm font-black tabular-nums text-neutral-900 dark:text-white">{value}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-950/70">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={cn(
            "h-7 rounded px-2 text-[11px] font-black transition-colors",
            value === option.key
              ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-950"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BasketballShotLocationMap({
  sport = "nba",
  playerId,
  playerName,
  season,
  seasonType = "Regular Season",
  gameId,
  className,
  compact = false,
}: BasketballShotLocationMapProps) {
  const [windowKey, setWindowKey] = useState<WindowKey>("l10");
  const [periodKey, setPeriodKey] = useState<PeriodKey>("all");
  const [madeFilter, setMadeFilter] = useState<BasketballShotMadeFilter>("all");
  const [wnbaSeason, setWnbaSeason] = useState<WnbaSeasonKey>("2025");
  const windowOption = WINDOW_OPTIONS.find((option) => option.key === windowKey) ?? WINDOW_OPTIONS[1];
  const periodOption = PERIOD_OPTIONS.find((option) => option.key === periodKey) ?? PERIOD_OPTIONS[0];
  const resolvedSeason = season ?? (sport === "wnba" ? wnbaSeason : defaultSeason(sport));

  const { data, isLoading, error, refetch, isFetching } = useBasketballShotLocations({
    sport,
    playerId,
    season: resolvedSeason,
    seasonType,
    gameId: gameId ?? null,
    lastNGames: gameId ? null : windowOption.lastNGames,
    period: periodOption.period ?? null,
    half: periodOption.half ?? null,
    madeFilter,
    limit: compact ? 400 : 900,
    enabled: typeof playerId === "number",
  });

  const shots = data?.shots ?? [];
  const summary = data?.summary;
  const zoneSummary = data?.zone_summary ?? [];
  const displayName = data?.player?.name || playerName || "Player";
  const dateLabel =
    data?.filters?.date_from && data?.filters?.date_to
      ? data.filters.date_from === data.filters.date_to
        ? data.filters.date_from
        : `${data.filters.date_from} to ${data.filters.date_to}`
      : resolvedSeason;

  const topZones = useMemo(() => zoneSummary.slice(0, compact ? 3 : 5), [zoneSummary, compact]);

  if (!playerId) return null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900",
        className
      )}
    >
      <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/20">
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-neutral-950 dark:text-white">
              Shot Location Map
            </h3>
            <p className="truncate text-xs font-medium text-neutral-500">
              {displayName} · {dateLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sport === "wnba" && !season && (
            <SegmentedControl
              value={wnbaSeason}
              options={WNBA_SEASONS}
              onChange={setWnbaSeason}
            />
          )}
          {!gameId && (
            <SegmentedControl
              value={windowKey}
              options={WINDOW_OPTIONS.map(({ key, label }) => ({ key, label }))}
              onChange={setWindowKey}
            />
          )}
          <SegmentedControl
            value={periodKey}
            options={PERIOD_OPTIONS.map(({ key, label }) => ({ key, label }))}
            onChange={setPeriodKey}
          />
          <SegmentedControl
            value={madeFilter}
            options={MADE_FILTERS}
            onChange={setMadeFilter}
          />
          <button
            type="button"
            onClick={() => refetch()}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:text-white"
            title="Refresh shot locations"
          >
            <RotateCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 bg-neutral-950 p-3 sm:p-4">
          <div className="relative mx-auto aspect-[500/470] w-full max-w-[620px] overflow-hidden rounded-lg border border-white/10 bg-[#101820]">
            <svg viewBox="0 0 500 470" className="h-full w-full" role="img" aria-label="Basketball shot location map">
              <defs>
                <radialGradient id="shotMapPaintGlow" cx="50%" cy="88%" r="65%">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.16)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </radialGradient>
              </defs>

              <rect x="0" y="0" width="500" height="470" fill="#101820" />
              <rect x="170" y="280" width="160" height="190" fill="url(#shotMapPaintGlow)" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
              <path d="M30 420 L470 420" stroke="rgba(255,255,255,0.24)" strokeWidth="2" />
              <path d="M30 420 L30 210" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
              <path d="M470 420 L470 210" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
              <path d="M30 210 A220 220 0 0 1 470 210" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
              <circle cx="250" cy="420" r="7" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2" />
              <path d="M220 420 H280" stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
              <circle cx="250" cy="300" r="60" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" strokeDasharray="5 5" />

              {isLoading ? (
                <text x="250" y="230" textAnchor="middle" fill="rgba(255,255,255,0.58)" fontSize="13" fontWeight="700">
                  Loading shots...
                </text>
              ) : error ? (
                <text x="250" y="230" textAnchor="middle" fill="rgba(244,63,94,0.9)" fontSize="13" fontWeight="700">
                  Shot data unavailable
                </text>
              ) : shots.length === 0 ? (
                <text x="250" y="230" textAnchor="middle" fill="rgba(255,255,255,0.58)" fontSize="13" fontWeight="700">
                  No shots found
                </text>
              ) : (
                shots.map((shot) => <ShotDot key={`${shot.game_id}-${shot.game_event_id}-${shot.player_id}`} shot={shot} compact={compact} />)
              )}
            </svg>
          </div>
        </div>

        <aside className="border-t border-neutral-200 p-4 dark:border-neutral-800 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 gap-2">
            <StatPill label="FGA" value={summary?.fga ?? "--"} />
            <StatPill label="FGM" value={summary?.fgm ?? "--"} />
            <StatPill label="FG%" value={formatPct(summary?.fg_pct)} />
            <StatPill label="Points" value={summary?.points ?? "--"} />
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Top Zones</div>
            {topZones.length ? (
              topZones.map((zone) => (
                <div
                  key={zone.zone}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-neutral-900 dark:text-white">{zone.zone}</div>
                    <div className="text-[11px] text-neutral-500">
                      {zone.fgm}/{zone.fga} · {formatPct(zone.fg_pct)}
                    </div>
                  </div>
                  <div className="text-right text-xs font-black tabular-nums text-cyan-500">
                    {zone.pct_of_attempts ?? 0}%
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-neutral-200 px-3 py-6 text-center text-xs font-semibold text-neutral-500 dark:border-neutral-800">
                No zone summary
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
