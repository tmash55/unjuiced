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

function getWeatherIcon(cloudCover: number | null | undefined, precipProb: number | null | undefined): string {
  const precip = precipProb ?? 0;
  const clouds = cloudCover ?? 0;
  if (precip >= 50) return "🌧️";
  if (precip >= 25) return "🌦️";
  if (clouds >= 80) return "☁️";
  if (clouds >= 40) return "⛅";
  return "☀️";
}

function getWeatherLabel(cloudCover: number | null | undefined, precipProb: number | null | undefined): string {
  const precip = precipProb ?? 0;
  const clouds = cloudCover ?? 0;
  if (precip >= 50) return "Rain";
  if (precip >= 25) return "Showers";
  if (clouds >= 80) return "Cloudy";
  if (clouds >= 40) return "Partly";
  return "Clear";
}

export function HREnvironmentDetail({ row, date }: HREnvironmentDetailProps) {
  const [showBatters, setShowBatters] = useState(false);
  const [selectedHour, setSelectedHour] = useState(0);
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

  // Active hourly data for interactive timeline
  const activeHourData = useMemo(() => {
    if (!row.hourlyForecast || row.hourlyForecast.length === 0) return null;
    return row.hourlyForecast[selectedHour] ?? row.hourlyForecast[0];
  }, [row.hourlyForecast, selectedHour]);

  // Wind data — use selected hour if available, otherwise game-level
  const activeWindSpeed = activeHourData?.wind_speed_mph ?? row.windSpeedMph ?? 0;
  const activeWindLabel = activeHourData?.wind_label ?? row.windLabel ?? "";
  const activeWindDeg = activeHourData?.wind_relative_deg ?? row.windRelativeDeg ?? 0;

  return (
    <div className="space-y-3 p-3 lg:p-4">
      {/* Section 1: Game Header + Gauge */}
      <div className="rounded-xl bg-neutral-50/80 dark:bg-neutral-950/40 border border-neutral-200/50 dark:border-neutral-800/40 p-4 lg:p-5">
        <div className="flex items-start gap-5">
          {/* Gauge */}
          <div className="shrink-0">
            <EnvGauge score={envScore} size={140} />
          </div>

          {/* Game info + edge signal */}
          <div className="flex-1 min-w-0">
            {/* Matchup */}
            <div className="flex items-center gap-2.5 mb-1.5">
              {row.awayTeamAbbr && (
                <img
                  src={`/team-logos/mlb/${row.awayTeamAbbr.toUpperCase()}.svg`}
                  alt={awayAbbr}
                  className="h-6 w-6 object-contain shrink-0"
                />
              )}
              <span className="font-bold text-neutral-900 dark:text-white text-sm">{awayAbbr}</span>
              <span className="text-neutral-400 dark:text-neutral-600 text-xs font-medium">@</span>
              <span className="font-bold text-neutral-900 dark:text-white text-sm">{homeAbbr}</span>
              {row.homeTeamAbbr && (
                <img
                  src={`/team-logos/mlb/${row.homeTeamAbbr.toUpperCase()}.svg`}
                  alt={homeAbbr}
                  className="h-6 w-6 object-contain shrink-0"
                />
              )}
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {row.venueName ?? "Unknown Venue"} · {gameTime}
            </p>

            {/* Edge signals */}
            <div className="mt-3 flex items-center gap-2.5 flex-wrap">
              <span className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold", impactPillClass(row.totalImpact))}>
                {formatImpactLabel(row.totalImpact)}
              </span>
              <span className={cn("text-sm font-black tabular-nums", scoreColor(row.hrImpactScore))}>
                HR {formatSigned(row.hrImpactScore, 1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Stadium + Timeline (interactive) */}
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/40 overflow-hidden">
        {/* Conditions strip */}
        <div className="flex items-center gap-4 px-4 py-2.5 bg-neutral-50/80 dark:bg-neutral-950/30 border-b border-neutral-200/40 dark:border-neutral-800/30 flex-wrap">
          {row.temperatureF != null && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-base">{getWeatherIcon(row.cloudCoverPct, row.precipProbability)}</span>
              <span className="font-bold text-neutral-900 dark:text-white tabular-nums">{Math.round(row.temperatureF)}°F</span>
            </div>
          )}
          {row.humidityPct != null && (
            <div className="text-xs text-neutral-500"><span className="font-semibold text-neutral-700 dark:text-neutral-300">{Math.round(row.humidityPct)}%</span> humidity</div>
          )}
          {row.windSpeedMph != null && (
            <div className="text-xs text-neutral-500">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">{Math.round(row.windSpeedMph)} mph</span> wind
            </div>
          )}
          {row.elevationFt != null && (
            <div className="text-xs text-neutral-500"><span className="font-semibold text-neutral-700 dark:text-neutral-300">{Math.round(row.elevationFt).toLocaleString()}</span> ft</div>
          )}
          {row.roofType && row.roofType !== "Open" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500">{row.roofType}</span>
          )}
          {row.precipProbability != null && row.precipProbability > 0 && (
            <div className={cn("text-xs", row.precipProbability >= 30 ? "text-blue-500 font-semibold" : "text-neutral-500")}>
              {Math.round(row.precipProbability)}% precip
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left: Stadium diagram */}
          <div className="flex-1 p-4 min-w-0">
            <LivingStadiumCard
              row={row}
              windOverride={activeHourData ? {
                windSpeedMph: activeHourData.wind_speed_mph ?? row.windSpeedMph ?? 0,
                windRelativeDeg: activeHourData.wind_relative_deg ?? row.windRelativeDeg ?? 0,
                windLabel: activeHourData.wind_label ?? row.windLabel ?? "",
                cloudCoverPct: activeHourData.cloud_cover_pct ?? row.cloudCoverPct,
                precipProbability: activeHourData.precip_probability ?? row.precipProbability,
              } : null}
            />
          </div>

          {/* Right: Wind + Conditions + Timeline */}
          <div className="lg:w-[320px] border-t lg:border-t-0 lg:border-l border-neutral-200/40 dark:border-neutral-800/30 flex flex-col">
            {/* Wind compass + weather condition */}
            <div className="flex items-center gap-4 p-4 border-b border-neutral-200/40 dark:border-neutral-800/30">
              <WindCompass
                windRelativeDeg={activeWindDeg}
                windSpeedMph={activeWindSpeed}
                windLabel={activeWindLabel}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{getWeatherIcon(activeHourData?.cloud_cover_pct ?? row.cloudCoverPct, activeHourData?.precip_probability ?? row.precipProbability)}</span>
                  <div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">
                      {getWeatherLabel(activeHourData?.cloud_cover_pct ?? row.cloudCoverPct, activeHourData?.precip_probability ?? row.precipProbability)}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {activeHourData?.temp_f != null ? `${Math.round(activeHourData.temp_f)}°F` : row.temperatureF != null ? `${Math.round(row.temperatureF)}°F` : "--"}
                    </p>
                  </div>
                </div>
                {/* Factor bars — compact */}
                <div className="space-y-1.5">
                  {factors.slice(0, 4).map((f) => (
                    <div key={f.key} className="flex items-center gap-1.5">
                      <span className="text-[9px] text-neutral-500 w-14 shrink-0 truncate">{f.label}</span>
                      <div className="flex-1 h-1 bg-neutral-200 dark:bg-neutral-700/30 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", getFactorBarColor(f.score))} style={{ width: `${f.score}%` }} />
                      </div>
                      <span className={cn("text-[9px] font-bold w-4 text-right tabular-nums",
                        f.score >= 70 ? "text-emerald-500" : f.score <= 30 ? "text-red-400" : "text-neutral-500"
                      )}>{f.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline — clickable hours */}
            {row.hourlyForecast && row.hourlyForecast.length > 0 && (
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 px-3 pt-3 pb-1.5">
                  Timeline
                </p>
                <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible">
                {row.hourlyForecast.map((entry, i) => {
                  const isActive = i === selectedHour;
                  const isFirst = i === 0;
                  return (
                    <button
                      key={entry.hour}
                      onClick={() => setSelectedHour(i)}
                      className={cn(
                        "flex-shrink-0 px-3 py-2.5 text-left transition-all border-b border-neutral-100/50 dark:border-neutral-800/20 last:border-0",
                        "lg:w-full min-w-[100px]",
                        isActive
                          ? "bg-brand/5 dark:bg-brand/10"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className={cn("text-[10px] font-semibold", isActive ? "text-brand" : "text-neutral-500")}>
                            {isFirst ? "First Pitch" : `+${i}h · ~Inn ${i * 2 + 1}`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-sm">{getWeatherIcon(entry.cloud_cover_pct, entry.precip_probability)}</span>
                            <span className="text-xs font-bold text-neutral-900 dark:text-white tabular-nums">
                              {entry.temp_f != null ? `${Math.round(entry.temp_f)}°` : "--"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-neutral-500 tabular-nums">
                            {entry.wind_speed_mph != null ? `${Math.round(entry.wind_speed_mph)} mph` : "--"}
                          </p>
                          {(entry.precip_probability ?? 0) > 0 && (
                            <p className={cn("text-[9px] tabular-nums",
                              (entry.precip_probability ?? 0) >= 30 ? "text-blue-500 font-semibold" : "text-neutral-400"
                            )}>
                              {Math.round(entry.precip_probability ?? 0)}% rain
                            </p>
                          )}
                          {entry.hr_impact_score != null && (
                            <p className={cn("text-[9px] font-semibold tabular-nums",
                              entry.hr_impact_score >= 1 ? "text-emerald-500" : entry.hr_impact_score <= -1 ? "text-red-400" : "text-neutral-400"
                            )}>
                              HR {entry.hr_impact_score > 0 ? "+" : ""}{entry.hr_impact_score.toFixed(0)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Section 4: "Why It Leans" Tags */}
      {leanTags.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-2">
            Key Factors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {leanTags.map((tag, i) => (
              <span
                key={i}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                  tag.positive
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                )}
              >
                {tag.positive ? "+" : "-"} {tag.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Park Detail */}
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/40 p-4">

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
    </div>
  );
}
