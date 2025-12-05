import { createClient } from '@/libs/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/arbitrage'

  console.log('🔄 Auth callback started:', { code: !!code, token_hash: !!token_hash, type, next, origin })

  const supabase = await createClient()

  // Handle token_hash for email confirmations and password recovery
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'email' | 'signup' | 'invite' | 'magiclink',
    })
    
    if (!error && data.user) {
      console.log('✅ OTP verified for user:', data.user.id, 'type:', type)
      
      // For password recovery, redirect to forgot-password page
      const redirectPath = type === 'recovery' ? '/forgot-password' : next
      
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${redirectPath}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
      } else {
        return NextResponse.redirect(`${origin}${redirectPath}`)
      }
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
      
      console.log('✨ Redirecting to:', next)
      
      // Redirect to next page
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
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