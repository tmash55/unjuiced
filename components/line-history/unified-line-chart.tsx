"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  getContrastColor,
  rgbaColor,
  computePriceTicks,
  computeTimeTicks,
  formatChartTimestamp,
  formatOdds,
  getPriceAtTime,
  detectSteamMoves,
  computeMoveValue,
  classForMove,
} from "@/lib/line-history/utils";
import { TIME_RANGES, type TimeRangeKey, type ChartDataset, type HoverData, type SteamMove, type EVTimelinePoint } from "@/lib/line-history/types";
import { PremiumLogo } from "@/components/common/loading-state";
import { ChartTooltip } from "./chart-tooltip";
import type { LineHistoryBookData } from "@/lib/odds/line-history";

interface UnifiedLineChartProps {
  bookIds: string[];
  bookDataById: Record<string, LineHistoryBookData>;
  timeRange: TimeRangeKey;
  isLoading: boolean;
  isMobile: boolean;
  evTimeline?: EVTimelinePoint[];
  showEV?: boolean;
  showSteamMoves?: boolean;
  chartRef?: React.RefObject<HTMLDivElement | null>;
}

export function UnifiedLineChart({
  bookIds,
  bookDataById,
  timeRange,
  isLoading,
  isMobile,
  evTimeline,
  showEV,
  showSteamMoves = true,
  chartRef: externalChartRef,
}: UnifiedLineChartProps) {
  const W = isMobile ? 760 : 900;
  const H = isMobile ? 350 : 400;
  const PAD = isMobile ? { top: 18, right: 56, bottom: 30, left: 16 } : { top: 20, right: 56, bottom: 36, left: 12 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalChartRef || internalRef;
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
          fillColor: rgbaColor(getContrastColor(rawColor, "#0d1117", 2.8), 0.18),
          glowColor: rgbaColor(getContrastColor(rawColor, "#0d1117", 2.8), 0.34),
          name: meta?.name || bookId,
          logo: meta?.image?.square || meta?.image?.light || null,
        };
      })
      .filter((d) => d.entries.length > 0);
  }, [bookIds, bookDataById]);

  // Apply time range filter — carry forward last known price before cutoff
  const filteredDatasets = useMemo(() => {
    const rangeConfig = TIME_RANGES.find((r) => r.key === timeRange);
    if (!rangeConfig || rangeConfig.ms === 0) return datasets;
    const cutoff = Date.now() - rangeConfig.ms;
    return datasets
      .map((ds) => {
        const after = ds.entries.filter((pt) => pt.timestamp >= cutoff);
        // Find the last entry before cutoff to anchor the line
        const before = ds.entries.filter((pt) => pt.timestamp < cutoff);
        if (before.length > 0 && (after.length === 0 || after[0].timestamp > cutoff)) {
          const anchor = { ...before[before.length - 1], timestamp: cutoff };
          return { ...ds, entries: [anchor, ...after] };
        }
        return { ...ds, entries: after };
      })
      .filter((ds) => ds.entries.length > 0);
  }, [datasets, timeRange]);

  // Detect steam moves across all visible datasets
  const steamMoves = useMemo(() => {
    if (!showSteamMoves) return [];
    const allMoves: SteamMove[] = [];
    for (const ds of filteredDatasets) {
      allMoves.push(...detectSteamMoves(ds.entries, ds.bookId));
    }
    return allMoves;
  }, [filteredDatasets, showSteamMoves]);

  const { minPrice, maxPrice, minTs, maxTs } = useMemo(() => {
    let mnP = Infinity,
      mxP = -Infinity,
      mnT = Infinity,
      mxT = -Infinity;
    for (const ds of filteredDatasets) {
      for (const pt of ds.entries) {
        if (pt.price < mnP) mnP = pt.price;
        if (pt.price > mxP) mxP = pt.price;
        if (pt.timestamp < mnT) mnT = pt.timestamp;
        if (pt.timestamp > mxT) mxT = pt.timestamp;
      }
    }
    if (!isFinite(mnP)) {
      mnP = -110;
      mxP = -100;
      mnT = Date.now() - 3600_000;
      mxT = Date.now();
    }
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = (containerRef as React.RefObject<HTMLDivElement>).current?.getBoundingClientRect();
      if (!rect) return;
      setContainerRect(rect);

      const relX = e.clientX - rect.left;
      const svgX = (relX / rect.width) * W;

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
    },
    [filteredDatasets, fromX, containerRef]
  );

  const handleMouseLeave = useCallback(() => setHoverData(null), []);

  // Build EV overlay rectangles
  const evRects = useMemo(() => {
    if (!showEV || !evTimeline || evTimeline.length < 2) return [];
    const rects: { x: number; width: number; ev: number }[] = [];
    for (let i = 0; i < evTimeline.length; i++) {
      const pt = evTimeline[i];
      const nextTs = i < evTimeline.length - 1 ? evTimeline[i + 1].timestamp : maxTs;
      const x = toX(Math.max(pt.timestamp, minTs));
      const x2 = toX(Math.min(nextTs, maxTs));
      if (x2 <= x) continue;
      rects.push({ x, width: x2 - x, ev: pt.ev });
    }
    return rects;
  }, [showEV, evTimeline, minTs, maxTs, toX]);

  const latestSnapshots = useMemo(() => {
    return filteredDatasets
      .map((ds) => {
        const first = ds.entries[0];
        const last = ds.entries[ds.entries.length - 1];
        const move = computeMoveValue(first?.price, last?.price);
        return {
          bookId: ds.bookId,
          name: ds.name,
          color: ds.color,
          currentPrice: last?.price ?? null,
          move,
        };
      })
      .filter((item) => item.currentPrice != null);
  }, [filteredDatasets]);

  if (isLoading && filteredDatasets.length === 0) {
    return (
      <div className="h-[300px] rounded-[22px] border border-neutral-200/80 dark:border-neutral-800/80 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(244,247,250,0.92))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_42%),linear-gradient(180deg,_rgba(9,14,20,0.96),_rgba(13,17,23,0.94))] flex items-center justify-center shadow-[0_20px_60px_-28px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col items-center gap-3">
          <PremiumLogo size={34} />
          <span className="text-xs text-neutral-500">Loading line history...</span>
        </div>
      </div>
    );
  }

  if (filteredDatasets.length === 0) {
    return (
      <div className="h-[300px] rounded-[22px] border border-neutral-200/80 dark:border-neutral-800/80 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.95),_rgba(244,247,250,0.92))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_42%),linear-gradient(180deg,_rgba(9,14,20,0.96),_rgba(13,17,23,0.94))] flex items-center justify-center text-xs text-neutral-500 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.45)]">
        No line history available for this time range
      </div>
    );
  }

  const steamMarkerSize = isMobile ? 4.5 : 6;

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full h-auto rounded-[22px] border border-neutral-200/80 dark:border-neutral-800/80 bg-transparent shadow-[0_24px_70px_-34px_rgba(15,23,42,0.6)]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="line-history-shell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#f1f5f9" stopOpacity="0.96" />
          </linearGradient>
          <linearGradient id="line-history-shell-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c121a" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#080c12" stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id="line-history-plot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.64" />
          </linearGradient>
          <linearGradient id="line-history-plot-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#060b12" stopOpacity="0.45" />
          </linearGradient>
          {filteredDatasets.map((ds) => {
            const gradientId = `line-history-fill-${ds.bookId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
            return (
              <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ds.color} stopOpacity="0.34" />
                <stop offset="58%" stopColor={ds.color} stopOpacity="0.12" />
                <stop offset="100%" stopColor={ds.color} stopOpacity="0" />
              </linearGradient>
            );
          })}
        </defs>

        <rect x="0" y="0" width={W} height={H} rx="24" fill="url(#line-history-shell)" className="dark:hidden" />
        <rect x="0" y="0" width={W} height={H} rx="24" fill="url(#line-history-shell-dark)" className="hidden dark:block" />
        <rect
          x={PAD.left - 4}
          y={PAD.top - 6}
          width={plotW + 8}
          height={plotH + 12}
          rx="18"
          fill="url(#line-history-plot)"
          stroke="rgba(148,163,184,0.16)"
          className="dark:hidden"
        />
        <rect
          x={PAD.left - 4}
          y={PAD.top - 6}
          width={plotW + 8}
          height={plotH + 12}
          rx="18"
          fill="url(#line-history-plot-dark)"
          stroke="rgba(148,163,184,0.14)"
          className="hidden dark:block"
        />

        {/* EV overlay background bands — rendered before grid for subtle wash */}
        {evRects.map((rect, i) => {
          const absEV = Math.abs(rect.ev);
          const opacity = Math.max(0.08, Math.min(absEV / 20, 0.35));
          const fill = rect.ev >= 0 ? "#22c55e" : "#ef4444";
          return (
            <rect
              key={`ev-${i}`}
              x={rect.x}
              y={PAD.top}
              width={rect.width}
              height={plotH}
              fill={fill}
              opacity={opacity}
            />
          );
        })}

        {/* vertical grid lines */}
        {displayTimeTicks.map((ts) => (
          <line
            key={`v-${ts}`}
            x1={toX(ts)}
            y1={PAD.top}
            x2={toX(ts)}
            y2={H - PAD.bottom}
            stroke="currentColor"
            className="text-slate-200/85 dark:text-slate-800/80"
            strokeWidth="0.7"
            strokeDasharray="3 8"
          />
        ))}

        {/* horizontal grid lines */}
        {priceTicks.map((tick) => (
          <line
            key={`g-${tick}`}
            x1={PAD.left}
            y1={toY(tick)}
            x2={W - PAD.right}
            y2={toY(tick)}
            stroke="currentColor"
            className="text-slate-200/85 dark:text-slate-800/80"
            strokeWidth="0.7"
          />
        ))}

        {/* Y-axis labels (right) */}
        {displayPriceTicks.map((tick) => (
          <text
            key={`y-${tick}`}
            x={W - PAD.right + 6}
            y={toY(tick)}
            dominantBaseline="middle"
            textAnchor="start"
            fill="currentColor"
            className="text-neutral-500 dark:text-neutral-400"
            fontSize={isMobile ? "9" : "10"}
            fontFamily="inherit"
          >
            {formatOdds(tick)}
          </text>
        ))}

        {/* X-axis labels (bottom) */}
        {displayTimeTicks.map((ts) => (
          <text
            key={`x-${ts}`}
            x={toX(ts)}
            y={H - 6}
            textAnchor="middle"
            fill="currentColor"
            className="text-neutral-500 dark:text-neutral-400"
            fontSize={isMobile ? "9" : "9"}
            fontFamily="inherit"
          >
            {formatChartTimestamp(ts, timeRange_)}
          </text>
        ))}

        {/* step-line paths + soft area fills */}
        {filteredDatasets.map((ds) => {
          const pts = ds.entries;
          if (pts.length === 0) return null;
          const startX = toX(pts[0].timestamp);
          const endX = W - PAD.right;
          const startY = toY(pts[0].price);
          const endY = toY(pts[pts.length - 1].price);
          const gradientId = `line-history-fill-${ds.bookId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

          let d = `M${startX},${startY}`;
          for (let i = 1; i < pts.length; i++) {
            d += ` H${toX(pts[i].timestamp)} V${toY(pts[i].price)}`;
          }
          d += ` H${endX}`;
          const areaPath = `${d} V${H - PAD.bottom} H${startX} Z`;

          return (
            <g key={ds.bookId}>
              <path d={areaPath} fill={`url(#${gradientId})`} opacity={0.9} />
              <path d={d} fill="none" stroke={ds.glowColor} strokeWidth="7" strokeLinecap="round" opacity={0.65} />
              <path d={d} fill="none" stroke={ds.color} strokeWidth="2.35" strokeLinecap="round" opacity={0.98} />
              <circle cx={startX} cy={startY} r={2.5} fill="#ffffff" stroke={rgbaColor(ds.color, 0.72)} strokeWidth="1.4" opacity={0.95} />
              <circle cx={endX} cy={endY} r={5.4} fill={ds.color} stroke="#08121b" strokeWidth="2" />
              <circle cx={endX} cy={endY} r={2.2} fill="#f8fafc" opacity={0.95} />
            </g>
          );
        })}

        {/* Steam move diamond markers */}
        {steamMoves.map((move, i) => {
          const cx = toX(move.timestamp);
          const cy = toY(move.price);
          const s = steamMarkerSize;
          const fill = move.direction === "up" ? "#22c55e" : "#ef4444";
          return (
            <polygon
              key={`steam-${i}`}
              points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
              fill={fill}
              stroke="#0d1117"
              strokeWidth="1.2"
              opacity={0.92}
            />
          );
        })}

        {/* hover crosshair */}
        {hoverData && (
          <>
            <line
              x1={hoverData.svgX}
              y1={PAD.top}
              x2={hoverData.svgX}
              y2={H - PAD.bottom}
              stroke="currentColor"
              className="text-slate-400/90 dark:text-slate-500/90"
              strokeWidth="1.1"
              strokeDasharray="4,4"
            />
            {hoverData.prices.map((p) => (
              <g key={p.bookId}>
                <circle cx={hoverData.svgX} cy={toY(p.price)} r="6.2" fill={rgbaColor(p.color, 0.2)} />
                <circle cx={hoverData.svgX} cy={toY(p.price)} r="4.3" fill={p.color} stroke="#0d1117" strokeWidth="1.5" />
                <circle cx={hoverData.svgX} cy={toY(p.price)} r="1.9" fill="#f8fafc" opacity={0.92} />
              </g>
            ))}
          </>
        )}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {latestSnapshots.slice(0, isMobile ? 3 : 4).map((item) => (
          <div
            key={item.bookId}
            className="flex items-center gap-2 rounded-full border border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-950/70 px-3 py-1.5 shadow-sm backdrop-blur"
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color, boxShadow: `0 0 0 4px ${rgbaColor(item.color, 0.14)}` }} />
            <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">{item.name}</span>
            <span className="text-[11px] font-semibold tabular-nums text-neutral-900 dark:text-white">{formatOdds(item.currentPrice)}</span>
            <span className={`text-[11px] font-semibold tabular-nums ${classForMove(item.move)}`}>
              {item.move == null ? "—" : item.move === 0 ? "Flat" : `${item.move > 0 ? "+" : ""}${Math.round(item.move)}`}
            </span>
          </div>
        ))}
        {latestSnapshots.length > (isMobile ? 3 : 4) && (
          <div className="rounded-full border border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-950/60 px-3 py-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            +{latestSnapshots.length - (isMobile ? 3 : 4)} more books
          </div>
        )}
      </div>

      {/* HTML tooltip overlay */}
      {hoverData && containerRect && (
        <ChartTooltip
          data={hoverData}
          containerRect={containerRect}
          svgWidth={W}
          isMobile={isMobile}
          evTimeline={evTimeline}
          showEV={showEV}
        />
      )}
    </div>
  );
}
