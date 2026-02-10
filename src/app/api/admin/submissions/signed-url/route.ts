import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/admin/submissions/signed-url
// Body: { storage_path: string }
export async function POST(req: NextRequest) {
  try {
    const { storage_path } = await req.json();
    if (!storage_path) {
      return NextResponse.json({ error: 'Missing storage_path' }, { status: 400 });
    }
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.storage.from('submissions').createSignedUrl(storage_path, 3600);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ signedUrl: data?.signedUrl ?? null });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
