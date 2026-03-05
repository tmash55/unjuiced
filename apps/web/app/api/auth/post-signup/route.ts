import { createClient } from '@/libs/supabase/server'
import { dub } from '@/libs/dub'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { waitUntil } from '@vercel/functions'
import Stripe from 'stripe'
import { syncNewSignupToBeeHiiv } from '@/libs/beehiiv'
import { identifyCustomer, trackEvent } from '@/libs/customerio'
import { getPostHogClient } from '@/lib/posthog-server'

const SIGNUP_TRACKING_COOKIE = 'signup_tracked_v1'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      email,
      fullName,
      firstName: bodyFirstName,
      lastName: bodyLastName,
      avatarUrl,
      createdAt,
      signupMethod,
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // Extract first/last name - prefer explicit fields, fallback to parsing fullName
    const firstName = bodyFirstName || fullName?.split(' ')[0] || undefined
    const lastName = bodyLastName || fullName?.split(' ').slice(1).join(' ') || undefined

    const supabase = await createClient()
    const cookieStore = await cookies()

    const trackedUserId = cookieStore.get(SIGNUP_TRACKING_COOKIE)?.value
    const shouldTrackSignupOnce = trackedUserId !== userId

    console.log('📊 Post-signup processing:', {
      userId,
      email,
      firstName,
      lastName,
      createdAt,
      trackedUserId: trackedUserId || 'none',
      shouldTrackSignupOnce,
    })

    // ═══════════════════════════════════════════════════════════════════
    // POSTHOG SIGNUP EVENT - server-side fallback for callback flow
    // ═══════════════════════════════════════════════════════════════════
    if (shouldTrackSignupOnce) {
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        waitUntil(
          Promise.resolve()
            .then(() => {
              const posthog = getPostHogClient()
              posthog.capture({
                distinctId: userId,
                event: 'user_signed_up',
                properties: {
                  method: signupMethod || 'unknown',
                  email,
                  signup_source: 'website',
                },
              })
            })
            .then(() => {
              console.log('✅ PostHog signup tracked for', userId)
            })
            .catch((err) => {
              console.error('❌ PostHog signup tracking failed:', err)
            })
        )
      } else {
        console.warn('⚠️ NEXT_PUBLIC_POSTHOG_KEY not set - skipping PostHog signup capture')
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // UPDATE PROFILE - Save first/last name to profiles table
    // ═══════════════════════════════════════════════════════════════════
    if (firstName || lastName) {
      try {
        await supabase
          .from('profiles')
          .update({
            first_name: firstName || null,
            last_name: lastName || null,
          })
          .eq('id', userId)
        console.log('✅ Updated profile with name for user', userId)
      } catch (e) {
        console.warn('⚠️ Could not update profile name:', (e as any)?.message)
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // DUB LEAD TRACKING - Track new sign ups from referral links
    // ═══════════════════════════════════════════════════════════════════
    const dub_id = cookieStore.get('dub_id')?.value

    if (dub_id && shouldTrackSignupOnce) {
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
    } else if (dub_id && !shouldTrackSignupOnce) {
      // Avoid retaining referral cookie once signup tracking has already happened.
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
    // CUSTOMER.IO - Identify user + track signup event
    // ═══════════════════════════════════════════════════════════════════
    if (email) {
      console.log('📧 Syncing user to Customer.io:', userId)

      waitUntil(
        (async () => {
          await identifyCustomer(userId, {
            email,
            first_name: firstName || '',
            last_name: lastName || '',
            plan: 'free',
            plan_name: 'free',
            subscription_status: 'free',
            total_sessions: 0,
            signup_source: 'website',
            created_at: createdAt
              ? Math.floor(new Date(createdAt).getTime() / 1000)
              : Math.floor(Date.now() / 1000),
          })

          if (shouldTrackSignupOnce) {
            await trackEvent(userId, 'signed_up', {
              email,
              first_name: firstName || '',
              signup_source: 'website',
              signed_up_at: new Date().toISOString(),
            })
            console.log('✅ Customer.io signup tracking complete for', userId)
          }
        })().catch((err) => {
          console.error('❌ Customer.io sync error:', err)
        })
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // BEEHIIV SYNC - Track new sign ups as leads in BeeHiiv
    // ═══════════════════════════════════════════════════════════════════
    if (shouldTrackSignupOnce && email) {
      console.log('📧 Syncing new user to BeeHiiv as lead:', userId)

      waitUntil(
        syncNewSignupToBeeHiiv({
          email,
          firstName,
          lastName,
        }).then((success) => {
          if (success) {
            console.log('✅ BeeHiiv lead sync successful for user', userId)
          } else {
            console.warn('⚠️ BeeHiiv lead sync failed for user', userId)
          }
        }).catch((err) => {
          console.error('❌ BeeHiiv lead sync error:', err)
        })
      )
    }

    const response = NextResponse.json({ success: true })

    if (shouldTrackSignupOnce) {
      response.cookies.set(SIGNUP_TRACKING_COOKIE, userId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 90,
      })
    }

    return response
  } catch (error) {
    console.error('Post-signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
