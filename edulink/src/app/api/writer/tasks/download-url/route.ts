import { createR2ReadUrl } from '@/lib/r2';
import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
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

    const body = await req.json().catch(() => ({}));
    const taskId = String(body?.taskId ?? '').trim();
    const storagePath = String(body?.storagePath ?? '').trim();

    if (!UUID_RE.test(taskId)) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }
    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
    }

    // Optionally verify task ownership
    const { rows: taskRows } = await query('select id from tasks where id = $1 and writer_id = $2', [taskId, user.id]);
    if (!taskRows[0]) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const downloadUrl = await createR2ReadUrl(storagePath);
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('Writer download-url error:', error);
    return NextResponse.json({ error: 'Failed to prepare download URL' }, { status: 500 });
  }
}
