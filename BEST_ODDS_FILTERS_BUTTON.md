# Best Odds Filters Button Update

## Changes Made

Updated the filters button to match the arbitrage and odds screen design - simplified to just say "Filters" and moved min improvement inside the sheet.

### Button Changes

#### Before:
```
[🔍 Search...]  [Min Improvement ▼]  [Advanced (2)]  [🔄]
```

#### After:
```
[🔍 Search...]                    [🔄]  [Filters (3)]
```

### Specific Updates

1. **Simplified Button Text** ✅
   - Changed from "Advanced" to "Filters"
   - Removed `hidden sm:inline` - now always shows "Filters"
   - Matches arb/odds screen exactly

2. **Moved Min Improvement Inside Sheet** ✅
   - Removed from filter bar
   - Added as new section in filter sheet
   - Now appears after Sportsbooks section
   - Full-width dropdown with proper styling

3. **Updated Active Filter Count** ✅
   - Now includes min improvement in count
   - Shows badge when min improvement > 0
   - Example: `Filters (3)` when 3 filters active

4. **Filter Sheet Structure** 📋
   - Leagues (multi-select with checkboxes)
   - Markets (multi-select grouped by sport)
   - Sportsbooks (multi-select with checkboxes)
   - **Min Improvement** (dropdown) ← NEW

### Visual Design

**Filter Bar:**
```
┌─────────────────────────────────────────────────────┐
│ [🔍 Search...]                    [🔄]  [Filters (3)]│
└─────────────────────────────────────────────────────┘
```

**Filter Sheet:**
```
┌─────────────────────────────────────┐
│ Advanced Filters                    │
├─────────────────────────────────────┤
│ Leagues                    All|None │
│ ☑ NBA  ☑ NFL  ☑ NCAAF             │
│                                     │
│ Markets                    All|None │
│ Basketball                          │
│ ☑ Points  ☑ Rebounds  ☑ PRA       │
│                                     │
│ Sportsbooks                All|None │
│ ☑ DraftKings  ☑ FanDuel           │
│                                     │
│ Min Improvement                     │
│ [Show All ▼]                       │
└─────────────────────────────────────┘
```

### Code Changes

**Button:**
```typescript
<button className="filters-btn">
  <Filter className="h-4 w-4" />
  <span>Filters</span>  {/* Always visible */}
  {activeFiltersCount > 0 && (
    <span className="badge">{activeFiltersCount}</span>
  )}
</button>
```

**Active Filter Count:**
```typescript
const activeFiltersCount = 
  (!allLeaguesSelected ? 1 : 0) +
  (!allMarketsSelected ? 1 : 0) +
  (!allBooksSelected ? 1 : 0) +
  (prefs.minImprovement > 0 ? 1 : 0);  // ← NEW
```

**Min Improvement in Sheet:**
```typescript
<div>
  <h3>Min Improvement</h3>
  <select value={prefs.minImprovement}>
    <option value="0">Show All</option>
    <option value="1">1%+</option>
    <option value="2">2%+</option>
    <option value="5">5%+</option>
    <option value="10">10%+</option>
    <option value="20">20%+</option>
  </select>
</div>
```

## Files Changed

### `components/best-odds/best-odds-filters.tsx`
- Changed button text from "Advanced" to "Filters"
- Removed `hidden sm:inline` class
- Moved min improvement dropdown inside sheet
- Added min improvement to active filter count
- Changed "Min Improvement" to "Show All" for 0 value

## Benefits

✅ **Matches Arb/Odds Design** - Consistent button style across all tools  
✅ **Cleaner Filter Bar** - Less clutter, more space  
✅ **Better Organization** - All filters in one place (sheet)  
✅ **Clear Label** - "Filters" is more intuitive than "Advanced"  
✅ **Accurate Count** - Badge includes all active filters  

## Testing Checklist

1. ✅ Button says "Filters" (not "Advanced")
2. ✅ "Filters" text always visible (not hidden on mobile)
3. ✅ Min improvement removed from filter bar
4. ✅ Min improvement appears in filter sheet
5. ✅ Min improvement dropdown works correctly
6. ✅ Badge count includes min improvement
7. ✅ Badge shows when min improvement > 0
8. ✅ Layout matches arb/odds screens


