import { NextResponse } from 'next/server';
import { getRecommendations } from '../../lib/recommend';
import { ALL_LANGUAGE_CODES } from '../../lib/recommend-data';

const SYSTEM_PROMPT = `You are a travel attraction configuration expert. Given a Klook URL and attraction name, determine the best settings for a multilingual microsite.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "countryCode": "TH",
  "countryName": "Thailand",
  "confidence": "high",
  "baseCurrency": "THB",
  "languages": ["en", "th", "zh-CN", "ko", "ja"],
  "colors": {
    "primary": "#0ea5e9",
    "secondary": "#06b6d4",
    "accent": "#f59e0b"
  }
}

Rules:
- countryCode: ISO 3166-1 alpha-2 code
- confidence: "high" if location is clear, "medium" if inferred, "low" if guessing
- baseCurrency: main currency tourists pay in (e.g. THB for Thailand, JPY for Japan)
- languages: choose from ["en","zh-CN","zh-TW","ja","ko","ru","hi","ms","vi","de","fr","lo","es","pt","ar","th","id","it","nl","tr"] only. Build the list as follows:
  1. Always start with "en"
  2. If the destination country's local language appears in the available list above, add it (e.g. "ja" for Japan, "ko" for Korea, "vi" for Vietnam)
  3. Research which countries send the most international tourists to this destination. Add languages spoken by those top visitor-origin countries (from the available list only).
  4. Maximum 6 languages total, no duplicates.
  Example for Thailand: local=th, top tourist sources are China, Korea, Japan → ["en", "th", "zh-CN", "ko", "ja"]
  Example for Japan: local=ja, top sources are China, South Korea, Taiwan, USA → ["en", "ja", "zh-CN", "ko", "zh-TW"]
- colors: choose colors that fit the attraction's theme/vibe (water parks = blues, nature = greens, adventure = oranges/reds, cultural = purples/golds, etc.)`;

async function getAIRecommendation(klookUrl: string, attractionName: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const userMessage = `Klook URL: ${klookUrl}
Attraction Name: ${attractionName || '(not provided)'}

Analyze the URL slug and attraction name to determine the country, currency, recommended languages, and a color theme for the microsite.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://microsite-admin.vercel.app',
      'X-Title': 'Microsite Admin',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.1-pro-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 300,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  // Validate and sanitize
  let validLanguages = (parsed.languages ?? []).filter((l: string) =>
    ALL_LANGUAGE_CODES.includes(l)
  );
  if (!validLanguages.includes('en')) validLanguages.unshift('en');
  validLanguages = validLanguages.slice(0, 6);

  return {
    countryCode: String(parsed.countryCode ?? 'UNKNOWN'),
    countryName: String(parsed.countryName ?? 'Unknown'),
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    baseCurrency: String(parsed.baseCurrency ?? 'USD'),
    languages: validLanguages,
    colors: {
      primary: String(parsed.colors?.primary ?? '#0ea5e9'),
      secondary: String(parsed.colors?.secondary ?? '#06b6d4'),
      accent: String(parsed.colors?.accent ?? '#f59e0b'),
    },
  };
}

export async function POST(request: Request) {
  try {
    const { klookUrl, attractionName } = await request.json();

    if (!klookUrl) {
      return NextResponse.json({ error: 'klookUrl is required' }, { status: 400 });
    }

    // Try AI-powered recommendation first
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const aiResult = await getAIRecommendation(klookUrl, attractionName ?? '');
        return NextResponse.json({ ...aiResult, source: 'ai' });
      } catch (aiError) {
        console.warn('AI recommendation failed, falling back to keyword map:', aiError);
      }
    }

    // Fallback: keyword map
    const result = getRecommendations(klookUrl, attractionName ?? '');
    return NextResponse.json({ ...result, source: 'keyword' });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
