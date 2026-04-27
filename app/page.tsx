'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import type { Site } from '@/app/lib/supabase';

const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string; label: string }> = {
  generating: { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'Generating' },
  editing:    { bg: '#ede9fe', color: '#5b21b6', border: '#ddd6fe', label: 'Editing' },
  ready:      { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', label: 'Ready' },
  failed:     { bg: '#fee2e2', color: '#dc2626', border: '#fecaca', label: 'Failed' },
};

function StatusBadge({ status }: { status: Site['status'] }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SiteCard({ site }: { site: Site }) {
  const siteUrl = site.vercel_url ?? site.pages_url ?? site.custom_domain ?? null;
  const isActive = site.status === 'generating' || site.status === 'editing';

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <StatusBadge status={site.status} />
            {isActive && <span style={{ fontSize: 11, color: '#888' }}>auto-refreshing</span>}
          </div>
          <h2 style={s.siteName}>{site.attraction_name}</h2>
          <p style={s.siteDomain}>{site.domain}</p>
        </div>
        {siteUrl && (
          <a href={siteUrl} target="_blank" rel="noopener" style={s.openSiteBtn}>
            Open site ↗
          </a>
        )}
      </div>

      <div style={s.meta}>
        {site.created_by_name ?? site.created_by_email}
        {' · '}
        {formatDate(site.created_at)}
      </div>

      <div style={s.actions}>
        <a
          href={`/status?repo=${encodeURIComponent(site.repo_full_name)}`}
          style={s.actionBtn}
        >
          View status
        </a>
        <a
          href={`/edit?repo=${encodeURIComponent(site.repo_full_name)}${siteUrl ? `&siteUrl=${encodeURIComponent(siteUrl)}` : ''}`}
          style={s.actionBtn}
        >
          Edit with AI
        </a>
        {site.repo_url && (
          <a href={site.repo_url} target="_blank" rel="noopener" style={s.actionBtn}>
            Repo ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      if (data.error) setError(data.error);
      else setSites(data.sites ?? []);
    } catch {
      setError('Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  // Poll while any site is in-progress
  useEffect(() => {
    const hasActive = sites.some(s => s.status === 'generating' || s.status === 'editing');
    if (!hasActive) return;
    const id = setInterval(fetchSites, 15000);
    return () => clearInterval(id);
  }, [sites, fetchSites]);

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <h1 style={s.title}>Sites</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {session?.user && (
              <>
                {session.user.image && (
                  <img src={session.user.image} alt={session.user.name ?? ''} width={28} height={28} style={{ borderRadius: '50%' }} />
                )}
                <span style={{ fontSize: 13, color: '#555' }}>{session.user.email}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  style={s.signOutBtn}
                >
                  Sign out
                </button>
              </>
            )}
            <a href="/new" style={s.newSiteBtn}>+ New site</a>
          </div>
        </div>

        {/* Content */}
        {loading && <p style={s.muted}>Loading sites...</p>}

        {error && (
          <div style={s.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && sites.length === 0 && (
          <div style={s.emptyState}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>No sites yet</p>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>Generate your first Klook affiliate landing page.</p>
            <a href="/new" style={s.newSiteBtn}>+ New site</a>
          </div>
        )}

        {!loading && sites.length > 0 && (
          <div style={s.siteList}>
            {sites.map(site => <SiteCard key={site.id} site={site} />)}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: 800, margin: '0 auto', padding: '40px 20px' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 32, flexWrap: 'wrap' as const, gap: 12,
  },
  title: { fontSize: 26, fontWeight: 700, color: '#111', margin: 0 },
  signOutBtn: {
    fontSize: 12, color: '#888', background: 'none', border: '1px solid #e0e0e0',
    borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
  },
  newSiteBtn: {
    display: 'inline-block', padding: '8px 18px', background: '#0ea5e9',
    color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
  },
  muted: { color: '#888', fontSize: 14 },
  errorBox: {
    padding: 16, background: '#fef2f2', borderRadius: 8,
    border: '1px solid #fecaca', color: '#dc2626', fontSize: 14,
  },
  emptyState: {
    textAlign: 'center' as const, padding: '60px 20px',
    background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
  },
  siteList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  card: {
    background: '#fff', borderRadius: 12, padding: 20,
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  siteName: { fontSize: 17, fontWeight: 700, color: '#111', margin: '4px 0 2px' },
  siteDomain: { fontSize: 13, color: '#888', margin: 0, fontFamily: 'monospace' },
  meta: { fontSize: 12, color: '#aaa', marginTop: 4, marginBottom: 12 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  actionBtn: {
    display: 'inline-block', padding: '6px 14px', fontSize: 13, fontWeight: 500,
    color: '#0ea5e9', background: '#f0f9ff', border: '1px solid #bae6fd',
    borderRadius: 6, textDecoration: 'none',
  },
  openSiteBtn: {
    display: 'inline-block', padding: '6px 14px', fontSize: 13, fontWeight: 600,
    color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0',
    borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' as const,
  },
};
