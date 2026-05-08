"use client";

import React, { useState } from "react";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/popover";
import {
  useChartPreferences,
  type ChartSettings,
} from "@/hooks/use-chart-preferences";

// Gear-icon button + popover for the player drilldown chart's overlay
// toggles. Persists to user_preferences.chart_settings on every flip.
export function ChartSettingsPopover() {
  const [open, setOpen] = useState(false);
  const { settings, setSetting, resetSettings } = useChartPreferences();

  const activeCount = activeOverlayCount(settings);
  const content = (
    <div className="flex w-[300px] flex-col">
      {/* HEADER — title + active-count chip + reset link. Compact since the
          rows below carry the bulk of the visual weight. */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200/60 px-3 py-2 dark:border-neutral-800/60">
        <div className="flex items-center gap-2">
          <Settings className="h-3.5 w-3.5 text-brand" />
          <span className="text-[12px] font-black text-neutral-900 dark:text-white">
            Chart Settings
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-brand">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={resetSettings}
            className="text-[10px] font-bold tracking-[0.1em] text-neutral-500 uppercase transition-colors hover:text-brand dark:text-neutral-400"
          >
            Reset
          </button>
        )}
      </div>
      <SectionHeader>Display</SectionHeader>
      <div className="px-1.5 pb-1.5">
        <ToggleRow
          label="Potential Bars"
          description="Ghost bars for potential rebounds / assists"
          active={settings.showPotential}
          onToggle={(v) => setSetting("showPotential", v)}
          swatch={<DisplayPotentialSwatch />}
        />
        <ToggleRow
          label="Average Line"
          description="Horizontal line at the visible games' average"
          active={settings.showAverage}
          onToggle={(v) => setSetting("showAverage", v)}
          swatch={<AverageLineSwatch />}
        />
      </div>
      <SectionHeader>Context Overlays</SectionHeader>
      <div className="px-1.5 pb-2">
        <ToggleRow
          label="Confidence Band"
          description="Median ± 1σ across visible games"
          active={settings.showConfidenceBand}
          onToggle={(v) => setSetting("showConfidenceBand", v)}
          swatch={<BandSwatch />}
        />
        <ToggleRow
          label="DvP Line"
          description="Opp defense — line up = soft (good matchup)"
          active={settings.showDvpOverlay}
          onToggle={(v) => setSetting("showDvpOverlay", v)}
          swatch={<LineSwatch color="rgb(245 158 11)" />}
        />
        <ToggleRow
          label="Pace Line"
          description="Opp pace rank — #1 fastest, #30 slowest"
          active={settings.showPaceOverlay}
          onToggle={(v) => setSetting("showPaceOverlay", v)}
          swatch={<LineSwatch color="rgb(59 130 246)" dashed />}
        />
      </div>
    </div>
  );

  return (
    <Popover
      openPopover={open}
      setOpenPopover={setOpen}
      side="bottom"
      align="end"
      sideOffset={6}
      content={content}
      popoverContentClassName="rounded-xl border border-neutral-200/70 bg-white shadow-2xl dark:border-neutral-700/60 dark:bg-neutral-900 z-50 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chart overlay settings"
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
          activeOverlayCount(settings) > 0
            ? "border-brand/45 bg-brand/15 text-brand hover:bg-brand/25"
            : "border-neutral-200 text-neutral-500 hover:border-brand/40 hover:text-brand dark:border-neutral-700 dark:text-neutral-400",
        )}
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
    </Popover>
  );
}

// Quiet uppercase divider between "Display" and "Context Overlays" groups
// inside the popover. Same micro-cap rhythm used elsewhere in v2.
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 px-3 pt-2 pb-1 text-[9px] font-black tracking-[0.16em] text-neutral-400 uppercase dark:text-neutral-500">
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  active,
  onToggle,
  swatch,
}: {
  label: string;
  description: string;
  active: boolean;
  onToggle: (next: boolean) => void;
  swatch: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
        active
          ? "bg-brand/[0.08] dark:bg-brand/[0.10]"
          : "hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40",
      )}
    >
      {/* Real visual sample — small mini-chart-like swatch that looks like
          the actual overlay (band, line, dash, etc) instead of a generic
          color rectangle. Dimmed when off. */}
      <span
        className={cn(
          "grid h-7 w-9 shrink-0 place-items-center rounded-md border bg-neutral-50 transition-opacity dark:bg-neutral-950/50",
          active
            ? "border-brand/40 opacity-100"
            : "border-neutral-200/70 opacity-50 dark:border-neutral-800/70",
        )}
        aria-hidden
      >
        {swatch}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[12px] font-black",
            active ? "text-brand" : "text-neutral-900 dark:text-white",
          )}
        >
          {label}
        </div>
        <div className="text-[10.5px] font-medium leading-snug text-neutral-500 dark:text-neutral-400">
          {description}
        </div>
      </div>
      {/* Pill switch — flips between off (gray) and on (brand). */}
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          active ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
            active ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

// Mini-chart swatches — render the actual overlay shape at thumbnail size
// so users see what they'll get without enabling first.

function DisplayPotentialSwatch() {
  // Two stacked bars with a "ghost" potential bar behind the colored one,
  // mimicking the real PotentialBar render.
  return (
    <svg viewBox="0 0 32 22" className="h-4 w-6">
      <rect x="6" y="4" width="6" height="16" rx="1" className="fill-neutral-400/40" />
      <rect x="7" y="9" width="4" height="11" rx="1" className="fill-emerald-500" />
      <rect x="20" y="2" width="6" height="18" rx="1" className="fill-neutral-400/40" />
      <rect x="21" y="6" width="4" height="14" rx="1" className="fill-emerald-500" />
    </svg>
  );
}

function AverageLineSwatch() {
  // Horizontal dashed line through two short bars — same look as the AVG
  // line in the chart.
  return (
    <svg viewBox="0 0 32 22" className="h-4 w-6">
      <rect x="4" y="6" width="5" height="14" rx="1" className="fill-emerald-500" />
      <rect x="14" y="3" width="5" height="17" rx="1" className="fill-emerald-500" />
      <rect x="24" y="9" width="5" height="11" rx="1" className="fill-emerald-500" />
      <line
        x1="2"
        y1="11"
        x2="30"
        y2="11"
        stroke="rgb(115 115 115)"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

function BandSwatch() {
  return (
    <svg viewBox="0 0 32 22" className="h-4 w-6">
      <rect x="0" y="6" width="32" height="10" className="fill-brand/30" />
      <line x1="0" y1="6" x2="32" y2="6" className="stroke-brand/60" strokeWidth="0.8" />
      <line x1="0" y1="16" x2="32" y2="16" className="stroke-brand/60" strokeWidth="0.8" />
      <rect x="3" y="3" width="4" height="17" rx="1" className="fill-emerald-500/70" />
      <rect x="14" y="9" width="4" height="11" rx="1" className="fill-emerald-500/70" />
      <rect x="25" y="5" width="4" height="15" rx="1" className="fill-emerald-500/70" />
    </svg>
  );
}

function LineSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
  // Trend line zig-zagging across the swatch — solid for DvP, dashed for
  // Pace. Small dots at vertices to match the real overlay.
  const points = "2,16 9,7 17,12 24,4 30,10";
  const arr = points.split(" ").map((p) => p.split(",").map(Number));
  return (
    <svg viewBox="0 0 32 22" className="h-4 w-6">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "3 2" : undefined}
      />
      {arr.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.4" fill={color} />
      ))}
    </svg>
  );
}

// "Active" count for the gear button's tinted state. Display toggles
// (Potential / Average) only count as "active" when DEPARTING from default
// — i.e. the user has explicitly turned them off — so the gear doesn't
// pulse on every fresh load.
function activeOverlayCount(s: ChartSettings): number {
  return (
    (s.showConfidenceBand ? 1 : 0) +
    (s.showDvpOverlay ? 1 : 0) +
    (s.showPaceOverlay ? 1 : 0) +
    (!s.showPotential ? 1 : 0) +
    (!s.showAverage ? 1 : 0)
  );
}
