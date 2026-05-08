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
  "player_double_double",
  "player_triple_double",
  // 1Q props — keep PTS / REB / AST order matching the regulation set above
  "1st_quarter_player_points",
  "1st_quarter_player_rebounds",
  "1st_quarter_player_assists",
];

const marketSortKey = (market: string): number => {
  const idx = MARKET_ORDER.indexOf(market);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
};

// Compact market tabs — text-only with an underline indicator on active. Sized
// to read like a sub-nav rather than a card UI: minimal chrome, tight rhythm,
// horizontally scrollable when the slate has more markets than fit. Active tab
// auto-scrolls into view after deep-links or programmatic switches.
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
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent dark:from-neutral-950" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent dark:from-neutral-950" />

      <div
        role="tablist"
        aria-label="Player market"
        className="flex items-end gap-5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                "shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-2 pt-2 text-[13px] font-semibold tracking-tight transition-colors",
                active
                  ? "border-brand text-neutral-900 dark:text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
              )}
            >
              {formatMarketLabel(item.market)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
