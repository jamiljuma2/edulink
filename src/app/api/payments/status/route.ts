import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export async function GET(req: Request) {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const reference = url.searchParams.get('reference');
  if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400 });

  const { rows } = await query(
    'select id, status, reference, type, amount, currency, created_at from transactions where reference = $1 and user_id = $2',
    [reference, user.id]
  );
  const txn = rows[0];

  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

  return NextResponse.json({ transaction: txn });
}
