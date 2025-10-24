# Trial System Setup & User Entitlements

## Current State of Existing Users

All existing users in your database have entitlements like this:
```json
{
  "user_id": "...",
  "current_plan": "free",
  "entitlement_source": "none",
  "trial_started_at": null,
  "trial_ends_at": null,
  "trial_used": false
}
```

## How Trial Activation Works

### 1. **New Users (Sign Up)**
When a new user signs up:
- `/api/auth/callback` detects new users (created within 5 minutes)
- Automatically calls `/api/auth/init-trial`
- Sets:
  - `trial_used = true`
  - `trial_started_at = now()`
  - `trial_ends_at = now() + 7 days`

### 2. **Existing Users (trial_used = false)**
When existing users return and click "Start Free Trial":
- Button links to `/trial/activate`
- Route checks authentication:
  - **Not authenticated** → Redirects to `/register?redirectTo=/trial/activate`
  - **Authenticated** → Checks `trial_used`
- If `trial_used = false`:
  - Initializes trial (same as new users)
  - Redirects to `/arbitrage` with Pro access
- If `trial_used = true`:
  - Just redirects to `/arbitrage` (no trial activation)

### 3. **Trial Activation Flow**

```
User clicks "Start Free Trial"
         ↓
    /trial/activate
         ↓
   Authenticated? ──NO──> /register?redirectTo=/trial/activate
         ↓ YES
         ↓
   trial_used = false? ──NO──> Redirect to /arbitrage
         ↓ YES
         ↓
   Initialize Trial:
   - trial_used = true
   - trial_started_at = now()
   - trial_ends_at = now() + 7 days
         ↓
   Redirect to /arbitrage
```

## Where "Start Free Trial" Buttons Are

1. **Pricing Page** (`/pricing`)
   - Pro tier card
   - Links to `/trial/activate`

2. **Arbitrage Auth Gate** (`/arbitrage` for non-Pro users)
   - Overlay modal
   - Links to `/trial/activate`

3. **Odds Screen Pro Gate** (if applicable)
   - Links to `/trial/activate`

## Plan Detection Logic

The `current_entitlements` view determines user plan:

```sql
case
  -- Active subscription = Pro
  when exists (
    select 1 from billing.subscriptions s
    where s.user_id = p.id
      and s.status in ('active','trialing','past_due','unpaid')
      and s.current_period_end > now()
  ) then 'pro'
  
  -- Active trial = Pro
  when p.trial_ends_at is not null
       and p.trial_ends_at > now()
  then 'pro'
  
  -- Otherwise = Free
  else 'free'
end as current_plan
```

## User Experience by Status

| Status | trial_used | trial_ends_at | current_plan | What They See |
|--------|-----------|---------------|--------------|---------------|
| **New User** | `false` → `true` | Set on signup | `pro` (7 days) | Full Pro access |
| **Existing (unused trial)** | `false` | `null` | `free` | "Start Free Trial" button |
| **Active Trial** | `true` | Future date | `pro` | Full Pro access |
| **Expired Trial** | `true` | Past date | `free` | "Upgrade to Pro" + auth gate |
| **Pro Subscriber** | Any | Any | `pro` | Full Pro access |

## Testing the Flow

### Test 1: New User Signup
1. Sign up with new email
2. Should automatically get 7-day trial
3. Check `profiles` table: `trial_used = true`, dates set
4. Check `/arbitrage`: Should see full table

### Test 2: Existing User (unused trial)
1. Use existing user with `trial_used = false`
2. Visit `/pricing` or `/arbitrage`
3. Click "Start Free Trial"
4. Should redirect to `/trial/activate` → `/arbitrage`
5. Check `profiles` table: `trial_used = true`, dates set
6. Should see full Pro access

### Test 3: Existing User (trial used)
1. Use user with `trial_used = true` and expired `trial_ends_at`
2. Visit `/arbitrage`
3. Should see auth gate with "Upgrade to Pro"
4. Should NOT see "Start Free Trial"

## Database Queries for Verification

### Check all users' trial status:
```sql
SELECT 
  id,
  email,
  trial_used,
  trial_started_at,
  trial_ends_at,
  CASE 
    WHEN trial_ends_at > now() THEN 'Active Trial'
    WHEN trial_ends_at <= now() THEN 'Expired Trial'
    WHEN trial_used = false THEN 'Unused Trial'
    ELSE 'No Trial'
  END as trial_status
FROM profiles
ORDER BY created_at DESC;
```

### Check entitlements:
```sql
SELECT * FROM public.current_entitlements
ORDER BY user_id;
```

## Important Notes

1. **One Trial Per User**: Once `trial_used = true`, it can never be reset (by design)
2. **No Card Required**: Trial activation doesn't require payment info
3. **Auto-Expiry**: After 7 days, `current_plan` automatically becomes 'free' (view logic)
4. **Seamless Upgrade**: Users can upgrade to paid Pro anytime during or after trial
5. **Existing Users**: All existing users with `trial_used = false` will get their trial when they click the button

## Migration Strategy (Optional)

If you want to give ALL existing users a fresh trial opportunity:

```sql
-- Reset trial status for all existing users
UPDATE profiles
SET 
  trial_used = false,
  trial_started_at = null,
  trial_ends_at = null
WHERE created_at < now() - interval '1 day';
```

⚠️ **Warning**: Only do this if you want to give everyone a fresh trial!

