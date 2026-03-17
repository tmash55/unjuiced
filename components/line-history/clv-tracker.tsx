"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { computeCLV, detectReverseLineMovement } from "@/lib/line-history/utils";
import type { LineHistoryBookData } from "@/lib/odds/line-history";
import { SHARP_BOOKS } from "@/lib/ev/constants";

const SHARP_BOOK_IDS = Object.keys(SHARP_BOOKS);

interface CLVTrackerProps {
  bestBookData: LineHistoryBookData | undefined;
  bookDataById: Record<string, LineHistoryBookData>;
  compareBookIds: string[];
  isMobile: boolean;
}

export function CLVTracker({ bestBookData, bookDataById, compareBookIds, isMobile }: CLVTrackerProps) {
  const clvResult = useMemo(() => {
    if (!bestBookData) return null;
    return computeCLV(bestBookData);
  }, [bestBookData]);

  const reverseLineMovement = useMemo(() => {
    if (!bestBookData?.entries?.length) return false;
    const sharpIds = compareBookIds.filter((id) => SHARP_BOOK_IDS.includes(id));
    for (const sharpId of sharpIds) {
      const sharpData = bookDataById[sharpId];
      if (!sharpData?.entries?.length) continue;
      if (detectReverseLineMovement(sharpData.entries, bestBookData.entries)) return true;
    }
    return false;
  }, [bestBookData, bookDataById, compareBookIds]);

  if (!clvResult && !reverseLineMovement) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", isMobile ? "text-[10px]" : "text-[11px]")}>
      {clvResult && (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border shadow-sm",
            clvResult.beatCLV
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300"
          )}
        >
          {clvResult.beatCLV ? "Beat CLV" : "CLV moved against"} by {Math.abs(Math.round(clvResult.delta))}
        </span>
      )}
      {reverseLineMovement && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300 shadow-sm">
          Reverse line movement detected
        </span>
      )}
    </div>
  );
}
