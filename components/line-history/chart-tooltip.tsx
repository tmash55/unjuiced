"use client";

import { cn } from "@/lib/utils";
import { formatOdds, relativeTime, formatImpliedProb } from "@/lib/line-history/utils";
import type { HoverData, EVTimelinePoint } from "@/lib/line-history/types";
import { formatEV } from "@/lib/ev/devig";
import { getPriceAtTime } from "@/lib/line-history/utils";

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
  const tooltipWidth = isMobile ? 170 : 200;
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
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/95 backdrop-blur-sm shadow-xl text-white px-2.5 py-2 min-w-[170px]">
        <div className="flex items-baseline gap-2 mb-1.5 border-b border-neutral-700/60 pb-1.5">
          <span className={cn("font-semibold tabular-nums", isMobile ? "text-[10px]" : "text-[11px]")}>{timeStr}</span>
          <span className={cn("text-neutral-400", isMobile ? "text-[9px]" : "text-[10px]")}>{relativeTime(data.timestamp)}</span>
        </div>
        <div className="space-y-0.5">
          {sorted.map((row) => {
            const impliedProb = formatImpliedProb(row.price);
            return (
              <div key={row.bookId} className="flex items-center gap-1.5 text-[11px]">
                <span className="font-extrabold tabular-nums min-w-[42px] text-[12px]" style={{ color: row.tooltipColor }}>
                  {formatOdds(row.price)}
                </span>
                {impliedProb && (
                  <span className="text-neutral-400 tabular-nums text-[10px] min-w-[36px]" title="Implied probability">
                    IP {impliedProb}
                  </span>
                )}
                {row.logo ? (
                  <img src={row.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded shrink-0" style={{ backgroundColor: row.color, opacity: 0.5 }} />
                )}
                <span className="text-neutral-200 truncate text-[10px]">{row.name}</span>
              </div>
            );
          })}
        </div>
        {evAtTimestamp && (
          <div className={cn(
            "mt-1.5 pt-1 border-t border-neutral-700/60 text-[10px] font-semibold tabular-nums",
            evAtTimestamp.ev >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            EV: {formatEV(evAtTimestamp.ev)} · Fair: {(evAtTimestamp.fairProb * 100).toFixed(1)}%
          </div>
        )}
        <div className="text-[9px] text-neutral-500 mt-1.5 pt-1 border-t border-neutral-700/60">{dateStr}</div>
      </div>
    </div>
  );
}
