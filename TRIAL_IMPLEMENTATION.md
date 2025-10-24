# 7-Day Free Trial Implementation

## Overview
Implemented automatic 7-day free trial for all new users upon signup. The trial grants full Pro access and is tracked in the database to ensure it can only be used once per user.

---

## Database Schema

### Profiles Table Updates
```sql
alter table public.profiles
  add column plan text not null default 'free' check (plan in ('free','pro')),
  add column trial_used boolean not null default false,
  add column trial_started_at timestamptz,
  add column trial_ends_at timestamptz;
```

### Entitlements View
**Note:** This view is in the `public` schema and is named `current_entitlements`.

```sql
create or replace view public.current_entitlements as
select
  p.id as user_id,
  -- A user is PRO if they have an active subscription or an active trial window
  case
    when exists (
      select 1
      from billing.subscriptions s
      where s.user_id = p.id
        and s.status in ('active','trialing','past_due','unpaid')
        and s.current_period_end > now()
    )
    then 'pro'
    when p.trial_ends_at is not null
         and p.trial_ends_at > now()
    then 'pro'
    else 'free'
  end as current_plan,
  -- Optional: expose why
  case
    when exists (
      select 1 from billing.subscriptions s
      where s.user_id = p.id
        and s.status in ('active','trialing','past_due','unpaid')
        and s.current_period_end > now()
    ) then 'subscription'
    when p.trial_ends_at is not null and p.trial_ends_at > now()
      then 'trial'
    else 'none'
  end as entitlement_source,
  p.trial_started_at,
  p.trial_ends_at,
  p.trial_used
from public.profiles p;
```

---

## Implementation Details

### 1. Trial Initialization Endpoint
**File:** `app/api/auth/init-trial/route.ts`

**Purpose:** Initializes the 7-day trial for a new user

**Logic:**
- Checks if user is authenticated
- Verifies `trial_used = false` (hasn't been used before)
- Sets:
  - `trial_used = true`
  - `trial_started_at = now()`
  - `trial_ends_at = now() + 7 days`
- Returns trial dates and success status
- Idempotent: Returns early if trial already used

**Usage:**
```typescript
POST /api/auth/init-trial
// No body required, uses authenticated session
```

---

### 2. Auth Callback Integration
**File:** `app/api/auth/callback/route.ts`

**Changes:**
- Detects new users (created within last 5 minutes)
- Automatically calls `/api/auth/init-trial` for new users
- Non-blocking: Continues redirect even if trial init fails
- Logs all trial initialization attempts

**Flow:**
```
User confirms email
  ↓
Auth callback receives code
  ↓
Exchange code for session
  ↓
Check if user is new (created < 5 min ago)
  ↓
Call /api/auth/init-trial
  ↓
Redirect to /arbitrage
```

---

### 3. Immediate Signup Integration
**File:** `components/auth/signup-email.tsx`

**Changes:**
- For environments with email confirmation disabled
- Calls `/api/auth/init-trial` immediately after successful signup
- User gets instant Pro access via trial
- Non-blocking: Shows success toast and redirects even if trial init fails

**Flow:**
```
User signs up
  ↓
supabase.auth.signUp()
  ↓
If session exists (no email confirmation)
  ↓
Call /api/auth/init-trial
  ↓
Show success toast
  ↓
Redirect to /arbitrage
```

---

### 4. Plan API Update
**File:** `app/api/me/plan/route.ts`

**Changes:**
- Now queries `v_user_entitlements` view instead of `profiles.plan` directly
- Returns `effective_plan` which accounts for:
  - Active Stripe subscriptions
  - Active trials (trial_ends_at > now())
- Also returns trial metadata:
  - `trial_used`
  - `trial_started_at`
  - `trial_ends_at`
  - `is_trial_active` (computed)

**Response:**
```json
{
  "plan": "pro",
  "authenticated": true,
  "userId": "...",
  "trial": {
    "trial_used": true,
    "trial_started_at": "2025-01-15T10:00:00Z",
    "trial_ends_at": "2025-01-22T10:00:00Z",
    "is_trial_active": true
  }
}
```

---

### 5. Server-Side Plan Helper
**File:** `lib/plans.ts`

**Changes:**
- `getUserPlan()` now queries `v_user_entitlements` view
- Returns `effective_plan` instead of `profiles.plan`
- Ensures consistent plan logic across the application

---

## User Flows

### New User Signup (Email Confirmation Enabled)
```
1. User submits signup form
2. Supabase creates auth.users record
3. Database trigger creates profiles record (trial_used = false)
4. User receives confirmation email
5. User clicks confirmation link
6. Auth callback detects new user
7. Auth callback calls /api/auth/init-trial
8. Trial dates are set in profiles table
9. User is redirected to /arbitrage
10. /api/me/plan returns "pro" (via v_user_entitlements)
11. User has full Pro access for 7 days
```

### New User Signup (Email Confirmation Disabled)
```
1. User submits signup form
2. Supabase creates auth.users record + session
3. Database trigger creates profiles record (trial_used = false)
4. signup-email component calls /api/auth/init-trial
5. Trial dates are set in profiles table
6. User is redirected to /arbitrage
7. /api/me/plan returns "pro" (via v_user_entitlements)
8. User has full Pro access for 7 days
```

### Trial Expiration
```
1. User's trial_ends_at passes
2. v_user_entitlements view returns "free"
3. /api/me/plan returns "free"
4. getUserPlan() returns "free"
5. User sees upgrade prompts
6. User can purchase Pro subscription
```

---

## Key Features

### ✅ Idempotent
- Trial can only be initialized once per user
- Multiple calls to `/api/auth/init-trial` are safe
- Returns early if `trial_used = true`

### ✅ Non-Blocking
- Trial initialization failures don't block signup flow
- Errors are logged but user still gets redirected
- Graceful degradation to free plan if trial fails

### ✅ Centralized Logic
- All plan checks use `v_user_entitlements` view
- Single source of truth for user entitlements
- Consistent behavior across API and server functions

### ✅ Stripe-Ready
- View already checks for active subscriptions
- Trial logic coexists with subscription logic
- Easy to add Stripe integration later

---

## Testing Checklist

### Manual Testing
- [ ] New user signup (email confirmation enabled)
- [ ] New user signup (email confirmation disabled)
- [ ] Trial dates are set correctly (7 days from now)
- [ ] User has Pro access during trial
- [ ] User reverts to Free after trial expires
- [ ] Trial cannot be reused (trial_used = true)
- [ ] /api/me/plan returns correct plan
- [ ] getUserPlan() returns correct plan
- [ ] Arbitrage table shows full data during trial
- [ ] Odds screen shows all features during trial

### Database Checks
```sql
-- Check user's trial status
SELECT id, email, trial_used, trial_started_at, trial_ends_at
FROM profiles
WHERE email = 'test@example.com';

-- Check effective plan
SELECT user_id, effective_plan
FROM v_user_entitlements
WHERE user_id = '...';
```

---

## Next Steps

1. ✅ Trial initialization (DONE)
2. ⏳ Stripe subscription creation
3. ⏳ Stripe webhook handlers
4. ⏳ Subscription management UI
5. ⏳ Trial expiration notifications
6. ⏳ Upgrade prompts and CTAs

---

## Notes

- Trial is granted automatically on first signup
- No credit card required for trial
- Trial cannot be extended or reused
- Users can upgrade to paid Pro at any time during or after trial
- Paid subscriptions take precedence over trials in v_user_entitlements

