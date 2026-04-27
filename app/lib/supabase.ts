import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const SCREENSHOT_BUCKET = 'ai-edit-screenshots';

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service-role key.
 * Bypasses RLS — never expose this to the browser.
 */
export function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
  }
  if (!cached) {
    cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export interface Site {
  id: string;
  repo_full_name: string;
  repo_url: string | null;
  attraction_name: string;
  klook_url: string;
  domain: string;
  affiliate_url: string;
  base_currency: string | null;
  languages: string[] | null;
  colors: { primary?: string; secondary?: string; accent?: string } | null;
  head_scripts: string | null;
  vercel_url: string | null;
  pages_url: string | null;
  custom_domain: string | null;
  status: 'generating' | 'ready' | 'failed' | 'editing';
  created_by_email: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}
