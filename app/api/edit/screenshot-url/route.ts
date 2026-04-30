import { NextResponse } from 'next/server';
import { getSupabase, SCREENSHOT_BUCKET } from '@/app/lib/supabase';

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

interface SignRequestBody {
  filename?: string;
  contentType?: string;
  size?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SignRequestBody;
    const { filename, contentType, size } = body;

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 });
    }
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Screenshot must be an image file' }, { status: 400 });
    }
    if (typeof size === 'number' && size > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ error: 'Screenshot too large (max 10 MB)' }, { status: 400 });
    }

    const rawExt = filename.split('.').pop()?.toLowerCase() || 'png';
    const ext = /^[a-z0-9]+$/.test(rawExt) ? rawExt : 'png';
    const objectPath = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (error || !data) {
      throw error || new Error('Failed to create signed upload URL');
    }

    const { data: pub } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(objectPath);

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      path: data.path,
      publicUrl: pub.publicUrl,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
