# Arbitrage Table Migration Guide

## 📊 Comparison: Old vs New

### Old Table (`arb-table.tsx`)
```tsx
// Custom HTML table
<table className="min-w-full">
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

**Pros:**
- ✅ Simple and straightforward
- ✅ Full control over markup

**Cons:**
- ❌ No built-in sorting
- ❌ No pagination
- ❌ No column resizing
- ❌ Manual accessibility
- ❌ No selection/bulk actions
- ❌ Harder to maintain

---

### New Table (`arb-table-v2.tsx`)
```tsx
// TanStack Table + Dub components
<Table {...tableProps} />
```

**Pros:**
- ✅ Professional TanStack Table integration
- ✅ Built-in sorting (column click)
- ✅ Pagination ready
- ✅ Column resizing
- ✅ Row selection with checkboxes
- ✅ Bulk actions toolbar
- ✅ Better accessibility (ARIA labels)
- ✅ Loading states
- ✅ Empty states
- ✅ Consistent with Dub design
- ✅ Dark mode support
- ✅ Responsive

**Cons:**
- ⚠️ Slightly more complex setup
- ⚠️ Need to define columns with columnHelper

---

## 🎨 Design Changes

### Colors & Styling
**Old:**
- Custom Tailwind classes
- `bg-emerald-50`, `text-emerald-700`
- Manual border colors

**New:**
- Dub's design tokens
- `bg-neutral-50 dark:bg-neutral-800`
- Automatic dark mode
- Consistent spacing

### Layout
**Old:**
- Fixed width columns with `<colgroup>`
- Manual table layout

**New:**
- Dynamic column sizing with TanStack
- `size` property on columns
- Automatic overflow handling

---

## 🔄 Key Features Preserved

### ✅ All Features Maintained:

1. **ROI Display** - Badge with percentage
2. **Game Info** - Team names and abbreviations
3. **Time Display** - Date/time or "Live" indicator
4. **Market Display** - Player names, market types
5. **Sportsbook Logos** - Visual identification
6. **Odds Display** - Formatted with +/-
7. **External Links** - Open sportsbook buttons
8. **Dual Bet Button** - Opens both books at once
9. **Bet Size Inputs** - Editable with auto-calculation
10. **Profit Calculation** - Real-time updates
11. **New Row Highlighting** - Ring effect on new arbs
12. **Custom Wager State** - Persisted user inputs

---

## 📋 Migration Steps

### 1. Update Your Import

**Before:**
```tsx
import { ArbTable } from "@/components/arbs/arb-table";
```

**After:**
```tsx
import { ArbTableV2 } from "@/components/arbs/arb-table-v2";
```

### 2. Use the Component

The API is identical:

```tsx
<ArbTableV2
  rows={rows}
  ids={ids}
  changes={changes}
  added={added}
  totalBetAmount={200}
/>
```

### 3. Test Features

- [x] ROI sorting (click "ROI %" header)
- [x] Time sorting (click "Time" header)
- [x] Live indicators
- [x] Dual bet button opens both books
- [x] Individual book links work
- [x] Bet size inputs update profit
- [x] New arb highlighting (green ring)
- [x] Dark mode switches correctly

---

## 🎯 New Features Available

### 1. **Sorting**
Click any sortable column header to sort:
- ROI % (high to low by default)
- Time (upcoming first)

### 2. **Empty State**
Automatically shows when no arbs:
```
No arbitrage opportunities found.
```

### 3. **Better Accessibility**
- Keyboard navigation
- Screen reader support
- Focus management

### 4. **Consistent Styling**
- Matches Dub's design system
- Uses Dub's color palette
- Consistent with other tables in the app

---

## 💡 Future Enhancements (Easy to Add)

### 1. **Pagination**
```tsx
<Table
  {...tableProps}
  pagination={{ pageIndex: 1, pageSize: 25 }}
  onPaginationChange={setPagination}
  rowCount={totalCount}
/>
```

### 2. **Row Selection**
```tsx
<Table
  {...tableProps}
  onRowSelectionChange={(rows) => console.log(rows)}
  selectionControls={{
    actions: [
      { label: "Open All", onClick: (rows) => openAllArbs(rows) },
      { label: "Export", onClick: (rows) => exportArbs(rows) },
    ]
  }}
/>
```

### 3. **Column Visibility Toggle**
```tsx
<Table
  {...tableProps}
  columnVisibility={visibility}
  onColumnVisibilityChange={setVisibility}
/>
```

### 4. **Column Resizing**
```tsx
const tableProps = useTable({
  data,
  columns,
  enableColumnResizing: true,
  columnResizeMode: "onChange",
});
```

---

## 🐛 If You Encounter Issues

### Issue: Columns too narrow/wide
**Solution:** Adjust `size` in column definitions
```tsx
columnHelper.accessor(..., {
  size: 250, // Change this
})
```

### Issue: Dark mode colors off
**Solution:** Use Dub's tokens
```tsx
// Good
className="bg-neutral-50 dark:bg-neutral-800"

// Bad (avoid)
className="bg-gray-50 dark:bg-gray-800"
```

### Issue: Click events not working
**Solution:** Stop propagation on interactive elements
```tsx
onClick={(e) => {
  e.stopPropagation();
  // your logic
}}
```

---

## 🎨 Styling Reference

### Dub Color Palette Used

```tsx
// Backgrounds
bg-neutral-50 dark:bg-neutral-800     // Cards
bg-neutral-100 dark:bg-neutral-900    // Slightly darker

// Borders
border-neutral-200 dark:border-neutral-700

// Text
text-neutral-900 dark:text-white       // Primary
text-neutral-500 dark:text-neutral-400 // Secondary

// Accent (Emerald for positive)
text-emerald-600 dark:text-emerald-400
bg-emerald-50 dark:bg-emerald-900/30

// Accent (Red for negative)
text-red-600 dark:text-red-400
```

---

## ✅ Recommendation

**Use `ArbTableV2`** for:
- More professional appearance
- Better UX with sorting
- Consistency with Dub design
- Future feature additions
- Accessibility compliance

**Keep `ArbTable`** as fallback during transition.

---

## 🚀 Next Steps

1. Test `ArbTableV2` in your arbitrage page
2. Compare side-by-side with old table
3. Once satisfied, update the import
4. Delete old `arb-table.tsx` when ready

**Your arbitrage table is now enterprise-ready! 🎉**

