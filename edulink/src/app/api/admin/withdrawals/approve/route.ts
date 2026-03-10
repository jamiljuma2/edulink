import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  const { transactionId } = await req.json();
  if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 });

  const { rows: txnRows } = await query(
    'select * from transactions where id = $1 and type = $2',
    [transactionId, 'payout']
  );
  const txn = txnRows[0];
  if (!txn) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });

  // Mark approved (actual payout integration can be added later)
  await query('update transactions set status = $1 where id = $2', ['success', transactionId]);

  return NextResponse.json({ ok: true });
}
