"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useNrfiGames } from "@/hooks/use-nrfi-games";
import { buildSeasonRange, getCurrentMlbSeason } from "@/lib/mlb/current-season";
import { cn } from "@/lib/utils";
import { GameCardV2 } from "./game-card-v2";
import { PitcherLeaderboard } from "./pitcher-leaderboard";
import { TeamOffense } from "./team-offense";
import { SegmentedControl, DateNav } from "@/components/cheat-sheet/sheet-filter-bar";
import { Loader2, CheckCircle, XCircle, Calendar, Trophy, Users } from "lucide-react";

type NrfiTab = "slate" | "pitchers" | "teams";
type SortOption = "best-grade" | "best-odds" | "game-time" | "lowest-offense";
type FilterOption = "all" | "nrfi" | "yrfi" | "a-plus" | "streaks";

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function parseScoringPct(value: string): number | null {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function MlbNrfiSheet() {
  const currentSeason = useMemo(() => getCurrentMlbSeason(), []);
  const combinedSeasonValue = useMemo(() => {
    const seasons = buildSeasonRange(currentSeason, 3);
    return `${seasons[0]}-${seasons[seasons.length - 1]}`;
  }, [currentSeason]);

  // Tab state
  const [activeTab, setActiveTab] = useState<NrfiTab>("slate");

  // Slate controls
  const [sort, setSort] = useState<SortOption>("best-grade");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [season, setSeason] = useState(String(currentSeason));
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDateState] = useState<string>(() => searchParams.get("date") || getTodayET());
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);

  const { games, meta, isLoading, error } = useNrfiGames({
    date: selectedDate,
    seasons: season,
  });

  const availableDates = useMemo(() => meta?.availableDates ?? [], [meta]);

  // Filter + sort
  const filtered = useMemo(() => {
    if (filter === "nrfi") return games.filter((g) => ["strong_nrfi", "nrfi", "lean_nrfi"].includes(g.lean));
    if (filter === "yrfi") return games.filter((g) => ["strong_yrfi", "yrfi", "lean_yrfi"].includes(g.lean));
    if (filter === "a-plus") return games.filter((g) => g.grade === "A+" || g.grade === "A");
    if (filter === "streaks") return games.filter((g) => {
      const aStreak = g.awayPitcher.recentStarts.filter((s, i) => i === 0 || g.awayPitcher.recentStarts.slice(0, i).every(x => x.scoreless)).length;
      const hStreak = g.homePitcher.recentStarts.filter((s, i) => i === 0 || g.homePitcher.recentStarts.slice(0, i).every(x => x.scoreless)).length;
      return aStreak + hStreak >= 8;
    });
    return games;
  }, [games, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "best-grade") arr.sort((a, b) => b.gradeScore - a.gradeScore);
    else if (sort === "best-odds") {
      arr.sort((a, b) => {
        const aOdds = parseFloat(a.bestNrfiOdds) || -999;
        const bOdds = parseFloat(b.bestNrfiOdds) || -999;
        return bOdds - aOdds;
      });
    } else if (sort === "lowest-offense") {
      arr.sort((a, b) => {
        const aAway = parseScoringPct(a.awayOffense.scoringPct);
        const aHome = parseScoringPct(a.homeOffense.scoringPct);
        const bAway = parseScoringPct(b.awayOffense.scoringPct);
        const bHome = parseScoringPct(b.homeOffense.scoringPct);
        const aAvg = aAway != null && aHome != null ? (aAway + aHome) / 2 : Number.POSITIVE_INFINITY;
        const bAvg = bAway != null && bHome != null ? (bAway + bHome) / 2 : Number.POSITIVE_INFINITY;
        return aAvg - bAvg;
      });
    } else {
      arr.sort((a, b) => a.gameTime.localeCompare(b.gameTime));
    }
    return arr;
  }, [filtered, sort]);

  // Summary
  const nrfiCount = games.filter((g) => ["strong_nrfi", "nrfi", "lean_nrfi"].includes(g.lean)).length;
  const yrfiCount = games.filter((g) => ["strong_yrfi", "yrfi", "lean_yrfi"].includes(g.lean)).length;
  const resolvedCount = games.filter((g) => g.nrfiResult != null).length;
  const nrfiHits = games.filter((g) => g.nrfiResult === true).length;

  const TABS: { key: NrfiTab; label: string; icon: React.ElementType }[] = [
    { key: "slate", label: "Today's Slate", icon: Calendar },
    { key: "pitchers", label: "Pitcher Leaderboard", icon: Trophy },
    { key: "teams", label: "Team Offense", icon: Users },
  ];

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                isActive
                  ? "bg-brand text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Today's Slate ──────────────────────────────────────── */}
      {activeTab === "slate" && (
        <>
          {/* Controls bar */}
          <div className="rounded-xl bg-neutral-50/80 dark:bg-neutral-950/40 border border-neutral-200/60 dark:border-neutral-800/60 overflow-visible mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200/40 dark:border-neutral-800/30">
              <DateNav
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                availableDates={availableDates}
              />
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-neutral-500">{games.length} games</span>
                <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                  <CheckCircle className="w-3 h-3" /> {nrfiCount} NRFI
                </span>
                <span className="flex items-center gap-1 text-red-500 font-semibold">
                  <XCircle className="w-3 h-3" /> {yrfiCount} YRFI
                </span>
                {resolvedCount > 0 && (
                  <span className="text-neutral-400">Record: {nrfiHits}/{resolvedCount}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {[
                  { label: "All", value: "all" },
                  { label: "NRFI", value: "nrfi" },
                  { label: "YRFI", value: "yrfi" },
                  { label: "A+ Only", value: "a-plus" },
                  { label: "Hot Streaks", value: "streaks" },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value as FilterOption)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors",
                      filter === f.value
                        ? "bg-brand text-white"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
              <SegmentedControl
                value={sort}
                onChange={(v) => setSort(v as SortOption)}
                options={[
                  { label: "Grade", value: "best-grade" },
                  { label: "Odds", value: "best-odds" },
                  { label: "Low Off", value: "lowest-offense" },
                  { label: "Time", value: "game-time" },
                ]}
              />
              <div className="flex-1" />
              <SegmentedControl
                value={season}
                onChange={setSeason}
                options={[
                  { label: String(currentSeason), value: String(currentSeason) },
                  { label: "Combined", value: combinedSeasonValue },
                ]}
              />
            </div>
          </div>

          {/* Game cards */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto" />
                <p className="text-sm text-neutral-500 mt-3">Loading NRFI slate...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-red-500">{error.message}</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">No games match your filter</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {filter !== "all" ? "Try switching to 'All' to see all games." : "No games scheduled for this date."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((game) => (
                <GameCardV2
                  key={game.gameId}
                  game={game}
                  expanded={expandedGameId === game.gameId}
                  onToggle={() => setExpandedGameId(expandedGameId === game.gameId ? null : game.gameId)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Pitcher Leaderboard ───────────────────────────────── */}
      {activeTab === "pitchers" && <PitcherLeaderboard />}

      {/* ── Tab: Team Offense ──────────────────────────────────────── */}
      {activeTab === "teams" && <TeamOffense />}
    </div>
  );
}
