export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'
import { createCustomerPortal } from '@/libs/stripe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: sub, error } = await supabase
      .from('billing.subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'no_customer' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
    const url = await createCustomerPortal({ customerId: sub.stripe_customer_id, returnUrl: `${origin}/account/settings` })
    return NextResponse.json({ url })
  } catch (e) {
    console.error('[billing/portal] error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}


