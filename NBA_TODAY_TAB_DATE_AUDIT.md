# Today Tab - Date Logic Audit

## Problem Statement
- Header shows "No games today"
- Leaderboard shows November 3rd data
- Database has 6 games scheduled for November 4th

## Current Flow Analysis

### 1. API Query (`/api/nba/live-stats`)

**Step 1: Query player stats from last 2 days**
```sql
WHERE ps.game_date >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY ps.game_date DESC, ps.pra DESC
```

**Result:** Gets both Nov 3 (with stats) and Nov 4 (no stats yet) games

**Step 2: Determine "today's" date**
```typescript
const latestGameDate = games?.[0]?.game_date;  // Gets Nov 4
const todaysGames = games?.filter(g => g.game_date === latestGameDate);
```

**Problem Identified:** 
- `latestGameDate` = Nov 4 (from nba_games table)
- But player stats only exist for Nov 3
- So game counts look at Nov 4, but leaderboard shows Nov 3

## The Core Issue

**Two different "today" definitions:**

1. **For Game Counts:**
   - Uses `games?.[0]?.game_date` (latest in nba_games table)
   - Result: Nov 4 → finds 6 scheduled games ✅

2. **For Leaderboard:**
   - Uses query result from `nba_player_game_stats`
   - Result: Nov 3 (latest with actual player data) ✅
   
**But they're disconnected!**

## Expected Behavior

### Scenario A: Games Scheduled (Not Started)
- **Date:** Nov 4
- **Game Count:** "6 Scheduled" ✅
- **Leaderboard:** Show Nov 3 (most recent with stats) ⚠️
- **Message:** "Stats will appear once games start"

### Scenario B: Games Live
- **Date:** Nov 4  
- **Game Count:** "3 Live" ✅
- **Leaderboard:** Show Nov 4 (live stats) ✅
- **Message:** "Updated every 20 seconds"

### Scenario C: Games Final
- **Date:** Nov 4
- **Game Count:** "6 Final" ✅
- **Leaderboard:** Show Nov 4 (final stats) ✅
- **Message:** "Final stats for today"

## Solution

We need TWO separate date checks:

### 1. Game Schedule Date (for header counts)
```typescript
// Get latest date from nba_games table
const latestScheduleDate = games?.[0]?.game_date;  // Nov 4
const todaysGames = games?.filter(g => g.game_date === latestScheduleDate);

// This gives us: 6 scheduled games for Nov 4
```

### 2. Stats Date (for leaderboard)
```typescript
// Get latest date that has actual player stats
const latestStatsDate = transformedLeaderboard?.[0]?.game_date;  // Nov 3

// Show Nov 3 leaderboard until Nov 4 games start
```

### 3. Metadata Response
```typescript
{
  metadata: {
    gamesLive: 0,
    gamesScheduled: 6,
    gamesFinal: 0,
    scheduleDate: '2025-11-04',  // For game counts
    statsDate: '2025-11-03'       // For leaderboard display
  }
}
```

## Implementation Fix

### Option A: Show Latest Available Stats (Recommended)
- Display "Today's Games: 6 Scheduled" in header
- Show Nov 3 leaderboard with note: "Showing latest stats (Nov 3)"
- When games start, update to Nov 4 stats

### Option B: Hide Leaderboard Until Games Start
- Display "Today's Games: 6 Scheduled" in header
- Show empty state: "Stats will appear once games start"
- Only show leaderboard when Nov 4 has data

## Recommended Fix

Update the API to return BOTH dates:

```typescript
const response: LiveStatsResponse = {
  leaderboard: transformedLeaderboard,
  lastUpdated: new Date().toISOString(),
  metadata: {
    total: transformedLeaderboard.length,
    view,
    gamesLive,
    gamesFinal,
    gamesScheduled,
    scheduleDate: latestGameDate,  // For game status (Nov 4)
    statsDate: transformedLeaderboard[0]?.game_date || latestGameDate  // For leaderboard (Nov 3)
  }
};
```

Then in the UI:
- Use `scheduleDate` for game counts
- Use `statsDate` to show which day's stats are displayed
- Add a note when they don't match: "Showing latest stats from Nov 3"

---

**Status:** Ready to implement fix
**Priority:** High - affects user experience and clarity

