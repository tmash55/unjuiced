import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const priceId = sp.get('priceId')
  const mode = sp.get('mode') || 'subscription'
  const couponId = sp.get('couponId')

  // Attempt to immediately create checkout; if not authenticated, API will 401 via middleware/auth
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
  try {
    const res = await fetch(`${origin}/api/billing/checkout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Pass through cookies so auth is present
        'Cookie': req.headers.get('cookie') || '',
      },
      body: JSON.stringify({ priceId, mode, couponId }),
    })
    if (!res.ok) {
      return NextResponse.redirect(`${origin}/pricing`)
    }
    const json = await res.json()
    if (json?.url) {
      return NextResponse.redirect(json.url)
    }
  } catch {}
  return NextResponse.redirect(`${origin}/pricing`)
}


