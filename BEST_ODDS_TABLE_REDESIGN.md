# Best Odds Table Redesign

## Changes Made

Completely redesigned the Best Odds table to match the arbitrage table layout and styling, with a clean column structure focused on key information.

### New Column Structure

**7 Columns:**
1. **Improvement %** - Green badge showing price improvement
2. **League** - Sport/league badge (NFL, NBA, etc.)
3. **Player** - Player name (formatted short), team, position
4. **Market** - Market type with Over/Under badge and line
5. **Best Book** - Sportsbook logo, name, and best odds
6. **Average** - Average odds across all books + book count
7. **Action** - Bet button with external link icon

### Visual Design

```
┌─────────┬────────┬──────────────┬──────────────┬──────────────┬─────────┬────────┐
│ +5.2%   │ 🏀 NBA │ James, L     │ Points       │ 🏢 DK  -110  │  -115   │  Bet   │
│         │        │ LAL • SF     │ Over 24.5    │ Best Odds    │ 8 books │   🔗   │
└─────────┴────────┴──────────────┴──────────────┴──────────────┴─────────┴────────┘
```

### Key Features

**1. Improvement % Column** ✅
- Large green badge (matching arb table)
- Bold percentage display
- `bg-emerald-50 text-emerald-700` styling
- **Border**: `border-emerald-200 dark:border-emerald-800`

**2. League Column** ✅
- **Sport icon** (🏈 🏀 ⚾ 🏒) using `SportIcon` component
- Compact badge format with icon + text
- Gray background with border
- Clear league identification (NFL, NBA, NHL, etc.)
- **Border**: `border-gray-200 dark:border-gray-700`

**3. Player Info Column** ✅
- **Bold player name** (formatted short: "Last, F")
- Secondary info: Team • Position
- Uses `formatPlayerShort()` helper (same as arb table)

**4. Market Column** ✅
- Market name in bordered pill
- Over/Under badge (green for over, red for under) **with borders**
- Line value displayed prominently
- **Over border**: `border-emerald-200 dark:border-emerald-800`
- **Under border**: `border-red-200 dark:border-red-800`

**5. Best Book Column** ✅
- Sportsbook logo (6x6)
- Book name
- **Large bold odds** in emerald color
- Bordered card layout (matching arb table style)

**6. Average Column** ✅
- Average odds displayed
- Book count below
- Muted text styling

**7. Action Column** ✅
- Primary button with brand color
- "Bet" text + external link icon
- Tooltip on hover
- Opens in new window

### Styling Details

**Table Structure:**
```typescript
<colgroup>
  <col style={{ width: 100 }} />  // Improvement
  <col style={{ width: 80 }} />   // League
  <col style={{ width: 240 }} />  // Player
  <col style={{ width: 200 }} />  // Market
  <col style={{ width: 180 }} />  // Best Book
  <col style={{ width: 120 }} />  // Average
  <col style={{ width: 100 }} />  // Action
</colgroup>
```

**Colors & Borders:**
- Improvement badge: `bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800`
- League badge: `bg-gray-100 text-gray-700 border-gray-200 dark:border-gray-700`
- Over badge: `bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800`
- Under badge: `bg-red-50 text-red-700 border-red-200 dark:border-red-800`
- Best odds: `text-emerald-600` (large, bold)
- Action button: `bg-[var(--primary)]`

**Borders:**
- Column separators: `border-l border-gray-200 dark:border-slate-700`
- Row separators: `border-t`
- Cards: `border border-gray-200 dark:border-slate-700`

### Helper Functions

**From Arb Table:**
- `formatPlayerShort()` - Formats "LeBron James" → "James, L"
- `humanizeMarket()` - Formats "player_points" → "Points"
- `formatOdds()` - Formats odds with +/- sign
- `logo()` - Gets sportsbook logo
- `bookName()` - Gets sportsbook display name
- `getBookFallbackUrl()` - Gets affiliate/fallback URL

**New:**
- `getLeagueLabel()` - Maps sport codes to display labels

### Removed Features

❌ Expandable rows (simplified for cleaner view)  
❌ All books comparison (focus on best deal)  
❌ Framer Motion animations (performance)  
❌ Image component (using img for logos like arb table)  
❌ Multiple responsive breakpoints (fixed width columns)

### Comparison to Arb Table

**Similarities:**
- ✅ Same table structure and borders
- ✅ Same badge styling for percentages
- ✅ Same sportsbook logo display
- ✅ Same button styling
- ✅ Same helper functions
- ✅ Same color scheme

**Differences:**
- Best Odds shows single best deal per prop
- Arb table shows over/under pair
- Best Odds has league column
- Arb table has ROI/profit calculations

## Files Changed

### `components/best-odds/best-odds-table.tsx`
- Complete rewrite to match arb table
- 7-column layout
- Imported helper functions from arb table pattern
- Removed expandable rows
- Removed framer-motion
- **Added league badge with sport icon** (🏈 🏀 ⚾ 🏒)
- **Added borders to all badges** (improvement, league, over/under)
- Imported `SportIcon` component and `getAllLeagues` helper
- Added `getSportForLeague()` helper to map league → sport
- Simplified to focus on best deal

## Benefits

✅ **Consistent Design** - Matches arbitrage table exactly  
✅ **Cleaner Layout** - Fixed columns, no expansion  
✅ **Better Scannability** - Key info at a glance  
✅ **Familiar UX** - Users know this pattern from arb  
✅ **Performance** - No animations, simpler rendering  
✅ **Professional Look** - Clean, modern table design  

## Testing Checklist

1. ✅ Improvement % shows as green badge
2. ✅ League badge displays correctly
3. ✅ Player names formatted short
4. ✅ Market displays with Over/Under badge
5. ✅ Sportsbook logo shows correctly
6. ✅ Best odds displayed prominently
7. ✅ Average odds and book count show
8. ✅ Bet button opens link in new window
9. ✅ Tooltip shows on button hover
10. ✅ Table scrolls horizontally on small screens
11. ✅ Dark mode styling works
12. ✅ Borders and spacing match arb table

