import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/libs/supabase/server'

/**
 * API endpoint to receive client-side logs
 * Stores in Supabase for later analysis
 * No third-party service needed!
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    // Get user if authenticated (optional)
    const { data: { user } } = await supabase.auth.getUser()

    // Insert log into Supabase
    // You'll need to create a 'logs' table:
    // CREATE TABLE logs (
    //   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    //   created_at timestamptz DEFAULT now(),
    //   level text NOT NULL,
    //   message text NOT NULL,
    //   context jsonb,
    //   user_id uuid REFERENCES auth.users(id),
    //   user_agent text,
    //   environment text
    // );
    // CREATE INDEX idx_logs_level ON logs(level);
    // CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
    // CREATE INDEX idx_logs_user_id ON logs(user_id);

    const { error } = await supabase.from('logs').insert({
      level: body.level,
      message: body.message,
      context: body.context || {},
      user_id: user?.id || null,
      user_agent: body.userAgent,
      environment: body.environment,
    })

    if (error) {
      console.error('Failed to insert log:', error)
      return NextResponse.json({ error: 'Failed to save log' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Log endpoint error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

