export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'
import { createCheckout } from '@/libs/stripe'
import Stripe from 'stripe'
import { getPartnerDiscountFromCookie } from '@/lib/partner-coupon'

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
    
    // Get discount from body or fallback to partner cookie
    const cookieHeader = req.headers.get('cookie')
    const partnerDiscount = getPartnerDiscountFromCookie(cookieHeader)
    
    // Prefer promotion code (shows code name in UI) over coupon (silent discount)
    let promotionCodeId: string | null = body?.promotionCodeId ?? partnerDiscount.promotionCodeId ?? null
    let couponId: string | null = body?.couponId ?? partnerDiscount.couponId ?? null
    
    if (partnerDiscount.promotionCodeId || partnerDiscount.couponId) {
      console.log('[billing/checkout] Using partner discount from cookie:', { 
        promotionCodeId: partnerDiscount.promotionCodeId,
        couponId: partnerDiscount.couponId 
      })
    }

    if (!priceId) {
      return NextResponse.json({ error: 'missing_price_id' }, { status: 400 })
    }

    // Check if this is a yearly plan - if so, coupons/promotion codes are not allowed
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-08-16' as any,
      typescript: true,
    })
    
    let isYearlyPlan = false
    try {
      const price = await stripe.prices.retrieve(priceId)
      const billingInterval = price.metadata?.billing_interval
      isYearlyPlan = billingInterval === 'yearly'
      
      if (isYearlyPlan && (couponId || promotionCodeId)) {
        console.log('[billing/checkout] Discount blocked for yearly plan:', { priceId, couponId, promotionCodeId })
        couponId = null
        promotionCodeId = null
      }
    } catch (priceError) {
      console.warn('[billing/checkout] Could not retrieve price metadata:', priceError)
      // Continue anyway - don't block checkout if price lookup fails
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

    // Always use absolute origin from the request URL for Stripe success/cancel URLs
    const { origin } = new URL(req.url)
    const successUrl = `${origin}/account/settings?billing=success`
    const cancelUrl = `${origin}/account/settings?billing=cancelled`

    const url = await createCheckout({
      user: { customerId: stripeCustomerId, email: user.email ?? undefined },
      mode,
      clientReferenceId: user.id,
      successUrl,
      cancelUrl,
      priceId,
      promotionCodeId: promotionCodeId || undefined,
      couponId: couponId || undefined,
      trialDays,
      paymentMethodCollection: trialDays ? 'always' : 'if_required',
      allowPromotionCodes: !isYearlyPlan, // Disable promo codes for yearly plans
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


