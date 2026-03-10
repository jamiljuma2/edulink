import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export async function GET() {
  const user = await getServerFirebaseUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }
  const { rows } = await query(
    'select id, role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = rows[0];
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: noStoreHeaders });
  }
  return NextResponse.json({ profile }, { headers: noStoreHeaders });
}
