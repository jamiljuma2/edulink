import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { getFirebaseStorageBucket } from '@/lib/firebaseAdmin';
import { query } from '@/lib/db';

// POST /api/admin/submissions/signed-url
// Body: { storage_path: string }
export async function POST(req: NextRequest) {
  try {
    const user = await getServerFirebaseUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { rows } = await query<{ role: string; approval_status: string }>(
      'select role, approval_status from profiles where id = $1',
      [user.id]
    );
    const profile = rows[0];
    if (!profile) {
      return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
    }
    if (profile.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Approval required' }, { status: 403 });
    }
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }
    const { storage_path } = await req.json();
    if (!storage_path) {
      return NextResponse.json({ error: 'Missing storage_path' }, { status: 400 });
    }
    const bucket = getFirebaseStorageBucket();
    const [signedUrl] = await bucket.file(storage_path).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });
    return NextResponse.json({ signedUrl });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
