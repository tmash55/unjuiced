interface DynamicSeasonAverageRow {
  [key: string]: unknown;
}

function parseNumericAverage(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 10) / 10;
}

function parseNumericCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function parseYearFromDate(date: string): number | null {
  const year = Number(date.split("-")[0]);
  return Number.isFinite(year) ? year : null;
}

/**
 * MLB prior-season average resolver.
 * Priority:
 * 1) season_${previousYear}_avg
 * 2) canonical aliases (season_2025_avg, previous_season_avg, etc.)
 */
export function getMlbPreviousSeasonAvg(
  row: DynamicSeasonAverageRow,
  referenceDate: string
): number | null {
  const currentYear = parseYearFromDate(referenceDate);
  const previousYear = currentYear ? currentYear - 1 : 2025;

  // Prefer explicit 2025 season stat when available (matches current data model).
  const sample2025 = parseNumericCount(row.sample_size_2025);
  const season2025 = parseNumericAverage(row.season_2025_avg);
  if (season2025 !== null && (sample2025 === null || sample2025 > 0)) {
    return season2025;
  }

  // Then try dynamic previous-year field with sample-size check when present.
  const dynamicSample = parseNumericCount(row[`sample_size_${previousYear}`]);
  const dynamicSeason = parseNumericAverage(row[`season_${previousYear}_avg`]);
  if (dynamicSeason !== null && (dynamicSample === null || dynamicSample > 0)) {
    return dynamicSeason;
  }

  const candidates: unknown[] = [
    row.season_2025_avg,
    row[`season_${previousYear}_avg`],
    row.previous_season_avg,
    row.prev_season_avg,
    row.last_season_avg,
    row.prior_season_avg,
    row.season_avg_previous,
  ];

  for (const candidate of candidates) {
    const value = parseNumericAverage(candidate);
    if (value !== null) return value;
  }

  return null;
}
