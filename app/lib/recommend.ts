import {
  CITY_COUNTRY_MAP,
  COMPOUND_TOKENS,
  COUNTRY_RECOMMENDATIONS,
  DEFAULT_RECOMMENDATION,
  CATEGORY_PALETTES,
  DEFAULT_COLORS,
} from './recommend-data';

export interface RecommendResult {
  countryCode: string;
  countryName: string;
  confidence: 'high' | 'medium' | 'low';
  baseCurrency: string;
  languages: string[];
  colors: { primary: string; secondary: string; accent: string };
}

/** Extract slug tokens from a Klook URL path */
export function parseKlookUrl(url: string): string[] {
  try {
    const { pathname } = new URL(url);
    // Strip locale prefix like /en-US/ or /zh-TW/
    const cleaned = pathname.replace(/^\/[a-z]{2}(-[A-Za-z]{2,4})?\//i, '/');
    // Match /activity/12345-slug-here/ pattern
    const match = cleaned.match(/\/activity\/\d+-([\w-]+)/);
    if (!match) return [];
    return match[1].toLowerCase().split('-').filter(Boolean);
  } catch {
    return [];
  }
}

/** Tokenize a name into lowercase words */
function tokenizeName(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/[\s-]+/).filter(Boolean);
}

/** Detect country from URL and attraction name */
export function detectCountry(
  klookUrl: string,
  attractionName: string
): { countryCode: string; countryName: string; confidence: 'high' | 'medium' | 'low' } {
  const urlTokens = parseKlookUrl(klookUrl);
  const slug = urlTokens.join('-');

  // Check compound tokens first (hong-kong, kuala-lumpur, etc.)
  for (const [compound, code] of Object.entries(COMPOUND_TOKENS)) {
    if (slug.includes(compound)) {
      const rec = COUNTRY_RECOMMENDATIONS[code];
      return { countryCode: code, countryName: rec?.countryName ?? code, confidence: 'high' };
    }
  }

  // Check individual URL tokens
  for (const token of urlTokens) {
    const code = CITY_COUNTRY_MAP[token];
    if (code) {
      const rec = COUNTRY_RECOMMENDATIONS[code];
      return { countryCode: code, countryName: rec?.countryName ?? code, confidence: 'high' };
    }
  }

  // Fall back to attraction name tokens
  const nameTokens = tokenizeName(attractionName);
  const nameSlug = nameTokens.join('-');

  for (const [compound, code] of Object.entries(COMPOUND_TOKENS)) {
    if (nameSlug.includes(compound)) {
      const rec = COUNTRY_RECOMMENDATIONS[code];
      return { countryCode: code, countryName: rec?.countryName ?? code, confidence: 'medium' };
    }
  }

  for (const token of nameTokens) {
    const code = CITY_COUNTRY_MAP[token];
    if (code) {
      const rec = COUNTRY_RECOMMENDATIONS[code];
      return { countryCode: code, countryName: rec?.countryName ?? code, confidence: 'medium' };
    }
  }

  return { countryCode: 'DEFAULT', countryName: DEFAULT_RECOMMENDATION.countryName, confidence: 'low' };
}

/** Detect category-based color palette from URL and name keywords */
export function detectColors(
  klookUrl: string,
  attractionName: string
): { primary: string; secondary: string; accent: string } {
  const tokens = [
    ...parseKlookUrl(klookUrl),
    ...tokenizeName(attractionName),
  ];

  let bestMatch = { palette: DEFAULT_COLORS, score: 0 };

  for (const category of CATEGORY_PALETTES) {
    const score = category.keywords.reduce(
      (sum, kw) => sum + (tokens.includes(kw) ? 1 : 0),
      0
    );
    if (score > bestMatch.score) {
      bestMatch = { palette: category.colors, score };
    }
  }

  return bestMatch.palette;
}

/** Get full recommendations from Klook URL and attraction name */
export function getRecommendations(klookUrl: string, attractionName: string): RecommendResult {
  const country = detectCountry(klookUrl, attractionName);
  const rec = COUNTRY_RECOMMENDATIONS[country.countryCode] ?? DEFAULT_RECOMMENDATION;
  const colors = detectColors(klookUrl, attractionName);

  return {
    countryCode: country.countryCode,
    countryName: country.countryName,
    confidence: country.confidence,
    baseCurrency: rec.baseCurrency,
    languages: rec.languages,
    colors,
  };
}
