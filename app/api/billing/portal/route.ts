export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'
import { createCustomerPortal } from '@/libs/stripe'

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

    if (error || !sub?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Make a purchase first.' },
        { status: 400 }
      )
    }

    const stripePortalUrl = await createCustomerPortal({
      customerId: sub.stripe_customer_id,
      returnUrl,
    })

    return NextResponse.json({ url: stripePortalUrl })
  } catch (e: any) {
    console.error('[billing/portal] error', e)
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 })
  }
}


