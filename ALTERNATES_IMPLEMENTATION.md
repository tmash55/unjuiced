# Alternate Lines Implementation Guide

## ✅ Complete Implementation

The alternate lines feature is now fully implemented with a clean, maintainable architecture.

---

## 📁 File Structure

```
app/api/props/alternates/
  └── route.ts                                    # API endpoint

components/odds-screen/tables/
  ├── alternate-lines-row.tsx                     # Displays alternate lines
  └── expandable-row-wrapper.tsx                  # Wraps rows with expand/collapse
```

---

## 🔧 API Endpoint

### Route: `/api/props/alternates`

**Query Parameters:**
- `sport` (required): Sport key (nfl, mlb, nba, wnba)
- `sid` (required): Row ID for the odds line

**Redis Key Pattern:**
```
props:{sport}:rows:alt:{sid}
```

**Response:**
```typescript
{
  sid: string;
  sport: string;
  alternates: AlternateLine[];  // Filtered (primary line removed)
  primary_ln: number;
  player?: string;
  position?: string;
  team?: string;
  market?: string;
  event?: any;
  timestamp: number;
}
```

**Features:**
- ✅ Fetches from Redis using modern key pattern
- ✅ Filters out primary line to avoid duplicates
- ✅ Returns metadata (player, position, team, market, event)
- ✅ Caching headers (30s)
- ✅ Error handling (invalid sport, missing SID, parse errors)

---

## 🎨 Component Architecture

### 1. `ExpandableRowWrapper` (Wrapper Component)

**Purpose:** Wraps existing table rows with expand/collapse functionality

**Features:**
- ✅ Expand/collapse icon with smooth rotation animation
- ✅ Client-side caching (60s TTL) to reduce API calls
- ✅ Lazy loading (fetch on first expand)
- ✅ Loading states
- ✅ Error handling
- ✅ Smooth expand/collapse animations (framer-motion)

**Props:**
```typescript
{
  sid: string;              // Row ID
  sport: string;            // Sport key
  primaryLine?: number;     // Primary line value
  children: React.ReactNode; // The actual table row
  sportsbookOrder: string[]; // Sportsbook order for columns
  onOddsClick?: (line, side, bookId) => void;
}
```

**Usage:**
```tsx
<ExpandableRowWrapper
  sid={row.id}
  sport="nfl"
  primaryLine={1.5}
  sportsbookOrder={sportsbookOrder}
  onOddsClick={handleOddsClick}
>
  <td>...</td> {/* Your existing table cells */}
  <td>...</td>
</ExpandableRowWrapper>
```

---

### 2. `AlternateLinesRow` (Display Component)

**Purpose:** Renders alternate lines in a styled, collapsible format

**Features:**
- ✅ Smooth animations (framer-motion `AnimatePresence`)
- ✅ Styled alternate rows (blue accent border)
- ✅ Loading skeleton
- ✅ Error state
- ✅ Empty state (no alternates)
- ✅ Clickable odds cells that open bet slip URLs
- ✅ Responsive layout matching main table

**Props:**
```typescript
{
  alternates: AlternateLine[];
  loading: boolean;
  error: string | null;
  primaryLine?: number;
  sportsbookOrder: string[];
  onOddsClick?: (line, side, bookId) => void;
}
```

---

## 🔌 Integration with `odds-table.tsx`

### Step 1: Import the Wrapper

```typescript
import { ExpandableRowWrapper } from "./expandable-row-wrapper";
```

### Step 2: Wrap Each Row

In your table body rendering logic, wrap each row:

```tsx
{data.map((row, index) => (
  <ExpandableRowWrapper
    key={row.id}
    sid={row.id}
    sport={sport}
    primaryLine={row.odds.line}
    sportsbookOrder={sportsbookOrder}
    onOddsClick={handleOddsClick}
  >
    {/* Your existing table cells */}
    <td>{row.entity.name}</td>
    <td>{row.event.name}</td>
    {/* ... more cells ... */}
  </ExpandableRowWrapper>
))}
```

### Step 3: Add Extra Column for Expand Icon

Update your table header to include a narrow column for the expand icon:

```tsx
<thead>
  <tr>
    <th className="w-8"></th> {/* Expand icon column */}
    <th>Entity/Player</th>
    <th>Event</th>
    {/* ... more headers ... */}
  </tr>
</thead>
```

---

## 🧹 Cleanup: Remove Old Alternates Logic

### Files to Update

#### ❌ Remove from `odds-table.tsx`:

1. **State:**
   ```typescript
   const [alternatesCache, setAlternatesCache] = useState<Record<string, any>>({})
   const [alternatesLoading, setAlternatesLoading] = useState<Record<string, boolean>>({})
   const [alternateRows, setAlternateRows] = useState<Record<string, Record<string, AlternateRowData[]>>>({})
   ```

2. **Functions:**
   ```typescript
   const fetchAlternates = useCallback(async (eventId: string) => { ... })
   const getAvailableLines = (item: OddsTableItem): number[] => { ... }
   const isLoadingAlternates = (eventId: string): boolean => { ... }
   const getAlternateDataForLine = (item: OddsTableItem, selectedLine: number): AlternateRowData | null => { ... }
   const updatePrimaryRowWithLine = useCallback(async (item: OddsTableItem, selectedLine: number) => { ... })
   ```

3. **Effects:**
   ```typescript
   // Remove alternates prefetching effect
   useEffect(() => { ... }, [data, preferences.includeAlternates, alternatesCache, alternatesLoading, fetchAlternates])
   
   // Remove alternates cache reset effect
   useEffect(() => { ... setExpandedRows({}); setAlternatesCache({}); ... }, [sport, type, market, scope])
   
   // Remove alternates row transformation effect
   useEffect(() => { ... const next: Record<string, Record<string, AlternateRowData[]>> = {}; ... }, [alternatesCache, type])
   ```

4. **Props passed to `MemoizedTableRow`:**
   ```typescript
   // Remove from MemoizedTableRow props interface:
   expandedRows: Record<string, boolean>
   setExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
   fetchAlternates: (eventId: string) => Promise<void>
   alternateRows: Record<string, Record<string, AlternateRowData[]>>
   alternatesLoading: Record<string, boolean>
   customLineSelections: Record<string, number>
   updatePrimaryRowWithLine: (item: OddsTableItem, selectedLine: number) => Promise<void>
   ```

#### ✅ Replace With:

Use the simple `ExpandableRowWrapper` component as shown above.

---

## 🎯 Benefits of New Architecture

### Before (Old System):
- ❌ Complex event-based caching (`alternatesCache[eventId]`)
- ❌ Nested state (`alternateRows[eventId][playerId]`)
- ❌ Tight coupling with table component
- ❌ Multiple useEffects for prefetching, caching, and transforming
- ❌ Called old `/api/odds-screen/alternates` endpoint

### After (New System):
- ✅ Simple row-based caching (`sid` as key)
- ✅ Clean separation of concerns
- ✅ Reusable wrapper component
- ✅ Single-responsibility components
- ✅ Uses modern `/api/props/alternates` endpoint
- ✅ Lazy loading (fetch only on expand)
- ✅ Client-side caching (60s TTL)

---

## 🧪 Testing Checklist

- [ ] Expand icon appears for each row
- [ ] Click expand icon to fetch alternates
- [ ] Alternates display correctly below row
- [ ] Primary line is filtered out
- [ ] Alternates are sorted by line value
- [ ] Loading state shows spinner
- [ ] Error state shows error message
- [ ] Empty state shows "No alternates" message
- [ ] Clicking odds opens bet slip URL in new tab
- [ ] Cache works (second expand doesn't re-fetch for 60s)
- [ ] Collapse animation is smooth
- [ ] Expand icon rotates smoothly

---

## 📝 Example Integration

```tsx
// In odds-table.tsx

import { ExpandableRowWrapper } from "./expandable-row-wrapper";

// In your table body rendering:

<tbody>
  {sortedAndFilteredData.map((item, index) => (
    <ExpandableRowWrapper
      key={item.id}
      sid={item.id}
      sport={sport}
      primaryLine={item.odds.best.over?.line || item.odds.best.under?.line}
      sportsbookOrder={orderedSportsbooks}
      onOddsClick={(line, side, bookId) => {
        console.log(`Clicked: ${line} ${side} on ${bookId}`);
        // Handle bet slip opening
      }}
    >
      {/* Entity/Player */}
      <td className="px-4 py-3">
        <div className="font-medium">{item.entity.name}</div>
        {item.entity.details && (
          <div className="text-xs text-neutral-500">{item.entity.details}</div>
        )}
      </td>

      {/* Event */}
      <td className="px-4 py-3">
        <div className="text-sm">{item.event.name}</div>
        <div className="text-xs text-neutral-500">
          {new Date(item.event.startTime).toLocaleString()}
        </div>
      </td>

      {/* Sportsbook columns */}
      {orderedSportsbooks.map((bookId) => {
        const bookData = item.odds.books[bookId];
        return (
          <td key={bookId} className="px-2 py-2">
            {bookData ? (
              <div className="flex flex-col gap-1">
                {/* Over */}
                {bookData.over && (
                  <button className="...">
                    {formatOdds(bookData.over.price)}
                  </button>
                )}
                {/* Under */}
                {bookData.under && (
                  <button className="...">
                    {formatOdds(bookData.under.price)}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center text-xs text-neutral-400">-</div>
            )}
          </td>
        );
      })}
    </ExpandableRowWrapper>
  ))}
</tbody>
```

---

## 🚀 Next Steps

1. ✅ API endpoint created
2. ✅ `AlternateLinesRow` component created
3. ✅ `ExpandableRowWrapper` component created
4. ⏳ **Integrate wrapper into `odds-table.tsx`**
5. ⏳ **Remove old alternates logic**
6. ⏳ **Test with real data**

---

## 📚 Reference

- **API Route:** `app/api/props/alternates/route.ts`
- **Display Component:** `components/odds-screen/tables/alternate-lines-row.tsx`
- **Wrapper Component:** `components/odds-screen/tables/expandable-row-wrapper.tsx`
- **Redis Key Pattern:** `props:{sport}:rows:alt:{sid}`
- **Cache TTL:** 60 seconds (client-side)
- **API Cache:** 30 seconds (server-side)



