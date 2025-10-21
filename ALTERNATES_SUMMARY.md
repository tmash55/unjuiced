# ✅ Alternate Lines Feature - Complete

## 🎯 What We Built

A clean, maintainable system for displaying alternate lines in the odds table using:
- Modern `/api/props/alternates` endpoint
- Reusable wrapper component for expand/collapse
- Client-side caching to reduce API calls
- Smooth animations and loading states

---

## 📦 Components Created

### 1. **API Endpoint** (`app/api/props/alternates/route.ts`)
- Fetches from Redis: `props:{sport}:rows:alt:{sid}`
- Filters out primary line
- Returns alternates with metadata
- 30s cache headers

### 2. **AlternateLinesRow** (`components/odds-screen/tables/alternate-lines-row.tsx`)
- Displays alternate lines below expanded row
- Styled with blue accent border
- Loading/error/empty states
- Clickable odds that open bet slip URLs
- Smooth animations

### 3. **ExpandableRowWrapper** (`components/odds-screen/tables/expandable-row-wrapper.tsx`)
- Wraps existing table rows
- Adds expand/collapse icon with rotation animation
- Lazy loading (fetch on first expand)
- Client-side caching (60s TTL)
- Clean, reusable API

---

## 🔧 How to Integrate

### Step 1: Import the Wrapper

```tsx
import { ExpandableRowWrapper } from "./expandable-row-wrapper";
```

### Step 2: Wrap Your Rows

```tsx
<ExpandableRowWrapper
  sid={row.id}
  sport="nfl"
  primaryLine={1.5}
  sportsbookOrder={sportsbookOrder}
  onOddsClick={handleOddsClick}
>
  <td>...</td> {/* Your existing cells */}
  <td>...</td>
</ExpandableRowWrapper>
```

### Step 3: Add Expand Column

```tsx
<thead>
  <tr>
    <th className="w-8"></th> {/* For expand icon */}
    <th>Entity/Player</th>
    {/* ... rest of headers ... */}
  </tr>
</thead>
```

---

## 🧹 Cleanup Required

Remove old alternates logic from `odds-table.tsx`:

1. **State:** `alternatesCache`, `alternatesLoading`, `alternateRows`
2. **Functions:** `fetchAlternates`, `getAvailableLines`, etc.
3. **Effects:** Alternates prefetching, caching, transforming
4. **Props:** Remove alternates-related props from `MemoizedTableRow`

See `ALTERNATES_IMPLEMENTATION.md` for detailed cleanup instructions.

---

## ✨ Benefits

| Before | After |
|--------|-------|
| Complex event-based caching | Simple row-based caching |
| Tight coupling with table | Reusable wrapper component |
| Multiple useEffects | Single lazy-loading hook |
| Old `/api/odds-screen/alternates` | New `/api/props/alternates` |
| Prefetch all events | Fetch on demand |

---

## 📊 Architecture

```
User clicks expand icon
         ↓
ExpandableRowWrapper checks cache
         ↓
    Cache hit?
    ↙        ↘
  Yes         No
   ↓           ↓
Display     Fetch from
cached      /api/props/alternates
data             ↓
              Cache result
                 ↓
            Display data
                 ↓
        AlternateLinesRow
          (animated)
```

---

## 🎨 UI/UX Features

- ✅ Expand icon rotates 90° on click
- ✅ Smooth expand/collapse animation
- ✅ Loading spinner during fetch
- ✅ Error message if fetch fails
- ✅ "No alternates" message if empty
- ✅ Blue accent border for alternate rows
- ✅ Clickable odds open bet slip in new tab
- ✅ Responsive layout matching main table

---

## 🧪 Testing

```bash
# Test API endpoint
curl "http://localhost:3000/api/props/alternates?sport=nfl&sid=YOUR_SID_HERE"

# Expected response:
{
  "sid": "...",
  "sport": "nfl",
  "alternates": [
    { "ln": 0.5, "books": {...}, "best": {...}, "avg": {...} },
    { "ln": 2.5, "books": {...}, "best": {...}, "avg": {...} }
  ],
  "primary_ln": 1.5,
  "player": "Aaron Rodgers",
  "timestamp": 1234567890
}
```

---

## 📝 Files Changed

- ✅ `app/api/props/alternates/route.ts` - API endpoint
- ✅ `components/odds-screen/tables/alternate-lines-row.tsx` - Display component
- ✅ `components/odds-screen/tables/expandable-row-wrapper.tsx` - Wrapper component
- ⏳ `components/odds-screen/tables/odds-table.tsx` - Integration pending

---

## 🚀 Ready for Integration

The feature is **complete and ready** to integrate into your `odds-table.tsx` component!

Follow the steps in `ALTERNATES_IMPLEMENTATION.md` to:
1. Integrate the wrapper
2. Remove old alternates logic
3. Test with real data

---

## 🎉 Result

A clean, maintainable, performant alternate lines system that:
- Reduces API calls with smart caching
- Provides smooth UX with animations
- Follows modern React best practices
- Is easy to integrate and maintain



