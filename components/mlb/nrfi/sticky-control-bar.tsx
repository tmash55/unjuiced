"use client";

import { SheetFilterBar, SegmentedControl, FilterDivider } from "@/components/cheat-sheet/sheet-filter-bar";

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
    <SheetFilterBar
      selectedDate={selectedDate}
      onDateChange={onDateChange}
      right={
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
            {lastUpdated}
          </span>
        </div>
      }
    >
      <SegmentedControl
        value={sort}
        onChange={onSortChange}
        options={[
          { label: "Game Time", value: "game-time" },
          { label: "Best Grade", value: "best-grade" },
        ]}
      />
      <FilterDivider />
      <SegmentedControl
        value={filter}
        onChange={onFilterChange}
        options={[
          { label: "All", value: "all" },
          { label: "NRFI", value: "nrfi" },
          { label: "YRFI", value: "yrfi" },
        ]}
      />
      <FilterDivider />
      <SegmentedControl
        value={season}
        onChange={onSeasonChange}
        options={[
          { label: "2025", value: "2025" },
          { label: "3-Year", value: "2023-2025" },
        ]}
      />
    </SheetFilterBar>
  );
}
