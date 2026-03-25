"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Zap, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MlbWeatherReportRow, HourlyForecastEntry } from "@/hooks/use-mlb-weather-report";
import { useMlbHRSheet } from "@/hooks/use-mlb-hr-sheet";
import type { HRSheetPlayer } from "@/app/api/mlb/hr-power-sheet/route";
import { EnvGauge } from "./env-gauge";
import { WindCompass } from "./wind-compass";
import { LivingStadiumCard } from "./living-stadium-card";
import {
  computeEnvScore,
  getFactorScores,
  getScoreTier,
  getScoreBadgeColor,
  getFactorBarColor,
  getWhyItLeansTags,
} from "./env-score";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETTime(dateTime: string | null): string {
  if (!dateTime) return "-";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatImpactLabel(value: string | null): string {
  if (!value) return "Neutral";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSigned(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(digits)}`;
}

function formatLongDate(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function impactPillClass(totalImpact: string | null): string {
  if (!totalImpact) return "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300";
  if (totalImpact.includes("strong_over") || totalImpact.includes("lean_over")) {
    return "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700/50 dark:text-emerald-300 dark:bg-emerald-950/40";
  }
  if (totalImpact.includes("strong_under") || totalImpact.includes("lean_under")) {
    return "border-red-300 text-red-700 bg-red-50 dark:border-red-700/50 dark:text-red-300 dark:bg-red-950/40";
  }
  return "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300";
}

function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return "text-neutral-500 dark:text-neutral-400";
  if (score >= 2) return "text-emerald-600 dark:text-emerald-300";
  if (score <= -2) return "text-red-600 dark:text-red-300";
  return "text-amber-600 dark:text-amber-300";
}

// ── Component ───────────────────────────────────────────────────────────────

interface HREnvironmentDetailProps {
  row: MlbWeatherReportRow;
  date: string;
}

export function HREnvironmentDetail({ row, date }: HREnvironmentDetailProps) {
  const [showBatters, setShowBatters] = useState(false);
  const envScore = useMemo(() => computeEnvScore(row), [row]);
  const factors = useMemo(() => getFactorScores(row), [row]);
  const tier = getScoreTier(envScore);
  const leanTags = useMemo(() => getWhyItLeansTags(row), [row]);

  const awayAbbr = row.awayTeamAbbr || "Away";
  const homeAbbr = row.homeTeamAbbr || "Home";
  const awayColor = row.awayTeamPrimaryColor ?? "#1e3a5f";
  const homeColor = row.homeTeamPrimaryColor ?? "#1e3a5f";
  const gameTime = getETTime(row.gameDatetime);

  // Batter scores
  const { players: allPlayers, isLoading: battersLoading } = useMlbHRSheet({
    date,
    enabled: showBatters,
    limit: 200,
  });

  const gamePlayers = useMemo(() => {
    if (!showBatters || !allPlayers.length) return [];
    const teamAbbrs = [row.homeTeamAbbr?.toUpperCase(), row.awayTeamAbbr?.toUpperCase()].filter(Boolean);
    return allPlayers
      .filter((p: HRSheetPlayer) => teamAbbrs.includes(p.team_abbr?.toUpperCase()))
      .sort((a: HRSheetPlayer, b: HRSheetPlayer) => b.hr_score - a.hr_score);
  }, [showBatters, allPlayers, row.homeTeamAbbr, row.awayTeamAbbr]);

  // Compute batter-adjusted env score accounting for handedness, pull tendency,
  // power profile, and park/wind interaction
  function batterAdjScore(player: HRSheetPlayer): number {
    const hand = player.batting_hand?.toUpperCase();
    let adjustment = 0;

    // 1. Park factor vs handedness (biggest factor)
    const parkHrVsHand = hand === "L"
      ? row.ballparkFactors?.hr?.vsLhb
      : hand === "R"
        ? row.ballparkFactors?.hr?.vsRhb
        : row.ballparkFactors?.hr?.overall;
    if (parkHrVsHand != null) {
      adjustment += (parkHrVsHand - 100) * 0.2;
    }

    // 2. Wind direction relative to pull/oppo side
    const windLabel = (row.windLabel ?? "").toLowerCase();
    const windSpeed = row.windSpeedMph ?? 0;
    const pullPct = player.pull_pct ?? 40;
    const oppoPct = player.oppo_pct ?? 20;
    const pullBonus = Math.max(0, (pullPct - 35) / 15); // 0-1 scale, higher pull = more impact
    const oppoBonus = Math.max(0, (oppoPct - 20) / 15); // 0-1 scale, higher oppo = more oppo power

    if (windSpeed > 3) {
      // LHB pull to RF / oppo to LF, RHB pull to LF / oppo to RF
      const pullsToRf = hand === "L" || hand === "S";
      const pullsToLf = hand === "R";
      const windToRf = windLabel.includes("out") && (windLabel.includes("rf") || windLabel.includes("right"));
      const windToLf = windLabel.includes("out") && (windLabel.includes("lf") || windLabel.includes("left"));
      const windOut = windLabel.includes("out");
      const windIn = windLabel.includes("in");

      if ((pullsToRf && windToRf) || (pullsToLf && windToLf)) {
        // Wind blowing out toward pull side — big boost, amplified by pull%
        adjustment += windSpeed * 0.25 * (1 + pullBonus * 0.5);
      } else if ((pullsToRf && windToLf) || (pullsToLf && windToRf)) {
        // Wind blowing toward oppo side — benefit oppo-power hitters
        adjustment += windSpeed * 0.12 * oppoBonus;
      } else if (windOut) {
        // Generic out wind — moderate boost
        adjustment += windSpeed * 0.12;
      } else if (windIn) {
        // Wind blowing in — penalty, worse for fly ball hitters
        const fbPct = player.fly_ball_pct ?? 35;
        adjustment -= windSpeed * 0.1 * (fbPct / 35);
      }
    }

    // 3. Pull/Oppo tendency vs fence dimensions
    const lfDist = row.fieldDistances?.leftLine ?? 330;
    const rfDist = row.fieldDistances?.rightLine ?? 330;
    const lfWall = row.wallHeights?.lf ?? 8;
    const rfWall = row.wallHeights?.rf ?? 8;

    if (hand === "R" || hand === "S") {
      // RHB pulls to LF, oppo to RF
      const lfFriendly = (330 - lfDist) * 0.15 + (8 - lfWall) * 0.2;
      const rfFriendly = (330 - rfDist) * 0.15 + (8 - rfWall) * 0.2;
      adjustment += lfFriendly * pullBonus + rfFriendly * oppoBonus * 0.5;
    } else if (hand === "L") {
      // LHB pulls to RF, oppo to LF
      const rfFriendly = (330 - rfDist) * 0.15 + (8 - rfWall) * 0.2;
      const lfFriendly = (330 - lfDist) * 0.15 + (8 - lfWall) * 0.2;
      adjustment += rfFriendly * pullBonus + lfFriendly * oppoBonus * 0.5;
    }

    // 4. Power profile boost — high barrel% batters benefit more from favorable conditions
    if (player.barrel_pct > 10) {
      adjustment += (player.barrel_pct - 10) * 0.3;
    }

    return Math.round(Math.min(100, Math.max(0, envScore + adjustment)));
  }

  // Wall data for park detail
  const wallData = [
    { label: "LF", distance: row.fieldDistances?.leftLine, height: row.wallHeights?.lf },
    { label: "LCF", distance: row.fieldDistances?.leftCenter, height: row.wallHeights?.lcf },
    { label: "CF", distance: row.fieldDistances?.centerField, height: row.wallHeights?.cf },
    { label: "RCF", distance: row.fieldDistances?.rightCenter, height: row.wallHeights?.rcf },
    { label: "RF", distance: row.fieldDistances?.rightLine, height: row.wallHeights?.rf },
  ];

  const hrFactor = row.ballparkFactors?.hr?.overall;

  return (
    <div className="space-y-3 p-3 lg:p-4">
      {/* Section 1: Game Header + Gauge */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-4">
        <div className="flex items-start gap-4">
          {/* Gauge */}
          <div className="shrink-0">
            <EnvGauge score={envScore} size={140} />
          </div>

          {/* Game info + edge signal */}
          <div className="flex-1 min-w-0">
            {/* Matchup */}
            <div className="flex items-center gap-2 mb-1">
              {row.awayTeamAbbr && (
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${awayColor}22`, border: `1px solid ${awayColor}44` }}
                >
                  <img
                    src={`/team-logos/mlb/${row.awayTeamAbbr.toUpperCase()}.svg`}
                    alt={awayAbbr}
                    className="h-4 w-4 object-contain"
                  />
                </div>
              )}
              <span className="font-bold text-neutral-900 dark:text-white text-sm">{awayAbbr}</span>
              <span className="text-neutral-400 dark:text-neutral-500 text-xs">@</span>
              {row.homeTeamAbbr && (
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${homeColor}22`, border: `1px solid ${homeColor}44` }}
                >
                  <img
                    src={`/team-logos/mlb/${row.homeTeamAbbr.toUpperCase()}.svg`}
                    alt={homeAbbr}
                    className="h-4 w-4 object-contain"
                  />
                </div>
              )}
              <span className="font-bold text-neutral-900 dark:text-white text-sm">{homeAbbr}</span>
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              {row.venueName ?? "Unknown Venue"} — {gameTime} — {formatLongDate(date)}
            </p>

            {/* Edge + HR Delta inline */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", impactPillClass(row.totalImpact))}>
                {formatImpactLabel(row.totalImpact)}
              </span>
              <span className={cn("text-sm font-bold tabular-nums", scoreColor(row.hrImpactScore))}>
                HR {formatSigned(row.hrImpactScore, 1)}
              </span>
            </div>

            {/* One-line summary */}
            <p className="mt-2 text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {envScore >= 70
                ? "High-impact HR environment. Weather and park factors significantly favor the long ball."
                : envScore >= 50
                  ? "Moderate HR environment. Conditions are near-neutral with some favorable factors."
                  : "Below-average HR environment. Multiple factors suppress home run potential."}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Factor Breakdown + Wind Compass side by side */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-4">
        <div className="flex gap-4 lg:gap-6">
          {/* Factor bars */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-3">
              Factor Breakdown
            </p>
            <div className="space-y-2.5">
              {factors.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-600 dark:text-neutral-400 w-20 shrink-0 truncate font-medium">
                    {f.label}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", getFactorBarColor(f.score))}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 w-8 text-right tabular-nums">
                    {f.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Wind compass */}
          <div className="shrink-0 flex flex-col items-center justify-center">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-2">
              Wind
            </p>
            <WindCompass
              windRelativeDeg={row.windRelativeDeg ?? 0}
              windSpeedMph={row.windSpeedMph ?? 0}
              windLabel={row.windLabel ?? ""}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Raw Conditions Line */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 px-4 py-3">
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          {row.temperatureF != null ? `${Math.round(row.temperatureF)}°F` : "--"}
          {row.feelsLikeF != null && row.feelsLikeF !== row.temperatureF ? ` (feels ${Math.round(row.feelsLikeF)}°F)` : ""}
          {" · "}
          {row.humidityPct != null ? `${Math.round(row.humidityPct)}% humidity` : "--"}
          {" · "}
          {row.windSpeedMph != null ? `Wind ${Math.round(row.windSpeedMph)} mph` : "No wind data"}
          {row.windGustMph != null && row.windGustMph > (row.windSpeedMph ?? 0) + 3 ? ` (gusts ${Math.round(row.windGustMph)})` : ""}
          {" · "}
          {row.elevationFt != null ? `${Math.round(row.elevationFt).toLocaleString()} ft elev` : "--"}
          {row.roofType ? ` · ${row.roofType}` : ""}
          {row.precipProbability != null && row.precipProbability > 0 ? ` · ${Math.round(row.precipProbability)}% precip` : ""}
        </p>
      </div>

      {/* Section 3b: Hourly Forecast Timeline */}
      {row.hourlyForecast && row.hourlyForecast.length > 0 && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-2.5">
            Game Weather Timeline
          </p>
          <div className="flex gap-0 overflow-x-auto pb-1">
            {row.hourlyForecast.map((entry, i) => {
              const isFirst = i === 0;
              const windShort = (entry.wind_label ?? "")
                .replace(/^blowing\s+/i, "")
                .replace(/\s+at\s+/i, " ")
                .trim();
              const precipHigh = (entry.precip_probability ?? 0) >= 30;
              const windChange =
                i > 0 &&
                entry.wind_speed_mph != null &&
                row.hourlyForecast![i - 1].wind_speed_mph != null &&
                Math.abs((entry.wind_speed_mph ?? 0) - (row.hourlyForecast![i - 1].wind_speed_mph ?? 0)) >= 5;
              const tempChange =
                i > 0 &&
                entry.temp_f != null &&
                row.hourlyForecast![i - 1].temp_f != null &&
                Math.abs((entry.temp_f ?? 0) - (row.hourlyForecast![i - 1].temp_f ?? 0)) >= 5;

              return (
                <div
                  key={entry.hour}
                  className={cn(
                    "flex-shrink-0 px-3 py-2 text-center border-r border-neutral-200/60 dark:border-neutral-700/40 last:border-r-0",
                    isFirst && "bg-brand/5 dark:bg-brand/10 rounded-l-lg",
                    "min-w-[90px]"
                  )}
                >
                  {/* Label */}
                  <p className={cn(
                    "text-[10px] font-semibold mb-1",
                    isFirst ? "text-brand" : "text-neutral-500"
                  )}>
                    {entry.label}
                  </p>
                  <p className="text-[9px] text-neutral-400 mb-1.5">
                    {entry.inning_estimate}
                  </p>

                  {/* Temp */}
                  <p className={cn(
                    "text-sm font-bold tabular-nums",
                    tempChange ? "text-amber-600 dark:text-amber-400" : "text-neutral-800 dark:text-neutral-200"
                  )}>
                    {entry.temp_f != null ? `${Math.round(entry.temp_f)}°` : "--"}
                  </p>

                  {/* Wind */}
                  <p className={cn(
                    "text-[10px] mt-1 leading-tight",
                    windChange ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-neutral-500 dark:text-neutral-400"
                  )}>
                    {entry.wind_speed_mph != null ? `${Math.round(entry.wind_speed_mph)} mph` : "--"}
                  </p>
                  {windShort && (
                    <p className="text-[9px] text-neutral-400 truncate max-w-[80px] mx-auto">
                      {windShort}
                    </p>
                  )}

                  {/* Precip */}
                  {(entry.precip_probability ?? 0) > 0 && (
                    <p className={cn(
                      "text-[10px] mt-1 tabular-nums",
                      precipHigh ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-neutral-400"
                    )}>
                      {Math.round(entry.precip_probability ?? 0)}% rain
                    </p>
                  )}

                  {/* HR impact if available */}
                  {entry.hr_impact_score != null && (
                    <p className={cn(
                      "text-[10px] mt-1 font-semibold tabular-nums",
                      entry.hr_impact_score >= 1 ? "text-emerald-600 dark:text-emerald-400"
                        : entry.hr_impact_score <= -1 ? "text-red-500 dark:text-red-400"
                        : "text-neutral-400"
                    )}>
                      HR {entry.hr_impact_score > 0 ? "+" : ""}{entry.hr_impact_score.toFixed(1)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 4: "Why It Leans" Tags */}
      {leanTags.length > 0 && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-2">
            Why It Leans
          </p>
          <div className="flex flex-wrap gap-1.5">
            {leanTags.map((tag, i) => (
              <span
                key={i}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium border",
                  tag.positive
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-red-300 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-300"
                )}
              >
                {tag.positive ? "+" : "-"} {tag.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Field Profile (LivingStadiumCard) */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-4">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-3">
          Field Profile
        </p>
        <LivingStadiumCard row={row} />
      </div>

      {/* Section 6: Park Factors Detail */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-4">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-3">
          Park Detail
        </p>

        {/* Wall heights and distances table */}
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden mb-3">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800/50">
                <th className="px-2 py-1.5 text-left text-neutral-500 font-semibold">Section</th>
                <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">Distance</th>
                <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">Wall Height</th>
              </tr>
            </thead>
            <tbody>
              {wallData.map((w) => (
                <tr key={w.label} className="border-t border-neutral-200/70 dark:border-neutral-800/50">
                  <td className="px-2 py-1.5 text-neutral-700 dark:text-neutral-300 font-medium">{w.label}</td>
                  <td className="px-2 py-1.5 text-right text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {w.distance != null ? `${Math.round(w.distance)} ft` : "--"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {w.height != null ? `${w.height} ft` : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* HR factor overview */}
        {hrFactor != null && (
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <div className="text-[12px] text-neutral-700 dark:text-neutral-300">
              <span className="font-semibold">HR Park Factor: </span>
              <span className={cn("font-bold tabular-nums", hrFactor >= 105 ? "text-emerald-600 dark:text-emerald-400" : hrFactor <= 95 ? "text-red-600 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300")}>
                {Math.round(hrFactor)}
              </span>
              <span className="text-neutral-500 ml-1.5">
                ({hrFactor >= 105 ? "HR-friendly" : hrFactor <= 95 ? "Pitcher-friendly" : "Neutral"} park)
              </span>
            </div>
          </div>
        )}

        {/* Handedness splits */}
        {row.ballparkFactors?.hr && (row.ballparkFactors.hr.vsLhb != null || row.ballparkFactors.hr.vsRhb != null) && (
          <div className="mt-2 flex gap-4 text-[11px]">
            {row.ballparkFactors.hr.vsLhb != null && (
              <span className="text-neutral-500 dark:text-neutral-400">
                vs LHB: <span className={cn("font-semibold", row.ballparkFactors.hr.vsLhb >= 105 ? "text-emerald-600 dark:text-emerald-400" : row.ballparkFactors.hr.vsLhb <= 95 ? "text-red-600 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300")}>
                  {Math.round(row.ballparkFactors.hr.vsLhb)}
                </span>
              </span>
            )}
            {row.ballparkFactors.hr.vsRhb != null && (
              <span className="text-neutral-500 dark:text-neutral-400">
                vs RHB: <span className={cn("font-semibold", row.ballparkFactors.hr.vsRhb >= 105 ? "text-emerald-600 dark:text-emerald-400" : row.ballparkFactors.hr.vsRhb <= 95 ? "text-red-600 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300")}>
                  {Math.round(row.ballparkFactors.hr.vsRhb)}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Section 7: Batter-Adjusted Environment Scores (expandable) */}
      <div className="px-4 lg:px-5 py-3">
        <button
          onClick={() => setShowBatters(!showBatters)}
          className="flex items-center gap-2 text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors w-full"
        >
          <Users className="h-3.5 w-3.5" />
          <span>{showBatters ? "Hide" : "View"} Batter Scores</span>
          {showBatters ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
        </button>

        {showBatters && (
          <div className="mt-3 space-y-3">
            {/* Header description */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-1">
                Batter-Adjusted Environment Scores
              </p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Accounts for handedness, pull tendency, and power profile against this park + tonight&apos;s conditions.
              </p>
            </div>

            {battersLoading ? (
              <div className="py-6 text-center text-[12px] text-neutral-500">Loading batter data...</div>
            ) : gamePlayers.length === 0 ? (
              <div className="py-6 text-center text-[12px] text-neutral-500">No batter data available for this game.</div>
            ) : (
              <>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[700px]">
                    <thead>
                      <tr className="bg-neutral-100 dark:bg-neutral-800/50">
                        <th className="px-2 py-1.5 text-left text-neutral-500 font-semibold w-6">#</th>
                        <th className="px-2 py-1.5 text-left text-neutral-500 font-semibold">Player</th>
                        <th className="px-2 py-1.5 text-center text-neutral-500 font-semibold">Bat</th>
                        <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">Adj Score</th>
                        <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">HR Score</th>
                        <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">Pull%</th>
                        <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">Oppo%</th>
                        <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">Barrel%</th>
                        <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">Avg EV</th>
                        <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold">FB%</th>
                        <th className="px-2 py-1.5 text-right text-neutral-500 font-semibold hidden md:table-cell">HRs (10G)</th>
                        <th className="px-2 py-1.5 text-left text-neutral-500 font-semibold hidden lg:table-cell">vs Pitcher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gamePlayers.slice(0, 25).map((player: HRSheetPlayer, idx: number) => {
                        const adjScore = batterAdjScore(player);
                        const adjDelta = adjScore - envScore;
                        const tierColor = (s: number) =>
                          s >= 70 ? "text-emerald-600 dark:text-emerald-400"
                          : s >= 50 ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400";
                        const teamColor = player.primary_color ?? "#64748b";

                        return (
                          <tr
                            key={player.player_id}
                            className="border-t border-neutral-200/70 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
                          >
                            {/* Rank */}
                            <td className="px-2 py-2 text-neutral-400 tabular-nums text-[10px]">
                              {idx + 1}
                            </td>

                            {/* Player name + team logo */}
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: `${teamColor}18`, border: `1px solid ${teamColor}25` }}
                                >
                                  <img
                                    src={`/team-logos/mlb/${player.team_abbr?.toUpperCase()}.svg`}
                                    alt={player.team_abbr}
                                    className="h-3.5 w-3.5 object-contain"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-neutral-800 dark:text-neutral-200 font-medium truncate text-[11px] leading-tight">
                                    {player.player_name}
                                  </p>
                                  <p className="text-[9px] text-neutral-400 leading-tight">
                                    {player.team_abbr} · {player.position}
                                    {player.lineup_position ? ` · #${player.lineup_position}` : ""}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Batting hand */}
                            <td className="px-2 py-2 text-center text-neutral-500 dark:text-neutral-400">
                              {player.batting_hand}
                            </td>

                            {/* Adj Score (primary) */}
                            <td className="px-2 py-2 text-right">
                              <span className={cn("font-bold tabular-nums", tierColor(adjScore))}>
                                {adjScore}
                              </span>
                              {adjDelta !== 0 && (
                                <span className={cn(
                                  "ml-1 text-[9px] font-medium tabular-nums",
                                  adjDelta > 0 ? "text-emerald-500" : "text-red-500"
                                )}>
                                  {adjDelta > 0 ? "+" : ""}{adjDelta}
                                </span>
                              )}
                            </td>

                            {/* HR Score */}
                            <td className={cn("px-2 py-2 text-right font-bold tabular-nums", tierColor(player.hr_score))}>
                              {player.hr_score}
                            </td>

                            {/* Pull% */}
                            <td className="px-2 py-2 text-right tabular-nums">
                              <span className={cn(
                                "font-medium",
                                player.pull_pct >= 45 ? "text-emerald-600 dark:text-emerald-400"
                                : player.pull_pct >= 38 ? "text-neutral-700 dark:text-neutral-300"
                                : "text-neutral-500 dark:text-neutral-400"
                              )}>
                                {player.pull_pct != null ? `${player.pull_pct.toFixed(1)}%` : "--"}
                              </span>
                            </td>

                            {/* Oppo% */}
                            <td className="px-2 py-2 text-right tabular-nums">
                              <span className={cn(
                                "font-medium",
                                player.oppo_pct >= 30 ? "text-emerald-600 dark:text-emerald-400"
                                : player.oppo_pct >= 22 ? "text-neutral-700 dark:text-neutral-300"
                                : "text-neutral-500 dark:text-neutral-400"
                              )}>
                                {player.oppo_pct != null ? `${player.oppo_pct.toFixed(1)}%` : "--"}
                              </span>
                            </td>

                            {/* Barrel% */}
                            <td className="px-2 py-2 text-right tabular-nums">
                              <span className={cn(
                                "font-medium",
                                player.barrel_pct >= 12 ? "text-emerald-600 dark:text-emerald-400"
                                : player.barrel_pct >= 8 ? "text-neutral-700 dark:text-neutral-300"
                                : "text-neutral-500 dark:text-neutral-400"
                              )}>
                                {player.barrel_pct != null ? `${player.barrel_pct.toFixed(1)}%` : "--"}
                              </span>
                            </td>

                            {/* Avg Exit Velo */}
                            <td className="px-2 py-2 text-right tabular-nums">
                              <span className={cn(
                                "font-medium",
                                player.avg_exit_velo >= 91 ? "text-emerald-600 dark:text-emerald-400"
                                : player.avg_exit_velo >= 88 ? "text-neutral-700 dark:text-neutral-300"
                                : "text-neutral-500 dark:text-neutral-400"
                              )}>
                                {player.avg_exit_velo != null ? player.avg_exit_velo.toFixed(1) : "--"}
                              </span>
                            </td>

                            {/* FB% */}
                            <td className="px-2 py-2 text-right text-neutral-500 dark:text-neutral-400 tabular-nums font-medium">
                              {player.fly_ball_pct != null ? `${player.fly_ball_pct.toFixed(1)}%` : "--"}
                            </td>

                            {/* HRs last 10 games */}
                            <td className="px-2 py-2 text-right tabular-nums hidden md:table-cell">
                              <span className={cn(
                                "font-medium",
                                player.hrs_last_10_games >= 3 ? "text-emerald-600 dark:text-emerald-400"
                                : player.hrs_last_10_games >= 1 ? "text-neutral-700 dark:text-neutral-300"
                                : "text-neutral-500 dark:text-neutral-400"
                              )}>
                                {player.hrs_last_10_games}
                              </span>
                            </td>

                            {/* Opposing pitcher */}
                            <td className="px-2 py-2 text-left hidden lg:table-cell">
                              {player.opposing_pitcher ? (
                                <div className="min-w-0">
                                  <p className="text-neutral-600 dark:text-neutral-300 truncate text-[10px] leading-tight">
                                    {player.opposing_pitcher}
                                  </p>
                                  <p className="text-[9px] text-neutral-400 leading-tight">
                                    {player.opposing_pitcher_hand ? `${player.opposing_pitcher_hand}HP` : ""}
                                    {player.pitcher_hr_per_9 != null ? ` · ${player.pitcher_hr_per_9.toFixed(1)} HR/9` : ""}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-neutral-400">--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {gamePlayers.length > 25 && (
                  <p className="text-[10px] text-neutral-500 text-center">
                    Showing top 25 of {gamePlayers.length} batters
                  </p>
                )}

                {/* Explainer */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30 px-3 py-2.5">
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    <span className="font-semibold text-neutral-600 dark:text-neutral-300">Adj Score</span> personalizes
                    the game environment score per batter. A {envScore} game score means different things for a RHB pull
                    hitter (hitting toward {row.fieldDistances?.leftLine ? `${Math.round(row.fieldDistances.leftLine)}ft LF` : "LF"})
                    vs a LHB pull hitter (hitting toward {row.fieldDistances?.rightLine ? `${Math.round(row.fieldDistances.rightLine)}ft RF` : "RF"}).
                    Factors in: handedness vs wind direction, pull% vs shortest fence, barrel rate, and park factor splits.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
