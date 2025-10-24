import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
  typescript: true,
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

function getServiceClient() {
  return new SupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  console.log('[webhook] Received webhook request')
  
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')
  
  if (!signature) {
    console.error('[webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    console.log('[webhook] Event verified:', event.type)
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err?.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
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
        const current_period_start = new Date((sub as any).current_period_start * 1000).toISOString()
        const current_period_end = new Date((sub as any).current_period_end * 1000).toISOString()
        const cancel_at_period_end = !!(sub as any).cancel_at_period_end
        const canceled_at = (sub as any).canceled_at ? new Date((sub as any).canceled_at * 1000).toISOString() : null

        const { data, error } = await supabase
          .schema('billing')
          .from('subscriptions')
          .upsert({
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
        
        if (error) {
          console.error('[webhook] Failed to upsert subscription:', error)
        } else {
          console.log('[webhook] Successfully upserted subscription for user:', user_id)
        }

        // Also persist the Stripe customer id on the profile for easy joins from invoice events
        try {
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: String(sub.customer) })
            .eq('id', user_id)
        } catch (e) {
          console.warn('[webhook] Failed to update profiles.stripe_customer_id', e)
        }
        break
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Store a reference for later lookup (optional)
        try {
          await getServiceClient()
            .schema('billing')
            .from('invoices')
            .insert({
            user_id: (session.client_reference_id as string) || null,
            stripe_invoice_id: session.invoice as string,
            amount_due: 0,
            amount_paid: 0,
            currency: session.currency || 'usd',
            status: 'open',
            hosted_invoice_url: null,
          })
        } catch {}

        // Best-effort: store stripe_customer_id on profile from session
        try {
          if (session.customer && session.client_reference_id) {
            await getServiceClient()
              .from('profiles')
              .update({ stripe_customer_id: String(session.customer) })
              .eq('id', session.client_reference_id as string)
          }
        } catch {}
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice
        // Resolve the application user id from the Stripe customer id on the profile
        let user_id: string | null = null
        const customerId = inv.customer ? String(inv.customer) : null
        if (customerId) {
          const { data: profile } = await getServiceClient()
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          user_id = profile?.id ?? null
        }

        // Fallback: try to resolve via subscriptions table by stripe_customer_id
        if (!user_id && customerId) {
          const { data: subLookup } = await getServiceClient()
            .schema('billing')
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          user_id = subLookup?.user_id ?? null
        }

        if (!user_id) {
          console.warn('[webhook] Skipping invoice upsert; could not resolve user_id for customer', customerId)
          break
        }

        const { error: invError } = await getServiceClient()
          .schema('billing')
          .from('invoices')
          .upsert({
          user_id,
          stripe_invoice_id: inv.id,
          amount_due: inv.amount_due,
          amount_paid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          hosted_invoice_url: (inv.hosted_invoice_url as string) ?? null,
          created_at: new Date(inv.created * 1000).toISOString(),
        }, { onConflict: 'stripe_invoice_id' })

        if (invError) {
          console.error('[webhook] Failed to upsert invoice:', invError)
        } else {
          console.log('[webhook] Upserted invoice', inv.id, 'for user', user_id)
        }
        break
      }
      default:
        // Unhandled event type
        console.log('[webhook] Unhandled event type:', event.type)
        break
    }
  } catch (e: any) {
    console.error('[webhook] Error processing webhook:', e?.message)
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}


