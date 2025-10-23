import { cn } from "@/lib/utils";
import Image from "next/image";

const sportsbooks = [
  { name: "DraftKings", logo: "draftkings.png" },
  { name: "FanDuel", logo: "fanduel.png" },
  { name: "BetMGM", logo: "betmgm.png" },
  { name: "Caesars", logo: "caesars.png" },
];

const oddsRows = [
  {
    bestOdds: "+245",
    avgLine: "+238",
    books: ["+240", "+245", "+235", "+242"],
  },
  {
    bestOdds: "-110",
    avgLine: "-112",
    books: ["-110", "-115", "-108", "-112"],
  },
];

export function AnalyticsGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none relative size-full text-[var(--fg)] [--bg:white] [--border:#e5e5e5] [--fg:#171717] [--muted:#404040] dark:[--bg:black] dark:[--border:#fff3] dark:[--fg:#fffa] dark:[--muted:#fff7]",
        className,
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 339 168"
        className="h-auto w-full [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] text-[var(--fg)] [--bg:white] [--border:#e5e5e5] [--fg:#171717] [--muted:#737373] dark:[--bg:black] dark:[--border:#fff3] dark:[--fg:#fffa] dark:[--muted:#fff7]"
      >
        <path
          stroke="#3B82F6"
          strokeWidth="2"
          d="m345 1-60.533 76.487a8 8 0 0 1-9.732 2.25l-25.53-12.241a8 8 0 0 0-9.214 1.657l-62.736 64.993a8 8 0 0 1-6.695 2.388L67.303 124.331a8 8 0 0 0-5.193 1.17L-3.166 166.5"
        />
        <circle cx="259.333" cy="72" r="3" fill="#3B82F6" />
        <circle
          cx="259.333"
          cy="72"
          r="4"
          stroke="#60A5FA"
          strokeOpacity="0.3"
          strokeWidth="2"
        />
      </svg>
      <div className="absolute bottom-0 left-5 right-0 [mask-image:linear-gradient(to_right,black_85%,transparent)]">
        {/* Table */}
        <div className="w-full rounded-l-lg border border-r-0 overflow-hidden bg-[var(--bg)] border-[var(--border)]">
          {/* Table Header */}
          <div className="grid [grid-template-columns:70px_70px_repeat(4,75px)] border-b h-12 border-[var(--border)]">
            {/* Best Odds Column */}
            <div className="h-12 flex items-center justify-center text-center text-[10px] font-medium border-r text-[var(--muted)] border-[var(--border)]">
              Best
            </div>
            {/* Avg Line Column */}
            <div className="h-12 flex items-center justify-center text-center text-[10px] font-medium border-r text-[var(--muted)] border-[var(--border)]">
              AVG
            </div>
            {/* Sportsbook Columns */}
            {sportsbooks.map((book) => (
              <div
                key={book.name}
                className="h-12 flex items-center justify-center border-r border-[var(--border)] last:border-r-0"
              >
                <div className="relative h-4 w-9">
                  <Image
                    src={`/images/sports-books/${book.logo}`}
                    alt={book.name}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Table Rows */}
          {oddsRows.map((row, idx) => (
            <div
              key={idx}
              className="grid [grid-template-columns:70px_70px_repeat(4,75px)] items-center border-b border-[var(--border)] last:border-b-0 h-11"
            >
              {/* Best Odds Cell */}
              <div className="h-11 flex items-center justify-center text-center text-[10px] font-medium text-[var(--fg)] border-r border-[var(--border)]">
                {row.bestOdds}
              </div>
              {/* Avg Line Cell */}
              <div className="h-11 flex items-center justify-center text-center text-[10px] font-medium text-[var(--fg)] border-r border-[var(--border)]">
                {row.avgLine}
              </div>
              {/* Sportsbook Cells */}
              {row.books.map((odds, bookIdx) => (
                <div
                  key={bookIdx}
                  className="h-11 flex items-center justify-center text-center text-[10px] font-medium text-[var(--fg)] border-r border-[var(--border)] last:border-r-0"
                >
                  {odds}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}