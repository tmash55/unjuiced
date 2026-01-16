"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShotZoneMatchup, mapZoneToId, ShotZone } from "@/hooks/use-shot-zone-matchup";

interface MobileShootingZonesProps {
  playerId: number | null;
  opponentTeamId: number | null;
  opponentTeamAbbr: string | null;
  playerName: string;
}

// Get ordinal suffix
function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Get rank color class
function getRankColorClass(rank: number | null) {
  if (rank === null) return "text-neutral-400 dark:text-neutral-500";
  if (rank >= 21) return "text-emerald-600 dark:text-emerald-400";
  if (rank <= 10) return "text-red-500 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

// Get rank badge background
function getRankBadgeBg(rank: number | null) {
  if (rank === null) return "bg-neutral-100 dark:bg-neutral-800";
  if (rank >= 21) return "bg-emerald-100 dark:bg-emerald-900/40";
  if (rank <= 10) return "bg-red-100 dark:bg-red-900/40";
  return "bg-amber-100 dark:bg-amber-900/40";
}

// Zone display names (without emojis)
const ZONE_DISPLAY: Record<string, string> = {
  rim: "At the Rim",
  paint: "In the Paint",
  midRange: "Mid-Range",
  corner3Left: "Left Corner 3",
  corner3Right: "Right Corner 3",
  aboveBreak3: "Above Break 3",
};

export function MobileShootingZones({ playerId, opponentTeamId, opponentTeamAbbr, playerName }: MobileShootingZonesProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { data, isLoading, error } = useShotZoneMatchup({
    playerId,
    opponentTeamId,
    enabled: !!playerId && !!opponentTeamId,
  });

  // Transform API data
  const zones = useMemo(() => {
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

  // Helper to get zone data
  const getZone = (zoneId: string) => zones.find(z => z.zoneId === zoneId);

  // Get zone fill color for SVG - muted, on-brand colors
  const getZoneFill = (zoneId: string): string => {
    const zone = getZone(zoneId);
    if (!zone || zone.defRank === null) return "#2d2d2d"; // Default dark
    
    // Favorable (21-30) - Muted emerald
    if (zone.defRank >= 21) return "rgba(52, 211, 153, 0.5)";
    // Tough (1-10) - True red
    if (zone.defRank <= 10) return "rgba(239, 68, 68, 0.5)";
    // Neutral (11-20) - Muted amber
    return "rgba(251, 191, 36, 0.45)";
  };

  // Calculate summary
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

  if (!playerId || !opponentTeamId) return null;

  return (
    <div className="bg-white dark:bg-neutral-900/80 rounded-2xl border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3.5 flex items-center justify-between bg-gradient-to-br from-white via-neutral-50/50 to-orange-50/30 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-orange-900/10"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-orange-500 to-amber-600 shadow-sm shadow-orange-500/30" />
          <div>
            <span className="text-sm font-bold text-neutral-900 dark:text-white block">
              Shot Zones
            </span>
            <span className="text-[10px] text-neutral-500">vs {opponentTeamAbbr}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && summary && !collapsed && (
            <div className="flex items-center gap-1">
              {summary.favorablePct > 0 && (
                <span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/50 dark:to-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-700/30">
                  {summary.favorablePct}% good
                </span>
              )}
              {summary.toughPct > 0 && (
                <span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/50 dark:to-red-900/30 text-red-500 dark:text-red-400 border border-red-200/50 dark:border-red-700/30">
                  {summary.toughPct}% tough
                </span>
              )}
            </div>
          )}
          <ChevronDown className={cn(
            "h-4 w-4 text-neutral-500 transition-transform",
            !collapsed && "rotate-180"
          )} />
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="border-t border-neutral-200/60 dark:border-neutral-700/60">
          {isLoading ? (
            <div className="px-4 py-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <span className="text-xs text-neutral-500 font-medium">Loading shot zones...</span>
              </div>
            </div>
          ) : error || !zones.length ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-neutral-500 font-medium">No shot zone data available</p>
            </div>
          ) : (
            <>
              {/* Court Visual - Matching desktop dimensions exactly */}
              <div className="px-3 py-4 bg-neutral-900 dark:bg-neutral-950">
                <svg viewBox="0 0 500 340" className="w-full h-auto">
                  {/* ═══════════════════════════════════════════════════════════
                      LAYER 1: ZONE FILLS (drawn first, from outside to inside)
                      NBA Court Dimensions (matching desktop):
                      ViewBox: 500 x 340
                      Baseline: y = 5
                      Basket center: (250, 48)
                      Paint: 16ft wide = x: 170 to 330 | 19ft deep = y: 5 to 195
                      Free throw circle: center (250, 195), radius 60
                      Restricted area: radius 40 from basket center
                      3-Point Arc: radius 238 from basket
                      Corner lines: x = 30 and x = 470
                      ═══════════════════════════════════════════════════════════ */}
                  
                  {/* ABOVE THE BREAK 3 - Full background for the arc area */}
                  <path 
                    d="M 0 139 
                       L 0 340 
                       L 500 340 
                       L 500 139
                       L 470 139
                       A 238 238 0 0 1 30 139
                       Z" 
                    fill={getZoneFill("aboveBreak3")}
                  />
                  
                  {/* LEFT CORNER 3 */}
                  <rect x="0" y="5" width="30" height="134" fill={getZoneFill("corner3Left")} />
                  
                  {/* RIGHT CORNER 3 */}
                  <rect x="470" y="5" width="30" height="134" fill={getZoneFill("corner3Right")} />
                  
                  {/* MID-RANGE - All areas between paint and 3pt line */}
                  {/* Left side mid-range */}
                  <path 
                    d="M 30 5 
                       L 30 139 
                       A 238 238 0 0 0 170 272
                       L 170 5
                       Z" 
                    fill={getZoneFill("midRange")}
                  />
                  {/* Right side mid-range */}
                  <path 
                    d="M 470 5 
                       L 470 139 
                       A 238 238 0 0 1 330 272
                       L 330 5
                       Z" 
                    fill={getZoneFill("midRange")}
                  />
                  {/* Top mid-range (elbow area) */}
                  <path 
                    d="M 170 195
                       L 170 272
                       A 238 238 0 0 0 330 272
                       L 330 195
                       Z" 
                    fill={getZoneFill("midRange")}
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
                  />
                  
                  {/* RESTRICTED AREA (Rim) */}
                  <path 
                    d="M 210 5 A 40 40 0 0 0 290 5 Z" 
                    fill={getZoneFill("rim")}
                  />
                  
                  {/* ═══════════════════════════════════════════════════════════
                      LAYER 2: COURT LINES (dark, drawn on top)
                      ═══════════════════════════════════════════════════════════ */}
                  
                  {/* Baseline */}
                  <line x1="0" y1="5" x2="500" y2="5" stroke="#222" strokeWidth="3" />
                  
                  {/* 3-Point Line - corners + arc */}
                  <path 
                    d="M 30 5 L 30 139 A 238 238 0 0 0 470 139 L 470 5" 
                    fill="none" stroke="#222" strokeWidth="3"
                  />
                  
                  {/* Corner zone borders */}
                  <line x1="0" y1="139" x2="30" y2="139" stroke="#222" strokeWidth="2" />
                  <line x1="470" y1="139" x2="500" y2="139" stroke="#222" strokeWidth="2" />
                  <line x1="0" y1="5" x2="0" y2="139" stroke="#222" strokeWidth="2" />
                  <line x1="500" y1="5" x2="500" y2="139" stroke="#222" strokeWidth="2" />
                  
                  {/* Paint/Key outline */}
                  <rect x="170" y="5" width="160" height="190" fill="none" stroke="#222" strokeWidth="2.5" />
                  
                  {/* Free Throw Circle (bottom half) */}
                  <path 
                    d="M 170 195 A 60 60 0 0 0 330 195" 
                    fill="none" stroke="#222" strokeWidth="2"
                  />
                  {/* Free Throw Circle (top half - dashed) */}
                  <path 
                    d="M 170 195 A 60 60 0 0 1 330 195" 
                    fill="none" stroke="#333" strokeWidth="1.5" strokeDasharray="8 6"
                  />
                  
                  {/* Restricted Area arc */}
                  <path d="M 210 5 A 40 40 0 0 0 290 5" fill="none" stroke="#222" strokeWidth="2" />
                  
                  {/* ═══════════════════════════════════════════════════════════
                      LAYER 3: BASKET HARDWARE
                      ═══════════════════════════════════════════════════════════ */}
                  
                  {/* Backboard */}
                  <rect x="220" y="8" width="60" height="4" fill="#555" rx="1" />
                  
                  {/* Rim */}
                  <circle cx="250" cy="20" r="9" fill="none" stroke="#f97316" strokeWidth="3" />
                  <circle cx="250" cy="20" r="2.5" fill="#f97316" />
                  
                  {/* ═══════════════════════════════════════════════════════════
                      LAYER 4: ZONE LABELS (badges)
                      ═══════════════════════════════════════════════════════════ */}
                  
                  {/* At the Rim */}
                  {getZone("rim") && (
                    <g>
                      <rect x="220" y="35" width="60" height="28" rx="4" fill="rgba(0,0,0,0.75)" />
                      <text x="250" y="50" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                        {getZone("rim")!.pct.toFixed(0)}%
                      </text>
                      <text x="250" y="60" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8">
                        {getZone("rim")!.defRank !== null ? getOrdinal(getZone("rim")!.defRank!) : "—"}
                      </text>
                    </g>
                  )}
                  
                  {/* In the Paint */}
                  {getZone("paint") && (
                    <g>
                      <rect x="220" y="100" width="60" height="28" rx="4" fill="rgba(0,0,0,0.75)" />
                      <text x="250" y="115" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                        {getZone("paint")!.pct.toFixed(0)}%
                      </text>
                      <text x="250" y="125" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8">
                        {getZone("paint")!.defRank !== null ? getOrdinal(getZone("paint")!.defRank!) : "—"}
                      </text>
                    </g>
                  )}
                  
                  {/* Mid-Range */}
                  {getZone("midRange") && (
                    <g>
                      <rect x="220" y="210" width="60" height="28" rx="4" fill="rgba(0,0,0,0.75)" />
                      <text x="250" y="225" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                        {getZone("midRange")!.pct.toFixed(0)}%
                      </text>
                      <text x="250" y="235" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8">
                        {getZone("midRange")!.defRank !== null ? getOrdinal(getZone("midRange")!.defRank!) : "—"}
                      </text>
                    </g>
                  )}
                  
                  {/* Left Corner 3 */}
                  {getZone("corner3Left") && (
                    <g>
                      <rect x="2" y="55" width="56" height="28" rx="4" fill="rgba(0,0,0,0.75)" />
                      <text x="30" y="70" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                        {getZone("corner3Left")!.pct.toFixed(0)}%
                      </text>
                      <text x="30" y="80" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8">
                        {getZone("corner3Left")!.defRank !== null ? getOrdinal(getZone("corner3Left")!.defRank!) : "—"}
                      </text>
                    </g>
                  )}
                  
                  {/* Right Corner 3 */}
                  {getZone("corner3Right") && (
                    <g>
                      <rect x="442" y="55" width="56" height="28" rx="4" fill="rgba(0,0,0,0.75)" />
                      <text x="470" y="70" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                        {getZone("corner3Right")!.pct.toFixed(0)}%
                      </text>
                      <text x="470" y="80" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8">
                        {getZone("corner3Right")!.defRank !== null ? getOrdinal(getZone("corner3Right")!.defRank!) : "—"}
                      </text>
                    </g>
                  )}
                  
                  {/* Above the Break 3 */}
                  {getZone("aboveBreak3") && (
                    <g>
                      <rect x="220" y="285" width="60" height="28" rx="4" fill="rgba(0,0,0,0.75)" />
                      <text x="250" y="300" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                        {getZone("aboveBreak3")!.pct.toFixed(0)}%
                      </text>
                      <text x="250" y="310" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8">
                        {getZone("aboveBreak3")!.defRank !== null ? getOrdinal(getZone("aboveBreak3")!.defRank!) : "—"}
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              {/* Zone Table with Headers */}
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_60px_60px_50px] items-center px-4 py-2 bg-neutral-100/80 dark:bg-neutral-800/50 border-y border-neutral-200/60 dark:border-neutral-800/60">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Zone
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 text-center leading-tight">
                    Shot %
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 text-center">
                    FG%
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 text-center leading-tight">
                    Def<br/>Rank
                  </span>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                  {zones.map((zone, idx) => {
                    const zoneName = ZONE_DISPLAY[zone.zoneId] || zone.displayName;
                    
                    return (
                      <div 
                        key={zone.zoneId}
                        className={cn(
                          "grid grid-cols-[1fr_60px_60px_50px] px-4 py-2.5 items-center",
                          idx % 2 === 0 
                            ? "bg-neutral-50/50 dark:bg-neutral-800/20" 
                            : "bg-white dark:bg-neutral-900"
                        )}
                      >
                        {/* Zone Name */}
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          {zoneName}
                        </span>
                        
                        {/* Shot % */}
                        <span className="text-xs font-bold tabular-nums text-neutral-900 dark:text-white text-center">
                          {zone.pct.toFixed(0)}%
                        </span>
                        
                        {/* FG% */}
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 text-center">
                          {zone.fgPct}%
                        </span>
                        
                        {/* Defense Rank */}
                        <div className="flex justify-center">
                          <span className={cn(
                            "inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-bold tabular-nums",
                            getRankBadgeBg(zone.defRank),
                            getRankColorClass(zone.defRank)
                          )}>
                            {zone.defRank ?? "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="px-4 py-2.5 bg-neutral-50/50 dark:bg-neutral-800/30 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <div className="flex items-center justify-center gap-3 text-[9px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">21-30 Favorable</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-amber-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">11-20 Neutral</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-red-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">1-10 Tough</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
