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

  // Get zone fill color for SVG - vibrant colors matching alternate lines matrix
  const getZoneFill = (zoneId: string): string => {
    const zone = getZone(zoneId);
    if (!zone || zone.defRank === null) return "#2d2d2d"; // Default dark
    
    // Favorable (21-30) - Emerald green (matches emerald-500/400)
    if (zone.defRank >= 21) return "rgba(52, 211, 153, 0.7)"; // #34d399
    // Tough (1-10) - Red (matches red-500/400)
    if (zone.defRank <= 10) return "rgba(248, 113, 113, 0.7)"; // #f87171
    // Neutral (11-20) - Amber/Orange (matches amber-500/400)
    return "rgba(251, 191, 36, 0.65)"; // #fbbf24
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
    
    return (
      <Tooltip content={tooltipContent} side="top">
        <div className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-help transition-all hover:scale-105 bg-black/60 backdrop-blur-sm border border-white/20 shadow-lg",
          zoneClassName
        )}>
          {/* Shot percentage */}
          <span className="text-[11px] font-bold tabular-nums text-white">
            {zone.pct.toFixed(0)}%
          </span>
          {/* Divider */}
          <span className="text-white/30">|</span>
          {/* Defense rank with color */}
          <span className={cn(
            "text-[10px] font-bold tabular-nums",
            zone.defRank !== null && zone.defRank >= 21 ? "text-emerald-400" :
            zone.defRank !== null && zone.defRank <= 10 ? "text-red-400" : "text-amber-400"
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
    <div className={cn("rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden shadow-sm h-full", className)}>
      {/* Header */}
      <div className="px-4 py-2 border-b border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50 to-transparent dark:from-neutral-800/50 dark:to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-0.5 rounded-full bg-gradient-to-b from-orange-500 to-amber-500" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Shooting Zones
            </h3>
            <Tooltip
              content={
                <div className="max-w-[240px] p-1">
                  <p className="text-xs font-semibold text-white mb-1">Shot Distribution & Defense</p>
                  <p className="text-[11px] text-neutral-300">
                    Shows where {displayPlayerName.split(" ").pop()} takes shots and how {displayOpponentAbbr} defends each zone.
                  </p>
                  <div className="mt-2 space-y-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
                      <span className="text-neutral-300">Favorable (21-30)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-amber-500" />
                      <span className="text-neutral-300">Neutral (11-20)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-red-500" />
                      <span className="text-neutral-300">Tough (1-10)</span>
                    </div>
                  </div>
                </div>
              }
              side="right"
            >
              <Info className="h-3 w-3 text-neutral-400 cursor-help" />
            </Tooltip>
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              vs {displayOpponentAbbr}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Summary Pills */}
            {!isLoading && summary && (
              <div className="hidden sm:flex items-center gap-1">
                {summary.favorablePct > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[9px] font-bold text-emerald-400">{summary.favorablePct}%</span>
                  </div>
                )}
                {summary.neutralPct > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-[9px] font-bold text-amber-400">{summary.neutralPct}%</span>
                  </div>
                )}
                {summary.toughPct > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-[9px] font-bold text-red-400">{summary.toughPct}%</span>
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
              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
            >
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-neutral-500 transition-transform",
                !collapsed && "rotate-180"
              )} />
            </button>
          </div>
        </div>
      </div>

      {/* Court View */}
      {!collapsed && (
        <div className="px-2 pt-2 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex flex-col items-center gap-2">
                <div className="h-4 w-4 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin" />
                <span className="text-[10px] text-neutral-400">Loading...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs text-neutral-400">No shot zone data available</p>
            </div>
          ) : zones.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs text-neutral-400">No shot zone data available</p>
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
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
              >
                {/* ═══════════════════════════════════════════════════════════
                    LAYER 1: ZONE FILLS (drawn first, from outside to inside)
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

                {/* LEFT CORNER 3 - From sideline to 3pt line, baseline to arc junction */}
                <rect x="0" y="5" width="30" height="134" fill={getZoneFill("corner3Left")} />

                {/* RIGHT CORNER 3 - Mirror of left */}
                <rect x="470" y="5" width="30" height="134" fill={getZoneFill("corner3Right")} />

                {/* MID-RANGE - All areas between paint and 3pt line */}
                {/* Left side mid-range (baseline to 3pt arc) */}
                {/* Arc at x=170: y = 48 + sqrt(238² - 80²) ≈ 272 */}
                <path 
                  d="M 30 5 
                     L 30 139 
                     A 238 238 0 0 0 170 272
                     L 170 5
                     Z" 
                  fill={getZoneFill("midRange")}
                />
                {/* Right side mid-range (baseline to 3pt arc) */}
                <path 
                  d="M 470 5 
                     L 470 139 
                     A 238 238 0 0 1 330 272
                     L 330 5
                     Z" 
                  fill={getZoneFill("midRange")}
                />
                {/* Top mid-range (from free throw line to 3pt arc - the elbow area) */}
                <path 
                  d="M 170 195
                     L 170 272
                     A 238 238 0 0 0 330 272
                     L 330 195
                     Z" 
                  fill={getZoneFill("midRange")}
                />

                {/* PAINT (Non-RA) - Rectangular key area minus restricted */}
                {/* Paint is just the rectangle from baseline to free throw line */}
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

                {/* RESTRICTED AREA (Rim) - Semicircle at the basket */}
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

                {/* Corner zone borders - creates rectangle separation from above-break-3 */}
                {/* Left corner bottom */}
                <line x1="0" y1="139" x2="30" y2="139" stroke="#222" strokeWidth="2" />
                {/* Right corner bottom */}
                <line x1="470" y1="139" x2="500" y2="139" stroke="#222" strokeWidth="2" />
                {/* Sidelines for corners */}
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

          {/* Legend - Clean inline with explanation */}
          <div className="mt-3 flex items-center justify-center gap-4 text-[9px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "rgba(52, 211, 153, 0.7)" }} />
              <span className="text-neutral-500 dark:text-neutral-400">Favorable <span className="text-neutral-400 dark:text-neutral-500">(21-30)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "rgba(251, 191, 36, 0.65)" }} />
              <span className="text-neutral-500 dark:text-neutral-400">Neutral <span className="text-neutral-400 dark:text-neutral-500">(11-20)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "rgba(248, 113, 113, 0.7)" }} />
              <span className="text-neutral-500 dark:text-neutral-400">Tough <span className="text-neutral-400 dark:text-neutral-500">(1-10)</span></span>
            </div>
          </div>
          <p className="mt-1 text-center text-[9px] text-neutral-400 dark:text-neutral-500">
            {showLabels ? "Shot % | Opp Defensive Rank" : "Hover over zones for details"}
          </p>
        </div>
      )}
    </div>
  );
}
