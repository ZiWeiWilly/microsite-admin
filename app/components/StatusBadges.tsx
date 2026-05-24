'use client';

import type { DeploymentInfo, WorkflowSummary } from '@/app/lib/types';

// ─── Deployment badge ────────────────────────────────────────────────────────

const DEPLOYMENT_CFG = {
  READY:      { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', label: 'Live · Ready' },
  BUILDING:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'Building…' },
  QUEUED:     { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'Queued' },
  ERROR:      { bg: '#fee2e2', color: '#dc2626', border: '#fecaca', label: 'Build failed' },
  CANCELED:   { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb', label: 'Cancelled' },
  UNKNOWN:    { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb', label: 'Unknown' },
  NOT_LINKED: { bg: '#f3f4f6', color: '#9ca3af', border: '#e5e7eb', label: 'Not linked' },
} as const;

export function DeploymentBadge({ deployment }: { deployment: DeploymentInfo | null }) {
  if (!deployment) {
    return (
      <span style={skeletonStyle} aria-label="Loading deployment status" />
    );
  }
  const cfg = DEPLOYMENT_CFG[deployment.state] ?? DEPLOYMENT_CFG.UNKNOWN;
  const isActive = deployment.state === 'BUILDING' || deployment.state === 'QUEUED';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
      title={deployment.url ?? undefined}
    >
      {isActive && <SpinnerIcon color={cfg.color} />}
      {cfg.label}
    </span>
  );
}

// ─── Workflow chip ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CHIP_CFG = {
  success:    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', icon: '✓' },
  failure:    { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '✗' },
  cancelled:  { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb', icon: '–' },
  skipped:    { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb', icon: '–' },
  timed_out:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '✗' },
  in_progress:{ bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: '⟳' },
  queued:     { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: '⏸' },
  no_runs:    { bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb', icon: '—' },
} as const;

type ChipKey = keyof typeof CHIP_CFG;

function resolveChipKey(workflow: WorkflowSummary): ChipKey {
  const run = workflow.latestRun;
  if (!run) return 'no_runs';
  if (run.status === 'queued') return 'queued';
  if (run.status === 'in_progress') return 'in_progress';
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure') return 'failure';
  if (run.conclusion === 'cancelled') return 'cancelled';
  if (run.conclusion === 'skipped') return 'skipped';
  if (run.conclusion === 'timed_out') return 'timed_out';
  return 'no_runs';
}

export function WorkflowChip({ workflow, statusHref }: { workflow: WorkflowSummary; statusHref?: string }) {
  const key = resolveChipKey(workflow);
  const cfg = CHIP_CFG[key];
  const run = workflow.latestRun;
  const isSpinning = key === 'in_progress';

  const label = workflow.workflowName
    .replace(/^Generate and Deploy$/i, 'Generate')
    .replace(/^AI Edit$/i, 'AI Edit');

  const chip = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 500,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap' as const,
      }}
      title={
        run
          ? `${workflow.workflowName} · ${run.headBranch} · ${relativeTime(run.createdAt)}`
          : `${workflow.workflowName} · no runs yet`
      }
    >
      {isSpinning ? <SpinnerIcon color={cfg.color} /> : <span>{cfg.icon}</span>}
      <span>{label}</span>
      {run && (
        <span style={{ opacity: 0.7, fontSize: 10 }}>
          {relativeTime(run.createdAt)}
        </span>
      )}
    </span>
  );

  const href = statusHref ?? run?.runUrl;
  if (href) {
    return (
      <a
        href={href}
        target={statusHref ? '_self' : '_blank'}
        rel={statusHref ? undefined : 'noopener noreferrer'}
        style={{ textDecoration: 'none' }}
      >
        {chip}
      </a>
    );
  }

  return chip;
}

// ─── Skeleton chips ───────────────────────────────────────────────────────────

export function WorkflowChipSkeleton() {
  return <span style={{ ...skeletonStyle, width: 80, height: 22, borderRadius: 99 }} />;
}

export function DeploymentBadgeSkeleton() {
  return <span style={{ ...skeletonStyle, width: 90, height: 22, borderRadius: 99 }} />;
}

// ─── Error chip ───────────────────────────────────────────────────────────────

export function WorkflowErrorChip({ message }: { message: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 500,
        background: '#fff7ed',
        color: '#c2410c',
        border: '1px solid #fed7aa',
        cursor: 'default',
      }}
      title={message}
    >
      ! status unavailable
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const skeletonStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#e5e7eb',
  borderRadius: 4,
  width: 60,
  height: 20,
  verticalAlign: 'middle',
  opacity: 0.6,
  animation: 'pulse 1.5s ease-in-out infinite',
};

function SpinnerIcon({ color }: { color: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
