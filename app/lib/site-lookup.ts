import { getSupabase, type Site } from './supabase';

export function normalizeUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

export function extractHost(raw: string): string {
  const normalized = normalizeUrl(raw);
  return normalized.split('/')[0];
}

export async function lookupSiteByUrl(url: string): Promise<Site | null> {
  const host = extractHost(url);
  if (!host) return null;

  const supabase = getSupabase();
  const { data } = await supabase
    .from('sites')
    .select('*')
    .or(
      `domain.eq.${host},` +
      `vercel_url.ilike.%${host}%,` +
      `pages_url.ilike.%${host}%,` +
      `custom_domain.ilike.%${host}%`
    )
    .limit(1)
    .maybeSingle();

  return (data as Site | null) ?? null;
}
