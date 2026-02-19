"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import { GripVertical, ChevronDown, ChevronUp } from "lucide-react";

// Sportsbook helpers
const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};

const getBookName = (bookId?: string): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

const getBookFallbackUrl = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  if (!sb) return null;
  return sb.affiliateLink || sb.links?.desktop || null;
};

const formatOddsPrice = (price: number): string => {
  if (price >= 0) return `+${price}`;
  return String(price);
};

// Teammate out structure from game_logs
interface TeammateOut {
  player_id: number;
  name: string;
  avg: number | null;
}

// Game log from hit rate profile (for teammates_out data)
interface ProfileGameLog {
  game_id?: string;
  date?: string;
  teammates_out?: TeammateOut[];
}

type QuickFilterKey = "home" | "away" | "win" | "loss" | "wonBy10" | "lostBy10" | "primetime" | "dvpTough" | "dvpAverage" | "dvpWeak";

// Book odds structure
interface BookOddsData {
  book: string;
  price: number;
  url: string | null;
  mobileUrl: string | null;
}

// Odds data for display
interface OddsDisplayData {
  bestOver?: BookOddsData | null;
  bestUnder?: BookOddsData | null;
  allBooks?: {
    over: BookOddsData[];
    under: BookOddsData[];
  };
  // When custom line doesn't have exact odds, we show closest available line
  oddsLine?: number | null;
  isClosestLine?: boolean;
}

// Mini odds button with dropdown
function MiniOddsButton({ 
  type, 
  best, 
  allBooks 
}: { 
  type: "over" | "under"; 
  best: BookOddsData; 
  allBooks: BookOddsData[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Detect mobile
  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);
  
  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const isOver = type === "over";
  const hasMultiple = allBooks.length > 1;
  
  // Memoize book logo/name lookups
  const bestLogo = useMemo(() => getBookLogo(best.book), [best.book]);
  const bestName = useMemo(() => getBookName(best.book), [best.book]);
  
  // Get link for a book
  const getBookLink = useCallback((book: BookOddsData): string | null => {
    const fallback = getBookFallbackUrl(book.book);
    if (isMobile) {
      return book.mobileUrl || book.url || fallback;
    }
    return book.url || book.mobileUrl || fallback;
  }, [isMobile]);
  
  const handleClick = useCallback((e: React.MouseEvent, book?: BookOddsData) => {
    e.stopPropagation();
    const target = book || best;
    const link = getBookLink(target);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  }, [best, getBookLink]);
  
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMultiple) {
      setIsOpen(prev => !prev);
    } else {
      handleClick(e);
    }
  }, [hasMultiple, handleClick]);
  
  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all",
          "hover:bg-neutral-100 dark:hover:bg-neutral-800",
          isOver 
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
        )}
      >
        <span className={cn(
          "text-[10px] font-bold",
          isOver ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        )}>
          {isOver ? "O" : "U"}
        </span>
        {bestLogo && (
          <img 
            src={bestLogo}
            alt={bestName}
            className="w-4 h-4 rounded object-contain"
          />
        )}
        <span className={cn(
          "text-[11px] font-semibold",
          best.price > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-200"
        )}>
          {formatOddsPrice(best.price)}
        </span>
        {hasMultiple && (
          <ChevronUp className={cn(
            "h-3 w-3 text-neutral-400 transition-transform",
            isOpen && "rotate-180"
          )} />
        )}
      </button>
      
      {/* Dropdown - Opens upward to avoid container overflow clipping */}
      {isOpen && hasMultiple && (
        <div className="absolute right-0 bottom-full z-50 mb-1 min-w-[160px] rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800 overflow-hidden">
          <div className="border-b border-neutral-200 dark:border-neutral-700 px-3 py-1.5">
            <p className="text-[9px] text-neutral-400 dark:text-neutral-500">
              {allBooks.length} books • Best: {formatOddsPrice(best.price)}
            </p>
          </div>
          <div className="py-1 max-h-[200px] overflow-y-auto">
            {allBooks.map((book, idx) => {
              const bookLogo = getBookLogo(book.book);
              const bookName = getBookName(book.book);
              const isBest = idx === 0;
              const link = getBookLink(book);
              
              return (
                <button
                  key={book.book}
                  onClick={(e) => handleClick(e, book)}
                  disabled={!link}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors",
                    link 
                      ? "hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer" 
                      : "opacity-50 cursor-default",
                    isBest && (isOver 
                      ? "bg-emerald-50 dark:bg-emerald-900/20" 
                      : "bg-red-50 dark:bg-red-900/20")
                  )}
                >
                  <div className="flex items-center gap-2">
                    {bookLogo ? (
                      <img src={bookLogo} alt={bookName} className="w-5 h-5 rounded object-contain" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-600" />
                    )}
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {bookName}
                    </span>
                  </div>
                  <span className={cn(
                    "font-semibold",
                    book.price > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-800 dark:text-white"
                  )}>
                    {formatOddsPrice(book.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Play type/shot zone filter types for chart overlay lines
interface MatchupFilterLine {
  type: "playType" | "shotZone";
  key: string; // play type name or zone name
  label: "tough" | "neutral" | "favorable";
  displayName: string;
  color: string;
}

interface GameLogChartProps {
  games: BoxScoreGame[];
  line: number | null;
  market: string;
  sport?: "nba" | "mlb";
  className?: string;
  // Optional: game logs from hit rate profile for teammates_out data
  profileGameLogs?: ProfileGameLog[] | null;
  // Optional: callback when line is changed via drag
  onLineChange?: (newLine: number) => void;
  // Optional: quick filters
  quickFilters?: Set<string>;
  onQuickFilterToggle?: (key: QuickFilterKey) => void;
  onQuickFiltersClear?: () => void;
  // Optional: odds data for display
  odds?: OddsDisplayData | null;
  // Optional: opponent DvP ranks - map of teamId to rank (1-30)
  opponentDvpRanks?: Map<number, number | null>;
  // Optional: DvP range filter (min, max)
  dvpRange?: [number, number] | null;
  onDvpRangeChange?: (range: [number, number] | null) => void;
  // Optional: Play type ranks for overlay lines - map of playType -> teamAbbr -> rank
  playTypeRanksMap?: Map<string, Map<string, number>>;
  // Optional: Shot zone ranks for overlay lines - map of zone -> teamAbbr -> rank
  shotZoneRanksMap?: Map<string, Map<string, number>>;
  // Optional: Active matchup filter lines to show
  activeMatchupFilters?: MatchupFilterLine[];
}

// Get the stat value based on market
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
    case "player_runs_scored": return game.mlbRunsScored ?? 0;
    case "player_rbi": return game.mlbRbi ?? 0;
    case "player_total_bases": return game.mlbTotalBases ?? 0;
    case "pitcher_strikeouts": return game.mlbPitcherStrikeouts ?? 0;
    default: return game.pts;
  }
};

// Check if market is a combo market
const isComboMarket = (market: string): boolean => {
  return [
    "player_points_rebounds_assists",
    "player_points_rebounds", 
    "player_points_assists",
    "player_rebounds_assists",
    "player_blocks_steals"
  ].includes(market);
};

// Get component stats for combo markets
interface ComboStatSegment {
  value: number;
  label: string;
}

const getComboSegments = (game: BoxScoreGame, market: string): ComboStatSegment[] => {
  switch (market) {
    case "player_points_rebounds_assists":
      return [
        { value: game.pts, label: "P" },
        { value: game.reb, label: "R" },
        { value: game.ast, label: "A" },
      ];
    case "player_points_rebounds":
      return [
        { value: game.pts, label: "P" },
        { value: game.reb, label: "R" },
      ];
    case "player_points_assists":
      return [
        { value: game.pts, label: "P" },
        { value: game.ast, label: "A" },
      ];
    case "player_rebounds_assists":
      return [
        { value: game.reb, label: "R" },
        { value: game.ast, label: "A" },
      ];
    case "player_blocks_steals":
      return [
        { value: game.blk, label: "BLK" },
        { value: game.stl, label: "STL" },
      ];
    default:
      return [];
  }
};

// Get short market label for tooltip
const getMarketLabel = (market: string): string => {
  const labels: Record<string, string> = {
    player_points: "pts",
    player_rebounds: "reb",
    player_assists: "ast",
    player_threes_made: "3pm",
    player_blocks: "blk",
    player_steals: "stl",
    player_turnovers: "tov",
    player_points_rebounds_assists: "pra",
    player_points_rebounds: "p+r",
    player_points_assists: "p+a",
    player_rebounds_assists: "r+a",
    player_blocks_steals: "Blk+Stl",
    player_hits: "hits",
    player_home_runs: "hr",
    player_runs_scored: "runs",
    player_rbi: "rbi",
    player_total_bases: "tb",
    pitcher_strikeouts: "k",
  };
  return labels[market] || "stat";
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
};

// Stat row component for tooltip - premium styling
const StatRow = ({ label, value, subValue }: { label: string; value: string | number; subValue?: string }) => (
  <div className="flex items-center justify-between py-[3px]">
    <span className="text-[12px] font-normal text-neutral-400">{label}</span>
    <span className="text-[12px] font-semibold text-white">
      {value}
      {subValue && <span className="font-normal text-neutral-500 ml-1.5">({subValue})</span>}
    </span>
  </div>
);

// Get market-specific stats for tooltip
const getMarketStats = (game: BoxScoreGame, market: string): React.ReactNode => {
  switch (market) {
    case "player_hits":
    case "player_home_runs":
    case "player_runs_scored":
    case "player_rbi":
    case "player_total_bases":
      return (
        <>
          <StatRow label="AB" value={game.mlbAtBats ?? 0} />
          <StatRow label="Hits" value={game.mlbHits ?? 0} />
          <StatRow label="Runs" value={game.mlbRunsScored ?? 0} />
          <StatRow label="RBI" value={game.mlbRbi ?? 0} />
          <StatRow label="Total Bases" value={game.mlbTotalBases ?? 0} />
          <StatRow label="Walks" value={game.mlbWalks ?? 0} />
        </>
      );
    case "pitcher_strikeouts":
      return (
        <>
          <StatRow label="IP" value={game.mlbInningsPitched ?? 0} />
          <StatRow label="Strikeouts" value={game.mlbPitcherStrikeouts ?? 0} />
          <StatRow label="Hits Allowed" value={game.mlbHitsAllowed ?? 0} />
          <StatRow label="Earned Runs" value={game.mlbEarnedRuns ?? 0} />
          <StatRow label="Walks" value={game.mlbWalks ?? 0} />
          <StatRow label="WHIP" value={game.mlbWhipGame?.toFixed(2) ?? "-"} />
        </>
      );
  }

  // Common stats for all markets
  const commonStats = (
    <>
      <StatRow label="Minutes" value={Math.round(game.minutes)} />
      <StatRow label="Fouls" value={game.fouls} />
    </>
  );

  switch (market) {
    case "player_points":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow 
            label="FG" 
            value={`${game.fgm}/${game.fga}`} 
            subValue={`${Math.round(game.fgPct * 100)}%`} 
          />
          <StatRow 
            label="3PT" 
            value={`${game.fg3m}/${game.fg3a}`} 
            subValue={`${Math.round(game.fg3Pct * 100)}%`} 
          />
          <StatRow 
            label="FT" 
            value={`${game.ftm}/${game.fta}`} 
            subValue={`${Math.round(game.ftPct * 100)}%`} 
          />
        </>
      );

    case "player_rebounds":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="OREB" value={game.oreb} />
          <StatRow label="DREB" value={game.dreb} />
          <StatRow label="Total REB" value={game.reb} />
          <StatRow label="Potential REB" value={game.potentialReb} />
        </>
      );

    case "player_assists":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Assists" value={game.ast} />
          <StatRow label="Passes" value={game.passes} />
          <StatRow label="Turnovers" value={game.tov} />
          <StatRow label="AST/TO" value={game.ast === 0 ? "0" : game.tov === 0 ? game.ast.toString() : (game.ast / game.tov).toFixed(1)} />
          <StatRow label="Pace" value={Math.round(game.pace)} />
        </>
      );

    case "player_threes_made":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow 
            label="3PT" 
            value={`${game.fg3m}/${game.fg3a}`} 
            subValue={`${Math.round(game.fg3Pct * 100)}%`} 
          />
          <StatRow 
            label="FG" 
            value={`${game.fgm}/${game.fga}`} 
            subValue={`${Math.round(game.fgPct * 100)}%`} 
          />
          <StatRow 
            label="FT" 
            value={`${game.ftm}/${game.fta}`} 
            subValue={`${Math.round(game.ftPct * 100)}%`} 
          />
        </>
      );

    case "player_steals":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Steals" value={game.stl} />
          <StatRow label="Blocks" value={game.blk} />
          <StatRow label="DEF Rating" value={Math.round(game.defRating)} />
        </>
      );

    case "player_blocks":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Blocks" value={game.blk} />
          <StatRow label="Steals" value={game.stl} />
          <StatRow label="DEF Rating" value={Math.round(game.defRating)} />
        </>
      );

    case "player_blocks_steals":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Blocks" value={game.blk} />
          <StatRow label="Steals" value={game.stl} />
          <StatRow label="Blk+Stl" value={game.bs} />
          <StatRow label="DEF Rating" value={Math.round(game.defRating)} />
        </>
      );

    case "player_points_assists":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Points" value={game.pts} />
          <StatRow label="Assists" value={game.ast} />
          <StatRow label="P+A Total" value={game.pa} />
        </>
      );

    case "player_points_rebounds":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Points" value={game.pts} />
          <StatRow label="Rebounds" value={game.reb} />
          <StatRow label="P+R Total" value={game.pr} />
        </>
      );

    case "player_rebounds_assists":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Rebounds" value={game.reb} />
          <StatRow label="Assists" value={game.ast} />
          <StatRow label="R+A Total" value={game.ra} />
        </>
      );

    case "player_points_rebounds_assists":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Points" value={game.pts} />
          <StatRow label="Rebounds" value={game.reb} />
          <StatRow label="Assists" value={game.ast} />
          {/* Combined */}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="PRA Total" value={game.pra} />
          <StatRow label="Usage" value={`${Math.round(game.usagePct * 100)}%`} />
        </>
      );

    case "player_turnovers":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Turnovers" value={game.tov} />
          <StatRow label="Assists" value={game.ast} />
          <StatRow label="AST/TO" value={game.ast === 0 ? "0" : game.tov === 0 ? game.ast.toString() : (game.ast / game.tov).toFixed(1)} />
          <StatRow label="Passes" value={game.passes} />
          <StatRow label="Usage" value={`${Math.round(game.usagePct * 100)}%`} />
        </>
      );

    default:
      return commonStats;
  }
};

export function GameLogChart({
  games: inputGames,
  line,
  market,
  sport = "nba",
  className,
  profileGameLogs,
  onLineChange,
  quickFilters,
  onQuickFilterToggle,
  onQuickFiltersClear,
  odds,
  opponentDvpRanks,
  dvpRange,
  onDvpRangeChange,
  playTypeRanksMap,
  shotZoneRanksMap,
  activeMatchupFilters = [],
}: GameLogChartProps) {
  // State for showing DvP overlay line
  const [showDvpLine, setShowDvpLine] = useState(false);
  // State for showing matchup filter lines
  const [showMatchupLines, setShowMatchupLines] = useState(true);
  const marketLabel = getMarketLabel(market);
  const chartRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLine, setDragLine] = useState<number | null>(null);
  
  // Use drag line while dragging, otherwise use prop line
  const displayLine = isDragging && dragLine !== null ? dragLine : line;
  
  // Process and reverse game logs (most recent on right)
  const games = useMemo(() => {
    if (!inputGames || inputGames.length === 0) return [];
    return [...inputGames].reverse(); // Oldest first, most recent on right
  }, [inputGames]);

  // Normalize game ID by removing leading zeros for consistent matching
  // NBA game IDs can be "0022500060" or "22500060" depending on source
  const normalizeGameId = (id: string | number | undefined | null): string => {
    if (id === undefined || id === null) return "";
    const idStr = String(id);
    return idStr.replace(/^0+/, ""); // Remove leading zeros
  };

  // Create a lookup map for teammates_out from profile game logs
  const teammatesOutByGameId = useMemo(() => {
    if (!profileGameLogs) return new Map<string, TeammateOut[]>();
    const map = new Map<string, TeammateOut[]>();
    for (const log of profileGameLogs) {
      if (log.game_id && log.teammates_out && log.teammates_out.length > 0) {
        // Store with normalized game_id for consistent lookup
        map.set(normalizeGameId(log.game_id), log.teammates_out);
      }
    }
    return map;
  }, [profileGameLogs]);

  // Calculate chart dimensions - responsive to data range
  const maxStat = useMemo(() => {
    if (games.length === 0) return 10;
    
    // For rebounds market, include potential rebounds in max calculation
    // For 3PM market, include 3PA in max calculation
    let max: number;
    if (market === "player_rebounds") {
      max = Math.max(...games.map(g => Math.max(getMarketStat(g, market), g.potentialReb || 0)));
    } else if (market === "player_threes_made") {
      max = Math.max(...games.map(g => Math.max(getMarketStat(g, market), g.fg3a || 0)));
    } else {
      max = Math.max(...games.map(g => getMarketStat(g, market)));
    }
    
    // For small values (0-5), use a tighter scale
    if (max <= 3) return Math.max(max + 1, 2); // At least 2 for visibility
    if (max <= 5) return max + 2;
    if (max <= 10) return Math.ceil(max / 2) * 2 + 2; // Round to nearest 2
    if (max <= 20) return Math.ceil(max / 5) * 5 + 2; // Round to nearest 5
    // For larger values, round up to nearest 5 with small buffer
    return Math.ceil(max / 5) * 5 + 5;
  }, [games, market]);

  const chartHeight = 200;
  // Adjust bar width based on number of games
  const barWidth = games.length <= 5 ? 48 : games.length <= 10 ? 40 : games.length <= 20 ? 30 : 24;

  // Shared track sizing for bars/logos/dates so all x-axis elements stay aligned.
  const gapPx = 12; // gap-3
  const contentWidth = games.length > 0
    ? games.length * barWidth + (games.length - 1) * gapPx
    : 0;

  // Auto-scroll to the right (most recent games) only when overflowing.
  // Uses requestAnimationFrame to ensure the DOM has laid out the full scroll width first.
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    requestAnimationFrame(() => {
      const isOverflowing = el.scrollWidth > el.clientWidth + 1;
      if (isOverflowing) {
        el.scrollLeft = el.scrollWidth;
      } else {
        el.scrollLeft = 0;
      }
    });
  }, [games.length, barWidth, gapPx]);

  // Calculate line position as percentage (use displayLine for dragging)
  const linePosition = displayLine !== null ? (displayLine / maxStat) * 100 : null;
  
  // Handle drag start - must be before any early returns
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!onLineChange || line === null) return;
    e.preventDefault();
    setIsDragging(true);
    setDragLine(line);
  }, [line, onLineChange]);
  
  // Calculate line value from Y position
  const calculateLineFromY = useCallback((clientY: number): number => {
    if (!chartRef.current) return line ?? 0;
    const rect = chartRef.current.getBoundingClientRect();
    const relativeY = rect.bottom - clientY;
    const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
    // Round to nearest 0.5
    const rawValue = percentage * maxStat;
    return Math.round(rawValue * 2) / 2;
  }, [maxStat, line]);
  
  // Handle drag move - must be before any early returns
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const newLine = calculateLineFromY(clientY);
      setDragLine(newLine);
    };
    
    const handleEnd = () => {
      if (dragLine !== null && onLineChange) {
        onLineChange(dragLine);
      }
      setIsDragging(false);
      setDragLine(null);
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragLine, onLineChange, calculateLineFromY]);

  // Empty state - keep the controls visible so users can adjust filters
  const isEmptyData = !inputGames || inputGames.length === 0;
  
  if (isEmptyData) {
    return (
      <div className={cn("relative", className)}>
        {/* Empty Chart Area with Message */}
        <div className="flex items-center justify-center h-64 text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/20">
          <div className="text-center">
            <p className="text-sm font-medium">No games match current filters</p>
            <p className="text-xs mt-1 text-neutral-400">Try adjusting your filters below</p>
          </div>
        </div>
        
        {/* Quick Filters, Legend & Odds Row - Still visible for adjustment */}
        <div className="mt-4 flex items-center justify-between">
          {/* Quick Filters - Left */}
          {onQuickFilterToggle ? (
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {([
                { key: "home" as QuickFilterKey, label: "Home" },
                { key: "away" as QuickFilterKey, label: "Away" },
                { key: "win" as QuickFilterKey, label: "Win" },
                { key: "loss" as QuickFilterKey, label: "Loss" },
                { key: "wonBy10" as QuickFilterKey, label: "Won 10+" },
                { key: "lostBy10" as QuickFilterKey, label: "Lost 10+" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onQuickFilterToggle(key)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-medium rounded-md border transition-all",
                    quickFilters?.has(key)
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  {label}
                </button>
              ))}
              {/* DvP Defense Filters - only show if we have DvP data */}
              {opponentDvpRanks && opponentDvpRanks.size > 0 && (
                <>
                  <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
                  {([
                    { key: "dvpTough" as QuickFilterKey, label: "DvP 1-10", tooltip: "Tough defense" },
                    { key: "dvpAverage" as QuickFilterKey, label: "DvP 11-20", tooltip: "Average defense" },
                    { key: "dvpWeak" as QuickFilterKey, label: "DvP 21-30", tooltip: "Weak defense" },
                  ]).map(({ key, label, tooltip }) => (
                    <Tooltip key={key} content={tooltip} side="top">
                      <button
                        type="button"
                        onClick={() => onQuickFilterToggle(key)}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-medium rounded-md border transition-all",
                          quickFilters?.has(key)
                            ? key === "dvpTough" 
                              ? "bg-red-500 text-white border-red-500 shadow-sm"
                              : key === "dvpAverage"
                              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                              : "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                            : "border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        )}
                      >
                        {label}
                      </button>
                    </Tooltip>
                  ))}
                </>
              )}
              {quickFilters && quickFilters.size > 0 && onQuickFiltersClear && (
                <button
                  type="button"
                  onClick={onQuickFiltersClear}
                  className="px-2 py-1 text-[10px] font-medium text-red-500 hover:text-red-600"
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1" /> 
          )}

          {/* Legend - Center (simplified for empty state) */}
          <div className="flex items-center justify-center gap-4 text-[10px] flex-1">
            <span className="text-neutral-400">No data to display</span>
          </div>

          {/* Odds - Right (using MiniOddsButton like the main chart) */}
          <div className="flex items-center justify-end gap-2 text-[10px] flex-1">
            {(odds?.bestOver || odds?.bestUnder) && (
              <>
                {odds?.bestOver && (
                  <MiniOddsButton
                    type="over"
                    best={odds.bestOver}
                    allBooks={odds.allBooks?.over || []}
                  />
                )}
                {odds?.bestUnder && (
                  <MiniOddsButton
                    type="under"
                    best={odds.bestUnder}
                    allBooks={odds.allBooks?.under || []}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Y-Axis Labels + tick marks */}
      <div className="absolute left-0 w-10 flex flex-col justify-between z-20" style={{ top: 0, height: chartHeight }}>
        {[maxStat, Math.round(maxStat / 2), 0].map((val) => (
          <div key={val} className="flex items-center">
            <span className="text-[10px] tabular-nums text-neutral-500 dark:text-neutral-400 font-medium text-right flex-1 pr-1.5">{val}</span>
            <div className="w-1.5 border-b border-neutral-400/20 dark:border-neutral-500/20" />
          </div>
        ))}
      </div>

      {/* DvP Y-Axis Labels - Right side (only when DvP line is shown) */}
      {showDvpLine && opponentDvpRanks && opponentDvpRanks.size > 0 && (
        <div className="absolute right-0 w-12 flex flex-col justify-between text-[9px] font-medium pr-1 z-20" style={{ top: 0, height: chartHeight }}>
          {/* Top = Rank 30 (Weak defense = good for player) */}
          <div className="flex items-center justify-end gap-0.5">
            <span className="text-emerald-500 font-bold">#30</span>
          </div>
          {/* Middle = Rank 15 */}
          <div className="flex items-center justify-end gap-0.5">
            <span className="text-amber-500 font-bold">#15</span>
          </div>
          {/* Bottom = Rank 1 (Tough defense = hard for player) */}
          <div className="flex items-center justify-end gap-0.5">
            <span className="text-red-500 font-bold">#1</span>
          </div>
        </div>
      )}

      {/* Line value label - anchored in Y-axis area, always visible outside scroll */}
      {linePosition !== null && (
        <>
          <div
            onMouseDown={onLineChange ? handleDragStart : undefined}
            onTouchStart={onLineChange ? handleDragStart : undefined}
            className={cn(
              "absolute left-0 z-30",
              onLineChange
                ? (isDragging ? "cursor-grabbing pointer-events-auto touch-none" : "cursor-grab pointer-events-auto touch-none")
                : "pointer-events-none"
            )}
            style={{
              top: chartHeight * (1 - linePosition / 100),
              transform: "translateY(-50%)",
            }}
          >
            <div
              className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition-all shadow-sm",
                isDragging
                  ? "bg-amber-500 dark:bg-amber-400 text-black scale-110"
                  : "bg-primary dark:bg-primary-weak text-on-primary"
              )}
            >
              {onLineChange && (
                <GripVertical className="h-2.5 w-2.5 opacity-60" />
              )}
              {displayLine}
            </div>
          </div>
          {/* Connecting line from label to chart area */}
          <div
            onMouseDown={onLineChange ? handleDragStart : undefined}
            onTouchStart={onLineChange ? handleDragStart : undefined}
            className={cn(
              "absolute z-[22] left-10 right-0",
              onLineChange
                ? (isDragging ? "cursor-grabbing pointer-events-auto touch-none" : "cursor-grab pointer-events-auto touch-none")
                : "pointer-events-none"
            )}
            style={{
              top: chartHeight * (1 - linePosition / 100),
              transform: "translateY(-50%)",
            }}
          >
            <div className="absolute left-0 right-0 top-1/2 h-8 -translate-y-1/2" />
            <div className={cn(
              "absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed transition-all duration-200 pointer-events-none",
              isDragging
                ? "border-amber-500 dark:border-amber-400"
                : "border-primary/40 dark:border-primary-weak/40"
            )}
            style={isDragging ? { filter: "drop-shadow(0 0 4px rgba(245, 158, 11, 0.3))" } : undefined}
            />
          </div>
        </>
      )}

      {/* Scrollable chart wrapper */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "ml-10",
          showDvpLine && "mr-16",
          "overflow-x-auto scrollbar-thin"
        )}
      >
      <div className="w-max min-w-full">
      <div className="mx-auto" style={{ width: contentWidth }}>

      {/* Chart Area */}
      <div ref={chartRef} className="relative" style={{ height: chartHeight }}>
        {/* Subtle chart background gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-sm">
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-500/[0.04] via-transparent to-transparent dark:from-white/[0.025] dark:via-transparent dark:to-transparent" />
        </div>

        {/* Horizontal grid lines at Y-axis ticks */}
        <div className="absolute top-0 left-0 right-0 border-b border-dashed border-neutral-400/[0.12] dark:border-neutral-500/[0.15] pointer-events-none" />
        <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-neutral-400/[0.12] dark:border-neutral-500/[0.15] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 border-b border-neutral-400/[0.20] dark:border-neutral-500/[0.20] pointer-events-none" />

        {/* Bars Container - fixed track with shared widths for perfect x-axis alignment */}
        <div className="absolute inset-0 flex items-end justify-start gap-3 z-10 pointer-events-none">
          
          {/* DvP Line Overlay - positioned relative to centered bars */}
          {showDvpLine && opponentDvpRanks && opponentDvpRanks.size > 0 && games.length > 1 && (() => {
            // Calculate dimensions matching the bar/date track
            const gapSize = gapPx;

            // Build points data - X positions are relative to content start (0)
            const points = games.map((game, idx) => {
              const dvpRank = opponentDvpRanks.get(game.opponentTeamId);
              if (dvpRank === null || dvpRank === undefined) return null;
              
              // X = center of each bar within the content area
              const x = idx * (barWidth + gapSize) + (barWidth / 2);
              
              // Y = rank 1 at bottom (tough), rank 30 at top (weak)
              const yPercent = ((dvpRank - 1) / 29) * 100;
              const y = chartHeight * (1 - yPercent / 100);
              
              return { x, y, rank: dvpRank, idx };
            }).filter(Boolean) as { x: number; y: number; rank: number; idx: number }[];
            
            if (points.length < 2) return null;
            
            // Build SVG path
            const pathD = points.map((p, i) => 
              i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
            ).join(' ');
            
            return (
              <svg 
                className="absolute bottom-0 left-0 z-[5] pointer-events-none"
                style={{ 
                  width: contentWidth, 
                  height: chartHeight,
                }}
                viewBox={`0 0 ${contentWidth} ${chartHeight}`}
              >
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="dvpLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                
                {/* Line path - clean without dots/numbers */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="url(#dvpLineGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.4))' }}
                />
              </svg>
            );
          })()}
          
          {/* Matchup Filter Lines - Play Type and Shot Zone */}
          {showMatchupLines && activeMatchupFilters.length > 0 && games.length > 1 && (() => {
            // Calculate dimensions matching the bar/date track
            const gapSize = gapPx;

            // Render a line for each active matchup filter
            return activeMatchupFilters.map((filter, filterIdx) => {
              const ranksMap = filter.type === "playType" ? playTypeRanksMap?.get(filter.key) : shotZoneRanksMap?.get(filter.key);
              if (!ranksMap) return null;
              
              // Build points data - X positions are relative to content start (0)
              const points = games.map((game, idx) => {
                const rank = ranksMap.get(game.opponentAbbr);
                if (rank === null || rank === undefined) return null;
                
                // X = center of each bar within the content area
                const x = idx * (barWidth + gapSize) + (barWidth / 2);
                
                // Y = rank 1 at bottom (tough), rank 30 at top (weak/favorable)
                const yPercent = ((rank - 1) / 29) * 100;
                const y = chartHeight * (1 - yPercent / 100);
                
                return { x, y, rank, idx };
              }).filter(Boolean) as { x: number; y: number; rank: number; idx: number }[];
              
              if (points.length < 2) return null;
              
              // Build SVG path
              const pathD = points.map((p, i) => 
                i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
              ).join(' ');
              
              return (
                <svg 
                  key={`${filter.type}-${filter.key}`}
                  className="absolute bottom-0 left-0 z-[4] pointer-events-none"
                  style={{ 
                    width: contentWidth, 
                    height: chartHeight,
                  }}
                  viewBox={`0 0 ${contentWidth} ${chartHeight}`}
                >
                  {/* Line path */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={filter.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={filter.type === "shotZone" ? "4 2" : "none"}
                    style={{ 
                      filter: `drop-shadow(0 0 4px ${filter.color}40)`,
                      opacity: 0.8,
                    }}
                  />
                </svg>
              );
            });
          })()}
          
          {/* Note: individual bars will have pointer-events-auto for tooltips */}
          {games.map((game, idx) => {
            const statValue = getMarketStat(game, market);
            const barHeightPx = (statValue / maxStat) * chartHeight;
            // Use displayLine for real-time updates while dragging
            // >= so that hitting exactly the line counts as a hit (e.g., 1 block when line is 1)
            const hasLine = displayLine !== null;
            const isHit = hasLine && statValue >= displayLine;
            const opponentLogo = getTeamLogoUrl(game.opponentAbbr, sport);
            
            // Get opponent DvP rank for this market
            const opponentDvpRank = opponentDvpRanks?.get(game.opponentTeamId) ?? null;
            const getDvpRankColor = (rank: number | null) => {
              if (rank === null) return "text-neutral-400";
              if (rank <= 10) return "text-red-400"; // tough
              if (rank <= 20) return "text-amber-400"; // average
              return "text-emerald-400"; // weak
            };
            const getDvpLabel = (rank: number | null) => {
              if (rank === null) return null;
              if (rank <= 10) return "Tough";
              if (rank <= 20) return "Avg";
              return "Weak";
            };
            
            // Get teammates out for this game from profile game logs
            // Use normalized game ID to match across different formats
            const teammatesOut = teammatesOutByGameId.get(normalizeGameId(game.gameId)) || [];
            
            // Tooltip content - Premium trillion-dollar design
            const tooltipContent = (
              <div className="min-w-[240px] bg-neutral-900 dark:bg-neutral-950 rounded-xl overflow-hidden shadow-2xl border border-neutral-800/50">
                {/* ═══ HEADER BLOCK ═══ */}
                <div className="bg-neutral-950 dark:bg-black px-4 py-3 border-b border-neutral-800/50">
                  <div className="flex items-center justify-between gap-3">
                    {/* Date + Matchup */}
                    <div className="flex items-center gap-2">
                      {opponentLogo && (
                        <img 
                          src={opponentLogo} 
                          alt={game.opponentAbbr} 
                          className="w-5 h-5 object-contain"
                        />
                      )}
                  <span className="text-sm font-semibold text-white">
                    {formatDate(game.date)} {game.homeAway === "H" ? "vs" : "@"} {game.opponentAbbr}
                  </span>
                    </div>
                    {/* Result Pill + DvP Badge */}
                    <div className="flex items-center gap-2">
                      {opponentDvpRank !== null && (
                        <div className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold tracking-wide bg-neutral-800/50",
                          getDvpRankColor(opponentDvpRank)
                        )}>
                          DvP #{opponentDvpRank} <span className="opacity-70">({getDvpLabel(opponentDvpRank)})</span>
                        </div>
                      )}
                    <div className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide",
                    game.result === "W" 
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30" 
                        : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                  )}>
                      {game.result === "W" ? `W +${Math.abs(game.margin)}` : `L ${game.margin}`}
                    </div>
                    </div>
                  </div>
                </div>

                {/* ═══ BODY ═══ */}
                <div className="px-4 py-4">
                {/* Main Stat - Hero */}
                <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-black text-white tracking-tight leading-none">{statValue}</span>
                    <span className="text-sm font-medium text-neutral-400 uppercase tracking-wide">{marketLabel}</span>
                </div>

                {/* Market-specific Stats Grid */}
                  <div className="space-y-0">
                  {getMarketStats(game, market)}
                  </div>
                </div>

                {/* ═══ ACTIVE FILTER RANKS ═══ */}
                {activeMatchupFilters.length > 0 && (
                  <div className="px-4 py-3 border-t border-neutral-800/50">
                    <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">
                      {game.opponentAbbr} Defense Ranks
                    </span>
                    <div className="space-y-1.5">
                      {activeMatchupFilters.map((filter) => {
                        // Look up the opponent's rank for this filter
                        const ranksMap = filter.type === "playType" ? playTypeRanksMap : shotZoneRanksMap;
                        const teamRanks = ranksMap?.get(filter.key);
                        const opponentRank = teamRanks?.get(game.opponentAbbr);
                        
                        if (!opponentRank) return null;
                        
                        const getRankColor = (rank: number) => {
                          if (rank <= 10) return "text-red-400"; // Tough
                          if (rank >= 21) return "text-emerald-400"; // Favorable
                          return "text-yellow-400"; // Neutral
                        };
                        
                        const getRankBg = (rank: number) => {
                          if (rank <= 10) return "bg-red-500/20";
                          if (rank >= 21) return "bg-emerald-500/20";
                          return "bg-yellow-500/20";
                        };
                        
                        return (
                          <div key={`${filter.type}-${filter.key}`} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-neutral-300 truncate">
                              {filter.displayName}
                            </span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums",
                              getRankBg(opponentRank),
                              getRankColor(opponentRank)
                            )}>
                              #{opponentRank}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ═══ TEAMMATES OUT FOOTER ═══ */}
                {teammatesOut.length > 0 && (
                  <div className="px-4 py-3 bg-neutral-950/50 dark:bg-black/30 border-t border-[#ffffff0d]">
                    {/* Title Row */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Teammates Out
                      </span>
                      {teammatesOut.length > 3 && (
                        <span className="text-[10px] font-medium text-amber-500">
                          +{teammatesOut.length - 3} more
                        </span>
                      )}
                    </div>
                    {/* Player Rows */}
                    <div className="space-y-[5px]">
                      {[...teammatesOut]
                        .sort((a, b) => {
                          if (a.avg !== null && b.avg !== null) return b.avg - a.avg;
                          if (a.avg !== null) return -1;
                          if (b.avg !== null) return 1;
                          return a.name.localeCompare(b.name);
                        })
                        .slice(0, 3)
                        .map((teammate) => {
                          // Color code based on impact (avg value)
                          const getAvgColor = (avg: number | null) => {
                            if (avg === null) return "text-neutral-500";
                            if (avg >= 15) return "text-amber-400"; // High impact - gold
                            if (avg >= 8) return "text-orange-400"; // Medium - orange
                            return "text-neutral-400"; // Low - gray
                          };
                          
                          return (
                            <div key={teammate.player_id} className="flex items-center gap-2">
                              {/* Player Headshot - using NBA CDN */}
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-neutral-800 ring-1 ring-white/10 flex-shrink-0">
                                <img
                                  src={`https://cdn.nba.com/headshots/nba/latest/260x190/${teammate.player_id}.png`}
                                  alt={teammate.name}
                                  className="w-full h-full object-cover object-top"
                                  onError={(e) => {
                                    e.currentTarget.src = "/images/player-fallback.png";
                                  }}
                                />
                              </div>
                              {/* Name + Average */}
                              <div className="flex-1 flex items-center justify-between min-w-0">
                                <span className="text-[11px] font-medium text-neutral-200 truncate">
                              {teammate.name}
                            </span>
                            {teammate.avg !== null && (
                                  <span className={cn(
                                    "text-[11px] font-semibold ml-2 tabular-nums",
                                    getAvgColor(teammate.avg)
                                  )}>
                                    {teammate.avg.toFixed(1)}
                              </span>
                            )}
                          </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );

            return (
              <Tooltip key={game.gameId || idx} content={tooltipContent} side="top">
                <div
                  className="relative shrink-0 flex flex-col items-end justify-end cursor-pointer group pointer-events-auto"
                  style={{ width: barWidth, height: chartHeight }}
                >
                  {/* Bar - Stacked for combo markets, solid for single stat */}
                  {isComboMarket(market) ? (
                    // Stacked bar for combo markets - still green/red based on hit
                    <div className="flex flex-col items-center">
                      {/* Total value directly above the bar */}
                      <span className={cn(
                        "text-xs font-bold mb-1",
                        !hasLine 
                          ? "text-neutral-500 dark:text-neutral-400"
                          : isHit 
                            ? "text-emerald-600 dark:text-emerald-400" 
                            : "text-red-500 dark:text-red-400"
                      )}>
                        {statValue}
                      </span>
                  <div
                    className={cn(
                          "w-full rounded-t transition-all duration-200 group-hover:brightness-110 relative flex flex-col-reverse overflow-hidden",
                      !hasLine
                            ? "bg-gradient-to-t from-neutral-500 to-neutral-400 dark:from-neutral-600 dark:to-neutral-500"
                            : isHit
                              ? "bg-gradient-to-t from-emerald-600 to-emerald-500 dark:from-emerald-700 dark:to-emerald-600"
                              : "bg-gradient-to-t from-red-600 to-red-500 dark:from-red-700 dark:to-red-600"
                    )}
                    style={{
                          width: barWidth,
                      height: statValue === 0 ? 8 : Math.max(barHeightPx, 24),
                      boxShadow: !hasLine
                        ? undefined
                        : isHit
                          ? "0 -2px 12px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255,255,255,0.15)"
                          : "inset 0 1px 0 rgba(255,255,255,0.1)"
                    }}
                  >
                        {(() => {
                          const segments = getComboSegments(game, market);
                          // Filter out segments with 0 value
                          const nonZeroSegments = segments.filter(s => s.value > 0);
                          const total = nonZeroSegments.reduce((sum, s) => sum + s.value, 0);
                          
                          return nonZeroSegments.map((segment, segIdx) => {
                            const segmentHeight = total > 0 ? (segment.value / total) * 100 : 0;
                            const isFirstSegment = segIdx === 0;
                            const isLastSegment = segIdx === nonZeroSegments.length - 1;
                            
                            return (
                              <div
                                key={segment.label}
                                className={cn(
                                  "w-full relative flex items-center justify-center",
                                  isLastSegment && "rounded-t",
                                  // Lighter shade for visual separation
                                  !hasLine
                                    ? segIdx % 2 === 0 
                                      ? "bg-neutral-500/80 dark:bg-neutral-500/80" 
                                      : "bg-neutral-400/60 dark:bg-neutral-400/60"
                                    : isHit 
                                      ? segIdx % 2 === 0 
                                        ? "bg-emerald-500/80 dark:bg-emerald-500/80" 
                                        : "bg-emerald-400/60 dark:bg-emerald-400/60"
                                      : segIdx % 2 === 0 
                                        ? "bg-red-500/80 dark:bg-red-500/80" 
                                        : "bg-red-400/60 dark:bg-red-400/60",
                                  // Subtle divider between segments
                                  !isFirstSegment && "border-t border-white/30 dark:border-white/20"
                                )}
                                style={{ height: `${segmentHeight}%`, minHeight: 28 }}
                              >
                                {/* Value on top, abbreviation below */}
                                <div className="flex flex-col items-center justify-center leading-none">
                                  <span className="text-[10px] font-bold text-white drop-shadow-sm">
                                    {segment.value}
                                  </span>
                                  <span className="text-[7px] font-semibold text-white/80 uppercase tracking-wide">
                                    {segment.label}
                                  </span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : (
                    // Solid bar for single stat markets
                    <div className="flex flex-col items-center">
                      {/* Stat value above the bar */}
                    {statValue > 0 && (
                        <span className={cn(
                          "text-xs font-bold mb-1",
                          !hasLine 
                            ? "text-neutral-500 dark:text-neutral-400"
                            : isHit 
                              ? "text-emerald-600 dark:text-emerald-400" 
                              : "text-red-500 dark:text-red-400"
                        )}>
                        {statValue}
                      </span>
                    )}
                      <div className="relative">
                        {/* Potential Rebounds - Faded overlay (only for rebounds market) */}
                        {market === "player_rebounds" && game.potentialReb > 0 && game.potentialReb > game.reb && (
                          <>
                            <div
                              className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-200 bg-gradient-to-t from-neutral-400/30 to-neutral-300/20 dark:from-neutral-500/30 dark:to-neutral-400/20"
                              style={{ 
                                width: barWidth,
                                height: Math.max(((game.potentialReb / maxStat) * chartHeight), 24),
                              }}
                            />
                            {/* Potential Reb value - faded text above potential bar */}
                            <span 
                              className="absolute text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 left-1/2 -translate-x-1/2"
                              style={{ bottom: `${((game.potentialReb / maxStat) * chartHeight) + 2}px` }}
                            >
                              {game.potentialReb}
                            </span>
                          </>
                        )}
                        
                        {/* 3PA - Faded overlay (only for 3PM market) */}
                        {market === "player_threes_made" && game.fg3a > 0 && game.fg3a > game.fg3m && (
                          <>
                            <div
                              className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-200 bg-gradient-to-t from-neutral-400/30 to-neutral-300/20 dark:from-neutral-500/30 dark:to-neutral-400/20"
                              style={{ 
                                width: barWidth,
                                height: Math.max(((game.fg3a / maxStat) * chartHeight), 24),
                              }}
                            />
                            {/* 3PA value - faded text above 3PA bar */}
                            <span 
                              className="absolute text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 left-1/2 -translate-x-1/2"
                              style={{ bottom: `${((game.fg3a / maxStat) * chartHeight) + 2}px` }}
                            >
                              {game.fg3a}
                            </span>
                          </>
                        )}
                        {/* Actual stat bar */}
                        <div
                          className={cn(
                            "rounded-t transition-all duration-200 group-hover:brightness-110 relative",
                            !hasLine
                              ? "bg-gradient-to-t from-neutral-500 to-neutral-400 dark:from-neutral-600 dark:to-neutral-500"
                              : isHit
                                ? "bg-gradient-to-t from-emerald-600 to-emerald-400 dark:from-emerald-600 dark:to-emerald-500"
                                : "bg-gradient-to-t from-red-600 to-red-400 dark:from-red-600 dark:to-red-500"
                          )}
                          style={{
                            width: barWidth,
                            height: statValue === 0 ? 8 : Math.max(barHeightPx, 24),
                            boxShadow: !hasLine
                              ? undefined
                              : isHit
                                ? "0 -2px 12px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255,255,255,0.15)"
                                : "inset 0 1px 0 rgba(255,255,255,0.1)"
                          }}
                        />
                  </div>
                  </div>
                  )}
                  
                  {/* Value above bar for 0 */}
                  {statValue === 0 && (
                    <span className="absolute text-xs font-bold text-neutral-500 -translate-x-1/2 left-1/2" style={{ bottom: 12 }}>
                      0
                    </span>
                  )}

                  {/* Opponent logo indicator */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
                    {opponentLogo ? (
                      <img
                        src={opponentLogo}
                        alt={game.opponentAbbr}
                        className="w-4 h-4 object-contain opacity-60 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <span className="text-[10px] text-neutral-400">
                        {game.homeAway === "H" ? "H" : "A"}
                      </span>
                    )}
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>

        {/* Line Threshold - Draggable hit area (above bars, full chart width) */}
        {linePosition !== null && onLineChange && (
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className={cn(
              "absolute left-0 right-0 z-20 group/line touch-none",
              !isDragging && "cursor-grab",
              isDragging && "cursor-grabbing"
            )}
            style={{ bottom: `${linePosition}%` }}
          >
            {/* Full-width hit area with hover highlight */}
            <div className={cn(
              "absolute left-0 right-0 h-10 -translate-y-1/2 transition-all duration-200 rounded-sm",
              isDragging
                ? "bg-amber-500/10 dark:bg-amber-400/10"
                : "hover:bg-amber-500/[0.06] dark:hover:bg-amber-400/[0.06]"
            )} />
            {/* Enhanced dashed line on hover - overlays the base line for emphasis */}
            <div className={cn(
              "absolute left-0 right-0 -translate-y-[1px] border-t-2 border-dashed transition-all duration-200 pointer-events-none",
              isDragging
                ? "border-amber-500 dark:border-amber-400 opacity-100"
                : "border-transparent group-hover/line:border-amber-500/40 dark:group-hover/line:border-amber-400/40"
            )} />
          </div>
        )}
      </div>

      {/* X-Axis - Dates */}
      <div className="mt-8 flex justify-start gap-3">
        {games.map((game, idx) => (
          <div
            key={game.gameId || idx}
            className="shrink-0 text-[9px] text-neutral-400 text-center font-medium"
            style={{ width: barWidth }}
          >
            {formatShortDate(game.date)}
          </div>
        ))}
      </div>

      </div>{/* end centered track */}
      </div>{/* end minWidth inner */}
      </div>{/* end scroll wrapper */}

      {/* Chart Annotation Row - Outside scroll so it stays fixed */}
      <div className={cn("ml-10 mt-3 flex items-center justify-between", showDvpLine && "mr-16")}>
        {/* Context Toggles - Slim, clickable pills (left) */}
        {onQuickFilterToggle ? (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-medium text-neutral-400 mr-1">Context:</span>
            {([
              { key: "home" as QuickFilterKey, label: "Home" },
              { key: "away" as QuickFilterKey, label: "Away" },
              { key: "win" as QuickFilterKey, label: "Win" },
              { key: "loss" as QuickFilterKey, label: "Loss" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onQuickFilterToggle(key)}
                className={cn(
                  "px-1.5 py-0.5 text-[9px] font-medium rounded transition-all",
                  quickFilters?.has(key)
                    ? "bg-neutral-800 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
              >
                {label}
              </button>
            ))}
            {/* DvP toggles - only show if we have DvP data */}
            {opponentDvpRanks && opponentDvpRanks.size > 0 && (
              <>
                <span className="text-neutral-300 dark:text-neutral-600 mx-0.5">·</span>
                {([
                  { key: "dvpTough" as QuickFilterKey, label: "DvP 1-10" },
                  { key: "dvpWeak" as QuickFilterKey, label: "DvP 21-30" },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onQuickFilterToggle(key)}
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] font-medium rounded transition-all",
                      quickFilters?.has(key)
                        ? key === "dvpTough"
                          ? "bg-red-500 text-white"
                          : "bg-emerald-500 text-white"
                        : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Minimal Legend - Whispers, doesn't speak (center-right) */}
        <div className="flex items-center gap-3 text-[9px] text-neutral-400 dark:text-neutral-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-emerald-500/70" />
            <span>Hit</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-red-500/70" />
            <span>Miss</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 border-t border-dashed border-neutral-400/50" />
            <span>{line}</span>
          </div>
          {/* DvP Line Toggle - subtle */}
          {opponentDvpRanks && opponentDvpRanks.size > 0 && (
            <button
              type="button"
              onClick={() => setShowDvpLine(!showDvpLine)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded transition-all",
                showDvpLine
                  ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              )}
            >
              <div className="w-3 h-0.5 bg-gradient-to-r from-red-400 via-blue-400 to-emerald-400 rounded-full" />
              <span>DvP</span>
            </button>
          )}
          {/* Active Matchup Filter Lines Legend */}
          {activeMatchupFilters.length > 0 && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-neutral-200 dark:border-neutral-700">
              {activeMatchupFilters.map((filter) => (
                <div
                  key={`${filter.type}-${filter.key}`}
                  className="flex items-center gap-1"
                >
                  <div
                    className={cn(
                      "w-3 h-0.5 rounded-full",
                      filter.type === "shotZone" && "border-t border-dashed"
                    )}
                    style={{
                      backgroundColor: filter.type !== "shotZone" ? filter.color : undefined,
                      borderColor: filter.type === "shotZone" ? filter.color : undefined
                    }}
                  />
                  <span className="text-[9px]" style={{ color: filter.color }}>
                    {filter.displayName.length > 10 ? filter.displayName.substring(0, 10) + "..." : filter.displayName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
