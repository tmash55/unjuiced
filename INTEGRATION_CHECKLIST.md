# ✅ Alternates Integration Checklist

## Pre-Integration

- [x] API endpoint created (`/api/props/alternates`)
- [x] API tested with real Redis data
- [x] `AlternateLinesRow` component created
- [x] `ExpandableRowWrapper` component created
- [x] No linting errors
- [x] Documentation written

---

## Integration Steps

### 1. Update Table Structure

#### In `odds-table.tsx`:

- [ ] Import `ExpandableRowWrapper`
  ```tsx
  import { ExpandableRowWrapper } from "./expandable-row-wrapper";
  ```

- [ ] Add expand column to table header
  ```tsx
  <th className="w-8"></th> {/* First column */}
  ```

- [ ] Wrap each row with `ExpandableRowWrapper`
  ```tsx
  <ExpandableRowWrapper
    sid={row.id}
    sport={sport}
    primaryLine={row.odds.best.over?.line}
    sportsbookOrder={orderedSportsbooks}
  >
    {/* existing cells */}
  </ExpandableRowWrapper>
  ```

### 2. Remove Old Alternates Logic

#### State (Lines ~1157-1160):
- [ ] Remove `const [alternatesCache, setAlternatesCache] = ...`
- [ ] Remove `const [alternatesLoading, setAlternatesLoading] = ...`
- [ ] Remove `const [alternateRows, setAlternateRows] = ...`

#### Functions (Lines ~1163-1289):
- [ ] Remove `getAvailableLines`
- [ ] Remove `isLoadingAlternates`
- [ ] Remove `getAlternateDataForLine`
- [ ] Remove `fetchAlternates`
- [ ] Remove `updatePrimaryRowWithLine`

#### State (Lines ~1201-1202):
- [ ] Remove `const [customLineSelections, setCustomLineSelections] = ...`
- [ ] Remove `const [globalSelectedLine, setGlobalSelectedLine] = ...`

#### Effects (Lines ~1318-1669):
- [ ] Remove prefetch alternates effect
  ```tsx
  useEffect(() => {
    // Prefetch alternates for first 20 rows
    ...
  }, [data, preferences.includeAlternates, ...])
  ```

- [ ] Remove batch fetch effect
  ```tsx
  useEffect(() => {
    // Background alternates fetching
    ...
  }, [data, alternatesCache, alternatesLoading, fetchAlternates])
  ```

- [ ] Remove alternates cache reset effect
  ```tsx
  useEffect(() => {
    setExpandedRows({})
    setAlternatesCache({})
    ...
  }, [sport, type, market, scope])
  ```

- [ ] Remove alternates row transformation effect
  ```tsx
  useEffect(() => {
    const next: Record<string, Record<string, AlternateRowData[]>> = {}
    ...
  }, [alternatesCache, type])
  ```

#### Component Props (Lines ~961-987):
- [ ] Remove from `MemoizedTableRow` props:
  - `expandedRows`
  - `setExpandedRows`
  - `fetchAlternates`
  - `alternateRows`
  - `alternatesLoading`
  - `customLineSelections`
  - `updatePrimaryRowWithLine`

#### References in `useMemo` (Lines ~1341-1456):
- [ ] Remove `alternatesCache` from dependencies
- [ ] Remove `fillMissingSides` calls using `alternatesCache`
- [ ] Remove `customLineSelections` logic

### 3. Update Type Definitions

#### Remove unused types:
- [ ] `AlternateRowData` (if defined)
- [ ] Any alternates-related type exports

### 4. Test Integration

- [ ] Expand icon appears for each row
- [ ] Click expand to fetch alternates
- [ ] Alternates display correctly
- [ ] Loading state shows
- [ ] Error handling works
- [ ] Cache prevents duplicate fetches
- [ ] Collapse animation is smooth
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No linting errors

---

## Post-Integration

### 5. Performance Check

- [ ] Check network tab: only one request per expand (first time)
- [ ] Check cache: no duplicate requests within 60s
- [ ] Check animations: smooth 60fps
- [ ] Check memory: no memory leaks

### 6. Cleanup

- [ ] Remove debug console.logs
- [ ] Remove unused imports
- [ ] Remove unused state variables
- [ ] Format code
- [ ] Run linter

### 7. Documentation

- [ ] Update component README
- [ ] Update API documentation
- [ ] Add usage examples
- [ ] Update CHANGELOG

---

## Common Issues & Solutions

### Issue: Expand icon not showing
- **Solution:** Make sure you added the `<th className="w-8"></th>` column to the header

### Issue: Rows not wrapping correctly
- **Solution:** Ensure you're passing `children` correctly to `ExpandableRowWrapper`

### Issue: Alternates not fetching
- **Solution:** Check that `sid` prop is the correct row ID from Redis

### Issue: Cache not working
- **Solution:** Check browser console for cache logs, verify `sid` is consistent

### Issue: Animations stuttering
- **Solution:** Check if `AnimatePresence` is properly wrapping the component

### Issue: TypeScript errors
- **Solution:** Ensure all old alternates types are removed and new types are imported

---

## Verification Commands

```bash
# Check for old alternates references
grep -r "alternatesCache" components/odds-screen/tables/odds-table.tsx
grep -r "fetchAlternates" components/odds-screen/tables/odds-table.tsx
grep -r "alternateRows" components/odds-screen/tables/odds-table.tsx

# Expected: No results (after cleanup)

# Run linter
npm run lint

# Run type check
npm run type-check

# Build
npm run build
```

---

## Expected Outcome

After integration, users should be able to:
1. ✅ See an expand icon on each row
2. ✅ Click to expand and see alternate lines
3. ✅ See loading spinner during fetch
4. ✅ See alternates with smooth animation
5. ✅ Click odds to open bet slip URLs
6. ✅ Click collapse to hide alternates
7. ✅ Experience fast performance with caching

---

## Rollback Plan

If something goes wrong:

1. Revert `odds-table.tsx` changes
2. Keep the new components (they don't interfere)
3. File a bug report with:
   - Error messages
   - Console logs
   - Network tab screenshot
   - Browser/OS info

---

## Support

For questions or issues:
- Check `ALTERNATES_IMPLEMENTATION.md` for detailed docs
- Check `ALTERNATES_FLOW.md` for architecture
- Check `QUICK_START_ALTERNATES.md` for quick reference

---

## Sign-off

- [ ] Code reviewed
- [ ] Tests passed
- [ ] Performance validated
- [ ] Documentation updated
- [ ] Ready for production

---

**Estimated Time:** 30-60 minutes
**Difficulty:** Medium
**Impact:** High (better UX, cleaner code)



