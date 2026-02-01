import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { SUBSCRIPTION_PLANS } from '@/lib/roles';
import { convertUsdToKes, getUsdToKesRate } from '@/lib/exchangeRates';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { plan } = await req.json();
  const conf = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
  if (!conf) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single();
  if (pErr || !profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'writer') return NextResponse.json({ error: 'Writer role required' }, { status: 403 });

  // Create subscription record (inactive until payment success)
  const tasksPerDay = conf.tasksPerDay === Infinity ? 0 : conf.tasksPerDay;
  const { data: sub, error: sErr } = await supabase
    .from('subscriptions')
    .insert({ writer_id: user.id, plan, tasks_per_day: tasksPerDay, active: false })
    .select('*')
    .single();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

  const usdAmount = conf.price;
  const rate = await getUsdToKesRate();
  const kesAmount = convertUsdToKes(usdAmount, rate);

  return NextResponse.json({
    ok: true,
    subscriptionId: sub.id,
    amount: kesAmount,
    currency: 'KES',
    rate,
  });
}
