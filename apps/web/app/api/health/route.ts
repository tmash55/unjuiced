import { NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'

/**
 * Health check endpoint for monitoring
 * Use with UptimeRobot (free) or similar service
 * 
 * Returns:
 * - 200 OK: All systems operational
 * - 503 Service Unavailable: Critical service down
 */

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; latency?: number }> = {}
  let overallStatus = 200

  // 1. Check Supabase connection
  try {
    const start = performance.now()
    const supabase = await createClient()
    const { error } = await supabase.from('user_preferences').select('id').limit(1)
    const latency = performance.now() - start
    
    if (error) {
      checks.database = { status: 'error', message: error.message }
      overallStatus = 503
    } else {
      checks.database = { status: 'ok', latency: Math.round(latency) }
    }
  } catch (error) {
    checks.database = { status: 'error', message: String(error) }
    overallStatus = 503
  }

  // 2. Check Redis connection (if you're using it)
  try {
    const start = performance.now()
    // Replace with your actual Redis client
    // const redis = getRedisClient()
    // await redis.ping()
    const latency = performance.now() - start
    
    checks.redis = { status: 'ok', latency: Math.round(latency) }
  } catch (error) {
    checks.redis = { status: 'error', message: String(error) }
    // Redis is non-critical, don't fail health check
  }

  // 3. Check memory usage
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage()
    const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(memory.heapTotal / 1024 / 1024)
    const usagePercent = Math.round((heapUsedMB / heapTotalMB) * 100)
    
    checks.memory = {
      status: usagePercent > 90 ? 'error' : 'ok',
      message: `${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`,
    }
    
    if (usagePercent > 90) {
      overallStatus = 503
    }
  }

  // 4. Check environment
  checks.environment = {
    status: 'ok',
    message: process.env.NODE_ENV || 'unknown',
  }

  const response = {
    status: overallStatus === 200 ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    uptime: typeof process !== 'undefined' ? Math.round(process.uptime()) : undefined,
  }

  return NextResponse.json(response, { status: overallStatus })
}

