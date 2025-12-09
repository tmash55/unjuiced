import { cn } from "@/lib/utils";

const hitRateData = [
  { player: "J. Tatum", prop: "PTS", line: "26.5", l10: "80%", season: "72%" },
  { player: "L. James", prop: "AST", line: "8.5", l10: "70%", season: "65%" },
  { player: "S. Curry", prop: "3PM", line: "4.5", l10: "60%", season: "58%" },
];

export function HitRatesGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none relative size-full text-[var(--fg)] [--bg:white] [--border:#e5e5e5] [--fg:#171717] [--muted:#404040] [--good:#10b981] [--mid:#f59e0b] dark:[--bg:black] dark:[--border:#fff3] dark:[--fg:#fffa] dark:[--muted:#fff7]",
        className,
      )}
    >
      {/* Bar chart decoration - aligned right */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 339 168"
        className="h-auto w-full [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] text-[var(--fg)]"
      >
        {/* Bar charts in background - positioned to the right */}
        <rect x="200" y="80" width="28" height="88" rx="4" fill="#10b981" fillOpacity="0.15" />
        <rect x="200" y="100" width="28" height="68" rx="4" fill="#10b981" fillOpacity="0.4" />
        
        <rect x="245" y="50" width="28" height="118" rx="4" fill="#10b981" fillOpacity="0.15" />
        <rect x="245" y="70" width="28" height="98" rx="4" fill="#10b981" fillOpacity="0.4" />
        
        <rect x="290" y="65" width="28" height="103" rx="4" fill="#10b981" fillOpacity="0.15" />
        <rect x="290" y="90" width="28" height="78" rx="4" fill="#10b981" fillOpacity="0.4" />
        
        {/* Trend line connecting bars */}
        <path
          stroke="#10b981"
          strokeWidth="2"
          d="M214 100 L259 70 L304 90"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.6"
        />
        <circle cx="214" cy="100" r="4" fill="#10b981" />
        <circle cx="259" cy="70" r="4" fill="#10b981" />
        <circle cx="304" cy="90" r="4" fill="#10b981" />
      </svg>
      
      {/* Table */}
      <div className="absolute bottom-0 left-5 right-0 [mask-image:linear-gradient(to_right,black_85%,transparent)]">
        <div className="w-full rounded-l-lg border border-r-0 overflow-hidden bg-[var(--bg)] border-[var(--border)]">
          {/* Table Header */}
          <div className="grid [grid-template-columns:80px_50px_55px_55px_60px] border-b h-10 border-[var(--border)]">
            <div className="h-10 flex items-center px-2 text-[10px] font-medium text-[var(--muted)] border-r border-[var(--border)]">
              Player
            </div>
            <div className="h-10 flex items-center justify-center text-[10px] font-medium text-[var(--muted)] border-r border-[var(--border)]">
              Prop
            </div>
            <div className="h-10 flex items-center justify-center text-[10px] font-medium text-[var(--muted)] border-r border-[var(--border)]">
              Line
            </div>
            <div className="h-10 flex items-center justify-center text-[10px] font-medium text-[var(--muted)] border-r border-[var(--border)]">
              L10
            </div>
            <div className="h-10 flex items-center justify-center text-[10px] font-medium text-[var(--muted)]">
              Season
            </div>
          </div>
          
          {/* Table Rows */}
          {hitRateData.map((row, idx) => (
            <div
              key={idx}
              className="grid [grid-template-columns:80px_50px_55px_55px_60px] items-center border-b border-[var(--border)] last:border-b-0 h-9"
            >
              <div className="h-9 flex items-center px-2 text-[10px] font-medium text-[var(--fg)] border-r border-[var(--border)] truncate">
                {row.player}
              </div>
              <div className="h-9 flex items-center justify-center text-[10px] font-medium text-[var(--muted)] border-r border-[var(--border)]">
                {row.prop}
              </div>
              <div className="h-9 flex items-center justify-center text-[10px] font-medium text-[var(--fg)] border-r border-[var(--border)]">
                {row.line}
              </div>
              <div className={cn(
                "h-9 flex items-center justify-center text-[10px] font-semibold border-r border-[var(--border)]",
                parseInt(row.l10) >= 70 ? "text-emerald-500" : "text-amber-500"
              )}>
                {row.l10}
              </div>
              <div className={cn(
                "h-9 flex items-center justify-center text-[10px] font-semibold",
                parseInt(row.season) >= 70 ? "text-emerald-500" : "text-amber-500"
              )}>
                {row.season}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

