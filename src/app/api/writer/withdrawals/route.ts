import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  const { amount, phone } = await req.json();
  if (!amount || !phone) return NextResponse.json({ error: 'amount and phone required' }, { status: 400 });

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

  const { rows: walletRows } = await query(
    'select * from wallets where user_id = $1',
    [user.id]
  );
  const wallet = walletRows[0];
  const balance = Number(wallet?.balance ?? 0);
  if (Number(amount) > balance) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });

  // Record pending payout transaction (actual payout integration can be added later)
  await query(
    `insert into transactions (user_id, type, amount, currency, status, meta)
     values ($1, $2, $3, $4, $5, $6)`,
    [user.id, 'payout', Number(amount), wallet?.currency ?? 'KES', 'pending', { phone }]
  );

  return NextResponse.json({ ok: true, message: 'Withdrawal request submitted.' });
}
