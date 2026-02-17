"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PremiumLogo } from "@/components/common/loading-state";
import { formatMarketLabel } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  LineHistoryApiRequest,
  LineHistoryApiResponse,
  LineHistoryBookData,
  LineHistoryContext,
  LineHistoryPoint,
} from "@/lib/odds/line-history";

interface LineHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: LineHistoryContext | null;
}

/* ── Utility functions ─────────────────────────────────────────────── */

function formatOdds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;
}

function movementLabel(entries: LineHistoryPoint[]): string | null {
  if (!entries || entries.length < 2) return null;
  const first = entries[0].price;
  const last = entries[entries.length - 1].price;
  const diff = last - first;
  if (diff === 0) return "Flat";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${Math.round(diff)}`;
}

function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}

function formatAbsoluteTime(epochMs: number | null): string {
  if (!epochMs) return "—";
  return new Date(epochMs).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const value = input.trim();
  if (!value.startsWith("#")) return null;
  const hex = value.slice(1);
  const normalized = hex.length === 3 ? hex.split("").map((c) => `${c}${c}`).join("") : hex;
  if (normalized.length !== 6) return null;
  const n = Number.parseInt(normalized, 16);
  if (!Number.isFinite(n)) return null;
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function toHexColor(rgb: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function mixColors(base: string, target: string, amount: number): string {
  const baseRgb = parseHexColor(base);
  const targetRgb = parseHexColor(target);
  if (!baseRgb || !targetRgb) return base;
  const t = Math.max(0, Math.min(1, amount));
  return toHexColor({
    r: baseRgb.r + (targetRgb.r - baseRgb.r) * t,
    g: baseRgb.g + (targetRgb.g - baseRgb.g) * t,
    b: baseRgb.b + (targetRgb.b - baseRgb.b) * t,
  });
}

function luminance(color: string): number {
  const rgb = parseHexColor(color);
  if (!rgb) return 0;
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getContrastColor(baseColor: string, background: string, minContrast: number): string {
  if (!parseHexColor(baseColor)) return "#38bdf8";
  if (contrastRatio(baseColor, background) >= minContrast) return baseColor;
  for (let i = 1; i <= 10; i++) {
    const candidate = mixColors(baseColor, "#ffffff", i * 0.1);
    if (contrastRatio(candidate, background) >= minContrast) return candidate;
  }
  return mixColors(baseColor, "#ffffff", 0.85);
}

function classForMove(value: number | null): string {
  if (value == null || value === 0) return "text-neutral-400 dark:text-neutral-500";
  if (value > 0) return "text-emerald-500 dark:text-emerald-400";
  return "text-rose-500 dark:text-rose-400";
}

function formatMove(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value === 0) return "Flat";
  if (value > 0) return `▲ +${Math.round(value)}`;
  return `▼ ${Math.round(value)}`;
}

/* ── Chart utility functions ───────────────────────────────────────── */

function computePriceTicks(min: number, max: number): number[] {
  const range = max - min || 10;
  const rawStep = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 5, 10, 25, 50, 100];
  let step = niceSteps.find((s) => s * mag >= rawStep) ?? 10;
  step *= mag;
  if (step < 1) step = 1;

  const ticks: number[] = [];
  let t = Math.floor(min / step) * step;
  while (t <= max + step * 0.01) {
    if (t >= min - step * 0.5) ticks.push(Math.round(t));
    t += step;
  }
  if (ticks.length < 2) {
    ticks.length = 0;
    ticks.push(Math.round(min), Math.round(max));
  }
  return ticks;
}

function computeTimeTicks(minTs: number, maxTs: number): number[] {
  const range = maxTs - minTs;
  if (range <= 0) return [minTs];

  const intervals = [
    5 * 60_000, 15 * 60_000, 30 * 60_000,
    3600_000, 2 * 3600_000, 4 * 3600_000,
    6 * 3600_000, 12 * 3600_000, 86400_000,
  ];
  const targetTicks = 6;
  const rawInterval = range / targetTicks;
  const interval = intervals.find((i) => i >= rawInterval) || 86400_000;

  const ticks: number[] = [];
  let t = Math.ceil(minTs / interval) * interval;
  while (t <= maxTs) {
    ticks.push(t);
    t += interval;
  }
  if (ticks.length === 0) ticks.push(minTs + range / 2);
  return ticks;
}

function formatChartTimestamp(epochMs: number, rangeMs: number): string {
  const d = new Date(epochMs);
  if (rangeMs > 86400_000 * 1.5) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  if (rangeMs > 86400_000) {
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** For a step-line, find the price at a given timestamp */
function getPriceAtTime(entries: LineHistoryPoint[], ts: number): number | null {
  if (!entries || entries.length === 0) return null;
  let result: number | null = null;
  for (const pt of entries) {
    if (pt.timestamp <= ts) result = pt.price;
    else break;
  }
  return result;
}

/* ── Time range constants ──────────────────────────────────────────── */

type TimeRangeKey = "1h" | "6h" | "24h" | "all";
const TIME_RANGES: { key: TimeRangeKey; label: string; ms: number }[] = [
  { key: "1h", label: "1H", ms: 3600_000 },
  { key: "6h", label: "6H", ms: 6 * 3600_000 },
  { key: "24h", label: "24H", ms: 24 * 3600_000 },
  { key: "all", label: "ALL", ms: 0 },
];

/* ── BookLegend ────────────────────────────────────────────────────── */

function BookLegend({
  bookIds,
  hiddenBookIds,
  loadingBookIds,
  onToggle,
  isMobile,
}: {
  bookIds: string[];
  hiddenBookIds: Set<string>;
  loadingBookIds: Set<string>;
  onToggle: (bookId: string) => void;
  isMobile: boolean;
}) {
  return (
    <div
      className={cn(
        "gap-1.5",
        isMobile ? "flex overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex flex-wrap"
      )}
    >
      {bookIds.map((bookId) => {
        const meta = getSportsbookById(bookId);
        const name = meta?.name || bookId;
        const color = meta?.brandColor || "#16a34a";
        const logo = meta?.image?.square || meta?.image?.light || null;
        const hidden = hiddenBookIds.has(bookId);
        const loading = loadingBookIds.has(bookId);

        return (
          <button
            key={bookId}
            type="button"
            onClick={() => onToggle(bookId)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium border transition-all select-none cursor-pointer shrink-0",
              isMobile ? "px-1.5 py-1 text-[10px]" : "px-2 py-1 text-[11px]",
              "border-neutral-200 dark:border-neutral-700/80",
              hidden
                ? "opacity-40 bg-neutral-100/50 dark:bg-neutral-800/30"
                : "bg-white dark:bg-neutral-800/60",
              loading && "animate-pulse"
            )}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: hidden ? "transparent" : color, border: `2px solid ${color}` }}
            />
            {logo && <img src={logo} alt="" className="w-3.5 h-3.5 object-contain" />}
            {name}
          </button>
        );
      })}
    </div>
  );
}

/* ── Hover tooltip ─────────────────────────────────────────────────── */

interface HoverData {
  svgX: number;
  timestamp: number;
  prices: { bookId: string; price: number; color: string; tooltipColor: string; logo: string | null; name: string }[];
}

function ChartTooltip({
  data,
  containerRect,
  svgWidth,
  isMobile,
}: {
  data: HoverData;
  containerRect: DOMRect;
  svgWidth: number;
  isMobile: boolean;
}) {
  const pixelX = (data.svgX / svgWidth) * containerRect.width;
  const tooltipWidth = isMobile ? 156 : 180;
  const flipped = pixelX > containerRect.width - tooltipWidth - 20;
  const left = flipped ? pixelX - tooltipWidth - 12 : pixelX + 12;

  const d = new Date(data.timestamp);
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  // Sort by price descending (most positive first)
  const sorted = [...data.prices].sort((a, b) => b.price - a.price);

  return (
    <div
      className="absolute top-2 z-50 pointer-events-none"
      style={{ left: Math.max(4, Math.min(left, containerRect.width - tooltipWidth - 4)) }}
    >
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/95 backdrop-blur-sm shadow-xl text-white px-2.5 py-2 min-w-[170px]">
        <div className="flex items-baseline gap-2 mb-1.5 border-b border-neutral-700/60 pb-1.5">
          <span className={cn("font-semibold tabular-nums", isMobile ? "text-[10px]" : "text-[11px]")}>{timeStr}</span>
          <span className={cn("text-neutral-400", isMobile ? "text-[9px]" : "text-[10px]")}>{relativeTime(data.timestamp)}</span>
        </div>
        <div className="space-y-0.5">
          {sorted.map((row) => (
            <div key={row.bookId} className="flex items-center gap-1.5 text-[11px]">
              <span className="font-extrabold tabular-nums min-w-[42px] text-[12px]" style={{ color: row.tooltipColor }}>
                {formatOdds(row.price)}
              </span>
              {row.logo ? (
                <img src={row.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: row.color, opacity: 0.5 }} />
              )}
              <span className="text-neutral-200 truncate text-[10px]">{row.name}</span>
            </div>
          ))}
        </div>
        <div className="text-[9px] text-neutral-500 mt-1.5 pt-1 border-t border-neutral-700/60">{dateStr}</div>
      </div>
    </div>
  );
}

/* ── UnifiedLineChart ──────────────────────────────────────────────── */

interface ChartDataset {
  bookId: string;
  entries: LineHistoryPoint[];
  color: string;
  tooltipColor: string;
  name: string;
  logo: string | null;
}

function UnifiedLineChart({
  bookIds,
  bookDataById,
  timeRange,
  isLoading,
  isMobile,
}: {
  bookIds: string[];
  bookDataById: Record<string, LineHistoryBookData>;
  timeRange: TimeRangeKey;
  isLoading: boolean;
  isMobile: boolean;
}) {
  const W = isMobile ? 760 : 900;
  const H = isMobile ? 350 : 400;
  const PAD = isMobile ? { top: 18, right: 56, bottom: 30, left: 16 } : { top: 20, right: 56, bottom: 36, left: 12 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  const datasets: ChartDataset[] = useMemo(() => {
    return bookIds
      .map((bookId) => {
        const data = bookDataById[bookId];
        const meta = getSportsbookById(bookId);
        const rawColor = meta?.brandColor || "#16a34a";
        return {
          bookId,
          entries: data?.entries || [],
          color: getContrastColor(rawColor, "#0d1117", 2.8),
          tooltipColor: getContrastColor(rawColor, "#0f172a", 4.2),
          name: meta?.name || bookId,
          logo: meta?.image?.square || meta?.image?.light || null,
        };
      })
      .filter((d) => d.entries.length > 0);
  }, [bookIds, bookDataById]);

  // Apply time range filter
  const filteredDatasets = useMemo(() => {
    const rangeConfig = TIME_RANGES.find((r) => r.key === timeRange);
    if (!rangeConfig || rangeConfig.ms === 0) return datasets;
    const cutoff = Date.now() - rangeConfig.ms;
    return datasets.map((ds) => ({
      ...ds,
      entries: ds.entries.filter((pt) => pt.timestamp >= cutoff),
    })).filter((ds) => ds.entries.length > 0);
  }, [datasets, timeRange]);

  const { minPrice, maxPrice, minTs, maxTs } = useMemo(() => {
    let mnP = Infinity, mxP = -Infinity, mnT = Infinity, mxT = -Infinity;
    for (const ds of filteredDatasets) {
      for (const pt of ds.entries) {
        if (pt.price < mnP) mnP = pt.price;
        if (pt.price > mxP) mxP = pt.price;
        if (pt.timestamp < mnT) mnT = pt.timestamp;
        if (pt.timestamp > mxT) mxT = pt.timestamp;
      }
    }
    if (!isFinite(mnP)) { mnP = -110; mxP = -100; mnT = Date.now() - 3600_000; mxT = Date.now(); }
    const pad = (mxP - mnP) * 0.08 || 5;
    return { minPrice: mnP - pad, maxPrice: mxP + pad, minTs: mnT, maxTs: mxT };
  }, [filteredDatasets]);

  const priceTicks = useMemo(() => computePriceTicks(minPrice, maxPrice), [minPrice, maxPrice]);
  const timeTicks = useMemo(() => computeTimeTicks(minTs, maxTs), [minTs, maxTs]);
  const displayTimeTicks = useMemo(() => {
    if (!isMobile) return timeTicks;
    return timeTicks.filter((_, idx) => idx % 2 === 0 || idx === timeTicks.length - 1);
  }, [timeTicks, isMobile]);
  const displayPriceTicks = useMemo(() => {
    if (!isMobile || priceTicks.length <= 4) return priceTicks;
    return priceTicks.filter((_, idx) => idx % 2 === 0 || idx === priceTicks.length - 1);
  }, [priceTicks, isMobile]);
  const timeRange_ = maxTs - minTs || 1;
  const priceRange = maxPrice - minPrice || 1;

  const toX = useCallback((ts: number) => PAD.left + ((ts - minTs) / timeRange_) * plotW, [minTs, timeRange_, plotW]);
  const toY = useCallback((price: number) => PAD.top + (1 - (price - minPrice) / priceRange) * plotH, [minPrice, priceRange, plotH]);
  const fromX = useCallback((svgX: number) => minTs + ((svgX - PAD.left) / plotW) * timeRange_, [minTs, plotW, timeRange_]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setContainerRect(rect);

    const relX = e.clientX - rect.left;
    const svgX = (relX / rect.width) * W;

    // Clamp to plot area
    if (svgX < PAD.left || svgX > W - PAD.right) {
      setHoverData(null);
      return;
    }

    const ts = fromX(svgX);
    const prices = filteredDatasets
      .map((ds) => {
        const price = getPriceAtTime(ds.entries, ts);
        if (price == null) return null;
        return {
          bookId: ds.bookId,
          price,
          color: ds.color,
          tooltipColor: ds.tooltipColor,
          logo: ds.logo,
          name: ds.name,
        };
      })
      .filter(Boolean) as HoverData["prices"];

    if (prices.length === 0) {
      setHoverData(null);
      return;
    }

    setHoverData({ svgX, timestamp: ts, prices });
  }, [filteredDatasets, fromX]);

  const handleMouseLeave = useCallback(() => setHoverData(null), []);

  if (isLoading && filteredDatasets.length === 0) {
    return (
      <div className="h-[300px] rounded-lg border border-neutral-200/70 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <PremiumLogo size={34} />
          <span className="text-xs text-neutral-500">Loading line history...</span>
        </div>
      </div>
    );
  }

  if (filteredDatasets.length === 0) {
    return (
      <div className="h-[300px] rounded-lg border border-neutral-200/70 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/50 flex items-center justify-center text-xs text-neutral-500">
        No line history available for this time range
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto rounded-lg border border-neutral-200/70 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#0d1117]" preserveAspectRatio="xMidYMid meet">
        {/* vertical grid lines */}
        {displayTimeTicks.map((ts) => (
          <line
            key={`v-${ts}`}
            x1={toX(ts)}
            y1={PAD.top}
            x2={toX(ts)}
            y2={H - PAD.bottom}
            stroke="currentColor"
            className="text-neutral-200/80 dark:text-neutral-800/80"
            strokeWidth="0.6"
          />
        ))}

        {/* grid lines */}
        {priceTicks.map((tick) => (
          <line key={`g-${tick}`} x1={PAD.left} y1={toY(tick)} x2={W - PAD.right} y2={toY(tick)} stroke="currentColor" className="text-neutral-200/80 dark:text-neutral-800/80" strokeWidth="0.6" />
        ))}

        {/* Y-axis labels (right) */}
        {displayPriceTicks.map((tick) => (
          <text key={`y-${tick}`} x={W - PAD.right + 6} y={toY(tick)} dominantBaseline="middle" textAnchor="start" fill="currentColor" className="text-neutral-500 dark:text-neutral-400" fontSize={isMobile ? "9" : "10"} fontFamily="inherit">
            {formatOdds(tick)}
          </text>
        ))}

        {/* X-axis labels (bottom) */}
        {displayTimeTicks.map((ts) => (
          <text key={`x-${ts}`} x={toX(ts)} y={H - 6} textAnchor="middle" fill="currentColor" className="text-neutral-500 dark:text-neutral-400" fontSize={isMobile ? "9" : "9"} fontFamily="inherit">
            {formatChartTimestamp(ts, timeRange_)}
          </text>
        ))}

        {/* step-line paths */}
        {filteredDatasets.map((ds) => {
          const pts = ds.entries;
          if (pts.length === 0) return null;

          let d = `M${toX(pts[0].timestamp)},${toY(pts[0].price)}`;
          for (let i = 1; i < pts.length; i++) {
            d += ` H${toX(pts[i].timestamp)} V${toY(pts[i].price)}`;
          }
          d += ` H${W - PAD.right}`;

          return (
            <g key={ds.bookId}>
              <path d={d} fill="none" stroke={ds.color} strokeWidth="5" strokeLinecap="round" opacity={0.14} />
              <path d={d} fill="none" stroke={ds.color} strokeWidth="2.2" strokeLinecap="round" opacity={0.96} />
            </g>
          );
        })}

        {/* hover crosshair */}
        {hoverData && (
          <>
            <line
              x1={hoverData.svgX} y1={PAD.top} x2={hoverData.svgX} y2={H - PAD.bottom}
              stroke="currentColor" className="text-neutral-400 dark:text-neutral-500" strokeWidth="1" strokeDasharray="3,3"
            />
            {/* dots at intersection */}
            {hoverData.prices.map((p) => (
              <circle key={p.bookId} cx={hoverData.svgX} cy={toY(p.price)} r="4" fill={p.color} stroke="#0d1117" strokeWidth="1.5" />
            ))}
          </>
        )}
      </svg>

      {/* HTML tooltip overlay */}
      {hoverData && containerRect && (
        <ChartTooltip data={hoverData} containerRect={containerRect} svgWidth={W} isMobile={isMobile} />
      )}
    </div>
  );
}

/* ── TimeRangeSelector ─────────────────────────────────────────────── */

function TimeRangeSelector({
  value,
  onChange,
  className,
}: {
  value: TimeRangeKey;
  onChange: (v: TimeRangeKey) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700/80 overflow-hidden", className)}>
      {TIME_RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={cn(
            "px-3 py-1 text-[11px] font-semibold transition-colors",
            r.key === value
              ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
              : "bg-white dark:bg-neutral-800/60 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/* ── StatsTable ────────────────────────────────────────────────────── */

function StatsTable({
  bookIds,
  bookDataById,
  isMobile,
}: {
  bookIds: string[];
  bookDataById: Record<string, LineHistoryBookData>;
  isMobile: boolean;
}) {
  if (bookIds.length === 0) return null;

  const rows = bookIds
    .map((bookId) => {
      const bookData = bookDataById[bookId];
      const meta = getSportsbookById(bookId);
      const name = meta?.name || bookId;
      const color = meta?.brandColor || "#16a34a";
      const logo = meta?.image?.square || meta?.image?.light || null;
      const entries = bookData?.entries || [];
      const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
      const currentDisplayPrice = latestEntry?.price ?? bookData?.currentPrice ?? null;
      const openPrice = entries.length > 0 ? entries[0].price : bookData?.olv.price ?? null;
      const moveValue =
        currentDisplayPrice != null && openPrice != null ? currentDisplayPrice - openPrice : null;
      const updatedEpoch =
        latestEntry?.timestamp ??
        parseIsoTimestamp(bookData?.updated) ??
        bookData?.clv.timestamp ??
        bookData?.olv.timestamp ??
        null;

      return {
        bookId,
        bookData,
        name,
        color,
        logo,
        entries,
        currentDisplayPrice,
        moveValue,
        updatedEpoch,
        points: entries.length,
      };
    })
    .sort((a, b) => {
      const aCurrent = a.currentDisplayPrice;
      const bCurrent = b.currentDisplayPrice;
      if (aCurrent != null && bCurrent != null && aCurrent !== bCurrent) return bCurrent - aCurrent;
      if (aCurrent != null && bCurrent == null) return -1;
      if (aCurrent == null && bCurrent != null) return 1;
      return a.name.localeCompare(b.name);
    });

  if (isMobile) {
    return (
      <div className="space-y-1.5">
        {rows.map((row) => {
          const isNoHistory = row.bookData && (row.bookData.status !== "ok" || row.points === 0);
          return (
            <div key={row.bookId} className="rounded-md border border-neutral-200/70 dark:border-neutral-800/70 bg-white/50 dark:bg-neutral-900/30 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  {row.logo && <img src={row.logo} alt="" className="w-3.5 h-3.5 object-contain" />}
                  <span className="text-[11px] font-semibold truncate">{row.name}</span>
                  {isNoHistory && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10 text-amber-500 dark:text-amber-300 text-[8px] font-semibold">
                      No history
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] font-semibold tabular-nums", classForMove(row.moveValue))}>
                  {formatMove(row.moveValue)}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-5 gap-1 text-[9px]">
                <div><p className="text-neutral-500">OLV</p><p className="font-semibold tabular-nums">{formatOdds(row.bookData?.olv.price ?? null)}</p></div>
                <div><p className="text-neutral-500">CLV</p><p className="font-semibold tabular-nums">{formatOdds(row.bookData?.clv.price ?? null)}</p></div>
                <div><p className="text-neutral-500">Current</p><p className="font-semibold tabular-nums">{formatOdds(row.currentDisplayPrice)}</p></div>
                <div><p className="text-neutral-500">Age</p><p className="text-neutral-400">{row.updatedEpoch ? relativeTime(row.updatedEpoch) : "—"}</p></div>
                <div><p className="text-neutral-500">Pts</p><p className="text-neutral-400 tabular-nums">{row.points > 0 ? row.points : "—"}</p></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] min-w-[760px]">
        <thead>
          <tr className="text-neutral-500 border-b border-neutral-200/70 dark:border-neutral-800/70">
            <th className="text-left font-medium py-1.5 pr-3">Book</th>
            <th className="text-right font-medium py-1.5 px-2">OLV</th>
            <th className="text-right font-medium py-1.5 px-2">CLV</th>
            <th className="text-right font-medium py-1.5 px-2">Current</th>
            <th className="text-right font-medium py-1.5 px-2">Move</th>
            <th className="text-right font-medium py-1.5 px-2">Age</th>
            <th className="text-right font-medium py-1.5 pl-2">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isNoHistory = row.bookData && (row.bookData.status !== "ok" || row.points === 0);
            return (
              <tr key={row.bookId} className="border-b border-neutral-100 dark:border-neutral-800/50">
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                    {row.logo && <img src={row.logo} alt="" className="w-4 h-4 object-contain" />}
                    <span className="font-medium truncate">{row.name}</span>
                    {isNoHistory && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10 text-amber-500 dark:text-amber-300 text-[9px] font-semibold">
                        No history
                      </span>
                    )}
                  </div>
                  {row.updatedEpoch && (
                    <div className="text-[10px] text-neutral-500 mt-0.5">{formatAbsoluteTime(row.updatedEpoch)}</div>
                  )}
                </td>
                <td className="text-right tabular-nums py-1.5 px-2 font-semibold">{formatOdds(row.bookData?.olv.price ?? null)}</td>
                <td className="text-right tabular-nums py-1.5 px-2 font-semibold">{formatOdds(row.bookData?.clv.price ?? null)}</td>
                <td className="text-right tabular-nums py-1.5 px-2 font-semibold">{formatOdds(row.currentDisplayPrice)}</td>
                <td className={cn("text-right tabular-nums py-1.5 px-2 font-semibold", classForMove(row.moveValue))}>
                  {formatMove(row.moveValue)}
                </td>
                <td className="text-right py-1.5 px-2 text-neutral-500">{row.updatedEpoch ? relativeTime(row.updatedEpoch) : "—"}</td>
                <td className="text-right tabular-nums py-1.5 pl-2 text-neutral-400">{row.points > 0 ? row.points : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── LineHistoryDialog ─────────────────────────────────────────────── */

export function LineHistoryDialog({ open, onOpenChange, context }: LineHistoryDialogProps) {
  const isMobile = useIsMobile();
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [bookDataById, setBookDataById] = useState<Record<string, LineHistoryBookData>>({});
  const [loadingBookIds, setLoadingBookIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hiddenBookIds, setHiddenBookIds] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("all");
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  const visibleBookIds = useMemo(
    () => selectedBookIds.filter((id) => !hiddenBookIds.has(id)),
    [selectedBookIds, hiddenBookIds]
  );

  const allBookIds = useMemo(() => {
    if (!context) return [];
    const seed = [
      ...(context.allBookIds || []),
      ...(context.bestBookId ? [context.bestBookId] : []),
      ...(context.compareBookIds || []),
    ];
    return Array.from(new Set(seed.filter(Boolean)));
  }, [context]);

  const priorityBookIds = useMemo(() => {
    if (!context) return [];
    return Array.from(
      new Set(
        [context.bestBookId, ...(context.compareBookIds || [])]
          .filter(Boolean)
          .filter((bookId): bookId is string => !!bookId)
      )
    );
  }, [context]);

  const addableBooks = useMemo(() => allBookIds.filter((bookId) => !selectedBookIds.includes(bookId)), [allBookIds, selectedBookIds]);
  const isChartLoading = useMemo(
    () => visibleBookIds.some((bookId) => loadingBookIds.has(bookId) && !bookDataById[bookId]),
    [visibleBookIds, loadingBookIds, bookDataById]
  );
  const noHistoryBooks = useMemo(
    () =>
      selectedBookIds.filter((bookId) => {
        const item = bookDataById[bookId];
        if (!item || loadingBookIds.has(bookId)) return false;
        return item.status !== "ok" || (item.entries?.length || 0) === 0;
      }),
    [selectedBookIds, bookDataById, loadingBookIds]
  );
  const noHistoryBookNames = useMemo(
    () => noHistoryBooks.map((bookId) => getSportsbookById(bookId)?.name || bookId),
    [noHistoryBooks]
  );
  const noHistorySummary = useMemo(() => {
    if (noHistoryBookNames.length === 0) return "";
    if (noHistoryBookNames.length <= 3) return noHistoryBookNames.join(", ");
    return `${noHistoryBookNames.slice(0, 3).join(", ")} +${noHistoryBookNames.length - 3} more`;
  }, [noHistoryBookNames]);

  const fetchBooks = useCallback(
    async (books: string[], options?: { addToSelected?: boolean; silent?: boolean }) => {
      if (!context || books.length === 0) return;

      const targetBooks = Array.from(new Set(books.filter(Boolean)));
      if (targetBooks.length === 0) return;

      setLoadingBookIds((prev) => {
        const next = new Set(prev);
        targetBooks.forEach((bookId) => next.add(bookId));
        return next;
      });
      if (!options?.silent) setErrorMessage(null);

      try {
        const payload: LineHistoryApiRequest = { context, books: targetBooks };
        const response = await fetch("/api/v2/odds/line-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to load line history (${response.status})`);
        }

        const data = (await response.json()) as LineHistoryApiResponse;
        const incoming = Array.isArray(data?.books) ? data.books : [];

        setBookDataById((prev) => {
          const next = { ...prev };
          incoming.forEach((item) => {
            next[item.bookId] = item;
          });
          return next;
        });

        if (options?.addToSelected) {
          setSelectedBookIds((prev) => Array.from(new Set([...prev, ...targetBooks])));
        }
      } catch (error) {
        if (!options?.silent) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load line history.");
        }
      } finally {
        setLoadingBookIds((prev) => {
          const next = new Set(prev);
          targetBooks.forEach((bookId) => next.delete(bookId));
          return next;
        });
      }
    },
    [context]
  );

  useEffect(() => {
    if (!open || !context) return;

    setBookDataById({});
    setErrorMessage(null);
    setHiddenBookIds(new Set());
    setTimeRange("all");
    setMobileDetailsOpen(false);

    const firstBooks = priorityBookIds.length > 0 ? priorityBookIds : allBookIds.slice(0, 1);
    const remaining = allBookIds.filter((bookId) => !firstBooks.includes(bookId));
    const initialSelected = [...firstBooks, ...remaining];
    setSelectedBookIds(initialSelected);

    void fetchBooks(firstBooks, { addToSelected: false });

    if (remaining.length > 0) {
      const timer = window.setTimeout(() => {
        void fetchBooks(remaining, { silent: true });
      }, 250);
      return () => window.clearTimeout(timer);
    }
  }, [open, context, priorityBookIds, allBookIds, fetchBooks]);

  const selectionTitle = useMemo(() => {
    if (!context) return "Line History";
    const selection = context.selectionName || context.playerName || context.team || `${context.awayTeam || ""} @ ${context.homeTeam || ""}`.trim();
    const rawMarket = context.marketDisplay || context.market;
    const market = rawMarket && rawMarket.includes("_") ? formatMarketLabel(rawMarket) : rawMarket;
    return selection ? `${selection} · ${market}` : market;
  }, [context]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-3rem)] lg:max-w-[1200px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-3 sm:px-5 pr-16 sm:pr-24 py-2.5 sm:py-3 border-b border-neutral-200/70 dark:border-neutral-800/70">
          <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 min-w-0">
            <div className="min-w-0">
              <DialogTitle className="text-[18px] sm:text-lg font-semibold tracking-tight">Historical Line Movement</DialogTitle>
              <DialogDescription className="text-[11px] sm:text-sm text-neutral-500 truncate">
                {selectionTitle || "Selection history"}
              </DialogDescription>
            </div>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} className="mr-8 sm:mr-3" />
          </div>
        </DialogHeader>

        <div className="px-3 sm:px-5 py-2.5 sm:py-4 space-y-2.5 sm:space-y-3 max-h-[calc(100vh-7.5rem)] sm:max-h-[calc(100vh-10rem)] overflow-y-auto overflow-x-hidden">
          {errorMessage && (
            <div className="rounded-lg border border-red-300/70 dark:border-red-900/70 bg-red-50/70 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {selectedBookIds.length > 0 && (
            <>
              <BookLegend
                bookIds={selectedBookIds}
                hiddenBookIds={hiddenBookIds}
                loadingBookIds={loadingBookIds}
                isMobile={isMobile}
                onToggle={(bookId) =>
                  setHiddenBookIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(bookId)) next.delete(bookId);
                    else next.add(bookId);
                    return next;
                  })
                }
              />

              <UnifiedLineChart
                bookIds={visibleBookIds}
                bookDataById={bookDataById}
                timeRange={timeRange}
                isLoading={isChartLoading}
                isMobile={isMobile}
              />

              {noHistoryBookNames.length > 0 && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-amber-700 dark:text-amber-300">
                  No historical data for {isMobile ? noHistorySummary : noHistoryBookNames.join(", ")} at this time. Current odds may still be available.
                </div>
              )}

              {isMobile ? (
                <div className="rounded-md border border-neutral-200/70 dark:border-neutral-800/70 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMobileDetailsOpen((prev) => !prev)}
                    className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-semibold text-neutral-300 bg-neutral-900/30"
                  >
                    <span>Book Details (OLV, CLV, Current)</span>
                    {mobileDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {mobileDetailsOpen && (
                    <div className="p-1.5">
                      <StatsTable bookIds={selectedBookIds} bookDataById={bookDataById} isMobile={isMobile} />
                    </div>
                  )}
                </div>
              ) : (
                <StatsTable bookIds={selectedBookIds} bookDataById={bookDataById} isMobile={isMobile} />
              )}
            </>
          )}

          {selectedBookIds.length === 0 && (
            <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800/70 p-5 text-sm text-neutral-500 text-center">
              No books selected for historical lookup.
            </div>
          )}

          {addableBooks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Add Sportsbooks</p>
              <div className="flex flex-wrap gap-2">
                {addableBooks.map((bookId) => {
                  const meta = getSportsbookById(bookId);
                  const name = meta?.name || bookId;
                  const loading = loadingBookIds.has(bookId);
                  return (
                    <button
                      key={bookId}
                      type="button"
                      onClick={() => {
                        if (bookDataById[bookId]) {
                          setSelectedBookIds((prev) => Array.from(new Set([...prev, bookId])));
                          return;
                        }
                        void fetchBooks([bookId], { addToSelected: true });
                      }}
                      disabled={loading}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600",
                        "bg-neutral-50 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300",
                        loading && "opacity-60 cursor-wait"
                      )}
                    >
                      {loading ? `Loading ${name}...` : name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
