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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });

  const { rows: profileRows } = await query<{ role: string; approval_status: string; email: string | null }>(
    'select role, approval_status, email from profiles where id = $1',
    [user.id]
  );

  const profile = profileRows[0];
  if (!profile) {
    return NextResponse.json({ error: 'Profile missing', resolvedUserId: user.id }, { status: 403, headers: noStoreHeaders });
  }

  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403, headers: noStoreHeaders });
  }

  const [dbInfo, txCount, topupCount, assignmentsCount, submissionsCount] = await Promise.all([
    query<{ current_database: string; now: string }>('select current_database(), now()::text', []),
    query<{ count: string }>('select count(*) from transactions', []),
    query<{ count: string }>("select count(*) from transactions where type = 'topup'", []),
    query<{ count: string }>('select count(*) from assignments', []),
    query<{ count: string }>('select count(*) from task_submissions', []),
  ]);

  return NextResponse.json(
    {
      ok: true,
      resolvedUserId: user.id,
      profile,
      db: dbInfo.rows[0] ?? null,
      counts: {
        transactions: Number(txCount.rows[0]?.count ?? 0),
        topups: Number(topupCount.rows[0]?.count ?? 0),
        assignments: Number(assignmentsCount.rows[0]?.count ?? 0),
        submissions: Number(submissionsCount.rows[0]?.count ?? 0),
      },
    },
    { headers: noStoreHeaders }
  );
}
