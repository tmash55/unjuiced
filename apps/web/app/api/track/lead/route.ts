import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { dub } from '@/libs/dub'

/**
 * Track a lead event with Dub
 * Called after successful signup when email confirmation is disabled
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, name, avatar } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    
    const cookieStore = await cookies()
    const dubId = cookieStore.get('dub_id')?.value
    
    console.log('📊 Lead tracking API called:', {
      userId,
      email: email ? '***' : 'not provided',
      dubId: dubId ? dubId.slice(0, 10) + '...' : 'NOT SET',
      hasDubApiKey: !!process.env.DUB_API_KEY
    })
    
    if (!dubId) {
      console.log('⚠️ No dub_id cookie - user did not come from a Dub link')
      return NextResponse.json({ 
        tracked: false, 
        reason: 'no_dub_id_cookie' 
      })
    }
    
    if (!process.env.DUB_API_KEY) {
      console.error('❌ DUB_API_KEY not configured')
      return NextResponse.json({ 
        tracked: false, 
        reason: 'api_key_not_configured' 
      })
    }
    
    // Check if this is a test cookie (won't work with Dub)
    const isTestCookie = dubId.startsWith('test_')
    
    if (isTestCookie) {
      console.log('⚠️ Test cookie detected - skipping Dub API call (test cookies are not real Dub clicks)')
      const response = NextResponse.json({ 
        tracked: false,
        reason: 'test_cookie',
        message: 'Test cookie detected. For real testing, use a production Dub link (e.g., unj.bet/tyler)'
      })
      response.cookies.delete('dub_id')
      return response
    }
    
    // Track the lead with Dub
    console.log('📊 Tracking Dub lead event for:', userId)
    
    await dub.track.lead({
      clickId: dubId,
      eventName: 'Sign Up',
      customerExternalId: userId,
      customerName: name || undefined,
      customerEmail: email || undefined,
      customerAvatar: avatar || undefined,
    })
    
    console.log('✅ Dub lead event tracked successfully')
    
    // Delete the dub_id cookie after successful tracking
    const response = NextResponse.json({ 
      tracked: true,
      message: 'Lead tracked successfully'
    })
    response.cookies.delete('dub_id')
    
    return response
    
  } catch (error) {
    console.error('❌ Failed to track Dub lead:', error)
    
    // Clear the cookie even on error to prevent retries with invalid clickId
    const response = NextResponse.json({ 
      tracked: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
    response.cookies.delete('dub_id')
    
    return response
  }
}

