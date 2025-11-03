# Best Odds API - Quick Notes

## Current Status: ✅ Working

Both endpoints are working correctly with `sport=all`.

## Key Redis Keys

Your backend populates these keys:

### Primary Data Keys (Used by Frontend)
- `best_odds:all:sort:improvement` - ZSET with all deals sorted by improvement %
- `best_odds:all:sort:pregame` - ZSET with pregame deals only
- `best_odds:all:sort:live` - ZSET with live deals only
- `props:{sport}:best_odds:rows` - HASH with full deal data (per sport: nfl, nba, nhl)
- `best_odds:all:v` - Version counter for cache busting
- `pub:best_odds:all` - Pub/sub channel for real-time updates

### Data Structure

**ZSET Members (improvement score):**
```
Member: {event_id}:{entity}:{market}:{line}:{side}
Score: improvement percentage (e.g., 208.97)

Example:
  "f2617c37-9050-5fc6-982e-6476a4ec5da0:pid:00-0038809:player_touchdowns:0.5:o"
  Score: 208.97
```

**HASH Fields (full deal data):**
```
Key: props:nfl:best_odds:rows (per sport)
Field: ZSET member WITHOUT sport prefix
Value: JSON with full deal data

Example ZSET member: nfl:f2617c37-9050-5fc6-982e-6476a4ec5da0:pid:00-0038809:player_touchdowns:0.5:o
Example HASH field: f2617c37-9050-5fc6-982e-6476a4ec5da0:pid:00-0038809:player_touchdowns:0.5:o

HASH value (JSON):
{
  "sport": "nfl",
  "eid": "f2617c37-9050-5fc6-982e-6476a4ec5da0",
  "ent": "pid:00-0038809",
  "mkt": "player_touchdowns",
  "ln": 0.5,
  "side": "o",
  "best_book": "draftkings",
  "best_price": -110,
  "best_link": "https://...",
  "num_books": 8,
  "avg_price": -120,
  "price_improvement": 208.97,
  "all_books": [...],
  "scope": "pregame",
  "last_updated": 1698765432,
  "player_name": "James Cook",
  "team": "BUF",
  "position": "RB"
}
```

## API Endpoints

### 1. GET /api/best-odds

**Working Query:**
```bash
curl "http://localhost:3000/api/best-odds?sport=all&limit=10"
```

**Query Parameters:**
- `sport`: Currently only `"all"` works (sport filtering happens client-side)
- `scope`: `"all"` | `"pregame"` | `"live"` (default: "all")
- `limit`: 1-200 (default: 50)
- `offset`: pagination offset (default: 0)
- `minImprovement`: filter by improvement % (default: 0)
- `maxOdds`: filter by max odds (optional)
- `minOdds`: filter by min odds (optional)

**Auth Gating:**
- Free users: Only see deals with improvement < 10%
- Pro users: See all deals

**Response:**
```json
{
  "version": 323,
  "total": 10,
  "deals": [...],
  "hasMore": true
}
```

### 2. GET /api/sse/best-odds

**Working Connection:**
```bash
curl -N "http://localhost:3000/api/sse/best-odds?sport=all"
```

**Events:**
- `hello`: Sent immediately on connection
- `data`: Deal updates (filtered for free users)
- `: ping`: Heartbeat every 15s

**Hello Event Example:**
```
event: hello
data: {"sport":"all","isPro":true}
```

### 3. POST /api/best-odds/enrich

**Purpose:** Batch fetch player and event enrichment data.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/best-odds/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "players": [
      { "sport": "nfl", "ent": "pid:00-0038809" },
      { "sport": "nfl", "ent": "pid:00-0036590" }
    ],
    "events": [
      { "sport": "nfl", "eid": "f2617c37-9050-5fc6-982e-6476a4ec5da0" },
      { "sport": "nfl", "eid": "8926e950-8ad1-51ca-b34e-6f0ee149a949" }
    ]
  }'
```

**Response:**
```json
{
  "players": {
    "nfl:pid:00-0038809": {
      "name": "Rashod Bateman",
      "team": "BAL",
      "position": "WR"
    },
    "nfl:pid:00-0036590": {
      "name": "James Cook",
      "team": "BUF",
      "position": "RB"
    }
  },
  "events": {
    "nfl:f2617c37-9050-5fc6-982e-6476a4ec5da0": {
      "home": "BAL",
      "away": "CLE",
      "start": "2025-01-31T18:00:00Z",
      "live": false
    }
  }
}
```

**Redis Keys Used:**
- `props:{sport}:player:{ent}` - HASH with player data
- `props:{sport}:events:{eid}` - STRING (JSON) with event data

**Caching:** 5 minutes (player/event data changes infrequently)

**Usage Pattern:**
1. Fetch deals from GET /api/best-odds
2. Extract unique `ent` (players) and `eid` (events) from deals
3. Batch enrich with POST /api/best-odds/enrich
4. Merge enrichment data with deals in frontend

## Sport Filtering

Since the API returns `sport=all`, **sport filtering happens on the frontend**:

```typescript
// Client-side filtering example
const nflDeals = allDeals.filter(deal => deal.sport === 'nfl');
const nbaDeals = allDeals.filter(deal => deal.sport === 'nba');
const nhlDeals = allDeals.filter(deal => deal.sport === 'nhl');
```

## Testing Checklist

- [x] GET endpoint returns data with `sport=all`
- [x] SSE endpoint connects and sends hello event
- [x] Free user filtering works (< 10% improvement)
- [x] Pro user sees all deals (208% improvement visible)
- [x] Scope filtering works (`pregame`, `live`, `all`)
- [ ] Enrichment endpoint returns player and event data
- [ ] Enrichment handles missing data gracefully
- [x] No TypeScript errors
- [x] Proper logging for debugging

## Next Steps: Frontend

1. **Create client library** (`lib/best-odds-client.ts`):
   - `fetchBestOdds()` - wrapper for GET endpoint
   - `openBestOddsSSE()` - wrapper for SSE endpoint

2. **Create React hooks** (`hooks/use-best-odds.ts`):
   - `useBestOdds()` - React Query hook for GET
   - `useBestOddsLive()` - SSE hook for real-time

3. **Create page** (`app/(protected)/best-odds/page.tsx`):
   - Sport filter dropdown (client-side)
   - Scope selector (pregame/live/all)
   - Auto-refresh toggle (Pro only)
   - Filter controls (improvement, odds range)

4. **Create table component** (`components/best-odds/best-odds-table.tsx`):
   - Display deals in sortable table
   - Show improvement % prominently
   - Link to best book with deep link
   - Expandable row to show all books
   - Mobile responsive

5. **Styling**:
   - Similar to arbitrage table
   - Highlight high-improvement deals
   - Pro badge for gated features
   - Loading skeletons

## Example Frontend Usage

### Basic Workflow

```typescript
// 1. Fetch initial deals
const { data, isLoading } = useBestOdds({
  scope: 'pregame',
  limit: 50
});

// 2. Extract unique players and events from deals
const uniquePlayers = Array.from(
  new Set(
    data?.deals
      .filter(d => d.ent.startsWith('pid:'))
      .map(d => ({ sport: d.sport, ent: d.ent }))
  )
);

const uniqueEvents = Array.from(
  new Set(data?.deals.map(d => ({ sport: d.sport, eid: d.eid })))
);

// 3. Batch enrich the data
const enrichmentResponse = await fetch('/api/best-odds/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    players: uniquePlayers,
    events: uniqueEvents
  })
});

const { players, events } = await enrichmentResponse.json();

// 4. Merge enrichment data with deals
const enrichedDeals = data.deals.map(deal => ({
  ...deal,
  playerName: players[`${deal.sport}:${deal.ent}`]?.name,
  playerTeam: players[`${deal.sport}:${deal.ent}`]?.team,
  playerPosition: players[`${deal.sport}:${deal.ent}`]?.position,
  homeTeam: events[`${deal.sport}:${deal.eid}`]?.home,
  awayTeam: events[`${deal.sport}:${deal.eid}`]?.away,
  gameStart: events[`${deal.sport}:${deal.eid}`]?.start,
  isLive: events[`${deal.sport}:${deal.eid}`]?.live
}));

// 5. Filter by sport (client-side)
const nflDeals = enrichedDeals.filter(d => d.sport === 'nfl');

// 6. Connect to SSE for live updates
const { deals: liveDeals } = useBestOddsLive({
  enabled: isPro && autoRefresh
});
```

### Helper Function Example

```typescript
// lib/best-odds-client.ts
export async function enrichBestOdds(deals: BestOddsDeal[]) {
  // Extract unique players and events
  const uniquePlayers = new Map<string, { sport: string; ent: string }>();
  const uniqueEvents = new Map<string, { sport: string; eid: string }>();
  
  deals.forEach(deal => {
    // Add player if starts with 'pid:'
    if (deal.ent.startsWith('pid:')) {
      const key = `${deal.sport}:${deal.ent}`;
      if (!uniquePlayers.has(key)) {
        uniquePlayers.set(key, { sport: deal.sport, ent: deal.ent });
      }
    }
    
    // Add event
    const eventKey = `${deal.sport}:${deal.eid}`;
    if (!uniqueEvents.has(eventKey)) {
      uniqueEvents.set(eventKey, { sport: deal.sport, eid: deal.eid });
    }
  });
  
  // Fetch enrichment data
  const response = await fetch('/api/best-odds/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      players: Array.from(uniquePlayers.values()),
      events: Array.from(uniqueEvents.values())
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to enrich deals');
  }
  
  const { players, events } = await response.json();
  
  // Merge enrichment data
  return deals.map(deal => {
    const playerKey = `${deal.sport}:${deal.ent}`;
    const eventKey = `${deal.sport}:${deal.eid}`;
    
    return {
      ...deal,
      // Add player data
      playerName: players[playerKey]?.name || deal.playerName,
      playerTeam: players[playerKey]?.team || deal.team,
      playerPosition: players[playerKey]?.position || deal.position,
      // Add event data
      homeTeam: events[eventKey]?.home || deal.homeTeam,
      awayTeam: events[eventKey]?.away || deal.awayTeam,
      gameStart: events[eventKey]?.start || deal.startTime,
      isLive: events[eventKey]?.live ?? false
    };
  });
}
```

## Testing the Enrichment Endpoint

After fetching some deals, extract a few player/event IDs and test enrichment:

```bash
# Example with real data from a previous request
curl -X POST "http://localhost:3000/api/best-odds/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "players": [
      { "sport": "nfl", "ent": "pid:00-0038809" }
    ],
    "events": [
      { "sport": "nfl", "eid": "f2617c37-9050-5fc6-982e-6476a4ec5da0" }
    ]
  }' | jq
```

**Expected response:**
```json
{
  "players": {
    "nfl:pid:00-0038809": {
      "name": "James Cook",
      "team": "BUF",
      "position": "RB"
    }
  },
  "events": {
    "nfl:f2617c37-9050-5fc6-982e-6476a4ec5da0": {
      "home": "BAL",
      "away": "CLE",
      "start": "2025-01-31T18:00:00Z",
      "live": false
    }
  }
}
```

**Check server logs for:**
```
[/api/best-odds/enrich] Request: { playerCount: 1, eventCount: 1 }
[/api/best-odds/enrich] Fetching player data for 1 players
[/api/best-odds/enrich] Enriched 1 players
[/api/best-odds/enrich] Fetching event data for 1 events
[/api/best-odds/enrich] Enriched 1 events
```

## Common Issues

### Issue: Empty deals array (RESOLVED ✅)
- **Check:** Is `props:{sport}:best_odds:rows` HASH populated?
- **Status:** ✅ Using per-sport HASHes
- **Solution:** Backend uses `props:nfl:best_odds:rows`, `props:nba:best_odds:rows`, etc.
- **Action:** API updated to use per-sport HASH structure

### Issue: Enrichment returns empty objects
- **Check:** Do the Redis keys exist? 
  - `props:nfl:player:{ent}` for players
  - `props:nfl:events:{eid}` for events
- **Fix:** Ensure backend is populating these enrichment keys

### Issue: SSE connects but no data
- **Check:** Is backend publishing to `pub:best_odds:all`?
- **Fix:** Verify pub/sub is working in backend

### Issue: All deals filtered for free users
- **Expected:** This is correct if all improvements are >= 10%
- **Solution:** Backend should include deals with lower improvements too

## Performance Notes

- GET endpoint: 30s browser cache, 60s CDN cache
- SSE: Real-time updates with 15s heartbeat
- Efficient ZSET queries (sorted by improvement)
- O(1) HASH lookups

