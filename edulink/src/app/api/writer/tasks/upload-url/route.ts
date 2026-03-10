import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';
import { createR2UploadUrl, sanitizeFileName } from '@/lib/r2';

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
    const fileName = String(body?.fileName ?? '').trim();
    const contentType = String(body?.contentType ?? 'application/octet-stream').trim();

    if (!UUID_RE.test(taskId)) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }
    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const { rows: taskRows } = await query('select id from tasks where id = $1 and writer_id = $2', [taskId, user.id]);
    if (!taskRows[0]) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const storagePath = `submissions/${user.id}/${taskId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
    const uploadUrl = await createR2UploadUrl(storagePath, contentType);

    return NextResponse.json({ uploadUrl, storagePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('Writer upload-url error:', error);

    if (message.startsWith('Missing required env var:')) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to prepare upload URL' }, { status: 500 });
  }
}
