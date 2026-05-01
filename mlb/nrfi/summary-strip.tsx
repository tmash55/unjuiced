import { cn } from "@/lib/utils";

interface SummaryStripProps {
  nrfiLeansAB: number;
  yrfiLeansAB: number;
  bestNrfiPrice: string;
  strongestYrfi: string;
  aGradeNrfiRecord: string;
  aGradeNrfiPct: string;
}

interface StatChipProps {
  label: string;
  value: string;
  accent?: "green" | "red" | "yellow" | "neutral";
}

function StatChip({ label, value, accent = "neutral" }: StatChipProps) {
  const accentStyles = {
    green: "text-nrfi-green",
    red: "text-yrfi-red",
    yellow: "text-neutral-yellow",
    neutral: "text-foreground",
  };
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary border border-border/60">
      <span className="text-xs text-muted-foreground/70 font-medium tracking-wide uppercase whitespace-nowrap">
        {label}
      </span>
      <span className={cn("text-xs font-bold tabular-nums", accentStyles[accent])}>
        {value}
      </span>
    </div>
  );
}

export function SummaryStrip({
  nrfiLeansAB,
  yrfiLeansAB,
  bestNrfiPrice,
  strongestYrfi,
  aGradeNrfiRecord,
  aGradeNrfiPct,
}: SummaryStripProps) {
  return (
    <div className="w-full border-b border-border bg-background">
      <div className="max-w-[1440px] mx-auto px-6 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <StatChip
            label="A/B NRFI Leans"
            value={`${nrfiLeansAB} games`}
            accent="green"
          />
          <StatChip
            label="A/B YRFI Leans"
            value={`${yrfiLeansAB} games`}
            accent="red"
          />
          <StatChip
            label="Best NRFI Price"
            value={bestNrfiPrice}
            accent="green"
          />
          <StatChip
            label="Strongest YRFI"
            value={strongestYrfi}
            accent="red"
          />
          <StatChip
            label="A-Grade NRFI Record"
            value={`${aGradeNrfiRecord} (${aGradeNrfiPct})`}
            accent="yellow"
          />

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              Today&rsquo;s Slate
            </span>
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-xs font-bold bg-secondary text-foreground border border-border">
              9
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
