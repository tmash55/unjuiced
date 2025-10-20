/**
 * Example unit tests using Jest (comes with Next.js)
 * Run with: npm test
 */

import {
  validateSport,
  validateScope,
  validateType,
  validateMarket,
  validateStringArray,
  validateNumber,
  ValidationError,
} from '../validation'

describe('Validation', () => {
  describe('validateSport', () => {
    it('should accept valid sports', () => {
      expect(validateSport('nfl')).toBe('nfl')
      expect(validateSport('NBA')).toBe('nba')
      expect(validateSport('MLB')).toBe('mlb')
    })

    it('should reject invalid sports', () => {
      expect(() => validateSport('soccer')).toThrow(ValidationError)
      expect(() => validateSport(123)).toThrow(ValidationError)
      expect(() => validateSport(null)).toThrow(ValidationError)
    })
  })

  describe('validateScope', () => {
    it('should accept valid scopes', () => {
      expect(validateScope('pregame')).toBe('pregame')
      expect(validateScope('LIVE')).toBe('live')
    })

    it('should reject invalid scopes', () => {
      expect(() => validateScope('future')).toThrow(ValidationError)
    })
  })

  describe('validateType', () => {
    it('should accept valid types', () => {
      expect(validateType('player')).toBe('player')
      expect(validateType('GAME')).toBe('game')
    })

    it('should reject invalid types', () => {
      expect(() => validateType('team')).toThrow(ValidationError)
    })
  })

  describe('validateMarket', () => {
    it('should accept valid markets', () => {
      expect(validateMarket('h2h')).toBe('h2h')
      expect(validateMarket('spreads')).toBe('spreads')
    })

    it('should reject invalid markets', () => {
      expect(() => validateMarket('')).toThrow(ValidationError)
      expect(() => validateMarket('a'.repeat(101))).toThrow(ValidationError)
      expect(() => validateMarket(123)).toThrow(ValidationError)
    })
  })

  describe('validateStringArray', () => {
    it('should accept valid string arrays', () => {
      expect(validateStringArray(['a', 'b'], 'test')).toEqual(['a', 'b'])
      expect(validateStringArray([], 'test')).toEqual([])
    })

    it('should reject invalid arrays', () => {
      expect(() => validateStringArray('not-array', 'test')).toThrow(ValidationError)
      expect(() => validateStringArray([1, 2], 'test')).toThrow(ValidationError)
      expect(() => validateStringArray(['a', 1], 'test')).toThrow(ValidationError)
    })
  })

  describe('validateNumber', () => {
    it('should accept valid numbers', () => {
      expect(validateNumber(5, 'test')).toBe(5)
      expect(validateNumber(0, 'test')).toBe(0)
      expect(validateNumber(-5, 'test')).toBe(-5)
    })

    it('should respect min/max constraints', () => {
      expect(validateNumber(5, 'test', { min: 0, max: 10 })).toBe(5)
      expect(() => validateNumber(-1, 'test', { min: 0 })).toThrow(ValidationError)
      expect(() => validateNumber(11, 'test', { max: 10 })).toThrow(ValidationError)
    })

    it('should reject invalid numbers', () => {
      expect(() => validateNumber('5', 'test')).toThrow(ValidationError)
      expect(() => validateNumber(NaN, 'test')).toThrow(ValidationError)
    })
  })
})

