# Alternate Lines - Data Flow Diagram

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Clicks expand icon
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              ExpandableRowWrapper Component                      │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ 1. Check if already expanded                          │     │
│  │ 2. Check hasFetched flag                              │     │
│  │ 3. Check client-side cache (60s TTL)                  │     │
│  └───────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  │                       │
            Cache Hit?                Cache Miss?
                  │                       │
                  ↓                       ↓
         ┌────────────────┐      ┌────────────────┐
         │  Use Cached    │      │  Fetch from    │
         │  Data (Fast)   │      │  API (Slow)    │
         └────────────────┘      └────────────────┘
                  │                       │
                  │                       ↓
                  │              ┌─────────────────────────────┐
                  │              │  GET /api/props/alternates  │
                  │              │  ?sport=nfl&sid=...         │
                  │              └─────────────────────────────┘
                  │                       │
                  │                       ↓
                  │              ┌─────────────────────────────┐
                  │              │   Redis Fetch               │
                  │              │   props:nfl:rows:alt:sid    │
                  │              └─────────────────────────────┘
                  │                       │
                  │                       ↓
                  │              ┌─────────────────────────────┐
                  │              │  Filter out primary line    │
                  │              │  Return alternates + meta   │
                  │              └─────────────────────────────┘
                  │                       │
                  │                       ↓
                  │              ┌─────────────────────────────┐
                  │              │  Update client cache        │
                  │              │  (60s TTL)                  │
                  │              └─────────────────────────────┘
                  │                       │
                  └───────────┬───────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              AlternateLinesRow Component                         │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Render alternate lines with:                          │     │
│  │ - Blue accent border                                  │     │
│  │ - Smooth animations                                   │     │
│  │ - Clickable odds → bet slip URLs                      │     │
│  │ - Responsive layout                                   │     │
│  └───────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        USER SEES RESULT                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 State Transitions

```
┌─────────────┐
│  Collapsed  │
└─────────────┘
       │
       │ User clicks expand
       ↓
┌─────────────┐
│  Expanding  │ ← Loading state (spinner)
└─────────────┘
       │
       │ Data fetched
       ↓
┌─────────────┐
│  Expanded   │ ← Shows alternates
└─────────────┘
       │
       │ User clicks collapse
       ↓
┌─────────────┐
│  Collapsed  │ ← Data cached for 60s
└─────────────┘
```

---

## 📦 Data Structure Flow

### Redis Data (Input)
```json
{
  "primary_ln": 1.5,
  "lines": [
    { "ln": 0.5, "books": {...} },
    { "ln": 1.5, "books": {...} },  ← Primary (filtered out)
    { "ln": 2.5, "books": {...} },
    { "ln": 3.5, "books": {...} }
  ]
}
```
              ↓ API processes
### API Response (Output)
```json
{
  "alternates": [
    { "ln": 0.5, "books": {...} },
    { "ln": 2.5, "books": {...} },
    { "ln": 3.5, "books": {...} }
  ],
  "primary_ln": 1.5
}
```
              ↓ Component renders
### UI Display
```
┌──────────────────────────────────────┐
│ ⊕ Aaron Rodgers | PIT vs CIN | ...   │ ← Primary row
└──────────────────────────────────────┘
         │ (Click expand icon)
         ↓
┌──────────────────────────────────────┐
│ ⊖ Aaron Rodgers | PIT vs CIN | ...   │ ← Primary row
├──────────────────────────────────────┤
│   Alt: 0.5  | DK: -780 | FD: -700 |  │ ← Alternate
├──────────────────────────────────────┤
│   Alt: 2.5  | DK: +294 | FD: +290 |  │ ← Alternate
├──────────────────────────────────────┤
│   Alt: 3.5  | DK: +1140 | FD: +920|  │ ← Alternate
└──────────────────────────────────────┘
```

---

## ⚡ Performance Optimizations

### Client-Side Cache
```
First Expand:  [API Call] → 200ms
Second Expand: [Cache Hit] → <1ms (within 60s)
After 60s:     [API Call] → 200ms (cache expired)
```

### Server-Side Cache
```
First Request:  [Redis Fetch] → 50ms
Second Request: [Cache Hit]   → <5ms (within 30s)
```

### Combined Effect
```
User A expands row:     [Redis: 50ms] [Total: 50ms]
User A expands again:   [Client: <1ms] [Total: <1ms]
User B expands same:    [Server: <5ms] [Total: <5ms]
```

---

## 🎨 Component Hierarchy

```
OddsTable
  └── ExpandableRowWrapper (for each row)
       ├── Expand/Collapse Icon
       │    └── ChevronRight (rotates 90°)
       │
       ├── Primary Row Content (children)
       │    ├── Entity/Player Cell
       │    ├── Event Cell
       │    ├── Best Line Cell
       │    └── Sportsbook Cells
       │
       └── AlternateLinesRow (conditional)
            ├── Loading State
            │    └── Spinner
            │
            ├── Error State
            │    └── Error Message
            │
            ├── Empty State
            │    └── "No alternates" message
            │
            └── Alternates (animated)
                 ├── Alternate Line 1
                 ├── Alternate Line 2
                 └── Alternate Line 3
```

---

## 🔐 Caching Strategy

```
┌───────────────────────────────────────────────────────┐
│                 Client-Side Cache                      │
│  Key: "nfl:e151e71995b0b73ae7820147c39c10b19985c223"  │
│  TTL: 60 seconds                                       │
│  Storage: Map<string, { data, timestamp }>            │
└───────────────────────────────────────────────────────┘
                          │
                          ↓
┌───────────────────────────────────────────────────────┐
│                 Server-Side Cache                      │
│  Headers: Cache-Control: public, max-age=30           │
│  TTL: 30 seconds                                       │
│  Storage: HTTP cache / CDN                             │
└───────────────────────────────────────────────────────┘
                          │
                          ↓
┌───────────────────────────────────────────────────────┐
│                    Redis (Source)                      │
│  Key: props:nfl:rows:alt:{sid}                        │
│  TTL: As set by backend                                │
│  Storage: Upstash Redis                                │
└───────────────────────────────────────────────────────┘
```

---

## 🎯 Design Decisions

| Decision | Reason |
|----------|--------|
| **Lazy loading** | Don't fetch until user expands |
| **Client cache (60s)** | Balance freshness vs. performance |
| **Server cache (30s)** | Reduce Redis load |
| **Row-based caching** | Simpler than event-based |
| **Wrapper component** | Reusable, clean separation |
| **Motion animations** | Smooth UX, professional feel |
| **Filter primary line** | Avoid duplicates in UI |

---

## 📊 Performance Metrics

### Expected Performance
- **First Load:** 200-500ms (cold cache)
- **Cached Load:** <5ms (warm cache)
- **Animation:** 200ms (expand/collapse)
- **Memory:** ~1KB per cached row
- **API Calls:** Reduced by ~90% with caching

### Scalability
- ✅ Supports 1000+ rows per table
- ✅ Handles 10+ alternates per row
- ✅ Works with 15+ sportsbooks
- ✅ Responsive on mobile



