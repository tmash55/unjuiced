export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createService } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
  typescript: true,
})

function getServiceClient() {
  return createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'missing_signature' }, { status: 400 })

  const buf = Buffer.from(await req.arrayBuffer())
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[stripe] signature verification failed', err?.message)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  try {
    const supabase = getServiceClient()

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id || sub.metadata?.userId || undefined
        // Try to resolve user from client_reference_id via checkout session if needed
        let user_id = userId
        if (!user_id && sub.latest_invoice && typeof sub.latest_invoice === 'string') {
          try {
            const inv = await stripe.invoices.retrieve(sub.latest_invoice, {
              expand: ['payment_intent']
            })
            const sessionId = inv.metadata?.checkout_session_id as string | undefined
            if (sessionId) {
              const session = await stripe.checkout.sessions.retrieve(sessionId)
              user_id = (session.client_reference_id as string) || undefined
            }
          } catch {}
        }

        if (!user_id) {
          // Best effort: do not fail webhook
          console.warn('[stripe] missing user id on subscription event')
          break
        }

        const normalizedStatus = sub.status
        const current_period_start = new Date(sub.current_period_start * 1000).toISOString()
        const current_period_end = new Date(sub.current_period_end * 1000).toISOString()
        const cancel_at_period_end = !!sub.cancel_at_period_end
        const canceled_at = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null

        await supabase.from('billing.subscriptions').upsert({
          user_id,
          stripe_customer_id: String(sub.customer),
          stripe_subscription_id: sub.id,
          price_id: typeof sub.items.data[0]?.price?.id === 'string' ? sub.items.data[0].price.id : '',
          status: normalizedStatus,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          canceled_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' })
        break
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Store a reference for later lookup (optional)
        try {
          await getServiceClient().from('billing.invoices').insert({
            user_id: (session.client_reference_id as string) || null,
            stripe_invoice_id: session.invoice as string,
            amount_due: 0,
            amount_paid: 0,
            currency: session.currency || 'usd',
            status: 'open',
            hosted_invoice_url: null,
            invoice_pdf: null,
          })
        } catch {}
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice
        const user_id = (inv.customer_email as string) || (inv.customer as string) || null
        await getServiceClient().from('billing.invoices').upsert({
          user_id,
          stripe_invoice_id: inv.id,
          amount_due: inv.amount_due,
          amount_paid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf: inv.invoice_pdf,
          created_at: new Date(inv.created * 1000).toISOString(),
        }, { onConflict: 'stripe_invoice_id' })
        break
      }
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('[stripe] webhook handler error', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}


