/**
 * Simple in-memory rate limiter (no Redis needed for small scale)
 * For production scale, use Upstash Redis (free tier: 10k requests/day)
 */

interface RateLimitConfig {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max requests per interval
}

class RateLimiter {
  private cache: Map<string, number[]> = new Map()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
    
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, timestamps] of this.cache.entries()) {
      const validTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < this.config.interval
      )
      if (validTimestamps.length === 0) {
        this.cache.delete(key)
      } else {
        this.cache.set(key, validTimestamps)
      }
    }
  }

  async limit(identifier: string): Promise<{ success: boolean; remaining: number }> {
    const now = Date.now()
    const timestamps = this.cache.get(identifier) || []

    // Filter out old timestamps
    const validTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < this.config.interval
    )

    if (validTimestamps.length >= this.config.uniqueTokenPerInterval) {
      return {
        success: false,
        remaining: 0,
      }
    }

    // Add current timestamp
    validTimestamps.push(now)
    this.cache.set(identifier, validTimestamps)

    return {
      success: true,
      remaining: this.config.uniqueTokenPerInterval - validTimestamps.length,
    }
  }

  async reset(identifier: string) {
    this.cache.delete(identifier)
  }
}

// Create rate limiters for different endpoints
export const apiRateLimit = new RateLimiter({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 60, // 60 requests per minute
})

export const sseRateLimit = new RateLimiter({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 10, // 10 SSE connections per minute
})

export const authRateLimit = new RateLimiter({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 5, // 5 auth attempts per 15 minutes
})

// Helper to get identifier from request
export function getIdentifier(req: Request): string {
  // Try to get user ID from auth
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  if (userId) return `user:${userId}`

  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  return `ip:${ip}`
}

// Middleware wrapper
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  limiter: RateLimiter = apiRateLimit
) {
  return async (req: Request) => {
    const identifier = getIdentifier(req)
    const { success, remaining } = await limiter.limit(identifier)

    if (!success) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Please slow down and try again later',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
          },
        }
      )
    }

    const response = await handler(req)
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    
    return response
  }
}

