# 🚀 Quick Start: Integrating Alternate Lines

## TL;DR

Wrap your table rows with `ExpandableRowWrapper` to add expand/collapse functionality for alternate lines.

---

## 3-Step Integration

### 1️⃣ Import

```tsx
import { ExpandableRowWrapper } from "./expandable-row-wrapper";
```

### 2️⃣ Add Column

```tsx
<thead>
  <tr>
    <th className="w-8"></th> {/* Expand icon */}
    <th>Player</th>
    <th>Event</th>
    {/* ... */}
  </tr>
</thead>
```

### 3️⃣ Wrap Rows

```tsx
<tbody>
  {data.map(row => (
    <ExpandableRowWrapper
      sid={row.id}
      sport={sport}
      primaryLine={row.odds.best.over?.line}
      sportsbookOrder={sportsbookOrder}
    >
      <td>{row.entity.name}</td>
      <td>{row.event.name}</td>
      {/* ... your existing cells ... */}
    </ExpandableRowWrapper>
  ))}
</tbody>
```

---

## ✅ Done!

That's it! Users can now click the expand icon to view alternate lines.

---

## 📚 Full Documentation

See `ALTERNATES_IMPLEMENTATION.md` for:
- API details
- Component props
- Cleanup instructions
- Testing guide

---

## 🎯 What You Get

- ✨ Expand/collapse icon with smooth animation
- 🚀 Lazy loading (fetch on first expand)
- 💾 Smart caching (60s TTL)
- 🎨 Loading/error/empty states
- 🔗 Clickable odds → bet slip URLs
- 📱 Responsive design

---

## 🧹 Cleanup

Remove old alternates logic from `odds-table.tsx`:
- `alternatesCache` state
- `alternatesLoading` state
- `alternateRows` state
- `fetchAlternates` function
- Related useEffects

See `ALTERNATES_IMPLEMENTATION.md` for details.



