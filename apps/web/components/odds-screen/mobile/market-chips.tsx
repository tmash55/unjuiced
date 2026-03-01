"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { PRIMARY_GAME_MARKETS, PRIMARY_MARKETS, SECONDARY_GAME_MARKETS, SECONDARY_MARKETS } from "../odds-navigation";

interface MarketChipsProps {
  sport: string;
  type: "game" | "player";
  selectedMarket: string;
  onMarketChange: (market: string) => void;
}

const toChips = (tabs: Array<{ apiKey: string; label: string }>): Array<{ apiKey: string; label: string }> => {
  const seen = new Set<string>();
  const chips: Array<{ apiKey: string; label: string }> = [];
  for (const tab of tabs) {
    if (!tab.apiKey || seen.has(tab.apiKey)) {
      continue;
    }
    seen.add(tab.apiKey);
    chips.push({ apiKey: tab.apiKey, label: tab.label });
  }
  return chips;
};

const SPORT_KEYS = Array.from(
  new Set([
    ...Object.keys(PRIMARY_GAME_MARKETS),
    ...Object.keys(SECONDARY_GAME_MARKETS),
    ...Object.keys(PRIMARY_MARKETS),
    ...Object.keys(SECONDARY_MARKETS),
  ])
);

const ALL_MARKETS: Record<string, Record<"game" | "player", { apiKey: string; label: string }[]>> = SPORT_KEYS.reduce(
  (acc, sport) => {
    acc[sport] = {
      game: toChips([...(PRIMARY_GAME_MARKETS[sport] || []), ...(SECONDARY_GAME_MARKETS[sport] || [])]),
      player: toChips([...(PRIMARY_MARKETS[sport] || []), ...(SECONDARY_MARKETS[sport] || [])]),
    };
    return acc;
  },
  {} as Record<string, Record<"game" | "player", { apiKey: string; label: string }[]>>
);

export function MarketChips({ sport, type, selectedMarket, onMarketChange }: MarketChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Get markets for this sport and type
  const markets = useMemo(() => {
    const sportKey = sport.toLowerCase();
    return ALL_MARKETS[sportKey]?.[type] || [];
  }, [sport, type]);

  // Scroll selected market into view
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [selectedMarket]);

  if (markets.length === 0) {
    return null;
  }

  return (
    <div 
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4"
    >
      {markets.map((market) => {
        const isSelected = selectedMarket === market.apiKey;
        return (
          <button
            key={market.apiKey}
            ref={isSelected ? selectedRef : null}
            onClick={() => onMarketChange(market.apiKey)}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap active:scale-[0.95]",
              isSelected
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            )}
          >
            {market.label}
          </button>
        );
      })}
    </div>
  );
}

// Export helper to get default market for a type
export function getDefaultMarketForType(sport: string, type: "game" | "player"): string {
  const sportKey = sport.toLowerCase();
  const markets = ALL_MARKETS[sportKey]?.[type] || [];
  return markets[0]?.apiKey || "game_moneyline";
}
