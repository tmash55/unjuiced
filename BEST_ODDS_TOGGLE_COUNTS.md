# Best Odds Toggle with Counts

## Changes Made

Updated the Pregame/Live toggle to match the arbitrage screen pattern with counts and a disabled "Live" button showing "Coming Soon".

### Toggle Changes

#### Before:
```
[Pre-Game] [Live] [All]  Showing upcoming games
```

#### After:
```
[Pre-Game (234)] [Live 🔒 (Soon)]  Showing upcoming games
```

### Specific Updates

1. **Added Counts to Pre-Game Button** ✅
   - Shows count of pregame opportunities: `Pre-Game (234)`
   - Count updates dynamically based on data
   - Matches arbitrage screen pattern

2. **Removed "All" Toggle** ❌
   - Simplified to just Pre-Game and Live
   - Matches arbitrage screen (only 2 options)

3. **Disabled Live Button with Lock Icon** 🔒
   - Button is disabled (not clickable)
   - Shows lock icon
   - Shows "(Soon)" text
   - Has hover title "Coming soon"
   - Visual indicator that feature is coming

4. **Info Text Hidden on Mobile** 📱
   - Added `hidden md:block` class
   - Matches arbitrage screen responsive behavior

### Visual Design

```
┌─────────────────────────────────────────────────────┐
│ [Pre-Game (234)] [Live 🔒 (Soon)]  Showing upcoming │
└─────────────────────────────────────────────────────┘
```

The Live button appears disabled with:
- Lock icon (🔒)
- "(Soon)" text
- Reduced opacity
- No hover/click interaction
- Tooltip: "Coming soon"

### Code Structure

```typescript
// Calculate counts by scope
const pregameCount = deals.filter(d => d.scope === 'pregame').length;
const liveCount = deals.filter(d => d.scope === 'live').length;

// Pre-Game button (active)
<button onClick={() => handlePrefsChange({ ...prefs, scope: 'pregame' })}>
  Pre-Game {stats.pregame > 0 && `(${stats.pregame})`}
</button>

// Live button (disabled, coming soon)
<button disabled={true} title="Coming soon">
  <span className="flex items-center gap-1.5">
    Live
    <Lock className="h-3 w-3 opacity-60" />
    <span className="text-xs opacity-60">(Soon)</span>
  </span>
</button>
```

## Files Changed

### `app/(protected)/best-odds/page.tsx`
- Added `Lock` icon import from lucide-react
- Added `pregameCount` and `liveCount` calculations
- Updated toggle to show counts
- Disabled Live button with lock icon and "(Soon)" text
- Removed "All" toggle option
- Made info text hidden on mobile

## Benefits

✅ **Clear Counts** - Users see exactly how many opportunities in each scope  
✅ **Matches Arb Pattern** - Consistent with arbitrage screen design  
✅ **Coming Soon Indicator** - Clear visual that Live is planned feature  
✅ **Better UX** - Lock icon + text makes it obvious feature isn't ready  
✅ **Responsive** - Info text hidden on mobile to save space  

## Testing Checklist

1. ✅ Pre-Game button shows count: `Pre-Game (234)`
2. ✅ Count updates when data changes
3. ✅ Live button is disabled (not clickable)
4. ✅ Live button shows lock icon
5. ✅ Live button shows "(Soon)" text
6. ✅ Hover shows "Coming soon" tooltip
7. ✅ Info text hidden on mobile screens
8. ✅ "All" toggle removed
9. ✅ Layout matches arbitrage screen


