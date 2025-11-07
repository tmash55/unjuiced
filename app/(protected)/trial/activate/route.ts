import { createClient } from '@/libs/supabase/server'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

/**
 * GET /trial/activate
 * Activates the free trial for authenticated users who haven't used it yet
 * Supports redirectTo query param to return users to the page they came from
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const redirectTo = searchParams.get('redirectTo') || '/arbitrage'
  
  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  
  // If not authenticated, redirect to register with redirectTo preserved
  if (!user) {
    redirect(`/register?redirectTo=${encodeURIComponent(redirectTo)}`)
  }

  // Check if user has already used their trial
  const { data: profile } = await supabase
    .from('profiles')
    .select('trial_used, trial_started_at, trial_ends_at')
    .eq('id', user.id)
    .single()

  // If trial not used, initialize it
  if (profile && !profile.trial_used) {
    const now = new Date()
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        trial_used: true,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Error activating trial:', updateError)
    } else {
      console.log('✅ Trial activated for user:', {
        userId: user.id,
        email: user.email,
        trial_ends_at: trialEnds.toISOString(),
      })
    }
  }

  // Redirect to the page user came from, or arbitrage by default
  redirect(redirectTo)
}

