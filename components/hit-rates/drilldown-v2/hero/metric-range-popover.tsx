"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/popover";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import type { MetricFilterConfig } from "../shared/quick-filters";

// Replaces the threshold-toggle inline chips (Minutes 30+, FGA 15+, etc.)
// with a click-to-open range control: dual-thumb slider + numeric inputs +
// quick-select pills for common thresholds. Backed by the existing
// metric:KEY:range:MIN:MAX filter id system so nothing else needs to change
// in the predicate / preset infrastructure.
export function MetricRangePopover({
  config,
  recentGames,
  activeRange,
  onChange,
  active,
  getValueOverride,
  minOverride,
  maxOverride,
  labelOverride,
}: {
  config: MetricFilterConfig;
  recentGames: BoxScoreGame[];
  activeRange: { min: number; max: number | null } | null;
  onChange: (range: { min: number; max: number } | null) => void;
  active: boolean;
  // For metrics whose values aren't on the box-score (e.g., opp DvP rank
  // looked up via a context map). Falls back to config.getValue otherwise.
  getValueOverride?: (game: BoxScoreGame) => number | null | undefined;
  // Hard bounds for metrics with a known fixed range (e.g., DvP rank is
  // 1..totalTeams regardless of how many games are loaded).
  minOverride?: number;
  maxOverride?: number;
  // Override the popover header title — useful when the label needs the
  // active market baked in (e.g., "Opp Defense Rank vs Assists").
  labelOverride?: string;
}) {
  const [open, setOpen] = useState(false);

  // Extent of this metric across the player's recent games — drives the
  // slider's true min/max so users can't drag past meaningful values.
  // When min/maxOverride is set, those win — useful for ranking metrics
  // where the bounds are fixed by the league size.
  const getValue = getValueOverride ?? config.getValue;
  const { min, max, avg } = useMemo(() => {
    const values = recentGames
      .map((g) => getValue(g))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (values.length === 0) {
      return {
        min: minOverride ?? 0,
        max: maxOverride ?? 1,
        avg: 0,
      };
    }
    let lo = Infinity;
    let hi = -Infinity;
    let sum = 0;
    for (const v of values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      sum += v;
    }
    // Round to nearest step for a cleaner slider scale.
    const step = config.step;
    const flooredLo = Math.floor(lo / step) * step;
    const ceiledHi = Math.ceil(hi / step) * step;
    return {
      min: minOverride ?? flooredLo,
      max: maxOverride ?? Math.max(ceiledHi, flooredLo + step),
      avg: sum / values.length,
    };
  }, [config, recentGames, getValue, minOverride, maxOverride]);

  const display = (input: number) =>
    config.isPercentage ? `${Math.round(input)}%` : String(Math.round(input));

  // Quick-select pills — common thresholds bracketed around the player's
  // typical performance. Gives one-click parity with the old preset chips.
  const quickThresholds = useMemo(() => {
    const span = Math.max(1, max - min);
    const stepCount = Math.min(4, Math.max(2, Math.round(span / config.step / 4)));
    const pills: number[] = [];
    for (let i = 1; i <= stepCount; i++) {
      const value = Math.round((min + (span * i) / (stepCount + 1)) / config.step) * config.step;
      if (!pills.includes(value)) pills.push(value);
    }
    return pills;
  }, [min, max, config.step]);

  return (
    <Popover
      openPopover={open}
      setOpenPopover={setOpen}
      side="bottom"
      align="start"
      sideOffset={6}
      content={
        <RangeBody
          config={config}
          labelOverride={labelOverride}
          min={min}
          max={max}
          avg={avg}
          activeRange={activeRange}
          quickThresholds={quickThresholds}
          display={display}
          onApply={(range) => {
            onChange(range);
            // Stay open after applying; user can keep nudging.
          }}
          onClear={() => {
            onChange(null);
          }}
        />
      }
      popoverContentClassName="rounded-xl border border-neutral-200/70 bg-white shadow-2xl dark:border-neutral-700/60 dark:bg-neutral-900 z-50 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition-all duration-150",
          active
            ? "bg-brand text-neutral-950 shadow-sm shadow-brand/25"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100",
        )}
      >
        <span>{config.shortLabel}</span>
        {activeRange && (
          <span className="tabular-nums opacity-90">
            {display(activeRange.min)}
            {activeRange.max !== null && activeRange.max !== max
              ? `-${display(activeRange.max)}`
              : "+"}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
    </Popover>
  );
}

// Inner body of the popover — slider + numeric inputs + quick pills + clear.
// Holds local draft state so the user can drag without firing onChange every
// pixel; commit on input blur / pill click / "Apply" (here we just commit
// continuously since the parent recomputes filtered games efficiently).
function RangeBody({
  config,
  labelOverride,
  min,
  max,
  avg,
  activeRange,
  quickThresholds,
  display,
  onApply,
  onClear,
}: {
  config: MetricFilterConfig;
  labelOverride?: string;
  min: number;
  max: number;
  avg: number;
  activeRange: { min: number; max: number | null } | null;
  quickThresholds: number[];
  display: (n: number) => string;
  onApply: (range: { min: number; max: number }) => void;
  onClear: () => void;
}) {
  const clamp = (value: number) => Math.min(max, Math.max(min, value));
  const draftMin = clamp(activeRange?.min ?? min);
  const draftMax = clamp(activeRange?.max ?? max);
  const span = Math.max(config.step, max - min);
  const leftPct = ((draftMin - min) / span) * 100;
  const rightPct = ((draftMax - min) / span) * 100;
  const isActive = draftMin > min || draftMax < max;

  const commit = (nextMin: number, nextMax: number) => {
    const orderedMin = Math.min(nextMin, nextMax);
    const orderedMax = Math.max(nextMin, nextMax);
    onApply({ min: orderedMin, max: orderedMax });
  };

  const normalizeInput = (value: string, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(parsed);
  };

  return (
    <div className="flex w-[300px] flex-col gap-4 px-4 py-3.5">
      {/* Header — metric name + clear. Slight bottom padding rule below it
          via the parent gap; keeps the title group visually separate from
          the pill row without needing an explicit divider. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-black text-neutral-900 dark:text-white">
            {labelOverride ?? config.label}
          </div>
          <div className="mt-0.5 text-[10px] font-medium leading-snug text-neutral-500 dark:text-neutral-500">
            {config.description} · avg {display(avg)}
          </div>
        </div>
        {isActive && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[10px] font-bold tracking-[0.1em] text-neutral-500 uppercase transition-colors hover:text-brand dark:text-neutral-400"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick pills — common thresholds. Sets min to the pill, leaves max
          at the natural ceiling so it behaves like the old "30+" toggle.
          flex-1 on each so they evenly divide the popover width and feel
          like a proper control segment instead of left-clustered chips. */}
      <div className="flex items-stretch gap-1.5">
        {quickThresholds.map((threshold) => {
          const isPicked =
            isActive && draftMin === threshold && draftMax === max;
          return (
            <button
              key={threshold}
              type="button"
              onClick={() => commit(threshold, max)}
              className={cn(
                "flex-1 rounded-full px-3 py-1.5 text-[11px] font-black tabular-nums transition-colors",
                isPicked
                  ? "bg-brand text-neutral-950 shadow-sm shadow-brand/25"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
              )}
            >
              {display(threshold)}+
            </button>
          );
        })}
      </div>

      {/* Slider with two thumbs — more padding around the track + wider
          input cells so the values sit clearly on either side. */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="grid grid-cols-[52px_1fr_52px] items-center gap-3">
          <input
            type="number"
            min={min}
            max={draftMax}
            step={config.step}
            value={Math.round(draftMin)}
            onChange={(event) =>
              commit(normalizeInput(event.target.value, draftMin), draftMax)
            }
            className="h-8 rounded-md border border-neutral-200 bg-white px-1.5 text-center text-[12px] font-black tabular-nums text-neutral-700 outline-none transition-colors focus:border-brand/60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            aria-label={`${config.label} minimum`}
          />
          <div className="relative h-8">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand"
              style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
            />
            <input
              type="range"
              min={min}
              max={max}
              step={config.step}
              value={draftMin}
              onChange={(event) =>
                commit(
                  Math.min(Number(event.target.value), draftMax - config.step),
                  draftMax,
                )
              }
              className="range-thumb pointer-events-none absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent"
              aria-label={`${config.label} minimum slider`}
            />
            <input
              type="range"
              min={min}
              max={max}
              step={config.step}
              value={draftMax}
              onChange={(event) =>
                commit(
                  draftMin,
                  Math.max(Number(event.target.value), draftMin + config.step),
                )
              }
              className="range-thumb pointer-events-none absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent"
              aria-label={`${config.label} maximum slider`}
            />
          </div>
          <input
            type="number"
            min={draftMin}
            max={max}
            step={config.step}
            value={Math.round(draftMax)}
            onChange={(event) =>
              commit(draftMin, normalizeInput(event.target.value, draftMax))
            }
            className="h-8 rounded-md border border-neutral-200 bg-white px-1.5 text-center text-[12px] font-black tabular-nums text-neutral-700 outline-none transition-colors focus:border-brand/60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            aria-label={`${config.label} maximum`}
          />
        </div>
        <div className="flex justify-between px-1 text-[9px] font-bold tabular-nums text-neutral-400 dark:text-neutral-500">
          <span>{display(min)}</span>
          <span>{display(max)}</span>
        </div>
      </div>

      {/* Range-input thumb styling — the wrapper input is pointer-events:none
          so both stacked thumbs can coexist; pointer-events:auto on the thumb
          pseudo-element re-enables click/drag on just the knob. The same
          rule lives in filters-drawer.tsx but only mounts when that drawer
          renders, so we duplicate it here to keep this popover standalone. */}
      <style jsx global>{`
        .range-thumb::-webkit-slider-runnable-track {
          height: 0;
          background: transparent;
        }
        .range-thumb::-moz-range-track {
          height: 0;
          background: transparent;
        }
        .range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 2px solid rgb(10 10 10);
          background: var(--brand, #38bdf8);
          box-shadow: 0 0 0 1px rgb(255 255 255 / 0.16);
          pointer-events: auto;
          cursor: pointer;
        }
        .range-thumb::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 2px solid rgb(10 10 10);
          background: var(--brand, #38bdf8);
          box-shadow: 0 0 0 1px rgb(255 255 255 / 0.16);
          pointer-events: auto;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
