import { createR2ReadUrl } from '@/lib/r2';
import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const user = await getServerFirebaseUser();
    if (!user) {
      console.error('Download failed: Unauthorized user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
      'select role, approval_status from profiles where id = $1',
      [user.id]
    );
    const profile = profileRows[0];
    if (!profile) {
      console.error('Download failed: Profile missing for user', user.id);
      return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
    }
    if (profile.role !== 'student') {
      console.error('Download failed: User role is not student', profile.role);
      return NextResponse.json({ error: 'Student role required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const assignmentId = String(body?.assignmentId ?? '').trim();
    if (!UUID_RE.test(assignmentId)) {
      console.error('Download failed: Invalid assignment id', assignmentId);
      return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
    }

    // Only allow download if assignment is submitted/completed
    // First, verify assignment exists and belongs to student
    const { rows: assignmentRows } = await query(
      `select id from assignments where id = $1 and student_id = $2 and status in ('submitted', 'completed')`,
      [assignmentId, user.id]
    );
    const assignment = assignmentRows[0];
    if (!assignment) {
      console.error('Download failed: Assignment not found or not submitted/completed', assignmentId, 'User:', user.id);
      return NextResponse.json({ error: 'Assignment not found or not submitted/completed' }, { status: 404 });
    }

    // Fetch the latest approved task_submission for this assignment
    const { rows: submissionRows } = await query(
      `select ts.storage_path from task_submissions ts
        join tasks t on ts.task_id = t.id
        where t.assignment_id = $1 and ts.status = 'approved'
        order by ts.created_at desc limit 1`,
      [assignmentId]
    );
    const submission = submissionRows[0];
    if (!submission || !submission.storage_path) {
      console.error('Download failed: No submitted answer file found', assignmentId);
      return NextResponse.json({ error: 'No submitted answer file available for download' }, { status: 404 });
    }

    const downloadUrl = await createR2ReadUrl(submission.storage_path);
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('Student assignment download-url error:', error);
    return NextResponse.json({ error: 'Failed to prepare download URL' }, { status: 500 });
  }
}
