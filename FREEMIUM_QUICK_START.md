# Freemium Quick Start Guide

## 🚀 Quick Reference

### User Tiers

| Tier | Arb Results | Refresh Rate | Filters | Export |
|------|-------------|--------------|---------|--------|
| **Anonymous** | 5 | 60s | ❌ | ❌ |
| **Free** | 25 | 10s | ✅ | ❌ |
| **Pro** | Unlimited | 2s | ✅ | ✅ |

---

## 📦 Files Created

```
lib/
  └── plans.ts              # Plan limits & utilities

hooks/
  └── use-feature-access.ts # React hooks for feature gating

components/
  └── upgrade-prompt.tsx    # Upgrade UI components

libs/supabase/
  └── middleware.ts         # Updated with freemium routes

app/api/arbs/
  └── route.ts              # Updated with plan limits
```

---

## 💻 How to Use

### 1. In a Component (Client-side)

```typescript
import { useArbitrageAccess } from "@/hooks/use-feature-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";

export default function ArbitragePage() {
  const { plan, limits, upgradeMessage, isAnonymous } = useArbitrageAccess();

  return (
    <>
      {/* Show upgrade prompt */}
      {plan !== "pro" && (
        <UpgradePrompt
          plan={plan}
          feature="arbitrage"
          message={upgradeMessage}
          variant="banner"
        />
      )}

      {/* Your content with limits applied */}
      <ArbitrageTable maxResults={limits.maxResults} />
    </>
  );
}
```

### 2. In an API Route (Server-side)

```typescript
import { createClient } from "@/libs/supabase/server";
import { getUserPlan, PLAN_LIMITS } from "@/lib/plans";

export async function GET(req: NextRequest) {
  // Get user plan
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userPlan = await getUserPlan(user);
  
  // Get limits
  const limits = PLAN_LIMITS[userPlan].arbitrage;
  const maxResults = limits.maxResults === -1 ? 1000 : limits.maxResults;
  
  // Apply limits to results
  const results = await getResults();
  return NextResponse.json({
    data: results.slice(0, maxResults),
    plan: userPlan,
    limits,
  });
}
```

---

## 🎨 UI Components

### Upgrade Prompt Variants

```typescript
// 1. Inline (subtle, in-flow)
<UpgradePrompt
  plan="anonymous"
  feature="arbitrage"
  message="Sign up to see more"
  variant="inline"
/>

// 2. Banner (attention-grabbing, top of page)
<UpgradePrompt
  plan="free"
  feature="arbitrage"
  message="Upgrade to Pro for unlimited access"
  variant="banner"
/>

// 3. Card (centered, empty state)
<UpgradePrompt
  plan="anonymous"
  feature="arbitrage"
  message="Create account to unlock more features"
  variant="card"
/>
```

### Locked Overlay

```typescript
<div className="relative">
  {/* Blurred content */}
  <div className="blur-sm opacity-50">
    <HiddenContent />
  </div>
  
  {/* Lock overlay */}
  <LockedOverlay
    plan="anonymous"
    feature="arbitrage"
    message="Sign up to see more opportunities"
  />
</div>
```

---

## 🔧 Available Hooks

```typescript
// Get user's plan
const plan = useUserPlan(); // "anonymous" | "free" | "pro"

// Get arbitrage feature access
const { plan, limits, upgradeMessage, hasAccess } = useArbitrageAccess();

// Get odds feature access
const { limits } = useOddsAccess();

// Get +EV feature access
const { hasAccess, upgradeMessage } = usePositiveEVAccess();

// Generic feature access
const access = useFeatureAccess("arbitrage");
```

---

## 📋 Common Patterns

### Pattern 1: Show Results with Limit

```typescript
const { limits } = useArbitrageAccess();
const results = allResults.slice(0, limits.maxResults);

return (
  <>
    {results.map(result => <ResultCard key={result.id} {...result} />)}
    {allResults.length > limits.maxResults && (
      <UpgradePrompt plan={plan} feature="arbitrage" message="..." />
    )}
  </>
);
```

### Pattern 2: Disable Feature

```typescript
const { limits } = useArbitrageAccess();

<button 
  disabled={!limits.canExport}
  onClick={handleExport}
>
  Export {!limits.canExport && "(Pro only)"}
</button>
```

### Pattern 3: Conditional Rendering

```typescript
const { isAnonymous, isFree, isPro } = useArbitrageAccess();

return (
  <>
    {isAnonymous && <SignUpCTA />}
    {isFree && <UpgradeToPro />}
    {isPro && <AllFeatures />}
  </>
);
```

---

## 🛠️ Customizing Limits

Edit `lib/plans.ts`:

```typescript
export const PLAN_LIMITS = {
  anonymous: {
    arbitrage: {
      maxResults: 5,        // ← Change this
      refreshRate: 60000,   // ← Or this
      canFilter: false,
      canExport: false,
    },
    // ...
  },
  // ...
}
```

---

## 🔍 Debugging

### Check user's plan in console:

```typescript
import { useUserPlan } from "@/hooks/use-feature-access";

function DebugPlan() {
  const plan = useUserPlan();
  console.log("Current plan:", plan);
  return null;
}
```

### Check API response headers:

```bash
curl -I https://yourapp.com/api/arbs
# Look for:
# X-User-Plan: anonymous
# X-Plan-Limit: 5
```

---

## ✅ Quick Test

1. **Test as Anonymous:**
   - Open `/arbitrage` in incognito
   - Should see 5 results max
   - Should see "Sign up" prompt

2. **Test as Free:**
   - Sign up for account
   - Visit `/arbitrage`
   - Should see 25 results max
   - Should see "Upgrade" prompt

3. **Test as Pro:**
   - Manually set plan to "pro" in database
   - Visit `/arbitrage`
   - Should see all results
   - Should NOT see upgrade prompt

---

## 🚦 Routes Summary

### Public (No auth check)
- `/`, `/login`, `/register`, `/pricing`, `/blog`, etc.

### Freemium (Open to all, feature-gated)
- `/arbitrage`, `/odds`, `/positive-ev`, `/parlay-builder`

### Protected (Auth required)
- `/dashboard`, `/settings`, `/account`, `/billing`

---

## 📞 Need Help?

- Review `FREEMIUM_IMPLEMENTATION.md` for detailed docs
- Check `lib/plans.ts` for plan configuration
- See `components/upgrade-prompt.tsx` for UI examples

**You're all set! 🎉**

