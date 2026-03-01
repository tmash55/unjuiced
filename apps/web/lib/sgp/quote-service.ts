import { redis } from "@/lib/redis";

export interface SgpBookOdds {
  price?: string;
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string;
}

interface OddsBlazeResponse {
  price?: string;
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string;
  message?: string;
}

interface SgpVendorCacheEntry {
  odds: SgpBookOdds;
  cached_at: number;
  soft_ttl_seconds: number;
  hard_ttl_seconds: number;
}

interface RateLimitCheck {
  ok: boolean;
  retryAfterSeconds: number;
}

export interface FetchSgpQuoteOptions {
  forceRefresh?: boolean;
  allowStaleOnRateLimit?: boolean;
  allowStaleOnLockTimeout?: boolean;
  softTtlSeconds?: number;
  hardTtlSeconds?: number;
}

export interface FetchSgpQuoteResult {
  odds: SgpBookOdds;
  fromCache: boolean;
  stale: boolean;
  source: "cache" | "vendor" | "stale-cache" | "rate-limited" | "in-flight";
  requestHash: string;
  rateLimited: boolean;
}

const ODDSBLAZE_API_KEY = process.env.ODDSBLAZE_API_KEY;
const DEFAULT_SOFT_TTL_SECONDS = 20;
const DEFAULT_HARD_TTL_SECONDS = 120;
const NEGATIVE_SOFT_TTL_SECONDS = 8;
const NEGATIVE_HARD_TTL_SECONDS = 30;
const LOCK_TTL_SECONDS = 8;
const WAIT_FOR_IN_FLIGHT_MS = 1200;
const WAIT_POLL_MS = 120;
const VENDOR_TIMEOUT_MS = 6000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SGP_VENDOR_GLOBAL_RPM = parsePositiveInt(process.env.SGP_VENDOR_GLOBAL_RPM, 60);
const SGP_VENDOR_PER_BOOK_RPM = parsePositiveInt(process.env.SGP_VENDOR_PER_BOOK_RPM, 20);

const CACHE_KEY_PREFIX = "sgp:vendor:v1";
const LOCK_KEY_PREFIX = "sgp:vendor:lock:v1";
const RATE_LIMIT_KEY_PREFIX = "sgp:vendor:rate:v1";

const ODDSBLAZE_BOOK_ID_MAP: Record<string, string> = {
  draftkings: "draftkings",
  fanduel: "fanduel",
  betmgm: "betmgm",
  caesars: "caesars",
  bet365: "bet365",
  betrivers: "betrivers",
  betparx: "betparx",
  pointsbet: "pointsbet",
  espn: "espnbet",
  fanatics: "fanatics",
  fliff: "fliff",
  "hard-rock": "hard-rock",
  "bally-bet": "bally-bet",
  thescore: "thescore",
  prophetx: "prophetx",
  pinnacle: "pinnacle",
  wynnbet: "wynnbet",
};

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, "0");
}

export function computeSgpTokenHash(tokens: string[]): string {
  const normalized = [...tokens].sort().join("|");
  const hash1 = simpleHash(normalized);
  const hash2 = simpleHash(normalized.split("").reverse().join(""));
  return `${hash1}${hash2}`;
}

function getOddsBlazeBookId(bookId: string): string {
  return ODDSBLAZE_BOOK_ID_MAP[bookId] || bookId;
}

function getCacheKey(bookId: string, requestHash: string): string {
  return `${CACHE_KEY_PREFIX}:${bookId}:${requestHash}`;
}

function getLockKey(bookId: string, requestHash: string): string {
  return `${LOCK_KEY_PREFIX}:${bookId}:${requestHash}`;
}

function getRateLimitKey(scope: "global" | "book", bookId?: string): string {
  const minute = Math.floor(Date.now() / 60000);
  if (scope === "global") return `${RATE_LIMIT_KEY_PREFIX}:global:${minute}`;
  return `${RATE_LIMIT_KEY_PREFIX}:book:${bookId || "unknown"}:${minute}`;
}

async function getCacheEntry(
  bookId: string,
  requestHash: string
): Promise<{ entry: SgpVendorCacheEntry | null; stale: boolean }> {
  const cacheKey = getCacheKey(bookId, requestHash);
  const cached = await redis.get<SgpVendorCacheEntry>(cacheKey);
  if (!cached) return { entry: null, stale: false };

  const ageSeconds = (Date.now() - cached.cached_at) / 1000;

  if (ageSeconds > cached.hard_ttl_seconds) {
    await redis.del(cacheKey);
    return { entry: null, stale: false };
  }

  return { entry: cached, stale: ageSeconds > cached.soft_ttl_seconds };
}

async function setCacheEntry(
  bookId: string,
  requestHash: string,
  odds: SgpBookOdds,
  softTtlSeconds: number,
  hardTtlSeconds: number
): Promise<void> {
  const cacheKey = getCacheKey(bookId, requestHash);
  const value: SgpVendorCacheEntry = {
    odds,
    cached_at: Date.now(),
    soft_ttl_seconds: softTtlSeconds,
    hard_ttl_seconds: hardTtlSeconds,
  };
  await redis.set(cacheKey, value, { ex: hardTtlSeconds });
}

async function tryAcquireLock(lockKey: string, lockValue: string): Promise<boolean> {
  const result = await redis.set(lockKey, lockValue, { nx: true, ex: LOCK_TTL_SECONDS });
  return result === "OK";
}

async function releaseLock(lockKey: string, lockValue: string): Promise<void> {
  try {
    const current = await redis.get<string>(lockKey);
    if (current === lockValue) {
      await redis.del(lockKey);
    }
  } catch (error) {
    console.warn("[SGP Quote Service] Lock release warning:", error);
  }
}

async function waitForInFlightResult(
  bookId: string,
  requestHash: string,
  maxWaitMs: number
): Promise<{ entry: SgpVendorCacheEntry | null; stale: boolean }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const cached = await getCacheEntry(bookId, requestHash);
    if (cached.entry) {
      return cached;
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
  }
  return { entry: null, stale: false };
}

async function consumeRateLimit(bookId: string): Promise<RateLimitCheck> {
  const globalKey = getRateLimitKey("global");
  const bookKey = getRateLimitKey("book", bookId);
  const keyTtl = 120;

  const [globalCount, bookCount] = await Promise.all([
    redis.incr(globalKey),
    redis.incr(bookKey),
  ]);

  if (globalCount === 1) {
    await redis.expire(globalKey, keyTtl);
  }
  if (bookCount === 1) {
    await redis.expire(bookKey, keyTtl);
  }

  if (globalCount > SGP_VENDOR_GLOBAL_RPM || bookCount > SGP_VENDOR_PER_BOOK_RPM) {
    return { ok: false, retryAfterSeconds: 60 };
  }

  return { ok: true, retryAfterSeconds: 0 };
}

function normalizeError(message: string): SgpBookOdds {
  return { error: message };
}

function hasDuplicateTokens(tokens: string[]): boolean {
  return new Set(tokens).size !== tokens.length;
}

async function fetchFromVendor(bookId: string, sgpTokens: string[]): Promise<SgpBookOdds> {
  if (!ODDSBLAZE_API_KEY) {
    return normalizeError("API key not configured");
  }

  const oddsBlazeBookId = getOddsBlazeBookId(bookId);
  const url = `https://${oddsBlazeBookId}.sgp.oddsblaze.com/?key=${ODDSBLAZE_API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sgpTokens),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (body.includes("Invalid key")) {
        return normalizeError("Invalid API key - verify ODDSBLAZE_API_KEY");
      }
      return normalizeError(`API error: ${response.status}`);
    }

    const data: OddsBlazeResponse = await response.json();

    if (data.error || data.message) {
      return normalizeError(data.error || data.message || "No price available");
    }

    if (!data.price) {
      return normalizeError("No price available for this combination");
    }

    return {
      price: data.price,
      links: data.links,
      limits: data.limits,
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return normalizeError("Vendor timeout");
    }
    return normalizeError("Failed to fetch odds");
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSgpQuote(
  bookId: string,
  sgpTokens: string[],
  options: FetchSgpQuoteOptions = {}
): Promise<FetchSgpQuoteResult> {
  const {
    forceRefresh = false,
    allowStaleOnRateLimit = true,
    allowStaleOnLockTimeout = true,
    softTtlSeconds = DEFAULT_SOFT_TTL_SECONDS,
    hardTtlSeconds = DEFAULT_HARD_TTL_SECONDS,
  } = options;

  const requestHash = computeSgpTokenHash(sgpTokens);

  if (sgpTokens.length < 2) {
    return {
      odds: normalizeError("Not enough legs with SGP support"),
      fromCache: false,
      stale: false,
      source: "vendor",
      requestHash,
      rateLimited: false,
    };
  }

  if (hasDuplicateTokens(sgpTokens)) {
    return {
      odds: normalizeError("Duplicate selections detected"),
      fromCache: false,
      stale: false,
      source: "vendor",
      requestHash,
      rateLimited: false,
    };
  }

  const cachedBefore = await getCacheEntry(bookId, requestHash);
  if (!forceRefresh && cachedBefore.entry && !cachedBefore.stale) {
    return {
      odds: cachedBefore.entry.odds,
      fromCache: true,
      stale: false,
      source: "cache",
      requestHash,
      rateLimited: false,
    };
  }

  const lockKey = getLockKey(bookId, requestHash);
  const lockValue = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const hasLock = await tryAcquireLock(lockKey, lockValue);

  if (!hasLock) {
    const waited = await waitForInFlightResult(bookId, requestHash, WAIT_FOR_IN_FLIGHT_MS);
    if (waited.entry) {
      return {
        odds: waited.entry.odds,
        fromCache: true,
        stale: waited.stale,
        source: waited.stale ? "stale-cache" : "cache",
        requestHash,
        rateLimited: false,
      };
    }

    if (allowStaleOnLockTimeout && cachedBefore.entry) {
      return {
        odds: cachedBefore.entry.odds,
        fromCache: true,
        stale: cachedBefore.stale,
        source: cachedBefore.stale ? "stale-cache" : "cache",
        requestHash,
        rateLimited: false,
      };
    }

    return {
      odds: normalizeError("Quote request already in progress"),
      fromCache: false,
      stale: false,
      source: "in-flight",
      requestHash,
      rateLimited: false,
    };
  }

  try {
    if (!forceRefresh) {
      const cachedAfterLock = await getCacheEntry(bookId, requestHash);
      if (cachedAfterLock.entry && !cachedAfterLock.stale) {
        return {
          odds: cachedAfterLock.entry.odds,
          fromCache: true,
          stale: false,
          source: "cache",
          requestHash,
          rateLimited: false,
        };
      }
    }

    const rateLimit = await consumeRateLimit(bookId);
    if (!rateLimit.ok) {
      if (allowStaleOnRateLimit && cachedBefore.entry) {
        return {
          odds: cachedBefore.entry.odds,
          fromCache: true,
          stale: true,
          source: "stale-cache",
          requestHash,
          rateLimited: true,
        };
      }

      return {
        odds: normalizeError(`Rate limited, retry in ${rateLimit.retryAfterSeconds}s`),
        fromCache: false,
        stale: false,
        source: "rate-limited",
        requestHash,
        rateLimited: true,
      };
    }

    const odds = await fetchFromVendor(bookId, sgpTokens);
    const isNegative = Boolean(odds.error);

    await setCacheEntry(
      bookId,
      requestHash,
      odds,
      isNegative ? NEGATIVE_SOFT_TTL_SECONDS : softTtlSeconds,
      isNegative ? NEGATIVE_HARD_TTL_SECONDS : hardTtlSeconds
    );

    return {
      odds,
      fromCache: false,
      stale: false,
      source: "vendor",
      requestHash,
      rateLimited: false,
    };
  } finally {
    await releaseLock(lockKey, lockValue);
  }
}
