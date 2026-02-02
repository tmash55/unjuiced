import { NextRequest, NextResponse } from 'next/server';
import { syncNewSignupToBeeHiiv } from '@/libs/beehiiv';

/**
 * Track a new lead in BeeHiiv
 * Called from client-side signup flow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, lastName } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const success = await syncNewSignupToBeeHiiv({
      email,
      firstName,
      lastName,
    });

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to sync to BeeHiiv' }, { status: 500 });
    }
  } catch (error) {
    console.error('[beehiiv] Track endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
