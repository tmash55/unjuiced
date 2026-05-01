"use client";

import { cn } from "@/lib/utils";

type SortOption = "game-time" | "best-grade";
type FilterOption = "all" | "nrfi" | "yrfi";
type SeasonOption = "2025" | "2023-2025";

interface StickyControlBarProps {
  sort: SortOption;
  filter: FilterOption;
  season: SeasonOption;
  onSortChange: (sort: SortOption) => void;
  onFilterChange: (filter: FilterOption) => void;
  onSeasonChange: (season: SeasonOption) => void;
  lastUpdated: string;
  slateDate: string;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium shrink-0">
        {label}
      </span>
      <div className="flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-all duration-150 cursor-pointer whitespace-nowrap",
              value === opt.value
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StickyControlBar({
  sort,
  filter,
  season,
  onSortChange,
  onFilterChange,
  onSeasonChange,
  lastUpdated,
  slateDate,
}: StickyControlBarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Left: Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-foreground">
              NRFI
            </span>
            <span className="text-base font-light text-muted-foreground">
              Cheat Sheet
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-medium text-muted-foreground">
            {slateDate}
          </span>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-4">
          <SegmentedControl
            label="Sort"
            value={sort}
            onChange={onSortChange}
            options={[
              { label: "Game Time", value: "game-time" },
              { label: "Best Grade", value: "best-grade" },
            ]}
          />
          <div className="h-4 w-px bg-border" />
          <SegmentedControl
            label="Filter"
            value={filter}
            onChange={onFilterChange}
            options={[
              { label: "All Games", value: "all" },
              { label: "NRFI Leans", value: "nrfi" },
              { label: "YRFI Leans", value: "yrfi" },
            ]}
          />
          <div className="h-4 w-px bg-border" />
          <SegmentedControl
            label="Sample"
            value={season}
            onChange={onSeasonChange}
            options={[
              { label: "2025", value: "2025" },
              { label: "2023–2025", value: "2023-2025" },
            ]}
          />
        </div>

        {/* Right: Meta */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-nrfi-green animate-pulse" />
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdated}
          </span>
        </div>
      </div>
    </header>
  );
}
