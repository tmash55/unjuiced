"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getCurrentMlbSeason } from "@/lib/mlb/current-season";
import { useNrfiPitchers } from "@/hooks/use-nrfi-leaderboards";
import type { NrfiPitcherRow } from "@/app/api/mlb/nrfi/pitchers/route";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { SegmentedControl, FilterSearch } from "@/components/cheat-sheet/sheet-filter-bar";
import { Loader2, ChevronDown } from "lucide-react";

function pctColor(pct: number): string {
  if (pct >= 75) return "text-emerald-500";
  if (pct >= 60) return "text-teal-400";
  if (pct >= 50) return "text-neutral-400";
  return "text-red-500";
}

type SortField = "nrfi_pct" | "total_starts" | "whip_1st" | "k_per_9_1st" | "ops_1st";

function toSortableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function PitcherLeaderboard() {
  const currentSeason = useMemo(() => getCurrentMlbSeason(), []);
  const combinedSeasons = `${currentSeason - 1},${currentSeason}`;
  const [minStarts, setMinStarts] = useState(10);
  const [seasons, setSeasons] = useState(String(currentSeason));
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("nrfi_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: pitchers, isLoading } = useNrfiPitchers({ minStarts, seasons });

  const filtered = useMemo(() => {
    let rows = pitchers ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => p.pitcher_name.toLowerCase().includes(q) || (p.team_abbr ?? "").toLowerCase().includes(q));
    }
    // Deduplicate by pitcher_id (RPC may return multiple rows per pitcher for different split types)
    const seen = new Map<number, NrfiPitcherRow>();
    for (const r of rows) {
      if (!seen.has(r.pitcher_id) || Number(r.nrfi_pct) > Number(seen.get(r.pitcher_id)!.nrfi_pct)) {
        seen.set(r.pitcher_id, r);
      }
    }
    rows = [...seen.values()];

    rows.sort((a, b) => {
      const aVal = toSortableNumber(a[sortField]);
      const bVal = toSortableNumber(b[sortField]);

      if (aVal == null && bVal == null) return a.pitcher_name.localeCompare(b.pitcher_name);
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (aVal === bVal) return a.pitcher_name.localeCompare(b.pitcher_name);
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return rows;
  }, [pitchers, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir(field === "whip_1st" || field === "ops_1st" ? "asc" : "desc"); }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-neutral-300 transition-colors">
      {children}
      {sortField === field && <ChevronDown className={cn("w-3 h-3", sortDir === "asc" && "rotate-180")} />}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSearch value={search} onChange={setSearch} placeholder="Search pitcher..." />
        <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <span>Min starts:</span>
          <SegmentedControl
            value={String(minStarts)}
            onChange={(v) => setMinStarts(Number(v))}
            options={[
              { label: "5", value: "5" },
              { label: "10", value: "10" },
              { label: "15", value: "15" },
              { label: "20", value: "20" },
            ]}
          />
        </div>
        <div className="flex-1" />
        <SegmentedControl
          value={seasons}
          onChange={setSeasons}
          options={[
            { label: String(currentSeason), value: String(currentSeason) },
            { label: `${currentSeason - 1}-${currentSeason}`, value: combinedSeasons },
          ]}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200/60 dark:border-neutral-800/40 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  <th className="text-left px-3 py-2.5 w-8">#</th>
                  <th className="text-left px-3 py-2.5 min-w-[160px]">Pitcher</th>
                  <th className="text-center px-3 py-2.5">Record</th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="nrfi_pct">NRFI%</SortHeader></th>
                  <th className="text-center px-3 py-2.5">Home%</th>
                  <th className="text-center px-3 py-2.5">Away%</th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="whip_1st">1st WHIP</SortHeader></th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="k_per_9_1st">1st K/9</SortHeader></th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="ops_1st">1st OPS</SortHeader></th>
                  <th className="text-center px-3 py-2.5">1st AVG</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const nrfiPct = Number(p.nrfi_pct);
                  return (
                    <tr
                      key={`${p.pitcher_id}-${i}`}
                      className="border-b border-neutral-100/50 dark:border-neutral-800/30 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-neutral-400 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Image
                            src={getMlbHeadshotUrl(p.pitcher_id, "tiny")}
                            alt="" width={28} height={28}
                            className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
                            unoptimized
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-neutral-900 dark:text-white truncate block">{p.pitcher_name}</span>
                            {p.team_abbr && <span className="text-[10px] text-neutral-400">{p.team_abbr}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-2.5 font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                        {p.nrfi_record || `${p.nrfi_count}-${p.yrfi_count}`}
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className={cn("font-black tabular-nums", pctColor(nrfiPct))}>
                          {nrfiPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-neutral-600 dark:text-neutral-400">
                        {p.home_nrfi_pct ? `${Number(p.home_nrfi_pct).toFixed(0)}%` : "—"}
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-neutral-600 dark:text-neutral-400">
                        {p.away_nrfi_pct ? `${Number(p.away_nrfi_pct).toFixed(0)}%` : "—"}
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-neutral-600 dark:text-neutral-400">
                        {p.whip_1st ?? "—"}
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-neutral-600 dark:text-neutral-400">
                        {p.k_per_9_1st ?? "—"}
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-neutral-600 dark:text-neutral-400">
                        {p.ops_1st ?? "—"}
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums text-neutral-600 dark:text-neutral-400">
                        {p.avg_1st ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-8 text-sm text-neutral-500">No pitchers match your criteria</div>
          )}
        </div>
      )}
    </div>
  );
}
