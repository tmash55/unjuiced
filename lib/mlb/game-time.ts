type MlbGameStatusInput = {
  game_status?: string | null;
  game_datetime?: string | null;
  game_date?: string | null;
  final_inning?: number | null;
  live?: {
    current_inning?: number | null;
    current_inning_half?: "top" | "bottom" | string | null;
  } | null;
};

type FormatGameTimeOptions = {
  fallback?: string;
  includeTimeZoneName?: boolean;
  timeZone?: string;
};

const EASTERN_TIME_RE = /^(\d{1,2}):(\d{2})\s*(am|pm)\s*(?:e[ds]?t|et)?$/i;
const EASTERN_TIME_ZONE = "America/New_York";

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  const zonedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );

  return zonedAsUtc - date.getTime();
}

function easternWallTimeToDate(gameDate: string, hour12: number, minute: number, meridiem: string): Date | null {
  const [year, month, day] = gameDate.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;

  let hour = hour12 % 12;
  if (meridiem.toLowerCase() === "pm") hour += 12;

  const localAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  let offset = getTimeZoneOffsetMs(localAsUtc, EASTERN_TIME_ZONE);
  let utcDate = new Date(localAsUtc.getTime() - offset);

  offset = getTimeZoneOffsetMs(utcDate, EASTERN_TIME_ZONE);
  utcDate = new Date(localAsUtc.getTime() - offset);

  return Number.isNaN(utcDate.getTime()) ? null : utcDate;
}

function parseEasternStatusTime(status: string, gameDate?: string | null): Date | null {
  if (!gameDate) return null;
  const match = status.trim().match(EASTERN_TIME_RE);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return easternWallTimeToDate(gameDate, hour, minute, match[3]);
}

export function formatGameTimeForUser(
  dateTime: string | Date | null | undefined,
  options: FormatGameTimeOptions = {}
): string {
  const fallback = options.fallback ?? "TBD";
  if (!dateTime) return fallback;

  const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: options.timeZone,
    timeZoneName: options.includeTimeZoneName ? "short" : undefined,
  }).format(date);
}

export function formatEasternGameStatusForUser(
  status: string | null | undefined,
  gameDate?: string | null,
  options: FormatGameTimeOptions = {}
): string {
  const fallback = options.fallback ?? "TBD";
  if (!status) return fallback;

  const easternDate = parseEasternStatusTime(status, gameDate);
  if (!easternDate) return status;

  return formatGameTimeForUser(easternDate, {
    ...options,
    fallback: status,
  });
}

export function formatMlbGameStatusForUser(
  game: MlbGameStatusInput,
  options: FormatGameTimeOptions = {}
): string {
  const fallback = options.fallback ?? "TBD";
  const status = game.game_status || fallback;
  const statusLower = status.toLowerCase();

  if (statusLower.includes("final")) {
    return game.final_inning && game.final_inning > 9 ? `F/${game.final_inning}` : "Final";
  }

  if (game.live?.current_inning != null) {
    const half = game.live.current_inning_half === "top"
      ? "T"
      : game.live.current_inning_half === "bottom"
        ? "B"
        : "";
    return `${half}${game.live.current_inning}`;
  }

  if (statusLower.includes("progress")) return "Live";

  if (game.game_datetime) {
    return formatGameTimeForUser(game.game_datetime, {
      includeTimeZoneName: true,
      ...options,
      fallback: status,
    });
  }

  return formatEasternGameStatusForUser(status, game.game_date, {
    includeTimeZoneName: true,
    ...options,
    fallback: status,
  });
}
