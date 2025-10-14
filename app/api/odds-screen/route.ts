import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { redis } from "@/lib/redis";

// Validation schema for request parameters
const RequestSchema = z.object({
  sport: z.string().min(1, 'Sport is required'),
  type: z.enum(['player', 'game'], { 
    errorMap: () => ({ message: 'Type must be either "player" or "game"' })
  }),
  market: z.string().min(1, 'Market is required'),
  scope: z.enum(['pregame', 'live'], {
    errorMap: () => ({ message: 'Scope must be either "pregame" or "live"' })
  }),
  gameId: z.string().nullable().optional(),
  search: z.string().nullable().optional(),
})

type RequestParams = z.infer<typeof RequestSchema>

// Response interfaces
interface OddsScreenResponse {
  success: boolean
  metadata: {
    sport: string
    type: 'player' | 'game'
    market: string
    scope: string
    lastUpdated: string
    totalCount: number
    filteredCount?: number
  }
  data: OddsScreenItem[]
}

interface OddsScreenItem {
  id: string
  entity: {
    type: 'player' | 'game'
    name: string
    details?: string
    id?: string // Added for player alternates
  }
  event: {
    id: string
    startTime: string
    homeTeam: string
    awayTeam: string
  }
  odds: {
    best: {
      over?: { price: number, line: number, book: string, link?: string | null}
      under?: { price: number, line: number, book: string, link?: string | null}
    }
    average: {
      over?: { price: number, line: number }
      under?: { price: number, line: number }
    }
    opening: {
      over?: { price: number, line: number }
      under?: { price: number, line: number }
    }
    books: Record<string, {
      over?: { price: number, line: number, link?: string | null}
      under?: { price: number, line: number, link?: string | null}
    }>
  }
}

// Helper function to build Redis key
function buildRedisKey(params: {
  sport: string
  type: 'player' | 'game'
  market: string
  scope: string
}): string {
  const { sport, type, market, scope } = params
  
  if (type === 'player') {
    return `odds:${sport}:props:${market}:primary:${scope}`
  } else {
    return `odds:${sport}:props:${market}:game:primary:${scope}`
  }
}

// Helper function to transform player prop data
function transformPlayerProp(
  playerId: string,
  playerData: any,
  eventBundle: any,
  eventId: string
): OddsScreenItem {
  const eventInfo = eventBundle.event || {}
  
  const entity = {
    type: 'player' as const,
    name: playerData.name || 'Unknown Player',
    details: playerData.position || undefined,
    team: playerData.team || undefined,
    id: playerId
  }

  const event = {
    id: eventId,
    startTime: eventInfo.start || '',
    homeTeam: eventInfo.home || '',
    awayTeam: eventInfo.away || ''
  }

  // Extract best odds from Redis best block
  const best: OddsScreenItem['odds']['best'] = {}
  if (playerData.best?.over) {
    best.over = {
      price: playerData.best.over.price,
      line: playerData.best.over.line,
      book: playerData.best.over.book,
      link: playerData.best.over.links?.desktop || null
    }
  }
  if (playerData.best?.under) {
    best.under = {
      price: playerData.best.under.price,
      line: playerData.best.under.line,
      book: playerData.best.under.book,
      link: playerData.best.under.links?.desktop || null
    }
  }

  // Extract average odds from metrics
  const average: OddsScreenItem['odds']['average'] = {}
  if (playerData.metrics?.over) {
    average.over = {
      price: Math.round(playerData.metrics.over.avg_price || 0),
      line: playerData.primary_line
    }
  }
  if (playerData.metrics?.under) {
    average.under = {
      price: Math.round(playerData.metrics.under.avg_price || 0),
      line: playerData.primary_line
    }
  }

  // TODO: Add opening odds when available in Redis data
  const opening: OddsScreenItem['odds']['opening'] = {}

  // Transform sportsbook data - for player props, books is Record<string, PlayerTotalsQuote>
  const books: Record<string, any> = {}
  
  Object.entries(playerData.books || {}).forEach(([bookId, bookData]: [string, any]) => {
    books[bookId] = {}
    
    if (bookData.over) {
      books[bookId].over = {
        price: bookData.over.price,
        line: bookData.over.line,
        link: bookData.over.links?.desktop || null
      }
    }
    
    if (bookData.under) {
      books[bookId].under = {
        price: bookData.under.price,
        line: bookData.under.line,
        link: bookData.under.links?.desktop || null
      }
    }
  })

  return {
    id: `${eventId}-${playerId}`,
    entity,
    event,
    odds: { best, average, opening, books }
  }
}

// Helper function to get team name from abbreviation
function getTeamName(teamAbbr: string, sport: string): string {
  // NFL Team mappings
  const nflTeamMap: Record<string, string> = {
    'MIA': 'Miami Dolphins',
    'NYJ': 'New York Jets',
    'BUF': 'Buffalo Bills',
    'NE': 'New England Patriots',
    'BAL': 'Baltimore Ravens',
    'CIN': 'Cincinnati Bengals',
    'CLE': 'Cleveland Browns',
    'PIT': 'Pittsburgh Steelers',
    'TEN': 'Tennessee Titans',
    'IND': 'Indianapolis Colts',
    'HOU': 'Houston Texans',
    'JAX': 'Jacksonville Jaguars',
    'KC': 'Kansas City Chiefs',
    'LV': 'Las Vegas Raiders',
    'LAC': 'Los Angeles Chargers',
    'DEN': 'Denver Broncos',
    'DAL': 'Dallas Cowboys',
    'NYG': 'New York Giants',
    'PHI': 'Philadelphia Eagles',
    'WAS': 'Washington Commanders',
    'GB': 'Green Bay Packers',
    'CHI': 'Chicago Bears',
    'MIN': 'Minnesota Vikings',
    'DET': 'Detroit Lions',
    'ATL': 'Atlanta Falcons',
    'CAR': 'Carolina Panthers',
    'NO': 'New Orleans Saints',
    'TB': 'Tampa Bay Buccaneers',
    'ARI': 'Arizona Cardinals',
    'LAR': 'Los Angeles Rams',
    'SF': 'San Francisco 49ers',
    'SEA': 'Seattle Seahawks'
  }
  
  // NCAAF Team mappings (subset - can be expanded)
  const ncaafTeamMap: Record<string, string> = {
    'BAMA': 'Alabama Crimson Tide',
    'UGA': 'Georgia Bulldogs',
    'OSU': 'Ohio State Buckeyes',
    'MICH': 'Michigan Wolverines',
    'ND': 'Notre Dame Fighting Irish',
    'LSU': 'LSU Tigers',
    'TEX': 'Texas Longhorns',
    'USC': 'USC Trojans',
    'CLEM': 'Clemson Tigers',
    'OKLA': 'Oklahoma Sooners'
  }
  
  if (sport === 'nfl') {
    return nflTeamMap[teamAbbr] || teamAbbr
  } else if (sport === 'ncaaf') {
    return ncaafTeamMap[teamAbbr] || teamAbbr
  }
  
  return teamAbbr
}

// Helper function to transform game prop data
function transformGameProp(
  eventBundle: any,
  eventId: string,
  market: string,
  sport: string
): OddsScreenItem {
  const eventInfo = eventBundle.event || {}
  
  // Determine the entity name based on market type
  let entityName: string
  let entityDetails: string | undefined
  
  if (market.includes('home_team') || market.includes('home_total')) {
    // For home team markets, show the home team name
    entityName = getTeamName(eventInfo.home, sport) || eventInfo.home
    entityDetails = getGamePropDetails(market, eventBundle)
  } else if (market.includes('away_team') || market.includes('away_total')) {
    // For away team markets, show the away team name
    entityName = getTeamName(eventInfo.away, sport) || eventInfo.away
    entityDetails = getGamePropDetails(market, eventBundle)
  } else {
    // For general game markets, show the matchup
    entityName = `${eventInfo.away} @ ${eventInfo.home}`
    entityDetails = getGamePropDetails(market, eventBundle)
  }
  
  const entity = {
    type: 'game' as const,
    name: entityName,
    details: entityDetails
  }

  const event = {
    id: eventId,
    startTime: eventInfo.start || '',
    homeTeam: eventInfo.home || '',
    awayTeam: eventInfo.away || ''
  }

  // Determine if this market uses over/under or home/away structure
  const isOverUnder = ['total', 'totals'].includes(market) || 
                      market.includes('total_points') || 
                      market.includes('total_touchdowns') ||
                      market.includes('_total_')
  const isHomeAway = ['spread', 'spreads', 'moneyline'].includes(market)

  // Debug logging for team-specific markets
  if (market.includes('home_team') || market.includes('away_team') || market.includes('home_total') || market.includes('away_total')) {
    console.log(`[transformGameProp] Market: ${market}`)
    console.log(`[transformGameProp] isOverUnder: ${isOverUnder}`)
    console.log(`[transformGameProp] eventBundle.best:`, JSON.stringify(eventBundle.best, null, 2))
    console.log(`[transformGameProp] eventBundle.books keys:`, Object.keys(eventBundle.books || {}))
  }

  // Extract best odds from Redis best block
  const best: OddsScreenItem['odds']['best'] = {}
  if (isOverUnder) {
    if (eventBundle.best?.over) {
      best.over = {
        price: eventBundle.best.over.price,
        line: eventBundle.best.over.line || extractLineFromBestOffer(eventBundle.best.over, eventBundle),
        book: eventBundle.best.over.book,
        link: eventBundle.best.over.links?.desktop || null
      }
    }
    if (eventBundle.best?.under) {
      best.under = {
        price: eventBundle.best.under.price,
        line: eventBundle.best.under.line || extractLineFromBestOffer(eventBundle.best.under, eventBundle),
        book: eventBundle.best.under.book,
        link: eventBundle.best.under.links?.desktop || null
      }
    }
  } else if (isHomeAway) {
    // Map home/away to over/under for consistent table display
    if (eventBundle.best?.away) {
      best.over = {
        price: eventBundle.best.away.price,
        line: eventBundle.best.away.line || extractLineFromBestOffer(eventBundle.best.away, eventBundle),
        book: eventBundle.best.away.book,
        link: eventBundle.best.away.links?.desktop || null
      }
    }
    if (eventBundle.best?.home) {
      best.under = {
        price: eventBundle.best.home.price,
        line: eventBundle.best.home.line || extractLineFromBestOffer(eventBundle.best.home, eventBundle),
        book: eventBundle.best.home.book,
        link: eventBundle.best.home.links?.desktop || null
      }
    }
  } else {
    // Fallback: try to extract best odds regardless of structure
    console.log(`[transformGameProp] Fallback for market: ${market}`)
    if (eventBundle.best?.over) {
      best.over = {
        price: eventBundle.best.over.price,
        line: eventBundle.best.over.line || extractLineFromBestOffer(eventBundle.best.over, eventBundle),
        book: eventBundle.best.over.book,
        link: eventBundle.best.over.links?.desktop || null
      }
    }
    if (eventBundle.best?.under) {
      best.under = {
        price: eventBundle.best.under.price,
        line: eventBundle.best.under.line || extractLineFromBestOffer(eventBundle.best.under, eventBundle),
        book: eventBundle.best.under.book,
        link: eventBundle.best.under.links?.desktop || null
      }
    }
  }

  // Extract average odds from metrics
  const average: OddsScreenItem['odds']['average'] = {}
  if (isOverUnder) {
    if (eventBundle.metrics?.over) {
      average.over = {
        price: Math.round(eventBundle.metrics.over.avg_price || 0),
        line: extractLineFromMetrics(eventBundle.metrics.over, eventBundle)
      }
    }
    if (eventBundle.metrics?.under) {
      average.under = {
        price: Math.round(eventBundle.metrics.under.avg_price || 0),
        line: extractLineFromMetrics(eventBundle.metrics.under, eventBundle)
      }
    }
  } else if (isHomeAway) {
    // Map home/away to over/under for consistent table display
    if (eventBundle.metrics?.away) {
      average.over = {
        price: Math.round(eventBundle.metrics.away.avg_price || 0),
        line: extractLineFromMetrics(eventBundle.metrics.away, eventBundle)
      }
    }
    if (eventBundle.metrics?.home) {
      average.under = {
        price: Math.round(eventBundle.metrics.home.avg_price || 0),
        line: extractLineFromMetrics(eventBundle.metrics.home, eventBundle)
      }
    }
  } else {
    // Fallback: try to extract average odds regardless of structure
    if (eventBundle.metrics?.over) {
      average.over = {
        price: Math.round(eventBundle.metrics.over.avg_price || 0),
        line: extractLineFromMetrics(eventBundle.metrics.over, eventBundle)
      }
    }
    if (eventBundle.metrics?.under) {
      average.under = {
        price: Math.round(eventBundle.metrics.under.avg_price || 0),
        line: extractLineFromMetrics(eventBundle.metrics.under, eventBundle)
      }
    }
  }

  // TODO: Add opening odds when available in Redis data
  const opening: OddsScreenItem['odds']['opening'] = {}

  // Transform sportsbook data
  const books: Record<string, any> = {}
  
  Object.entries(eventBundle.books || {}).forEach(([bookId, bookData]: [string, any]) => {
    books[bookId] = {}
    
    if (isOverUnder) {
      if (bookData.over) {
        books[bookId].over = {
          price: bookData.over.price,
          line: bookData.over.line,
          link: bookData.over.links?.desktop || null
        }
      }
      
      if (bookData.under) {
        books[bookId].under = {
          price: bookData.under.price,
          line: bookData.under.line,
          link: bookData.under.links?.desktop || null
        }
      }
    } else if (isHomeAway) {
      // Map home/away to over/under for consistent table display
      if (bookData.away) {
        books[bookId].over = {
          price: bookData.away.price,
          line: bookData.away.line,
          link: bookData.away.links?.desktop || null
        }
      }
      
      if (bookData.home) {
        books[bookId].under = {
          price: bookData.home.price,
          line: bookData.home.line,
          link: bookData.home.links?.desktop || null
        }
      }
    } else {
      // Fallback: try to extract sportsbook data regardless of structure
      if (bookData.over) {
        books[bookId].over = {
          price: bookData.over.price,
          line: bookData.over.line,
          link: bookData.over.links?.desktop || null
        }
      }
      
      if (bookData.under) {
        books[bookId].under = {
          price: bookData.under.price,
          line: bookData.under.line,
          link: bookData.under.links?.desktop || null
        }
      }
    }
  })

  return {
    id: `${eventId}-game-${market}`,
    entity,
    event,
    odds: { best, average, opening, books }
  }
}

// Helper function to extract line from best offer (fallback to first book's line)
function extractLineFromBestOffer(bestOffer: any, eventBundle: any): number {
  // Try to find the line from the book that has the best offer
  const bestBook = bestOffer.book
  if (bestBook && eventBundle.books?.[bestBook]) {
    const bookData = eventBundle.books[bestBook]
    return bookData.over?.line || bookData.under?.line || bookData.home?.line || bookData.away?.line || 0
  }
  
  // Fallback: get line from first available book
  const books = eventBundle.books || {}
  for (const bookData of Object.values(books)) {
    const line = (bookData as any).over?.line || (bookData as any).under?.line || (bookData as any).home?.line || (bookData as any).away?.line
    if (line) return line
  }
  
  return 0
}

// Helper function to extract line from metrics (fallback to first book's line)
function extractLineFromMetrics(metrics: any, eventBundle: any): number {
  // Try to get line from the best book mentioned in metrics
  const bestBook = metrics.best_book
  if (bestBook && eventBundle.books?.[bestBook]) {
    const bookData = eventBundle.books[bestBook]
    return bookData.over?.line || bookData.under?.line || bookData.home?.line || bookData.away?.line || 0
  }
  
  // Fallback: get line from first available book
  const books = eventBundle.books || {}
  for (const bookData of Object.values(books)) {
    const line = (bookData as any).over?.line || (bookData as any).under?.line || (bookData as any).home?.line || (bookData as any).away?.line
    if (line) return line
  }
  
  return 0
}

// Helper function to get game prop details based on market
function getGamePropDetails(market: string, eventBundle: any): string | undefined {
  switch (market) {
    case 'spreads':
    case 'spread':
      return 'Point Spread'
    case 'total':
    case 'totals':{// Extract line from first available book
      const totalLine = extractLineFromMetrics({}, eventBundle) || extractLineFromBestOffer({}, eventBundle)
      return totalLine ? `Total ${totalLine}` : 'Total'}
      
    case 'moneyline':
      return 'Moneyline'
    default:
      // Handle team-specific markets with descriptive names
      if (market.includes('home_team') || market.includes('home_total')) {
        return market.replace(/_/g, ' ')
          .replace('home team', 'Home Team')
          .replace('home total', 'Home Team Total')
          .replace(/\b\w/g, l => l.toUpperCase())
      }
      if (market.includes('away_team') || market.includes('away_total')) {
        return market.replace(/_/g, ' ')
          .replace('away team', 'Away Team')
          .replace('away total', 'Away Team Total')
          .replace(/\b\w/g, l => l.toUpperCase())
      }
      
      // Convert other markets to readable format
      return market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

// Helper function to apply search filter
function applySearchFilter(items: OddsScreenItem[], search: string | null | undefined): OddsScreenItem[] {
  if (!search || search.trim() === '') {
    return items
  }

  const searchTerm = search.toLowerCase().trim()
  return items.filter(item => {
    const entityName = item.entity.name.toLowerCase()
    const entityDetails = item.entity.details?.toLowerCase() || ''
    const homeTeam = item.event.homeTeam.toLowerCase()
    const awayTeam = item.event.awayTeam.toLowerCase()
    
    return entityName.includes(searchTerm) ||
           entityDetails.includes(searchTerm) ||
           homeTeam.includes(searchTerm) ||
           awayTeam.includes(searchTerm)
  })
}

// Helper function to apply game filter
function applyGameFilter(items: OddsScreenItem[], gameId: string | null | undefined): OddsScreenItem[] {
  if (!gameId || gameId.trim() === '') {
    return items
  }

  return items.filter(item => item.event.id === gameId)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawParams = {
      sport: searchParams.get('sport'),
      type: searchParams.get('type'),
      market: searchParams.get('market'),
      scope: searchParams.get('scope'),
      gameId: searchParams.get('gameId'),
      search: searchParams.get('search'),
    }

    // Validate parameters
    const validatedParams = RequestSchema.parse(rawParams)
    // Build Redis key
    const parsed = RequestSchema.safeParse(rawParams)
    if (!parsed.success){
        return NextResponse.json({error: parsed.error.flatten()}, {status: 400})
    }
    const params = parsed.data
    const { sport, type, market, scope } = params
    const redisKey = buildRedisKey({ sport, type, market, scope })
    console.log(`[/api/odds-screen] Fetching from Redis key: ${redisKey}`)

    // Fetch data from Redis
    const startTime = Date.now()
    const rawData = await redis.get(redisKey)
    const fetchTime = Date.now() - startTime
    
    if (!rawData) {
      console.log(`[/api/odds-screen] No data found for key: ${redisKey}`)
      return NextResponse.json({
        success: true,
        metadata: {
          sport: validatedParams.sport,
          type: validatedParams.type,
          market: validatedParams.market,
          scope: validatedParams.scope,
          lastUpdated: new Date().toISOString(),
          totalCount: 0,
        },
        data: []
      } as OddsScreenResponse)
    }

    // Parse the Redis data
    const parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData

    // Compute ETag from raw payload
    const rawPayload = typeof rawData === 'string' ? rawData : JSON.stringify(rawData)
    const etag = `W/"${createHash('sha1').update(rawPayload).digest('hex')}"`

    // Conditional GET handling
    const ifNoneMatch = request.headers.get('if-none-match') || request.headers.get('If-None-Match')
    if (ifNoneMatch && ifNoneMatch === etag) {
      const notModified = new NextResponse(null, { status: 304 })
      notModified.headers.set('ETag', etag)
      notModified.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=120')
      return notModified
    }
    
    if (!parsedData || (!parsedData.events && !parsedData.players)) {
      console.log(`[/api/odds-screen] Invalid data structure for key: ${redisKey}`)
      return NextResponse.json({
        success: false,
        error: 'Invalid data structure received from Redis'
      }, { status: 500 })
    }

    const transformStartTime = Date.now()
    const transformedItems: OddsScreenItem[] = []

    if (validatedParams.type === 'player') {
      // Transform player props data
      const events = parsedData.events || {}
      
      Object.entries(events).forEach(([eventId, eventBundle]: [string, any]) => {
        const players = eventBundle.players || {}
        
        Object.entries(players).forEach(([playerId, playerData]: [string, any]) => {
          const transformedItem = transformPlayerProp(playerId, playerData, eventBundle, eventId)
          transformedItems.push(transformedItem)
        })
      })
    } else {
      // Transform game props data
      const events = parsedData.events || {}
      
      Object.entries(events).forEach(([eventId, eventBundle]: [string, any]) => {
        // For game props, eventBundle contains event, books, best, metrics directly
        const transformedItem = transformGameProp(eventBundle, eventId, validatedParams.market, validatedParams.sport)
        transformedItems.push(transformedItem)
      })
    }

    const transformTime = Date.now() - transformStartTime

    // Apply filters
    let filteredItems = transformedItems

    // Apply game filter
    if (validatedParams.gameId) {
      filteredItems = applyGameFilter(filteredItems, validatedParams.gameId)
    }

    // Apply search filter
    if (validatedParams.search) {
      filteredItems = applySearchFilter(filteredItems, validatedParams.search)
    }

    // Sort by event start time, then by entity name
    filteredItems.sort((a, b) => {
      const timeComparison = new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()
      if (timeComparison !== 0) return timeComparison
      return a.entity.name.localeCompare(b.entity.name)
    })

    const totalTime = Date.now() - startTime

    // Log performance metrics
    console.log(`[/api/odds-screen] Performance metrics:`, {
      redisKey,
      fetchTime: `${fetchTime}ms`,
      transformTime: `${transformTime}ms`,
      totalTime: `${totalTime}ms`,
      totalItems: transformedItems.length,
      filteredItems: filteredItems.length,
      dataSize: JSON.stringify(parsedData).length
    })

    const response: OddsScreenResponse = {
      success: true,
      metadata: {
        sport: validatedParams.sport,
        type: validatedParams.type,
        market: validatedParams.market,
        scope: validatedParams.scope,
        lastUpdated: parsedData.updated_at || new Date().toISOString(),
        totalCount: transformedItems.length,
        filteredCount: filteredItems.length !== transformedItems.length ? filteredItems.length : undefined
      },
      data: filteredItems
    }

    const res = NextResponse.json(response)
    res.headers.set('ETag', etag)
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=120')
    return res

  } catch (error) {
    console.error('[/api/odds-screen] Error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}