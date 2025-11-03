# Best Odds - Expandable Rows Feature ✅

## Overview

Added expandable row functionality to the Best Odds table. Users can now click on any row to expand it and see all available sportsbook odds for that specific line, making it easy to compare prices across books.

## What Changed

### BestOddsTable Component Updates

**File:** `components/best-odds/best-odds-table.tsx`

#### New Features

1. **Click to Expand**
   - Click anywhere on a row to expand/collapse
   - Chevron icon (Right → Down) shows expand state
   - Smooth animations powered by framer-motion

2. **All Sportsbook Odds Display**
   - Grid layout showing all books (1-4 columns responsive)
   - Books sorted by best odds first
   - Best book highlighted with brand color
   - Each book card shows:
     - Sportsbook name (capitalized)
     - Odds (formatted)
     - "BEST" badge for top book
     - Bet button with deep link

3. **Stats Summary**
   - Average odds across all books
   - Best odds (highlighted)
   - Price improvement percentage

4. **Visual Design**
   - Light blue background for expanded rows
   - Brand-colored left border (4px)
   - Best book cards use brand color accent
   - Other books use neutral styling
   - Smooth expand/collapse animation
   - Staggered card animations (0.03s delay)

## UI Behavior

### Row Click
- **Click row**: Expands to show all sportsbooks
- **Click again**: Collapses row
- **Click chevron**: Same as clicking row
- **Click bet button**: Opens bet link (doesn't expand row)

### Expanded Content Layout

```
┌─────────────────────────────────────────────────┐
│ [TrendingUp] All Sportsbook Odds (8 books)     │
│                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐
│ │DraftKings│ │ FanDuel  │ │ BetMGM   │ │Caesars│
│ │ BEST     │ │          │ │          │ │       │
│ │  +120    │ │  +115    │ │  +110    │ │ +105  │
│ │  [Bet]   │ │  [Bet]   │ │  [Bet]   │ │ [Bet] │
│ └──────────┘ └──────────┘ └──────────┘ └──────┘
│                                                  │
│ ────────────────────────────────────────────────│
│ Avg: +108   Best: +120   +15.3% improvement    │
└─────────────────────────────────────────────────┘
```

### Color Coding

**Best Book:**
- Background: Brand color (10% opacity)
- Border: Brand color
- Text: Brand color
- Button: Brand background

**Other Books:**
- Background: White/Neutral-800
- Border: Neutral-200/700
- Text: Neutral-900/White
- Button: Neutral-100/700

## Technical Implementation

### State Management
```typescript
const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
```

### Toggle Function
```typescript
const toggleRow = (key: string) => {
  setExpandedRows(prev => {
    const next = new Set(prev);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return next;
  });
};
```

### Animations
- **Row expand/collapse**: 200ms duration
- **Card stagger**: 30ms delay per card
- **Motion**: Opacity and Y-axis translation

## Responsive Design

**Grid Columns:**
- Mobile (< sm): 1 column
- Small (sm): 2 columns
- Large (lg): 3 columns
- Extra Large (xl): 4 columns

**Hidden Columns:**
- Game column: Hidden on < lg
- Improvement column: Hidden on < md
- Books column: Hidden on < xl

## Data Source

All odds data comes from the `allBooks` array in each `BestOddsDeal`:

```typescript
allBooks: Array<{
  book: string;      // Sportsbook ID (e.g., "draftkings")
  price: number;     // American odds (e.g., 120, -110)
  link: string;      // Deep link to place bet
}>
```

This data is already embedded in the API response - no additional API calls needed!

## User Benefits

1. **Complete Transparency**: See all available odds at a glance
2. **Easy Comparison**: Quickly identify which book has best odds
3. **One-Click Betting**: Direct links to each sportsbook
4. **Visual Hierarchy**: Best odds clearly highlighted
5. **Fast Access**: No need to visit multiple sites

## Performance

- ✅ No additional API calls
- ✅ Smooth animations (framer-motion)
- ✅ Efficient state management (Set)
- ✅ Click event bubbling handled correctly
- ✅ Prevents duplicate expansions

## Accessibility

- Keyboard accessible (can expand with Enter/Space)
- Screen reader friendly (semantic HTML)
- Clear visual indicators (chevron icons)
- High contrast for best book highlighting

## Example Use Case

**Scenario**: User sees Patrick Mahomes passing TDs at +120 on DraftKings

1. User clicks the row
2. Row expands showing all 8 books:
   - DraftKings: +120 (BEST)
   - FanDuel: +115
   - BetMGM: +110
   - Caesars: +105
   - BetRivers: +100
   - ESPN: +100
   - Fanatics: +95
   - Hard Rock: +90

3. User sees DraftKings is clearly the best
4. User clicks "Bet" button
5. Opens DraftKings app/website with bet pre-filled

## Future Enhancements (Optional)

1. **History Tracking**: Show how odds have changed over time
2. **Alerts**: Notify when a book improves their odds
3. **Comparison Mode**: Compare multiple lines side-by-side
4. **Bookmaker Stats**: Show which books consistently offer best odds
5. **Quick Add**: Add multiple lines to a bet slip at once

## Testing Checklist

- [x] Row expands on click
- [x] Chevron icon changes state
- [x] All books display correctly
- [x] Best book is highlighted
- [x] Odds are sorted (best first)
- [x] Bet buttons work without expanding
- [x] Expand animation is smooth
- [x] Card stagger animation works
- [x] Mobile responsive (1-4 columns)
- [x] Dark mode styling works
- [x] No API errors or console warnings

## Status

✅ Complete and ready for use!

Users can now get full transparency into sportsbook odds and make informed betting decisions with a single click.

