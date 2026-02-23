"use client";

import { useMemo, type CSSProperties } from "react";
import { AlertTriangle, CloudRain, Thermometer, Wind } from "lucide-react";
import { MlbWeatherReportRow } from "@/hooks/use-mlb-weather-report";
import { cn } from "@/lib/utils";

type Point = [number, number];

const VIEWBOX_WIDTH = 420;
const VIEWBOX_HEIGHT = 200;
const VIEWBOX_PADDING = 10;

function toPoint(value: unknown): Point | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
}

function toPoints(values: unknown): Point[] {
  if (!Array.isArray(values)) return [];
  return values.map(toPoint).filter((point): point is Point => !!point);
}

function pathFromPoints(points: Point[], close = true): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const segments = [`M ${first[0]} ${first[1]}`];
  for (const point of rest) {
    segments.push(`L ${point[0]} ${point[1]}`);
  }
  if (close) segments.push("Z");
  return segments.join(" ");
}

function safeRound(value: number) {
  return Math.max(0, Math.round(value));
}

function normalizeToViewbox(groups: Point[][]): Point[][] {
  const allPoints = groups.flat();
  if (allPoints.length === 0) return groups;

  const xs = allPoints.map((point) => point[0]);
  const ys = allPoints.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const scale = Math.min(
    (VIEWBOX_WIDTH - VIEWBOX_PADDING * 2) / sourceWidth,
    (VIEWBOX_HEIGHT - VIEWBOX_PADDING * 2) / sourceHeight
  );

  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  // Center the scaled content within the viewbox
  const offsetX = (VIEWBOX_WIDTH - renderedWidth) / 2;
  const offsetY = (VIEWBOX_HEIGHT - renderedHeight) / 2;

  return groups.map((group) =>
    group.map(([x, y]) => [
      offsetX + (x - minX) * scale,
      VIEWBOX_HEIGHT - offsetY - (y - minY) * scale,
    ])
  );
}

function getETTime(dateTime: string | null): string {
  if (!dateTime) return "-";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatImpactLabel(value: string | null): string {
  if (!value) return "Neutral";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function polarVector(degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return "text-neutral-600 dark:text-neutral-400";
  if (score >= 2) return "text-emerald-600 dark:text-emerald-300";
  if (score <= -2) return "text-red-600 dark:text-red-300";
  return "text-amber-600 dark:text-amber-300";
}

function wallHeightColor(height: number | null, min: number, max: number, alpha = 0.9): string {
  if (height === null || !Number.isFinite(height)) return `rgba(148, 163, 184, ${alpha})`;
  const range = max - min;
  if (range < 1) return `rgba(148, 163, 184, ${alpha})`;
  const t = Math.max(0, Math.min(1, (height - min) / range));
  if (t < 0.5) {
    const s = t * 2;
    // emerald → amber
    return `rgba(${Math.round(16 + 235 * s)}, ${Math.round(185 + 6 * s)}, ${Math.round(129 - 93 * s)}, ${alpha})`;
  }
  const s = (t - 0.5) * 2;
  // amber → red
  return `rgba(${Math.round(251 - 12 * s)}, ${Math.round(191 - 123 * s)}, ${Math.round(36 + 32 * s)}, ${alpha})`;
}

function factorValueColor(val: number | null): string {
  if (val === null) return "text-neutral-500";
  if (val >= 108) return "text-emerald-400";
  if (val >= 103) return "text-emerald-500/80";
  if (val <= 92) return "text-red-400";
  if (val <= 97) return "text-red-400/70";
  return "text-neutral-400 dark:text-neutral-500";
}

function impactAccentClass(totalImpact: string | null): string {
  if (totalImpact?.includes("strong_over")) return "bg-gradient-to-r from-transparent via-emerald-400 to-transparent";
  if (totalImpact?.includes("lean_over")) return "bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent";
  if (totalImpact?.includes("strong_under")) return "bg-gradient-to-r from-transparent via-red-400 to-transparent";
  if (totalImpact?.includes("lean_under")) return "bg-gradient-to-r from-transparent via-red-500/60 to-transparent";
  return "bg-neutral-200/40 dark:bg-neutral-700/25";
}

function impactPillClass(totalImpact: string | null): string {
  if (!totalImpact) return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  if (totalImpact.includes("strong_over") || totalImpact.includes("lean_over")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-700/40";
  }
  if (totalImpact.includes("strong_under") || totalImpact.includes("lean_under")) {
    return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300/40 dark:border-red-700/40";
  }
  return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
}

function formatSigned(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(digits)}`;
}

function scorePanelClass(score: number | null): string {
  if (score === null || score === undefined) {
    return "border-neutral-300/70 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900";
  }
  if (score >= 2) {
    return "border-emerald-300/60 bg-emerald-50 dark:border-emerald-700/40 dark:bg-emerald-950/35";
  }
  if (score <= -2) {
    return "border-red-300/60 bg-red-50 dark:border-red-700/40 dark:bg-red-950/35";
  }
  return "border-amber-300/60 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/35";
}

function keyDrivers(row: MlbWeatherReportRow): string[] {
  const drivers: string[] = [];
  const trimmedWind = row.windLabel?.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (trimmedWind) drivers.push(trimmedWind);

  if (row.temperatureF != null) {
    const roundedTemp = Math.round(row.temperatureF);
    if (roundedTemp >= 85) drivers.push(`Warm air (${roundedTemp}\u00b0F) can increase carry`);
    if (roundedTemp <= 55) drivers.push(`Cool air (${roundedTemp}\u00b0F) can suppress carry`);
  }

  const hrFactor = row.ballparkFactors?.hr?.overall;
  if (hrFactor != null) {
    const delta = Math.round(hrFactor - 100);
    if (Math.abs(delta) >= 2) {
      drivers.push(`HR park factor ${Math.round(hrFactor)} (${delta > 0 ? "+" : ""}${delta}%)`);
    }
  }

  if ((row.roofType || "").toLowerCase().includes("retract")) {
    drivers.push("Retractable roof can change wind impact");
  }

  return drivers.slice(0, 3);
}

export function LivingStadiumCard({ row }: { row: MlbWeatherReportRow }) {
  const cardId = `living-stadium-${row.gameId}`;
  const outfieldRaw = toPoints(row.stadiumGeometry?.outfieldOuter ?? []);
  const infieldRaw = toPoints(row.stadiumGeometry?.infieldOuter ?? []);
  const foulRaw = toPoints(row.stadiumGeometry?.foulLines ?? []);
  const plateRaw = toPoints(row.stadiumGeometry?.homePlate ?? []);

  const fallbackOutfield: Point[] = [
    [0, 0],
    [55, 65],
    [125, 105],
    [210, 118],
    [295, 106],
    [365, 66],
    [420, 0],
    [210, -80],
  ];

  const outfieldPoints = outfieldRaw.length >= 12 ? outfieldRaw : fallbackOutfield;

  const [normalizedOutfield, normalizedInfield, normalizedFoul, normalizedPlate] = useMemo(() => {
    const groups = normalizeToViewbox([
      outfieldPoints,
      infieldRaw,
      foulRaw,
      plateRaw,
    ]);

    return [groups[0] || [], groups[1] || [], groups[2] || [], groups[3] || []];
  }, [outfieldPoints, infieldRaw, foulRaw, plateRaw]);

  const outfieldPath = pathFromPoints(normalizedOutfield);
  const infieldPath = normalizedInfield.length >= 3 ? pathFromPoints(normalizedInfield) : "";
  const foulPath = normalizedFoul.length >= 2 ? pathFromPoints(normalizedFoul, false) : "";
  const platePath = normalizedPlate.length >= 3 ? pathFromPoints(normalizedPlate) : "";

  const wallHeights = [
    row.wallHeights?.lf ?? null,
    row.wallHeights?.lcf ?? null,
    row.wallHeights?.cf ?? null,
    row.wallHeights?.rcf ?? null,
    row.wallHeights?.rf ?? null,
  ];
  const numericWallHeights = wallHeights.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const minWallHeight = numericWallHeights.length > 0 ? Math.min(...numericWallHeights) : 0;
  const maxWallHeight = numericWallHeights.length > 0 ? Math.max(...numericWallHeights) : 0;

  const windSpeed = Number(row.windSpeedMph ?? 0);
  const windVector = polarVector(Number(row.windRelativeDeg ?? 0));
  const homePoint =
    normalizedPlate.length > 0
      ? normalizedPlate.reduce(
          (acc, point) => ({ x: acc.x + point[0], y: acc.y + point[1] }),
          { x: 0, y: 0 }
        )
      : { x: VIEWBOX_WIDTH / 2, y: VIEWBOX_HEIGHT - 40 };
  const homeX = normalizedPlate.length > 0 ? homePoint.x / normalizedPlate.length : homePoint.x;
  const homeY = normalizedPlate.length > 0 ? homePoint.y / normalizedPlate.length : homePoint.y;

  const outfieldArcPoints = useMemo(() => {
    if (normalizedOutfield.length < 8) return normalizedOutfield;

    const enriched = normalizedOutfield.map((point) => {
      const dx = point[0] - homeX;
      const dy = point[1] - homeY;
      return {
        point,
        distance: Math.hypot(dx, dy),
        angle: Math.atan2(dy, dx),
      };
    });

    const maxDistance = Math.max(...enriched.map((entry) => entry.distance));
    const floorDistance = maxDistance * 0.55;
    let activePoints = enriched.filter(
      (entry) => entry.point[1] <= homeY - 6 && entry.distance >= floorDistance
    );

    if (activePoints.length < 8) {
      activePoints = enriched.filter(
        (entry) => entry.point[1] <= homeY - 6 && entry.distance >= maxDistance * 0.45
      );
    }
    if (activePoints.length < 8) {
      activePoints = enriched.filter((entry) => entry.point[1] <= homeY - 6);
    }
    if (activePoints.length < 8) return normalizedOutfield;

    return activePoints
      .sort((a, b) => a.angle - b.angle)
      .map((entry) => entry.point);
  }, [normalizedOutfield, homeX, homeY]);

  const arcProfile = useMemo(() => {
    if (outfieldArcPoints.length < 8) {
      return {
        markers: [] as Array<{ section: string; point: Point; index: number }>,
        boundaries: [0, safeRound((outfieldArcPoints.length - 1) / 2), outfieldArcPoints.length - 1],
      };
    }

    const n = outfieldArcPoints.length;

    // CF: highest point (smallest y in SVG = furthest from home)
    let cfIdx = 0;
    for (let i = 1; i < n; i++) {
      if (outfieldArcPoints[i][1] < outfieldArcPoints[cfIdx][1]) cfIdx = i;
    }

    // LF: leftmost x in the left half of the arc (before CF index)
    let lfIdx = 0;
    for (let i = 1; i < cfIdx; i++) {
      if (outfieldArcPoints[i][0] < outfieldArcPoints[lfIdx][0]) lfIdx = i;
    }

    // RF: rightmost x in the right half of the arc (after CF index)
    let rfIdx = n - 1;
    for (let i = cfIdx + 1; i < n; i++) {
      if (outfieldArcPoints[i][0] > outfieldArcPoints[rfIdx][0]) rfIdx = i;
    }

    // LCF/RCF: true midpoints so spacing is equal on each side
    const lcfIdx = safeRound((lfIdx + cfIdx) / 2);
    const rcfIdx = safeRound((cfIdx + rfIdx) / 2);

    const markerIndices = [lfIdx, lcfIdx, cfIdx, rcfIdx, rfIdx];
    const markerSections = ["LF", "LCF", "CF", "RCF", "RF"];

    const boundaries = [
      lfIdx,
      safeRound((lfIdx + lcfIdx) / 2),
      safeRound((lcfIdx + cfIdx) / 2),
      safeRound((cfIdx + rcfIdx) / 2),
      safeRound((rcfIdx + rfIdx) / 2),
      rfIdx,
    ];

    return {
      markers: markerIndices.map((index, i) => ({
        section: markerSections[i],
        point: outfieldArcPoints[index],
        index,
      })),
      boundaries,
    };
  }, [outfieldArcPoints]);

  const hrImpact = Number(row.hrImpactScore ?? 0);
  const heatIntensity = clamp(Math.abs(hrImpact) / 8, 0.1, 0.58);
  const heatColor = hrImpact >= 0 ? `rgba(16, 185, 129, ${heatIntensity})` : `rgba(239, 68, 68, ${heatIntensity})`;
  const heatStartX = homeX - windVector.x * 130;
  const heatStartY = homeY - windVector.y * 130;
  const heatEndX = homeX + windVector.x * 130;
  const heatEndY = homeY + windVector.y * 130;
  const windFlowDuration = `${clamp(8.8 - windSpeed * 0.27, 2.2, 8.6)}s`;
  const windFlowRotationDeg = Number(row.windRelativeDeg ?? 0) - 90;
  const windShiftPx = 28 + clamp(windSpeed, 0, 24) * 2.2;
  const windOpacity = clamp(0.3 + windSpeed / 40, 0.35, 0.88);
  const windCompassCx = VIEWBOX_WIDTH - 40;
  const windCompassCy = 38;
  const windCompassR = 19;
  const wxIconCx = 40;
  const wxIconCy = 38;
  const wxCloudCover = row.cloudCoverPct ?? 50;
  const wxPrecip = row.precipProbability ?? 0;
  const wxIsRainy = wxPrecip > 25;
  const wxIsCloudy = wxCloudCover > 65 && !wxIsRainy;
  const wxIsPartly = wxCloudCover > 30 && !wxIsCloudy && !wxIsRainy;
  const wxLabel = wxIsRainy ? "Rain" : wxIsCloudy ? "Cloudy" : wxIsPartly ? "Partly" : "Clear";
  const windArrowLen = 12;
  const windTipX = windCompassCx + windVector.x * windArrowLen;
  const windTipY = windCompassCy + windVector.y * windArrowLen;
  const windTailX = windCompassCx - windVector.x * windArrowLen;
  const windTailY = windCompassCy - windVector.y * windArrowLen;
  const windPerpX = -windVector.y;
  const windPerpY = windVector.x;
  const windBaseX = windCompassCx + windVector.x * (windArrowLen - 5);
  const windBaseY = windCompassCy + windVector.y * (windArrowLen - 5);
  const windArrowHeadPath = `M${windTipX.toFixed(1)},${windTipY.toFixed(1)} L${(windBaseX + windPerpX * 4).toFixed(1)},${(windBaseY + windPerpY * 4).toFixed(1)} L${(windBaseX - windPerpX * 4).toFixed(1)},${(windBaseY - windPerpY * 4).toFixed(1)} Z`;
  const outfieldArcPath = pathFromPoints(outfieldArcPoints, false);
  const outfieldDistances = [
    row.fieldDistances?.leftLine ?? null,
    row.fieldDistances?.leftCenter ?? null,
    row.fieldDistances?.centerField ?? null,
    row.fieldDistances?.rightCenter ?? null,
    row.fieldDistances?.rightLine ?? null,
  ];

  const distanceMarkers = useMemo(() => {
    return arcProfile.markers
      .map((marker, index) => {
        const point = marker.point;

        const dx = point[0] - homeX;
        const dy = point[1] - homeY;
        const magnitude = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / magnitude;
        const uy = dy / magnitude;
        const labelOffset =
          marker.section === "LF" || marker.section === "RF"
            ? 6
            : marker.section === "CF"
              ? 14
              : 12;

        return {
          index,
          section: marker.section,
          distance: outfieldDistances[index],
          lineEndX: point[0] - ux * 6,
          lineEndY: point[1] - uy * 6,
          labelX: clamp(point[0] + ux * labelOffset, 18, VIEWBOX_WIDTH - 18),
          labelY: clamp(point[1] + uy * labelOffset, 14, VIEWBOX_HEIGHT - 24),
        };
      })
      .filter((marker): marker is NonNullable<typeof marker> => !!marker);
  }, [arcProfile, homeX, homeY, outfieldDistances]);

  const awayAbbr = row.awayTeamAbbr || row.awayTeamName || "Away";
  const homeAbbr = row.homeTeamAbbr || row.homeTeamName || "Home";
  const awayColor = row.awayTeamPrimaryColor ?? "#1e3a5f";
  const homeColor = row.homeTeamPrimaryColor ?? "#1e3a5f";
  const gameSubLabel =
    row.venueCity && row.venueState ? `${row.venueName || "Unknown Venue"} • ${row.venueCity}, ${row.venueState}` : row.venueName || "Unknown Venue";
  const gameTime = getETTime(row.gameDatetime);
  const insightDrivers = keyDrivers(row);

  return (
    <article className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className={cn("h-[2px] w-full", impactAccentClass(row.totalImpact))} />
      <div className="px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Away team */}
            <div className="flex items-center gap-2 min-w-0">
              {row.awayTeamAbbr && (
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${awayColor}22`, border: `1.5px solid ${awayColor}55` }}
                >
                  <img
                    src={`/team-logos/mlb/${row.awayTeamAbbr.toUpperCase()}.svg`}
                    alt={row.awayTeamAbbr}
                    className="h-5 w-5 object-contain"
                  />
                </div>
              )}
              <span className="font-bold text-sm md:text-base text-neutral-900 dark:text-white truncate">{awayAbbr}</span>
            </div>
            <span className="text-neutral-400 dark:text-neutral-500 text-xs font-medium">@</span>
            {/* Home team */}
            <div className="flex items-center gap-2 min-w-0">
              {row.homeTeamAbbr && (
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${homeColor}22`, border: `1.5px solid ${homeColor}55` }}
                >
                  <img
                    src={`/team-logos/mlb/${row.homeTeamAbbr.toUpperCase()}.svg`}
                    alt={row.homeTeamAbbr}
                    className="h-5 w-5 object-contain"
                  />
                </div>
              )}
              <span className="font-bold text-sm md:text-base text-neutral-900 dark:text-white truncate">{homeAbbr}</span>
            </div>
          </div>
          <p className="hidden sm:block text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-1">
            {gameSubLabel}
          </p>
          <p className="hidden sm:block text-[10px] uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-500">
            First Pitch {gameTime}
          </p>
        </div>
        {/* Mobile venue line */}
        <p className="sm:hidden w-full text-[11px] text-neutral-500 dark:text-neutral-400 -mt-1">
          {gameSubLabel} • First Pitch {gameTime}
        </p>
        <div className="flex items-stretch gap-2 flex-wrap">
          <div className={cn("rounded-lg border px-2.5 py-1.5 min-w-[126px]", impactPillClass(row.totalImpact))}>
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold opacity-70">Edge Signal</p>
            <p className="text-sm font-bold leading-tight">{formatImpactLabel(row.totalImpact)}</p>
          </div>
          <div className={cn("rounded-lg border px-2.5 py-1.5 min-w-[86px]", scorePanelClass(row.hrImpactScore))}>
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-neutral-500 dark:text-neutral-400">HR Delta</p>
            <p className={cn("text-base font-bold tabular-nums leading-tight", scoreColor(row.hrImpactScore))}>
              {formatSigned(row.hrImpactScore, 1)}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 border-b border-neutral-200/70 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-900/60 dark:to-neutral-900">
        <p className="text-[10px] uppercase tracking-[0.11em] font-semibold text-neutral-500 dark:text-neutral-400">Why It Leans This Way</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {insightDrivers.length > 0 ? (
            insightDrivers.map((driver) => (
              <span
                key={driver}
                className="rounded-md border border-neutral-200/80 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900 px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-300"
              >
                {driver}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">No strong directional weather drivers.</span>
          )}
        </div>
      </div>

      <div className="bg-[#080e1a] overflow-hidden rounded-b-xl">
        {/* 2/3 + 1/3 split: field left, park factors right */}
        <div className="grid grid-cols-[2fr_1fr]">
          {/* Left: Stadium field */}
          <div className="border-r border-white/[0.06]">
            <div className="px-3 pt-2 pb-1 border-b border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-[0.11em] font-semibold text-white/35">Field Profile</p>
              <p className="text-[11px] text-white/55">Outfield distances with wall-height and wind overlay</p>
            </div>
            <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="w-full h-[228px] md:h-[268px]">
              <defs>
                <clipPath id={`${cardId}-clip`}>
                  <path d={outfieldPath} />
                </clipPath>
                <linearGradient
                  id={`${cardId}-heat`}
                  gradientUnits="userSpaceOnUse"
                  x1={heatStartX}
                  y1={heatStartY}
                  x2={heatEndX}
                  y2={heatEndY}
                >
                  <stop offset="0%" stopColor={hrImpact >= 0 ? "rgba(34, 197, 94, 0.04)" : heatColor} />
                  <stop offset="65%" stopColor={hrImpact >= 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.12)"} />
                  <stop offset="100%" stopColor={hrImpact >= 0 ? heatColor : "rgba(239, 68, 68, 0.04)"} />
                </linearGradient>
                <marker
                  id={`${cardId}-particle-tip`}
                  markerWidth="3"
                  markerHeight="3"
                  refX="2.6"
                  refY="1.5"
                  orient="auto"
                >
                  <path d="M0,0 L3,1.5 L0,3 z" fill="rgba(224, 242, 254, 0.95)" />
                </marker>
                <linearGradient id={`${cardId}-away-badge`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={awayColor} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={awayColor} stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id={`${cardId}-home-badge`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={homeColor} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={homeColor} stopOpacity={0.25} />
                </linearGradient>
              </defs>

            <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#080e1a" />
            <g clipPath={`url(#${cardId}-clip)`}>
              <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={`url(#${cardId}-heat)`} />

              <g transform={`rotate(${windFlowRotationDeg} ${VIEWBOX_WIDTH / 2} ${VIEWBOX_HEIGHT / 2})`}>
                {[...Array(11)].map((_, index) => (
                  <g key={`wind-particle-row-${index}`} transform={`translate(110 ${50 + index * 18})`}>
                    <g
                      className="living-wind-particle"
                      style={
                        {
                          animationDuration: windFlowDuration,
                          animationDelay: `${index * 0.18}s`,
                          opacity: windOpacity,
                          "--wind-shift": `${windShiftPx}px`,
                        } as CSSProperties
                      }
                    >
                      <line x1={-8} y1={0} x2={8} y2={0} className="living-wind-particle-line" markerEnd={`url(#${cardId}-particle-tip)`} />
                    </g>
                  </g>
                ))}
              </g>
            </g>

            <path d={outfieldPath} fill="rgba(15, 23, 42, 0.14)" stroke="rgba(148, 163, 184, 0.25)" strokeWidth={1.25} />
            {infieldPath && <path d={infieldPath} fill="rgba(15, 118, 110, 0.2)" stroke="rgba(94, 234, 212, 0.35)" strokeWidth={1} />}
            {foulPath && <path d={foulPath} fill="none" stroke="rgba(203, 213, 225, 0.45)" strokeWidth={1} strokeDasharray="3 4" />}
            {platePath && <path d={platePath} fill="rgba(251, 191, 36, 0.25)" stroke="rgba(251, 191, 36, 0.7)" strokeWidth={1} />}

            {arcProfile.boundaries.length === 6
              ? [0, 1, 2, 3, 4].map((i) => {
                  const segPoints = outfieldArcPoints.slice(arcProfile.boundaries[i], arcProfile.boundaries[i + 1] + 1);
                  if (segPoints.length < 2) return null;
                  const segPath = pathFromPoints(segPoints, false);
                  return (
                    <path
                      key={`wall-arc-${i}`}
                      d={segPath}
                      fill="none"
                      stroke={wallHeightColor(wallHeights[i], minWallHeight, maxWallHeight)}
                      strokeWidth={4.5}
                      strokeLinecap="round"
                      opacity={0.92}
                    />
                  );
                })
              : outfieldArcPath && (
                  <path
                    d={outfieldArcPath}
                    fill="none"
                    stroke="rgba(214, 224, 235, 0.95)"
                    strokeWidth={4.25}
                    strokeLinecap="round"
                    opacity={0.95}
                  />
                )}

            {distanceMarkers.map((marker) => (
              <g key={`distance-marker-${marker.section}`}>
                <line
                  x1={homeX}
                  y1={homeY}
                  x2={marker.lineEndX}
                  y2={marker.lineEndY}
                  stroke="rgba(148, 163, 184, 0.28)"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
                <circle cx={marker.lineEndX} cy={marker.lineEndY} r={2.1} fill="rgba(186, 230, 253, 0.8)" />
                <text
                  x={marker.labelX}
                  y={marker.labelY}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="rgba(224, 242, 254, 0.95)"
                  stroke="rgba(2, 6, 23, 0.6)"
                  strokeWidth="2"
                  paintOrder="stroke fill"
                >
                  {marker.distance != null ? Math.round(marker.distance) : "-"}
                </text>
                <text
                  x={marker.labelX}
                  y={marker.labelY + 11}
                  textAnchor="middle"
                  fontSize="9.5"
                  letterSpacing="0.04em"
                  fill="rgba(148, 163, 184, 0.95)"
                >
                  {marker.section}
                </text>
              </g>
            ))}

            {/* Weather condition icon — top-left, mirrors wind compass */}
            <g>
              <circle cx={wxIconCx} cy={wxIconCy} r={windCompassR + 4} fill="rgba(2, 6, 23, 0.58)" />
              <circle cx={wxIconCx} cy={wxIconCy} r={windCompassR} fill="none" stroke="rgba(186, 230, 253, 0.18)" strokeWidth={1} />
              {wxIsRainy ? (
                <g>
                  <path
                    d={`M${wxIconCx - 9},${wxIconCy + 2} a4,4 0 0,1 1,-9 a6.5,6.5 0 0,1 12,0 a4,4 0 0,1 1,9 Z`}
                    fill="rgba(148, 163, 184, 0.88)"
                  />
                  {[-4.5, 0, 4.5].map((offset) => (
                    <line
                      key={offset}
                      x1={wxIconCx + offset} y1={wxIconCy + 6}
                      x2={wxIconCx + offset - 2} y2={wxIconCy + 12}
                      stroke="rgba(147, 197, 253, 0.85)"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  ))}
                </g>
              ) : wxIsCloudy ? (
                <path
                  d={`M${wxIconCx - 10},${wxIconCy + 4} a5,5 0 0,1 1,-11 a7.5,7.5 0 0,1 14,0 a5,5 0 0,1 1,11 Z`}
                  fill="rgba(148, 163, 184, 0.78)"
                />
              ) : wxIsPartly ? (
                <g>
                  <circle cx={wxIconCx - 2} cy={wxIconCy - 4} r={5.5} fill="rgba(251, 191, 36, 0.85)" />
                  <path
                    d={`M${wxIconCx - 8},${wxIconCy + 5} a4,4 0 0,1 1,-9 a6,6 0 0,1 11,0 a4,4 0 0,1 1,9 Z`}
                    fill="rgba(148, 163, 184, 0.88)"
                  />
                </g>
              ) : (
                <g>
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                    const rad = (deg * Math.PI) / 180;
                    return (
                      <line
                        key={deg}
                        x1={wxIconCx + Math.cos(rad) * 8.5} y1={wxIconCy + Math.sin(rad) * 8.5}
                        x2={wxIconCx + Math.cos(rad) * 12.5} y2={wxIconCy + Math.sin(rad) * 12.5}
                        stroke="rgba(251, 191, 36, 0.72)"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                    );
                  })}
                  <circle cx={wxIconCx} cy={wxIconCy} r={6.5} fill="rgba(251, 191, 36, 0.92)" />
                </g>
              )}
              <text
                x={wxIconCx}
                y={wxIconCy + windCompassR + 13}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="rgba(224, 242, 254, 0.8)"
                stroke="rgba(2, 6, 23, 0.65)"
                strokeWidth="2.5"
                paintOrder="stroke fill"
              >
                {wxLabel}
              </text>
            </g>

            {/* Wind compass indicator */}
            <g opacity={windSpeed > 0 ? 1 : 0.35}>
              <circle cx={windCompassCx} cy={windCompassCy} r={windCompassR + 4} fill="rgba(2, 6, 23, 0.58)" />
              <circle cx={windCompassCx} cy={windCompassCy} r={windCompassR} fill="none" stroke="rgba(186, 230, 253, 0.22)" strokeWidth={1} />
              <line
                x1={windTailX}
                y1={windTailY}
                x2={windBaseX}
                y2={windBaseY}
                stroke="rgba(186, 230, 253, 0.8)"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <path d={windArrowHeadPath} fill="rgba(186, 230, 253, 0.92)" />
              <text
                x={windCompassCx}
                y={windCompassCy + windCompassR + 13}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="rgba(224, 242, 254, 0.9)"
                stroke="rgba(2, 6, 23, 0.65)"
                strokeWidth="2.5"
                paintOrder="stroke fill"
              >
                {Math.round(windSpeed)} mph
              </text>
            </g>

            <circle cx={homeX} cy={homeY} r={4.2} fill="rgba(125, 211, 252, 0.72)" stroke="rgba(255,255,255,0.45)" strokeWidth={1} />

            {/* Team logo badges — bottom corners, broadcast style */}
            {row.awayTeamAbbr && (
              <g>
                <circle cx={22} cy={VIEWBOX_HEIGHT - 22} r={17} fill={`url(#${cardId}-away-badge)`} />
                <circle cx={22} cy={VIEWBOX_HEIGHT - 22} r={17} fill="none" stroke={awayColor} strokeWidth={1.25} strokeOpacity={0.5} />
                <image
                  href={`/team-logos/mlb/${row.awayTeamAbbr.toUpperCase()}.svg`}
                  x={22 - 11} y={VIEWBOX_HEIGHT - 22 - 11}
                  width={22} height={22}
                />
              </g>
            )}
            {row.homeTeamAbbr && (
              <g>
                <circle cx={VIEWBOX_WIDTH - 22} cy={VIEWBOX_HEIGHT - 22} r={17} fill={`url(#${cardId}-home-badge)`} />
                <circle cx={VIEWBOX_WIDTH - 22} cy={VIEWBOX_HEIGHT - 22} r={17} fill="none" stroke={homeColor} strokeWidth={1.25} strokeOpacity={0.5} />
                <image
                  href={`/team-logos/mlb/${row.homeTeamAbbr.toUpperCase()}.svg`}
                  x={VIEWBOX_WIDTH - 22 - 11} y={VIEWBOX_HEIGHT - 22 - 11}
                  width={22} height={22}
                />
              </g>
            )}
            </svg>
          </div>

          {/* Right: Park Factors */}
          <div className="p-3 flex flex-col justify-center">
            {row.ballparkFactors && (() => {
              const FACTORS = [
                { key: "hr",   label: "HR" },
                { key: "h",    label: "H" },
                { key: "3b",   label: "3B" },
                { key: "runs", label: "Runs" },
                { key: "2b",   label: "2B" },
              ];
              const hasAny = FACTORS.some((f) => row.ballparkFactors?.[f.key]?.overall != null);
              if (!hasAny) return null;
              return (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.11em] font-semibold text-white/35">Park Factors</p>
                      <p className="text-[10px] text-white/40">Baseline 100</p>
                    </div>
                    <span className="text-[10px] text-white/25">2025</span>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.08em] text-white/25">
                    <span>Suppress</span>
                    <span>Boost</span>
                  </div>
                  <div className="space-y-2.5">
                    {FACTORS.map(({ key, label }) => {
                      const val = row.ballparkFactors?.[key]?.overall ?? null;
                      const dev = val != null ? Math.max(-20, Math.min(20, val - 100)) : 0;
                      const deltaLabel = val != null ? `${Math.round(dev) > 0 ? "+" : ""}${Math.round(dev)}%` : "--";
                      const barPct = (Math.abs(dev) / 20) * 45;
                      const isOver = dev > 0;
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/45 w-7 shrink-0 font-semibold">{label}</span>
                          <div className="relative flex-1 h-2 bg-white/[0.10] rounded-full overflow-hidden">
                            <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
                            {val != null && (
                              <div
                                className={cn("absolute inset-y-0 rounded-full", isOver ? "bg-emerald-400/90" : "bg-red-400/90")}
                                style={{ width: `${barPct}%`, left: isOver ? "50%" : undefined, right: !isOver ? "50%" : undefined }}
                              />
                            )}
                          </div>
                          <div className="w-[44px] shrink-0 text-right">
                            <p className={cn("text-[11px] font-bold tabular-nums leading-none", factorValueColor(val))}>{val ?? "–"}</p>
                            <p className={cn("text-[9px] font-semibold tabular-nums leading-none mt-0.5", dev > 0 ? "text-emerald-300/85" : dev < 0 ? "text-red-300/85" : "text-white/35")}>
                              {deltaLabel}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Full-width weather pills */}
        <div className="border-t border-white/[0.06]">
          <div className="px-3 pt-2">
            <p className="text-[10px] uppercase tracking-[0.11em] font-semibold text-white/35">Game Conditions</p>
          </div>
          <div className="px-3 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Temp */}
            <div className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2.5">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.08em] font-semibold mb-2 flex items-center gap-1">
                <Thermometer className="h-3 w-3 shrink-0" /> Temp
              </p>
              <p className="text-[23px] font-semibold text-white leading-none tabular-nums">{formatNumber(row.temperatureF, 0)}°</p>
              <p className="text-[10px] text-white/50 mt-1.5">
                {row.feelsLikeF != null ? `Feels ${formatNumber(row.feelsLikeF, 0)}°` : "\u00A0"}
              </p>
            </div>

            {/* Wind */}
            <div className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2.5">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.08em] font-semibold mb-2 flex items-center gap-1">
                <Wind className="h-3 w-3 shrink-0" /> Wind
              </p>
              <p className="text-[23px] font-semibold text-white leading-none tabular-nums">
                {formatNumber(row.windSpeedMph, 0)}
                <span className="text-xs font-medium text-white/50 ml-1">mph</span>
              </p>
              <p className="text-[10px] text-sky-300/70 mt-1.5 truncate">
                {row.windLabel || (row.windGustMph != null ? `gusts ${formatNumber(row.windGustMph, 0)} mph` : "\u00A0")}
              </p>
            </div>

            {/* Rain */}
            <div className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2.5">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.08em] font-semibold mb-2 flex items-center gap-1">
                <CloudRain className="h-3 w-3 shrink-0" /> Rain
              </p>
              <p className="text-[23px] font-semibold text-white leading-none tabular-nums">
                {row.precipProbability != null ? `${Math.round(row.precipProbability)}%` : "—"}
              </p>
              <p className="text-[10px] text-white/50 mt-1.5">
                {row.cloudCoverPct != null ? `${Math.round(row.cloudCoverPct)}% cloud cover` : "\u00A0"}
              </p>
            </div>

            {/* Venue */}
            <div className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2.5">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.08em] font-semibold mb-2">Venue</p>
              <p className="text-[23px] font-semibold text-white leading-none truncate">{row.roofType || "—"}</p>
              <p className="text-[10px] text-white/50 mt-1.5">
                {row.elevationFt != null ? `${Math.round(row.elevationFt).toLocaleString()} ft elev` : "\u00A0"}
              </p>
            </div>
          </div>
        </div>

        {/* Weather alert */}
        {row.weatherAlert && (
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="flex items-start gap-2 text-xs text-amber-400/90">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
              <span>{row.weatherAlert}</span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .living-wind-particle {
          animation-name: living-wind-particle-flow;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }

        .living-wind-particle-line {
          stroke: rgba(186, 230, 253, 0.7);
          stroke-width: 1.25;
          stroke-linecap: round;
        }

        @keyframes living-wind-particle-flow {
          from {
            transform: translateX(calc(var(--wind-shift, 48px) * -1));
            opacity: 0.3;
          }
          20% {
            opacity: 0.85;
          }
          80% {
            opacity: 0.9;
          }
          to {
            transform: translateX(var(--wind-shift, 48px));
            opacity: 0.25;
          }
        }
      `}</style>
    </article>
  );
}
