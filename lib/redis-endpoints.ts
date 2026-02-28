export type RedisEndpointConfig = {
  url: string | null;
  token: string | null;
  usingDedicated: boolean;
  partialDedicatedConfig: boolean;
  usedFallback: boolean;
};

export type ResolvedRedisEndpoint = {
  url: string | null;
  token: string | null;
  source: "dedicated" | "rest" | "none";
  rejectedLoopback: boolean;
  partialDedicatedConfig: boolean;
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0.0.0.0"
  );
}

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return isLoopbackHost(parsed.hostname);
  } catch {
    // Non-URL strings are treated as non-loopback; downstream client will validate.
    return false;
  }
}

function shouldDisallowLoopback(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

export function getRedisCommandEndpoint(): RedisEndpointConfig {
  const dedicatedUrl = readEnv("UPSTASH_REDIS_COMMAND_URL");
  const dedicatedToken = readEnv("UPSTASH_REDIS_COMMAND_TOKEN");
  const dedicatedReady = Boolean(dedicatedUrl && dedicatedToken);
  const partialDedicatedConfig = Boolean(dedicatedUrl || dedicatedToken) && !dedicatedReady;

  if (dedicatedReady) {
    return {
      url: dedicatedUrl,
      token: dedicatedToken,
      usingDedicated: true,
      partialDedicatedConfig: false,
      usedFallback: false,
    };
  }

  const url = readEnv("UPSTASH_REDIS_REST_URL");
  const token = readEnv("UPSTASH_REDIS_REST_TOKEN");
  return {
    url,
    token,
    usingDedicated: false,
    partialDedicatedConfig,
    usedFallback: true,
  };
}

/**
 * Resolve the effective command endpoint with production safety checks.
 *
 * In production environments we reject loopback endpoints (localhost/127.0.0.1),
 * because serverless runtimes cannot reach local tunnel addresses.
 */
export function resolveRedisCommandEndpoint(): ResolvedRedisEndpoint {
  const dedicatedUrl = readEnv("UPSTASH_REDIS_COMMAND_URL");
  const dedicatedToken = readEnv("UPSTASH_REDIS_COMMAND_TOKEN");
  const restUrl = readEnv("UPSTASH_REDIS_REST_URL");
  const restToken = readEnv("UPSTASH_REDIS_REST_TOKEN");

  const disallowLoopback = shouldDisallowLoopback();
  let rejectedLoopback = false;

  const usable = (url: string | null, token: string | null): boolean => {
    if (!url || !token) return false;
    if (disallowLoopback && isLoopbackUrl(url)) {
      rejectedLoopback = true;
      return false;
    }
    return true;
  };

  if (usable(dedicatedUrl, dedicatedToken)) {
    return {
      url: dedicatedUrl,
      token: dedicatedToken,
      source: "dedicated",
      rejectedLoopback,
      partialDedicatedConfig: false,
    };
  }

  if (usable(restUrl, restToken)) {
    return {
      url: restUrl,
      token: restToken,
      source: "rest",
      rejectedLoopback,
      partialDedicatedConfig: Boolean(dedicatedUrl || dedicatedToken) && !(dedicatedUrl && dedicatedToken),
    };
  }

  return {
    url: null,
    token: null,
    source: "none",
    rejectedLoopback,
    partialDedicatedConfig: Boolean(dedicatedUrl || dedicatedToken) && !(dedicatedUrl && dedicatedToken),
  };
}

export function getRedisPubSubEndpoint(): RedisEndpointConfig {
  const dedicatedUrl = readEnv("UPSTASH_REDIS_PUBSUB_URL");
  const dedicatedToken = readEnv("UPSTASH_REDIS_PUBSUB_TOKEN");
  const dedicatedReady = Boolean(dedicatedUrl && dedicatedToken);
  const partialDedicatedConfig = Boolean(dedicatedUrl || dedicatedToken) && !dedicatedReady;
  const allowFallback = readEnv("UPSTASH_REDIS_PUBSUB_FALLBACK_TO_COMMAND") === "true";

  if (dedicatedReady) {
    return {
      url: dedicatedUrl,
      token: dedicatedToken,
      usingDedicated: true,
      partialDedicatedConfig: false,
      usedFallback: false,
    };
  }

  if (allowFallback) {
    const fallback = getRedisCommandEndpoint();
    return {
      url: fallback.url,
      token: fallback.token,
      usingDedicated: false,
      partialDedicatedConfig,
      usedFallback: true,
    };
  }

  return {
    url: null,
    token: null,
    usingDedicated: false,
    partialDedicatedConfig,
    usedFallback: false,
  };
}

/**
 * Resolve pub/sub endpoint with production safety checks.
 *
 * In production, loopback pub/sub URLs are rejected. If explicit pub/sub
 * credentials are unavailable and fallback is enabled, this will use the
 * resolved command endpoint.
 */
export function resolveRedisPubSubEndpoint(): ResolvedRedisEndpoint {
  const dedicatedUrl = readEnv("UPSTASH_REDIS_PUBSUB_URL");
  const dedicatedToken = readEnv("UPSTASH_REDIS_PUBSUB_TOKEN");
  const allowFallback = readEnv("UPSTASH_REDIS_PUBSUB_FALLBACK_TO_COMMAND") === "true";
  const disallowLoopback = shouldDisallowLoopback();
  let rejectedLoopback = false;

  const usableDedicated = (): boolean => {
    if (!dedicatedUrl || !dedicatedToken) return false;
    if (disallowLoopback && isLoopbackUrl(dedicatedUrl)) {
      rejectedLoopback = true;
      return false;
    }
    return true;
  };

  if (usableDedicated()) {
    return {
      url: dedicatedUrl,
      token: dedicatedToken,
      source: "dedicated",
      rejectedLoopback,
      partialDedicatedConfig: false,
    };
  }

  if (allowFallback) {
    const command = resolveRedisCommandEndpoint();
    return {
      url: command.url,
      token: command.token,
      source: command.source === "none" ? "none" : "rest",
      rejectedLoopback: rejectedLoopback || command.rejectedLoopback,
      partialDedicatedConfig: Boolean(dedicatedUrl || dedicatedToken) && !(dedicatedUrl && dedicatedToken),
    };
  }

  return {
    url: null,
    token: null,
    source: "none",
    rejectedLoopback,
    partialDedicatedConfig: Boolean(dedicatedUrl || dedicatedToken) && !(dedicatedUrl && dedicatedToken),
  };
}
