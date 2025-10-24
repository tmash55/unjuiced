export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'
import { createCheckout } from '@/libs/stripe'

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
    const couponId: string | null = body?.couponId ?? null

    if (!priceId) {
      return NextResponse.json({ error: 'missing_price_id' }, { status: 400 })
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

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
    const successUrl = `${origin}/account/settings?billing=success`
    const cancelUrl = `${origin}/account/settings?billing=cancelled`

    const url = await createCheckout({
      user: { customerId: stripeCustomerId, email: user.email ?? undefined },
      mode,
      clientReferenceId: user.id,
      successUrl,
      cancelUrl,
      priceId,
      couponId: couponId || undefined,
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


