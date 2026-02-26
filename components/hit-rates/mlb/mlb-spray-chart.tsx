"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, RotateCcw, Zap } from "lucide-react";
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

type TrajectoryFilter = "all" | "ground_ball" | "line_drive" | "fly_ball" | "popup";
type HitFilter = "all" | "hits" | "single" | "double" | "triple" | "home_run";
type ZoneDisplay = "off" | "show" | "only";

interface MlbSprayChartProps {
  playerId: number | null;
  gameId: number | null;
  battingHand?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────


const SEASON_OPTIONS = [
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "all", label: "All Seasons" },
];

const ZONE_ORDER_RHB = ["pull", "pull_center", "center", "oppo_center", "oppo"];
const ZONE_ORDER_LHB = ["oppo", "oppo_center", "center", "pull_center", "pull"];
const ZONE_LABELS: Record<string, string> = {
  pull: "Pull",
  pull_center: "Pull-C",
  center: "Center",
  oppo_center: "Oppo-C",
  oppo: "Oppo",
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

const HIT_FILTER_OPTIONS: Array<{ value: HitFilter; label: string }> = [
  { value: "all", label: "All BIP" },
  { value: "hits", label: "All Hits" },
  { value: "single", label: "Singles" },
  { value: "double", label: "Doubles" },
  { value: "triple", label: "Triples" },
  { value: "home_run", label: "Home Runs" },
];

const ZONE_DISPLAY_OPTIONS: Array<{ value: ZoneDisplay; label: string }> = [
  { value: "off", label: "Zones Off" },
  { value: "show", label: "Zones On" },
  { value: "only", label: "Zones Only" },
];

const TRAJECTORY_OPTIONS: Array<{ value: TrajectoryFilter; label: string }> = [
  { value: "all", label: "All Traj" },
  { value: "ground_ball", label: "Ground Balls" },
  { value: "line_drive", label: "Line Drives" },
  { value: "fly_ball", label: "Fly Balls" },
  { value: "popup", label: "Pop Ups" },
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

type EvThreshold = "off" | "90" | "95" | "100" | "105";

const EV_THRESHOLD_OPTIONS: Array<{ value: EvThreshold; label: string; mph: number | null }> = [
  { value: "off", label: "All EV", mph: null },
  { value: "90", label: "90+ mph", mph: 90 },
  { value: "95", label: "95+ mph", mph: 95 },
  { value: "100", label: "100+ mph", mph: 100 },
  { value: "105", label: "105+ mph", mph: 105 },
];

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

export function MlbSprayChart({ playerId, gameId, battingHand }: MlbSprayChartProps) {
  const [seasonFilter, setSeasonFilter] = useState("2025");
  const [trajectoryFilter, setTrajectoryFilter] = useState<TrajectoryFilter>("all");
  const [evThreshold, setEvThreshold] = useState<EvThreshold>("off");
  const [animKey, setAnimKey] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [zoneDisplay, setZoneDisplay] = useState<ZoneDisplay>("show");
  const [hitFilter, setHitFilter] = useState<HitFilter>("all");

  const seasons = useMemo(() => {
    if (seasonFilter === "all") return undefined;
    return [Number(seasonFilter)];
  }, [seasonFilter]);

  const minExitVelo = EV_THRESHOLD_OPTIONS.find((o) => o.value === evThreshold)?.mph ?? undefined;

  const { data, isLoading, isError } = useMlbSprayChart({
    playerId,
    gameId,
    seasons,
    minExitVelo,
    enabled: typeof playerId === "number",
  });

  // ── Client-side filters + chronological sort ──
  const eventsArr = Array.isArray(data?.events) ? data.events : [];
  const filteredEvents = useMemo(() => {
    if (eventsArr.length === 0) return [];
    let events = eventsArr;
    if (trajectoryFilter !== "all") {
      events = events.filter((e) => normalizeTraj(e.trajectory) === trajectoryFilter);
    }
    if (hitFilter !== "all") {
      events = events.filter((e) => {
        const r = (e.result ?? "").toLowerCase();
        if (hitFilter === "hits") return HIT_RESULTS.has(r);
        if (hitFilter === "single") return SINGLE_RESULTS.has(r);
        if (hitFilter === "double") return DOUBLE_RESULTS.has(r);
        if (hitFilter === "triple") return TRIPLE_RESULTS.has(r);
        if (hitFilter === "home_run") return HR_RESULTS.has(r);
        return true;
      });
    }
    return [...events].sort((a, b) => {
      const da = a.game_date ?? "";
      const db = b.game_date ?? "";
      return da.localeCompare(db);
    });
  }, [eventsArr, trajectoryFilter, hitFilter]);

  // ── Stadium geometry (normalized to 500x500 viewbox) ──
  const outfieldRaw = useMemo(() => toPoints(data?.stadium_geometry?.outfieldOuter ?? []), [data?.stadium_geometry]);
  const infieldRaw = useMemo(() => toPoints(data?.stadium_geometry?.infieldOuter ?? []), [data?.stadium_geometry]);
  const foulRaw = useMemo(() => toPoints(data?.stadium_geometry?.foulLines ?? []), [data?.stadium_geometry]);
  const plateRaw = useMemo(() => toPoints(data?.stadium_geometry?.homePlate ?? []), [data?.stadium_geometry]);

  const outfieldPoints = outfieldRaw.length >= 12 ? outfieldRaw : FALLBACK_OUTFIELD;

  const [normalizedOutfield, normalizedInfield, normalizedFoul, normalizedPlate] = useMemo(() => {
    const groups = normalizeToViewbox([outfieldPoints, infieldRaw, foulRaw, plateRaw]);
    return [groups[0] || [], groups[1] || [], groups[2] || [], groups[3] || []];
  }, [outfieldPoints, infieldRaw, foulRaw, plateRaw]);

  const outfieldPath = pathFromPoints(normalizedOutfield);
  const infieldPath = normalizedInfield.length >= 3 ? pathFromPoints(normalizedInfield) : "";
  const foulPath = normalizedFoul.length >= 2 ? pathFromPoints(normalizedFoul, false) : "";
  const platePath = normalizedPlate.length >= 3 ? pathFromPoints(normalizedPlate) : "";

  // ── MLBAM dot mapper ──
  const mapCoord = useMemo(
    () => buildCoordMapper(normalizedPlate, normalizedOutfield),
    [normalizedPlate, normalizedOutfield]
  );

  const hpSvg = useMemo<Point>(() => mapCoord(MLBAM_HP_X, MLBAM_HP_Y), [mapCoord]);
  const currentYear = useMemo(() => getCurrentSeasonYear(), []);

  // ── Precomputed dot data (sorted chronologically) ──
  const dots = useMemo<DotDatum[]>(() => {
    return filteredEvents
      .filter((e) => e.coord_x !== null && e.coord_y !== null)
      .map((event) => {
        const [vx, vy] = mapCoord(event.coord_x!, event.coord_y!);
        const traj = normalizeTraj(event.trajectory);
        const flightDur = getFlightDuration(traj, event.exit_velocity);
        const isArc = traj === "fly_ball" || traj === "popup";
        const trailLen = Math.sqrt((vx - hpSvg[0]) ** 2 + (vy - hpSvg[1]) ** 2);

        return {
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
  const zoneOrder = battingHand === "L" ? ZONE_ORDER_LHB : ZONE_ORDER_RHB;
  const zoneSummaryArr = Array.isArray(data?.zone_summary) ? data.zone_summary : [];
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
  const dotGroupKey = `${animKey}-${trajectoryFilter}-${seasonFilter}-${evThreshold}-${hitFilter}`;

  // ── Hover handlers ──
  const handleDotEnter = useCallback((idx: number) => setHoveredIdx(idx), []);
  const handleDotLeave = useCallback(() => setHoveredIdx(null), []);
  const handleDotClick = useCallback(
    (idx: number) => setHoveredIdx((prev) => (prev === idx ? null : idx)),
    []
  );

  const hovered = hoveredIdx !== null ? dots[hoveredIdx] ?? null : null;

  // ── Loading ──
  if (isLoading) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/95 dark:border-neutral-700/60 dark:bg-neutral-900/65 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-500/25 via-emerald-400/10 to-transparent dark:from-emerald-400/25 dark:via-emerald-300/10 opacity-90" />
        <header className="relative px-5 py-4 border-b border-neutral-200/70 dark:border-neutral-700/60 bg-gradient-to-r from-white/80 via-white/65 to-white/45 dark:from-neutral-900/75 dark:via-neutral-900/65 dark:to-neutral-900/35 backdrop-blur-sm">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Batted Ball
          </p>
          <h3 className="text-sm font-black tracking-wide text-neutral-900 dark:text-white">Spray Chart</h3>
        </header>
        <div className="relative p-5">
          <div className="h-[400px] animate-pulse rounded-2xl bg-neutral-100/80 dark:bg-neutral-800/50" />
        </div>
      </section>
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-red-200/60 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/20 p-6">
        <p className="text-center text-sm font-semibold text-red-600 dark:text-red-300">
          Unable to load spray chart data. Please try again later.
        </p>
      </section>
    );
  }

  // ── Empty ──
  if (!data || dots.length === 0) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/95 dark:border-neutral-700/60 dark:bg-neutral-900/65 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-500/25 via-emerald-400/10 to-transparent dark:from-emerald-400/25 dark:via-emerald-300/10 opacity-90" />
        <header className="relative px-5 py-4 border-b border-neutral-200/70 dark:border-neutral-700/60 bg-gradient-to-r from-white/80 via-white/65 to-white/45 dark:from-neutral-900/75 dark:via-neutral-900/65 dark:to-neutral-900/35 backdrop-blur-sm">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Batted Ball
          </p>
          <h3 className="text-sm font-black tracking-wide text-neutral-900 dark:text-white">Spray Chart</h3>
        </header>
        <div className="relative p-5">
          <div className="rounded-2xl border border-dashed border-neutral-300/70 dark:border-neutral-700/60 bg-neutral-50/70 dark:bg-neutral-900/40 py-12">
            <p className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
              No batted ball data available
              {trajectoryFilter !== "all" && " for this trajectory filter"}
              {hitFilter !== "all" && ` (${HIT_FILTER_OPTIONS.find(o => o.value === hitFilter)?.label ?? hitFilter})`}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Zone overlay color (based on deviation from even split) ──
  const maxZonePct = Math.max(...zoneOverlays.map((z) => z.pct), 0.01);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/95 dark:border-neutral-700/60 dark:bg-neutral-900/65 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
      {/* Accent gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-500/25 via-emerald-400/10 to-transparent dark:from-emerald-400/25 dark:via-emerald-300/10 opacity-90" />
      <div className="pointer-events-none absolute right-[-20%] top-[-35%] h-40 w-40 rounded-full bg-white/60 blur-3xl dark:bg-white/10" />

      {/* Header */}
      <header className="relative px-5 py-4 border-b border-neutral-200/70 dark:border-neutral-700/60 bg-gradient-to-r from-white/80 via-white/65 to-white/45 dark:from-neutral-900/75 dark:via-neutral-900/65 dark:to-neutral-900/35 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              Batted Ball
            </p>
            <h3 className="text-sm font-black tracking-wide text-neutral-900 dark:text-white">Spray Chart</h3>
          </div>

          {/* Top-right controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => { setAnimKey((k) => k + 1); setHoveredIdx(null); }}
              className="flex items-center rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 px-2 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors"
              title="Replay animation"
            >
              <RotateCcw className="h-3 w-3" />
            </button>

            <FilterSelect
              value={trajectoryFilter}
              onChange={(v) => setTrajectoryFilter(v as TrajectoryFilter)}
              options={TRAJECTORY_OPTIONS}
            />

            <FilterSelect
              value={hitFilter}
              onChange={(v) => setHitFilter(v as HitFilter)}
              options={HIT_FILTER_OPTIONS}
            />

            <FilterSelect
              value={zoneDisplay}
              onChange={(v) => setZoneDisplay(v as ZoneDisplay)}
              options={ZONE_DISPLAY_OPTIONS}
            />

            <FilterSelect
              value={seasonFilter}
              onChange={setSeasonFilter}
              options={SEASON_OPTIONS}
            />

            <Tooltip content="Filter by minimum exit velocity. Hard hit = 95+ mph." side="bottom">
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors shrink-0",
                        evThreshold !== "off"
                          ? "border-amber-400/60 bg-amber-50 text-amber-700 dark:border-amber-600/50 dark:bg-amber-900/30 dark:text-amber-300"
                          : "border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-700"
                      )}
                    >
                      <Zap className={cn("h-3.5 w-3.5", evThreshold !== "off" && "fill-current")} />
                      {evThreshold === "off" ? "EV" : `${EV_THRESHOLD_OPTIONS.find((o) => o.value === evThreshold)?.mph}+`}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={6} className="min-w-[120px]">
                    {EV_THRESHOLD_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setEvThreshold(opt.value)}
                        className={cn(
                          "flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer",
                          opt.value === evThreshold && "bg-neutral-100 dark:bg-neutral-800/50"
                        )}
                      >
                        <span>{opt.label}</span>
                        {opt.value === evThreshold && <Check className="h-3.5 w-3.5 text-neutral-500" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Tooltip>
          </div>
        </div>
      </header>

      <div className="relative p-5">
        <div>
          {/* SVG stadium + tooltip wrapper */}
          <div className="px-3">
            <div className="relative max-w-[500px] mx-auto">
              <svg
                viewBox={`0 0 ${VB} ${VB}`}
                className="w-full overflow-visible"
                overflow="visible"
                role="img"
                aria-label={`Spray chart with ${dots.length} batted balls`}
              >
                <defs>
                  <style>{SPRAY_KEYFRAMES}</style>
                  <clipPath id="sc-field-clip">
                    <path d={outfieldPath} />
                  </clipPath>
                  <radialGradient id="hover-glow">
                    <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Grass / outfield */}
                <path
                  d={outfieldPath}
                  fill="rgba(15, 23, 42, 0.14)"
                  stroke="rgba(148, 163, 184, 0.25)"
                  strokeWidth={1.25}
                  className="dark:fill-neutral-800/30"
                />

                {/* Zone overlays (clipped to field) */}
                {zoneDisplay !== "off" && (
                  <g clipPath="url(#sc-field-clip)">
                    {zoneOverlays.map((zone) => {
                      const intensity = zone.pct > 0 ? zone.pct / maxZonePct : 0;
                      const fill = `rgba(20, 184, 166, ${0.04 + intensity * 0.18})`;

                      return (
                        <path
                          key={zone.name}
                          d={zone.path}
                          fill={fill}
                          stroke="rgba(148, 163, 184, 0.15)"
                          strokeWidth={0.5}
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
                {zoneDisplay !== "off" &&
                  zoneOverlays.map((zone) => (
                    <g key={`zl-${zone.name}`} className="pointer-events-none">
                      <text
                        x={zone.labelX}
                        y={zone.labelY - 5}
                        textAnchor="middle"
                        fill="rgba(255, 255, 255, 0.7)"
                        fontSize={10}
                        fontWeight={700}
                        letterSpacing="0.05em"
                      >
                        {zone.label}
                      </text>
                      <text
                        x={zone.labelX}
                        y={zone.labelY + 7}
                        textAnchor="middle"
                        fill="rgba(255, 255, 255, 0.45)"
                        fontSize={9}
                        fontWeight={600}
                      >
                        {zone.count > 0 ? `${Math.round(zone.pct * 100)}%` : ""}
                      </text>
                    </g>
                  ))}

                {/* Infield */}
                {infieldPath && (
                  <path
                    d={infieldPath}
                    fill="rgba(15, 118, 110, 0.2)"
                    stroke="rgba(94, 234, 212, 0.35)"
                    strokeWidth={1}
                  />
                )}
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
                {zoneDisplay !== "only" && <g key={dotGroupKey}>
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
                        onClick={() => handleDotClick(i)}
                      >
                        {isHovered && (
                          <circle
                            cx={d.vx}
                            cy={d.vy}
                            r={d.radius + 8}
                            fill="url(#hover-glow)"
                            style={{ animation: "glow-pulse 1.5s ease-in-out infinite" }}
                          />
                        )}
                        {d.event.is_barrel && (
                          <circle cx={d.vx} cy={d.vy} r={d.radius + 2} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.25} />
                        )}
                        {d.hr && (
                          <circle cx={d.vx} cy={d.vy} r={d.radius + 1} fill="none" stroke="#CA8A04" strokeWidth={1.25} />
                        )}
                        {isHovered && (
                          <circle cx={d.vx} cy={d.vy} r={d.radius + 3} fill="none" stroke="white" strokeWidth={1.5} opacity={0.9} />
                        )}
                        <circle cx={d.vx} cy={d.vy} r={isHovered ? d.radius + 1 : d.radius} fill={d.color} />
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
                  </div>
                </div>
              )}
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

        {/* Zone Breakdown Bar (color-coded by deviation from 20% even split) */}
        {zoneSummaries.length > 0 && totalZoneCount > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 mb-2">
              Zone Breakdown
            </p>
            <div className="flex rounded-xl overflow-hidden border border-neutral-200/70 dark:border-neutral-700/60 h-8">
              {zoneSummaries.map((zone) => {
                const widthPct = (zone.count / totalZoneCount) * 100;
                if (widthPct < 1) return null;
                const deviation = widthPct / 100 - 0.2;
                let bgColor: string;
                if (deviation >= 0) {
                  const t = Math.min(1, deviation / 0.15);
                  bgColor = `rgba(20, 184, 166, ${0.12 + t * 0.38})`;
                } else {
                  const t = Math.min(1, Math.abs(deviation) / 0.12);
                  bgColor = `rgba(148, 163, 184, ${0.08 + t * 0.15})`;
                }

                return (
                  <div
                    key={zone.zone}
                    className="flex flex-col items-center justify-center text-[9px] font-bold border-r border-neutral-200/50 dark:border-neutral-700/40 last:border-r-0"
                    style={{ width: `${widthPct}%`, backgroundColor: bgColor }}
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
        {trajSummary.length > 0 && (
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
        {hardContact && hardContact.count > 0 && (
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
