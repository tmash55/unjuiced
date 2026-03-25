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
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { NRFIRecord, StreakBadge } from "./nrfi-record";

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
}
function getBookName(bookId: string): string {
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
}

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
        "rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 border-l-2",
        lm.accent,
        "p-4 flex flex-col gap-3",
        "transition-colors duration-150",
        "hover:border-neutral-300 dark:hover:border-neutral-700/60",
        "cursor-pointer active:scale-[0.998]"
      )}
    >
      {/* Row 1: Lean + matchup + grade */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className={cn("text-[11px] font-bold tracking-wide uppercase", lm.text)}>
            {getLeanLabel(game.lean)}
          </span>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-neutral-900 dark:text-white tracking-tight leading-snug">
            <TeamLogo abbr={game.awayTricode} size={20} />
            {game.awayTeam}
            <span className="font-normal text-neutral-400 dark:text-neutral-500 text-xs">@</span>
            <TeamLogo abbr={game.homeTricode} size={20} />
            {game.homeTeam}
          </h3>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{game.gameTime}</span>
        </div>
        <span className={cn("px-2.5 py-1 rounded-lg text-xl font-black tabular-nums leading-none shrink-0", lm.badge)}>
          {game.grade}
        </span>
      </div>

      {/* Row 2: Pitcher pairing — W-L records */}
      <div className="flex items-center rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30">
        <div className="flex-1 text-center py-2.5 px-3">
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium truncate mb-1">{game.awayPitcher.name}</p>
          <NRFIRecord record={game.awayPitcher.scorelessRecord} showPct={false} size="sm" className="justify-center" />
        </div>
        <span className="text-[10px] text-neutral-300 dark:text-neutral-600 px-1">vs</span>
        <div className="flex-1 text-center py-2.5 px-3">
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium truncate mb-1">{game.homePitcher.name}</p>
          <NRFIRecord record={game.homePitcher.scorelessRecord} showPct={false} size="sm" className="justify-center" />
        </div>
      </div>

      {/* Row 3: Tags — compact */}
      {game.reasonTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {game.reasonTags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 whitespace-nowrap"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: Odds + expand cue */}
      {(() => {
        const primaryOdds = lm.isNrfi || lm.color === "yellow" ? game.bestNrfiOdds : game.bestYrfiOdds;
        const altOdds = lm.isNrfi || lm.color === "yellow" ? game.bestYrfiOdds : game.bestNrfiOdds;
        const primarySide = lm.isNrfi ? "NRFI" : lm.isYrfi ? "YRFI" : "NRFI";
        // Find the book with the best odds for the primary side
        const bestBook = game.sportsbooks.length > 0
          ? game.sportsbooks.reduce((best, b) => {
              const price = primarySide === "NRFI" ? b.nrfiOdds : b.yrfiOdds;
              const bestPrice = primarySide === "NRFI" ? best.nrfiOdds : best.yrfiOdds;
              if (price === "-") return best;
              if (bestPrice === "-") return b;
              return parseFloat(price) > parseFloat(bestPrice) ? b : best;
            })
          : null;
        const bestLogo = bestBook ? getBookLogo(bestBook.name) : null;

        return (
          <div className="flex items-center justify-between pt-2 border-t border-neutral-200/40 dark:border-neutral-700/20">
            <div className="flex items-center gap-2.5">
              {bestLogo && <img src={bestLogo} alt={bestBook?.name ?? ""} className="h-4 w-auto shrink-0 opacity-70" />}
              <span className={cn("text-lg font-black tabular-nums leading-none", lm.text)}>
                {primaryOdds}
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider font-medium">
                {primarySide}
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-600 tabular-nums">
                {altOdds}
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
          </div>
        );
      })()}
    </button>
  );
}

// ─── Expanded Card ──────────────────────────────────────────────────────────────

function ExpandedCard({ game, onCollapse, lm }: { game: GameCardType; onCollapse: () => void; lm: LeanMeta }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 border-l-2",
        lm.accent
      )}
    >
      {/* ── Header ── */}
      <button
        onClick={onCollapse}
        className="w-full text-left px-5 pt-4 pb-3 flex items-start justify-between gap-3 cursor-pointer group"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className={cn("text-[11px] font-bold tracking-wide uppercase", lm.text)}>
            {getLeanLabel(game.lean)}
          </span>
          <h3 className="flex items-center gap-1.5 text-base font-bold text-neutral-900 dark:text-white tracking-tight leading-snug">
            <TeamLogo abbr={game.awayTricode} size={22} />
            {game.awayTeam}
            <span className="font-normal text-neutral-400 dark:text-neutral-500 text-xs">@</span>
            <TeamLogo abbr={game.homeTricode} size={22} />
            {game.homeTeam}
          </h3>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{game.gameTime}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("px-2.5 py-1 rounded-lg text-xl font-black tabular-nums leading-none", lm.badge)}>
            {game.grade}
          </span>
          <ChevronUp className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
        </div>
      </button>

      {/* ── Grade rationale strip ── */}
      <div className={cn("mx-5 mb-4 rounded-lg border p-4", lm.bg)}>
        <div className="grid grid-cols-[1fr_auto] gap-5 items-center">
          <p className="text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed">{game.gradeExplanation}</p>
          <div className="flex flex-col gap-1.5 min-w-[220px]">
            <ScoreMeter label="Pitching" value={game.componentScores.pitching} barColor={lm.bar} />
            <ScoreMeter label="Offense" value={game.componentScores.offense} barColor={lm.bar} />
            <ScoreMeter label="Environment" value={game.componentScores.environment} barColor={lm.bar} />
            <ScoreMeter label="Price" value={game.componentScores.price} barColor={lm.bar} />
          </div>
        </div>
      </div>

      {/* ── Main 3-column body ── */}
      <div className="px-5 pb-5 grid grid-cols-3 gap-4">

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
                  <div className="grid grid-cols-2 gap-px bg-neutral-200/50 dark:bg-neutral-700/30">
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
                <div className="px-3 py-2 border-t border-neutral-200/50 dark:border-neutral-700/30 flex items-center gap-2">
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
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                {game.parkFactor}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
                  game.lineupStatus === "Confirmed"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400"
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
            {lm.isNrfi || lm.isYrfi ? (
              <div className="grid grid-cols-2 divide-x divide-neutral-200/50 dark:divide-neutral-700/30 border-b border-neutral-200/50 dark:border-neutral-700/30">
                <div
                  className={cn(
                    "px-5 py-4 flex flex-col gap-1",
                    lm.isNrfi ? "bg-emerald-500/5 dark:bg-emerald-500/10" : "bg-red-500/5 dark:bg-red-500/10"
                  )}
                >
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                    Recommended
                  </span>
                  <span className={cn("text-xs font-bold mt-0.5", lm.text)}>
                    {lm.isNrfi ? "NRFI" : "YRFI"}
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
            ) : (
              /* Neutral — show both sides equally, no recommendation */
              <div className="grid grid-cols-2 divide-x divide-neutral-200/50 dark:divide-neutral-700/30 border-b border-neutral-200/50 dark:border-neutral-700/30">
                <div className="px-5 py-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                    NRFI
                  </span>
                  <span className="text-3xl font-black tabular-nums leading-none mt-1 text-emerald-500">
                    {game.bestNrfiOdds}
                  </span>
                </div>
                <div className="px-5 py-4 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                    YRFI
                  </span>
                  <span className="text-3xl font-black tabular-nums leading-none mt-1 text-red-400">
                    {game.bestYrfiOdds}
                  </span>
                </div>
              </div>
            )}

            {/* Sportsbook rows */}
            {game.sportsbooks.length > 0 && (
              <div className="flex flex-col px-2 pt-2 pb-1.5 flex-1">
                {/* Column header */}
                <div className="flex items-center px-3 pb-1.5 mb-1 border-b border-neutral-200/40 dark:border-neutral-700/20">
                  <span className="text-[9px] text-neutral-400 uppercase tracking-widest font-semibold flex-1">Book</span>
                  <span className="text-[9px] text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-widest font-semibold w-14 text-right">NRFI</span>
                  <span className="text-[9px] text-red-500/60 dark:text-red-400/60 uppercase tracking-widest font-semibold w-14 text-right">YRFI</span>
                  <span className="w-14" />
                </div>
                {game.sportsbooks.map((book) => {
                  const logo = getBookLogo(book.name);
                  return (
                  <a
                    key={book.name}
                    href={book.link || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center py-2 px-3 rounded-lg hover:bg-neutral-100/80 dark:hover:bg-neutral-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {logo ? (
                        <img src={logo} alt={book.name} className="h-4 w-auto shrink-0" />
                      ) : null}
                      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 truncate">
                        {getBookName(book.name)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums w-14 text-right shrink-0">
                      {book.nrfiOdds}
                    </span>
                    <span className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums w-14 text-right shrink-0">
                      {book.yrfiOdds}
                    </span>
                  </a>
                  );
                })}
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
