import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';
import { SUBSCRIPTION_PLANS } from '@/lib/roles';
import { convertUsdToKes, getUsdToKesRate } from '@/lib/exchangeRates';

type SubscriptionRow = {
  id: string;
};

export async function POST(req: Request) {
  const { plan } = await req.json();
  const conf = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
  if (!conf) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'writer') return NextResponse.json({ error: 'Writer role required' }, { status: 403 });

  // Create subscription record (inactive until payment success)
  const tasksPerDay = conf.tasksPerDay === Infinity ? 0 : conf.tasksPerDay;
  const { rows: subRows } = await query<SubscriptionRow>(
    `insert into subscriptions (writer_id, plan, tasks_per_day, active)
     values ($1, $2, $3, false)
     returning *`,
    [user.id, plan, tasksPerDay]
  );
  const sub = subRows[0];
  if (!sub) return NextResponse.json({ error: 'Failed to create subscription' }, { status: 400 });

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
