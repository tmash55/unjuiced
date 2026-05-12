const DEFAULT_MIDDLES_REDIS_PREFIX = "middles:v2";

export const MIDDLES_REDIS_PREFIX = (
  process.env.MIDDLES_REDIS_PREFIX?.trim() || DEFAULT_MIDDLES_REDIS_PREFIX
).replace(/:+$/, "");

export const MIDDLES_REDIS_KEYS = {
  rows: `${MIDDLES_REDIS_PREFIX}:rows`,
  sortScore: `${MIDDLES_REDIS_PREFIX}:sort:score`,
  sortScoreLive: `${MIDDLES_REDIS_PREFIX}:sort:score:live`,
  sortScorePregame: `${MIDDLES_REDIS_PREFIX}:sort:score:pregame`,
  version: `${MIDDLES_REDIS_PREFIX}:v`,
  statsLatest: `${MIDDLES_REDIS_PREFIX}:stats:latest`,
};

export function getMiddlesByEventKey(eventId: string): string {
  return `${MIDDLES_REDIS_PREFIX}:by_event:${eventId}`;
}
