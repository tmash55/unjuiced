"use client";

import { useMemo, type ReactNode } from "react";
import { RefreshCw, Loader2, AlertCircle, Clock3, Target, List, Building2, Sparkles } from "lucide-react";
import { useTripleDoubleSheet, type TripleDoubleBestPrice } from "@/hooks/use-triple-double-sheet";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { cn } from "@/lib/utils";

function StatChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/60 px-2.5 py-1.5">
      <span className="text-neutral-500 dark:text-neutral-400">{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</div>
        <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{value}</div>
      </div>
    </div>
  );
}

function BookPill({
  price,
  isBest,
}: {
  price: TripleDoubleBestPrice | null;
  isBest?: boolean;
}) {
  if (!price) {
    return <span className="inline-flex min-h-8 items-center rounded-md px-2 text-xs text-neutral-500 dark:text-neutral-500">-</span>;
  }

  const meta = getSportsbookById(price.book);
  const logo = meta?.image?.light;
  const bookLabel = meta?.name || price.book;
  const href = price.mobileLink || price.link;

  const inner = (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1 transition-all",
        "bg-white dark:bg-neutral-900",
        isBest
          ? "border-brand/45 bg-brand/10 dark:bg-brand/15 shadow-sm shadow-brand/20"
          : "border-neutral-200 dark:border-neutral-700"
      )}
      title={price.stale ? "Stale quote served from cache" : undefined}
    >
      {logo ? <img src={logo} alt={price.book} className="h-3.5 w-3.5 rounded object-contain" /> : null}
      <span className={cn("text-sm font-bold tabular-nums", isBest ? "text-brand" : "text-neutral-800 dark:text-neutral-100")}>
        {price.priceFormatted}
      </span>
      <span className="max-w-20 truncate text-[10px] text-neutral-500 dark:text-neutral-400">{bookLabel}</span>
      {price.stale ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" /> : null}
    </span>
  );

  if (!href) return inner;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex hover:opacity-90 transition-opacity">
      {inner}
    </a>
  );
}

export function TripleDoubleSheet() {
  const { data, isLoading, isFetching, error, refetch } = useTripleDoubleSheet();
  const sheet = data?.data;
  const rows = sheet?.rows || [];

  const generatedLabel = useMemo(() => {
    if (!sheet?.generatedAt) return "Not yet generated";
    return new Date(sheet.generatedAt).toLocaleString();
  }, [sheet?.generatedAt]);

  const sourceLabel = useMemo(() => {
    switch (data?.source) {
      case "computed":
        return "Live compute";
      case "redis_cache":
        return "Redis cache";
      case "l1_cache":
        return "Memory cache";
      default:
        return "N/A";
    }
  }, [data?.source]);

  const cacheHitRate = useMemo(() => {
    const stats = sheet?.meta?.quoteStats;
    if (!stats || stats.totalRequests <= 0) return null;
    return `${Math.round((stats.cacheHits / stats.totalRequests) * 100)}%`;
  }, [sheet?.meta?.quoteStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Failed to load triple-double sheet
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-neutral-50/90 to-white dark:from-neutral-900 dark:to-neutral-950 p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatChip
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label="Updated"
              value={generatedLabel}
            />
            <StatChip
              icon={<Target className="h-3.5 w-3.5" />}
              label="Target Line"
              value={sheet?.meta?.targetLine ? sheet.meta.targetLine.toFixed(1) : "-"}
            />
            <StatChip
              icon={<List className="h-3.5 w-3.5" />}
              label="Rows"
              value={String(rows.length)}
            />
            <StatChip
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Data Source"
              value={sourceLabel}
            />
            {cacheHitRate ? (
              <StatChip
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="Cache Hit"
                value={cacheHitRate}
              />
            ) : null}
          </div>
        <button
          type="button"
          onClick={() => refetch()}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-xs font-semibold",
            "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          )}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </button>
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <Sparkles className="h-3 w-3 text-brand" />
          Highest available price in each row is highlighted.
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-sm text-neutral-500">
          No triple-double sheet rows are available yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="min-w-[940px] w-full">
            <thead className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/95 dark:bg-neutral-900/95 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                <th className="px-4 py-2.5 font-semibold">Player</th>
                <th className="px-4 py-2.5 font-semibold">Matchup</th>
                <th className="px-4 py-2.5 font-semibold">SGP (R+A)</th>
                <th className="px-4 py-2.5 font-semibold">SGP (P+R+A)</th>
                <th className="px-4 py-2.5 font-semibold">Triple Double</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const bestPrice = Math.max(
                  row.sgp_ra?.price ?? Number.NEGATIVE_INFINITY,
                  row.sgp_pra?.price ?? Number.NEGATIVE_INFINITY,
                  row.td?.price ?? Number.NEGATIVE_INFINITY
                );
                const hasBest = Number.isFinite(bestPrice);

                return (
                <tr
                  key={row.id}
                  className="group border-b border-neutral-100 dark:border-neutral-800/80 odd:bg-neutral-50/40 dark:odd:bg-neutral-900/20 last:border-b-0 hover:bg-brand/[0.04] dark:hover:bg-brand/[0.08]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{row.player}</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">{row.team || "-"}</div>
                      </div>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        row.hasAllThreeLegs
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      )}>
                        {row.hasAllThreeLegs ? "PRA Ready" : "RA Only"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{row.matchup}</div>
                    <div className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                      {new Date(row.startTime).toLocaleString(undefined, {
                        weekday: "short",
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <BookPill price={row.sgp_ra} isBest={hasBest && row.sgp_ra?.price === bestPrice} />
                  </td>
                  <td className="px-4 py-3">
                    <BookPill price={row.sgp_pra} isBest={hasBest && row.sgp_pra?.price === bestPrice} />
                  </td>
                  <td className="px-4 py-3">
                    <BookPill price={row.td} isBest={hasBest && row.td?.price === bestPrice} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
