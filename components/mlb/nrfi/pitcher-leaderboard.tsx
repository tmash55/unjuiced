"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useNrfiPitchers } from "@/hooks/use-nrfi-leaderboards";
import type { NrfiPitcherRow } from "@/app/api/mlb/nrfi/pitchers/route";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { SegmentedControl, FilterSearch } from "@/components/cheat-sheet/sheet-filter-bar";
import { Loader2, Flame, Snowflake, ChevronDown } from "lucide-react";

type SortField = "nrfi_pct" | "total_starts" | "current_streak" | "first_inn_whip" | "first_inn_k9";

function pctColor(pct: number): string {
  if (pct >= 75) return "text-emerald-500";
  if (pct >= 60) return "text-teal-400";
  if (pct >= 50) return "text-neutral-400";
  return "text-red-500";
}

export function PitcherLeaderboard() {
  const [minStarts, setMinStarts] = useState(10);
  const [seasons, setSeasons] = useState("2025,2026");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("nrfi_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: pitchers, isLoading } = useNrfiPitchers({ minStarts, seasons });

  const filtered = useMemo(() => {
    let rows = pitchers ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => p.player_name.toLowerCase().includes(q) || p.team_abbr.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
    return rows;
  }, [pitchers, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
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
            { label: "2025-26", value: "2025,2026" },
            { label: "2026", value: "2026" },
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
                  <th className="text-left px-3 py-2.5 sticky left-0 bg-white dark:bg-neutral-900 z-[5]">#</th>
                  <th className="text-left px-3 py-2.5 sticky left-8 bg-white dark:bg-neutral-900 z-[5]">Pitcher</th>
                  <th className="text-center px-3 py-2.5">Record</th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="nrfi_pct">NRFI%</SortHeader></th>
                  <th className="text-center px-3 py-2.5">Streak</th>
                  <th className="text-center px-3 py-2.5">Home%</th>
                  <th className="text-center px-3 py-2.5">Away%</th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="first_inn_whip">1st WHIP</SortHeader></th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="first_inn_k9">1st K/9</SortHeader></th>
                  <th className="text-center px-3 py-2.5">1st OPS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.player_id}
                    className="border-b border-neutral-100/50 dark:border-neutral-800/30 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-neutral-400 tabular-nums sticky left-0 bg-white dark:bg-neutral-900 z-[5]">{i + 1}</td>
                    <td className="px-3 py-2 sticky left-8 bg-white dark:bg-neutral-900 z-[5]">
                      <div className="flex items-center gap-2">
                        <Image
                          src={getMlbHeadshotUrl(p.player_id, "tiny")}
                          alt="" width={24} height={24}
                          className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
                          unoptimized
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-neutral-900 dark:text-white truncate block">{p.player_name}</span>
                          <span className="text-[10px] text-neutral-400">{p.team_abbr} · {p.throws}HP</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-3 py-2 font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                      {p.nrfi_count}-{p.yrfi_count}
                    </td>
                    <td className="text-center px-3 py-2">
                      <span className={cn("font-black tabular-nums", pctColor(p.nrfi_pct))}>
                        {p.nrfi_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-center px-3 py-2">
                      {p.current_streak >= 3 && (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          p.streak_type === "nrfi" ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
                        )}>
                          {p.streak_type === "nrfi" ? <Flame className="w-3 h-3" /> : <Snowflake className="w-3 h-3" />}
                          {p.current_streak}
                        </span>
                      )}
                      {p.current_streak < 3 && <span className="text-neutral-500 tabular-nums">{p.current_streak}</span>}
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {p.home_nrfi_pct != null ? `${p.home_nrfi_pct.toFixed(0)}%` : "—"}
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {p.away_nrfi_pct != null ? `${p.away_nrfi_pct.toFixed(0)}%` : "—"}
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {p.first_inn_whip != null ? p.first_inn_whip.toFixed(2) : "—"}
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {p.first_inn_k9 != null ? p.first_inn_k9.toFixed(1) : "—"}
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {p.first_inn_ops != null ? `.${Math.round(p.first_inn_ops * 1000).toString().padStart(3, "0")}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
