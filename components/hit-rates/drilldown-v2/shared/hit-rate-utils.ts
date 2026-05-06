import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

// Pull the relevant stat for a given market out of a box-score game. Used when
// recomputing hit rates client-side against a custom line.
export function getMarketStatValue(game: BoxScoreGame, market: string): number {
  switch (market) {
    case "player_points":
      return game.pts;
    case "player_rebounds":
      return game.reb;
    case "player_assists":
      return game.ast;
    case "player_threes_made":
      return game.fg3m;
    case "player_steals":
      return game.stl;
    case "player_blocks":
      return game.blk;
    case "player_turnovers":
      return game.tov;
    case "player_points_rebounds_assists":
      return game.pra;
    case "player_points_rebounds":
      return game.pr;
    case "player_points_assists":
      return game.pa;
    case "player_rebounds_assists":
      return game.ra;
    case "player_blocks_steals":
      return game.bs;
    default:
      return 0;
  }
}

export interface HitRateBuckets {
  last5Pct: number | null;
  last5Sample: number;
  last10Pct: number | null;
  last10Sample: number;
  last20Pct: number | null;
  last20Sample: number;
  seasonPct: number | null;
  seasonSample: number | null;
  h2hPct: number | null;
  h2hSample: number | null;
}

// Compute hit rates for L5/L10/L20/season/H2H against an arbitrary line. Used
// when the user adjusts the line via the stepper — server-side rates are only
// valid for the prop's default line.
export function computeHitRates(
  games: BoxScoreGame[],
  market: string,
  line: number,
  opponentTeamId: number | null
): HitRateBuckets {
  // Newest game first — date is YYYY-MM-DD so a string sort works.
  const sortedGames = [...games].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const bucket = (subset: BoxScoreGame[]): { pct: number | null; sample: number } => {
    if (subset.length === 0) return { pct: null, sample: 0 };
    const hits = subset.filter((g) => getMarketStatValue(g, market) >= line).length;
    return { pct: (hits / subset.length) * 100, sample: subset.length };
  };

  const l5 = bucket(sortedGames.slice(0, 5));
  const l10 = bucket(sortedGames.slice(0, 10));
  const l20 = bucket(sortedGames.slice(0, 20));
  const season = bucket(sortedGames);
  const h2h = opponentTeamId
    ? bucket(sortedGames.filter((g) => g.opponentTeamId === opponentTeamId))
    : { pct: null, sample: 0 };

  return {
    last5Pct: l5.pct,
    last5Sample: l5.sample,
    last10Pct: l10.pct,
    last10Sample: l10.sample,
    last20Pct: l20.pct,
    last20Sample: l20.sample,
    seasonPct: season.pct,
    seasonSample: season.sample,
    h2hPct: h2h.pct,
    h2hSample: h2h.sample,
  };
}
