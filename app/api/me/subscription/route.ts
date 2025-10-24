import { NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the user's latest subscription
    const { data: subscription, error: subError } = await supabase
      .schema('billing')
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) {
      console.error('[subscription] DB error:', subError)
      return NextResponse.json(
        { error: 'Failed to fetch subscription' },
        { status: 500 }
      )
    }

    // Return null if no subscription found (not an error)
    if (!subscription) {
      return NextResponse.json(null, { status: 404 })
    }

    return NextResponse.json(subscription)
  } catch (error: any) {
    console.error('[subscription] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
