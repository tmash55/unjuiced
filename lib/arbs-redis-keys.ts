const DEFAULT_ARBS_REDIS_PREFIX = "arbs:v2";

export const ARBS_REDIS_PREFIX = (
  process.env.ARBS_REDIS_PREFIX?.trim() || DEFAULT_ARBS_REDIS_PREFIX
).replace(/:+$/, "");

export const ARBS_REDIS_KEYS = {
  rows: `${ARBS_REDIS_PREFIX}:rows`,
  sortRoi: `${ARBS_REDIS_PREFIX}:sort:roi`,
  sortRoiLive: `${ARBS_REDIS_PREFIX}:sort:roi:live`,
  sortRoiPregame: `${ARBS_REDIS_PREFIX}:sort:roi:pregame`,
  version: `${ARBS_REDIS_PREFIX}:v`,
  statsLatest: `${ARBS_REDIS_PREFIX}:stats:latest`,
};

export function getArbsByEventKey(eventId: string): string {
  return `${ARBS_REDIS_PREFIX}:by_event:${eventId}`;
}

export function getArbsPubSubChannel(): string {
  return process.env.ARBS_PUBSUB_CHANNEL?.trim() || `pub:${ARBS_REDIS_PREFIX}`;
}
