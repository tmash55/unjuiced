"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import { GripVertical, ChevronDown } from "lucide-react";

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

type QuickFilterKey = "home" | "away" | "win" | "loss" | "wonBy10" | "lostBy10" | "primetime";

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
          <ChevronDown className={cn(
            "h-3 w-3 text-neutral-400 transition-transform",
            isOpen && "rotate-180"
          )} />
        )}
      </button>
      
      {/* Dropdown */}
      {isOpen && hasMultiple && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800 overflow-hidden">
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
          <div className="border-t border-neutral-200 dark:border-neutral-700 px-3 py-1.5">
            <p className="text-[9px] text-neutral-400 dark:text-neutral-500">
              {allBooks.length} books • Best: {formatOddsPrice(best.price)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface GameLogChartProps {
  games: BoxScoreGame[];
  line: number | null;
  market: string;
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
          <StatRow label="AST/TO" value={game.tov > 0 ? (game.ast / game.tov).toFixed(1) : "∞"} />
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
          <StatRow label="Usage" value={`${Math.round(game.usagePct)}%`} />
        </>
      );

    case "player_turnovers":
      return (
        <>
          {commonStats}
          <div className="my-2 border-t border-[#ffffff0d]" />
          <StatRow label="Turnovers" value={game.tov} />
          <StatRow label="Assists" value={game.ast} />
          <StatRow label="AST/TO" value={game.tov > 0 ? (game.ast / game.tov).toFixed(1) : "∞"} />
          <StatRow label="Passes" value={game.passes} />
          <StatRow label="Usage" value={`${Math.round(game.usagePct)}%`} />
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
  className,
  profileGameLogs,
  onLineChange,
  quickFilters,
  onQuickFilterToggle,
  onQuickFiltersClear,
  odds,
}: GameLogChartProps) {
  const marketLabel = getMarketLabel(market);
  const chartRef = useRef<HTMLDivElement>(null);
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
    const max = Math.max(...games.map(g => getMarketStat(g, market)));
    
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
  const barWidth = games.length <= 5 ? 48 : games.length <= 10 ? 36 : games.length <= 20 ? 24 : 16;

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

  // Early return for empty data - AFTER all hooks
  if (!inputGames || inputGames.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 text-neutral-400", className)}>
        No game log data available
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Y-Axis Labels */}
      <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-[10px] text-neutral-400 font-medium">
        <span>{maxStat}</span>
        <span>{Math.round(maxStat / 2)}</span>
        <span>0</span>
      </div>

      {/* Chart Area */}
      <div ref={chartRef} className="ml-10 relative" style={{ height: chartHeight }}>
        {/* Bottom Line Only */}
        <div className="absolute bottom-0 left-0 right-0 border-b border-neutral-200 dark:border-neutral-700" />

        {/* Line Threshold - Visual line (behind bars) */}
        {linePosition !== null && (
          <div
            className="absolute left-0 right-0 z-0 pointer-events-none"
            style={{ bottom: `${linePosition}%` }}
          >
            {/* Visible dashed line - behind bars */}
            <div className={cn(
              "absolute left-0 right-0 border-t-2 border-dashed transition-all",
              isDragging 
                ? "border-amber-500 dark:border-amber-400" 
                : "border-primary dark:border-primary-weak"
            )} />
          </div>
        )}

        {/* Bars - above the line */}
        <div className="absolute inset-0 flex items-end justify-center gap-3 z-10 pointer-events-none">
          {/* Note: individual bars will have pointer-events-auto for tooltips */}
          {games.map((game, idx) => {
            const statValue = getMarketStat(game, market);
            const barHeightPx = (statValue / maxStat) * chartHeight;
            // Use displayLine for real-time updates while dragging
            // >= so that hitting exactly the line counts as a hit (e.g., 1 block when line is 1)
            const isHit = displayLine !== null && statValue >= displayLine;
            const opponentLogo = getTeamLogoUrl(game.opponentAbbr, "nba");
            
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
                    {/* Result Pill */}
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
                  className="relative flex flex-col items-end justify-end cursor-pointer group pointer-events-auto"
                  style={{ width: barWidth, height: chartHeight }}
                >
                  {/* Bar - Stacked for combo markets, solid for single stat */}
                  {isComboMarket(market) ? (
                    // Stacked bar for combo markets - still green/red based on hit
                    <div className="flex flex-col items-center">
                      {/* Total value directly above the bar */}
                      <span className={cn(
                        "text-xs font-bold mb-1",
                        isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                      )}>
                        {statValue}
                      </span>
                      <div
                        className={cn(
                          "w-full rounded-t transition-all duration-200 group-hover:opacity-90 relative flex flex-col-reverse overflow-hidden",
                          isHit
                            ? "bg-gradient-to-t from-emerald-600 to-emerald-500 dark:from-emerald-700 dark:to-emerald-600"
                            : "bg-gradient-to-t from-red-600 to-red-500 dark:from-red-700 dark:to-red-600"
                        )}
                        style={{ 
                          width: barWidth,
                          height: statValue === 0 ? 8 : Math.max(barHeightPx, 24),
                          boxShadow: isHit 
                            ? "0 -2px 8px rgba(16, 185, 129, 0.3)" 
                            : undefined
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
                                  isHit 
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
                          isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                        )}>
                          {statValue}
                        </span>
                      )}
                      <div
                        className={cn(
                          "rounded-t transition-all duration-200 group-hover:opacity-90",
                          isHit
                            ? "bg-gradient-to-t from-emerald-500 to-emerald-400 dark:from-emerald-600 dark:to-emerald-500"
                            : "bg-gradient-to-t from-red-500 to-red-400 dark:from-red-600 dark:to-red-500"
                        )}
                        style={{ 
                          width: barWidth,
                          height: statValue === 0 ? 8 : Math.max(barHeightPx, 24),
                          boxShadow: isHit 
                            ? "0 -2px 8px rgba(16, 185, 129, 0.3)" 
                            : undefined
                        }}
                      />
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

        {/* Line Threshold - Draggable hit area (above bars) */}
        {linePosition !== null && onLineChange && (
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className={cn(
              "absolute left-0 right-0 z-20 group/line",
              !isDragging && "cursor-grab",
              isDragging && "cursor-grabbing"
            )}
            style={{ bottom: `${linePosition}%` }}
          >
            {/* Invisible larger hit area for easier grabbing */}
            <div className={cn(
              "absolute left-0 right-0 h-8 -translate-y-1/2 transition-colors",
              "hover:bg-amber-500/10 dark:hover:bg-amber-400/10"
            )} />
          </div>
        )}

        {/* Line value label - always visible (highest z-index) */}
        {linePosition !== null && (
          <div
            className="absolute left-0 z-30 pointer-events-none"
            style={{ bottom: `${linePosition}%` }}
          >
            <div
              className={cn(
                "absolute -left-1 -translate-y-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-all",
                isDragging 
                  ? "bg-amber-500 dark:bg-amber-400 text-black scale-110" 
                  : "bg-primary dark:bg-primary-weak text-on-primary",
                onLineChange && !isDragging && "group-hover/line:bg-amber-500 group-hover/line:dark:bg-amber-400 group-hover/line:text-black group-hover/line:scale-105"
              )}
            >
              {onLineChange && (
                <GripVertical className="h-2.5 w-2.5 opacity-70" />
              )}
              {displayLine}
            </div>
          </div>
        )}
      </div>

      {/* X-Axis - Dates */}
      <div className="ml-10 mt-8 flex justify-center gap-3">
        {games.map((game, idx) => (
          <div
            key={game.gameId || idx}
            className="text-[9px] text-neutral-400 text-center font-medium"
            style={{ width: barWidth }}
          >
            {formatShortDate(game.date)}
          </div>
        ))}
      </div>

      {/* Quick Filters, Legend & Odds Row */}
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

        {/* Legend - Center */}
        <div className="flex items-center justify-center gap-4 text-[10px] flex-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-emerald-500 to-emerald-400" />
            <span className="text-neutral-500 dark:text-neutral-400">Over</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-red-500 to-red-400" />
            <span className="text-neutral-500 dark:text-neutral-400">Under</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 border-t-2 border-dashed border-primary dark:border-primary-weak" />
            <span className="text-neutral-500 dark:text-neutral-400">Line ({line})</span>
          </div>
        </div>

        {/* Odds - Right */}
        <div className="flex items-center justify-end gap-2 text-[10px] flex-1">
          {(odds?.bestOver || odds?.bestUnder) && (
            <>
              {/* Show which line these odds are for when it differs from chart line */}
              {odds?.oddsLine !== undefined && odds?.oddsLine !== null && odds?.oddsLine !== line && (
                <Tooltip 
                  content={
                    odds.isClosestLine 
                      ? `Showing odds for closest available line (${odds.oddsLine})`
                      : `Odds shown for ${odds.oddsLine} line`
                  }
                  side="top"
                >
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-1 rounded-md cursor-help",
                    odds.isClosestLine 
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-700" 
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                  )}>
                    {odds.isClosestLine ? `≈ ${odds.oddsLine}` : `O/U ${odds.oddsLine}`}
                  </span>
                </Tooltip>
              )}
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
          {!odds?.bestOver && !odds?.bestUnder && (
            <span className="text-neutral-400 dark:text-neutral-500">No odds</span>
          )}
        </div>
      </div>
    </div>
  );
}
