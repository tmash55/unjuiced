export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'
import { createCheckout } from '@/libs/stripe'
import { getPartnerDiscountFromCookie } from '@/lib/partner-coupon'
import { getRedirectUrl } from '@/lib/domain'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    console.log('[billing/checkout] Request received')
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('[billing/checkout] Auth error:', authError)
    }
    
    if (!user) {
      console.error('[billing/checkout] No user found - unauthorized')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    
    console.log('[billing/checkout] User authenticated:', user.id)

    const body = await req.json().catch(() => ({}))
    const priceId = String(body?.priceId || '')
    const mode = (body?.mode === 'payment' ? 'payment' : 'subscription') as 'payment' | 'subscription'
    const requestedTrialDays: number | undefined = typeof body?.trialDays === 'number' ? body.trialDays : undefined

    if (!priceId) {
      return NextResponse.json({ error: 'missing_price_id' }, { status: 400 })
    }

    // Check for partner discount from Dub referral link
    const cookieHeader = req.headers.get('cookie')
    const partnerDiscount = getPartnerDiscountFromCookie(cookieHeader)
    
    if (partnerDiscount.couponId || partnerDiscount.promotionCodeId) {
      console.log('[billing/checkout] Partner discount found:', {
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
    
    let isYearlyPlan = false
    try {
      const price = await stripe.prices.retrieve(priceId)
      const billingInterval = price.metadata?.billing_interval
      isYearlyPlan = billingInterval === 'yearly'
      
      if (isYearlyPlan) {
        console.log('[billing/checkout] Yearly plan - promo codes disabled')
      }
    } catch (priceError) {
      console.warn('[billing/checkout] Could not retrieve price metadata:', priceError)
    }

    // Try to reuse existing Stripe customer id if present in latest subscription
    let stripeCustomerId: string | undefined
    {
      const { data: sub } = await supabase
        .schema('billing')
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      stripeCustomerId = sub?.stripe_customer_id || undefined
    }
    // Fallback to profiles.stripe_customer_id if no subscription yet, and read trial_used
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
      // Even if we had a customer id from subscriptions, still fetch trial_used for gating trials
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_used')
        .eq('id', user.id)
        .maybeSingle()
      profileTrialUsed = profile?.trial_used ?? undefined
    }
    // If still missing, create a Stripe customer now and persist it for this user
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
      } catch (err) {
        console.warn('[billing/checkout] Failed to create Stripe customer:', (err as any)?.message)
      }
    }

    // Gate trials: only allow trial if profile.trial_used === false
    const allowTrial = profileTrialUsed === false
    const trialDays = allowTrial ? requestedTrialDays : undefined

    // Use app subdomain for Stripe success/cancel URLs (e.g. https://app.unjuiced.bet)
    const { host } = new URL(req.url)
    const successUrl = `${getRedirectUrl(host, '/account/settings', 'app')}?billing=success`
    const cancelUrl = `${getRedirectUrl(host, '/account/settings', 'app')}?billing=cancelled`

    // Determine discount to apply:
    // - Yearly plans: no discounts
    // - Partner referral: auto-apply coupon/promo code
    // - Otherwise: show promo code input
    const shouldAutoApplyDiscount = !isYearlyPlan && (partnerDiscount.promotionCodeId || partnerDiscount.couponId)
    
    const url = await createCheckout({
      user: { customerId: stripeCustomerId, email: user.email ?? undefined },
      mode,
      clientReferenceId: user.id,
      successUrl,
      cancelUrl,
      priceId,
      trialDays,
      paymentMethodCollection: trialDays ? 'always' : 'if_required',
      // If auto-applying discount, don't show promo code input (Stripe doesn't allow both)
      // If no discount to auto-apply, show promo code input (except yearly plans)
      allowPromotionCodes: !isYearlyPlan && !shouldAutoApplyDiscount,
      // Auto-apply partner discount if available
      couponId: shouldAutoApplyDiscount ? (partnerDiscount.couponId ?? undefined) : undefined,
      promotionCodeId: shouldAutoApplyDiscount ? (partnerDiscount.promotionCodeId ?? undefined) : undefined,
    })

    if (!url) {
      return NextResponse.json({ error: 'failed_to_create_checkout' }, { status: 500 })
    }

    return NextResponse.json({ url })
  } catch (error) {
    console.error('[billing/checkout] error', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
