"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useMlbHotZoneMatchup } from "@/hooks/use-mlb-hot-zone-matchup";
import type {
  HotZoneWindow,
  MlbHotZoneBatterZone,
  MlbHotZoneMatchupOverlay,
  MlbHotZonePitchType,
  MlbHotZonePitcherZone,
} from "@/app/api/mlb/hot-zone-matchup/route";

type HotZoneView = "batter" | "pitcher" | "matchup";

interface MlbHotZoneMatchupProps {
  batterId: number | null | undefined;
  pitcherId?: number | null | undefined;
}

const MAIN_ZONE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const WINDOW_OPTIONS: Array<{ value: HotZoneWindow; label: string }> = [
  { value: "season", label: "SZN" },
  { value: "last_5", label: "L5" },
  { value: "last_10", label: "L10" },
  { value: "last_20", label: "L20" },
];

/* ── Heatmap: deep blue → sky blue → white → salmon → red ─────────────────── */

function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const stops = [
    { t: 0, r: 30, g: 64, b: 200 },
    { t: 0.3, r: 80, g: 140, b: 235 },
    { t: 0.5, r: 220, g: 225, b: 235 },
    { t: 0.7, r: 240, g: 130, b: 110 },
    { t: 1, r: 220, g: 50, b: 50 },
  ];
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1].t < c) i++;
  const a = stops[i],
    b = stops[i + 1];
  const p = (c - a.t) / (b.t - a.t);
  return `rgb(${Math.round(a.r + (b.r - a.r) * p)},${Math.round(a.g + (b.g - a.g) * p)},${Math.round(a.b + (b.b - a.b) * p)})`;
}

function tempToT(temp: string | null | undefined): number | null {
  if (!temp) return null;
  const k = temp.toLowerCase();
  if (k === "hot") return 0.95;
  if (k === "warm") return 0.72;
  if (k === "lukewarm") return 0.28;
  if (k === "cold") return 0.05;
  return null;
}

/* ── Formatters ───────────────────────────────────────────────────────────── */

function fmt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  if (Math.abs(v) < 1) return v.toFixed(3).replace(/^0/, "");
  if (Math.abs(v) < 10) return v.toFixed(1);
  return `${Math.round(v)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  return `${Math.round(v)}%`;
}

function fmtCount(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  return Math.round(v).toLocaleString();
}

function fmtSpeed(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  return `${v.toFixed(1)}`;
}

function getCurrentEtYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(
      new Date()
    )
  );
}

/* ── Cell data ────────────────────────────────────────────────────────────── */

interface ZoneCellData {
  bg: string;
  textCls: string;
  mainValue: string;
  subLabel: string;
}

/** Returns appropriate text class for the heat value t (0=cold blue, 0.5=white, 1=hot red) */
function textClsForT(t: number): string {
  // Near the white middle, use dark text; at the blue/red extremes, use white
  return t > 0.25 && t < 0.75 ? "text-neutral-900 dark:text-neutral-900" : "text-white";
}

function textClsForBg(color: string): string {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const r = parseInt(hex[1].slice(0, 2), 16);
    const g = parseInt(hex[1].slice(2, 4), 16);
    const b = parseInt(hex[1].slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b < 160 ? "text-white" : "text-neutral-900 dark:text-neutral-900";
  }
  const rgb = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const brightness = 0.299 * +rgb[1] + 0.587 * +rgb[2] + 0.114 * +rgb[3];
    return brightness < 160 ? "text-white" : "text-neutral-900 dark:text-neutral-900";
  }
  return "text-white";
}

function batterCell(b: MlbHotZoneBatterZone | undefined): ZoneCellData {
  const contact = b?.contact_pct ?? null;
  let t = tempToT(b?.temp);
  if (t === null && contact !== null) t = Math.max(0, Math.min(1, contact / 100));
  t = t ?? 0.5;
  return {
    bg: b?.color ?? heatColor(t),
    textCls: b?.color ? textClsForBg(b.color) : textClsForT(t),
    mainValue: b?.value != null ? fmt(b.value) : fmtPct(contact),
    subLabel: b?.pitches_seen != null ? `${b.pitches_seen}` : "",
  };
}

function pitcherCell(p: MlbHotZonePitcherZone | undefined): ZoneCellData {
  const usage = p?.zone_pct ?? null;
  let t = tempToT(p?.temp);
  if (t === null && usage !== null) t = Math.max(0, Math.min(1, usage / 16));
  t = t ?? 0.5;
  return {
    bg: p?.color ?? heatColor(t),
    textCls: p?.color ? textClsForBg(p.color) : textClsForT(t),
    mainValue: p?.value != null ? fmt(p.value) : fmtPct(usage),
    subLabel: p?.pitches_thrown != null ? `${p.pitches_thrown}` : "",
  };
}

function matchupCell(
  o: MlbHotZoneMatchupOverlay | undefined,
  b: MlbHotZoneBatterZone | undefined,
  p: MlbHotZonePitcherZone | undefined
): ZoneCellData {
  const usage = o?.pitcher_zone_pct ?? p?.zone_pct ?? null;
  const whiff = o?.batter_whiff_pct ?? b?.whiff_pct ?? null;
  const adv = o?.advantage ?? null;

  let t = tempToT(o?.temp);
  if (t === null) {
    if (adv === "batter_advantage") t = 0.9;
    else if (adv === "pitcher_advantage") t = 0.1;
    else t = 0.5;
  }

  const isDead = adv === "dead_zone" || (usage !== null && usage < 3);
  const bg = o?.color ?? (isDead ? "rgba(100,116,139,0.2)" : heatColor(t));
  const textCls = o?.color
    ? textClsForBg(o.color)
    : isDead
      ? "text-neutral-400"
      : textClsForT(t);

  return {
    bg,
    textCls,
    mainValue: o?.value != null ? fmt(o.value) : fmtPct(usage),
    subLabel: whiff != null ? `${Math.round(100 - whiff)}%ct` : "",
  };
}

function getUsagePct(r: MlbHotZonePitchType): number {
  return r.pct ?? r.usage_pct ?? 0;
}
function getPitchName(r: MlbHotZonePitchType): string {
  return r.pitch_name || r.pitch_type || "Unknown";
}
function getWhiffTone(view: HotZoneView, w: number | null | undefined): string {
  if (w == null) return "text-neutral-500";
  if (view === "batter") {
    if (w <= 20) return "text-emerald-600 dark:text-emerald-400";
    if (w <= 30) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }
  if (w >= 30) return "text-emerald-600 dark:text-emerald-400";
  if (w >= 20) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/* ── Grid position map (zone → CSS grid row/col) ─────────────────────────── */

const ZONE_POS: Record<number, { row: number; col: number }> = {
  1: { row: 2, col: 2 },
  2: { row: 2, col: 3 },
  3: { row: 2, col: 4 },
  4: { row: 3, col: 2 },
  5: { row: 3, col: 3 },
  6: { row: 3, col: 4 },
  7: { row: 4, col: 2 },
  8: { row: 4, col: 3 },
  9: { row: 4, col: 4 },
};

/* ── Component ────────────────────────────────────────────────────────────── */

export function MlbHotZoneMatchup({ batterId, pitcherId }: MlbHotZoneMatchupProps) {
  const [view, setView] = useState<HotZoneView>("batter");
  const [singleWindow, setSingleWindow] = useState<HotZoneWindow>("season");
  const [batterWindow, setBatterWindow] = useState<HotZoneWindow>("season");
  const [pitcherWindow, setPitcherWindow] = useState<HotZoneWindow>("season");
  const season = useMemo(() => getCurrentEtYear(), []);

  const hasPitcher = typeof pitcherId === "number";
  const effBW = view === "matchup" ? batterWindow : view === "batter" ? singleWindow : "season";
  const effPW = view === "matchup" ? pitcherWindow : view === "pitcher" ? singleWindow : "season";

  const { data, isLoading, isError } = useMlbHotZoneMatchup({
    batterId,
    pitcherId,
    batterWindow: effBW,
    pitcherWindow: effPW,
    season,
    enabled: typeof batterId === "number" && (view === "batter" || hasPitcher),
  });

  const bMap = useMemo(() => new Map((data?.batter_zones ?? []).map((r) => [r.zone, r])), [data?.batter_zones]);
  const pMap = useMemo(() => new Map((data?.pitcher_zones ?? []).map((r) => [r.zone, r])), [data?.pitcher_zones]);
  const oMap = useMemo(() => new Map((data?.matchup_overlay ?? []).map((r) => [r.zone, r])), [data?.matchup_overlay]);

  const pitchTypes = useMemo(() => {
    const src = view === "batter" ? data?.batter_vs_pitch_types ?? [] : data?.pitcher_pitch_mix ?? [];
    return [...src].sort((a, b) => getUsagePct(b) - getUsagePct(a));
  }, [data?.batter_vs_pitch_types, data?.pitcher_pitch_mix, view]);

  const topUsage = useMemo(() => (pitchTypes.length ? Math.max(...pitchTypes.map(getUsagePct)) : 0), [pitchTypes]);

  const getCell = (zone: number): ZoneCellData => {
    const b = bMap.get(zone);
    const p = pMap.get(zone);
    const o = oMap.get(zone);
    if (view === "batter") return batterCell(b);
    if (view === "pitcher") return pitcherCell(p);
    return matchupCell(o, b, p);
  };

  const viewLabel = view === "batter" ? "Contact Rate" : view === "pitcher" ? "Zone Usage" : "Matchup Advantage";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/95 dark:border-neutral-700/60 dark:bg-neutral-900/65 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-blue-500/20 via-red-400/10 to-transparent dark:from-blue-400/20 dark:via-red-300/10 opacity-90" />
      <div className="pointer-events-none absolute right-[-20%] top-[-35%] h-40 w-40 rounded-full bg-white/60 blur-3xl dark:bg-white/10" />

      {/* Header */}
      <header className="relative px-5 py-4 border-b border-neutral-200/70 dark:border-neutral-700/60 bg-gradient-to-r from-white/80 via-white/65 to-white/45 dark:from-neutral-900/75 dark:via-neutral-900/65 dark:to-neutral-900/35 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">Matchup Lens</p>
            <h3 className="text-sm font-black tracking-wide text-neutral-900 dark:text-white">Hot Zones</h3>
          </div>
          <div className="flex items-center rounded-lg border border-neutral-200/70 dark:border-neutral-700/60 bg-neutral-100/70 dark:bg-neutral-800/60 p-0.5">
            {(["batter", "pitcher", "matchup"] as const).map((mode) => {
              const dis = !hasPitcher && mode !== "batter";
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={dis}
                  onClick={() => !dis && setView(mode)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-all",
                    view === mode
                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                      : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
                    dis && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {mode === "matchup" ? "VS" : mode.slice(0, 3).toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {view === "matchup" ? (
            <>
              <WindowPills label="B" value={batterWindow} onChange={setBatterWindow} />
              <WindowPills label="P" value={pitcherWindow} onChange={setPitcherWindow} />
            </>
          ) : (
            <WindowPills value={singleWindow} onChange={setSingleWindow} />
          )}
        </div>
        {data?.meta?.fallback_used && (
          <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            Showing {data.meta.resolved_season} data (requested {data.meta.requested_season}).
          </p>
        )}
      </header>

      {/* Body */}
      <div className="relative p-5">
        {!hasPitcher && view !== "batter" ? (
          <EmptyMsg text="Pitcher not available. Batter view is still available." />
        ) : isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-[260px] w-[260px] animate-pulse rounded-2xl bg-neutral-100/80 dark:bg-neutral-800/50" />
          </div>
        ) : isError ? (
          <EmptyMsg text="Unable to load zone data." error />
        ) : (
          <div className="space-y-4">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              {viewLabel}
            </p>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[auto_1fr]">
              {/* ── Strike zone grid with wrapping outside zones ── */}
              <div className="flex justify-center">
                <div
                  className="inline-grid"
                  style={{
                    gridTemplateColumns: "40px 72px 72px 72px 40px",
                    gridTemplateRows: "38px 72px 72px 72px 38px",
                    gap: "3px",
                  }}
                >
                  {/* Zone 11 - Above (row 1, col 2-4) */}
                  {(() => {
                    const c = getCell(11);
                    return (
                      <div
                        className="flex items-center justify-center gap-1.5 rounded-xl"
                        style={{ gridRow: 1, gridColumn: "2 / 5", backgroundColor: c.bg }}
                      >
                        <span className={cn("text-sm font-black tabular-nums", c.textCls)}>{c.mainValue}</span>
                        <span className={cn("text-[9px] font-semibold opacity-70", c.textCls)}>Above</span>
                      </div>
                    );
                  })()}

                  {/* Zone 12 - Inside (row 2-4, col 1) */}
                  {(() => {
                    const c = getCell(12);
                    return (
                      <div
                        className="flex flex-col items-center justify-center rounded-xl"
                        style={{ gridRow: "2 / 5", gridColumn: 1, backgroundColor: c.bg }}
                      >
                        <span className={cn("text-sm font-black tabular-nums", c.textCls)}>{c.mainValue}</span>
                        <span className={cn("text-[8px] font-semibold opacity-70", c.textCls)}>In</span>
                      </div>
                    );
                  })()}

                  {/* Inner zones 1-9 */}
                  {MAIN_ZONE_IDS.map((zone) => {
                    const c = getCell(zone);
                    const pos = ZONE_POS[zone];
                    return (
                      <div
                        key={zone}
                        className="relative flex flex-col items-center justify-center rounded-lg"
                        style={{
                          gridRow: pos.row,
                          gridColumn: pos.col,
                          backgroundColor: c.bg,
                        }}
                      >
                        <span className={cn("text-lg font-black tabular-nums leading-none drop-shadow-sm", c.textCls)}>
                          {c.mainValue}
                        </span>
                        {c.subLabel && (
                          <span className={cn("mt-0.5 text-[10px] font-semibold opacity-70 leading-none", c.textCls)}>
                            {c.subLabel}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Strike zone border overlay */}
                  <div
                    className="pointer-events-none rounded-lg border-2 border-neutral-400/50 dark:border-neutral-500/40"
                    style={{ gridRow: "2 / 5", gridColumn: "2 / 5" }}
                  />

                  {/* Zone 14 - Outside (row 2-4, col 5) */}
                  {(() => {
                    const c = getCell(14);
                    return (
                      <div
                        className="flex flex-col items-center justify-center rounded-xl"
                        style={{ gridRow: "2 / 5", gridColumn: 5, backgroundColor: c.bg }}
                      >
                        <span className={cn("text-sm font-black tabular-nums", c.textCls)}>{c.mainValue}</span>
                        <span className={cn("text-[8px] font-semibold opacity-70", c.textCls)}>Out</span>
                      </div>
                    );
                  })()}

                  {/* Zone 13 - Below (row 5, col 2-4) */}
                  {(() => {
                    const c = getCell(13);
                    return (
                      <div
                        className="flex items-center justify-center gap-1.5 rounded-xl"
                        style={{ gridRow: 5, gridColumn: "2 / 5", backgroundColor: c.bg }}
                      >
                        <span className={cn("text-sm font-black tabular-nums", c.textCls)}>{c.mainValue}</span>
                        <span className={cn("text-[9px] font-semibold opacity-70", c.textCls)}>Below</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ── Pitch type breakdown ── */}
              <div className="min-w-0">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                  {view === "batter" ? "Pitch Types Faced" : "Pitch Arsenal"}
                </p>
                {pitchTypes.length === 0 ? (
                  <p className="py-4 text-center text-xs text-neutral-400">No pitch data</p>
                ) : (
                  <div className="space-y-1.5">
                    {pitchTypes.slice(0, 6).map((row) => {
                      const usage = getUsagePct(row);
                      const width = topUsage > 0 ? (usage / topUsage) * 100 : 0;
                      const whiffTone = getWhiffTone(view, row.whiff_pct);
                      return (
                        <div key={`${row.pitch_type ?? row.pitch_name}-${usage}`} className="flex items-center gap-2">
                          <span className="w-[52px] shrink-0 truncate text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
                            {getPitchName(row)}
                          </span>
                          <div className="relative flex-1 h-4 rounded-full bg-neutral-100/80 dark:bg-neutral-800/60 overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500/60 dark:bg-blue-400/40" style={{ width: `${Math.max(8, width)}%` }} />
                            <span className="absolute inset-y-0 right-1.5 flex items-center text-[10px] font-bold tabular-nums text-neutral-600 dark:text-neutral-300">
                              {fmtPct(usage)}
                            </span>
                          </div>
                          <span className="w-[40px] shrink-0 text-right text-[10px] text-neutral-500 dark:text-neutral-400">
                            {row.avg_speed != null ? fmtSpeed(row.avg_speed) : ""}
                          </span>
                          <span className={cn("w-[44px] shrink-0 text-right text-[10px] font-bold", whiffTone)}>
                            {fmtPct(row.whiff_pct)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 pt-0.5 text-[9px] font-semibold text-neutral-400 dark:text-neutral-500">
                      <span className="w-[52px]" />
                      <span className="flex-1 text-center">Usage</span>
                      <span className="w-[40px] text-right">Velo</span>
                      <span className="w-[44px] text-right">Whiff</span>
                    </div>
                  </div>
                )}

                {/* Color legend */}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full" style={{ background: heatColor(0) }} />
                    <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400">Cold</span>
                  </div>
                  <div
                    className="h-2.5 w-20 rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.33)}, ${heatColor(0.66)}, ${heatColor(1)})`,
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full" style={{ background: heatColor(1) }} />
                    <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400">Hot</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-neutral-50/80 dark:bg-neutral-900/40 px-3 py-2 text-[11px]">
              {view === "batter" ? (
                <>
                  <Stat label="Zone Swing" value={fmtPct(data?.batter_totals?.swing_pct)} />
                  <Stat label="Chase" value={fmtPct(data?.batter_totals?.chase_pct)} />
                  <Stat label="Whiff" value={fmtPct(data?.batter_totals?.whiff_pct)} />
                  <Stat label="Zone Contact" value={fmtPct(data?.batter_totals?.zone_contact_pct)} />
                  <Stat label="Pitches" value={fmtCount(data?.batter_totals?.total_pitches)} />
                </>
              ) : view === "pitcher" ? (
                <>
                  <Stat label="Zone%" value={fmtPct(data?.pitcher_totals?.zone_pct)} />
                  <Stat label="Whiff%" value={fmtPct(data?.pitcher_totals?.whiff_pct)} />
                  <Stat label="Velo" value={data?.pitcher_totals?.avg_speed != null ? `${data.pitcher_totals.avg_speed.toFixed(1)}` : "-"} />
                  <Stat label="Pitches" value={fmtCount(data?.pitcher_totals?.total_pitches)} />
                </>
              ) : (
                <>
                  <Stat label="B Contact" value={fmtPct(data?.batter_totals?.zone_contact_pct)} />
                  <Stat label="B Whiff" value={fmtPct(data?.batter_totals?.whiff_pct)} />
                  <Stat label="P Zone" value={fmtPct(data?.pitcher_totals?.zone_pct)} />
                  <Stat label="P Whiff" value={fmtPct(data?.pitcher_totals?.whiff_pct)} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function EmptyMsg({ text, error }: { text: string; error?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed py-8",
        error
          ? "border-red-200/60 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/20"
          : "border-neutral-300/70 dark:border-neutral-700/60 bg-neutral-50/70 dark:bg-neutral-900/40"
      )}
    >
      <p className={cn("text-center text-xs font-medium", error ? "text-red-600 dark:text-red-300" : "text-neutral-500 dark:text-neutral-400")}>
        {text}
      </p>
    </div>
  );
}

function WindowPills({ label, value, onChange }: { label?: string; value: HotZoneWindow; onChange: (v: HotZoneWindow) => void }) {
  return (
    <div className="flex items-center gap-1">
      {label && <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mr-0.5">{label}</span>}
      {WINDOW_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-all",
            value === opt.value
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>{" "}
      <span className="font-bold text-neutral-900 dark:text-white">{value}</span>
    </span>
  );
}
