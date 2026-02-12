import { createClient } from '@/libs/supabase/server'
import { NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'

/**
 * POST /api/auth/init-trial
 * Initializes the 3-day free trial for a new user
 * This should be called after successful signup
 */
export async function POST() {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user has already used their trial
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('trial_used, trial_started_at, trial_ends_at')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // If trial already used, return early
    if (profile.trial_used) {
      return NextResponse.json({
        success: false,
        message: 'Trial already used',
        trial_used: true,
      })
    }

    // Initialize trial: set trial_used to true and set dates
    const now = new Date()
    const trialEnds = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days from now

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        trial_used: true,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile for trial:', updateError)
      return NextResponse.json(
        { error: 'Failed to initialize trial' },
        { status: 500 }
      )
    }

    console.log('✅ Trial initialized for user:', {
      userId: user.id,
      email: user.email,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
    })

    // Capture trial_started event in PostHog
    const posthog = getPostHogClient()
    posthog.capture({
      distinctId: user.id,
      event: 'trial_started',
      properties: {
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        trial_duration_days: 3,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Trial initialized successfully',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
    })
  } catch (error) {
    console.error('Error in /api/auth/init-trial:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

