/**
 * Simple request validation without Zod (to avoid dependencies)
 * For production, consider adding Zod: npm install zod
 */

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Sport validation
const VALID_SPORTS = [
  'nfl',
  'nba',
  'mlb',
  'ncaabaseball',
  'nhl',
  'ncaaf',
  'ncaab',
  'wnba',
  'soccer_epl',
  'soccer_laliga',
  'soccer_mls',
  'soccer_ucl',
  'soccer_uel',
  'tennis_atp',
  'tennis_challenger',
  'tennis_itf_men',
  'tennis_itf_women',
  'tennis_utr_men',
  'tennis_utr_women',
  'tennis_wta',
  'ufc',
] as const
export type ValidSport = typeof VALID_SPORTS[number]

export function validateSport(sport: unknown): ValidSport {
  if (typeof sport !== 'string') {
    throw new ValidationError('Sport must be a string', 'sport')
  }
  
  const normalized = sport.toLowerCase()
  if (!VALID_SPORTS.includes(normalized as ValidSport)) {
    throw new ValidationError(
      `Invalid sport. Must be one of: ${VALID_SPORTS.join(', ')}`,
      'sport'
    )
  }
  
  return normalized as ValidSport
}

// Scope validation
const VALID_SCOPES = ['pregame', 'live'] as const
export type ValidScope = typeof VALID_SCOPES[number]

export function validateScope(scope: unknown): ValidScope {
  if (typeof scope !== 'string') {
    throw new ValidationError('Scope must be a string', 'scope')
  }
  
  const normalized = scope.toLowerCase()
  if (!VALID_SCOPES.includes(normalized as ValidScope)) {
    throw new ValidationError(
      `Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}`,
      'scope'
    )
  }
  
  return normalized as ValidScope
}

// Type validation
const VALID_TYPES = ['player', 'game'] as const
export type ValidType = typeof VALID_TYPES[number]

export function validateType(type: unknown): ValidType {
  if (typeof type !== 'string') {
    throw new ValidationError('Type must be a string', 'type')
  }
  
  const normalized = type.toLowerCase()
  if (!VALID_TYPES.includes(normalized as ValidType)) {
    throw new ValidationError(
      `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
      'type'
    )
  }
  
  return normalized as ValidType
}

// Market validation
export function validateMarket(market: unknown): string {
  if (typeof market !== 'string') {
    throw new ValidationError('Market must be a string', 'market')
  }
  
  if (market.length === 0 || market.length > 100) {
    throw new ValidationError('Market must be between 1 and 100 characters', 'market')
  }
  
  return market
}

// Array validation
export function validateStringArray(arr: unknown, fieldName: string): string[] {
  if (!Array.isArray(arr)) {
    throw new ValidationError(`${fieldName} must be an array`, fieldName)
  }
  
  if (!arr.every(item => typeof item === 'string')) {
    throw new ValidationError(`${fieldName} must be an array of strings`, fieldName)
  }
  
  return arr
}

// Number validation
export function validateNumber(
  value: unknown,
  fieldName: string,
  options?: { min?: number; max?: number }
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName)
  }
  
  if (options?.min !== undefined && value < options.min) {
    throw new ValidationError(
      `${fieldName} must be at least ${options.min}`,
      fieldName
    )
  }
  
  if (options?.max !== undefined && value > options.max) {
    throw new ValidationError(
      `${fieldName} must be at most ${options.max}`,
      fieldName
    )
  }
  
  return value
}

// Helper to validate query params from URL
export function validateQueryParams<T extends Record<string, unknown>>(
  searchParams: URLSearchParams,
  validators: Record<keyof T, (value: unknown) => any>
): T {
  const result = {} as T
  
  for (const [key, validator] of Object.entries(validators)) {
    const value = searchParams.get(key)
    try {
      result[key as keyof T] = validator(value)
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new ValidationError(`Invalid ${key}`, key)
    }
  }
  
  return result
}

// Wrapper for API routes with validation
export function withValidation<T extends Record<string, unknown>>(
  validators: Record<keyof T, (value: unknown) => any>,
  handler: (req: Request, params: T) => Promise<Response>
) {
  return async (req: Request) => {
    try {
      const { searchParams } = new URL(req.url)
      const params = validateQueryParams<T>(searchParams, validators)
      return await handler(req, params)
    } catch (error) {
      if (error instanceof ValidationError) {
        return new Response(
          JSON.stringify({
            error: 'Validation Error',
            message: error.message,
            field: error.field,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Internal Server Error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}
