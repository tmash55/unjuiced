import { cn } from "@/lib/utils";

interface SummaryStripProps {
  nrfiLeansAB: number;
  yrfiLeansAB: number;
  bestNrfiPrice: string;
  strongestYrfi: string;
  aGradeNrfiRecord: string;
  aGradeNrfiPct: string;
  totalGames?: number;
}

export function SummaryStrip({
  nrfiLeansAB,
  yrfiLeansAB,
  bestNrfiPrice,
  strongestYrfi,
  aGradeNrfiRecord,
  aGradeNrfiPct,
  totalGames,
}: SummaryStripProps) {
  return (
    <div className="w-full">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5">
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-4 py-2.5">
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{nrfiLeansAB}</span> NRFI
            </span>
            <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-700/30 shrink-0" />
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
              <span className="font-mono font-bold text-red-500 dark:text-red-400 tabular-nums">{yrfiLeansAB}</span> YRFI
            </span>
            <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-700/30 shrink-0" />
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
              Best <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{bestNrfiPrice}</span>
            </span>
            <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-700/30 shrink-0" />
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
              A-Grade <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{aGradeNrfiRecord}</span>
              <span className="text-neutral-300 dark:text-neutral-600 ml-1">({aGradeNrfiPct})</span>
            </span>
            <div className="flex-1" />
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums shrink-0">
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{totalGames ?? "-"}</span> games
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
