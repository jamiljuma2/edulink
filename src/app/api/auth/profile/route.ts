import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export async function GET() {
  const user = await getServerFirebaseUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { rows } = await query(
    'select id, role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = rows[0];
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  return NextResponse.json({ profile });
}
