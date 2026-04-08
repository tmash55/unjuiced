"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useNrfiTeams } from "@/hooks/use-nrfi-leaderboards";
import type { NrfiTeamRow } from "@/app/api/mlb/nrfi/teams/route";
import { SegmentedControl } from "@/components/cheat-sheet/sheet-filter-bar";
import { Loader2, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";

type SubTab = "nrfi-friendly" | "yrfi-targets";
type SortField = "scoring_pct" | "first_inn_ops" | "first_inn_hrs" | "first_inn_walks";

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3 text-red-500" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-emerald-500" />;
  return <Minus className="w-3 h-3 text-neutral-400" />;
}

export function TeamOffense() {
  const [subTab, setSubTab] = useState<SubTab>("nrfi-friendly");
  const [seasons, setSeasons] = useState("2025,2026");
  const [sortField, setSortField] = useState<SortField>("scoring_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: teams, isLoading } = useNrfiTeams({ seasons });

  const sorted = useMemo(() => {
    let rows = teams ?? [];
    rows = [...rows].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      // NRFI-friendly: ascending (low scoring = good). YRFI targets: descending (high scoring = targets)
      const dir = subTab === "nrfi-friendly" ? "asc" : "desc";
      const effectiveDir = sortField === "scoring_pct" ? dir : sortDir;
      return effectiveDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return rows;
  }, [teams, sortField, sortDir, subTab]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir(subTab === "nrfi-friendly" ? "asc" : "desc"); }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-neutral-300 transition-colors">
      {children}
      {sortField === field && <ChevronDown className={cn("w-3 h-3", sortDir === "asc" && "rotate-180")} />}
    </button>
  );

  function scoringColor(pct: number): string {
    if (subTab === "nrfi-friendly") {
      return pct <= 22 ? "text-emerald-500" : pct <= 28 ? "text-neutral-400" : "text-red-500";
    }
    return pct >= 30 ? "text-red-500" : pct >= 25 ? "text-amber-400" : "text-neutral-400";
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={subTab}
          onChange={(v) => { setSubTab(v as SubTab); setSortField("scoring_pct"); setSortDir(v === "nrfi-friendly" ? "asc" : "desc"); }}
          options={[
            { label: "NRFI Friendly", value: "nrfi-friendly" },
            { label: "YRFI Targets", value: "yrfi-targets" },
          ]}
        />
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
                  <th className="text-left px-3 py-2.5 sticky left-8 bg-white dark:bg-neutral-900 z-[5]">Team</th>
                  <th className="text-center px-3 py-2.5">Games</th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="scoring_pct">Scoring%</SortHeader></th>
                  <th className="text-center px-3 py-2.5">L30%</th>
                  <th className="text-center px-3 py-2.5">Trend</th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="first_inn_ops">1st OPS</SortHeader></th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="first_inn_hrs">HRs</SortHeader></th>
                  <th className="text-center px-3 py-2.5"><SortHeader field="first_inn_walks">Walks</SortHeader></th>
                  <th className="text-center px-3 py-2.5">Ks</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => (
                  <tr
                    key={t.team_id}
                    className="border-b border-neutral-100/50 dark:border-neutral-800/30 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-neutral-400 tabular-nums sticky left-0 bg-white dark:bg-neutral-900 z-[5]">{i + 1}</td>
                    <td className="px-3 py-2 sticky left-8 bg-white dark:bg-neutral-900 z-[5]">
                      <div className="flex items-center gap-2">
                        <Image
                          src={`/team-logos/mlb/${t.team_abbr.toUpperCase()}.svg`}
                          alt="" width={20} height={20}
                          className="object-contain shrink-0"
                        />
                        <span className="font-semibold text-neutral-900 dark:text-white">{t.team_abbr}</span>
                      </div>
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-500">{t.games}</td>
                    <td className="text-center px-3 py-2">
                      <span className={cn("font-black tabular-nums", scoringColor(t.scoring_pct))}>
                        {t.scoring_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {t.l30_scoring_pct != null ? `${t.l30_scoring_pct.toFixed(0)}%` : "—"}
                    </td>
                    <td className="text-center px-3 py-2">
                      <TrendIcon trend={t.l30_trend} />
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {t.first_inn_ops != null ? `.${Math.round(t.first_inn_ops * 1000).toString().padStart(3, "0")}` : "—"}
                    </td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">{t.first_inn_hrs ?? "—"}</td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">{t.first_inn_walks ?? "—"}</td>
                    <td className="text-center px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">{t.first_inn_ks ?? "—"}</td>
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
