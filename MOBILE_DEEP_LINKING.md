# Mobile Deep Linking - Implementation Guide

## 🎯 Overview

Smart deep linking system that automatically selects the best link based on user's device and available URLs from the vendor.

---

## 📱 Link Priority Logic

```
1. Mobile Device + Mobile Link Available → Use Mobile Link
2. Desktop Link Available → Use Desktop Link  
3. Fallback → Sportsbook Homepage URL
```

---

## 🔧 Implementation

### **1. Type Definitions** (`lib/arb-schema.ts`)

```typescript
o: {
  bk: string;
  name?: string;
  od: number;
  id?: string;
  u?: string;        // Desktop deep link
  m?: string | null; // Mobile deep link (NEW)
};
u: {
  bk: string;
  name?: string;
  od: number;
  id?: string;
  u?: string;        // Desktop deep link
  m?: string | null; // Mobile deep link (NEW)
};
```

### **2. Mobile Detection** (`components/arbs/arb-table-v2.tsx`)

```typescript
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth < 768;
};
```

**Detects:**
- ✅ User agent (iOS, Android, etc.)
- ✅ Screen width (< 768px = mobile)

### **3. Smart Link Selection**

```typescript
const getBestLink = (bookId?: string, desktopUrl?: string | null, mobileUrl?: string | null) => {
  // Priority 1: Mobile link on mobile device
  if (isMobile() && mobileUrl) return mobileUrl;
  
  // Priority 2: Desktop link
  if (desktopUrl) return desktopUrl;
  
  // Priority 3: Fallback to sportsbook homepage
  return getBookFallbackUrl(bookId);
};
```

### **4. Updated Link Opening**

```typescript
// Single bet
openLink(r.o?.bk, r.o?.u, r.o?.m);

// Dual bet (both sides)
const overUrl = getBestLink(r.o?.bk, r.o?.u, r.o?.m);
const underUrl = getBestLink(r.u?.bk, r.u?.u, r.u?.m);
```

---

## 📊 Example Data Structure

```json
{
  "o": {
    "bk": "hard-rock-indiana",
    "name": "DeVonta Smith Over 5.5",
    "od": -105,
    "u": "https://app.hardrock.bet/?deep_link_value=betslip/7878545547080761687",
    "m": "https://share.hardrock.bet/Pt0T/bet?deep_link_value=hardrock://betslip/7878545547080761687"
  },
  "u": {
    "bk": "draftkings",
    "name": "DeVonta Smith Under 5.5",
    "od": 111,
    "u": "https://sportsbook.draftkings.com/event/32225665?outcomes=...",
    "m": null
  }
}
```

**In this example:**
- **Hard Rock** has both desktop and mobile links
- **DraftKings** only has desktop link (`m: null`)

---

## 🎯 User Experience

### **Mobile User (iPhone/Android)**

| Sportsbook | Has Mobile Link? | Opens |
|------------|------------------|-------|
| Hard Rock | ✅ Yes | Mobile app deep link |
| DraftKings | ❌ No | Desktop website (mobile-optimized) |
| FanDuel | ❌ No (null) | FanDuel homepage |

### **Desktop User**

| Sportsbook | Has Desktop Link? | Opens |
|------------|-------------------|-------|
| Hard Rock | ✅ Yes | Desktop website |
| DraftKings | ✅ Yes | Desktop website |
| FanDuel | ❌ No (null) | FanDuel homepage |

---

## ✅ Benefits

1. **Native App Experience** - Opens sportsbook apps on mobile when available
2. **Seamless Fallback** - Gracefully degrades to desktop links or homepage
3. **Better Conversion** - Users land directly in the bet slip (when supported)
4. **Cross-Platform** - Works on iOS, Android, and desktop
5. **Vendor Agnostic** - Handles books with/without mobile links

---

## 🧪 Testing

### **Test on Mobile:**
1. Open arbitrage table on iPhone/Android
2. Click a bet with mobile link (e.g., Hard Rock)
3. Should open native app with bet slip pre-filled
4. Click a bet without mobile link (e.g., DraftKings)
5. Should open mobile website

### **Test on Desktop:**
1. Open arbitrage table on desktop
2. Click any bet
3. Should always open desktop website (never mobile links)

### **Test Fallback:**
1. Find a bet with `u: null` and `m: null`
2. Click the bet
3. Should open sportsbook homepage

---

## 🔍 Debugging

### **Check Link Selection:**
```javascript
// In browser console
console.log('Is Mobile:', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
console.log('Screen Width:', window.innerWidth);
```

### **Inspect Data:**
```javascript
// Check if mobile links are present
fetch('/api/arbs/teaser?limit=1')
  .then(r => r.json())
  .then(data => console.log('Sample row:', data.rows[0]));
```

---

## 📝 Backend Requirements

Your backend worker should provide:

```typescript
{
  o: {
    u: string;        // Desktop deep link (required)
    m: string | null; // Mobile deep link (optional)
  },
  u: {
    u: string;        // Desktop deep link (required)
    m: string | null; // Mobile deep link (optional)
  }
}
```

**Notes:**
- `m` can be `null` if sportsbook doesn't support mobile deep links
- Both `u` and `m` can be `null` (will fallback to homepage)
- Mobile links typically use custom URL schemes (e.g., `hardrock://`, `draftkings://`)

---

## 🚀 Future Enhancements

1. **User Preference** - Let users choose "Always use desktop" or "Always use mobile"
2. **Link Analytics** - Track which link types convert best
3. **Smart Routing** - Detect if app is installed, otherwise use web
4. **Deep Link Validation** - Verify links before opening
5. **Retry Logic** - If mobile link fails, fallback to desktop

---

## 🔗 Related Files

- `lib/arb-schema.ts` - Type definitions
- `components/arbs/arb-table-v2.tsx` - Link selection logic
- `lib/data/sportsbooks.ts` - Sportsbook homepage URLs

---

**Last Updated**: [Current Date]  
**Status**: ✅ Production-Ready

