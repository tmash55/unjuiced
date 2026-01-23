"use client";

import { cn } from "@/lib/utils";
import Autoplay from "embla-carousel-autoplay";
import { useState, useEffect, useMemo, useRef, useId } from "react";
import { type CarouselApi } from "@/components/ui/carousel";
import { IconChartBar, IconFlame, IconCheck, IconAlertTriangle, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/button";
import { getPlayerHeadshotUrl } from "@/lib/utils/player-headshot";
import { AnimatePresence, motion } from "motion/react";
import { useOutsideClick } from "@/hooks/use-outside-click";

interface GameLog {
  date: string;
  market_stat: number;
  win_loss: string;
  home_away: string;
  margin: string;
  opponent_team_id?: number;
}

// NBA Team ID to Abbreviation mapping
const NBA_TEAM_ID_TO_ABBR: Record<number, string> = {
  1610612737: "ATL", 1610612738: "BOS", 1610612751: "BKN", 1610612766: "CHA",
  1610612741: "CHI", 1610612739: "CLE", 1610612742: "DAL", 1610612743: "DEN",
  1610612765: "DET", 1610612744: "GSW", 1610612745: "HOU", 1610612754: "IND",
  1610612746: "LAC", 1610612747: "LAL", 1610612763: "MEM", 1610612748: "MIA",
  1610612749: "MIL", 1610612750: "MIN", 1610612740: "NOP", 1610612752: "NYK",
  1610612760: "OKC", 1610612753: "ORL", 1610612755: "PHI", 1610612756: "PHX",
  1610612757: "POR", 1610612758: "SAC", 1610612759: "SAS", 1610612761: "TOR",
  1610612762: "UTA", 1610612764: "WAS",
};

interface HitRateData {
  playerId: number;
  playerName: string;
  team: string;
  position: string;
  market: string;
  marketDisplay: string;
  line: string | number;
  l5: number;
  l10: number;
  l20: number;
  szn: number;
  l5Avg: number | null;
  l10Avg: number | null;
  hitStreak: number | null;
  gameLogs: GameLog[];
  opponent: string;
  gameStatus: string;
  homeAway: string;
  dvpRank: number | null;
  dvpLabel: string | null;
  profileUrl: string;
}

async function fetchTopHitRates() {
  const res = await fetch("/api/dashboard/hit-rates");
  if (!res.ok) throw new Error("Failed to fetch hit rates");
  return res.json();
}

function GameLogChart({ gameLogs, line, compact = false }: { gameLogs: GameLog[]; line: number | string | null; compact?: boolean }) {
  // Take last 10 games, reverse so most recent is on right
  const logs = useMemo(() => {
    if (!Array.isArray(gameLogs)) return [];
    return [...gameLogs].slice(0, 10).reverse();
  }, [gameLogs]);

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-neutral-400">
        No game data
      </div>
    );
  }

  const lineNum = line === null || line === undefined || line === "" 
    ? 0 
    : (typeof line === 'string' ? parseFloat(line) : line);
    
  const hasLine = lineNum > 0;
  const maxStat = Math.max(...logs.map(g => g.market_stat || 0), hasLine ? lineNum + 2 : 5);
  // Use pixel heights (stable) and give the chart more vertical presence in the taller card
  const maxBarHeight = compact ? 60 : 140;
  const totalGames = logs.length;

  // Calculate recency opacity (older games more faded)
  const getOpacity = (index: number) => {
    const fromEnd = totalGames - 1 - index; // 0 = most recent
    if (fromEnd <= 2) return 1; // Last 3 games full opacity
    if (fromEnd <= 5) return 0.7; // Next 3 games
    return 0.5; // Older games
  };

  // Calculate line position as pixels from bottom
  const linePosition = hasLine ? (lineNum / maxStat) * maxBarHeight : 0;

  return (
    <div className="flex h-full gap-1">
      {/* Y-Axis */}
      <div className="flex flex-col text-[8px] text-neutral-400 font-medium w-6 shrink-0 pr-0.5">
        {/* Max value at top */}
        <span>{Math.round(maxStat)}</span>
        {/* Spacer for chart area */}
        <div className="flex-1 relative" style={{ minHeight: maxBarHeight }}>
          {/* Line label - positioned to align with dotted line */}
          {hasLine && (
            <div 
              className="absolute -right-1 bg-neutral-600 dark:bg-neutral-500 text-white text-[7px] font-bold px-1 py-0.5 rounded leading-none z-20"
              style={{ 
                bottom: `${linePosition}px`,
                transform: 'translateY(50%)'
              }}
            >
              {lineNum}
            </div>
          )}
        </div>
        {/* Zero at bottom */}
        <span>0</span>
      </div>
      
      {/* Chart Area */}
      <div className="flex-1 flex flex-col">
        {/* Bars Container - Use fixed height */}
        <div 
          className="flex items-end justify-around gap-1 relative"
          style={{ height: maxBarHeight }}
        >
          {/* Line indicator */}
          {hasLine && (
            <div 
              className="absolute left-0 right-0 border-t-2 border-dashed border-neutral-400 dark:border-neutral-500 pointer-events-none z-10"
              style={{ bottom: `${linePosition}px` }}
            />
          )}
          
          {logs.map((game, i) => {
            const stat = game.market_stat || 0;
            const isHit = hasLine ? stat > lineNum : true;
            const isPush = hasLine && stat === lineNum;
            const barHeight = Math.max((stat / maxStat) * maxBarHeight, 4); // Pixel-based height
            const opacity = getOpacity(i);
            
            return (
              <div key={i} className="flex flex-col items-center flex-1 min-w-0 justify-end h-full">
                {/* Stat Value on top */}
                <span 
                  className={cn(
                    "font-bold mb-0.5",
                    compact ? "text-[7px]" : "text-[10px]",
                    isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                  )}
                  style={{ opacity }}
                >
                  {stat}
                </span>
                
                {/* Bar with recency opacity - using pixel height */}
                <div 
                  className={cn(
                    "rounded-t-sm transition-all",
                    compact ? "w-2" : "w-3",
                    isPush 
                      ? "bg-amber-400 dark:bg-amber-500"
                      : isHit 
                        ? "bg-emerald-500 dark:bg-emerald-400" 
                        : "bg-red-400 dark:bg-red-500"
                  )}
                  style={{ height: `${barHeight}px`, opacity }}
                />
              </div>
            );
          })}
        </div>
        
        {/* X-Axis: Date + Opponent Logo */}
        <div className="flex justify-around gap-1 pt-1.5 border-t border-neutral-200 dark:border-neutral-700 mt-1.5">
          {logs.map((game, i) => {
            const opponentAbbr = game.opponent_team_id ? NBA_TEAM_ID_TO_ABBR[game.opponent_team_id] : null;
            
            return (
              <div key={i} className="flex flex-col items-center flex-1 min-w-0">
                {/* Date */}
                <span className={cn(
                  "text-neutral-500 dark:text-neutral-400",
                  compact ? "text-[6px]" : "text-[8px]"
                )}>
                  {game.date ? (() => {
                    const parts = game.date.split("-");
                    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
                  })() : '-'}
                </span>
                {/* Opponent Logo */}
                {opponentAbbr ? (
                  <img
                    src={`/team-logos/nba/${opponentAbbr}.svg`}
                    alt={opponentAbbr}
                    className={cn(
                      "object-contain opacity-70 mt-0.5",
                      compact ? "h-3 w-3" : "h-4 w-4"
                    )}
                  />
                ) : (
                  <span className="text-[6px] text-neutral-400 mt-0.5">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Confidence badge logic
function getConfidenceBadge(l10: number, dvpRank: number | null, dvpLabel: string | null) {
  // Elite = 100% L10
  if (l10 >= 1.0) {
    return { label: "Elite", icon: IconFlame, color: "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400", iconColor: "text-orange-500" };
  }
  // Strong = 80-99% L10
  if (l10 >= 0.8) {
    return { label: "Strong", icon: IconCheck, color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400", iconColor: "text-emerald-500" };
  }
  // Volatile = below 80%
  return { label: "Volatile", icon: IconAlertTriangle, color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400", iconColor: "text-amber-500" };
}

// Generate matchup insight
function getMatchupInsight(item: HitRateData): string | null {
  const { dvpRank, dvpLabel, marketDisplay, opponent, l10Avg, line } = item;
  
  // DVP-based insight (strongest signal)
  if (dvpRank !== null && dvpLabel === 'favorable') {
    return `${opponent} ${dvpRank >= 25 ? 'bottom 5' : `#${dvpRank}`} vs ${marketDisplay.toLowerCase()}`;
  }
  
  // Average-based insight
  if (l10Avg !== null && line) {
    const lineNum = typeof line === 'string' ? parseFloat(line) : line;
    const diff = l10Avg - lineNum;
    if (diff > 1) {
      return `Averaging +${diff.toFixed(1)} above the line`;
    }
  }
  
  return null;
}

// Expanded Game Log Chart (larger version for modal)
function ExpandedGameLogChart({ gameLogs, line }: { gameLogs: GameLog[]; line: number | string | null }) {
  const logs = useMemo(() => {
    if (!Array.isArray(gameLogs)) return [];
    return [...gameLogs].slice(0, 20).reverse(); // Show more games in expanded view
  }, [gameLogs]);

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-neutral-400">
        No game data available
      </div>
    );
  }

  const lineNum = line === null || line === undefined || line === "" 
    ? 0 
    : (typeof line === 'string' ? parseFloat(line) : line);
    
  const hasLine = lineNum > 0;
  const maxStat = Math.max(...logs.map(g => g.market_stat || 0), hasLine ? lineNum + 2 : 5);
  const chartHeight = 100;

  return (
    <div className="flex h-full gap-2">
      {/* Y-Axis */}
      <div className="flex flex-col justify-between text-xs text-neutral-400 font-medium w-6 shrink-0 relative">
        <span>{Math.round(maxStat)}</span>
        <span>0</span>
        {hasLine && (
          <div 
            className="absolute right-0 bg-neutral-600 dark:bg-neutral-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none z-20"
            style={{ 
              bottom: `${(lineNum / maxStat) * 85}%`,
              transform: 'translateY(50%)'
            }}
          >
            {lineNum}
          </div>
        )}
      </div>
      
      {/* Chart Area */}
      <div className="flex-1 flex flex-col">
        {/* Bars Container */}
        <div className="flex-1 flex items-end justify-around gap-1 relative pb-2">
          {hasLine && (
            <div 
              className="absolute left-0 right-0 border-t-2 border-dashed border-neutral-400 dark:border-neutral-500 pointer-events-none z-10"
              style={{ bottom: `${(lineNum / maxStat) * chartHeight}%` }}
            />
          )}
          
          {logs.map((game, i) => {
            const stat = game.market_stat || 0;
            const isHit = hasLine ? stat > lineNum : true;
            const isPush = hasLine && stat === lineNum;
            const heightPct = Math.max((stat / maxStat) * chartHeight, 5);
            
            return (
              <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end group">
                {/* Stat Value on top */}
                <span className={cn(
                  "text-[10px] font-bold mb-1",
                  isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                )}>
                  {stat}
                </span>
                
                {/* Bar */}
                <div 
                  className={cn(
                    "w-full rounded-t-sm transition-all min-w-[12px] max-w-[28px]",
                    isPush 
                      ? "bg-amber-400 dark:bg-amber-500"
                      : isHit 
                        ? "bg-emerald-500 dark:bg-emerald-400" 
                        : "bg-red-400 dark:bg-red-500"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        
        {/* X-Axis */}
        <div className="flex justify-around gap-1 pt-2 border-t border-neutral-200 dark:border-neutral-700">
          {logs.map((game, i) => {
            const opponentAbbr = game.opponent_team_id ? NBA_TEAM_ID_TO_ABBR[game.opponent_team_id] : null;
            
            return (
              <div key={i} className="flex flex-col items-center flex-1 min-w-0">
                <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
                  {game.date ? (() => {
                    const parts = game.date.split("-");
                    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
                  })() : '-'}
                </span>
                {opponentAbbr ? (
                  <img
                    src={`/team-logos/nba/${opponentAbbr}.svg`}
                    alt={opponentAbbr}
                    className="h-4 w-4 object-contain opacity-70 mt-1"
                  />
                ) : (
                  <span className="text-[8px] text-neutral-400 mt-1">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Expanded Card Modal
function ExpandedHitRateCard({ 
  item, 
  onClose, 
  id 
}: { 
  item: HitRateData; 
  onClose: () => void;
  id: string;
}) {
  const ref = useRef<HTMLDivElement>(null!);
  const badge = getConfidenceBadge(item.l10, item.dvpRank, item.dvpLabel);
  const BadgeIcon = badge.icon;
  
  useOutsideClick(ref, onClose);
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  
  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  return (
    <div className="fixed inset-0 grid place-items-center z-[100]">
      <motion.div
        ref={ref}
        layoutId={`card-${item.playerId}-${item.market}-${id}`}
        className="w-full max-w-[600px] max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl mx-4"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header with gradient - matches card header style */}
        <div className="relative bg-gradient-to-r from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-850 p-5 border-b border-neutral-100 dark:border-neutral-800">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700 transition-colors z-10"
          >
            <IconX className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
          </button>
          
          <div className="flex items-center gap-4">
            {/* Player Headshot with team logo overlay - matching card style */}
            <motion.div 
              layoutId={`headshot-${item.playerId}-${item.market}-${id}`}
              className="relative shrink-0"
            >
              <div className="h-20 w-20 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 border-4 border-white dark:border-neutral-800 shadow-lg">
                <img
                  src={getPlayerHeadshotUrl(item.playerId, "small")}
                  alt={item.playerName}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              {/* Team logo overlay */}
              <img
                src={`/team-logos/nba/${item.team}.svg`}
                alt={item.team}
                className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-white dark:bg-neutral-800 rounded-full p-1 shadow-md border border-neutral-200 dark:border-neutral-700"
              />
            </motion.div>
            
            <div className="flex-1 min-w-0">
              <motion.h2 
                layoutId={`name-${item.playerId}-${item.market}-${id}`}
                className="text-2xl font-bold text-neutral-900 dark:text-neutral-100"
              >
                {item.playerName}
              </motion.h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-2 mt-0.5">
                <span>{item.team}</span>
                <span className="text-neutral-300 dark:text-neutral-600">•</span>
                <span>{item.position}</span>
              </p>
              
              {/* Market & Line + Badge */}
              <div className="flex items-center gap-2 mt-3">
                <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {item.marketDisplay} O {item.line}
                  </span>
                </div>
                
                {/* Confidence Badge */}
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold",
                  badge.color
                )}>
                  <BadgeIcon className={cn("h-4 w-4", badge.iconColor)} />
                  <span>{badge.label}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Matchup Info */}
          {item.opponent && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-500">{item.homeAway === 'H' ? 'vs' : '@'}</span>
                <img
                  src={`/team-logos/nba/${item.opponent}.svg`}
                  alt={item.opponent}
                  className="h-8 w-8 object-contain"
                />
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{item.opponent}</span>
              </div>
              <div className="text-right">
                {item.gameStatus && (
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.gameStatus}</p>
                )}
                {item.dvpRank && (
                  <p className={cn(
                    "text-xs mt-0.5",
                    item.dvpLabel === 'favorable' ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-neutral-500"
                  )}>
                    #{item.dvpRank} vs {item.marketDisplay}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Hit Rate Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "L5", value: item.l5, avg: item.l5Avg },
              { label: "L10", value: item.l10, avg: item.l10Avg },
              { label: "L20", value: item.l20, avg: null },
              { label: "Season", value: item.szn, avg: null },
            ].map((stat) => (
              <div 
                key={stat.label}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 text-center"
              >
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{stat.label}</p>
                <p className={cn(
                  "text-xl font-bold",
                  stat.value >= 0.8 ? "text-emerald-600 dark:text-emerald-400" 
                    : stat.value >= 0.6 ? "text-amber-600 dark:text-amber-400" 
                    : "text-neutral-600 dark:text-neutral-300"
                )}>
                  {Math.round(stat.value * 100)}%
                </p>
                {stat.avg !== null && (
                  <p className="text-[10px] text-neutral-500 mt-0.5">Avg: {stat.avg}</p>
                )}
              </div>
            ))}
          </div>
          
          {/* Hit Streak */}
          {item.hitStreak && item.hitStreak >= 2 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
              <IconFlame className="h-5 w-5 text-amber-500 fill-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {item.hitStreak} game hit streak
              </span>
            </div>
          )}
          
          {/* Game Log Chart */}
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-3">Game Log</h3>
            <div className="h-[200px] p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
              <ExpandedGameLogChart 
                gameLogs={item.gameLogs} 
                line={typeof item.line === 'string' ? parseFloat(item.line) : item.line} 
              />
            </div>
          </div>
        </div>
        
        {/* Footer CTA */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <Link
            href={item.profileUrl}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
          >
            View Full Profile
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export function HitRatesBentoCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [activeCard, setActiveCard] = useState<HitRateData | null>(null);
  const id = useId();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-top-hit-rates"],
    queryFn: fetchTopHitRates,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (data) {
      console.log("[HitRatesCarousel] Data received:", data);
    }
    if (error) {
      console.error("[HitRatesCarousel] Error:", error);
    }
  }, [data, error]);

  const hitRates: HitRateData[] = data?.hitRates || [];
  const hasData = hitRates.length > 0;

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api, hitRates.length]);

  // Pause autoplay when card is expanded
  useEffect(() => {
    if (activeCard) {
      api?.plugins()?.autoplay?.stop();
    } else {
      api?.plugins()?.autoplay?.play();
    }
  }, [activeCard, api]);

  const handleCardClick = (item: HitRateData, e: React.MouseEvent) => {
    // Don't expand if clicking on the "View Player" link
    if ((e.target as HTMLElement).closest('a')) return;
    setActiveCard(item);
  };

  const handleCloseExpanded = () => {
    setActiveCard(null);
  };

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {activeCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            onClick={handleCloseExpanded}
          />
        )}
      </AnimatePresence>
      
      {/* Expanded Card Modal */}
      <AnimatePresence>
        {activeCard && (
          <ExpandedHitRateCard 
            item={activeCard} 
            onClose={handleCloseExpanded}
            id={id}
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "h-full flex flex-col relative group/bento rounded-xl",
        // Amber/gold gradient for Hit Rates (trending/hot)
        "bg-gradient-to-br from-amber-50/30 via-transparent to-yellow-50/20",
        "dark:from-amber-950/15 dark:via-transparent dark:to-yellow-950/10"
      )}>
        {/* Header with hover animation */}
        <div className="flex items-center justify-between px-1 py-2 transition duration-200 group-hover/bento:translate-x-2">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg shadow-sm",
              // Amber/gold gradient
              "bg-gradient-to-br from-amber-500 to-yellow-500"
            )}>
              <IconChartBar className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <span className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">Top Hit Rates</span>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-medium">
                Trending props • Historical data
              </p>
            </div>
          </div>
          {/* View All Hit Rates Link */}
          <Link 
            href="/hit-rates/nba"
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
              "text-amber-700 dark:text-amber-300",
              "bg-amber-50 dark:bg-amber-900/30",
              "hover:bg-amber-100 dark:hover:bg-amber-900/50",
              "border border-amber-200/50 dark:border-amber-700/30"
            )}
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        
        {/* Side Navigation Arrows */}
        {hasData && (
          <>
            <Button 
              variant="outline"
              icon={<ChevronLeft className="h-4 w-4" />}
              onClick={() => api?.scrollPrev()}
              className="!h-6 !w-6 !min-w-0 !p-0 rounded-full absolute -left-1 top-1/2 -translate-y-1/2 z-10 opacity-50 hover:opacity-100 transition-opacity bg-white dark:bg-neutral-900 shadow-sm border-neutral-200 dark:border-neutral-700" 
              aria-label="Previous slide"
            />
            <Button 
              variant="outline"
              icon={<ChevronRight className="h-4 w-4" />}
              onClick={() => api?.scrollNext()}
              className="!h-6 !w-6 !min-w-0 !p-0 rounded-full absolute -right-1 top-1/2 -translate-y-1/2 z-10 opacity-50 hover:opacity-100 transition-opacity bg-white dark:bg-neutral-900 shadow-sm border-neutral-200 dark:border-neutral-700" 
              aria-label="Next slide"
            />
          </>
        )}

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : !hasData ? (
          <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">
            No hit rates available
          </div>
        ) : (
          <Carousel
            setApi={setApi}
            opts={{ align: "start", loop: true }}
            plugins={[
              Autoplay({ 
                delay: 6000, 
                stopOnMouseEnter: true,
                stopOnInteraction: false, // Resume autoplay after user interaction
              }),
            ]}
            // Force the embla viewport + container to stretch, so the slide can fill the extra vertical space
            className={cn(
              "w-full flex-1 flex flex-col min-h-0 -mx-1 pt-1",
              "[&_[data-slot=carousel-content]]:h-full",
              "[&_[data-slot=carousel-content]>div]:h-full",
              "[&_[data-slot=carousel-content]>div]:items-stretch"
            )}
          >
            <CarouselContent className="h-full -ml-1">
              {hitRates.map((item, index) => {
                const badge = getConfidenceBadge(item.l10, item.dvpRank, item.dvpLabel);
                const BadgeIcon = badge.icon;
                const insight = getMatchupInsight(item);
                
                // Calculate hits for last 10
                const hitsL10 = item.gameLogs?.slice(0, 10).filter(g => {
                  const lineNum = typeof item.line === 'string' ? parseFloat(item.line) : item.line;
                  return g.market_stat > lineNum;
                }).length || 0;
                
                return (
                  <CarouselItem key={index} className="h-full pl-1 flex">
                    <motion.div 
                      layoutId={`card-${item.playerId}-${item.market}-${id}`}
                      onClick={(e) => handleCardClick(item, e)}
                      className="flex-1 flex flex-col rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden hover:shadow-lg hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
                    >
                      {/* Player Header - Premium drilldown style */}
                      <div className="relative bg-gradient-to-r from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-850 p-3 border-b border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center gap-3">
                          {/* Large Player Headshot with Team Logo Overlay */}
                          <motion.div 
                            layoutId={`headshot-${item.playerId}-${item.market}-${id}`}
                            className="relative shrink-0"
                          >
                            <div className="h-14 w-14 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 border-3 border-white dark:border-neutral-800 shadow-md">
                              <img
                                src={getPlayerHeadshotUrl(item.playerId, "small")}
                                alt={item.playerName}
                                className="h-full w-full object-cover object-top"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                            {/* Team logo overlay */}
                            <img
                              src={`/team-logos/nba/${item.team}.svg`}
                              alt={item.team}
                              className="absolute -bottom-0.5 -right-0.5 h-5 w-5 object-contain bg-white dark:bg-neutral-800 rounded-full p-0.5 shadow-sm border border-neutral-200 dark:border-neutral-700"
                            />
                          </motion.div>
                          
                          {/* Player Info */}
                          <div className="flex-1 min-w-0">
                            <motion.h4 
                              layoutId={`name-${item.playerId}-${item.market}-${id}`}
                              className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate"
                            >
                              {item.playerName}
                            </motion.h4>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                              <span>{item.team}</span>
                              <span className="text-neutral-300 dark:text-neutral-600">•</span>
                              <span>{item.position}</span>
                            </p>
                            
                            {/* Market + Line Badge */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="px-2 py-0.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                {item.marketDisplay} O {item.line}
                              </div>
                              
                              {/* Confidence Badge */}
                              <div className={cn(
                                "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold",
                                badge.color
                              )}>
                                <BadgeIcon className={cn("h-3 w-3", badge.iconColor)} />
                                <span>{badge.label}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick Stats Row */}
                      <div className="flex items-center justify-around py-2 px-3 bg-neutral-50/50 dark:bg-neutral-800/30 border-b border-neutral-100 dark:border-neutral-800">
                        {/* L10 Hit Rate */}
                        <div className="text-center">
                          <p className="text-[9px] uppercase tracking-wider text-neutral-500 mb-0.5">L10</p>
                          <p className={cn(
                            "text-lg font-black leading-none",
                            item.l10 >= 0.8 ? "text-emerald-600 dark:text-emerald-400" 
                              : item.l10 >= 0.6 ? "text-amber-600 dark:text-amber-400" 
                              : "text-neutral-600 dark:text-neutral-400"
                          )}>
                            {hitsL10}/10
                          </p>
                        </div>
                        
                        {/* Divider */}
                        <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />
                        
                        {/* L5 Avg */}
                        <div className="text-center">
                          <p className="text-[9px] uppercase tracking-wider text-neutral-500 mb-0.5">L5 Avg</p>
                          <p className="text-lg font-black text-neutral-800 dark:text-neutral-200 leading-none">
                            {item.l5Avg?.toFixed(1) || '—'}
                          </p>
                        </div>
                        
                        {/* Divider */}
                        <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />
                        
                        {/* Hit Streak or Season */}
                        <div className="text-center">
                          {item.hitStreak && item.hitStreak >= 2 ? (
                            <>
                              <p className="text-[9px] uppercase tracking-wider text-neutral-500 mb-0.5">Streak</p>
                              <p className="text-lg font-black text-amber-500 leading-none flex items-center justify-center gap-0.5">
                                <IconFlame className="h-4 w-4 fill-amber-500" />
                                {item.hitStreak}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] uppercase tracking-wider text-neutral-500 mb-0.5">Season</p>
                              <p className={cn(
                                "text-lg font-black leading-none",
                                item.szn >= 0.7 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400"
                              )}>
                                {Math.round(item.szn * 100)}%
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Game Log Chart - Takes most of the space */}
                      <div className="flex-1 px-4 py-3 min-h-[220px]">
                        <GameLogChart 
                          gameLogs={item.gameLogs} 
                          line={typeof item.line === 'string' ? parseFloat(item.line) : item.line} 
                        />
                      </div>

                      {/* Footer - Matchup Context */}
                      <div className="px-3 py-2 bg-neutral-50/50 dark:bg-neutral-800/30 border-t border-neutral-100 dark:border-neutral-800">
                        {item.opponent ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                              <span className="font-medium">{item.homeAway === 'H' ? 'vs' : '@'}</span>
                              <img
                                src={`/team-logos/nba/${item.opponent}.svg`}
                                alt={item.opponent}
                                className="h-4 w-4 object-contain"
                              />
                              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{item.opponent}</span>
                              {item.dvpRank && (
                                <span className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded",
                                  item.dvpLabel === 'favorable' 
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium" 
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                                )}>
                                  {item.dvpRank >= 25 ? 'Easy matchup' : `#${item.dvpRank} DVP`}
                                </span>
                              )}
                            </div>
                            {item.gameStatus && (
                              <span className="text-[10px] text-neutral-500">{item.gameStatus}</span>
                            )}
                          </div>
                        ) : insight ? (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                            {insight}
                          </p>
                        ) : (
                          <div className="flex gap-4 text-xs">
                            <span className="text-neutral-500">
                              L5: <span className={cn(
                                "font-bold",
                                item.l5 >= 0.8 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                              )}>{Math.round(item.l5 * 100)}%</span>
                            </span>
                            <span className="text-neutral-500">
                              L20: <span className="font-bold text-neutral-700 dark:text-neutral-300">{Math.round(item.l20 * 100)}%</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
        )}
        
        {/* Progress Dots */}
        {hasData && count > 1 && (
          <div className="flex justify-center gap-1.5 mt-2 pb-1">
            {Array.from({ length: count }).map((_, index) => (
              <button
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  index === current 
                    ? "w-5 bg-gradient-to-r from-amber-500 to-yellow-500 shadow-sm shadow-amber-500/30" 
                    : "w-1.5 bg-amber-200 dark:bg-amber-800/50 hover:bg-amber-300 dark:hover:bg-amber-700/50"
                )}
                onClick={() => api?.scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
