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

export type MetricFilterCategory =
  | "opportunity"
  | "shooting"
  | "rebounding"
  | "scoring"
  | "discipline";

export interface MetricFilterConfig {
  key: string;
  label: string;
  shortLabel: string;
  category: MetricFilterCategory;
  description: string;
  step: number;
  isPercentage?: boolean;
  getValue: (game: BoxScoreGame) => number | null | undefined;
}

export interface PlayTypeDefenseQuickFilter {
  playType: string;
  label: string;
  rankByOpponentAbbr: Map<string, number>;
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
  /** Tonight's opponent team_id. When provided alongside dvpRankByOpponent,
   *  the inline picker surfaces a SHARPER DvP tier (Top 5 / Bottom 5) when
   *  the opponent is in the extreme. */
  tonightOpponentTeamId?: number | null;
  /** Optional NBA team play-type defense ranks. Drives v1-style tough/avg/soft
   *  opponent filters by the opponent faced in each historical game. */
  playTypeDefenseFilters?: PlayTypeDefenseQuickFilter[];
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

// Set of every gameId that is either night of a back-to-back pair (games
// played on consecutive calendar days). Previously only the second night
// was flagged since `daysRest === 0` only marks the rested-zero game; this
// also adds the first night so the B2B chip surfaces both halves.
function computeB2bGameIds(games: BoxScoreGame[]): Set<string> {
  const sorted = [...games]
    .filter((g) => !!g.date)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const ids = new Set<string>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1].date}T00:00:00Z`);
    const curr = new Date(`${sorted[i].date}T00:00:00Z`);
    if (Number.isNaN(prev.getTime()) || Number.isNaN(curr.getTime())) continue;
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      ids.add(sorted[i - 1].gameId);
      ids.add(sorted[i].gameId);
    }
  }
  return ids;
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

function normalizePercentValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value <= 1 ? value * 100 : value;
}

export const METRIC_FILTERS: MetricFilterConfig[] = [
  {
    key: "minutes",
    label: "Minutes",
    shortLabel: "MIN",
    category: "opportunity",
    description: "Minutes played",
    step: 1,
    getValue: (g) => g.minutes,
  },
  {
    key: "usage",
    label: "Usage",
    shortLabel: "USG%",
    category: "opportunity",
    description: "Share of team possessions used",
    step: 1,
    isPercentage: true,
    getValue: (g) => normalizePercentValue(g.usagePct),
  },
  {
    key: "potentialReb",
    label: "Rebound Chances",
    shortLabel: "REB CH",
    category: "opportunity",
    description: "Tracked rebound opportunities",
    step: 1,
    getValue: (g) => g.potentialReb,
  },
  {
    key: "potentialAssists",
    label: "Potential Assists",
    shortLabel: "POT AST",
    category: "opportunity",
    description: "Passes that could become assists",
    step: 1,
    getValue: (g) => g.potentialAssists,
  },
  {
    key: "fga",
    label: "FGA",
    shortLabel: "FGA",
    category: "shooting",
    description: "Field goal attempts",
    step: 1,
    getValue: (g) => g.fga,
  },
  {
    key: "fgm",
    label: "FGM",
    shortLabel: "FGM",
    category: "shooting",
    description: "Field goals made",
    step: 1,
    getValue: (g) => g.fgm,
  },
  {
    key: "fgPct",
    label: "FG%",
    shortLabel: "FG%",
    category: "shooting",
    description: "Field goal percentage",
    step: 1,
    isPercentage: true,
    getValue: (g) => normalizePercentValue(g.fgPct),
  },
  {
    key: "fg3a",
    label: "3PA",
    shortLabel: "3PA",
    category: "shooting",
    description: "Three-point attempts",
    step: 1,
    getValue: (g) => g.fg3a,
  },
  {
    key: "fg3Pct",
    label: "3P%",
    shortLabel: "3P%",
    category: "shooting",
    description: "Three-point percentage",
    step: 1,
    isPercentage: true,
    getValue: (g) => normalizePercentValue(g.fg3Pct),
  },
  {
    key: "ftm",
    label: "FTM",
    shortLabel: "FTM",
    category: "scoring",
    description: "Free throws made",
    step: 1,
    getValue: (g) => g.ftm,
  },
  {
    key: "points",
    label: "Points",
    shortLabel: "PTS",
    category: "scoring",
    description: "Total points",
    step: 1,
    getValue: (g) => g.pts,
  },
  {
    key: "oreb",
    label: "Offensive Rebounds",
    shortLabel: "OREB",
    category: "rebounding",
    description: "Offensive rebounds",
    step: 1,
    getValue: (g) => g.oreb,
  },
  {
    key: "dreb",
    label: "Defensive Rebounds",
    shortLabel: "DREB",
    category: "rebounding",
    description: "Defensive rebounds",
    step: 1,
    getValue: (g) => g.dreb,
  },
  {
    key: "fouls",
    label: "Fouls",
    shortLabel: "PF",
    category: "discipline",
    description: "Personal fouls",
    step: 1,
    getValue: (g) => g.fouls,
  },
];

// Virtual metric config for opponent DvP rank. Lives outside METRIC_FILTERS
// because its value isn't per-game (it's a season-long opponent ranking
// looked up via QuickFilterContext.dvpRankByOpponent), so the drawer's
// generic stat sliders can't display it. Used only by the inline DEF
// popover in the chart header.
export const DVP_RANK_CONFIG: MetricFilterConfig = {
  key: "dvpRank",
  label: "Opp Defense Rank",
  shortLabel: "DEF",
  category: "opportunity",
  description: "Opp def rank vs position (1 = toughest)",
  step: 1,
  // Returning null is fine — the popover gets its values via a custom
  // getValue closure that captures the dvpRankByOpponent map.
  getValue: () => null,
};

function formatMetricIdValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function metricFilterId(key: string, min: number, max?: number): string {
  const normalizedMin = formatMetricIdValue(min);
  if (max !== undefined) {
    return `metric:${key}:range:${normalizedMin}:${formatMetricIdValue(max)}`;
  }
  return `metric:${key}:gte:${normalizedMin}`;
}

export function parseMetricFilterId(
  id: string
): { key: string; min: number; max: number | null } | null {
  const range = /^metric:([^:]+):range:(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)$/.exec(id);
  if (range) {
    const min = Number(range[2]);
    const max = Number(range[3]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { key: range[1], min: Math.min(min, max), max: Math.max(min, max) };
  }
  const gte = /^metric:([^:]+):gte:(-?\d+(?:\.\d+)?)$/.exec(id);
  if (!gte) return null;
  const min = Number(gte[2]);
  if (!Number.isFinite(min)) return null;
  return { key: gte[1], min, max: null };
}

export function buildMetricQuickFilter(
  config: MetricFilterConfig,
  range: { min: number; max: number | null }
): QuickFilter {
  const format = (value: number) =>
    config.isPercentage ? `${Math.round(value)}%` : formatMetricIdValue(value);
  const valueLabel =
    range.max === null
      ? `${format(range.min)}+`
      : `${format(range.min)}-${format(range.max)}`;
  return {
    id:
      range.max === null
        ? metricFilterId(config.key, range.min)
        : metricFilterId(config.key, range.min, range.max),
    label: `${config.shortLabel} ${valueLabel}`,
    predicate: (game) => {
      const value = config.getValue(game);
      if (value === null || value === undefined || !Number.isFinite(value)) return false;
      if (range.max === null) return value >= range.min;
      return value >= range.min && value <= range.max;
    },
  };
}

export function resolveQuickFilter(
  id: string,
  filters: QuickFilter[],
  ctx?: QuickFilterContext
): QuickFilter | null {
  const existing = filters.find((f) => f.id === id);
  if (existing) return existing;

  const metric = parseMetricFilterId(id);
  if (metric) {
    // Special-case opp DvP rank — it's not a per-game stat (needs the
    // opponent map from context). Build the predicate inline using the map
    // so this id flows through the same `metric:KEY:range:MIN:MAX` pipeline
    // the threshold metrics use.
    if (metric.key === "dvpRank" && ctx?.dvpRankByOpponent) {
      const ranks = ctx.dvpRankByOpponent;
      const min = metric.min;
      const max = metric.max;
      const label =
        max === null
          ? `Top ${Math.round(min)} D`
          : `D #${Math.round(min)}-${Math.round(max)}`;
      return {
        id,
        label,
        predicate: (g) => {
          const rank = ranks.get(g.opponentTeamId);
          if (rank == null) return false;
          if (max === null) return rank <= min;
          return rank >= min && rank <= max;
        },
      };
    }
    const config = METRIC_FILTERS.find((f) => f.key === metric.key);
    return config ? buildMetricQuickFilter(config, metric) : null;
  }

  if (id.startsWith("playType:") && ctx?.playTypeDefenseFilters) {
    const [, encodedPlayType, tier] = id.split(":");
    const playType = decodeURIComponent(encodedPlayType ?? "");
    const source = ctx.playTypeDefenseFilters.find((f) => f.playType === playType);
    if (!source || !["tough", "neutral", "favorable"].includes(tier ?? "")) return null;
    const label =
      tier === "tough" ? "Top 10" : tier === "favorable" ? "Bottom 10" : "Mid";
    return {
      id,
      label: `${source.label} ${label}`,
      predicate: (game) => {
        const rank = source.rankByOpponentAbbr.get(game.opponentAbbr);
        if (rank == null) return false;
        if (tier === "tough") return rank <= 10;
        if (tier === "favorable") return rank >= 21;
        return rank > 10 && rank < 21;
      },
    };
  }

  return null;
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
  // Set of game ids that are EITHER half of a back-to-back pair (the night
  // before AND the second-night game). Previously we only flagged the
  // second game (where rest=0), so 1/11 wouldn't show even though 1/12 was
  // its B2B pair. Marking both lets users compare both nights side-by-side.
  const b2bGameIds = computeB2bGameIds(recentGames);
  if (daysRestById.size > 0) {
    filters.push(
      {
        id: "b2b",
        label: "Back-to-Back",
        // Either night of a back-to-back pair (consecutive calendar days).
        predicate: (g) => b2bGameIds.has(g.gameId),
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
  // Top 5 / Bottom 5 are sharper subsets that only render when the league
  // has enough teams to make the tier meaningful (NBA 30 ✓, WNBA 13 ✗).
  if (ctx.dvpRankByOpponent && ctx.dvpRankByOpponent.size > 0) {
    const total = ctx.totalTeams ?? 30;
    const toughCutoff = Math.max(3, Math.round(total / 3)); // top third
    const weakCutoff = total - Math.max(3, Math.round(total / 3)) + 1; // bottom third
    const ranks = ctx.dvpRankByOpponent;
    if (total >= 20) {
      filters.push({
        id: "dvpTopFive",
        label: "Top 5 D",
        predicate: (g) => {
          const rank = ranks.get(g.opponentTeamId);
          return rank != null && rank >= 1 && rank <= 5;
        },
      });
    }
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
    if (total >= 20) {
      filters.push({
        id: "dvpBottomFive",
        label: "Bottom 5 D",
        predicate: (g) => {
          const rank = ranks.get(g.opponentTeamId);
          return rank != null && rank >= total - 4;
        },
      });
    }
  }

  if (ctx.playTypeDefenseFilters && ctx.playTypeDefenseFilters.length > 0) {
    for (const playType of ctx.playTypeDefenseFilters) {
      const encoded = encodeURIComponent(playType.playType);
      filters.push(
        {
          id: `playType:${encoded}:tough`,
          label: `${playType.label} Top 10`,
          predicate: (g) => {
            const rank = playType.rankByOpponentAbbr.get(g.opponentAbbr);
            return rank != null && rank <= 10;
          },
        },
        {
          id: `playType:${encoded}:neutral`,
          label: `${playType.label} Mid`,
          predicate: (g) => {
            const rank = playType.rankByOpponentAbbr.get(g.opponentAbbr);
            return rank != null && rank > 10 && rank < 21;
          },
        },
        {
          id: `playType:${encoded}:favorable`,
          label: `${playType.label} Bottom 10`,
          predicate: (g) => {
            const rank = playType.rankByOpponentAbbr.get(g.opponentAbbr);
            return rank != null && rank >= 21;
          },
        }
      );
    }
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

  // Always-on, market-aware base set: minutes / volume / venue. DvP tiers
  // are handled separately below so we can pick the SHARPEST tier for the
  // tonight's opponent when applicable (Top 5 D vs the broader Top 10 D).
  const alwaysPrefixes = [
    "minutes",
    "fga",
    "threePtA",
    "potAst",
    "rebChances",
    "ast",
    "venue",
  ];
  for (const f of filters) {
    if (alwaysPrefixes.some((p) => f.id.startsWith(p))) include(f);
  }

  // DvP tier — show the broad Top/Avg/Bottom trio always, but UPGRADE to
  // Top 5 / Bottom 5 when tonight's opponent is in the extreme. Rendering
  // both Top 10 and Top 5 would be redundant — the sharper one wins.
  const total = ctx.totalTeams ?? 30;
  const oppRank =
    ctx.tonightOpponentTeamId != null
      ? (ctx.dvpRankByOpponent?.get(ctx.tonightOpponentTeamId) ?? null)
      : null;
  const showTopFive = total >= 20 && oppRank !== null && oppRank <= 5;
  const showBottomFive = total >= 20 && oppRank !== null && oppRank >= total - 4;
  for (const f of filters) {
    if (!f.id.startsWith("dvp")) continue;
    // Suppress the broad tier when its sharper sibling is being shown.
    if (f.id === "dvpTough" && showTopFive) continue;
    if (f.id === "dvpWeak" && showBottomFive) continue;
    // Only include sharper tiers when they actually fit the matchup.
    if (f.id === "dvpTopFive" && !showTopFive) continue;
    if (f.id === "dvpBottomFive" && !showBottomFive) continue;
    include(f);
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
