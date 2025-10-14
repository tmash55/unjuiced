import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const brandKey = searchParams.get('brand_key') || 'unjuiced';

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ pro: false, status: null, current_period_end: null, cancel_at_period_end: null });
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .eq('brand_key', brandKey)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json({ pro: false, status: null, current_period_end: null, cancel_at_period_end: null });
    }

    const status = (sub as any)?.status as string | null;
    const endIso = (sub as any)?.current_period_end as string | null;
    const cancelAtPeriodEnd = Boolean((sub as any)?.cancel_at_period_end);

    const nowMs = Date.now();
    const endMs = endIso ? Date.parse(endIso) : NaN;

    const isActiveStatus = status === 'active' || status === 'trialing';
    const withinPeriod = !endIso || (Number.isFinite(endMs) && endMs > nowMs);
    const pro = Boolean(isActiveStatus && withinPeriod);

    return NextResponse.json({
      pro,
      status,
      current_period_end: endIso,
      cancel_at_period_end: cancelAtPeriodEnd,
    });
  } catch (e: any) {
    console.error('subscription status error', e);
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}