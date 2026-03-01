"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";

interface ChartHelpButtonProps {
  canShowEV?: boolean;
  className?: string;
}

export function ChartHelpButton({ canShowEV, className }: ChartHelpButtonProps) {
  return (
    <Tooltip
      content={
        <div className="max-w-[280px] px-3 py-2.5 text-left text-xs text-neutral-700 dark:text-neutral-200 space-y-1.5">
          <div>
            <span className="font-semibold">Lines</span>
            <span className="text-neutral-500 dark:text-neutral-400"> — colored paths show each book&apos;s odds over time.</span>
          </div>
          <div>
            <span className="font-semibold">Diamonds</span>
            <span className="text-neutral-500 dark:text-neutral-400"> — steam moves (sudden sharp odds shifts).</span>
          </div>
          <div>
            <span className="font-semibold">IP %</span>
            <span className="text-neutral-500 dark:text-neutral-400"> — implied probability from American odds.</span>
          </div>
          {canShowEV && (
            <div>
              <span className="font-semibold">EV Overlay</span>
              <span className="text-neutral-500 dark:text-neutral-400"> — green/red shading for +/- expected value.</span>
            </div>
          )}
          <div>
            <span className="font-semibold">Beat CLV</span>
            <span className="text-neutral-500 dark:text-neutral-400"> — whether your line beat closing line value.</span>
          </div>
          <div>
            <span className="font-semibold">Stats</span>
            <span className="text-neutral-500 dark:text-neutral-400"> — Open/High/Low/Current odds range, % Change, and Moves.</span>
          </div>
        </div>
      }
      side="bottom"
    >
      <button
        type="button"
        className={cn(
          "p-1.5 rounded-md border transition-all",
          "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
          className
        )}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}
