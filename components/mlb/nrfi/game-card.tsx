"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type {
  GameCard as GameCardType,
  Pitcher,
  TeamOffense,
  RecentStart,
} from "@/lib/nrfi-data";
import { getLeanLabel, getLeanClasses } from "@/lib/nrfi-data";
import { NRFIRecord, StreakBadge } from "./nrfi-record";

function TeamLogo({ abbr, size = 20 }: { abbr: string; size?: number }) {
  return (
    <Image
      src={`/team-logos/mlb/${abbr.toUpperCase()}.svg`}
      alt={abbr}
      width={size}
      height={size}
      className="object-contain shrink-0"
    />
  );
}

type LeanMeta = ReturnType<typeof getLeanClasses>;
import {
  ChevronUp,
  ChevronRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Thermometer,
  Wind,
  Droplets,
  CloudRain,
} from "lucide-react";

// ─── Score meter ────────────────────────────────────────────────────────────────

function ScoreMeter({ label, value, barColor }: { label: string; value: number; barColor: string }) {

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-visible relative">
        <div
          className={cn("h-[3px] rounded-full transition-all duration-500 -mt-px", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 w-6 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

// ─── Pitcher helpers ────────────────────────────────────────────────────────────

function PitcherStatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium tracking-wide">{label}</span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          highlight ? "text-amber-600 dark:text-amber-400" : "text-neutral-900 dark:text-white"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RecentStartBadge({ start }: { start: RecentStart }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 rounded-lg w-full",
        start.scoreless
          ? "bg-emerald-500/10 dark:bg-emerald-500/15"
          : "bg-red-500/10 dark:bg-red-500/15"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "font-black shrink-0 text-xs",
            start.scoreless ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
          )}
        >
          {start.scoreless ? "✓" : "✗"}
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{start.isHome ? "vs" : "@"}</span>
        <TeamLogo abbr={start.opponent} size={14} />
        <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{start.opponent}</span>
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums text-xs font-semibold",
          start.scoreless ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        )}
      >
        {start.detail}
      </span>
    </div>
  );
}

function PitcherColumn({ pitcher }: { pitcher: Pitcher }) {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Hero scoreless record — F8 W-L first */}
      <div className="text-center py-4 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30">
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium mb-2 truncate tracking-wide uppercase">
          {pitcher.name}
          <span className="text-neutral-300 dark:text-neutral-600 ml-1.5 normal-case">{pitcher.team}</span>
        </p>
        <NRFIRecord record={pitcher.scorelessRecord} pct={pitcher.scorelessPct} size="lg" className="justify-center" />
        {/* Streak badge */}
        {pitcher.recentStarts.length > 0 && (
          <div className="mt-2 flex justify-center">
            <StreakBadge recentStarts={pitcher.recentStarts} />
          </div>
        )}
      </div>
      {/* Stat rows */}
      <div className="px-1">
        <PitcherStatRow label="K%" value={pitcher.k_pct} />
        <PitcherStatRow
          label="BB%"
          value={pitcher.bb_pct}
          highlight={parseFloat(pitcher.bb_pct) > 9}
        />
        <PitcherStatRow label="WHIP" value={pitcher.whip} />
      </div>
      {/* Last 3 starts */}
      {pitcher.recentStarts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-semibold px-1">
            Last {pitcher.recentStarts.length} Starts
          </span>
          {pitcher.recentStarts.map((s, i) => (
            <RecentStartBadge key={i} start={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Offense helpers ────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-neutral-400" />;
}

function PressureBadge({ pressure }: { pressure: "Low" | "Medium" | "High" }) {
  const cls =
    pressure === "Low"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
      : pressure === "High"
      ? "bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/25"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-semibold border shrink-0", cls)}>
      {pressure}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank <= 10
      ? "bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/25"
      : rank <= 20
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-semibold border shrink-0 tabular-nums", cls)}>
      #{rank}
    </span>
  );
}

function OffenseColumn({ offense }: { offense: TeamOffense }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-neutral-900 dark:text-white">{offense.team}</span>
        <PressureBadge pressure={offense.pressure} />
        {offense.offenseRank != null && <RankBadge rank={offense.offenseRank} />}
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">1st-inn score</span>
          <span className="text-xs font-bold text-neutral-900 dark:text-white tabular-nums">{offense.scoringPct}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">OPS</span>
          <span className="text-xs font-bold text-neutral-900 dark:text-white tabular-nums">{offense.ops}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">H/A split</span>
          <span className="text-xs font-medium text-neutral-900 dark:text-white tabular-nums whitespace-nowrap">
            {offense.homePct} / {offense.awayPct}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">L30 trend</span>
          <TrendIcon trend={offense.l30Trend} />
        </div>
      </div>
    </div>
  );
}

// ─── Collapsed Card ─────────────────────────────────────────────────────────────

function CollapsedCard({ game, onExpand, lm }: { game: GameCardType; onExpand: () => void; lm: LeanMeta }) {

  return (
    <button
      onClick={onExpand}
      className={cn(
        "w-full text-left group",
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 border-l-2",
        lm.accent,
        "p-5 flex flex-col gap-4",
        "transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30 hover:border-neutral-300 dark:hover:border-neutral-700",
        "cursor-pointer"
      )}
    >
      {/* Row 1: Lean + matchup + grade */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className={cn("text-sm font-black tracking-tight leading-none", lm.text)}>
            {getLeanLabel(game.lean)}
          </span>
          <h3 className="flex items-center gap-1.5 text-base font-bold text-neutral-900 dark:text-white tracking-tight leading-snug">
            <TeamLogo abbr={game.awayTricode} size={22} />
            {game.awayTeam}
            <span className="font-normal text-neutral-400 dark:text-neutral-500">@</span>
            <TeamLogo abbr={game.homeTricode} size={22} />
            {game.homeTeam}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{game.gameTime}</span>
          </div>
        </div>
        <span className={cn("px-3 py-1.5 rounded-lg text-2xl font-black tabular-nums leading-none shrink-0", lm.badge)}>
          {game.grade}
        </span>
      </div>

      {/* Row 2: Pitcher pairing — W-L format */}
      <div className="flex items-stretch rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30">
        <div className="flex-1 flex flex-col items-center gap-1 px-3 py-2.5">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium truncate">{game.awayPitcher.name}</span>
          <NRFIRecord record={game.awayPitcher.scorelessRecord} showPct={false} size="md" className="justify-center" />
          <StreakBadge recentStarts={game.awayPitcher.recentStarts} />
        </div>
        <div className="flex flex-col items-center justify-center px-2 border-x border-neutral-200/50 dark:border-neutral-700/30">
          <span className="text-[10px] text-neutral-400 font-medium">vs</span>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 px-3 py-2.5">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium truncate">{game.homePitcher.name}</span>
          <NRFIRecord record={game.homePitcher.scorelessRecord} showPct={false} size="md" className="justify-center" />
          <StreakBadge recentStarts={game.homePitcher.recentStarts} />
        </div>
      </div>

      {/* Row 3: Tags */}
      {game.reasonTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {game.reasonTags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 tracking-tight whitespace-nowrap"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: Odds + expand cue */}
      <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 pt-3">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
              {lm.isNrfi ? "Rec. NRFI" : lm.isYrfi ? "Rec. YRFI" : "NRFI"}
            </span>
            <span
              className={cn(
                "text-xl font-black tabular-nums leading-none",
                lm.text
              )}
            >
              {lm.isNrfi || lm.color === "yellow" ? game.bestNrfiOdds : game.bestYrfiOdds}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 opacity-40">
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest">
              {lm.isNrfi ? "YRFI" : "NRFI"}
            </span>
            <span className="text-sm font-semibold tabular-nums text-neutral-500">
              {lm.isNrfi || lm.color === "yellow" ? game.bestYrfiOdds : game.bestNrfiOdds}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
          <span className="text-xs font-medium tracking-wide">Details</span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

// ─── Expanded Card ──────────────────────────────────────────────────────────────

function ExpandedCard({ game, onCollapse, lm }: { game: GameCardType; onCollapse: () => void; lm: LeanMeta }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 border-l-2 shadow-xl shadow-black/5 dark:shadow-black/30",
        lm.accent
      )}
    >
      {/* ── Header ── */}
      <button
        onClick={onCollapse}
        className="w-full text-left px-6 pt-5 pb-4 flex items-start justify-between gap-3 cursor-pointer group"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className={cn("text-sm font-black tracking-tight leading-none", lm.text)}>
            {getLeanLabel(game.lean)}
          </span>
          <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900 dark:text-white tracking-tight leading-snug">
            <TeamLogo abbr={game.awayTricode} size={24} />
            {game.awayTeam}
            <span className="font-normal text-neutral-400 dark:text-neutral-500">@</span>
            <TeamLogo abbr={game.homeTricode} size={24} />
            {game.homeTeam}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{game.gameTime}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("px-3 py-1.5 rounded-lg text-2xl font-black tabular-nums leading-none", lm.badge)}>
            {game.grade}
          </span>
          <div className="flex items-center gap-1 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
            <span className="text-xs font-medium">Collapse</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </div>
        </div>
      </button>

      {/* ── Grade rationale strip ── */}
      <div className={cn("mx-6 mb-5 rounded-xl border", lm.bg)}>
        <div className="px-5 py-3 grid grid-cols-[1fr_auto] gap-6 items-center">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{game.gradeExplanation}</p>
          <div className="flex flex-col gap-1.5 min-w-[240px]">
            <ScoreMeter label="Pitching" value={game.componentScores.pitching} barColor={lm.bar} />
            <ScoreMeter label="Offense" value={game.componentScores.offense} barColor={lm.bar} />
            <ScoreMeter label="Environment" value={game.componentScores.environment} barColor={lm.bar} />
            <ScoreMeter label="Price" value={game.componentScores.price} barColor={lm.bar} />
          </div>
        </div>
      </div>

      {/* ── Main 3-column body ── */}
      <div className="px-6 pb-6 grid grid-cols-3 gap-5">

        {/* ── COL 1: Starting Pitchers ── */}
        <div className="flex flex-col gap-3">
          <h4 className="text-[11px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-semibold">
            Starting Pitchers
          </h4>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 overflow-hidden h-full">
            <div className="grid grid-cols-2 divide-x divide-neutral-200/50 dark:divide-neutral-700/30 h-full">
              <div className="p-5">
                <PitcherColumn pitcher={game.awayPitcher} />
              </div>
              <div className="p-5">
                <PitcherColumn pitcher={game.homePitcher} />
              </div>
            </div>
          </div>
        </div>

        {/* ── COL 2: 1st-Inning Offense + Conditions ── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <h4 className="text-[11px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-semibold">
              1st-Inning Offense
            </h4>
            <div className="grid grid-cols-2 divide-x divide-neutral-200/50 dark:divide-neutral-700/30 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 overflow-hidden">
              <div className="p-5 pb-6">
                <OffenseColumn offense={game.awayOffense} />
              </div>
              <div className="p-5 pb-6">
                <OffenseColumn offense={game.homeOffense} />
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div className="flex flex-col gap-2">
            <h4 className="text-[11px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-semibold">
              Conditions
            </h4>
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 overflow-hidden">
              {game.weather ? (
                game.weather.roofType === "dome" ? (
                  <div className="px-4 py-3 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">Dome</span>
                    <span>— no weather impact</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-700">
                    {game.weather.temperatureF != null && (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/80">
                        <Thermometer className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">Temp</span>
                          <span className={cn(
                            "text-xs font-bold tabular-nums",
                            game.weather.temperatureF >= 90 ? "text-red-500 dark:text-red-400"
                            : game.weather.temperatureF <= 50 ? "text-blue-500 dark:text-blue-400"
                            : "text-neutral-900 dark:text-white"
                          )}>
                            {Math.round(game.weather.temperatureF)}°F
                          </span>
                        </div>
                      </div>
                    )}
                    {game.weather.windSpeedMph != null && (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/80">
                        <Wind className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">Wind</span>
                          <span className={cn(
                            "text-xs font-bold tabular-nums",
                            game.weather.windImpact === "favorable" ? "text-red-500 dark:text-red-400"
                            : game.weather.windImpact === "unfavorable" ? "text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-900 dark:text-white"
                          )}>
                            {Math.round(game.weather.windSpeedMph)}mph
                          </span>
                        </div>
                      </div>
                    )}
                    {game.weather.humidityPct != null && (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/80">
                        <Droplets className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">Humidity</span>
                          <span className="text-xs font-bold tabular-nums text-neutral-900 dark:text-white">
                            {Math.round(game.weather.humidityPct)}%
                          </span>
                        </div>
                      </div>
                    )}
                    {game.weather.precipProbability != null && game.weather.precipProbability > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/80">
                        <CloudRain className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">Rain</span>
                          <span className={cn(
                            "text-xs font-bold tabular-nums",
                            game.weather.precipProbability >= 40 ? "text-amber-600 dark:text-amber-400" : "text-neutral-900 dark:text-white"
                          )}>
                            {Math.round(game.weather.precipProbability)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="px-4 py-3 text-xs text-neutral-400">No weather data</div>
              )}
              {/* Wind direction label */}
              {game.weather && game.weather.roofType !== "dome" && game.weather.windLabel && game.weather.windSpeedMph != null && game.weather.windSpeedMph >= 5 && (
                <div className="px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-2">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">Direction</span>
                  <span className={cn(
                    "text-[11px] font-semibold",
                    game.weather.windImpact === "favorable" ? "text-red-500 dark:text-red-400"
                    : game.weather.windImpact === "unfavorable" ? "text-emerald-600 dark:text-emerald-400"
                    : "text-neutral-600 dark:text-neutral-400"
                  )}>
                    {game.weather.windLabel}
                  </span>
                </div>
              )}
            </div>
            {/* Park factor + status badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 whitespace-nowrap">
                {game.parkFactor}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap",
                  game.lineupStatus === "Confirmed"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700"
                )}
              >
                {game.lineupStatus} lineups
              </span>
            </div>
          </div>
        </div>

        {/* ── COL 3: Best Available Odds ── */}
        <div className="flex flex-col gap-3">
          <h4 className="text-[11px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-semibold">
            Best Available Odds
          </h4>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 overflow-hidden h-full flex flex-col">

            {/* Rec / Alt hero */}
            <div className="grid grid-cols-2 divide-x divide-neutral-200/50 dark:divide-neutral-700/30 border-b border-neutral-200/50 dark:border-neutral-700/30">
              <div
                className={cn(
                  "px-5 py-4 flex flex-col gap-1",
                  lm.isNrfi
                    ? "bg-emerald-500/5 dark:bg-emerald-500/10"
                    : lm.isYrfi
                    ? "bg-red-500/5 dark:bg-red-500/10"
                    : "bg-amber-500/5 dark:bg-amber-500/10"
                )}
              >
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                  Recommended
                </span>
                <span className={cn("text-xs font-bold mt-0.5", lm.text)}>
                  {lm.isNrfi ? "NRFI" : lm.isYrfi ? "YRFI" : "NRFI"}
                </span>
                <span className={cn("text-3xl font-black tabular-nums leading-none mt-0.5", lm.text)}>
                  {lm.isNrfi ? game.bestNrfiOdds : game.bestYrfiOdds}
                </span>
              </div>
              <div className="px-5 py-4 flex flex-col gap-1 opacity-40">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                  Alt side
                </span>
                <span className="text-xs text-neutral-500 mt-0.5">
                  {lm.isNrfi ? "YRFI" : "NRFI"}
                </span>
                <span className="text-3xl font-black tabular-nums leading-none mt-0.5 text-neutral-500">
                  {lm.isNrfi ? game.bestYrfiOdds : game.bestNrfiOdds}
                </span>
              </div>
            </div>

            {/* Sportsbook rows */}
            {game.sportsbooks.length > 0 && (
              <div className="flex flex-col px-2 pt-3 pb-2 flex-1 border-t border-neutral-100 dark:border-neutral-800">
                {/* Column header */}
                <div className="flex items-center px-3 pb-2 mb-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold flex-1">Book</span>
                  <span className="text-[10px] text-emerald-600/50 dark:text-emerald-400/50 uppercase tracking-widest font-semibold w-16 text-right">NRFI</span>
                  <span className="text-[10px] text-red-500/50 dark:text-red-400/50 uppercase tracking-widest font-semibold w-16 text-right">YRFI</span>
                  <span className="w-16" />
                </div>
                {game.sportsbooks.map((book) => (
                  <div
                    key={book.name}
                    className="flex items-center py-2.5 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 flex-1 min-w-0 truncate">
                      {book.name}
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums w-16 text-right shrink-0">
                      {book.nrfiOdds}
                    </span>
                    <span className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums w-16 text-right shrink-0">
                      {book.yrfiOdds}
                    </span>
                    <div className="w-16 flex justify-end shrink-0">
                      <a
                        href={book.link}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-brand text-white hover:bg-brand/90 transition-opacity"
                      >
                        Bet <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────

export function GameCard({
  game,
  isExpanded,
  onExpand,
  onCollapse,
  className,
}: {
  game: GameCardType;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  className?: string;
}) {
  const lm = getLeanClasses(game.lean);
  return (
    <div className={className}>
      {isExpanded ? (
        <ExpandedCard game={game} onCollapse={onCollapse} lm={lm} />
      ) : (
        <CollapsedCard game={game} onExpand={onExpand} lm={lm} />
      )}
    </div>
  );
}
