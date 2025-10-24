import { createClient } from '@/libs/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/arbitrage'

  console.log('🔄 Auth callback started:', { code: !!code, next, origin })

  if (code) {
    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      console.log('✅ User authenticated:', { 
        userId: data.user.id, 
        email: data.user.email,
        metadata: data.user.user_metadata 
      })
      
      // Check if this is a new user and initialize trial
      // We check if the user was created recently (within last 5 minutes)
      const userCreatedAt = new Date(data.user.created_at)
      const now = new Date()
      const isNewUser = (now.getTime() - userCreatedAt.getTime()) < 5 * 60 * 1000 // 5 minutes
      
      if (isNewUser) {
        console.log('🎉 New user detected, initializing trial...')
        try {
          // Call init-trial endpoint
          const initTrialResponse = await fetch(`${origin}/api/auth/init-trial`, {
            method: 'POST',
            headers: {
              'Cookie': request.headers.get('cookie') || '',
            },
          })
          
          const trialResult = await initTrialResponse.json()
          console.log('✅ Trial initialization result:', trialResult)
        } catch (trialError) {
          console.error('❌ Error initializing trial:', trialError)
          // Don't block the redirect if trial init fails
        }
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