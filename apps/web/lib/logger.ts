/**
 * Production-grade logger without third-party dependencies
 * Logs to console in dev, can be extended to log to your own API endpoint
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development'
  private logEndpoint = '/api/logs' // Optional: send to your own endpoint

  private formatMessage(level: LogLevel, message: string, context?: LogContext) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      environment: process.env.NODE_ENV,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    }
  }

  private async sendToServer(logData: any) {
    // Only send errors and warnings to server in production
    if (!this.isDev && (logData.level === 'error' || logData.level === 'warn')) {
      try {
        await fetch(this.logEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData),
        })
      } catch (e) {
        // Silently fail - don't want logging to break the app
        console.error('Failed to send log to server:', e)
      }
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      const logData = this.formatMessage('debug', message, context)
      console.debug(`[DEBUG] ${message}`, context || '')
    }
  }

  info(message: string, context?: LogContext) {
    const logData = this.formatMessage('info', message, context)
    if (this.isDev) {
      console.info(`[INFO] ${message}`, context || '')
    }
    this.sendToServer(logData)
  }

  warn(message: string, context?: LogContext) {
    const logData = this.formatMessage('warn', message, context)
    console.warn(`[WARN] ${message}`, context || '')
    this.sendToServer(logData)
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const logData = this.formatMessage('error', message, {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    })
    console.error(`[ERROR] ${message}`, error, context || '')
    this.sendToServer(logData)
  }

  // Performance tracking
  metric(name: string, value: number, context?: LogContext) {
    const logData = {
      type: 'metric',
      name,
      value,
      timestamp: new Date().toISOString(),
      context,
    }
    
    if (this.isDev) {
      console.log(`[METRIC] ${name}: ${value}ms`, context || '')
    }
    
    this.sendToServer(logData)
  }
}

export const logger = new Logger()

// Helper for timing operations
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>,
  context?: LogContext
): T | Promise<T> {
  const start = performance.now()
  
  try {
    const result = fn()
    
    if (result instanceof Promise) {
      return result.then((value) => {
        const duration = performance.now() - start
        logger.metric(name, duration, context)
        return value
      }).catch((error) => {
        const duration = performance.now() - start
        logger.error(`${name} failed`, error, { ...context, duration })
        throw error
      }) as T
    }
    
    const duration = performance.now() - start
    logger.metric(name, duration, context)
    return result
  } catch (error) {
    const duration = performance.now() - start
    logger.error(`${name} failed`, error, { ...context, duration })
    throw error
  }
}

