# Testing Trial Flow - Quick Guide

## 🧪 How to Test Trial Expiration

### Method 1: Manual Database Update (Recommended)

**1. Find your test user:**
```sql
SELECT id, email, trial_used, trial_started_at, trial_ends_at 
FROM profiles 
WHERE email = 'your-test-email@test.com';
```

**2. Set trial to expire in the past:**
```sql
UPDATE profiles 
SET 
  trial_used = true,
  trial_started_at = now() - interval '8 days',
  trial_ends_at = now() - interval '1 day'
WHERE email = 'your-test-email@test.com';
```

**3. Verify the change:**
```sql
SELECT * FROM public.current_entitlements 
WHERE user_id = '[your-user-id]';
```
Should show `current_plan = 'free'` and `entitlement_source = 'none'`

**4. Test in the app:**
- Refresh the page
- Should see "Free" badge in account dropdown
- Should see auth gate on `/arbitrage`
- Should see "Upgrade to Pro" (no trial option)

---

### Method 2: Set Trial to Expire Soon (Test Countdown)

**Set trial to expire in 1 hour:**
```sql
UPDATE profiles 
SET 
  trial_used = true,
  trial_started_at = now() - interval '6 days 23 hours',
  trial_ends_at = now() + interval '1 hour'
WHERE email = 'your-test-email@test.com';
```

**Set trial to expire in 1 day:**
```sql
UPDATE profiles 
SET 
  trial_used = true,
  trial_started_at = now() - interval '6 days',
  trial_ends_at = now() + interval '1 day'
WHERE email = 'your-test-email@test.com';
```

---

## 🔄 Complete Trial Flow Testing

### Test 1: New User Trial Activation
```sql
-- Reset user to unused trial state
UPDATE profiles 
SET 
  trial_used = false,
  trial_started_at = null,
  trial_ends_at = null
WHERE email = 'your-test-email@test.com';
```

**Expected behavior:**
1. Visit `/pricing` → See "Start Free — 7-Day Trial" button
2. Click button → Trial activates
3. Check database:
```sql
SELECT trial_used, trial_started_at, trial_ends_at 
FROM profiles 
WHERE email = 'your-test-email@test.com';
```
Should show `trial_used = true` and dates set

4. Visit `/arbitrage` → Full access (no gate)
5. Account dropdown → Shows "Trial" badge
6. Settings → Billing → Shows trial end date

---

### Test 2: Active Trial User
```sql
-- Set user with active trial (3 days remaining)
UPDATE profiles 
SET 
  trial_used = true,
  trial_started_at = now() - interval '4 days',
  trial_ends_at = now() + interval '3 days'
WHERE email = 'your-test-email@test.com';
```

**Expected behavior:**
1. Account dropdown → "Trial" badge
2. `/arbitrage` → Full access
3. Settings → Billing → Shows "Trial ends [date]"
4. Can use all Pro features

---

### Test 3: Expired Trial User
```sql
-- Set user with expired trial
UPDATE profiles 
SET 
  trial_used = true,
  trial_started_at = now() - interval '10 days',
  trial_ends_at = now() - interval '3 days'
WHERE email = 'your-test-email@test.com';
```

**Expected behavior:**
1. Account dropdown → "Free" badge
2. `/arbitrage` → Auth gate appears
3. Auth gate shows "Upgrade to Pro" (NO trial option)
4. Settings → Billing → Shows "Free" plan
5. Pricing page → Only shows "Unlock Pro Now" button (no trial)

---

### Test 4: Trial to Paid Conversion
```sql
-- Start with active trial
UPDATE profiles 
SET 
  trial_used = true,
  trial_started_at = now() - interval '2 days',
  trial_ends_at = now() + interval '5 days'
WHERE email = 'your-test-email@test.com';
```

**Steps:**
1. Verify trial is active (Pro access)
2. Go to Settings → Billing
3. Click "Subscribe to Pro"
4. Complete Stripe checkout (use test card: `4242 4242 4242 4242`)
5. After payment:
   - Check `billing.subscriptions` table
   - Check `current_entitlements` view
   - Should show `current_plan = 'pro'` and `entitlement_source = 'subscription'`
6. Account dropdown → "Pro" badge (purple)
7. Still have Pro access (now via subscription, not trial)

---

## 🎯 Quick Test Scenarios

### Scenario A: "I just signed up"
```sql
UPDATE profiles SET trial_used = false, trial_started_at = null, trial_ends_at = null WHERE email = 'test@test.com';
```
✅ Should see trial CTA everywhere

### Scenario B: "I'm on day 5 of my trial"
```sql
UPDATE profiles SET trial_used = true, trial_started_at = now() - interval '5 days', trial_ends_at = now() + interval '2 days' WHERE email = 'test@test.com';
```
✅ Should have Pro access, see trial badge

### Scenario C: "My trial expired yesterday"
```sql
UPDATE profiles SET trial_used = true, trial_started_at = now() - interval '8 days', trial_ends_at = now() - interval '1 day' WHERE email = 'test@test.com';
```
✅ Should be locked out, see upgrade CTAs

### Scenario D: "I'm a paying Pro user"
```sql
-- First, create a subscription in billing.subscriptions
-- Then check entitlements
SELECT * FROM public.current_entitlements WHERE user_id = '[user-id]';
```
✅ Should show `current_plan = 'pro'`, `entitlement_source = 'subscription'`

---

## 🔍 Verification Queries

### Check current plan:
```sql
SELECT 
  p.email,
  ce.current_plan,
  ce.entitlement_source,
  p.trial_used,
  p.trial_ends_at,
  CASE 
    WHEN p.trial_ends_at > now() THEN 'Active'
    WHEN p.trial_ends_at <= now() THEN 'Expired'
    ELSE 'Never Started'
  END as trial_status
FROM profiles p
LEFT JOIN public.current_entitlements ce ON ce.user_id = p.id
WHERE p.email = 'your-test-email@test.com';
```

### Check all trial users:
```sql
SELECT 
  email,
  trial_used,
  trial_started_at,
  trial_ends_at,
  CASE 
    WHEN trial_ends_at > now() THEN 'Active Trial'
    WHEN trial_ends_at <= now() THEN 'Expired Trial'
    WHEN trial_used = false THEN 'Unused Trial'
    ELSE 'No Trial'
  END as status
FROM profiles
WHERE trial_used = true OR trial_started_at IS NOT NULL
ORDER BY trial_ends_at DESC;
```

---

## 🐛 Troubleshooting

### Issue: Changes not reflecting in UI
**Solution:**
1. Clear browser cache
2. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
3. Check React Query cache (5 min stale time)
4. Log out and log back in

### Issue: Still seeing trial badge after expiration
**Solution:**
1. Verify database change:
```sql
SELECT trial_ends_at, now(), trial_ends_at > now() as is_active 
FROM profiles 
WHERE email = 'test@test.com';
```
2. Check `current_entitlements` view:
```sql
SELECT * FROM public.current_entitlements WHERE user_id = '[user-id]';
```
3. If view is correct but UI isn't, clear React Query cache

### Issue: Can't access Pro features during trial
**Solution:**
1. Check entitlements API: Visit `/api/me/plan` in browser
2. Should show `plan: "pro"` and `entitlement_source: "trial"`
3. If not, check database dates are correct
4. Verify `trial_ends_at` is in the future

---

## 📝 Testing Checklist

Before going to production, test:

- [ ] New user signup → Trial auto-activates
- [ ] Trial user has Pro access
- [ ] Trial badge shows in UI
- [ ] Trial end date shows in billing settings
- [ ] Expired trial → Loses Pro access
- [ ] Expired trial → Sees "Upgrade" (no trial option)
- [ ] Trial user can upgrade to paid
- [ ] Paid user shows "Pro" badge (not "Trial")
- [ ] Canceled subscription → Shows cancellation notice
- [ ] User with unused trial can activate it

---

## 💡 Pro Tips

1. **Use multiple test accounts** - One for each scenario
2. **Test in incognito** - Avoids cache issues
3. **Keep SQL snippets handy** - Faster testing
4. **Check both UI and database** - Ensure consistency
5. **Test mobile too** - Auth gates, badges, etc.

---

## 🔄 Reset to Clean State

```sql
-- Reset user to brand new state
UPDATE profiles 
SET 
  trial_used = false,
  trial_started_at = null,
  trial_ends_at = null
WHERE email = 'your-test-email@test.com';

-- Delete any test subscriptions
DELETE FROM billing.subscriptions 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'your-test-email@test.com');

-- Delete any test invoices
DELETE FROM billing.invoices 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'your-test-email@test.com');
```

Now you can test the full flow from scratch!

