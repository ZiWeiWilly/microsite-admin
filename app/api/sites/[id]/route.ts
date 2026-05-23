import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
