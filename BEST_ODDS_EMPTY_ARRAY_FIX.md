# Best Odds Empty Array Fix

## Problem
After adding the database columns for Best Odds preferences, the page was showing "No results found" even though data was available. The issue was that the default values in the database were empty arrays `[]`, which the filtering logic interpreted as "user deselected everything" rather than "show everything".

## Root Cause
The database migration set default values to empty arrays:
```sql
best_odds_selected_books text[] DEFAULT '{}'
best_odds_selected_leagues text[] DEFAULT '{}'
best_odds_selected_markets text[] DEFAULT '{}'
```

However, the filtering logic was treating empty arrays as "nothing selected" instead of "everything selected".

## Solution
We followed the same pattern used in the arbitrage and odds screen features:

### 1. Created Centralized Preference Helpers
Added to `context/preferences-context.tsx`:
- `getBestOddsFilters()` - Returns filters with proper defaults
- `updateBestOddsFilters()` - Saves filters to database
- `useBestOddsPreferences()` - Convenience hook for components

### 2. Implemented "NULL means ALL" Pattern
```typescript
// If undefined (NULL in DB), default to ALL
// If empty array [], user explicitly deselected everything
selectedBooks: preferences.best_odds_selected_books ?? activeSportsbooks
selectedLeagues: preferences.best_odds_selected_leagues ?? allLeagues
selectedMarkets: preferences.best_odds_selected_markets ?? allMarkets
```

### 3. Simplified Best Odds Page
Before:
- Manual preference initialization
- Complex useEffect for syncing
- Manual save logic with multiple updatePreference calls

After:
- Single line: `const { filters: prefs, updateFilters } = useBestOddsPreferences()`
- Automatic defaults handling
- Automatic persistence

### 4. Client-Side Filtering (Like Arbs/Odds)
Changed from server-side filtering to client-side:
- Fetch ALL deals from API (no filter params)
- Apply filters client-side using `matchesBestOddsDeal()`
- Only refetch when `scope` or `sortBy` changes
- Instant filter updates (no API delay)

## Benefits
✅ Consistent with arbitrage and odds screen patterns
✅ New users see all data by default
✅ Authenticated users get persistent preferences
✅ Guest users get reset on page refresh
✅ Instant filter updates (client-side)
✅ Simpler code (less boilerplate)

## Files Changed
1. `context/preferences-context.tsx` - Added Best Odds preference helpers
2. `app/(protected)/best-odds/page.tsx` - Simplified to use new hook
3. `migrations/add_best_odds_preferences.sql` - Already created (no changes needed)

## Testing
1. ✅ New users should see all sportsbooks, leagues, and markets selected by default
2. ✅ Filtering should work instantly (no API calls)
3. ✅ Authenticated users should have preferences persist across sessions
4. ✅ Guest users should have preferences reset on page refresh
5. ✅ Empty arrays in DB should be treated as "select all"


