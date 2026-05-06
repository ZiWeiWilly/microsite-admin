'use client';

import type { Site } from '@/app/lib/supabase';
import type { SiteHealth } from '@/app/lib/types';
import {
  DeploymentBadge,
  DeploymentBadgeSkeleton,
  WorkflowChip,
  WorkflowChipSkeleton,
  WorkflowErrorChip,
} from './StatusBadges';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface SiteCardProps {
  site: Site;
  health: SiteHealth | undefined;
  healthLoading: boolean;
}

export function SiteCard({ site, health, healthLoading }: SiteCardProps) {
  const siteUrl = site.vercel_url ?? site.pages_url ?? site.custom_domain ?? null;

  const githubError = health?.errors?.find((e) => e.source === 'github');
  const vercelError = health?.errors?.find((e) => e.source === 'vercel');

  return (
    <div style={s.card}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Deployment badge */}
          <div style={{ marginBottom: 4 }}>
            {healthLoading && !health ? (
              <DeploymentBadgeSkeleton />
            ) : (
              <DeploymentBadge
                deployment={vercelError ? null : (health?.deployment ?? null)}
              />
            )}
          </div>
          <h2 style={s.siteName}>{site.attraction_name}</h2>
          <p style={s.siteDomain}>{site.domain}</p>
        </div>

        {siteUrl && (
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" style={s.openSiteBtn}>
            Open site ↗
          </a>
        )}
      </div>

      {/* Workflow chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, minHeight: 28, alignItems: 'center' }}>
        {healthLoading && !health ? (
          <>
            <WorkflowChipSkeleton />
            <WorkflowChipSkeleton />
          </>
        ) : githubError ? (
          <WorkflowErrorChip message={githubError.message} />
        ) : health && health.workflows.length > 0 ? (
          health.workflows.map((wf) => (
            <WorkflowChip key={wf.workflowFile} workflow={wf} />
          ))
        ) : null}
      </div>

      {/* Meta */}
      <div style={s.meta}>
        {site.created_by_name ?? site.created_by_email}
        {' · '}
        {formatDate(site.created_at)}
      </div>

      {/* Actions */}
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
          <a href={site.repo_url} target="_blank" rel="noopener noreferrer" style={s.actionBtn}>
            Repo ↗
          </a>
        )}
      </div>
    </div>
  );
}

const s = {
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  siteName: { fontSize: 17, fontWeight: 700, color: '#111', margin: '4px 0 2px' },
  siteDomain: { fontSize: 13, color: '#888', margin: 0, fontFamily: 'monospace' },
  meta: { fontSize: 12, color: '#aaa', marginTop: 4, marginBottom: 12 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  actionBtn: {
    display: 'inline-block',
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: '#0ea5e9',
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 6,
    textDecoration: 'none',
  },
  openSiteBtn: {
    display: 'inline-block',
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: '#166534',
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  },
};
