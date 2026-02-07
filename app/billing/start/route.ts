import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'
import { createCheckout } from '@/libs/stripe'
import { getPartnerDiscountFromCookie } from '@/lib/partner-coupon'
import { isAppSubdomain, getRedirectUrl } from '@/lib/domain'
import { isYearlyPriceId, ACTIVE_PROMO, isPromoActive } from '@/constants/billing'
import Stripe from 'stripe'

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const priceId = sp.get('priceId')
  const mode = (sp.get('mode') || 'subscription') as 'payment' | 'subscription'
  const trialDaysParam = sp.get('trialDays')
  const requestedTrialDays = trialDaysParam ? Number(trialDaysParam) : undefined
  // Use host to construct proper app subdomain URLs via getRedirectUrl
  const { host } = new URL(req.url)
  const fallbackPath = isAppSubdomain(host) ? '/plans' : '/pricing'

  console.log('[billing/start] Request received', { priceId, mode })

  try {
    // Check authentication directly instead of making HTTP call
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[billing/start] Auth error:', authError)
      return NextResponse.redirect(`${getRedirectUrl(host, '/login', 'app')}?redirectTo=${encodeURIComponent(req.url)}`)
    }

    if (!user) {
      console.error('[billing/start] No user found - redirecting to login')
      return NextResponse.redirect(`${getRedirectUrl(host, '/login', 'app')}?redirectTo=${encodeURIComponent(req.url)}`)
    }

    console.log('[billing/start] User authenticated:', user.id)

    if (!priceId) {
      console.error('[billing/start] Missing priceId')
      return NextResponse.redirect(getRedirectUrl(host, fallbackPath, 'app'))
    }

    // Safety net: block checkout if user already has an active subscription
    // This prevents accidental double subscriptions. Existing subscribers
    // should upgrade/downgrade through the Stripe Customer Portal instead.
    const { data: existingSub } = await supabase
      .schema('billing')
      .from('subscriptions')
      .select('id, status, stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .limit(1)
      .maybeSingle()

    if (existingSub) {
      console.warn('[billing/start] User already has active subscription, redirecting to portal', {
        subscriptionId: existingSub.stripe_subscription_id,
        status: existingSub.status,
      })
      return NextResponse.redirect(getRedirectUrl(host, '/account/settings/billing', 'app'))
    }

    // Check for partner discount from Dub referral link
    const cookieHeader = req.headers.get('cookie')
    const partnerDiscount = getPartnerDiscountFromCookie(cookieHeader)
    
    if (partnerDiscount.couponId || partnerDiscount.promotionCodeId) {
      console.log('[billing/start] Partner discount found:', {
        couponId: partnerDiscount.couponId,
        promotionCodeId: partnerDiscount.promotionCodeId,
        partnerName: partnerDiscount.partnerName,
      })
    }

    // Check if this is a yearly plan - if so, promo codes are not allowed
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-08-16' as any,
      typescript: true,
    })
    
    // Check if yearly via Stripe metadata first, fall back to known price IDs
    let isYearlyPlan = isYearlyPriceId(priceId)
    try {
      const price = await stripe.prices.retrieve(priceId)
      const billingInterval = price.metadata?.billing_interval
      if (billingInterval === 'yearly') {
        isYearlyPlan = true
      }
    } catch (priceError) {
      console.warn('[billing/start] Could not retrieve price metadata, using price ID fallback:', priceError)
    }
    
    if (isYearlyPlan) {
      console.log('[billing/start] Yearly plan detected - promo codes disabled')
    }

    // Try to reuse existing Stripe customer id if present
    let stripeCustomerId: string | undefined
    const { data: sub } = await supabase
      .schema('billing')
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    stripeCustomerId = sub?.stripe_customer_id || undefined
    let profileTrialUsed: boolean | undefined
    if (!stripeCustomerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, trial_used')
        .eq('id', user.id)
        .maybeSingle()
      stripeCustomerId = profile?.stripe_customer_id || undefined
      profileTrialUsed = profile?.trial_used ?? undefined
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_used')
        .eq('id', user.id)
        .maybeSingle()
      profileTrialUsed = profile?.trial_used ?? undefined
    }
    const allowTrial = profileTrialUsed === false
    const trialDays = allowTrial ? requestedTrialDays : undefined

    // Validate existing customer ID actually exists in Stripe
    // (handles test vs. live mode mismatch, deleted customers, etc.)
    if (stripeCustomerId) {
      try {
        await stripe.customers.retrieve(stripeCustomerId)
      } catch {
        console.warn('[billing/start] Stored customer ID invalid, will create new:', stripeCustomerId)
        stripeCustomerId = undefined
      }
    }

    if (!stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { user_id: user.id },
        })
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customer.id })
          .eq('id', user.id)
        stripeCustomerId = customer.id
        console.log('[billing/start] Created new Stripe customer:', customer.id)
      } catch (err) {
        console.warn('[billing/start] Failed to create Stripe customer:', (err as any)?.message)
      }
    }

    // Use app subdomain for redirects (e.g. https://app.unjuiced.bet/account/settings)
    const successUrl = getRedirectUrl(host, '/today', 'app')
    const cancelUrl = getRedirectUrl(host, '/today', 'app')

    // Determine discount to apply (priority order):
    // 1. Yearly plans: no discounts ever
    // 2. Active site-wide promo (e.g. Super Bowl 60): overrides partner discount
    // 3. Partner referral: auto-apply coupon/promo code
    // 4. No discount: show promo code input for manual entry
    
    const promoActive = isPromoActive() && !isYearlyPlan && (!ACTIVE_PROMO.monthlyOnly || !isYearlyPlan)
    const hasPartnerDiscount = !isYearlyPlan && (partnerDiscount.promotionCodeId || partnerDiscount.couponId)
    
    let autoPromotionCodeId: string | undefined
    let autoCouponId: string | undefined
    let allowPromoCodes = !isYearlyPlan
    
    if (promoActive) {
      // Site-wide promo takes priority over partner discount
      autoPromotionCodeId = ACTIVE_PROMO.promotionCodeId
      allowPromoCodes = false
      console.log('[billing/start] Applying site-wide promo:', ACTIVE_PROMO.name)
    } else if (hasPartnerDiscount) {
      // Partner discount as fallback
      autoPromotionCodeId = partnerDiscount.promotionCodeId ?? undefined
      autoCouponId = partnerDiscount.couponId ?? undefined
      allowPromoCodes = false
      console.log('[billing/start] Applying partner discount:', partnerDiscount.partnerName)
    }

    console.log('[billing/start] Creating checkout session', {
      isYearlyPlan,
      promoActive,
      hasPartnerDiscount,
      autoPromotionCodeId: autoPromotionCodeId ? '***' : undefined,
      allowPromoCodes,
    })
    const url = await createCheckout({
      user: { customerId: stripeCustomerId, email: user.email ?? undefined },
      mode,
      clientReferenceId: user.id,
      successUrl,
      cancelUrl,
      priceId,
      trialDays,
      paymentMethodCollection: typeof trialDays === 'number' ? 'always' : 'if_required',
      allowPromotionCodes: allowPromoCodes,
      couponId: autoCouponId,
      promotionCodeId: autoPromotionCodeId,
    })

    if (!url) {
      console.error('[billing/start] Failed to create checkout')
      return NextResponse.redirect(getRedirectUrl(host, fallbackPath, 'app'))
    }

    console.log('[billing/start] Redirecting to Stripe checkout')
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('[billing/start] Error:', error)
    return NextResponse.redirect(getRedirectUrl(host, fallbackPath, 'app'))
  }
}
