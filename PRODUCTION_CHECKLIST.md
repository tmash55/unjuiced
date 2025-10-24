# Production Deployment Checklist - Stripe & Billing

## 🔴 Critical - Must Do Before Launch

### 1. **Stripe Product Setup**
- [ ] Create "Unjuiced Pro" product in Stripe Production
- [ ] Create Monthly price ($30/month)
- [ ] Create Yearly price ($300/year)
- [ ] Copy both Price IDs for environment variables
- [ ] Verify pricing is correct in Stripe dashboard

### 2. **Stripe API Keys**
- [ ] Get Production Publishable Key (`pk_live_...`)
- [ ] Get Production Secret Key (`sk_live_...`)
- [ ] Update in Vercel environment variables:
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_STRIPE_KEY`

### 3. **Stripe Webhook Configuration**
- [ ] Create webhook endpoint in Stripe Production
- [ ] Set endpoint URL: `https://unjuiced.bet/api/billing/webhook`
- [ ] Select these events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `invoice.created`
  - `invoice.finalized`
- [ ] Copy Webhook Signing Secret (`whsec_...`)
- [ ] Update in Vercel: `STRIPE_WEBHOOK_SECRET`

### 4. **Environment Variables**
Update in Vercel Production:
```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_YEARLY=price_...

# Site URL
NEXT_PUBLIC_SITE_URL=https://unjuiced.bet
```

### 5. **Stripe Customer Portal**
- [ ] Enable Customer Portal in Stripe Production
- [ ] Configure portal settings:
  - ✅ Allow customers to update payment methods
  - ✅ Allow customers to view invoices
  - ✅ Allow customers to cancel subscriptions
  - ✅ Allow customers to update billing information
- [ ] Set business information (name, logo, support email)
- [ ] Configure cancellation behavior (immediate vs. end of period)

### 6. **Database Schema**
- [ ] Verify `billing.subscriptions` table exists in production
- [ ] Verify `billing.invoices` table exists in production
- [ ] Verify `profiles.stripe_customer_id` column exists
- [ ] Verify `profiles.trial_used`, `trial_started_at`, `trial_ends_at` columns exist
- [ ] Verify `public.current_entitlements` view exists
- [ ] Run this query to confirm view works:
```sql
SELECT * FROM public.current_entitlements LIMIT 5;
```

### 7. **Supabase Configuration**
- [ ] Verify `billing` schema is exposed in PostgREST API
- [ ] Verify RLS policies are set on `billing.subscriptions`:
  - Users can SELECT their own subscriptions
  - Service role has full access
- [ ] Grant permissions to service role:
```sql
GRANT USAGE ON SCHEMA billing TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA billing TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA billing TO service_role;
```

### 8. **Email Configuration (Resend)**
- [ ] Verify `RESEND_API_KEY` is set in production
- [ ] Test email sending works (optional: send test email)

---

## 🟡 Important - Should Do

### 9. **Testing in Production**
- [ ] Create a test subscription with a real card
- [ ] Verify subscription appears in `billing.subscriptions`
- [ ] Verify `current_entitlements` view shows "pro"
- [ ] Test accessing Pro features (arbitrage table, live updates)
- [ ] Test Customer Portal access
- [ ] Test subscription cancellation flow
- [ ] Test webhook events are received (check Vercel logs)
- [ ] Verify invoices are created in `billing.invoices`

### 10. **Trial Flow Testing**
- [ ] Sign up as new user
- [ ] Verify trial is auto-activated
- [ ] Verify `trial_ends_at` is set to 7 days from now
- [ ] Verify Pro features are accessible
- [ ] Test trial expiration (manually set `trial_ends_at` to past)
- [ ] Verify user becomes "free" after trial expires

### 11. **Error Monitoring**
- [ ] Set up Sentry or similar for error tracking (optional)
- [ ] Monitor Vercel logs for webhook errors
- [ ] Monitor Stripe dashboard for failed payments
- [ ] Set up alerts for critical errors

### 12. **Legal & Compliance**
- [ ] Verify Terms of Service mentions subscription terms
- [ ] Verify Privacy Policy mentions Stripe data processing
- [ ] Add refund policy (if applicable)
- [ ] Verify "entertainment purposes only" disclaimers are prominent

---

## 🟢 Nice to Have - Post-Launch

### 13. **Analytics & Monitoring**
- [ ] Track conversion rate (trial → paid)
- [ ] Monitor churn rate
- [ ] Track MRR (Monthly Recurring Revenue)
- [ ] Set up Stripe Revenue Recognition (if needed)

### 14. **Customer Communication**
- [ ] Set up trial expiration email (3 days before, 1 day before)
- [ ] Set up payment failed email
- [ ] Set up subscription canceled email
- [ ] Set up welcome email for new Pro users

### 15. **Additional Features**
- [ ] Add promo codes/coupons support
- [ ] Add referral program (optional)
- [ ] Add annual plan discount campaigns
- [ ] Add usage-based billing (if applicable)

---

## 🔍 Pre-Launch Verification Checklist

### Critical Path Test:
1. **New User Sign Up**
   - [ ] Sign up → Trial auto-activates → Can access Pro features
   
2. **Trial to Paid Conversion**
   - [ ] Click "Upgrade to Pro" → Stripe Checkout → Payment succeeds → Becomes Pro subscriber
   
3. **Existing User (No Trial)**
   - [ ] User with `trial_used = true` → Sees "Upgrade to Pro" only → Can purchase
   
4. **Subscription Management**
   - [ ] Pro user → Settings → Billing → "Manage Subscription" → Customer Portal → Can cancel
   
5. **Webhook Flow**
   - [ ] Payment succeeds → Webhook fires → Database updates → User gets Pro access
   
6. **Cancellation Flow**
   - [ ] User cancels → Webhook fires → `cancel_at_period_end = true` → UI shows "Canceling" badge

---

## 🚨 Common Gotchas

### Webhook Issues:
- ✅ Webhook URL must be HTTPS (not HTTP)
- ✅ Webhook secret must match exactly (no extra spaces)
- ✅ Webhook must be in "Production" mode in Stripe
- ✅ Vercel function timeout is 10s (should be enough for webhooks)

### Environment Variables:
- ✅ Redeploy after updating environment variables
- ✅ Verify variables are set in "Production" environment (not Preview)
- ✅ Check for typos in variable names

### Database:
- ✅ RLS policies must allow service role to write to `billing` tables
- ✅ `billing` schema must be exposed in Supabase API settings
- ✅ `stripe_customer_id` must be populated for portal to work

### Customer Portal:
- ✅ Must be enabled in Stripe Production (separate from Test mode)
- ✅ Business information must be filled out
- ✅ Return URL must be set correctly

---

## 📋 Quick Reference

### Stripe Dashboard URLs:
- **Products**: https://dashboard.stripe.com/products
- **Webhooks**: https://dashboard.stripe.com/webhooks
- **Customer Portal**: https://dashboard.stripe.com/settings/billing/portal
- **API Keys**: https://dashboard.stripe.com/apikeys

### Vercel URLs:
- **Environment Variables**: https://vercel.com/[your-team]/[project]/settings/environment-variables
- **Logs**: https://vercel.com/[your-team]/[project]/logs

### Database Queries:

**Check entitlements:**
```sql
SELECT * FROM public.current_entitlements WHERE user_id = '[user_id]';
```

**Check subscriptions:**
```sql
SELECT * FROM billing.subscriptions WHERE user_id = '[user_id]';
```

**Check trial status:**
```sql
SELECT id, email, trial_used, trial_started_at, trial_ends_at 
FROM profiles 
WHERE id = '[user_id]';
```

---

## ✅ Final Go-Live Checklist

Before flipping the switch:
- [ ] All environment variables set in Vercel Production
- [ ] Stripe webhook configured and tested
- [ ] Database schema verified in production
- [ ] Test subscription created and working
- [ ] Customer Portal accessible
- [ ] Trial flow tested end-to-end
- [ ] Webhook events logging correctly
- [ ] Error monitoring in place
- [ ] Legal pages updated
- [ ] Team trained on support flow

---

## 🆘 Rollback Plan

If something goes wrong:
1. **Disable new signups** (add feature flag)
2. **Pause Stripe webhook** (disable in Stripe dashboard)
3. **Revert environment variables** to test mode
4. **Investigate logs** in Vercel and Stripe
5. **Fix issue** in staging
6. **Re-test** thoroughly
7. **Re-enable** when confident

---

## 📞 Support Contacts

- **Stripe Support**: https://support.stripe.com/
- **Supabase Support**: https://supabase.com/support
- **Vercel Support**: https://vercel.com/support

---

**Last Updated**: [Date]  
**Completed By**: [Name]  
**Production Launch Date**: [Date]

