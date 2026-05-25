import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones?account.id=${CLOUDFLARE_ACCOUNT_ID}&status=active&per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await res.json();

    if (!res.ok || !data.success) {
      const msg = data.errors?.[0]?.message ?? 'Unknown Cloudflare error';
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const zones: { id: string; name: string }[] = (data.result ?? []).map(
      (z: { id: string; name: string }) => ({ id: z.id, name: z.name })
    );

    return NextResponse.json({ zones });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
