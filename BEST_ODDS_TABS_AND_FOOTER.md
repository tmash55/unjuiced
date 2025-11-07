# Best Odds Filters - Tabs & Footer Update

## Changes Made

Completely redesigned the Best Odds filters sheet to match the arbitrage screen pattern with tabs, proper state management, and footer action buttons.

### New Structure

#### Before:
- Single scrollable sheet with all filters stacked
- No tabs
- No footer buttons
- Changes applied immediately

#### After:
- **3 Tabs**: Sportsbooks | Leagues & Markets | Improvement & Odds
- **Footer Buttons**: Reset All | Cancel | Apply Filters
- **Local State**: Changes not applied until "Apply" clicked
- **Unsaved Changes Tracking**: "Apply" button highlights when changes pending

### Tab Structure

**Tab 1: Sportsbooks** 🏢
- Grid of sportsbook cards with logos
- Checkboxes for selection
- "Select All" and "Clear" buttons
- Sorted by priority

**Tab 2: Leagues & Markets** 🎯
- **Leagues Section**: Grid of league cards (NBA, NFL, etc.)
- **Markets Section**: Grouped by sport (Basketball, Football, Hockey, Baseball)
- "Select All" and "Clear All" buttons
- Tip box explaining default behavior

**Tab 3: Improvement & Odds** 📈
- Min Improvement % (number input)
- Min Odds (optional number input)
- Max Odds (optional number input)
- Helper text for each field

### Footer Actions

```
┌─────────────────────────────────────────────┐
│ [Reset All]          [Cancel] [Apply Filters]│
└─────────────────────────────────────────────┘
```

**Reset All:**
- Resets all filters to defaults (all selected)
- Applies immediately
- Clears min/max odds

**Cancel:**
- Discards unsaved changes
- Closes sheet
- Reverts to last applied state

**Apply Filters:**
- Saves changes to preferences
- Closes sheet
- Highlights when unsaved changes exist

### State Management

**Local State (Uncommitted):**
```typescript
const [localBooks, setLocalBooks] = useState<string[]>([]);
const [localLeagues, setLocalLeagues] = useState<string[]>([]);
const [localMarkets, setLocalMarkets] = useState<string[]>([]);
const [localMinImprovement, setLocalMinImprovement] = useState<number>(0);
const [localMaxOdds, setLocalMaxOdds] = useState<number | undefined>();
const [localMinOdds, setLocalMinOdds] = useState<number | undefined>();
```

**Change Tracking:**
```typescript
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

// Compares local state to saved prefs
useEffect(() => {
  const changed =
    localBooks.length !== prefs.selectedBooks.length ||
    localBooks.some(id => !prefs.selectedBooks.includes(id)) ||
    // ... check all fields
  setHasUnsavedChanges(changed);
}, [localBooks, localLeagues, localMarkets, ...]);
```

**Apply Function:**
```typescript
const apply = () => {
  onPrefsChange({
    ...prefs,
    selectedBooks: localBooks,
    selectedLeagues: localLeagues,
    selectedMarkets: localMarkets,
    minImprovement: localMinImprovement,
    maxOdds: localMaxOdds,
    minOdds: localMinOdds,
  });
  setOpen(false);
};
```

### Visual Design

**Tab Navigation:**
```
┌───────────────────────────────────────────┐
│ [🏢 Sportsbooks] [🎯 Leagues] [📈 Odds]  │
├───────────────────────────────────────────┤
│                                           │
│           Tab Content Here                │
│                                           │
└───────────────────────────────────────────┘
```

**Filter Cards:**
```
┌─────────────────────────────────────┐
│ ☑ [Logo] DraftKings                 │ ← Active
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ☐ [Logo] FanDuel                    │ ← Inactive
└─────────────────────────────────────┘
```

### Key Features

1. **Tabs for Organization** ✅
   - Sportsbooks (Building2 icon)
   - Leagues & Markets (Target icon)
   - Improvement & Odds (TrendingUp icon)

2. **Local State Management** ✅
   - Changes staged locally
   - Not applied until "Apply" clicked
   - Can be cancelled/discarded

3. **Unsaved Changes Indicator** ✅
   - "Apply" button highlights when changes pending
   - Visual feedback for user

4. **Reset Functionality** ✅
   - One-click reset to defaults
   - Applies immediately (doesn't wait for Apply)

5. **Cancel Functionality** ✅
   - Discards uncommitted changes
   - Reverts to last saved state

6. **Filter Cards with Checkboxes** ✅
   - Visual card-based selection
   - Active state styling
   - Hover effects

7. **Grouped Markets** ✅
   - Basketball, Football, Hockey, Baseball
   - Organized by sport type
   - Easy to scan

8. **Number Inputs for Odds** ✅
   - Min/Max odds with placeholders
   - Optional fields (can be empty)
   - Helper text

## Files Changed

### `components/best-odds/best-odds-filters.tsx`
- Complete rewrite to match arb filters pattern
- Added Tabs component
- Added local state management
- Added footer with Reset/Cancel/Apply buttons
- Added unsaved changes tracking
- Improved visual design with filter cards

## Benefits

✅ **Matches Arb Design** - Consistent UI across tools  
✅ **Better Organization** - Tabs group related filters  
✅ **Explicit Apply** - Users control when changes take effect  
✅ **Can Cancel** - Discard changes if needed  
✅ **Quick Reset** - One-click back to defaults  
✅ **Visual Feedback** - Clear indication of unsaved changes  
✅ **Professional UX** - Matches modern filter patterns  

## Testing Checklist

1. ✅ Three tabs render correctly
2. ✅ Tab icons show on desktop, hidden on mobile
3. ✅ Sportsbook cards show logos and names
4. ✅ League and market checkboxes work
5. ✅ Local state updates when clicking checkboxes
6. ✅ "Apply" button highlights when changes made
7. ✅ "Apply" saves changes and closes sheet
8. ✅ "Cancel" discards changes and closes sheet
9. ✅ "Reset All" resets to defaults immediately
10. ✅ Filter count badge updates correctly
11. ✅ Sheet reopens with last applied state
12. ✅ Min/Max odds inputs work correctly


