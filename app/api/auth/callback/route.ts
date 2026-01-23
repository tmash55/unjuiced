import { createClient } from '@/libs/supabase/server'
import { dub } from '@/libs/dub'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { waitUntil } from '@vercel/functions'
import Stripe from 'stripe'
import { syncNewSignupToBrevo } from '@/libs/brevo'
import { getRedirectUrl, DOMAINS } from '@/lib/domain'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const redirectTo = searchParams.get('redirectTo')
  const next = searchParams.get('next') ?? '/today' // Default to /today on app subdomain

  const host = request.headers.get('host') || ''
  const isLocal = host.includes('localhost')

  console.log('🔄 Auth callback started:', { code: !!code, token_hash: !!token_hash, type, next, redirectTo, origin, host })

  const supabase = await createClient()
  const cookieStore = await cookies()

  // Helper function to get the redirect destination
  const getAuthRedirect = (path: string) => {
    // If redirectTo is specified (e.g., from app subdomain login flow)
    if (redirectTo) {
      // If it's already a full URL (e.g., https://app.unjuiced.bet/today)
      if (redirectTo.startsWith('http')) {
        return redirectTo
      }
      // Otherwise, build the app subdomain URL
      return getRedirectUrl(host, redirectTo, 'app')
    }
    
    // Default: redirect to app subdomain with the path
    return getRedirectUrl(host, path, 'app')
  }

  // Handle token_hash for email confirmations and password recovery
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'email' | 'signup' | 'invite' | 'magiclink',
    })
    
    if (!error && data.user) {
      console.log('✅ OTP verified for user:', data.user.id, 'type:', type)
      
      // For password recovery, redirect to forgot-password page on marketing site
      if (type === 'recovery') {
        const forwardedHost = request.headers.get('x-forwarded-host')
        const redirectPath = '/forgot-password'
        
        if (isLocal) {
          return NextResponse.redirect(`${origin}${redirectPath}`)
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
        } else {
          return NextResponse.redirect(`${origin}${redirectPath}`)
        }
      }
      
      // For other OTP types (email confirmation, etc.), redirect to app subdomain
      const redirectUrl = getAuthRedirect(next)
      console.log('✨ OTP success, redirecting to:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    } else {
      console.error('❌ OTP verification error:', error)
    }
  }

  // Handle code exchange (PKCE flow)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      console.log('✅ User authenticated:', { 
        userId: data.user.id, 
        email: data.user.email,
        metadata: data.user.user_metadata 
      })
      
      // ═══════════════════════════════════════════════════════════════════
      // DUB LEAD TRACKING - Track new sign ups from referral links
      // ═══════════════════════════════════════════════════════════════════
      const dub_id = cookieStore.get('dub_id')?.value
      // Check if user was created in the last 10 minutes (new sign up)
      const isNewUser = new Date(data.user.created_at) > new Date(Date.now() - 10 * 60 * 1000)
      
      console.log('📊 Dub lead tracking check:', {
        dub_id: dub_id || 'NOT SET',
        isNewUser,
        userCreatedAt: data.user.created_at,
        hasDubApiKey: !!process.env.DUB_API_KEY,
      })
      
      if (dub_id && isNewUser) {
        if (!process.env.DUB_API_KEY) {
          console.error('❌ Cannot track Dub lead - DUB_API_KEY not set in environment')
        } else {
          console.log('📊 Tracking Dub lead event for new user:', data.user.id)
          
          // Use waitUntil to track the lead without blocking the response
          waitUntil(
            dub.track.lead({
              clickId: dub_id,
              eventName: 'Sign Up',
              customerExternalId: data.user.id,
              customerName: data.user.user_metadata?.full_name || data.user.user_metadata?.name || undefined,
              customerEmail: data.user.email || undefined,
              customerAvatar: data.user.user_metadata?.avatar_url || undefined,
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
      
      // Ensure a Stripe customer exists for this user (idempotent by profile check)
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', data.user.id)
          .maybeSingle()

        if (!profile?.stripe_customer_id) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2023-08-16' as any,
            typescript: true,
          })
          const customer = await stripe.customers.create({
            email: data.user.email || undefined,
            metadata: { user_id: data.user.id },
          })
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: customer.id })
            .eq('id', data.user.id)
          console.log('✅ Created Stripe customer for user', data.user.id)
        }
      } catch (e) {
        console.warn('⚠️ Could not ensure Stripe customer on auth callback:', (e as any)?.message)
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // BREVO SYNC - Track new sign ups as leads in Brevo
      // ═══════════════════════════════════════════════════════════════════
      if (isNewUser && data.user.email) {
        console.log('📧 Syncing new user to Brevo as lead:', data.user.id)
        
        // Use waitUntil to sync without blocking the response
        waitUntil(
          syncNewSignupToBrevo({
            email: data.user.email,
            firstName: data.user.user_metadata?.full_name?.split(' ')[0] || 
                      data.user.user_metadata?.name?.split(' ')[0] || undefined,
            lastName: data.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 
                     data.user.user_metadata?.name?.split(' ').slice(1).join(' ') || undefined,
            newsletterOptIn: true, // Default to true - users can unsubscribe later
            source: 'app_signup',
          }).then((success) => {
            if (success) {
              console.log('✅ Brevo lead sync successful for user', data.user.id)
            } else {
              console.warn('⚠️ Brevo lead sync failed for user', data.user.id)
            }
          }).catch((err) => {
            console.error('❌ Brevo lead sync error:', err)
          })
        )
      }
      
      // Build the redirect URL (to app subdomain)
      const redirectUrl = getAuthRedirect(next)
      console.log('✨ Auth success, redirecting to:', redirectUrl)
      
      return NextResponse.redirect(redirectUrl)
    } else {
      console.error('❌ Auth error:', error)
    }
  } else {
    console.log('⚠️ No auth code provided')
  }

  console.log('🔄 Redirecting to auth error page')
  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
