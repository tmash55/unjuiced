"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { Check, ChevronDown, Cloud, CloudRain, CloudSun, MapPin, Navigation2, RotateCcw, Sun, Thermometer, Wind, Zap } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { useMlbSprayChart } from "@/hooks/use-mlb-spray-chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  BattedBallEvent,
  ZoneSummary,
} from "@/app/api/mlb/spray-chart/route";

// ─── SVG Helpers (mirrors living-stadium-card) ──────────────────────────────

type Point = [number, number];

const VB = 500;
const VB_PAD = 50;

function toPoint(value: unknown): Point | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
}

function toPoints(values: unknown): Point[] {
  if (!Array.isArray(values)) return [];
  return values.map(toPoint).filter((p): p is Point => !!p);
}

function pathFromPoints(points: Point[], close = true): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const segments = [`M ${first[0]} ${first[1]}`];
  for (const p of rest) segments.push(`L ${p[0]} ${p[1]}`);
  if (close) segments.push("Z");
  return segments.join(" ");
}

function normalizeToViewbox(groups: Point[][]): Point[][] {
  const allPoints = groups.flat();
  if (allPoints.length === 0) return groups;

  const xs = allPoints.map((p) => p[0]);
  const ys = allPoints.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const srcW = Math.max(1, maxX - minX);
  const srcH = Math.max(1, maxY - minY);
  const scale = Math.min(
    (VB - VB_PAD * 2) / srcW,
    (VB - VB_PAD * 2) / srcH
  );

  const rw = srcW * scale;
  const rh = srcH * scale;
  const ox = (VB - rw) / 2;
  const oy = (VB - rh) / 2;

  return groups.map((g) =>
    g.map(([x, y]) => [
      ox + (x - minX) * scale,
      VB - oy - (y - minY) * scale,
    ])
  );
}

function getPointCentroid(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
}

// ─── Fallback outfield ──────────────────────────────────────────────────────

const FALLBACK_OUTFIELD: Point[] = [
  [0, 0], [55, 65], [125, 105], [210, 118],
  [295, 106], [365, 66], [420, 0], [210, -80],
];

// ─── MLBAM → SVG coordinate mapper ──────────────────────────────────────────

const MLBAM_HP_X = 125.42;
const MLBAM_HP_Y = 199.27;

function buildCoordMapper(
  normalizedPlate: Point[],
  normalizedOutfield: Point[]
): (cx: number, cy: number) => Point {
  let svgHpX = VB / 2;
  let svgHpY = VB - 40;
  if (normalizedPlate.length > 0) {
    svgHpX = normalizedPlate.reduce((s, p) => s + p[0], 0) / normalizedPlate.length;
    svgHpY = normalizedPlate.reduce((s, p) => s + p[1], 0) / normalizedPlate.length;
  }

  let svgTopY = VB_PAD;
  if (normalizedOutfield.length > 0) {
    svgTopY = Math.min(...normalizedOutfield.map((p) => p[1]));
  }

  // MLBAM hc_y at the outfield fence varies by park (~40-60).
  // 32 balances keeping non-HR dots inside while pushing HRs past the fence.
  const mlbamFieldDepth = MLBAM_HP_Y - 32;
  const svgFieldDepth = svgHpY - svgTopY;
  const scale = svgFieldDepth / mlbamFieldDepth;

  return (cx, cy) => {
    const vx = svgHpX + (cx - MLBAM_HP_X) * scale;
    const vy = svgHpY - (MLBAM_HP_Y - cy) * scale;
    return [vx, vy];
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type MlbTrajectoryFilter = "all" | "ground_ball" | "line_drive" | "fly_ball" | "popup";
export type MlbHitFilter = "all" | "hits" | "single" | "double" | "triple" | "home_run";
export type MlbZoneDisplay = "off" | "show" | "only";
export type MlbEvThreshold = "off" | "90" | "95" | "100" | "105";
export type MlbPitcherHandFilter = "all" | "L" | "R";
export type MlbSprayChartPlayerType = "batter" | "pitcher";

export interface MlbSprayChartFilterState {
  seasonFilter: string;
  trajectoryFilter: MlbTrajectoryFilter;
  pitchTypeFilter: string;
  pitcherHandFilter: MlbPitcherHandFilter;
  hitFilter: MlbHitFilter;
  zoneDisplay: MlbZoneDisplay;
  evThreshold: MlbEvThreshold;
}

interface MlbSprayChartWeather {
  temperature_f?: number | null;
  wind_speed_mph?: number | null;
  wind_relative_deg?: number | null;
  wind_label?: string | null;
  wind_impact?: string | null;
  hr_impact_score?: number | null;
  precip_probability?: number | null;
  cloud_cover_pct?: number | null;
  roof_type?: string | null;
  venue_name?: string | null;
}

interface MlbSprayChartProps {
  playerId: number | null;
  playerType?: MlbSprayChartPlayerType;
  gameId: number | null;
  eventId?: string | null;
  battingHand?: string | null;
  variant?: "default" | "modal";
  className?: string;
  filters?: MlbSprayChartFilterState;
  onFiltersChange?: (filters: MlbSprayChartFilterState) => void;
  hideHeaderControls?: boolean;
  hideZoneBreakdown?: boolean;
  venueName?: string | null;
  weather?: MlbSprayChartWeather | null;
  selectedEventKey?: string | null;
  onEventSelect?: (eventKey: string | null, event: BattedBallEvent | null) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────


export const MLB_SEASON_OPTIONS = [
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "all", label: "2023-2026" },
];

const ZONE_ORDER_RHB = ["oppo", "oppo_center", "center", "pull_center", "pull"];
const ZONE_ORDER_LHB = ["pull", "pull_center", "center", "oppo_center", "oppo"];
const ZONE_ORDER_FIELD = ["rf", "rcf", "cf", "lcf", "lf"];
const ZONE_LABELS: Record<string, string> = {
  pull: "Pull",
  pull_center: "Pull-C",
  center: "Center",
  oppo_center: "Oppo-C",
  oppo: "Oppo",
  lf: "LF",
  lcf: "LCF",
  cf: "CF",
  rcf: "RCF",
  rf: "RF",
};

export const MLB_PITCH_TYPE_LABELS: Record<string, string> = {
  FF: "4-Seam",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  CU: "Curveball",
  CH: "Changeup",
  FS: "Splitter",
  KC: "Knuckle Curve",
  ST: "Sweeper",
  SV: "Slurve",
  KN: "Knuckleball",
  EP: "Eephus",
};

// Fair territory angular bounds (radians, from right foul line to left foul line)
const FAIR_START = Math.PI * 0.25;
const FAIR_END = Math.PI * 0.75;
const ZONE_STEP = (FAIR_END - FAIR_START) / 5;

// ─── Animation ──────────────────────────────────────────────────────────────

const SPRAY_KEYFRAMES = `
  @keyframes spray-straight {
    from { transform: translate(var(--fx), var(--fy)); opacity: 0; }
    to   { transform: translate(0px, 0px); }
  }
  @keyframes spray-arc {
    0%   { transform: translate(var(--fx), var(--fy)); opacity: 0; }
    50%  { transform: translate(var(--mx), var(--my)); opacity: 0.9; }
    100% { transform: translate(0px, 0px); }
  }
  @keyframes trail-draw {
    0%   { stroke-dashoffset: var(--tl); opacity: 0.6; }
    60%  { stroke-dashoffset: 0; opacity: 0.35; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }
  @keyframes glow-pulse {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.9; }
  }
`;

const SEQ_TOTAL = 5;

// ─── Dot helpers ──────────────────────────────────────────────────────────────

const HIT_RESULTS = new Set(["single", "double", "triple", "home run", "home_run", "1b", "2b", "3b", "hr"]);
const HR_RESULTS = new Set(["home run", "home_run", "hr"]);
const SINGLE_RESULTS = new Set(["single", "1b"]);
const DOUBLE_RESULTS = new Set(["double", "2b"]);
const TRIPLE_RESULTS = new Set(["triple", "3b"]);

export const MLB_HIT_FILTER_OPTIONS: Array<{ value: MlbHitFilter; label: string }> = [
  { value: "all", label: "All BIP" },
  { value: "hits", label: "All Hits" },
  { value: "single", label: "Singles" },
  { value: "double", label: "Doubles" },
  { value: "triple", label: "Triples" },
  { value: "home_run", label: "Home Runs" },
];

export const MLB_ZONE_DISPLAY_OPTIONS: Array<{ value: MlbZoneDisplay; label: string }> = [
  { value: "off", label: "Zones Off" },
  { value: "show", label: "Zones On" },
  { value: "only", label: "Zones Only" },
];

export const MLB_TRAJECTORY_OPTIONS: Array<{ value: MlbTrajectoryFilter; label: string }> = [
  { value: "all", label: "All Traj" },
  { value: "ground_ball", label: "Ground Balls" },
  { value: "line_drive", label: "Line Drives" },
  { value: "fly_ball", label: "Fly Balls" },
  { value: "popup", label: "Pop Ups" },
];

export const MLB_PITCHER_HAND_OPTIONS: Array<{ value: MlbPitcherHandFilter; label: string }> = [
  { value: "all", label: "Both" },
  { value: "L", label: "vs LHP" },
  { value: "R", label: "vs RHP" },
];

function getDotColor(result: string | null): string {
  if (!result) return "#EF4444";
  const r = result.toLowerCase();
  if (HR_RESULTS.has(r)) return "#EAB308";
  if (HIT_RESULTS.has(r)) return "#22C55E";
  return "#EF4444";
}

function getDotRadius(event: BattedBallEvent): number {
  const r = (event.result ?? "").toLowerCase();
  let base = HR_RESULTS.has(r) ? 5 : HIT_RESULTS.has(r) ? 3.5 : 3;
  if (event.is_hard_hit) base += 0.75;
  return base;
}

function isHR(result: string | null): boolean {
  if (!result) return false;
  return HR_RESULTS.has(result.toLowerCase());
}

function getCurrentSeasonYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
    }).format(new Date())
  );
}

function normalizeTraj(trajectory: string | null): string {
  return (trajectory ?? "").toLowerCase().replace(/\s+/g, "_");
}

function normalizePitcherHand(value: string | null | undefined): MlbPitcherHandFilter | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized.startsWith("L")) return "L";
  if (normalized.startsWith("R")) return "R";
  return null;
}

export function getMlbNormalizedBatterHand(value: string | null | undefined): "L" | "R" | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized.startsWith("L")) return "L";
  if (normalized.startsWith("R")) return "R";
  return null;
}

export function getMlbSampleBatterHand(
  events: ReadonlyArray<Pick<BattedBallEvent, "batter_hand">>,
  fallback?: string | null
): "L" | "R" | null {
  const fallbackHand = getMlbNormalizedBatterHand(fallback);
  let left = 0;
  let right = 0;

  events.forEach((event) => {
    const hand = getMlbNormalizedBatterHand(event.batter_hand);
    if (hand === "L") left += 1;
    if (hand === "R") right += 1;
  });

  if (left > right) return "L";
  if (right > left) return "R";
  return fallbackHand;
}

function isLeftHandedBatter(value: string | null | undefined): boolean {
  return getMlbNormalizedBatterHand(value) === "L";
}

function inferFixedFieldZone(coordX: number | null | undefined, coordY: number | null | undefined) {
  if (coordX == null || coordY == null) return null;
  const angle = Math.atan2(MLBAM_HP_Y - Number(coordY), Number(coordX) - MLBAM_HP_X);
  if (!Number.isFinite(angle)) return null;

  const clamped = Math.max(FAIR_START, Math.min(FAIR_END - 0.0001, angle));
  const index = Math.floor((clamped - FAIR_START) / ZONE_STEP);
  return ZONE_ORDER_FIELD[index] ?? null;
}

function inferBatterRelativeZone(
  coordX: number | null | undefined,
  coordY: number | null | undefined,
  batterHand: string | null | undefined
) {
  if (coordX == null || coordY == null) return null;
  const angle = Math.atan2(MLBAM_HP_Y - Number(coordY), Number(coordX) - MLBAM_HP_X);
  if (!Number.isFinite(angle)) return null;

  const order = isLeftHandedBatter(batterHand) ? ZONE_ORDER_LHB : ZONE_ORDER_RHB;
  const clamped = Math.max(FAIR_START, Math.min(FAIR_END - 0.0001, angle));
  const index = Math.floor((clamped - FAIR_START) / ZONE_STEP);
  return order[index] ?? null;
}

function getFlightDuration(traj: string, exitVelo: number | null): number {
  // Base duration by trajectory type
  let base: number;
  switch (traj) {
    case "ground_ball": base = 0.35; break;
    case "line_drive": base = 0.45; break;
    case "fly_ball": base = 0.7; break;
    case "popup": base = 0.9; break;
    default: base = 0.4;
  }
  // Scale by exit velocity: harder hit = faster animation
  if (exitVelo != null && exitVelo > 0) {
    if (exitVelo >= 110) return base * 0.55;
    if (exitVelo >= 100) return base * 0.7;
    if (exitVelo >= 90) return base * 0.85;
    if (exitVelo < 70) return base * 1.25;
  }
  return base;
}

const TRAJ_SHORT: Record<string, string> = {
  ground_ball: "Ground Ball",
  line_drive: "Line Drive",
  fly_ball: "Fly Ball",
  popup: "Popup",
};

const TRAJ_TOOLTIPS: Record<string, string> = {
  ground_ball: "Ground Ball — batted ball hit on the ground with a launch angle below 10°",
  line_drive: "Line Drive — hard-hit ball with a launch angle between 10° and 25°. Highest expected batting average.",
  fly_ball: "Fly Ball — batted ball hit in the air with a launch angle between 25° and 50°",
  popup: "Pop Up — batted ball hit very high with a launch angle above 50°. Almost always an out.",
};

export const MLB_EV_THRESHOLD_OPTIONS: Array<{ value: MlbEvThreshold; label: string; mph: number | null }> = [
  { value: "off", label: "All EV", mph: null },
  { value: "90", label: "90+ mph", mph: 90 },
  { value: "95", label: "95+ mph", mph: 95 },
  { value: "100", label: "100+ mph", mph: 100 },
  { value: "105", label: "105+ mph", mph: 105 },
];

export const getDefaultMlbSprayChartFilters = (): MlbSprayChartFilterState => ({
  seasonFilter: String(getCurrentSeasonYear()),
  trajectoryFilter: "all",
  pitchTypeFilter: "all",
  pitcherHandFilter: "all",
  hitFilter: "all",
  zoneDisplay: "show",
  evThreshold: "off",
});

export const getMlbEvThresholdMph = (value: MlbEvThreshold): number | undefined => {
  return MLB_EV_THRESHOLD_OPTIONS.find((o) => o.value === value)?.mph ?? undefined;
};

export function filterMlbBattedBallEvents(
  events: BattedBallEvent[],
  filters: Pick<MlbSprayChartFilterState, "seasonFilter" | "trajectoryFilter" | "pitchTypeFilter" | "pitcherHandFilter" | "hitFilter" | "evThreshold">,
  playerType: MlbSprayChartPlayerType = "batter"
) {
  const minExitVelo = getMlbEvThresholdMph(filters.evThreshold);
  const pitchTypeFilter = filters.pitchTypeFilter ?? "all";
  const pitcherHandFilter = filters.pitcherHandFilter ?? "all";
  let filtered = events;

  if (filters.seasonFilter !== "all") {
    const season = Number(filters.seasonFilter);
    if (Number.isFinite(season)) {
      filtered = filtered.filter((event) => event.season === season);
    }
  }

  if (filters.trajectoryFilter !== "all") {
    filtered = filtered.filter((event) => normalizeTraj(event.trajectory) === filters.trajectoryFilter);
  }

  if (pitchTypeFilter !== "all") {
    filtered = filtered.filter((event) => event.pitch_type === pitchTypeFilter);
  }

  if (pitcherHandFilter !== "all") {
    filtered = filtered.filter((event) => {
      const hand = playerType === "pitcher" ? event.batter_hand : event.pitcher_hand;
      return normalizePitcherHand(hand) === pitcherHandFilter;
    });
  }

  if (filters.hitFilter !== "all") {
    filtered = filtered.filter((event) => {
      const result = (event.result ?? "").toLowerCase();
      if (filters.hitFilter === "hits") return HIT_RESULTS.has(result);
      if (filters.hitFilter === "single") return SINGLE_RESULTS.has(result);
      if (filters.hitFilter === "double") return DOUBLE_RESULTS.has(result);
      if (filters.hitFilter === "triple") return TRIPLE_RESULTS.has(result);
      if (filters.hitFilter === "home_run") return HR_RESULTS.has(result);
      return true;
    });
  }

  if (minExitVelo != null) {
    filtered = filtered.filter((event) => (event.exit_velocity ?? -Infinity) >= minExitVelo);
  }

  return [...filtered].sort((a, b) => {
    const da = a.game_date ?? "";
    const db = b.game_date ?? "";
    return da.localeCompare(db);
  });
}

function formatResult(result: string | null): string {
  if (!result) return "Unknown";
  return result.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const year = String(d.getFullYear()).slice(2);
  return `${month} ${day}, '${year}`;
}

function formatWeatherNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function getRoofLabel(roofType?: string | null): string | null {
  if (!roofType) return null;
  const normalized = roofType.toLowerCase();
  if (normalized.includes("dome")) return "Dome";
  if (normalized.includes("closed")) return "Roof Closed";
  if (normalized.includes("open")) return "Roof Open";
  return null;
}

function getWindTextToneClass(windImpact?: string | null) {
  const impact = windImpact?.toLowerCase();
  if (impact === "favorable") {
    return "text-red-600 dark:text-red-300";
  }
  if (impact === "unfavorable") {
    return "text-emerald-600 dark:text-emerald-300";
  }
  return "text-neutral-500 dark:text-slate-400";
}

function getWeatherConditionIcon(precipPct: number | null, cloudCoverPct: number | null, roofLabel: string | null) {
  if (roofLabel && roofLabel !== "Roof Open") return Cloud;
  if (precipPct !== null && precipPct >= 25) return CloudRain;
  if (cloudCoverPct !== null && cloudCoverPct >= 70) return Cloud;
  if (cloudCoverPct !== null && cloudCoverPct >= 30) return CloudSun;
  return Sun;
}

function getWeatherConditionTone(precipPct: number | null, cloudCoverPct: number | null, roofLabel: string | null) {
  if (roofLabel && roofLabel !== "Roof Open") return "text-sky-500 dark:text-sky-300";
  if (precipPct !== null && precipPct >= 25) return "text-sky-600 dark:text-sky-300";
  if (cloudCoverPct !== null && cloudCoverPct >= 70) return "text-slate-500 dark:text-slate-300";
  if (cloudCoverPct !== null && cloudCoverPct >= 30) return "text-amber-500 dark:text-amber-300";
  return "text-amber-500 dark:text-amber-300";
}

function getZoneHeatStyle(pct: number, maxPct: number) {
  if (pct <= 0 || maxPct <= 0) {
    return {
      fill: "rgba(71, 85, 105, 0.08)",
      stroke: "rgba(148, 163, 184, 0.12)",
      bar: "rgba(71, 85, 105, 0.5)",
      label: "rgba(226, 232, 240, 0.58)",
    };
  }

  const intensity = Math.min(1, Math.max(0, pct / maxPct));
  const alpha = 0.08 + intensity * 0.24;
  const strokeAlpha = 0.16 + intensity * 0.28;
  const barAlpha = 0.42 + intensity * 0.46;

  return {
    fill: `rgba(20, 184, 166, ${alpha})`,
    stroke: `rgba(45, 212, 191, ${strokeAlpha})`,
    bar: `rgba(20, 184, 166, ${barAlpha})`,
    label: intensity >= 0.72 ? "rgba(240, 253, 250, 0.92)" : "rgba(226, 232, 240, 0.68)",
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function angleDistance(a: number, b: number) {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

function findOutfieldPointAtAngle(points: Point[], hp: Point, targetAngle: number): Point | null {
  const candidates = points
    .map((point) => {
      const dx = point[0] - hp[0];
      const dy = hp[1] - point[1];
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      return { point, radius, score: angleDistance(angle, targetAngle) - radius * 0.0006 };
    })
    .filter((candidate) => candidate.radius > 24);

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.point ?? null;
}

export function getMlbBattedBallEventKey(event: BattedBallEvent, index = 0): string {
  if (event.id != null) return `id:${event.id}`;
  return [
    "bb",
    event.game_date ?? "date",
    event.game_id ?? "game",
    event.inning ?? "inn",
    event.coord_x ?? "x",
    event.coord_y ?? "y",
    event.exit_velocity ?? "ev",
    event.launch_angle ?? "la",
    event.result ?? event.event_type ?? "result",
    index,
  ].join(":");
}

// ─── Zone wedge path builder ────────────────────────────────────────────────

function buildWedgePath(
  hpX: number,
  hpY: number,
  startAngle: number,
  endAngle: number,
  radius: number
): string {
  const steps = 16;
  let d = `M ${hpX} ${hpY}`;
  for (let s = 0; s <= steps; s++) {
    const a = startAngle + (endAngle - startAngle) * (s / steps);
    d += ` L ${hpX + radius * Math.cos(a)} ${hpY - radius * Math.sin(a)}`;
  }
  return d + " Z";
}

// ─── Precomputed dot data ────────────────────────────────────────────────────

interface DotDatum {
  eventKey: string;
  event: BattedBallEvent;
  vx: number;
  vy: number;
  traj: string;
  flightDur: number;
  isArc: boolean;
  color: string;
  radius: number;
  finalOpacity: number;
  hr: boolean;
  trailLen: number;
}

interface ZoneOverlay {
  name: string;
  label: string;
  path: string;
  labelX: number;
  labelY: number;
  count: number;
  pct: number;
  boundaryAngle: number | null; // angle of left boundary line (null for last zone)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MlbSprayChart({
  playerId,
  playerType = "batter",
  gameId,
  eventId,
  battingHand,
  variant = "default",
  className,
  filters,
  onFiltersChange,
  hideHeaderControls = false,
  hideZoneBreakdown = false,
  venueName,
  weather,
  selectedEventKey = null,
  onEventSelect,
}: MlbSprayChartProps) {
  const [localFilters, setLocalFilters] = useState<MlbSprayChartFilterState>(() => getDefaultMlbSprayChartFilters());
  const [animKey, setAnimKey] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const chartId = useId().replace(/:/g, "");
  const activeFilters = filters ?? localFilters;
  const setFilters = useCallback((patch: Partial<MlbSprayChartFilterState>) => {
    const next = { ...activeFilters, ...patch };
    if (onFiltersChange) {
      onFiltersChange(next);
    } else {
      setLocalFilters(next);
    }
    setHoveredIdx(null);
  }, [activeFilters, onFiltersChange]);

  const seasons = useMemo(() => {
    if (activeFilters.seasonFilter === "all") return undefined;
    return [Number(activeFilters.seasonFilter)];
  }, [activeFilters.seasonFilter]);

  const minExitVelo = getMlbEvThresholdMph(activeFilters.evThreshold);

  const { data, isLoading, isError } = useMlbSprayChart({
    playerId,
    playerType,
    gameId,
    eventId,
    seasons,
    minExitVelo,
    enabled: typeof playerId === "number",
  });

  // ── Client-side filters + chronological sort ──
  const eventsArr = Array.isArray(data?.events) ? data.events : [];
  const pitchTypeOptions = useMemo<Array<{ value: string; label: string }>>(() => {
    const pitchTypes = Array.from(
      new Set(
        eventsArr
          .map((event) => event.pitch_type)
          .filter((pitchType): pitchType is string => Boolean(pitchType))
      )
    ).sort((a, b) => {
      const labelA = MLB_PITCH_TYPE_LABELS[a] ?? a;
      const labelB = MLB_PITCH_TYPE_LABELS[b] ?? b;
      return labelA.localeCompare(labelB);
    });

    return [
      { value: "all", label: "All Pitches" },
      ...pitchTypes.map((pitchType) => ({
        value: pitchType,
        label: MLB_PITCH_TYPE_LABELS[pitchType] ?? pitchType,
      })),
    ];
  }, [eventsArr]);
  const filteredEvents = useMemo(() => {
    if (eventsArr.length === 0) return [];
    return filterMlbBattedBallEvents(eventsArr, activeFilters, playerType);
  }, [eventsArr, activeFilters, playerType]);
  const sampleBatterHand = useMemo(
    () => getMlbSampleBatterHand(filteredEvents, battingHand),
    [filteredEvents, battingHand]
  );

  // ── Stadium geometry (normalized to 500x500 viewbox) ──
  const outfieldRaw = useMemo(() => toPoints(data?.stadium_geometry?.outfieldOuter ?? []), [data?.stadium_geometry]);
  const outfieldInnerRaw = useMemo(() => toPoints(data?.stadium_geometry?.outfieldInner ?? []), [data?.stadium_geometry]);
  const infieldRaw = useMemo(() => toPoints(data?.stadium_geometry?.infieldOuter ?? []), [data?.stadium_geometry]);
  const infieldInnerRaw = useMemo(() => toPoints(data?.stadium_geometry?.infieldInner ?? []), [data?.stadium_geometry]);
  const foulRaw = useMemo(() => toPoints(data?.stadium_geometry?.foulLines ?? []), [data?.stadium_geometry]);
  const plateRaw = useMemo(() => toPoints(data?.stadium_geometry?.homePlate ?? []), [data?.stadium_geometry]);

  const outfieldPoints = outfieldRaw.length >= 12 ? outfieldRaw : FALLBACK_OUTFIELD;

  const [normalizedOutfield, normalizedOutfieldInner, normalizedInfield, normalizedInfieldInner, normalizedFoul, normalizedPlate] = useMemo(() => {
    const groups = normalizeToViewbox([outfieldPoints, outfieldInnerRaw, infieldRaw, infieldInnerRaw, foulRaw, plateRaw]);
    return [groups[0] || [], groups[1] || [], groups[2] || [], groups[3] || [], groups[4] || [], groups[5] || []];
  }, [outfieldPoints, outfieldInnerRaw, infieldRaw, infieldInnerRaw, foulRaw, plateRaw]);

  const fieldPolygonPoints = useMemo(() => {
    const plateAnchor = getPointCentroid(normalizedPlate);
    if (!plateAnchor || normalizedOutfield.length < 3) return normalizedOutfield;

    const lowestWallY = Math.max(...normalizedOutfield.map(([, y]) => y));
    const isWallArcOnly = lowestWallY < plateAnchor[1] - 24;

    return isWallArcOnly ? [plateAnchor, ...normalizedOutfield] : normalizedOutfield;
  }, [normalizedOutfield, normalizedPlate]);

  const outfieldPath = pathFromPoints(fieldPolygonPoints);
  const outfieldInnerPath = normalizedOutfieldInner.length >= 3 ? pathFromPoints(normalizedOutfieldInner, false) : "";
  const infieldPath = normalizedInfield.length >= 3 ? pathFromPoints(normalizedInfield) : "";
  const infieldInnerPath = normalizedInfieldInner.length >= 3 ? pathFromPoints(normalizedInfieldInner) : "";
  const foulPath = normalizedFoul.length >= 2 ? pathFromPoints(normalizedFoul, false) : "";
  const platePath = normalizedPlate.length >= 3 ? pathFromPoints(normalizedPlate) : "";

  // ── MLBAM dot mapper ──
  const mapCoord = useMemo(
    () => buildCoordMapper(normalizedPlate, normalizedOutfield),
    [normalizedPlate, normalizedOutfield]
  );

  const hpSvg = useMemo<Point>(() => mapCoord(MLBAM_HP_X, MLBAM_HP_Y), [mapCoord]);
  const currentYear = useMemo(() => getCurrentSeasonYear(), []);
  const infieldDetails = useMemo(() => {
    const infieldAboveHome = normalizedInfield.filter(([, y]) => y < hpSvg[1] - 2);
    const topY = infieldAboveHome.length > 0 ? Math.min(...infieldAboveHome.map(([, y]) => y)) : hpSvg[1] - 76;
    const diamondSize = clampNumber((hpSvg[1] - topY) * 0.54, 30, 48);
    const home: Point = [hpSvg[0], hpSvg[1] - 2];
    const first: Point = [hpSvg[0] + diamondSize * 0.78, hpSvg[1] - diamondSize * 0.78];
    const second: Point = [hpSvg[0], hpSvg[1] - diamondSize * 1.55];
    const third: Point = [hpSvg[0] - diamondSize * 0.78, hpSvg[1] - diamondSize * 0.78];
    const mound: Point = [hpSvg[0], hpSvg[1] - diamondSize * 0.86];
    const dirtPath = pathFromPoints([home, first, second, third], true);

    return {
      dirtPath,
      mound,
      bases: [
        { label: "3B", point: third },
        { label: "2B", point: second },
        { label: "1B", point: first },
      ],
    };
  }, [hpSvg, normalizedInfield]);
  const distanceMarkers = useMemo(() => {
    const distances = data?.stadium_geometry?.fieldDistances;
    const markers = [
      { key: "lf", label: "LF", distance: distances?.leftLine, angle: FAIR_END },
      { key: "lcf", label: "LCF", distance: distances?.leftCenter, angle: FAIR_END - ZONE_STEP * 1.2 },
      { key: "cf", label: "CF", distance: distances?.centerField, angle: Math.PI / 2 },
      { key: "rcf", label: "RCF", distance: distances?.rightCenter, angle: FAIR_START + ZONE_STEP * 1.2 },
      { key: "rf", label: "RF", distance: distances?.rightLine, angle: FAIR_START },
    ];

    return markers.flatMap((marker) => {
      if (typeof marker.distance !== "number" || !Number.isFinite(marker.distance)) return [];
      const point = findOutfieldPointAtAngle(normalizedOutfield, hpSvg, marker.angle);
      if (!point) return [];

      const dx = point[0] - hpSvg[0];
      const dy = point[1] - hpSvg[1];
      const mag = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / mag;
      const uy = dy / mag;
      const labelOffset = marker.label === "CF" ? 18 : marker.label.includes("C") ? 15 : 12;

      return [{
        ...marker,
        distance: Number(marker.distance),
        tickX1: point[0] - ux * 4,
        tickY1: point[1] - uy * 4,
        tickX2: point[0] - ux * 15,
        tickY2: point[1] - uy * 15,
        labelX: clampNumber(point[0] - ux * labelOffset, 28, VB - 28),
        labelY: clampNumber(point[1] - uy * labelOffset, 24, VB - 28),
      }];
    });
  }, [data?.stadium_geometry?.fieldDistances, hpSvg, normalizedOutfield]);

  // ── Precomputed dot data (sorted chronologically) ──
  const dots = useMemo<DotDatum[]>(() => {
    return filteredEvents
      .filter((e) => e.coord_x !== null && e.coord_y !== null)
      .map((event, index) => {
        const [vx, vy] = mapCoord(event.coord_x!, event.coord_y!);
        const traj = normalizeTraj(event.trajectory);
        const flightDur = getFlightDuration(traj, event.exit_velocity);
        const isArc = traj === "fly_ball" || traj === "popup";
        const trailLen = Math.sqrt((vx - hpSvg[0]) ** 2 + (vy - hpSvg[1]) ** 2);

        return {
          eventKey: getMlbBattedBallEventKey(event, index),
          event, vx, vy, traj, flightDur, isArc,
          color: getDotColor(event.result),
          radius: getDotRadius(event),
          finalOpacity: event.season === currentYear ? 1 : 0.6,
          hr: isHR(event.result),
          trailLen,
        };
      });
  }, [filteredEvents, mapCoord, hpSvg, currentYear]);

  // ── Sequential delay per at-bat ──
  const seqDelay = useMemo(() => {
    if (dots.length <= 1) return 0;
    const raw = SEQ_TOTAL / dots.length;
    return Math.max(0.015, Math.min(0.15, raw));
  }, [dots.length]);

  // ── Zone data ──
  const zoneOrder = playerType === "pitcher"
    ? ZONE_ORDER_FIELD
    : sampleBatterHand === "L"
      ? ZONE_ORDER_LHB
      : ZONE_ORDER_RHB;
  const rawZoneSummaryArr = Array.isArray(data?.zone_summary) ? data.zone_summary : [];
  const zoneSummaryArr = useMemo(() => {
    const countByZone = new Map<string, ZoneSummary>();
    filteredEvents.forEach((event) => {
      const zone = playerType === "pitcher"
        ? inferFixedFieldZone(event.coord_x, event.coord_y)
        : inferBatterRelativeZone(event.coord_x, event.coord_y, event.batter_hand ?? sampleBatterHand ?? battingHand) ?? event.zone;
      if (!zone) return;
      const current = countByZone.get(zone) ?? { zone, count: 0, hits: 0, avg: null, hr: 0 };
      const result = (event.result ?? "").toLowerCase();
      current.count += 1;
      if (HIT_RESULTS.has(result)) current.hits += 1;
      if (HR_RESULTS.has(result)) current.hr += 1;
      countByZone.set(zone, current);
    });

    const derived = Array.from(countByZone.values());
    return derived.length > 0 || playerType === "pitcher" ? derived : rawZoneSummaryArr;
  }, [battingHand, filteredEvents, playerType, rawZoneSummaryArr, sampleBatterHand]);
  const zoneSummaries = useMemo(() => {
    if (zoneSummaryArr.length === 0) return [];
    return zoneOrder
      .map((zone) => zoneSummaryArr.find((z) => z.zone === zone))
      .filter((z): z is ZoneSummary => !!z);
  }, [zoneSummaryArr, zoneOrder]);

  const totalZoneCount = zoneSummaries.reduce((sum, z) => sum + z.count, 0);

  // ── Zone overlays (angular wedges clipped to field) ──
  const zoneOverlays = useMemo<ZoneOverlay[]>(() => {
    // Compute field radius for label placement
    const outfieldAboveHP = normalizedOutfield.filter(([, py]) => py < hpSvg[1] - 5);
    const fieldRadius = outfieldAboveHP.length > 0
      ? Math.max(...outfieldAboveHP.map(([px, py]) =>
          Math.sqrt((px - hpSvg[0]) ** 2 + (py - hpSvg[1]) ** 2)
        ))
      : 200;

    return zoneOrder.map((zoneName, i) => {
      const startAngle = FAIR_START + i * ZONE_STEP;
      const endAngle = FAIR_START + (i + 1) * ZONE_STEP;
      const midAngle = (startAngle + endAngle) / 2;

      const path = buildWedgePath(hpSvg[0], hpSvg[1], startAngle, endAngle, 600);

      const labelR = fieldRadius * 0.55;
      const labelX = hpSvg[0] + labelR * Math.cos(midAngle);
      const labelY = hpSvg[1] - labelR * Math.sin(midAngle);

      const zoneStats = zoneSummaryArr.find((z) => z.zone === zoneName);
      const count = zoneStats?.count ?? 0;
      const pct = totalZoneCount > 0 ? count / totalZoneCount : 0;

      return {
        name: zoneName,
        label: ZONE_LABELS[zoneName] ?? zoneName,
        path,
        labelX,
        labelY,
        count,
        pct,
        boundaryAngle: i < 4 ? endAngle : null,
      };
    });
  }, [zoneOrder, normalizedOutfield, hpSvg, zoneSummaryArr, totalZoneCount]);

  // ── Trajectory summary ──
  const trajSummary = Array.isArray(data?.trajectory_summary) ? data.trajectory_summary : [];

  // ── Hard contact summary ──
  const hardContact = data?.hard_contact ?? null;

  // ── Animation restart key ──
  // Keep filters out of this key so changing filters swaps the plotted data without replaying the spray animation.
  const dotGroupKey = `${animKey}`;

  // ── Hover handlers ──
  const handleDotEnter = useCallback((idx: number) => setHoveredIdx(idx), []);
  const handleDotLeave = useCallback(() => setHoveredIdx(null), []);
  const handleDotClick = useCallback(
    (idx: number, event?: React.MouseEvent<SVGGElement>) => {
      event?.stopPropagation();
      const dot = dots[idx] ?? null;
      const nextKey = dot?.eventKey ?? null;
      const shouldClear = selectedEventKey === nextKey;
      setHoveredIdx(shouldClear ? null : idx);
      onEventSelect?.(shouldClear ? null : nextKey, shouldClear ? null : dot?.event ?? null);
    },
    [dots, onEventSelect, selectedEventKey]
  );
  const handleChartBackgroundClick = useCallback(() => {
    if (!selectedEventKey) return;
    setHoveredIdx(null);
    onEventSelect?.(null, null);
  }, [onEventSelect, selectedEventKey]);

  const hovered = hoveredIdx !== null ? dots[hoveredIdx] ?? null : null;
  const hasSelectedDot = Boolean(selectedEventKey && dots.some((dot) => dot.eventKey === selectedEventKey));
  const isModalVariant = variant === "modal";
  const shellClassName = cn(
    isModalVariant
      ? "relative overflow-hidden rounded-lg border border-neutral-200/50 bg-white shadow-sm shadow-slate-200/20 dark:border-neutral-700/30 dark:bg-neutral-800/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
      : "relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/95 dark:border-neutral-700/60 dark:bg-neutral-900/65 shadow-xl ring-1 ring-black/5 dark:ring-white/10",
    className
  );
  const headerClassName = cn(
    "relative border-b backdrop-blur-sm",
    isModalVariant
      ? "border-neutral-200/50 bg-white/70 px-4 py-3 dark:border-neutral-700/30 dark:bg-transparent"
      : "border-neutral-200/70 bg-gradient-to-r from-white/80 via-white/65 to-white/45 px-5 py-4 dark:border-neutral-700/60 dark:from-neutral-900/75 dark:via-neutral-900/65 dark:to-neutral-900/35"
  );
  const bodyClassName = isModalVariant ? "relative p-3" : "relative p-5";
  const fieldMaxWidthClassName = "max-w-[500px]";
  const stadiumFrameClassName = "relative";
  const showExtendedSummaries = !isModalVariant;
  const displayVenueName = venueName || weather?.venue_name || null;
  const tempF = formatWeatherNumber(weather?.temperature_f);
  const windSpeed = formatWeatherNumber(weather?.wind_speed_mph);
  const windRelativeDeg = formatWeatherNumber(weather?.wind_relative_deg);
  const precipPct = formatWeatherNumber(weather?.precip_probability);
  const cloudCoverPct = formatWeatherNumber(weather?.cloud_cover_pct);
  const roofLabel = getRoofLabel(weather?.roof_type);
  const roofControlled = Boolean(roofLabel && roofLabel !== "Roof Open");
  const displayRoofLabel = roofControlled ? roofLabel : null;
  const hasConditionData = Boolean(precipPct !== null || cloudCoverPct !== null || displayRoofLabel);
  const shouldShowWeatherContext = Boolean(displayVenueName || tempF !== null || precipPct !== null || cloudCoverPct !== null || displayRoofLabel);
  const WeatherConditionIcon = getWeatherConditionIcon(precipPct, cloudCoverPct, displayRoofLabel);
  const weatherConditionTone = getWeatherConditionTone(precipPct, cloudCoverPct, displayRoofLabel);
  const shouldShowWindMarker = Boolean(windSpeed !== null && windSpeed >= 3 && !roofControlled);

  // ── Loading ──
  if (isLoading) {
    return (
      <section className={shellClassName}>
        {!isModalVariant && <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-500/25 via-emerald-400/10 to-transparent opacity-90 dark:from-emerald-400/25 dark:via-emerald-300/10" />}
        <header className={headerClassName}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Batted Ball
          </p>
          <h3 className="text-sm font-black tracking-wide text-neutral-900 dark:text-white">Spray Chart</h3>
        </header>
        <div className={bodyClassName}>
          <div className={cn("animate-pulse rounded-2xl bg-neutral-100/80 dark:bg-neutral-800/50", isModalVariant ? "h-[320px]" : "h-[400px]")} />
        </div>
      </section>
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <section className={cn(shellClassName, "border-red-200/60 bg-red-50/40 p-6 dark:border-red-800/50 dark:bg-red-950/20")}>
        <p className="text-center text-sm font-semibold text-red-600 dark:text-red-300">
          Unable to load spray chart data. Please try again later.
        </p>
      </section>
    );
  }

  // ── Empty initial response ──
  if (!data) {
    return (
      <section className={shellClassName}>
        {!isModalVariant && <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-500/25 via-emerald-400/10 to-transparent opacity-90 dark:from-emerald-400/25 dark:via-emerald-300/10" />}
        <header className={headerClassName}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Batted Ball
          </p>
          <h3 className="text-sm font-black tracking-wide text-neutral-900 dark:text-white">Spray Chart</h3>
        </header>
        <div className={bodyClassName}>
          <div className="rounded-2xl border border-dashed border-neutral-300/70 dark:border-neutral-700/60 bg-neutral-50/70 dark:bg-neutral-900/40 py-12">
            <p className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
              No batted ball data available
              {activeFilters.trajectoryFilter !== "all" && " for this trajectory filter"}
              {activeFilters.hitFilter !== "all" && ` (${MLB_HIT_FILTER_OPTIONS.find(o => o.value === activeFilters.hitFilter)?.label ?? activeFilters.hitFilter})`}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Zone overlay color (based on deviation from even split) ──
  const maxZonePct = Math.max(...zoneOverlays.map((z) => z.pct), 0.01);
  const hasNoPlottedResults = dots.length === 0;
  const resetFilters = () => {
    const next = getDefaultMlbSprayChartFilters();
    if (onFiltersChange) {
      onFiltersChange(next);
    } else {
      setLocalFilters(next);
    }
    setHoveredIdx(null);
  };

  return (
    <section className={shellClassName}>
      {/* Accent gradient */}
      {!isModalVariant && <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-500/25 via-emerald-400/10 to-transparent opacity-90 dark:from-emerald-400/25 dark:via-emerald-300/10" />}
      {!isModalVariant && <div className="pointer-events-none absolute right-[-20%] top-[-35%] h-40 w-40 rounded-full bg-white/60 blur-3xl dark:bg-white/10" />}

      {/* Header */}
      <header className={headerClassName}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={cn("mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400", isModalVariant && "tracking-[0.12em]")}>
              Batted Ball
            </p>
            <h3 className="text-sm font-black tracking-wide text-neutral-900 dark:text-white">Spray Chart</h3>
          </div>

          {/* Top-right controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {hideHeaderControls && (
              <FilterSelect
                value={activeFilters.zoneDisplay}
                onChange={(v) => setFilters({ zoneDisplay: v as MlbZoneDisplay })}
                options={MLB_ZONE_DISPLAY_OPTIONS}
              />
            )}

            <button
              type="button"
              onClick={() => { setAnimKey((k) => k + 1); setHoveredIdx(null); }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-neutral-200/60 bg-neutral-100 px-2 py-1.5 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-200/70 active:scale-[0.98] dark:border-neutral-700/60 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
                hideHeaderControls && "px-2.5"
              )}
              title="Replay animation"
              aria-label="Replay spray chart animation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {hideHeaderControls && <span className="hidden sm:inline">Replay</span>}
            </button>

            {!hideHeaderControls && (
              <>
                <FilterSelect
                  value={activeFilters.trajectoryFilter}
                  onChange={(v) => setFilters({ trajectoryFilter: v as MlbTrajectoryFilter })}
                  options={MLB_TRAJECTORY_OPTIONS}
                />

                <FilterSelect
                  value={activeFilters.pitchTypeFilter ?? "all"}
                  onChange={(v) => setFilters({ pitchTypeFilter: v })}
                  options={pitchTypeOptions}
                />

                <FilterSelect
                  value={activeFilters.pitcherHandFilter ?? "all"}
                  onChange={(v) => setFilters({ pitcherHandFilter: v as MlbPitcherHandFilter })}
                  options={MLB_PITCHER_HAND_OPTIONS}
                />

                <FilterSelect
                  value={activeFilters.hitFilter}
                  onChange={(v) => setFilters({ hitFilter: v as MlbHitFilter })}
                  options={MLB_HIT_FILTER_OPTIONS}
                />

                <FilterSelect
                  value={activeFilters.zoneDisplay}
                  onChange={(v) => setFilters({ zoneDisplay: v as MlbZoneDisplay })}
                  options={MLB_ZONE_DISPLAY_OPTIONS}
                />

                <FilterSelect
                  value={activeFilters.seasonFilter}
                  onChange={(v) => setFilters({ seasonFilter: v })}
                  options={MLB_SEASON_OPTIONS}
                />

                <Tooltip content="Filter by minimum exit velocity. Hard hit = 95+ mph." side="bottom">
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors shrink-0",
                            activeFilters.evThreshold !== "off"
                              ? "border-amber-400/60 bg-amber-50 text-amber-700 dark:border-amber-600/50 dark:bg-amber-900/30 dark:text-amber-300"
                              : "border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-700"
                          )}
                        >
                          <Zap className={cn("h-3.5 w-3.5", activeFilters.evThreshold !== "off" && "fill-current")} />
                          {activeFilters.evThreshold === "off" ? "EV" : `${MLB_EV_THRESHOLD_OPTIONS.find((o) => o.value === activeFilters.evThreshold)?.mph}+`}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[120px]">
                        {MLB_EV_THRESHOLD_OPTIONS.map((opt) => (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={() => setFilters({ evThreshold: opt.value })}
                            className={cn(
                              "flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer",
                              opt.value === activeFilters.evThreshold && "bg-neutral-100 dark:bg-neutral-800/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            {opt.value === activeFilters.evThreshold && <Check className="h-3.5 w-3.5 text-neutral-500" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </header>

      {shouldShowWeatherContext && (
        <div className="flex flex-col gap-2 border-b border-neutral-200/50 bg-neutral-50/55 px-4 py-2.5 dark:border-neutral-700/30 dark:bg-slate-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {hasConditionData && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/70 bg-white/80 px-2 py-1.5 text-[10px] font-black text-neutral-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/55 dark:text-slate-300">
                <WeatherConditionIcon className={cn("h-3.5 w-3.5", weatherConditionTone)} />
                {precipPct !== null && precipPct >= 25
                  ? `${precipPct}% rain`
                  : cloudCoverPct !== null
                    ? `${cloudCoverPct}% clouds`
                    : displayRoofLabel}
              </span>
            )}
            {tempF !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/70 bg-white/80 px-2 py-1.5 text-[10px] font-black tabular-nums text-neutral-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/55 dark:text-slate-300">
                <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                {tempF}°F
              </span>
            )}
            {displayRoofLabel && (
              <span className="inline-flex items-center rounded-lg border border-sky-300/30 bg-sky-500/10 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-sky-600 shadow-sm dark:text-sky-300">
                {displayRoofLabel}
              </span>
            )}
          </div>

          {displayVenueName && (
            <div className="flex min-w-0 items-center gap-1.5 text-neutral-700 dark:text-slate-200 sm:justify-end">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-500" />
              <span className="truncate text-xs font-black">{displayVenueName}</span>
            </div>
          )}
        </div>
      )}

      <div className={bodyClassName}>
        <div>
          {/* SVG stadium + tooltip wrapper */}
          <div className={isModalVariant ? "px-1" : "px-3"}>
            <div className={stadiumFrameClassName}>
              <div className={cn("relative mx-auto", fieldMaxWidthClassName)}>
                <svg
                  viewBox={`0 0 ${VB} ${VB}`}
                  className={cn("w-full overflow-visible", selectedEventKey && "cursor-pointer")}
                  overflow="visible"
                  role="img"
                  aria-label={`Spray chart with ${dots.length} batted balls`}
                  onClick={handleChartBackgroundClick}
                >
                <defs>
                  <style>{SPRAY_KEYFRAMES}</style>
                  <clipPath id={`${chartId}-field-clip`}>
                    <path d={outfieldPath} />
                  </clipPath>
                  <radialGradient id={`${chartId}-hover-glow`}>
                    <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id={`${chartId}-field-grass`} x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#0F766E" stopOpacity="0.22" />
                    <stop offset="52%" stopColor="#134E4A" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0F172A" stopOpacity="0.16" />
                  </linearGradient>
                  <radialGradient id={`${chartId}-infield-grass`}>
                    <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0F766E" stopOpacity="0.13" />
                  </radialGradient>
                  <linearGradient id={`${chartId}-infield-dirt`} x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#D97706" stopOpacity="0.36" />
                    <stop offset="58%" stopColor="#92400E" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#451A03" stopOpacity="0.18" />
                  </linearGradient>
                  <radialGradient id={`${chartId}-base-glow`}>
                    <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.15" />
                  </radialGradient>
                </defs>

                {/* Grass / outfield */}
                <path
                  d={outfieldPath}
                  fill={`url(#${chartId}-field-grass)`}
                  stroke="rgba(94, 234, 212, 0.18)"
                  strokeWidth={1.25}
                />
                {outfieldInnerPath && (
                  <path
                    d={outfieldInnerPath}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.18)"
                    strokeWidth={0.8}
                    strokeDasharray="4 4"
                  />
                )}

                {/* Zone overlays (clipped to field) */}
                {activeFilters.zoneDisplay !== "off" && (
                  <g clipPath={`url(#${chartId}-field-clip)`}>
                    {zoneOverlays.map((zone) => {
                      const heat = getZoneHeatStyle(zone.pct, maxZonePct);

                      return (
                        <path
                          key={zone.name}
                          d={zone.path}
                          fill={heat.fill}
                          stroke={heat.stroke}
                          strokeWidth={zone.pct === maxZonePct ? 1.1 : 0.65}
                        />
                      );
                    })}

                    {/* Zone boundary lines */}
                    {zoneOverlays.map((zone) => {
                      if (zone.boundaryAngle === null) return null;
                      const r = 600;
                      const x2 = hpSvg[0] + r * Math.cos(zone.boundaryAngle);
                      const y2 = hpSvg[1] - r * Math.sin(zone.boundaryAngle);
                      return (
                        <line
                          key={`zb-${zone.name}`}
                          x1={hpSvg[0]}
                          y1={hpSvg[1]}
                          x2={x2}
                          y2={y2}
                          stroke="rgba(255, 255, 255, 0.12)"
                          strokeWidth={1}
                          strokeDasharray="6 4"
                        />
                      );
                    })}
                  </g>
                )}

                {/* Zone labels */}
                {activeFilters.zoneDisplay !== "off" &&
                  zoneOverlays.map((zone) => {
                    const heat = getZoneHeatStyle(zone.pct, maxZonePct);

                    return (
                      <g key={`zl-${zone.name}`} className="pointer-events-none">
                        <text
                          x={zone.labelX}
                          y={zone.labelY - 5}
                          textAnchor="middle"
                          fill={heat.label}
                          fontSize={10}
                          fontWeight={800}
                          letterSpacing="0.04em"
                        >
                          {zone.label}
                        </text>
                        <text
                          x={zone.labelX}
                          y={zone.labelY + 7}
                          textAnchor="middle"
                          fill={zone.pct === maxZonePct ? "rgba(45, 212, 191, 0.96)" : "rgba(203, 213, 225, 0.55)"}
                          fontSize={9}
                          fontWeight={800}
                        >
                          {zone.count > 0 ? `${Math.round(zone.pct * 100)}%` : ""}
                        </text>
                      </g>
                    );
                  })}

                {/* Stadium wall distances */}
                {distanceMarkers.length > 0 && (
                  <g className="pointer-events-none">
                    {distanceMarkers.map((marker) => (
                      <g key={marker.key}>
                        <line
                          x1={marker.tickX1}
                          y1={marker.tickY1}
                          x2={marker.tickX2}
                          y2={marker.tickY2}
                          stroke="rgba(125, 211, 252, 0.35)"
                          strokeWidth={1}
                        />
                        <text
                          x={marker.labelX}
                          y={marker.labelY}
                          textAnchor="middle"
                          fill="rgba(226, 232, 240, 0.5)"
                          fontSize={9}
                          fontWeight={900}
                          letterSpacing="0.06em"
                        >
                          {Math.round(marker.distance)}
                        </text>
                      </g>
                    ))}
                  </g>
                )}

                {/* Infield */}
                {infieldPath && (
                  <path
                    d={infieldPath}
                    fill={`url(#${chartId}-infield-grass)`}
                    stroke="rgba(94, 234, 212, 0.28)"
                    strokeWidth={1}
                  />
                )}
                {infieldDetails.dirtPath && (
                  <g className="pointer-events-none">
                    <path
                      d={infieldDetails.dirtPath}
                      fill="none"
                      stroke={`url(#${chartId}-infield-dirt)`}
                      strokeWidth={11}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {infieldDetails.bases.map((base) => (
                      <circle
                        key={`dirt-${base.label}`}
                        cx={base.point[0]}
                        cy={base.point[1]}
                        r={8.5}
                        fill="rgba(146, 64, 14, 0.18)"
                      />
                    ))}
                  </g>
                )}
                {infieldInnerPath && (
                  <path
                    d={infieldInnerPath}
                    fill="none"
                    stroke="rgba(254, 243, 199, 0.24)"
                    strokeWidth={0.75}
                  />
                )}
                <g className="pointer-events-none">
                  <circle
                    cx={infieldDetails.mound[0]}
                    cy={infieldDetails.mound[1]}
                    r={4.2}
                    fill="rgba(180, 83, 9, 0.35)"
                    stroke="rgba(254, 243, 199, 0.34)"
                    strokeWidth={0.9}
                  />
                  {infieldDetails.bases.map((base) => (
                    <rect
                      key={base.label}
                      x={base.point[0] - 2.7}
                      y={base.point[1] - 2.7}
                      width={5.4}
                      height={5.4}
                      rx={0.8}
                      fill={`url(#${chartId}-base-glow)`}
                      stroke="rgba(255, 251, 235, 0.55)"
                      strokeWidth={0.7}
                      transform={`rotate(45 ${base.point[0]} ${base.point[1]})`}
                    />
                  ))}
                </g>
                {/* Foul lines */}
                {foulPath && (
                  <path
                    d={foulPath}
                    fill="none"
                    stroke="rgba(203, 213, 225, 0.45)"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                  />
                )}
                {/* Home plate */}
                {platePath && (
                  <path
                    d={platePath}
                    fill="rgba(251, 191, 36, 0.25)"
                    stroke="rgba(251, 191, 36, 0.7)"
                    strokeWidth={1}
                  />
                )}

                {/* Animated batted balls */}
                {activeFilters.zoneDisplay !== "only" && <g key={dotGroupKey}>
                  {/* Trail lines */}
                  {dots.map((d, i) => {
                    const delay = i * seqDelay;
                    const trailDur = d.flightDur + 0.3;
                    return (
                      <line
                        key={`t-${i}`}
                        x1={hpSvg[0]}
                        y1={hpSvg[1]}
                        x2={d.vx}
                        y2={d.vy}
                        stroke="white"
                        strokeWidth={d.event.exit_velocity != null && d.event.exit_velocity >= 100 ? 2 : 1.25}
                        strokeLinecap="round"
                        style={{
                          "--tl": `${d.trailLen}px`,
                          strokeDasharray: `${d.trailLen}px`,
                          strokeDashoffset: `${d.trailLen}px`,
                          opacity: 0,
                          animation: `trail-draw ${trailDur.toFixed(2)}s ease-out ${delay.toFixed(3)}s both`,
                        } as React.CSSProperties}
                      />
                    );
                  })}

                  {/* Dots */}
                  {dots.map((d, i) => {
                    const delay = i * seqDelay;
                    const fromX = hpSvg[0] - d.vx;
                    const fromY = hpSvg[1] - d.vy;
                    // Arc height from launch angle if available, else trajectory default
                    const la = d.event.launch_angle;
                    const arcHeight = d.isArc
                      ? la != null ? -(Math.min(60, Math.max(10, la)) * 0.7) : (d.traj === "popup" ? -40 : -25)
                      : 0;
                    const isHovered = hoveredIdx === i;
                    const isSelected = selectedEventKey === d.eventKey;
                    const isDimmed = hasSelectedDot && !isSelected && !isHovered;
                    const markerOpacity = isDimmed ? 0.28 : 1;

                    const dotStyle: React.CSSProperties = {
                      "--fx": `${fromX}px`,
                      "--fy": `${fromY}px`,
                      ...(d.isArc && {
                        "--mx": `${fromX * 0.35}px`,
                        "--my": `${fromY * 0.35 + arcHeight}px`,
                      }),
                      opacity: d.finalOpacity,
                      animation: `${d.isArc ? "spray-arc" : "spray-straight"} ${d.flightDur}s ${d.isArc ? "ease-in-out" : "ease-out"} ${delay.toFixed(3)}s both`,
                      cursor: "pointer",
                    } as React.CSSProperties;

                    return (
                      <g
                        key={`d-${i}`}
                        style={dotStyle}
                        onPointerEnter={() => handleDotEnter(i)}
                        onPointerLeave={handleDotLeave}
                        onClick={(event) => handleDotClick(i, event)}
                      >
                        {isSelected && (
                          <>
                            <circle
                              cx={d.vx}
                              cy={d.vy}
                              r={d.radius + 11}
                              fill="rgba(14, 165, 233, 0.18)"
                              stroke="rgba(125, 211, 252, 0.45)"
                              strokeWidth={1.5}
                              style={{ animation: "glow-pulse 1.5s ease-in-out infinite" }}
                            />
                            <circle
                              cx={d.vx}
                              cy={d.vy}
                              r={d.radius + 6}
                              fill="none"
                              stroke="#38BDF8"
                              strokeWidth={2.25}
                              strokeDasharray="3 2"
                            />
                          </>
                        )}
                        {(isHovered || isSelected) && (
                          <circle
                            cx={d.vx}
                            cy={d.vy}
                            r={d.radius + 8}
                            fill={`url(#${chartId}-hover-glow)`}
                            style={{ animation: "glow-pulse 1.5s ease-in-out infinite" }}
                          />
                        )}
                        {d.event.is_barrel && (
                          <circle cx={d.vx} cy={d.vy} r={d.radius + 2} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.25} opacity={markerOpacity} />
                        )}
                        {d.hr && (
                          <circle cx={d.vx} cy={d.vy} r={d.radius + 1} fill="none" stroke="#CA8A04" strokeWidth={1.25} opacity={markerOpacity} />
                        )}
                        {(isHovered || isSelected) && (
                          <circle cx={d.vx} cy={d.vy} r={d.radius + 3} fill="none" stroke="white" strokeWidth={1.5} opacity={0.9} />
                        )}
                        <circle
                          cx={d.vx}
                          cy={d.vy}
                          r={isHovered || isSelected ? d.radius + 1.5 : d.radius}
                          fill={d.color}
                          opacity={markerOpacity}
                        />
                        <circle cx={d.vx} cy={d.vy} r={Math.max(d.radius + 4, 8)} fill="transparent" />
                      </g>
                    );
                  })}
                </g>}

                {/* Hover connector line */}
                {hovered && (
                  <line
                    x1={hpSvg[0]} y1={hpSvg[1]}
                    x2={hovered.vx} y2={hovered.vy}
                    stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 3"
                    className="pointer-events-none"
                  />
                )}
                </svg>

                {shouldShowWindMarker && (
                  <div className="pointer-events-none absolute bottom-2 left-1 flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-white/85 px-2 py-1.5 text-[10px] font-black shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/70 dark:shadow-black/25">
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-md border border-current/25 bg-current/10", getWindTextToneClass(weather?.wind_impact))}>
                      <Navigation2
                        className="h-3.5 w-3.5 text-current"
                        style={{
                          transform: windRelativeDeg !== null ? `rotate(${windRelativeDeg}deg)` : undefined,
                        }}
                      />
                    </span>
                    <span className="leading-tight">
                      <span className={cn("block tabular-nums", getWindTextToneClass(weather?.wind_impact))}>
                        {windSpeed} mph
                      </span>
                      {weather?.wind_label && (
                        <span className="block max-w-[112px] truncate text-[9px] font-bold text-neutral-500 dark:text-slate-400">
                          {weather.wind_label}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* HTML Tooltip */}
                {hovered && (
                  <div
                    className="absolute pointer-events-none z-10"
                    style={{
                      left: `${(hovered.vx / VB) * 100}%`,
                      top: `${(hovered.vy / VB) * 100}%`,
                      transform:
                        hovered.vy / VB < 0.25
                          ? "translate(-50%, 16px)"
                          : "translate(-50%, calc(-100% - 16px))",
                    }}
                  >
                    <div className="rounded-xl bg-neutral-950/95 backdrop-blur-md border border-neutral-700/70 px-3.5 py-2.5 shadow-2xl shadow-black/40 min-w-[170px]">
                      {/* Result + Date */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-black" style={{ color: hovered.color }}>
                          {formatResult(hovered.event.result)}
                        </span>
                        {hovered.event.game_date && (
                          <span className="text-[10px] font-medium text-neutral-500">
                            {formatDate(hovered.event.game_date)}
                          </span>
                        )}
                      </div>

                    {/* EV · LA · Distance */}
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
                      {hovered.event.exit_velocity != null && (
                        <span className="tabular-nums">
                          {hovered.event.exit_velocity.toFixed(1)}
                          <span className="text-neutral-500 ml-0.5">mph</span>
                        </span>
                      )}
                      {hovered.event.launch_angle != null && (
                        <>
                          <span className="text-neutral-600">·</span>
                          <span className="tabular-nums">
                            {hovered.event.launch_angle}
                            <span className="text-neutral-500">°</span>
                          </span>
                        </>
                      )}
                      {hovered.event.hit_distance != null && (
                        <>
                          <span className="text-neutral-600">·</span>
                          <span className="tabular-nums">
                            {Math.round(hovered.event.hit_distance)}
                            <span className="text-neutral-500 ml-0.5">ft</span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Trajectory + badges */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-neutral-400">
                        {TRAJ_SHORT[hovered.traj] ?? hovered.traj}
                      </span>
                      {hovered.event.is_barrel && (
                        <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-px text-[9px] font-bold text-amber-400">
                          Barrel
                        </span>
                      )}
                      {hovered.event.is_hard_hit && !hovered.event.is_barrel && (
                        <span className="rounded-full bg-orange-500/15 border border-orange-500/25 px-1.5 py-px text-[9px] font-bold text-orange-400">
                          Hard Hit
                        </span>
                      )}
                    </div>

                    {(() => {
                      const contactLabel = playerType === "pitcher" ? "Batter" : "Pitcher";
                      const contactName = playerType === "pitcher" ? hovered.event.batter_name : hovered.event.pitcher_name;
                      const contactHand = playerType === "pitcher" ? hovered.event.batter_hand : hovered.event.pitcher_hand;
                      const hasContactInfo = Boolean(contactName || contactHand);
                      const hasPitchInfo = Boolean(hovered.event.pitch_type || hovered.event.pitch_speed != null);

                      if (!hasContactInfo && !hasPitchInfo) return null;

                      return (
                      <div className="mt-2 border-t border-white/10 pt-2">
                        {hasContactInfo && (
                          <div className="flex items-center justify-between gap-3 text-[10px]">
                            <span className="font-semibold uppercase tracking-wide text-neutral-500">{contactLabel}</span>
                            <span className="max-w-[112px] truncate text-right font-bold text-neutral-200">
                              {contactName ?? "Unknown"}
                              {contactHand && <span className="ml-1 text-neutral-500">({contactHand})</span>}
                            </span>
                          </div>
                        )}
                        {hasPitchInfo && (
                          <div className="mt-1 flex items-center justify-between gap-3 text-[10px]">
                            <span className="font-semibold uppercase tracking-wide text-neutral-500">Pitch</span>
                            <span className="flex min-w-0 items-center gap-1.5 text-right font-bold text-neutral-200">
                              {hovered.event.pitch_type && (
                                <span className="rounded bg-slate-700/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-100">
                                  {hovered.event.pitch_type}
                                </span>
                              )}
                              <span className="truncate">
                                {hovered.event.pitch_type ? MLB_PITCH_TYPE_LABELS[hovered.event.pitch_type] ?? hovered.event.pitch_type : "Unknown"}
                                {hovered.event.pitch_speed != null && (
                                  <span className="ml-1 text-neutral-500">{hovered.event.pitch_speed.toFixed(1)} mph</span>
                                )}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {hasNoPlottedResults && (
                <div className="absolute inset-6 z-10 flex items-center justify-center rounded-2xl border border-dashed border-neutral-300/70 bg-white/80 text-center shadow-sm backdrop-blur-md dark:border-neutral-700/70 dark:bg-neutral-950/70">
                  <div className="max-w-xs px-5 py-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
                      No Results
                    </p>
                    <p className="mt-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                      No batted balls match these filters.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                      The field and controls stay visible so you can loosen the filters without losing context.
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset filters
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Legend + BIP count */}
            <div className="flex items-center justify-center gap-4 mt-3 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
              <span className="tabular-nums font-bold">{filteredEvents.length} BIP</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
                Hit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-[#EAB308] ring-1 ring-[#CA8A04]" />
                HR
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                Out
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-white/90 bg-transparent dark:border-neutral-300/70" />
                Barrel
              </span>
            </div>
          </div>
        </div>

        {/* Zone Breakdown Bar (color-coded by share of the current filtered sample) */}
        {!hideZoneBreakdown && zoneSummaries.length > 0 && totalZoneCount > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 mb-2">
              Zone Breakdown
            </p>
            <div className="flex rounded-xl overflow-hidden border border-neutral-200/70 dark:border-neutral-700/60 h-8">
              {[...zoneSummaries].reverse().map((zone) => {
                const widthPct = (zone.count / totalZoneCount) * 100;
                if (widthPct < 1) return null;
                const heat = getZoneHeatStyle(widthPct / 100, maxZonePct);

                return (
                  <div
                    key={zone.zone}
                    className="flex flex-col items-center justify-center text-[9px] font-bold border-r border-neutral-200/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:border-[#050a0f]/80 last:border-r-0"
                    style={{ width: `${widthPct}%`, backgroundColor: heat.bar }}
                    title={`${ZONE_LABELS[zone.zone] ?? zone.zone}: ${zone.count} BIP (${Math.round(widthPct)}%)`}
                  >
                    <span className="text-neutral-800 dark:text-neutral-100 leading-none">
                      {ZONE_LABELS[zone.zone] ?? zone.zone}
                    </span>
                    <span className="text-neutral-600 dark:text-neutral-300 leading-none">
                      {Math.round(widthPct)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Trajectory Summary */}
        {showExtendedSummaries && trajSummary.length > 0 && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              Trajectory
            </span>
            {trajSummary.map((t) => {
              const label =
                t.trajectory === "ground_ball" ? "GB"
                  : t.trajectory === "line_drive" ? "LD"
                  : t.trajectory === "fly_ball" ? "FB"
                  : t.trajectory === "popup" ? "PU"
                  : t.trajectory;
              const tooltipText = TRAJ_TOOLTIPS[t.trajectory] ?? t.trajectory;
              return (
                <Tooltip key={t.trajectory} content={tooltipText} side="top">
                  <span
                    className="inline-flex items-center gap-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50 px-2 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 cursor-default"
                  >
                    {label}
                    <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {t.pct.toFixed(0)}%
                    </span>
                  </span>
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Hard Contact Summary */}
        {showExtendedSummaries && hardContact && hardContact.count > 0 && (
          <div className="mt-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 bg-neutral-50/70 dark:bg-neutral-900/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 mb-1">
              Hard Contact ({minExitVelo ?? 95}+ mph)
            </p>
            <div className="flex items-center gap-3 flex-wrap text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <span className="tabular-nums">{hardContact.count} Hard Hit</span>
              {hardContact.avg != null && (
                <span className="tabular-nums">
                  {(hardContact.avg > 1 ? hardContact.avg / 1000 : hardContact.avg).toFixed(3).replace(/^0/, "")} AVG
                </span>
              )}
              <span className="tabular-nums">{hardContact.hr} HR</span>
              <span className="tabular-nums">{hardContact.barrels} Barrels</span>
              {hardContact.avg_ev != null && (
                <span className="tabular-nums">{hardContact.avg_ev.toFixed(1)} EV</span>
              )}
              {hardContact.avg_distance != null && (
                <span className="tabular-nums">{Math.round(hardContact.avg_distance)} ft</span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Reusable filter dropdown (matches site-wide Radix DropdownMenu pattern) ── */

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-lg shrink-0",
            "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/70 dark:hover:bg-neutral-700",
            "border border-neutral-200/60 dark:border-neutral-700/60",
            "font-medium text-neutral-700 dark:text-neutral-300",
            "transition-colors",
            "px-2 py-1.5 text-[11px]"
          )}
        >
          <span className="truncate max-w-[100px]">{selected?.label ?? value}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[140px]">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer",
              opt.value === value && "bg-neutral-100 dark:bg-neutral-800/50"
            )}
          >
            <span>{opt.label}</span>
            {opt.value === value && <Check className="h-3.5 w-3.5 text-neutral-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
