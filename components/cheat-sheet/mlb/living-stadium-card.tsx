"use client";

import { useMemo, type CSSProperties } from "react";
import { AlertTriangle, CloudRain, Thermometer, Wind } from "lucide-react";
import { MlbWeatherReportRow } from "@/hooks/use-mlb-weather-report";
import { cn } from "@/lib/utils";

type Point = [number, number];

const VIEWBOX_WIDTH = 420;
const VIEWBOX_HEIGHT = 280;
const VIEWBOX_PADDING = 24;

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

  return groups.map((group) =>
    group.map(([x, y]) => [
      VIEWBOX_PADDING + (x - minX) * scale,
      VIEWBOX_HEIGHT - VIEWBOX_PADDING - (y - minY) * scale,
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

function interpolateColor(start: [number, number, number], end: [number, number, number], t: number): string {
  const safeT = clamp(t, 0, 1);
  const r = Math.round(start[0] + (end[0] - start[0]) * safeT);
  const g = Math.round(start[1] + (end[1] - start[1]) * safeT);
  const b = Math.round(start[2] + (end[2] - start[2]) * safeT);
  return `rgb(${r}, ${g}, ${b})`;
}

function wallColor(height: number | null, minHeight: number, maxHeight: number): string {
  if (height === null) return "rgba(156, 163, 175, 0.85)";
  const range = Math.max(maxHeight - minHeight, 1);
  const normalized = (height - minHeight) / range;
  return interpolateColor([34, 197, 94], [239, 68, 68], normalized);
}

function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return "text-neutral-500";
  if (score >= 2) return "text-emerald-400";
  if (score <= -2) return "text-red-400";
  return "text-amber-400";
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

  const wallSegments = useMemo(() => {
    if (normalizedOutfield.length < 10) return [];
    const segments: Point[][] = [];
    for (let i = 0; i < 5; i++) {
      const start = Math.floor((normalizedOutfield.length - 1) * (i / 5));
      const end = Math.floor((normalizedOutfield.length - 1) * ((i + 1) / 5));
      const segment = normalizedOutfield.slice(start, Math.max(end + 1, start + 2));
      if (segment.length >= 2) segments.push(segment);
    }
    return segments;
  }, [normalizedOutfield]);

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

  const windArrowLength = 75 + clamp(windSpeed, 0, 24) * 2.2;
  const windStartX = homeX - windVector.x * 20;
  const windStartY = homeY - windVector.y * 20;
  const windEndX = homeX + windVector.x * windArrowLength;
  const windEndY = homeY + windVector.y * windArrowLength;

  const hrImpact = Number(row.hrImpactScore ?? 0);
  const heatIntensity = clamp(Math.abs(hrImpact) / 8, 0.1, 0.58);
  const heatColor = hrImpact >= 0 ? `rgba(16, 185, 129, ${heatIntensity})` : `rgba(239, 68, 68, ${heatIntensity})`;
  const heatStartX = homeX - windVector.x * 130;
  const heatStartY = homeY - windVector.y * 130;
  const heatEndX = homeX + windVector.x * 130;
  const heatEndY = homeY + windVector.y * 130;
  const windFlowDuration = `${clamp(10 - windSpeed * 0.25, 3.4, 9.5)}s`;

  const gameLabel = `${row.awayTeamAbbr || row.awayTeamName || "Away"} @ ${row.homeTeamAbbr || row.homeTeamName || "Home"}`;
  const gameSubLabel =
    row.venueCity && row.venueState ? `${row.venueName || "Unknown Venue"} • ${row.venueCity}, ${row.venueState}` : row.venueName || "Unknown Venue";

  return (
    <article className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm md:text-base font-semibold text-neutral-900 dark:text-white">{gameLabel}</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {gameSubLabel} • {getETTime(row.gameDatetime)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("px-2 py-1 rounded-md text-xs font-semibold", impactPillClass(row.totalImpact))}>
            {formatImpactLabel(row.totalImpact)}
          </span>
          <span className={cn("text-sm font-bold", scoreColor(row.hrImpactScore))}>
            HR {row.hrImpactScore != null ? `${row.hrImpactScore > 0 ? "+" : ""}${formatNumber(row.hrImpactScore, 1)}` : "-"}
          </span>
        </div>
      </div>

      <div className="p-3 md:p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-xl border border-sky-500/15 bg-gradient-to-b from-sky-500/[0.08] to-transparent dark:from-sky-500/[0.09] dark:to-transparent p-2 md:p-3 overflow-hidden">
          <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="w-full h-[220px] md:h-[245px]">
            <defs>
              <pattern id={`${cardId}-grid`} width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(125, 211, 252, 0.13)" strokeWidth="0.8" />
              </pattern>
              <clipPath id={`${cardId}-clip`}>
                <path d={outfieldPath} />
              </clipPath>
              <linearGradient id={`${cardId}-field-bg`} x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(14, 116, 144, 0.08)" />
                <stop offset="100%" stopColor="rgba(30, 64, 175, 0.16)" />
              </linearGradient>
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
              <marker id={`${cardId}-arrowhead`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="rgba(56, 189, 248, 0.9)" />
              </marker>
            </defs>

            <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={`url(#${cardId}-grid)`} />
            <g clipPath={`url(#${cardId}-clip)`}>
              <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={`url(#${cardId}-field-bg)`} />
              <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={`url(#${cardId}-heat)`} />

              {[...Array(10)].map((_, index) => (
                <line
                  key={index}
                  x1={-120}
                  y1={44 + index * 22}
                  x2={VIEWBOX_WIDTH + 120}
                  y2={44 + index * 22}
                  className="living-wind-line"
                  style={
                    {
                      transformOrigin: `${VIEWBOX_WIDTH / 2}px ${VIEWBOX_HEIGHT / 2}px`,
                      transform: `rotate(${Number(row.windRelativeDeg ?? 0)}deg)`,
                      animationDuration: windFlowDuration,
                      animationDelay: `${index * 0.32}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </g>

            <path d={outfieldPath} fill="rgba(15, 23, 42, 0.14)" stroke="rgba(148, 163, 184, 0.25)" strokeWidth={1.25} />
            {infieldPath && <path d={infieldPath} fill="rgba(15, 118, 110, 0.2)" stroke="rgba(94, 234, 212, 0.35)" strokeWidth={1} />}
            {foulPath && <path d={foulPath} fill="none" stroke="rgba(203, 213, 225, 0.45)" strokeWidth={1} strokeDasharray="3 4" />}
            {platePath && <path d={platePath} fill="rgba(251, 191, 36, 0.25)" stroke="rgba(251, 191, 36, 0.7)" strokeWidth={1} />}

            {wallSegments.map((segment, index) => (
              <path
                key={`wall-segment-${index}`}
                d={pathFromPoints(segment, false)}
                fill="none"
                stroke={wallColor(wallHeights[index] ?? null, minWallHeight, maxWallHeight)}
                strokeWidth={4.25}
                strokeLinecap="round"
                opacity={0.95}
              />
            ))}

            <line
              x1={windStartX}
              y1={windStartY}
              x2={windEndX}
              y2={windEndY}
              stroke="rgba(56, 189, 248, 0.92)"
              strokeWidth={2.2}
              strokeLinecap="round"
              markerEnd={`url(#${cardId}-arrowhead)`}
            />
            <circle cx={homeX} cy={homeY} r={4.8} fill="rgba(125, 211, 252, 0.9)" stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              Wind: {formatNumber(row.windSpeedMph, 0)} mph
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/10 border border-sky-500/20">
              {row.windLabel || "No wind label"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
              Wall profile: {numericWallHeights.length > 0 ? `${Math.round(minWallHeight)}-${Math.round(maxWallHeight)} ft` : "N/A"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <Thermometer className="h-3.5 w-3.5" />
                Temp
              </span>
              <span className="font-semibold text-neutral-900 dark:text-white">{formatNumber(row.temperatureF, 1)}°F</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <Wind className="h-3.5 w-3.5" />
                Gusts
              </span>
              <span className="font-semibold text-neutral-900 dark:text-white">{formatNumber(row.windGustMph, 0)} mph</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <CloudRain className="h-3.5 w-3.5" />
                Rain
              </span>
              <span className="font-semibold text-neutral-900 dark:text-white">
                {row.precipProbability != null ? `${Math.round(row.precipProbability)}%` : "-"}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 p-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">Venue Factors</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-neutral-200 dark:border-neutral-800 p-2">
                <p className="text-neutral-500">Roof</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">{row.roofType || "-"}</p>
              </div>
              <div className="rounded border border-neutral-200 dark:border-neutral-800 p-2">
                <p className="text-neutral-500">Elevation</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {row.elevationFt != null ? `${Math.round(row.elevationFt)} ft` : "-"}
                </p>
              </div>
              <div className="rounded border border-neutral-200 dark:border-neutral-800 p-2">
                <p className="text-neutral-500">CF</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {row.fieldDistances?.centerField != null ? `${Math.round(row.fieldDistances.centerField)} ft` : "-"}
                </p>
              </div>
              <div className="rounded border border-neutral-200 dark:border-neutral-800 p-2">
                <p className="text-neutral-500">LF/RF</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {row.fieldDistances?.leftLine != null && row.fieldDistances?.rightLine != null
                    ? `${Math.round(row.fieldDistances.leftLine)} / ${Math.round(row.fieldDistances.rightLine)}`
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          {row.weatherAlert && (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 inline-flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{row.weatherAlert}</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .living-wind-line {
          stroke: rgba(125, 211, 252, 0.42);
          stroke-width: 1.6;
          stroke-dasharray: 5 10;
          animation-name: living-wind-flow;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }

        @keyframes living-wind-flow {
          from {
            stroke-dashoffset: 0;
            opacity: 0.2;
          }
          50% {
            opacity: 0.85;
          }
          to {
            stroke-dashoffset: -110;
            opacity: 0.2;
          }
        }
      `}</style>
    </article>
  );
}
