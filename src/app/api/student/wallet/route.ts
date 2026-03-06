import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export async function GET() {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'student') return NextResponse.json({ error: 'Student role required' }, { status: 403 });

  const { rows: walletRows } = await query(
    'select * from wallets where user_id = $1',
    [user.id]
  );
  const wallet = walletRows[0];

  if (!wallet) {
    const { rows: createdRows } = await query(
      'insert into wallets (user_id, balance, currency) values ($1, 0, $2) returning *',
      [user.id, 'KES']
    );
    const created = createdRows[0];
    if (!created) return NextResponse.json({ error: 'Failed to create wallet' }, { status: 400 });
    return NextResponse.json({ wallet: created });
  }

  return NextResponse.json({ wallet });
}
