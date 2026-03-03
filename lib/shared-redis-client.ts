/**
 * Shared Redis Client Module
 *
 * Single source of truth for the Redis client used by all API routes.
 * Uses resolveRedisCommandEndpoint() to support both:
 *   - UPSTASH_REDIS_COMMAND_URL / UPSTASH_REDIS_COMMAND_TOKEN (dedicated VPS endpoint)
 *   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (fallback REST endpoint)
 *
 * CHANGED vs old pattern: previous routes either used raw env vars (ev-feed-route.ts)
 * or the old @/lib/redis import (v2-edges-sport-route.ts). This module replaces both.
 */

import { Redis } from "@upstash/redis";
import { resolveRedisCommandEndpoint } from "@/lib/redis-endpoints";

const endpoint = resolveRedisCommandEndpoint();

if (!endpoint.url || !endpoint.token) {
  throw new Error(
    `Redis misconfigured: source=${endpoint.source}, loopback=${endpoint.rejectedLoopback}, ` +
      `partialConfig=${endpoint.partialDedicatedConfig}. ` +
      `Set UPSTASH_REDIS_COMMAND_URL + UPSTASH_REDIS_COMMAND_TOKEN (or the REST equivalents).`
  );
}

export const redis = new Redis({
  url: endpoint.url,
  token: endpoint.token,
  // responseEncoding: false is required so the SDK returns raw strings instead of
  // auto-decoding JSON — our routes handle parsing manually for correctness.
  responseEncoding: false,
});

/**
 * Parse a Redis value that may already be an object (Upstash SDK auto-decoded)
 * or a raw JSON string (when responseEncoding: false).
 *
 * In practice with responseEncoding: false, values always come back as strings,
 * but this helper guards against both cases.
 */
export function parseRedisValue<T>(
  value: string | T | null,
  key?: string
): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value as T;

  const trimmed = value.trim();
  // Reject HTML error pages from the REST proxy
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (key) {
      console.warn(`[redis] Failed to parse JSON for key: ${key}`);
    }
    return null;
  }
}

/**
 * Simple djb2 hash for building short Redis cache keys from longer strings.
 */
export function hashCacheKey(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * HGETALL wrapper that handles both Upstash REST response formats:
 *
 * - Standard Upstash cloud: returns flat array ["f1","v1","f2","v2"]
 *   which the SDK normally converts to an object.
 * - Custom VPS proxy (redis.unjuiced.bet): returns an object directly
 *   {"f1":"v1","f2":"v2"} — this breaks the SDK's hgetall because it
 *   expects the array format and calls .length on null.
 *
 * This helper bypasses the SDK entirely and does a direct REST call,
 * handling both formats safely.
 */
export async function hgetallSafe(key: string): Promise<Record<string, string> | null> {
  const url = `${endpoint.url}/HGETALL/${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${endpoint.token}` },
    });
    if (!res.ok) {
      console.warn(`[redis] hgetallSafe HTTP ${res.status} for key: ${key}`);
      return null;
    }
    const json = await res.json();
    const result = json.result;
    if (!result) return null;

    // Custom proxy returns object directly: {"result": {"field": "value", ...}}
    if (typeof result === "object" && !Array.isArray(result)) {
      return Object.keys(result).length > 0 ? result : null;
    }

    // Standard Upstash returns flat array: {"result": ["field", "value", ...]}
    if (Array.isArray(result) && result.length >= 2) {
      const obj: Record<string, string> = {};
      for (let i = 0; i < result.length; i += 2) {
        obj[result[i]] = result[i + 1];
      }
      return Object.keys(obj).length > 0 ? obj : null;
    }

    return null;
  } catch (err) {
    console.warn(`[redis] hgetallSafe fetch failed for key: ${key}`, err);
    return null;
  }
}