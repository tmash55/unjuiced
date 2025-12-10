import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Test route to check Dub tracking setup
 * 
 * Usage:
 * - Check status: GET /api/test/dub-check
 * - Set test cookie: GET /api/test/dub-check?set_test_cookie=true
 * - Clear test cookie: GET /api/test/dub-check?clear_cookie=true
 * 
 * This helps verify:
 * 1. The dub_id cookie is being set when clicking affiliate links
 * 2. The DUB_API_KEY is configured
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const setTestCookie = searchParams.get('set_test_cookie') === 'true'
  const clearCookie = searchParams.get('clear_cookie') === 'true'
  
  const cookieStore = await cookies()
  
  // Handle setting a test cookie for local development
  if (setTestCookie) {
    const testDubId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const response = NextResponse.json({
      status: 'ok',
      action: 'set_test_cookie',
      message: '✅ Test dub_id cookie set! Now sign up with a new user to test lead tracking.',
      dub_id: testDubId,
      nextSteps: [
        '1. Sign up as a new user (use a test email)',
        '2. Check server logs for lead tracking messages',
        '3. Note: This is a test cookie - lead will show in Dub but with "test_" prefix'
      ]
    })
    response.cookies.set('dub_id', testDubId, {
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      httpOnly: false,
      sameSite: 'lax'
    })
    return response
  }
  
  // Handle clearing the cookie
  if (clearCookie) {
    const response = NextResponse.json({
      status: 'ok',
      action: 'clear_cookie',
      message: '✅ dub_id cookie cleared'
    })
    response.cookies.delete('dub_id')
    return response
  }
  
  const dubId = cookieStore.get('dub_id')?.value
  const dubPartnerData = cookieStore.get('dub_partner_data')?.value
  
  const hasDubApiKey = !!process.env.DUB_API_KEY
  const apiKeyPreview = process.env.DUB_API_KEY 
    ? `${process.env.DUB_API_KEY.slice(0, 8)}...` 
    : 'NOT SET'
  
  const result = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      dub_id_cookie: {
        present: !!dubId,
        value: dubId || null,
        message: dubId 
          ? '✅ dub_id cookie found - click tracking is working' 
          : '❌ dub_id cookie NOT found - visit your site via a Dub link (e.g., unj.bet/tyler) first'
      },
      dub_partner_data_cookie: {
        present: !!dubPartnerData,
        parsed: dubPartnerData ? JSON.parse(decodeURIComponent(dubPartnerData)) : null,
        message: dubPartnerData 
          ? '✅ Partner data cookie found' 
          : '⚠️ No partner data cookie (optional - only set for partner links with discounts)'
      },
      dub_api_key: {
        configured: hasDubApiKey,
        preview: apiKeyPreview,
        message: hasDubApiKey 
          ? '✅ DUB_API_KEY is configured' 
          : '❌ DUB_API_KEY is NOT set - lead/sale tracking will fail'
      }
    },
    leadTrackingReady: !!dubId && hasDubApiKey,
    nextSteps: !dubId 
      ? [
          'Option A - Test on Production:',
          '  1. Deploy your changes',
          '  2. Open incognito browser and visit https://unj.bet/tyler',
          '  3. Sign up with a new email',
          '',
          'Option B - Local Testing:',
          '  1. Visit /api/test/dub-check?set_test_cookie=true',
          '  2. Sign up as a new user',
          '  3. Check server logs for lead tracking messages',
          '  Note: Test leads will have "test_" prefix in Dub dashboard'
        ]
      : hasDubApiKey
        ? [
            '✅ Ready for testing!',
            '1. Sign up as a new user',
            '2. Check server logs for "📊 Tracking Dub lead event" message',
            '3. Check your Dub dashboard for the lead event',
            '',
            'To clear cookie: /api/test/dub-check?clear_cookie=true'
          ]
        : [
            '1. Set DUB_API_KEY in your .env.local file',
            '2. Restart your dev server',
            '3. Try again'
          ],
    isTestCookie: dubId?.startsWith('test_') || false
  }
  
  return NextResponse.json(result, { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

