# Pro Users: Unlimited Arbitrage Opportunities

## 🎯 Change Summary

**Before:** All users (free and pro) were limited to 100 arbitrage opportunities.  
**After:** Pro users get unlimited opportunities, free users limited to 100.

---

## 🔧 Changes Made

### 1. **Updated `arbs-content.tsx`**

```tsx
// BEFORE ❌
const { rows, ... } = useArbsView({ pro, live: auto, eventId, limit: 100, mode });

// AFTER ✅
// Pro users get unlimited results, free users limited to 100
const limit = pro ? undefined : 100;

const { rows, ... } = useArbsView({ pro, live: auto, eventId, limit, mode });
```

**Logic:**
- `limit = undefined` → Pro users (no limit, fetch all)
- `limit = 100` → Free users (capped at 100 results)

---

### 2. **Updated `use-arbs-stream.ts`**

```tsx
// BEFORE ❌
setHasMore(res.ids.length === limit); // Breaks when limit is undefined

// AFTER ✅
// If limit is undefined (pro users), there's no pagination, so hasMore is false
// If limit is set, check if we got exactly that many results (indicates more might exist)
setHasMore(limit !== undefined && res.ids.length === limit);
```

**Logic:**
- Pro users: `hasMore = false` (all results loaded at once)
- Free users: `hasMore = true` if exactly 100 results (indicates more exist)

---

## 📊 User Experience

### **Pro Users:**
```
✅ See ALL arbitrage opportunities
✅ No "Load More" button needed
✅ All opportunities in one view
✅ Better for scanning and comparing
```

### **Free Users:**
```
⚠️ Limited to 100 opportunities
⚠️ May see "Load More" if more exist
⚠️ Encourages upgrade to Pro
✅ Still functional, just limited
```

---

## 🔍 How It Works

### **API Request Flow:**

#### Pro Users:
```
GET /api/arbs?v=0&cursor=0
(no limit parameter sent)
    ↓
Backend returns ALL opportunities
    ↓
Display all results at once
```

#### Free Users:
```
GET /api/arbs?v=0&cursor=0&limit=100
    ↓
Backend returns max 100 opportunities
    ↓
If exactly 100 returned, show "Load More"
    ↓
Click "Load More" → cursor=100
```

---

## 🎨 UI States

### **Pro User Loading:**
```tsx
<div>Loading opportunities...</div>
    ↓
<div>Showing 247 opportunities</div> // All results
```

### **Free User Loading:**
```tsx
<div>Loading opportunities...</div>
    ↓
<div>Showing 100 of 100+ opportunities</div>
<Button>Load More</Button>
```

---

## 🧪 Testing

### **Test as Pro User:**

1. **Check console:**
   ```js
   window.__userPlan
   // { plan: "pro", authenticated: true, isPro: true }
   ```

2. **Check arbitrage page:**
   - Should see ALL opportunities (not limited to 100)
   - No pagination needed
   - May see 200+ opportunities

3. **Check network tab:**
   ```
   GET /api/arbs?v=0&cursor=0
   (no limit param)
   ```

---

### **Test as Free User:**

1. **Check console:**
   ```js
   window.__userPlan
   // { plan: "free", authenticated: true, isPro: false }
   ```

2. **Check arbitrage page:**
   - Should see max 100 opportunities
   - If more exist, see "Load More" button
   - Upgrade banner visible

3. **Check network tab:**
   ```
   GET /api/arbs?v=0&cursor=0&limit=100
   ```

---

## 💡 Why This Matters

### **Pro User Value:**
- ✅ **Better UX** - See everything at once
- ✅ **Faster scanning** - No clicking "Load More"
- ✅ **Complete picture** - All arbs visible
- ✅ **Professional tool** - No artificial limits

### **Free User Motivation:**
- ⚠️ **Feels limitation** - Only 100 visible
- 💰 **Upgrade incentive** - See "100+ available"
- 🎯 **Clear value** - Pro unlocks all opportunities

---

## 🔮 Future Enhancements

### **Virtual Scrolling (Performance)**
When pro users have 1000+ opportunities:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

// Only render visible rows
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100, // row height
})
```

### **Real-time Updates**
Already implemented via SSE:
```tsx
// Pro users get live updates for ALL opportunities
// Free users get live updates for their 100
```

### **Smart Filtering**
Pre-filter before display:
```tsx
// Pro users might want to hide low-ROI arbs
const filteredRows = rows.filter(r => r.roi_bps >= minROI);
```

---

## 📋 Checklist

- [x] Pro users: `limit = undefined`
- [x] Free users: `limit = 100`
- [x] Handle undefined limit in pagination logic
- [x] Update `hasMore` calculation
- [x] Test both user types
- [x] No linting errors
- [x] Documentation created

---

## 🎯 Result

**Pro users now get unlimited arbitrage opportunities! 🎉**

### Comparison:
```
┌─────────────┬──────────┬──────────┐
│ Feature     │ Free     │ Pro      │
├─────────────┼──────────┼──────────┤
│ Limit       │ 100      │ Unlimited│
│ Pagination  │ Yes      │ No       │
│ Load More   │ Yes      │ N/A      │
│ Full Access │ No       │ Yes      │
└─────────────┴──────────┴──────────┘
```

**This is a proper freemium model that rewards pro users! 🚀**

