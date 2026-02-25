export type RedisEndpointConfig = {
  url: string | null;
  token: string | null;
  usingDedicated: boolean;
  partialDedicatedConfig: boolean;
  usedFallback: boolean;
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
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
