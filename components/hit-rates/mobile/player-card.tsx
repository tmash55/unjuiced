"use client";

import React, { useState } from "react";
import { ChevronRight, Plus, HeartPulse, X, AlertTriangle, ArrowDown } from "lucide-react";
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
  isBlurred?: boolean;
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

// Get injury status color
function getInjuryColor(status: string | null): string {
  if (!status) return "text-neutral-400 dark:text-neutral-500";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500 dark:text-red-400";
  if (s === "questionable" || s === "doubtful") return "text-amber-500 dark:text-amber-400";
  if (s === "probable" || s === "gtd") return "text-emerald-500 dark:text-emerald-400";
  return "text-neutral-400 dark:text-neutral-500";
}

// Unified hit rate cluster - modern chip UI with standardized widths
function HitRateCluster({
  l5,
  l10,
  season,
  h2h,
}: {
  l5: number | null;
  l10: number | null;
  season: number | null;
  h2h: number | null;
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
      
      {/* Divider */}
      <div className="w-px h-7 bg-neutral-200/50 dark:bg-neutral-700/30" />
      
      {/* H2H - fixed width for consistency */}
      <div className="flex flex-col items-center w-12 py-1.5">
        <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
          H2H
        </span>
        <span className={cn("text-[13px] font-extrabold leading-tight", getHitRateColor(h2h))}>
          {formatPct(h2h)}
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
// LOW rank (1-10) = tough defense = HARD for player (red)
// HIGH rank (21-30) = weak defense = GOOD for player (green)
function DvpBadge({ rank }: { rank: number | null }) {
  if (rank === null) return null;
  
  // Determine matchup quality (inverted - low rank = hard, high rank = good)
  const isHardMatchup = rank <= 10;    // 1-10: Tough defense (bad for player)
  const isGoodMatchup = rank >= 21;    // 21-30: Weak defense (good for player)
  const isNeutral = !isHardMatchup && !isGoodMatchup;

  // Get pill styling based on matchup quality
  const getPillStyle = () => {
    if (isGoodMatchup) {
      return "bg-emerald-500/20 dark:bg-emerald-500/15 border-emerald-500/30 dark:border-emerald-500/20";
    }
    if (isHardMatchup) {
      return "bg-red-500/20 dark:bg-red-500/15 border-red-500/30 dark:border-red-500/20";
    }
    // Neutral - very subtle
    return "bg-neutral-200/50 dark:bg-neutral-700/40 border-neutral-300/50 dark:border-neutral-600/40";
  };

  // Get text color
  const getTextColor = () => {
    if (isGoodMatchup) return "text-emerald-600 dark:text-emerald-400";
    if (isHardMatchup) return "text-red-500 dark:text-red-400";
    return "text-neutral-500 dark:text-neutral-400";
  };

  return (
    <div className={cn(
      "flex items-center gap-0.5 px-1.5 py-0.5 rounded border",
      getPillStyle()
    )}>
      {/* Arrow indicator for good/hard matchups */}
      {isGoodMatchup && (
        <span className="text-[9px] text-emerald-500 dark:text-emerald-400">▲</span>
      )}
      {isHardMatchup && (
        <span className="text-[9px] text-red-500 dark:text-red-400">▼</span>
      )}
      
      {/* Rank text */}
      <span className={cn("text-[10px] font-medium", getTextColor())}>
        {getOrdinalSuffix(rank)} DvP
      </span>
    </div>
  );
}

export function PlayerCard({ profile, odds, onCardClick, onAddToSlip, isFirst = false, isBlurred = false }: PlayerCardProps) {
  const [showInjuryModal, setShowInjuryModal] = useState(false);

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
    h2hPct,
    gameLogs,
    matchupRank,
    primaryColor,
    secondaryColor,
    injuryStatus,
    injuryNotes,
  } = profile;

  const propLabel = formatMarketLabel(market);
  const matchupText = homeAway === "H" 
    ? `${opponentTeamAbbr} @ ${teamAbbr}` 
    : `${teamAbbr} @ ${opponentTeamAbbr}`;
  const gameTime = gameStatus?.replace(/\s*ET$/i, "").trim() ?? "TBD";
  
  // Format prop text
  const propText = line !== null ? `${line}+ ${propLabel}` : propLabel;

  const hasOdds = odds && (odds.bestOver || odds.bestUnder);
  const hasInjury = !isBlurred && injuryStatus && injuryStatus.toLowerCase() !== "active" && injuryStatus.toLowerCase() !== "available";
  
  // Check if player is in G League
  const isGLeague = injuryNotes?.toLowerCase().includes("g league") || 
                    injuryNotes?.toLowerCase().includes("g-league") ||
                    injuryNotes?.toLowerCase().includes("gleague");

  // Display values - use placeholders for blurred cards
  const displayName = isBlurred ? "Player Name" : playerName;
  const displayTeam = isBlurred ? "TM" : teamAbbr;
  const displayPosition = isBlurred ? "POS" : position;
  const displayLine = isBlurred ? "00.0" : line;
  const displayPropText = isBlurred ? `00.0+ ${propLabel}` : propText;

  return (
    <div className={cn(
      "bg-white dark:bg-neutral-900",
      isBlurred && "pointer-events-none select-none"
    )}>
      {/* Premium inset divider - 85% width, centered */}
      {!isFirst && (
        <div className="flex justify-center">
          <div className="w-[85%] h-px bg-neutral-200/60 dark:bg-neutral-700/40" />
        </div>
      )}
      
      {/* Main tappable area */}
      <button
        type="button"
        onClick={isBlurred ? undefined : onCardClick}
        disabled={isBlurred}
        className={cn(
          "w-full text-left px-3 py-2.5",
          isBlurred 
            ? "cursor-default" 
            : "active:bg-neutral-50 dark:active:bg-neutral-800/50"
        )}
      >
        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 1 — Header Row (toned down: very small, mono, low-contrast)
            Game • DvP • Kickoff time
        ═══════════════════════════════════════════════════════════════ */}
        <div className={cn("flex items-center justify-between mb-2", isBlurred && "blur-[3px] opacity-60")}>
          <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-wide">
            <span className="uppercase">{isBlurred ? "TM @ TM" : matchupText}</span>
            <span className="opacity-40">•</span>
            <span>{isBlurred ? "0:00 PM" : gameTime}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Over Odds */}
            {!isBlurred && hasOdds && odds.bestOver && (
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
                  "flex items-center gap-1 px-1.5 py-0.5 rounded",
                  "bg-emerald-100 dark:bg-emerald-900/30",
                  "border border-emerald-300/60 dark:border-emerald-700/40",
                  "transition-all duration-150",
                  (odds.bestOver.mobileUrl || odds.bestOver.url) 
                    ? "hover:bg-emerald-200 dark:hover:bg-emerald-900/50 active:scale-95 cursor-pointer" 
                    : "cursor-default"
                )}
              >
                {getBookLogo(odds.bestOver.book) && (
                  <img
                    src={getBookLogo(odds.bestOver.book)!}
                    alt={odds.bestOver.book}
                    className="h-3 w-3 rounded object-contain"
                  />
                )}
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {formatOdds(odds.bestOver.price)}
                </span>
              </a>
            )}
            <DvpBadge rank={isBlurred ? null : matchupRank} />
          </div>
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════
            BLOCK 2 — Player Identity + Hit Rates (2-row layout with hit rates on right)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-start gap-2">
          {/* Left side: Headshot + Player info */}
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Headshot with team logo overlay */}
            <div className={cn("relative shrink-0", isBlurred && "blur-[2px] opacity-60")}>
              <div 
                className="w-9 h-9 rounded-full p-[1.5px]"
                style={{
                  background: isBlurred ? '#6b7280' : (primaryColor 
                    ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)`
                    : '#374151')
                }}
              >
                <div 
                  className="w-full h-full rounded-full overflow-hidden relative"
                  style={{
                    background: isBlurred ? '#6b7280' : (primaryColor && secondaryColor
                      ? `linear-gradient(180deg, ${primaryColor}dd 0%, ${primaryColor} 50%, ${secondaryColor} 100%)`
                      : primaryColor || '#374151')
                  }}
                >
                  {!isBlurred && (
                    <div className="absolute inset-0 flex items-center justify-center scale-[1.4] translate-y-[10%]">
                      <PlayerHeadshot
                        nbaPlayerId={playerId}
                        name={playerName}
                        size="small"
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                </div>
              </div>
              {/* Team logo overlay */}
              {!isBlurred && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
                  <img
                    src={`/team-logos/nba/${teamAbbr?.toUpperCase()}.svg`}
                    alt={teamAbbr ?? ""}
                    className="h-2.5 w-2.5 object-contain"
                    onError={(e) => { 
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            
            {/* Player identity - 2 rows */}
            <div className={cn("flex-1 min-w-0", isBlurred && "blur-[3px] opacity-60")}>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-50 truncate tracking-tight">
                  {displayName}
                </h3>
                {hasInjury && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInjuryModal(true);
                    }}
                    className="shrink-0 active:scale-90 transition-transform cursor-pointer"
                  >
                    {isGLeague ? (
                      <ArrowDown className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <HeartPulse className={cn("h-3.5 w-3.5", getInjuryColor(injuryStatus))} />
                    )}
                  </span>
                )}
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium shrink-0">
                  {displayPosition}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  O
                </span>
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  {displayPropText}
                </span>
              </div>
            </div>
          </div>

          {/* Right side: Hit Rate Cluster - spans both rows */}
          <div className={cn("shrink-0", isBlurred && "blur-[3px] opacity-60")}>
            <HitRateCluster l5={last5Pct} l10={last10Pct} season={seasonPct} h2h={h2hPct} />
          </div>
        </div>
      </button>
      
      {/* Injury Detail Modal */}
      {showInjuryModal && hasInjury && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end"
          onClick={() => setShowInjuryModal(false)}
        >
          <div
            className="w-full bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl border-t border-neutral-200 dark:border-neutral-700 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                {isGLeague ? (
                  <ArrowDown className="h-4 w-4 text-blue-500" />
                ) : (
                  <AlertTriangle className={cn("h-4 w-4", getInjuryColor(injuryStatus))} />
                )}
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {isGLeague ? "G League Assignment" : "Injury Report"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInjuryModal(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-4 w-4 text-neutral-500" />
              </button>
            </div>

            {/* Player Info */}
            <div className="p-4 space-y-4">
              {/* Player Header */}
              <div className="flex items-center gap-3">
                {/* Headshot with team gradient border and logo overlay */}
                <div className="relative shrink-0">
                  <div 
                    className="w-12 h-12 rounded-full p-[2px]"
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
                  {/* Team logo overlay */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
                    <img
                      src={`/team-logos/nba/${teamAbbr?.toUpperCase()}.svg`}
                      alt={teamAbbr ?? ""}
                      className="h-3 w-3 object-contain"
                      onError={(e) => { 
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {playerName}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {teamAbbr} • {position}
                  </p>
                </div>
              </div>

              {/* Injury Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    Status
                  </span>
                  <span className={cn("text-sm font-bold uppercase", isGLeague ? "text-blue-500" : getInjuryColor(injuryStatus))}>
                    {isGLeague ? "G League" : injuryStatus}
                  </span>
                </div>
                
                {injuryNotes && (
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <p className="text-xs text-neutral-700 dark:text-neutral-300">
                      {injuryNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowInjuryModal(false)}
                className="w-full py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg font-medium text-sm active:scale-[0.98] transition-transform"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* CTA Row - removed for mobile */}
    </div>
  );
}
