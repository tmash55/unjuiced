type RedisLike = {
  zcard: (key: string) => Promise<unknown>;
  zrange: (key: string, start: number, stop: number, opts?: { rev?: boolean }) => Promise<unknown>;
};

/**
 * Compatibility wrapper for descending sorted-set range queries.
 * Uses ZCARD + ascending ZRANGE and reverses in memory, so it works on older
 * Redis versions that do not support ZRANGE ... REV.
 */
export async function zrevrangeCompat(
  redis: RedisLike,
  key: string,
  start: number,
  stop: number
): Promise<string[]> {
  if (stop < start) return [];

  const totalRaw = await redis.zcard(key);
  const total = Number(totalRaw || 0);
  if (!Number.isFinite(total) || total <= 0) return [];

  // Convert descending offset window [start..stop] into ascending index window.
  let ascStart = total - 1 - stop;
  let ascEnd = total - 1 - start;

  if (ascEnd < 0) return [];
  if (ascStart < 0) ascStart = 0;

  const raw = await redis.zrange(key, ascStart, ascEnd);
  const asc = Array.isArray(raw) ? raw.map((v) => String(v)) : [];
  return asc.reverse();
}
