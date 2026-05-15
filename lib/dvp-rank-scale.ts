export type DvpSport = "nba" | "wnba" | "mlb";
export type DvpRankBucket = "tough" | "neutral" | "favorable";

export const NBA_DVP_TEAM_COUNT = 30;
export const WNBA_2025_DVP_TEAM_COUNT = 13;
export const WNBA_2026_DVP_TEAM_COUNT = 15;

const parseYear = (value?: string | number | null): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = value.match(/\b(20\d{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
};

export function getDvpTeamCount(
  sport: DvpSport,
  seasonOrDate?: string | number | null,
  knownTotalTeams?: number | null,
): number {
  if (sport === "wnba") {
    const year = parseYear(seasonOrDate);
    const seasonTotal = year && year <= 2025
      ? WNBA_2025_DVP_TEAM_COUNT
      : WNBA_2026_DVP_TEAM_COUNT;
    return knownTotalTeams && Number.isFinite(knownTotalTeams)
      ? Math.max(Math.floor(knownTotalTeams), seasonTotal)
      : seasonTotal;
  }

  if (knownTotalTeams && Number.isFinite(knownTotalTeams) && knownTotalTeams > 0) {
    return Math.floor(knownTotalTeams);
  }

  return NBA_DVP_TEAM_COUNT;
}

export function getDvpRankRanges(totalTeams: number) {
  const total = Math.max(Math.floor(totalTeams || NBA_DVP_TEAM_COUNT), 1);
  const toughMax = Math.ceil(total / 3);
  const neutralMax = Math.ceil((total * 2) / 3);

  return {
    tough: { min: 1, max: toughMax },
    neutral: { min: toughMax + 1, max: neutralMax },
    favorable: { min: neutralMax + 1, max: total },
    total,
  };
}

export function getDvpRankBucket(
  rank: number | null | undefined,
  totalTeams: number,
): DvpRankBucket | null {
  if (!rank || !Number.isFinite(rank)) return null;
  const ranges = getDvpRankRanges(totalTeams);
  if (rank <= ranges.tough.max) return "tough";
  if (rank <= ranges.neutral.max) return "neutral";
  return "favorable";
}

export function isDvpRankInBucket(
  rank: number | null | undefined,
  bucket: DvpRankBucket,
  totalTeams: number,
): boolean {
  return getDvpRankBucket(rank, totalTeams) === bucket;
}

export function formatDvpRankRange(bucket: DvpRankBucket, totalTeams: number): string {
  const range = getDvpRankRanges(totalTeams)[bucket];
  return range.min <= range.max ? `${range.min}-${range.max}` : `${range.max}`;
}

export function getDvpRankYPercent(
  rank: number | null | undefined,
  totalTeams: number,
): number {
  if (!rank || !Number.isFinite(rank)) return 0;
  const total = Math.max(Math.floor(totalTeams), 1);
  if (total <= 1) return 0;
  const clampedRank = Math.min(Math.max(rank, 1), total);
  return ((clampedRank - 1) / (total - 1)) * 100;
}

export function getDvpRankLabel(
  rank: number | null | undefined,
  totalTeams: number,
): "Tough" | "Avg" | "Favorable" | null {
  const bucket = getDvpRankBucket(rank, totalTeams);
  if (bucket === "tough") return "Tough";
  if (bucket === "neutral") return "Avg";
  if (bucket === "favorable") return "Favorable";
  return null;
}
