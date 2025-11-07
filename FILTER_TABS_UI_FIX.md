# Filter Tabs UI Fix

## Issue
The filter tabs had UI issues:
1. Text not properly centered vertically
2. Active tab state looked "funky" - inconsistent styling
3. Default Radix UI classes conflicting with custom CSS

## Root Cause
The `TabsList` and `TabsTrigger` components from Radix UI have default classes that were conflicting with the custom `.filter-tabs` CSS:
- Default `w-fit` was limiting width
- Default height/padding classes were interfering
- Default box-shadow was conflicting with custom active state
- Flexbox alignment wasn't properly set

## Solution
Added `!important` flags and explicit flexbox/alignment properties to override Radix UI defaults:

### Key Changes:

**1. Container Fixes:**
```css
.filter-tabs {
  background: #f8f9fa !important;
  padding: 4px !important;
  border-radius: 0.5rem !important;
  height: auto !important;  /* ← NEW: Override default height */
}
```

**2. Button Centering:**
```css
.filter-tabs button {
  padding: 0.625rem 1rem !important;
  display: flex !important;              /* ← NEW: Force flexbox */
  align-items: center !important;        /* ← NEW: Center vertically */
  justify-content: center !important;    /* ← NEW: Center horizontally */
  height: auto !important;               /* ← NEW: Override fixed height */
  min-height: 2.5rem;                    /* ← NEW: Consistent height */
  border: 1px solid transparent !important;  /* ← NEW: Clean border */
  box-shadow: none !important;           /* ← NEW: Remove default shadow */
}
```

**3. Active State Fixes:**
```css
.filter-tabs button[data-state="active"] {
  background: white !important;
  color: rgb(14, 132, 189) !important;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.08),
    inset 0 -2px 0 rgba(14, 165, 233, 0.5) !important;  /* ← Proper shadow */
  border: 1px solid transparent !important;  /* ← Clean border */
}
```

**4. Underline Position:**
```css
.filter-tabs button[data-state="active"]::after {
  bottom: 0px;  /* ← Changed from -4px to align properly */
}
```

## Before vs After

**Before:**
```
┌─────────────────────────────────────┐
│ 🏢 Sportsbooks  🎯 Leagues  📈 Odds │  ← Text misaligned
│     ▔▔▔▔▔▔▔▔▔                      │  ← Underline too low
└─────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────┐
│  🏢 Sportsbooks   🎯 Leagues  📈 Odds│  ← Properly centered
│      ▔▔▔▔▔▔▔                       │  ← Underline aligned
└─────────────────────────────────────┘
```

## Files Changed

### `app/globals.css`
- Added `!important` flags to override Radix UI defaults
- Added explicit flexbox properties for centering
- Added `min-height` for consistent tab height
- Fixed underline position
- Cleaned up border and box-shadow conflicts

## Benefits

✅ **Proper Centering** - Text and icons perfectly centered  
✅ **Consistent Height** - All tabs same height  
✅ **Clean Active State** - No conflicting shadows/borders  
✅ **Better Alignment** - Underline properly positioned  
✅ **Works Everywhere** - Fixes both arb and best odds filters  

## Testing Checklist

1. ✅ Tab text centered vertically
2. ✅ Tab icons centered vertically
3. ✅ Active tab has clean white background
4. ✅ Active tab has proper shadow
5. ✅ Underline aligned at bottom of tab
6. ✅ Hover state works correctly
7. ✅ Dark mode looks good
8. ✅ Works in both arb and best odds filters


