'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import type { Site } from '@/app/lib/supabase';
import type { SiteHealth, SitesHealthResponse } from '@/app/lib/types';
import { SiteCard } from '@/app/components/SiteCard';

export default function Dashboard() {
  const { data: session } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [health, setHealth] = useState<Record<string, SiteHealth>>({});
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
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

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/sites/health');
      if (!res.ok) return;
      const data: SitesHealthResponse = await res.json();
      setHealth(data.sites ?? {});
    } catch {
      // best-effort; cards degrade gracefully
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSites().then(fetchHealth);
  }, [fetchSites, fetchHealth]);

  // Poll while any site is active
  useEffect(() => {
    const isActive =
      sites.some((s) => s.status === 'generating' || s.status === 'editing') ||
      Object.values(health).some(
        (h) =>
          h.deployment?.state === 'BUILDING' ||
          h.deployment?.state === 'QUEUED' ||
          h.workflows.some(
            (w) => w.latestRun?.status === 'in_progress' || w.latestRun?.status === 'queued'
          )
      );

    if (!isActive) return;

    const id = setInterval(() => {
      fetchSites();
      fetchHealth();
    }, 15000);
    return () => clearInterval(id);
  }, [sites, health, fetchSites, fetchHealth]);

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }
      `}</style>
      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <h1 style={s.title}>Sites</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {session?.user && (
              <>
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? ''}
                    width={28}
                    height={28}
                    style={{ borderRadius: '50%' }}
                  />
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
        {loading && <p style={s.muted}>Loading sites…</p>}

        {error && (
          <div style={s.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && sites.length === 0 && (
          <div style={s.emptyState}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              No sites yet
            </p>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>
              Generate your first Klook affiliate landing page.
            </p>
            <a href="/new" style={s.newSiteBtn}>+ New site</a>
          </div>
        )}

        {!loading && sites.length > 0 && (
          <div style={s.siteList}>
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                health={health[site.repo_full_name]}
                healthLoading={healthLoading}
              />
            ))}
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  title: { fontSize: 26, fontWeight: 700, color: '#111', margin: 0 },
  signOutBtn: {
    fontSize: 12,
    color: '#888',
    background: 'none',
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  newSiteBtn: {
    display: 'inline-block',
    padding: '8px 18px',
    background: '#0ea5e9',
    color: '#fff',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
  muted: { color: '#888', fontSize: 14 },
  errorBox: {
    padding: 16,
    background: '#fef2f2',
    borderRadius: 8,
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: 14,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
  },
  siteList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
};
