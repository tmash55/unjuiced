"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlayerLookup } from "@/hooks/use-player-lookup";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import { usePlayerBoxScores, BoxScoreGame } from "@/hooks/use-player-box-scores";
import { GameLogChart } from "@/components/hit-rates/game-log-chart";
import { BoxScoreTable } from "@/components/hit-rates/box-score-table";
import { PositionVsTeam } from "@/components/hit-rates/position-vs-team";
import { DefensiveAnalysis } from "@/components/hit-rates/defensive-analysis";
import { PlayTypeAnalysis } from "@/components/hit-rates/play-type-analysis";
import { ShootingZones } from "@/components/hit-rates/shooting-zones";
import { PlayerCorrelations } from "@/components/hit-rates/player-correlations";
import { HitRateSummaryStrip } from "@/components/hit-rates/drilldown-v2/hero/hit-rate-summary-strip";
import { Tile } from "@/components/hit-rates/drilldown-v2/shared/tile";
import {
  HitRateChart as HitRateChartV2,
  type ChartSplit,
  type ChartRange,
  type ChartHitRateSegment,
} from "@/components/hit-rates/drilldown-v2/hero/hit-rate-chart";
import { DrilldownHeader } from "@/components/hit-rates/drilldown-v2/header/drilldown-header";
import {
  MatchupPanel as MatchupPanelV2,
  ShootingPanel as ShootingPanelV2,
  PlayTypePanel as PlayTypePanelV2,
  OddsPanel as OddsPanelV2,
} from "@/components/hit-rates/drilldown-v2/tabs/drilldown-tabs";
import {
  MlbSprayChart,
  MLB_EV_THRESHOLD_OPTIONS,
  MLB_HIT_FILTER_OPTIONS,
  MLB_PITCHER_HAND_OPTIONS,
  MLB_PITCH_TYPE_LABELS,
  MLB_SEASON_OPTIONS,
  MLB_TRAJECTORY_OPTIONS,
  MLB_ZONE_DISPLAY_OPTIONS,
  filterMlbBattedBallEvents,
  getDefaultMlbSprayChartFilters,
  getMlbBattedBallEventKey,
  getMlbEvThresholdMph,
  getMlbSampleBatterHand,
  type MlbEvThreshold,
  type MlbHitFilter,
  type MlbPitcherHandFilter,
  type MlbSprayChartFilterState,
  type MlbSprayChartPlayerType,
  type MlbTrajectoryFilter,
  type MlbZoneDisplay,
} from "@/components/hit-rates/mlb/mlb-spray-chart";
import type { BattedBallEvent } from "@/app/api/mlb/spray-chart/route";
import { LoadingState } from "@/components/common/loading-state";
import { ExternalLink, X, AlertCircle, Pencil, Check, ChevronDown, RotateCcw, Users, Target, Zap, Lock, Sparkles, Thermometer, Wind, CloudRain, Home, BadgeDollarSign } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { getAllActiveSportsbooks, getSportsbookById } from "@/lib/data/sportsbooks";
import { formatGameTimeForUser } from "@/lib/mlb/game-time";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import Link from "next/link";
import { useStateLink } from "@/hooks/use-state-link";
import { useMlbPlayerGameLogs } from "@/hooks/use-mlb-player-game-logs";
import { useMlbSprayChart } from "@/hooks/use-mlb-spray-chart";
import { useMlbGames } from "@/hooks/use-mlb-games";
import { useMlbHotZone } from "@/hooks/use-mlb-hot-zone";
import { useMlbIndividualMatchup } from "@/hooks/use-mlb-individual-matchup";
import { useMlbBatterOdds, type BatterOddsEntry } from "@/hooks/use-mlb-batter-odds";
import { useHitRateOdds } from "@/hooks/use-hit-rate-odds";
import type { QuickViewGameContext } from "@/lib/hit-rates/quick-view";
import type { LineHistoryApiResponse, LineHistoryBookData, LineHistoryContext, LineHistoryPoint } from "@/lib/odds/line-history";
import { LineHistoryDialog } from "@/components/opportunities/line-history-dialog";
import { IconPlus, IconChartHistogram, IconCirclePlus } from "@tabler/icons-react";
import { useFavorites, type AddFavoriteParams, type BookSnapshot, type Favorite } from "@/hooks/use-favorites";
import { toast } from "sonner";

// Tab type for modal navigation
type ModalTab = "gamelog" | "splits" | "matchup" | "playstyle" | "correlation" | "odds";

export interface OddsData {
  over?: {
    price: number;
    line: number;
    book?: string;
    mobileLink?: string | null;
  };
  under?: {
    price: number;
    line: number;
    book?: string;
    mobileLink?: string | null;
  };
}

interface AlternateLineOdds {
  ln: number;
  over?: { price: number; book?: string; mobileLink?: string | null };
  under?: { price: number; book?: string; mobileLink?: string | null };
  books?: Record<string, {
    over?: { price: number; mobileLink?: string | null; url?: string | null; sgp?: string | null };
    under?: { price: number; mobileLink?: string | null; url?: string | null; sgp?: string | null };
  }>;
}

const getAlternateLineBookCount = (line: AlternateLineOdds) => {
  return Object.values(line.books ?? {}).reduce((count, sides) => {
    return count + Number(Boolean(sides.over)) + Number(Boolean(sides.under));
  }, 0);
};

export interface LiveBookOfferInput {
  side: "over" | "under";
  book: string;
  price: number;
  line?: number | null;
  url?: string | null;
  mobileUrl?: string | null;
  mobileLink?: string | null;
  decimal?: number | null;
  evPercent?: number | null;
  isSharpRef?: boolean | null;
  sgp?: string | null;
  oddId?: string | null;
  odd_id?: string | null;
}

interface MlbBookOffer {
  side: "over" | "under";
  book: string;
  price: number;
  line: number;
  url: string | null;
  mobileUrl: string | null;
  isBest: boolean;
  evPercent: number | null;
  isSharpRef: boolean;
  sgp: string | null;
  oddId: string | null;
}

interface PlayerQuickViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport?: "nba" | "wnba" | "mlb";
  odds_player_id?: string;
  player_name?: string;
  /** Direct NBA player ID - when provided, skips the lookup API call */
  nba_player_id?: number;
  /** Direct MLB player ID - when provided, skips player-name matching */
  mlb_player_id?: number;
  initial_market?: string;
  /** Pre-select this line when opening (e.g., from edge finder alternate lines) */
  initial_line?: number;
  onMarketChange?: (market: string) => void;
  /** Pass odds directly from the odds screen for real-time updates */
  odds?: OddsData;
  /** Event ID for fetching alternate lines */
  event_id?: string;
  /** Hide links into the full hit-rate experience while a sport/tool is still gated */
  showFullProfileLink?: boolean;
  /** Known game context from the caller, preferred over hit-rate profile matchup data */
  gameContext?: QuickViewGameContext;
  /** Optional full live book snapshot from tools like Edge Finder/+EV to avoid refetching odds we already have */
  liveBookOffers?: LiveBookOfferInput[];
}

// Color helpers matching drilldown
const getPctColor = (value: number | null) => {
  if (value === null) return "text-neutral-500";
  if (value >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
};

const getPctBgColor = (value: number | null) => {
  if (value === null) return "bg-neutral-50 dark:bg-neutral-800";
  if (value >= 70) return "bg-emerald-50 dark:bg-emerald-900/20";
  if (value >= 50) return "bg-amber-50 dark:bg-amber-900/20";
  return "bg-red-50 dark:bg-red-900/20";
};

// Get market stat from box score
const getMarketStat = (game: BoxScoreGame, market: string): number => {
  switch (market) {
    case "player_points": return game.pts;
    case "player_rebounds": return game.reb;
    case "player_assists": return game.ast;
    case "player_threes_made": return game.fg3m;
    case "player_steals": return game.stl;
    case "player_blocks": return game.blk;
    case "player_turnovers": return game.tov;
    case "player_points_rebounds_assists": return game.pra;
    case "player_points_rebounds": return game.pr;
    case "player_points_assists": return game.pa;
    case "player_rebounds_assists": return game.ra;
    case "player_blocks_steals": return game.bs;
    case "player_hits": return game.mlbHits ?? 0;
    case "player_home_runs": return game.mlbHomeRuns ?? 0;
    case "player_runs":
    case "player_runs_scored": return game.mlbRunsScored ?? 0;
    case "player_rbi": return game.mlbRbi ?? 0;
    case "player_rbis": return game.mlbRbi ?? 0;
    case "player_total_bases": return game.mlbTotalBases ?? 0;
    case "player_stolen_bases": return game.mlbStolenBases ?? 0;
    case "player_hits__runs__rbis": return (game.mlbHits ?? 0) + (game.mlbRunsScored ?? 0) + (game.mlbRbi ?? 0);
    case "player_strikeouts":
    case "pitcher_strikeouts": return game.mlbPitcherStrikeouts ?? 0;
    case "player_hits_allowed":
    case "pitcher_hits_allowed": return game.mlbHitsAllowed ?? 0;
    case "player_earned_runs":
    case "pitcher_earned_runs": return game.mlbEarnedRuns ?? 0;
    case "player_outs":
    case "pitcher_outs":
    case "pitcher_outs_recorded": return game.mlbPitcherOuts ?? Math.round((game.mlbInningsPitched ?? 0) * 3);
    case "player_walks_allowed":
    case "pitcher_walks":
    case "pitcher_walks_allowed": return game.mlbWalks ?? 0;
    default: return game.pts;
  }
};

const formatMlbHeaderRate = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(3).replace(/^0/, "");
};

const formatMlbHeaderDecimal = (value: number | null | undefined, digits = 1) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
};

const MLB_HIT_RESULTS = new Set(["single", "double", "triple", "home run", "home_run", "1b", "2b", "3b", "hr"]);

const normalizePitchUsagePct = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value <= 1 ? value * 100 : value;
};

const formatPitchUsagePct = (value: number | null | undefined) => {
  const normalized = normalizePitchUsagePct(value);
  if (normalized === null) return null;
  return `${Math.round(normalized)}%`;
};

const formatMlbBattedBallDate = (dateStr?: string | null, includeYear = false) => {
  if (!dateStr) return "-";
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
    timeZone: "America/New_York",
  }).format(parsed);
};

const formatMlbBattedBallResult = (result?: string | null) => {
  if (!result) return "-";
  const key = result.toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    single: "1B",
    double: "2B",
    triple: "3B",
    home_run: "HR",
    field_out: "Out",
    force_out: "FO",
    grounded_into_double_play: "GDP",
    double_play: "DP",
    fielders_choice: "FC",
    field_error: "E",
    sac_fly: "SF",
    sac_bunt: "SAC",
  };
  return map[key] ?? result.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatMlbBattedBallTrajectory = (trajectory?: string | null) => {
  const map: Record<string, string> = {
    ground_ball: "GB",
    line_drive: "LD",
    fly_ball: "FB",
    popup: "PU",
  };
  return trajectory ? map[trajectory] ?? trajectory : "-";
};

const getMlbBattedBallResultClass = (event: BattedBallEvent) => {
  const result = (event.event_type ?? event.result ?? "").toLowerCase().replace(/\s+/g, "_");
  if (result === "home_run" || result === "hr") return "text-amber-400";
  if (result === "triple" || result === "double") return "text-emerald-400";
  if (event.is_hit || MLB_HIT_RESULTS.has(result)) return "text-sky-400";
  return "text-slate-400";
};

const getMlbBattedBallEvClass = (ev?: number | null) => {
  if (ev == null || !Number.isFinite(ev)) return "text-slate-400";
  if (ev >= 105) return "text-emerald-300";
  if (ev >= 95) return "text-emerald-400";
  if (ev >= 88) return "text-amber-300";
  return "text-slate-400";
};

const getMlbBattedBallTrajectoryClass = (trajectory?: string | null) => {
  if (trajectory === "line_drive") return "text-emerald-400";
  if (trajectory === "fly_ball") return "text-sky-400";
  if (trajectory === "ground_ball") return "text-amber-400";
  return "text-slate-400";
};

const getMlbSeasonFromDate = (dateStr: string) => {
  const parsed = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
};

const formatQuickViewGameStatus = (status?: string | null, gameDatetime?: string | null) => {
  if (status && !/^scheduled$/i.test(status)) return status;
  return formatGameTimeForUser(gameDatetime, {
    fallback: status || "",
    includeTimeZoneName: true,
  });
};

// Fallback markets - ordered by popularity
const FALLBACK_MARKETS = [
  "player_points", 
  "player_rebounds", 
  "player_assists", 
  "player_threes_made",
  "player_points_rebounds_assists", 
  "player_points_rebounds", 
  "player_points_assists",
  "player_rebounds_assists", 
  "player_steals", 
  "player_blocks", 
  "player_blocks_steals", 
  "player_turnovers",
];

const MLB_FALLBACK_MARKETS = [
  "player_hits",
  "player_total_bases",
  "player_home_runs",
  "player_runs_scored",
  "player_rbi",
  "player_stolen_bases",
  "player_hits__runs__rbis",
  "pitcher_strikeouts",
  "pitcher_hits_allowed",
  "pitcher_earned_runs",
  "pitcher_outs",
];

const MLB_PITCHER_MARKETS = new Set([
  "player_strikeouts",
  "pitcher_strikeouts",
  "player_hits_allowed",
  "pitcher_hits_allowed",
  "player_earned_runs",
  "pitcher_earned_runs",
  "player_outs",
  "pitcher_outs",
  "pitcher_outs_recorded",
  "player_walks_allowed",
  "pitcher_walks",
  "pitcher_walks_allowed",
]);

const isMlbPitcherMarketKey = (market: string | null | undefined) => !!market && MLB_PITCHER_MARKETS.has(market);
const MLB_BATTER_FALLBACK_MARKETS = MLB_FALLBACK_MARKETS.filter((market) => !isMlbPitcherMarketKey(market));
const MLB_PITCHER_FALLBACK_MARKETS = MLB_FALLBACK_MARKETS.filter((market) => isMlbPitcherMarketKey(market));
const MLB_LINE_HISTORY_MARKET_ALIASES: Record<string, string> = {
  player_rbi: "player_rbis",
  player_runs_scored: "player_runs",
  pitcher_strikeouts: "player_strikeouts",
  pitcher_hits_allowed: "player_hits_allowed",
  pitcher_earned_runs: "player_earned_runs",
  pitcher_outs: "player_outs",
  pitcher_outs_recorded: "player_outs",
  pitcher_walks: "player_walks_allowed",
  pitcher_walks_allowed: "player_walks_allowed",
  batter_stolen_bases: "player_stolen_bases",
  player_steals: "player_stolen_bases",
  stolen_bases: "player_stolen_bases",
};

const getMlbLineHistoryMarket = (market: string) => MLB_LINE_HISTORY_MARKET_ALIASES[market] ?? market;

const parseMlbBookKey = (key: string) => {
  const idx = key.indexOf("__");
  return idx >= 0 ? key.slice(0, idx) : key;
};

const buildHalfPointLadder = (start: number, end: number) => {
  const lines: number[] = [];
  for (let line = start; line <= end + 0.001; line += 1) {
    lines.push(Math.round(line * 10) / 10);
  }
  return lines;
};

const normalizeMlbOddsLine = (line?: number | null) => {
  if (typeof line !== "number" || !Number.isFinite(line)) return null;
  const rounded = Math.round(line * 10) / 10;
  if (rounded > 0 && Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return Math.round((rounded - 0.5) * 10) / 10;
  }
  return rounded;
};

const toPositiveMlbGameId = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getMlbMarketLineLadder = (market: string, activeLine: number) => {
  const min = 0.5;
  const extendTo = (baseMax: number) => Math.max(baseMax, Math.ceil(activeLine) + 1.5);

  switch (market) {
    case "player_home_runs":
    case "player_stolen_bases":
      return buildHalfPointLadder(min, extendTo(2.5));
    case "player_hits":
    case "player_runs":
    case "player_runs_scored":
    case "player_rbi":
    case "player_rbis":
      return buildHalfPointLadder(min, extendTo(4.5));
    case "player_total_bases":
    case "player_hits__runs__rbis":
      return buildHalfPointLadder(min, extendTo(10.5));
    case "player_strikeouts":
    case "pitcher_strikeouts":
      return buildHalfPointLadder(2.5, extendTo(12.5));
    case "player_hits_allowed":
    case "pitcher_hits_allowed":
      return buildHalfPointLadder(2.5, extendTo(10.5));
    case "player_earned_runs":
    case "pitcher_earned_runs":
    case "player_walks_allowed":
    case "pitcher_walks":
    case "pitcher_walks_allowed":
      return buildHalfPointLadder(min, extendTo(6.5));
    case "player_outs":
    case "pitcher_outs":
    case "pitcher_outs_recorded":
      return buildHalfPointLadder(8.5, extendTo(21.5));
    default:
      return buildHalfPointLadder(min, extendTo(10.5));
  }
};

type GameCountFilter = 5 | 10 | 20 | 30 | "season" | "h2h";
type MlbHomeAwayFilter = "all" | "H" | "A";
type MlbDayNightFilter = "all" | "D" | "N";
type MlbBookSortKey = "book" | "over" | "under";
type SortDirection = "asc" | "desc";
type MlbLineHistorySide = "over" | "under";
const SHARP_LINE_HISTORY_BOOKS = ["pinnacle", "circa"];
// Default-selection priority for the line movement chart. Pinnacle/Circa are sharp;
// fall back to the most popular consumer books before alphabetical ordering kicks in.
const LINE_HISTORY_BOOK_PRIORITY = ["pinnacle", "circa", "draftkings", "fanduel", "fanatics"];

const formatAmericanOdds = (price?: number | null) => {
  if (price === null || price === undefined) return "-";
  return price > 0 ? `+${price}` : `${price}`;
};

const normalizeMlbPlayerOddsName = (name?: string | null) =>
  (name ?? "").toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

const findMlbPlayerOddsEntry = (
  odds: Record<string, BatterOddsEntry>,
  playerName?: string | null
): BatterOddsEntry | null => {
  const key = normalizeMlbPlayerOddsName(playerName);
  return key ? odds[key] ?? null : null;
};

const getAmericanImpliedProbability = (price?: number | null) => {
  if (price === null || price === undefined || price === 0) return null;
  return price > 0 ? 100 / (price + 100) : Math.abs(price) / (Math.abs(price) + 100);
};

const americanToDecimal = (price?: number | null) => {
  if (price === null || price === undefined || price === 0) return null;
  return price > 0 ? 1 + price / 100 : 1 + 100 / Math.abs(price);
};

const formatPctValue = (value: number | null | undefined, digits = 0) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}%`;
};

const getSharpLineHistoryRank = (book: { bookId?: string | null; bookName?: string | null }) => {
  const normalized = `${book.bookId ?? ""} ${book.bookName ?? ""}`.toLowerCase();
  const rank = SHARP_LINE_HISTORY_BOOKS.findIndex((sharpBook) => normalized.includes(sharpBook));
  return rank === -1 ? SHARP_LINE_HISTORY_BOOKS.length : rank;
};

const getLineHistoryBookPriorityRank = (book: { bookId?: string | null; bookName?: string | null }) => {
  const normalized = `${book.bookId ?? ""} ${book.bookName ?? ""}`.toLowerCase();
  const rank = LINE_HISTORY_BOOK_PRIORITY.findIndex((preferred) => normalized.includes(preferred));
  return rank === -1 ? LINE_HISTORY_BOOK_PRIORITY.length : rank;
};

const normalizeLineHistoryBookKey = (value?: string | null) => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const getLineHistorySportsbook = (book: { bookId?: string | null; bookName?: string | null }) => {
  const directMatch = book.bookId ? getSportsbookById(book.bookId) : undefined;
  if (directMatch) return directMatch;

  const bookId = normalizeLineHistoryBookKey(book.bookId);
  const bookName = normalizeLineHistoryBookKey(book.bookName);
  if (!bookId && !bookName) return undefined;

  return getAllActiveSportsbooks().find((sportsbook) => {
    const sportsbookId = normalizeLineHistoryBookKey(sportsbook.id);
    const sportsbookName = normalizeLineHistoryBookKey(sportsbook.name);
    return sportsbookId === bookId || sportsbookId === bookName || sportsbookName === bookId || sportsbookName === bookName;
  });
};

const isSameLineHistorySportsbook = (offerBookId: string, historyBook: { bookId?: string | null; bookName?: string | null }) => {
  const offerSportsbook = getLineHistorySportsbook({ bookId: offerBookId });
  const historySportsbook = getLineHistorySportsbook(historyBook);
  if (offerSportsbook && historySportsbook) return offerSportsbook.id === historySportsbook.id;

  const offerBook = normalizeLineHistoryBookKey(offerBookId);
  const historyBookId = normalizeLineHistoryBookKey(historyBook.bookId);
  const historyBookName = normalizeLineHistoryBookKey(historyBook.bookName);
  return offerBook === historyBookId || offerBook === historyBookName;
};

const syncLineHistoryWithLivePrice = (entries: LineHistoryPoint[], livePrice?: number | null): LineHistoryPoint[] => {
  if (!Number.isFinite(livePrice ?? NaN)) return entries;
  const price = livePrice as number;
  if (entries.length === 0) return [{ price, timestamp: Date.now() }];

  const lastEntry = entries[entries.length - 1];
  if (lastEntry.price === price) return entries;

  const lastMs = lastEntry.timestamp > 10_000_000_000 ? lastEntry.timestamp : lastEntry.timestamp * 1000;
  const timestamp = Math.max(Date.now(), lastMs + 1_000);
  return [...entries, { price, timestamp }];
};

const sortLineHistoryBookIds = (bookIds: string[]) => {
  return Array.from(new Set(bookIds.filter(Boolean))).sort((a, b) => {
    const aRank = getLineHistoryBookPriorityRank({ bookId: a });
    const bRank = getLineHistoryBookPriorityRank({ bookId: b });
    if (aRank !== bRank) return aRank - bRank;
    const aName = getLineHistorySportsbook({ bookId: a })?.name ?? a;
    const bName = getLineHistorySportsbook({ bookId: b })?.name ?? b;
    return aName.localeCompare(bName);
  });
};

const getOddsLink = (offer: { url?: string | null; mobileUrl?: string | null; mobileLink?: string | null } | null | undefined) => {
  if (!offer) return null;
  return offer.mobileUrl || offer.mobileLink || offer.url || null;
};

const formatLineHistoryTime = (timestamp?: number | null) => {
  if (!timestamp) return "";
  const ms = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const parsed = new Date(ms);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

const getLineHistoryTimestampMs = (timestamp?: number | null) => {
  if (!timestamp) return null;
  return timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
};

const formatMiniLineAxisTime = (timestamp?: number | null) => {
  const ms = getLineHistoryTimestampMs(timestamp);
  if (!ms) return "";
  const parsed = new Date(ms);
  if (Number.isNaN(parsed.getTime())) return "";

  const now = new Date();
  const sameDay = parsed.toDateString() === now.toDateString();
  if (!sameDay) {
    return new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
    }).format(parsed);
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed).replace(/\s/g, "").toLowerCase();
};

const isMlbClosedGameStatus = (status?: string | null) => {
  const normalized = (status ?? "").trim().toLowerCase();
  return Boolean(
    normalized.includes("final") ||
    normalized.includes("completed") ||
    normalized === "f" ||
    normalized === "game over"
  );
};

const isMlbMarketClosed = (game?: { gameDate?: string | null; gameDatetime?: string | null; gameStatus?: string | null } | null) => {
  if (!game) return false;
  if (isMlbClosedGameStatus(game.gameStatus)) return true;
  if (!game.gameDate) return false;

  const gameDate = new Date(`${game.gameDate}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  gameDate.setHours(0, 0, 0, 0);
  return Number.isFinite(gameDate.getTime()) && gameDate.getTime() < today.getTime();
};

const getMlbGameStartTimestampMs = (game?: { gameDatetime?: string | null; gameDate?: string | null } | null) => {
  if (!game?.gameDatetime) return null;
  const parsed = new Date(game.gameDatetime).getTime();
  if (Number.isFinite(parsed)) return parsed;

  const timeMatch = game.gameDatetime.match(/(\d{1,2}):(\d{2})\s*(am|pm)\s*ET/i);
  if (!game.gameDate || !timeMatch) return null;

  const [, hourValue, minuteValue, meridiem] = timeMatch;
  const hour12 = Number(hourValue);
  const minute = Number(minuteValue);
  if (!Number.isFinite(hour12) || !Number.isFinite(minute)) return null;
  const hour = (hour12 % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  const easternTimestamp = `${game.gameDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`;
  const fallbackParsed = new Date(easternTimestamp).getTime();
  return Number.isFinite(fallbackParsed) ? fallbackParsed : null;
};

const normalizeHexColor = (color?: string | null) => {
  if (!color) return null;
  const normalized = color.trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : null;
};

const getColorLuminance = (color?: string | null) => {
  const hex = normalizeHexColor(color);
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const getReadableTeamAccent = (primary?: string | null, secondary?: string | null) => {
  const primaryHex = normalizeHexColor(primary);
  const secondaryHex = normalizeHexColor(secondary);
  const primaryLuminance = getColorLuminance(primaryHex);
  if (primaryHex && (primaryLuminance === null || primaryLuminance >= 0.22 || !secondaryHex)) return primaryHex;
  return secondaryHex ?? primaryHex;
};

function MlbGlassPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card shadow-sm shadow-slate-200/20 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        className
      )}
    >
      {children}
    </section>
  );
}

function MlbMetricTile({
  label,
  value,
  sub,
  tone = "neutral",
  accentColor,
  align = "left",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "green" | "red" | "amber";
  accentColor?: string | null;
  align?: "left" | "center";
}) {
  const accent = normalizeHexColor(accentColor);
  return (
    <div
      className={cn(
        "min-w-0 border-r border-border px-2 py-2 last:border-r-0 sm:px-5 sm:py-3",
        align === "center" && "text-center",
        accent && "relative overflow-hidden"
      )}
      style={accent ? {
        background: `linear-gradient(135deg, ${accent}24 0%, ${accent}12 48%, transparent 100%)`,
        boxShadow: `inset 0 1px 0 ${accent}22`,
      } : undefined}
    >
      <p className={cn("truncate text-[9px] font-semibold text-muted-foreground sm:text-[11px] sm:font-medium", accent && "dark:text-slate-300")}>{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-black leading-none tabular-nums sm:text-2xl",
          !accent && tone === "green" && "text-emerald-600 dark:text-emerald-400",
          !accent && tone === "red" && "text-red-500 dark:text-red-400",
          !accent && tone === "amber" && "text-amber-600 dark:text-amber-300",
          !accent && tone === "neutral" && "text-foreground"
        )}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">{sub}</p>}
    </div>
  );
}

type MlbBattedBallBucket = {
  label: string;
  value: number;
  className: string;
  color?: string;
};

function MlbDistributionTooltip({
  children,
  content,
  className,
}: {
  children: React.ReactNode;
  content: string;
  className?: string;
}) {
  return (
    <Tooltip content={content} contentClassName="px-2.5 py-1.5 text-[11px] font-bold">
      <span
        tabIndex={0}
        className={cn(
          "inline-block max-w-full cursor-help truncate rounded-sm outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400/70",
          className
        )}
      >
        {children}
      </span>
    </Tooltip>
  );
}

const MLB_MODAL_ZONE_ORDER_RHB = ["oppo", "oppo_center", "center", "pull_center", "pull"] as const;
const MLB_MODAL_ZONE_ORDER_LHB = ["pull", "pull_center", "center", "oppo_center", "oppo"] as const;
const MLB_MODAL_ZONE_ORDER_FIELD = ["rf", "rcf", "cf", "lcf", "lf"] as const;
const MLB_MODAL_ZONE_LABELS: Record<string, string> = {
  pull: "Pull",
  pull_center: "Pull-C",
  center: "Center",
  oppo_center: "Oppo-C",
  oppo: "Oppo",
  lf: "LF",
  lcf: "LCF",
  cf: "CF",
  rcf: "RCF",
  rf: "RF",
};

function getMlbModalZoneBucketColor(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) return "rgba(71, 85, 105, 0.5)";
  const intensity = Math.min(1, Math.max(0, value / maxValue));
  return `rgba(20, 184, 166, ${0.36 + intensity * 0.52})`;
}

function isMlbLeftHandedBatter(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toUpperCase().startsWith("L");
}

const MLB_MODAL_HP_X = 125.42;
const MLB_MODAL_HP_Y = 199.27;
const MLB_MODAL_FAIR_START = Math.PI * 0.25;
const MLB_MODAL_FAIR_END = Math.PI * 0.75;
const MLB_MODAL_ZONE_STEP = (MLB_MODAL_FAIR_END - MLB_MODAL_FAIR_START) / 5;

function inferMlbModalZone(
  event: { zone?: string | null; coord_x?: number | null; coord_y?: number | null },
  battingHand?: string | null
) {
  if (event.coord_x == null || event.coord_y == null) return event.zone ?? null;

  const order = isMlbLeftHandedBatter(battingHand) ? MLB_MODAL_ZONE_ORDER_LHB : MLB_MODAL_ZONE_ORDER_RHB;
  const angle = Math.atan2(MLB_MODAL_HP_Y - event.coord_y, event.coord_x - MLB_MODAL_HP_X);
  if (!Number.isFinite(angle)) return null;

  const clamped = Math.max(MLB_MODAL_FAIR_START, Math.min(MLB_MODAL_FAIR_END - 0.0001, angle));
  const index = Math.floor((clamped - MLB_MODAL_FAIR_START) / MLB_MODAL_ZONE_STEP);
  return order[index] ?? null;
}

function inferMlbModalFixedFieldZone(
  event: { coord_x?: number | null; coord_y?: number | null }
) {
  if (event.coord_x == null || event.coord_y == null) return null;

  const angle = Math.atan2(MLB_MODAL_HP_Y - event.coord_y, event.coord_x - MLB_MODAL_HP_X);
  if (!Number.isFinite(angle)) return null;

  const clamped = Math.max(MLB_MODAL_FAIR_START, Math.min(MLB_MODAL_FAIR_END - 0.0001, angle));
  const index = Math.floor((clamped - MLB_MODAL_FAIR_START) / MLB_MODAL_ZONE_STEP);
  return MLB_MODAL_ZONE_ORDER_FIELD[index] ?? null;
}

function MlbDistributionBar({
  title,
  buckets,
  isLoading,
  emptyLabel,
  unit,
}: {
  title: string;
  buckets: MlbBattedBallBucket[];
  isLoading: boolean;
  emptyLabel: string;
  unit?: "degrees" | "mph";
}) {
  const hasData = buckets.some((bucket) => bucket.value > 0);
  const formatBucketLabel = (label: string) => unit === "degrees" ? `${label}°` : unit === "mph" ? `${label} mph` : label;
  const visibleBuckets = buckets.filter((bucket) => bucket.value > 0);
  const visibleTotal = visibleBuckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const getSegmentWidth = (value: number) => `${visibleTotal > 0 ? (value / visibleTotal) * 100 : 0}%`;
  const getTooltipContent = (bucket: MlbBattedBallBucket) => `${title}: ${formatBucketLabel(bucket.label)} - ${bucket.value}%`;

  return (
    <MlbGlassPanel className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-3 w-full animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
            <div className="grid grid-cols-4 gap-2">
              {buckets.map((bucket) => (
                <div key={bucket.label} className="h-8 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800/70" />
              ))}
            </div>
          </div>
        ) : hasData ? (
          <div className="space-y-3">
            <div className="flex">
              {visibleBuckets.map((bucket) => (
                <div key={bucket.label} className="min-w-0 text-center" style={{ width: getSegmentWidth(bucket.value) }}>
                  <MlbDistributionTooltip
                    content={getTooltipContent(bucket)}
                    className="text-sm font-black tabular-nums text-foreground"
                  >
                    {bucket.value}%
                  </MlbDistributionTooltip>
                </div>
              ))}
            </div>
            <div className="relative flex h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800 ring-1 ring-border">
              {visibleBuckets.map((bucket) => (
                <div
                  key={bucket.label}
                  className={cn("h-full min-w-0 border-r border-card last:border-r-0", bucket.className)}
                  style={{ width: getSegmentWidth(bucket.value), backgroundColor: bucket.color }}
                />
              ))}
            </div>
            <div className="flex">
              {visibleBuckets.map((bucket) => (
                <div
                  key={bucket.label}
                  className="relative min-w-0 pt-2 text-center before:absolute before:left-1/2 before:top-0 before:h-1.5 before:w-px before:-translate-x-1/2 before:bg-border"
                  style={{ width: getSegmentWidth(bucket.value) }}
                >
                  <MlbDistributionTooltip
                    content={getTooltipContent(bucket)}
                    className="text-[11px] font-medium text-muted-foreground"
                  >
                    {formatBucketLabel(bucket.label)}
                  </MlbDistributionTooltip>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs font-semibold text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </MlbGlassPanel>
  );
}

function MlbBattedBallsTable({
  events,
  selectedEventKey,
  onSelectEvent,
  isLoading,
  playerType = "batter",
  includeYearInDates = false,
}: {
  events: BattedBallEvent[];
  selectedEventKey: string | null;
  onSelectEvent: (eventKey: string | null, event: BattedBallEvent | null) => void;
  isLoading: boolean;
  playerType?: MlbSprayChartPlayerType;
  includeYearInDates?: boolean;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  type BattedBallSortKey = "date" | "inning" | "exit_velocity" | "launch_angle" | "hit_distance" | "trajectory" | "result" | "player" | "pitch_type" | "pitch_speed";
  type BattedBallSortDirection = "asc" | "desc";
  const [sortState, setSortState] = useState<{ key: BattedBallSortKey; direction: BattedBallSortDirection }>({
    key: "date",
    direction: "desc",
  });
  const compareNullableValues = useCallback((a: string | number | null | undefined, b: string | number | null | undefined, direction: BattedBallSortDirection) => {
    const aMissing = a === null || a === undefined || a === "";
    const bMissing = b === null || b === undefined || b === "";
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    const base = typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });

    return direction === "asc" ? base : -base;
  }, []);
  const getSortValue = useCallback((event: BattedBallEvent, key: BattedBallSortKey): string | number | null => {
    switch (key) {
      case "date":
        return event.game_date ? new Date(event.game_date).getTime() : null;
      case "inning":
        return event.inning ?? null;
      case "exit_velocity":
        return event.exit_velocity ?? null;
      case "launch_angle":
        return event.launch_angle ?? null;
      case "hit_distance":
        return event.hit_distance ?? null;
      case "trajectory":
        return formatMlbBattedBallTrajectory(event.trajectory);
      case "result":
        return formatMlbBattedBallResult(event.event_type ?? event.result);
      case "player":
        return playerType === "pitcher"
          ? event.batter_name ?? event.batter_hand ?? null
          : event.pitcher_name ?? event.pitcher_hand ?? null;
      case "pitch_type":
        return event.pitch_type ?? null;
      case "pitch_speed":
        return event.pitch_speed ?? null;
      default:
        return null;
    }
  }, [playerType]);
  const toggleSort = useCallback((key: BattedBallSortKey) => {
    setSortState((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }, []);
  const SortHeader = ({
    sortKey,
    label,
    align = "center",
  }: {
    sortKey: BattedBallSortKey;
    label: string;
    align?: "left" | "center";
  }) => {
    const active = sortState.key === sortKey;

    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className={cn(
          "group inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-black uppercase tracking-wide transition",
          align === "left" ? "justify-start" : "justify-center",
          active
            ? "bg-brand/10 text-brand"
            : "text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-foreground"
        )}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition",
            active ? "opacity-100" : "opacity-35 group-hover:opacity-70",
            active && sortState.direction === "asc" && "rotate-180"
          )}
        />
      </button>
    );
  };
  const tableEvents = useMemo(
    () => events
      .map((event, index) => ({ event, key: getMlbBattedBallEventKey(event, index) }))
      .sort((a, b) => {
        const primaryCompare = compareNullableValues(
          getSortValue(a.event, sortState.key),
          getSortValue(b.event, sortState.key),
          sortState.direction
        );
        if (primaryCompare !== 0) return primaryCompare;

        const dateCompare = compareNullableValues(
          getSortValue(a.event, "date"),
          getSortValue(b.event, "date"),
          "desc"
        );
        if (dateCompare !== 0) return dateCompare;

        return compareNullableValues(a.event.inning ?? null, b.event.inning ?? null, "desc");
      }),
    [compareNullableValues, events, getSortValue, sortState.direction, sortState.key]
  );

  useEffect(() => {
    if (!selectedEventKey || !scrollContainerRef.current) return;
    const row = scrollContainerRef.current.querySelector<HTMLTableRowElement>(`tr[data-event-key="${CSS.escape(selectedEventKey)}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedEventKey]);

  return (
    <MlbGlassPanel className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-black text-foreground">Batted Balls</h3>
          <p className="text-xs font-medium text-muted-foreground">
            {isLoading ? "Loading tracked contact" : `${tableEvents.length} balls in play match current filters`}
          </p>
        </div>
        {selectedEventKey && (
          <button
            type="button"
            onClick={() => onSelectEvent(null, null)}
            className="rounded-md border border-border bg-neutral-50 dark:bg-neutral-800/50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 px-4 py-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800/70" />
          ))}
        </div>
      ) : tableEvents.length === 0 ? (
        <div className="mx-4 my-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs font-semibold text-muted-foreground">
          No batted balls match these filters.
        </div>
      ) : (
        <div ref={scrollContainerRef} className="max-h-[360px] overflow-auto hidden-scrollbar">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="sticky top-0 z-[1] bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur">
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-black">#</th>
                <th className="px-3 py-1.5 text-left font-black"><SortHeader sortKey="date" label="Date" align="left" /></th>
                <th className="px-3 py-1.5 text-center font-black"><SortHeader sortKey="inning" label="Inn" /></th>
                <th className="px-3 py-1.5 text-center font-black"><SortHeader sortKey="exit_velocity" label="EV" /></th>
                <th className="px-3 py-1.5 text-center font-black"><SortHeader sortKey="launch_angle" label="LA" /></th>
                <th className="px-3 py-1.5 text-center font-black"><SortHeader sortKey="hit_distance" label="Dist" /></th>
                <th className="px-3 py-1.5 text-center font-black"><SortHeader sortKey="trajectory" label="Type" /></th>
                <th className="px-3 py-1.5 text-center font-black"><SortHeader sortKey="result" label="Result" /></th>
                <th className="px-3 py-1.5 text-left font-black">
                  <SortHeader sortKey="player" label={playerType === "pitcher" ? "Batter" : "Pitcher"} align="left" />
                </th>
                <th className="px-3 py-1.5 text-center font-black"><SortHeader sortKey="pitch_type" label="Pitch" /></th>
                <th className="px-3 py-1.5 text-center font-black"><SortHeader sortKey="pitch_speed" label="Velo" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {tableEvents.map(({ event, key }, index) => {
                const isSelected = selectedEventKey === key;
                const resultLabel = formatMlbBattedBallResult(event.event_type ?? event.result);
                return (
                  <tr
                    key={key}
                    data-event-key={key}
                    onClick={() => onSelectEvent(isSelected ? null : key, isSelected ? null : event)}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-brand/8",
                      isSelected
                        ? "bg-brand/12 ring-1 ring-inset ring-brand/40"
                        : event.is_barrel
                        ? "bg-emerald-500/8"
                        : index % 2 === 0
                        ? "bg-card"
                        : "bg-neutral-50 dark:bg-neutral-800/40"
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-foreground/80">
                      {formatMlbBattedBallDate(event.game_date, includeYearInDates)}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-muted-foreground">{event.inning ?? "-"}</td>
                    <td className={cn("px-3 py-2 text-center font-mono font-black tabular-nums", getMlbBattedBallEvClass(event.exit_velocity))}>
                      {event.exit_velocity != null ? Number(event.exit_velocity).toFixed(1) : "-"}
                      {event.is_barrel && <span className="ml-1 text-[9px] text-emerald-500 dark:text-emerald-300">BRL</span>}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-semibold tabular-nums text-foreground/80">
                      {event.launch_angle != null ? `${Math.round(Number(event.launch_angle))}°` : "-"}
                    </td>
                    <td className="px-3 py-2 text-center font-mono tabular-nums text-muted-foreground">
                      {event.hit_distance != null ? `${Math.round(Number(event.hit_distance))}ft` : "-"}
                    </td>
                    <td className={cn("px-3 py-2 text-center font-black", getMlbBattedBallTrajectoryClass(event.trajectory))}>
                      {formatMlbBattedBallTrajectory(event.trajectory)}
                    </td>
                    <td className={cn("px-3 py-2 text-center font-black", getMlbBattedBallResultClass(event))}>
                      {resultLabel}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 font-medium text-foreground/80">
                      {playerType === "pitcher" ? (
                        event.batter_name ? (
                          <>
                            {event.batter_name}
                            {event.batter_hand && <span className="ml-1 text-muted-foreground">({event.batter_hand})</span>}
                          </>
                        ) : event.batter_hand ? (
                          <span className="text-muted-foreground">{event.batter_hand}HB</span>
                        ) : "-"
                      ) : event.pitcher_name ? (
                        <>
                          {event.pitcher_name}
                          {event.pitcher_hand && <span className="ml-1 text-muted-foreground">({event.pitcher_hand})</span>}
                        </>
                      ) : event.pitcher_hand ? (
                        <span className="text-muted-foreground">{event.pitcher_hand}HP</span>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {event.pitch_type ? (
                        <Tooltip content={MLB_PITCH_TYPE_LABELS[event.pitch_type] ?? event.pitch_type} side="top">
                          <span className="inline-flex rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] font-black text-foreground/80">
                            {event.pitch_type}
                          </span>
                        </Tooltip>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2 text-center font-mono tabular-nums text-muted-foreground">
                      {event.pitch_speed != null ? Number(event.pitch_speed).toFixed(1) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </MlbGlassPanel>
  );
}

function MlbBattedBallFilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  accent = false,
  menuHeader,
  menuMinWidth,
  triggerLabel,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; detail?: string | null; prefix?: string | null; usagePct?: number | null }>;
  onChange: (value: T) => void;
  accent?: boolean;
  menuHeader?: React.ReactNode;
  menuMinWidth?: string;
  triggerLabel?: (option: { value: T; label: string; prefix?: string | null }) => React.ReactNode;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  const hasUsage = options.some((option) => typeof option.usagePct === "number" && option.usagePct > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex min-h-[48px] w-full min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left shadow-sm transition active:scale-[0.99]",
            "border-border bg-neutral-50 dark:bg-neutral-800/40 hover:border-brand/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/60",
            accent && "border-brand/50 bg-brand/8 hover:bg-brand/12 dark:bg-brand/12"
          )}
        >
          <span className="min-w-0">
            <span className="block font-mono text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
            <span className="mt-0.5 block truncate text-sm font-black text-foreground">
              {triggerLabel ? triggerLabel(selected) : selected?.label ?? value}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className={cn(
          "max-h-[320px] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl scrollbar-hide",
          menuMinWidth ?? "min-w-[200px]"
        )}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        {menuHeader && (
          <div className="sticky top-0 z-10 mb-1 rounded-md border border-border bg-card/95 px-2.5 py-2 shadow-sm backdrop-blur">
            {menuHeader}
          </div>
        )}
        {options.map((option) => {
          const isSelected = option.value === value;
          const usage = typeof option.usagePct === "number" ? Math.max(0, Math.min(100, option.usagePct)) : null;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold",
                isSelected && "bg-brand/10 text-brand"
              )}
            >
              {option.prefix ? (
                <span className={cn(
                  "inline-flex h-5 min-w-[28px] items-center justify-center rounded font-mono text-[10px] font-black tracking-tight",
                  isSelected ? "bg-brand/15 text-brand" : "bg-neutral-200/70 text-foreground/70 dark:bg-neutral-700/60 dark:text-neutral-300"
                )}>
                  {option.prefix}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                {hasUsage && usage !== null ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1 w-10 overflow-hidden rounded-full bg-neutral-200/70 dark:bg-neutral-700/60">
                      <span
                        className={cn("block h-full rounded-full", isSelected ? "bg-brand" : "bg-foreground/40")}
                        style={{ width: `${usage}%` }}
                      />
                    </span>
                    <span className={cn("min-w-[28px] text-right font-mono text-[10px] font-black tabular-nums", isSelected ? "text-brand" : "text-muted-foreground")}>
                      {usage}%
                    </span>
                  </span>
                ) : option.detail ? (
                  <span className="font-mono text-[10px] font-black tabular-nums text-muted-foreground">
                    {option.detail}
                  </span>
                ) : null}
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MlbBattedBallFiltersPanel({
  filters,
  onChange,
  onReset,
  pitchTypeOptions,
  opposingPitcherName,
  playerType = "batter",
  pitchMixContextName,
  pitchMixIsFullArsenal = false,
}: {
  filters: MlbSprayChartFilterState;
  onChange: (filters: MlbSprayChartFilterState) => void;
  onReset: () => void;
  pitchTypeOptions: Array<{ value: string; label: string; detail?: string | null; prefix?: string | null; usagePct?: number | null }>;
  opposingPitcherName?: string | null;
  playerType?: MlbSprayChartPlayerType;
  pitchMixContextName?: string | null;
  pitchMixIsFullArsenal?: boolean;
}) {
  const headerLabel = pitchMixIsFullArsenal ? "Pitch Mix" : "BIP Pitch Mix";
  const subjectName = pitchMixContextName || opposingPitcherName;
  const headerSubtitle = subjectName
    ? pitchMixIsFullArsenal
      ? `${subjectName}'s season repertoire`
      : `${subjectName}'s pitches in play`
    : pitchMixIsFullArsenal
      ? "Season repertoire"
      : "Pitches in current sample";
  const updateFilters = (patch: Partial<MlbSprayChartFilterState>) => {
    onChange({ ...filters, ...patch });
  };
  const handOptions = playerType === "pitcher"
    ? [
        { value: "all" as MlbPitcherHandFilter, label: "Both" },
        { value: "L" as MlbPitcherHandFilter, label: "vs LHB" },
        { value: "R" as MlbPitcherHandFilter, label: "vs RHB" },
      ]
    : MLB_PITCHER_HAND_OPTIONS;

  return (
    <MlbGlassPanel className="overflow-visible">
      <div className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <MlbBattedBallFilterSelect
            label="Season"
            value={filters.seasonFilter}
            options={MLB_SEASON_OPTIONS}
            onChange={(value) => updateFilters({ seasonFilter: value })}
          />
          <MlbBattedBallFilterSelect<MlbTrajectoryFilter>
            label="Trajectory"
            value={filters.trajectoryFilter}
            options={MLB_TRAJECTORY_OPTIONS}
            onChange={(value) => updateFilters({ trajectoryFilter: value })}
          />
          <MlbBattedBallFilterSelect<string>
            label="Pitch Type"
            value={filters.pitchTypeFilter ?? "all"}
            options={pitchTypeOptions}
            onChange={(value) => updateFilters({ pitchTypeFilter: value })}
            accent={(filters.pitchTypeFilter ?? "all") !== "all"}
            menuMinWidth="min-w-[260px]"
            triggerLabel={(option) => option.prefix ? `${option.prefix} · ${option.label}` : option.label}
            menuHeader={
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {headerLabel}
                </p>
                <p className="mt-0.5 text-xs font-black leading-tight text-foreground">
                  {headerSubtitle}
                </p>
              </div>
            }
          />
          <MlbBattedBallFilterSelect<MlbPitcherHandFilter>
            label={playerType === "pitcher" ? "Batter Hand" : "Pitcher Hand"}
            value={filters.pitcherHandFilter ?? "all"}
            options={handOptions}
            onChange={(value) => updateFilters({ pitcherHandFilter: value })}
            accent={(filters.pitcherHandFilter ?? "all") !== "all"}
          />
          <MlbBattedBallFilterSelect<MlbHitFilter>
            label="BIP Type"
            value={filters.hitFilter}
            options={MLB_HIT_FILTER_OPTIONS}
            onChange={(value) => updateFilters({ hitFilter: value })}
          />
          <MlbBattedBallFilterSelect<MlbEvThreshold>
            label="Metric View"
            value={filters.evThreshold}
            options={MLB_EV_THRESHOLD_OPTIONS}
            onChange={(value) => updateFilters({ evThreshold: value })}
            accent={filters.evThreshold !== "off"}
          />
        </div>

        <Tooltip content="Reset filters" side="top">
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset batted ball filters"
            className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-neutral-50 dark:bg-neutral-800/40 text-foreground/70 shadow-sm transition hover:border-brand/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-foreground active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </MlbGlassPanel>
  );
}

function MlbOddsBlock({
  label,
  odds,
  tone,
  onClick,
}: {
  label: "Over" | "Under";
  odds?: { price: number; line: number; book?: string; mobileLink?: string | null };
  tone: "over" | "under";
  onClick?: () => void;
}) {
  const isOver = tone === "over";
  const sb = odds?.book ? getSportsbookById(odds.book) : null;
  return (
    <button
      type="button"
      disabled={!getOddsLink(odds)}
      onClick={onClick}
      className={cn(
        "flex h-12 min-w-[112px] flex-col justify-center rounded-lg border px-3 text-left shadow-sm transition active:scale-[0.98] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        isOver
          ? "border-emerald-500/45 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          : "border-red-500/45 bg-red-50/90 text-red-700 hover:bg-red-100/80 dark:border-red-500/60 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/20",
        !getOddsLink(odds) && "cursor-default"
      )}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-black">
        <span>{label}</span>
        {sb?.image?.light && <img src={sb.image.light} alt={sb.name} className="h-4 w-4 rounded object-contain" />}
      </div>
      <div className="mt-0.5 text-lg font-black tabular-nums text-neutral-950 dark:text-white">{formatAmericanOdds(odds?.price)}</div>
    </button>
  );
}

function MlbWeatherChip({ weather }: { weather: import("@/hooks/use-mlb-games").MlbGameWeather }) {
  const tempF = Number.isFinite(weather.temperature_f as number) ? Math.round(weather.temperature_f as number) : null;
  const windMph = Number.isFinite(weather.wind_speed_mph as number) ? Math.round(weather.wind_speed_mph as number) : null;
  const precipPct = Number.isFinite(weather.precip_probability as number) ? Math.round(weather.precip_probability as number) : null;
  const isClosedRoof = weather.roof_type ? weather.roof_type.toLowerCase() === "closed" || weather.roof_type.toLowerCase() === "dome" : false;

  const parts: React.ReactNode[] = [];
  if (tempF !== null) {
    parts.push(
      <span key="temp" className="inline-flex items-center gap-1">
        <Thermometer className="h-3 w-3 text-amber-500/80" />
        <span className="font-mono tabular-nums">{tempF}°F</span>
      </span>
    );
  }
  if (windMph !== null && windMph > 0) {
    parts.push(
      <span key="wind" className="inline-flex items-center gap-1">
        <Wind className="h-3 w-3 text-sky-500/80" />
        <span className="font-mono tabular-nums">{windMph}mph</span>
        {weather.wind_label && <span className="text-foreground/60">{weather.wind_label}</span>}
      </span>
    );
  }
  if (precipPct !== null && precipPct >= 20) {
    parts.push(
      <span key="precip" className="inline-flex items-center gap-1 text-blue-500 dark:text-blue-400">
        <CloudRain className="h-3 w-3" />
        <span className="font-mono tabular-nums">{precipPct}%</span>
      </span>
    );
  }
  if (isClosedRoof) {
    parts.push(
      <span key="roof" className="inline-flex items-center gap-1 text-foreground/60">
        <Home className="h-3 w-3" />
        Roof
      </span>
    );
  }

  if (parts.length === 0) return null;

  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-border bg-neutral-50 px-2.5 py-1 text-xs text-foreground/80 dark:bg-neutral-800/40">
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="text-border">•</span>}
          {part}
        </React.Fragment>
      ))}
    </div>
  );
}

type SeasonStatTier = "elite" | "good" | "neutral" | "weak";

function getSeasonStatTier(label: string, raw: string): SeasonStatTier {
  // Parse the numeric value out of the formatted string
  const num = Number(raw.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(num)) return "neutral";
  switch (label.toUpperCase()) {
    case "AVG":
      if (num >= 0.300) return "elite";
      if (num >= 0.270) return "good";
      if (num >= 0.230) return "neutral";
      return "weak";
    case "OPS":
      if (num >= 0.900) return "elite";
      if (num >= 0.800) return "good";
      if (num >= 0.700) return "neutral";
      return "weak";
    case "OBP":
      if (num >= 0.380) return "elite";
      if (num >= 0.340) return "good";
      if (num >= 0.310) return "neutral";
      return "weak";
    case "ERA":
      if (num <= 3.00) return "elite";
      if (num <= 4.00) return "good";
      if (num <= 4.75) return "neutral";
      return "weak";
    case "WHIP":
      if (num <= 1.10) return "elite";
      if (num <= 1.25) return "good";
      if (num <= 1.40) return "neutral";
      return "weak";
    case "K/G":
      if (num >= 9) return "elite";
      if (num >= 7) return "good";
      return "neutral";
    case "IP/G":
      if (num >= 6.0) return "elite";
      if (num >= 5.0) return "good";
      return "neutral";
    default:
      return "neutral";
  }
}

const SEASON_TIER_VALUE_CLASS: Record<SeasonStatTier, string> = {
  elite: "text-emerald-500 dark:text-emerald-400",
  good: "text-emerald-600/85 dark:text-emerald-300/90",
  neutral: "text-foreground",
  weak: "text-amber-500 dark:text-amber-400",
};

const SEASON_TIER_DOT_CLASS: Record<SeasonStatTier, string> = {
  elite: "bg-emerald-500 ring-emerald-500/25",
  good: "bg-emerald-400/80 ring-emerald-400/20",
  neutral: "bg-foreground/30 ring-foreground/10",
  weak: "bg-amber-500 ring-amber-500/25",
};

function MlbSeasonStatsStrip({
  summary,
  teamAccent,
}: {
  summary: { label: string; stats: Array<{ label: string; value: string; sub?: string; highlight?: boolean }> };
  teamAccent?: string | null;
}) {
  const accent = normalizeHexColor(teamAccent);
  const topEdgeStyle = accent
    ? { background: `linear-gradient(90deg, transparent, ${accent}99, transparent)` }
    : undefined;
  const bandStyle = accent
    ? { background: `linear-gradient(90deg, ${accent}14, transparent 45%, ${accent}10)` }
    : undefined;
  const dotStyle = accent ? { backgroundColor: accent } : undefined;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div
        className={cn("absolute inset-x-0 top-0 h-px", !accent && "bg-gradient-to-r from-transparent via-brand/60 to-transparent")}
        style={topEdgeStyle}
      />
      <div
        className={cn(
          "flex items-center justify-center gap-1.5 border-b border-border px-3 py-1 sm:py-1.5",
          !accent && "bg-gradient-to-r from-brand/[0.06] via-transparent to-brand/[0.06]"
        )}
        style={bandStyle}
      >
        <span className={cn("h-1 w-1 rounded-full", !accent && "bg-brand")} style={dotStyle} />
        <span className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-foreground/80 sm:text-[10px]">{summary.label}</span>
        <span className={cn("h-1 w-1 rounded-full", !accent && "bg-brand/70")} style={dotStyle} />
      </div>
      <div className="grid grid-cols-4 divide-x divide-border">
        {summary.stats.map((stat) => {
          const tier = getSeasonStatTier(stat.label, stat.value);
          return (
            <div key={stat.label} className="group relative min-w-0 px-1.5 py-1.5 text-center sm:px-2 sm:py-2">
              <p className="flex items-center justify-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                <span className={cn("inline-block h-1 w-1 rounded-full ring-2", SEASON_TIER_DOT_CLASS[tier])} />
                {stat.label}
              </p>
              <p className={cn("mt-0.5 text-sm font-black leading-none tabular-nums sm:mt-1 sm:text-base", SEASON_TIER_VALUE_CLASS[tier])}>
                {stat.value}
              </p>
              {stat.sub && <p className="mt-0.5 hidden truncate text-[8px] font-medium uppercase tracking-wide text-muted-foreground sm:mt-1 sm:block">{stat.sub}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MlbCompactSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ label: string; value: T; disabled?: boolean }>;
  onChange: (value: T) => void;
}) {
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-md border border-border bg-neutral-50 px-2.5 text-left transition hover:border-brand/50 active:scale-[0.99] dark:bg-neutral-800/40"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
            <span className="truncate text-xs font-bold text-foreground">{selected?.label ?? value}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px] rounded-lg border border-border bg-card p-1 shadow-xl">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              disabled={option.disabled}
              onSelect={() => !option.disabled && onChange(option.value)}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-2 text-sm font-semibold",
                isSelected && "bg-brand/10 text-brand",
                option.disabled && "cursor-not-allowed opacity-40"
              )}
            >
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MlbFilterButton({
  active,
  disabled,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-bold transition active:scale-[0.98]",
        active
          ? "bg-brand/15 text-brand shadow-sm ring-1 ring-brand/25"
          : "text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function MiniLineMovementChart({
  points,
  isMarketClosed = false,
  liveStartTimestamp,
}: {
  points: Array<{ price: number; timestamp: number }>;
  isMarketClosed?: boolean;
  liveStartTimestamp?: number | null;
}) {
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const formatRelativeLineTime = (timestamp: number, endTimestamp: number) => {
    const endMs = getLineHistoryTimestampMs(endTimestamp);
    const currentMs = getLineHistoryTimestampMs(timestamp);
    if (!endMs || !currentMs) return "";
    const deltaMs = Math.max(0, endMs - currentMs);
    const minutes = Math.round(deltaMs / 60_000);
    if (minutes <= 2) return "";
    if (minutes < 60) return `-${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `-${hours}h`;
    return `-${Math.round(hours / 24)}d`;
  };

  const chart = useMemo(() => {
    const clean = points
      .filter((point) => Number.isFinite(point.price) && Number.isFinite(point.timestamp))
      .slice(-18);
    if (clean.length < 2) return null;

    const width = 340;
    const height = 150;
    const pad = { left: 46, right: 12, top: 18, bottom: 34 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const prices = clean.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = Math.max(1, max - min);
    const yForPrice = (price: number) => pad.top + plotHeight - ((price - min) / range) * plotHeight;
    const positions = clean.map((point, index) => {
      const x = pad.left + (clean.length === 1 ? 0 : (index / (clean.length - 1)) * plotWidth);
      const y = yForPrice(point.price);
      return { ...point, x, y };
    });
    const path = positions
      .map((point, index) => {
        return `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      })
      .join(" ");
    const areaPath = `${path} L ${(pad.left + plotWidth).toFixed(1)} ${(pad.top + plotHeight).toFixed(1)} L ${pad.left.toFixed(1)} ${(pad.top + plotHeight).toFixed(1)} Z`;
    const ticks = Array.from(new Set([max, Math.round((min + max) / 2), min]));
    const xTickIndexes = Array.from(new Set([
      0,
      Math.round((clean.length - 1) * 0.35),
      Math.round((clean.length - 1) * 0.7),
      clean.length - 1,
    ]));
    const liveStartMs = getLineHistoryTimestampMs(liveStartTimestamp);
    let liveBoundary: { x: number; startedAt: number; entireWindow: boolean } | null = null;
    if (liveStartMs) {
      const firstLiveIndex = positions.findIndex((point) => {
        const pointMs = getLineHistoryTimestampMs(point.timestamp);
        return Boolean(pointMs && pointMs >= liveStartMs);
      });

      if (firstLiveIndex >= 0) {
        if (firstLiveIndex === 0) {
          liveBoundary = { x: pad.left, startedAt: liveStartMs, entireWindow: true };
        } else {
          const previousPoint = positions[firstLiveIndex - 1];
          const firstLivePoint = positions[firstLiveIndex];
          liveBoundary = {
            x: (previousPoint.x + firstLivePoint.x) / 2,
            startedAt: liveStartMs,
            entireWindow: false,
          };
        }
      }
    }

    return {
      areaPath,
      positions,
      path,
      width,
      height,
      pad,
      plotWidth,
      plotHeight,
      open: clean[0],
      current: clean[clean.length - 1],
      low: min,
      high: max,
      ticks,
      xTicks: xTickIndexes.map((index) => positions[index]).filter(Boolean),
      yForPrice,
      liveBoundary,
    };
  }, [liveStartTimestamp, points]);

  if (!chart) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-lg border border-dashed border-border bg-neutral-50 dark:bg-neutral-800/40 text-xs text-muted-foreground dark:bg-neutral-800/30">
        Not enough movement yet
      </div>
    );
  }

  const change = chart.current.price - chart.open.price;
  const strokeClass = change >= 0 ? "stroke-emerald-500" : "stroke-red-500";
  const fillClass = change >= 0 ? "fill-emerald-500" : "fill-red-500";
  const areaFill = change >= 0 ? "fill-emerald-500/15" : "fill-red-500/15";
  const changeLabel = `${change >= 0 ? "+" : ""}${change} over window`;
  const changeShortLabel = `${change >= 0 ? "+" : ""}${change}`;
  const currentY = chart.yForPrice(chart.current.price);
  const hoveredPoint = hoveredPointIndex !== null ? chart.positions[hoveredPointIndex] : null;
  const currentMs = getLineHistoryTimestampMs(chart.current.timestamp);
  const isStale = Boolean(currentMs && Date.now() - currentMs > 15 * 60_000);
  const endAxisLabel = isMarketClosed
    ? "Close"
    : isStale
      ? formatMiniLineAxisTime(chart.current.timestamp)
      : "Now";
  const currentLabel = isMarketClosed ? "Close" : isStale ? "Last" : "Current";
  const summaryItems = [
    { label: "Open", value: formatAmericanOdds(chart.open.price), className: "text-foreground" },
    { label: currentLabel, value: formatAmericanOdds(chart.current.price), className: "text-foreground" },
    { label: "Move", value: changeShortLabel, className: change >= 0 ? "text-emerald-500" : "text-red-500" },
  ];
  const tooltipWidth = 104;
  const tooltipHeight = 44;
  const tooltipX = hoveredPoint
    ? Math.min(Math.max(hoveredPoint.x - tooltipWidth / 2, chart.pad.left), chart.width - chart.pad.right - tooltipWidth)
    : 0;
  const tooltipY = hoveredPoint
    ? Math.max(4, hoveredPoint.y - tooltipHeight - 12)
    : 0;
  const handleChartPointerMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * chart.width;
    const nearestIndex = chart.positions.reduce((nearest, point, index) => {
      const currentDistance = Math.abs(point.x - x);
      const nearestDistance = Math.abs(chart.positions[nearest].x - x);
      return currentDistance < nearestDistance ? index : nearest;
    }, 0);
    setHoveredPointIndex(nearestIndex);
  };

  return (
    <div className="rounded-lg border border-border bg-neutral-50 dark:bg-neutral-800/40 p-3 dark:bg-neutral-800/30 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-[150px] w-full cursor-crosshair overflow-visible"
        onMouseMove={handleChartPointerMove}
        onMouseLeave={() => setHoveredPointIndex(null)}
      >
        {chart.ticks.map((tick) => {
          const y = chart.yForPrice(tick);
          return (
            <g key={tick}>
              <line
                x1={chart.pad.left}
                x2={chart.width - chart.pad.right}
                y1={y}
                y2={y}
                className="stroke-neutral-200/70 dark:stroke-neutral-700/40"
              />
              <text x={chart.pad.left - 8} y={y + 3} textAnchor="end" className="fill-neutral-400 font-mono text-[10px] font-semibold dark:fill-slate-500">
                {formatAmericanOdds(tick)}
              </text>
            </g>
          );
        })}
        {chart.liveBoundary && (
          <g className="pointer-events-none">
            <rect
              x={chart.liveBoundary.x}
              y={chart.pad.top}
              width={chart.width - chart.pad.right - chart.liveBoundary.x}
              height={chart.plotHeight}
              className="fill-sky-500/5 dark:fill-sky-400/10"
            />
            {!chart.liveBoundary.entireWindow && (
              <line
                x1={chart.liveBoundary.x}
                x2={chart.liveBoundary.x}
                y1={chart.pad.top - 3}
                y2={chart.pad.top + chart.plotHeight + 3}
                className="stroke-sky-400/70 dark:stroke-sky-300/70"
                strokeDasharray="4 4"
              />
            )}
            <text
              x={Math.min(chart.liveBoundary.x + 6, chart.width - chart.pad.right - 50)}
              y={chart.pad.top + 10}
              className="fill-sky-500 font-mono text-[8px] font-black uppercase tracking-[0.08em] dark:fill-sky-300"
            >
              Live
            </text>
          </g>
        )}
        <path d={chart.areaPath} className={areaFill} />
        <path d={chart.path} fill="none" className={strokeClass} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {chart.positions.map((point, index) => (
          <g
            key={`${point.timestamp}-${index}`}
            tabIndex={0}
            role="img"
            aria-label={`${formatAmericanOdds(point.price)} at ${formatLineHistoryTime(point.timestamp)}`}
            className="outline-none"
            onFocus={() => setHoveredPointIndex(index)}
            onBlur={() => setHoveredPointIndex(null)}
          >
            <circle
              cx={point.x}
              cy={point.y}
              r={hoveredPointIndex === index ? "5.4" : index === chart.positions.length - 1 ? "4.5" : "3.2"}
              className={cn(fillClass, "stroke-white/80 stroke-[1.5] transition-[r] dark:stroke-[#111820]")}
            />
            <circle cx={point.x} cy={point.y} r="10" className="fill-transparent" />
          </g>
        ))}
        <circle cx={chart.width - chart.pad.right} cy={currentY} r="7" className={cn(fillClass, "opacity-15")} />
        {hoveredPoint && (
          <g className="pointer-events-none">
            <line
              x1={hoveredPoint.x}
              x2={hoveredPoint.x}
              y1={chart.pad.top}
              y2={chart.pad.top + chart.plotHeight}
              className="stroke-neutral-300 dark:stroke-slate-600"
              strokeDasharray="3 4"
            />
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx="8"
              className="fill-white stroke-neutral-200 shadow-sm dark:fill-[#0b1118] dark:stroke-neutral-700"
            />
            <text
              x={tooltipX + 10}
              y={tooltipY + 18}
              className="fill-neutral-950 font-mono text-[13px] font-black tabular-nums dark:fill-white"
            >
              {formatAmericanOdds(hoveredPoint.price)}
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 34}
              className="fill-neutral-500 font-mono text-[9px] font-bold uppercase tracking-[0.06em] dark:fill-slate-400"
            >
              {formatLineHistoryTime(hoveredPoint.timestamp)}
            </text>
          </g>
        )}
        {chart.xTicks.map((point, index) => (
          <text
            key={`${point.timestamp}-${index}`}
            x={point.x}
            y={chart.height - 12}
            textAnchor={index === 0 ? "start" : index === chart.xTicks.length - 1 ? "end" : "middle"}
            className="fill-neutral-400 font-mono text-[10px] font-semibold dark:fill-slate-500"
          >
            {index === chart.xTicks.length - 1 ? endAxisLabel : formatRelativeLineTime(point.timestamp, chart.current.timestamp)}
          </text>
        ))}
      </svg>
      <div className="mt-1 border-t border-border pt-2">
        <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border bg-card/60">
          {summaryItems.map((item) => (
            <div key={item.label} className="border-r border-border px-2 py-2 last:border-r-0">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{item.label}</p>
              <p className={cn("mt-0.5 font-mono text-[12px] font-black tabular-nums", item.className)}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          <span>Low {formatAmericanOdds(chart.low)}</span>
          <span className={cn("inline-flex items-center gap-1", change >= 0 ? "text-emerald-500" : "text-red-500")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", change >= 0 ? "bg-emerald-500" : "bg-red-500")} />
            {chart.positions.length} line entries
          </span>
          {chart.liveBoundary && (
            <span className="inline-flex items-center gap-1 text-brand">
              <span className="h-2.5 w-px bg-brand/80" />
              Live odds after {formatMiniLineAxisTime(chart.liveBoundary.startedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyMiniLineMovementChart({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-neutral-50 dark:bg-neutral-800/40 p-3 dark:bg-neutral-800/30 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="relative h-[150px] overflow-hidden rounded-md">
        <div className="absolute inset-x-10 top-8 space-y-7">
          {[0, 1, 2].map((line) => (
            <div key={line} className="border-t border-neutral-200/75 dark:border-neutral-700/45" />
          ))}
        </div>
        <div className="absolute inset-x-10 bottom-8 flex items-end justify-between">
          {[32, 54, 26, 64, 42, 72].map((height, index) => (
            <div key={index} className="w-1.5 rounded-full bg-neutral-200/80 dark:bg-neutral-700/55" style={{ height }} />
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="max-w-[220px] text-xs leading-relaxed text-neutral-500 dark:text-slate-400">{message}</p>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-neutral-200/60 pt-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 dark:border-neutral-700/35 dark:text-slate-500">
        <span>Low -</span>
        <span>Last -</span>
        <span>0 line entries</span>
      </div>
    </div>
  );
}

function MlbRightRail({
  currentMarket,
  activeLine,
  bookOffers,
  chartStats,
  dynamicHitRates,
  nextGame,
  lineHistory,
  isLineHistoryLoading,
  lineHistoryError,
  lineOptions,
  lineHistorySide,
  onLineHistorySideChange,
  onLineChange,
  canOpenLineHistory,
  onOpenLineHistory,
  isFavoriteSaved,
  isFavoriteSaving,
  isFavoriteLoggedIn,
  canSaveFavorite,
  onToggleFavorite,
}: {
  currentMarket: string;
  activeLine: number;
  bookOffers: MlbBookOffer[];
  chartStats: { avg: number | null; hitRate: number | null; hits: number; total: number };
  dynamicHitRates: { l5: number | null; l10: number | null; l20: number | null; season: number | null; h2h: number | null };
  nextGame: {
    gameDate?: string | null;
    gameDatetime?: string | null;
    gameStatus?: string | null;
    homeAway?: "H" | "A" | null;
    opponentTeamAbbr?: string | null;
    opposingPitcherName?: string | null;
    opposingPitcherId?: number | string | null;
  } | null;
  lineHistory: LineHistoryApiResponse | null | undefined;
  isLineHistoryLoading: boolean;
  lineHistoryError: Error | null;
  lineOptions: number[];
  lineHistorySide: MlbLineHistorySide;
  onLineHistorySideChange: (side: MlbLineHistorySide) => void;
  onLineChange: (line: number) => void;
  canOpenLineHistory?: boolean;
  onOpenLineHistory?: () => void;
  isFavoriteSaved: boolean;
  isFavoriteSaving: boolean;
  isFavoriteLoggedIn: boolean;
  canSaveFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [bookSort, setBookSort] = useState<{ key: MlbBookSortKey; direction: SortDirection }>({
    key: "over",
    direction: "desc",
  });
  const [selectedHistoryBookId, setSelectedHistoryBookId] = useState<string | null>(null);
  const modelPct = dynamicHitRates.season ?? chartStats.hitRate;
  // When the modal is opened from a tool that doesn't carry odds context (e.g. exit
  // velocity), the right-rail panels for live odds, line movement, and the betslip
  // CTA have nothing to show. Hide them outright instead of stacking empty states.
  const hasOddsContext = bookOffers.length > 0 || canOpenLineHistory || canSaveFavorite;
  const isMarketClosed = isMlbMarketClosed(nextGame);
  const gameStartTimestampMs = getMlbGameStartTimestampMs(nextGame);
  const currentSideBookOffers = useMemo(() => {
    return bookOffers.filter((offer) => offer.side === lineHistorySide && Math.abs(offer.line - activeLine) < 0.01);
  }, [activeLine, bookOffers, lineHistorySide]);
  const historyBookOptions = useMemo(() => {
    const byBook = new Map<string, LineHistoryBookData>();
    const getKey = (book: { bookId?: string | null; bookName?: string | null }) => {
      const sportsbook = getLineHistorySportsbook(book);
      return sportsbook?.id ?? normalizeLineHistoryBookKey(book.bookId) ?? normalizeLineHistoryBookKey(book.bookName);
    };

    (lineHistory?.books ?? []).forEach((book) => {
      byBook.set(getKey(book), book);
    });

    currentSideBookOffers.forEach((offer) => {
      const key = getKey({ bookId: offer.book });
      const existing = byBook.get(key);
      if (existing) return;
      const sportsbook = getLineHistorySportsbook({ bookId: offer.book });
      byBook.set(key, {
        bookId: offer.book,
        bookName: sportsbook?.name ?? offer.book,
        status: "not_found",
        message: "No historical odds found for this book.",
        oddsId: undefined,
        market: null,
        selection: null,
        updated: null,
        olv: { price: null, timestamp: null },
        clv: { price: null, timestamp: null },
        currentPrice: offer.price,
        entries: [],
        source: "cache",
      });
    });

    return Array.from(byBook.values())
      .sort((a, b) => {
        const aRank = getLineHistoryBookPriorityRank(a);
        const bRank = getLineHistoryBookPriorityRank(b);
        if (aRank !== bRank) return aRank - bRank;
        return a.bookName.localeCompare(b.bookName);
      });
  }, [currentSideBookOffers, lineHistory]);
  const selectedHistoryBook = useMemo(() => {
    return historyBookOptions.find((book) => book.bookId === selectedHistoryBookId) ?? historyBookOptions[0] ?? null;
  }, [historyBookOptions, selectedHistoryBookId]);
  useEffect(() => {
    if (historyBookOptions.length === 0) {
      if (selectedHistoryBookId !== null) setSelectedHistoryBookId(null);
      return;
    }

    if (!selectedHistoryBookId || !historyBookOptions.some((book) => book.bookId === selectedHistoryBookId)) {
      setSelectedHistoryBookId(historyBookOptions[0].bookId);
    }
  }, [historyBookOptions, selectedHistoryBookId]);
  const baseBookRows = useMemo(() => {
    if (isMarketClosed) return [];
    const rows = new Map<string, { book: string; over?: MlbBookOffer; under?: MlbBookOffer }>();
    bookOffers.filter((offer) => Math.abs(offer.line - activeLine) < 0.01).forEach((offer) => {
      const row = rows.get(offer.book) ?? { book: offer.book };
      if (offer.side === "over") {
        if (!row.over || (americanToDecimal(offer.price) ?? 0) > (americanToDecimal(row.over.price) ?? 0)) row.over = offer;
      } else if (!row.under || (americanToDecimal(offer.price) ?? 0) > (americanToDecimal(row.under.price) ?? 0)) {
        row.under = offer;
      }
      rows.set(offer.book, row);
    });
    return Array.from(rows.values())
      .sort((a, b) => {
        const aBest = Number(Boolean(a.over?.isBest)) + Number(Boolean(a.under?.isBest));
        const bBest = Number(Boolean(b.over?.isBest)) + Number(Boolean(b.under?.isBest));
        if (aBest !== bBest) return bBest - aBest;
        const aBestDecimal = Math.max(americanToDecimal(a.over?.price) ?? 0, americanToDecimal(a.under?.price) ?? 0);
        const bBestDecimal = Math.max(americanToDecimal(b.over?.price) ?? 0, americanToDecimal(b.under?.price) ?? 0);
        return bBestDecimal - aBestDecimal;
      })
  }, [activeLine, bookOffers, isMarketClosed]);
  const bookRows = useMemo(() => {
    const priceValue = (offer?: MlbBookOffer) => americanToDecimal(offer?.price) ?? -Infinity;
    const directionMultiplier = bookSort.direction === "asc" ? 1 : -1;

    return [...baseBookRows]
      .sort((a, b) => {
        if (bookSort.key === "book") {
          const aName = getSportsbookById(a.book)?.name ?? a.book;
          const bName = getSportsbookById(b.book)?.name ?? b.book;
          return aName.localeCompare(bName) * directionMultiplier;
        }

        const aValue = priceValue(bookSort.key === "over" ? a.over : a.under);
        const bValue = priceValue(bookSort.key === "over" ? b.over : b.under);
        if (aValue !== bValue) return (aValue - bValue) * directionMultiplier;

        const aBest = Number(Boolean(a.over?.isBest)) + Number(Boolean(a.under?.isBest));
        const bBest = Number(Boolean(b.over?.isBest)) + Number(Boolean(b.under?.isBest));
        if (aBest !== bBest) return bBest - aBest;

        const aName = getSportsbookById(a.book)?.name ?? a.book;
        const bName = getSportsbookById(b.book)?.name ?? b.book;
        return aName.localeCompare(bName);
      })
  }, [baseBookRows, bookSort]);
  const hasMoreBookRows = bookRows.length >= 5;
  const getOfferEvPercent = (offer: MlbBookOffer | undefined) => {
    if (!offer || offer.isSharpRef || offer.evPercent === null || offer.evPercent <= 0) return null;
    return offer.evPercent;
  };
  const handleBookSort = (key: MlbBookSortKey) => {
    setBookSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: key === "book" ? "asc" : "desc" };
    });
  };
  const selectedLineOption = lineOptions.find((line) => Math.abs(line - activeLine) < 0.01) ?? activeLine;
  const renderBookSortHeader = (key: MlbBookSortKey, label: string, className?: string) => {
    const isActive = bookSort.key === key;
    return (
      <button
        type="button"
        onClick={() => handleBookSort(key)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800/70 dark:hover:text-slate-200",
          isActive && "text-neutral-800 dark:text-slate-200",
          className
        )}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition",
            isActive ? "opacity-100" : "opacity-35",
            isActive && bookSort.direction === "asc" && "rotate-180"
          )}
        />
      </button>
    );
  };
  const betNotes = [
    modelPct !== null
      ? `${formatMarketLabel(currentMarket)} has hit in ${modelPct}% of 2026 games at ${activeLine}+.`
      : "Season hit-rate context will appear once game logs are available.",
    chartStats.avg !== null
      ? `Recent sample average is ${chartStats.avg.toFixed(1)} against a ${activeLine}+ line.`
      : "Recent sample average is unavailable for this market.",
    nextGame?.opponentTeamAbbr
      ? `Next matchup is ${nextGame.homeAway === "H" ? "vs" : "@"} ${nextGame.opponentTeamAbbr}.`
      : "Upcoming matchup context is not attached to this row yet.",
  ];
  const selectedHistorySportsbook = selectedHistoryBook ? getLineHistorySportsbook(selectedHistoryBook) : undefined;
  const selectedHistoryLiveOffer = useMemo(() => {
    if (!selectedHistoryBook || isMarketClosed) return null;
    return bookOffers.find((offer) => (
      offer.side === lineHistorySide
      && Math.abs(offer.line - activeLine) < 0.01
      && isSameLineHistorySportsbook(offer.book, selectedHistoryBook)
    )) ?? null;
  }, [activeLine, bookOffers, isMarketClosed, lineHistorySide, selectedHistoryBook]);
  const syncedHistoryEntries = useMemo(() => {
    if (!selectedHistoryBook) return [];
    if (isMarketClosed) return selectedHistoryBook.entries;
    return syncLineHistoryWithLivePrice(selectedHistoryBook.entries, selectedHistoryLiveOffer?.price ?? selectedHistoryBook.currentPrice);
  }, [isMarketClosed, selectedHistoryBook, selectedHistoryLiveOffer?.price]);

  return (
    <aside className="flex min-h-0 flex-col gap-2.5 lg:sticky lg:top-0 lg:h-full lg:max-h-full lg:self-stretch lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1 scrollbar-hide">
      <MlbGlassPanel className="shrink-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">Bet Context</h3>
        </div>
        <div className="space-y-2.5 px-4 py-3">
          {betNotes.map((note, idx) => (
            <div key={note} className="flex gap-2 text-xs leading-relaxed text-foreground/80">
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  idx < 2 ? "border-emerald-500/60 text-emerald-600 dark:text-emerald-300" : "border-amber-500/60 text-amber-600 dark:text-amber-300"
                )}
              >
                {idx < 2 ? "✓" : "!"}
              </span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </MlbGlassPanel>

      {hasOddsContext && (
      <MlbGlassPanel className="flex min-h-[220px] flex-col overflow-hidden lg:min-h-[176px] lg:flex-none xl:min-h-[220px]">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">Best Books</h3>
            {isMarketClosed ? (
              <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">
                Closed
              </span>
            ) : hasMoreBookRows ? (
              <span className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Scroll for more
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:max-h-[248px] xl:max-h-none">
          <div className="grid grid-cols-[minmax(0,1fr)_86px_86px] gap-2 px-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {renderBookSortHeader("book", "Book", "justify-self-start")}
            {renderBookSortHeader("over", "Over", "justify-self-end")}
            {renderBookSortHeader("under", "Under", "justify-self-end")}
          </div>
          <div className={cn("mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5 scrollbar-hide", hasMoreBookRows && "max-h-[188px]")}>
            {bookRows.length > 0 ? bookRows.map((row) => {
              const sb = getSportsbookById(row.book);
              const overLink = getOddsLink(row.over);
              const underLink = getOddsLink(row.under);
              const overEvPercent = getOfferEvPercent(row.over);
              const underEvPercent = getOfferEvPercent(row.under);
              return (
                <div
                  key={row.book}
                  className={cn(
                    "grid min-h-[46px] grid-cols-[minmax(0,1fr)_86px_86px] items-center gap-2 border-b border-border/60 px-1 py-1.5 text-sm last:border-b-0",
                    (row.over?.isBest || row.under?.isBest) && "bg-emerald-500/[0.06] dark:bg-emerald-500/[0.05]"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {sb?.image?.light && <img src={sb.image.light} alt={sb.name} className="h-4 w-4 rounded object-contain" />}
                    <span className="truncate font-semibold text-foreground">{sb?.name ?? row.book}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!overLink}
                    title={overLink ? `Open ${sb?.name ?? row.book} over odds` : undefined}
                    onClick={() => overLink && window.open(overLink, "_blank", "noopener,noreferrer")}
                    className={cn(
                      "group relative inline-flex h-8 min-w-[76px] items-center justify-center overflow-hidden rounded-md border text-right font-mono text-[13px] font-bold tabular-nums shadow-sm transition active:scale-[0.98] disabled:cursor-default dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
                      row.over?.isBest
                        ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                        : "border-border bg-card text-foreground hover:border-brand/50 hover:bg-brand/8",
                      !row.over && "border-transparent bg-transparent text-muted-foreground/40 shadow-none"
                    )}
                  >
                    <span className="inline-flex h-full min-w-0 flex-1 items-center justify-center gap-1 px-2">
                      {row.over ? formatAmericanOdds(row.over.price) : "-"}
                      {row.over && overLink && <ExternalLink className="h-2.5 w-2.5 opacity-45 transition group-hover:opacity-80" />}
                    </span>
                    {overEvPercent !== null && (
                      <Tooltip content={`+${overEvPercent.toFixed(1)}% +EV`} contentClassName="px-2.5 py-1.5 text-xs font-bold">
                        <span className="inline-flex h-full min-w-[38px] items-center justify-center border-l border-emerald-500/25 bg-emerald-500/15 px-1.5 text-[9px] font-black leading-none text-emerald-700 transition hover:bg-emerald-500/25 dark:border-emerald-300/20 dark:bg-emerald-400/15 dark:text-emerald-200 dark:hover:bg-emerald-400/25">
                          +{overEvPercent.toFixed(1)}%
                        </span>
                      </Tooltip>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={!underLink}
                    title={underLink ? `Open ${sb?.name ?? row.book} under odds` : undefined}
                    onClick={() => underLink && window.open(underLink, "_blank", "noopener,noreferrer")}
                    className={cn(
                      "group relative inline-flex h-8 min-w-[76px] items-center justify-center overflow-hidden rounded-md border text-right font-mono text-[13px] font-bold tabular-nums shadow-sm transition active:scale-[0.98] disabled:cursor-default dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
                      row.under?.isBest
                        ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                        : "border-border bg-card text-foreground hover:border-brand/50 hover:bg-brand/8",
                      !row.under && "border-transparent bg-transparent text-muted-foreground/40 shadow-none"
                    )}
                  >
                    <span className="inline-flex h-full min-w-0 flex-1 items-center justify-center gap-1 px-2">
                      {row.under ? formatAmericanOdds(row.under.price) : "-"}
                      {row.under && underLink && <ExternalLink className="h-2.5 w-2.5 opacity-45 transition group-hover:opacity-80" />}
                    </span>
                    {underEvPercent !== null && (
                      <Tooltip content={`+${underEvPercent.toFixed(1)}% +EV`} contentClassName="px-2.5 py-1.5 text-xs font-bold">
                        <span className="inline-flex h-full min-w-[38px] items-center justify-center border-l border-emerald-500/25 bg-emerald-500/15 px-1.5 text-[9px] font-black leading-none text-emerald-700 transition hover:bg-emerald-500/25 dark:border-emerald-300/20 dark:bg-emerald-400/15 dark:text-emerald-200 dark:hover:bg-emerald-400/25">
                          +{underEvPercent.toFixed(1)}%
                        </span>
                      </Tooltip>
                    )}
                  </button>
                </div>
              );
            }) : (
              <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                {isMarketClosed ? "Market closed. Live book prices are hidden after final." : "No live books attached to this selection."}
              </div>
            )}
          </div>
        </div>
      </MlbGlassPanel>
      )}

      {hasOddsContext && (
      <MlbGlassPanel className="shrink-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">Line Movement</h3>
            <button
              type="button"
              disabled={!canOpenLineHistory}
              onClick={onOpenLineHistory}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition active:scale-[0.98]",
                canOpenLineHistory
                  ? "border-border text-muted-foreground hover:border-brand/50 hover:bg-brand/10 hover:text-brand"
                  : "cursor-not-allowed border-border/40 text-muted-foreground/40"
              )}
            >
              Full
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="px-4 py-4">
          {isLineHistoryLoading ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-neutral-800/40 p-3 dark:bg-neutral-800/30 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                <div className="h-[150px] animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800/60" />
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                  <div className="h-3 w-28 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/70" />
                  <div className="h-3 w-20 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/70" />
                </div>
              </div>
            </div>
          ) : selectedHistoryBook ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    Book
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="group flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-left text-xs font-bold text-foreground shadow-sm outline-none transition hover:border-brand/50 hover:bg-brand/8 focus:border-brand focus:ring-2 focus:ring-brand/15 data-[state=open]:border-brand data-[state=open]:ring-2 data-[state=open]:ring-brand/15"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {selectedHistorySportsbook?.image?.light && (
                            <img
                              src={selectedHistorySportsbook.image.light}
                              alt=""
                              className="h-4 w-4 shrink-0 rounded object-contain"
                            />
                          )}
                          <span className="truncate">{selectedHistoryBook.bookName}</span>
                          {getSharpLineHistoryRank(selectedHistoryBook) < SHARP_LINE_HISTORY_BOOKS.length && (
                            <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.06em] text-emerald-600 dark:text-emerald-300">
                              Sharp
                            </span>
                          )}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      onWheelCapture={(event) => event.stopPropagation()}
                      className="max-h-72 min-w-[220px] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1.5 shadow-xl ring-0 scrollbar-hide"
                    >
                      {historyBookOptions.map((book) => {
                        const sb = getLineHistorySportsbook(book);
                        const isSelected = book.bookId === selectedHistoryBook.bookId;
                        const isSharp = getSharpLineHistoryRank(book) < SHARP_LINE_HISTORY_BOOKS.length;
                        return (
                          <DropdownMenuItem
                            key={book.bookId}
                            onSelect={() => setSelectedHistoryBookId(book.bookId)}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs font-bold text-foreground/80 focus:bg-brand/10 focus:text-foreground",
                              isSelected && "bg-brand/10 text-foreground"
                            )}
                          >
                            {sb?.image?.light ? (
                              <img src={sb.image.light} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                            ) : (
                              <span className="h-4 w-4 shrink-0 rounded bg-neutral-100 dark:bg-neutral-800" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{book.bookName}</span>
                            {isSharp && (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.06em] text-emerald-600 dark:text-emerald-300">
                                Sharp
                              </span>
                            )}
                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="group inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 font-mono text-[10px] font-bold tabular-nums text-foreground/80 shadow-sm outline-none transition hover:border-brand/50 hover:bg-brand/8 focus:border-brand focus:ring-2 focus:ring-brand/15 data-[state=open]:border-brand data-[state=open]:ring-2 data-[state=open]:ring-brand/15"
                      >
                        {selectedLineOption}+
                        <ChevronDown className="h-3 w-3 text-muted-foreground transition group-data-[state=open]:rotate-180" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onWheelCapture={(event) => event.stopPropagation()}
                      className="max-h-64 min-w-24 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1.5 shadow-xl ring-0 scrollbar-hide"
                    >
                      {lineOptions.map((line) => {
                        const isSelected = Math.abs(line - activeLine) < 0.01;
                        return (
                          <DropdownMenuItem
                            key={line}
                            onSelect={() => onLineChange(line)}
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 font-mono text-[11px] font-bold tabular-nums text-foreground/80 focus:bg-brand/10 focus:text-foreground",
                              isSelected && "bg-brand/10 text-foreground"
                            )}
                          >
                            {line}+
                            {isSelected && <Check className="h-3.5 w-3.5 text-brand" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Switch line movement side from ${lineHistorySide}`}
                        className="group inline-flex h-8 w-9 items-center justify-center rounded-md border border-border bg-card font-mono text-[11px] font-black uppercase text-foreground/80 shadow-sm outline-none transition hover:border-brand/50 hover:bg-brand/8 focus:border-brand focus:ring-2 focus:ring-brand/15 data-[state=open]:border-brand data-[state=open]:ring-2 data-[state=open]:ring-brand/15"
                      >
                        {lineHistorySide === "over" ? "O" : "U"}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-24 rounded-lg border border-border bg-card p-1.5 shadow-xl ring-0"
                    >
                      {(["over", "under"] as const).map((side) => (
                        <DropdownMenuItem
                          key={side}
                          onSelect={() => onLineHistorySideChange(side)}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/80 focus:bg-brand/10 focus:text-foreground",
                            side === lineHistorySide && "bg-brand/10 text-foreground"
                          )}
                        >
                          <span><span className="font-black">{side === "over" ? "O" : "U"}</span> {side}</span>
                          {side === lineHistorySide && <Check className="h-3.5 w-3.5 text-brand" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div>
                {syncedHistoryEntries.length >= 2 ? (
                  <MiniLineMovementChart
                    points={syncedHistoryEntries}
                    isMarketClosed={isMarketClosed}
                    liveStartTimestamp={gameStartTimestampMs}
                  />
                ) : (
                  <EmptyMiniLineMovementChart message="No historical odds available for this book, side, and line yet." />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {syncedHistoryEntries.length < 2
                  ? "Try another book, side, or line to view historical movement."
                  : isMarketClosed
                  ? `Closed ${formatLineHistoryTime(syncedHistoryEntries.at(-1)?.timestamp)}`
                  : selectedHistoryLiveOffer
                  ? `Synced to live Best Books price ${formatAmericanOdds(selectedHistoryLiveOffer.price)}`
                  : `Last updated ${formatLineHistoryTime(selectedHistoryBook.entries.at(-1)?.timestamp)}`}
              </p>
              <div className="border-t border-border pt-3">
                <button
                  type="button"
                  disabled={isFavoriteSaving || (!canSaveFavorite && isFavoriteLoggedIn)}
                  onClick={onToggleFavorite}
                  className={cn(
                    "group flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black tracking-tight transition active:scale-[0.99]",
                    isFavoriteSaved
                      ? "border-brand/35 bg-brand/10 text-brand hover:bg-brand/15"
                      : "border-brand/30 bg-gradient-to-b from-brand to-brand/85 text-on-primary shadow-md shadow-brand/30 hover:shadow-lg hover:shadow-brand/40 dark:shadow-brand/25 dark:hover:shadow-brand/35",
                    (isFavoriteSaving || (!canSaveFavorite && isFavoriteLoggedIn)) && "cursor-not-allowed opacity-60"
                  )}
                >
                  {isFavoriteSaved ? (
                    <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />
                  ) : (
                    <IconCirclePlus className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" stroke={2.2} />
                  )}
                  <span>{isFavoriteSaved ? "Saved to Betslip" : "Add to Betslip"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs leading-relaxed text-muted-foreground">
                {lineHistoryError?.message || "Line movement will appear when historical odds are available for this book."}
              </div>
              <div className="border-t border-border pt-3">
                <button
                  type="button"
                  disabled={isFavoriteSaving || (!canSaveFavorite && isFavoriteLoggedIn)}
                  onClick={onToggleFavorite}
                  className={cn(
                    "group flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black tracking-tight transition active:scale-[0.99]",
                    isFavoriteSaved
                      ? "border-brand/35 bg-brand/10 text-brand hover:bg-brand/15"
                      : "border-brand/30 bg-gradient-to-b from-brand to-brand/85 text-on-primary shadow-md shadow-brand/30 hover:shadow-lg hover:shadow-brand/40 dark:shadow-brand/25 dark:hover:shadow-brand/35",
                    (isFavoriteSaving || (!canSaveFavorite && isFavoriteLoggedIn)) && "cursor-not-allowed opacity-60"
                  )}
                >
                  {isFavoriteSaved ? (
                    <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />
                  ) : (
                    <IconCirclePlus className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" stroke={2.2} />
                  )}
                  <span>{isFavoriteSaved ? "Saved to Betslip" : "Add to Betslip"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </MlbGlassPanel>
      )}
      {!hasOddsContext && (
        <MlbGlassPanel className="shrink-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">Live Odds</h3>
          </div>
          <div className="px-4 py-5 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Odds aren&apos;t attached to this view. Open this player from <span className="font-semibold text-foreground/80">Prop Center</span>, <span className="font-semibold text-foreground/80">Edge Finder</span>, or <span className="font-semibold text-foreground/80">+EV</span> to see live books and line movement.
            </p>
          </div>
        </MlbGlassPanel>
      )}
    </aside>
  );
}

function MlbQuickMatchupPanel({
  profile,
  currentMarket,
  activeLine,
  dynamicHitRates,
}: {
  profile?: HitRateProfile;
  currentMarket: string;
  activeLine: number;
  dynamicHitRates: { l5: number | null; l10: number | null; l20: number | null; season: number | null; h2h: number | null };
}) {
  const stats = [
    { label: "L5", value: dynamicHitRates.l5, sub: profile?.last5Avg?.toFixed(1) },
    { label: "L10", value: dynamicHitRates.l10, sub: profile?.last10Avg?.toFixed(1) },
    { label: "L20", value: dynamicHitRates.l20, sub: profile?.last20Avg?.toFixed(1) },
    { label: "Season", value: dynamicHitRates.season, sub: profile?.seasonAvg?.toFixed(1) },
    { label: "H2H", value: dynamicHitRates.h2h, sub: profile?.h2hAvg?.toFixed(1) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Matchup</p>
          <div className="mt-3 flex items-center gap-3">
            {profile?.opponentTeamAbbr && (
              <img
                src={getTeamLogoUrl(profile.opponentTeamAbbr, "mlb")}
                alt={profile.opponentTeamAbbr}
                className="h-9 w-9 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div>
              <p className="text-lg font-black text-neutral-950 dark:text-white">
                {profile?.homeAway === "H" ? "vs" : "@"} {profile?.opponentTeamAbbr || "TBD"}
              </p>
              <p className="text-xs font-medium text-neutral-500">{profile?.gameStatus || profile?.startTime || "Start TBD"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Prop Line</p>
          <p className="mt-3 text-2xl font-black tabular-nums text-neutral-950 dark:text-white">
            {activeLine}+ <span className="text-sm font-bold text-neutral-500">{formatMarketLabel(currentMarket)}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {profile?.bestOdds ? `${profile.bestOdds.book.toUpperCase()} ${profile.bestOdds.price > 0 ? "+" : ""}${profile.bestOdds.price}` : "No live odds attached"}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Context</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <span className="text-neutral-500">Hand</span>
            <span className="text-right font-bold text-neutral-900 dark:text-white">{profile?.battingHand || "-"}</span>
            <span className="text-neutral-500">Lineup</span>
            <span className="text-right font-bold text-neutral-900 dark:text-white">{profile?.lineupPosition ? `#${profile.lineupPosition}` : "-"}</span>
            <span className="text-neutral-500">DvP</span>
            <span className="text-right font-bold text-neutral-900 dark:text-white">{profile?.matchupRankLabel || (profile?.matchupRank ? `#${profile.matchupRank}` : "-")}</span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid grid-cols-5 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-neutral-50 p-3 text-center dark:bg-neutral-800/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{stat.label}</p>
              <p className={cn("mt-1 text-lg font-black tabular-nums", getPctColor(stat.value))}>
                {stat.value !== null ? `${stat.value}%` : "-"}
              </p>
              <p className="text-[10px] font-semibold text-neutral-400">{stat.sub ? `${stat.sub} avg` : "no avg"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlayerQuickViewModal({
  open,
  onOpenChange,
  sport = "nba",
  odds_player_id,
  player_name,
  nba_player_id: directNbaPlayerId,
  mlb_player_id: directMlbPlayerId,
  initial_market,
  initial_line,
  onMarketChange,
  odds,
  event_id,
  showFullProfileLink = true,
  gameContext,
  liveBookOffers,
}: PlayerQuickViewModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const applyState = useStateLink();
  const queryClient = useQueryClient();
  const { toggleFavorite, isFavorited, isLoggedIn, isToggling } = useFavorites();
  const isMlb = sport === "mlb";
  const isWnba = sport === "wnba";
  const [lineHistoryDialogOpen, setLineHistoryDialogOpen] = useState(false);
  const [lineHistorySide, setLineHistorySide] = useState<MlbLineHistorySide>("over");
  const [battedBallFilters, setBattedBallFilters] = useState<MlbSprayChartFilterState>(() => getDefaultMlbSprayChartFilters());
  const [selectedBattedBallKey, setSelectedBattedBallKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setLineHistoryDialogOpen(false);
  }, [open]);

  useEffect(() => {
    setSelectedBattedBallKey(null);
  }, [battedBallFilters]);

  // Check if user has Hit Rate access for advanced tabs (hit_rate or pro plan)
  const { user } = useAuth();
  const { hasAccess: hasAdvancedAccess } = useHasHitRateAccess();
  const isAuthenticated = !!user;

  // Data fetching - skip lookup when the caller already has the sport's internal player ID.
  const needsLookup = isMlb
    ? !directMlbPlayerId && !!(odds_player_id || player_name)
    : !directNbaPlayerId && !!(odds_player_id || player_name);
  const { data: lookupData, isLoading: isLoadingLookup } = usePlayerLookup({
    sport,
    odds_player_id,
    player_name,
    enabled: open && needsLookup,
  });

  // Use direct ID if provided, otherwise use looked up ID. WNBA's lookup row
  // ships TWO ids: wnba_player_id (the routing id used for hit-rates / box
  // scores / RPCs) and nba_player_id (the cdn.nba.com headshot id). Keep
  // them separate — using the headshot id for routing returns no profile
  // and the modal renders "Player Not Found".
  const nba_player_id = directNbaPlayerId || lookupData?.player?.nba_player_id || undefined;
  const wnba_player_id = lookupData?.player?.wnba_player_id || undefined;
  const mlb_player_id = directMlbPlayerId || lookupData?.player?.mlb_player_id || undefined;
  const resolvedPlayerId = isMlb
    ? mlb_player_id
    : isWnba
      ? wnba_player_id
      : nba_player_id;
  const playerInfo = lookupData?.player;
  const oddsPlayerIdForLookup = odds_player_id || playerInfo?.odds_player_id || null;

  // Fetch profiles and box scores in PARALLEL (not sequential)
  // Only fetch when we have a player ID
  const { rows: profiles, isLoading: isLoadingProfiles } = useHitRateTable({
    sport,
    playerId: resolvedPlayerId,
    search: !resolvedPlayerId && isMlb ? player_name : undefined,
    enabled: open && (!!resolvedPlayerId || (isMlb && !!player_name)),
    limit: 20, // Reduced from 50 - we only need current markets
  });

  // Pull the same 100-game window the v2 drilldown uses so SZN has the
  // full season available (NBA regular season is 82 games + playoffs).
  // WNBA endpoint expects wnba_player_id; using the headshot nba_player_id
  // returns nothing.
  const { games: boxScoreGames, seasonSummary, isLoading: isLoadingBoxScores } = usePlayerBoxScores({
    playerId: resolvedPlayerId || null,
    sport: isMlb ? undefined : (sport as "nba" | "wnba"),
    enabled: !isMlb && open && !!resolvedPlayerId,
  });

  // Profile & market selection
  const hasUpcomingProfile = profiles.length > 0;
  const isMlbPitcherProfile = useMemo(() => {
    if (!isMlb) return false;
    if (isMlbPitcherMarketKey(initial_market)) return true;
    return profiles.some((p) => p.position === "P" || isMlbPitcherMarketKey(p.market));
  }, [initial_market, isMlb, profiles]);
  
  // Sort markets by preferred order
  const availableMarkets = useMemo(() => {
    const fallbackMarkets = isMlb
      ? isMlbPitcherProfile
        ? MLB_PITCHER_FALLBACK_MARKETS
        : MLB_BATTER_FALLBACK_MARKETS
      : FALLBACK_MARKETS;
    const profileMarkets = hasUpcomingProfile
      ? profiles
          .map((p) => p.market)
          .filter((market) => !isMlb || isMlbPitcherMarketKey(market) === isMlbPitcherProfile)
      : [];
    const marketCandidates = isMlb
      ? [...fallbackMarkets, ...profileMarkets]
      : profileMarkets.length > 0
        ? profileMarkets
        : fallbackMarkets;
    const safeInitialMarket = initial_market && (!isMlb || isMlbPitcherMarketKey(initial_market) === isMlbPitcherProfile)
      ? initial_market
      : null;
    const uniqueMarkets = Array.from(new Set([safeInitialMarket, ...marketCandidates].filter(Boolean) as string[]));
    // Sort by FALLBACK_MARKETS order (preferred display order)
    return uniqueMarkets.sort((a, b) => {
      const indexA = fallbackMarkets.indexOf(a);
      const indexB = fallbackMarkets.indexOf(b);
      // If not in FALLBACK_MARKETS, put at end
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [hasUpcomingProfile, profiles, isMlb, isMlbPitcherProfile, initial_market]);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(initial_market || null);
  
  // Only sync initial_market on mount or when it changes from parent
  // If the initial_market isn't available (e.g., double doubles), fall back to player_points
  useEffect(() => {
    if (initial_market && availableMarkets.length > 0) {
      if (availableMarkets.includes(initial_market)) {
        setSelectedMarket(initial_market);
      } else {
        // Fallback to player_points if initial market isn't available
        const preferredDefault = isMlb ? (isMlbPitcherProfile ? "pitcher_strikeouts" : "player_hits") : "player_points";
        const fallbackMarket = availableMarkets.includes(preferredDefault)
          ? preferredDefault
          : availableMarkets[0];
        setSelectedMarket(fallbackMarket);
      }
    }
  }, [initial_market, availableMarkets, isMlb, isMlbPitcherProfile]);

  // Set default market if none selected
  useEffect(() => {
    if (!selectedMarket && availableMarkets.length > 0) {
      setSelectedMarket(availableMarkets[0]);
    } else if (selectedMarket && availableMarkets.length > 0 && !availableMarkets.includes(selectedMarket)) {
      setSelectedMarket(availableMarkets[0]);
    }
  }, [selectedMarket, availableMarkets]);

  const currentMarket = selectedMarket || availableMarkets[0] || (isMlb ? (isMlbPitcherProfile ? "pitcher_strikeouts" : "player_hits") : "player_points");
  const currentMarketProfile = profiles.find((p) => p.market === currentMarket) || null;
  const profile = currentMarketProfile || profiles[0];
  const oddsLookupRows = useMemo(() => {
    return profiles
      .map((p) => ({
        oddsSelectionId: p.selKey || p.oddsSelectionId,
        line: p.line,
      }))
      .filter((row) => !!row.oddsSelectionId);
  }, [profiles]);
  const { getOdds: getHitRateOdds } = useHitRateOdds({
    rows: oddsLookupRows,
    sport,
    enabled: open && oddsLookupRows.length > 0,
    refetchIntervalMs: isMlb && open ? 30_000 : false,
  });

  const { games: mlbGames, season: mlbLogSeason, isLoading: isLoadingMlbLogs } = useMlbPlayerGameLogs({
    playerId: isMlb ? resolvedPlayerId ?? profiles[0]?.playerId ?? null : null,
    market: currentMarket,
    limit: 200,
    includePrior: false,
    enabled: isMlb && open && !!(resolvedPlayerId ?? profiles[0]?.playerId),
  });

  const modalGames = isMlb ? mlbGames : boxScoreGames;

  const hitRateDate = useMemo(() => {
    const candidate =
      profile?.gameDate ||
      profiles[0]?.gameDate ||
      profile?.startTime ||
      profiles[0]?.startTime ||
      null;

    if (!candidate) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;

    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split("T")[0];
  }, [profile?.gameDate, profile?.startTime, profiles]);

  const fullHitRateHref = useMemo(() => {
    const params = new URLSearchParams({ market: currentMarket });
    if (hitRateDate) {
      params.set("date", hitRateDate);
    }
    // Pin to the v2 drilldown — the Edge Finder / EV quick-view modal
    // was deep-linking to v1 because it didn't carry the `v=2` flag the
    // page reads to pick the new bento layout. NBA + WNBA both have v2;
    // MLB doesn't ship a v2 yet so skip the flag for it.
    if (sport !== "mlb") {
      params.set("v", "2");
    }
    const playerId = profile?.playerId || resolvedPlayerId;
    return playerId
      ? `/hit-rates/${sport}/player/${playerId}?${params.toString()}`
      : `/hit-rates/${sport}`;
  }, [currentMarket, hitRateDate, profile?.playerId, resolvedPlayerId, sport]);

  // Fetch alternate lines using React Query for caching
  const normalizedPlayerNameKey = player_name?.toLowerCase().replace(/ /g, "_") || "";
  const playerKey = oddsPlayerIdForLookup || normalizedPlayerNameKey;
  const { data: alternatesData } = useQuery({
    queryKey: ["modal-alternates", event_id, playerKey, currentMarket],
    queryFn: async () => {
      if (!event_id || !playerKey) return [];
      
      const params = new URLSearchParams({
        sport,
        eventId: event_id,
        market: currentMarket,
        player: playerKey,
      });
      
      const response = await fetch(`/api/v2/props/alternates?${params.toString()}`);
      if (!response.ok) return [];
      
      const result = await response.json();
      const allLines = result.lines || result.all_lines || [];
      
      // Transform to simpler structure for odds lookup
      return allLines.map((line: any) => {
        let bestOver: AlternateLineOdds["over"] = undefined;
        let bestUnder: AlternateLineOdds["under"] = undefined;
        const books: NonNullable<AlternateLineOdds["books"]> = {};
        
        Object.entries(line.books || {}).forEach(([bookId, bookData]: [string, any]) => {
          if (bookData.over && (!bestOver || bookData.over.price > bestOver.price)) {
            bestOver = {
              price: bookData.over.price,
              book: bookId,
              mobileLink: bookData.over.m || bookData.over.u || null,
            };
          }
          if (bookData.under && (!bestUnder || bookData.under.price > bestUnder.price)) {
            bestUnder = {
              price: bookData.under.price,
              book: bookId,
              mobileLink: bookData.under.m || bookData.under.u || null,
            };
          }
          if (bookData.over || bookData.under) {
            books[bookId] = {
              over: bookData.over ? {
                price: bookData.over.price,
                mobileLink: bookData.over.m || bookData.over.u || null,
                url: bookData.over.u || bookData.over.m || null,
                sgp: bookData.over.sgp || null,
              } : undefined,
              under: bookData.under ? {
                price: bookData.under.price,
                mobileLink: bookData.under.m || bookData.under.u || null,
                url: bookData.under.u || bookData.under.m || null,
                sgp: bookData.under.sgp || null,
              } : undefined,
            };
          }
        });
        
        return { ln: isMlb ? normalizeMlbOddsLine(line.ln) ?? line.ln : line.ln, over: bestOver, under: bestUnder, books };
      }) as AlternateLineOdds[];
    },
    enabled: open && !!event_id && !!playerKey,
    staleTime: 30_000, // 30 seconds - odds can change
    gcTime: 5 * 60_000, // 5 minutes
  });
  const alternateLines = alternatesData || [];

  // Line state - initialize with initial_line if provided (e.g., from edge finder)
  const [customLine, setCustomLine] = useState<number | null>(() => isMlb ? normalizeMlbOddsLine(initial_line) : initial_line ?? null);
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [editValue, setEditValue] = useState("");
  
  // Market dropdown state
  const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState(false);
  const marketDropdownRef = useRef<HTMLDivElement>(null);

  // Close market dropdown when clicking outside
  useEffect(() => {
    if (!isMarketDropdownOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(e.target as Node)) {
        setIsMarketDropdownOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMarketDropdownOpen]);

  // Reset customLine on every modal open so the caller's initial_line always wins
  // over the user's last manual selection from a previous session.
  useEffect(() => {
    if (!open) return;
    if (initial_line !== undefined && initial_line !== null) {
      setCustomLine(isMlb ? normalizeMlbOddsLine(initial_line) : initial_line);
    } else {
      setCustomLine(null);
    }
  }, [open, initial_line, isMlb]);

  const externalOddsMarket = initial_market || availableMarkets[0] || null;
  const canUseExternalOdds = !isMlb || !externalOddsMarket || currentMarket === externalOddsMarket;
  
  const defaultLine = useMemo(() => {
    // Priority: profile line -> odds line -> calculated from box scores
    let rawLine: number;
    if (currentMarketProfile?.line) rawLine = currentMarketProfile.line;
    else if (canUseExternalOdds && odds?.over?.line) rawLine = odds.over.line;
    else if (canUseExternalOdds && odds?.under?.line) rawLine = odds.under.line;
    else if (alternateLines.length > 0) {
      const deepestLine = [...alternateLines].sort((a, b) => {
        const bookDelta = getAlternateLineBookCount(b) - getAlternateLineBookCount(a);
        if (bookDelta !== 0) return bookDelta;
        return a.ln - b.ln;
      })[0];
      rawLine = deepestLine?.ln ?? (modalGames.length === 0 ? (isMlb ? 1 : 10) : 1);
    } else if (modalGames.length === 0) {
      rawLine = isMlb ? 1 : 10;
    } else {
      const recentGames = modalGames.slice(0, 10);
      const avg = recentGames.reduce((sum, g) => sum + getMarketStat(g, currentMarket), 0) / recentGames.length;
      rawLine = Math.round(avg * 2) / 2;
    }

    return isMlb ? normalizeMlbOddsLine(rawLine) ?? rawLine : rawLine;
  }, [currentMarketProfile, canUseExternalOdds, odds, alternateLines, modalGames, currentMarket, isMlb]);

	  const activeLine = useMemo(() => {
	    const rawLine = customLine ?? defaultLine;
	    return isMlb ? normalizeMlbOddsLine(rawLine) ?? rawLine : rawLine;
	  }, [customLine, defaultLine, isMlb]);
  const handleLineChange = useCallback((line: number) => {
    setCustomLine(isMlb ? normalizeMlbOddsLine(line) ?? line : line);
  }, [isMlb]);
  const handleLineReset = useCallback(() => setCustomLine(null), []);

  // Chart state for the v2 HitRateChart embedded in the gamelog tab.
  // The modal is a quick-view, so we keep the advanced filtering surface
  // (teammate filters, quick-filter chips, metric overlays, DvP/pace
  // overlays) collapsed and only thread the split + range the chart
  // needs to render.
  const [chartSplit, setChartSplit] = useState<ChartSplit>("all");
  const [chartRange, setChartRange] = useState<ChartRange>("l20");
  const isCustomLineActive = customLine !== null && Math.abs(customLine - defaultLine) > 1e-6;

  // Box-score season selector. WNBA defaults to the current calendar year
  // so opening the modal in May 2026 lands on the active season; users
  // can pop back to prior years from the chip row above the table.
  const todayYear = new Date().getUTCFullYear();
  const todayMonth = new Date().getUTCMonth() + 1;
  const defaultBoxScoreSeason = isWnba
    ? String(todayYear)
    : todayMonth >= 8
      ? `${todayYear}-${String((todayYear + 1) % 100).padStart(2, "0")}`
      : `${todayYear - 1}-${String(todayYear % 100).padStart(2, "0")}`;
  const [boxScoreSeason, setBoxScoreSeason] = useState<string>(defaultBoxScoreSeason);
  // Available seasons — current + previous only. The RPC only carries the
  // last ~1 season of box-score history, so older chips returned empty
  // tables and confused users.
  const boxScoreSeasonOptions = useMemo(() => {
    if (isMlb) return [];
    if (isWnba) {
      return [String(todayYear), String(todayYear - 1)];
    }
    const startYear = todayMonth >= 8 ? todayYear : todayYear - 1;
    return [
      `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
      `${startYear - 1}-${String(startYear % 100).padStart(2, "0")}`,
    ];
  }, [isMlb, isWnba, todayYear, todayMonth]);
	  const activeHitRateOdds = getHitRateOdds(currentMarketProfile?.selKey || currentMarketProfile?.oddsSelectionId || null);
  const activeHitRateLine = useMemo(() => {
    if (!activeHitRateOdds?.allLines?.length) return null;
    const getLineValue = (line: number) => isMlb ? normalizeMlbOddsLine(line) ?? line : line;
    const exact = activeHitRateOdds.allLines.find((line) => Math.abs(getLineValue(line.line) - activeLine) < 0.01);
    if (exact) return exact;
    const sorted = [...activeHitRateOdds.allLines].sort((a, b) => Math.abs(getLineValue(a.line) - activeLine) - Math.abs(getLineValue(b.line) - activeLine));
    return sorted[0] && Math.abs(getLineValue(sorted[0].line) - activeLine) <= 1.5 ? sorted[0] : null;
  }, [activeHitRateOdds, activeLine, isMlb]);
  const activeAlternateLine = useMemo(() => {
    if (alternateLines.length === 0) return null;
    const exact = alternateLines.find((line) => Math.abs(line.ln - activeLine) < 0.01);
    if (exact) return exact;
    const closest = [...alternateLines].sort((a, b) => Math.abs(a.ln - activeLine) - Math.abs(b.ln - activeLine))[0];
    return closest && Math.abs(closest.ln - activeLine) <= 1.5 ? closest : null;
  }, [activeLine, alternateLines]);
  const mlbLiveOddsGameId = useMemo(() => {
    if (!isMlb) return null;
    return toPositiveMlbGameId(gameContext?.gameId ?? currentMarketProfile?.gameId ?? profile?.gameId);
  }, [currentMarketProfile?.gameId, gameContext?.gameId, isMlb, profile?.gameId]);
  const mlbLiveOddsMarket = isMlb ? getMlbLineHistoryMarket(currentMarket) : currentMarket;
  const mlbLiveOddsPlayerName = player_name || currentMarketProfile?.playerName || profile?.playerName || "";
  const { odds: fetchedMlbOverOdds } = useMlbBatterOdds(
    open && isMlb ? mlbLiveOddsGameId : null,
    mlbLiveOddsMarket,
    activeLine,
    "over"
  );
  const { odds: fetchedMlbUnderOdds } = useMlbBatterOdds(
    open && isMlb ? mlbLiveOddsGameId : null,
    mlbLiveOddsMarket,
    activeLine,
    "under"
  );
  const fetchedMlbOverEntry = useMemo(
    () => findMlbPlayerOddsEntry(fetchedMlbOverOdds, mlbLiveOddsPlayerName),
    [fetchedMlbOverOdds, mlbLiveOddsPlayerName]
  );
  const fetchedMlbUnderEntry = useMemo(
    () => findMlbPlayerOddsEntry(fetchedMlbUnderOdds, mlbLiveOddsPlayerName),
    [fetchedMlbUnderOdds, mlbLiveOddsPlayerName]
  );

  // Compute odds for the current line (from alternates or original odds)
  // Always look up in alternates first since market may have changed
  const activeOdds = useMemo(() => {
    if (activeAlternateLine) {
      return {
        over: activeAlternateLine.over ? {
          price: activeAlternateLine.over.price,
          line: activeAlternateLine.ln,
          book: activeAlternateLine.over.book,
          mobileLink: activeAlternateLine.over.mobileLink,
        } : undefined,
        under: activeAlternateLine.under ? {
          price: activeAlternateLine.under.price,
          line: activeAlternateLine.ln,
          book: activeAlternateLine.under.book,
          mobileLink: activeAlternateLine.under.mobileLink,
        } : undefined,
      };
    }

    if (activeHitRateLine) {
      const hitRateLine = isMlb ? normalizeMlbOddsLine(activeHitRateLine.line) ?? activeHitRateLine.line : activeHitRateLine.line;
      return {
        over: activeHitRateLine.bestOver ? {
          price: activeHitRateLine.bestOver.price,
          line: hitRateLine,
          book: activeHitRateLine.bestOver.book,
          mobileLink: activeHitRateLine.bestOver.mobileUrl || activeHitRateLine.bestOver.url,
        } : undefined,
        under: activeHitRateLine.bestUnder ? {
          price: activeHitRateLine.bestUnder.price,
          line: hitRateLine,
          book: activeHitRateLine.bestUnder.book,
          mobileLink: activeHitRateLine.bestUnder.mobileUrl || activeHitRateLine.bestUnder.url,
        } : undefined,
      };
    }

    if (isMlb && (fetchedMlbOverEntry || fetchedMlbUnderEntry)) {
      return {
        over: fetchedMlbOverEntry ? {
          price: fetchedMlbOverEntry.best_price,
          line: normalizeMlbOddsLine(fetchedMlbOverEntry.line) ?? activeLine,
          book: fetchedMlbOverEntry.best_book,
          mobileLink: fetchedMlbOverEntry.best_mobile_link ?? fetchedMlbOverEntry.best_link,
        } : undefined,
        under: fetchedMlbUnderEntry ? {
          price: fetchedMlbUnderEntry.best_price,
          line: normalizeMlbOddsLine(fetchedMlbUnderEntry.line) ?? activeLine,
          book: fetchedMlbUnderEntry.best_book,
          mobileLink: fetchedMlbUnderEntry.best_mobile_link ?? fetchedMlbUnderEntry.best_link,
        } : undefined,
      };
    }
    
    // Fall back to original odds ONLY if we haven't changed markets
    // (i.e., customLine is null and odds line matches defaultLine)
    if (customLine === null && odds && canUseExternalOdds) {
      const oddsLine = odds.over?.line ?? odds.under?.line;
      const normalizedOddsLine = isMlb ? normalizeMlbOddsLine(oddsLine) : oddsLine ?? null;
      if (normalizedOddsLine === defaultLine) {
        return odds;
      }
    }
    
    // No odds available for this market/line
    return null;
  }, [activeAlternateLine, activeHitRateLine, activeLine, canUseExternalOdds, customLine, defaultLine, fetchedMlbOverEntry, fetchedMlbUnderEntry, isMlb, odds]);

  const bookOffers = useMemo<MlbBookOffer[]>(() => {
    const callerOffers: MlbBookOffer[] = canUseExternalOdds ? (liveBookOffers ?? [])
      .filter((offer) => offer.book && Number.isFinite(offer.price))
      .map((offer) => ({
        side: offer.side,
        book: offer.book,
        price: offer.price,
        line: isMlb ? normalizeMlbOddsLine(offer.line ?? activeLine) ?? activeLine : offer.line ?? activeLine,
        url: offer.url ?? null,
        mobileUrl: offer.mobileUrl ?? offer.mobileLink ?? null,
        isBest: false,
        evPercent: offer.evPercent ?? null,
        isSharpRef: Boolean(offer.isSharpRef),
        sgp: offer.sgp ?? null,
        oddId: offer.oddId ?? offer.odd_id ?? null,
      })) : [];

    const mergeOffers = (base: MlbBookOffer[], supplemental: MlbBookOffer[]) => {
      const byKey = new Map<string, MlbBookOffer>();
      [...base, ...supplemental].forEach((offer) => {
        const key = `${offer.side}:${offer.book}:${offer.line}`;
        const existing = byKey.get(key);
        byKey.set(key, {
          ...(existing ?? {}),
          ...offer,
          evPercent: offer.evPercent ?? existing?.evPercent ?? null,
          isSharpRef: offer.isSharpRef || existing?.isSharpRef || false,
          url: offer.url ?? existing?.url ?? null,
          mobileUrl: offer.mobileUrl ?? existing?.mobileUrl ?? null,
          sgp: offer.sgp ?? existing?.sgp ?? null,
          oddId: offer.oddId ?? existing?.oddId ?? null,
        });
      });
      const merged = Array.from(byKey.values());
      const bestBySide = new Map<"over" | "under", number>();
      for (const side of ["over", "under"] as const) {
        const sideDecimals = merged
          .filter((offer) => offer.side === side)
          .map((offer) => americanToDecimal(offer.price) ?? 0);
        const bestDecimal = sideDecimals.length > 0 ? Math.max(...sideDecimals) : 0;
        if (Number.isFinite(bestDecimal) && bestDecimal > 0) {
          bestBySide.set(side, bestDecimal);
        }
      }
      return merged
        .map((offer) => ({
          ...offer,
          isBest: (americanToDecimal(offer.price) ?? 0) === bestBySide.get(offer.side),
        }))
        .sort((a, b) => {
          if (a.isBest !== b.isBest) return a.isBest ? -1 : 1;
          if (a.side !== b.side) return a.side === "over" ? -1 : 1;
          return (americanToDecimal(b.price) ?? 0) - (americanToDecimal(a.price) ?? 0);
        });
    };

    const buildFetchedMlbOffers = (
      entry: BatterOddsEntry | null,
      side: "over" | "under"
    ): MlbBookOffer[] => {
      if (!entry) return [];
      const line = normalizeMlbOddsLine(entry.line) ?? activeLine;
      const sourceBooks = entry.all_books?.length
        ? entry.all_books
        : [{
            book: entry.best_book,
            price: entry.best_price,
            link: entry.best_link,
            mobile_link: entry.best_mobile_link,
            line,
            sgp: null,
            odd_id: null,
          }];

      return sourceBooks
        .filter((book) => book.book && Number.isFinite(book.price))
        .map((book) => ({
          side,
          book: book.book,
          price: book.price,
          line: normalizeMlbOddsLine(book.line ?? line) ?? line,
          url: book.link ?? null,
          mobileUrl: book.mobile_link ?? null,
          isBest: false,
          evPercent: entry.ev_pct ?? null,
          isSharpRef: entry.sharp_book ? parseMlbBookKey(book.book) === parseMlbBookKey(entry.sharp_book) : false,
          sgp: book.sgp ?? null,
          oddId: book.odd_id ?? null,
        }));
    };

    const fetchedMlbOffers = [
      ...buildFetchedMlbOffers(fetchedMlbOverEntry, "over"),
      ...buildFetchedMlbOffers(fetchedMlbUnderEntry, "under"),
    ];

    const alternateOffers: MlbBookOffer[] = [];
    if (activeAlternateLine?.books) {
      Object.entries(activeAlternateLine.books).forEach(([book, sides]) => {
        if (sides.over && Number.isFinite(sides.over.price)) {
          alternateOffers.push({
            side: "over",
            book,
            price: sides.over.price,
            line: activeAlternateLine.ln,
            url: sides.over.url ?? null,
            mobileUrl: sides.over.mobileLink ?? null,
            isBest: false,
            evPercent: null,
            isSharpRef: false,
            sgp: sides.over.sgp ?? null,
            oddId: null,
          });
        }
        if (sides.under && Number.isFinite(sides.under.price)) {
          alternateOffers.push({
            side: "under",
            book,
            price: sides.under.price,
            line: activeAlternateLine.ln,
            url: sides.under.url ?? null,
            mobileUrl: sides.under.mobileLink ?? null,
            isBest: false,
            evPercent: null,
            isSharpRef: false,
            sgp: sides.under.sgp ?? null,
            oddId: null,
          });
        }
      });
    }

    if (!activeHitRateLine?.books) {
      const fallback: MlbBookOffer[] = [];
	      if (activeOdds?.over?.book && activeOdds.over.price != null) {
	        fallback.push({
	          side: "over",
	          book: activeOdds.over.book,
	          price: activeOdds.over.price,
	          line: isMlb ? normalizeMlbOddsLine(activeOdds.over.line) ?? activeLine : activeOdds.over.line,
          url: null,
          mobileUrl: activeOdds.over.mobileLink ?? null,
          isBest: true,
          evPercent: null,
          isSharpRef: false,
          sgp: null,
          oddId: null,
        });
      }
	      if (activeOdds?.under?.book && activeOdds.under.price != null) {
	        fallback.push({
	          side: "under",
	          book: activeOdds.under.book,
	          price: activeOdds.under.price,
	          line: isMlb ? normalizeMlbOddsLine(activeOdds.under.line) ?? activeLine : activeOdds.under.line,
          url: null,
          mobileUrl: activeOdds.under.mobileLink ?? null,
          isBest: true,
          evPercent: null,
          isSharpRef: false,
          sgp: null,
          oddId: null,
        });
      }
      return mergeOffers(callerOffers, [...fetchedMlbOffers, ...alternateOffers, ...fallback]);
    }

    const offers: MlbBookOffer[] = [];
    const hitRateLine = isMlb ? normalizeMlbOddsLine(activeHitRateLine.line) ?? activeHitRateLine.line : activeHitRateLine.line;
    Object.entries(activeHitRateLine.books).forEach(([book, sides]) => {
      if (sides.over) {
        offers.push({
          side: "over",
          book,
          price: sides.over.price,
          line: hitRateLine,
          url: sides.over.url,
          mobileUrl: sides.over.mobileUrl,
          isBest: false,
          evPercent: null,
          isSharpRef: false,
          sgp: sides.over.sgp ?? null,
          oddId: null,
        });
      }
      if (sides.under) {
        offers.push({
          side: "under",
          book,
          price: sides.under.price,
          line: hitRateLine,
	          url: sides.under.url,
	          mobileUrl: sides.under.mobileUrl,
          isBest: false,
          evPercent: null,
          isSharpRef: false,
          sgp: sides.under.sgp ?? null,
          oddId: null,
        });
      }
    });

	    return mergeOffers(callerOffers, [...fetchedMlbOffers, ...alternateOffers, ...offers]);
	  }, [activeAlternateLine, activeHitRateLine, activeOdds, activeLine, canUseExternalOdds, fetchedMlbOverEntry, fetchedMlbUnderEntry, isMlb, liveBookOffers]);

	  const rightRailLineOptions = useMemo(() => {
	    const lines = new Set<number>();
	    const addLine = (line?: number | null) => {
	      if (typeof line === "number" && Number.isFinite(line)) {
	        const normalized = isMlb ? normalizeMlbOddsLine(line) : Math.round(line * 10) / 10;
	        if (normalized !== null) lines.add(normalized);
	      }
	    };

    addLine(activeLine);
    addLine(defaultLine);
    addLine(profile?.line ?? null);
    addLine(activeOdds?.over?.line ?? null);
    addLine(activeOdds?.under?.line ?? null);
    alternateLines.forEach((line) => addLine(line.ln));
    activeHitRateOdds?.allLines?.forEach((line) => addLine(line.line));
    bookOffers.forEach((offer) => addLine(offer.line));
    if (isMlb) {
      getMlbMarketLineLadder(currentMarket, activeLine).forEach(addLine);
    }

    return Array.from(lines).sort((a, b) => a - b);
  }, [activeHitRateOdds, activeLine, activeOdds, alternateLines, bookOffers, currentMarket, defaultLine, isMlb, profile?.line]);

  // Transform activeOdds into GameLogChart format
  const oddsForChart = useMemo(() => {
    if (!activeOdds) return null;

    return {
      bestOver: activeOdds.over ? {
        book: activeOdds.over.book || 'unknown',
        price: activeOdds.over.price,
        url: activeOdds.over.mobileLink || null,
        mobileUrl: activeOdds.over.mobileLink || null,
      } : null,
      bestUnder: activeOdds.under ? {
        book: activeOdds.under.book || 'unknown',
        price: activeOdds.under.price,
        url: activeOdds.under.mobileLink || null,
        mobileUrl: activeOdds.under.mobileLink || null,
      } : null,
	      oddsLine: isMlb ? normalizeMlbOddsLine(activeOdds.over?.line || activeOdds.under?.line || activeLine) ?? activeLine : activeOdds.over?.line || activeOdds.under?.line || activeLine,
	      isClosestLine: false,
	    };
	  }, [activeOdds, activeLine, isMlb]);

  // Game count filter
  const [gameCount, setGameCount] = useState<GameCountFilter>(10);
  const [mlbHomeAwayFilter, setMlbHomeAwayFilter] = useState<MlbHomeAwayFilter>("all");
  const [mlbDayNightFilter, setMlbDayNightFilter] = useState<MlbDayNightFilter>("all");
  
  // Active tab for modal navigation
  const [activeTab, setActiveTab] = useState<ModalTab>("gamelog");

  // Get profile data for advanced tabs
  const profilePlayerId = profile?.playerId || resolvedPlayerId;
  const profilePosition = profile?.position || "";
  const profileOpponentTeamId = profile?.opponentTeamId || null;
  const profileOpponentTeamAbbr = profile?.opponentTeamAbbr || "";
  const profilePlayerName = profile?.playerName || player_name || "";
  const isMlbPitcher = isMlb && (isMlbPitcherProfile || isMlbPitcherMarketKey(currentMarket) || profilePosition === "P");

  useEffect(() => {
    if (isMlb && (activeTab === "correlation" || activeTab === "matchup")) {
      setActiveTab("gamelog");
    }
    if (isWnba && activeTab === "correlation") {
      setActiveTab("gamelog");
    }
  }, [activeTab, isMlb, isWnba]);

  // Reset modal-local state when the user switches markets *within* the modal.
  // Skip the initial mount — otherwise it would wipe customLine that was just
  // initialized from `initial_line`.
  const lastResetMarketRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastResetMarketRef.current === null) {
      lastResetMarketRef.current = selectedMarket;
      return;
    }
    if (lastResetMarketRef.current === selectedMarket) return;
    lastResetMarketRef.current = selectedMarket;
    setCustomLine(null);
    setIsEditingLine(false);
    setLineHistorySide("over");
    setGameCount(10);
    setMlbHomeAwayFilter("all");
    setMlbDayNightFilter("all");
  }, [selectedMarket]);

  // Sort games by date descending
  const sortedGames = useMemo(() => {
    return [...modalGames].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [modalGames]);

  const mlbSeasonGames = useMemo(() => {
    if (!isMlb) return [];
    const seasonYear = mlbLogSeason ?? new Date().getFullYear();
    return sortedGames.filter((game) => getMlbSeasonFromDate(game.date) === seasonYear);
  }, [isMlb, mlbLogSeason, sortedGames]);

  const chartBaseGames = isMlb ? mlbSeasonGames : sortedGames;

  const locationFilteredGames = useMemo(() => {
    if (!isMlb || mlbHomeAwayFilter === "all") return chartBaseGames;
    return chartBaseGames.filter((game) => game.homeAway === mlbHomeAwayFilter);
  }, [chartBaseGames, isMlb, mlbHomeAwayFilter]);

  const hasDayNightData = useMemo(() => {
    return chartBaseGames.some((game) => game.mlbDayNight === "D" || game.mlbDayNight === "N");
  }, [chartBaseGames]);

  const contextFilteredGames = useMemo(() => {
    if (!isMlb || mlbDayNightFilter === "all") return locationFilteredGames;
    return locationFilteredGames.filter((game) => game.mlbDayNight === mlbDayNightFilter);
  }, [isMlb, locationFilteredGames, mlbDayNightFilter]);

  // Filtered games based on count
  const filteredGames = useMemo(() => {
    if (gameCount === "season") return contextFilteredGames;
    if (gameCount === "h2h") {
      if (profile?.opponentTeamAbbr) {
        return contextFilteredGames.filter(g => g.opponentAbbr === profile.opponentTeamAbbr);
      }
      return []; // No H2H data without opponent
    }
    return contextFilteredGames.slice(0, gameCount as number);
  }, [contextFilteredGames, gameCount, profile?.opponentTeamAbbr]);

  // Calculate hit rates
  const dynamicHitRates = useMemo(() => {
    if (chartBaseGames.length === 0) return { l5: null, l10: null, l20: null, season: null, h2h: null };

    const calculateHitRate = (games: BoxScoreGame[]) => {
      if (games.length === 0) return null;
      const stats = games.map(g => getMarketStat(g, currentMarket));
      const hits = stats.filter(s => s >= activeLine).length;
      return Math.round((hits / stats.length) * 100);
    };

    // H2H games against current opponent
    const h2hGames = profile?.opponentTeamAbbr
      ? chartBaseGames.filter(g => g.opponentAbbr === profile.opponentTeamAbbr)
      : [];

    return {
      l5: calculateHitRate(chartBaseGames.slice(0, 5)),
      l10: calculateHitRate(chartBaseGames.slice(0, 10)),
      l20: calculateHitRate(chartBaseGames.slice(0, 20)),
      season: calculateHitRate(chartBaseGames),
      h2h: calculateHitRate(h2hGames),
    };
  }, [chartBaseGames, activeLine, currentMarket, profile?.opponentTeamAbbr]);

  // Sample counts mirror what dynamicHitRates filtered against — the v2 chart's
  // segments need both pct + sample for the X/Y readout in each header chip.
  // SZN scopes to the current season so the % matches the bars the chart
  // renders when the user picks the SZN range button.
  const chartHitRateSegments: ChartHitRateSegment[] = useMemo(() => {
    const h2hSample = profile?.opponentTeamAbbr
      ? chartBaseGames.filter((g) => g.opponentAbbr === profile.opponentTeamAbbr).length
      : 0;

    // SZN locks onto the *current* real-world season so the chip stays in
    // sync with the chart's SZN button. WNBA uses today's calendar year;
    // NBA uses today's season (Aug-Dec → year, Jan-Jul → year-1).
    const today = new Date();
    const todayYear = today.getUTCFullYear();
    const todayMonth = today.getUTCMonth() + 1;
    const seasonStartYear = isWnba
      ? todayYear
      : todayMonth >= 8
        ? todayYear
        : todayYear - 1;
    const seasonGames = chartBaseGames.filter((g) => {
      const y = parseInt((g.date ?? "").slice(0, 4), 10);
      const m = parseInt((g.date ?? "").slice(5, 7), 10);
      if (!Number.isFinite(y) || !Number.isFinite(m)) return false;
      if (isWnba) return y === seasonStartYear;
      return (m >= 8 ? y : y - 1) === seasonStartYear;
    });
    const seasonStats = seasonGames.map((g) => getMarketStat(g, currentMarket));
    const seasonHits = seasonStats.filter((s) => s >= activeLine).length;
    const seasonPct = seasonStats.length > 0
      ? Math.round((seasonHits / seasonStats.length) * 100)
      : null;

    return [
      { range: "l5", label: "L5", pct: dynamicHitRates.l5, sample: Math.min(5, chartBaseGames.length) },
      { range: "l10", label: "L10", pct: dynamicHitRates.l10, sample: Math.min(10, chartBaseGames.length) },
      { range: "l20", label: "L20", pct: dynamicHitRates.l20, sample: Math.min(20, chartBaseGames.length) },
      { range: "szn", label: "SZN", pct: seasonPct, sample: seasonGames.length },
      { range: "h2h", label: "H2H", pct: dynamicHitRates.h2h, sample: h2hSample },
    ];
  }, [dynamicHitRates, chartBaseGames, profile?.opponentTeamAbbr, isWnba, currentMarket, activeLine]);

  // Chart stats
  const chartStats = useMemo(() => {
    if (filteredGames.length === 0) return { avg: null, hitRate: null, hits: 0, total: 0 };
    const stats = filteredGames.map(g => getMarketStat(g, currentMarket));
    const avg = stats.reduce((a, b) => a + b, 0) / stats.length;
    const hits = stats.filter(s => s >= activeLine).length;
    return {
      avg: Math.round(avg * 10) / 10,
      hitRate: Math.round((hits / stats.length) * 100),
      hits,
      total: stats.length,
    };
  }, [filteredGames, currentMarket, activeLine]);

  const mlbSeasonSummary = useMemo(() => {
    if (!isMlb || mlbSeasonGames.length === 0) return null;
    const games = mlbSeasonGames;
    const n = games.length;

    if (isMlbPitcher) {
      const totals = games.reduce(
        (acc, game) => ({
          strikeouts: acc.strikeouts + (game.mlbPitcherStrikeouts ?? 0),
          innings: acc.innings + (game.mlbInningsPitched ?? 0),
          earnedRuns: acc.earnedRuns + (game.mlbEarnedRuns ?? 0),
          hitsAllowed: acc.hitsAllowed + (game.mlbHitsAllowed ?? 0),
          walks: acc.walks + (game.mlbWalks ?? 0),
        }),
        { strikeouts: 0, innings: 0, earnedRuns: 0, hitsAllowed: 0, walks: 0 }
      );
      const era = totals.innings > 0 ? (totals.earnedRuns * 9) / totals.innings : null;
      const whip = totals.innings > 0 ? (totals.hitsAllowed + totals.walks) / totals.innings : null;

      return {
        label: `${mlbLogSeason ?? new Date().getFullYear()} Season Averages`,
        stats: [
          { label: "K/G", value: formatMlbHeaderDecimal(totals.strikeouts / n), highlight: true },
          { label: "IP/G", value: formatMlbHeaderDecimal(totals.innings / n) },
          { label: "ERA", value: formatMlbHeaderDecimal(era, 2) },
          { label: "WHIP", value: formatMlbHeaderDecimal(whip, 2) },
        ],
      };
    }

    const totals = games.reduce(
      (acc, game) => ({
        hits: acc.hits + (game.mlbHits ?? 0),
        totalBases: acc.totalBases + (game.mlbTotalBases ?? 0),
        homeRuns: acc.homeRuns + (game.mlbHomeRuns ?? 0),
        rbi: acc.rbi + (game.mlbRbi ?? 0),
        atBats: acc.atBats + (game.mlbAtBats ?? 0),
        plateAppearances: acc.plateAppearances + (game.mlbPlateAppearances ?? 0),
        walks: acc.walks + (game.mlbWalks ?? 0),
      }),
      { hits: 0, totalBases: 0, homeRuns: 0, rbi: 0, atBats: 0, plateAppearances: 0, walks: 0 }
    );
    const avg = totals.atBats > 0 ? totals.hits / totals.atBats : null;
    const obp = totals.plateAppearances > 0 ? (totals.hits + totals.walks) / totals.plateAppearances : null;
    const slg = totals.atBats > 0 ? totals.totalBases / totals.atBats : null;
    const ops = obp !== null && slg !== null ? obp + slg : null;

    return {
      label: `${mlbLogSeason ?? new Date().getFullYear()} Season Averages`,
      stats: [
        { label: "AVG", value: formatMlbHeaderRate(avg), sub: `${n} games`, highlight: true },
        { label: "HR", value: `${totals.homeRuns}`, sub: "Total" },
        { label: "RBI", value: `${totals.rbi}`, sub: "Total" },
        { label: "OPS", value: formatMlbHeaderRate(ops), sub: "Season" },
      ],
      modalStats: [
        { label: "H/G", value: formatMlbHeaderDecimal(totals.hits / n), highlight: true },
        { label: "TB/G", value: formatMlbHeaderDecimal(totals.totalBases / n) },
        { label: "AVG", value: formatMlbHeaderRate(avg) },
        { label: "OBP", value: formatMlbHeaderRate(obp) },
      ],
    };
  }, [isMlb, isMlbPitcher, mlbLogSeason, mlbSeasonGames]);

  const headerSeasonSummary = useMemo(() => {
    if (isMlb) return mlbSeasonSummary;
    const fmt = (v: number | null | undefined) =>
      typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) : "—";

    // Compute averages from the *current* real-world season's games so the
    // strip stays in sync with the SZN range button (WNBA → today's year,
    // NBA → today's season). Falls back to the RPC summary when there are
    // no games in the current season yet (e.g. preseason).
    if (boxScoreGames.length > 0) {
      const today = new Date();
      const todayYear = today.getUTCFullYear();
      const todayMonth = today.getUTCMonth() + 1;
      const latestSeasonStartYear = isWnba
        ? todayYear
        : todayMonth >= 8
          ? todayYear
          : todayYear - 1;
      const inSeason = boxScoreGames.filter((g) => {
        const y = parseInt((g.date ?? "").slice(0, 4), 10);
        const m = parseInt((g.date ?? "").slice(5, 7), 10);
        if (!Number.isFinite(y) || !Number.isFinite(m)) return false;
        if (isWnba) return y === latestSeasonStartYear;
        const startYear = m >= 8 ? y : y - 1;
        return startYear === latestSeasonStartYear;
      });
      if (inSeason.length > 0) {
        const sum = inSeason.reduce(
          (acc, g) => ({
            pts: acc.pts + (g.pts ?? 0),
            reb: acc.reb + (g.reb ?? 0),
            ast: acc.ast + (g.ast ?? 0),
            fgm: acc.fgm + (g.fgm ?? 0),
            fga: acc.fga + (g.fga ?? 0),
          }),
          { pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0 },
        );
        const n = inSeason.length;
        const fgPct = sum.fga > 0 ? (sum.fgm / sum.fga) * 100 : null;
        // WNBA seasons are single calendar years (label "2026"); NBA spans
        // two ("25/26").
        const seasonLabel = isWnba
          ? `${latestSeasonStartYear} Season`
          : `${String(latestSeasonStartYear).slice(-2)}/${String(latestSeasonStartYear + 1).slice(-2)} Season`;
        return {
          label: seasonLabel,
          stats: [
            { label: "PTS", value: fmt(sum.pts / n), highlight: true },
            { label: "REB", value: fmt(sum.reb / n) },
            { label: "AST", value: fmt(sum.ast / n) },
            { label: "FG%", value: fgPct !== null ? fgPct.toFixed(1) : "—" },
          ],
        };
      }
    }

    if (!seasonSummary) return null;
    return {
      label: "Season Averages",
      stats: [
        { label: "PTS", value: fmt(seasonSummary.avgPoints), highlight: true },
        { label: "REB", value: fmt(seasonSummary.avgRebounds) },
        { label: "AST", value: fmt(seasonSummary.avgAssists) },
        { label: "FG%", value: fmt(seasonSummary.fgPct) },
      ],
    };
  }, [isMlb, isWnba, mlbSeasonSummary, seasonSummary, boxScoreGames]);

  // Only wait for lookup if we don't have a direct ID
  const isLoading = (needsLookup && isLoadingLookup) || isLoadingProfiles || (isMlb ? isLoadingMlbLogs && modalGames.length === 0 : isLoadingBoxScores);
  // hasData is true if:
  // - We have a direct nba_player_id with profile or box scores, OR
  // - We looked up and found the player with profile or box scores
  const hasData = isMlb
    ? (!!resolvedPlayerId || profiles.length > 0) && (hasUpcomingProfile || mlbGames.length > 0)
    : (directNbaPlayerId || lookupData?.found) && (hasUpcomingProfile || boxScoreGames.length > 0);

  // Display info - prefer profile data, then lookup data, then passed props
  const displayName = profile?.playerName || playerInfo?.name || player_name || "Unknown Player";
  const displayPosition = profile?.position || playerInfo?.depth_chart_pos || playerInfo?.position || "";
  const displayJersey = profile?.jerseyNumber || playerInfo?.jersey_number;
  const teamLogoSport = isMlb ? "mlb" : isWnba ? "wnba" : "nba";
  const fullProfilePlayerId = profile?.playerId || resolvedPlayerId;
  const fullProfileHref = fullHitRateHref;
  const { games: mlbScheduleGames } = useMlbGames(isMlb && open);
  const nextGame = useMemo<QuickViewGameContext | null>(() => {
    if (gameContext?.gameDate && gameContext.opponentTeamAbbr) {
      return {
        gameId: gameContext.gameId ?? null,
        gameDate: gameContext.gameDate,
        gameDatetime: gameContext.gameDatetime ?? null,
        gameStatus: gameContext.gameStatus ?? null,
        homeAway: gameContext.homeAway ?? null,
        opponentTeamAbbr: gameContext.opponentTeamAbbr,
        opposingPitcherName: gameContext.opposingPitcherName ?? null,
        opposingPitcherId: gameContext.opposingPitcherId ?? null,
      };
    }

    if (!profile?.gameDate) return null;
    return {
      gameId: profile.gameId ?? null,
      gameDate: profile.gameDate,
      gameDatetime: profile.startTime ?? null,
      gameStatus: profile.gameStatus ?? null,
      homeAway: profile.homeAway === "H" || profile.homeAway === "A" ? profile.homeAway : null,
      opponentTeamAbbr: profile.opponentTeamAbbr ?? null,
      opposingPitcherName: null,
      opposingPitcherId: null,
    };
  }, [gameContext, profile?.gameDate, profile?.gameId, profile?.gameStatus, profile?.homeAway, profile?.opponentTeamAbbr, profile?.startTime]);
  const mlbScheduleGame = useMemo(() => {
    if (!isMlb || !nextGame?.gameId) return null;
    return mlbScheduleGames.find((game) => String(game.game_id) === String(nextGame.gameId)) ?? null;
  }, [isMlb, mlbScheduleGames, nextGame?.gameId]);
  const opposingPitcherId = useMemo(() => {
    const explicit = toPositiveMlbGameId(nextGame?.opposingPitcherId);
    if (explicit) return explicit;
    if (!mlbScheduleGame || !nextGame?.homeAway) return null;
    return nextGame.homeAway === "H"
      ? toPositiveMlbGameId(mlbScheduleGame.away_probable_pitcher_id)
      : toPositiveMlbGameId(mlbScheduleGame.home_probable_pitcher_id);
  }, [mlbScheduleGame, nextGame?.homeAway, nextGame?.opposingPitcherId]);
  const nextGameDetail = nextGame?.opposingPitcherName
    || (opposingPitcherId && mlbScheduleGame
      ? nextGame?.homeAway === "H"
        ? mlbScheduleGame.away_probable_pitcher
        : mlbScheduleGame.home_probable_pitcher
      : null)
    || (isMlb && !isMlbPitcher ? "TBD" : formatQuickViewGameStatus(nextGame?.gameStatus, nextGame?.gameDatetime));

  const derivedPlayerTeam = useMemo(() => {
    if (!mlbScheduleGame || !nextGame?.homeAway) return "";
    return nextGame.homeAway === "H"
      ? mlbScheduleGame.home_team_tricode
      : mlbScheduleGame.away_team_tricode;
  }, [mlbScheduleGame, nextGame?.homeAway]);
  const displayTeam = profile?.teamAbbr || playerInfo?.team_abbr || derivedPlayerTeam || "";
  const lineHistoryContext = useMemo<LineHistoryContext | null>(() => {
    const contextEventId = event_id || profile?.eventId;
    const historyMarket = isMlb ? getMlbLineHistoryMarket(currentMarket) : currentMarket;
    const currentLineOffers = bookOffers.filter((offer) => Math.abs(offer.line - activeLine) < 0.01);
    const selectedSideOffers = currentLineOffers.filter((offer) => offer.side === lineHistorySide);
    const candidateOffers = selectedSideOffers.length > 0 ? selectedSideOffers : currentLineOffers;
    const allBookIds = sortLineHistoryBookIds(candidateOffers.map((offer) => offer.book));
    if (!isMlb || !contextEventId || !historyMarket || allBookIds.length === 0) return null;

    return {
      source: "prop_center",
      sport,
      eventId: contextEventId,
      market: historyMarket,
      marketDisplay: formatMarketLabel(currentMarket),
      side: lineHistorySide,
      line: activeLine,
      selectionName: displayName,
      playerName: displayName,
      team: displayTeam || null,
      bestBookId: activeOdds?.[lineHistorySide]?.book || candidateOffers[0]?.book || null,
      compareBookIds: allBookIds,
      allBookIds,
      currentPricesByBook: Object.fromEntries(candidateOffers.map((offer) => [offer.book, offer.price])),
    };
  }, [activeLine, activeOdds, bookOffers, currentMarket, displayName, displayTeam, event_id, isMlb, lineHistorySide, profile?.eventId, sport]);

  const favoriteParams = useMemo<AddFavoriteParams | null>(() => {
    if (!isMlb) return null;
    const contextEventId = event_id || profile?.eventId;
    const favoriteMarket = getMlbLineHistoryMarket(currentMarket);
    const favoritePlayerId = odds_player_id || oddsPlayerIdForLookup || (resolvedPlayerId ? String(resolvedPlayerId) : null);
    const sideOffers = bookOffers
      .filter((offer) => offer.side === lineHistorySide && Math.abs(offer.line - activeLine) < 0.01)
      .sort((a, b) => (americanToDecimal(b.price) ?? 0) - (americanToDecimal(a.price) ?? 0));

    if (!contextEventId || !favoriteMarket || !favoritePlayerId || sideOffers.length === 0) return null;

    const booksSnapshot: Record<string, BookSnapshot> = {};
    for (const offer of sideOffers) {
      const bookId = parseMlbBookKey(offer.book);
      const existing = booksSnapshot[bookId];
      if (existing && (americanToDecimal(existing.price) ?? 0) >= (americanToDecimal(offer.price) ?? 0)) continue;
      booksSnapshot[bookId] = {
        price: offer.price,
        u: offer.url,
        m: offer.mobileUrl,
        sgp: offer.sgp,
        odd_id: offer.oddId,
      };
    }

    const bestOffer = sideOffers[0];
    const homeTeam = nextGame?.homeAway === "H"
      ? displayTeam
      : nextGame?.homeAway === "A"
      ? nextGame.opponentTeamAbbr
      : null;
    const awayTeam = nextGame?.homeAway === "A"
      ? displayTeam
      : nextGame?.homeAway === "H"
      ? nextGame.opponentTeamAbbr
      : null;

    return {
      type: "player",
      sport: "mlb",
      event_id: contextEventId,
      game_date: nextGame?.gameDate || profile?.gameDate || null,
      home_team: homeTeam || null,
      away_team: awayTeam || null,
      start_time: nextGame?.gameDatetime || profile?.startTime || null,
      player_id: favoritePlayerId,
      player_name: displayName,
      player_team: displayTeam || null,
      player_position: displayPosition || null,
      market: favoriteMarket,
      line: activeLine,
      side: lineHistorySide,
      odds_key: `odds:mlb:${contextEventId}:${favoriteMarket}`,
      odds_selection_id: `${contextEventId}:${favoritePlayerId}:${favoriteMarket}:${activeLine}:${lineHistorySide}`,
      books_snapshot: Object.keys(booksSnapshot).length > 0 ? booksSnapshot : null,
      best_price_at_save: bestOffer?.price ?? null,
      best_book_at_save: bestOffer ? parseMlbBookKey(bestOffer.book) : null,
      source: "quick_view_modal",
    };
  }, [
    activeLine,
    bookOffers,
    currentMarket,
    displayName,
    displayPosition,
    displayTeam,
    event_id,
    isMlb,
    lineHistorySide,
    nextGame,
    oddsPlayerIdForLookup,
    odds_player_id,
    profile?.eventId,
    profile?.gameDate,
    profile?.startTime,
    resolvedPlayerId,
  ]);

  const isFavoriteSaved = favoriteParams
    ? isFavorited({
        event_id: favoriteParams.event_id,
        type: "player",
        player_id: favoriteParams.player_id,
        market: favoriteParams.market,
        line: favoriteParams.line,
        side: favoriteParams.side,
      })
    : false;

  const handleToggleFavorite = useCallback(() => {
    if (!isLoggedIn) {
      toast.error("Sign in to save plays");
      return;
    }
    if (!favoriteParams) {
      toast.error("No live odds available for this line yet");
      return;
    }

    const snapshot = favoriteParams.books_snapshot ?? {};
    const label = `${displayName} ${favoriteParams.side} ${favoriteParams.line}+ ${formatMarketLabel(currentMarket)}`;

    toggleFavorite(favoriteParams)
      .then((result) => {
        if (result?.action === "added") {
          toast.success("Saved to My Plays", { description: label, duration: 3000 });

          fetch("/api/v2/favorites/enrich-sgp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sport: "mlb",
              event_id: favoriteParams.event_id,
              odds_key: favoriteParams.odds_key,
              player_id: favoriteParams.player_id,
              market: favoriteParams.market,
              player_name: favoriteParams.player_name,
              line: favoriteParams.line,
              side: favoriteParams.side,
            }),
          })
            .then((response) => {
              if (!response.ok) throw new Error("enrich failed");
              return response.json();
            })
            .then((data) => {
              if (!data.sgp_tokens || Object.keys(data.sgp_tokens).length === 0) return;
              const favorite = result.favorite;
              if (!favorite?.id) return;

              const enriched = { ...snapshot };
              for (const [bookId, token] of Object.entries(data.sgp_tokens)) {
                if (enriched[bookId]) {
                  enriched[bookId] = { ...enriched[bookId], sgp: token as string };
                }
              }

              const enrichedFavorite = { ...favorite, books_snapshot: enriched };
              queryClient.setQueryData<Favorite[]>(
                ["favorites", favorite.user_id],
                (old) => old
                  ? old.map((fav) => (fav?.id === favorite.id ? enrichedFavorite : fav))
                  : old
              );

              import("@/libs/supabase/client").then(({ createClient }) => {
                createClient()
                  .from("user_favorites")
                  .update({ books_snapshot: enriched })
                  .eq("id", favorite.id)
                  .then(() => {
                    queryClient.invalidateQueries({ queryKey: ["favorites", favorite.user_id] });
                  });
              });
            })
            .catch(() => {});
        } else if (result?.action === "removed") {
          toast("Removed from My Plays", { duration: 2000 });
        }
      })
      .catch(() => {
        toast.error("Could not update My Plays");
      });
  }, [currentMarket, displayName, favoriteParams, isLoggedIn, queryClient, toggleFavorite]);

  const {
    data: lineHistoryData,
    isLoading: isLineHistoryLoading,
    error: lineHistoryError,
  } = useQuery<LineHistoryApiResponse, Error>({
    queryKey: [
      "mlb-quick-view-line-history",
      lineHistoryContext?.sport,
      lineHistoryContext?.eventId,
      lineHistoryContext?.market,
      lineHistoryContext?.side,
      lineHistoryContext?.line,
      lineHistoryContext?.allBookIds?.join(","),
    ],
    queryFn: async () => {
      if (!lineHistoryContext) throw new Error("Missing line history context");
      const books = lineHistoryContext.compareBookIds?.length ? lineHistoryContext.compareBookIds : lineHistoryContext.allBookIds || [];
      const response = await fetch("/api/v2/odds/line-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: lineHistoryContext, books }),
      });
      if (response.status === 401) throw new Error("Sign in to view historical line movement.");
      if (response.status === 403) throw new Error("Line movement is available on Sharp and Elite plans.");
      if (!response.ok) throw new Error("Line movement is unavailable for this selection.");
      return response.json();
    },
    enabled: open && !!lineHistoryContext,
    retry: false,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchInterval: open && !!lineHistoryContext ? 30_000 : false,
    refetchOnWindowFocus: false,
  });
  const spraySeason = battedBallFilters.seasonFilter === "all" ? null : Number(battedBallFilters.seasonFilter);
  const spraySeasons = Number.isFinite(spraySeason) && spraySeason ? [spraySeason] : undefined;
  const sprayMinExitVelo = getMlbEvThresholdMph(battedBallFilters.evThreshold);
  const battedBallPlayerType: MlbSprayChartPlayerType = isMlbPitcher ? "pitcher" : "batter";
  const mlbSprayGameId = isMlb
    ? toPositiveMlbGameId(nextGame?.gameId ?? profile?.gameId)
    : null;
  const mlbSprayEventId = isMlb
    ? event_id || profile?.eventId || null
    : null;
  const { data: mlbSprayData, isLoading: isLoadingMlbSpray } = useMlbSprayChart({
    playerId: isMlb ? fullProfilePlayerId ?? null : null,
    playerType: battedBallPlayerType,
    gameId: mlbSprayGameId,
    eventId: mlbSprayEventId,
    seasons: spraySeasons,
    minExitVelo: sprayMinExitVelo,
    enabled: isMlb && !!fullProfilePlayerId,
  });
  const { data: mlbHotZoneData } = useMlbHotZone(
    isMlb && !isMlbPitcher ? fullProfilePlayerId ?? null : null,
    opposingPitcherId,
    open && isMlb && !isMlbPitcher && !!fullProfilePlayerId && !!opposingPitcherId
  );
  const { pitcher: opposingPitcherProfile } = useMlbIndividualMatchup({
    batterId: open && isMlb && !isMlbPitcher ? fullProfilePlayerId ?? null : null,
    pitcherId: open && isMlb && !isMlbPitcher ? opposingPitcherId : null,
    sample: "season",
  });
  const opposingPitcherHand = useMemo(() => {
    if (!opposingPitcherId || !mlbSprayData?.events) return null;
    const match = mlbSprayData.events.find((event) => Number(event.pitcher_id) === Number(opposingPitcherId) && event.pitcher_hand);
    if (!match?.pitcher_hand) return null;
    const upper = String(match.pitcher_hand).toUpperCase();
    return upper === "L" || upper === "R" ? upper : null;
  }, [mlbSprayData?.events, opposingPitcherId]);

  const battedBallPitchTypeOptions = useMemo(() => {
    const eventPitchRows = (mlbSprayData?.events ?? []).filter((event) => Boolean(event.pitch_type));
    const eventPitchTypes = Array.from(
      new Set(
        eventPitchRows
          .map((event) => event.pitch_type)
          .filter((pitchType): pitchType is string => Boolean(pitchType))
      )
    );
    const pitchNameByType = new Map<string, string>();
    const fallbackUsageByPitch = new Map<string, number | null>();
    (mlbHotZoneData?.pitchTypes ?? []).forEach((pitch) => {
      if (!pitch.pitch_type) return;
      pitchNameByType.set(
        pitch.pitch_type,
        pitch.pitch_name || MLB_PITCH_TYPE_LABELS[pitch.pitch_type] || pitch.pitch_type
      );
      fallbackUsageByPitch.set(pitch.pitch_type, normalizePitchUsagePct(pitch.usage_pct));
    });

    const usageByPitch = new Map<string, { label: string; usage: number | null }>();

    // Prefer the pitcher's full arsenal (whole-season pitch mix from individual-matchup).
    // Falls back to hot-zone usage, then BIP-derived counts from spray events.
    const arsenalRows = opposingPitcherProfile?.arsenal ?? [];
    if (arsenalRows.length > 0) {
      arsenalRows.forEach((row) => {
        if (!row.pitch_type) return;
        usageByPitch.set(row.pitch_type, {
          label: row.pitch_name || pitchNameByType.get(row.pitch_type) || MLB_PITCH_TYPE_LABELS[row.pitch_type] || row.pitch_type,
          usage: normalizePitchUsagePct(row.usage_pct),
        });
      });
    } else if (eventPitchTypes.length > 0) {
      const totalWithPitch = eventPitchRows.length;
      eventPitchTypes.forEach((pitchType) => {
        const count = eventPitchRows.filter((event) => event.pitch_type === pitchType).length;
        usageByPitch.set(pitchType, {
          label: pitchNameByType.get(pitchType) ?? MLB_PITCH_TYPE_LABELS[pitchType] ?? pitchType,
          usage: totalWithPitch > 0 ? Math.round((count / totalWithPitch) * 100) : null,
        });
      });
    } else {
      fallbackUsageByPitch.forEach((usage, pitchType) => {
        usageByPitch.set(pitchType, {
          label: pitchNameByType.get(pitchType) ?? MLB_PITCH_TYPE_LABELS[pitchType] ?? pitchType,
          usage,
        });
      });
    }
    const pitchTypes = Array.from(usageByPitch.keys());
    pitchTypes.sort((a, b) => {
      const usageA = usageByPitch.get(a)?.usage ?? null;
      const usageB = usageByPitch.get(b)?.usage ?? null;
      if (usageA !== null || usageB !== null) return (usageB ?? -1) - (usageA ?? -1);
      const labelA = usageByPitch.get(a)?.label ?? MLB_PITCH_TYPE_LABELS[a] ?? a;
      const labelB = usageByPitch.get(b)?.label ?? MLB_PITCH_TYPE_LABELS[b] ?? b;
      return labelA.localeCompare(labelB);
    });

    return [
      { value: "all", label: "All Pitches" },
      ...pitchTypes.map((pitchType) => ({
        value: pitchType,
        label: usageByPitch.get(pitchType)?.label ?? MLB_PITCH_TYPE_LABELS[pitchType] ?? pitchType,
        prefix: pitchType,
        usagePct: usageByPitch.get(pitchType)?.usage ?? null,
      })),
    ];
  }, [mlbHotZoneData?.pitchTypes, mlbSprayData?.events, opposingPitcherProfile?.arsenal]);

  const usingFullPitcherMix = (opposingPitcherProfile?.arsenal?.length ?? 0) > 0;
  useEffect(() => {
    if (
      battedBallFilters.pitchTypeFilter !== "all" &&
      !battedBallPitchTypeOptions.some((option) => option.value === battedBallFilters.pitchTypeFilter)
    ) {
      setBattedBallFilters((filters) => ({ ...filters, pitchTypeFilter: "all" }));
    }
  }, [battedBallFilters.pitchTypeFilter, battedBallPitchTypeOptions]);
  const filteredBattedBallEvents = useMemo(
    () => filterMlbBattedBallEvents(mlbSprayData?.events ?? [], battedBallFilters, battedBallPlayerType),
    [battedBallFilters, battedBallPlayerType, mlbSprayData?.events]
  );
  const battedBallSummary = useMemo(() => {
    const events = [...filteredBattedBallEvents]
      .sort((a, b) => new Date(b.game_date ?? 0).getTime() - new Date(a.game_date ?? 0).getTime());
    const total = events.length;
    const hardHits = events.filter((event) => event.is_hard_hit).length;
    const barrels = events.filter((event) => event.is_barrel).length;
    const evEvents = events.filter((event) => typeof event.exit_velocity === "number");
    const laEvents = events.filter((event) => typeof event.launch_angle === "number");
    const avgEv = evEvents.length > 0
      ? evEvents.reduce((sum, event) => sum + (event.exit_velocity ?? 0), 0) / evEvents.length
      : null;
    const avgLa = laEvents.length > 0
      ? laEvents.reduce((sum, event) => sum + (event.launch_angle ?? 0), 0) / laEvents.length
      : null;
    const pct = (count: number) => total > 0 ? Math.round((count / total) * 100) : null;
    const bucketPct = (count: number) => evEvents.length > 0 ? Math.round((count / evEvents.length) * 100) : 0;
    const launchPct = (count: number) => laEvents.length > 0 ? Math.round((count / laEvents.length) * 100) : 0;
    const sampleLabel = battedBallFilters.seasonFilter === "all" ? "2023-2026 sample" : `${battedBallFilters.seasonFilter} sample`;
    const sampleBatterHand = getMlbSampleBatterHand(events, profile?.battingHand);
    const zoneOrder = isMlbPitcher
      ? MLB_MODAL_ZONE_ORDER_FIELD
      : sampleBatterHand === "L"
        ? MLB_MODAL_ZONE_ORDER_LHB
        : MLB_MODAL_ZONE_ORDER_RHB;
    const zoneCounts = new Map<string, number>();
    events.forEach((event) => {
      const zone = isMlbPitcher
        ? inferMlbModalFixedFieldZone(event)
        : inferMlbModalZone(event, event.batter_hand ?? sampleBatterHand ?? profile?.battingHand);
      if (zone) zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
    });
    let totalZoneCount = Array.from(zoneCounts.values()).reduce((sum, count) => sum + count, 0);
    if (!isMlbPitcher && events.length > 0 && totalZoneCount === 0) {
      (mlbSprayData?.zone_summary ?? []).forEach((zone) => {
        if (zone.zone && zone.count > 0) zoneCounts.set(zone.zone, zone.count);
      });
      totalZoneCount = Array.from(zoneCounts.values()).reduce((sum, count) => sum + count, 0);
    }
    const zonePct = (zone: string) => totalZoneCount > 0 ? Math.round(((zoneCounts.get(zone) ?? 0) / totalZoneCount) * 100) : 0;

    return {
      total,
      evCount: evEvents.length,
      laCount: laEvents.length,
      sampleLabel,
      hardHitPct: pct(hardHits),
      barrelPct: pct(barrels),
      avgEv,
      avgLa,
      evBuckets: [
        { label: "< 80", value: bucketPct(evEvents.filter((e) => (e.exit_velocity ?? 0) < 80).length), className: "bg-slate-500" },
        { label: "80-95", value: bucketPct(evEvents.filter((e) => (e.exit_velocity ?? 0) >= 80 && (e.exit_velocity ?? 0) < 95).length), className: "bg-sky-500" },
        { label: "95-110", value: bucketPct(evEvents.filter((e) => (e.exit_velocity ?? 0) >= 95 && (e.exit_velocity ?? 0) < 110).length), className: "bg-emerald-500" },
        { label: "110+", value: bucketPct(evEvents.filter((e) => (e.exit_velocity ?? 0) >= 110).length), className: "bg-red-400" },
      ],
      launchBuckets: [
        { label: "< 0", value: launchPct(laEvents.filter((e) => (e.launch_angle ?? 0) < 0).length), className: "bg-red-400" },
        { label: "0-10", value: launchPct(laEvents.filter((e) => (e.launch_angle ?? 0) >= 0 && (e.launch_angle ?? 0) < 10).length), className: "bg-emerald-500" },
        { label: "10-20", value: launchPct(laEvents.filter((e) => (e.launch_angle ?? 0) >= 10 && (e.launch_angle ?? 0) < 20).length), className: "bg-emerald-400" },
        { label: "20-30", value: launchPct(laEvents.filter((e) => (e.launch_angle ?? 0) >= 20 && (e.launch_angle ?? 0) < 30).length), className: "bg-orange-400" },
        { label: "30+", value: launchPct(laEvents.filter((e) => (e.launch_angle ?? 0) >= 30).length), className: "bg-sky-400" },
      ],
      zoneBuckets: (() => {
        const buckets = [...zoneOrder].reverse().map((zone) => ({
          label: MLB_MODAL_ZONE_LABELS[zone] ?? zone,
          value: zonePct(zone),
          className: "bg-teal-600",
        }));
        const maxValue = Math.max(...buckets.map((bucket) => bucket.value), 0);
        return buckets.map((bucket) => ({
          ...bucket,
          color: getMlbModalZoneBucketColor(bucket.value, maxValue),
        }));
      })(),
    };
  }, [battedBallFilters.seasonFilter, filteredBattedBallEvents, isMlbPitcher, mlbSprayData?.zone_summary, profile?.battingHand]);
  const modalTabs = isMlb
    ? [
        { id: "gamelog" as const, label: "Game Log", mobileLabel: "Log", icon: IconChartHistogram, proOnly: false },
        { id: "playstyle" as const, label: "Batted Ball", mobileLabel: "Batted", icon: Zap, proOnly: true },
        { id: "splits" as const, label: "Splits", mobileLabel: "Splits", icon: Users, proOnly: false, disabled: true, soon: true },
        { id: "matchup" as const, label: "Matchup", mobileLabel: "Match", icon: Target, proOnly: true, disabled: true, soon: true },
      ]
    : isWnba
      ? [
          { id: "gamelog" as const, label: "Game Log", mobileLabel: "Log", icon: IconChartHistogram, proOnly: false },
          { id: "matchup" as const, label: "Matchup", mobileLabel: "Match", icon: Target, proOnly: true },
          { id: "playstyle" as const, label: "Play Style", mobileLabel: "Style", icon: Zap, proOnly: true },
          { id: "odds" as const, label: "Odds", mobileLabel: "Odds", icon: BadgeDollarSign, proOnly: false },
        ]
      : [
          { id: "gamelog" as const, label: "Game Log", mobileLabel: "Log", icon: IconChartHistogram, proOnly: false },
          { id: "matchup" as const, label: "Matchup", mobileLabel: "Match", icon: Target, proOnly: true },
          { id: "playstyle" as const, label: "Play Style", mobileLabel: "Style", icon: Zap, proOnly: true },
          { id: "correlation" as const, label: "Correlation", mobileLabel: "Corr", icon: Users, proOnly: true },
          { id: "odds" as const, label: "Odds", mobileLabel: "Odds", icon: BadgeDollarSign, proOnly: false },
        ];

	  const handleLineEdit = () => {
	    const val = parseFloat(editValue);
	    if (!isNaN(val)) handleLineChange(val);
	    setIsEditingLine(false);
	  };

  if (isMlb) {
    const hitRateCards = [
      { label: "Last 5", value: dynamicHitRates.l5, games: chartBaseGames.slice(0, 5) },
      { label: "Last 10", value: dynamicHitRates.l10, games: chartBaseGames.slice(0, 10) },
      { label: "Last 20", value: dynamicHitRates.l20, games: chartBaseGames.slice(0, 20) },
      { label: "Season", value: dynamicHitRates.season, games: chartBaseGames },
      { label: `Avg ${formatMarketLabel(currentMarket)}`, value: chartStats.avg, games: filteredGames, isAvg: true },
    ];

    return (
      <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full h-[100dvh] max-w-none rounded-none border-0 bg-background p-0 text-foreground shadow-2xl sm:h-auto sm:max-h-[94vh] sm:max-w-[96vw] sm:rounded-xl sm:border sm:border-border sm:ring-1 sm:ring-black/5 lg:max-w-[1420px] dark:sm:ring-white/5 overflow-hidden">
          {isLoading ? (
            <div className="px-6 py-24">
              <DialogTitle className="sr-only">Loading Player Profile</DialogTitle>
              <LoadingState message="Loading player profile..." />
            </div>
          ) : !hasData ? (
            <div className="px-6 py-24 text-center">
              <DialogTitle className="text-lg font-semibold text-foreground">Player Not Found</DialogTitle>
              <p className="mt-2 text-sm text-muted-foreground">Unable to load data for this player.</p>
            </div>
          ) : (
            <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background sm:h-[94vh] sm:max-h-[94vh]">
              <div className="shrink-0 border-b border-border bg-card px-3 py-2.5 sm:px-6 sm:py-3 lg:pr-12">
                <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                  <div className="flex min-w-0 items-center gap-3 sm:items-start sm:gap-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-neutral-100 dark:bg-neutral-800 shadow-sm sm:h-24 sm:w-24 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <PlayerHeadshot
                        nbaPlayerId={null}
                        mlbPlayerId={resolvedPlayerId ?? null}
                        sport={sport}
                        name={displayName}
                        size="small"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 sm:pt-0.5">
                      <div className="flex min-w-0 items-baseline gap-1.5 sm:block">
                        <DialogTitle className="truncate text-base font-black leading-tight tracking-tight text-foreground sm:text-3xl">
                          {displayName}
                        </DialogTitle>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:hidden">
                          {[displayTeam, displayPosition, displayJersey ? `#${displayJersey}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <div className="mt-0.5 hidden flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground sm:mt-1 sm:flex sm:gap-2 sm:text-sm">
                        {displayTeam && <span>{displayTeam}</span>}
                        {displayPosition && <><span className="text-border">•</span><span>{displayPosition}</span></>}
                        {displayJersey && <><span className="text-border">•</span><span>#{displayJersey}</span></>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2 sm:gap-2">
                        {nextGame && (
                          <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-border bg-neutral-50 py-0.5 pl-1 pr-2 text-[11px] text-foreground/85 dark:bg-neutral-800/40 sm:gap-2 sm:py-1 sm:pl-1.5 sm:pr-2.5 sm:text-xs">
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-1.5 py-0.5 font-bold uppercase tracking-[0.08em] text-[9px] text-brand sm:px-2 sm:text-[10px]">
                              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                              Next
                            </span>
                            {nextGame.opponentTeamAbbr && (
                              <span className="inline-flex items-center gap-1 font-semibold sm:gap-1.5">
                                <span className="text-foreground/55">{nextGame.homeAway === "H" ? "vs" : "@"}</span>
                                <img
                                  src={getTeamLogoUrl(nextGame.opponentTeamAbbr, "mlb")}
                                  alt={nextGame.opponentTeamAbbr}
                                  className="h-3.5 w-3.5 object-contain sm:h-4 sm:w-4"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                                <span>{nextGame.opponentTeamAbbr}</span>
                              </span>
                            )}
                            {nextGameDetail && nextGameDetail !== "TBD" && (
                              <span className="inline-flex items-center gap-1 truncate font-medium text-foreground/70">
                                <span className="text-foreground/35">•</span>
                                <span className="truncate">{nextGameDetail}</span>
                                {opposingPitcherHand && (
                                  <span className="font-mono text-[10px] font-bold text-foreground/55">({opposingPitcherHand})</span>
                                )}
                              </span>
                            )}
                          </div>
                        )}
                        {isMlb && mlbScheduleGame?.weather && (
                          <MlbWeatherChip weather={mlbScheduleGame.weather} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {headerSeasonSummary && (
                      <MlbSeasonStatsStrip
                        summary={headerSeasonSummary}
                        teamAccent={getReadableTeamAccent(profile?.primaryColor, profile?.secondaryColor)}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 scrollbar-hide sm:px-6 sm:pb-4 lg:overflow-hidden">
                <div className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px] lg:pt-4">
                  <main className="min-w-0 lg:min-h-0">
                    <MlbGlassPanel className="overflow-visible lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                      <div className="sticky top-0 z-20 flex flex-col gap-2 rounded-t-lg border-b border-border bg-card px-3 py-2 sm:gap-3 sm:px-3 sm:py-2.5 lg:static lg:z-auto xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-hide">
                          {modalTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const isDisabled = "disabled" in tab && tab.disabled;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => !isDisabled && setActiveTab(tab.id)}
                                className={cn(
                                  "relative flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm",
                                  isDisabled
                                    ? "cursor-not-allowed border-neutral-200/60 bg-neutral-100/60 text-neutral-400 dark:border-neutral-800/60 dark:bg-neutral-800/40 dark:text-neutral-600"
                                    : isActive
                                      ? "border-brand/45 bg-brand/10 text-brand shadow-sm"
                                      : "border-neutral-200/70 bg-neutral-50/70 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800/70 dark:bg-neutral-950/35 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-900",
                                )}
                              >
                                <Icon className={cn("h-4 w-4", isActive ? "text-brand" : "")} />
                                <span>{tab.id === "matchup" ? "Pitcher" : tab.id === "playstyle" ? "Batted Ball" : tab.label.replace("Game ", "")}</span>
                                {"soon" in tab && tab.soon && <span className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[9px] font-black text-muted-foreground">SOON</span>}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:grid-cols-2 xl:w-[360px]">
                          <div className="relative" ref={marketDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
                              className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-neutral-50 dark:bg-neutral-800/50 px-2.5 text-left shadow-sm transition hover:border-brand/60 active:scale-[0.99] dark:bg-neutral-800/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:h-10 sm:px-3"
                            >
                              <span className="min-w-0">
                                <span className="block text-[8px] font-bold uppercase leading-none tracking-wide text-muted-foreground sm:text-[9px]">Prop</span>
                                <span className="mt-0.5 block truncate text-xs font-black leading-tight text-foreground sm:text-sm">{formatMarketLabel(currentMarket)}</span>
                              </span>
                              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isMarketDropdownOpen && "rotate-180")} />
                            </button>
                            {isMarketDropdownOpen && (
                              <div className="absolute left-0 top-full z-50 mt-2 max-h-[280px] min-w-[220px] overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-2xl">
                                {availableMarkets.map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                      setSelectedMarket(m);
                                      onMarketChange?.(m);
                                      setIsMarketDropdownOpen(false);
                                    }}
                                    className={cn(
                                      "w-full rounded-md px-3 py-2 text-left text-sm font-bold transition",
                                      m === currentMarket ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-foreground/80 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-foreground"
                                    )}
                                  >
                                    {formatMarketLabel(m)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-9 items-center justify-between gap-2 rounded-lg border border-border bg-neutral-50 dark:bg-neutral-800/50 px-2.5 text-left shadow-sm transition hover:border-brand/60 active:scale-[0.99] dark:bg-neutral-800/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:h-10 sm:px-3"
                              >
                                <span className="min-w-0">
                                  <span className="block text-[8px] font-bold uppercase leading-none tracking-wide text-muted-foreground sm:text-[9px]">Line</span>
                                  <span className="mt-0.5 block text-xs font-black leading-tight text-foreground sm:text-sm">{activeLine}+</span>
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onWheelCapture={(event) => event.stopPropagation()}
                              className="z-[300] max-h-72 min-w-[160px] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1.5 shadow-2xl scrollbar-hide"
                            >
                              {rightRailLineOptions.map((line) => {
                                const isSelected = Math.abs(line - activeLine) < 0.01;
                                return (
                                  <DropdownMenuItem
                                    key={line}
                                    onSelect={() => {
                                      handleLineChange(line);
                                      setIsEditingLine(false);
                                    }}
                                    className={cn(
                                      "cursor-pointer rounded-md px-3 py-2 text-sm font-black tabular-nums",
                                      isSelected
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                        : "text-foreground/80 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-foreground"
                                    )}
                                  >
                                    {line}+
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="space-y-2.5 overflow-y-auto p-2.5 scrollbar-hide sm:space-y-3 sm:p-3 lg:min-h-0 lg:flex-1 lg:pr-2">
                    {activeTab === "gamelog" && (
                      <>
                        <MlbGlassPanel className="grid grid-cols-5 overflow-hidden">
                          {hitRateCards.map((card) => {
                            const hits = card.games.filter((game) => getMarketStat(game, currentMarket) >= activeLine).length;
                            const tone = card.isAvg
                              ? "neutral"
                              : card.value === null
                              ? "neutral"
                              : card.value >= 50
                              ? "green"
                              : "red";
                            const teamAccentColor = card.isAvg
                              ? getReadableTeamAccent(profile?.primaryColor, profile?.secondaryColor)
                              : null;
                            return (
                              <MlbMetricTile
                                key={card.label}
                                label={card.label}
                                value={card.isAvg ? (card.value !== null ? card.value.toFixed(2) : "-") : formatPctValue(card.value)}
                                sub={card.isAvg ? "Per Game" : `${hits} / ${card.games.length}`}
                                tone={tone}
                                accentColor={teamAccentColor}
                              />
                            );
                          })}
                        </MlbGlassPanel>

                        <MlbGlassPanel className="overflow-hidden">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                            <div>
                              <h3 className="text-sm font-black text-foreground">Recent Games <span className="font-medium text-muted-foreground">({formatMarketLabel(currentMarket)})</span></h3>
                            </div>
                            <div className="flex rounded-md border border-border bg-neutral-50 dark:bg-neutral-800/50 p-0.5">
                              {[
                                { label: "10", value: 10 as const },
                                { label: "20", value: 20 as const },
                                { label: "30", value: 30 as const },
                                { label: "Season", value: "season" as const },
                              ].map((option) => (
                                <MlbFilterButton
                                  key={option.label}
                                  active={gameCount === option.value}
                                  onClick={() => setGameCount(option.value)}
                                >
                                  {option.label}
                                </MlbFilterButton>
                              ))}
                            </div>
                          </div>
                          <div className="px-3 py-3">
                            {filteredGames.length > 0 ? (
                              <GameLogChart
                                games={filteredGames}
                                market={currentMarket}
                                sport={sport}
                                line={activeLine}
                                onLineChange={handleLineChange}
                                odds={oddsForChart}
                                profileGameLogs={profile?.gameLogs as any}
                              />
                            ) : (
                              <div className="py-12 text-center text-sm text-muted-foreground">No game data available for these filters</div>
                            )}
                          </div>
                          <div className="border-t border-border px-3 py-2.5 sm:px-4 sm:py-3">
                            {/* Mobile: compact dropdowns side by side */}
                            <div className="flex items-center gap-2 sm:hidden">
                              <MlbCompactSelect
                                label="Loc"
                                value={mlbHomeAwayFilter}
                                options={[
                                  { label: "All", value: "all" as const },
                                  { label: "Home", value: "H" as const },
                                  { label: "Away", value: "A" as const },
                                ]}
                                onChange={(v) => setMlbHomeAwayFilter(v)}
                              />
                              <MlbCompactSelect
                                label="Time"
                                value={mlbDayNightFilter}
                                options={[
                                  { label: "All", value: "all" as const },
                                  { label: "Day", value: "D" as const, disabled: !hasDayNightData },
                                  { label: "Night", value: "N" as const, disabled: !hasDayNightData },
                                ]}
                                onChange={(v) => setMlbDayNightFilter(v)}
                              />
                            </div>
                            {/* Desktop: segmented controls */}
                            <div className="hidden flex-wrap items-center justify-between gap-3 sm:flex">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Location</span>
                                <div className="flex rounded-md border border-border bg-neutral-50 dark:bg-neutral-800/50 p-0.5">
                                  {[
                                    { label: "All", value: "all" as const },
                                    { label: "Home", value: "H" as const },
                                    { label: "Away", value: "A" as const },
                                  ].map((option) => (
                                    <MlbFilterButton
                                      key={option.value}
                                      active={mlbHomeAwayFilter === option.value}
                                      onClick={() => setMlbHomeAwayFilter(option.value)}
                                    >
                                      {option.label}
                                    </MlbFilterButton>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Time</span>
                                <div className="flex rounded-md border border-border bg-neutral-50 dark:bg-neutral-800/50 p-0.5">
                                  {[
                                    { label: "All", value: "all" as const },
                                    { label: "Day", value: "D" as const },
                                    { label: "Night", value: "N" as const },
                                  ].map((option) => (
                                    <MlbFilterButton
                                      key={option.value}
                                      active={mlbDayNightFilter === option.value}
                                      disabled={option.value !== "all" && !hasDayNightData}
                                      title={option.value !== "all" && !hasDayNightData ? "Game start time is not available for this sample yet." : undefined}
                                      onClick={() => setMlbDayNightFilter(option.value)}
                                    >
                                      {option.label}
                                    </MlbFilterButton>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </MlbGlassPanel>

                        {fullProfilePlayerId && (
                          <BoxScoreTable
                            sport={sport}
                            playerId={fullProfilePlayerId}
                            market={currentMarket}
                            currentLine={activeLine}
                            prefetchedGames={filteredGames}
                            variant="modal"
                          />
                        )}
                      </>
                    )}

                    {activeTab === "playstyle" && (
                      <>
                        <MlbBattedBallFiltersPanel
                          filters={battedBallFilters}
                          onChange={setBattedBallFilters}
                          onReset={() => setBattedBallFilters(getDefaultMlbSprayChartFilters())}
                          pitchTypeOptions={battedBallPitchTypeOptions}
                          opposingPitcherName={!isMlbPitcher && nextGameDetail !== "TBD" ? nextGameDetail : null}
                          playerType={battedBallPlayerType}
                          pitchMixContextName={isMlbPitcher ? displayName : null}
                          pitchMixIsFullArsenal={usingFullPitcherMix}
                        />

                        <MlbGlassPanel className="grid grid-cols-2 overflow-hidden md:grid-cols-4">
                          <MlbMetricTile
                            label={isMlbPitcher ? "Hard Hit Allowed" : "Hard Hit"}
                            value={isLoadingMlbSpray ? "-" : battedBallSummary.hardHitPct !== null ? `${battedBallSummary.hardHitPct}%` : "-"}
                            sub={battedBallSummary.total > 0 ? `${battedBallSummary.total} BBE` : battedBallSummary.sampleLabel}
                            tone="neutral"
                            align="center"
                          />
                          <MlbMetricTile
                            label={isMlbPitcher ? "Avg EV Allowed" : "Avg Exit Velo"}
                            value={isLoadingMlbSpray ? "-" : battedBallSummary.avgEv !== null ? `${battedBallSummary.avgEv.toFixed(1)} mph` : "-"}
                            sub={battedBallSummary.evCount > 0 ? `${battedBallSummary.evCount} tracked` : "Tracked BBE"}
                            tone="neutral"
                            align="center"
                          />
                          <MlbMetricTile
                            label={isMlbPitcher ? "Barrel % Allowed" : "Barrel %"}
                            value={isLoadingMlbSpray ? "-" : battedBallSummary.barrelPct !== null ? `${battedBallSummary.barrelPct}%` : "-"}
                            sub="Barrels / BBE"
                            tone="neutral"
                            align="center"
                          />
                          <MlbMetricTile
                            label={isMlbPitcher ? "Launch Allowed" : "Launch Angle"}
                            value={isLoadingMlbSpray ? "-" : battedBallSummary.avgLa !== null ? `${battedBallSummary.avgLa.toFixed(1)}°` : "-"}
                            sub={battedBallSummary.laCount > 0 ? `${battedBallSummary.laCount} tracked` : "Average"}
                            tone="neutral"
                            align="center"
                          />
                        </MlbGlassPanel>

                        <div className="grid gap-3 xl:grid-cols-[1fr_1.25fr]">
                          <MlbSprayChart
                            playerId={fullProfilePlayerId ?? null}
                            playerType={battedBallPlayerType}
                            gameId={mlbSprayGameId}
                            eventId={mlbSprayEventId}
                            battingHand={profile?.battingHand}
                            variant="modal"
                            filters={battedBallFilters}
                            onFiltersChange={setBattedBallFilters}
                            hideHeaderControls
                            hideZoneBreakdown
                            venueName={mlbScheduleGame?.weather?.venue_name ?? null}
                            weather={mlbScheduleGame?.weather ?? null}
                            selectedEventKey={selectedBattedBallKey}
                            onEventSelect={(eventKey) => setSelectedBattedBallKey(eventKey)}
                          />

                          <div className="space-y-3">
                            <MlbDistributionBar
                              title="Exit Velocity Breakdown"
                              buckets={battedBallSummary.evBuckets}
                              isLoading={isLoadingMlbSpray}
                              emptyLabel="Exit velocity data is not available for this sample."
                              unit="mph"
                            />
                            <MlbDistributionBar
                              title="Launch Angle Breakdown"
                              buckets={battedBallSummary.launchBuckets}
                              isLoading={isLoadingMlbSpray}
                              emptyLabel="Launch angle data is not available for this sample."
                              unit="degrees"
                            />
                            <MlbDistributionBar
                              title="Zone Breakdown"
                              buckets={battedBallSummary.zoneBuckets}
                              isLoading={isLoadingMlbSpray}
                              emptyLabel="Zone data is not available for this sample."
                            />
                          </div>
                        </div>

                        <MlbBattedBallsTable
                          events={filteredBattedBallEvents}
                          selectedEventKey={selectedBattedBallKey}
                          onSelectEvent={(eventKey) => setSelectedBattedBallKey(eventKey)}
                          isLoading={isLoadingMlbSpray}
                          playerType={battedBallPlayerType}
                          includeYearInDates={battedBallFilters.seasonFilter === "all"}
                        />
                      </>
                    )}
                      </div>
                    </MlbGlassPanel>
                  </main>

                  <MlbRightRail
                    currentMarket={currentMarket}
                    activeLine={activeLine}
                    bookOffers={bookOffers}
                    chartStats={chartStats}
                    dynamicHitRates={dynamicHitRates}
                    nextGame={nextGame}
                    lineHistory={lineHistoryData}
                    isLineHistoryLoading={isLineHistoryLoading}
                    lineHistoryError={lineHistoryError}
                    lineOptions={rightRailLineOptions}
                    lineHistorySide={lineHistorySide}
                    onLineHistorySideChange={setLineHistorySide}
                    onLineChange={(line) => {
                      handleLineChange(line);
                      setIsEditingLine(false);
                    }}
                    canOpenLineHistory={!!lineHistoryContext}
                    onOpenLineHistory={() => setLineHistoryDialogOpen(true)}
                    isFavoriteSaved={isFavoriteSaved}
                    isFavoriteSaving={isToggling}
                    isFavoriteLoggedIn={isLoggedIn}
                    canSaveFavorite={!!favoriteParams}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <LineHistoryDialog
        open={lineHistoryDialogOpen}
        onOpenChange={(nextOpen) => {
          setLineHistoryDialogOpen(nextOpen);
        }}
        context={lineHistoryContext}
      />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-hidden border border-neutral-200/50 dark:border-neutral-800/80 bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-950 dark:to-neutral-900 p-0 shadow-2xl rounded-2xl ring-1 ring-black/5 dark:ring-white/5">
        {isLoading ? (
          <div className="py-20 px-6">
            <DialogTitle className="sr-only">Loading Player Profile</DialogTitle>
            <LoadingState message="Loading player profile..." />
          </div>
        ) : !hasData ? (
          <div className="py-20 px-6 text-center">
            <DialogTitle className="text-lg font-semibold mb-2">Player Not Found</DialogTitle>
            <p className="text-muted-foreground">Unable to load data for this player.</p>
          </div>
        ) : (
          <div className="flex flex-col max-h-[92vh] overflow-hidden w-full">
            {/* ═══════════════════════════════════════════════════════════════════
                STICKY HEADER — three rows in one sticky region:
                  1. v2 DrilldownHeader (identity, matchup, line stepper, best price)
                  2. Market dropdown + season averages strip
                  3. Tab pill row
                Stays pinned while the user scrolls the active tab.
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-white to-white/95 dark:from-neutral-950 dark:to-neutral-950/95 backdrop-blur-xl border-b border-neutral-200/50 dark:border-neutral-800/80">
              {/* Row 1 — v2 DrilldownHeader (NBA/WNBA only). */}
              {!isMlb && profile && (
                <div className="relative px-3 sm:px-6 pt-2 pb-1.5 sm:pt-3 sm:pb-2 pr-12 sm:pr-16 border-b border-neutral-200/50 dark:border-neutral-800/60">
                  <DrilldownHeader
                    profile={profile as any}
                    sport={(isWnba ? "wnba" : "nba") as "nba" | "wnba"}
                    effectiveLine={activeLine}
                    onLineChange={handleLineChange}
                    onLineReset={handleLineReset}
                    odds={activeHitRateOdds ?? null}
                    compact
                  />
                  {/* Close button — pinned top-right inside the DrilldownHeader row. */}
                  <button
                    onClick={() => onOpenChange(false)}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 p-2 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-neutral-800/80 transition-all hover:scale-105 active:scale-95 z-10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* Row 2 — market dropdown + season averages. On mobile this row
                  also carries the line stepper + best-price quick-glance since
                  the DrilldownHeader's line/odds column hides below sm. */}
              <div className="relative px-3 sm:px-6 py-2 sm:py-3">
                <div className={cn("flex items-center gap-1.5 sm:gap-3", isMlb && "pr-10")}>
                  {/* Market Dropdown - selects which prop the chart + tabs render. */}
                  <div className="relative shrink-0" ref={marketDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
                      className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/80 text-xs sm:text-sm font-bold text-neutral-900 dark:text-white hover:border-brand/45 hover:shadow-md transition-all shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                    >
                      <span className="text-brand">{formatMarketLabel(currentMarket)}</span>
                      <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform duration-200", isMarketDropdownOpen && "rotate-180")} />
                    </button>
                    {isMarketDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 z-[9999] min-w-[180px] p-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/80 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 backdrop-blur-xl">
                        <div className="max-h-[280px] overflow-y-auto">
                          {availableMarkets.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setSelectedMarket(m);
                                onMarketChange?.(m);
                                setIsMarketDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2.5 text-left text-sm font-semibold rounded-lg transition-all",
                                m === currentMarket
                                  ? "bg-brand/10 text-brand ring-1 ring-brand/20"
                                  : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
                              )}
                            >
                              {formatMarketLabel(m)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mobile-only inline line stepper + best price. Sits next to
                      the market dropdown so the active prop, the active line,
                      and the best price all live on one tight row. */}
                  {!isMlb && (
                    <div className="flex sm:hidden flex-1 items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLineChange(Math.max(0.5, activeLine - 0.5))}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        aria-label="Decrease line"
                      >
                        <span className="text-base font-black leading-none">−</span>
                      </button>
                      <span className={cn(
                        "min-w-[2.75rem] rounded-md px-1.5 py-1 text-center text-sm font-black tabular-nums leading-none",
                        isCustomLineActive
                          ? "bg-brand/10 text-brand ring-1 ring-brand/30"
                          : "text-neutral-900 dark:text-white"
                      )}>
                        {activeLine}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleLineChange(activeLine + 0.5)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        aria-label="Increase line"
                      >
                        <span className="text-base font-black leading-none">+</span>
                      </button>
                      {(activeHitRateOdds?.bestOver || activeHitRateOdds?.bestUnder) && (
                        <div className="ml-1 flex items-center gap-1 border-l border-neutral-200/60 pl-2 dark:border-neutral-700/60">
                          {activeHitRateOdds?.bestOver && (
                            <span className={cn(
                              "text-[11px] font-black tabular-nums",
                              activeHitRateOdds.bestOver.price > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-neutral-900 dark:text-white"
                            )}>
                              O {activeHitRateOdds.bestOver.price > 0 ? "+" : ""}{activeHitRateOdds.bestOver.price}
                            </span>
                          )}
                          {activeHitRateOdds?.bestUnder && (
                            <span className={cn(
                              "text-[11px] font-black tabular-nums",
                              activeHitRateOdds.bestUnder.price > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-neutral-700 dark:text-neutral-300"
                            )}>
                              U {activeHitRateOdds.bestUnder.price > 0 ? "+" : ""}{activeHitRateOdds.bestUnder.price}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Season averages — compact horizontal pill row (desktop). */}
                  {headerSeasonSummary && (
                    <div className="hidden sm:flex flex-1 min-w-0 items-center gap-1 overflow-x-auto scrollbar-hide">
                      {headerSeasonSummary.stats.map((stat) => (
                        <div
                          key={stat.label}
                          className={cn(
                            "flex items-baseline gap-1.5 px-2.5 py-1.5 rounded-lg whitespace-nowrap",
                            stat.highlight
                              ? "bg-brand/10 ring-1 ring-brand/20"
                              : "bg-neutral-100/60 dark:bg-neutral-800/50 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
                          )}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">{stat.label}</span>
                          <span className={cn(
                            "text-sm font-black tabular-nums",
                            stat.highlight ? "text-brand" : "text-neutral-900 dark:text-white"
                          )}>
                            {stat.value}
                          </span>
                        </div>
                      ))}
                      <span className="ml-1 text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">{headerSeasonSummary.label}</span>
                    </div>
                  )}
                </div>

                {/* Mobile season averages: tighter grid below the market row. */}
                {headerSeasonSummary && (
                  <div className="flex sm:hidden mt-2.5 gap-1 overflow-x-auto scrollbar-hide">
                    {headerSeasonSummary.stats.map((stat) => (
                      <div
                        key={stat.label}
                        className={cn(
                          "flex items-baseline gap-1.5 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0",
                          stat.highlight
                            ? "bg-brand/10 ring-1 ring-brand/20"
                            : "bg-neutral-100/60 dark:bg-neutral-800/50 ring-1 ring-neutral-200/50 dark:ring-neutral-700/50"
                        )}
                      >
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">{stat.label}</span>
                        <span className={cn(
                          "text-sm font-black tabular-nums",
                          stat.highlight ? "text-brand" : "text-neutral-900 dark:text-white"
                        )}>
                          {stat.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Close button (MLB only — NBA/WNBA close button lives in
                    the DrilldownHeader row above). */}
                {isMlb && (
                  <button
                    onClick={() => onOpenChange(false)}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 p-2 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-neutral-800/80 transition-all hover:scale-105 active:scale-95 z-10 backdrop-blur-sm"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}

                {/* Mobile CTA: quick access to full hit rate card. */}
                {showFullProfileLink && (
                  <div className="sm:hidden mt-2.5">
                    {hasAdvancedAccess ? (
                      <Link
                        href={fullProfileHref}
                        target="_blank"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        onClick={() => onOpenChange(false)}
                      >
                        View Full Hit Rate Card
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <Link
                        href="/pricing"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-colors"
                        onClick={() => onOpenChange(false)}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {isAuthenticated ? "Upgrade for Full Hit Rate Card" : "Try Free for Full Hit Rate Card"}
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Row 3 — tab navigation. Inside the sticky region so it stays
                  pinned alongside the DrilldownHeader + market row. */}
              <div className="shrink-0 px-4 sm:px-6 pt-2 pb-3 border-t border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
                {modalTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isDisabled = "disabled" in tab && tab.disabled;
                  const isSoon = "soon" in tab && tab.soon;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!isDisabled) setActiveTab(tab.id);
                      }}
                      className={cn(
                        "group relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap active:scale-[0.98] sm:px-4",
                        isDisabled
                          ? "cursor-not-allowed border-neutral-200/60 bg-neutral-100/60 text-neutral-400 dark:border-neutral-800/60 dark:bg-neutral-800/40 dark:text-neutral-600"
                          : isActive
                            ? "border-brand/45 bg-brand/10 text-brand shadow-sm"
                            : "border-neutral-200/70 bg-neutral-50/70 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800/70 dark:bg-neutral-950/35 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-900",
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 transition-colors",
                        isDisabled
                          ? "text-neutral-400 dark:text-neutral-600"
                          : isActive ? "text-brand" : "text-neutral-400 dark:text-neutral-500"
                      )} />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.mobileLabel}</span>
                      {isSoon ? (
                        <span className="ml-1 px-1.5 py-0.5 text-[8px] font-bold bg-neutral-200 text-neutral-500 rounded-md shadow-sm dark:bg-neutral-700 dark:text-neutral-300">
                          SOON
                        </span>
                      ) : tab.proOnly && !hasAdvancedAccess && (
                        <span className="ml-1 px-1.5 py-0.5 text-[8px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md shadow-sm">
                          SCOUT
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                SCROLLABLE CONTENT
                ═══════════════════════════════════════════════════════════════════ */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-5 min-w-0 relative z-0 min-h-[400px]">
              {/* Notice for future games */}
              {!hasUpcomingProfile && !nextGame && activeTab === "gamelog" && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    No upcoming game profile found. Showing historical stats.
                  </p>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  GAME LOG TAB
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "gamelog" && (
                <>
                  {/* v2 HitRateChart — same component the full hit-rate
                      drilldown renders. The chart already wraps itself in a
                      Tile and bakes the v2 DrilldownHeader in as its top slot,
                      so the gamelog tab inherits the v2 hero look as one drop-in. */}
                  {profile && !isMlb ? (
                    <HitRateChartV2
                      games={boxScoreGames}
                      market={currentMarket}
                      line={activeLine}
                      sport={(isWnba ? "wnba" : "nba") as "nba" | "wnba"}
                      isCustomLine={isCustomLineActive}
                      isLoading={isLoadingBoxScores}
                      split={chartSplit}
                      onSplitChange={setChartSplit}
                      range={chartRange}
                      onRangeChange={setChartRange}
                      hitRateSegments={chartHitRateSegments}
                      opponentTeamId={profile.opponentTeamId ?? null}
                      onLineChange={handleLineChange}
                      onLineReset={handleLineReset}
                      tonightDate={profile.gameDate ?? null}
                      tonightSpread={profile.spread ?? null}
                      tonightOpponentTeamId={profile.opponentTeamId ?? null}
                      upcomingGameDate={profile.gameDate ?? null}
                      upcomingOpponentAbbr={profile.opponentTeamAbbr ?? null}
                      upcomingHomeAway={profile.homeAway ?? null}
                      hideQuickFilters
                    />
                  ) : (
                    <Tile label="Game Log" padded={false} className="w-full overflow-hidden">
                      <div className="p-3 sm:p-4">
                        {filteredGames.length > 0 ? (
                          <GameLogChart
                            games={filteredGames}
                            market={currentMarket}
                            sport={sport}
                            line={activeLine}
                            onLineChange={handleLineChange}
                            odds={oddsForChart}
                            profileGameLogs={profile?.gameLogs as any}
                          />
                        ) : (
                          <div className="py-12 text-center text-sm text-neutral-500">No game data available</div>
                        )}
                      </div>
                    </Tile>
                  )}

                  {/* Box Score Table */}
                  {fullProfilePlayerId && (
                    <Tile
                      label="Box Score"
                      headerRight={
                        !isMlb && boxScoreSeasonOptions.length > 0 ? (
                          <div className="flex items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
                            {boxScoreSeasonOptions.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setBoxScoreSeason(opt)}
                                className={cn(
                                  "rounded-sm px-2 py-0.5 text-[10px] font-black tabular-nums tracking-[0.08em] transition-all",
                                  boxScoreSeason === opt
                                    ? "bg-brand text-neutral-950"
                                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : undefined
                      }
                      padded={false}
                      className="w-full overflow-hidden"
                    >
                      <div className="overflow-x-auto">
                        <BoxScoreTable
                          sport={sport}
                          playerId={fullProfilePlayerId}
                          market={currentMarket}
                          currentLine={activeLine}
                          season={isMlb ? undefined : boxScoreSeason}
                          prefetchedGames={isMlb ? mlbSeasonGames : undefined}
                          variant="modal"
                        />
                      </div>
                    </Tile>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  MATCHUP TAB - Defense vs Position Analysis
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "matchup" && isMlb && (
                <MlbQuickMatchupPanel
                  profile={profile}
                  currentMarket={currentMarket}
                  activeLine={activeLine}
                  dynamicHitRates={dynamicHitRates}
                />
              )}

              {activeTab === "matchup" && !isMlb && (
                <div className="relative">
                  {/* WNBA exception: Defense vs Position is the free-tier
                      carrot, only Similar Players gets the pro lock. NBA keeps
                      the full-tab gate. */}
                  {!isWnba && !hasAdvancedAccess && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md rounded-xl">
                      <div className="flex flex-col items-center gap-4 p-6 max-w-sm text-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20">
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                            Matchup Analysis
                          </h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            See how this player performs against the opposing defense with detailed positional matchup data.
                          </p>
                        </div>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow"
                        >
                          <Lock className="w-4 h-4" />
                          {isAuthenticated ? "Upgrade to Scout" : "Try Free"}
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className={cn(!isWnba && !hasAdvancedAccess && "pointer-events-none select-none")}>
                    {profile && (
                      <MatchupPanelV2
                        profile={profile as any}
                        sport={(isWnba ? "wnba" : "nba") as "nba" | "wnba"}
                        activeLine={activeLine}
                        stacked
                        gateSimilarPlayers={isWnba && !hasAdvancedAccess}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  PLAY STYLE TAB - Play Type & Shooting Analysis
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "playstyle" && isMlb && (
                <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
	                  <MlbSprayChart
	                    playerId={fullProfilePlayerId ?? null}
	                    gameId={mlbSprayGameId}
	                    eventId={mlbSprayEventId}
	                    battingHand={profile?.battingHand}
	                    venueName={mlbScheduleGame?.weather?.venue_name ?? null}
	                    weather={mlbScheduleGame?.weather ?? null}
	                  />
                </div>
              )}

              {activeTab === "playstyle" && !isMlb && (
                <div className="relative">
                  {/* Pro gate overlay */}
                  {!hasAdvancedAccess && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md rounded-xl">
                      <div className="flex flex-col items-center gap-4 p-6 max-w-sm text-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20">
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                            Play Style Analysis
                          </h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Explore play type breakdowns and shooting zone charts to understand how this player scores.
                          </p>
                        </div>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow"
                        >
                          <Lock className="w-4 h-4" />
                          {isAuthenticated ? "Upgrade to Scout" : "Try Free"}
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <div className={cn("space-y-4", !hasAdvancedAccess && "pointer-events-none select-none")}>
                    {profile && (
                      <>
                        <ShootingPanelV2
                          profile={profile as any}
                          sport={(isWnba ? "wnba" : "nba") as "nba" | "wnba"}
                        />
                        {!isWnba && (
                          <PlayTypePanelV2
                            profile={profile as any}
                            sport="nba"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  CORRELATION TAB - Teammate Correlations
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "correlation" && !isMlb && (
                <div className="relative">
                  {/* Pro gate overlay */}
                  {!hasAdvancedAccess && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md rounded-xl">
                      <div className="flex flex-col items-center gap-4 p-6 max-w-sm text-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20">
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                            Player Correlations
                          </h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Discover which teammates boost or hurt this player&apos;s performance for smarter parlays.
                          </p>
                        </div>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow"
                        >
                          <Lock className="w-4 h-4" />
                          {isAuthenticated ? "Upgrade to Scout" : "Try Free"}
                        </Link>
                      </div>
                    </div>
                  )}
                  
                  <div className={cn("overflow-x-auto", !hasAdvancedAccess && "pointer-events-none select-none")}>
                    <div className="min-w-[640px] sm:min-w-0">
                      <PlayerCorrelations
                        playerId={profilePlayerId ?? null}
                        market={currentMarket}
                        line={activeLine}
                        gameId={profile?.gameId}
                        gameDate={profile?.gameDate}
                        homeTeamName={profile?.homeTeamName}
                        awayTeamName={profile?.awayTeamName}
                        startTime={profile?.startTime}
                        anchorTeam={profile?.teamAbbr || profile?.teamName}
                        playerName={profilePlayerName}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════════
                  ODDS TAB — full all-lines table from the v2 OddsPanel.
                  ═══════════════════════════════════════════════════════════════════ */}
              {activeTab === "odds" && !isMlb && profile && (
                <OddsPanelV2
                  profile={profile as any}
                  sport={(isWnba ? "wnba" : "nba") as "nba" | "wnba"}
                  activeLine={activeLine}
                  onLineSelect={handleLineChange}
                  odds={activeHitRateOdds ?? null}
                  isLoading={false}
                />
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                FOOTER - View Full Profile CTA
                ═══════════════════════════════════════════════════════════════════ */}
            {showFullProfileLink && (
            <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-neutral-200/50 dark:border-neutral-800/50">
              {hasAdvancedAccess ? (
                <Link
                  href={fullProfileHref}
                  target="_blank"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  View Full Hit Rate Profile
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isAuthenticated ? "Upgrade to Scout for Full Profile" : "Try Free for Full Profile"}
                </Link>
              )}
            </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
