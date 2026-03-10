import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';
import { createR2UploadUrl, sanitizeFileName } from '@/lib/r2';

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
    if (profile.role !== 'student') return NextResponse.json({ error: 'Student role required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const fileName = String(body?.fileName ?? '').trim();
    const contentType = String(body?.contentType ?? 'application/octet-stream').trim();

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const storagePath = `assignments/${user.id}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
    const uploadUrl = await createR2UploadUrl(storagePath, contentType);

    return NextResponse.json({ uploadUrl, storagePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('Student upload-url error:', error);

    if (message.startsWith('Missing required env var:')) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to prepare upload URL' }, { status: 500 });
  }
}
