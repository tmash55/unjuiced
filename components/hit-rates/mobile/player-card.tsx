"use client";

import React from "react";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { formatMarketLabel } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// Helper to get sportsbook logo
const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};

interface PlayerCardProps {
  profile: HitRateProfile;
  odds?: {
    bestOver?: { price: number; book: string; url?: string | null; mobileUrl?: string | null } | null;
    bestUnder?: { price: number; book: string; url?: string | null; mobileUrl?: string | null } | null;
  } | null;
  onCardClick: () => void;
  onAddToSlip?: () => void;
  isFirst?: boolean;
}

// Format odds with + prefix for positive
const formatOdds = (price: number | undefined): string => {
  if (price === undefined) return "—";
  return price > 0 ? `+${price}` : `${price}`;
};

// Get color for hit rate percentage (softer tones)
function getHitRateColor(pct: number | null) {
  if (pct === null) return "text-neutral-400 dark:text-neutral-500";
  if (pct >= 80) return "text-emerald-500 dark:text-emerald-400/90";
  if (pct >= 60) return "text-amber-500 dark:text-amber-400/90";
  return "text-red-400 dark:text-red-400/90";
}

// Unified hit rate cluster - modern chip UI with standardized widths
function HitRateCluster({
  l5,
  l10,
  season,
}: {
  l5: number | null;
  l10: number | null;
  season: number | null;
}) {
  const formatPct = (val: number | null) => val !== null ? `${Math.round(val)}%` : "—";
  
  return (
    <div className={cn(
      "inline-flex items-center gap-0 rounded-xl overflow-hidden",
      "bg-neutral-50/80 dark:bg-neutral-800/50",
      "border border-neutral-200/60 dark:border-neutral-700/40",
      "shadow-sm"
    )}>
      {/* L5 - fixed width for consistency */}
      <div className="flex flex-col items-center w-12 py-1.5">
        <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
          L5
        </span>
        <span className={cn("text-[13px] font-extrabold leading-tight", getHitRateColor(l5))}>
          {formatPct(l5)}
        </span>
      </div>
      
      {/* Divider */}
      <div className="w-px h-7 bg-neutral-200/50 dark:bg-neutral-700/30" />
      
      {/* L10 - fixed width for consistency */}
      <div className="flex flex-col items-center w-12 py-1.5">
        <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
          L10
        </span>
        <span className={cn("text-[13px] font-extrabold leading-tight", getHitRateColor(l10))}>
          {formatPct(l10)}
        </span>
      </div>
      
      {/* Divider */}
      <div className="w-px h-7 bg-neutral-200/50 dark:bg-neutral-700/30" />
      
      {/* Season - fixed width for consistency */}
      <div className="flex flex-col items-center w-12 py-1.5">
        <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
          SZN
        </span>
        <span className={cn("text-[13px] font-extrabold leading-tight", getHitRateColor(season))}>
          {formatPct(season)}
        </span>
      </div>
    </div>
  );
}

// Mini sparkline for mobile - refined design with baseline and fades
function MobileSparkline({ gameLogs, line }: { gameLogs: unknown[] | null; line: number | null }) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  
  if (!gameLogs || gameLogs.length === 0) {
    return <div className="h-8 w-full bg-neutral-100/50 dark:bg-neutral-800/30 rounded" />;
  }

  // gameLogs is sorted newest first, so slice(0, 10) gets the 10 most recent games
  // Then reverse so oldest is on left, newest is on right (for visual consistency)
  const recentGames = [...gameLogs.slice(0, 10)].reverse();
  const effectiveLine = line ?? 0;
  const maxVal = Math.max(...recentGames.map((g: any) => g.market_stat ?? 0), effectiveLine * 1.5 || 10);
  const chartHeight = 32; // Fixed height in pixels

  return (
    <div className="relative w-full" style={{ height: chartHeight }}>
      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-white/30 dark:from-neutral-900/30 to-transparent z-10 pointer-events-none" />
      
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-white/30 dark:from-neutral-900/30 to-transparent z-10 pointer-events-none" />
      
      {/* Y-axis baseline */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-neutral-300/60 dark:bg-neutral-600/60" />
      
      {/* Bars container - right-aligned so most recent is always on the right */}
      <div className="flex items-end justify-end gap-[3px] h-full w-full">
        {recentGames.map((game: any, idx) => {
          const val = game.market_stat ?? 0;
          const heightPct = Math.max(15, (val / maxVal) * 100);
          const barHeight = Math.round((heightPct / 100) * chartHeight);
          const isHit = effectiveLine > 0 ? val >= effectiveLine : true;
          const isHovered = hoveredIdx === idx;
          
          return (
            <div
              key={idx}
              className="relative w-3 h-full flex items-end"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
            >
              {/* Bar - softer colors, brighten on hover */}
              <div
                className={cn(
                  "w-full rounded-t-[2px] transition-all duration-150",
                  isHit 
                    ? isHovered 
                      ? "bg-emerald-500 dark:bg-emerald-400" 
                      : "bg-emerald-400/80 dark:bg-emerald-500/70"
                    : isHovered
                      ? "bg-red-500 dark:bg-red-400"
                      : "bg-red-400/80 dark:bg-red-500/70"
                )}
                style={{ height: barHeight }}
              />
              
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
                  <div className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap",
                    "bg-neutral-900 dark:bg-neutral-100",
                    "text-white dark:text-neutral-900",
                    "shadow-lg"
                  )}>
                    {val}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// DVP Rank badge - subtle pill with arrows for top/bottom matchups
function DvpBadge({ rank }: { rank: number | null }) {
  if (rank === null) return null;
  
  // Determine matchup quality
  const isTop5 = rank <= 5;
  const isBottom5 = rank >= 26;
  const isNeutral = !isTop5 && !isBottom5;

  // Get pill styling based on matchup quality
  const getPillStyle = () => {
    if (isTop5) {
      return "bg-emerald-500/20 dark:bg-emerald-500/15 border-emerald-500/30 dark:border-emerald-500/20";
    }
    if (isBottom5) {
      return "bg-red-500/20 dark:bg-red-500/15 border-red-500/30 dark:border-red-500/20";
    }
    // Neutral - very subtle
    return "bg-neutral-200/50 dark:bg-neutral-700/40 border-neutral-300/50 dark:border-neutral-600/40";
  };

  // Get text color
  const getTextColor = () => {
    if (isTop5) return "text-emerald-600 dark:text-emerald-400";
    if (isBottom5) return "text-red-500 dark:text-red-400";
    return "text-neutral-500 dark:text-neutral-400";
  };

  return (
    <div className={cn(
      "flex items-center gap-0.5 px-1.5 py-0.5 rounded border",
      getPillStyle()
    )}>
      {/* Arrow indicator for top/bottom matchups */}
      {isTop5 && (
        <span className="text-[9px] text-emerald-500 dark:text-emerald-400">▲</span>
      )}
      {isBottom5 && (
        <span className="text-[9px] text-red-500 dark:text-red-400">▼</span>
      )}
      
      {/* Rank text */}
      <span className={cn("text-[10px] font-medium", getTextColor())}>
        {getOrdinalSuffix(rank)} DvP
      </span>
    </div>
  );
}

export function PlayerCard({ profile, odds, onCardClick, onAddToSlip, isFirst = false }: PlayerCardProps) {
  const {
    playerId,
    playerName,
    teamAbbr,
    position,
    opponentTeamAbbr,
    homeAway,
    gameStatus,
    market,
    line,
    last5Pct,
    last10Pct,
    seasonPct,
    gameLogs,
    matchupRank,
    primaryColor,
    secondaryColor,
  } = profile;

  const propLabel = formatMarketLabel(market);
  const matchupText = homeAway === "H" 
    ? `${opponentTeamAbbr} @ ${teamAbbr}` 
    : `${teamAbbr} @ ${opponentTeamAbbr}`;
  const gameTime = gameStatus?.replace(/\s*ET$/i, "").trim() ?? "TBD";
  
  // Format prop text
  const propText = line !== null ? `${line}+ ${propLabel}` : propLabel;

  const hasOdds = odds && (odds.bestOver || odds.bestUnder);

  return (
    <div className="bg-white dark:bg-neutral-900">
      {/* Premium inset divider - 85% width, centered */}
      {!isFirst && (
        <div className="flex justify-center">
          <div className="w-[85%] h-px bg-neutral-200/60 dark:bg-neutral-700/40" />
        </div>
      )}
      
      {/* Main tappable area */}
      <button
        type="button"
        onClick={onCardClick}
        className="w-full text-left px-4 py-4 active:bg-neutral-50 dark:active:bg-neutral-800/50"
      >
        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 1 — Header Row (toned down: very small, mono, low-contrast)
            Game • DvP • Kickoff time
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-wide">
            <span className="uppercase">{matchupText}</span>
            <span className="opacity-40">•</span>
            <span>{gameTime}</span>
          </div>
          <DvpBadge rank={matchupRank} />
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 2 — Player Identity (bold, prominent)
            Player image • Name / Position / Team icon
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-3 mb-3">
          {/* Headshot - zoomed in on face with team color gradient + outer ring */}
          <div 
            className="shrink-0 w-12 h-12 rounded-full p-[2px]"
            style={{
              background: primaryColor 
                ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)`
                : '#374151'
            }}
          >
            <div 
              className="w-full h-full rounded-full overflow-hidden relative"
              style={{
                background: primaryColor && secondaryColor
                  ? `linear-gradient(180deg, ${primaryColor}dd 0%, ${primaryColor} 50%, ${secondaryColor} 100%)`
                  : primaryColor || '#374151'
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center scale-[1.4] translate-y-[10%]">
                <PlayerHeadshot
                  nbaPlayerId={playerId}
                  name={playerName}
                  size="small"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
          
          {/* Player identity */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-bold text-neutral-900 dark:text-neutral-50 truncate tracking-tight">
              {playerName}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <img
                src={`/team-logos/nba/${teamAbbr?.toUpperCase()}.svg`}
                alt={teamAbbr ?? ""}
                className="h-4 w-4 object-contain"
                onError={(e) => { 
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                {position} • #{profile.jerseyNumber ?? "—"}
              </span>
            </div>
          </div>
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 3 — Prop Line + Odds (split design for better hierarchy)
            [ Prop Label ]  [ Odds with subtle shading ]
        ═══════════════════════════════════════════════════════════════ */}
        <div className={cn(
          "flex items-center overflow-hidden",
          "w-full rounded-lg",
          "bg-neutral-100 dark:bg-neutral-800",
          "border border-neutral-200 dark:border-neutral-700"
        )}>
          {/* Prop label - left side */}
          <div className="flex-1 px-3 py-2">
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {propText}
            </span>
          </div>
          
          {/* Odds - right side with subtle shading */}
          {hasOdds ? (
            <div className={cn(
              "flex items-center gap-2 px-2.5 py-2",
              "bg-gradient-to-r from-transparent via-neutral-200/40 to-neutral-200/60",
              "dark:from-transparent dark:via-neutral-700/40 dark:to-neutral-700/60"
            )}>
              {odds.bestOver && (
                <a
                  href={odds.bestOver.mobileUrl || odds.bestOver.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!odds.bestOver?.mobileUrl && !odds.bestOver?.url) {
                      e.preventDefault();
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 -my-0.5 rounded",
                    "transition-all duration-150",
                    (odds.bestOver.mobileUrl || odds.bestOver.url) 
                      ? "hover:bg-emerald-500/10 active:bg-emerald-500/20 cursor-pointer" 
                      : "cursor-default"
                  )}
                >
                  {getBookLogo(odds.bestOver.book) && (
                    <img
                      src={getBookLogo(odds.bestOver.book)!}
                      alt={odds.bestOver.book}
                      className="h-4 w-4 rounded object-contain"
                    />
                  )}
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    O {formatOdds(odds.bestOver.price)}
                  </span>
                </a>
              )}
              
              {/* Subtle divider between O/U */}
              {odds.bestOver && odds.bestUnder && (
                <div className="w-px h-4 bg-neutral-300/60 dark:bg-neutral-600/60" />
              )}
              
              {odds.bestUnder && (
                <a
                  href={odds.bestUnder.mobileUrl || odds.bestUnder.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!odds.bestUnder?.mobileUrl && !odds.bestUnder?.url) {
                      e.preventDefault();
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 -my-0.5 rounded",
                    "transition-all duration-150",
                    (odds.bestUnder.mobileUrl || odds.bestUnder.url) 
                      ? "hover:bg-red-500/10 active:bg-red-500/20 cursor-pointer" 
                      : "cursor-default"
                  )}
                >
                  {getBookLogo(odds.bestUnder.book) && (
                    <img
                      src={getBookLogo(odds.bestUnder.book)!}
                      alt={odds.bestUnder.book}
                      className="h-4 w-4 rounded object-contain"
                    />
                  )}
                  <span className="text-sm font-semibold text-red-500 dark:text-red-400">
                    U {formatOdds(odds.bestUnder.price)}
                  </span>
                </a>
              )}
            </div>
          ) : (
            <div className="px-2.5 py-2">
              <span className="text-xs text-neutral-400 dark:text-neutral-500">No odds</span>
            </div>
          )}
        </div>
        
        {/* Bottom Row: Sparkline + Hit Rates */}
        <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/50">
          <div className="flex items-center gap-8">
            {/* Sparkline */}
            <div className="flex-1">
              <MobileSparkline gameLogs={gameLogs} line={line} />
            </div>
            
            {/* Unified Hit Rate Cluster */}
            <HitRateCluster l5={last5Pct} l10={last10Pct} season={seasonPct} />
          </div>
        </div>
      </button>
      
      {/* CTA Row - with gap above for breathing room */}
      <div className="flex items-center mt-1.5 mx-4 border-t border-neutral-100 dark:border-neutral-800/50">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddToSlip?.();
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3",
            "text-sm font-medium text-neutral-600 dark:text-neutral-400",
            "transition-colors duration-150",
            "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
            "active:bg-neutral-100 dark:active:bg-neutral-800",
            "border-r border-neutral-100 dark:border-neutral-800/50"
          )}
        >
          <Plus className="h-4 w-4" />
          Add to Slip
        </button>
        <button
          type="button"
          onClick={onCardClick}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3",
            "text-sm font-medium text-brand",
            "transition-colors duration-150",
            "hover:bg-brand/5 dark:hover:bg-brand/10",
            "active:bg-brand/10 dark:active:bg-brand/15"
          )}
        >
          Details
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
