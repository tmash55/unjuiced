import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { syncSubscriptionToBeeHiiv, getPlanFromPriceId } from '@/libs/beehiiv'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16' as any,
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

        // Fallback: resolve by Stripe customer id via profiles.stripe_customer_id
        if (!user_id && sub.customer) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('stripe_customer_id', String(sub.customer))
              .maybeSingle()
            user_id = profile?.id || undefined
          } catch {}
        }

        if (!user_id) {
          // Best effort: do not fail webhook
          console.warn('[stripe] missing user id on subscription event')
          break
        }

        const normalizedStatus = sub.status
        // Robustly derive period timestamps (top-level or from first item)
        const firstItem: any = (sub as any)?.items?.data?.[0] || null
        const cpsEpoch = (sub as any)?.current_period_start ?? firstItem?.current_period_start ?? (sub as any)?.start_date
        const cpeEpoch = (sub as any)?.current_period_end ?? firstItem?.current_period_end ?? null
        if (!cpsEpoch || !cpeEpoch) {
          console.warn('[webhook] Subscription event missing period dates; skipping upsert for subscription', sub.id)
          break
        }
        const current_period_start = new Date(Number(cpsEpoch) * 1000).toISOString()
        const current_period_end = new Date(Number(cpeEpoch) * 1000).toISOString()
        const cancel_at_period_end = !!(sub as any).cancel_at_period_end
        const canceled_at = (sub as any).canceled_at ? new Date(Number((sub as any).canceled_at) * 1000).toISOString() : null

        const { data, error } = await supabase
          .schema('billing')
          .from('subscriptions')
          .upsert({
          user_id,
          stripe_customer_id: String(sub.customer),
          stripe_subscription_id: sub.id,
          price_id: typeof (sub as any)?.items?.data?.[0]?.price?.id === 'string' ? (sub as any).items.data[0].price.id : '',
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

        // If the subscription includes a trial, persist trial metadata on the profile
        try {
          const trialStartEpoch = (sub as any)?.trial_start ?? null
          const trialEndEpoch = (sub as any)?.trial_end ?? null
          const profileUpdates: Record<string, any> = {}
          if (normalizedStatus === 'trialing') {
            profileUpdates.trial_used = true
          }
          if (typeof trialStartEpoch === 'number') {
            profileUpdates.trial_started_at = new Date(Number(trialStartEpoch) * 1000).toISOString()
          }
          if (typeof trialEndEpoch === 'number') {
            profileUpdates.trial_ends_at = new Date(Number(trialEndEpoch) * 1000).toISOString()
          }
          if (Object.keys(profileUpdates).length > 0) {
            await supabase
              .from('profiles')
              .update(profileUpdates)
              .eq('id', user_id)
            console.log('[webhook] Updated profile trial fields for user', user_id, profileUpdates)
          }
        } catch (e) {
          console.warn('[webhook] Failed to update profile trial fields', (e as any)?.message)
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
        
        // ═══════════════════════════════════════════════════════════════════
        // BEEHIIV SYNC - Update contact lifecycle based on subscription status
        // ═══════════════════════════════════════════════════════════════════
        const priceId = typeof (sub as any)?.items?.data?.[0]?.price?.id === 'string'
          ? (sub as any).items.data[0].price.id
          : undefined

        // Sync to BeeHiiv for all subscriptions (will map price to plan)
        try {
          // Get customer email and name for BeeHiiv sync
          let customerEmail: string | undefined
          let firstName: string | undefined
          let lastName: string | undefined

          // First try to get email from our profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', user_id)
            .maybeSingle()

          customerEmail = profileData?.email || undefined
          firstName = profileData?.first_name || undefined
          lastName = profileData?.last_name || undefined

          // Fallback: fetch from Stripe customer
          if (!customerEmail && sub.customer) {
            try {
              const customer = await stripe.customers.retrieve(String(sub.customer))
              if (customer && !customer.deleted && 'email' in customer) {
                customerEmail = customer.email || undefined
              }
            } catch (e) {
              console.warn('[webhook] Failed to fetch customer email from Stripe:', (e as any)?.message)
            }
          }

          if (customerEmail) {
            const beehiivSuccess = await syncSubscriptionToBeeHiiv({
              email: customerEmail,
              priceId,
              status: normalizedStatus,
              cancelAtPeriodEnd: cancel_at_period_end,
              currentPeriodEnd: cpeEpoch,
              trialEnd: (sub as any)?.trial_end ?? undefined,
              firstName,
              lastName,
            })

            if (beehiivSuccess) {
              console.log('[webhook] BeeHiiv sync successful for subscription', sub.id)
            } else {
              console.warn('[webhook] BeeHiiv sync failed for subscription', sub.id)
            }
          } else {
            console.warn('[webhook] No email found for BeeHiiv sync, subscription:', sub.id)
          }
        } catch (e) {
          // Don't fail the webhook for BeeHiiv errors
          console.error('[webhook] BeeHiiv sync error:', (e as any)?.message)
        }
        
        break
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Do not insert invoice placeholders here; rely on invoice.* events for accurate amounts/status

        // Best-effort: store stripe_customer_id on profile from session
        try {
          if (session.customer && session.client_reference_id) {
            await getServiceClient()
              .from('profiles')
              .update({ stripe_customer_id: String(session.customer) })
              .eq('id', session.client_reference_id as string)
          }
        } catch {}

        // Also upsert subscription immediately if present on the session
        try {
          if (session.subscription && session.client_reference_id) {
            const s = await stripe.subscriptions.retrieve(session.subscription as string)
            const subUserId = session.client_reference_id as string
            const normalizedStatus = s.status
            const cpsRaw = (s as any)?.current_period_start
            const cpeRaw = (s as any)?.current_period_end
            if (!cpsRaw || !cpeRaw) {
              console.warn('[webhook] Subscription from checkout.session missing period dates; skipping upsert')
            } else {
              const current_period_start = new Date(Number(cpsRaw) * 1000).toISOString()
              const current_period_end = new Date(Number(cpeRaw) * 1000).toISOString()
              const cancel_at_period_end = !!(s as any).cancel_at_period_end
              const canceled_at = (s as any).canceled_at ? new Date(Number((s as any).canceled_at) * 1000).toISOString() : null
              const priceId = typeof s.items.data[0]?.price?.id === 'string' ? s.items.data[0].price.id : ''
              
              await getServiceClient()
                .schema('billing')
                .from('subscriptions')
                .upsert({
                  user_id: subUserId,
                  stripe_customer_id: String(s.customer),
                  stripe_subscription_id: s.id,
                  price_id: priceId,
                  status: normalizedStatus,
                  current_period_start,
                  current_period_end,
                  cancel_at_period_end,
                  canceled_at,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'stripe_subscription_id' })
              console.log('[webhook] Upserted subscription from checkout.session for user', subUserId)
              
              // ═══════════════════════════════════════════════════════════════════
              // BEEHIIV SYNC - Update contact lifecycle from checkout completion
              // ═══════════════════════════════════════════════════════════════════
              try {
                // Get customer email and name - prefer session.customer_email, fallback to Stripe customer
                let customerEmail = session.customer_email || undefined
                let firstName: string | undefined
                let lastName: string | undefined

                if (!customerEmail) {
                  // Try profile
                  const { data: profileData } = await getServiceClient()
                    .from('profiles')
                    .select('email, first_name, last_name')
                    .eq('id', subUserId)
                    .maybeSingle()
                  customerEmail = profileData?.email || undefined
                  firstName = profileData?.first_name || undefined
                  lastName = profileData?.last_name || undefined
                }

                if (!customerEmail && s.customer) {
                  const customer = await stripe.customers.retrieve(String(s.customer))
                  if (customer && !customer.deleted && 'email' in customer) {
                    customerEmail = customer.email || undefined
                  }
                }

                if (customerEmail) {
                  const beehiivSuccess = await syncSubscriptionToBeeHiiv({
                    email: customerEmail,
                    priceId,
                    status: normalizedStatus,
                    cancelAtPeriodEnd: cancel_at_period_end,
                    currentPeriodEnd: cpeRaw,
                    trialEnd: (s as any)?.trial_end ?? undefined,
                    firstName,
                    lastName,
                  })

                  if (beehiivSuccess) {
                    console.log('[webhook] BeeHiiv sync successful from checkout.session')
                  } else {
                    console.warn('[webhook] BeeHiiv sync failed from checkout.session')
                  }
                }
              } catch (e) {
                console.error('[webhook] BeeHiiv sync error from checkout.session:', (e as any)?.message)
              }
            }
          }
        } catch (e) {
          console.warn('[webhook] Failed to upsert subscription from checkout.session', (e as any)?.message)
        }
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.finalized':
      case 'invoice.created': {
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


