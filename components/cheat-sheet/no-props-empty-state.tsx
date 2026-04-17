"use client";

import { CalendarDays } from "lucide-react";

interface NoPropsEmptyStateProps {
  sport: string;
  nextDate?: string | null;
}

function formatNextDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const SPORT_LABELS: Record<string, string> = {
  nba: "NBA",
  wnba: "WNBA",
  mlb: "MLB",
};

export function NoPropsEmptyState({ sport, nextDate }: NoPropsEmptyStateProps) {
  const sportLabel = SPORT_LABELS[sport] ?? sport.toUpperCase();

  return (
    <div className="flex items-center justify-center py-20 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center mb-5 shadow-sm border border-neutral-200/50 dark:border-neutral-700/50 mx-auto">
          <CalendarDays className="h-8 w-8 text-neutral-400 dark:text-neutral-500" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
          No {sportLabel} props available today
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {nextDate
            ? `The next games are on ${formatNextDate(nextDate)}`
            : "Check back soon for upcoming games"}
        </p>
      </div>
    </div>
  );
}
