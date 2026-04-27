import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase';

function normalizeUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const normalized = normalizeUrl(url);
  if (!normalized) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();

    // Match against domain (exact) or URL fields (partial, since they include protocol)
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .or(
        `domain.eq.${normalized},` +
        `vercel_url.ilike.%${normalized}%,` +
        `pages_url.ilike.%${normalized}%,` +
        `custom_domain.ilike.%${normalized}%`
      )
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json({ site: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
