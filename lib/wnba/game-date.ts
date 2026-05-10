const WNBA_DAY_INDEX: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export interface WnbaGameDateRow {
  game_date?: string | null;
  day?: string | null;
}

function getUtcWeekday(date: string): number | null {
  const parsed = new Date(`${date}T00:00:00Z`);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return null;
  return parsed.getUTCDay();
}

export function addDateDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getDateInTimeZone(
  value: string | Date | null | undefined,
  timeZone = "America/New_York",
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function normalizeWnbaGameDate(
  row: WnbaGameDateRow,
  startTime?: string | null,
): string | null {
  const startDate = getDateInTimeZone(startTime);
  if (startDate) return startDate;

  const gameDate = row.game_date;
  if (!gameDate) return null;

  const targetDay = row.day
    ? WNBA_DAY_INDEX[String(row.day).trim().toLowerCase()]
    : undefined;
  if (targetDay === undefined) return gameDate;

  const currentDay = getUtcWeekday(gameDate);
  if (currentDay === null || currentDay === targetDay) return gameDate;

  const previousDate = addDateDays(gameDate, -1);
  if (getUtcWeekday(previousDate) === targetDay) return previousDate;

  const nextDate = addDateDays(gameDate, 1);
  if (getUtcWeekday(nextDate) === targetDay) return nextDate;

  return gameDate;
}

export function getWnbaDbDatesForLocalDates(dates: string[]): string[] {
  return [...new Set(dates.flatMap((date) => [date, addDateDays(date, 1)]))];
}
