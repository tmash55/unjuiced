"use client";

import { useMemo } from "react";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useTripleDoubleSheet, type TripleDoubleBestPrice } from "@/hooks/use-triple-double-sheet";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { cn } from "@/lib/utils";

function BookPill({ price }: { price: TripleDoubleBestPrice | null }) {
  if (!price) {
    return <span className="text-xs text-neutral-400">-</span>;
  }

  const meta = getSportsbookById(price.book);
  const logo = meta?.image?.light;
  const href = price.mobileLink || price.link;

  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1">
      {logo ? <img src={logo} alt={price.book} className="h-3.5 w-3.5 rounded object-contain" /> : null}
      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{price.priceFormatted}</span>
      <span className="text-[10px] text-neutral-400">{price.book}</span>
    </span>
  );

  if (!href) return inner;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-3">
        <div className="text-xs text-neutral-600 dark:text-neutral-400">
          Updated: <span className="font-medium text-neutral-900 dark:text-neutral-100">{generatedLabel}</span>
          {sheet?.meta?.targetLine ? (
            <span className="ml-2">| Target line: {sheet.meta.targetLine.toFixed(1)}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5 text-xs font-medium",
            "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          )}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-sm text-neutral-500">
          No triple-double sheet rows are available yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="min-w-full">
            <thead className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                <th className="px-3 py-2 font-semibold">Player</th>
                <th className="px-3 py-2 font-semibold">Matchup</th>
                <th className="px-3 py-2 font-semibold">SGP (R+A)</th>
                <th className="px-3 py-2 font-semibold">SGP (P+R+A)</th>
                <th className="px-3 py-2 font-semibold">Triple Double</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 dark:border-neutral-800/80 last:border-b-0">
                  <td className="px-3 py-2.5">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{row.player}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{row.team || "-"}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-sm text-neutral-800 dark:text-neutral-200">{row.matchup}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {new Date(row.startTime).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><BookPill price={row.sgp_ra} /></td>
                  <td className="px-3 py-2.5"><BookPill price={row.sgp_pra} /></td>
                  <td className="px-3 py-2.5"><BookPill price={row.td} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
