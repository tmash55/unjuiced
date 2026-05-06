"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";

interface MarketScrollerProps {
  profiles: HitRateProfile[];
  selectedMarket: string;
  onMarketChange: (market: string) => void;
}

// Canonical market order — mirrors props.cash conventions so users coming from
// other tools find what they expect first. Anything not listed here drops to the
// end in alphabetical order.
const MARKET_ORDER: string[] = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes_made",
  "player_points_rebounds_assists", // PRA
  "player_points_assists",          // PA
  "player_points_rebounds",         // PR
  "player_rebounds_assists",        // RA
  "player_steals",
  "player_blocks",
  "player_blocks_steals",
  "player_turnovers",
];

const marketSortKey = (market: string): number => {
  const idx = MARKET_ORDER.indexOf(market);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
};

// Horizontal scrollable market navigation. Each pill shows the market label and
// the player's current line for that market. Active pill is brand-tinted; hover
// gives a subtle scale-up for tactile feedback. The active pill auto-scrolls into
// view when the selected market changes — keeps it visible after deep-link or
// programmatic switches.
export function MarketScroller({
  profiles,
  selectedMarket,
  onMarketChange,
}: MarketScrollerProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Dedupe markets across profiles, then sort to canonical props.cash order.
  const seen = new Set<string>();
  const items = profiles
    .filter((p) => {
      if (seen.has(p.market)) return false;
      seen.add(p.market);
      return true;
    })
    .sort((a, b) => {
      const order = marketSortKey(a.market) - marketSortKey(b.market);
      if (order !== 0) return order;
      // Tiebreaker for unknown markets: alphabetical by label
      return formatMarketLabel(a.market).localeCompare(formatMarketLabel(b.market));
    });

  // Auto-scroll the active pill into view when the selection changes.
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedMarket]);

  return (
    <div className="relative">
      {/* Edge fades hint at horizontal overflow without a scrollbar */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white to-transparent dark:from-neutral-950" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-white to-transparent dark:from-neutral-950" />

      <div
        role="tablist"
        aria-label="Player market"
        className="flex items-center gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.market === selectedMarket;
          return (
            <button
              key={item.market}
              ref={active ? activeRef : null}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onMarketChange(item.market)}
              className={cn(
                "group relative shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-tight transition-all duration-200",
                active
                  ? "bg-brand text-neutral-950 shadow-sm shadow-brand/30 ring-1 ring-brand/50"
                  : "bg-neutral-100 text-neutral-600 ring-1 ring-transparent hover:scale-[1.03] hover:bg-neutral-200 hover:text-neutral-900 hover:shadow-sm dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              )}
            >
              <span>{formatMarketLabel(item.market)}</span>
              {item.line !== null && item.line !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-black tabular-nums leading-none",
                    active
                      ? "bg-neutral-950/15 text-neutral-950"
                      : "bg-neutral-200/70 text-neutral-500 group-hover:bg-neutral-300/70 dark:bg-neutral-700/60 dark:text-neutral-400 dark:group-hover:bg-neutral-700"
                  )}
                >
                  {item.line}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
