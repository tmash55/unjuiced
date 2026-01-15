"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, Info, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { useShotZoneMatchup, mapZoneToId, ShotZone } from "@/hooks/use-shot-zone-matchup";

interface ShootingZonesProps {
  playerId?: number | null;
  opponentTeamId?: number | null;
  playerName?: string | null;
  opponentTeamAbbr?: string | null;
  className?: string;
}

// Internal zone data structure for rendering
interface ZoneRenderData {
  zoneId: string;
  displayName: string;
  pct: number;           // Percentage of points from this zone
  defRank: number | null; // Opponent defense rank (1-30)
  fgPct: number;         // Field goal percentage (0-100)
  fgm: number;           // Field goals made
  fga: number;           // Field goal attempts
  points: number;        // Total points
  oppFgPct: number | null; // Opponent FG% allowed
  matchupRating: string;
}

// Get zone color based on defense rank
function getZoneColor(defRank: number | null, viewMode: "player" | "defense") {
  if (defRank === null) return { bg: "rgba(120,120,120,0.3)", text: "text-neutral-400" };
  
  if (viewMode === "defense") {
    // For defense view: green = bad defense (high rank), red = good defense (low rank)
    if (defRank >= 21) return { bg: "rgba(16,185,129,0.6)", text: "text-emerald-100" }; // Favorable
    if (defRank <= 10) return { bg: "rgba(239,68,68,0.6)", text: "text-red-100" }; // Tough
    return { bg: "rgba(245,158,11,0.5)", text: "text-amber-100" }; // Neutral
  } else {
    // For player view: same colors but used for consistency
    if (defRank >= 21) return { bg: "rgba(16,185,129,0.5)", text: "text-emerald-100" };
    if (defRank <= 10) return { bg: "rgba(239,68,68,0.5)", text: "text-red-100" };
    return { bg: "rgba(245,158,11,0.45)", text: "text-amber-100" };
  }
}

// Get ordinal suffix
function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ShootingZones({ 
  playerId,
  opponentTeamId,
  playerName,
  opponentTeamAbbr,
  className 
}: ShootingZonesProps) {
  // Handle null values with defaults
  const effectivePlayerName = playerName || "Player";
  const effectiveOpponentAbbr = opponentTeamAbbr || "OPP";
  const [collapsed, setCollapsed] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  // Fetch real data
  const { data, isLoading, error } = useShotZoneMatchup({
    playerId,
    opponentTeamId,
    enabled: !!playerId && !!opponentTeamId,
  });

  // Transform API data to render format
  const zones = useMemo((): ZoneRenderData[] => {
    if (!data?.zones) return [];
    
    return data.zones.map((zone: ShotZone) => ({
      zoneId: mapZoneToId(zone.zone),
      displayName: zone.display_name,
      pct: zone.player_pct_of_total,
      defRank: zone.opponent_def_rank,
      fgPct: Math.round(zone.player_fg_pct * 100),
      fgm: zone.player_fgm,
      fga: zone.player_fga,
      points: zone.player_points,
      oppFgPct: zone.opponent_opp_fg_pct ? Math.round(zone.opponent_opp_fg_pct * 100) : null,
      matchupRating: zone.matchup_rating,
    }));
  }, [data]);

  // Helper to get zone data by ID
  const getZone = (zoneId: string): ZoneRenderData | undefined => {
    return zones.find(z => z.zoneId === zoneId);
  };

  // Friendly zone names for display
  const zoneNames: Record<string, string> = {
    rim: "At the Rim",
    paint: "In the Paint",
    midRange: "Mid-Range",
    corner3Left: "Left Corner 3",
    corner3Right: "Right Corner 3",
    aboveBreak3: "Above the Break 3",
  };

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!zones.length) return null;
    
    let favorablePct = 0;
    let neutralPct = 0;
    let toughPct = 0;
    
    zones.forEach(zone => {
      if (zone.defRank === null) return;
      if (zone.defRank >= 21) favorablePct += zone.pct;
      else if (zone.defRank <= 10) toughPct += zone.pct;
      else neutralPct += zone.pct;
    });
    
    return {
      favorablePct: Math.round(favorablePct),
      neutralPct: Math.round(neutralPct),
      toughPct: Math.round(toughPct),
    };
  }, [zones]);

  // Get zone fill color for SVG - Premium vibrant colors with better contrast
  const getZoneFill = (zoneId: string): string => {
    const zone = getZone(zoneId);
    if (!zone || zone.defRank === null) return "url(#neutralGradient)"; // Default gradient
    
    // Favorable (21-30) - Vibrant teal/emerald
    if (zone.defRank >= 21) return "url(#favorableGradient)";
    // Tough (1-10) - Rich coral/rose
    if (zone.defRank <= 10) return "url(#toughGradient)";
    // Neutral (11-20) - Golden amber
    return "url(#neutralGradient)";
  };
  
  // Get zone glow color for effects
  const getZoneGlow = (zoneId: string): string => {
    const zone = getZone(zoneId);
    if (!zone || zone.defRank === null) return "rgba(251, 191, 36, 0.4)";
    if (zone.defRank >= 21) return "rgba(16, 185, 129, 0.5)";
    if (zone.defRank <= 10) return "rgba(244, 63, 94, 0.5)";
    return "rgba(251, 191, 36, 0.4)";
  };

  // Zone component for rendering stats (badge only, no background color)
  const ZoneStat = ({ zoneId, className: zoneClassName }: { zoneId: string; className?: string }) => {
    const zone = getZone(zoneId);
    if (!zone) return null;
    
    const displayName = zoneNames[zoneId] || zone.displayName;
    
    const tooltipContent = (
      <div className="p-1 text-xs">
        <div className="font-bold text-white mb-1">{displayName}</div>
        <div className="space-y-0.5 text-neutral-300">
          <div>Points: <span className="font-semibold text-white">{zone.points}</span></div>
          <div>Shot Distribution: <span className="font-semibold text-white">{zone.pct.toFixed(1)}%</span></div>
          <div>FG: <span className="font-semibold text-white">{zone.fgm}/{zone.fga} ({zone.fgPct}%)</span></div>
          {zone.defRank !== null && (
            <div>Opp Def Rank: <span className={cn(
              "font-semibold",
              zone.defRank >= 21 ? "text-emerald-400" : zone.defRank <= 10 ? "text-red-400" : "text-amber-400"
            )}>{getOrdinal(zone.defRank)}</span></div>
          )}
          {zone.oppFgPct !== null && (
            <div>Opp Allows: <span className="font-semibold text-white">{zone.oppFgPct}% FG</span></div>
          )}
        </div>
      </div>
    );

    // When labels are hidden, show a small hover indicator dot
    if (!showLabels) {
      return (
        <Tooltip content={tooltipContent} side="top">
          <div className={cn(
            "w-5 h-5 rounded-full cursor-help transition-all hover:scale-125 bg-black/40 backdrop-blur-sm border border-white/40 flex items-center justify-center shadow-md",
            zoneClassName
          )}>
            <div className="w-2 h-2 rounded-full bg-white/80" />
          </div>
        </Tooltip>
      );
    }
    
    // Premium badge styling based on defense rank
    const getBadgeStyle = () => {
      if (zone.defRank === null) return "from-neutral-800/90 to-neutral-900/90 border-neutral-600/50";
      if (zone.defRank >= 21) return "from-emerald-900/95 to-emerald-950/95 border-emerald-500/40 shadow-emerald-500/20";
      if (zone.defRank <= 10) return "from-rose-900/95 to-rose-950/95 border-rose-500/40 shadow-rose-500/20";
      return "from-amber-900/95 to-amber-950/95 border-amber-500/40 shadow-amber-500/20";
    };
    
    return (
      <Tooltip content={tooltipContent} side="top">
        <div className={cn(
          "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 cursor-help transition-all hover:scale-110 backdrop-blur-md border shadow-lg",
          "bg-gradient-to-br",
          getBadgeStyle(),
          zoneClassName
        )}>
          {/* Shot percentage */}
          <span className="text-[12px] font-black tabular-nums text-white drop-shadow-sm">
            {zone.pct.toFixed(0)}%
          </span>
          {/* Divider */}
          <span className="text-white/20 font-light">|</span>
          {/* Defense rank with color */}
          <span className={cn(
            "text-[11px] font-black tabular-nums drop-shadow-sm",
            zone.defRank !== null && zone.defRank >= 21 ? "text-emerald-300" :
            zone.defRank !== null && zone.defRank <= 10 ? "text-rose-300" : "text-amber-300"
          )}>
            {zone.defRank !== null ? getOrdinal(zone.defRank) : "—"}
          </span>
        </div>
      </Tooltip>
    );
  };

  // Use actual data from API if available, otherwise fall back to props
  const displayOpponentAbbr = data?.opponent?.team_abbr || effectiveOpponentAbbr;
  const displayPlayerName = data?.player?.name || effectivePlayerName;

  return (
    <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5 h-full", className)}>
      {/* Header - Premium Design */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-orange-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-orange-900/10" />
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-orange-500 to-amber-600 shadow-sm shadow-orange-500/30" />
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                Shooting Zones
              </h3>
            <Tooltip
              content={
                <div className="max-w-[260px] p-2">
                  <p className="text-xs font-bold text-white mb-1.5">Shot Distribution & Defense</p>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Shows where {displayPlayerName.split(" ").pop()} takes shots and how {displayOpponentAbbr} defends each zone.
                  </p>
                  <div className="mt-3 space-y-1.5 text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600" />
                      <span className="text-emerald-300 font-medium">Favorable</span>
                      <span className="text-neutral-400">(Opp rank 21-30)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-md bg-gradient-to-br from-amber-400 to-amber-600" />
                      <span className="text-amber-300 font-medium">Neutral</span>
                      <span className="text-neutral-400">(Opp rank 11-20)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-md bg-gradient-to-br from-rose-400 to-rose-600" />
                      <span className="text-rose-300 font-medium">Tough</span>
                      <span className="text-neutral-400">(Opp rank 1-10)</span>
                    </div>
                  </div>
                </div>
              }
              side="right"
            >
              <Info className="h-3.5 w-3.5 text-neutral-400 hover:text-orange-400 cursor-help transition-colors" />
            </Tooltip>
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              vs {displayOpponentAbbr}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Summary Pills - Premium */}
            {!isLoading && summary && (
              <div className="hidden sm:flex items-center gap-1.5">
                {summary.favorablePct > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-400">{summary.favorablePct}%</span>
                  </div>
                )}
                {summary.neutralPct > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 shadow-sm shadow-amber-500/10">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-400 to-amber-500" />
                    <span className="text-[10px] font-bold text-amber-400">{summary.neutralPct}%</span>
                  </div>
                )}
                {summary.toughPct > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-rose-500/20 to-rose-600/10 border border-rose-500/30 shadow-sm shadow-rose-500/10">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-br from-rose-400 to-rose-500" />
                    <span className="text-[10px] font-bold text-rose-400">{summary.toughPct}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Show/Hide Labels Toggle */}
            <Tooltip content={showLabels ? "Hide labels" : "Show labels"}>
              <button
                type="button"
                onClick={() => setShowLabels(!showLabels)}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  showLabels 
                    ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300" 
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
              >
                {showLabels ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </button>
            </Tooltip>

            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
            >
              <ChevronDown className={cn(
                "h-4 w-4 text-neutral-500 transition-transform",
                !collapsed && "rotate-180"
              )} />
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Court View */}
      {!collapsed && (
        <div className="px-2 pt-2 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 bg-gradient-to-b from-neutral-900/20 to-neutral-900/40 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-orange-200/30 border-t-orange-500 rounded-full animate-spin" />
                <span className="text-xs text-neutral-400 font-medium">Loading zones...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48 bg-gradient-to-b from-neutral-900/20 to-neutral-900/40 rounded-xl">
              <p className="text-sm text-neutral-400 font-medium">No shot zone data available</p>
            </div>
          ) : zones.length === 0 ? (
            <div className="flex items-center justify-center h-48 bg-gradient-to-b from-neutral-900/20 to-neutral-900/40 rounded-xl">
              <p className="text-sm text-neutral-400 font-medium">No shot zone data available</p>
            </div>
          ) : (
            <div className="relative w-full mx-auto">
              {/* 
                NBA Court Dimensions (1 foot = 10 units):
                =========================================
                ViewBox: 500 x 340 (extended for more above-break-3 space)
                Baseline: y = 5
                Basket center: (250, 48) - about 4.3 feet from baseline
                
                Paint: 16ft wide = x: 170 to 330 | 19ft deep = y: 5 to 195
                Free throw circle: center (250, 195), radius 60
                Restricted area: radius 40 from basket center
                
                3-Point Arc: radius 238 from basket (250, 48)
                Corner lines: x = 30 and x = 470
                Arc meets corners at: y = 48 + sqrt(238² - 220²) ≈ 48 + 91 = 139
              */}
              <svg 
                viewBox="0 0 500 340" 
                className="w-full h-auto"
                style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.3))" }}
              >
                {/* ═══════════════════════════════════════════════════════════
                    GRADIENT DEFINITIONS - Premium color schemes
                    ═══════════════════════════════════════════════════════════ */}
                <defs>
                  {/* Favorable (Green) - Vibrant teal/emerald */}
                  <linearGradient id="favorableGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#059669" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#047857" stopOpacity="0.85" />
                  </linearGradient>
                  
                  {/* Tough (Red) - Rich coral/rose */}
                  <linearGradient id="toughGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#e11d48" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#be123c" stopOpacity="0.85" />
                  </linearGradient>
                  
                  {/* Neutral (Amber) - Golden amber */}
                  <linearGradient id="neutralGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#d97706" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#b45309" stopOpacity="0.85" />
                  </linearGradient>
                  
                  {/* Court wood texture gradient */}
                  <linearGradient id="courtFloor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1a1a2e" />
                    <stop offset="50%" stopColor="#16162a" />
                    <stop offset="100%" stopColor="#1a1a2e" />
                  </linearGradient>
                  
                  {/* Glow filter for zones */}
                  <filter id="zoneGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  
                  {/* Rim glow */}
                  <filter id="rimGlow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  
                  {/* Court lines gradient */}
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4a5568" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#718096" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#4a5568" stopOpacity="0.8" />
                  </linearGradient>
                </defs>

                {/* ═══════════════════════════════════════════════════════════
                    LAYER 0: COURT BACKGROUND
                    ═══════════════════════════════════════════════════════════ */}
                <rect x="0" y="0" width="500" height="340" fill="url(#courtFloor)" />
                
                {/* Subtle wood grain lines */}
                {[...Array(20)].map((_, i) => (
                  <line 
                    key={i}
                    x1="0" 
                    y1={i * 17} 
                    x2="500" 
                    y2={i * 17} 
                    stroke="rgba(255,255,255,0.03)" 
                    strokeWidth="1"
                  />
                ))}

                {/* ═══════════════════════════════════════════════════════════
                    LAYER 1: ZONE FILLS (with glow effects)
                    ═══════════════════════════════════════════════════════════ */}

                {/* ABOVE THE BREAK 3 */}
                <path 
                  d="M 0 139 
                     L 0 340 
                     L 500 340 
                     L 500 139
                     L 470 139
                     A 238 238 0 0 1 30 139
                     Z" 
                  fill={getZoneFill("aboveBreak3")}
                  filter="url(#zoneGlow)"
                />

                {/* LEFT CORNER 3 */}
                <rect x="0" y="5" width="30" height="134" fill={getZoneFill("corner3Left")} filter="url(#zoneGlow)" />

                {/* RIGHT CORNER 3 */}
                <rect x="470" y="5" width="30" height="134" fill={getZoneFill("corner3Right")} filter="url(#zoneGlow)" />

                {/* MID-RANGE - Left side */}
                <path 
                  d="M 30 5 
                     L 30 139 
                     A 238 238 0 0 0 170 272
                     L 170 5
                     Z" 
                  fill={getZoneFill("midRange")}
                  filter="url(#zoneGlow)"
                />
                {/* MID-RANGE - Right side */}
                <path 
                  d="M 470 5 
                     L 470 139 
                     A 238 238 0 0 1 330 272
                     L 330 5
                     Z" 
                  fill={getZoneFill("midRange")}
                  filter="url(#zoneGlow)"
                />
                {/* MID-RANGE - Top (elbow area) */}
                <path 
                  d="M 170 195
                     L 170 272
                     A 238 238 0 0 0 330 272
                     L 330 195
                     Z" 
                  fill={getZoneFill("midRange")}
                  filter="url(#zoneGlow)"
                />

                {/* PAINT (Non-RA) */}
                <path 
                  d="M 170 5 
                     L 170 195 
                     L 330 195 
                     L 330 5
                     L 290 5
                     A 40 40 0 0 1 210 5
                     Z" 
                  fill={getZoneFill("paint")}
                  filter="url(#zoneGlow)"
                />

                {/* RESTRICTED AREA (Rim) */}
                <path 
                  d="M 210 5 A 40 40 0 0 0 290 5 Z" 
                  fill={getZoneFill("rim")}
                  filter="url(#zoneGlow)"
                />

                {/* ═══════════════════════════════════════════════════════════
                    LAYER 2: COURT LINES (premium styling)
                    ═══════════════════════════════════════════════════════════ */}
                
                {/* Baseline - white glow effect */}
                <line x1="0" y1="5" x2="500" y2="5" stroke="rgba(255,255,255,0.6)" strokeWidth="4" />
                <line x1="0" y1="5" x2="500" y2="5" stroke="rgba(255,255,255,0.9)" strokeWidth="2" />

                {/* 3-Point Line - glowing white */}
                <path 
                  d="M 30 5 L 30 139 A 238 238 0 0 0 470 139 L 470 5" 
                  fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="4"
                />
                <path 
                  d="M 30 5 L 30 139 A 238 238 0 0 0 470 139 L 470 5" 
                  fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2"
                />

                {/* Corner zone borders */}
                <line x1="0" y1="139" x2="30" y2="139" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                <line x1="470" y1="139" x2="500" y2="139" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                <line x1="0" y1="5" x2="0" y2="139" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                <line x1="500" y1="5" x2="500" y2="139" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />

                {/* Paint/Key outline - glowing */}
                <rect x="170" y="5" width="160" height="190" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="4" />
                <rect x="170" y="5" width="160" height="190" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
                
                {/* Free Throw Circle (bottom half) */}
                <path 
                  d="M 170 195 A 60 60 0 0 0 330 195" 
                  fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"
                />
                {/* Free Throw Circle (top half - dashed) */}
                <path 
                  d="M 170 195 A 60 60 0 0 1 330 195" 
                  fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="8 6"
                />

                {/* Restricted Area arc */}
                <path d="M 210 5 A 40 40 0 0 0 290 5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />

                {/* ═══════════════════════════════════════════════════════════
                    LAYER 3: PREMIUM BASKET HARDWARE
                    ═══════════════════════════════════════════════════════════ */}
                
                {/* Backboard - glass effect */}
                <rect x="218" y="6" width="64" height="6" fill="rgba(255,255,255,0.15)" rx="2" />
                <rect x="220" y="8" width="60" height="4" fill="rgba(255,255,255,0.3)" rx="1" />
                <rect x="222" y="9" width="56" height="2" fill="rgba(255,255,255,0.1)" rx="0.5" />
                
                {/* Rim - Orange glow */}
                <circle cx="250" cy="20" r="12" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.3" filter="url(#rimGlow)" />
                <circle cx="250" cy="20" r="10" fill="none" stroke="#fb923c" strokeWidth="3.5" filter="url(#rimGlow)" />
                <circle cx="250" cy="20" r="10" fill="none" stroke="#f97316" strokeWidth="2.5" />
                
                {/* Net attachment points */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
                  const rad = (angle * Math.PI) / 180;
                  const x = 250 + 10 * Math.cos(rad);
                  const y = 20 + 10 * Math.sin(rad);
                  return (
                    <circle key={angle} cx={x} cy={y} r="1" fill="#f97316" opacity="0.8" />
                  );
                })}
                
                {/* Center dot */}
                <circle cx="250" cy="20" r="2" fill="#f97316" />
              </svg>

              {/* Zone Overlays - 6 zones positioned over their court areas */}
              <div className="absolute inset-0">
                {/* Rim / Restricted Area - near the basket */}
                <div className="absolute" style={{ top: "4%", left: "50%", transform: "translateX(-50%)" }}>
                  <ZoneStat zoneId="rim" />
                </div>

                {/* Paint (non-restricted) - in the key */}
                <div className="absolute" style={{ top: "32%", left: "50%", transform: "translateX(-50%)" }}>
                  <ZoneStat zoneId="paint" />
                </div>

                {/* Mid Range - outside paint, inside 3pt (show above FT circle) */}
                <div className="absolute" style={{ top: "62%", left: "50%", transform: "translateX(-50%)" }}>
                  <ZoneStat zoneId="midRange" />
                </div>

                {/* Corner 3 Left - in the left corner area */}
                <div className="absolute" style={{ top: "18%", left: "0.5%" }}>
                  <ZoneStat zoneId="corner3Left" />
                </div>

                {/* Corner 3 Right - in the right corner area */}
                <div className="absolute" style={{ top: "18%", right: "0.5%" }}>
                  <ZoneStat zoneId="corner3Right" />
                </div>

                {/* Above the Break 3 - in the arc area */}
                <div className="absolute" style={{ bottom: "6%", left: "50%", transform: "translateX(-50%)" }}>
                  <ZoneStat zoneId="aboveBreak3" />
                </div>
              </div>
            </div>
          )}

          {/* Legend - Premium styling */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm shadow-emerald-500/30" />
              <span className="text-[10px] font-semibold text-emerald-400">Favorable</span>
              <span className="text-[9px] text-emerald-400/60">(21-30)</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-500/30" />
              <span className="text-[10px] font-semibold text-amber-400">Neutral</span>
              <span className="text-[9px] text-amber-400/60">(11-20)</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-rose-400 to-rose-600 shadow-sm shadow-rose-500/30" />
              <span className="text-[10px] font-semibold text-rose-400">Tough</span>
              <span className="text-[9px] text-rose-400/60">(1-10)</span>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
            {showLabels ? "Shot Distribution % | Opponent Defensive Rank" : "Hover over zones for details"}
          </p>
        </div>
      )}
    </div>
  );
}
