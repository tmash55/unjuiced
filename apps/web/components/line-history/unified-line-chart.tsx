"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  getContrastColor,
  computePriceTicks,
  computeTimeTicks,
  formatChartTimestamp,
  formatOdds,
  getPriceAtTime,
  detectSteamMoves,
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

  const steamMarkerSize = isMobile ? 4.5 : 6;

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full h-auto rounded-lg border border-neutral-200/70 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#0d1117]"
        preserveAspectRatio="xMidYMid meet"
      >
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
            className="text-neutral-200/80 dark:text-neutral-800/80"
            strokeWidth="0.6"
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
            className="text-neutral-200/80 dark:text-neutral-800/80"
            strokeWidth="0.6"
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
              strokeWidth="1"
              opacity={0.85}
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
              className="text-neutral-400 dark:text-neutral-500"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            {hoverData.prices.map((p) => (
              <circle key={p.bookId} cx={hoverData.svgX} cy={toY(p.price)} r="4" fill={p.color} stroke="#0d1117" strokeWidth="1.5" />
            ))}
          </>
        )}
      </svg>

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
