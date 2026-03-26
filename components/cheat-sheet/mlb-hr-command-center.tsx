"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbHRScores } from "@/hooks/use-mlb-hr-scores";
import type { HRScorePlayer } from "@/app/api/mlb/hr-scores/route";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { ButtonLink } from "@/components/button-link";
import { Tooltip } from "@/components/tooltip";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { SheetFilterBar, SegmentedControl, FilterDivider, FilterSearch, FilterCount } from "@/components/cheat-sheet/sheet-filter-bar";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Snowflake,
  Lock,
  Search,
  X,
  ExternalLink,
  Zap,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const FREE_MAX_ROWS = 5;
const UPGRADE_URL = "/pricing";

const MIN_SCORE_OPTIONS = [
  { value: 0, label: "All" },
  { value: 50, label: "50+" },
  { value: 65, label: "65+" },
  { value: 80, label: "80+" },
] as const;

const TIERS = [
  { min: 90, label: "Elite", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", icon: Flame },
  { min: 80, label: "Strong", color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30", icon: Zap },
  { min: 70, label: "Solid", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30", icon: TrendingUp },
  { min: 0, label: "Longshot", color: "text-neutral-400", bg: "bg-neutral-500/10", border: "border-neutral-500/20", icon: Minus },
] as const;

function getTierFromScore(score: number) {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

type SortField = "hr_score" | "player" | "edge_pct" | "batter_power" | "pitcher_vuln" | "barrel_pct" | "max_ev" | "best_odds";
type SortDirection = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 80) return "text-blue-400";
  if (score >= 70) return "text-amber-400";
  return "text-neutral-400";
}

function getScoreBg(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 80) return "bg-blue-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-neutral-500";
}

function formatOdds(odds: number | string | null): string {
  if (odds == null) return "-";
  if (typeof odds === "string") return odds.startsWith("+") || odds.startsWith("-") ? odds : `+${odds}`;
  return odds > 0 ? `+${odds}` : String(odds);
}

function formatPct(val: number | null, decimals = 1): string {
  if (val == null) return "-";
  return `${val.toFixed(decimals)}%`;
}

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
}

function getBookName(bookId: string): string {
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
}

/** Inline odds cell — sportsbook logo + price on same line, expandable dropdown */
function HROddsCell({ player }: { player: HRScorePlayer }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const bestPrice = player.best_odds_american;
  const bestBook = player.best_odds_book;
  const allBooks = player.all_book_odds;
  const hasOdds = bestPrice != null;

  if (!hasOdds) return <span className="text-xs text-neutral-500">—</span>;

  const logo = bestBook ? getBookLogo(bestBook) : null;
  const bookEntries = allBooks
    ? Object.entries(allBooks)
        .filter(([, d]) => d?.price != null)
        .sort((a, b) => (b[1]?.price ?? -9999) - (a[1]?.price ?? -9999))
    : [];

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all",
          "hover:bg-neutral-100 dark:hover:bg-neutral-800/60",
          isOpen && "bg-neutral-100 dark:bg-neutral-800/60 ring-1 ring-brand/30"
        )}
      >
        {logo ? (
          <img src={logo} alt={bestBook ?? ""} className="h-4 w-auto shrink-0" />
        ) : null}
        <span className="text-xs font-bold tabular-nums text-emerald-400">{formatOdds(bestPrice)}</span>
        <ChevronDown className={cn("w-3 h-3 text-neutral-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && bookEntries.length > 0 && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">HR 0.5+</span>
            <span className="text-[10px] text-neutral-400">{bookEntries.length} books</span>
          </div>
          {/* Book list */}
          <div className="max-h-64 overflow-y-auto">
            {bookEntries.map(([book, data]) => {
              const bLogo = getBookLogo(book);
              const price = data?.price;
              const link = data?.link || data?.mobile_link;
              const isBest = book === bestBook;
              return (
                <a
                  key={book}
                  href={link ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 transition-colors",
                    "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                    isBest && "bg-emerald-500/5"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {bLogo ? (
                      <img src={bLogo} alt={book} className="h-4 w-auto shrink-0" />
                    ) : null}
                    <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 truncate">
                      {getBookName(book)}
                    </span>
                    {isBest && (
                      <span className="text-[9px] font-bold text-emerald-500 uppercase shrink-0">Best</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      isBest ? "text-emerald-400" : "text-neutral-600 dark:text-neutral-300"
                    )}>
                      {price != null ? formatOdds(price) : "—"}
                    </span>
                    {link && <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({ field, currentField, direction }: { field: SortField; currentField: SortField; direction: SortDirection }) {
  if (field !== currentField) return <ChevronDown className="w-3 h-3 opacity-30" />;
  return direction === "desc"
    ? <ChevronDown className="w-3 h-3 text-brand" />
    : <ChevronUp className="w-3 h-3 text-brand" />;
}

function SurgeIcon({ direction }: { direction: string | null }) {
  if (!direction) return <Minus className="w-3.5 h-3.5 text-neutral-400" />;
  const d = direction.toLowerCase();
  if (d.includes("hot")) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (d.includes("cold")) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-neutral-400" />;
}

const TIER_TIPS: Record<string, string> = {
  Elite: "Best HR opportunities of the day",
  Strong: "Above-average HR conditions",
  Solid: "Typical matchup, moderate opportunity",
  Longshot: "Unfavorable conditions for HRs",
};

function ScorePill({ score }: { score: number }) {
  const config = getTierFromScore(score);
  return (
    <Tooltip content={`${config.label}: ${TIER_TIPS[config.label] ?? ""}`} side="top">
      <div className="flex flex-col items-center gap-0.5 cursor-help">
        <div className={cn("relative w-12 h-12 rounded-full flex items-center justify-center border-2", config.border, config.bg)}>
          <span className={cn("text-base font-black tabular-nums", config.color)}>{Math.round(score)}</span>
        </div>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider", config.color)}>{config.label}</span>
      </div>
    </Tooltip>
  );
}

function SubScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-neutral-500 w-16 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", getScoreBg(value))} style={{ width: `${value}%` }} />
      </div>
      <span className={cn("text-[10px] font-bold tabular-nums w-6 shrink-0", getScoreColor(value))}>{Math.round(value)}</span>
    </div>
  );
}

function ExpandedRow({ player }: { player: HRScorePlayer }) {
  const allOdds = player.all_book_odds && typeof player.all_book_odds === "object"
    ? Object.entries(player.all_book_odds)
    : [];

  return (
    <tr>
      <td colSpan={12} className="p-0">
        <div className="px-6 py-5 bg-neutral-50/50 dark:bg-neutral-800/30 border-b border-neutral-200/80 dark:border-neutral-700/80">
          <div className="grid grid-cols-4 gap-6">
            {/* Score Breakdown */}
            <div className="flex flex-col gap-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Score Breakdown</h4>
              <SubScoreBar label="Power" value={player.batter_power_score ?? 0} />
              <SubScoreBar label="Pitcher" value={player.pitcher_vuln_score ?? 0} />
              <SubScoreBar label="Park" value={player.park_factor_score ?? 0} />
              <SubScoreBar label="Env" value={player.environment_score ?? 0} />
              <SubScoreBar label="Matchup" value={player.matchup_context_score ?? 0} />
            </div>

            {/* Statcast Detail */}
            <div className="flex flex-col gap-1.5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Statcast</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-neutral-500">Barrel%</span>
                <span className="font-bold text-neutral-200 tabular-nums">{formatPct(player.barrel_pct)}</span>
                <span className="text-neutral-500">Max EV</span>
                <span className="font-bold text-neutral-200 tabular-nums">{player.max_exit_velo?.toFixed(1) ?? "-"} mph</span>
                <span className="text-neutral-500">Hard Hit%</span>
                <span className="font-bold text-neutral-200 tabular-nums">{formatPct(player.hard_hit_pct)}</span>
                <span className="text-neutral-500">ISO</span>
                <span className="font-bold text-neutral-200 tabular-nums">{player.iso?.toFixed(3) ?? "-"}</span>
              </div>
            </div>

            {/* Park & Weather + Matchup */}
            <div className="flex flex-col gap-1.5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Conditions & Matchup</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-neutral-500">Park Factor</span>
                <span className={cn("font-bold tabular-nums", (player.park_hr_factor ?? 1) > 1.05 ? "text-emerald-400" : (player.park_hr_factor ?? 1) < 0.95 ? "text-red-400" : "text-neutral-300")}>
                  {player.park_hr_factor?.toFixed(2) ?? "-"}x
                </span>
                <span className="text-neutral-500">Temp</span>
                <span className="font-bold text-neutral-200 tabular-nums">{player.temperature_f != null ? `${Math.round(player.temperature_f)}°F` : "-"}</span>
                <span className="text-neutral-500">Wind</span>
                <span className="font-bold text-neutral-200">{player.wind_label ?? "-"}</span>
                <span className="text-neutral-500">Venue</span>
                <span className="font-bold text-neutral-200 truncate">{player.venue_name ?? "-"}</span>
                <span className="text-neutral-500">Platoon</span>
                <span className={cn("font-bold", player.platoon_advantage ? "text-emerald-400" : "text-neutral-400")}>
                  {player.platoon_advantage ? "Yes" : "No"}
                </span>
                <span className="text-neutral-500">BvP</span>
                <span className="font-bold text-neutral-200 tabular-nums">
                  {player.bvp_pa != null ? `${player.bvp_hr ?? 0} HR / ${player.bvp_pa} PA` : "-"}
                </span>
              </div>
            </div>

            {/* Surge & Streaks + All Odds */}
            <div className="flex flex-col gap-3">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Surge & Streaks</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-neutral-500">7d Barrel%</span>
                  <span className="font-bold text-neutral-200 tabular-nums">{formatPct(player.surge_barrel_pct_7d)}</span>
                  <span className="text-neutral-500">7d HRs</span>
                  <span className="font-bold text-neutral-200 tabular-nums">{player.surge_hr_7d ?? "-"}</span>
                  <span className="text-neutral-500">HR Streak</span>
                  <span className={cn("font-bold tabular-nums", (player.hr_streak ?? 0) >= 2 ? "text-emerald-400" : "text-neutral-200")}>
                    {player.hr_streak ?? 0} games
                  </span>
                  <span className="text-neutral-500">Last 3 Games</span>
                  <span className="font-bold text-neutral-200 tabular-nums">{player.hr_last_3_games ?? 0} HR</span>
                </div>
              </div>

              {allOdds.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">All Book Odds</h4>
                  <div className="flex flex-wrap gap-1">
                    {allOdds.map(([book, info]: [string, any]) => (
                      <a
                        key={book}
                        href={info?.link ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
                      >
                        {book} {formatOdds(info?.odds)}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function MobileCard({ player, rank }: { player: HRScorePlayer; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = getTierFromScore(player.hr_score);

  return (
    <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4 flex items-center gap-3">
        {/* Rank */}
        <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0",
          rank <= 3 ? "bg-amber-500/20 text-amber-400" : "bg-neutral-800 text-neutral-400"
        )}>
          {rank}
        </span>

        {/* Headshot */}
        <Image
          src={getMlbHeadshotUrl(player.player_id, "tiny")}
          alt={player.player_name}
          width={36}
          height={36}
          className="rounded-full bg-neutral-800 shrink-0"
          unoptimized
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Image src={`/team-logos/mlb/${player.team_abbr.toUpperCase()}.svg`} alt={player.team_abbr} width={14} height={14} className="shrink-0" />
            <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{player.player_name}</span>
            <span className={cn("text-[10px] font-semibold px-1 py-0.5 rounded", config.bg, config.color)}>{config.label}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
            <span>vs {player.opp_pitcher_name ?? "TBD"} ({player.opp_pitcher_hand ?? "?"})</span>
            <SurgeIcon direction={player.surge_direction} />
          </div>
        </div>

        {/* Score + Odds */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-neutral-500 block">Edge</span>
            <span className={cn("text-xs font-bold tabular-nums",
              (player.edge_pct ?? 0) > 0 ? "text-emerald-400" : (player.edge_pct ?? 0) < 0 ? "text-red-400" : "text-neutral-400"
            )}>
              {player.edge_pct != null ? `${player.edge_pct > 0 ? "+" : ""}${player.edge_pct.toFixed(1)}%` : "-"}
            </span>
          </div>
          <div className={cn("w-11 h-11 rounded-full flex items-center justify-center border-2 shrink-0", config.border, config.bg)}>
            <span className={cn("text-sm font-black tabular-nums", config.color)}>{Math.round(player.hr_score)}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-neutral-100 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="flex flex-col gap-1.5">
              <SubScoreBar label="Power" value={player.batter_power_score ?? 0} />
              <SubScoreBar label="Pitcher" value={player.pitcher_vuln_score ?? 0} />
              <SubScoreBar label="Park" value={player.park_factor_score ?? 0} />
              <SubScoreBar label="Env" value={player.environment_score ?? 0} />
              <SubScoreBar label="Matchup" value={player.matchup_context_score ?? 0} />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <span className="text-neutral-500">Barrel%</span>
              <span className="font-bold text-neutral-200 tabular-nums">{formatPct(player.barrel_pct)}</span>
              <span className="text-neutral-500">Max EV</span>
              <span className="font-bold text-neutral-200 tabular-nums">{player.max_exit_velo?.toFixed(1) ?? "-"}</span>
              <span className="text-neutral-500">Best Odds</span>
              <span className="font-bold text-emerald-400 tabular-nums">{player.best_odds_american != null ? (typeof player.best_odds_american === "string" ? player.best_odds_american : formatOdds(player.best_odds_american)) : "-"}</span>
              <span className="text-neutral-500">Park</span>
              <span className="font-bold text-neutral-200 tabular-nums">{player.park_hr_factor?.toFixed(2) ?? "-"}x</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function MlbHRCommandCenter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDateState] = useState(() => searchParams.get("date") || getETDate());
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);
  const [minScore, setMinScore] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("hr_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>("all");

  const isMobile = useMediaQuery("(max-width: 767px)");
  const { hasAccess, isLoading: isLoadingAccess } = useHasHitRateAccess();
  const isGated = !isLoadingAccess && !hasAccess;

  const { players, meta, isLoading, availableDates } = useMlbHRScores(selectedDate);

  // Auto-advance to next game date
  React.useEffect(() => {
    if (isLoading || players.length > 0 || availableDates.length === 0) return;
    if (!availableDates.includes(selectedDate)) {
      const nextDate = availableDates.find((d) => d >= selectedDate) ?? availableDates[0];
      setSelectedDate(nextDate);
    }
  }, [isLoading, players.length, availableDates, selectedDate]);

  // Derive unique games from players (grouped by venue)
  const gameOptions = useMemo(() => {
    const venueTeams = new Map<string, Set<string>>();
    players.forEach((p) => {
      const key = p.venue_name ?? "Unknown";
      if (!venueTeams.has(key)) venueTeams.set(key, new Set());
      venueTeams.get(key)!.add(p.team_abbr);
    });
    return Array.from(venueTeams.entries())
      .map(([venue, teams]) => {
        const sorted = [...teams].sort();
        return { venue, label: sorted.join(" @ "), teams: sorted };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [players]);

  // Reset game filter when date changes
  React.useEffect(() => { setSelectedGame("all"); }, [selectedDate]);

  // Filter
  const filteredPlayers = useMemo(() => {
    let result = players;
    if (selectedGame !== "all") {
      result = result.filter((p) => (p.venue_name ?? "Unknown") === selectedGame);
    }
    if (minScore > 0) {
      result = result.filter((p) => p.hr_score >= minScore);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.player_name.toLowerCase().includes(q) ||
          p.team_abbr.toLowerCase().includes(q) ||
          (p.opp_pitcher_name ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [players, minScore, searchQuery, selectedGame]);

  // Sort
  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (sortField) {
        case "hr_score": aVal = a.hr_score; bVal = b.hr_score; break;
        case "player": aVal = a.player_name; bVal = b.player_name; break;
        case "edge_pct": aVal = a.edge_pct ?? -999; bVal = b.edge_pct ?? -999; break;
        case "batter_power": aVal = a.batter_power_score; bVal = b.batter_power_score; break;
        case "pitcher_vuln": aVal = a.pitcher_vuln_score; bVal = b.pitcher_vuln_score; break;
        case "barrel_pct": aVal = a.barrel_pct ?? 0; bVal = b.barrel_pct ?? 0; break;
        case "max_ev": aVal = a.max_exit_velo ?? 0; bVal = b.max_exit_velo ?? 0; break;
        case "best_odds": aVal = a.best_odds_american ?? 9999; bVal = b.best_odds_american ?? 9999; break;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "desc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sortDirection === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [filteredPlayers, sortField, sortDirection]);

  const displayPlayers = isGated ? sortedPlayers.slice(0, FREE_MAX_ROWS) : sortedPlayers;

  // Rank by HR score (stable regardless of sort column)
  const rankMap = useMemo(() => {
    const ranked = [...filteredPlayers].sort((a, b) => b.hr_score - a.hr_score);
    const map = new Map<number | null, number>();
    ranked.forEach((p, i) => map.set(p.player_id, i + 1));
    return map;
  }, [filteredPlayers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="space-y-0">
      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div data-tour="hr-filter-bar">
      <SheetFilterBar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        availableDates={availableDates}
        right={
          <>
            <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search player..." />
            <FilterCount count={filteredPlayers.length} label="players" />
          </>
        }
        legend={
          <>
            <span className="font-medium text-neutral-500">Tiers:</span>
            {TIERS.map((t) => (
              <span key={t.label} className="flex items-center gap-1">
                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", t.bg, t.color)}>{t.label}</span>
              </span>
            ))}
          </>
        }
        mobileControls={
          <>
            <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search player..." />
            <div className="flex items-center gap-2 w-full">
              <SegmentedControl
                fullWidth
                value={String(minScore)}
                onChange={(v) => setMinScore(Number(v) as 0 | 50 | 65 | 80)}
                options={MIN_SCORE_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
              />
              {gameOptions.length > 1 && (
                <select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className="px-2.5 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 text-xs font-semibold text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-pointer shrink-0"
                >
                  <option value="all">All Games</option>
                  {gameOptions.map((g) => (
                    <option key={g.venue} value={g.venue}>{g.label}</option>
                  ))}
                </select>
              )}
            </div>
          </>
        }
      >
        <SegmentedControl
          value={String(minScore)}
          onChange={(v) => setMinScore(Number(v) as 0 | 50 | 65 | 80)}
          options={MIN_SCORE_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
        />
        {gameOptions.length > 1 && (
          <>
            <FilterDivider />
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 text-xs font-semibold text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-pointer"
            >
              <option value="all">All Games</option>
              {gameOptions.map((g) => (
                <option key={g.venue} value={g.venue}>{g.label}</option>
              ))}
            </select>
          </>
        )}
      </SheetFilterBar>
      </div>

      {/* ── Table / Cards ─────────────────────────────────────────────── */}
      <div className="relative">
        {isMobile && !isLoading && sortedPlayers.length > 0 ? (
          <div className="space-y-3 pt-3">
            {displayPlayers.map((player, idx) => (
              <MobileCard key={`${player.player_name}-${idx}`} player={player} rank={idx + 1} />
            ))}
          </div>
        ) : (
          <div className="rounded-b-2xl border border-t-0 border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden bg-white dark:bg-neutral-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand/30 border-t-brand mx-auto" />
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-4">Loading HR scores...</p>
                </div>
              </div>
            ) : sortedPlayers.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center max-w-sm">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">No HR data</h3>
                  <p className="text-sm text-neutral-500">{searchQuery ? "No players match your search." : "No data available for this date."}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[400px]">
                <table data-tour="hr-table" className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm">
                      <Th className="w-10 text-center">#</Th>
                      <Th className="min-w-[220px] text-left">
                        <SortBtn field="player" current={sortField} dir={sortDirection} onClick={handleSort}>Player</SortBtn>
                      </Th>
                      <Th className="min-w-[70px]">
                        <Tooltip content="Composite HR score (0-100) combining batter power, pitcher vulnerability, park factors, environment, and matchup context. 90+ is elite." side="top">
                          <span className="cursor-help"><SortBtn field="hr_score" current={sortField} dir={sortDirection} onClick={handleSort}>Score</SortBtn></span>
                        </Tooltip>
                      </Th>
                      <Th>
                        <Tooltip content="Last 7 days barrel rate and HR count vs season average. Hot = locked in, Cold = slumping." side="top">
                          <span className="cursor-help">Surge</span>
                        </Tooltip>
                      </Th>
                      <Th>
                        <Tooltip content="Batter Power — barrel rate, exit velo, ISO, and hard-hit %. Measures raw power output." side="top">
                          <span className="cursor-help"><SortBtn field="batter_power" current={sortField} dir={sortDirection} onClick={handleSort}>Power</SortBtn></span>
                        </Tooltip>
                      </Th>
                      <Th>
                        <Tooltip content="Pitcher Vulnerability — opposing pitcher's HR/9, fly ball rate, and hard contact allowed. Higher = gives up more HRs." side="top">
                          <span className="cursor-help"><SortBtn field="pitcher_vuln" current={sortField} dir={sortDirection} onClick={handleSort}>P.Vuln</SortBtn></span>
                        </Tooltip>
                      </Th>
                      <Th>
                        <Tooltip content="Season barrel rate — percentage of batted balls classified as barrels (ideal exit velo + launch angle)." side="top">
                          <span className="cursor-help"><SortBtn field="barrel_pct" current={sortField} dir={sortDirection} onClick={handleSort}>Brl%</SortBtn></span>
                        </Tooltip>
                      </Th>
                      <Th>
                        <Tooltip content="Maximum exit velocity this season. Higher = more raw power on contact." side="top">
                          <span className="cursor-help"><SortBtn field="max_ev" current={sortField} dir={sortDirection} onClick={handleSort}>Max EV</SortBtn></span>
                        </Tooltip>
                      </Th>
                      <Th>
                        <Tooltip content="Environment — temperature, wind, humidity, and elevation. Wind blowing out in warm weather = big boost." side="top">
                          <span className="cursor-help">Env</span>
                        </Tooltip>
                      </Th>
                      <Th>
                        <Tooltip content="Best available HR odds (Over 0.5 Home Runs) across 14+ sportsbooks. Click to see all books." side="top">
                          <span className="cursor-help"><SortBtn field="best_odds" current={sortField} dir={sortDirection} onClick={handleSort}>Odds</SortBtn></span>
                        </Tooltip>
                      </Th>
                      <Th>
                        <Tooltip content="Model edge over the market. Positive = our model thinks this HR is more likely than the odds imply. Edge = (Model Prob - Market Prob) / Market Prob." side="top">
                          <span className="cursor-help"><SortBtn field="edge_pct" current={sortField} dir={sortDirection} onClick={handleSort}>Edge</SortBtn></span>
                        </Tooltip>
                      </Th>
                      <Th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayPlayers.map((player, idx) => {
                      const isExpanded = expandedPlayerId === (player.player_id ?? idx);
                      const config = getTierFromScore(player.hr_score);
                      return (
                        <React.Fragment key={`${player.player_name}-${idx}`}>
                          <tr
                            onClick={() => setExpandedPlayerId(isExpanded ? null : (player.player_id ?? idx))}
                            className={cn(
                              "cursor-pointer border-b border-neutral-100 dark:border-neutral-800/50 transition-colors",
                              isExpanded
                                ? "bg-neutral-50 dark:bg-neutral-800/40"
                                : "hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20"
                            )}
                          >
                            {/* Rank (by HR score, not current sort) */}
                            <td className="px-3 py-2.5 text-center">
                              {(() => {
                                const rank = rankMap.get(player.player_id) ?? idx + 1;
                                return (
                                  <span className={cn("inline-flex w-6 h-6 items-center justify-center rounded-full text-[11px] font-black",
                                    rank <= 3 ? "bg-amber-500/20 text-amber-400" : rank <= 10 ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500" : "text-neutral-400"
                                  )}>
                                    {rank}
                                  </span>
                                );
                              })()}
                            </td>

                            {/* Player */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <Image
                                  src={getMlbHeadshotUrl(player.player_id, "tiny")}
                                  alt={player.player_name}
                                  width={32}
                                  height={32}
                                  className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
                                  unoptimized
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Image src={`/team-logos/mlb/${player.team_abbr.toUpperCase()}.svg`} alt="" width={14} height={14} className="shrink-0" />
                                    <span className="font-bold text-neutral-900 dark:text-white truncate text-sm">{player.player_name}</span>
                                    {player.bat_hand && (
                                      <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1 rounded">{player.bat_hand}</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-neutral-500 truncate">
                                    vs {player.opp_pitcher_name ?? "TBD"}
                                    {player.opp_pitcher_hand && <span className="text-neutral-400"> ({player.opp_pitcher_hand})</span>}
                                    {player.platoon_advantage && <span className="ml-1 text-emerald-500 font-semibold">PLT</span>}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="px-3 py-2.5 text-center">
                              <ScorePill score={player.hr_score} />
                            </td>

                            {/* Surge */}
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <SurgeIcon direction={player.surge_direction} />
                                {player.hr_streak != null && player.hr_streak >= 2 && (
                                  <span className="text-[9px] font-bold text-amber-400">{player.hr_streak}g streak</span>
                                )}
                              </div>
                            </td>

                            {/* Power */}
                            <td className="px-3 py-2.5 text-center">
                              <span className={cn("text-xs font-bold tabular-nums", getScoreColor(player.batter_power_score))}>
                                {Math.round(player.batter_power_score)}
                              </span>
                            </td>

                            {/* Pitcher Vuln */}
                            <td className="px-3 py-2.5 text-center">
                              <span className={cn("text-xs font-bold tabular-nums", getScoreColor(player.pitcher_vuln_score))}>
                                {Math.round(player.pitcher_vuln_score)}
                              </span>
                            </td>

                            {/* Barrel% */}
                            <td className="px-3 py-2.5 text-center">
                              <span className={cn("text-xs font-bold tabular-nums",
                                (player.barrel_pct ?? 0) >= 15 ? "text-emerald-400" : (player.barrel_pct ?? 0) >= 10 ? "text-green-400" : "text-neutral-400"
                              )}>
                                {formatPct(player.barrel_pct)}
                              </span>
                            </td>

                            {/* Max EV */}
                            <td className="px-3 py-2.5 text-center">
                              <span className={cn("text-xs font-bold tabular-nums",
                                (player.max_exit_velo ?? 0) >= 112 ? "text-emerald-400" : (player.max_exit_velo ?? 0) >= 108 ? "text-green-400" : "text-neutral-400"
                              )}>
                                {player.max_exit_velo?.toFixed(1) ?? "-"}
                              </span>
                            </td>

                            {/* Env */}
                            <td className="px-3 py-2.5 text-center">
                              {player.env_boost ? (
                                <Tooltip content={player.env_boost} side="top">
                                  <span className="cursor-help">{(player.environment_score ?? 0) >= 60
                                    ? <Flame className="w-4 h-4 text-amber-400 mx-auto" />
                                    : (player.environment_score ?? 0) <= 30
                                    ? <Snowflake className="w-4 h-4 text-blue-400 mx-auto" />
                                    : <Minus className="w-4 h-4 text-neutral-400 mx-auto" />
                                  }</span>
                                </Tooltip>
                              ) : (
                                <Minus className="w-4 h-4 text-neutral-500 mx-auto" />
                              )}
                            </td>

                            {/* Best Odds */}
                            <td className="px-3 py-2.5 text-center">
                              <HROddsCell player={player} />
                            </td>

                            {/* Edge */}
                            <td className="px-3 py-2.5 text-center">
                              {player.edge_pct != null ? (
                                <Tooltip
                                  content={player.edge_pct > 0 ? "Our model sees value — HR is more likely than odds imply" : "Market is pricing this about right or better"}
                                  side="top"
                                >
                                  <span className={cn("text-xs font-bold tabular-nums cursor-help",
                                    player.edge_pct > 0 ? "text-emerald-400" : player.edge_pct < 0 ? "text-red-400" : "text-neutral-400"
                                  )}>
                                    {player.edge_pct > 0 ? "+" : ""}{player.edge_pct.toFixed(1)}%
                                  </span>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-neutral-500">-</span>
                              )}
                            </td>

                            {/* Expand */}
                            <td className="px-2 py-2.5 text-center">
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4 text-neutral-400" />
                                : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                            </td>
                          </tr>
                          {isExpanded && <ExpandedRow player={player} />}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Gating overlay */}
        {isGated && sortedPlayers.length > FREE_MAX_ROWS && (
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white dark:from-neutral-950 to-transparent flex items-end justify-center pb-6">
            <div className="text-center">
              <Lock className="w-5 h-5 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                {sortedPlayers.length - FREE_MAX_ROWS} more players available
              </p>
              <ButtonLink href={UPGRADE_URL} className="mt-2 text-sm">
                Upgrade to unlock
              </ButtonLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      "h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/95 dark:bg-neutral-800/95",
      className
    )}>
      {children}
    </th>
  );
}

function SortBtn({ field, current, dir, onClick, children }: {
  field: SortField; current: SortField; dir: SortDirection; onClick: (f: SortField) => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(field)}
      className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
    >
      {children}
      <SortIcon field={field} currentField={current} direction={dir} />
    </button>
  );
}
