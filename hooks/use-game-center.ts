"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export type GameCenterView = "slate" | "weakness" | "correlations" | "weather";
export type GameCenterSample = "season" | "30" | "15" | "7";

export interface GameCenterState {
  gameId: number | null;
  view: GameCenterView;
  season: number;
  sample: GameCenterSample;
  pitcher: "away" | "home";
}

const DEFAULT_SEASON = () => {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

export function useGameCenter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state: GameCenterState = useMemo(() => {
    const gameParam = searchParams.get("game");
    const viewParam = searchParams.get("view");
    const seasonParam = searchParams.get("season");
    const sampleParam = searchParams.get("range");
    const pitcherParam = searchParams.get("pitcher");

    return {
      gameId: gameParam ? Number(gameParam) : null,
      view: (["weakness", "correlations", "weather"].includes(viewParam ?? "") ? viewParam : "slate") as GameCenterView,
      season: seasonParam ? Number(seasonParam) : DEFAULT_SEASON(),
      sample: (["season", "30", "15", "7"].includes(sampleParam ?? "") ? sampleParam : "season") as GameCenterSample,
      pitcher: (pitcherParam === "home" ? "home" : "away") as "away" | "home",
    };
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: Partial<Record<string, string | null>>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val == null) {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setGameId = useCallback(
    (id: number) => updateParams({ game: String(id) }),
    [updateParams]
  );

  const clearGame = useCallback(
    () => updateParams({ game: null, view: null, season: null, range: null, pitcher: null }),
    [updateParams]
  );

  const setView = useCallback(
    (view: GameCenterView) =>
      updateParams({ view: view === "slate" ? null : view }),
    [updateParams]
  );

  const setSeason = useCallback(
    (season: number) => {
      const def = DEFAULT_SEASON();
      updateParams({ season: season === def ? null : String(season) });
    },
    [updateParams]
  );

  const setSample = useCallback(
    (sample: GameCenterSample) =>
      updateParams({ range: sample === "season" ? null : sample }),
    [updateParams]
  );

  const setPitcher = useCallback(
    (pitcher: "away" | "home") =>
      updateParams({ pitcher: pitcher === "away" ? null : pitcher }),
    [updateParams]
  );

  // Derived: batting side is opposite of pitcher toggle
  const battingSide = state.pitcher === "away" ? "home" : "away";

  return {
    ...state,
    battingSide,
    setGameId,
    clearGame,
    setView,
    setSeason,
    setSample,
    setPitcher,
  };
}
