# NBA Stats - Testing Guide

## 🧪 Quick Testing Checklist

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Test API Endpoints

#### Live Stats API
```bash
# Basic live stats
curl http://localhost:3000/api/nba/live-stats

# With filters
curl "http://localhost:3000/api/nba/live-stats?view=leaderboard&limit=10&minPRA=20"

# Live games only
curl "http://localhost:3000/api/nba/live-stats?view=live-only"

# On-court players only
curl "http://localhost:3000/api/nba/live-stats?view=oncourt"
```

#### Historical Stats API
```bash
# Get yesterday's stats
curl "http://localhost:3000/api/nba/historical?date=2025-11-03"

# Get specific game
curl "http://localhost:3000/api/nba/historical?date=2025-11-03&gameId=0022500152"
```

#### Advanced Stats API
```bash
# Elite club (40+ PRA)
curl "http://localhost:3000/api/nba/advanced-stats?stat=elite_club"

# PRA per minute leaders
curl "http://localhost:3000/api/nba/advanced-stats?stat=pra_per_min&minMinutes=20"

# High efficiency scorers
curl "http://localhost:3000/api/nba/advanced-stats?stat=efficiency"
```

### 3. Test Frontend Pages

#### Main Page
```
http://localhost:3000/stats/nba
```

**What to check:**
- [ ] Page loads without errors
- [ ] Header shows game count (live/scheduled/final)
- [ ] Three tabs visible: Live, Historical, Advanced
- [ ] Last updated timestamp displays

#### Live Tab
**What to check:**
- [ ] Game schedule bar appears (if games today)
- [ ] Leaderboard table loads
- [ ] Player rows display correctly
- [ ] Click player row to expand advanced stats
- [ ] Sort columns work (PTS, REB, AST, PRA, etc.)
- [ ] Auto-refresh indicator appears
- [ ] Green dot shows for on-court players
- [ ] Medals (🥇🥈🥉) show for top 3
- [ ] Elite badges (⭐👑) for 50+ PRA players

#### Game Schedule Bar
**What to check:**
- [ ] Horizontal scroll works
- [ ] "All Games" button shows first
- [ ] Live games show red pulsing dot
- [ ] Scores update for live games
- [ ] Click game filters leaderboard
- [ ] Spread/O/U odds display (if available)

#### Historical Tab
**What to check:**
- [ ] Date picker loads with dates from Nov 3, 2025 onwards
- [ ] Game summaries display for selected date
- [ ] Click game to filter stats
- [ ] Leaderboard shows daily leaders
- [ ] Top performer per game displays
- [ ] "Clear Game Filter" button works

#### Advanced Tab
**What to check:**
- [ ] Three sub-tabs: Elite Club, PRA/Min, Efficiency
- [ ] Elite Club shows 40+ PRA performances
- [ ] Tier badges (Legendary 👑, Elite ⭐) display
- [ ] PRA/Min shows efficiency leaders
- [ ] Efficiency shows high FG% scorers
- [ ] Stats load without errors

### 4. Test SSE Connection

#### Game Schedule SSE
```bash
# Monitor SSE stream (terminal)
curl -N http://localhost:3000/api/sse/props?sport=nba
```

**What to check:**
- [ ] Connection establishes (returns data)
- [ ] Events stream in real-time
- [ ] Reconnects if connection drops

#### In Browser
Open DevTools → Network tab
- [ ] SSE connection shows as "EventStream"
- [ ] Status is 200 and stays connected
- [ ] Messages appear in real-time

### 5. Test Mobile Responsive

#### Resize browser to mobile width
**What to check:**
- [ ] Header stacks vertically
- [ ] Tabs work on mobile
- [ ] Game schedule bar scrolls horizontally
- [ ] Table is readable (may scroll horizontally)
- [ ] Expandable rows work
- [ ] Navigation menu includes "NBA Stats" link

### 6. Test Edge Cases

#### No Live Games
- [ ] Empty state shows: "No live games right now"
- [ ] Suggests checking historical/advanced tabs

#### No Data for Historical Date
- [ ] Shows: "No games found for this date"

#### API Error Handling
- [ ] Graceful error messages
- [ ] Doesn't crash the page
- [ ] Shows last successful data if available

#### SSE Connection Failure
- [ ] Shows "Connection lost. Reconnecting..."
- [ ] Attempts to reconnect
- [ ] Recovers when connection restored

### 7. Performance Testing

#### Initial Load
- [ ] Page loads in < 2 seconds
- [ ] No layout shift (CLS)
- [ ] Smooth scrolling

#### Auto-Refresh
- [ ] Updates every 20 seconds (check network tab)
- [ ] No jank or freezing
- [ ] Smooth transition between updates

#### Large Tables
- [ ] 50+ player table scrolls smoothly
- [ ] Sorting is fast
- [ ] Filtering is instantaneous

### 8. SEO Verification

#### Meta Tags
View page source and check for:
- [ ] `<title>` includes "King of the Court" and "NBA PRA Leaderboard"
- [ ] Meta description is keyword-rich
- [ ] Open Graph tags present
- [ ] Twitter Card tags present
- [ ] Canonical URL set to `/stats/nba`

#### Lighthouse Score
Run Lighthouse in Chrome DevTools:
- [ ] Performance: 90+
- [ ] Accessibility: 90+
- [ ] Best Practices: 90+
- [ ] SEO: 90+

### 9. Navigation Testing

#### Desktop
- [ ] "NBA Stats" link appears in main nav
- [ ] Clicking navigates to `/stats/nba`
- [ ] Active state highlights correctly

#### Mobile
- [ ] Hamburger menu includes "NBA Stats"
- [ ] Link works correctly

### 10. Cross-Browser Testing

Test in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## 🐛 Common Issues & Solutions

### Issue: API returns 500 error
**Check:**
- Supabase credentials in `.env`
- Tables exist and have data
- Database connection is active

**Solution:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

### Issue: SSE connection fails
**Check:**
- Redis credentials in `.env`
- `/api/sse/props?sport=nba` endpoint works
- Pro user authentication (SSE is gated)

**Solution:**
- Test SSE endpoint directly
- Check browser console for errors
- Verify Pro plan access

### Issue: No data in leaderboard
**Check:**
- Ingestor is running (`sudo systemctl status nba-live-stats.service`)
- Data exists in Supabase tables
- Query parameters are correct

**Solution:**
```bash
# Check ingestor status (on VPS)
ssh your-vps
sudo systemctl status nba-live-stats.service
sudo journalctl -u nba-live-stats.service -n 100
```

### Issue: Auto-refresh not working
**Check:**
- React Query is configured correctly
- Network tab shows requests every 20s
- No errors in console

**Solution:**
- Check `refetchInterval` in `use-nba-stats.ts`
- Verify queries are enabled

### Issue: Mobile layout broken
**Check:**
- Tailwind responsive classes
- Table overflow handling
- Touch/scroll gestures work

**Solution:**
- Add `overflow-x-auto` to table containers
- Test on actual mobile device

## 📊 Expected Results

### During Live Games
- Leaderboard updates every 20 seconds
- On-court indicators show green dots
- Scores update in real-time
- Game clock displays correctly

### During Off-Hours
- Shows "No live games" message
- Historical data is accessible
- Advanced stats load properly
- Empty state is friendly

### Performance Benchmarks
- Initial load: < 2s
- API response: < 200ms
- Auto-refresh: No jank
- Table sort: < 100ms

## ✅ Final Checklist

Before deploying to production:
- [ ] All API endpoints tested and working
- [ ] Frontend loads without errors
- [ ] SSE connection stable
- [ ] Mobile responsive
- [ ] SEO optimized
- [ ] Navigation links added
- [ ] Error handling works
- [ ] Performance is good
- [ ] Cross-browser compatible
- [ ] Documentation complete

## 🚀 Deploy to Production

Once all tests pass:

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

## 📝 Post-Deployment Verification

After deployment:
- [ ] Visit https://unjuiced.io/stats/nba
- [ ] Verify SSL certificate
- [ ] Check all features work in production
- [ ] Monitor for errors in Vercel logs
- [ ] Test from different locations/networks

---

**Testing Date:** November 4, 2025
**Status:** Ready for Testing
**Route:** `/stats/nba`

