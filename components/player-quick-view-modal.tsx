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
import { MlbSprayChart } from "@/components/hit-rates/mlb/mlb-spray-chart";
import { LoadingState } from "@/components/common/loading-state";
import { ExternalLink, X, AlertCircle, Pencil, Check, ChevronDown, RotateCcw, BarChart3, Users, Target, Zap, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { getAllActiveSportsbooks, getSportsbookById } from "@/lib/data/sportsbooks";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import Link from "next/link";
import { useStateLink } from "@/hooks/use-state-link";
import { useMlbPlayerGameLogs } from "@/hooks/use-mlb-player-game-logs";
import { useMlbSprayChart } from "@/hooks/use-mlb-spray-chart";
import { useHitRateOdds } from "@/hooks/use-hit-rate-odds";
import type { QuickViewGameContext } from "@/lib/hit-rates/quick-view";
import type { LineHistoryApiResponse, LineHistoryBookData, LineHistoryContext, LineHistoryPoint } from "@/lib/odds/line-history";
import { LineHistoryDialog } from "@/components/opportunities/line-history-dialog";
import { IconPlus } from "@tabler/icons-react";
import { useFavorites, type AddFavoriteParams, type BookSnapshot, type Favorite } from "@/hooks/use-favorites";
import { toast } from "sonner";

// Tab type for modal navigation
type ModalTab = "gamelog" | "splits" | "matchup" | "playstyle" | "correlation";

interface OddsData {
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
  sport?: "nba" | "mlb";
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

const getMlbSeasonFromDate = (dateStr: string) => {
  const parsed = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
};

const formatQuickViewGameStatus = (status?: string | null, gameDatetime?: string | null) => {
  if (status && !/^scheduled$/i.test(status)) return status;
  if (!gameDatetime) return status || "";

  const parsed = new Date(gameDatetime);
  if (Number.isNaN(parsed.getTime())) return status || "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
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

const getMlbMarketLineLadder = (market: string, activeLine: number) => {
  const min = 0.5;
  const extendTo = (baseMax: number) => Math.max(baseMax, Math.ceil(activeLine) + 1.5);

  switch (market) {
    case "player_home_runs":
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

const formatAmericanOdds = (price?: number | null) => {
  if (price === null || price === undefined) return "-";
  return price > 0 ? `+${price}` : `${price}`;
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
    const aRank = getSharpLineHistoryRank({ bookId: a });
    const bRank = getSharpLineHistoryRank({ bookId: b });
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
        "rounded-lg border border-neutral-200/50 bg-white shadow-sm shadow-slate-200/20 dark:border-neutral-700/30 dark:bg-neutral-800/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
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
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "green" | "red" | "amber";
  accentColor?: string | null;
}) {
  const accent = normalizeHexColor(accentColor);
  return (
    <div
      className={cn(
        "min-w-0 border-r border-neutral-200/60 px-2 py-2 last:border-r-0 dark:border-neutral-700/35 sm:px-5 sm:py-3",
        accent && "relative overflow-hidden"
      )}
      style={accent ? {
        background: `linear-gradient(135deg, ${accent}24 0%, ${accent}12 48%, transparent 100%)`,
        boxShadow: `inset 0 1px 0 ${accent}22`,
      } : undefined}
    >
      <p className={cn("truncate text-[9px] font-semibold text-neutral-500 dark:text-slate-400 sm:text-[11px] sm:font-medium", accent && "dark:text-slate-300")}>{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-black leading-none tabular-nums sm:text-2xl",
          !accent && tone === "green" && "text-emerald-600 dark:text-emerald-400",
          !accent && tone === "red" && "text-red-500 dark:text-red-400",
          !accent && tone === "amber" && "text-amber-600 dark:text-amber-300",
          !accent && tone === "neutral" && "text-neutral-950 dark:text-slate-50"
        )}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[10px] text-neutral-500 dark:text-slate-400 sm:text-xs">{sub}</p>}
    </div>
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

function MlbSeasonStatsStrip({
  summary,
}: {
  summary: { label: string; stats: Array<{ label: string; value: string; sub?: string; highlight?: boolean }> };
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200/70 bg-neutral-50 shadow-sm dark:border-neutral-700/50 dark:bg-neutral-800/35 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="bg-slate-900 px-3 py-1 text-center dark:bg-slate-950">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-white">{summary.label}</span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-neutral-200/70 dark:divide-neutral-700/45">
        {summary.stats.map((stat) => (
          <div key={stat.label} className="min-w-0 px-2 py-1.5 text-center">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-500">{stat.label}</p>
            <p className={cn("mt-0.5 text-base font-black leading-none tabular-nums", stat.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-950 dark:text-white")}>
              {stat.value}
            </p>
            {stat.sub && <p className="mt-0.5 truncate text-[8px] font-medium text-neutral-500 dark:text-slate-500">{stat.sub}</p>}
          </div>
        ))}
      </div>
    </div>
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
          ? "bg-sky-100 text-sky-700 shadow-sm ring-1 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-sky-500/20"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-neutral-500 dark:hover:bg-transparent dark:hover:text-slate-400"
      )}
    >
      {children}
    </button>
  );
}

function MiniLineMovementChart({
  points,
}: {
  points: Array<{ price: number; timestamp: number }>;
}) {
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const formatRelativeLineTime = (timestamp: number, endTimestamp: number) => {
    const toMs = (value: number) => (value > 10_000_000_000 ? value : value * 1000);
    const deltaMs = Math.max(0, toMs(endTimestamp) - toMs(timestamp));
    const minutes = Math.round(deltaMs / 60_000);
    if (minutes <= 2) return "Now";
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
    };
  }, [points]);

  if (!chart) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 text-xs text-neutral-400 dark:border-neutral-700/50 dark:bg-[#111820] dark:text-slate-500">
        Not enough movement yet
      </div>
    );
  }

  const change = chart.current.price - chart.open.price;
  const strokeClass = change >= 0 ? "stroke-emerald-500" : "stroke-red-500";
  const fillClass = change >= 0 ? "fill-emerald-500" : "fill-red-500";
  const areaFill = change >= 0 ? "fill-emerald-500/15" : "fill-red-500/15";
  const changeLabel = `${change >= 0 ? "+" : ""}${change} over window`;
  const currentY = chart.yForPrice(chart.current.price);
  const hoveredPoint = hoveredPointIndex !== null ? chart.positions[hoveredPointIndex] : null;
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
    <div className="rounded-lg border border-neutral-200/70 bg-neutral-50/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-neutral-700/35 dark:bg-[#111820] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
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
            {formatRelativeLineTime(point.timestamp, chart.current.timestamp)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-neutral-200/60 pt-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-500 dark:border-neutral-700/35 dark:text-slate-500">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span>Low {formatAmericanOdds(chart.low)}</span>
          <span className="text-neutral-900 dark:text-slate-100">Last {formatAmericanOdds(chart.current.price)}</span>
          <span className={cn(change >= 0 ? "text-emerald-500" : "text-red-500")}>{changeLabel}</span>
        </div>
        <span className={cn("inline-flex items-center gap-1", change >= 0 ? "text-emerald-500" : "text-red-500")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", change >= 0 ? "bg-emerald-500" : "bg-red-500")} />
          {chart.positions.length} line entries
        </span>
      </div>
    </div>
  );
}

function EmptyMiniLineMovementChart({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-neutral-200/70 bg-neutral-50/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-neutral-700/35 dark:bg-[#111820] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
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
        const aRank = getSharpLineHistoryRank(a);
        const bRank = getSharpLineHistoryRank(b);
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
  }, [activeLine, bookOffers]);
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
  const hasMoreBookRows = bookRows.length > 6;
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
    if (!selectedHistoryBook) return null;
    return bookOffers.find((offer) => (
      offer.side === lineHistorySide
      && Math.abs(offer.line - activeLine) < 0.01
      && isSameLineHistorySportsbook(offer.book, selectedHistoryBook)
    )) ?? null;
  }, [activeLine, bookOffers, lineHistorySide, selectedHistoryBook]);
  const syncedHistoryEntries = useMemo(() => {
    return selectedHistoryBook
      ? syncLineHistoryWithLivePrice(selectedHistoryBook.entries, selectedHistoryLiveOffer?.price ?? selectedHistoryBook.currentPrice)
      : [];
  }, [selectedHistoryBook, selectedHistoryLiveOffer?.price]);

  return (
    <aside className="flex min-h-0 flex-col gap-2.5 lg:sticky lg:top-0 lg:h-full lg:max-h-full lg:self-stretch lg:overflow-hidden">
      <MlbGlassPanel className="shrink-0">
        <div className="border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-900 dark:text-white">Bet Context</h3>
        </div>
        <div className="space-y-2.5 px-4 py-3">
          {betNotes.map((note, idx) => (
            <div key={note} className="flex gap-2 text-xs leading-relaxed text-neutral-600 dark:text-slate-300">
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

      <MlbGlassPanel className="flex min-h-[180px] flex-1 flex-col overflow-hidden lg:min-h-0">
        <div className="border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-900 dark:text-white">Best Books</h3>
            {hasMoreBookRows && (
              <span className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-400 dark:text-slate-500">
                Scroll for more
              </span>
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
          <div className="grid grid-cols-[minmax(0,1fr)_86px_86px] gap-2 px-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-500">
            {renderBookSortHeader("book", "Book", "justify-self-start")}
            {renderBookSortHeader("over", "Over", "justify-self-end")}
            {renderBookSortHeader("under", "Under", "justify-self-end")}
          </div>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5 scrollbar-hide">
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
                    "grid min-h-[46px] grid-cols-[minmax(0,1fr)_86px_86px] items-center gap-2 border-b border-neutral-200/50 px-1 py-1.5 text-sm last:border-b-0 dark:border-neutral-700/25",
                    (row.over?.isBest || row.under?.isBest) && "bg-emerald-500/[0.035]"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {sb?.image?.light && <img src={sb.image.light} alt={sb.name} className="h-4 w-4 rounded object-contain" />}
                    <span className="truncate font-semibold text-neutral-700 dark:text-slate-200">{sb?.name ?? row.book}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!overLink}
                    title={overLink ? `Open ${sb?.name ?? row.book} over odds` : undefined}
                    onClick={() => overLink && window.open(overLink, "_blank", "noopener,noreferrer")}
                    className={cn(
                      "group relative inline-flex h-8 min-w-[76px] items-center justify-center overflow-hidden rounded-md border text-right font-mono text-[13px] font-bold tabular-nums shadow-sm transition active:scale-[0.98] disabled:cursor-default dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
                      row.over?.isBest
                        ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-300"
                        : "border-neutral-200/70 bg-white/70 text-neutral-800 hover:border-sky-400/50 hover:bg-sky-50/80 dark:border-neutral-700/50 dark:bg-neutral-900/50 dark:text-slate-200 dark:hover:border-sky-500/45 dark:hover:bg-sky-500/10",
                      !row.over && "border-transparent bg-transparent text-neutral-300 shadow-none dark:text-slate-700"
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
                        ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-300"
                        : "border-neutral-200/70 bg-white/70 text-neutral-800 hover:border-sky-400/50 hover:bg-sky-50/80 dark:border-neutral-700/50 dark:bg-neutral-900/50 dark:text-slate-200 dark:hover:border-sky-500/45 dark:hover:bg-sky-500/10",
                      !row.under && "border-transparent bg-transparent text-neutral-300 shadow-none dark:text-slate-700"
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
              <div className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-500 dark:border-neutral-700/50 dark:text-slate-500">
                No live books attached to this selection.
              </div>
            )}
          </div>
        </div>
      </MlbGlassPanel>

      <MlbGlassPanel className="shrink-0">
        <div className="border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-900 dark:text-white">Line Movement</h3>
            <button
              type="button"
              disabled={!canOpenLineHistory}
              onClick={onOpenLineHistory}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition active:scale-[0.98]",
                canOpenLineHistory
                  ? "border-neutral-200/70 text-neutral-600 hover:border-sky-400/60 hover:bg-sky-50 hover:text-sky-700 dark:border-neutral-700/50 dark:text-slate-300 dark:hover:border-sky-500/45 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
                  : "cursor-not-allowed border-neutral-200/40 text-neutral-300 dark:border-neutral-800 dark:text-slate-700"
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
              <div className="rounded-lg border border-neutral-200/70 bg-neutral-50/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-neutral-700/35 dark:bg-neutral-800/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                <div className="h-[150px] animate-pulse rounded-md bg-neutral-200/55 dark:bg-neutral-700/45" />
                <div className="mt-3 flex items-center justify-between border-t border-neutral-200/60 pt-2 dark:border-neutral-700/35">
                  <div className="h-3 w-28 animate-pulse rounded bg-neutral-200/70 dark:bg-neutral-700/55" />
                  <div className="h-3 w-20 animate-pulse rounded bg-neutral-200/70 dark:bg-neutral-700/55" />
                </div>
              </div>
            </div>
          ) : selectedHistoryBook ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-neutral-200/50 pb-2 dark:border-neutral-700/25">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 dark:text-slate-500">
                    Book
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="group flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-neutral-200/70 bg-white px-2.5 text-left text-xs font-bold text-neutral-800 shadow-sm outline-none transition hover:border-sky-400/50 hover:bg-sky-50/70 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15 data-[state=open]:border-sky-400 data-[state=open]:ring-2 data-[state=open]:ring-sky-400/15 dark:border-neutral-700/45 dark:bg-neutral-900/65 dark:text-slate-100 dark:hover:border-sky-500/45 dark:hover:bg-sky-500/10 dark:focus:border-sky-500 dark:data-[state=open]:border-sky-500"
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
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition group-data-[state=open]:rotate-180 dark:text-slate-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="max-h-72 rounded-lg border border-neutral-200/70 bg-white p-1.5 shadow-xl shadow-slate-950/10 ring-0 dark:border-neutral-700/50 dark:bg-[#0f1720] dark:shadow-black/30"
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
                              "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs font-bold text-neutral-700 focus:bg-sky-50 focus:text-neutral-950 dark:text-slate-300 dark:focus:bg-sky-500/10 dark:focus:text-white",
                              isSelected && "bg-sky-50 text-neutral-950 dark:bg-sky-500/10 dark:text-white"
                            )}
                          >
                            {sb?.image?.light ? (
                              <img src={sb.image.light} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                            ) : (
                              <span className="h-4 w-4 shrink-0 rounded bg-neutral-200 dark:bg-neutral-700" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{book.bookName}</span>
                            {isSharp && (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.06em] text-emerald-600 dark:text-emerald-300">
                                Sharp
                              </span>
                            )}
                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
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
                        className="group inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200/70 bg-white px-2.5 font-mono text-[10px] font-bold tabular-nums text-neutral-600 shadow-sm outline-none transition hover:border-sky-400/50 hover:bg-sky-50/70 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15 data-[state=open]:border-sky-400 data-[state=open]:ring-2 data-[state=open]:ring-sky-400/15 dark:border-neutral-700/45 dark:bg-neutral-900/65 dark:text-slate-300 dark:hover:border-sky-500/45 dark:hover:bg-sky-500/10 dark:focus:border-sky-500"
                      >
                        {selectedLineOption}+
                        <ChevronDown className="h-3 w-3 text-neutral-400 transition group-data-[state=open]:rotate-180 dark:text-slate-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onWheelCapture={(event) => event.stopPropagation()}
                      className="max-h-64 min-w-24 overflow-y-auto overscroll-contain rounded-lg border border-neutral-200/70 bg-white p-1.5 shadow-xl shadow-slate-950/10 ring-0 scrollbar-hide dark:border-neutral-700/50 dark:bg-[#0f1720] dark:shadow-black/30"
                    >
                      {lineOptions.map((line) => {
                        const isSelected = Math.abs(line - activeLine) < 0.01;
                        return (
                          <DropdownMenuItem
                            key={line}
                            onSelect={() => onLineChange(line)}
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 font-mono text-[11px] font-bold tabular-nums text-neutral-700 focus:bg-sky-50 focus:text-neutral-950 dark:text-slate-300 dark:focus:bg-sky-500/10 dark:focus:text-white",
                              isSelected && "bg-sky-50 text-neutral-950 dark:bg-sky-500/10 dark:text-white"
                            )}
                          >
                            {line}+
                            {isSelected && <Check className="h-3.5 w-3.5 text-sky-500" />}
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
                        className="group inline-flex h-8 w-9 items-center justify-center rounded-md border border-neutral-200/70 bg-white font-mono text-[11px] font-black uppercase text-neutral-600 shadow-sm outline-none transition hover:border-sky-400/50 hover:bg-sky-50/70 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15 data-[state=open]:border-sky-400 data-[state=open]:ring-2 data-[state=open]:ring-sky-400/15 dark:border-neutral-700/45 dark:bg-neutral-900/65 dark:text-slate-300 dark:hover:border-sky-500/45 dark:hover:bg-sky-500/10 dark:focus:border-sky-500"
                      >
                        {lineHistorySide === "over" ? "O" : "U"}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-24 rounded-lg border border-neutral-200/70 bg-white p-1.5 shadow-xl shadow-slate-950/10 ring-0 dark:border-neutral-700/50 dark:bg-[#0f1720] dark:shadow-black/30"
                    >
                      {(["over", "under"] as const).map((side) => (
                        <DropdownMenuItem
                          key={side}
                          onSelect={() => onLineHistorySideChange(side)}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-700 focus:bg-sky-50 focus:text-neutral-950 dark:text-slate-300 dark:focus:bg-sky-500/10 dark:focus:text-white",
                            side === lineHistorySide && "bg-sky-50 text-neutral-950 dark:bg-sky-500/10 dark:text-white"
                          )}
                        >
                          <span><span className="font-black">{side === "over" ? "O" : "U"}</span> {side}</span>
                          {side === lineHistorySide && <Check className="h-3.5 w-3.5 text-sky-500" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div>
                {syncedHistoryEntries.length >= 2 ? (
                  <MiniLineMovementChart points={syncedHistoryEntries} />
                ) : (
                  <EmptyMiniLineMovementChart message="No historical odds available for this book, side, and line yet." />
                )}
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-slate-500">
                {syncedHistoryEntries.length < 2
                  ? "Try another book, side, or line to view historical movement."
                  : selectedHistoryLiveOffer
                  ? `Synced to live Best Books price ${formatAmericanOdds(selectedHistoryLiveOffer.price)}`
                  : `Updated ${formatLineHistoryTime(selectedHistoryBook.entries.at(-1)?.timestamp)}`}
              </p>
              <div className="border-t border-neutral-200/60 pt-3 dark:border-neutral-700/35">
                <button
                  type="button"
                  disabled={isFavoriteSaving || (!canSaveFavorite && isFavoriteLoggedIn)}
                  onClick={onToggleFavorite}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition active:scale-[0.99]",
                    isFavoriteSaved
                      ? "border-sky-400/45 bg-sky-500/85 hover:bg-sky-500"
                      : "border-emerald-400/40 bg-emerald-500/85 hover:bg-emerald-500",
                    (isFavoriteSaving || (!canSaveFavorite && isFavoriteLoggedIn)) && "cursor-not-allowed opacity-60"
                  )}
                >
                  {isFavoriteSaved ? "Saved to Betslip" : "Add to Betslip"}
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/50">
                    {isFavoriteSaved ? <Check className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" stroke={2.4} />}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center text-xs leading-relaxed text-neutral-500 dark:border-neutral-700/50 dark:text-slate-500">
                {lineHistoryError?.message || "Line movement will appear when historical odds are available for this book."}
              </div>
              <div className="border-t border-neutral-200/60 pt-3 dark:border-neutral-700/35">
                <button
                  type="button"
                  disabled={isFavoriteSaving || (!canSaveFavorite && isFavoriteLoggedIn)}
                  onClick={onToggleFavorite}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition active:scale-[0.99]",
                    isFavoriteSaved
                      ? "border-sky-400/45 bg-sky-500/85 hover:bg-sky-500"
                      : "border-emerald-400/40 bg-emerald-500/85 hover:bg-emerald-500",
                    (isFavoriteSaving || (!canSaveFavorite && isFavoriteLoggedIn)) && "cursor-not-allowed opacity-60"
                  )}
                >
                  {isFavoriteSaved ? "Saved to Betslip" : "Add to Betslip"}
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/50">
                    {isFavoriteSaved ? <Check className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" stroke={2.4} />}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </MlbGlassPanel>
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
  const [lineHistoryDialogOpen, setLineHistoryDialogOpen] = useState(false);
  const [lineHistorySide, setLineHistorySide] = useState<MlbLineHistorySide>("over");

  useEffect(() => {
    if (!open) setLineHistoryDialogOpen(false);
  }, [open]);

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

  // Use direct ID if provided, otherwise use looked up ID
  const nba_player_id = directNbaPlayerId || lookupData?.player?.nba_player_id || undefined;
  const mlb_player_id = directMlbPlayerId || lookupData?.player?.mlb_player_id || undefined;
  const resolvedPlayerId = isMlb ? mlb_player_id : nba_player_id;
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

  // Limit box scores to last 25 games for faster loading
  const { games: boxScoreGames, seasonSummary, isLoading: isLoadingBoxScores } = usePlayerBoxScores({
    playerId: nba_player_id || null,
    enabled: !isMlb && open && !!nba_player_id,
    limit: 25, // Only fetch last 25 games for modal (full drilldown can load more)
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
      : fallbackMarkets;
    const safeInitialMarket = initial_market && (!isMlb || isMlbPitcherMarketKey(initial_market) === isMlbPitcherProfile)
      ? initial_market
      : null;
    const uniqueMarkets = Array.from(new Set([safeInitialMarket, ...profileMarkets].filter(Boolean) as string[]));
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
        
        return { ln: line.ln, over: bestOver, under: bestUnder, books };
      }) as AlternateLineOdds[];
    },
    enabled: open && !!event_id && !!playerKey,
    staleTime: 30_000, // 30 seconds - odds can change
    gcTime: 5 * 60_000, // 5 minutes
  });
  const alternateLines = alternatesData || [];

  // Line state - initialize with initial_line if provided (e.g., from edge finder)
  const [customLine, setCustomLine] = useState<number | null>(initial_line ?? null);
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

  // Update customLine when initial_line changes (e.g., clicking different player in edge finder)
  useEffect(() => {
    if (initial_line !== undefined && initial_line !== null) {
      setCustomLine(initial_line);
    }
  }, [initial_line]);

  const externalOddsMarket = initial_market || availableMarkets[0] || null;
  const canUseExternalOdds = !isMlb || !externalOddsMarket || currentMarket === externalOddsMarket;
  
  const defaultLine = useMemo(() => {
    // Priority: profile line -> odds line -> calculated from box scores
    if (currentMarketProfile?.line) return currentMarketProfile.line;
    if (canUseExternalOdds && odds?.over?.line) return odds.over.line;
    if (canUseExternalOdds && odds?.under?.line) return odds.under.line;
    if (alternateLines.length > 0) {
      const deepestLine = [...alternateLines].sort((a, b) => {
        const bookDelta = getAlternateLineBookCount(b) - getAlternateLineBookCount(a);
        if (bookDelta !== 0) return bookDelta;
        return a.ln - b.ln;
      })[0];
      if (deepestLine) return deepestLine.ln;
    }
    if (modalGames.length === 0) return isMlb ? 1 : 10;
    const recentGames = modalGames.slice(0, 10);
    const avg = recentGames.reduce((sum, g) => sum + getMarketStat(g, currentMarket), 0) / recentGames.length;
    return Math.round(avg * 2) / 2;
  }, [currentMarketProfile, canUseExternalOdds, odds, alternateLines, modalGames, currentMarket, isMlb]);

  const activeLine = customLine ?? defaultLine;
  const activeHitRateOdds = getHitRateOdds(currentMarketProfile?.selKey || currentMarketProfile?.oddsSelectionId || null);
  const activeHitRateLine = useMemo(() => {
    if (!activeHitRateOdds?.allLines?.length) return null;
    const exact = activeHitRateOdds.allLines.find((line) => line.line === activeLine);
    if (exact) return exact;
    const sorted = [...activeHitRateOdds.allLines].sort((a, b) => Math.abs(a.line - activeLine) - Math.abs(b.line - activeLine));
    return sorted[0] && Math.abs(sorted[0].line - activeLine) <= 1.5 ? sorted[0] : null;
  }, [activeHitRateOdds, activeLine]);
  const activeAlternateLine = useMemo(() => {
    if (alternateLines.length === 0) return null;
    const exact = alternateLines.find((line) => Math.abs(line.ln - activeLine) < 0.01);
    if (exact) return exact;
    const closest = [...alternateLines].sort((a, b) => Math.abs(a.ln - activeLine) - Math.abs(b.ln - activeLine))[0];
    return closest && Math.abs(closest.ln - activeLine) <= 1.5 ? closest : null;
  }, [activeLine, alternateLines]);

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
      return {
        over: activeHitRateLine.bestOver ? {
          price: activeHitRateLine.bestOver.price,
          line: activeHitRateLine.line,
          book: activeHitRateLine.bestOver.book,
          mobileLink: activeHitRateLine.bestOver.mobileUrl || activeHitRateLine.bestOver.url,
        } : undefined,
        under: activeHitRateLine.bestUnder ? {
          price: activeHitRateLine.bestUnder.price,
          line: activeHitRateLine.line,
          book: activeHitRateLine.bestUnder.book,
          mobileLink: activeHitRateLine.bestUnder.mobileUrl || activeHitRateLine.bestUnder.url,
        } : undefined,
      };
    }
    
    // Fall back to original odds ONLY if we haven't changed markets
    // (i.e., customLine is null and odds line matches defaultLine)
    if (customLine === null && odds && canUseExternalOdds) {
      const oddsLine = odds.over?.line ?? odds.under?.line;
      if (oddsLine === defaultLine) {
        return odds;
      }
    }
    
    // No odds available for this market/line
    return null;
  }, [activeAlternateLine, activeHitRateLine, canUseExternalOdds, customLine, defaultLine, odds]);

  const bookOffers = useMemo<MlbBookOffer[]>(() => {
    const callerOffers: MlbBookOffer[] = canUseExternalOdds ? (liveBookOffers ?? [])
      .filter((offer) => offer.book && Number.isFinite(offer.price))
      .map((offer) => ({
        side: offer.side,
        book: offer.book,
        price: offer.price,
        line: offer.line ?? activeLine,
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
          line: activeOdds.over.line,
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
          line: activeOdds.under.line,
          url: null,
          mobileUrl: activeOdds.under.mobileLink ?? null,
          isBest: true,
          evPercent: null,
          isSharpRef: false,
          sgp: null,
          oddId: null,
        });
      }
      return mergeOffers(callerOffers, [...alternateOffers, ...fallback]);
    }

    const offers: MlbBookOffer[] = [];
    Object.entries(activeHitRateLine.books).forEach(([book, sides]) => {
      if (sides.over) {
        offers.push({
          side: "over",
          book,
          price: sides.over.price,
          line: activeHitRateLine.line,
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
          line: activeHitRateLine.line,
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

    return mergeOffers(callerOffers, [...alternateOffers, ...offers]);
  }, [activeAlternateLine, activeHitRateLine, activeOdds, activeLine, canUseExternalOdds, liveBookOffers]);

  const rightRailLineOptions = useMemo(() => {
    const lines = new Set<number>();
    const addLine = (line?: number | null) => {
      if (typeof line === "number" && Number.isFinite(line)) {
        lines.add(Math.round(line * 10) / 10);
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
      oddsLine: activeOdds.over?.line || activeOdds.under?.line || activeLine,
      isClosestLine: false,
    };
  }, [activeOdds, activeLine]);

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
    if (isMlb && (activeTab === "correlation" || activeTab === "matchup" || activeTab === "playstyle")) {
      setActiveTab("gamelog");
    }
  }, [activeTab, isMlb]);

  useEffect(() => {
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
    if (!seasonSummary) return null;
    return {
      label: "Season Averages",
      stats: [
        { label: "PTS", value: seasonSummary.avgPoints.toFixed(1), highlight: true },
        { label: "REB", value: seasonSummary.avgRebounds.toFixed(1) },
        { label: "AST", value: seasonSummary.avgAssists.toFixed(1) },
        { label: "FG%", value: seasonSummary.fgPct.toFixed(1) },
      ],
    };
  }, [isMlb, mlbSeasonSummary, seasonSummary]);

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
  const displayTeam = profile?.teamAbbr || playerInfo?.team_abbr || "";
  const displayPosition = profile?.position || playerInfo?.depth_chart_pos || playerInfo?.position || "";
  const displayJersey = profile?.jerseyNumber || playerInfo?.jersey_number;
  const teamLogoSport = isMlb ? "mlb" : "nba";
  const fullProfilePlayerId = profile?.playerId || resolvedPlayerId;
  const fullProfileHref = fullHitRateHref;
  const nextGame = useMemo<QuickViewGameContext | null>(() => {
    if (gameContext?.gameDate && gameContext.opponentTeamAbbr) {
      return {
        gameDate: gameContext.gameDate,
        gameDatetime: gameContext.gameDatetime ?? null,
        gameStatus: gameContext.gameStatus ?? null,
        homeAway: gameContext.homeAway ?? null,
        opponentTeamAbbr: gameContext.opponentTeamAbbr,
        opposingPitcherName: gameContext.opposingPitcherName ?? null,
      };
    }

    if (!profile?.gameDate) return null;
    return {
      gameDate: profile.gameDate,
      gameDatetime: profile.startTime ?? null,
      gameStatus: profile.gameStatus ?? null,
      homeAway: profile.homeAway === "H" || profile.homeAway === "A" ? profile.homeAway : null,
      opponentTeamAbbr: profile.opponentTeamAbbr ?? null,
      opposingPitcherName: null,
    };
  }, [gameContext, profile?.gameDate, profile?.gameStatus, profile?.homeAway, profile?.opponentTeamAbbr, profile?.startTime]);
  const nextGameDetail = nextGame?.opposingPitcherName
    || (isMlb && !isMlbPitcher ? "TBD" : formatQuickViewGameStatus(nextGame?.gameStatus, nextGame?.gameDatetime));
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
  const spraySeason = mlbLogSeason ?? new Date().getFullYear();
  const { data: mlbSprayData, isLoading: isLoadingMlbSpray } = useMlbSprayChart({
    playerId: isMlb && !isMlbPitcher ? fullProfilePlayerId ?? null : null,
    gameId: profile?.gameId ? Number(profile.gameId) : null,
    seasons: [spraySeason],
    enabled: isMlb && !isMlbPitcher && !!fullProfilePlayerId,
  });
  const battedBallSummary = useMemo(() => {
    const events = (mlbSprayData?.events ?? []).filter((event) => event.season === spraySeason);
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

    return {
      total,
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
    };
  }, [mlbSprayData?.events, spraySeason]);
  const modalTabs = isMlb
    ? [
        { id: "gamelog" as const, label: "Game Log", mobileLabel: "Log", icon: BarChart3, proOnly: false },
        { id: "splits" as const, label: "Splits", mobileLabel: "Splits", icon: Users, proOnly: false, disabled: true, soon: true },
        { id: "matchup" as const, label: "Matchup", mobileLabel: "Match", icon: Target, proOnly: true, disabled: true, soon: true },
        ...(!isMlbPitcher
          ? [{ id: "playstyle" as const, label: "Batted Ball", mobileLabel: "Batted", icon: Zap, proOnly: true, disabled: true, soon: true }]
          : []),
      ]
    : [
        { id: "gamelog" as const, label: "Game Log", mobileLabel: "Log", icon: BarChart3, proOnly: false },
        { id: "matchup" as const, label: "Matchup", mobileLabel: "Match", icon: Target, proOnly: true },
        { id: "playstyle" as const, label: "Play Style", mobileLabel: "Style", icon: Zap, proOnly: true },
        { id: "correlation" as const, label: "Correlation", mobileLabel: "Corr", icon: Users, proOnly: true },
      ];

  const handleLineEdit = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val)) setCustomLine(val);
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
        <DialogContent className="w-full max-w-[96vw] lg:max-w-[1420px] max-h-[94vh] overflow-hidden rounded-xl border border-neutral-200/50 bg-white p-0 text-neutral-950 shadow-2xl ring-1 ring-black/5 dark:border-neutral-700/40 dark:bg-[#050a0f] dark:text-slate-100 dark:ring-white/5">
          {isLoading ? (
            <div className="px-6 py-24">
              <DialogTitle className="sr-only">Loading Player Profile</DialogTitle>
              <LoadingState message="Loading player profile..." />
            </div>
          ) : !hasData ? (
            <div className="px-6 py-24 text-center">
              <DialogTitle className="text-lg font-semibold text-neutral-950 dark:text-white">Player Not Found</DialogTitle>
              <p className="mt-2 text-sm text-neutral-500 dark:text-slate-400">Unable to load data for this player.</p>
            </div>
          ) : (
            <div className="flex h-[94vh] max-h-[94vh] flex-col overflow-hidden bg-neutral-50 dark:bg-[#050a0f]">
              <div className="shrink-0 border-b border-neutral-200/50 bg-white px-4 py-3 dark:border-neutral-700/35 dark:bg-[#080f16] sm:px-6 lg:pr-12">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200/50 bg-neutral-100 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <PlayerHeadshot
                        nbaPlayerId={null}
                        mlbPlayerId={resolvedPlayerId ?? null}
                        sport={sport}
                        name={displayName}
                        size="small"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <DialogTitle className="truncate text-2xl font-black tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
                        {displayName}
                      </DialogTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-500 dark:text-slate-400">
                        {displayTeam && <span>{displayTeam}</span>}
                        {displayPosition && <><span className="text-neutral-300 dark:text-slate-600">•</span><span>{displayPosition}</span></>}
                        {displayJersey && <><span className="text-neutral-300 dark:text-slate-600">•</span><span>#{displayJersey}</span></>}
                      </div>
                      {nextGame && (
                        <div className="mt-2 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-1 text-xs text-neutral-600 dark:bg-emerald-400/[0.06] dark:text-slate-300">
                          <span className="inline-flex items-center gap-1.5 font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            Next
                          </span>
                          {nextGame.opponentTeamAbbr && (
                            <>
                              <span className="text-neutral-300 dark:text-slate-600">{nextGame.homeAway === "H" ? "vs" : "@"}</span>
                              <span className="inline-flex items-center gap-1.5">
                                {nextGame.opponentTeamAbbr && (
                                  <img
                                    src={getTeamLogoUrl(nextGame.opponentTeamAbbr, "mlb")}
                                    alt={nextGame.opponentTeamAbbr}
                                    className="h-4 w-4 object-contain"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  />
                                )}
                                {nextGame.opponentTeamAbbr}
                              </span>
                            </>
                          )}
                          {nextGameDetail && (
                            <>
                              <span className="text-neutral-300 dark:text-slate-600">•</span>
                              <span className="truncate">{nextGameDetail}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {headerSeasonSummary && (
                      <MlbSeasonStatsStrip summary={headerSeasonSummary} />
                    )}
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-hide sm:px-6 lg:overflow-hidden">
                <div className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <main className="min-w-0 lg:min-h-0">
                    <MlbGlassPanel className="overflow-visible lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                      <div className="flex flex-col gap-2 border-b border-neutral-200/50 px-2.5 py-2 dark:border-neutral-700/30 sm:gap-3 sm:px-3 sm:py-2.5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 gap-5 overflow-x-auto scrollbar-hide sm:gap-7">
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
                                  "relative flex h-10 shrink-0 items-center gap-1.5 text-xs font-semibold transition sm:h-11 sm:gap-2 sm:text-sm",
                                  isDisabled
                                    ? "cursor-not-allowed text-neutral-400 dark:text-slate-600"
                                    : isActive
                                      ? "text-neutral-950 dark:text-white"
                                      : "text-neutral-500 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-slate-200"
                                )}
                              >
                                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span>{tab.id === "matchup" ? "Pitcher" : tab.id === "playstyle" ? "Batted Ball" : tab.label.replace("Game ", "")}</span>
                                {"soon" in tab && tab.soon && <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-black text-neutral-500 dark:bg-slate-700 dark:text-slate-300">SOON</span>}
                                {isActive && <span className="absolute bottom-[-9px] left-0 h-0.5 w-full rounded-full bg-sky-500 sm:bottom-[-11px]" />}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:grid-cols-2 xl:w-[360px]">
                          <div className="relative" ref={marketDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
                              className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50 px-2.5 text-left shadow-sm transition hover:border-sky-300/70 active:scale-[0.99] dark:border-neutral-700/50 dark:bg-neutral-800/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:border-sky-500/50 sm:h-10 sm:px-3"
                            >
                              <span className="min-w-0">
                                <span className="block text-[8px] font-bold uppercase leading-none tracking-wide text-neutral-500 dark:text-slate-500 sm:text-[9px]">Prop</span>
                                <span className="mt-0.5 block truncate text-xs font-black leading-tight text-neutral-950 dark:text-white sm:text-sm">{formatMarketLabel(currentMarket)}</span>
                              </span>
                              <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isMarketDropdownOpen && "rotate-180")} />
                            </button>
                            {isMarketDropdownOpen && (
                              <div className="absolute left-0 top-full z-50 mt-2 max-h-[280px] min-w-[220px] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1.5 shadow-2xl dark:border-neutral-700/50 dark:bg-[#080f16]">
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
                                      m === currentMarket ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "text-neutral-700 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-800"
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
                                className="flex h-9 items-center justify-between gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50 px-2.5 text-left shadow-sm transition hover:border-sky-300/70 active:scale-[0.99] dark:border-neutral-700/50 dark:bg-neutral-800/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:border-sky-500/50 sm:h-10 sm:px-3"
                              >
                                <span className="min-w-0">
                                  <span className="block text-[8px] font-bold uppercase leading-none tracking-wide text-neutral-500 dark:text-slate-500 sm:text-[9px]">Line</span>
                                  <span className="mt-0.5 block text-xs font-black leading-tight text-neutral-950 dark:text-white sm:text-sm">{activeLine}+</span>
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onWheelCapture={(event) => event.stopPropagation()}
                              className="z-[300] max-h-72 min-w-[160px] overflow-y-auto overscroll-contain rounded-lg border-neutral-200 bg-white p-1.5 shadow-2xl scrollbar-hide dark:border-neutral-700/50 dark:bg-[#080f16]"
                            >
                              {rightRailLineOptions.map((line) => {
                                const isSelected = Math.abs(line - activeLine) < 0.01;
                                return (
                                  <DropdownMenuItem
                                    key={line}
                                    onSelect={() => {
                                      setCustomLine(line);
                                      setIsEditingLine(false);
                                    }}
                                    className={cn(
                                      "cursor-pointer rounded-md px-3 py-2 text-sm font-black tabular-nums",
                                      isSelected
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                        : "text-neutral-700 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-800"
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
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
                            <div>
                              <h3 className="text-sm font-black text-neutral-950 dark:text-white">Recent Games <span className="font-medium text-neutral-500 dark:text-slate-400">({formatMarketLabel(currentMarket)})</span></h3>
                            </div>
                            <div className="flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5 dark:border-slate-800 dark:bg-slate-950">
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
                                onLineChange={setCustomLine}
                                odds={oddsForChart}
                                profileGameLogs={profile?.gameLogs as any}
                              />
                            ) : (
                              <div className="py-12 text-center text-sm text-neutral-500 dark:text-slate-400">No game data available for these filters</div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wide text-neutral-400 dark:text-slate-500">Location</span>
                              <div className="flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5 dark:border-slate-800 dark:bg-slate-950">
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
                              <span className="text-[10px] font-black uppercase tracking-wide text-neutral-400 dark:text-slate-500">Time</span>
                              <div className="flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5 dark:border-slate-800 dark:bg-slate-950">
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
                        </MlbGlassPanel>

                        {fullProfilePlayerId && (
                          <BoxScoreTable
                            sport={sport}
                            playerId={fullProfilePlayerId}
                            market={currentMarket}
                            currentLine={activeLine}
                            prefetchedGames={filteredGames}
                          />
                        )}
                      </>
                    )}

                    {activeTab === "playstyle" && !isMlbPitcher && (
                      <>
                        <MlbGlassPanel className="grid grid-cols-2 overflow-hidden md:grid-cols-4">
                          <MlbMetricTile label="Hard Hit" value={battedBallSummary.hardHitPct !== null ? `${battedBallSummary.hardHitPct}%` : "-"} sub={`${battedBallSummary.total} tracked balls`} tone="neutral" />
                          <MlbMetricTile label="Avg Exit Velo" value={battedBallSummary.avgEv !== null ? `${battedBallSummary.avgEv.toFixed(1)} mph` : "-"} sub="2026 sample" tone="neutral" />
                          <MlbMetricTile label="Barrel %" value={battedBallSummary.barrelPct !== null ? `${battedBallSummary.barrelPct}%` : "-"} sub="Barrels / BBE" tone="neutral" />
                          <MlbMetricTile label="Launch Angle" value={battedBallSummary.avgLa !== null ? `${battedBallSummary.avgLa.toFixed(1)}°` : "-"} sub="Average" tone="neutral" />
                        </MlbGlassPanel>

                        <div className="grid gap-3 xl:grid-cols-[1fr_1.25fr]">
                          <MlbGlassPanel className="overflow-hidden">
                            <div className="border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
                              <h3 className="text-xs font-black uppercase tracking-wide text-neutral-700 dark:text-slate-300">Spray Distribution</h3>
                            </div>
                            <div className="p-3">
                              <MlbSprayChart
                                playerId={fullProfilePlayerId ?? null}
                                gameId={profile?.gameId ? Number(profile.gameId) : null}
                                battingHand={profile?.battingHand}
                              />
                            </div>
                          </MlbGlassPanel>

                          <div className="space-y-3">
                            <MlbGlassPanel>
                              <div className="border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
                                <h3 className="text-xs font-black uppercase tracking-wide text-neutral-700 dark:text-slate-300">Exit Velocity Breakdown</h3>
                              </div>
                              <div className="space-y-3 px-4 py-4">
                                {battedBallSummary.evBuckets.map((bucket) => (
                                  <div key={bucket.label}>
                                    <div className="mb-1 flex justify-between text-xs text-neutral-500 dark:text-slate-400">
                                      <span>{bucket.label} mph</span>
                                      <span className="font-bold tabular-nums text-neutral-950 dark:text-white">{isLoadingMlbSpray ? "-" : `${bucket.value}%`}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-slate-800">
                                      <div className={cn("h-full rounded-full", bucket.className)} style={{ width: `${bucket.value}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </MlbGlassPanel>

                            <MlbGlassPanel>
                              <div className="border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
                                <h3 className="text-xs font-black uppercase tracking-wide text-neutral-700 dark:text-slate-300">Launch Angle Breakdown</h3>
                              </div>
                              <div className="space-y-3 px-4 py-4">
                                {battedBallSummary.launchBuckets.map((bucket) => (
                                  <div key={bucket.label}>
                                    <div className="mb-1 flex justify-between text-xs text-neutral-500 dark:text-slate-400">
                                      <span>{bucket.label}°</span>
                                      <span className="font-bold tabular-nums text-neutral-950 dark:text-white">{isLoadingMlbSpray ? "-" : `${bucket.value}%`}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-slate-800">
                                      <div className={cn("h-full rounded-full", bucket.className)} style={{ width: `${bucket.value}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </MlbGlassPanel>
                          </div>
                        </div>

                        <MlbGlassPanel className="overflow-hidden">
                          <div className="border-b border-neutral-200/50 px-4 py-3 dark:border-neutral-700/30">
                            <h3 className="text-sm font-black text-neutral-950 dark:text-white">Recent Games <span className="font-medium text-neutral-500 dark:text-slate-400">({formatMarketLabel(currentMarket)})</span></h3>
                          </div>
                          <div className="px-3 py-3">
                            <GameLogChart
                              games={filteredGames.length > 0 ? filteredGames : chartBaseGames.slice(0, 10)}
                              market={currentMarket}
                              sport={sport}
                              line={activeLine}
                              onLineChange={setCustomLine}
                              odds={oddsForChart}
                            />
                          </div>
                        </MlbGlassPanel>

                        {fullProfilePlayerId && (
                          <BoxScoreTable
                            sport={sport}
                            playerId={fullProfilePlayerId}
                            market={currentMarket}
                            currentLine={activeLine}
                            prefetchedGames={filteredGames}
                          />
                        )}
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
                      setCustomLine(line);
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
                STICKY HEADER - Premium Design
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-white to-white/95 dark:from-neutral-950 dark:to-neutral-950/95 backdrop-blur-xl border-b border-neutral-200/50 dark:border-neutral-800/80">
              {/* Top Section - Player Info + Season Stats */}
              <div 
                className="relative overflow-hidden"
                style={{ 
                  background: profile?.primaryColor 
                    ? `linear-gradient(135deg, ${profile.primaryColor}20 0%, ${profile.primaryColor}05 40%, transparent 70%)`
                    : undefined
                }}
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-white/50 dark:via-neutral-950/30 dark:to-neutral-950/50" />
                
                {/* Close button */}
                <button
                  onClick={() => onOpenChange(false)}
                  className="absolute top-3 right-3 p-2 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-white/80 dark:hover:text-white dark:hover:bg-neutral-800/80 transition-all hover:scale-105 active:scale-95 z-10 backdrop-blur-sm"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="relative px-4 sm:px-6 pt-5 pb-4">
                  <div className="flex items-start gap-4">
                    {/* Left: Headshot + Basic Info */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div 
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden shadow-xl shrink-0 ring-2 ring-white dark:ring-neutral-700 transition-transform hover:scale-105"
                        style={{ 
                          background: profile?.primaryColor && profile?.secondaryColor 
                            ? `linear-gradient(180deg, ${profile.primaryColor} 0%, ${profile.secondaryColor} 100%)`
                            : profile?.primaryColor || '#374151'
                        }}
                      >
                        <PlayerHeadshot
                          nbaPlayerId={nba_player_id || null}
                          mlbPlayerId={isMlb ? resolvedPlayerId ?? null : null}
                          sport={sport}
                          name={displayName}
                          size="small"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="flex flex-col gap-1 min-w-0 pr-10 sm:pr-0">
                        <DialogTitle className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white leading-tight truncate tracking-tight">
                          {displayName}
                        </DialogTitle>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          {displayTeam && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50">
                              <img
                                src={teamLogoSport === "mlb" ? getTeamLogoUrl(displayTeam, "mlb") : `/team-logos/nba/${displayTeam.toUpperCase()}.svg`}
                                alt={displayTeam}
                                className="h-4 w-4 object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">{displayTeam}</span>
                            </div>
                          )}
                          {displayPosition && (
                            <span className="px-2 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50 font-semibold text-neutral-600 dark:text-neutral-400">
                              {displayPosition}
                            </span>
                          )}
                          {displayJersey && (
                            <span className="font-medium text-neutral-400">#{displayJersey}</span>
                          )}
                        </div>
                        {/* Next Game - Premium Badge */}
                        {nextGame && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-700/30">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] uppercase tracking-wide font-bold text-emerald-700 dark:text-emerald-400">Next</span>
                              {nextGame.homeAway && (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">{nextGame.homeAway === "H" ? "vs" : "@"}</span>
                              )}
                              {nextGame.opponentTeamAbbr && (
                                <img
                                  src={teamLogoSport === "mlb" ? getTeamLogoUrl(nextGame.opponentTeamAbbr, "mlb") : `/team-logos/nba/${nextGame.opponentTeamAbbr.toUpperCase()}.svg`}
                                  alt={nextGame.opponentTeamAbbr}
                                  className="h-3.5 w-3.5 object-contain"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              )}
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{nextGame.opponentTeamAbbr}</span>
                              {nextGameDetail && (
                                <>
                                  <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">•</span>
                                  <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">{nextGameDetail}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Season Stats Card - Premium Glass Design */}
                    {headerSeasonSummary && (
                      <div className="hidden sm:flex flex-col items-center gap-1.5 mr-8">
                        <div className="flex items-stretch gap-1 p-1.5 rounded-xl bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50 shadow-sm">
                          {headerSeasonSummary.stats.map((stat) => (
                            <div 
                              key={stat.label}
                              className={cn(
                                "flex flex-col items-center justify-center px-3 py-1.5 min-w-[52px] rounded-lg transition-colors",
                                stat.highlight && "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20"
                              )}
                            >
                              <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{stat.label}</span>
                              <span className={cn(
                                "text-lg font-bold tabular-nums tracking-tight",
                                stat.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                              )}>
                                {stat.value}
                              </span>
                            </div>
                          ))}
                        </div>
                        <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{headerSeasonSummary.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile Season Stats - Premium Grid */}
                  {headerSeasonSummary && (
                    <div className="flex sm:hidden flex-col items-center gap-2 mt-4">
                      <div className="grid grid-cols-4 gap-1 w-full max-w-xs p-1.5 rounded-xl bg-white/60 dark:bg-neutral-800/40 backdrop-blur-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
                        {headerSeasonSummary.stats.map((stat) => (
                          <div 
                            key={stat.label}
                            className={cn(
                              "flex flex-col items-center justify-center py-2 rounded-lg",
                              stat.highlight && "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30"
                            )}
                          >
                            <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{stat.label}</span>
                            <span className={cn(
                              "text-base font-bold tabular-nums",
                              stat.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                            )}>
                              {stat.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <span className="text-[7px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{headerSeasonSummary.label}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Section - Prop Controls - Premium Glass */}
              <div className="px-4 sm:px-6 py-3 bg-gradient-to-r from-neutral-50/80 via-white/60 to-neutral-50/80 dark:from-neutral-900/60 dark:via-neutral-800/40 dark:to-neutral-900/60 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                  {/* Left: Market Dropdown + Line Chip */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Market Dropdown - Premium */}
                    <div className="relative" ref={marketDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/80 text-xs sm:text-sm font-bold text-neutral-900 dark:text-white hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                      >
                        <span className="text-emerald-600 dark:text-emerald-400">{formatMarketLabel(currentMarket)}</span>
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
                                    ? "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/50 dark:ring-emerald-700/30"
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

                    {/* Line Chip */}
                    <div
                      className={cn(
                        "relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-md transition-all cursor-pointer",
                        customLine !== null && customLine !== defaultLine
                          ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-neutral-950" 
                          : "hover:shadow-lg"
                      )}
                      style={{ backgroundColor: profile?.primaryColor || '#6366f1' }}
                      onClick={() => {
                        if (!isEditingLine) {
                          setEditValue(String(activeLine));
                          setIsEditingLine(true);
                        }
                      }}
                    >
                      {isEditingLine ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleLineEdit(); }}
                            onBlur={handleLineEdit}
                            className="w-12 px-1.5 py-0.5 text-sm font-bold text-neutral-900 bg-white rounded text-center"
                            autoFocus
                          />
                          <button onClick={handleLineEdit} className="p-0.5 text-white hover:bg-white/20 rounded">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-base font-bold text-white tabular-nums">{activeLine}+</span>
                          <Pencil className="h-3 w-3 text-white/60" />
                        </>
                      )}
                    </div>

                    {/* Reset Line Button - Only shown when line is customized */}
                    {customLine !== null && customLine !== defaultLine && (
                      <button
                        type="button"
                        onClick={() => setCustomLine(null)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-750 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        title="Reset to original line"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span className="hidden sm:inline">Reset</span>
                      </button>
                    )}

                    {/* Odds */}
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      {activeOdds?.over ? (
                        <button
                          type="button"
                          onClick={() => activeOdds.over?.mobileLink && window.open(applyState(activeOdds.over.mobileLink) || activeOdds.over.mobileLink, "_blank", "noopener,noreferrer")}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-all text-xs",
                            activeOdds.over?.mobileLink && "hover:border-emerald-400/50 cursor-pointer"
                          )}
                        >
                          {activeOdds.over.book && (() => {
                            const sb = getSportsbookById(activeOdds.over.book);
                            return sb?.image?.light ? (
                              <img src={sb.image.light} alt={sb.name} className="h-3.5 w-3.5 object-contain" />
                            ) : null;
                          })()}
                          <span className="font-medium text-neutral-400">O</span>
                          <span className={cn(
                            "font-bold tabular-nums",
                            activeOdds.over.price > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                          )}>
                            {activeOdds.over.price > 0 ? `+${activeOdds.over.price}` : activeOdds.over.price}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
                          <span className="font-medium text-neutral-400">O</span>
                          <span className="font-bold tabular-nums text-neutral-400">—</span>
                        </div>
                      )}
                      {activeOdds?.under ? (
                        <button
                          type="button"
                          onClick={() => activeOdds.under?.mobileLink && window.open(applyState(activeOdds.under.mobileLink) || activeOdds.under.mobileLink, "_blank", "noopener,noreferrer")}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-all text-xs",
                            activeOdds.under?.mobileLink && "hover:border-red-400/50 cursor-pointer"
                          )}
                        >
                          {activeOdds.under.book && (() => {
                            const sb = getSportsbookById(activeOdds.under.book);
                            return sb?.image?.light ? (
                              <img src={sb.image.light} alt={sb.name} className="h-3.5 w-3.5 object-contain" />
                            ) : null;
                          })()}
                          <span className="font-medium text-neutral-400">U</span>
                          <span className={cn(
                            "font-bold tabular-nums",
                            activeOdds.under.price > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300"
                          )}>
                            {activeOdds.under.price > 0 ? `+${activeOdds.under.price}` : activeOdds.under.price}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
                          <span className="font-medium text-neutral-400">U</span>
                          <span className="font-bold tabular-nums text-neutral-400">—</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Hit Rate Strip - Premium Pills */}
                  <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-neutral-100/50 dark:bg-neutral-800/30">
                    {[
                      { label: "L5", value: dynamicHitRates.l5, count: 5 as const },
                      { label: "L10", value: dynamicHitRates.l10, count: 10 as const },
                      { label: "L20", value: dynamicHitRates.l20, count: 20 as const },
                      { label: "SZN", value: dynamicHitRates.season, count: "season" as const },
                      { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" as const },
                    ].map((stat) => {
                      const isSelected = gameCount === stat.count;
                      const hitColor = stat.value !== null && stat.value >= 70 
                        ? "emerald" 
                        : stat.value !== null && stat.value >= 50 
                          ? "amber" 
                          : "red";
                      return (
                        <button
                          key={stat.label}
                          type="button"
                          onClick={() => setGameCount(stat.count)}
                          className={cn(
                            "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold",
                            isSelected 
                              ? "bg-white dark:bg-neutral-800 shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50" 
                              : "hover:bg-white/50 dark:hover:bg-neutral-800/50"
                          )}
                        >
                          <span className={cn(
                            "font-bold tabular-nums tracking-tight",
                            isSelected ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500"
                          )}>
                            {stat.label}
                          </span>
                          <span className={cn(
                            "font-bold tabular-nums",
                            hitColor === "emerald" && "text-emerald-600 dark:text-emerald-400",
                            hitColor === "amber" && "text-amber-600 dark:text-amber-400",
                            hitColor === "red" && "text-red-500 dark:text-red-400",
                            stat.value === null && "text-neutral-400 dark:text-neutral-500"
                          )}>
                            {stat.value != null ? `${stat.value}%` : "—"}
                          </span>
                          {isSelected && (
                            <div className={cn(
                              "absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full",
                              hitColor === "emerald" && "bg-emerald-500",
                              hitColor === "amber" && "bg-amber-500",
                              hitColor === "red" && "bg-red-500",
                              stat.value === null && "bg-neutral-400"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Hit Rate Strip - Premium Touch Targets */}
                <div className="flex sm:hidden items-center justify-center gap-1 mt-3 p-1 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40 overflow-x-auto">
                  {[
                    { label: "L5", value: dynamicHitRates.l5, count: 5 as const },
                    { label: "L10", value: dynamicHitRates.l10, count: 10 as const },
                    { label: "L20", value: dynamicHitRates.l20, count: 20 as const },
                    { label: "SZN", value: dynamicHitRates.season, count: "season" as const },
                    { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" as const },
                  ].map((stat) => {
                    const isSelected = gameCount === stat.count;
                    const hitColor = stat.value !== null && stat.value >= 70 
                      ? "emerald" 
                      : stat.value !== null && stat.value >= 50 
                        ? "amber" 
                        : "red";
                    return (
                      <button
                        key={stat.label}
                        type="button"
                        onClick={() => setGameCount(stat.count)}
                        className={cn(
                          "relative flex flex-col items-center justify-center px-2.5 py-2 rounded-lg transition-all min-w-[52px]",
                          isSelected 
                            ? "bg-white dark:bg-neutral-800 shadow-sm ring-1 ring-neutral-200/60 dark:ring-neutral-700/60" 
                            : "active:scale-95"
                        )}
                      >
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wide",
                          isSelected ? "text-neutral-600 dark:text-neutral-300" : "text-neutral-400 dark:text-neutral-500"
                        )}>
                          {stat.label}
                        </span>
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          hitColor === "emerald" && "text-emerald-600 dark:text-emerald-400",
                          hitColor === "amber" && "text-amber-600 dark:text-amber-400",
                          hitColor === "red" && "text-red-500 dark:text-red-400",
                          stat.value === null && "text-neutral-400 dark:text-neutral-500"
                        )}>
                          {stat.value != null ? `${stat.value}%` : "—"}
                        </span>
                        {isSelected && (
                          <div className={cn(
                            "absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full",
                            hitColor === "emerald" && "bg-emerald-500",
                            hitColor === "amber" && "bg-amber-500",
                            hitColor === "red" && "bg-red-500",
                            stat.value === null && "bg-neutral-400"
                          )} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile CTA: quick access to full hit rate card */}
                {showFullProfileLink && (
                <div className="sm:hidden mt-2">
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
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                TAB NAVIGATION - Premium Style
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="shrink-0 px-4 sm:px-6 pt-2.5 pb-3 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-gradient-to-r from-white via-neutral-50/50 to-white dark:from-neutral-900 dark:via-neutral-800/30 dark:to-neutral-900 overflow-hidden">
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
                        "relative flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                        isDisabled
                          ? "cursor-not-allowed text-neutral-400 dark:text-neutral-600 bg-neutral-100/60 dark:bg-neutral-800/40"
                          : isActive
                          ? "bg-white dark:bg-neutral-800 text-emerald-700 dark:text-emerald-400 shadow-md ring-1 ring-emerald-200/50 dark:ring-emerald-700/30"
                          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-white/60 dark:hover:bg-neutral-800/60 active:scale-95"
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 transition-colors",
                        isDisabled
                          ? "text-neutral-400 dark:text-neutral-600"
                          : isActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400 dark:text-neutral-500"
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

            {/* ═══════════════════════════════════════════════════════════════════
                SCROLLABLE CONTENT
                ═══════════════════════════════════════════════════════════════════ */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-4 space-y-5 min-w-0 relative z-0 min-h-[400px]">
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
                  {/* Chart Section - Premium Card */}
                  <div className="rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5 w-full max-w-full relative z-0">
                    <div className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-emerald-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-emerald-900/10" />
                      <div className="relative px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-200/60 dark:border-neutral-700/60">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 shadow-sm shadow-emerald-500/30" />
                            <div>
                              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">Game Log</h2>
                              <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-medium">Performance history</p>
                            </div>
                          </div>
                          
                          {/* Chart Stats - Premium */}
                          <div className="flex items-center gap-1.5 sm:gap-3">
                            <div className="flex flex-col items-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white dark:bg-neutral-700/40 ring-1 ring-neutral-200/60 dark:ring-neutral-600/40 shadow-sm">
                              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-neutral-400">Avg</span>
                              <span className={cn(
                                "text-base sm:text-xl font-bold tabular-nums tracking-tight",
                                chartStats.avg && chartStats.avg > activeLine ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                              )}>
                                {chartStats.avg?.toFixed(1) ?? "—"}
                              </span>
                            </div>
                            <div className={cn(
                              "flex flex-col items-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl ring-1 shadow-sm",
                              chartStats.hitRate !== null && chartStats.hitRate >= 70 
                                ? "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 ring-emerald-200/60 dark:ring-emerald-700/40"
                                : chartStats.hitRate !== null && chartStats.hitRate >= 50 
                                  ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 ring-amber-200/60 dark:ring-amber-700/40"
                                  : chartStats.hitRate !== null
                                    ? "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 ring-red-200/60 dark:ring-red-700/40"
                                    : "bg-neutral-50 dark:bg-neutral-700/30 ring-neutral-200/50 dark:ring-neutral-700/50"
                            )}>
                              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-neutral-400">Hit Rate</span>
                              <span className={cn("text-base sm:text-xl font-bold tabular-nums tracking-tight", getPctColor(chartStats.hitRate))}>
                                {chartStats.hitRate !== null ? `${chartStats.hitRate}%` : "—"}
                              </span>
                            </div>
                            <div className="hidden sm:flex flex-col items-center text-xs text-neutral-500">
                              <span className="font-bold text-neutral-700 dark:text-neutral-300">{chartStats.hits}/{chartStats.total}</span>
                              <span className="text-[9px]">games</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="p-3 sm:p-4">
                      {filteredGames.length > 0 ? (
                        <GameLogChart
                          games={filteredGames}
                          market={currentMarket}
                          sport={sport}
                          line={activeLine}
                          onLineChange={setCustomLine}
                          odds={oddsForChart}
                          profileGameLogs={profile?.gameLogs as any}
                        />
                      ) : (
                        <div className="py-12 text-center text-sm text-neutral-500">No game data available</div>
                      )}
                    </div>
                  </div>

                  {/* Box Score Table */}
                  {fullProfilePlayerId && (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200/60 dark:border-neutral-700/60">
                      <BoxScoreTable
                        sport={sport}
                        playerId={fullProfilePlayerId}
                        market={currentMarket}
                        currentLine={activeLine}
                        prefetchedGames={isMlb ? mlbSeasonGames : undefined}
                      />
                    </div>
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
                  {/* Pro gate overlay */}
                  {!hasAdvancedAccess && (
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
                  
                  <div className={cn("space-y-6", !hasAdvancedAccess && "pointer-events-none select-none")}>
                    {/* Defensive Analysis Matrix */}
                    <DefensiveAnalysis
                      playerId={profilePlayerId ?? 0}
                      opponentTeamId={profileOpponentTeamId}
                      opponentTeamAbbr={profileOpponentTeamAbbr}
                      position={profilePosition}
                    />
                    
                    {/* Position vs Team Game Log */}
                    <PositionVsTeam
                      position={profilePosition}
                      opponentTeamId={profileOpponentTeamId}
                      opponentTeamAbbr={profileOpponentTeamAbbr}
                      market={currentMarket}
                      currentLine={activeLine}
                    />
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
                    gameId={profile?.gameId ? Number(profile.gameId) : null}
                    battingHand={profile?.battingHand}
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
                  
                  <div className={cn("space-y-6", !hasAdvancedAccess && "pointer-events-none select-none")}>
                    <PlayTypeAnalysis
                      playerId={profilePlayerId ?? null}
                      opponentTeamId={profileOpponentTeamId}
                      opponentTeamAbbr={profileOpponentTeamAbbr}
                      playerName={profilePlayerName}
                    />
                    <ShootingZones
                      playerId={profilePlayerId}
                      opponentTeamId={profileOpponentTeamId}
                      playerName={profilePlayerName}
                      opponentTeamAbbr={profileOpponentTeamAbbr}
                      showSideTable
                    />
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
                  
                  <div className={cn(!hasAdvancedAccess && "pointer-events-none select-none")}>
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
