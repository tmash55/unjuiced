"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, Info } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"player" | "defense">("defense");

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

  // Get zone fill color for SVG
  const getZoneFill = (zoneId: string): string => {
    const zone = getZone(zoneId);
    if (!zone || zone.defRank === null) return "#2d2d2d"; // Default dark
    
    if (zone.defRank >= 21) return "rgba(16,185,129,0.45)"; // Favorable - green
    if (zone.defRank <= 10) return "rgba(239,68,68,0.45)"; // Tough - red
    return "rgba(245,158,11,0.4)"; // Neutral - amber
  };

  // Zone component for rendering stats (badge only, no background color)
  const ZoneStat = ({ zoneId, className: zoneClassName }: { zoneId: string; className?: string }) => {
    const zone = getZone(zoneId);
    if (!zone) return null;
    
    const displayName = zoneNames[zoneId] || zone.displayName;
    
    return (
      <Tooltip
        content={
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
        }
        side="top"
      >
        <div className={cn(
          "flex flex-col items-center justify-center rounded-md px-2 py-1 cursor-help transition-all hover:scale-105 bg-black/40 backdrop-blur-sm border border-white/10",
          zoneClassName
        )}>
          <span className="text-[11px] font-bold tabular-nums text-white">
            {viewMode === "player" ? `${zone.pct.toFixed(0)}%` : zone.defRank !== null ? getOrdinal(zone.defRank) : "—"}
          </span>
          <span className="text-[8px] font-medium text-white/70">
            {viewMode === "player" ? `${zone.fgPct}%` : `${zone.pct.toFixed(0)}%`}
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
            {/* View Toggle */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-700/50 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("player")}
                className={cn(
                  "px-2 py-1 text-[10px] font-semibold rounded-md transition-all",
                  viewMode === "player"
                    ? "bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                Player
              </button>
              <button
                type="button"
                onClick={() => setViewMode("defense")}
                className={cn(
                  "px-2 py-1 text-[10px] font-semibold rounded-md transition-all",
                  viewMode === "defense"
                    ? "bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                Opp Defense
              </button>
            </div>

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
                NBA Court Dimensions (scaled 1 foot = 10 units):
                ================================================
                - ViewBox: 500 wide x 320 tall
                - Baseline: y=20
                - Basket center: (250, 63) - 4.3 feet from baseline
                
                KEY DIMENSIONS:
                - Paint: 16 feet wide (160 units) = x: 170 to 330
                - Paint: 19 feet deep (190 units) = y: 20 to 210
                - Free throw circle: 6 feet radius (60 units), center at (250, 210)
                - Restricted area: 4 feet radius (40 units) from basket
                
                3-POINT LINE:
                - Arc radius: 23.75 feet (237.5 units) from basket center
                - Corner lines: 3 feet from sideline (x=30 and x=470)
                - Arc meets corners at y ≈ 152 (calculated: 63 + sqrt(237.5² - 220²))
                
                ZONES:
                1. Rim (Restricted): Semicircle 40 units from basket
                2. Paint: Key area minus restricted
                3. Mid-Range: Inside 3pt line, outside paint
                4. Corner 3 Left/Right: Straight sections x=0-30 and x=470-500
                5. Above Break 3: The arc portion beyond the corners
              */}
              <svg 
                viewBox="0 0 500 320" 
                className="w-full h-auto"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
              >
                <defs>
                  <linearGradient id="courtGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1a1a1a" />
                    <stop offset="100%" stopColor="#141414" />
                  </linearGradient>
                </defs>

                {/* Court Background */}
                <rect x="0" y="0" width="500" height="320" rx="6" fill="url(#courtGradient)" />
                <rect x="0" y="0" width="500" height="320" rx="6" fill="none" stroke="#333" strokeWidth="2" />

                {/* Baseline */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#444" strokeWidth="2" />

                {/* ════════════════════════════════════════════════════════════
                    ZONE FILLS - Each zone colored by defensive matchup
                    ════════════════════════════════════════════════════════════ */}

                {/* 1. LEFT CORNER 3 - Rectangle from sideline to corner line, baseline to arc start */}
                <rect 
                  x="0" y="20" 
                  width="30" height="132"
                  fill={getZoneFill("corner3Left")}
                />

                {/* 2. RIGHT CORNER 3 - Mirror of left */}
                <rect 
                  x="470" y="20" 
                  width="30" height="132"
                  fill={getZoneFill("corner3Right")}
                />

                {/* 3. ABOVE THE BREAK 3 - Arc zone from where corners end to bottom */}
                <path 
                  d="M 30 152 
                     A 237.5 237.5 0 0 0 470 152
                     L 470 320
                     L 30 320
                     Z" 
                  fill={getZoneFill("aboveBreak3")}
                />

                {/* 4. MID-RANGE LEFT - Between left corner/arc and paint */}
                <path 
                  d="M 30 20 
                     L 30 152
                     A 237.5 237.5 0 0 0 170 232
                     L 170 20
                     Z" 
                  fill={getZoneFill("midRange")}
                />

                {/* 5. MID-RANGE RIGHT - Between right corner/arc and paint */}
                <path 
                  d="M 470 20 
                     L 470 152
                     A 237.5 237.5 0 0 1 330 232
                     L 330 20
                     Z" 
                  fill={getZoneFill("midRange")}
                />

                {/* 6. MID-RANGE TOP - Above the free throw circle, inside arc */}
                <path 
                  d="M 170 210
                     A 60 60 0 0 0 330 210
                     L 330 232
                     A 237.5 237.5 0 0 1 170 232
                     Z" 
                  fill={getZoneFill("midRange")}
                />

                {/* 7. PAINT (Non-RA) - The key minus restricted area */}
                <path 
                  d="M 170 20 
                     L 170 210
                     A 60 60 0 0 0 330 210
                     L 330 20
                     L 290 20
                     A 40 40 0 0 1 210 20
                     L 170 20
                     Z" 
                  fill={getZoneFill("paint")}
                />

                {/* 8. RESTRICTED AREA (Rim) - Semicircle near basket */}
                <path 
                  d="M 210 20 
                     A 40 40 0 0 0 290 20
                     Z" 
                  fill={getZoneFill("rim")}
                />

                {/* ════════════════════════════════════════════════════════════
                    COURT LINES - Draw on top of zones
                    ════════════════════════════════════════════════════════════ */}
                
                {/* 3-Point Line */}
                <path 
                  d="M 30 20 L 30 152 A 237.5 237.5 0 0 0 470 152 L 470 20" 
                  fill="none" stroke="#555" strokeWidth="2"
                />

                {/* Paint/Key outline */}
                <rect x="170" y="20" width="160" height="190" fill="none" stroke="#555" strokeWidth="1.5" />
                
                {/* Free Throw Circle */}
                <circle cx="250" cy="210" r="60" fill="none" stroke="#555" strokeWidth="1.5" />

                {/* Restricted Area arc */}
                <path d="M 210 20 A 40 40 0 0 0 290 20" fill="none" stroke="#666" strokeWidth="1.5" />

                {/* Backboard */}
                <rect x="220" y="22" width="60" height="4" fill="#777" rx="1" />
                
                {/* Rim */}
                <circle cx="250" cy="35" r="8" fill="none" stroke="#f97316" strokeWidth="2.5" />
                <circle cx="250" cy="35" r="2" fill="#f97316" />
              </svg>

              {/* Zone Overlays - 6 zones positioned over their court areas */}
              <div className="absolute inset-0">
                {/* Rim / Restricted Area - near the basket */}
                <div className="absolute" style={{ top: "8%", left: "50%", transform: "translateX(-50%)" }}>
                  <ZoneStat zoneId="rim" />
                </div>

                {/* Paint (non-restricted) - in the key */}
                <div className="absolute" style={{ top: "35%", left: "50%", transform: "translateX(-50%)" }}>
                  <ZoneStat zoneId="paint" />
                </div>

                {/* Mid Range - outside paint, inside 3pt (show above FT circle) */}
                <div className="absolute" style={{ top: "58%", left: "50%", transform: "translateX(-50%)" }}>
                  <ZoneStat zoneId="midRange" />
                </div>

                {/* Corner 3 Left - in the left corner area */}
                <div className="absolute" style={{ top: "22%", left: "1%" }}>
                  <ZoneStat zoneId="corner3Left" />
                </div>

                {/* Corner 3 Right - in the right corner area */}
                <div className="absolute" style={{ top: "22%", right: "1%" }}>
                  <ZoneStat zoneId="corner3Right" />
                </div>

                {/* Above the Break 3 - in the arc area */}
                <div className="absolute" style={{ bottom: "10%", left: "50%", transform: "translateX(-50%)" }}>
                  <ZoneStat zoneId="aboveBreak3" />
                </div>
              </div>
            </div>
          )}

          {/* Legend - Compact inline */}
          <div className="mt-2 flex items-center justify-center gap-3 text-[9px]">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "rgba(16,185,129,0.6)" }} />
              <span className="text-neutral-500 dark:text-neutral-400">Favorable</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "rgba(245,158,11,0.5)" }} />
              <span className="text-neutral-500 dark:text-neutral-400">Neutral</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "rgba(239,68,68,0.6)" }} />
              <span className="text-neutral-500 dark:text-neutral-400">Tough</span>
            </div>
            <span className="text-neutral-400 dark:text-neutral-500 ml-1">
              · {viewMode === "player" ? "Shot % & FG%" : "Def Rank & Shot %"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
