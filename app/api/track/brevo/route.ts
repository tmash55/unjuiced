import { NextRequest, NextResponse } from 'next/server'
import { syncNewSignupToBrevo } from '@/libs/brevo'

/**
 * Sync a new user to Brevo as a lead
 * Called after successful signup when email confirmation is disabled
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, source } = body
    
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    
    console.log('📧 Brevo lead sync API called:', {
      email: email.replace(/(.{2}).*@/, '$1***@'),
      hasFirstName: !!firstName,
      hasLastName: !!lastName,
      source: source || 'app_signup',
    })
    
    const success = await syncNewSignupToBrevo({
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      newsletterOptIn: true,
      source: source || 'app_signup',
    })
    
    if (success) {
      console.log('✅ Brevo lead sync successful')
      return NextResponse.json({ 
        synced: true,
        message: 'Contact synced to Brevo successfully'
      })
    } else {
      console.warn('⚠️ Brevo lead sync failed')
      return NextResponse.json({ 
        synced: false, 
        reason: 'brevo_api_failed' 
      })
    }
    
  } catch (error) {
    console.error('❌ Brevo lead sync error:', error)
    return NextResponse.json({ 
      synced: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
