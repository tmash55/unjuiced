export function getCurrentMlbSeason(date = new Date()): number {
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
    }).format(date)
  );
  const month = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
    }).format(date)
  );

  // MLB regular season data is not reliable before April.
  return month < 4 ? year - 1 : year;
}

export function buildSeasonRange(endSeason: number, count: number): number[] {
  const safeCount = Math.max(1, count);
  const startSeason = endSeason - safeCount + 1;
  return Array.from({ length: safeCount }, (_, index) => startSeason + index);
}
