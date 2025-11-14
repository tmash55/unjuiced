/**
 * Adapter to transform new props API format to OddsTableItem format
 * This ensures the table component works with the modern pub/sub architecture
 */

import type { OddsScreenItem, OddsPrice } from '@/components/odds-screen/types/odds-screen-types'

// New API row format from props:{sport}:rows:prim
export interface PropsRow {
  sid?: string
  eid: string // Event ID
  ent: string // Entity ID (e.g., "pid:00-0039732" or "game")
  player: string | null // Player name
  team: string | null // Team abbreviation
  position: string | null // Player position
  mkt: string // Market name
  ln: number // Primary line
  ev: {
    // Event info
    dt: string // ISO timestamp
    live: boolean
    home: {
      id: string
      name: string
      abbr: string
    }
    away: {
      id: string
      name: string
      abbr: string
    }
  }
  best?: {
    over?: {
      bk: string // Sportsbook key
      price: number
    }
    under?: {
      bk: string // Sportsbook key
      price: number
    }
  }
  avg?: {
    over?: number
    under?: number
  }
  books?: Record<
    string,
    {
      over?: {
        price: number
        line: number
        u: string // URL
        m?: string // Mobile URL
        limit_max?: number | null
      }
      under?: {
        price: number
        line: number
        u: string // URL
        m?: string // Mobile URL
        limit_max?: number | null
      }
    }
  >
  ts?: number // Timestamp
}

// New API response format
export interface PropsTableResponse {
  sids: string[]
  rows: PropsRow[]
  nextCursor: string | null
}

/**
 * Transform a single props row to OddsScreenItem format
 */
export function transformPropsRowToOddsItem(
  row: PropsRow,
  type: 'player' | 'game'
): OddsScreenItem {
  // Parse entity ID
  const entityId = row.ent.includes(':') ? row.ent.split(':')[1] : row.ent
  const isPlayer = type === 'player' || row.ent.startsWith('pid:')

  // Build entity
  // Normalize market details for game rows so downstream UI can make consistent decisions
  const marketKey = (row.mkt || '').toString().toLowerCase()
  const normalizedDetails = isPlayer
    ? undefined
    : marketKey.includes('moneyline')
      ? 'Moneyline'
      : marketKey.includes('spread')
        ? 'Point Spread'
        : marketKey.includes('total')
          ? 'Total Points'
          : undefined

  const entity: OddsScreenItem['entity'] = isPlayer
    ? {
        type: 'player',
        name: row.player || 'Unknown Player',
        details: row.position || row.team || undefined,
        id: entityId,
      }
    : {
        type: 'game',
        name: `${row.ev.away.abbr} @ ${row.ev.home.abbr}`,
        details: normalizedDetails,
      }

  // Build event
  const event: OddsScreenItem['event'] = {
    id: row.eid,
    startTime: row.ev.dt,
    homeTeam: row.ev.home.abbr,
    awayTeam: row.ev.away.abbr,
    homeName: row.ev.home.name,
    awayName: row.ev.away.name,
  }

  // Build odds
  const isMoneyline = marketKey.includes('moneyline') || row.ln === 0
  const isSpread = marketKey.includes('spread')
  const isTotal = marketKey.includes('total')
  const odds: OddsScreenItem['odds'] = {
    best: {
      over: row.best?.over
        ? {
            price: row.best.over.price,
            line: row.ln,
            book: row.best.over.bk,
            link: row.books?.[row.best.over.bk]?.over?.u || null,
          }
        : undefined,
      under: row.best?.under
        ? {
            price: row.best.under.price,
            line: row.ln,
            book: row.best.under.bk,
            link: row.books?.[row.best.under.bk]?.under?.u || null,
          }
        : undefined,
    },
    average: {
      over: row.avg?.over
        ? {
            price: row.avg.over,
            line: isMoneyline ? 0 : row.ln,
          }
        : undefined,
      under: row.avg?.under
        ? {
            price: row.avg.under,
            line: isMoneyline ? 0 : row.ln,
          }
        : undefined,
    },
    opening: {}, // Not available in new format yet
    books: {},
    normalized: {
      marketKind: isMoneyline ? 'moneyline' : isSpread ? 'spread' : isTotal ? 'total' : 'other',
      displayOrder: isMoneyline || isSpread ? ['away','home'] : undefined,
      // For our UI, away should be treated as the top row.
      // We align helper-side mapping so that calling code can still reuse over/under-based helpers when needed.
      // Convention: for team markets, map away -> 'under', home -> 'over'
      sideMap: isMoneyline || isSpread ? { away: 'under', home: 'over' } : undefined,
      books: {},
      best: {},
      average: {},
    },
  }

  // Transform books
  if (row.books) {
    // Normalize book keys to match our canonical sportsbook IDs
    const normalizeBookId = (id: string): string => {
      const lower = id.toLowerCase()
      switch (lower) {
        case 'hardrock': return 'hard-rock'
        case 'ballybet': return 'bally-bet'
        case 'sportsinteraction': return 'sports-interaction'
        default: return lower
      }
    }
    Object.entries(row.books).forEach(([bookId, bookData]) => {
      const canonicalId = normalizeBookId(bookId)
      
      // Debug logging for limit_max (development only)
      if (process.env.NODE_ENV === 'development' && (bookData.over?.limit_max || bookData.under?.limit_max)) {
        console.log(`[ADAPTER] ${canonicalId} has limit_max:`, {
          over: bookData.over?.limit_max,
          under: bookData.under?.limit_max
        })
      }
      
      const over: OddsPrice | undefined = bookData.over
        ? { 
            price: bookData.over.price, 
            line: isMoneyline ? 0 : bookData.over.line, 
            link: bookData.over.u || bookData.over.m || null,
            mobileLink: bookData.over.m || null,
            limit_max: bookData.over.limit_max
          }
        : undefined
      const under: OddsPrice | undefined = bookData.under
        ? { 
            price: bookData.under.price, 
            line: isMoneyline ? 0 : bookData.under.line, 
            link: bookData.under.u || bookData.under.m || null,
            mobileLink: bookData.under.m || null,
            limit_max: bookData.under.limit_max
          }
        : undefined

      odds.books[canonicalId] = {
        over: bookData.over
          ? over
          : undefined,
        under: bookData.under
          ? under
          : undefined,
      }

      // Fill normalized books
      if (odds.normalized) {
        const n = odds.normalized
        n.books[canonicalId] = n.books[canonicalId] || {}
        if (n.marketKind === 'moneyline' || n.marketKind === 'spread') {
          // Map away/home explicitly; away corresponds to 'under' side per our UI convention
          if (under) n.books[canonicalId].away = under
          if (over) n.books[canonicalId].home = over
        } else if (n.marketKind === 'total') {
          if (over) n.books[canonicalId].over = over
          if (under) n.books[canonicalId].under = under
        }
      }
    })
  }

  // Generate unique ID - use SID if available, otherwise create from event+entity+market+line
  // This ensures each unique prop (player + market + line) gets a unique ID
  const uniqueId = row.sid || `${row.eid}-${entityId}-${row.mkt}-${row.ln}`
  
  const item: OddsScreenItem = {
    id: uniqueId,
    entity,
    event,
    odds,
  }

  // Fill normalized best/average
  if (odds.normalized) {
    const n = odds.normalized
    if (n.marketKind === 'moneyline' || n.marketKind === 'spread') {
      // Side convention: away = 'under', home = 'over'
      if (odds.best.under) n.best!.away = odds.best.under
      if (odds.best.over) n.best!.home = odds.best.over
      if (odds.average.under) n.average!.away = odds.average.under
      if (odds.average.over) n.average!.home = odds.average.over
    } else if (n.marketKind === 'total') {
      if (odds.best.over) n.best!.over = odds.best.over
      if (odds.best.under) n.best!.under = odds.best.under
      if (odds.average.over) n.average!.over = odds.average.over
      if (odds.average.under) n.average!.under = odds.average.under
    }
  }

  return item
}

/**
 * Transform props table response to odds screen format
 */
export function transformPropsResponseToOddsScreen(
  response: PropsTableResponse,
  type: 'player' | 'game'
): OddsScreenItem[] {
  // Attach SIDs to rows for better ID generation
  const rowsWithSids = response.rows.map((row, index) => ({
    ...row,
    sid: row.sid || response.sids[index],
  }))
  
  const items = rowsWithSids
    .map((row) => {
      try {
        return transformPropsRowToOddsItem(row, type)
      } catch (error) {
        console.error('[ADAPTER] Error transforming row:', error, row)
        return null
      }
    })
    .filter((item): item is OddsScreenItem => item !== null)
  
  // Deduplicate by entity + event (for player props) or event + market (for game markets)
  // This ensures only one row per player/game per market is shown
  const seen = new Map<string, OddsScreenItem>()
  const duplicatesByEntity = new Map<string, number>()
  
  items.forEach(item => {
    // Create deduplication key based on type
    let dedupeKey: string
    if (type === 'player' && item.entity.type === 'player') {
      // For player props: dedupe by event + entity (player)
      dedupeKey = `${item.event.id}-${item.entity.id}`
    } else {
      // For game markets: dedupe by event + market kind
      const marketKind = item.odds.normalized?.marketKind || 'other'
      dedupeKey = `${item.event.id}-${marketKind}`
    }
    
    if (!seen.has(dedupeKey)) {
      seen.set(dedupeKey, item)
    } else {
      // Track duplicates for logging
      duplicatesByEntity.set(dedupeKey, (duplicatesByEntity.get(dedupeKey) || 1) + 1)
    }
  })
  
  // Log duplicates if any were found
  if (duplicatesByEntity.size > 0) {
    const totalDuplicates = Array.from(duplicatesByEntity.values()).reduce((sum, count) => sum + count, 0)
    console.warn(`[ADAPTER] Removed ${totalDuplicates} duplicate rows (multiple primary lines for same player/game)`)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[ADAPTER] Duplicates by entity:', Array.from(duplicatesByEntity.entries()).slice(0, 5))
      console.warn('[ADAPTER] This indicates duplicate SIDs in Redis. Check DUPLICATE_ROWS_DEBUG.md for diagnosis.')
    }
  }
  
  // Return deduplicated items
  return Array.from(seen.values())
}

/**
 * Fetch odds using new props API with transformation
 */
export async function fetchOddsWithNewAPI(params: {
  sport: string
  market: string
  scope: 'pregame' | 'live'
  type: 'player' | 'game'
  limit?: number
}): Promise<{ data: OddsScreenItem[]; nextCursor: string | null }> {
  const { sport, market, scope, type, limit = 300 } = params

  const url = `/api/props/table?sport=${encodeURIComponent(sport)}&market=${encodeURIComponent(
    market
  )}&scope=${encodeURIComponent(scope)}&limit=${limit}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch odds: ${response.status} ${response.statusText}`)
  }

  const propsResponse: PropsTableResponse = await response.json()

  // Transform to OddsScreenItem format
  const data = transformPropsResponseToOddsScreen(propsResponse, type)

  return {
    data,
    nextCursor: propsResponse.nextCursor,
  }
}

