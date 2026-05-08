"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TileProps {
  /** Small uppercase label that sits in the top of the tile. */
  label?: React.ReactNode;
  /** Optional content rendered to the right of the label (counts, badges, toggles). */
  headerRight?: React.ReactNode;
  /** Optional row that renders ABOVE the label/headerRight strip — used to bake
   *  a richer header (player identity, matchup, line, odds) into the same card
   *  as the body. Renders with its own bottom hairline. */
  topSlot?: React.ReactNode;
  /** Tailwind grid class — span control comes from the parent grid. */
  className?: string;
  /** Body content. Pass `padded={false}` if you need to handle padding yourself. */
  children: React.ReactNode;
  /** Defaults to true. Pass false when the body should bleed to the card edges
   *  (e.g. an edge-to-edge bar chart). */
  padded?: boolean;
}

// Shared card chrome — matches the hit-rate table card treatment so the bento
// grid feels like one product family. All bento tiles render through this so
// any future visual tweak (e.g. ring color, shadow scale) lands consistently.
export function Tile({
  label,
  headerRight,
  topSlot,
  className,
  children,
  padded = true,
}: TileProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/80 shadow-sm ring-1 ring-black/[0.03] dark:border-neutral-800/70 dark:bg-neutral-900/60 dark:ring-white/[0.03]",
        className
      )}
    >
      {topSlot && (
        <div className="border-b border-neutral-200/60 px-4 py-3 dark:border-neutral-800/60">
          {topSlot}
        </div>
      )}
      {(label || headerRight) && (
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200/60 px-4 py-2 dark:border-neutral-800/60">
          {label ? (
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
              {label}
            </span>
          ) : (
            <span />
          )}
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      <div className={cn("flex-1", padded && "p-4")}>{children}</div>
    </div>
  );
}
