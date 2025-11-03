# Ladders Feature Architecture

This document provides an overview of how the Ladders feature works, including component hierarchy, data flow, and API architecture.

---

## Component Hierarchy

```
app/(protected)/ladders/page.tsx (Main Page)
├── ToolHeading & ToolSubheading (Header)
├── FiltersBar (Top Controls)
│   ├── Sport Selector (Combobox)
│   ├── Market Selector (Combobox)
│   ├── Player Selector (Combobox with search)
│   ├── Side Filter (Over/Under toggle)
│   └── LaddersFilters (Sportsbooks, Gap, Multi-book)
│       └── Popover with filter options
├── Ladder Display Area
│   ├── Ladder Header (Player info, event details)
│   ├── Primary Line Indicator
│   └── Ladder Rows Container
│       └── LadderRow[] (Multiple rows)
│           ├── Line value display
│           ├── Best odds display
│           ├── Add to builder button
│           └── Expandable details (all books)
└── LadderBuilderPanel (Side panel)
    └── Selected ladder legs with pricing
```

---

## Data Flow

### 1. Initial Page Load
```
User lands on /ladders
    ↓
Page reads URL params (sport, market, player, books, side, gap)
    ↓
Initialize state from URL or defaults
    ↓
Trigger API calls via React hooks
```

### 2. Market Selection Flow
```
useMarkets(sport) hook
    ↓
GET /api/props/mkts?sport={sport}
    ↓
Redis: SMEMBERS props:{sport}:mkts
    ↓
Returns: { mkts: ["passing_yards", "rushing_yards", ...] }
    ↓
Populate market dropdown
```

### 3. Player Selection Flow
```
User selects market
    ↓
usePlayers(sport, market, search, scope) hook
    ↓
GET /api/props/players?sport={sport}&mkt={market}&q={search}&scope={scope}
    ↓
Redis queries:
  1. SMEMBERS props:{sport}:players:mkt:{market}
  2. For each player entity:
     - SMEMBERS props:{sport}:sids:ent:{ent}:mkt:{market}
     - EXISTS props:{sport}:rows:alt:{sid} (validate)
     - HGETALL props:{sport}:player:{ent} (get metadata)
    ↓
Returns: { players: [{ ent, name, team, position }, ...] }
    ↓
Populate player dropdown with search
```

### 4. SID Resolution Flow
```
User selects player
    ↓
useFindSid(sport, ent, market) hook
    ↓
GET /api/props/find?sport={sport}&ent={ent}&mkt={market}
    ↓
Redis queries:
  1. SMEMBERS props:{sport}:sids:ent:{ent}:mkt:{market}
  2. For each SID:
     - EXISTS props:{sport}:rows:alt:{sid} (validate)
     - If not exists, try HGET props:{sport}:sid2primary {sid}
    ↓
Returns: { sids: ["validated_sid_1", "validated_sid_2", ...] }
    ↓
Select first valid SID
```

### 5. Ladder Data Loading Flow
```
useLadderFamily(sport, sid) hook
    ↓
GET /api/props/alt?sport={sport}&sid={sid}
    ↓
Redis: GET props:{sport}:rows:alt:{sid}
    ↓
Returns: {
  eid, ent, mkt, player, team, position, primary_ln,
  ev: { eid, event: { dt, live, home, away }, live },
  lines: [{ ln, books, best, avg }, ...]
}
    ↓
Process and display ladder
```

### 6. Real-time Updates Flow (SSE)
```
useLadderFamily establishes SSE connection
    ↓
GET /api/sse/alt?sport={sport}&sids={sid}
    ↓
Server polls: XRANGE props:{sport}:alt:x
    ↓
On update event:
  - Fetch latest data: GET props:{sport}:rows:alt:{sid}
  - Update ladder display
    ↓
SSE events: hello, alt, heartbeat
```

---

## API Routes

### `/api/props/mkts`
**Purpose:** Get available markets for a sport  
**Method:** GET  
**Params:** `sport`  
**Redis Keys:** `props:{sport}:mkts`  
**Cache:** 5 minutes (client), 10 minutes (CDN)  

### `/api/props/players`
**Purpose:** Get players for a market with search  
**Method:** GET  
**Params:** `sport`, `mkt`, `q` (search), `limit`, `scope` (pregame/live)  
**Redis Keys:**
- `props:{sport}:players:mkt:{market}`
- `props:{sport}:sids:ent:{ent}:mkt:{market}`
- `props:{sport}:rows:alt:{sid}`
- `props:{sport}:player:{ent}`
- `props:{sport}:is_live`

**Cache:** 30s (client), 60s (CDN)  
**Features:**
- In-memory cache (60s)
- Player deduplication by name
- Scope filtering (live vs pregame)
- Validation of SIDs before returning

### `/api/props/find`
**Purpose:** Find valid SIDs for a player+market  
**Method:** GET  
**Params:** `sport`, `ent` (or `player`), `mkt`  
**Redis Keys:**
- `props:{sport}:sids:ent:{ent}:mkt:{market}`
- `props:{sport}:rows:alt:{sid}`
- `props:{sport}:sid2primary`

**Features:**
- SID validation (checks if alternate data exists)
- Automatic fallback to primary SID if needed
- Debug info in development mode

### `/api/props/alt`
**Purpose:** Get ladder family data for a SID  
**Method:** GET  
**Params:** `sport`, `sid` (or `familySid`)  
**Redis Keys:** `props:{sport}:rows:alt:{sid}`  
**Cache:** 5s (client), 10s (CDN) + in-memory cache (10s)  
**Features:**
- ETag support for 304 Not Modified
- In-memory coalescing cache
- Stale-while-revalidate

### `/api/sse/alt`
**Purpose:** Real-time updates stream for ladder changes  
**Method:** GET (SSE)  
**Params:** `sport`, `sids` (comma-separated), `embed`, `from_id`  
**Redis Keys:**
- `props:{sport}:alt:x` (Redis Stream)
- `props:{sport}:rows:alt:{sid}` (if embed=1)

**Features:**
- Server-Sent Events (SSE)
- Resume support via Last-Event-ID
- Heartbeat every 30s
- Polling interval: 900ms

### `/api/props/markets` (Legacy)
**Purpose:** Alternative markets endpoint  
**Method:** GET  
**Params:** `sport`  
**Redis Keys:** `idx:{sport}:props:markets`  
**Fallback:** Static list of common markets

---

## React Hooks

### `useMarkets(sport)`
**Purpose:** Fetch available markets for a sport  
**Query Key:** `["ladder-mkts", sport]`  
**Stale Time:** 10 minutes  
**GC Time:** 30 minutes  

### `usePlayers(sport, mkt, search, scope)`
**Purpose:** Fetch players for a market with search  
**Query Key:** `["ladder-players", sport, mkt, search, scope]`  
**Stale Time:** 60 seconds  
**GC Time:** 10 minutes  
**Enabled:** When sport and market are selected  

### `useFindSid(sport, ent, mkt)`
**Purpose:** Find SIDs for a player+market  
**Query Key:** `["ladder-find", sport, ent, mkt]`  
**Stale Time:** 30 seconds  
**Enabled:** When sport, entity, and market are selected  

### `useLadderFamily(sport, sid)`
**Purpose:** Fetch and subscribe to ladder data  
**Features:**
- Initial HTTP fetch with ETag
- SSE subscription for live updates
- Automatic reconnection
- Error handling (404 detection)

**State:**
- `family` - The ladder data
- `etag` - Current ETag for caching
- `error` - Error state ('not_found', 'error', or null)
- `isLoading` - Loading state

---

## Key Components

### `LaddersPage` (Main Container)
**File:** `app/(protected)/ladders/page.tsx`  
**Responsibilities:**
- URL state management (syncs filters to URL)
- Sport/market/player selection
- Filter management (books, gap, side, multi-book)
- Ladder builder state
- Line deduplication logic
- Sorting and filtering logic

**State:**
- `sport` - Selected sport
- `mkt` - Selected market
- `ent` - Selected player entity
- `selectedBooks` - Active sportsbooks
- `sideFilter` - Over/Under
- `ladderGap` - Minimum gap between lines
- `multiBookOnly` - Show only multi-book lines
- `singleBookMode` - Single book view mode
- `ladderSelections` - Builder selections

### `LadderRow`
**File:** `components/ladders/ladder-row.tsx`  
**Responsibilities:**
- Display single ladder line
- Show best odds for over/under
- Expandable view for all books
- Add to builder functionality
- Value indicators (best value, primary line)
- Odds movement indicators

**Props:**
- `line` - Line value
- `bestOver/bestUnder` - Best odds
- `avgOver/avgUnder` - Average odds
- `allBooks` - All sportsbook odds
- `isBestValue` - Best value indicator
- `isPrimaryLine` - Primary line indicator

### `LaddersFilters`
**File:** `components/ladders/ladders-filters.tsx`  
**Responsibilities:**
- Sportsbook selection (multi-select)
- Ladder gap configuration
- Multi-book only toggle
- Apply/Reset functionality

**Features:**
- Excludes Bodog and Bovada (data accuracy issues)
- Unsaved changes tracking
- Popover UI

### `LadderBuilderPanel`
**File:** `components/ladders/ladder-builder-panel.tsx`  
**Responsibilities:**
- Display selected ladder legs
- Calculate total odds
- Show potential payout
- Remove selections
- Open deep links

---

## Data Processing Pipeline

### Line Deduplication
```javascript
// Remove duplicate lines by line number (keep first occurrence)
const linesSeen = new Map<number, any>();
(family.lines || []).forEach((row: any) => {
  if (!linesSeen.has(row.ln)) {
    linesSeen.set(row.ln, row);
  }
});
const deduplicatedLines = Array.from(linesSeen.values());
```

### Filtering Logic
```javascript
const filteredLines = deduplicatedLines
  .filter(row => {
    // 1. Filter by selected books
    const hasSelectedBook = Object.keys(row.books || {})
      .some(bookId => selectedBooks.includes(bookId));
    
    // 2. Multi-book filter
    if (multiBookOnly) {
      const bookCount = Object.keys(row.books || {}).length;
      if (bookCount < 2) return false;
    }
    
    // 3. Ladder gap filter
    if (ladderGap > 0) {
      // Complex gap logic...
    }
    
    return hasSelectedBook;
  });
```

### Sorting Logic
```javascript
// Sort by line value (ascending for over, descending for under)
const sortedLines = filteredLines.sort((a, b) => {
  return sideFilter === 'over' 
    ? a.ln - b.ln  // Ascending
    : b.ln - a.ln; // Descending
});
```

### Best Value Calculation
```javascript
// Find line with best avg-to-best boost
let bestBoost = -Infinity;
let bestValueLine = null;

filteredLines.forEach(row => {
  const best = sideFilter === 'over' ? row.best?.over : row.best?.under;
  const avg = sideFilter === 'over' ? row.avg?.over : row.avg?.under;
  
  if (best && avg) {
    const boost = best.price - avg;
    if (boost > bestBoost) {
      bestBoost = boost;
      bestValueLine = row.ln;
    }
  }
});
```

---

## URL State Management

The page syncs key parameters to the URL for shareability:

**URL Parameters:**
- `sport` - Selected sport (e.g., `nfl`)
- `market` - Selected market (e.g., `receiving_yards`)
- `player` - Selected player entity ID
- `books` - Comma-separated sportsbook IDs
- `side` - Over or under
- `gap` - Ladder gap value
- `multibook` - Multi-book only (true/false)
- `view` - Single book view mode (book ID or null)

**Example URL:**
```
/ladders?sport=nfl&market=receiving_yards&player=player_123&books=draftkings,fanduel&side=over&gap=5&multibook=false
```

---

## Performance Optimizations

### API Level
1. **In-memory caching** - 10-60s caches in API routes
2. **ETag support** - 304 Not Modified responses
3. **CDN caching** - Public cache headers
4. **Stale-while-revalidate** - Serve stale data while refreshing
5. **Batch Redis queries** - Reduce round trips

### Client Level
1. **React Query caching** - Automatic query deduplication
2. **Stale time configuration** - Reduce unnecessary refetches
3. **SSE for updates** - Efficient real-time updates
4. **Memoization** - useMemo for expensive calculations
5. **Deduplication** - Remove duplicate lines/players

### UI Level
1. **Virtualization** - Only render visible rows (if needed)
2. **Debounced search** - Reduce API calls during typing
3. **Optimistic updates** - Instant UI feedback
4. **Skeleton states** - Better loading experience

---

## Error Handling

### 404 Errors (No Alternates)
```javascript
if (error === 'not_found') {
  // Show friendly message: "No alternate lines available"
}
```

### Validation Errors
- Invalid sport → 400 Bad Request
- Missing parameters → 400 Bad Request
- Redis errors → 500 Internal Server Error (with fallback)

### SSE Connection Errors
- Automatic reconnection
- Heartbeat monitoring (30s)
- Graceful degradation (falls back to polling)

---

## Testing

### Test Routes
See `LADDERS_TEST_ROUTES.md` for API testing examples.

### Test Scripts
- `scripts/check-nfl-keys.ts` - Verify Redis keys
- `scripts/debug-live-nfl.ts` - Debug live data
- `scripts/compare-live-sports.ts` - Compare sports data

### Browser Console Testing
```javascript
// Test API directly
fetch('/api/props/alt?sport=nfl&sid=YOUR_SID')
  .then(r => r.json())
  .then(console.log);

// Test SSE connection
const es = new EventSource('/api/sse/alt?sport=nfl&sids=YOUR_SID');
es.onmessage = (e) => console.log('SSE:', e.data);
```

---

## Future Enhancements

### Potential Improvements
1. **Virtual scrolling** - For very long ladders
2. **Odds comparison view** - Side-by-side book comparison
3. **Historical odds** - Track odds movement over time
4. **Alerts** - Notify on odds changes
5. **Favorites** - Save favorite players/markets
6. **Mobile optimization** - Better mobile UX
7. **Export builder** - Share ladder combinations
8. **Analytics** - Track best value lines

---

## Related Documentation

- `LADDERS_REDIS_KEYS.md` - Complete Redis key reference
- `LADDERS_TEST_ROUTES.md` - API testing guide
- `ALTERNATES_IMPLEMENTATION.md` - Implementation details
- `ALTERNATES_SUMMARY.md` - Feature summary




