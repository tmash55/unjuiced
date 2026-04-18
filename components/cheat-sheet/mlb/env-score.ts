import type { MlbWeatherReportRow } from "@/hooks/use-mlb-weather-report";

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
}

// ── Individual factor scores (0-100) ────────────────────────────────────────

function parkFactorScore(row: MlbWeatherReportRow): number {
  const val = row.ballparkFactors?.hr?.overall;
  if (val == null) return 50; // neutral fallback
  return clamp((val - 80) / 40 * 100, 0, 100);
}

function windScore(row: MlbWeatherReportRow): number {
  const speed = row.windSpeedMph ?? 0;
  const label = (row.windLabel ?? "").toLowerCase();
  const impact = (row.windImpact ?? "").toLowerCase();

  // Base direction score
  let directionScore = 50;
  if (label.includes("out") || impact.includes("favorable") || impact.includes("boost")) {
    directionScore = 75;
  } else if (label.includes("in") || impact.includes("unfavorable") || impact.includes("suppress")) {
    directionScore = 25;
  } else if (label.includes("cross")) {
    directionScore = 45;
  }

  // Amplify by speed: stronger wind = more extreme score
  const speedFactor = clamp(speed / 20, 0, 1);
  const amplified = 50 + (directionScore - 50) * (0.4 + speedFactor * 0.6);

  return clamp(amplified, 0, 100);
}

function temperatureScore(row: MlbWeatherReportRow): number {
  const temp = row.temperatureF;
  if (temp == null) return 50;
  if (temp <= 55) return lerp(temp, 40, 55, 0, 15);
  if (temp <= 65) return lerp(temp, 55, 65, 15, 50);
  if (temp <= 85) return lerp(temp, 65, 85, 50, 100);
  return 100;
}

function humidityScore(row: MlbWeatherReportRow): number {
  const hum = row.humidityPct;
  if (hum == null) return 50;
  // Lower humidity = better for HR (drier air = less drag)
  if (hum <= 30) return 80;
  if (hum <= 60) return lerp(hum, 30, 60, 80, 50);
  if (hum <= 90) return lerp(hum, 60, 90, 50, 20);
  return 20;
}

function elevationScore(row: MlbWeatherReportRow): number {
  const elev = row.elevationFt;
  if (elev == null) return 30;
  if (elev <= 0) return 30;
  if (elev <= 1000) return lerp(elev, 0, 1000, 30, 60);
  if (elev <= 5280) return lerp(elev, 1000, 5280, 60, 100);
  return 100;
}

function hrImpactScore(row: MlbWeatherReportRow): number {
  const val = row.hrImpactScore;
  if (val == null) return 50;
  // Value is already on a 0-100 scale from the database
  return clamp(Math.round(val), 0, 100);
}

// ── Composite score ─────────────────────────────────────────────────────────

const WEIGHTS = {
  park: 25,
  wind: 25,
  temperature: 15,
  hrImpact: 15,
  humidity: 10,
  elevation: 10,
} as const;

export interface FactorBreakdown {
  label: string;
  key: string;
  score: number;
  weight: number;
}

export function getFactorScores(row: MlbWeatherReportRow): FactorBreakdown[] {
  return [
    { label: "Park Factor", key: "park", score: Math.round(parkFactorScore(row)), weight: WEIGHTS.park },
    { label: "Wind Impact", key: "wind", score: Math.round(windScore(row)), weight: WEIGHTS.wind },
    { label: "Temperature", key: "temperature", score: Math.round(temperatureScore(row)), weight: WEIGHTS.temperature },
    { label: "HR Weather", key: "hrImpact", score: Math.round(hrImpactScore(row)), weight: WEIGHTS.hrImpact },
    { label: "Humidity", key: "humidity", score: Math.round(humidityScore(row)), weight: WEIGHTS.humidity },
    { label: "Elevation", key: "elevation", score: Math.round(elevationScore(row)), weight: WEIGHTS.elevation },
  ];
}

export function computeEnvScore(row: MlbWeatherReportRow): number {
  const factors = getFactorScores(row);
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weighted = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  return Math.round(weighted / totalWeight);
}

// ── Score tiers and colors ──────────────────────────────────────────────────

export interface ScoreTier {
  label: string;
  colorClass: string;
  bgClass: string;
}

export function getScoreTier(score: number): ScoreTier {
  if (score >= 86) return { label: "Elite", colorClass: "text-emerald-400", bgClass: "bg-emerald-500/20" };
  if (score >= 70) return { label: "Above Avg", colorClass: "text-emerald-400", bgClass: "bg-emerald-500/15" };
  if (score >= 50) return { label: "Average", colorClass: "text-amber-400", bgClass: "bg-amber-500/15" };
  if (score >= 31) return { label: "Below Avg", colorClass: "text-orange-400", bgClass: "bg-orange-500/15" };
  return { label: "Poor", colorClass: "text-red-400", bgClass: "bg-red-500/15" };
}

export function getScoreBadgeColor(score: number): string {
  if (score >= 70) return "#10B981"; // emerald
  if (score >= 50) return "#F59E0B"; // amber
  return "#EF4444"; // red
}

export function getScoreBadgeBg(score: number): string {
  if (score >= 70) return "rgba(16, 185, 129, 0.15)";
  if (score >= 50) return "rgba(245, 158, 11, 0.15)";
  return "rgba(239, 68, 68, 0.15)";
}

export function getFactorBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  if (score >= 30) return "bg-orange-500";
  return "bg-red-500";
}

// ── "Why it leans" tag generation ───────────────────────────────────────────

export interface LeanTag {
  label: string;
  positive: boolean; // green vs red
  sentiment?: "positive" | "negative" | "neutral"; // overrides positive for amber/yellow tags
}

export function getWhyItLeansTags(row: MlbWeatherReportRow): LeanTag[] {
  const tags: LeanTag[] = [];
  const factors = getFactorScores(row);

  // Sort factors by how extreme their scores are (distance from 50)
  const sorted = [...factors].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));

  for (const f of sorted) {
    if (tags.length >= 4) break;
    if (Math.abs(f.score - 50) < 12) continue; // skip neutral factors

    const positive = f.score > 50;
    let label = "";

    switch (f.key) {
      case "park":
        label = positive ? `HR-friendly park (${row.ballparkFactors?.hr?.overall ?? "?"})` : `HR-suppressing park (${row.ballparkFactors?.hr?.overall ?? "?"})`;
        break;
      case "wind": {
        const wLabel = (row.windLabel ?? "").toLowerCase();
        const wImpact = (row.windImpact ?? "").toLowerCase();
        const wSpeed = row.windSpeedMph ? Math.round(row.windSpeedMph) + " mph" : "";
        // Check crosswind FIRST — "crosswind" contains "in" so must be before the "in" check
        if (wLabel.includes("cross")) {
          label = `Crosswind ${wSpeed}`;
        } else if (wLabel.includes("out") || wImpact.includes("blowing out")) {
          label = `+ Wind blowing out ${wSpeed}`;
        } else if (wLabel.includes("blowing in") || wImpact.includes("blowing in")) {
          label = `- Wind blowing in ${wSpeed}`;
        } else {
          label = positive ? `+ Favorable wind ${wSpeed}` : `- Unfavorable wind ${wSpeed}`;
        }
        break;
      }
      case "temperature": {
        const temp = row.temperatureF;
        label = positive ? `Warm air ${temp ? Math.round(temp) + "°F" : ""}` : `Cold air ${temp ? Math.round(temp) + "°F" : ""}`;
        break;
      }
      case "hrImpact":
        label = positive ? `High HR weather impact (+${(row.hrImpactScore ?? 0).toFixed(1)})` : `Low HR weather impact (${(row.hrImpactScore ?? 0).toFixed(1)})`;
        break;
      case "humidity":
        label = positive ? `Low humidity (${row.humidityPct ? Math.round(row.humidityPct) + "%" : ""})` : `High humidity (${row.humidityPct ? Math.round(row.humidityPct) + "%" : ""})`;
        break;
      case "elevation":
        label = positive ? `High elevation (${row.elevationFt ? Math.round(row.elevationFt).toLocaleString() + " ft" : ""})` : `Low elevation`;
        break;
    }

    if (!label) continue;

    // Determine sentiment: crosswind and borderline factors are neutral (amber)
    let sentiment: "positive" | "negative" | "neutral" = positive ? "positive" : "negative";
    if (f.key === "wind" && (row.windLabel ?? "").toLowerCase().includes("cross")) {
      sentiment = "neutral";
    }
    if (f.key === "temperature" && !positive && (row.temperatureF ?? 70) >= 50) {
      sentiment = "neutral"; // Cool but not extreme cold
    }
    if (f.key === "elevation" && !positive) {
      continue; // Skip "low elevation" — not actionable
    }

    tags.push({ label: label.trim(), positive, sentiment });
  }

  return tags;
}
