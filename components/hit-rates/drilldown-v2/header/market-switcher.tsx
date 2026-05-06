"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";

interface MarketSwitcherProps {
  profiles: HitRateProfile[];
  selectedMarket: string;
  onMarketChange: (market: string) => void;
}

// Market dropdown for the drilldown header. Lists every market we have a hit-rate
// profile for on this player; selecting one drives the rest of the page.
export function MarketSwitcher({
  profiles,
  selectedMarket,
  onMarketChange,
}: MarketSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Dedupe markets across profiles (one profile per market expected, but be safe)
  const seen = new Set<string>();
  const options = profiles
    .filter((p) => {
      if (seen.has(p.market)) return false;
      seen.add(p.market);
      return true;
    })
    .map((p) => ({
      value: p.market,
      label: formatMarketLabel(p.market),
      line: p.line,
    }));

  const current = options.find((o) => o.value === selectedMarket) ?? options[0];

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left transition-all duration-200",
          "bg-white shadow-sm ring-1 ring-black/[0.04] hover:shadow-md dark:bg-neutral-800/90 dark:ring-white/[0.04]",
          "border border-neutral-200/80 dark:border-neutral-700/80",
          open && "ring-2 ring-brand/30 border-brand/50"
        )}
      >
        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
          {current?.label ?? "Select market"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200",
            open && "rotate-180 text-brand"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[220px] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:ring-white/5">
          <div className="max-h-[320px] overflow-y-auto py-1">
            {options.map((opt) => {
              const active = opt.value === selectedMarket;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onMarketChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors",
                    active
                      ? "bg-brand/10 text-brand"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm",
                      active
                        ? "font-bold text-brand"
                        : "font-medium text-neutral-900 dark:text-neutral-100"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="flex items-center gap-2">
                    {opt.line !== null && opt.line !== undefined && (
                      <span className="text-[11px] font-bold tabular-nums text-neutral-400 dark:text-neutral-500">
                        {opt.line}
                      </span>
                    )}
                    {active && <Check className="h-4 w-4 text-brand" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
