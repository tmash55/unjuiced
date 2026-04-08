"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getCurrentMlbSeason } from "@/lib/mlb/current-season";
import { useNrfiTeams } from "@/hooks/use-nrfi-leaderboards";
import type { NrfiTeamRow } from "@/app/api/mlb/nrfi/teams/route";
import { SegmentedControl } from "@/components/cheat-sheet/sheet-filter-bar";
import { Loader2, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";

type SubTab = "nrfi-friendly" | "yrfi-targets";
type SortField = "scoring_pct" | "ops_1st" | "hrs_1st" | "walks_1st";

function TeamLogo({ abbr }: { abbr: string }) {
  return (
    <Image
      src={`/team-logos/mlb/${abbr.toUpperCase()}.svg`}
      alt={abbr}
      width={22}
      height={22}
      className="object-contain shrink-0"
    />
  );
}

function deriveTrend(current: string | null, l30: string | null): "up" | "down" | "flat" {
  if (!current || !l30) return "flat";
  const diff = Number(l30) - Number(current);
  if (diff > 3) return "up";
  if (diff < -3) return "down";
  return "flat";
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3 text-red-500" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-emerald-500" />;
  return <Minus className="w-3 h-3 text-neutral-400" />;
}

function toSortableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const normalized = typeof value === "string" ? value.replace("%", "") : value;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function TeamOffense() {
  const currentSeason = useMemo(() => getCurrentMlbSeason(), []);
  const combinedSeasons = `${currentSeason - 1},${currentSeason}`;
  const [subTab, setSubTab] = useState<SubTab>("nrfi-friendly");
  const [seasons, setSeasons] = useState(String(currentSeason));
  const [sortField, setSortField] = useState<SortField>("scoring_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: teams, isLoading } = useNrfiTeams({ seasons });

  const sorted = useMemo(() => {
    let rows = (teams ?? []) as NrfiTeamRow[];
    rows = [...rows].sort((a, b) => {
      const aVal = toSortableNumber(a[sortField]);
      const bVal = toSortableNumber(b[sortField]);

      if (aVal == null && bVal == null) return Number(a.tid) - Number(b.tid);
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (aVal === bVal) return Number(a.tid) - Number(b.tid);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return rows;
  }, [teams, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortField(field);
      setSortDir(field === "scoring_pct" ? (subTab === "nrfi-friendly" ? "asc" : "desc") : "desc");
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => handleSort(field)} className="inline-flex items-center justify-center gap-1 hover:text-neutral-300 transition-colors">
      {children}
      {sortField === field && <ChevronDown className={cn("w-3 h-3", sortDir === "asc" && "rotate-180")} />}
    </button>
  );

  function scoringColor(pct: number): string {
    if (subTab === "nrfi-friendly") {
      return pct <= 22 ? "text-emerald-500" : pct <= 28 ? "text-neutral-400" : "text-red-500";
    }
    return pct >= 35 ? "text-red-500" : pct >= 28 ? "text-amber-400" : "text-neutral-400";
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
                  <th className="w-10 px-3 py-2.5 text-center">#</th>
                  <th className="px-3 py-2.5 text-left min-w-[180px]">Team</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap"><SortHeader field="scoring_pct">Scoring%</SortHeader></th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">L30%</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Trend</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap"><SortHeader field="ops_1st">1st OPS</SortHeader></th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap"><SortHeader field="hrs_1st">HRs</SortHeader></th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap"><SortHeader field="walks_1st">BBs</SortHeader></th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Ks</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Home%</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Away%</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => {
                  const scorePct = toSortableNumber(t.scoring_pct);
                  const trend = deriveTrend(t.scoring_pct, t.l30_scoring_pct);
                  const abbr = t.team_abbr ?? "";
                  const teamName = t.team_name ?? null;
                  const teamLabel = teamName || abbr || `Team ${t.tid}`;
                  return (
                    <tr
                      key={t.tid}
                      className="border-b border-neutral-100/50 dark:border-neutral-800/30 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors"
                    >
                      <td className="px-3 py-3 text-center text-neutral-400 tabular-nums align-middle">{i + 1}</td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          {abbr && (
                            <TeamLogo abbr={abbr} />
                          )}
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-neutral-900 dark:text-white">{teamLabel}</span>
                            {abbr && teamName && (
                              <span className="block text-[10px] uppercase tracking-wide text-neutral-400">{abbr}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <span className={cn("font-black tabular-nums", scorePct != null ? scoringColor(scorePct) : "text-neutral-400")}>
                          {scorePct != null ? `${scorePct.toFixed(1)}%` : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600 dark:text-neutral-400 align-middle">
                        {t.l30_scoring_pct != null ? `${Number(t.l30_scoring_pct).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex justify-center">
                          <TrendIcon trend={trend} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600 dark:text-neutral-400 align-middle">
                        {t.ops_1st ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600 dark:text-neutral-400 align-middle">{t.hrs_1st ?? "—"}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600 dark:text-neutral-400 align-middle">{t.walks_1st ?? "—"}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600 dark:text-neutral-400 align-middle">{t.ks_1st ?? "—"}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600 dark:text-neutral-400 align-middle">
                        {t.home_scoring_pct != null ? `${Number(t.home_scoring_pct).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-neutral-600 dark:text-neutral-400 align-middle">
                        {t.away_scoring_pct != null ? `${Number(t.away_scoring_pct).toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length === 0 && !isLoading && (
            <div className="text-center py-8 text-sm text-neutral-500">No team data available</div>
          )}
        </div>
      )}
    </div>
  );
}
