# Sharp Signals — Frontend Developer Brief

## What Is This?

**Sharp Signals** is a real-time prediction market insider tracking tool for [Unjuiced](https://unjuiced.bet) — a sports betting analytics SaaS ($70/mo Elite tier).

We track ~84 wallets on **Polymarket** (a crypto prediction market) that have proven track records betting on sports. When these "sharps" place bets, we detect them in real-time, cross-reference with legal US sportsbook odds (DraftKings, FanDuel, etc.), and surface actionable signals to our users.

**Think of it as:** "A Bloomberg terminal for sports betting insiders" — but at $70/mo instead of OddsJam's $800/mo.

### Why This Matters
- **71% consensus win rate** on NBA sharp signals
- **+28% ROI** on sharp consensus picks (NBA + NHL + Tennis)
- These are real tracked results from 3,000+ resolved signals
- OddsJam charges ~$800/mo for a similar (worse) product called "Insiders"
- We're 11x cheaper with better data

---

## The Data Pipeline (How It Works)

```
Polymarket (crypto prediction market)
  │
  ├─ Sharps place bets (we track 84 wallets)
  │
  ▼
VPS Whale Tracker (runs 24/7, polls every 30s)
  │
  ├─ Detects trades from tracked wallets
  ├─ Classifies: Sharp / Insider / Burner tier
  ├─ Matches to our Redis odds data (sportsbook prices)
  ├─ Scores signal quality (1-5 stars)
  │
  ▼
Supabase `polymarket_signals` table (3,300+ signals)
  │
  ├─ Feed API enriches with wallet scores + live odds
  │
  ▼
Frontend (Sharp Signals page)
```

**Key tables:**
- `polymarket_signals` — every tracked bet (3,300+ rows)
- `polymarket_wallet_scores` — per-wallet stats (ROI, win rate, tier, streaks)
- `user_preferences` — saved filters, followed wallets, alert settings

---

## Phase 1 Goals

Build a premium, transparent, customizable signal dashboard that:

1. **Shows real-time sharp signals** with sportsbook odds + deep links to place the bet
2. **Displays transparent ROI** broken down by sport, timeframe, and tier — no black box
3. **Lets users customize their feed** — follow specific wallets, filter by sport, set alert thresholds
4. **Includes a wallet leaderboard** — anonymous rankings so users can find and follow top performers
5. **Looks and feels premium** — this is the $70/mo feature that justifies Elite tier

### What Makes Us Different From OddsJam
| Feature | OddsJam Insiders ($800/mo) | Unjuiced Sharp Signals ($70/mo) |
|---------|---------------------------|----------------------------------|
| Individual fills shown separately | ✅ | ❌ We aggregate fills into single signals |
| Consensus scoring | ❌ | ✅ Majority-side deduplication |
| Per-sport ROI transparency | ❌ | ✅ Full breakdown |
| Custom wallet following | ❌ | ✅ |
| Sportsbook deep links | ✅ | ✅ |
| Kelly-based unit sizing | ❌ | ✅ |
| Order book visualization | ❌ | ✅ |
| Price charts | ✅ | ✅ |

---

## Current State

### Existing Components (on `feature/polymarket-whale-board` branch)
```
components/sharp-signals/
├── stats-bar.tsx          # Top-level ROI stats display
├── filters.tsx            # Sport + tier pill filters
├── pick-card.tsx          # Individual signal card (Picks tab)
├── pick-detail-panel.tsx  # Right panel detail view for a pick
├── market-card.tsx        # Market-level aggregation card (Markets tab)
├── market-detail-panel.tsx# Right panel detail view for a market
├── order-book.tsx         # Polymarket order book visualization
├── price-chart.tsx        # Price history sparkline/chart
├── market-price-chart.tsx # Market-level price chart
├── leaderboard.tsx        # Wallet leaderboard table
├── insider-card.tsx       # Wallet profile card
├── signal-card.tsx        # Legacy signal card
├── signal-feed.tsx        # Legacy signal feed
├── game-card.tsx          # Legacy game card
├── game-feed.tsx          # Legacy game feed
├── aggregate-bar.tsx      # Legacy aggregate display
├── tier-badge.tsx         # S/A/B/C tier badge component
├── kelly-sizer.tsx        # Kelly criterion calculator
└── filters.tsx            # Filter controls
```

### Page Structure
The main page is at `app/(app)/sharp-signals/page.tsx` with two tabs:
- **Picks** — individual signals sorted by score
- **Markets** — market-level aggregation (multiple signals on same game)

Layout: Left panel (55%) = scrollable list, Right panel (45%) = detail view

---

## API Endpoints

### 1. `GET /api/polymarket/stats`
**ROI dashboard data.** Elite-tier required.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sport` | string | — | Filter to one sport (nba, nhl, soccer, etc) |
| `timeframe` | string | `all` | `7d`, `30d`, or `all` |
| `excludeSports` | string | `esports` | Comma-separated sports to exclude |
| `includeSports` | string | — | Override excludes (e.g. `esports` to opt-in) |

**Response:**
```json
{
  "overall": {
    "wins": 497, "losses": 269, "total": 766,
    "winRate": 64.9, "roi": 28.3, "pnl100": 21713,
    "since": "2026-03-14T..."
  },
  "byTier": {
    "sharp": { "wins": 413, "losses": 299, "winRate": 58.0, "roi": 16.1, "pnl100": 11430 },
    "whale": { "wins": 180, "losses": 115, "winRate": 61.0, "roi": 17.1, "pnl100": 5046 }
  },
  "bySport": {
    "nba": { "wins": 413, "losses": 299, "winRate": 58.0, "roi": 16.1, "pnl100": 11430 },
    "nhl": { "wins": 113, "losses": 74, "winRate": 60.4, "roi": 17.3, "pnl100": 3231 },
    "tennis": { "wins": 26, "losses": 10, "winRate": 72.2, "roi": 29.8, "pnl100": 1074 },
    "march-madness": { "wins": 23, "losses": 20, "winRate": 53.5, "roi": 4.4, "pnl100": 191 }
  },
  "byTimeframe": {
    "7d": { "wins": 120, "losses": 80, "winRate": 60.0, "roi": 12.5, "pnl100": 2500 },
    "30d": { "wins": 400, "losses": 250, "winRate": 61.5, "roi": 15.2, "pnl100": 9880 },
    "all": { "wins": 497, "losses": 269, "winRate": 64.9, "roi": 28.3, "pnl100": 21713 }
  },
  "topWallets": [
    { "anonymousId": "7A3F", "record": "196-94", "winRate": 67.6, "roi": 32.8, "sport": "nba" },
    { "anonymousId": "EE61", "record": "177-98", "winRate": 64.4, "roi": 20.3, "sport": "mixed" }
  ]
}
```

### 2. `GET /api/polymarket/feed`
**Signal feed.** Elite-tier required. This is the main data source for the Picks tab.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Signals per page (max 200) |
| `offset` | number | 0 | Pagination |
| `sport` | string | — | Filter by sport |
| `tier` | string | — | Comma-separated: `sharp,whale` |
| `minStake` | number | 0 | Minimum bet size in USD |
| `minQuality` | number | 0 | Minimum quality score (1-5) |
| `resolved` | string | `all` | `true`, `false`, or `all` |
| `wallet` | string | — | Filter by specific wallet address |
| `today` | string | `false` | Only today's signals |
| `sort` | string | `score` | `score`, `recent`, or `stake` |

**Response — each signal includes:**
```typescript
{
  // Core signal data
  id: number,
  tier: "sharp" | "whale" | "burner",
  market_title: "Jazz vs. Timberwolves",
  market_type: "moneyline" | "spread" | "total" | "player_prop",
  sport: "nba",
  outcome: "Timberwolves",
  side: "BUY",
  entry_price: 0.72,           // Polymarket price (0-1)
  american_odds: -257,          // Converted to American
  bet_size: 5420.00,           // Total USD wagered
  implied_probability: 72.0,
  
  // Game context
  event_title: "NBA: Jazz vs. Timberwolves",
  home_team: "Timberwolves",
  away_team: "Jazz",
  game_start_time: "2026-03-18T20:00:00Z",
  game_date: "2026-03-18",
  
  // Wallet info (ANONYMIZED — never show wallet_address or wallet_username)
  wallet_tier: "S",            // S/A/B/C/FADE/NEW
  wallet_roi: 32.8,
  wallet_record: "196-94",
  wallet_total_bets: 290,
  wallet_avg_stake: 850,
  wallet_rank: 4,              // Our internal rank
  wallet_polymarket_rank: 39,  // Polymarket sports leaderboard rank
  stake_vs_avg: 6.4,          // 6.4x their average bet = HIGH CONVICTION
  
  // Signal scoring
  signal_score: 8.7,          // 0-10 composite score
  signal_label: "🔥",         // 🔥 (8+), ⭐ (6+), 👍 (4+), 👀 (<4)
  
  // Fill aggregation (wallets split orders into chunks)
  wager_count: 5,             // 5 individual fills aggregated
  fills: [
    { price: 0.71, size: 1100, created_at: "...", american_odds: -245 },
    { price: 0.72, size: 1080, created_at: "...", american_odds: -257 },
    // ...
  ],
  
  // 🆕 LIVE SPORTSBOOK ODDS (new — from Redis)
  live_odds: {
    best: {
      book: "fanduel",
      price: "-195",
      decimal: 1.51,
      line: null,
      mobile_link: "https://sportsbook.fanduel.com/..."
    },
    all: [
      { book: "fanduel", price: "-195", decimal: 1.51, mobile_link: "..." },
      { book: "draftkings", price: "-200", decimal: 1.50 },
      { book: "betmgm", price: "-190", decimal: 1.53, mobile_link: "..." }
    ],
    updated_at: "2026-03-18T14:30:00Z"
  },
  
  // Odds matching confidence
  odds_confidence: 93,        // 0-100 how confident the Redis match is
  
  // Resolution (for resolved signals)
  resolved: false,
  result: null,               // "win" | "loss" | null
  pnl: null,
  
  quality_score: 4,           // 1-5 stars
  created_at: "2026-03-18T14:25:00Z"
}
```

### 3. `GET /api/polymarket/leaderboard`
**Wallet rankings.** Elite-tier required.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 25 | Wallets per page (max 100) |
| `offset` | number | 0 | Pagination |
| `tier` | string | — | Filter: `S,A,B` (comma-separated) |
| `sport` | string | — | Filter by primary sport |
| `minBets` | number | 0 | Minimum resolved bets |
| `sortBy` | string | `rank` | `rank`, `roi`, `profit`, `win_rate`, `total_wagered` |

**Response — each wallet includes:**
```typescript
{
  wallet_address: "0x37c1...",  // ⚠️ DO NOT display this
  display_name: null,           // ⚠️ DO NOT display wallet_username either
  // Show ONLY: first 4 chars of wallet_address uppercased → "#37C1"
  
  rank: 1,
  tier: "S",
  roi: 32.8,
  wins: 196,
  losses: 94,
  win_rate: 67.6,
  total_wagered: 245000,
  total_profit: 80500,
  avg_stake: 845,
  current_streak: 5,           // Positive = win streak, negative = loss
  best_win_streak: 12,
  
  // Sport breakdown
  sport_breakdown: {
    "nba": { w: 150, l: 70, bets: 220, roi: 18.5 },
    "nhl": { w: 30, l: 15, bets: 45, roi: 22.1 },
    "soccer": { w: 16, l: 9, bets: 25, roi: 8.3 }
  },
  primary_sport: "nba",
  
  // Notable plays
  biggest_win_title: "Celtics ML vs Lakers",
  biggest_bet_size: 25000,
  
  // Polymarket profile
  poly_rank: 39,               // Sports leaderboard rank on Polymarket
  poly_volume: 36000000,       // Lifetime volume
}
```

### 4. `GET /api/polymarket/games`
**Market-level aggregation.** Groups signals by game/market for the Markets tab.

### 5. `GET /api/polymarket/price-chart?token_id=xxx&interval=all`
**Polymarket price history** for sparklines and charts. Returns `[{t: epoch, p: price}]`.
Intervals: `1h`, `6h`, `1d`, `1w`, `1m`, `all`.

### 6. `GET /api/polymarket/orderbook?token_id=xxx`
**Polymarket order book** — bids/asks with price and size.

### 7. `GET/PATCH /api/polymarket/preferences`
**User preferences** for Sharp Signals filters and settings.

**GET response:**
```json
{
  "signal_followed_wallets": ["0x37c1...", "0xee61..."],
  "signal_sport_filters": ["nba", "nhl"],
  "signal_excluded_sports": ["esports"],
  "signal_tier_filters": null,
  "signal_min_stake": 500,
  "signal_sort_by": "score",
  "signal_show_resolved": false,
  "signal_timeframe": "30d",
  "signal_alert_enabled": false,
  "signal_alert_min_stake": 5000,
  "signal_alert_sports": null,
  "signal_alert_wallets": null
}
```

**PATCH body (partial update):**
```json
{
  "signal_followed_wallets": ["0x37c1...", "0xee61..."],
  "signal_sport_filters": ["nba", "nhl"]
}
```

---

## Design Direction

### Brand
- **Primary color:** `#38BDF8` (sky blue)
- **Action:** `#0EA5E9`
- **Dark:** `#0284C7`
- **Background:** Dark theme (neutral-900/950)
- **Font:** System/Inter
- **Logo:** `https://unjuiced.bet/logo.png`

### UI Framework
- **Next.js 15** / React 19
- **Tailwind CSS** with `cn()` utility
- **shadcn/ui** components
- **SWR** for data fetching
- **Existing layout:** `AppPageLayout` component with `title`, `subtitle`, `statsBar`, `contextBar`, `headerActions` props

### Key UX Principles
1. **Transparency first** — every number is auditable, show the math
2. **Mobile-responsive** — many users check on phones between games
3. **Fast** — 30s auto-refresh, optimistic UI, skeleton loading
4. **Premium feel** — this justifies the $70/mo price tag
5. **Don't overwhelm** — smart defaults, progressive disclosure

### Visual Cues
- **Stake vs Average multiplier:** Green (3x+) = high conviction, Yellow (1.5x+) = above avg, White = normal
- **Consensus strength:** 🟢 Strong (75%+, 3+ sharps), 🟡 Lean (60-75%), 🔴 Split (50/50)
- **Signal score labels:** 🔥 (8+), ⭐ (6+), 👍 (4+), 👀 (<4)
- **Tier badges:** S-tier green, A-tier blue, B-tier gray, FADE red
- **Win/loss:** Green/red with +/- prefix on ROI numbers

### Privacy Rules (CRITICAL)
- **NEVER show `wallet_address` or `wallet_username`** on the frontend
- Anonymous display: first 4 chars of wallet_address uppercased → `#37C1`
- Do NOT show PNL dollar amounts (users could cross-reference with Polymarket)
- Show: rank, record, win rate, ROI %, avg stake, streak, specialty sport

---

## Sections to Build / Polish

### 1. Stats Dashboard (Top of Page)
Sport-level ROI cards with timeframe selector (7d/30d/All). Think: mini dashboard cards showing NBA +16.1% ROI, NHL +17.3%, Tennis +29.8%. Total combined ROI prominently displayed. Users can see the product is legit at a glance.

### 2. Signal Feed (Picks Tab)
Individual pick cards sorted by signal score. Each card shows: wallet tier badge, market title, outcome, entry price, bet size, stake-vs-avg indicator, signal score, AND now **live sportsbook odds with "Bet Now" links** to DraftKings/FanDuel/etc.

### 3. Market View (Markets Tab)  
Aggregated view — one card per game showing consensus direction, % of sharp money on each side, total volume. Clicking opens detail panel with individual bets, order book, price chart.

### 4. Leaderboard Tab (New)
Anonymous wallet rankings. Users browse → find wallets they trust → click "Follow" → feed filters to their followed wallets. This is the bridge between discovery and customization.

### 5. Custom Filters + Preferences
- Follow specific wallets (persisted via preferences API)
- Sport toggles (NBA on, NHL on, soccer off, esports off)
- Tier filter (sharps only, all, etc)
- Min stake slider
- Sort: by score / recent / stake size
- Saved filter presets

### 6. Detail Panel (Right Side)
When you click a pick: full wallet profile (anonymized), all sportsbook odds comparison, order book depth, price chart, fill breakdown, similar recent signals from same wallet.

---

## Current ROI Numbers (for display)

### Sharp Consensus (the headline number)
- **NBA:** 413W-299L · 58.0% · **+16.1% ROI**
- **NHL:** 113W-74L · 60.4% · **+17.3% ROI**
- **Tennis:** 26W-10L · 72.2% · **+29.8% ROI**
- **March Madness:** 23W-20L · 53.5% · +4.4% ROI
- **Combined (excl. esports/soccer):** 497W-269L · 64.9% · **+28.3% ROI** 🔥

### Top Wallets
1. **#37C1** — 196W-94L (67.6%) · +32.8% ROI · NBA specialist
2. **#EE61** — 177W-98L (64.4%) · +20.3% ROI · Mixed sports
3. **#B6AE** — 71W-62L (53.4%) · +12.7% ROI
4. **#D6A3** — 31W-20L (60.8%) · +19.0% ROI
5. **#2A2C** — 30W-22L (57.7%) · +12.6% ROI

---

## Tech Stack Reference
- **Framework:** Next.js 15 (App Router) / React 19
- **Styling:** Tailwind CSS + shadcn/ui
- **Data fetching:** SWR with 30s refresh
- **Auth:** Supabase Auth (JWT)
- **State:** React useState + SWR cache
- **Charts:** Consider Recharts or lightweight SVG sparklines
- **Branch:** `feature/polymarket-whale-board`
