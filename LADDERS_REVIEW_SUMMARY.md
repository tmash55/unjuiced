# Ladders Feature Review Summary

## Overview

This document summarizes the review of the Ladders feature, including all Redis keys, API routes, components, and data flow.

---

## 📋 Documentation Created

1. **LADDERS_REDIS_KEYS.md** - Complete Redis key reference with examples
2. **LADDERS_ARCHITECTURE.md** - Component hierarchy and data flow
3. **LADDERS_REDIS_QUICK_REFERENCE.md** - Quick lookup guide for Redis keys
4. **LADDERS_REVIEW_SUMMARY.md** - This file

---

## 🔑 Critical Redis Keys for NFL (and all sports)

### Must Have (Required)
```bash
# 1. Ladder data (MOST IMPORTANT)
props:nfl:rows:alt:{sid}  # JSON with all lines, books, odds

# 2. Available markets
props:nfl:mkts  # Set of market names

# 3. Players by market
props:nfl:players:mkt:{market}  # Set of player entity IDs

# 4. Player metadata
props:nfl:player:{ent}  # Hash with name, team, position

# 5. SID lookup
props:nfl:sids:ent:{ent}:mkt:{market}  # Set of SIDs for player+market
```

### Optional (Enhanced Features)
```bash
# Live/pregame filtering
props:nfl:is_live  # Hash: sid -> "0" (pregame) or "1" (live)

# Real-time updates
props:nfl:alt:x  # Redis Stream for SSE updates

# SID resolution
props:nfl:sid2primary  # Hash: alternate_sid -> primary_sid
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LADDERS PAGE COMPONENT                        │
│  /app/(protected)/ladders/page.tsx                              │
│                                                                  │
│  State: sport, market, player, books, filters                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
        ┌───────────────┐ ┌──────────┐ ┌─────────────┐
        │  useMarkets   │ │usePlayers│ │useFindSid   │
        └───────────────┘ └──────────┘ └─────────────┘
                │              │              │
                ▼              ▼              ▼
        ┌───────────────┐ ┌──────────┐ ┌─────────────┐
        │ /api/props/   │ │/api/props│ │/api/props/  │
        │    mkts       │ │ /players │ │   find      │
        └───────────────┘ └──────────┘ └─────────────┘
                │              │              │
                └──────────────┼──────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   UPSTASH REDIS     │
                    │                     │
                    │  props:nfl:mkts     │
                    │  props:nfl:players  │
                    │  props:nfl:sids     │
                    │  props:nfl:player   │
                    └─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  useLadderFamily    │
                    └─────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
        ┌───────────────────┐  ┌──────────────────┐
        │  /api/props/alt   │  │  /api/sse/alt    │
        │  (HTTP)           │  │  (SSE Stream)    │
        └───────────────────┘  └──────────────────┘
                    │                     │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │   UPSTASH REDIS     │
                    │                     │
                    │ props:nfl:rows:alt  │
                    │ props:nfl:alt:x     │
                    └─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   LADDER DISPLAY    │
                    │                     │
                    │  - LadderRow[]      │
                    │  - LadderBuilder    │
                    └─────────────────────┘
```

---

## 🛣️ API Routes Summary

| Route | Purpose | Key Redis Keys |
|-------|---------|----------------|
| `GET /api/props/mkts` | List markets | `props:{sport}:mkts` |
| `GET /api/props/players` | List players | `props:{sport}:players:mkt:{market}`<br>`props:{sport}:player:{ent}`<br>`props:{sport}:sids:ent:{ent}:mkt:{market}` |
| `GET /api/props/find` | Find SIDs | `props:{sport}:sids:ent:{ent}:mkt:{market}`<br>`props:{sport}:rows:alt:{sid}` |
| `GET /api/props/alt` | Get ladder data | `props:{sport}:rows:alt:{sid}` |
| `GET /api/sse/alt` | Real-time updates | `props:{sport}:alt:x`<br>`props:{sport}:rows:alt:{sid}` |

---

## 🧩 Component Structure

```
LaddersPage (Main)
├── Sport Selector
├── Market Selector
├── Player Selector (with search)
├── Filters
│   ├── Sportsbooks (multi-select)
│   ├── Ladder Gap
│   ├── Multi-book Only
│   └── Side (Over/Under)
├── Ladder Display
│   ├── Player Info Header
│   ├── Event Details
│   └── LadderRow[] (multiple lines)
│       ├── Line value
│       ├── Best odds
│       ├── Add to builder
│       └── Expandable details
└── LadderBuilderPanel
    └── Selected legs with pricing
```

---

## 📊 Example: Complete NFL Player Setup

For **DeVonta Smith** receiving yards in **PHI @ DAL**:

```bash
# 1. Market exists
SADD props:nfl:mkts "receiving_yards"

# 2. Player in market
SADD props:nfl:players:mkt:receiving_yards "devonta_smith_123"

# 3. Player metadata
HMSET props:nfl:player:devonta_smith_123 \
  name "DeVonta Smith" \
  team "PHI" \
  position "WR"

# 4. Link to SID
SADD props:nfl:sids:ent:devonta_smith_123:mkt:receiving_yards \
  "71688971e063d0033f8a17a726663b30c723fad"

# 5. Ladder data (CRITICAL)
SET props:nfl:rows:alt:71688971e063d0033f8a17a726663b30c723fad '{
  "eid": "phi_dal_2024_12_29",
  "ent": "devonta_smith_123",
  "mkt": "receiving_yards",
  "player": "DeVonta Smith",
  "team": "PHI",
  "position": "WR",
  "primary_ln": 67.5,
  "ev": {
    "eid": "phi_dal_2024_12_29",
    "event": {
      "dt": "2024-12-29T20:00:00Z",
      "live": false,
      "home": "DAL",
      "away": "PHI"
    },
    "live": false
  },
  "lines": [
    { "ln": 57.5, "books": {...}, "best": {...}, "avg": {...} },
    { "ln": 62.5, "books": {...}, "best": {...}, "avg": {...} },
    { "ln": 67.5, "books": {...}, "best": {...}, "avg": {...} },
    { "ln": 72.5, "books": {...}, "best": {...}, "avg": {...} },
    { "ln": 77.5, "books": {...}, "best": {...}, "avg": {...} }
  ]
}'

# 6. Live status (optional)
HSET props:nfl:is_live "71688971e063d0033f8a17a726663b30c723fad" "0"
```

---

## ✅ Checklist for Adding a New Sport

To enable ladders for NBA, NHL, or any other sport:

### Critical Setup
- [ ] Create `props:{sport}:mkts` set with all markets
- [ ] For each market, create `props:{sport}:players:mkt:{market}` set
- [ ] For each player, create `props:{sport}:player:{ent}` hash
- [ ] For each player+market, create `props:{sport}:sids:ent:{ent}:mkt:{market}` set
- [ ] **Most Important:** For each SID, create `props:{sport}:rows:alt:{sid}` with complete JSON

### Optional Enhancements
- [ ] Create `props:{sport}:is_live` hash for live/pregame filtering
- [ ] Create `props:{sport}:alt:x` stream for real-time updates
- [ ] Create `props:{sport}:sid2primary` hash for SID resolution

### Validation
- [ ] Test `/api/props/mkts?sport={sport}` returns markets
- [ ] Test `/api/props/players?sport={sport}&mkt={market}` returns players
- [ ] Test `/api/props/find?sport={sport}&ent={ent}&mkt={market}` returns SIDs
- [ ] Test `/api/props/alt?sport={sport}&sid={sid}` returns ladder data
- [ ] Verify ladder page loads and displays correctly

---

## 🔍 Testing & Debugging

### Quick Tests
```bash
# Test markets
curl "http://localhost:3000/api/props/mkts?sport=nfl"

# Test players
curl "http://localhost:3000/api/props/players?sport=nfl&mkt=receiving_yards"

# Test find SID
curl "http://localhost:3000/api/props/find?sport=nfl&ent=player_123&mkt=receiving_yards"

# Test ladder data
curl "http://localhost:3000/api/props/alt?sport=nfl&sid=YOUR_SID"
```

### Redis Verification
```bash
# Check all NFL keys
redis-cli --scan --pattern "props:nfl:*"

# Count keys by type
redis-cli --scan --pattern "props:nfl:rows:alt:*" | wc -l
redis-cli SCARD props:nfl:mkts
redis-cli SCARD props:nfl:players:mkt:receiving_yards
```

### Debug Scripts
```bash
# Check NFL keys
npx tsx scripts/check-nfl-keys.ts

# Debug live data
npx tsx scripts/debug-live-nfl.ts

# Compare sports
npx tsx scripts/compare-live-sports.ts
```

---

## 🚀 Performance Characteristics

### Caching Strategy
- **API Routes:** 5-60s in-memory cache + CDN cache
- **React Query:** 30s-10min stale time
- **ETag Support:** 304 Not Modified responses
- **SSE Updates:** Real-time with 900ms polling

### Optimization Features
- Batch Redis queries (MGET, HMGET)
- Player deduplication by name
- Line deduplication by line number
- SID validation before returning
- Stale-while-revalidate headers

---

## 📝 Key Files Reference

### API Routes
- `app/api/props/alt/route.ts` - Get ladder data
- `app/api/props/players/route.ts` - Get players
- `app/api/props/find/route.ts` - Find SIDs
- `app/api/props/mkts/route.ts` - Get markets
- `app/api/sse/alt/route.ts` - SSE updates

### Components
- `app/(protected)/ladders/page.tsx` - Main page
- `components/ladders/ladder-row.tsx` - Individual row
- `components/ladders/ladders-filters.tsx` - Filters panel
- `components/ladders/ladder-builder-panel.tsx` - Builder panel

### Hooks
- `hooks/use-ladders.ts` - All ladder hooks

### Client Library
- `libs/ladders/client.ts` - API client functions

---

## 🎯 Summary

The Ladders feature requires **5 critical Redis key patterns** to function:

1. **`props:{sport}:rows:alt:{sid}`** - The ladder data (MOST IMPORTANT)
2. **`props:{sport}:mkts`** - Available markets
3. **`props:{sport}:players:mkt:{market}`** - Players per market
4. **`props:{sport}:player:{ent}`** - Player metadata
5. **`props:{sport}:sids:ent:{ent}:mkt:{market}`** - SID lookup

Your VPS ingestor scripts must create these keys for each sport you want to support. The data flows from Redis → API routes → React hooks → UI components.

For detailed information, see:
- **Full Redis Keys:** `LADDERS_REDIS_KEYS.md`
- **Quick Reference:** `LADDERS_REDIS_QUICK_REFERENCE.md`
- **Architecture:** `LADDERS_ARCHITECTURE.md`
- **Testing:** `LADDERS_TEST_ROUTES.md`




