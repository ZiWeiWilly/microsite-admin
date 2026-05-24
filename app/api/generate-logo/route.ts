import { NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import opentype from 'opentype.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

async function suggestBrandColor(attractionName: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: `You are a brand color expert. Given the attraction name "${attractionName}", suggest ONE hex color that best represents its brand identity for use as text on a white/light background. The color must have sufficient contrast on white (WCAG AA minimum). Reply with ONLY the hex color code, e.g. #2563eb`,
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter color suggestion failed: ${response.status}`);

  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content?.trim() ?? '';
  const match = raw.match(/#[0-9A-Fa-f]{6}/);
  return match ? match[0] : '#1a1a2e';
}

// Use opentype.js glyph-by-glyph path rendering — bypasses librsvg font loading entirely.
// librsvg on Linux (Vercel) silently fails to load woff/woff2 regardless of how they're
// referenced. font.getPath() is also avoided due to Inter's CCMP table triggering a
// known opentype.js bug; per-glyph rendering works correctly.
const FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'Inter-Bold.woff');
const FONT = opentype.parse(fs.readFileSync(FONT_PATH));

const MAX_TEXT_WIDTH = 480;

function textToSvgPaths(text: string, x: number, y: number, fontSize: number, fill: string): { paths: string; width: number } {
  const scale = fontSize / FONT.unitsPerEm;
  let curX = x;
  const parts: string[] = [];
  for (const char of text) {
    const glyph = FONT.charToGlyph(char);
    const p = glyph.getPath(curX, y, fontSize);
    p.fill = fill;
    parts.push(p.toSVG(2));
    curX += (glyph.advanceWidth ?? 0) * scale;
  }
  return { paths: parts.join(''), width: curX - x };
}

async function generateTextImage(text: string, color: string, height: number): Promise<Buffer> {
  let fontSize = Math.round(height * 0.58);
  const { width: rawWidth } = textToSvgPaths(text, 0, 0, fontSize, color);
  let textWidth = Math.ceil(rawWidth) + 10;

  if (textWidth > MAX_TEXT_WIDTH) {
    fontSize = Math.floor(fontSize * (MAX_TEXT_WIDTH / textWidth));
    textWidth = MAX_TEXT_WIDTH;
  }

  const baseline = Math.round(height * 0.5 + fontSize * 0.35);
  const { paths } = textToSvgPaths(text, 0, baseline, fontSize, color);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${textWidth}" height="${height}">${paths}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function composeLogos(attractionName: string, brandColor: string): Promise<{
  logo: Buffer;
  logoLight: Buffer;
  logoIcon: Buffer;
}> {
  const poweredByPath = path.join(process.cwd(), 'public', 'powered_by.png');
  const poweredByBuffer = fs.readFileSync(poweredByPath);
  const poweredByMeta = await sharp(poweredByBuffer).metadata();

  const height = poweredByMeta.height ?? 126;
  const gap = 24;

  const darkTextBuffer = await generateTextImage(attractionName, brandColor, height);
  const darkTextMeta = await sharp(darkTextBuffer).metadata();
  const textWidth = darkTextMeta.width ?? 400;

  const totalWidth = textWidth + gap + (poweredByMeta.width ?? 616);

  const logo = await sharp({
    create: { width: totalWidth, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: darkTextBuffer, left: 0, top: 0 },
      { input: poweredByBuffer, left: textWidth + gap, top: 0 },
    ])
    .png()
    .toBuffer();

  const lightTextBuffer = await generateTextImage(attractionName, '#ffffff', height);

  const logoLight = await sharp({
    create: { width: totalWidth, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: lightTextBuffer, left: 0, top: 0 },
      { input: poweredByBuffer, left: textWidth + gap, top: 0 },
    ])
    .png()
    .toBuffer();

  const iconSize = 128;
  const iconFontSize = 80;
  const char = attractionName.charAt(0).toUpperCase();
  const charScale = iconFontSize / FONT.unitsPerEm;
  const glyph = FONT.charToGlyph(char);
  const charWidth = (glyph.advanceWidth ?? 0) * charScale;
  const charX = (iconSize - charWidth) / 2;
  const charY = Math.round(iconSize * 0.72);
  const charPath = glyph.getPath(charX, charY, iconFontSize);
  charPath.fill = 'white';

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}">
    <rect width="${iconSize}" height="${iconSize}" rx="16" fill="${brandColor}"/>
    ${charPath.toSVG(2)}
  </svg>`;

  const logoIcon = await sharp(Buffer.from(iconSvg)).png().toBuffer();

  return { logo, logoLight, logoIcon };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { attractionName?: string };
    const attractionName = (body.attractionName ?? '').trim();
    if (!attractionName) {
      return NextResponse.json({ error: 'attractionName is required' }, { status: 400 });
    }

    const brandColor = await suggestBrandColor(attractionName);
    const { logo, logoLight, logoIcon } = await composeLogos(attractionName, brandColor);

    return NextResponse.json({
      logo: logo.toString('base64'),
      logoLight: logoLight.toString('base64'),
      logoIcon: logoIcon.toString('base64'),
      brandColor,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[generate-logo]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
