import { cn } from "@/lib/utils";
import { Filter, Calendar, LayoutGrid, Zap, TrendingUp, BarChart3, ChevronDown } from "lucide-react";

// Types
export type DvpViewMode = "basic" | "advanced" | "combo" | "trends";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";

interface DvpFiltersProps {
  position: Position;
  onPositionChange: (pos: Position) => void;
  viewMode: DvpViewMode;
  onViewModeChange: (mode: DvpViewMode) => void;
  season: string;
  onSeasonChange: (season: string) => void;
}

const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

const VIEW_MODES: { value: DvpViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "basic", label: "Basic", icon: <LayoutGrid className="w-4 h-4" /> },
  { value: "advanced", label: "Advanced", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "combo", label: "Combo", icon: <Zap className="w-4 h-4" /> },
  { value: "trends", label: "Trends", icon: <TrendingUp className="w-4 h-4" /> },
];

export function DvpFilters({
  position,
  onPositionChange,
  viewMode,
  onViewModeChange,
  season,
  onSeasonChange,
}: DvpFiltersProps) {
  return (
    <div className="flex flex-col gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Position Selector - Pill Style */}
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => onPositionChange(pos)}
                className={cn(
                  "px-3 py-1.5 text-sm font-bold rounded-md transition-all",
                  position === pos
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Season Selector (Simplified) */}
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
            <Calendar className="w-4 h-4 text-neutral-500" />
            <span>{season}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>
        </div>

        {/* Right Side: View Modes */}
        <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-x-auto">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => onViewModeChange(mode.value)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
                viewMode === mode.value
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {mode.icon}
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

