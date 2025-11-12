export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'
import { createCustomerPortal } from '@/libs/stripe'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to view billing information.' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const returnUrl = body.returnUrl

    if (!returnUrl) {
      return NextResponse.json(
        { error: 'Return URL is required' },
        { status: 400 }
      )
    }

    // Look up the user's Stripe customer id from latest subscription
    const { data: sub, error } = await supabase
      .schema('billing')
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fallback to profiles.stripe_customer_id
    let stripeCustomerId = sub?.stripe_customer_id as string | undefined
    if (!stripeCustomerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, email')
        .eq('id', user.id)
        .maybeSingle()
      stripeCustomerId = profile?.stripe_customer_id || undefined
    }

    // If still missing, create a customer now and persist
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
      } catch (e: any) {
        console.error('[billing/portal] failed to create customer:', e?.message)
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'no_customer', message: 'No billing account found. Please start a subscription first.' },
        { status: 400 }
      )
    }

    // Try to create the portal session; if customer is invalid in Stripe (e.g., stale id), recreate and retry
    let stripePortalUrl: string
    try {
      stripePortalUrl = await createCustomerPortal({
        customerId: stripeCustomerId,
        returnUrl,
      })
    } catch (e: any) {
      const msg: string = e?.message || ''
      const isMissing = /No such customer/i.test(msg) || /resource_missing/i.test(msg)
      if (!isMissing) {
        throw e
      }
      // Recreate customer and update profile, then retry
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-08-16' as any,
        typescript: true,
      })
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id, note: 'recreated from portal due to missing customer' },
      })
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', user.id)
      stripePortalUrl = await createCustomerPortal({
        customerId: customer.id,
        returnUrl,
      })
    }

    return NextResponse.json({ url: stripePortalUrl })
  } catch (e: any) {
    console.error('[billing/portal] error', e)
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 })
  }
}


