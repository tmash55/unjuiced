# Limit Max Display Options

## Current Implementation (Compact Vertical Stack)

### Visual Example:
```
o7.5 +110
$500
```

### Code:
```tsx
<div className="text-xs font-medium leading-tight">
  <div>
    <span className="opacity-75">o7.5</span>
    <span className="ml-1 font-semibold">+110</span>
  </div>
  {odds.limit_max && (
    <div className="text-[9px] text-neutral-400 dark:text-neutral-500 font-normal mt-0.5 leading-none">
      ${odds.limit_max}
    </div>
  )}
</div>
```

### Pros:
- ✅ Clean, easy to read
- ✅ Compact with `leading-tight` and smaller text
- ✅ Clear hierarchy (odds are primary, limit is secondary)
- ✅ Minimal height increase

### Cons:
- ⚠️ Slightly taller cells than before

---

## Alternative: Inline with Parenthesis

### Visual Example:
```
o7.5 +110 ($500)
```

### Code:
```tsx
<div className="text-xs font-medium">
  <span className="opacity-75">o7.5</span>
  <span className="ml-1 font-semibold">+110</span>
  {odds.limit_max && (
    <span className="ml-1 text-[9px] text-neutral-400 dark:text-neutral-500">
      (${odds.limit_max})
    </span>
  )}
</div>
```

### Pros:
- ✅ Same cell height as before
- ✅ All info on one line

### Cons:
- ⚠️ Can get crowded on smaller screens
- ⚠️ Harder to scan quickly
- ⚠️ May cause text wrapping issues

---

## Alternative: Abbreviated Inline

### Visual Example:
```
o7.5 +110 (M:500)
```

### Code:
```tsx
<div className="text-xs font-medium">
  <span className="opacity-75">o7.5</span>
  <span className="ml-1 font-semibold">+110</span>
  {odds.limit_max && (
    <span className="ml-1 text-[9px] text-neutral-400 dark:text-neutral-500">
      (M:{odds.limit_max})
    </span>
  )}
</div>
```

### Pros:
- ✅ Same cell height
- ✅ Very compact
- ✅ "M:" abbreviation for "Max"

### Cons:
- ⚠️ Less clear what "M:" means
- ⚠️ Still can get crowded

---

## Recommendation

**Current implementation (Compact Vertical Stack)** is best because:

1. **Readability**: Easy to scan and understand at a glance
2. **Hierarchy**: Odds are primary focus, limit is secondary info
3. **Responsive**: Works well on all screen sizes
4. **Minimal impact**: With `leading-tight` and smaller text (9px), the height increase is minimal
5. **Tooltip backup**: The tooltip still shows "Max: $500" on hover for confirmation

The compact vertical stack gives you the best of both worlds - clarity without taking up too much space.

---

## If You Want to Try Inline (Parenthesis)

Replace the current implementation with this code in `odds-table.tsx`:

```tsx
// For non-moneyline markets (line + odds + limit inline)
<div className="text-xs font-medium">
  <span className={`opacity-75 ${lineChanged ? 'animate-odds-flash-line px-1 rounded' : ''}`}>
    {formatLine(odds.line, side)}
  </span>
  <span
    className={cn(
      'ml-1 font-semibold transition-colors',
      priceChanged && (isPositiveChange ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400')
    )}
  >
    {formatOdds(odds.price)}
  </span>
  {odds.limit_max && (
    <span className="ml-1 text-[9px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
      (${odds.limit_max})
    </span>
  )}
</div>

// For moneyline markets (odds + limit inline)
<div className="text-sm font-semibold">
  <span
    className={cn(
      priceChanged && (isPositiveChange ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'),
      'transition-colors'
    )}
  >
    {formatOdds(odds.price)}
  </span>
  {odds.limit_max && (
    <span className="ml-1 text-[9px] text-neutral-400 dark:text-neutral-500 font-normal whitespace-nowrap">
      (${odds.limit_max})
    </span>
  )}
</div>
```

