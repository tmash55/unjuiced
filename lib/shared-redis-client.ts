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

const endpointUrl: string = endpoint.url;
const endpointToken: string = endpoint.token;

export const redis = new Redis({
  url: endpointUrl,
  token: endpointToken,
  // responseEncoding: false is required so the SDK returns raw strings instead of
  // auto-decoding JSON — our routes handle parsing manually for correctness.
  responseEncoding: false,
});

const HGETALL_TIMEOUT_MS = 10000;
const HGETALL_RETRY_ATTEMPTS = 1;
const HGETALL_RETRY_BACKOFF_MS = 150;

const COMMAND_TIMEOUT_MS = 7000;
const COMMAND_RETRY_ATTEMPTS = 1;

async function runRedisCommandSafe(
  args: Array<string | number>,
  retries: number = COMMAND_RETRY_ATTEMPTS
): Promise<unknown | null> {
  const url = endpointUrl;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("redis_command_timeout"), COMMAND_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${endpointToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(args),
      });

      const raw = await res.text();
      if (!res.ok) {
        if (res.status === 413) {
          return null;
        }
        if ((res.status >= 500 || res.status === 429) && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
        console.warn(`[redis] command HTTP ${res.status} for ${args[0]}`);
        return null;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
        console.warn(`[redis] non-JSON command response for ${args[0]}`);
        return null;
      }

      if (parsed && typeof parsed === "object" && "result" in parsed) {
        return parsed.result;
      }
      return parsed ?? null;
    } catch (err) {
      if (attempt >= retries) {
        console.warn(`[redis] command failed for ${args[0]}`, err);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

export async function setSafe(
  key: string,
  value: string,
  options?: { ex?: number }
): Promise<boolean> {
  const args: Array<string | number> = ["SET", key, value];
  if (options?.ex && Number.isFinite(options.ex) && options.ex > 0) {
    args.push("EX", Math.floor(options.ex));
  }
  const result = await runRedisCommandSafe(args);
  return result === "OK";
}

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
  const url = `${endpointUrl}/HGETALL/${encodeURIComponent(key)}`;
  for (let attempt = 0; attempt <= HGETALL_RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("hgetall_timeout"), HGETALL_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
      headers: { Authorization: `Bearer ${endpointToken}` },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        // Retry transient upstream/proxy statuses only.
        if (res.status >= 500 || res.status === 429) {
          throw new Error(`hgetall_http_${res.status}`);
        }
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
      const shouldRetry = attempt < HGETALL_RETRY_ATTEMPTS;
      if (!shouldRetry) {
        console.warn(`[redis] hgetallSafe fetch failed for key: ${key}`, err);
        return null;
      }
      const backoff = HGETALL_RETRY_BACKOFF_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

/**
 * Fetch edge/EV rows using per-event hashes (v2 architecture).
 *
 * Instead of one giant HGETALL on `edge:{sport}:rows:{preset}` (which can be 50MB+),
 * this reads `active_events:{sport}` then pipelines small HGETALLs on per-event hashes:
 *   `edge:{sport}:{eventId}:{preset}`
 *
 * Falls back to the old single-hash format if no per-event keys exist (transition period).
 *
 * Returns the same Record<seid, jsonString> that hgetallSafe returns.
 */
export async function hgetallPerEvent(
  sport: string,
  preset: string,
  keyPrefix: "edge" | "ev" = "edge"
): Promise<Record<string, string> | null> {
  // Step 1: Get active event IDs
  const eventIds = await runRedisCommandSafe(["SMEMBERS", `active_events:${sport}`]) as string[] | null;
  if (!eventIds || eventIds.length === 0) {
    // Fallback to old single-hash format
    return hgetallSafe(`${keyPrefix}:${sport}:rows:${preset}`);
  }

  // Step 2: Pipeline HGETALL on per-event hashes
  const pipelineUrl = `${endpointUrl}/pipeline`;
  const commands = eventIds.map((eid) => [
    "HGETALL",
    `${keyPrefix}:${sport}:${eid}:${preset}`,
  ]);

  // Chunk into batches of 20 to avoid oversized requests
  const BATCH_SIZE = 20;
  const merged: Record<string, string> = {};
  let foundAny = false;

  for (let i = 0; i < commands.length; i += BATCH_SIZE) {
    const batch = commands.slice(i, i + BATCH_SIZE);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("pipeline_timeout"), 15000);

    try {
      const res = await fetch(pipelineUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${endpointToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        console.warn(`[redis] hgetallPerEvent pipeline HTTP ${res.status} for ${sport}/${preset}`);
        continue;
      }

      const results = await res.json();
      if (!Array.isArray(results)) continue;

      for (const item of results) {
        const result = item?.result;
        if (!result) continue;

        if (typeof result === "object" && !Array.isArray(result)) {
          for (const [field, value] of Object.entries(result)) {
            merged[field] = value as string;
            foundAny = true;
          }
        } else if (Array.isArray(result) && result.length >= 2) {
          for (let j = 0; j < result.length; j += 2) {
            merged[result[j]] = result[j + 1];
            foundAny = true;
          }
        }
      }
    } catch (err) {
      console.warn(`[redis] hgetallPerEvent pipeline failed for ${sport}/${preset} batch ${i}`, err);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (foundAny) {
    return merged;
  }

  // Fallback: no per-event keys found, try old single-hash format
  console.log(`[redis] hgetallPerEvent: no per-event data for ${sport}/${preset}, falling back to single hash`);
  return hgetallSafe(`${keyPrefix}:${sport}:rows:${preset}`);
}
