"use client";

import { cn } from "@/lib/utils";
import { MlbDateNav } from "@/components/cheat-sheet/mlb-date-nav";

type SortOption = "game-time" | "best-grade";
type FilterOption = "all" | "nrfi" | "yrfi";
type SeasonOption = "2025" | "2023-2025";

interface StickyControlBarProps {
  sort: SortOption;
  filter: FilterOption;
  season: SeasonOption;
  selectedDate: string;
  onSortChange: (sort: SortOption) => void;
  onFilterChange: (filter: FilterOption) => void;
  onSeasonChange: (season: SeasonOption) => void;
  onDateChange: (date: string) => void;
  lastUpdated: string;
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800/60">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap",
            value === opt.value
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-200 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function StickyControlBar({
  sort,
  filter,
  season,
  selectedDate,
  onSortChange,
  onFilterChange,
  onSeasonChange,
  onDateChange,
  lastUpdated,
}: StickyControlBarProps) {
  return (
    <header className="sticky top-[92px] z-30 w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-200/60 dark:border-neutral-700/30">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
        {/* Left: Date nav */}
        <MlbDateNav selectedDate={selectedDate} onDateChange={onDateChange} />

        {/* Center: Controls */}
        <div className="flex items-center gap-2">
          <Seg
            value={sort}
            onChange={onSortChange}
            options={[
              { label: "Game Time", value: "game-time" },
              { label: "Best Grade", value: "best-grade" },
            ]}
          />

          <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-700/30 shrink-0" />

          <Seg
            value={filter}
            onChange={onFilterChange}
            options={[
              { label: "All", value: "all" },
              { label: "NRFI", value: "nrfi" },
              { label: "YRFI", value: "yrfi" },
            ]}
          />

          <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-700/30 shrink-0" />

          <Seg
            value={season}
            onChange={onSeasonChange}
            options={[
              { label: "2025", value: "2025" },
              { label: "3-Year", value: "2023-2025" },
            ]}
          />
        </div>

        {/* Right: Live indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
            {lastUpdated}
          </span>
        </div>
      </div>
    </header>
  );
}
