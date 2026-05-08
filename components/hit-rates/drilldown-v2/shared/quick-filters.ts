import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

// Per-market quick filters that appear as chips under the chart's Splits row.
// Each filter has a predicate over BoxScoreGame; multiple active filters
// compose with AND (a game must match every active predicate to render).
//
// Thresholds are PLAYER-RELATIVE — computed from the recent box-score
// distribution so a 4-FGA-per-game wing doesn't get a useless "15+ FGA"
// chip and a 30-PPG star doesn't get a meaningless "10+ FGA" one. Filters
// only appear when the threshold is high enough to actually slice the data.
export interface QuickFilter {
  id: string;
  label: string;
  predicate: (game: BoxScoreGame) => boolean;
}

export interface QuickFilterContext {
  market: string;
  /** "H"/"A" or "home"/"away" — drives whether the venue chip pins to Home
   *  or Away for the player's upcoming game. Case-insensitive. */
  upcomingHomeAway: string | null | undefined;
  /** Recent games used to compute player-relative thresholds. Should be the
   *  full available box-score window (typically L20-L100). */
  recentGames: BoxScoreGame[];
  /** Opponent_team_id → DvP rank for the player's POSITION on the active
   *  market. Lower rank = tougher defense (1 = #1 D vs PTS for PFs etc.).
   *  When provided, three defense-tier quick filters render. */
  dvpRankByOpponent?: Map<number, number>;
  /** Total teams in the league — used to scale the tier thresholds (NBA = 30,
   *  WNBA = 13). Defaults to 30 if absent. */
  totalTeams?: number;
  /** Tonight's game date (YYYY-MM-DD) — drives the day-of-week chip and
   *  the "days rest tonight" tier surfaced inline. */
  tonightDate?: string | null;
  /** Tonight's spread for the player's team (positive = underdog, negative
   *  = favorite). Drives whether Close or Blowout is the contextual chip. */
  tonightSpread?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

// Days-of-rest before each game in the window. Sort ascending by date,
// diff consecutive game dates, and key by gameId for predicate lookups.
function computeDaysRestMap(games: BoxScoreGame[]): Map<string, number> {
  const sorted = [...games]
    .filter((g) => !!g.date)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const map = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1].date}T00:00:00Z`);
    const curr = new Date(`${sorted[i].date}T00:00:00Z`);
    if (Number.isNaN(prev.getTime()) || Number.isNaN(curr.getTime())) continue;
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000) - 1;
    map.set(sorted[i].gameId, Math.max(0, diff));
  }
  return map;
}

// Day of week (0=Sun, 6=Sat) — null when the date is missing/unparsable.
function parseDayOfWeek(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

function avg(games: BoxScoreGame[], extract: (g: BoxScoreGame) => number): number {
  if (games.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const g of games) {
    const v = extract(g);
    if (Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

// Pick a "high-side" threshold for a stat from the player's average. The
// multiplier overshoots by ~25% so the chip captures genuinely above-typical
// games; rounding keeps the label readable.
function pickThreshold(playerAvg: number, opts?: { multiplier?: number; min?: number }): number | null {
  const m = opts?.multiplier ?? 1.25;
  const target = playerAvg * m;
  if (target < (opts?.min ?? 2)) return null;
  if (target >= 25) return Math.round(target / 5) * 5; // 25, 30, 35...
  if (target >= 10) return Math.round(target / 2) * 2; // 10, 12, 14...
  return Math.max(opts?.min ?? 2, Math.round(target));
}

// Minutes threshold is its own thing — clipped to ranges (~25/28/30/32/35)
// so the chip reads like a recognizable role tier ("Started? Played heavy?")
// rather than an arbitrary number.
function pickMinutesThreshold(avgMin: number): number | null {
  if (avgMin < 18) return null; // bench player, "30+ Min" would empty the chart
  if (avgMin >= 34) return 36;
  if (avgMin >= 30) return 32;
  if (avgMin >= 25) return 28;
  return 25;
}

const venueChip = (upcomingHomeAway: string | null | undefined): QuickFilter | null => {
  const v = (upcomingHomeAway ?? "").trim().toLowerCase();
  // Normalize the upstream value — APIs ship a mix of "H"/"A", "home"/"away",
  // and 1/0. Anything that doesn't decode is treated as "no venue context".
  const isHome = v === "h" || v === "home" || v === "1" || v === "true";
  const isAway = v === "a" || v === "away" || v === "0" || v === "false";
  if (isHome) {
    return {
      id: "venueHome",
      label: "Home",
      predicate: (g) => g.homeAway === "H",
    };
  }
  if (isAway) {
    return {
      id: "venueAway",
      label: "Away",
      predicate: (g) => g.homeAway === "A",
    };
  }
  return null;
};

// ── Per-market filter sets ───────────────────────────────────────────────

export function getQuickFilters(ctx: QuickFilterContext): QuickFilter[] {
  const { market, upcomingHomeAway, recentGames } = ctx;
  const filters: QuickFilter[] = [];

  // Minutes filter — relevant for any market where minutes drive opportunity.
  // Skipped for 1Q markets (Q1 minutes are capped) and Q1 stats already.
  const isQ1 = market.startsWith("1st_quarter_player_");
  if (!isQ1) {
    const avgMin = avg(recentGames, (g) => g.minutes ?? 0);
    const minThreshold = pickMinutesThreshold(avgMin);
    if (minThreshold !== null) {
      filters.push({
        id: `minutes${minThreshold}`,
        label: `${minThreshold}+ Min`,
        predicate: (g) => (g.minutes ?? 0) >= minThreshold,
      });
    }
  }

  // Market-specific volume filter — threshold scales with the player's
  // recent average of that volume metric.
  switch (market) {
    case "player_points":
    case "player_points_rebounds_assists":
    case "player_points_assists":
    case "player_points_rebounds":
    case "player_double_double":
    case "player_triple_double": {
      const avgFga = avg(recentGames, (g) => g.fga ?? 0);
      const t = pickThreshold(avgFga, { min: 4 });
      if (t !== null) {
        filters.push({
          id: `fga${t}`,
          label: `${t}+ FGA`,
          predicate: (g) => (g.fga ?? 0) >= t,
        });
      }
      break;
    }
    case "player_rebounds":
    case "player_rebounds_assists": {
      const avgPot = avg(recentGames, (g) => g.potentialReb ?? 0);
      const t = pickThreshold(avgPot, { min: 3 });
      if (t !== null) {
        filters.push({
          id: `rebChances${t}`,
          label: `${t}+ REB Chances`,
          predicate: (g) => (g.potentialReb ?? 0) >= t,
        });
      }
      break;
    }
    case "player_assists": {
      const avgPot = avg(recentGames, (g) => g.potentialAssists ?? 0);
      const t = pickThreshold(avgPot, { min: 3 });
      if (t !== null) {
        filters.push({
          id: `potAst${t}`,
          label: `${t}+ Pot AST`,
          predicate: (g) => (g.potentialAssists ?? 0) >= t,
        });
      }
      break;
    }
    case "player_threes_made": {
      const avg3pa = avg(recentGames, (g) => g.fg3a ?? 0);
      const t = pickThreshold(avg3pa, { min: 2 });
      if (t !== null) {
        filters.push({
          id: `threePtA${t}`,
          label: `${t}+ 3PA`,
          predicate: (g) => (g.fg3a ?? 0) >= t,
        });
      }
      break;
    }
    case "player_turnovers": {
      const avgAst = avg(recentGames, (g) => g.ast ?? 0);
      const t = pickThreshold(avgAst, { min: 3 });
      if (t !== null) {
        filters.push({
          id: `ast${t}`,
          label: `${t}+ AST`,
          predicate: (g) => (g.ast ?? 0) >= t,
        });
      }
      break;
    }
    case "player_steals":
    case "player_blocks":
    case "player_blocks_steals":
      // No clean volume proxy that adds signal; minutes filter above is enough.
      break;
    default:
      break;
  }

  // Game context filters — derived from box-score margin/date and apply to
  // every market. Blowouts are directional (won by 15+ vs lost by 15+) so
  // the chip semantically matches what the spread says about tonight: a
  // favored team's blowout means *they* blew the opponent out.
  filters.push(
    {
      id: "closeGame",
      label: "Close (≤5)",
      predicate: (g) => Math.abs(g.margin ?? 0) <= 5,
    },
    {
      id: "wonBy15",
      label: "Won by 15+",
      predicate: (g) => g.result === "W" && (g.margin ?? 0) >= 15,
    },
    {
      id: "lostBy15",
      label: "Lost by 15+",
      predicate: (g) => g.result === "L" && (g.margin ?? 0) <= -15,
    }
  );

  // Days rest / B2B — precompute date diffs for the recent games so each
  // predicate is one Map lookup. First game in the window has no prior game
  // to diff against and is excluded from rest filters.
  const daysRestById = computeDaysRestMap(recentGames);
  if (daysRestById.size > 0) {
    filters.push(
      {
        id: "b2b",
        label: "Back-to-Back",
        // Consecutive calendar days = zero rest days between games.
        predicate: (g) => daysRestById.get(g.gameId) === 0,
      },
      {
        id: "rest2plus",
        label: "2+ Days Rest",
        predicate: (g) => {
          const d = daysRestById.get(g.gameId);
          return d !== undefined && d >= 2;
        },
      },
      {
        id: "rest3plus",
        label: "3+ Days Rest",
        predicate: (g) => {
          const d = daysRestById.get(g.gameId);
          return d !== undefined && d >= 3;
        },
      }
    );
  }

  // One chip per specific day of week. The inline-filter picker surfaces
  // ONLY the day matching tonight's game (e.g. "Thursday" if tonight is
  // a Thursday); the rest live in the dropdown.
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (let i = 0; i < 7; i++) {
    filters.push({
      id: `dow${i}`,
      label: dayNames[i],
      predicate: (g) => parseDayOfWeek(g.date) === i,
    });
  }

  // Defense-vs-position tiers — only render when DvP data is available for
  // this player's position on the active market. Lower rank = tougher D.
  if (ctx.dvpRankByOpponent && ctx.dvpRankByOpponent.size > 0) {
    const total = ctx.totalTeams ?? 30;
    const toughCutoff = Math.max(3, Math.round(total / 3)); // top third
    const weakCutoff = total - Math.max(3, Math.round(total / 3)) + 1; // bottom third
    const ranks = ctx.dvpRankByOpponent;
    filters.push({
      id: "dvpTough",
      label: `Top ${toughCutoff} D`,
      predicate: (g) => {
        const rank = ranks.get(g.opponentTeamId);
        return rank != null && rank >= 1 && rank <= toughCutoff;
      },
    });
    filters.push({
      id: "dvpAvg",
      label: "Avg D",
      predicate: (g) => {
        const rank = ranks.get(g.opponentTeamId);
        return rank != null && rank > toughCutoff && rank < weakCutoff;
      },
    });
    filters.push({
      id: "dvpWeak",
      label: `Bottom ${total - weakCutoff + 1} D`,
      predicate: (g) => {
        const rank = ranks.get(g.opponentTeamId);
        return rank != null && rank >= weakCutoff;
      },
    });
  }

  const venue = venueChip(upcomingHomeAway);
  if (venue) filters.push(venue);

  return filters;
}

// Picks the subset of quick filters worth showing inline above the chart.
// Includes always-relevant chips (minutes / volume / venue / DvP) plus the
// ONE option from each contextual category (day-of-week, days-rest, game-
// flow) that actually matches tonight's matchup. Everything else lives in
// the popover so the inline row stays focused and not overwhelming.
export function getInlineQuickFilters(
  filters: QuickFilter[],
  ctx: QuickFilterContext
): QuickFilter[] {
  const inline: QuickFilter[] = [];
  const seen = new Set<string>();
  const include = (f: QuickFilter | undefined) => {
    if (f && !seen.has(f.id)) {
      inline.push(f);
      seen.add(f.id);
    }
  };

  // Always-on, market-aware base set: minutes / volume / venue / DvP tiers.
  const alwaysPrefixes = [
    "minutes",
    "fga",
    "threePtA",
    "potAst",
    "rebChances",
    "ast",
    "venue",
    "dvp",
  ];
  for (const f of filters) {
    if (alwaysPrefixes.some((p) => f.id.startsWith(p))) include(f);
  }

  // Day of week — surface only tonight's day.
  const tonightDay = parseDayOfWeek(ctx.tonightDate);
  if (tonightDay !== null) {
    include(filters.find((f) => f.id === `dow${tonightDay}`));
  }

  // Days rest tonight — only the matching tier (B2B / 2+ / 3+).
  const tonightRest = computeTonightDaysRest(ctx.recentGames, ctx.tonightDate);
  if (tonightRest !== null) {
    if (tonightRest === 0) include(filters.find((f) => f.id === "b2b"));
    else if (tonightRest >= 3) include(filters.find((f) => f.id === "rest3plus"));
    else if (tonightRest >= 2) include(filters.find((f) => f.id === "rest2plus"));
  }

  // Spread context — books project a Close or Blowout outcome. Blowout chip
  // is directional: favored team (negative spread) gets "Won by 15+";
  // underdog (positive spread) gets "Lost by 15+". Mirrors what tonight's
  // spread literally implies about the team's expected result.
  const spread = ctx.tonightSpread ?? null;
  if (spread !== null) {
    const spreadAbs = Math.abs(spread);
    if (spreadAbs <= 5) {
      include(filters.find((f) => f.id === "closeGame"));
    } else if (spreadAbs >= 10) {
      const isFavored = spread < 0;
      include(filters.find((f) => f.id === (isFavored ? "wonBy15" : "lostBy15")));
    }
  }

  return inline;
}

// Days rest tonight — diff between the player's most recent box-score date
// and tonight's game date, minus 1 (so consecutive days = 0 = B2B).
function computeTonightDaysRest(
  recentGames: BoxScoreGame[],
  tonightDate: string | null | undefined
): number | null {
  if (!tonightDate) return null;
  const sorted = [...recentGames]
    .filter((g) => !!g.date)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const last = sorted[0];
  if (!last?.date) return null;
  const prev = new Date(`${last.date}T00:00:00Z`);
  const curr = new Date(`${tonightDate}T00:00:00Z`);
  if (Number.isNaN(prev.getTime()) || Number.isNaN(curr.getTime())) return null;
  const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000) - 1;
  return Math.max(0, diff);
}

// Maps a market to the corresponding rank field name on a DvP team ranking
// row. Returns null when the market has no DvP rank field (combos that
// aren't tracked separately, etc.) so the chart skips DvP filters cleanly.
export function dvpRankFieldForMarket(market: string): string | null {
  switch (market) {
    case "player_points":
      return "ptsRank";
    case "player_rebounds":
      return "rebRank";
    case "player_assists":
      return "astRank";
    case "player_threes_made":
      return "fg3mRank";
    case "player_steals":
      return "stlRank";
    case "player_blocks":
      return "blkRank";
    case "player_turnovers":
      return "tovRank";
    case "player_points_rebounds_assists":
      return "praRank";
    case "player_points_rebounds":
      return "prRank";
    case "player_points_assists":
      return "paRank";
    case "player_rebounds_assists":
      return "raRank";
    case "player_blocks_steals":
      return "bsRank";
    default:
      return null;
  }
}
