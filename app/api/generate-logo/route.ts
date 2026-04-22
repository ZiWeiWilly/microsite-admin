import { NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function sanitizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history.filter((item): item is ChatMessage => {
    if (!item || typeof item !== 'object') return false;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    return (role === 'user' || role === 'assistant') && typeof content === 'string';
  });
}

async function decodeImageFromUnknown(input: unknown): Promise<Buffer | null> {
  if (!input) return null;

  if (typeof input === 'string') {
    if (input.startsWith('data:')) return Buffer.from(input.split(',')[1], 'base64');
    return Buffer.from(input, 'base64');
  }

  if (typeof input !== 'object') return null;

  const obj = input as {
    url?: unknown;
    image_url?: { url?: unknown } | unknown;
    b64_json?: unknown;
    bytes?: unknown;
    data?: unknown;
    inline_data?: { data?: unknown } | unknown;
  };

  const directBase64 =
    (typeof obj.b64_json === 'string' && obj.b64_json)
    || (typeof obj.bytes === 'string' && obj.bytes)
    || (typeof obj.data === 'string' && obj.data);
  if (directBase64) return Buffer.from(directBase64, 'base64');

  if (obj.inline_data && typeof obj.inline_data === 'object') {
    const inlineData = (obj.inline_data as { data?: unknown }).data;
    if (typeof inlineData === 'string') return Buffer.from(inlineData, 'base64');
  }

  const urlCandidate =
    (typeof obj.url === 'string' && obj.url)
    || (typeof obj.image_url === 'object' && obj.image_url && typeof (obj.image_url as { url?: unknown }).url === 'string'
      ? (obj.image_url as { url: string }).url
      : null);
  if (urlCandidate) {
    if (urlCandidate.startsWith('data:')) return Buffer.from(urlCandidate.split(',')[1], 'base64');
    const imgRes = await fetch(urlCandidate);
    if (!imgRes.ok) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  }

  return null;
}

async function generateAttractionIcon(attractionName: string, history: ChatMessage[]): Promise<Buffer> {
  const systemPrompt = `Create a clean, modern logo icon for "${attractionName}". Requirements:
- Square format, suitable for a website navbar
- Minimal and professional design
- Transparent or white background
- Bold, recognizable symbol that represents this attraction
- No text in the image
- Suitable for use at small sizes (favicon)`;

  const messages: ChatMessage[] =
    history.length > 0
      ? history
      : [{ role: 'user', content: systemPrompt }];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.1-flash-image-preview',
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  console.log('[generate-logo] raw response:', JSON.stringify(data, null, 2));

  const message = data.choices?.[0]?.message;
  const content = message?.content;

  // Array of parts (multimodal)
  if (Array.isArray(content)) {
    for (const part of content) {
      const decoded = await decodeImageFromUnknown(part);
      if (decoded) return decoded;
    }
  }

  // String content with embedded data URI
  if (typeof content === 'string') {
    const match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (match) return Buffer.from(match[1], 'base64');
  }

  // Some OpenRouter wrappers put the image under message.image or message.images
  if (message?.image) {
    const decoded = await decodeImageFromUnknown(message.image);
    if (decoded) return decoded;
  }
  if (Array.isArray(message?.images) && message.images.length > 0) {
    for (const img of message.images) {
      const decoded = await decodeImageFromUnknown(img);
      if (decoded) return decoded;
    }
  }

  throw new Error(`No image found in Gemini response. Content type: ${typeof content}, keys: ${Object.keys(message ?? {}).join(', ')}`);
}

async function composeLogos(iconBuffer: Buffer): Promise<{
  logo: Buffer;
  logoLight: Buffer;
  logoIcon: Buffer;
}> {
  const poweredByPath = path.join(process.cwd(), 'public', 'powered_by.png');
  const poweredByBuffer = fs.readFileSync(poweredByPath);
  const poweredByMeta = await sharp(poweredByBuffer).metadata();

  const iconHeight = poweredByMeta.height ?? 126;
  const gap = 24;

  // Resize icon to match powered_by height, preserve aspect ratio
  const iconResized = await sharp(iconBuffer)
    .resize({ height: iconHeight, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const iconMeta = await sharp(iconResized).metadata();
  const iconWidth = iconMeta.width ?? iconHeight;

  const totalWidth = iconWidth + gap + (poweredByMeta.width ?? 616);

  // logo.png — for light backgrounds (navbar)
  const logo = await sharp({
    create: { width: totalWidth, height: iconHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: iconResized, left: 0, top: 0 },
      { input: poweredByBuffer, left: iconWidth + gap, top: 0 },
    ])
    .png()
    .toBuffer();

  // logo-light.png — for dark backgrounds (footer): invert icon, keep Klook brand as-is
  const iconLight = await sharp(iconBuffer)
    .resize({ height: iconHeight, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .negate({ alpha: false })
    .png()
    .toBuffer();
  const iconLightResized = await sharp(iconLight)
    .resize({ height: iconHeight, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const logoLight = await sharp({
    create: { width: totalWidth, height: iconHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: iconLightResized, left: 0, top: 0 },
      { input: poweredByBuffer, left: iconWidth + gap, top: 0 },
    ])
    .png()
    .toBuffer();

  // logo-icon.png — square favicon (128x128)
  const logoIcon = await sharp(iconBuffer).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  return { logo, logoLight, logoIcon };
}

export async function POST(request: Request) {
  try {
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    }

    const body = await request.json() as { attractionName?: string; history?: unknown };
    const attractionName = body.attractionName ?? '';
    const history = sanitizeHistory(body.history);
    if (!attractionName) {
      return NextResponse.json({ error: 'attractionName is required' }, { status: 400 });
    }

    const iconBuffer = await generateAttractionIcon(attractionName, history);
    const { logo, logoLight, logoIcon } = await composeLogos(iconBuffer);

    // Return updated history so client can append the assistant's image turn
    const assistantTurn: ChatMessage = { role: 'assistant', content: '[image generated]' };
    const updatedHistory: ChatMessage[] = [...history, assistantTurn];

    return NextResponse.json({
      logo: logo.toString('base64'),
      logoLight: logoLight.toString('base64'),
      logoIcon: logoIcon.toString('base64'),
      history: updatedHistory,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[generate-logo]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
