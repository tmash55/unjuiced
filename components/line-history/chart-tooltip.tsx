"use client";

import { cn } from "@/lib/utils";
import { formatOdds, relativeTime, formatImpliedProb, rgbaColor } from "@/lib/line-history/utils";
import type { HoverData, EVTimelinePoint } from "@/lib/line-history/types";
import { formatEV } from "@/lib/ev/devig";

interface ChartTooltipProps {
  data: HoverData;
  containerRect: DOMRect;
  svgWidth: number;
  isMobile: boolean;
  evTimeline?: EVTimelinePoint[];
  showEV?: boolean;
}

export function ChartTooltip({
  data,
  containerRect,
  svgWidth,
  isMobile,
  evTimeline,
  showEV,
}: ChartTooltipProps) {
  const pixelX = (data.svgX / svgWidth) * containerRect.width;
  const tooltipWidth = isMobile ? 196 : 224;
  const flipped = pixelX > containerRect.width - tooltipWidth - 20;
  const left = flipped ? pixelX - tooltipWidth - 12 : pixelX + 12;

  const d = new Date(data.timestamp);
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  // Sort by price descending (most positive first)
  const sorted = [...data.prices].sort((a, b) => b.price - a.price);

  // Find EV at this timestamp (nearest point before timestamp)
  let evAtTimestamp: EVTimelinePoint | null = null;
  if (showEV && evTimeline && evTimeline.length > 0) {
    for (const pt of evTimeline) {
      if (pt.timestamp <= data.timestamp) evAtTimestamp = pt;
      else break;
    }
  }

  return (
    <div
      className="absolute top-2 z-50 pointer-events-none"
      style={{ left: Math.max(4, Math.min(left, containerRect.width - tooltipWidth - 4)) }}
    >
      <div className="min-w-[196px] rounded-2xl border border-slate-700/80 bg-[linear-gradient(180deg,rgba(10,16,24,0.96),rgba(4,8,14,0.94))] px-3 py-2.5 text-white shadow-[0_24px_60px_-24px_rgba(2,6,23,0.9)] backdrop-blur-md">
        <div className="mb-2 flex items-start justify-between gap-3 border-b border-slate-700/70 pb-2">
          <div className="min-w-0">
            <div className={cn("font-semibold tabular-nums tracking-tight text-slate-100", isMobile ? "text-[11px]" : "text-xs")}>
              {timeStr}
            </div>
            <div className="text-[10px] text-slate-400">{dateStr}</div>
          </div>
          <span className="rounded-full border border-slate-700 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            {relativeTime(data.timestamp)}
          </span>
        </div>

        <div className="space-y-1">
          {sorted.map((row) => {
            const impliedProb = formatImpliedProb(row.price);
            return (
              <div
                key={row.bookId}
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.045] px-2 py-1.5"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: row.color, boxShadow: `0 0 0 4px ${rgbaColor(row.color, 0.16)}` }}
                />
                {row.logo ? (
                  <img src={row.logo} alt="" className="h-4 w-4 object-contain shrink-0" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-medium text-slate-200">{row.name}</div>
                  {impliedProb && <div className="text-[9px] tabular-nums text-slate-400">IP {impliedProb}</div>}
                </div>
                <span
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold tabular-nums"
                  style={{ backgroundColor: rgbaColor(row.color, 0.14), color: row.tooltipColor }}
                >
                  {formatOdds(row.price)}
                </span>
              </div>
            );
          })}
        </div>

        {evAtTimestamp && (
          <div
            className={cn(
              "mt-2 rounded-xl border px-2.5 py-2 text-[10px] font-semibold tabular-nums",
              evAtTimestamp.ev >= 0
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/25 bg-rose-500/10 text-rose-300"
            )}
          >
            EV {formatEV(evAtTimestamp.ev)} · Fair {(evAtTimestamp.fairProb * 100).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}
