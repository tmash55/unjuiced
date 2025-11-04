# NBA Stats - Date Handling Audit & Fixes

## Problem Identified

The core issue was **inconsistent date parsing between UTC and local time**.

### Symptoms:
1. Live tab shows "no games today" but displays yesterday's data
2. Historical dropdown shows "Nov 2nd" but label says "Latest: Nov 3, 2025"
3. Data appears when switching between dates

### Root Cause:

**Date String Ambiguity in JavaScript:**
```javascript
// WRONG - Ambiguous, interpreted as local midnight
new Date('2025-11-03')  

// RIGHT - Explicit UTC interpretation
new Date('2025-11-03T00:00:00Z')  
// or
new Date('2025-11-03T12:00:00Z') // Noon UTC (safer for display)
```

## Fixes Applied

### 1. Historical Browser Date Generation
**Before:**
```typescript
const endDate = latestDate ? new Date(latestDate + 'T00:00:00Z') : new Date();
for (let d = new Date(endDate); d >= startDate; d.setUTCDate(d.getUTCDate() - 1)) {
  availableDates.push(format(d, 'yyyy-MM-dd'));
}
```

**After:**
```typescript
// Force UTC interpretation and manually format dates
for (let d = new Date(endDate); d >= startDate; d.setUTCDate(d.getUTCDate() - 1)) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  availableDates.push(`${year}-${month}-${day}`);
}
```

### 2. Date Display in Dropdown
**Before:**
```typescript
format(new Date(date), 'MMM d, yyyy')  // Ambiguous parsing
```

**After:**
```typescript
format(new Date(date + 'T12:00:00Z'), 'MMM d, yyyy')  // Explicit UTC noon
```

### 3. Live Stats Query Date Range
**Before:**
```sql
WHERE ps.game_date >= CURRENT_DATE - INTERVAL '1 day'
```

**After:**
```sql
WHERE ps.game_date >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY ps.game_date DESC, ps.pra DESC
```

This gives a 2-day buffer for timezone edge cases and ensures we get the most recent games first.

### 4. Game Metadata Calculation
**Before:**
```typescript
const today = new Date();
const utcDateString = today.toISOString().split('T')[0];

const { data: games } = await supabase
  .from('nba_games')
  .select('game_status')
  .gte('game_date', utcDateString);

const gamesLive = games?.filter(g => g.game_status === 2).length || 0;
```

**After:**
```typescript
// Get last 2 days of games
const { data: games } = await supabase
  .from('nba_games')
  .select('game_status, game_date')
  .gte('game_date', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  .order('game_date', { ascending: false });

// Only count games from TODAY (UTC)
const todayUTC = new Date().toISOString().split('T')[0];
const todaysGames = games?.filter(g => g.game_date === todayUTC) || [];

const gamesLive = todaysGames.filter(g => g.game_status === 2).length;
const gamesFinal = todaysGames.filter(g => g.game_status === 3).length;
const gamesScheduled = todaysGames.filter(g => g.game_status === 1).length;
```

Now we **explicitly filter for today's UTC date** when calculating game counts.

## Date Handling Rules

### ✅ DO:
1. **Always append timezone** when parsing date strings: `date + 'T00:00:00Z'` or `date + 'T12:00:00Z'`
2. **Use UTC methods** for calculations: `getUTCDate()`, `getUTCFullYear()`, etc.
3. **Compare dates in UTC**: `date.toISOString().split('T')[0]`
4. **Manual date formatting** for UTC dates instead of relying on `format(new Date(string))`

### ❌ DON'T:
1. Parse bare date strings: `new Date('2025-11-03')` ← AMBIGUOUS
2. Mix local and UTC date methods
3. Use `setDate()` instead of `setUTCDate()`
4. Assume client timezone matches database timezone

## Expected Behavior Now

### Live Tab:
- Shows games from **today's UTC date**
- If no games today → shows "No games scheduled - Showing most recent games"
- Displays games from last 2 days sorted by date DESC, PRA DESC

### Historical Tab:
- Dropdown correctly shows dates starting from latest game date
- "Latest: Nov 3, 2025" matches the top dropdown option
- Selecting any date loads the correct data for that date

### Date Display:
- All dates displayed use UTC interpretation
- Format: "Nov 3, 2025" (always matches database date)

## Testing Checklist

- [ ] Historical dropdown shows correct date (matches "Latest" indicator)
- [ ] Live tab correctly identifies if games are today (UTC)
- [ ] Game counts (live/scheduled/final) accurate for today's UTC date
- [ ] Switching dates in historical tab loads correct data
- [ ] Date display consistent across all components
- [ ] Works correctly regardless of user's local timezone

## Files Modified

1. `/app/api/nba/live-stats/route.ts` - Fixed date range query and game count logic
2. `/components/nba/historical-browser.tsx` - Fixed date generation and parsing
3. All date strings now explicitly use UTC timezone

