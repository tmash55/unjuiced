import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'
import { createCheckout } from '@/libs/stripe'
import Stripe from 'stripe'

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const priceId = sp.get('priceId')
  const mode = (sp.get('mode') || 'subscription') as 'payment' | 'subscription'
  const couponId = sp.get('couponId')
  const trialDaysParam = sp.get('trialDays')
  const requestedTrialDays = trialDaysParam ? Number(trialDaysParam) : undefined
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''

  console.log('[billing/start] Request received', { priceId, mode })

  try {
    // Check authentication directly instead of making HTTP call
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[billing/start] Auth error:', authError)
      return NextResponse.redirect(`${origin}/login?redirectTo=${encodeURIComponent(req.url)}`)
    }

    if (!user) {
      console.error('[billing/start] No user found - redirecting to login')
      return NextResponse.redirect(`${origin}/login?redirectTo=${encodeURIComponent(req.url)}`)
    }

    console.log('[billing/start] User authenticated:', user.id)

    if (!priceId) {
      console.error('[billing/start] Missing priceId')
      return NextResponse.redirect(`${origin}/pricing`)
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
    if (!stripeCustomerId) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2023-08-16' as any,
          typescript: true,
        })
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
        console.warn('[billing/start] Failed to create Stripe customer:', (err as any)?.message)
      }
    }

    const successUrl = `${origin}/account/settings?billing=success`
    const cancelUrl = `${origin}/account/settings?billing=cancelled`

    console.log('[billing/start] Creating checkout session')
    const url = await createCheckout({
      user: { customerId: stripeCustomerId, email: user.email ?? undefined },
      mode,
      clientReferenceId: user.id,
      successUrl,
      cancelUrl,
      priceId,
      couponId: couponId || undefined,
      trialDays,
      paymentMethodCollection: typeof trialDays === 'number' ? 'always' : 'if_required',
    })

    if (!url) {
      console.error('[billing/start] Failed to create checkout')
      return NextResponse.redirect(`${origin}/pricing`)
    }

    console.log('[billing/start] Redirecting to Stripe checkout')
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('[billing/start] Error:', error)
    return NextResponse.redirect(`${origin}/pricing`)
  }
}


