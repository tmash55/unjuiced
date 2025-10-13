# Freemium Implementation Guide

## 🎯 Overview

Your app now supports a 3-tier freemium model:
- **Anonymous** (no account): Limited access
- **Free** (registered user): Better access  
- **Pro** (paid user): Full access

## 📊 Plan Limits

### Anonymous Users (No Account)
```typescript
arbitrage: {
  maxResults: 5,          // Only see 5 arbitrage opportunities
  refreshRate: 60000,     // Data refreshes every 60 seconds
  canFilter: false,       // Cannot filter results
  canExport: false,       // Cannot export data
}

odds: {
  maxLeagues: 1,          // Only 1 league visible
  refreshRate: 30000,     // Updates every 30 seconds  
  canCompare: false,      // Cannot compare odds
}

positiveEV: {
  maxResults: 0,          // No access to +EV tool
}
```

### Free Users (Registered)
```typescript
arbitrage: {
  maxResults: 25,         // See up to 25 opportunities
  refreshRate: 10000,     // Data refreshes every 10 seconds
  canFilter: true,        // Can filter by league, book, etc.
  canExport: false,       // Cannot export data
}

odds: {
  maxLeagues: 3,          // Access to 3 leagues
  refreshRate: 5000,      // Updates every 5 seconds
  canCompare: true,       // Can compare odds across books
}

positiveEV: {
  maxResults: 10,         // See up to 10 +EV bets
  refreshRate: 30000,     // Updates every 30 seconds
}
```

### Pro Users (Paid)
```typescript
arbitrage: {
  maxResults: -1,         // Unlimited (returns up to 1000)
  refreshRate: 2000,      // Real-time: updates every 2 seconds
  canFilter: true,        // Full filtering capabilities
  canExport: true,        // Can export to CSV/Excel
}

odds: {
  maxLeagues: -1,         // All leagues
  refreshRate: 2000,      // Real-time updates
  canCompare: true,       // Full comparison tools
}

positiveEV: {
  maxResults: -1,         // Unlimited opportunities
  refreshRate: 5000,      // Fast updates
}
```

---

## 🏗️ Architecture

### 1. Middleware (libs/supabase/middleware.ts)

**Three Route Types:**

1. **Public Routes** - No auth check at all
   - `/`, `/login`, `/register`, `/pricing`, `/blog`, etc.

2. **Freemium Routes** - Accessible to all, feature-gated in components
   - `/arbitrage`, `/odds`, `/positive-ev`, `/parlay-builder`

3. **Protected Routes** - Require authentication
   - `/dashboard`, `/settings`, `/account`, `/billing`

### 2. Plan Detection

**Server-side (API routes):**
```typescript
import { getUserPlan } from "@/lib/plans";

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
const userPlan = await getUserPlan(user); // "anonymous" | "free" | "pro"
```

**Client-side (components):**
```typescript
import { useUserPlan, useArbitrageAccess } from "@/hooks/use-feature-access";

function MyComponent() {
  const plan = useUserPlan();
  const { hasAccess, limits, upgradeMessage } = useArbitrageAccess();
  
  return (
    <div>
      {plan === "anonymous" && <UpgradePrompt message={upgradeMessage} />}
      {hasAccess && <ArbitrageTable limit={limits.maxResults} />}
    </div>
  );
}
```

---

## 🔧 Implementation Examples

### Example 1: Arbitrage Page with Gating

```typescript
"use client";

import { useArbitrageAccess } from "@/hooks/use-feature-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";

export default function ArbitragePage() {
  const { 
    plan, 
    limits, 
    upgradeMessage, 
    isAnonymous 
  } = useArbitrageAccess();

  return (
    <div>
      {/* Show upgrade banner for anonymous/free users */}
      {plan !== "pro" && (
        <UpgradePrompt
          plan={plan}
          feature="arbitrage"
          message={upgradeMessage}
          variant="banner"
        />
      )}

      {/* Show arbitrage table with plan-based limits */}
      <ArbitrageTable 
        maxResults={limits.maxResults}
        refreshRate={limits.refreshRate}
        canFilter={limits.canFilter}
        canExport={limits.canExport}
      />

      {/* Show locked overlay for additional results */}
      {plan !== "pro" && (
        <div className="relative">
          <div className="pointer-events-none blur-sm opacity-50">
            {/* Blurred preview of more results */}
          </div>
          <LockedOverlay
            plan={plan}
            feature="arbitrage"
            message={upgradeMessage}
          />
        </div>
      )}
    </div>
  );
}
```

### Example 2: API Route with Plan Limits

```typescript
// app/api/arbs/route.ts (already implemented)

export async function GET(req: NextRequest) {
  // Get user plan
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userPlan = await getUserPlan(user);
  
  // Apply plan limits
  const planLimits = PLAN_LIMITS[userPlan].arbitrage;
  const maxAllowed = planLimits.maxResults === -1 ? 1000 : planLimits.maxResults;
  const limit = Math.min(requestedLimit, maxAllowed);
  
  // Return results with plan info
  return NextResponse.json({
    rows: results.slice(0, limit),
    plan: userPlan,
    limits: {
      maxResults: planLimits.maxResults,
      applied: limit,
      canFilter: planLimits.canFilter,
      canExport: planLimits.canExport,
    }
  });
}
```

### Example 3: Feature Gating UI Components

```typescript
import { useArbitrageAccess } from "@/hooks/use-feature-access";

function ExportButton() {
  const { limits, plan } = useArbitrageAccess();
  
  if (!limits.canExport) {
    return (
      <Tooltip content="Upgrade to Pro to export data">
        <button disabled className="opacity-50 cursor-not-allowed">
          <Download className="size-4" />
          Export (Pro only)
        </button>
      </Tooltip>
    );
  }
  
  return (
    <button onClick={handleExport}>
      <Download className="size-4" />
      Export
    </button>
  );
}
```

---

## 🎨 UI Components

### 1. UpgradePrompt Component

**Three variants:**

```typescript
// Inline variant
<UpgradePrompt
  plan={plan}
  feature="arbitrage"
  message="Sign up to see more opportunities"
  variant="inline"
/>

// Banner variant (recommended for page headers)
<UpgradePrompt
  plan={plan}
  feature="arbitrage"
  message="Upgrade to Pro for unlimited arbitrage opportunities"
  variant="banner"
/>

// Card variant (recommended for empty states)
<UpgradePrompt
  plan={plan}
  feature="arbitrage"
  message="Unlock more opportunities with a free account"
  variant="card"
/>
```

### 2. LockedOverlay Component

```typescript
<div className="relative">
  {/* Your blurred content */}
  <div className="blur-sm">...</div>
  
  {/* Overlay */}
  <LockedOverlay
    plan={plan}
    feature="arbitrage"
    message="Sign up free to see more"
  />
</div>
```

---

## 🔑 Hooks Reference

### `useUserPlan()`
Returns the user's current plan.

```typescript
const plan = useUserPlan(); // "anonymous" | "free" | "pro"
```

### `useFeatureAccess(feature)`
Generic hook for any feature.

```typescript
const {
  plan,              // User's plan
  hasAccess,         // Can user access this feature?
  limits,            // Feature limits object
  checkLimit,        // Function to check if count exceeds limit
  upgradeMessage,    // Pre-formatted upgrade message
  isAnonymous,       // Boolean helpers
  isFree,
  isPro,
  isAuthenticated,
} = useFeatureAccess("arbitrage");
```

### `useArbitrageAccess()`
Shortcut for arbitrage feature.

```typescript
const { limits, plan, upgradeMessage } = useArbitrageAccess();
```

### `useOddsAccess()`
Shortcut for odds feature.

```typescript
const { limits, plan } = useOddsAccess();
```

### `usePositiveEVAccess()`
Shortcut for +EV feature.

```typescript
const { hasAccess, upgradeMessage } = usePositiveEVAccess();
```

---

## 📝 Utility Functions

### Server-side Functions

```typescript
import { getUserPlan, canAccessFeature, getFeatureLimits } from "@/lib/plans";

// Get user's plan
const plan = await getUserPlan(user);

// Check if user can access feature
const canUse = canAccessFeature(plan, "arbitrage");

// Get feature limits
const limits = getFeatureLimits(plan, "arbitrage");
```

### Client-side Functions

```typescript
import { getClientUserPlan, exceedsLimit, getUpgradeMessage } from "@/lib/plans";

// Get plan from user object
const plan = getClientUserPlan(user);

// Check if result count exceeds limit
const tooMany = exceedsLimit(plan, "arbitrage", resultCount);

// Get upgrade message
const message = getUpgradeMessage(plan, "arbitrage");
```

---

## 🚀 Conversion Funnel

### Anonymous → Free
1. User visits `/arbitrage`
2. Sees 5 opportunities (limited)
3. Sees "Sign up free to see 25 opportunities" banner
4. Clicks "Sign up free" → `/register`
5. Creates account
6. Now sees 25 opportunities + filters

### Free → Pro
1. Free user hits 25-result limit
2. Sees "Upgrade to Pro for unlimited access" banner
3. Wants export feature (disabled for free)
4. Clicks "Upgrade to Pro" → `/pricing`
5. Subscribes
6. Now gets unlimited results + all features

---

## 🔒 Security Considerations

1. **Never trust client-side limits** - Always enforce in API
2. **Plan stored in database** - `profiles.plan` column
3. **Middleware checks auth** - But allows anonymous access to freemium routes
4. **API enforces limits** - Based on user's actual plan from database
5. **Rate limiting** - Consider adding rate limits per plan

---

## 📊 Analytics Tracking

Track these events to optimize conversion:

```typescript
// When user hits limit
trackEvent("limit_reached", { 
  feature: "arbitrage",
  plan: "anonymous",
  results_shown: 5,
  results_available: 50
});

// When user clicks upgrade
trackEvent("upgrade_clicked", {
  feature: "arbitrage",
  current_plan: "free",
  location: "banner"
});

// When user converts
trackEvent("plan_upgraded", {
  from_plan: "free",
  to_plan: "pro",
  trigger_feature: "arbitrage"
});
```

---

## ✅ Testing Checklist

- [ ] Anonymous user can view `/arbitrage` without login
- [ ] Anonymous user sees only 5 results
- [ ] Anonymous user sees upgrade prompt
- [ ] Registered user sees 25 results
- [ ] Pro user sees unlimited results
- [ ] API enforces limits correctly
- [ ] Export button disabled for non-pro users
- [ ] Filter UI disabled for anonymous users
- [ ] Upgrade CTAs link to correct pages
- [ ] Plan persists across page refreshes

---

## 🎯 Next Steps

1. **Update your arbitrage page** to use `useArbitrageAccess()`
2. **Add UpgradePrompt components** to freemium pages
3. **Test the flow** as anonymous, free, and pro user
4. **Set up analytics** to track conversions
5. **A/B test** different upgrade messages

---

**Your freemium system is ready! 🎉**

