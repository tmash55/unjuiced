import { cn } from "@/lib/utils";

/**
 * F8: W-L Record Presentation Standard
 *
 * Renders NRFI/YRFI records as "{count}/{total} NRFI" with optional percentage.
 * Used platform-wide for consistent NRFI stat display.
 */

interface NRFIRecordProps {
  /** Scoreless record string, e.g. "24/30" */
  record: string;
  /** Scoreless percentage, e.g. "80.0" */
  pct?: string | null;
  /** Display context — determines label and color */
  context?: "nrfi" | "yrfi" | "team_offense";
  /** Show percentage in parentheses */
  showPct?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function NRFIRecord({
  record,
  pct,
  context = "nrfi",
  showPct = true,
  size = "md",
  className,
}: NRFIRecordProps) {
  const label = context === "yrfi" ? "YRFI" : context === "team_offense" ? "" : "NRFI";

  const recordSize = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-4xl",
  }[size];

  const labelSize = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-sm",
  }[size];

  const pctSize = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-[11px]",
    xl: "text-xs",
  }[size];

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className={cn("font-black tabular-nums text-neutral-900 dark:text-white leading-none", recordSize)}>
        {record}
      </span>
      {label && (
        <span className={cn("font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500", labelSize)}>
          {label}
        </span>
      )}
      {showPct && pct && (
        <span className={cn("text-neutral-400 dark:text-neutral-500 tabular-nums", pctSize)}>
          ({pct}%)
        </span>
      )}
    </span>
  );
}

/**
 * Compact streak badge — shows current NRFI/YRFI streak from recentStarts.
 * F4: Streak Counters (partial — computed from available recent starts)
 */
export function StreakBadge({
  recentStarts,
}: {
  recentStarts: Array<{ scoreless: boolean }>;
}) {
  if (!recentStarts.length) return null;

  // Compute current streak from most recent game backwards
  const first = recentStarts[0];
  let streakType = first.scoreless ? "nrfi" : "yrfi";
  let streakLength = 0;

  for (const start of recentStarts) {
    if ((streakType === "nrfi" && start.scoreless) || (streakType === "yrfi" && !start.scoreless)) {
      streakLength++;
    } else {
      break;
    }
  }

  if (streakLength <= 1) return null; // Don't show for streak of 1

  const isNRFI = streakType === "nrfi";
  const isHot = streakLength >= 5;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums border",
        isNRFI
          ? streakLength >= 5
            ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
            : "bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20"
          : streakLength >= 5
            ? "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400 border-red-200 dark:border-red-500/30"
            : "bg-red-50/50 dark:bg-red-500/10 text-red-500 dark:text-red-400 border-red-200/50 dark:border-red-500/20"
      )}
    >
      {streakLength} {isNRFI ? "NRFI" : "YRFI"}
    </span>
  );
}
