"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Clock3,
  ExternalLink,
  Flame,
  Info,
  HeartPulse,
  LineChart as LineChartIcon,
  Loader2,
  Rows3,
  Search,
  ShieldCheck,
  Target,
  Trophy,
  X,
  ArrowDown,
  SlidersHorizontal,
  Check,
  User,
} from "lucide-react";
import Chart from "@/icons/chart";
// Disabled: usePrefetchPlayer was causing excessive API calls on hover
// import { usePrefetchPlayer } from "@/hooks/use-prefetch-player";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { OddsDropdown } from "@/components/hit-rates/odds-dropdown";
import {
  InjuryReportTooltipContent,
  hasReportableInjury,
  isGLeagueAssignment,
} from "@/components/hit-rates/injury-report-tooltip";
import { Popover } from "@/components/popover";
import { LineHistoryDialog } from "@/components/opportunities/line-history-dialog";
import type { LineHistoryContext } from "@/lib/odds/line-history";
// MiniSparkline removed - using color-coded percentage cells instead for performance
import { HitRateProfile } from "@/lib/hit-rates-schema";
import {
  usePlayerBoxScores,
  type BoxScoreGame,
} from "@/hooks/use-player-box-scores";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import {
  getTeamLogoUrl,
  getStandardAbbreviation,
} from "@/lib/data/team-mappings";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getHitRateTableConfig } from "@/lib/hit-rates/table-config";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getDvpRankBucket,
  getDvpRankRanges,
  getDvpTeamCount,
} from "@/lib/dvp-rank-scale";

// Map of combo market keys to their full descriptions (only abbreviated combos need tooltips)
const COMBO_MARKET_DESCRIPTIONS: Record<string, string> = {
  player_points_rebounds_assists: "Points + Rebounds + Assists",
  player_points_rebounds: "Points + Rebounds",
  player_points_assists: "Points + Assists",
  player_rebounds_assists: "Rebounds + Assists",
};

// Check if a market is a combo market that needs a tooltip
const getMarketTooltip = (market: string): string | null => {
  return COMBO_MARKET_DESCRIPTIONS[market] || null;
};

const isBinaryOddsMarket = (market: string | null | undefined) =>
  market === "player_double_double" || market === "player_triple_double";

const hasTableOdds = (row: HitRateProfile) =>
  !!row.bestOdds ||
  (isBinaryOddsMarket(row.market) && !!row.eventId && !!(row.selKey ?? row.oddsSelectionId));

type SortField =
  | "line"
  | "l5Avg"
  | "l10Avg"
  | "seasonAvg"
  | "streak"
  | "l5Pct"
  | "l10Pct"
  | "l20Pct"
  | "seasonPct"
  | "h2hPct"
  | "matchupRank"
  | "paceRank";
type SortDirection = "asc" | "desc";

// Market options for filter
const DEFAULT_MARKET_OPTIONS = [
  { value: "player_points", label: "Points" },
  { value: "player_rebounds", label: "Rebounds" },
  { value: "player_assists", label: "Assists" },
  { value: "1st_quarter_player_points", label: "1Q Points" },
  { value: "1st_quarter_player_rebounds", label: "1Q Rebounds" },
  { value: "1st_quarter_player_assists", label: "1Q Assists" },
  { value: "player_points_rebounds_assists", label: "PRA" },
  { value: "player_points_rebounds", label: "P+R" },
  { value: "player_points_assists", label: "P+A" },
  { value: "player_rebounds_assists", label: "R+A" },
  { value: "player_threes_made", label: "3PM" },
  { value: "player_steals", label: "Steals" },
  { value: "player_blocks", label: "Blocks" },
  { value: "player_blocks_steals", label: "Blk+Stl" },
  { value: "player_double_double", label: "Double Double" },
  { value: "player_triple_double", label: "Triple Double" },
  { value: "player_turnovers", label: "Turnovers" },
];

// Position options for filter
const POSITION_OPTIONS = [
  { value: "PG", label: "Point Guard" },
  { value: "SG", label: "Shooting Guard" },
  { value: "SF", label: "Small Forward" },
  { value: "PF", label: "Power Forward" },
  { value: "C", label: "Center" },
];

// Max matchup rank value (0 = all/disabled)
const MAX_MATCHUP_RANK_LIMIT = 30;

interface HitRateTableProps {
  sport?: "nba" | "mlb" | "wnba";
  rows: HitRateProfile[];
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: HitRateProfile) => void;
  // Pagination props
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  totalCount?: number;
  // Filter props
  selectedMarkets: string[];
  marketOptions?: Array<{ value: string; label: string }>;
  onMarketsChange: (markets: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Sort props
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  // Scroll position restoration
  scrollRef?: React.RefObject<HTMLDivElement>;
  initialScrollTop?: number;
  // Advanced filter props (controlled from parent)
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (value: boolean) => void;
  // Callback to report which profiles have odds
  onOddsAvailabilityChange?: (idsWithOdds: Set<string>) => void;
  // Optional upgrade banner to show after filters (for gated access)
  upgradeBanner?: React.ReactNode;
  // Optional content to render after the table (for blurred preview rows)
  bottomContent?: React.ReactNode;
  // Index after which rows should be blurred (for gated access preview)
  blurAfterIndex?: number;
  // Optional games filter element
  gamesFilter?: React.ReactNode;
}

const formatPercentage = (value: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
};

const formatRoundedPercentage = (value: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
};

const formatOddsPrice = (price: number | null | undefined) => {
  if (price === null || price === undefined) return "—";
  return price > 0 ? `+${price}` : `${price}`;
};

const getPrimaryHitRate = (row: HitRateProfile) =>
  row.last10Pct ?? row.last5Pct ?? row.last20Pct ?? row.seasonPct;

const getHitRateTextColor = (value: number | null | undefined) => {
  if (value === null || value === undefined)
    return "text-neutral-500 dark:text-neutral-400";
  if (value >= 70) return "text-emerald-500 dark:text-emerald-400";
  if (value >= 50) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
};

const getStreakDisplay = (streak: number | null | undefined) => {
  if (streak === null || streak === undefined) return "—";
  if (streak > 0) return `W ${streak}`;
  if (streak < 0) return `L ${Math.abs(streak)}`;
  return "0";
};

const getStreakColor = (streak: number | null | undefined) => {
  if (streak === null || streak === undefined || streak === 0)
    return "text-neutral-500 dark:text-neutral-400";
  return streak > 0
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";
};

const getMarketStatValue = (game: BoxScoreGame, market: string): number => {
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
    case "player_hits":
      return game.mlbHits ?? 0;
    case "player_home_runs":
      return game.mlbHomeRuns ?? 0;
    case "player_runs_scored":
      return game.mlbRunsScored ?? 0;
    case "player_rbi":
      return game.mlbRbi ?? 0;
    case "player_total_bases":
      return game.mlbTotalBases ?? 0;
    case "pitcher_strikeouts":
      return game.mlbPitcherStrikeouts ?? 0;
    case "1st_quarter_player_points":
      return game.q1Pts ?? 0;
    case "1st_quarter_player_rebounds":
      return game.q1Reb ?? 0;
    case "1st_quarter_player_assists":
      return game.q1Ast ?? 0;
    case "player_double_double":
      return countDoubleDigitCategories(game) >= 2 ? 1 : 0;
    case "player_triple_double":
      return countDoubleDigitCategories(game) >= 3 ? 1 : 0;
    default:
      return game.pts;
  }
};

// Count traditional categories (PTS/REB/AST/STL/BLK) at 10+. Mirrors the
// drilldown's countDoubleDigitCategories so DD/TD bars and the chart agree.
const countDoubleDigitCategories = (game: BoxScoreGame): number => {
  let count = 0;
  if ((game.pts ?? 0) >= 10) count++;
  if ((game.reb ?? 0) >= 10) count++;
  if ((game.ast ?? 0) >= 10) count++;
  if ((game.stl ?? 0) >= 10) count++;
  if ((game.blk ?? 0) >= 10) count++;
  return count;
};

// Returns market-relevant efficiency splits for the bar tooltip — e.g. FG/3PT for
// scoring, REB/Potential for rebounds, AST/Potential for assists. Empty array when
// nothing useful is available for the market (steals/blocks/turnovers/MLB markets).
type EfficiencyPart = { value: string; label: string };
const getMarketEfficiencyParts = (
  game: BoxScoreGame,
  market: string,
): EfficiencyPart[] => {
  const fg =
    game.fga > 0 ? { value: `${game.fgm}/${game.fga}`, label: "FG" } : null;
  const fg3 =
    game.fg3a > 0 ? { value: `${game.fg3m}/${game.fg3a}`, label: "3PT" } : null;
  const ft =
    game.fta > 0 ? { value: `${game.ftm}/${game.fta}`, label: "FT" } : null;
  const reb =
    game.potentialReb > 0
      ? { value: `${game.reb}/${game.potentialReb}`, label: "of pot. reb" }
      : null;
  const ast =
    game.potentialAssists != null && game.potentialAssists > 0
      ? { value: `${game.ast}/${game.potentialAssists}`, label: "of pot. ast" }
      : null;

  switch (market) {
    case "player_points":
      return [fg, fg3, ft].filter((p): p is EfficiencyPart => p !== null);
    case "player_rebounds":
      return reb ? [reb] : [];
    case "player_assists":
      return ast ? [ast] : [];
    case "player_threes_made":
      return fg3 ? [fg3] : [];
    case "player_points_rebounds_assists":
    case "player_points_rebounds":
    case "player_points_assists":
      return [fg, fg3].filter((p): p is EfficiencyPart => p !== null);
    case "player_rebounds_assists":
      return [reb, ast].filter((p): p is EfficiencyPart => p !== null);
    default:
      return [];
  }
};

type RecentTrendMap = Record<string, BoxScoreGame[]>;

async function fetchRecentTrends(
  sport: "nba" | "wnba",
  playerIds: number[],
): Promise<RecentTrendMap> {
  if (playerIds.length === 0) return {};

  const params = new URLSearchParams();
  params.set("playerIds", playerIds.join(","));
  params.set("limit", "10");

  const res = await fetch(
    `/api/${sport}/hit-rates/recent-trends?${params.toString()}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load recent trends");
  }

  const payload = await res.json();
  return payload.trends ?? {};
}

const getContextPillClass = (
  rank: number | null,
  sport: "nba" | "mlb" | "wnba",
) => {
  const tier = getMatchupTier(rank, getDefenseTotalTeams(sport));
  switch (tier) {
    case "elite":
      return "border-[color-mix(in_oklab,var(--accent)_38%,transparent)] bg-[color-mix(in_oklab,var(--accent)_17%,var(--card))] text-[color-mix(in_oklab,var(--accent)_92%,var(--text))]";
    case "strong":
      return "border-[color-mix(in_oklab,var(--accent)_24%,transparent)] bg-[color-mix(in_oklab,var(--accent)_9%,var(--card))] text-[color-mix(in_oklab,var(--accent)_78%,var(--text))]";
    case "bad":
      return "border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-300";
    case "worst":
      return "border-red-500/35 bg-red-500/15 text-red-600 dark:text-red-200";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400";
  }
};

// Edge-to-edge tier classes for DEF Rank and Pace cells — matches the Hit Rate cell
// palette so the three colored sections of the table read with one consistent treatment.
const tierToCellClass = (tier: MatchupTier | null): string => {
  if (!tier)
    return "bg-neutral-50 text-neutral-500 dark:bg-neutral-900/80 dark:text-neutral-500";
  switch (tier) {
    case "elite":
      return "bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-500/40 dark:text-white";
    case "strong":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    case "neutral":
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-500/15 dark:text-neutral-300";
    case "bad":
      return "bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-300";
    case "worst":
      return "bg-red-100 text-red-800 font-bold dark:bg-red-500/40 dark:text-white";
    default:
      return "bg-neutral-50 text-neutral-500 dark:bg-neutral-900/80 dark:text-neutral-500";
  }
};

const getDefRankCellClass = (
  rank: number | null | undefined,
  sport: "nba" | "mlb" | "wnba" = "nba",
  totalTeams?: number | null,
): string => {
  if (rank === null || rank === undefined) return tierToCellClass(null);
  const tier = getMatchupTier(rank, getDefenseTotalTeams(sport, undefined, totalTeams));
  return tierToCellClass(tier);
};

const getPaceCellClass = (
  rank: number | null | undefined,
  sport: "nba" | "mlb" | "wnba" = "nba",
): string => {
  return tierToCellClass(getPaceTier(rank, sport));
};

// Pace rank semantics are INVERTED relative to DEF rank:
//   - DEF: rank #1 = best defense = BAD for offensive props (red)
//   - Pace: rank #1 = fastest pace = GOOD for offensive props (green)
// We invert the rank then reuse the existing 5-tier logic.
const invertRank = (rank: number, total: number) => total - rank + 1;

const getPaceTier = (
  rank: number | null | undefined,
  sport: "nba" | "mlb" | "wnba" = "nba",
) => {
  if (rank === null || rank === undefined) return null;
  const total = getDefenseTotalTeams(sport);
  return getMatchupTier(invertRank(rank, total), total);
};

const getPaceRankPillClass = (
  rank: number | null | undefined,
  sport: "nba" | "mlb" | "wnba" = "nba",
): string => {
  const tier = getPaceTier(rank, sport);
  if (!tier) {
    return "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400";
  }
  switch (tier) {
    case "elite":
      return "border-[color-mix(in_oklab,var(--accent)_38%,transparent)] bg-[color-mix(in_oklab,var(--accent)_17%,var(--card))] text-[color-mix(in_oklab,var(--accent)_92%,var(--text))]";
    case "strong":
      return "border-[color-mix(in_oklab,var(--accent)_24%,transparent)] bg-[color-mix(in_oklab,var(--accent)_9%,var(--card))] text-[color-mix(in_oklab,var(--accent)_78%,var(--text))]";
    case "bad":
      return "border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-300";
    case "worst":
      return "border-red-500/35 bg-red-500/15 text-red-600 dark:text-red-200";
    case "neutral":
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400";
  }
};

const getPaceRankTextColor = (
  rank: number | null | undefined,
  sport: "nba" | "mlb" | "wnba" = "nba",
): string => {
  const tier = getPaceTier(rank, sport);
  if (!tier) return "text-neutral-500 dark:text-neutral-400";
  switch (tier) {
    case "elite":
      return "text-emerald-700 dark:text-emerald-300 font-bold";
    case "strong":
      return "text-emerald-600 dark:text-emerald-400";
    case "bad":
      return "text-red-500 dark:text-red-400";
    case "worst":
      return "text-red-600 dark:text-red-300 font-bold";
    case "neutral":
    default:
      return "text-neutral-500 dark:text-neutral-400";
  }
};

const getPacePillClass = (
  label: "pace_up" | "pace_down" | "neutral" | null | undefined,
) => {
  if (label === "pace_up") {
    return "border-[color-mix(in_oklab,var(--accent)_28%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,var(--card))] text-[color-mix(in_oklab,var(--accent)_82%,var(--text))]";
  }
  if (label === "pace_down") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300";
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400";
};

// Hit rate badge class - matches alternate lines matrix colors
const hitRateBadgeClass = (value: number | null) => {
  if (value === null || value === undefined) {
    return "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500";
  }
  if (value >= 75) {
    return "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
  if (value >= 60) {
    return "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-500";
  }
  if (value >= 50) {
    return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400";
  }
  if (value >= 35) {
    return "bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400";
  }
  return "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400";
};

// Get progress bar color based on hit rate
const getProgressBarColor = (value: number | null) => {
  if (value === null || value === undefined)
    return "bg-neutral-300 dark:bg-neutral-600";
  if (value >= 75) return "bg-emerald-500";
  if (value >= 60) return "bg-emerald-400";
  if (value >= 50) return "bg-amber-400";
  if (value >= 35) return "bg-orange-400";
  return "bg-red-400";
};

// Locked to the prop command center palette (mlb-prop-command-center.tsx:500) so all of our
// performance/score tables read the same. 5-tier scale with a neutral grey middle band.
const getHitRateHeatClass = (value: number | null) => {
  if (value === null || value === undefined) {
    return "bg-neutral-50 text-neutral-500 dark:bg-neutral-900/80 dark:text-neutral-500";
  }
  if (value >= 75) {
    return "bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-500/40 dark:text-white";
  }
  if (value >= 60) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  }
  if (value >= 50) {
    // Avg — neutral grey signals "right around the line" without competing with the green/red tiers
    return "bg-neutral-100 text-neutral-700 dark:bg-neutral-500/15 dark:text-neutral-300";
  }
  if (value >= 35) {
    return "bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-300";
  }
  return "bg-red-100 text-red-800 font-bold dark:bg-red-500/40 dark:text-white";
};

const formatHitRateCount = (
  value: number | null,
  sampleSize?: number | null,
) => {
  if (value === null || value === undefined || !sampleSize || sampleSize <= 0)
    return null;
  const hits = Math.round((value / 100) * sampleSize);
  return `${hits}/${sampleSize}`;
};

// Heat-map hit rate cell content. The tier background is applied to the parent <td>
// (edge-to-edge solid fill, matching the prop command center pattern). This component
// only renders the percentage + sample count text.
const HitRateCell = ({
  value,
  sampleSize,
  subLabel,
  isBlurred = false,
}: {
  value: number | null;
  sampleSize?: number | null;
  subLabel?: string;
  isBlurred?: boolean;
}) => {
  const count = formatHitRateCount(value, sampleSize);
  const secondary = count ?? subLabel ?? "—";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1",
        isBlurred && "opacity-60 blur-[3px]",
      )}
    >
      <span className="text-[15px] leading-none font-black tabular-nums">
        {value !== null && value !== undefined ? `${Math.round(value)}%` : "—"}
      </span>
      <span className="text-[11px] leading-none font-bold tabular-nums">
        {secondary}
      </span>
    </div>
  );
};

// Compact-view Over/Under odds cells with sportsbook book chip + dropdown popover.
// Fetches the odds-line for the row once, then exposes per-side triggers (Over / Under)
// that open a popover listing every book with that side's price + deep link.
type OddsLineBook = {
  book: string;
  over: number | null;
  under: number | null;
  odd_id_over?: string | null;
  odd_id_under?: string | null;
  link_over?: string | null;
  link_under?: string | null;
};
type OddsLineApiResponse = {
  best: { book: string; over: number | null; under: number | null } | null;
  books: OddsLineBook[];
};

const findBestPerSide = (
  books: OddsLineBook[] | undefined,
  side: "over" | "under",
) => {
  if (!books || books.length === 0) return null;
  let best: { book: string; price: number } | null = null;
  for (const b of books) {
    const price = side === "over" ? b.over : b.under;
    if (price === null || price === undefined) continue;
    if (best === null || price > best.price) {
      best = { book: b.book, price };
    }
  }
  return best;
};

type CompactLineMovementMeta = {
  bestBookId?: string | null;
  allBookIds?: string[];
  currentPricesByBook?: Record<string, number>;
  oddIdsByBook?: Record<string, string>;
};

// Sportsbook logo — uses the standard light PNG (e.g. /images/sports-books/draftkings.png).
// No rounded clipping or chip wrapper, so the logo's own design (round/wordmark/etc.) renders
// as the source artwork intended.
const BookLogo = ({ book, size = 16 }: { book: string; size?: number }) => {
  const sb = getSportsbookById(book);
  const src = sb?.image?.light ?? null;
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="shrink-0 bg-neutral-200 dark:bg-neutral-700"
        style={{ height: size, width: size }}
      />
    );
  }
  return (
    <img
      src={src}
      alt={sb?.name ?? book}
      className="shrink-0 object-contain"
      style={{ height: size, width: size }}
    />
  );
};

// Per-side trigger + popover that lists every book offering that side. Styled to
// match the prop command center / HR command center dropdowns: book logo + name +
// BEST badge + price + ExternalLink, with a "Line Movement" footer.
const CompactSidePrice = ({
  side,
  books,
  fallback,
  line,
  market,
  isBlurred,
  gameStarted,
  isLoading,
  onOpenLineMovement,
}: {
  side: "over" | "under";
  books: OddsLineBook[] | undefined;
  fallback: { book: string; price: number } | null;
  line: number | null;
  market: string;
  isBlurred: boolean;
  gameStarted: boolean;
  isLoading: boolean;
  onOpenLineMovement?: (
    side: "over" | "under",
    meta?: CompactLineMovementMeta,
  ) => void;
}) => {
  const [open, setOpen] = useState(false);
  const binaryMarket = isBinaryOddsMarket(market);
  const liveBest = findBestPerSide(books, side);
  const best = liveBest ?? fallback;

  if (isBlurred) {
    return (
      <span className="text-xs text-neutral-400 opacity-50 blur-[2px]">
        +000
      </span>
    );
  }
  if (gameStarted) {
    return (
      <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>
    );
  }
  if ((isLoading && !best) || !best) {
    return (
      <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>
    );
  }

  // Build the per-book list filtered to this side
  const priced = (books ?? [])
    .map((b) => ({
      book: b.book,
      price: (side === "over" ? b.over : b.under) ?? null,
      link: (side === "over" ? b.link_over : b.link_under) ?? null,
      oddId:
        (side === "over" ? b.odd_id_over : b.odd_id_under) ?? null,
    }))
    .filter(
      (b): b is {
        book: string;
        price: number;
        link: string | null;
        oddId: string | null;
      } =>
        b.price !== null && b.price !== undefined,
    )
    .sort((a, b) => b.price - a.price);
  const currentPricesByBook: Record<string, number> = {};
  const oddIdsByBook: Record<string, string> = {};
  const allBookIds: string[] = [];
  for (const book of priced) {
    allBookIds.push(book.book);
    currentPricesByBook[book.book] = book.price;
    if (book.oddId) oddIdsByBook[book.book] = book.oddId;
  }
  const lineMovementMeta: CompactLineMovementMeta = {
    bestBookId: best?.book ?? priced[0]?.book ?? null,
    allBookIds,
    currentPricesByBook,
    oddIdsByBook,
  };

  const sideLabel = binaryMarket
    ? side === "over"
      ? "YES"
      : "NO"
    : side === "over"
      ? "OVER"
      : "UNDER";
  const lineLabel =
    binaryMarket
      ? sideLabel
      : line !== null && line !== undefined
        ? `${line}+ ${sideLabel}`
        : sideLabel;

  return (
    <Popover
      openPopover={open}
      setOpenPopover={setOpen}
      align="center"
      side="bottom"
      popoverContentClassName="w-[280px] p-0 overflow-hidden bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-700/80 shadow-2xl ring-1 ring-black/5 dark:ring-white/5"
      content={
        <div>
          {/* Header: market label + book count */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
            <span className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              {formatMarketLabel(market)} · {lineLabel}
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
              {priced.length} {priced.length === 1 ? "book" : "books"}
            </span>
          </div>
          {/* Book list */}
          <div className="max-h-[260px] overflow-y-auto">
            {priced.length === 0 ? (
              <div className="px-3 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                {fallback ? "No live books for this side" : "No books"}
              </div>
            ) : (
              priced.map((b, i) => {
                const sb = getSportsbookById(b.book);
                const isBest = i === 0;
                const hasLink = !!b.link;
                return (
                  <a
                    key={`${b.book}-${i}`}
                    href={hasLink ? b.link! : undefined}
                    target={hasLink ? "_blank" : undefined}
                    rel={hasLink ? "noopener noreferrer" : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!hasLink) e.preventDefault();
                      else setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 transition-colors",
                      "hover:bg-neutral-50 dark:hover:bg-neutral-800/60",
                      isBest && "bg-emerald-500/5",
                      !hasLink && "cursor-default",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <BookLogo book={b.book} size={16} />
                      <span className="truncate text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                        {sb?.name ?? b.book}
                      </span>
                      {isBest && (
                        <span className="shrink-0 text-[9px] font-bold tracking-wide text-emerald-500 uppercase">
                          Best
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "text-xs font-bold tabular-nums",
                          isBest
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-600 dark:text-neutral-300",
                        )}
                      >
                        {formatOddsPrice(b.price)}
                      </span>
                      {hasLink && (
                        <ExternalLink className="h-2.5 w-2.5 text-neutral-400" />
                      )}
                    </div>
                  </a>
                );
              })
            )}
          </div>
          {/* Line movement footer */}
          {onOpenLineMovement && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLineMovement(side, lineMovementMeta);
                setOpen(false);
              }}
              className="hover:text-brand dark:hover:text-brand flex w-full items-center justify-center gap-1.5 border-t border-neutral-100 px-3 py-2 text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
            >
              <LineChartIcon className="h-3 w-3" />
              Line Movement
            </button>
          )}
        </div>
      }
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1 transition-colors",
          "hover:bg-neutral-100 dark:hover:bg-neutral-800/60",
          open && "ring-brand/30 bg-neutral-100 ring-1 dark:bg-neutral-800/70",
        )}
      >
        <BookLogo book={best.book} size={16} />
        <span
          className={cn(
            "text-xs font-black tabular-nums",
            best.price > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-neutral-700 dark:text-neutral-200",
          )}
        >
          {formatOddsPrice(best.price)}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 opacity-40 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
    </Popover>
  );
};

const CompactOddsCells = ({
  row,
  sport,
  isBlurred,
  isLastColumn,
  onOpenLineMovement,
}: {
  row: HitRateProfile;
  sport: "nba" | "mlb" | "wnba";
  isBlurred: boolean;
  isLastColumn?: boolean;
  onOpenLineMovement?: (
    row: HitRateProfile,
    side: "over" | "under",
    meta?: CompactLineMovementMeta,
  ) => void;
}) => {
  const rawSelectionKey = row.selKey ?? row.oddsSelectionId;
  const playerId = rawSelectionKey ? rawSelectionKey.split(":")[0] : null;
  const enabled =
    !isBlurred &&
    sport !== "mlb" && // MLB doesn't have /props/odds-line for hit-rate context yet
    !!row.eventId &&
    !!row.market &&
    !!playerId &&
    row.line !== null &&
    row.line !== undefined;

  const oddsLineQuery = useQuery({
    queryKey: [
      "compact-odds-line",
      sport,
      row.eventId,
      row.market,
      playerId,
      row.line,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        event_id: row.eventId!,
        market: row.market,
        player_id: playerId!,
        line: String(row.line),
      });
      const res = await fetch(
        `/api/${sport}/props/odds-line?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch odds line");
      return res.json() as Promise<OddsLineApiResponse>;
    },
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Fallback: when the live /odds-line query returns no books for this exact line
  // (line drift / partial cache miss) but the row has a precomputed bestOdds from
  // the v2 endpoint, surface that on whichever side the selKey encodes. selKey is
  // "{playerId}:{side}:{line}" — hit-rate rows are typically the "over" side.
  const fallbackSide: "over" | "under" | null = (() => {
    if (!row.selKey) return null;
    const side = row.selKey.split(":")[1];
    if (side === "over" || side === "under") return side;
    return null;
  })();
  const overFallback =
    row.bestOdds && fallbackSide === "over"
      ? { book: row.bestOdds.book, price: row.bestOdds.price }
      : null;
  const underFallback =
    row.bestOdds && fallbackSide === "under"
      ? { book: row.bestOdds.book, price: row.bestOdds.price }
      : null;

  const gameStarted = hasGameStarted(row.gameStatus, row.gameDate);
  const isLoading =
    oddsLineQuery.isLoading ||
    (enabled && oddsLineQuery.isFetching && !oddsLineQuery.data);

  return (
    <>
      <td className="border-brand/20 dark:border-brand/15 border-l px-2 py-2 text-center align-middle">
        <CompactSidePrice
          side="over"
          books={oddsLineQuery.data?.books}
          fallback={overFallback}
          line={row.line}
          market={row.market}
          isBlurred={isBlurred}
          gameStarted={gameStarted}
          isLoading={isLoading}
          onOpenLineMovement={
            onOpenLineMovement
              ? (s, meta) => onOpenLineMovement(row, s, meta)
              : undefined
          }
        />
      </td>
      <td
        className={cn(
          "px-2 py-2 text-center align-middle",
          isLastColumn && "rounded-r-xl",
        )}
      >
        <CompactSidePrice
          side="under"
          books={oddsLineQuery.data?.books}
          fallback={underFallback}
          line={row.line}
          market={row.market}
          isBlurred={isBlurred}
          gameStarted={gameStarted}
          isLoading={isLoading}
          onOpenLineMovement={
            onOpenLineMovement
              ? (s, meta) => onOpenLineMovement(row, s, meta)
              : undefined
          }
        />
      </td>
    </>
  );
};

const MiniSignalBar = ({ value }: { value: number | null }) => {
  const percentage = Math.min(100, Math.max(0, value ?? 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          getProgressBarColor(value),
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const MetricRail = ({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) => (
  <div className="min-w-0">
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-500">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-black tabular-nums",
          getHitRateTextColor(value),
        )}
      >
        {formatRoundedPercentage(value)}
      </span>
    </div>
    <MiniSignalBar value={value} />
  </div>
);

const RecentTrendBars = ({
  row,
  games,
  isLoading,
  isBlurred = false,
  sport,
}: {
  row: HitRateProfile;
  games: BoxScoreGame[] | undefined;
  isLoading: boolean;
  isBlurred?: boolean;
  sport: "nba" | "mlb" | "wnba";
}) => {
  if (isBlurred) {
    return (
      <div className="flex h-20 items-end gap-1.5 opacity-45 blur-[2px]">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex flex-1 items-end">
            <div
              className="w-full rounded-sm bg-neutral-300 dark:bg-neutral-700"
              style={{ height: `${14 + (index % 5) * 5}px` }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (sport === "mlb") {
    return (
      <div className="flex h-20 items-center justify-center text-[11px] font-bold tracking-[0.12em] text-neutral-400 uppercase dark:text-neutral-500">
        Game logs soon
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="relative flex h-20 items-stretch gap-2 pl-1">
        <div className="relative flex h-full flex-1 flex-col justify-end pb-1">
          <div className="pointer-events-none absolute inset-x-0 bottom-[34px] border-t border-dashed border-neutral-400/30 dark:border-neutral-600/30" />
          <div
            className="relative flex w-full items-end justify-center gap-[2px]"
            style={{ height: 60 }}
          >
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="flex h-full w-3.5 shrink-0 items-end justify-center"
              >
                <div
                  className="w-full animate-pulse rounded-t-[2px] bg-neutral-200/70 dark:bg-neutral-800/70"
                  style={{ height: 18 + (index % 4) * 6 }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="w-7 flex-shrink-0" />
      </div>
    );
  }

  const chartGames = (games ?? []).slice(0, 10).reverse();
  if (chartGames.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-[11px] font-bold tracking-[0.12em] text-neutral-400 uppercase dark:text-neutral-500">
        No recent games
      </div>
    );
  }

  const linePresent = row.line !== null && row.line !== undefined;
  const lineValue = row.line ?? 0;
  const values = chartGames.map((game) => getMarketStatValue(game, row.market));
  // Cap the chart top at the 80th percentile (with buffer) so a single career-high game
  // doesn't shrink every other bar to a sliver. Outliers just clip at the top edge.
  const sortedValues = [...values].sort((a, b) => a - b);
  const p80 = sortedValues[Math.floor(sortedValues.length * 0.8)] ?? 1;
  const chartMax = Math.max(lineValue * 1.35, p80 * 1.15, 1);
  const chartHeightPx = 60; // available drawable height inside the cell
  const linePositionPx = linePresent
    ? Math.min(chartHeightPx - 4, (lineValue / chartMax) * chartHeightPx)
    : 0;

  return (
    <div className="relative flex h-20 items-stretch gap-2 pl-1">
      <div className="relative flex h-full flex-1 flex-col justify-end pb-1">
        {/* Threshold line at the prop value */}
        {linePresent && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-neutral-400/60 dark:border-neutral-500/55"
            style={{ bottom: `calc(${linePositionPx}px + 4px)` }}
          />
        )}
        {/* Bars — all grow from the bottom baseline, clustered tight in the center */}
        <div
          className="relative flex w-full items-end justify-center gap-[2px]"
          style={{ height: chartHeightPx }}
        >
          {chartGames.map((game, index) => {
            const value = values[index];
            const isHit = value >= lineValue;
            const barH = Math.min(
              chartHeightPx,
              Math.max(3, (value / chartMax) * chartHeightPx),
            );
            const date = new Date(`${game.date}T00:00:00`);
            const dateLabel = Number.isNaN(date.getTime())
              ? game.date
              : date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
            const margin = linePresent ? value - lineValue : null;
            const marketLabel = formatMarketLabel(row.market);

            return (
              <Tooltip
                key={`${game.gameId}-${index}`}
                side="top"
                content={
                  <div className="min-w-[200px] px-3 py-2.5">
                    {/* Header: date • matchup • result */}
                    <div className="flex items-center justify-between gap-3 border-b border-neutral-200/70 pb-2 dark:border-neutral-700/70">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
                        <span className="tabular-nums">{dateLabel}</span>
                        <span className="text-neutral-400 dark:text-neutral-500">
                          {game.homeAway === "H" ? "vs" : "@"}
                        </span>
                        <span className="font-black">
                          {game.opponentAbbr || "OPP"}
                        </span>
                      </div>
                      {game.result && (
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-px text-[10px] font-black tracking-wider uppercase tabular-nums",
                            game.result === "W"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {game.result} {game.teamScore}-{game.opponentScore}
                        </span>
                      )}
                    </div>
                    {/* Main: stat value + margin vs line */}
                    <div className="flex items-end justify-between gap-3 pt-2.5">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={cn(
                            "text-2xl leading-none font-black tabular-nums",
                            isHit
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {value}
                        </span>
                        <span className="text-[10px] font-bold tracking-[0.1em] text-neutral-500 uppercase dark:text-neutral-400">
                          {marketLabel}
                        </span>
                      </div>
                      {margin !== null && (
                        <div className="flex flex-col items-end leading-tight">
                          <span
                            className={cn(
                              "text-[11px] font-black tabular-nums",
                              isHit
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {margin >= 0 ? "+" : ""}
                            {Number.isInteger(margin)
                              ? margin
                              : margin.toFixed(1)}
                          </span>
                          <span className="text-[9px] font-bold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
                            vs {row.line}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Market-specific efficiency: shooting splits / made-of-potential */}
                    {(() => {
                      const parts = getMarketEfficiencyParts(game, row.market);
                      if (parts.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-neutral-200/50 pt-2 text-[10px] font-bold text-neutral-500 tabular-nums dark:border-neutral-700/50 dark:text-neutral-400">
                          {parts.map((p, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && (
                                <span className="text-neutral-300 dark:text-neutral-600">
                                  •
                                </span>
                              )}
                              <span>
                                <span className="text-neutral-700 dark:text-neutral-200">
                                  {p.value}
                                </span>
                                <span className="ml-1 tracking-wider uppercase">
                                  {p.label}
                                </span>
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    })()}
                    {/* Context: minutes / usage / passes (passes shown only on assist markets) */}
                    {(() => {
                      const isAssistMarket =
                        row.market === "player_assists" ||
                        row.market === "player_points_assists" ||
                        row.market === "player_rebounds_assists" ||
                        row.market === "player_points_rebounds_assists";
                      const showMinutes = game.minutes > 0;
                      const showUsage = game.usagePct > 0;
                      const showPasses = isAssistMarket && game.passes > 0;
                      if (!showMinutes && !showUsage && !showPasses)
                        return null;
                      return (
                        <div className="mt-2 flex items-center gap-2 border-t border-neutral-200/50 pt-2 text-[10px] font-bold tracking-wider text-neutral-500 uppercase dark:border-neutral-700/50 dark:text-neutral-400">
                          {showMinutes && (
                            <span className="tabular-nums">
                              {Math.round(game.minutes)} min
                            </span>
                          )}
                          {showMinutes && (showUsage || showPasses) && (
                            <span className="text-neutral-300 dark:text-neutral-600">
                              •
                            </span>
                          )}
                          {showUsage && (
                            <span className="tabular-nums">
                              {(game.usagePct < 1
                                ? game.usagePct * 100
                                : game.usagePct
                              ).toFixed(1)}
                              % USG
                            </span>
                          )}
                          {showUsage && showPasses && (
                            <span className="text-neutral-300 dark:text-neutral-600">
                              •
                            </span>
                          )}
                          {showPasses && (
                            <span className="tabular-nums">
                              {game.passes} PASS
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                }
              >
                <div className="group/trend flex h-full w-3.5 shrink-0 items-end justify-center">
                  <div
                    className={cn(
                      "w-full rounded-t-[2px] transition-all duration-200 group-hover/trend:translate-y-[-1px] group-hover/trend:brightness-115",
                      isHit
                        ? "bg-emerald-500/90 shadow-[0_0_0_1px_rgba(16,185,129,0.2)_inset] dark:bg-emerald-400/90"
                        : "bg-rose-500/80 shadow-[0_0_0_1px_rgba(244,63,94,0.2)_inset] dark:bg-rose-500/80",
                    )}
                    style={{ height: barH }}
                  />
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
      {/* Line value label, vertically centered on the threshold line */}
      {linePresent && (
        <div className="relative flex w-7 flex-shrink-0">
          <span
            className="absolute right-0 translate-y-1/2 text-[11px] leading-none font-black text-neutral-500 tabular-nums dark:text-neutral-400"
            style={{ bottom: `calc(${linePositionPx}px + 4px)` }}
          >
            {row.line}
          </span>
        </div>
      )}
    </div>
  );
};

const DailyInsightCard = ({
  icon,
  label,
  primary,
  secondary,
  accent = "brand",
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary: string;
  accent?: "brand" | "emerald" | "amber" | "red";
}) => {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
      : accent === "amber"
        ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
        : accent === "red"
          ? "text-red-500 bg-red-500/10 border-red-500/20"
          : "text-brand bg-brand/10 border-brand/20";

  return (
    <div className="group hover:border-brand/30 relative overflow-hidden rounded-xl border border-neutral-200/80 bg-white/80 p-3.5 shadow-sm ring-1 ring-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800/80 dark:bg-neutral-900/70 dark:ring-white/[0.03]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
            accentClass,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-500">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-black text-neutral-950 dark:text-white">
            {primary}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {secondary}
          </p>
        </div>
      </div>
    </div>
  );
};

export const DailyInsightStrip = ({
  rows,
  totalCount,
  sport,
}: {
  rows: HitRateProfile[];
  totalCount?: number;
  sport: "nba" | "mlb" | "wnba";
}) => {
  const insights = useMemo(() => {
    const usableRows = rows.filter((row) => !isPlayerOut(row.injuryStatus));
    const byL10 = [...usableRows]
      .filter((row) => row.last10Pct !== null)
      .sort(
        (a, b) =>
          (b.last10Pct ?? -1) - (a.last10Pct ?? -1) ||
          (b.last10Avg ?? -1) - (a.last10Avg ?? -1),
      );
    const byOdds = [...usableRows]
      .filter((row) => row.bestOdds)
      .sort(
        (a, b) => (b.bestOdds?.price ?? -9999) - (a.bestOdds?.price ?? -9999),
      );
    const byStreak = [...usableRows]
      .filter((row) => row.hitStreak !== null && row.hitStreak !== 0)
      .sort((a, b) => (b.hitStreak ?? -9999) - (a.hitStreak ?? -9999));
    const byWeakDefense = [...usableRows]
      .filter((row) => row.matchupRank !== null)
      .sort(
        (a, b) =>
          (b.matchupRank ?? -1) - (a.matchupRank ?? -1) ||
          (getPrimaryHitRate(b) ?? -1) - (getPrimaryHitRate(a) ?? -1),
      );
    const gameCount = new Set(
      usableRows.map((row) => row.gameId).filter(Boolean),
    ).size;
    const propsCount = totalCount ?? rows.length;

    return {
      bestL10: byL10[0] ?? null,
      bestOdds: byOdds[0] ?? null,
      hotStreak: byStreak[0] ?? null,
      weakDefense: byWeakDefense[0] ?? null,
      gameCount,
      propsCount,
    };
  }, [rows, totalCount]);

  const sportLabel = sport.toUpperCase();
  const bestL10 = insights.bestL10;
  const bestOdds = insights.bestOdds;
  const hotStreak = insights.hotStreak;
  const weakDefense = insights.weakDefense;
  const defenseTotalTeams = getDefenseTotalTeams(
    sport,
    weakDefense?.gameDate,
    weakDefense?.dvpTotalTeams,
  );

  return (
    <div className="border-b border-neutral-200/80 bg-gradient-to-r from-neutral-50 via-white to-neutral-50 px-5 py-4 dark:border-neutral-800/80 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1.15fr_0.95fr]">
        <DailyInsightCard
          icon={<Trophy className="h-4 w-4" />}
          label="Highest L10"
          primary={bestL10 ? bestL10.playerName : "No signal yet"}
          secondary={
            bestL10
              ? `${formatRoundedPercentage(bestL10.last10Pct)} on ${bestL10.line ?? "—"}+ ${formatMarketLabel(bestL10.market)}`
              : "Waiting on hit-rate rows"
          }
          accent="emerald"
        />
        <DailyInsightCard
          icon={<Target className="h-4 w-4" />}
          label="Best Odds"
          primary={
            bestOdds
              ? `${formatOddsPrice(bestOdds.bestOdds?.price)} ${bestOdds.playerName}`
              : "No odds yet"
          }
          secondary={
            bestOdds
              ? `${bestOdds.bestOdds?.book ?? "Book"} on ${bestOdds.line ?? "—"}+`
              : "Books will appear as feeds update"
          }
          accent={
            bestOdds && (bestOdds.bestOdds?.price ?? 0) > 0
              ? "emerald"
              : "brand"
          }
        />
        <DailyInsightCard
          icon={<Flame className="h-4 w-4" />}
          label="Hot Streak"
          primary={hotStreak ? hotStreak.playerName : "No active run"}
          secondary={
            hotStreak
              ? `${getStreakDisplay(hotStreak.hitStreak)} on ${formatMarketLabel(hotStreak.market)}`
              : "Streaks reset as lines move"
          }
          accent="amber"
        />
        <DailyInsightCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Weak Defense"
          primary={
            weakDefense
              ? `${weakDefense.playerName} vs ${weakDefense.opponentTeamAbbr ?? "OPP"}`
              : "No DvP yet"
          }
          secondary={
            weakDefense
              ? `Opponent rank ${weakDefense.matchupRank}/${defenseTotalTeams}, L10 ${formatRoundedPercentage(weakDefense.last10Pct)}`
              : "Needs matchup ranks for this slate"
          }
          accent="brand"
        />
        <DailyInsightCard
          icon={<Clock3 className="h-4 w-4" />}
          label={`${sportLabel} Slate`}
          primary={`${insights.gameCount || "All"} games`}
          secondary={`${insights.propsCount} props in this view`}
          accent="brand"
        />
      </div>
    </div>
  );
};

const ExpandedRowPanel = ({
  row,
  sport,
  onOpenFullReport,
}: {
  row: HitRateProfile;
  sport: "nba" | "mlb" | "wnba";
  onOpenFullReport?: (row: HitRateProfile) => void;
}) => {
  const boxScoreSport = sport === "wnba" ? "wnba" : "nba";
  const { games: recentGames, isLoading: recentGamesLoading } =
    usePlayerBoxScores({
      playerId: row.playerId,
      sport: boxScoreSport,
      limit: 10,
      enabled: sport !== "mlb" && !!row.playerId,
    });
  const avgDelta =
    row.last10Avg !== null && row.line !== null
      ? row.last10Avg - row.line
      : null;
  const defenseTotalTeams = getDefenseTotalTeams(
    sport,
    row.gameDate,
    row.dvpTotalTeams,
  );
  const chartGames = useMemo(
    () => recentGames.slice(0, 10).reverse(),
    [recentGames],
  );
  const maxChartValue = useMemo(() => {
    const values = chartGames.map((game) =>
      getMarketStatValue(game, row.market),
    );
    const maxValue = Math.max(row.line ?? 0, ...values, 1);
    return Math.ceil(maxValue * 1.15);
  }, [chartGames, row.line, row.market]);
  const matchupText =
    row.matchupRank !== null
      ? getDvpRankBucket(row.matchupRank, defenseTotalTeams) === "favorable"
        ? "Favorable defense"
        : getDvpRankBucket(row.matchupRank, defenseTotalTeams) === "tough"
          ? "Tough defense"
          : "Neutral defense"
      : "No defense rank";

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1.35fr_0.85fr_0.85fr]">
      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 ring-1 ring-black/[0.02] dark:border-neutral-800/80 dark:bg-neutral-950/70 dark:ring-white/[0.03]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-neutral-950 dark:text-white">
              Recent performance
            </p>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Last 10 games against {row.line ?? "—"}+{" "}
              {formatMarketLabel(row.market)}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            Avg {row.last10Avg !== null ? row.last10Avg.toFixed(1) : "—"}
          </div>
        </div>

        <div className="relative mb-4 min-h-[180px] rounded-xl border border-neutral-200/70 bg-white/70 px-4 pt-5 pb-3 dark:border-neutral-800/70 dark:bg-neutral-900/70">
          {row.line !== null && (
            <div
              className="border-brand/60 pointer-events-none absolute right-4 left-4 border-t border-dashed"
              style={{
                bottom: `${12 + Math.min(86, Math.max(8, (row.line / maxChartValue) * 82))}%`,
              }}
            >
              <span className="bg-brand absolute -top-3 -left-1 rounded-md px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                {row.line}
              </span>
            </div>
          )}

          {sport === "mlb" ? (
            <div className="flex h-[145px] items-center justify-center text-center">
              <div>
                <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
                  Recent bars need MLB row game logs
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Tracked in the data notes for a batched table RPC.
                </p>
              </div>
            </div>
          ) : recentGamesLoading ? (
            <div className="flex h-[145px] items-end gap-2">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className="w-full animate-pulse rounded-t-md bg-neutral-200 dark:bg-neutral-800"
                    style={{ height: `${38 + (index % 4) * 18}px` }}
                  />
                  <div className="h-3 w-8 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                </div>
              ))}
            </div>
          ) : chartGames.length > 0 ? (
            <div className="flex h-[145px] items-end gap-2">
              {chartGames.map((game) => {
                const statValue = getMarketStatValue(game, row.market);
                const hit = row.line !== null ? statValue >= row.line : false;
                const height = Math.max(14, (statValue / maxChartValue) * 112);
                const date = new Date(`${game.date}T00:00:00`);
                const dateLabel = date.toLocaleDateString("en-US", {
                  month: "numeric",
                  day: "numeric",
                });
                return (
                  <div
                    key={game.gameId}
                    className="group/bar flex min-w-0 flex-1 flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "text-[10px] font-black tabular-nums",
                        hit ? "text-emerald-500" : "text-red-500",
                      )}
                    >
                      {statValue}
                    </span>
                    <div
                      className={cn(
                        "w-full max-w-8 rounded-t-md shadow-sm transition-all duration-200 group-hover/bar:scale-x-110",
                        hit
                          ? "bg-gradient-to-t from-emerald-700 to-emerald-400"
                          : "bg-gradient-to-t from-red-700 to-red-400",
                      )}
                      style={{ height }}
                    />
                    <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500">
                      {dateLabel}
                    </span>
                    {game.opponentAbbr && (
                      <img
                        src={getTeamLogoUrl(game.opponentAbbr, sport)}
                        alt={game.opponentAbbr}
                        className="h-4 w-4 object-contain opacity-80"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[145px] items-center justify-center text-center">
              <div>
                <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
                  No recent games found
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  This will populate after box scores are available.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricRail label="L5" value={row.last5Pct} />
          <MetricRail label="L10" value={row.last10Pct} />
          <MetricRail label="L20" value={row.last20Pct} />
          <MetricRail label="Season" value={row.seasonPct} />
        </div>
        <div className="mt-4 grid gap-2 text-xs font-medium text-neutral-500 sm:grid-cols-3 dark:text-neutral-400">
          <div className="rounded-lg border border-neutral-200/70 bg-white/70 px-3 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/70">
            <span className="block text-[10px] font-bold tracking-[0.14em] text-neutral-400 uppercase">
              L10 edge
            </span>
            <span
              className={cn(
                "mt-1 block text-sm font-black tabular-nums",
                avgDelta === null
                  ? "text-neutral-400"
                  : avgDelta >= 0
                    ? "text-emerald-500"
                    : "text-red-500",
              )}
            >
              {avgDelta === null
                ? "—"
                : `${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(1)}`}
            </span>
          </div>
          <div className="rounded-lg border border-neutral-200/70 bg-white/70 px-3 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/70">
            <span className="block text-[10px] font-bold tracking-[0.14em] text-neutral-400 uppercase">
              Streak
            </span>
            <span
              className={cn(
                "mt-1 block text-sm font-black",
                getStreakColor(row.hitStreak),
              )}
            >
              {getStreakDisplay(row.hitStreak)}
            </span>
          </div>
          <div className="rounded-lg border border-neutral-200/70 bg-white/70 px-3 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/70">
            <span className="block text-[10px] font-bold tracking-[0.14em] text-neutral-400 uppercase">
              H2H
            </span>
            <span
              className={cn(
                "mt-1 block text-sm font-black tabular-nums",
                getHitRateTextColor(row.h2hPct),
              )}
            >
              {formatRoundedPercentage(row.h2hPct)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/70">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="text-brand h-4 w-4" />
          <p className="text-sm font-black text-neutral-950 dark:text-white">
            Matchup context
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">
              Opponent
            </span>
            <span className="inline-flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
              {row.opponentTeamAbbr && (
                <img
                  src={getTeamLogoUrl(row.opponentTeamAbbr, sport)}
                  alt={row.opponentTeamAbbr}
                  className="h-5 w-5 object-contain"
                />
              )}
              {row.homeAway === "H" ? "vs" : "@"}{" "}
              {row.opponentTeamAbbr ?? row.opponentTeamName ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">
              Defense rank
            </span>
            <span
              className={cn(
                "font-black tabular-nums",
                getMatchupRankColor(row.matchupRank, sport, defenseTotalTeams),
              )}
            >
              {row.matchupRank !== null
                ? `${row.matchupRank}/${defenseTotalTeams}`
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">
              Avg allowed
            </span>
            <span className="font-bold text-neutral-900 tabular-nums dark:text-white">
              {row.matchupAvgAllowed !== null
                ? row.matchupAvgAllowed.toFixed(1)
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Read</span>
            <span className="font-bold text-neutral-900 dark:text-white">
              {matchupText}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">
              Pace context
            </span>
            <span
              className={cn(
                "font-bold tabular-nums",
                row.paceContext?.paceLabel === "pace_up"
                  ? "text-emerald-500"
                  : row.paceContext?.paceLabel === "pace_down"
                    ? "text-amber-500"
                    : "text-neutral-900 dark:text-white",
              )}
            >
              {row.paceContext?.opponentRecent.l5Rank
                ? `Opp #${row.paceContext.opponentRecent.l5Rank}`
                : row.paceContext?.matchupL5Pace !== null &&
                    row.paceContext?.matchupL5Pace !== undefined
                  ? row.paceContext.matchupL5Pace.toFixed(1)
                  : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/70">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="text-brand h-4 w-4" />
          <p className="text-sm font-black text-neutral-950 dark:text-white">
            Market pulse
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">
              Best over
            </span>
            <span
              className={cn(
                "font-black tabular-nums",
                row.bestOdds ? "text-emerald-500" : "text-neutral-400",
              )}
            >
              {formatOddsPrice(row.bestOdds?.price)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">Book</span>
            <span className="font-bold text-neutral-900 capitalize dark:text-white">
              {row.bestOdds?.book ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">
              Game time
            </span>
            <span className="font-bold text-neutral-900 dark:text-white">
              {formatGameTime(row.gameStatus, row.gameDate)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenFullReport?.(row)}
            className="border-brand/25 bg-brand/10 text-brand hover:bg-brand/15 mt-2 w-full rounded-lg border px-3 py-2 text-xs font-black transition-all duration-200 active:scale-[0.98]"
          >
            Open full player report
          </button>
        </div>
      </div>
    </div>
  );
};

const formatDate = (value: string | null) => {
  if (!value) return "TBD";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

// Check if a game date is tomorrow (in ET timezone)
const isTomorrow = (gameDate: string | null): boolean => {
  if (!gameDate) return false;

  // Get today's date in ET
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayET = etFormatter.format(now);

  // Get tomorrow's date in ET
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowET = etFormatter.format(tomorrow);

  return gameDate === tomorrowET;
};

// Check if a game has started (10 minutes after scheduled time)
const hasGameStarted = (
  gameStatus: string | null,
  gameDate: string | null,
): boolean => {
  if (!gameStatus || !gameDate) return false;

  // Try to parse scheduled time like "7:00 pm ET" or "7:00 PM ET"
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch) {
    // Can't parse as scheduled time - might be in progress status, hide odds
    return true;
  }

  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;

  // Create scheduled game time in ET
  // Note: Using -05:00 for EST, games during EDT would be -04:00
  const scheduledTime = new Date(
    `${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`,
  );

  // Add 10 minutes buffer
  const bufferMs = 10 * 60 * 1000;
  const gameStartedTime = new Date(scheduledTime.getTime() + bufferMs);

  // Compare to current time
  return Date.now() > gameStartedTime.getTime();
};

// Convert ET time string (e.g., "7:00 pm ET") to user's local timezone
const formatGameTime = (gameStatus: string | null, gameDate: string | null) => {
  if (!gameStatus) return "TBD";

  // Check if it's a final score or other non-time status
  if (gameStatus.toLowerCase().includes("final")) return gameStatus;

  // Try to parse time like "7:00 pm ET" or "7:00 PM ET"
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch || !gameDate) return gameStatus.replace(/\s*ET$/i, "").trim();

  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;

  // Create a date object in ET (Eastern Time)
  // ET is UTC-5 (EST) or UTC-4 (EDT)
  const etDate = new Date(
    `${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`,
  );

  // Format in user's local timezone
  return etDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatSpread = (spread: number | null) => {
  if (spread === null || spread === undefined) return "—";
  return spread > 0 ? `+${spread}` : spread.toString();
};

const formatTotal = (total: number | null) => {
  if (total === null || total === undefined) return "—";
  return Number.isInteger(total) ? total.toString() : total.toFixed(1);
};

const formatBookName = (book: string | null | undefined) => {
  if (!book) return null;
  const normalized = book.toLowerCase();
  if (normalized === "pinnacle") return "Pinnacle";
  if (normalized === "draftkings") return "DraftKings";
  if (normalized === "fanduel") return "FanDuel";
  return book;
};

// Get color class for average vs line comparison
const getAvgColorClass = (avg: number | null, line: number | null) => {
  if (avg === null || line === null)
    return "text-neutral-700 dark:text-neutral-300";
  if (avg > line) return "text-emerald-600 dark:text-emerald-400"; // Green - over the line
  if (avg < line) return "text-red-500 dark:text-red-400"; // Red - under the line
  return "text-neutral-700 dark:text-neutral-300"; // Neutral - exactly at the line
};

// Position labels for display
const POSITION_LABELS: Record<string, string> = {
  PG: "Point Guard",
  SG: "Shooting Guard",
  SF: "Small Forward",
  PF: "Power Forward",
  C: "Center",
  G: "Guard",
  F: "Forward",
  GF: "Guard-Forward",
  FC: "Forward-Center",
};

const formatPosition = (position: string | null) => {
  if (!position) return "—";
  return position; // Now just return the position code (PG, SG, SF, PF, C, etc.)
};

const getPositionLabel = (position: string | null): string => {
  if (!position) return "Unknown";
  return POSITION_LABELS[position] || position;
};

const getStatusBorderClass = (status: string | null) => {
  // All players get the same neutral border - no colored borders
  return "border border-neutral-200 dark:border-neutral-700";
};

const isPlayerOut = (status: string | null) => status === "out";

// Get injury icon color class based on status
const getInjuryIconColorClass = (status: string | null): string => {
  if (!status || status === "active" || status === "available") return "";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game_time_decision")
    return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "";
};

// Check if player has an injury status worth showing
const hasInjuryStatus = (status: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s !== "active" && s !== "available";
};

// Get matchup tier based on rank (5-tier system)
// LOW rank = tough defense = HARD for player (red)
// HIGH rank = weak defense = GOOD for player (green)
type MatchupTier = "elite" | "strong" | "neutral" | "bad" | "worst" | null;

const getDefenseTotalTeams = (
  sport: "nba" | "mlb" | "wnba",
  seasonOrDate?: string | number | null,
  knownTotalTeams?: number | null,
) => getDvpTeamCount(sport, seasonOrDate, knownTotalTeams);

const getMatchupTier = (rank: number | null, totalTeams = 30): MatchupTier => {
  if (rank === null) return null;
  const ranges = getDvpRankRanges(totalTeams);
  const toughEliteCutoff = Math.max(1, Math.floor(ranges.total * 0.17));
  const toughCutoff = ranges.tough.max;
  const favorableCutoff = ranges.favorable.min;
  const favorableEliteCutoff = ranges.total - toughEliteCutoff + 1;

  if (rank <= toughEliteCutoff) return "worst";
  if (rank <= toughCutoff) return "bad";
  if (rank >= favorableEliteCutoff) return "elite";
  if (rank >= favorableCutoff) return "strong";
  return "neutral";
};

// Get matchup rank text color (5-tier system)
const getMatchupRankColor = (
  rank: number | null,
  sport: "nba" | "mlb" | "wnba" = "nba",
  totalTeams?: number | null,
): string => {
  const tier = getMatchupTier(rank, getDefenseTotalTeams(sport, undefined, totalTeams));
  if (!tier) return "text-neutral-500 dark:text-neutral-400";
  switch (tier) {
    case "elite":
      // Bold green text - easiest matchup
      return "text-emerald-800 dark:text-emerald-200 font-bold";
    case "strong":
      return "text-emerald-600 dark:text-emerald-400";
    case "neutral":
      return "text-neutral-500 dark:text-neutral-400";
    case "bad":
      return "text-red-500 dark:text-red-400";
    case "worst":
      // Bold red text - toughest matchup
      return "text-red-800 dark:text-red-200 font-bold";
    default:
      return "text-neutral-500 dark:text-neutral-400";
  }
};

// Column definitions for sortable headers
const SORTABLE_COLUMNS: { key: SortField; label: string }[] = [
  { key: "line", label: "Prop" },
  { key: "l5Avg", label: "L5 Avg" },
  { key: "l10Avg", label: "L10 Avg" },
  { key: "seasonAvg", label: "Season Avg" },
  { key: "streak", label: "Streak" },
  { key: "l5Pct", label: "L5" },
  { key: "l10Pct", label: "L10" },
  { key: "l20Pct", label: "L20" },
  { key: "seasonPct", label: "Season" },
];

const getSortValue = (row: HitRateProfile, field: SortField): number | null => {
  switch (field) {
    case "line":
      return row.line;
    case "l5Avg":
      return row.last5Avg;
    case "l10Avg":
      return row.last10Avg;
    case "seasonAvg":
      return row.seasonAvg;
    case "streak":
      return row.hitStreak;
    case "l5Pct":
      return row.last5Pct;
    case "l10Pct":
      return row.last10Pct;
    case "l20Pct":
      return row.last20Pct;
    case "seasonPct":
      return row.seasonPct;
    case "h2hPct":
      return row.h2hPct;
    case "matchupRank":
      return row.matchupRank;
    default:
      return null;
  }
};

export function HitRateTable({
  sport = "nba",
  rows,
  loading,
  error,
  onRowClick,
  hasMore,
  onLoadMore,
  isLoadingMore,
  totalCount,
  selectedMarkets,
  marketOptions,
  onMarketsChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
  scrollRef,
  initialScrollTop,
  hideNoOdds: hideNoOddsControlled,
  onHideNoOddsChange,
  onOddsAvailabilityChange,
  upgradeBanner,
  bottomContent,
  blurAfterIndex,
  gamesFilter,
}: HitRateTableProps) {
  const effectiveMarketOptions =
    marketOptions && marketOptions.length > 0
      ? marketOptions
      : DEFAULT_MARKET_OPTIONS;
  const tableConfig = getHitRateTableConfig(sport);
  const seasonPctHeaderLabel = tableConfig.seasonPctLabel;
  const showBinaryOddsLabels =
    selectedMarkets.length > 0 && selectedMarkets.every(isBinaryOddsMarket);
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Disabled: Prefetch was causing excessive API calls on every row hover
  // const prefetchPlayer = usePrefetchPlayer();

  // Advanced filter states
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(
    new Set(),
  );
  const [maxMatchupRank, setMaxMatchupRank] = useState<number>(0); // 0 = all
  // Support both controlled and uncontrolled hideNoOdds
  // Default to false so we show all players while odds are loading
  const [hideNoOddsInternal, setHideNoOddsInternal] = useState(false);
  const hideNoOdds = hideNoOddsControlled ?? hideNoOddsInternal;
  const setHideNoOdds = onHideNoOddsChange ?? setHideNoOddsInternal;
  const filterPopupRef = useRef<HTMLDivElement>(null);

  // Compact view: hides Recent (10) chart column and tightens row padding for power users
  const [compactView, setCompactView] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("hit-rate-compact-view") === "true";
  });

  // Line movement dialog state — opened from the compact odds dropdown footer
  const [lineHistoryContext, setLineHistoryContext] =
    useState<LineHistoryContext | null>(null);
  const handleOpenLineMovement = useCallback(
    (
      row: HitRateProfile,
      side: "over" | "under",
      meta?: CompactLineMovementMeta,
    ) => {
      if (!row.eventId || !row.market) return;
      const historySide = isBinaryOddsMarket(row.market)
        ? side === "over"
          ? "yes"
          : "no"
        : side;
      const ctx: LineHistoryContext = {
        source: "edge",
        sport,
        eventId: row.eventId,
        market: row.market,
        marketDisplay: formatMarketLabel(row.market),
        side: historySide,
        line: row.line ?? null,
        playerName: row.playerName ?? null,
        team: row.teamAbbr ?? null,
        bestBookId: meta?.bestBookId ?? row.bestOdds?.book ?? null,
        allBookIds: meta?.allBookIds,
        compareBookIds: meta?.allBookIds?.filter(
          (bookId) => bookId !== (meta.bestBookId ?? row.bestOdds?.book),
        ),
        currentPricesByBook: meta?.currentPricesByBook,
        oddIdsByBook: meta?.oddIdsByBook,
      };
      setLineHistoryContext(ctx);
    },
    [sport],
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("hit-rate-compact-view", String(compactView));
  }, [compactView]);

  // Check if any advanced filters are active
  const hasActiveFilters =
    selectedPositions.size > 0 || maxMatchupRank > 0 || hideNoOdds;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMarketDropdownOpen(false);
      }
      if (
        filterPopupRef.current &&
        !filterPopupRef.current.contains(e.target as Node)
      ) {
        setShowFilterPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Toggle position selection
  const togglePosition = useCallback((pos: string) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) {
        next.delete(pos);
      } else {
        next.add(pos);
      }
      return next;
    });
  }, []);

  // Reset all advanced filters
  const resetFilters = useCallback(() => {
    setSelectedPositions(new Set());
    setMaxMatchupRank(0);
    setHideNoOdds(false);
  }, [setHideNoOdds]);

  // Restore scroll position when returning from drilldown
  useEffect(() => {
    if (
      scrollRef?.current &&
      initialScrollTop !== undefined &&
      initialScrollTop > 0
    ) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: initialScrollTop,
          behavior: "instant",
        });
      });
    }
  }, [initialScrollTop, scrollRef]);

  const toggleMarket = useCallback(
    (value: string) => {
      onMarketsChange(
        selectedMarkets.includes(value)
          ? selectedMarkets.filter((v) => v !== value)
          : [...selectedMarkets, value],
      );
    },
    [selectedMarkets, onMarketsChange],
  );

  const selectAllMarkets = useCallback(() => {
    onMarketsChange(effectiveMarketOptions.map((o) => o.value));
  }, [effectiveMarketOptions, onMarketsChange]);

  const deselectAllMarkets = useCallback(() => {
    // Default back to points when deselecting all
    onMarketsChange([effectiveMarketOptions[0]?.value || "player_points"]);
  }, [effectiveMarketOptions, onMarketsChange]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        // Toggle direction if same field
        const newDirection = sortDirection === "asc" ? "desc" : "asc";
        onSortChange(field, newDirection);
      } else {
        // New field - always default to descending
        // For matchupRank: desc = best matchups first (30, 29, 28... = weak defense)
        // For all other fields: desc = highest values first
        onSortChange(field, "desc");
      }
    },
    [sortField, sortDirection, onSortChange],
  );

  // Apply advanced filters only (sorting is consolidated in sortedRows)
  const filteredRows = useMemo(() => {
    let result = rows;

    // Filter by position
    if (selectedPositions.size > 0) {
      result = result.filter((row) => {
        const pos = row.position?.toUpperCase();
        if (!pos) return false;
        // Handle positions like "G" (guard) matching PG/SG, "F" matching SF/PF
        if (pos === "G")
          return selectedPositions.has("PG") || selectedPositions.has("SG");
        if (pos === "F")
          return selectedPositions.has("SF") || selectedPositions.has("PF");
        return selectedPositions.has(pos);
      });
    }

    // Filter by matchup rank: highest ranks are the weakest defenses.
    if (maxMatchupRank > 0) {
      const defenseTotalTeams = getDefenseTotalTeams(sport);
      const minRankThreshold = defenseTotalTeams + 1 - maxMatchupRank;
      result = result.filter(
        (row) =>
          row.matchupRank !== null && row.matchupRank >= minRankThreshold,
      );
    }

    // Note: hideNoOdds filter is applied in render since odds are fetched separately

    return result;
  }, [rows, selectedPositions, maxMatchupRank, sport]);

  // Odds are now loaded directly from the main API via bestOdds field
  // No separate odds fetch needed - bestodds:nba keys provide the best price
  const oddsLoading = loading; // Odds load with the main data

  // Derived column widths: column order is player, matchup, prop, recent, str, l5,
  // l10, l20, season, h2h, defrank, pace, over, under (14 total). Compact view drops
  // the Recent col (idx 3); the rest carries through.
  const displayedColumnWidths = useMemo(() => {
    const base = tableConfig.columnWidths;
    if (!compactView) return base;
    return [...base.slice(0, 3), ...base.slice(4)];
  }, [compactView, tableConfig.columnWidths]);

  // Sort rows: All sorting consolidated here
  // Priority: 1) "Out" players to bottom, 2) Primary sort field, 3) Odds availability (tiebreaker)
  const sortedRows = useMemo(() => {
    // Get sort field mapping
    const fieldMap: Record<string, keyof HitRateProfile> = {
      line: "line",
      l5Avg: "last5Avg",
      l10Avg: "last10Avg",
      seasonAvg: "seasonAvg",
      streak: "hitStreak",
      l5Pct: "last5Pct",
      l10Pct: "last10Pct",
      l20Pct: "last20Pct",
      seasonPct: "seasonPct",
      h2hPct: "h2hPct",
      matchupRank: "matchupRank",
    };

    const sortFieldKey = sortField ? fieldMap[sortField] : null;
    const multiplier = sortDirection === "asc" ? 1 : -1;

    // Pace rank lives on a nested path (paceContext.opponentRecent.l5Rank), so we
    // resolve it via a custom getter rather than fieldMap.
    const getSortValue = (row: HitRateProfile): number | null => {
      if (sortField === "paceRank") {
        return row.paceContext?.opponentRecent.l5Rank ?? null;
      }
      if (sortFieldKey) {
        return row[sortFieldKey] as number | null;
      }
      return null;
    };

    return [...filteredRows].sort((a, b) => {
      // 0. ALWAYS push "out" players to the bottom
      const aIsOut = a.injuryStatus?.toLowerCase() === "out";
      const bIsOut = b.injuryStatus?.toLowerCase() === "out";
      if (aIsOut && !bIsOut) return 1;
      if (!aIsOut && bIsOut) return -1;

      // 1. PRIMARY SORT: by user's selected field (L10%, etc.)
      if (sortField) {
        const aVal = getSortValue(a);
        const bVal = getSortValue(b);

        // Push nulls to the end (regardless of sort direction)
        if (aVal === null && bVal !== null) return 1;
        if (aVal !== null && bVal === null) return -1;

        // If both have values, compare them
        if (aVal !== null && bVal !== null) {
          const diff = (aVal - bVal) * multiplier;
          if (diff !== 0) return diff;
        }
        // If both are null, fall through to secondary sort
      }

      // 2. SECONDARY SORT (tiebreaker): prefer rows with odds
      // Only apply when data has finished loading
      if (!oddsLoading) {
        const aHasOdds = hasTableOdds(a);
        const bHasOdds = hasTableOdds(b);

        if (aHasOdds && !bHasOdds) return -1;
        if (!aHasOdds && bHasOdds) return 1;
      }

      return 0;
    });
  }, [filteredRows, oddsLoading, sortField, sortDirection]);

  const displayedRows = useMemo(() => {
    if (!hideNoOdds || oddsLoading) return sortedRows;
    return sortedRows.filter(hasTableOdds);
  }, [hideNoOdds, oddsLoading, sortedRows]);

  const recentTrendSport =
    sport === "wnba" ? "wnba" : sport === "nba" ? "nba" : null;
  const recentTrendPlayerIds = useMemo(() => {
    if (!recentTrendSport) return [];
    return Array.from(
      new Set(
        displayedRows
          .slice(0, 60)
          .map((row) => row.playerId)
          .filter(Boolean),
      ),
    );
  }, [displayedRows, recentTrendSport]);

  const recentTrendsQuery = useQuery<RecentTrendMap>({
    queryKey: [
      "hit-rate-recent-trends",
      recentTrendSport,
      recentTrendPlayerIds.join(","),
    ],
    queryFn: () => fetchRecentTrends(recentTrendSport!, recentTrendPlayerIds),
    enabled: !!recentTrendSport && recentTrendPlayerIds.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Report which profiles have odds (for filtering in other components like sidebar)
  // Use a ref to track previous value and avoid infinite loops
  const prevOddsIdsRef = useRef<string>("");

  useEffect(() => {
    if (!onOddsAvailabilityChange || oddsLoading) return;

    const idsWithOdds = new Set<string>();
    for (const row of rows) {
      // DD/TD rows hydrate their Redis player context from sibling markets,
      // then the compact odds cell fetches the live yes/no market directly.
      if ((row.oddsSelectionId || row.selKey) && hasTableOdds(row)) {
        idsWithOdds.add(row.oddsSelectionId ?? row.selKey!);
      }
    }

    // Only call callback if the set actually changed
    const idsString = Array.from(idsWithOdds).sort().join(",");
    if (idsString !== prevOddsIdsRef.current) {
      prevOddsIdsRef.current = idsString;
      onOddsAvailabilityChange(idsWithOdds);
    }
  }, [rows, oddsLoading, onOddsAvailabilityChange]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );
  };

  // Render filter bar component (extracted for reuse) - Premium styling
  // z-[20] ensures dropdowns appear above the sticky table header (z-[5])
  const filterBar = (
    <div className="relative z-[20] flex shrink-0 items-center gap-4 border-b border-neutral-200/80 bg-gradient-to-r from-white via-neutral-50/50 to-white px-5 py-3.5 backdrop-blur-sm dark:border-neutral-800/80 dark:from-neutral-900 dark:via-neutral-800/30 dark:to-neutral-900">
      {/* Markets Dropdown - Premium */}
      <div ref={dropdownRef} className="relative z-[9998]">
        <button
          type="button"
          onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
          className={cn(
            "flex w-[190px] items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200",
            "bg-white shadow-sm hover:shadow-md dark:bg-neutral-800/90",
            "border border-neutral-200/80 dark:border-neutral-700/80",
            "ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
            marketDropdownOpen && "ring-brand/30 border-brand/50 ring-2",
          )}
        >
          <span className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {selectedMarkets.length === 0
              ? "No markets"
              : selectedMarkets.length === effectiveMarketOptions.length
                ? "All Markets"
                : selectedMarkets.length === 1
                  ? (effectiveMarketOptions.find(
                      (o) => o.value === selectedMarkets[0],
                    )?.label ?? "1 selected")
                  : selectedMarkets.length === 2
                    ? selectedMarkets
                        .map(
                          (m) =>
                            effectiveMarketOptions.find((o) => o.value === m)
                              ?.label,
                        )
                        .filter(Boolean)
                        .join(", ")
                    : `${selectedMarkets.length} selected`}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200",
              marketDropdownOpen && "text-brand rotate-180",
            )}
          />
        </button>

        {marketDropdownOpen && (
          <div className="absolute top-full left-0 z-[9999] mt-2 w-[220px] rounded-2xl border border-neutral-200/80 bg-white/95 p-2 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:ring-white/5">
            <div className="mb-2 flex items-center justify-between border-b border-neutral-100 px-1 pb-2 dark:border-neutral-800">
              <button
                type="button"
                onClick={selectAllMarkets}
                className="text-brand hover:text-brand/80 text-xs font-semibold transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAllMarkets}
                className="text-xs font-semibold text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                Clear All
              </button>
            </div>
            <div className="flex max-h-64 flex-col gap-0.5 overflow-auto">
              {effectiveMarketOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Checkbox
                    checked={selectedMarkets.includes(opt.value)}
                    onCheckedChange={() => toggleMarket(opt.value)}
                  />
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Games Filter Dropdown */}
      {gamesFilter}

      {/* Search Input - Premium */}
      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
        <input
          type="text"
          placeholder="Search player or team..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-full rounded-xl py-2.5 pr-9 pl-10 text-sm shadow-sm",
            "bg-white dark:bg-neutral-800/90",
            "border border-neutral-200/80 dark:border-neutral-700/80",
            "ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
            "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
            "focus:ring-brand/30 focus:border-brand/50 focus:ring-2 focus:outline-none",
            "transition-all duration-200 dark:text-white",
          )}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Compact View Toggle — hides Recent (10) chart and tightens row padding.
          ml-auto pushes the right cluster (Compact / Filters / props pill) to
          the far right edge so the search input stays anchored on the left. */}
      <Tooltip
        content={
          compactView
            ? "Switch to expanded view (with charts)"
            : "Switch to compact view (hides charts)"
        }
        side="top"
      >
        <button
          type="button"
          onClick={() => setCompactView(!compactView)}
          aria-pressed={compactView}
          className={cn(
            "ml-auto flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200",
            compactView
              ? "bg-brand/10 border-brand/40 text-brand shadow-brand/10 dark:bg-brand/20 dark:border-brand/50 shadow-sm"
              : "border-neutral-200/80 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50 hover:shadow-md dark:border-neutral-700/80 dark:bg-neutral-800/90 dark:text-neutral-300 dark:hover:bg-neutral-800",
            "border ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
          )}
        >
          <Rows3 className="h-4 w-4" />
          <span className="hidden lg:inline">Compact</span>
        </button>
      </Tooltip>

      {/* Advanced Filters Button - Premium */}
      <div ref={filterPopupRef} className="relative z-[9998]">
        <button
          type="button"
          onClick={() => setShowFilterPopup(!showFilterPopup)}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
            showFilterPopup || hasActiveFilters
              ? "bg-brand/10 border-brand/40 text-brand shadow-brand/10 dark:bg-brand/20 dark:border-brand/50 shadow-sm"
              : "border-neutral-200/80 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50 hover:shadow-md dark:border-neutral-700/80 dark:bg-neutral-800/90 dark:text-neutral-300 dark:hover:bg-neutral-800",
            "border ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-brand h-2 w-2 animate-pulse rounded-full" />
          )}
        </button>

        {/* Filter Popup - Premium */}
        {showFilterPopup && (
          <div className="absolute top-full right-0 z-[9999] mt-2 w-[340px] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:ring-white/5">
            {/* Header with gradient */}
            <div className="flex items-center justify-between border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-5 py-3.5 dark:border-neutral-800 dark:from-neutral-800/50 dark:to-neutral-900">
              <span className="text-sm font-bold text-neutral-900 dark:text-white">
                Advanced Filters
              </span>
              <button
                onClick={() => setShowFilterPopup(false)}
                className="rounded-lg p-1.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                <X className="h-4 w-4 text-neutral-400" />
              </button>
            </div>

            {/* Position Filter */}
            <div className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
              <div className="mb-3 text-xs font-bold tracking-wider text-neutral-600 uppercase dark:text-neutral-400">
                Position
              </div>
              <div className="flex flex-wrap gap-2">
                {POSITION_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => togglePosition(value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200",
                      selectedPositions.has(value)
                        ? "from-brand to-brand/90 shadow-brand/20 bg-gradient-to-r text-white shadow-md"
                        : "border border-neutral-200/60 bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700/60 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700",
                    )}
                  >
                    {selectedPositions.has(value) && (
                      <Check className="h-3 w-3" />
                    )}
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {/* Matchup Rank Filter - Number Input */}
            <div className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Top Matchups Only
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {maxMatchupRank > 0
                      ? `Showing top ${maxMatchupRank} matchups`
                      : "Showing all matchups"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMaxMatchupRank(Math.max(0, maxMatchupRank - 1))
                    }
                    disabled={maxMatchupRank === 0}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-200",
                      maxMatchupRank === 0
                        ? "cursor-not-allowed border-neutral-200 text-neutral-300 dark:border-neutral-700 dark:text-neutral-600"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:shadow-sm dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800",
                    )}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={MAX_MATCHUP_RANK_LIMIT}
                    value={maxMatchupRank || ""}
                    placeholder="All"
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val) || val < 0) {
                        setMaxMatchupRank(0);
                      } else {
                        setMaxMatchupRank(
                          Math.min(val, MAX_MATCHUP_RANK_LIMIT),
                        );
                      }
                    }}
                    className="focus:ring-brand/30 focus:border-brand/50 h-8 w-16 [appearance:textfield] rounded-xl border border-neutral-200 bg-white text-center text-sm font-bold text-neutral-900 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setMaxMatchupRank(
                        Math.min(MAX_MATCHUP_RANK_LIMIT, maxMatchupRank + 1),
                      )
                    }
                    disabled={maxMatchupRank >= MAX_MATCHUP_RANK_LIMIT}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-200",
                      maxMatchupRank >= MAX_MATCHUP_RANK_LIMIT
                        ? "cursor-not-allowed border-neutral-200 text-neutral-300 dark:border-neutral-700 dark:text-neutral-600"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:shadow-sm dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800",
                    )}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Hide No Odds Toggle */}
            <div className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
              <label className="group flex cursor-pointer items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Hide Players Without Odds
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    Only show props with available betting lines
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideNoOdds}
                  onClick={() => setHideNoOdds(!hideNoOdds)}
                  className={cn(
                    "focus:ring-brand/30 relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-neutral-900",
                    hideNoOdds
                      ? "from-brand to-brand/90 bg-gradient-to-r shadow-inner"
                      : "bg-neutral-200 dark:bg-neutral-700",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-200",
                      hideNoOdds ? "translate-x-[26px]" : "translate-x-1",
                    )}
                  />
                </button>
              </label>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <div className="bg-gradient-to-r from-neutral-50 to-neutral-100/50 px-5 py-3 dark:from-neutral-800/50 dark:to-neutral-800/30">
                <button
                  onClick={resetFilters}
                  className="w-full rounded-xl border border-transparent py-2.5 text-xs font-bold text-neutral-500 transition-all duration-200 hover:border-neutral-200 hover:bg-white hover:text-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Count indicator - Premium pill style. ml-auto on the Compact button
          above already anchors the right cluster, so no extra spacing needed
          here — just sits flush after Filters. */}
      <div className="rounded-full border border-neutral-200/60 bg-neutral-100 px-3 py-1.5 dark:border-neutral-700/60 dark:bg-neutral-800">
        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          {hasActiveFilters ||
          selectedMarkets.length < effectiveMarketOptions.length ? (
            // Filters active - show filtered count
            <>{displayedRows.length} props</>
          ) : totalCount !== undefined ? (
            // All markets, no filters - show pagination info
            <>
              {rows.length} of {totalCount} props
            </>
          ) : (
            <>{rows.length} props</>
          )}
        </span>
      </div>
    </div>
  );

  // Loading state - Premium
  if (loading) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white shadow-lg ring-1 ring-black/[0.03] dark:border-neutral-800/80 dark:bg-neutral-900 dark:ring-white/[0.03]">
        {filterBar}
        <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-transparent to-neutral-50/50 py-16 dark:to-neutral-950/50">
          <div className="text-center">
            <div className="relative inline-flex">
              <div className="border-brand/30 border-t-brand h-12 w-12 animate-spin rounded-full border-4 border-solid" />
              <Chart className="text-brand/60 absolute inset-0 m-auto h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Loading hit rates...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state - Premium
  if (error) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white shadow-lg ring-1 ring-black/[0.03] dark:border-neutral-800/80 dark:bg-neutral-900 dark:ring-white/[0.03]">
        {filterBar}
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="max-w-sm rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50 to-red-100/50 p-6 text-red-800 shadow-sm dark:border-red-900/40 dark:from-red-950/40 dark:to-red-900/20 dark:text-red-200">
            <p className="text-lg font-bold">Unable to load hit rates</p>
            <p className="mt-2 text-sm opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no markets selected or no data) - Premium
  if (!rows.length) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white shadow-lg ring-1 ring-black/[0.03] dark:border-neutral-800/80 dark:bg-neutral-900 dark:ring-white/[0.03]">
        {filterBar}
        <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-transparent to-neutral-50/50 py-20 dark:to-neutral-950/50">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200/50 bg-gradient-to-br from-neutral-100 to-neutral-50 shadow-sm dark:border-neutral-700/50 dark:from-neutral-800 dark:to-neutral-900">
              <Chart className="h-8 w-8 text-neutral-400 dark:text-neutral-500" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-neutral-900 dark:text-white">
              {selectedMarkets.length === 0
                ? "No markets selected"
                : "No hit rates available"}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {selectedMarkets.length === 0
                ? "Select one or more markets from the dropdown above."
                : "Check back closer to tip-off or adjust your filters."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white shadow-lg ring-1 ring-black/[0.03] dark:border-neutral-800/80 dark:bg-neutral-900 dark:ring-white/[0.03]">
      {filterBar}

      {/* Optional upgrade banner for gated access */}
      {upgradeBanner}

      {/* Table - Premium styling */}
      <div ref={scrollRef} className="flex-1 overflow-auto rounded-b-2xl">
        <table className="min-w-full table-fixed border-separate border-spacing-y-1 text-sm">
          <colgroup>
            {displayedColumnWidths.map((width, idx) => (
              <col key={`hr-col-${idx}`} style={{ width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[5]">
            {/* Grouped category row — pairs columns into "Hit Rate %" and "Defense Context" */}
            <tr className="bg-gradient-to-r from-neutral-50 via-white to-neutral-50 backdrop-blur-sm dark:from-neutral-900 dark:via-neutral-800/50 dark:to-neutral-900">
              {/* Spacer for Player + Matchup + Prop (+ Recent) + Str */}
              <th
                colSpan={compactView ? 4 : 5}
                aria-hidden="true"
                className="h-9"
              />
              {/* Hit Rate % group: L5 / L10 / L20 / Season / H2H */}
              <th
                colSpan={5}
                scope="colgroup"
                className="h-9 border-l border-neutral-200/40 px-3 pt-3 pb-1 text-center align-bottom text-[10px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:border-neutral-800/40 dark:text-neutral-500"
              >
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="via-brand/30 to-brand/50 h-px flex-1 bg-gradient-to-r from-transparent"
                    aria-hidden="true"
                  />
                  <span className="shrink-0">Hit Rate %</span>
                  <span
                    className="via-brand/30 to-brand/50 h-px flex-1 bg-gradient-to-l from-transparent"
                    aria-hidden="true"
                  />
                </div>
              </th>
              {/* Defense Context group: DEF Rank / Pace */}
              <th
                colSpan={2}
                scope="colgroup"
                className="h-9 border-l border-neutral-200/40 px-3 pt-3 pb-1 text-center align-bottom text-[10px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:border-neutral-800/40 dark:text-neutral-500"
              >
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="via-brand/30 to-brand/50 h-px flex-1 bg-gradient-to-r from-transparent"
                    aria-hidden="true"
                  />
                  <span className="shrink-0">Defense Context</span>
                  <span
                    className="via-brand/30 to-brand/50 h-px flex-1 bg-gradient-to-l from-transparent"
                    aria-hidden="true"
                  />
                </div>
              </th>
              {/* Odds group: always 2 cols (Over / Under) */}
              <th
                colSpan={2}
                scope="colgroup"
                className="h-9 border-l border-neutral-200/40 px-3 pt-3 pb-1 text-center align-bottom text-[10px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:border-neutral-800/40 dark:text-neutral-500"
              >
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="via-brand/30 to-brand/50 h-px flex-1 bg-gradient-to-r from-transparent"
                    aria-hidden="true"
                  />
                  <span className="shrink-0">Odds</span>
                  <span
                    className="via-brand/30 to-brand/50 h-px flex-1 bg-gradient-to-l from-transparent"
                    aria-hidden="true"
                  />
                </div>
              </th>
            </tr>
            <tr className="bg-gradient-to-r from-neutral-50 via-white to-neutral-50 backdrop-blur-sm dark:from-neutral-900 dark:via-neutral-800/50 dark:to-neutral-900">
              {/* Non-sortable columns */}
              <th className="h-14 border-b border-neutral-200/80 px-4 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase dark:border-neutral-800/80 dark:text-neutral-400">
                Player
              </th>
              {/* Sortable: Matchup */}
              <th
                onClick={() => handleSort("matchupRank")}
                className="h-14 cursor-pointer border-b border-neutral-200/80 px-3 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  Matchup
                  <SortIcon field="matchupRank" />
                </div>
              </th>

              {/* Sortable: Prop (line) */}
              <th
                onClick={() => handleSort("line")}
                className="h-14 cursor-pointer border-b border-neutral-200/80 px-3 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  Prop
                  <SortIcon field="line" />
                </div>
              </th>

              {!compactView && (
                <th className="h-14 border-b border-neutral-200/80 px-3 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase dark:border-neutral-800/80 dark:text-neutral-400">
                  Recent (10)
                </th>
              )}

              {/* Sortable: Streak */}
              <th
                onClick={() => handleSort("streak")}
                className="h-14 cursor-pointer border-b border-neutral-200/80 px-2 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <Tooltip
                  content="Hit Streak - Consecutive games hitting this line"
                  side="top"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>Str</span>
                    <SortIcon field="streak" />
                  </div>
                </Tooltip>
              </th>

              {/* Sortable: L5 (first cell of Hit Rate % group) */}
              <th
                onClick={() => handleSort("l5Pct")}
                className="h-14 w-16 min-w-[64px] cursor-pointer border-b border-l border-neutral-200/80 border-l-neutral-200/40 px-2 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:border-l-neutral-800/40 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  L5
                  <SortIcon field="l5Pct" />
                </div>
              </th>

              {/* Sortable: L10 */}
              <th
                onClick={() => handleSort("l10Pct")}
                className="h-14 cursor-pointer border-b border-neutral-200/80 px-2 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  L10
                  <SortIcon field="l10Pct" />
                </div>
              </th>

              {/* Sortable: L20 */}
              <th
                onClick={() => handleSort("l20Pct")}
                className="h-14 cursor-pointer border-b border-neutral-200/80 px-2 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  L20
                  <SortIcon field="l20Pct" />
                </div>
              </th>

              {/* Sortable: 25/26 % (Season %) */}
              <th
                onClick={() => handleSort("seasonPct")}
                className="h-14 cursor-pointer border-b border-neutral-200/80 px-3 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  {seasonPctHeaderLabel}
                  <SortIcon field="seasonPct" />
                </div>
              </th>

              {/* H2H % (Head to Head) */}
              <th
                onClick={() => handleSort("h2hPct")}
                className="h-14 cursor-pointer border-b border-neutral-200/80 px-3 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  H2H
                  <SortIcon field="h2hPct" />
                </div>
              </th>

              {/* Defensive context columns (first cell starts Defense Context group) */}
              <th
                onClick={() => handleSort("matchupRank")}
                className="h-14 cursor-pointer border-b border-l border-neutral-200/80 border-l-neutral-200/40 px-3 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:border-l-neutral-800/40 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  DEF Rank
                  <SortIcon field="matchupRank" />
                </div>
              </th>
              <th
                onClick={() => handleSort("paceRank")}
                className="h-14 cursor-pointer border-b border-neutral-200/80 px-3 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase transition-all duration-200 select-none hover:bg-neutral-100/50 hover:text-neutral-700 dark:border-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
              >
                <div className="flex items-center justify-center gap-1">
                  Pace
                  <SortIcon field="paceRank" />
                </div>
              </th>

              {/* Odds — always Over / Under */}
              <th className="h-14 border-b border-l border-neutral-200/80 border-l-neutral-200/40 px-2 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase dark:border-neutral-800/80 dark:border-l-neutral-800/40 dark:text-neutral-400">
                {showBinaryOddsLabels ? "Yes" : "Over"}
              </th>
              <th className="h-14 border-b border-neutral-200/80 px-2 text-center text-[11px] font-bold tracking-wider text-neutral-500 uppercase dark:border-neutral-800/80 dark:text-neutral-400">
                {showBinaryOddsLabels ? "No" : "Under"}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, idx) => {
              const opponent =
                row.opponentTeamAbbr ?? row.opponentTeamName ?? "Opponent";
              const matchup = row.teamAbbr
                ? `${row.teamAbbr} vs ${opponent}`
                : opponent;
              const isHighConfidence = (row.last10Pct ?? 0) >= 70;
              // Use composite key with index to guarantee uniqueness
              // (same player can have duplicate profiles for same game in data)
              const rowKey = `${row.id}-${row.gameId ?? "no-game"}-${row.market}-${idx}`;
              const rowSport =
                sport === "mlb" ? "mlb" : sport === "wnba" ? "wnba" : "nba";
              const defenseTotalTeamsForRow = getDefenseTotalTeams(
                rowSport,
                row.gameDate,
                row.dvpTotalTeams,
              );

              // Check if this row should be blurred (for gated access)
              const isBlurred =
                blurAfterIndex !== undefined && idx >= blurAfterIndex;

              return (
                <React.Fragment key={rowKey}>
                  <tr
                    onClick={() => !isBlurred && onRowClick?.(row)}
                    className={cn(
                      "group overflow-hidden transition-all duration-200",
                      idx % 2 === 0
                        ? "bg-white/90 dark:bg-neutral-950/70"
                        : "bg-neutral-50/90 dark:bg-neutral-900/70",
                      "shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
                      isBlurred
                        ? "pointer-events-none cursor-default select-none"
                        : "hover:bg-brand/[0.045] dark:hover:bg-brand/10 cursor-pointer hover:shadow-[inset_4px_0_0_0_rgba(14,165,233,0.55),inset_0_0_0_1px_rgba(14,165,233,0.24)]",
                    )}
                  >
                    {/* Player Column: (Headshot in normal mode) + Name + Position/Jersey */}
                    <td
                      className={cn(
                        "rounded-l-xl px-3 py-4",
                        compactView && "py-2",
                      )}
                    >
                      {isBlurred ? (
                        // Blurred placeholder content
                        <div className="flex items-center gap-3 opacity-50">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-xs font-black text-neutral-400 tabular-nums dark:border-neutral-800 dark:bg-neutral-900">
                            {idx + 1}
                          </span>
                          {!compactView && (
                            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-200 shadow-sm dark:bg-neutral-700">
                              <User className="h-7 w-7 text-neutral-400 dark:text-neutral-500" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm leading-tight font-bold text-neutral-400 blur-[2px] dark:text-neutral-500">
                                Player Name
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400 blur-[2px] dark:text-neutral-500">
                              <span>Team</span>
                              <span className="text-neutral-300 dark:text-neutral-600">
                                •
                              </span>
                              <span>Position</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Normal content
                        <div
                          className={cn(
                            "flex items-center gap-3",
                            isPlayerOut(row.injuryStatus) && "opacity-50",
                          )}
                        >
                          <span className="group-hover:border-brand/30 group-hover:text-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-xs font-black text-neutral-500 tabular-nums transition-all duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                            {idx + 1}
                          </span>
                          {!compactView &&
                            (() => {
                              const hasInjury = hasReportableInjury(
                                row.injuryStatus,
                              );

                              const headshotElement = (
                                <div
                                  className={cn(
                                    "group-hover:ring-brand/40 relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-100 shadow-sm ring-1 ring-neutral-200/70 transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-md dark:bg-neutral-800/60 dark:ring-neutral-800/80",
                                    hasInjury && "cursor-pointer",
                                    getStatusBorderClass(row.injuryStatus),
                                  )}
                                  style={
                                    row.primaryColor
                                      ? {
                                          // Subtle team-color accent: a 2px inner ring + soft glow on hover.
                                          // Replaces the loud full-bg gradient that fought with row-level data.
                                          boxShadow: `inset 0 -2px 0 ${row.primaryColor}88`,
                                        }
                                      : undefined
                                  }
                                >
                                  <PlayerHeadshot
                                    sport={sport}
                                    nbaPlayerId={
                                      row.nbaPlayerId ?? row.playerId
                                    }
                                    mlbPlayerId={row.playerId}
                                    name={row.playerName}
                                    size="small"
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              );

                              return hasInjury ? (
                                <Tooltip
                                  content={
                                    <InjuryReportTooltipContent
                                      playerName={row.playerName}
                                      status={row.injuryStatus}
                                      notes={row.injuryNotes}
                                      updatedAt={row.injuryUpdatedAt}
                                      returnDate={row.injuryReturnDate}
                                      source={row.injurySource}
                                      rawStatus={row.injuryRawStatus}
                                    />
                                  }
                                  side="right"
                                  contentClassName="p-0"
                                >
                                  {headshotElement}
                                </Tooltip>
                              ) : (
                                headshotElement
                              );
                            })()}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm leading-tight font-bold text-neutral-900 dark:text-white">
                                {row.playerName}
                              </span>
                              {hasInjuryStatus(row.injuryStatus) &&
                                (() => {
                                  const isGLeague = isGLeagueAssignment(
                                    row.injuryNotes,
                                  );
                                  return (
                                    <Tooltip
                                      content={
                                        <InjuryReportTooltipContent
                                          playerName={row.playerName}
                                          status={row.injuryStatus}
                                          notes={row.injuryNotes}
                                          updatedAt={row.injuryUpdatedAt}
                                          returnDate={row.injuryReturnDate}
                                          source={row.injurySource}
                                          rawStatus={row.injuryRawStatus}
                                        />
                                      }
                                      side="top"
                                      contentClassName="p-0"
                                    >
                                      {isGLeague ? (
                                        <ArrowDown className="h-4 w-4 shrink-0 cursor-help text-blue-500" />
                                      ) : (
                                        <HeartPulse
                                          className={cn(
                                            "h-4 w-4 shrink-0 cursor-help",
                                            getInjuryIconColorClass(
                                              row.injuryStatus,
                                            ),
                                          )}
                                        />
                                      )}
                                    </Tooltip>
                                  );
                                })()}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                              {row.teamAbbr && (
                                <img
                                  src={getTeamLogoUrl(row.teamAbbr, sport)}
                                  alt={row.teamAbbr}
                                  className="h-3.5 w-3.5 shrink-0 object-contain"
                                />
                              )}
                              {row.teamAbbr && (
                                <span className="font-bold tracking-wide text-neutral-700 uppercase dark:text-neutral-300">
                                  {row.teamAbbr}
                                </span>
                              )}
                              <span className="text-neutral-300 dark:text-neutral-600">
                                ·
                              </span>
                              <Tooltip
                                content={getPositionLabel(row.position)}
                                side="top"
                              >
                                <span className="cursor-help">
                                  {formatPosition(row.position)}
                                </span>
                              </Tooltip>
                              {row.jerseyNumber !== null &&
                                row.jerseyNumber !== undefined && (
                                  <>
                                    <span className="text-neutral-300 dark:text-neutral-600">
                                      ·
                                    </span>
                                    <span className="tabular-nums">
                                      #{row.jerseyNumber}
                                    </span>
                                  </>
                                )}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Matchup Column — opponent + game time + game lines (DEF rank lives in its own column) */}
                    <td
                      className={cn(
                        "px-2 py-4 text-center align-middle",
                        compactView && "py-2",
                      )}
                    >
                      {isBlurred ? (
                        <div
                          className={cn(
                            "mx-auto flex max-w-[112px] items-center justify-center gap-1.5 opacity-50 blur-[2px]",
                            compactView ? "flex-row" : "flex-col",
                          )}
                        >
                          <span className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                            vs
                          </span>
                          <div
                            className={cn(
                              "shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700",
                              compactView ? "h-5 w-5" : "h-7 w-7",
                            )}
                          />
                          {!compactView && (
                            <span className="text-[10px] font-bold text-neutral-400 tabular-nums">
                              —:—
                            </span>
                          )}
                        </div>
                      ) : compactView ? (
                        // Compact: single-line opponent (vs/@ + logo + abbr) — drops time and game lines
                        <div className="mx-auto flex max-w-[112px] items-center justify-center gap-1.5">
                          <span className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                            {row.homeAway === "H" ? "vs" : "@"}
                          </span>
                          {row.opponentTeamAbbr && (
                            <img
                              src={getTeamLogoUrl(row.opponentTeamAbbr, sport)}
                              alt={row.opponentTeamAbbr}
                              className="h-5 w-5 object-contain"
                            />
                          )}
                          {row.opponentTeamAbbr && (
                            <span className="text-[11px] font-bold text-neutral-700 tabular-nums dark:text-neutral-300">
                              {row.opponentTeamAbbr}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="mx-auto flex max-w-[112px] flex-col items-center gap-1">
                          {/* Tomorrow accent (rare, only when the game is next-day) */}
                          {isTomorrow(row.gameDate) && (
                            <span className="rounded-sm bg-amber-500/15 px-1.5 py-px text-[9px] leading-none font-bold tracking-[0.12em] text-amber-600 uppercase dark:text-amber-300">
                              Tomorrow
                            </span>
                          )}

                          {/* Primary: vs/@ + opponent logo */}
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                              {row.homeAway === "H" ? "vs" : "@"}
                            </span>
                            {row.opponentTeamAbbr && (
                              <img
                                src={getTeamLogoUrl(
                                  row.opponentTeamAbbr,
                                  sport,
                                )}
                                alt={row.opponentTeamAbbr}
                                className={cn(
                                  "object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]",
                                  sport === "wnba" ? "h-8 w-8" : "h-7 w-7",
                                )}
                              />
                            )}
                          </div>

                          {/* Time */}
                          <span className="text-[10px] leading-none font-bold tracking-[0.06em] text-neutral-500 uppercase tabular-nums dark:text-neutral-400">
                            {formatGameTime(row.gameStatus, row.gameDate)}
                          </span>

                          {/* Game lines — inline strip, muted, no chunky pills */}
                          {(row.total !== null || row.spread !== null) && (
                            <Tooltip
                              content={[
                                row.spread !== null
                                  ? `Spread from ${formatBookName(row.spreadBook) ?? "available books"}`
                                  : null,
                                row.total !== null
                                  ? `Total from ${formatBookName(row.totalBook) ?? "available books"}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                              side="top"
                            >
                              <div className="mt-0.5 flex cursor-help items-center justify-center gap-1 text-[10px] leading-none font-bold text-neutral-500 tabular-nums dark:text-neutral-400">
                                {row.spread !== null && (
                                  <span className="text-neutral-700 dark:text-neutral-200">
                                    {formatSpread(row.spread)}
                                  </span>
                                )}
                                {row.spread !== null && row.total !== null && (
                                  <span className="text-neutral-300 dark:text-neutral-700">
                                    ·
                                  </span>
                                )}
                                {row.total !== null && (
                                  <span>
                                    O/U{" "}
                                    <span className="text-neutral-700 dark:text-neutral-200">
                                      {formatTotal(row.total)}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Prop Column — line value stacked over market label, no info icon */}
                    <td
                      className={cn(
                        "px-3 py-4 text-center align-middle",
                        compactView && "py-2",
                      )}
                    >
                      {isBlurred ? (
                        <div className="flex flex-col items-center gap-0.5 opacity-50 blur-[2px]">
                          <span className="text-[15px] leading-none font-black text-neutral-400 tabular-nums">
                            00.0
                          </span>
                          <span className="text-[10px] font-bold tracking-[0.12em] text-neutral-400 uppercase">
                            PTS
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          {row.line !== null && (
                            <span className="text-[15px] leading-none font-black text-neutral-900 tabular-nums dark:text-white">
                              {row.line}
                            </span>
                          )}
                          <span className="text-[10px] font-bold tracking-[0.12em] text-neutral-500 uppercase dark:text-neutral-400">
                            {formatMarketLabel(row.market)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Recent trend bars — hidden in compact view */}
                    {!compactView && (
                      <td className="px-3 py-3 align-middle">
                        <RecentTrendBars
                          row={row}
                          games={recentTrendsQuery.data?.[String(row.playerId)]}
                          isLoading={
                            recentTrendsQuery.isLoading ||
                            recentTrendsQuery.isFetching
                          }
                          isBlurred={isBlurred}
                          sport={rowSport}
                        />
                      </td>
                    )}

                    {/* Streak Column */}
                    <td
                      className={cn(
                        "px-1 py-5 text-center align-middle",
                        compactView && "py-2",
                      )}
                    >
                      {isBlurred ? (
                        <span className="text-sm font-medium text-neutral-400 opacity-50 blur-[2px]">
                          0
                        </span>
                      ) : row.hitStreak !== null &&
                        row.hitStreak !== undefined ? (
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {row.hitStreak}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">
                          —
                        </span>
                      )}
                    </td>

                    {/* L5 % — edge-to-edge tier fill, with brand-tinted left divider for the Hit Rate % group */}
                    <td
                      className={cn(
                        "border-brand/20 dark:border-brand/15 border-l px-2 py-3 text-center align-middle transition-colors duration-200",
                        compactView && "py-1.5",
                        !isBlurred && getHitRateHeatClass(row.last5Pct),
                      )}
                    >
                      <HitRateCell
                        value={row.last5Pct}
                        sampleSize={5}
                        isBlurred={isBlurred}
                      />
                    </td>

                    {/* L10 % */}
                    <td
                      className={cn(
                        "px-2 py-3 text-center align-middle transition-colors duration-200",
                        compactView && "py-1.5",
                        !isBlurred && getHitRateHeatClass(row.last10Pct),
                      )}
                    >
                      <HitRateCell
                        value={row.last10Pct}
                        sampleSize={10}
                        isBlurred={isBlurred}
                      />
                    </td>

                    {/* L20 % */}
                    <td
                      className={cn(
                        "px-2 py-3 text-center align-middle transition-colors duration-200",
                        compactView && "py-1.5",
                        !isBlurred && getHitRateHeatClass(row.last20Pct),
                      )}
                    >
                      <HitRateCell
                        value={row.last20Pct}
                        sampleSize={20}
                        isBlurred={isBlurred}
                      />
                    </td>

                    {/* Season % */}
                    <td
                      className={cn(
                        "px-2 py-3 text-center align-middle transition-colors duration-200",
                        compactView && "py-1.5",
                        !isBlurred && getHitRateHeatClass(row.seasonPct),
                      )}
                    >
                      <HitRateCell
                        value={row.seasonPct}
                        sampleSize={row.seasonGames}
                        subLabel="SZN"
                        isBlurred={isBlurred}
                      />
                    </td>

                    {/* H2H % */}
                    <td
                      className={cn(
                        "px-2 py-3 text-center align-middle transition-colors duration-200",
                        compactView && "py-1.5",
                        !isBlurred && getHitRateHeatClass(row.h2hPct),
                      )}
                    >
                      <HitRateCell
                        value={row.h2hPct}
                        sampleSize={row.h2hGames}
                        isBlurred={isBlurred}
                      />
                    </td>

                    {/* Defensive context: rank vs position — edge-to-edge tier fill matching Hit Rate cells */}
                    <td
                      className={cn(
                        "border-brand/20 dark:border-brand/15 border-l px-2 py-3 text-center align-middle transition-colors duration-200",
                        compactView && "py-1.5",
                        !isBlurred &&
                          getDefRankCellClass(
                            row.matchupRank,
                            rowSport,
                            defenseTotalTeamsForRow,
                          ),
                      )}
                    >
                      {isBlurred || row.matchupRank === null ? (
                        <span className="text-xs font-black tabular-nums">
                          —
                        </span>
                      ) : (
                        (() => {
                          const tier = getMatchupTier(
                            row.matchupRank,
                            defenseTotalTeamsForRow,
                          );
                          const tierLabel =
                            tier === "elite"
                              ? "Easy matchup"
                              : tier === "strong"
                                ? "Favorable matchup"
                                : tier === "bad"
                                  ? "Hard matchup"
                                  : tier === "worst"
                                    ? "Toughest matchup"
                                    : "Average matchup";
                          const tierBadgeClass =
                            tier === "elite" || tier === "strong"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : tier === "bad" || tier === "worst"
                                ? "bg-red-500/15 text-red-600 dark:text-red-300"
                                : "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400";
                          const positionLabel = formatPosition(row.position);
                          const marketLabel = formatMarketLabel(row.market);
                          return (
                            <Tooltip
                              side="top"
                              content={
                                <div className="min-w-[220px] px-3 py-2.5">
                                  <div className="border-b border-neutral-200/70 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase dark:border-neutral-700/70 dark:text-neutral-400">
                                    Defense vs {positionLabel}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <div className="flex items-baseline gap-1.5 tabular-nums">
                                      <span
                                        className={cn(
                                          "text-base font-black",
                                          getMatchupRankColor(
                                            row.matchupRank,
                                            rowSport,
                                            defenseTotalTeamsForRow,
                                          ),
                                        )}
                                      >
                                        #{row.matchupRank}
                                      </span>
                                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                                        / {defenseTotalTeamsForRow}
                                      </span>
                                    </div>
                                    <span
                                      className={cn(
                                        "rounded-sm px-1.5 py-px text-[9px] font-black tracking-wider uppercase",
                                        tierBadgeClass,
                                      )}
                                    >
                                      {tierLabel}
                                    </span>
                                  </div>
                                  {row.matchupAvgAllowed !== null && (
                                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                                      <span className="text-neutral-500 dark:text-neutral-400">
                                        Allows to {positionLabel}
                                      </span>
                                      <span className="font-bold text-neutral-700 tabular-nums dark:text-neutral-200">
                                        {row.matchupAvgAllowed.toFixed(1)}{" "}
                                        {marketLabel}/g
                                      </span>
                                    </div>
                                  )}
                                  <div className="mt-2 border-t border-neutral-200/50 pt-1.5 text-[9px] font-bold tracking-wider text-neutral-400 uppercase dark:border-neutral-700/50 dark:text-neutral-500">
                                    1 toughest · {defenseTotalTeamsForRow}{" "}
                                    easiest
                                  </div>
                                </div>
                              }
                            >
                              <span className="cursor-help text-xs font-black tabular-nums">
                                #{row.matchupRank}
                              </span>
                            </Tooltip>
                          );
                        })()
                      )}
                    </td>

                    {/* Game context: pace — edge-to-edge tier fill matching Hit Rate cells */}
                    <td
                      className={cn(
                        "px-2 py-3 text-center align-middle transition-colors duration-200",
                        compactView && "py-1.5",
                        !isBlurred &&
                          getPaceCellClass(
                            row.paceContext?.opponentRecent.l5Rank ?? null,
                            rowSport,
                          ),
                      )}
                    >
                      <Tooltip
                        side="top"
                        content={
                          row.paceContext ? (
                            <div className="min-w-[240px] px-3 py-2.5">
                              <div className="border-b border-neutral-200/70 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase dark:border-neutral-700/70 dark:text-neutral-400">
                                Opponent Pace
                              </div>
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-between gap-3 text-[11px]">
                                  <span className="text-neutral-500 dark:text-neutral-400">
                                    Last 5
                                  </span>
                                  <span className="flex items-baseline gap-1.5 tabular-nums">
                                    <span
                                      className={cn(
                                        "font-black",
                                        getPaceRankTextColor(
                                          row.paceContext.opponentRecent
                                            .l5Rank ?? null,
                                          rowSport,
                                        ),
                                      )}
                                    >
                                      #
                                      {row.paceContext.opponentRecent.l5Rank ??
                                        "—"}
                                    </span>
                                    <span className="text-neutral-400 dark:text-neutral-500">
                                      ·
                                    </span>
                                    <span className="font-bold text-neutral-700 dark:text-neutral-200">
                                      {row.paceContext.opponentRecent.l5 != null
                                        ? row.paceContext.opponentRecent.l5.toFixed(
                                            1,
                                          )
                                        : "—"}
                                    </span>
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-[11px]">
                                  <span className="text-neutral-500 dark:text-neutral-400">
                                    Last 10
                                  </span>
                                  <span className="flex items-baseline gap-1.5 tabular-nums">
                                    <span
                                      className={cn(
                                        "font-black",
                                        getPaceRankTextColor(
                                          row.paceContext.opponentRecent
                                            .l10Rank ?? null,
                                          rowSport,
                                        ),
                                      )}
                                    >
                                      #
                                      {row.paceContext.opponentRecent.l10Rank ??
                                        "—"}
                                    </span>
                                    <span className="text-neutral-400 dark:text-neutral-500">
                                      ·
                                    </span>
                                    <span className="font-bold text-neutral-700 dark:text-neutral-200">
                                      {row.paceContext.opponentRecent.l10 !=
                                      null
                                        ? row.paceContext.opponentRecent.l10.toFixed(
                                            1,
                                          )
                                        : "—"}
                                    </span>
                                  </span>
                                </div>
                                {row.paceContext.opponentRecent.season !=
                                  null && (
                                  <div className="flex items-center justify-between gap-3 text-[11px]">
                                    <span className="text-neutral-500 dark:text-neutral-400">
                                      Season
                                    </span>
                                    <span className="flex items-baseline gap-1.5 tabular-nums">
                                      {row.paceContext.opponentRecent
                                        .seasonRank != null && (
                                        <>
                                          <span
                                            className={cn(
                                              "font-black",
                                              getPaceRankTextColor(
                                                row.paceContext.opponentRecent
                                                  .seasonRank,
                                                rowSport,
                                              ),
                                            )}
                                          >
                                            #
                                            {
                                              row.paceContext.opponentRecent
                                                .seasonRank
                                            }
                                          </span>
                                          <span className="text-neutral-400 dark:text-neutral-500">
                                            ·
                                          </span>
                                        </>
                                      )}
                                      <span className="font-bold text-neutral-700 dark:text-neutral-200">
                                        {row.paceContext.opponentRecent.season.toFixed(
                                          1,
                                        )}
                                      </span>
                                    </span>
                                  </div>
                                )}
                                {row.paceContext.matchupL5Pace != null && (
                                  <div className="mt-1 flex items-center justify-between gap-3 border-t border-neutral-200/50 pt-1.5 text-[11px] dark:border-neutral-700/50">
                                    <span className="text-neutral-500 dark:text-neutral-400">
                                      Projected matchup
                                    </span>
                                    <span className="font-bold text-neutral-700 tabular-nums dark:text-neutral-200">
                                      {row.paceContext.matchupL5Pace.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 text-[9px] font-medium text-neutral-400 dark:text-neutral-500">
                                Projection: average of team L5 + opponent L5
                                pace.
                              </div>
                            </div>
                          ) : (
                            "Pace context unavailable"
                          )
                        }
                      >
                        <span
                          className={cn(
                            "cursor-help text-xs font-black tabular-nums",
                            isBlurred && "opacity-50 blur-[2px]",
                          )}
                        >
                          {isBlurred
                            ? "—"
                            : row.paceContext?.opponentRecent.l5Rank
                              ? `#${row.paceContext.opponentRecent.l5Rank}`
                              : "—"}
                        </span>
                      </Tooltip>
                    </td>

                    {/* Odds — Over + Under for both views (compact + default) */}
                    <CompactOddsCells
                      row={row}
                      sport={rowSport}
                      isBlurred={isBlurred}
                      isLastColumn
                      onOpenLineMovement={handleOpenLineMovement}
                    />
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Line movement dialog (opened from compact odds dropdown footer) */}
        <LineHistoryDialog
          open={!!lineHistoryContext}
          onOpenChange={(open) => {
            if (!open) setLineHistoryContext(null);
          }}
          context={lineHistoryContext}
        />

        {/* Load More Button - Premium */}
        {hasMore && onLoadMore && (
          <div className="sticky bottom-0 flex items-center justify-center bg-gradient-to-t from-white via-white/95 to-transparent py-5 dark:from-neutral-900 dark:via-neutral-900/95">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200",
                "bg-white text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                "hover:bg-neutral-50 hover:shadow-lg dark:hover:bg-neutral-700",
                "border border-neutral-200/80 dark:border-neutral-700/80",
                "shadow-md ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
                isLoadingMore && "cursor-not-allowed opacity-70",
              )}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More
                  {totalCount !== undefined && (
                    <span className="text-neutral-400 dark:text-neutral-500">
                      ({rows.length} of {totalCount})
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        )}

        {/* Optional bottom content (for gated CTA) */}
        {bottomContent}
      </div>
    </div>
  );
}
