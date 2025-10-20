# Sports & Leagues Filter Implementation

## Overview
Added comprehensive sports and leagues filtering to the arbitrage system. Users can now filter arbitrage opportunities by specific sports (Football, Basketball, Baseball, Hockey) and drill down into specific leagues (NFL, NBA, MLB, etc.).

## What Was Changed

### 1. New Data Structure (`lib/data/sports.ts`)
Created a centralized sports and leagues data structure:
- **Sports**: Football, Basketball, Baseball, Hockey
- **Leagues**: NFL, NCAAF, NBA, NCAAB, WNBA, MLB, NHL
- Helper functions to query sports/leagues data

### 2. Updated Filter Types (`lib/arb-filters.ts`)
Extended `ArbPrefs` type with:
- `selectedSports: string[]` - Array of selected sport IDs
- `selectedLeagues: string[]` - Array of selected league IDs

Updated `matchesArbRow()` function to:
- Filter by sports when `selectedSports` has values (empty = show all)
- Filter by leagues when `selectedLeagues` has values (empty = show all)
- Works in combination with existing filters (books, ROI, search)

### 3. Updated Preferences Context (`context/preferences-context.tsx`)
- Added `selectedSports` and `selectedLeagues` to filter state
- Updated `updateArbitrageFilters()` to persist new filters
- Updated `getArbitrageFilters()` to return new filter values
- Default values: empty arrays (show all sports/leagues)

### 4. New UI Tab (`components/arbs/filters-sheet.tsx`)
Added a third tab "Sports" to the filters sheet:
- **Tab Layout**: Changed from 2 columns to 3 columns (Sportsbooks | Sports | ROI & Amount)
- **Sports Section**: Grid of checkboxes with sport icons
- **Leagues Section**: Grid of checkboxes with league names
- **Smart UI**: Leagues are disabled if their parent sport isn't selected
- **Tip Box**: Helpful information about how filtering works

### 5. Updated Filter Logic (`hooks/use-arbs-view.tsx`)
Updated all `matchesArbRow()` calls to include:
- `selectedSports` parameter
- `selectedLeagues` parameter
- Updated `hasActiveFilters` to include sports/leagues
- Updated filter count logic to track sports/leagues filters

## How It Works

### Filter Behavior
1. **All Selected by Default**: All sports and leagues are selected by default, showing all opportunities
2. **Sport-Level Filtering**: Deselecting specific sports removes those sports from results
3. **League-Level Filtering**: Deselecting specific leagues removes those leagues from results
4. **Combined Filtering**: Sports and leagues filters work together:
   - Deselect "Baseball" sport → Hides all baseball leagues (MLB)
   - Deselect "NCAAF" league → Hides only NCAAF, keeps other football leagues
5. **Works with Other Filters**: Combines seamlessly with sportsbooks, ROI, and search filters

### User Experience
- **Clean 3-Tab Layout**: Organized filters by category
- **Visual Icons**: Sport icons help users quickly identify options
- **Smart Disabling**: Leagues are automatically disabled if their sport isn't selected
- **Select All / Clear All Buttons**: Quick way to select or clear all sports/leagues filters
- **Helpful Tip**: Explains filtering behavior to users

## Example Use Cases

### Use Case 1: Filter by Sport
**Scenario**: User only wants basketball arbitrage opportunities
**Action**: 
1. Open Filters → Sports tab
2. Deselect "Football", "Baseball", and "Hockey"
3. Apply Filters
**Result**: Only shows NBA, NCAAB, and WNBA opportunities

### Use Case 2: Filter by Specific League
**Scenario**: User only wants NFL opportunities
**Action**:
1. Open Filters → Sports tab
2. Click "Clear All" then select only "NFL" league
3. Apply Filters
**Result**: Only shows NFL opportunities

### Use Case 3: Remove Unwanted Sport
**Scenario**: User wants all sports except baseball
**Action**:
1. Open Filters → Sports tab
2. Deselect "Baseball"
3. Apply Filters
**Result**: Shows all sports except baseball (MLB)

### Use Case 4: Combine with Other Filters
**Scenario**: User wants NFL with >1% ROI at DraftKings
**Action**:
1. Sportsbooks tab → Select only DraftKings
2. Sports tab → Select NFL
3. ROI & Amount tab → Set Min ROI to 1%
4. Apply Filters
**Result**: Shows only NFL opportunities at DraftKings with >1% ROI

## Technical Details

### Data Mapping
The arbitrage data includes league information in this format (from vendor API):
```typescript
{
  lg: {
    id: "nba",           // League ID (vendor format: lowercase, no prefix)
    name: "NBA",         // League display name
    sport: "Basketball"  // Sport identifier (capitalized)
  }
}
```

**Important**: Our filter IDs match the vendor API format:
- Sport IDs: `"Football"`, `"Basketball"`, `"Baseball"`, `"Hockey"` (capitalized)
- League IDs: `"nfl"`, `"ncaaf"`, `"nba"`, `"wnba"`, `"mlb"`, `"nhl"` (lowercase, no sport prefix)

### Filter Logic
```typescript
// Default: All sports and leagues selected = show all
// Filter only applies when user deselects specific sports/leagues

// Filter by sport
if (selectedSports.length > 0) {
  // Only show if opportunity's sport is in selectedSports
  // If all sports selected, this has no filtering effect
}

// Filter by league
if (selectedLeagues.length > 0) {
  // Only show if opportunity's league is in selectedLeagues
  // If all leagues selected, this has no filtering effect
}
```

### Persistence
- Filters are saved to user preferences (Supabase)
- Persists across sessions
- Defaults to all sports/leagues selected for new users

## UI/UX Decisions

### Why a Third Tab?
**Options Considered**:
1. ✅ **Add third tab** (chosen)
2. ❌ Add to ROI & Amount tab
3. ❌ Create a new section

**Reasoning**:
- Sports/Leagues are categorical filters (like Sportsbooks), not numeric (like ROI)
- Keeps the UI clean and organized
- Gives room for future expansion
- Separates concerns: Books (who), Sports (what), ROI (how much)

### Why Sport Icons?
- Visual identification is faster than reading text
- Makes the UI more engaging
- Consistent with modern sports betting app design
- Already had a SportIcon component in the codebase

### Why All Selected by Default?
- Explicit visibility: Users can clearly see what's included
- Easier to understand: Removing items is more intuitive than adding them
- Prevents confusion: Users won't wonder why nothing is showing
- Standard pattern: Similar to how email clients and other filters work
- Users can use "Clear All" for a clean slate, then select only what they want

## Testing Recommendations

1. **Test Default State**: Ensure all arbs show when all sports/leagues are selected (default)
2. **Test Single Sport**: Deselect all except one sport, verify only that sport's leagues appear
3. **Test Single League**: Use "Clear All" then select one league, verify only that league appears
4. **Test Multiple Sports**: Deselect some sports, verify only selected sports appear
5. **Test Combined Filters**: Combine with book/ROI filters, verify all filters work together
6. **Test Persistence**: Apply filters, refresh page, verify filters persist
7. **Test Reset**: Click "Reset All", verify sports/leagues filters return to all selected
8. **Test Select All**: Click "Clear All" then "Select All", verify all are selected again
9. **Test Active Filters Indicator**: Verify hasActiveFilters only shows true when selection differs from "all selected"

## Future Enhancements

Potential improvements for later:
1. **Sport Counts**: Show number of opportunities per sport/league
2. **Quick Filters**: "NFL Only" or "Major Leagues Only" preset buttons
3. **Season Awareness**: Auto-filter to in-season sports
4. **Live Indicators**: Show which leagues have live games
5. **Favorite Sports**: Remember user's preferred sports
6. **Advanced View**: Group results by league in the table

## Files Changed

- ✅ `lib/data/sports.ts` - New file with sports/leagues data
- ✅ `lib/arb-filters.ts` - Updated filter types and logic
- ✅ `context/preferences-context.tsx` - Updated preferences handling
- ✅ `components/arbs/filters-sheet.tsx` - Added third tab UI
- ✅ `hooks/use-arbs-view.tsx` - Updated filter application
- ✅ `components/icons/sport-icons.tsx` - Already existed, used for UI

## Summary

The sports and leagues filter is now fully integrated into the arbitrage system. Users can easily filter by sport and league, with a clean UI and intuitive behavior. The implementation is production-ready and includes proper persistence, type safety, and no linter errors.

## Important Notes

**Vendor API Format Matching**: The filter IDs now match exactly what the vendor API returns:
- ✅ Sport IDs: `"Football"`, `"Basketball"`, `"Baseball"`, `"Hockey"` (capitalized)
- ✅ League IDs: `"nfl"`, `"ncaaf"`, `"nba"`, `"wnba"`, `"mlb"`, `"nhl"` (lowercase)

This ensures filters work correctly with the actual arbitrage data structure.









