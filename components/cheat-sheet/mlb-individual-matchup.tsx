"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbGames, type MlbGame } from "@/hooks/use-mlb-games";
import { useMlbGameMatchup, type BatterMatchup, type PitcherProfile } from "@/hooks/use-mlb-game-matchup";
import { useMlbPlayerSearch, type MlbPlayerSearchResult } from "@/hooks/use-mlb-player-search";
import { useMlbHotZone, type BatterZoneCell, type PitcherZoneCell, type OverlayZoneCell } from "@/hooks/use-mlb-hot-zone";
import { useMlbIndividualMatchup } from "@/hooks/use-mlb-individual-matchup";
import { useMlbPlayerGameLogs } from "@/hooks/use-mlb-player-game-logs";
import { useMlbSprayChart } from "@/hooks/use-mlb-spray-chart";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { ChevronRight, Loader2, AlertCircle, Search, X } from "lucide-react";
import { IconUserSearch } from "@tabler/icons-react";

// ── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_OPTIONS = [
  { value: "season" as const, label: "Season" },
  { value: "30" as const, label: "Last 30" },
  { value: "15" as const, label: "Last 15" },
  { value: "7" as const, label: "Last 7" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtAvg(val: number | null): string {
  if (val == null) return "-";
  return val >= 1 ? val.toFixed(3) : `.${Math.round(val * 1000).toString().padStart(3, "0")}`;
}

function fmtStat(val: number | null, digits = 2): string {
  if (val == null) return "-";
  return val.toFixed(digits);
}

function slgColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 0.500) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 0.400) return "text-yellow-600 dark:text-yellow-400";
  if (val < 0.350 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function isoColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 0.220) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 0.160) return "text-yellow-600 dark:text-yellow-400";
  if (val < 0.120 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function baaColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 0.280) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 0.200 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function evColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 92) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 89) return "text-yellow-600 dark:text-yellow-400";
  if (val < 87 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function barrelColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 10) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 6) return "text-yellow-600 dark:text-yellow-400";
  if (val < 4 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function whiffColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 30) return "text-red-500 dark:text-red-400";
  if (val >= 25) return "text-yellow-600 dark:text-yellow-400";
  if (val < 15) return "text-emerald-600 dark:text-emerald-400";
  return "";
}

function gradeBadge(grade: "strong" | "neutral" | "weak") {
  switch (grade) {
    case "strong":
      return { label: "STRONG", bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" };
    case "neutral":
      return { label: "NEUTRAL", bg: "bg-yellow-500/15", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" };
    case "weak":
      return { label: "WEAK", bg: "bg-red-500/15", text: "text-red-500 dark:text-red-400", border: "border-red-500/30" };
  }
}

// ── Zone Grids ──────────────────────────────────────────────────────────────

const ZONE_GRID_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function zoneTempBg(temp: string | null): string {
  switch (temp) {
    case "hot": return "bg-red-500/60 dark:bg-red-500/50";
    case "warm": return "bg-orange-400/40 dark:bg-orange-400/30";
    case "lukewarm": return "bg-yellow-300/25 dark:bg-yellow-300/15";
    case "cold": return "bg-blue-400/25 dark:bg-blue-400/20";
    default: return "bg-neutral-100 dark:bg-neutral-800";
  }
}

function computeHeatBg(value: number | null, allValues: (number | null)[], higherIsHotter = true): string {
  if (value == null) return "bg-neutral-100 dark:bg-neutral-800";
  const nums = allValues.filter((v): v is number => v != null);
  if (nums.length < 2) return "bg-neutral-100 dark:bg-neutral-800";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max === min) return "bg-yellow-300/25 dark:bg-yellow-300/15";
  let pct = (value - min) / (max - min);
  if (!higherIsHotter) pct = 1 - pct;
  if (pct >= 0.75) return "bg-red-500/60 dark:bg-red-500/50";
  if (pct >= 0.5) return "bg-orange-400/40 dark:bg-orange-400/30";
  if (pct >= 0.25) return "bg-yellow-300/25 dark:bg-yellow-300/15";
  return "bg-blue-400/25 dark:bg-blue-400/20";
}

function computeHeatText(value: number | null, allValues: (number | null)[], higherIsHotter = true): string {
  if (value == null) return "text-neutral-600 dark:text-neutral-400";
  const nums = allValues.filter((v): v is number => v != null);
  if (nums.length < 2) return "text-neutral-600 dark:text-neutral-400";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max === min) return "text-neutral-900 dark:text-white";
  let pct = (value - min) / (max - min);
  if (!higherIsHotter) pct = 1 - pct;
  if (pct >= 0.75) return "text-white dark:text-white";
  if (pct >= 0.5) return "text-neutral-900 dark:text-white";
  return "text-neutral-600 dark:text-neutral-400";
}

function BatterHotZoneGrid({ zones, label }: { zones: BatterZoneCell[]; label: string }) {
  const zoneMap = new Map(zones.map((z) => [z.zone, z]));
  const allContactPcts = zones.map((z) => z.contact_pct);
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 mb-1">{label}</p>
      <div className="inline-grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-700">
        {ZONE_GRID_ORDER.map((zn) => {
          const z = zoneMap.get(zn);
          const val = z?.contact_pct ?? null;
          return (
            <div key={zn} className={cn("w-14 h-11 flex flex-col items-center justify-center", computeHeatBg(val, allContactPcts))}>
              {val != null ? (
                <span className={cn("text-[10px] font-bold tabular-nums", computeHeatText(val, allContactPcts))}>
                  {Math.round(val)}%
                </span>
              ) : (
                <span className="text-[10px] text-neutral-300 dark:text-neutral-600">—</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-neutral-400 mt-0.5">Contact % by zone</p>
    </div>
  );
}

function PitcherTendencyGrid({ zones, label }: { zones: PitcherZoneCell[]; label: string }) {
  const zoneMap = new Map(zones.map((z) => [z.zone, z]));
  const allZonePcts = zones.map((z) => z.zone_pct);
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 mb-1">{label}</p>
      <div className="inline-grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-700">
        {ZONE_GRID_ORDER.map((zn) => {
          const z = zoneMap.get(zn);
          const val = z?.zone_pct ?? null;
          return (
            <div key={zn} className={cn("w-14 h-11 flex flex-col items-center justify-center", computeHeatBg(val, allZonePcts))}>
              {val != null ? (
                <span className={cn("text-[10px] font-bold tabular-nums", computeHeatText(val, allZonePcts))}>
                  {Math.round(val)}%
                </span>
              ) : (
                <span className="text-[10px] text-neutral-300 dark:text-neutral-600">—</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-neutral-400 mt-0.5">Pitch location %</p>
    </div>
  );
}

function MatchupOverlayGrid({ zones }: { zones: OverlayZoneCell[] }) {
  const zoneMap = new Map(zones.map((z) => [z.zone, z]));

  function overlayBg(z: OverlayZoneCell | undefined): string {
    if (!z) return "bg-neutral-100 dark:bg-neutral-800";
    const adv = z.advantage;
    if (adv === "batter_advantage") return "bg-emerald-500/40 dark:bg-emerald-500/30";
    if (adv === "pitcher_advantage") return "bg-red-500/35 dark:bg-red-500/25";
    if (adv === "neutral") return "bg-yellow-400/20 dark:bg-yellow-400/15";
    return zoneTempBg(z.temp);
  }

  function overlayLabel(z: OverlayZoneCell | undefined): { text: string; color: string } {
    if (!z) return { text: "—", color: "text-neutral-400" };
    const adv = z.advantage;
    if (adv === "batter_advantage") return { text: "HIT", color: "text-emerald-800 dark:text-emerald-200" };
    if (adv === "pitcher_advantage") return { text: "MISS", color: "text-red-700 dark:text-red-200" };
    if (adv === "neutral") return { text: "EVEN", color: "text-yellow-700 dark:text-yellow-300" };
    if (adv === "dead_zone") return { text: "DEAD", color: "text-neutral-400" };
    if (z.temp === "hot") return { text: "HOT", color: "text-white" };
    if (z.temp === "cold") return { text: "COLD", color: "text-blue-600 dark:text-blue-300" };
    return { text: "—", color: "text-neutral-400" };
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 mb-1">Matchup Overlay</p>
      <div className="inline-grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-700">
        {ZONE_GRID_ORDER.map((zn) => {
          const z = zoneMap.get(zn);
          const lbl = overlayLabel(z);
          return (
            <div key={zn} className={cn("w-14 h-11 flex flex-col items-center justify-center", overlayBg(z))}>
              <span className={cn("text-[9px] font-bold", lbl.color)}>{lbl.text}</span>
              {z?.pitcher_zone_pct != null && (
                <span className="text-[8px] tabular-nums text-neutral-400">{Math.round(z.pitcher_zone_pct)}%</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-neutral-400 mt-0.5">Who wins each zone</p>
    </div>
  );
}

// ── Supporting Components ────────────────────────────────────────────────────

function MiniSparkline({ values, height = 24, width = 80 }: { values: number[]; height?: number; width?: number }) {
  if (values.length < 2) return <span className="text-[10px] text-neutral-400">-</span>;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  const lastVal = values[values.length - 1];
  const firstVal = values[0];
  const trending = lastVal > firstVal;

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={trending ? "#10b981" : "#ef4444"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx={(values.length - 1) / (values.length - 1) * width}
        cy={height - ((lastVal - min) / range) * height}
        r={2.5}
        fill={trending ? "#10b981" : "#ef4444"}
      />
    </svg>
  );
}

function HRScoreBar({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color = score >= 60 ? "bg-emerald-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400";
  const textColor = score >= 60 ? "text-emerald-600 dark:text-emerald-400" : score >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-bold tabular-nums w-8 text-right", textColor)}>{score}</span>
    </div>
  );
}

function MatchQualityBadge({ slg, whiffPct, usagePct }: { slg: number | null; whiffPct: number | null; usagePct: number }) {
  if (slg != null && slg >= 0.450 && usagePct >= 20) {
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">STRONG</span>;
  }
  if ((slg != null && slg < 0.300) || (whiffPct != null && whiffPct > 30)) {
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/30">WEAK</span>;
  }
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30">NEUTRAL</span>;
}

function EVLAScatter({ events }: { events: Array<{ exit_velocity: number | null; launch_angle: number | null; result: string | null; game_date?: string | null }> }) {
  const valid = useMemo(() => events.filter((e) => e.exit_velocity != null && e.launch_angle != null && e.exit_velocity > 0), [events]);
  if (valid.length < 3) {
    return <div className="flex items-center justify-center h-48 text-xs text-neutral-400">Not enough batted ball data</div>;
  }

  const W = 360;
  const H = 280;
  const PAD = { top: 20, right: 20, bottom: 35, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const evMin = 75;
  const evMax = 115;
  const laMin = -20;
  const laMax = 50;
  const evRange = evMax - evMin;
  const laRange = laMax - laMin;

  const toX = (ev: number) => PAD.left + ((ev - evMin) / evRange) * plotW;
  const toY = (la: number) => PAD.top + ((laMax - la) / laRange) * plotH;

  // HR zone: 95+ mph EV, 20-38° LA
  const hrZoneX = toX(95);
  const hrZoneY = toY(38);
  const hrZoneW = toX(evMax) - hrZoneX;
  const hrZoneH = toY(20) - hrZoneY;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[380px]">
      {/* Grid lines */}
      {[80, 85, 90, 95, 100, 105, 110].map((ev) => (
        <line key={`ev-${ev}`} x1={toX(ev)} y1={PAD.top} x2={toX(ev)} y2={H - PAD.bottom} className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth={0.5} />
      ))}
      {[-10, 0, 10, 20, 30, 40].map((la) => (
        <line key={`la-${la}`} x1={PAD.left} y1={toY(la)} x2={W - PAD.right} y2={toY(la)} className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth={0.5} />
      ))}

      {/* HR Zone shaded */}
      <rect x={hrZoneX} y={hrZoneY} width={hrZoneW} height={hrZoneH} rx={3} className="fill-emerald-500/10 dark:fill-emerald-500/15 stroke-emerald-500/30" strokeWidth={0.5} strokeDasharray="3 2" />
      <text x={hrZoneX + hrZoneW / 2} y={hrZoneY + 12} textAnchor="middle" className="fill-emerald-600/50 dark:fill-emerald-400/50" fontSize={8} fontWeight={600}>HR ZONE</text>

      {/* Axes */}
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth={1} />

      {/* X-axis labels */}
      {[80, 90, 100, 110].map((ev) => (
        <text key={`xl-${ev}`} x={toX(ev)} y={H - PAD.bottom + 14} textAnchor="middle" className="fill-neutral-400" fontSize={9}>{ev}</text>
      ))}
      <text x={W / 2} y={H - 4} textAnchor="middle" className="fill-neutral-500" fontSize={9} fontWeight={500}>Exit Velocity (mph)</text>

      {/* Y-axis labels */}
      {[-10, 0, 10, 20, 30, 40].map((la) => (
        <text key={`yl-${la}`} x={PAD.left - 6} y={toY(la) + 3} textAnchor="end" className="fill-neutral-400" fontSize={9}>{la}°</text>
      ))}
      <text x={10} y={H / 2} textAnchor="middle" className="fill-neutral-500" fontSize={9} fontWeight={500} transform={`rotate(-90 10 ${H / 2})`}>Launch Angle</text>

      {/* Data points */}
      {valid.map((e, i) => {
        const ev = e.exit_velocity!;
        const la = e.launch_angle!;
        const isHR = (e.result ?? "").toLowerCase().includes("home_run") || (e.result ?? "").toLowerCase().includes("home run");
        const cx = toX(Math.max(evMin, Math.min(evMax, ev)));
        const cy = toY(Math.max(laMin, Math.min(laMax, la)));
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={isHR ? 5 : 3}
            className={isHR ? "fill-brand stroke-white dark:stroke-neutral-900" : "fill-neutral-400/60 dark:fill-neutral-500/60"}
            strokeWidth={isHR ? 1 : 0}
          />
        );
      })}
    </svg>
  );
}

// ── Player Search Input ──────────────────────────────────────────────────────

function PlayerSearchInput({
  label,
  type,
  selected,
  onSelect,
  onClear,
}: {
  label: string;
  type: "batter" | "pitcher";
  selected: MlbPlayerSearchResult | null;
  onSelect: (player: MlbPlayerSearchResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { players, isLoading, isFetching } = useMlbPlayerSearch({
    query,
    type,
    enabled: isOpen,
  });

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleSelect = useCallback((player: MlbPlayerSearchResult) => {
    onSelect(player);
    setQuery("");
    setIsOpen(false);
  }, [onSelect]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
        <img
          src={getMlbHeadshotUrl(selected.player_id, "tiny")}
          alt={selected.name}
          className="w-8 h-8 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">{label}</p>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{selected.name}</p>
          <p className="text-[10px] text-neutral-500">
            {selected.team_abbr || ""}
            {selected.position ? ` · ${selected.position}` : ""}
          </p>
        </div>
        <button
          onClick={onClear}
          className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4 text-neutral-400" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
        <Search className="w-4 h-4 text-neutral-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">{label}</p>
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={`Search ${type}s...`}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none"
          />
        </div>
        {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400 shrink-0" />}
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl overflow-hidden max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="py-6 text-center">
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-neutral-400" />
            </div>
          ) : players.length === 0 ? (
            <div className="py-6 text-center text-sm text-neutral-500">
              No {type}s found for &quot;{query}&quot;
            </div>
          ) : (
            players.map((player) => (
              <button
                key={player.player_id}
                onClick={() => handleSelect(player)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors border-b border-neutral-100 dark:border-neutral-700/50 last:border-b-0"
              >
                <img
                  src={getMlbHeadshotUrl(player.player_id, "tiny")}
                  alt={player.name}
                  className="w-8 h-8 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{player.name}</p>
                  <p className="text-[10px] text-neutral-500">
                    {player.team_abbr || "FA"}
                    {player.position ? ` · ${player.position}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Game Time Helpers ────────────────────────────────────────────────────────

function getETTime(dateTime: string | null): string {
  if (!dateTime) return "TBD";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// ── Game Matchup Picker ─────────────────────────────────────────────────────

function GameMatchupPicker({
  onSelectMatchup,
}: {
  onSelectMatchup: (batter: MlbPlayerSearchResult, pitcher: MlbPlayerSearchResult) => void;
}) {
  const { games, isLoading: gamesLoading } = useMlbGames();
  const [pickerGameId, setPickerGameId] = useState<number | null>(null);
  const [pickerSide, setPickerSide] = useState<"away" | "home">("away");

  // Auto-select first game
  useEffect(() => {
    if (games.length > 0 && pickerGameId == null) {
      setPickerGameId(Number(games[0].game_id));
    }
  }, [games, pickerGameId]);

  const { pitcher: matchupPitcher, batters, game: matchupGame, isLoading: matchupLoading } = useMlbGameMatchup({
    gameId: pickerGameId,
    battingSide: pickerSide,
    sample: "season",
  });

  const selectedGame = useMemo(
    () => games.find((g) => Number(g.game_id) === pickerGameId) ?? null,
    [games, pickerGameId]
  );

  const handleBatterClick = useCallback((b: BatterMatchup) => {
    if (!matchupPitcher) return;
    onSelectMatchup(
      {
        player_id: b.player_id,
        name: b.player_name,
        team_abbr: b.team_abbr ?? "",
        team_name: "",
        position: "",
      },
      {
        player_id: matchupPitcher.player_id,
        name: matchupPitcher.name,
        team_abbr: matchupPitcher.team_abbr ?? "",
        team_name: matchupPitcher.team_name ?? "",
        position: "P",
      }
    );
  }, [matchupPitcher, onSelectMatchup]);

  if (gamesLoading) {
    return (
      <div className="py-6 text-center">
        <Loader2 className="w-4 h-4 animate-spin mx-auto text-neutral-400 mb-2" />
        <p className="text-xs text-neutral-500">Loading today&apos;s games...</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-neutral-500">
        No games today — use the search fields below
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Game cards — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {games.map((g) => {
          const gid = Number(g.game_id);
          const isSelected = gid === pickerGameId;
          return (
            <button
              key={g.game_id}
              onClick={() => { setPickerGameId(gid); setPickerSide("away"); }}
              className={cn(
                "shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left",
                isSelected
                  ? "border-brand bg-brand/5 dark:bg-brand/10 shadow-sm"
                  : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600"
              )}
            >
              <div className="flex items-center gap-1.5">
                <img
                  src={`/team-logos/mlb/${g.away_team_tricode.toUpperCase()}.svg`}
                  alt={g.away_team_tricode}
                  className="w-5 h-5 object-contain"
                />
                <span className="text-[11px] font-semibold text-neutral-500">@</span>
                <img
                  src={`/team-logos/mlb/${g.home_team_tricode.toUpperCase()}.svg`}
                  alt={g.home_team_tricode}
                  className="w-5 h-5 object-contain"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                  {g.away_team_tricode} @ {g.home_team_tricode}
                </p>
                <p className="text-[10px] text-neutral-500 whitespace-nowrap">{g.game_status}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Side toggle + batter list */}
      {selectedGame && matchupGame && (
        <div className="space-y-2">
          {/* Side toggle */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 w-fit">
            <button
              onClick={() => setPickerSide("away")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                pickerSide === "away"
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              <img
                src={`/team-logos/mlb/${matchupGame.away_team.abbr.toUpperCase()}.svg`}
                className="w-4 h-4 object-contain"
                alt={matchupGame.away_team.abbr}
              />
              {matchupGame.away_team.abbr} Batting
            </button>
            <button
              onClick={() => setPickerSide("home")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                pickerSide === "home"
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              <img
                src={`/team-logos/mlb/${matchupGame.home_team.abbr.toUpperCase()}.svg`}
                className="w-4 h-4 object-contain"
                alt={matchupGame.home_team.abbr}
              />
              {matchupGame.home_team.abbr} Batting
            </button>
          </div>

          {matchupPitcher && (
            <p className="text-xs text-neutral-500">
              vs <span className="font-semibold text-neutral-900 dark:text-white">{matchupPitcher.name}</span>
              {" "}({matchupPitcher.hand === "R" ? "RHP" : "LHP"}) — click a batter to analyze
            </p>
          )}

          {/* Batter grid */}
          {matchupLoading ? (
            <div className="py-4 text-center">
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-neutral-400" />
            </div>
          ) : batters.length === 0 ? (
            <div className="py-4 text-center text-xs text-neutral-500">
              No lineup data yet — lineups post 2-4 hours before game time
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {batters.map((b) => {
                const badge = gradeBadge(b.matchup_grade);
                return (
                  <button
                    key={b.player_id}
                    onClick={() => handleBatterClick(b)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-brand/40 hover:bg-brand/5 dark:hover:bg-brand/10 transition-all text-left group"
                  >
                    <img
                      src={getMlbHeadshotUrl(b.player_id, "tiny")}
                      alt={b.player_name}
                      className="w-8 h-8 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {b.lineup_position != null && (
                          <span className="text-[10px] font-bold text-neutral-400 tabular-nums w-3">{b.lineup_position}</span>
                        )}
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{b.player_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 tabular-nums">
                        <span>{b.batting_hand}HB</span>
                        <span>{fmtAvg(b.avg)} AVG</span>
                        <span>{b.hr_count} HR</span>
                      </div>
                    </div>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0", badge.bg, badge.text, badge.border)}>
                      {badge.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function MlbIndividualMatchup() {
  const [selectedBatter, setSelectedBatter] = useState<MlbPlayerSearchResult | null>(null);
  const [selectedPitcher, setSelectedPitcher] = useState<MlbPlayerSearchResult | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [indSample, setIndSample] = useState<"season" | "30" | "15" | "7">("season");
  const [zoneMode, setZoneMode] = useState<"batter" | "pitcher" | "both">("both");
  const [expandedPitch, setExpandedPitch] = useState<string | null>(null);
  const [evWindow, setEvWindow] = useState<"15" | "30" | "season">("30");

  const isMobile = useMediaQuery("(max-width: 767px)");

  const [zonePitchType, setZonePitchType] = useState<string | undefined>(undefined);

  const handlePickerSelect = useCallback((batterResult: MlbPlayerSearchResult, pitcherResult: MlbPlayerSearchResult) => {
    setSelectedBatter(batterResult);
    setSelectedPitcher(pitcherResult);
    setShowSearch(false);
  }, []);

  const hasSelection = selectedBatter != null && selectedPitcher != null;

  const { pitcher, batter, meta, isLoading, isFetching, error } = useMlbIndividualMatchup({
    batterId: selectedBatter?.player_id ?? null,
    pitcherId: selectedPitcher?.player_id ?? null,
    sample: indSample,
  });

  const { data: hotZone, isLoading: hotZoneLoading } = useMlbHotZone(
    selectedBatter?.player_id ?? null,
    selectedPitcher?.player_id ?? null,
    selectedBatter != null && selectedPitcher != null,
    zonePitchType
  );

  const { entries: gameLogs, isLoading: logsLoading } = useMlbPlayerGameLogs({
    playerId: selectedBatter?.player_id ?? null,
    market: "batter_hits",
    limit: 15,
    enabled: selectedBatter != null && selectedPitcher != null,
  });

  const { data: sprayData, isLoading: sprayLoading } = useMlbSprayChart({
    playerId: selectedBatter?.player_id ?? null,
    gameId: undefined,
    enabled: selectedBatter != null && selectedPitcher != null,
  });

  const sprayEvents = useMemo(() => {
    if (!sprayData?.events) return [];
    const events = sprayData.events;
    if (evWindow === "season") return events;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(evWindow));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return events.filter((e) => (e.game_date ?? "") >= cutoffStr);
  }, [sprayData, evWindow]);

  const badge = batter ? gradeBadge(batter.matchup_grade) : null;

  const matchupSummary = useMemo(() => {
    if (!pitcher || !batter || pitcher.arsenal.length === 0) return null;
    let best: { pitch: string; usage: number; slg: number } | null = null;
    for (const a of pitcher.arsenal) {
      if (a.usage_pct < 15) continue;
      const split = batter.pitch_splits.find((s) => s.pitch_type === a.pitch_type);
      if (!split?.slg) continue;
      if (!best || (a.usage_pct * Math.abs(split.slg - 0.400)) > (best.usage * Math.abs(best.slg - 0.400))) {
        best = { pitch: a.pitch_name, usage: a.usage_pct, slg: split.slg };
      }
    }
    if (!best) return null;
    const pitcherLast = pitcher.name.split(" ").pop();
    const batterLast = batter.player_name.split(" ").pop();
    if (best.slg >= 0.450) {
      return `${pitcherLast} throws ${best.usage}% ${best.pitch.toLowerCase()}s and ${batterLast} slugs ${fmtAvg(best.slg)} against ${best.pitch.toLowerCase()}s. This is a key advantage for the batter.`;
    }
    if (best.slg < 0.300) {
      return `${pitcherLast} throws ${best.usage}% ${best.pitch.toLowerCase()}s and ${batterLast} struggles at ${fmtAvg(best.slg)} SLG against them. Pitcher has the edge here.`;
    }
    return `${pitcherLast}'s primary pitch is the ${best.pitch.toLowerCase()} (${best.usage}%) — ${batterLast} hits ${fmtAvg(best.slg)} SLG against it.`;
  }, [pitcher, batter]);

  const logRolling = useMemo(() => {
    if (gameLogs.length === 0) return null;
    const hits = gameLogs.reduce((s, g) => s + (g.hits ?? 0), 0);
    const abs = gameLogs.reduce((s, g) => s + (g.atBats ?? 0), 0);
    const hrs = gameLogs.reduce((s, g) => s + (g.homeRuns ?? 0), 0);
    return {
      avg: abs > 0 ? hits / abs : null,
      hr: hrs,
      games: gameLogs.length,
    };
  }, [gameLogs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-gradient-to-br from-white to-neutral-50/90 dark:from-neutral-900 dark:to-[#0a0f1c] p-4 md:p-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-neutral-500 dark:text-neutral-400">
            Batter vs Pitcher
          </p>
          <h2 className="mt-1 text-xl md:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
            Individual Matchup
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            Head-to-head analysis with zone heat maps, pitch type splits, batted ball data, and game logs.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {/* Player selection bar */}
        <div className="p-4 space-y-3 border-b border-neutral-200 dark:border-neutral-800">
          {/* Selected players or search toggle */}
          {hasSelection && !showSearch ? (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Current batter */}
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-1.5">
                <img
                  src={getMlbHeadshotUrl(selectedBatter.player_id, "tiny")}
                  alt={selectedBatter.name}
                  className="w-6 h-6 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800"
                />
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">{selectedBatter.name}</span>
                <span className="text-[10px] text-neutral-400">vs</span>
                <img
                  src={getMlbHeadshotUrl(selectedPitcher.player_id, "tiny")}
                  alt={selectedPitcher.name}
                  className="w-6 h-6 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800"
                />
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">{selectedPitcher.name}</span>
                <button
                  onClick={() => { setSelectedBatter(null); setSelectedPitcher(null); }}
                  className="ml-1 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              </div>

              {/* Sample filter */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                {SAMPLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setIndSample(opt.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                      indSample === opt.value
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {isFetching && !isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />}
            </div>
          ) : showSearch ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Manual Search</p>
                <button
                  onClick={() => setShowSearch(false)}
                  className="text-[11px] font-medium text-brand hover:underline"
                >
                  Back to games
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PlayerSearchInput
                  label="Batter"
                  type="batter"
                  selected={selectedBatter}
                  onSelect={setSelectedBatter}
                  onClear={() => setSelectedBatter(null)}
                />
                <PlayerSearchInput
                  label="Pitcher"
                  type="pitcher"
                  selected={selectedPitcher}
                  onSelect={setSelectedPitcher}
                  onClear={() => setSelectedPitcher(null)}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Game picker or analysis */}
        {!hasSelection ? (
          <div className="p-4">
            {!showSearch && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Pick from today&apos;s games</p>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
                  >
                    <Search className="w-3 h-3" />
                    Search manually
                  </button>
                </div>
                <GameMatchupPicker onSelectMatchup={handlePickerSelect} />
              </>
            )}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
            <p className="text-sm text-red-500">{error.message}</p>
          </div>
        ) : pitcher && batter ? (
          <>
            {/* ── MATCHUP HEADER ───────────────────────────────────────── */}
            <div className="px-4 py-5 sm:px-6 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-800/50 dark:to-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Batter side */}
                <div className="flex items-center gap-3">
                  <img
                    src={getMlbHeadshotUrl(batter.player_id, "small")}
                    alt={batter.player_name}
                    className="w-16 h-16 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 border-2 border-white dark:border-neutral-700 shadow-sm"
                  />
                  <div>
                    <p className="text-base font-bold text-neutral-900 dark:text-white">{batter.player_name}</p>
                    <p className="text-xs text-neutral-500">
                      {batter.batting_hand}HB · {batter.team_abbr}
                    </p>
                    <p className="text-xs tabular-nums text-neutral-600 dark:text-neutral-400 mt-0.5">
                      {fmtAvg(batter.avg)} / {batter.hr_count} HR / {fmtAvg(batter.iso)} ISO
                    </p>
                  </div>
                </div>

                {/* VS badge */}
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">vs</p>
                  {badge && (
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border mt-1 inline-block", badge.bg, badge.text, badge.border)}>
                      {badge.label}
                    </span>
                  )}
                  {batter.hr_probability_score != null && (
                    <p className="text-[10px] text-neutral-400 mt-1 tabular-nums">HR Score: <span className={cn("font-bold", batter.hr_probability_score >= 60 ? "text-emerald-600 dark:text-emerald-400" : batter.hr_probability_score >= 40 ? "text-yellow-600" : "text-red-500")}>{batter.hr_probability_score}</span></p>
                  )}
                </div>

                {/* Pitcher side */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-base font-bold text-neutral-900 dark:text-white">{pitcher.name}</p>
                    <p className="text-xs text-neutral-500">
                      {pitcher.hand === "R" ? "RHP" : "LHP"} · {pitcher.team_abbr}
                    </p>
                    <p className="text-xs tabular-nums text-neutral-600 dark:text-neutral-400 mt-0.5">
                      {fmtStat(pitcher.era)} ERA / {fmtStat(pitcher.hr_per_9)} HR/9 / {fmtStat(pitcher.whip)} WHIP
                    </p>
                  </div>
                  <img
                    src={getMlbHeadshotUrl(pitcher.player_id, "small")}
                    alt={pitcher.name}
                    className="w-16 h-16 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 border-2 border-white dark:border-neutral-700 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* ── TWO-COLUMN LAYOUT ────────────────────────────────────── */}
            <div className={cn("flex gap-0", isMobile ? "flex-col" : "flex-row")}>
              {/* ── LEFT COLUMN (55%) ── */}
              <div className={cn("p-4 space-y-4", isMobile ? "w-full" : "w-[55%] border-r border-neutral-200 dark:border-neutral-800")}>

                {/* Strike Zone Heat Map */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pitch Zone Heat Map</h4>

                  {/* Zone mode toggle */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      {(["batter", "pitcher", "both"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setZoneMode(m)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all capitalize",
                            zoneMode === m
                              ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700"
                          )}
                        >
                          {m === "both" ? "Both" : m === "batter" ? "Batter" : "Pitcher"}
                        </button>
                      ))}
                    </div>

                    {/* Pitch type pills */}
                    {hotZone && hotZone.pitchTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setZonePitchType(undefined)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                            !zonePitchType
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                          )}
                        >
                          All
                        </button>
                        {hotZone.pitchTypes.map((pt) => (
                          <button
                            key={pt.pitch_type}
                            onClick={() => setZonePitchType(pt.pitch_type === zonePitchType ? undefined : (pt.pitch_type ?? undefined))}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                              zonePitchType === pt.pitch_type
                                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                            )}
                          >
                            {pt.pitch_name ?? pt.pitch_type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Zone grids */}
                  {hotZoneLoading ? (
                    <div className="flex items-center gap-2 py-4 justify-center text-xs text-neutral-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading zones...
                    </div>
                  ) : hotZone ? (
                    <div className="flex items-start gap-4 flex-wrap justify-center">
                      {(zoneMode === "batter" || zoneMode === "both") && hotZone.batterZones.length > 0 && (
                        <BatterHotZoneGrid zones={hotZone.batterZones} label={`${batter.player_name.split(" ").pop()} — Contact Zones`} />
                      )}
                      {(zoneMode === "pitcher" || zoneMode === "both") && hotZone.pitcherZones.length > 0 && (
                        <PitcherTendencyGrid zones={hotZone.pitcherZones} label={`${pitcher.name.split(" ").pop()} — Pitch Locations`} />
                      )}
                      {zoneMode === "both" && hotZone.overlay.length > 0 && (
                        <MatchupOverlayGrid zones={hotZone.overlay} />
                      )}
                    </div>
                  ) : null}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-neutral-400 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/60" /> Hot</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-400/40" /> Warm</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-300/25 border border-yellow-400/30" /> Lukewarm</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-400/25" /> Cold</span>
                    {zoneMode === "both" && (
                      <>
                        <span className="mx-1 text-neutral-300 dark:text-neutral-600">|</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/40" /> Batter wins</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/35" /> Pitcher wins</span>
                      </>
                    )}
                  </div>

                  {/* Auto-insight */}
                  {hotZone && hotZone.overlay.length > 0 && zoneMode === "both" && (() => {
                    const batterWins = hotZone.overlay.filter((z) => z.advantage === "batter_advantage").length;
                    const pitcherWins = hotZone.overlay.filter((z) => z.advantage === "pitcher_advantage").length;
                    if (batterWins >= 4) return (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5 dark:bg-emerald-500/10 rounded px-2 py-1 border border-emerald-500/15">
                        {batter.player_name.split(" ").pop()} has the advantage in {batterWins}/9 zones — favorable zone matchup
                      </p>
                    );
                    if (pitcherWins >= 5) return (
                      <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold bg-red-500/5 dark:bg-red-500/10 rounded px-2 py-1 border border-red-500/15">
                        {pitcher.name.split(" ").pop()} controls {pitcherWins}/9 zones — tough zone matchup for the batter
                      </p>
                    );
                    return null;
                  })()}
                </div>

                {/* EV vs LA Scatter */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Batted Balls — {batter.player_name.split(" ").pop()}
                    </h4>
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      {(["15", "30", "season"] as const).map((w) => (
                        <button
                          key={w}
                          onClick={() => setEvWindow(w)}
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all",
                            evWindow === w
                              ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700"
                          )}
                        >
                          {w === "season" ? "Season" : `${w}d`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {sprayLoading ? (
                    <div className="flex items-center gap-2 py-4 justify-center text-xs text-neutral-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                    </div>
                  ) : (
                    <EVLAScatter events={sprayEvents} />
                  )}

                  {/* Legend */}
                  <div className="flex items-center gap-4 text-[9px] text-neutral-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-brand" /> HR</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-400" /> Non-HR</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/30" /> HR Zone (95+ mph, 20-38°)</span>
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN (45%) ── */}
              <div className={cn("p-4 space-y-4", isMobile ? "w-full border-t border-neutral-200 dark:border-neutral-800" : "w-[45%]")}>

                {/* Head-to-Head */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Head-to-Head: {batter.player_name.split(" ").pop()} vs {pitcher.name.split(" ").pop()}
                  </h4>
                  {batter.h2h && batter.h2h.pa > 0 ? (
                    <>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { label: "PA", value: String(batter.h2h.pa) },
                          { label: "H", value: String(batter.h2h.hits) },
                          { label: "HR", value: String(batter.h2h.hrs) },
                          { label: "AVG", value: fmtAvg(batter.h2h.avg) },
                        ].map((s) => (
                          <div key={s.label}>
                            <p className="text-[10px] text-neutral-500">{s.label}</p>
                            <p className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">{s.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-neutral-500">SLG</p>
                          <p className={cn("text-sm font-bold tabular-nums", slgColor(batter.h2h.slg))}>{fmtAvg(batter.h2h.slg)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500">K%</p>
                          <p className="text-sm font-bold tabular-nums text-neutral-900 dark:text-white">{batter.k_pct != null ? `${batter.k_pct}%` : "-"}</p>
                        </div>
                      </div>
                      {batter.h2h.pa < 15 && (
                        <div className="flex items-start gap-1.5 text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 rounded px-2.5 py-1.5 border border-yellow-500/20">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            {batter.h2h.pa < 5
                              ? `Very limited data (${batter.h2h.pa} PA) — Rely on pitch type breakdown below instead`
                              : `Small sample size (${batter.h2h.pa} PA) — Interpret with caution`
                            }
                          </span>
                        </div>
                      )}
                      {(batter.h2h.last_meetings ?? []).length > 0 && (
                        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                          <p className="text-[10px] text-neutral-400 font-medium mb-1">Last Meetings</p>
                          <div className="space-y-1">
                            {(batter.h2h.last_meetings ?? []).map((m) => (
                              <div key={m.date} className="flex items-center justify-between text-[10px] tabular-nums">
                                <span className="text-neutral-500">{m.date}</span>
                                <span className="text-neutral-700 dark:text-neutral-300">
                                  {m.hits}/{m.pa}
                                  {m.hrs > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1">{m.hrs} HR</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-neutral-400 py-2">No career matchup data. See pitch type breakdown for general tendencies.</p>
                  )}
                </div>

                {/* Pitch Type Matchup Table */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                  <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pitch Type Matchup</h4>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
                        <th className="text-left pl-4 pr-2 py-1.5 font-medium">Pitch</th>
                        <th className="px-2 py-1.5 font-medium text-right">Usage</th>
                        <th className="px-2 py-1.5 font-medium text-right">SLG vs</th>
                        <th className="px-2 py-1.5 font-medium text-right">Whiff%</th>
                        <th className="pr-4 pl-2 py-1.5 font-medium text-center">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pitcher.arsenal.map((a) => {
                        const split = batter.pitch_splits.find((s) => s.pitch_type === a.pitch_type);
                        const isExpanded = expandedPitch === a.pitch_type;
                        return (
                          <React.Fragment key={a.pitch_type}>
                            <tr
                              onClick={() => setExpandedPitch(isExpanded ? null : a.pitch_type)}
                              className={cn(
                                "border-b border-neutral-50 dark:border-neutral-800/30 cursor-pointer transition-colors",
                                isExpanded ? "bg-brand/5 dark:bg-brand/10" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                              )}
                            >
                              <td className="pl-4 pr-2 py-2">
                                <div className="flex items-center gap-1.5">
                                  <ChevronRight className={cn("w-3 h-3 text-neutral-400 transition-transform", isExpanded && "rotate-90")} />
                                  <span className="font-semibold text-neutral-900 dark:text-white">{a.pitch_name}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-neutral-500">{a.usage_pct}%</td>
                              <td className={cn("px-2 py-2 text-right tabular-nums font-semibold", slgColor(split?.slg ?? null))}>
                                {fmtAvg(split?.slg ?? null)}
                              </td>
                              <td className={cn("px-2 py-2 text-right tabular-nums", whiffColor(a.whiff_pct))}>
                                {a.whiff_pct != null ? `${a.whiff_pct}%` : "-"}
                              </td>
                              <td className="pr-4 pl-2 py-2 text-center">
                                <MatchQualityBadge slg={split?.slg ?? null} whiffPct={a.whiff_pct ?? null} usagePct={a.usage_pct} />
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={5} className="px-4 py-3 bg-brand/5 dark:bg-brand/10 border-b border-neutral-100 dark:border-neutral-800">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
                                    <div>
                                      <p className="text-neutral-500">AVG vs</p>
                                      <p className={cn("font-bold text-sm tabular-nums", baaColor(split?.avg ?? null))}>{fmtAvg(split?.avg ?? null)}</p>
                                    </div>
                                    <div>
                                      <p className="text-neutral-500">ISO</p>
                                      <p className={cn("font-bold text-sm tabular-nums", isoColor(split?.iso ?? null))}>{fmtAvg(split?.iso ?? null)}</p>
                                    </div>
                                    <div>
                                      <p className="text-neutral-500">HR</p>
                                      <p className="font-bold text-sm tabular-nums text-neutral-900 dark:text-white">{split?.hrs ?? 0}</p>
                                    </div>
                                    <div>
                                      <p className="text-neutral-500">BBs</p>
                                      <p className="font-bold text-sm tabular-nums text-neutral-900 dark:text-white">{split?.batted_balls ?? 0}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Matchup summary */}
                  {matchupSummary && (
                    <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-neutral-400 mb-1">Matchup Summary</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{matchupSummary}</p>
                    </div>
                  )}
                </div>

                {/* Recent Game Log */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                  <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Last {gameLogs.length} Games
                    </h4>
                    {logRolling && logRolling.games > 0 && (
                      <span className="text-[10px] tabular-nums text-neutral-400">
                        {logRolling.avg != null ? fmtAvg(logRolling.avg) : "-"} AVG · {logRolling.hr} HR
                      </span>
                    )}
                  </div>
                  {logsLoading ? (
                    <div className="py-6 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-neutral-400" /></div>
                  ) : gameLogs.length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-400">No recent games</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] tabular-nums">
                        <thead>
                          <tr className="text-[9px] text-neutral-400 border-b border-neutral-100 dark:border-neutral-800">
                            <th className="text-left pl-4 pr-2 py-1.5 font-medium">Date</th>
                            <th className="px-2 py-1.5 font-medium text-left">Opp</th>
                            <th className="px-2 py-1.5 font-medium text-right">PA</th>
                            <th className="px-2 py-1.5 font-medium text-right">H</th>
                            <th className="px-2 py-1.5 font-medium text-right">HR</th>
                            <th className="px-2 py-1.5 font-medium text-right">RBI</th>
                            <th className="pr-4 pl-2 py-1.5 font-medium text-right">K</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gameLogs.map((g, i) => {
                            const hasHR = (g.homeRuns ?? 0) > 0;
                            return (
                              <tr key={`${g.date}-${i}`} className={cn(
                                "border-b border-neutral-50 dark:border-neutral-800/30",
                                hasHR && "bg-emerald-500/[0.07]"
                              )}>
                                <td className="pl-4 pr-2 py-1.5 text-neutral-500">{g.date?.slice(5) ?? "-"}</td>
                                <td className="px-2 py-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
                                  {g.homeAway === "A" ? "@" : ""}{g.opponentAbbr}
                                </td>
                                <td className="px-2 py-1.5 text-right text-neutral-500">{g.plateAppearances ?? g.atBats ?? "-"}</td>
                                <td className="px-2 py-1.5 text-right text-neutral-700 dark:text-neutral-300 font-medium">{g.hits ?? 0}</td>
                                <td className={cn("px-2 py-1.5 text-right font-semibold", hasHR ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400")}>{g.homeRuns ?? 0}</td>
                                <td className="px-2 py-1.5 text-right text-neutral-600 dark:text-neutral-400">{g.rbi ?? 0}</td>
                                <td className="pr-4 pl-2 py-1.5 text-right text-neutral-500">{g.strikeOuts ?? 0}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Rolling summary */}
                  {logRolling && batter && logRolling.games > 0 && (
                    <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-[10px] text-neutral-500">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">{logRolling.games}-game:</span>
                      {" "}{logRolling.avg != null ? fmtAvg(logRolling.avg) : "-"} AVG · {logRolling.hr} HR
                      {" "}
                      <span className="text-neutral-400">(Season: {fmtAvg(batter.avg)} AVG · {batter.hr_count} HR)</span>
                    </div>
                  )}
                </div>

                {/* HR Score + Recent Form */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                    <h5 className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 mb-2">HR Score</h5>
                    <HRScoreBar score={batter.hr_probability_score} />
                    {(batter.hr_factors ?? []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {(batter.hr_factors ?? []).map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px]">
                            <span className={f.positive ? "text-emerald-500" : "text-red-400"}>
                              {f.positive ? "+" : "-"}
                            </span>
                            <span className="text-neutral-600 dark:text-neutral-400">{f.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                    <h5 className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 mb-2">Recent Form (60d)</h5>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div>
                        <p className="text-[10px] text-neutral-500">Brl%</p>
                        <p className={cn("text-sm font-bold tabular-nums", barrelColor(batter.recent_barrel_pct))}>
                          {batter.recent_barrel_pct != null ? `${batter.recent_barrel_pct}%` : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500">EV</p>
                        <p className={cn("text-sm font-bold tabular-nums", evColor(batter.recent_avg_ev))}>
                          {batter.recent_avg_ev != null ? batter.recent_avg_ev.toFixed(1) : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500">HR</p>
                        <p className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{batter.recent_hr_count}</p>
                      </div>
                    </div>
                    {(batter.recent_ev_sparkline ?? []).length >= 2 && (
                      <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                        <p className="text-[9px] text-neutral-400">EV Trend</p>
                        <MiniSparkline values={batter.recent_ev_sparkline ?? []} width={80} height={24} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
