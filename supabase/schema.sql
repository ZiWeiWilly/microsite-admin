-- ============================================================
-- microsite-admin Supabase schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Sites table — one row per generated microsite
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text unique not null,
  repo_url text,
  attraction_name text not null,
  klook_url text not null,
  domain text not null,
  affiliate_url text not null,
  base_currency text,
  languages text[],
  colors jsonb,
  head_scripts text,
  vercel_url text,
  pages_url text,
  custom_domain text,
  status text not null default 'generating',
  created_by_email text not null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sites_created_at_idx on public.sites (created_at desc);
create index if not exists sites_status_idx on public.sites (status);
create index if not exists sites_owner_idx on public.sites (created_by_email);

-- Auto-update updated_at on row update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

-- ============================================================
-- Storage bucket for AI Edit screenshots (public read)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ai-edit-screenshots', 'ai-edit-screenshots', true)
on conflict (id) do nothing;

-- ============================================================
-- Notes
-- - This MVP doesn't enable RLS — all access goes through the
--   admin server using the service-role key (bypasses RLS).
--   Authentication is enforced at the Next.js middleware level
--   (only @klook.com emails allowed via NextAuth).
-- - If you later want client-side reads with RLS, enable it with:
--     alter table public.sites enable row level security;
--   and add policies based on auth.email().
-- ============================================================
