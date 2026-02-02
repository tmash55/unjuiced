import { createClient } from '@/libs/supabase/server'
import { dub } from '@/libs/dub'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { waitUntil } from '@vercel/functions'
import Stripe from 'stripe'
import { syncNewSignupToBrevo } from '@/libs/brevo'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, fullName, avatarUrl, createdAt } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const supabase = await createClient()
    const cookieStore = await cookies()

    // Check if user was created in the last 10 minutes (new sign up)
    const isNewUser = createdAt 
      ? new Date(createdAt) > new Date(Date.now() - 10 * 60 * 1000)
      : false

    console.log('📊 Post-signup processing:', { userId, email, isNewUser })

    // ═══════════════════════════════════════════════════════════════════
    // DUB LEAD TRACKING - Track new sign ups from referral links
    // ═══════════════════════════════════════════════════════════════════
    const dub_id = cookieStore.get('dub_id')?.value

    if (dub_id && isNewUser) {
      if (process.env.DUB_API_KEY) {
        console.log('📊 Tracking Dub lead event for new user:', userId)

        waitUntil(
          dub.track.lead({
            clickId: dub_id,
            eventName: 'Sign Up',
            customerExternalId: userId,
            customerName: fullName || undefined,
            customerEmail: email || undefined,
            customerAvatar: avatarUrl || undefined,
          }).then(() => {
            console.log('✅ Dub lead event tracked successfully')
          }).catch((err) => {
            console.error('❌ Failed to track Dub lead event:', err)
          })
        )
      }

      // Delete the dub_id cookie after tracking
      cookieStore.delete('dub_id')
    }

    // ═══════════════════════════════════════════════════════════════════
    // STRIPE CUSTOMER - Ensure a Stripe customer exists
    // ═══════════════════════════════════════════════════════════════════
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .maybeSingle()

      if (!profile?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2023-08-16' as any,
          typescript: true,
        })
        const customer = await stripe.customers.create({
          email: email || undefined,
          metadata: { user_id: userId },
        })
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customer.id })
          .eq('id', userId)
        console.log('✅ Created Stripe customer for user', userId)
      }
    } catch (e) {
      console.warn('⚠️ Could not ensure Stripe customer:', (e as any)?.message)
    }

    // ═══════════════════════════════════════════════════════════════════
    // BREVO SYNC - Track new sign ups as leads in Brevo
    // ═══════════════════════════════════════════════════════════════════
    if (isNewUser && email) {
      console.log('📧 Syncing new user to Brevo as lead:', userId)

      waitUntil(
        syncNewSignupToBrevo({
          email,
          firstName: fullName?.split(' ')[0] || undefined,
          lastName: fullName?.split(' ').slice(1).join(' ') || undefined,
          newsletterOptIn: true,
          source: 'app_signup',
        }).then((success) => {
          if (success) {
            console.log('✅ Brevo lead sync successful for user', userId)
          } else {
            console.warn('⚠️ Brevo lead sync failed for user', userId)
          }
        }).catch((err) => {
          console.error('❌ Brevo lead sync error:', err)
        })
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Post-signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
