"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbGames, type MlbGame } from "@/hooks/use-mlb-games";
import { useGameCenter, type GameCenterView, type GameCenterSample } from "@/hooks/use-game-center";
import { GameScoreboard } from "@/components/game-center/game-scoreboard";
import { GameHeader } from "@/components/game-center/game-header";
import { MlbBatterVsPitcher } from "@/components/cheat-sheet/mlb-batter-vs-pitcher";
import { MlbPitcherWeakness } from "@/components/cheat-sheet/mlb-pitcher-weakness";
import { CorrelationsView } from "@/components/game-center/correlations-view";
import { WeatherView } from "@/components/game-center/weather-view";
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";

// ── Constants ───────────────────────────────────────────────────────────────

const VIEW_TABS: { value: GameCenterView; label: string; shortLabel: string }[] = [
  { value: "slate", label: "Slate Insights", shortLabel: "Slate" },
  { value: "weakness", label: "Pitcher Weakness", shortLabel: "Weakness" },
  { value: "correlations", label: "Correlations", shortLabel: "Corr" },
  { value: "weather", label: "Weather", shortLabel: "Weather" },
];

const SEASON_OPTIONS = (() => {
  const now = new Date();
  const year = now.getFullYear();
  return [
    { label: String(year - 1), value: String(year - 1) },
    { label: String(year), value: String(year) },
  ];
})();

const SAMPLE_OPTIONS: { label: string; value: GameCenterSample; shortLabel: string }[] = [
  { value: "season", label: "Season", shortLabel: "Szn" },
  { value: "30", label: "Last 30", shortLabel: "30" },
  { value: "15", label: "Last 15", shortLabel: "15" },
  { value: "7", label: "Last 7", shortLabel: "7" },
];

// ── Doubleheader Detection ───────────────────────────────────────────────────

/** Build a map of game_id → "Gm 1" | "Gm 2" for doubleheader games */
function buildDoubleheaderMap(games: MlbGame[]): Map<string, string> {
  const map = new Map<string, string>();
  // Group by date + matchup (sorted tricodes to handle home/away)
  const groups = new Map<string, MlbGame[]>();
  for (const g of games) {
    const key = `${g.game_date}:${[g.away_team_tricode, g.home_team_tricode].sort().join("-")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    // Sort by game time/id to determine Gm 1 vs Gm 2
    group.sort((a, b) => Number(a.game_id) - Number(b.game_id));
    group.forEach((g, i) => map.set(g.game_id, `Gm ${i + 1}`));
  }
  return map;
}

// ── Game Switcher Dropdown ───────────────────────────────────────────────────

function lastNameOnly(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function GameSwitcher({
  games,
  selectedGameId,
  onSelect,
}: {
  games: MlbGame[];
  selectedGameId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dhMap = useMemo(() => buildDoubleheaderMap(games), [games]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = games.find((g) => Number(g.game_id) === selectedGameId);
  const visibleGames = games.filter((g) => {
    const status = (g.game_status || "").toLowerCase();
    return !status.includes("postponed") && !status.includes("cancelled");
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        {selected && (
          <>
            <img src={`/team-logos/mlb/${selected.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
            <span className="text-xs font-semibold">
              {selected.away_team_tricode} @ {selected.home_team_tricode}
              {dhMap.get(selected.game_id) && (
                <span className="ml-1 text-[9px] text-brand font-bold">({dhMap.get(selected.game_id)})</span>
              )}
            </span>
            <img src={`/team-logos/mlb/${selected.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
          </>
        )}
        <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/50 shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto">
          {(() => {
            let lastDate = "";
            return visibleGames.map((g) => {
              const id = Number(g.game_id);
              const isSelected = id === selectedGameId;
              const isFinal = (g.game_status || "").toLowerCase().includes("final");
              const showDateHeader = g.game_date !== lastDate;
              lastDate = g.game_date;
              const dateLabel = (() => {
                const d = new Date(g.game_date + "T12:00:00");
                const fmtET = (dt: Date) => dt.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
                const todayET = fmtET(new Date());
                const tomorrowDt = new Date();
                tomorrowDt.setDate(tomorrowDt.getDate() + 1);
                if (g.game_date === todayET) return "Today";
                if (g.game_date === fmtET(tomorrowDt)) return "Tomorrow";
                return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              })();
              return (
                <React.Fragment key={g.game_id}>
                  {showDateHeader && (
                    <div className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-100 dark:border-neutral-800/50 sticky top-0 z-10">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{dateLabel}</span>
                    </div>
                  )}
                  <button
                    onClick={() => { onSelect(id); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-neutral-100/50 dark:border-neutral-800/30 transition-colors",
                      isSelected
                        ? "bg-brand/5 dark:bg-brand/10"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    )}
                  >
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {/* Away team row */}
                      <div className="flex items-center gap-1.5">
                        <img src={`/team-logos/mlb/${g.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
                        <span className="text-[11px] font-bold text-neutral-900 dark:text-white w-8">{g.away_team_tricode}</span>
                        <span className="text-[10px] text-neutral-500 truncate">{lastNameOnly(g.away_probable_pitcher)}</span>
                        {isFinal && <span className="ml-auto text-[11px] font-bold text-neutral-900 dark:text-white tabular-nums shrink-0">{g.away_team_score}</span>}
                      </div>
                      {/* Home team row */}
                      <div className="flex items-center gap-1.5">
                        <img src={`/team-logos/mlb/${g.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
                        <span className="text-[11px] font-bold text-neutral-900 dark:text-white w-8">{g.home_team_tricode}</span>
                        <span className="text-[10px] text-neutral-500 truncate">{lastNameOnly(g.home_probable_pitcher)}</span>
                        {isFinal && <span className="ml-auto text-[11px] font-bold text-neutral-900 dark:text-white tabular-nums shrink-0">{g.home_team_score}</span>}
                      </div>
                      {dhMap.get(g.game_id) && (
                        <span className="text-[9px] text-brand font-bold">Game {dhMap.get(g.game_id)}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                      {!isFinal && (
                        <span className="text-[10px] text-neutral-500 tabular-nums whitespace-nowrap">{g.game_status}</span>
                      )}
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-brand" />}
                    </div>
                  </button>
                </React.Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function GameCenterPage() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { games, isLoading: gamesLoading } = useMlbGames();
  const gc = useGameCenter();

  const selectedGame = useMemo(
    () => games.find((g) => Number(g.game_id) === gc.gameId) ?? null,
    [games, gc.gameId]
  );

  if (gamesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">Loading games...</span>
      </div>
    );
  }

  // ── Scoreboard mode: no game selected ──
  if (!gc.gameId) {
    return (
      <GameScoreboard
        games={games}
        onSelectGame={gc.setGameId}
        isMobile={isMobile}
      />
    );
  }

  // ── Analysis mode: game selected ──
  return (
    <div className="space-y-3 md:space-y-4">
      {/* Navigation: Back + Game Switcher */}
      <div className="flex items-center justify-between">
        <button
          onClick={gc.clearGame}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Games
        </button>

        <GameSwitcher
          games={games}
          selectedGameId={gc.gameId}
          onSelect={gc.setGameId}
        />
      </div>

      {/* Game Header */}
      {selectedGame && (
        <GameHeader game={selectedGame} isMobile={isMobile} />
      )}

      {/* Tab Bar + Global Filters */}
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
        {/* Desktop layout */}
        {!isMobile && (
          <div className="flex items-center gap-3 px-4 py-2.5 overflow-x-auto scrollbar-hide">
            {/* View Tabs */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => gc.setView(tab.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                    gc.view === tab.value
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Slate Insights: Pitcher toggle + Season + Sample */}
            {gc.view === "slate" && selectedGame && (
              <>
                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700/40 shrink-0" />

                {/* Pitcher Toggle — team logos as buttons */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                  <button
                    onClick={() => gc.setPitcher("away")}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                      gc.pitcher === "away"
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    <img src={`/team-logos/mlb/${selectedGame.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
                    {selectedGame.away_team_tricode} Pitching
                  </button>
                  <button
                    onClick={() => gc.setPitcher("home")}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                      gc.pitcher === "home"
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    <img src={`/team-logos/mlb/${selectedGame.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
                    {selectedGame.home_team_tricode} Pitching
                  </button>
                </div>

                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700/40 shrink-0" />

                {/* Season */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                  {SEASON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => gc.setSeason(Number(opt.value))}
                      className={cn(
                        "px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                        gc.season === Number(opt.value)
                          ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                          : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700/40 shrink-0" />

                {/* Sample Range */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                  {SAMPLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => gc.setSample(opt.value)}
                      className={cn(
                        "px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                        gc.sample === opt.value
                          ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                          : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Pitcher Weakness: Season only */}
            {gc.view === "weakness" && (
              <>
                <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700/40 shrink-0" />
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                  {SEASON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => gc.setSeason(Number(opt.value))}
                      className={cn(
                        "px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                        gc.season === Number(opt.value)
                          ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                          : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Mobile layout — stacked */}
        {isMobile && (
          <div className="px-3 py-2.5 space-y-2.5">
            {/* Row 1: View tabs */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 w-full">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => gc.setView(tab.value)}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all text-center",
                    gc.view === tab.value
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500"
                  )}
                >
                  {tab.shortLabel}
                </button>
              ))}
            </div>

            {/* Slate Insights: Pitcher toggle + Season + Sample */}
            {gc.view === "slate" && selectedGame && (
              <>
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 w-full">
                  <button
                    onClick={() => gc.setPitcher("away")}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                      gc.pitcher === "away"
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500"
                    )}
                  >
                    <img src={`/team-logos/mlb/${selectedGame.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
                    {selectedGame.away_team_tricode}
                  </button>
                  <button
                    onClick={() => gc.setPitcher("home")}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                      gc.pitcher === "home"
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500"
                    )}
                  >
                    <img src={`/team-logos/mlb/${selectedGame.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
                    {selectedGame.home_team_tricode}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                    {SEASON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => gc.setSeason(Number(opt.value))}
                        className={cn(
                          "px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                          gc.season === Number(opt.value)
                            ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                            : "text-neutral-500"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                    {SAMPLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => gc.setSample(opt.value)}
                        className={cn(
                          "px-1.5 py-1 rounded-md text-[10px] font-semibold transition-all",
                          gc.sample === opt.value
                            ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                            : "text-neutral-500"
                        )}
                      >
                        {opt.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Pitcher Weakness: Season only */}
            {gc.view === "weakness" && (
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                {SEASON_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => gc.setSeason(Number(opt.value))}
                    className={cn(
                      "px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                      gc.season === Number(opt.value)
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active View */}
      {gc.view === "slate" && (
        <MlbBatterVsPitcher
          externalGameId={gc.gameId}
          externalSeason={gc.season}
          externalSample={gc.sample}
          externalBattingSide={gc.battingSide as "home" | "away"}
          embedded
        />
      )}
      {gc.view === "weakness" && (
        <MlbPitcherWeakness
          externalGameId={gc.gameId}
          externalSeason={gc.season}
          embedded
        />
      )}
      {gc.view === "correlations" && gc.gameId && selectedGame && (
        <CorrelationsView
          gameId={gc.gameId}
          gameTeams={[selectedGame.away_team_tricode, selectedGame.home_team_tricode]}
          pitcherHand={
            gc.pitcher === "away"
              ? selectedGame.away_probable_pitcher?.includes("(L)") ? "L" : "R"
              : selectedGame.home_probable_pitcher?.includes("(L)") ? "L" : "R"
          }
        />
      )}
      {gc.view === "weather" && gc.gameId && (
        <WeatherView gameId={gc.gameId} />
      )}
    </div>
  );
}
