import { NextResponse } from 'next/server';
import { getRecommendations } from '../../lib/recommend';

export async function POST(request: Request) {
  try {
    const { klookUrl, attractionName } = await request.json();

    if (!klookUrl) {
      return NextResponse.json({ error: 'klookUrl is required' }, { status: 400 });
    }

    const result = getRecommendations(klookUrl, attractionName ?? '');
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
