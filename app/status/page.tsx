'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface JobStep {
  name: string;
  status: string;
  conclusion: string | null;
}

interface Job {
  name: string;
  status: string;
  conclusion: string | null;
  steps: JobStep[];
}

interface StatusData {
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  workflowName: string;
  jobs: Job[];
  siteUrl?: string;
  previewUrl?: string;
  previewState?: string;
  previewCommitSha?: string;
  prNumber?: number;
  prUrl?: string;
  branchName?: string;
  message?: string;
  error?: string;
}

// null = hidden from users
const STEP_LABELS: Record<string, string | null> = {
  'Set up job': null,
  'Complete job': null,
  'Run actions/checkout@v4': 'Cloning template repository',
  'Install dependencies': 'Installing dependencies',
  'Write config file': 'Applying your configuration',
  'Generate site content': 'Generating site content with AI ✨',
  'Build site': 'Building site',
  'Generate sitemap': 'Generating sitemap',
  'Commit generated content to main': 'Saving generated content',
  'Deploy to Vercel': 'Deploying to Vercel',
};

const EDIT_STEP_LABELS: Record<string, string | null> = {
  'Set up job': null,
  'Complete job': null,
  'Run actions/checkout@v4': 'Cloning your repository',
  'Prepare branch': 'Preparing edit branch',
  'Download screenshot': 'Loading your reference screenshot',
  'Run Claude Code': 'AI is editing your site ✨',
  'Commit and push': 'Committing changes',
  'Ensure PR exists': 'Opening pull request',
};

function getFriendlyStepName(name: string, type: 'generate' | 'edit'): string | null {
  const labels = type === 'edit' ? EDIT_STEP_LABELS : STEP_LABELS;
  if (name in labels) return labels[name];
  if (/^Set up Node/i.test(name)) return 'Setting up environment';
  return name;
}

function useElapsed(createdAt: string | undefined): string {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!createdAt) return;
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      if (diff < 60) setElapsed(`${diff}s`);
      else setElapsed(`${Math.floor(diff / 60)}m ${diff % 60}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  return elapsed;
}

function StepIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (conclusion === 'success') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="10" cy="10" r="10" fill="#22c55e" />
        <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (conclusion === 'failure') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="10" cy="10" r="10" fill="#ef4444" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (conclusion === 'skipped') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="10" cy="10" r="10" fill="#d1d5db" />
        <path d="M7 10h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'in_progress') {
    return <span className="spinner" style={{ flexShrink: 0 }} />;
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9" stroke="#d1d5db" strokeWidth="2" />
    </svg>
  );
}

function StatusContent() {
  const searchParams = useSearchParams();
  const repo = searchParams.get('repo');
  const type = searchParams.get('type') === 'edit' ? 'edit' : 'generate';
  const initialPageUrl = searchParams.get('pageUrl') || '';
  const [data, setData] = useState<StatusData | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionBusy, setActionBusy] = useState<'approve' | 'discard' | 'refine' | null>(null);
  const [showRefine, setShowRefine] = useState(false);
  const [refinePageUrl, setRefinePageUrl] = useState(initialPageUrl);
  const [refineRequirements, setRefineRequirements] = useState('');
  const [refineAreaDescription, setRefineAreaDescription] = useState('');
  const [refineScreenshot, setRefineScreenshot] = useState<File | null>(null);
  const [merged, setMerged] = useState(false);
  const elapsed = useElapsed(data?.createdAt);

  const fetchStatus = useCallback(async () => {
    if (!repo) return;
    try {
      const res = await fetch(`/api/status?repo=${encodeURIComponent(repo)}&type=${type}`);
      const json = await res.json();
      if (json.error) setFetchError(json.error);
      else {
        setData(json);
        setFetchError('');
      }
    } catch {
      setFetchError('Failed to fetch status');
    }
  }, [repo, type]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (data?.status === 'completed') return;
      fetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, data?.status]);

  const visibleSteps = data?.jobs?.flatMap(job =>
    (job.steps ?? []).flatMap(step => {
      const label = getFriendlyStepName(step.name, type);
      return label ? [{ ...step, label }] : [];
    })
  ) ?? [];

  const completedCount = visibleSteps.filter(
    s => s.conclusion === 'success' || s.conclusion === 'skipped'
  ).length;
  const totalCount = visibleSteps.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const isCompleted = data?.status === 'completed';
  const isSuccess = data?.conclusion === 'success';
  const isFailure = data?.conclusion === 'failure';
  const activeStepLabel = visibleSteps.find(s => s.status === 'in_progress')?.label;
  const previewReady = data?.previewState === 'READY' && !!data.previewUrl;
  const hasOpenEditPr = type === 'edit' && Boolean(data?.prNumber);

  useEffect(() => {
    if (type !== 'edit') return;
    if (showRefine) return;
    if (!data) return;
    if (!refinePageUrl && data.siteUrl) {
      setRefinePageUrl(data.siteUrl);
    }
  }, [data, type, showRefine, refinePageUrl]);

  async function handleApprove() {
    if (!repo || !data?.prNumber) return;
    setActionBusy('approve');
    setActionError('');
    setActionMessage('');
    try {
      const res = await fetch('/api/edit/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, prNumber: data.prNumber }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `Approve failed: ${res.status}`);
      setMerged(true);
      setShowRefine(false);
      setActionMessage('Merged successfully. Production deployment is starting.');
      await fetchStatus();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to merge PR');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDiscard() {
    if (!repo || !data?.prNumber) return;
    const confirmed = window.confirm('Discard this AI edit? This will close the PR and delete its branch.');
    if (!confirmed) return;
    setActionBusy('discard');
    setActionError('');
    setActionMessage('');
    try {
      const res = await fetch('/api/edit/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, prNumber: data.prNumber, branch: data.branchName }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `Discard failed: ${res.status}`);
      setActionMessage('AI edit discarded.');
      window.location.href = '/';
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to discard PR');
      setActionBusy(null);
    }
  }

  function handleRefineScreenshot(file: File | null) {
    if (!file) {
      setRefineScreenshot(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionError('Screenshot exceeds 5 MB. Please use a smaller file.');
      return;
    }
    setActionError('');
    setRefineScreenshot(file);
  }

  async function handleRefineSubmit() {
    if (!refinePageUrl.trim()) {
      setActionError('Please enter the page URL to refine.');
      return;
    }
    if (!refineRequirements.trim()) {
      setActionError('Please describe what should change in this refinement.');
      return;
    }
    setActionBusy('refine');
    setActionError('');
    setActionMessage('');
    try {
      const formData = new FormData();
      formData.append('repo', repo || '');
      formData.append('pageUrl', refinePageUrl.trim());
      formData.append('requirements', refineRequirements.trim());
      if (refineAreaDescription.trim()) formData.append('areaDescription', refineAreaDescription.trim());
      if (refineScreenshot) formData.append('screenshot', refineScreenshot);
      if (data?.branchName) {
        formData.append('previousSummary', `Continue refining branch ${data.branchName}.`);
      }
      const res = await fetch('/api/edit', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `Refine failed: ${res.status}`);
      setShowRefine(false);
      setRefineRequirements('');
      setRefineAreaDescription('');
      setRefineScreenshot(null);
      setMerged(false);
      setActionMessage('Refinement dispatched. Preview will update after workflow completes.');
      await fetchStatus();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to dispatch refinement');
    } finally {
      setActionBusy(null);
    }
  }

  if (!repo) {
    return (
      <div style={s.container}>
        <div style={s.card}><p style={{ color: '#888' }}>No repository specified.</p></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          display: inline-block;
          width: 20px; height: 20px;
          border: 2.5px solid #e5e7eb;
          border-top-color: #f59e0b;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div style={s.container}>
        <a href="/" style={s.backLink}>&larr; Dashboard</a>
        <div style={s.card}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={s.title}>{type === 'edit' ? 'AI Edit Progress' : 'Site Generation Progress'}</h1>
            <p style={s.subtitle}>{repo}</p>
          </div>

          {fetchError && (
            <div style={s.errorBox}>
              <strong>Error:</strong> {fetchError}
            </div>
          )}
          {actionError && (
            <div style={s.errorBox}>
              <strong>Error:</strong> {actionError}
            </div>
          )}
          {actionMessage && (
            <div style={s.infoBox}>
              {actionMessage}
            </div>
          )}

          {!data && !fetchError && (
            <p style={{ color: '#888' }}>Loading status...</p>
          )}

          {data?.status === 'no_runs' && (
            <div style={s.failureBox}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No workflow run yet</p>
              <p style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 10 }}>
                The repo was created, but the build workflow has not started.
                This usually means the GitHub token is missing the
                {' '}<code>workflow</code> / <code>Actions: read & write</code> permission.
                You can trigger it manually from the Actions tab.
              </p>
              <p style={{ fontSize: 13, color: '#7f1d1d' }}>
                Please contact your technical team to trigger the workflow.
              </p>
            </div>
          )}

          {data && data.status !== 'no_runs' && (
            <>
              {/* Status + elapsed */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={s.badge(data.conclusion)}>
                  {isSuccess ? 'Completed' : isFailure ? 'Failed' : 'In Progress'}
                </span>
                {elapsed && (
                  <span style={{ fontSize: 13, color: '#888' }}>
                    {isCompleted ? `Finished in ${elapsed}` : `Running for ${elapsed}`}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {totalCount > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#555' }}>
                      {isCompleted && isSuccess
                        ? 'All steps completed'
                        : activeStepLabel
                          ? activeStepLabel
                          : `${completedCount} of ${totalCount} steps done`}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{progress}%</span>
                  </div>
                  <div style={s.progressTrack}>
                    <div style={s.progressFill(progress, isSuccess, isFailure)} />
                  </div>
                </div>
              )}

              {/* Steps */}
              <ul style={s.stepList}>
                {visibleSteps.map((step, i) => {
                  const isActive = step.status === 'in_progress';
                  return (
                    <li key={i} style={{ ...s.stepItem, background: isActive ? '#fffbeb' : 'transparent' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StepIcon status={step.status} conclusion={step.conclusion} />
                        <span style={{
                          fontSize: 14,
                          color: step.conclusion === 'failure' ? '#dc2626' : isActive ? '#92400e' : step.conclusion === null && step.status !== 'in_progress' ? '#9ca3af' : '#111',
                          fontWeight: isActive ? 600 : 400,
                        }}>
                          {step.label}
                        </span>
                      </span>
                      {step.conclusion === 'failure' && (
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>Failed</span>
                      )}
                      {isActive && (
                        <span style={{ fontSize: 12, color: '#92400e', fontWeight: 500 }}>Running…</span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Success */}
              {isSuccess && (
                type === 'edit' ? (
                  <div style={s.successBox}>
                    <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                      {merged ? 'Merged to production' : 'AI changes are ready for review'}
                    </p>
                    {hasOpenEditPr && (
                      <p style={{ fontSize: 13, color: '#166534', marginBottom: 10 }}>
                        PR #{data?.prNumber}
                        {data?.prUrl ? (
                          <>
                            {' '}· <a href={data.prUrl} target="_blank" rel="noopener" style={s.link}>Open PR</a>
                          </>
                        ) : null}
                      </p>
                    )}

                    {data?.previewUrl ? (
                      <div style={s.previewPanel}>
                        <p style={{ marginBottom: 6, fontSize: 13, color: '#166534' }}>
                          Preview status: {data.previewState || 'UNKNOWN'}
                        </p>
                        <a href={data.previewUrl} target="_blank" rel="noopener" style={{ ...s.link, fontWeight: 600 }}>
                          Open preview ↗
                        </a>
                      </div>
                    ) : data?.previewState === 'UNAVAILABLE' ? (
                      <p style={{ fontSize: 13, color: '#166534', marginBottom: 10 }}>
                        Preview is unavailable because `VERCEL_TOKEN` is not configured on microsite-admin.
                      </p>
                    ) : (
                      <p style={{ fontSize: 13, color: '#166534', marginBottom: 10 }}>
                        Preview deployment is still being prepared. Keep this page open and it will refresh automatically.
                      </p>
                    )}

                    {!merged && hasOpenEditPr && (
                      <div style={s.actionRow}>
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={!previewReady || actionBusy !== null}
                          style={s.primaryButton(actionBusy !== null || !previewReady)}
                        >
                          {actionBusy === 'approve' ? 'Merging…' : 'Approve & Merge'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRefine(v => !v)}
                          disabled={actionBusy !== null}
                          style={s.secondaryButton(actionBusy !== null)}
                        >
                          {showRefine ? 'Cancel Refine' : 'Refine'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDiscard}
                          disabled={actionBusy !== null}
                          style={s.dangerButton(actionBusy !== null)}
                        >
                          {actionBusy === 'discard' ? 'Discarding…' : 'Discard'}
                        </button>
                      </div>
                    )}

                    {showRefine && (
                      <div style={s.refineBox}>
                        <p style={{ fontSize: 13, color: '#166534', marginBottom: 8 }}>
                          Add more instructions. The AI will continue on the same PR branch.
                        </p>
                        <input
                          type="url"
                          value={refinePageUrl}
                          onChange={e => setRefinePageUrl(e.target.value)}
                          placeholder="https://your-site.vercel.app/path"
                          style={s.input}
                          disabled={actionBusy !== null}
                        />
                        <input
                          type="text"
                          value={refineAreaDescription}
                          onChange={e => setRefineAreaDescription(e.target.value)}
                          placeholder="Area to adjust (optional)"
                          style={{ ...s.input, marginTop: 8 }}
                          disabled={actionBusy !== null}
                        />
                        <textarea
                          value={refineRequirements}
                          onChange={e => setRefineRequirements(e.target.value)}
                          placeholder="What should change in this refinement?"
                          style={{ ...s.textarea, marginTop: 8 }}
                          rows={4}
                          disabled={actionBusy !== null}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleRefineScreenshot(e.target.files?.[0] ?? null)}
                          style={{ ...s.fileInput, marginTop: 8 }}
                          disabled={actionBusy !== null}
                        />
                        <button
                          type="button"
                          onClick={handleRefineSubmit}
                          disabled={actionBusy !== null}
                          style={{ ...s.primaryButton(actionBusy !== null), marginTop: 10 }}
                        >
                          {actionBusy === 'refine' ? 'Dispatching refinement…' : 'Submit refinement'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={s.successBox}>
                    <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Your site is live!</p>
                    {data.siteUrl && (
                      <p style={{ marginBottom: 8 }}>
                        <a href={data.siteUrl} target="_blank" rel="noopener" style={{ ...s.link, fontWeight: 600 }}>
                          {data.siteUrl} &rarr;
                        </a>
                      </p>
                    )}
                    <p style={{ fontSize: 13, color: '#166534', marginBottom: 12 }}>
                      It may take a few minutes for the site to be fully accessible.
                    </p>
                    {repo && (
                      <a
                        href={`/edit?repo=${encodeURIComponent(repo)}${data.siteUrl ? `&siteUrl=${encodeURIComponent(data.siteUrl)}` : ''}`}
                        style={s.editButton}
                      >
                        ✨ Edit this site with AI
                      </a>
                    )}
                  </div>
                )
              )}

              {/* Failure */}
              {isFailure && (
                <div style={s.failureBox}>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                    {type === 'edit' ? 'AI edit failed' : 'Generation failed'}
                  </p>
                  <p style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 10 }}>
                    Something went wrong during the process. Please check the details on GitHub or contact your technical team.
                  </p>
                  <p style={{ fontSize: 13, color: '#7f1d1d', margin: 0 }}>
                    Please contact your technical team for details.
                  </p>
                </div>
              )}

              {/* Polling notice */}
              {!isCompleted && (
                <p style={{ fontSize: 12, color: '#aaa', marginTop: 20, textAlign: 'center' as const }}>
                  Auto-refreshing every 10 seconds
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const s = {
  container: { maxWidth: 640, margin: '0 auto', padding: '40px 20px' },
  card: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  title: { fontSize: 22, fontWeight: 700 as const, marginBottom: 4, color: '#111' },
  subtitle: { fontSize: 13, color: '#888', fontFamily: 'monospace' },
  backLink: { display: 'inline-block', marginBottom: 16, color: '#0ea5e9', textDecoration: 'none' as const, fontSize: 14 },
  link: { color: '#0ea5e9', textDecoration: 'none' as const },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: 12,
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  fileInput: { display: 'block', fontSize: 14, color: '#555' },
  badge: (conclusion: string | null) => ({
    display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 as const,
    background: conclusion === 'success' ? '#dcfce7' : conclusion === 'failure' ? '#fee2e2' : '#fef3c7',
    color: conclusion === 'success' ? '#166534' : conclusion === 'failure' ? '#dc2626' : '#92400e',
  }),
  progressTrack: { height: 8, borderRadius: 99, background: '#f3f4f6', overflow: 'hidden' as const },
  progressFill: (pct: number, success: boolean, failure: boolean) => ({
    height: '100%',
    width: `${pct}%`,
    borderRadius: 99,
    background: success ? '#22c55e' : failure ? '#ef4444' : '#f59e0b',
    transition: 'width 0.5s ease',
  }),
  stepList: { listStyle: 'none' as const, padding: 0, margin: '0 0 8px 0' },
  stepItem: {
    padding: '10px 8px', borderBottom: '1px solid #f3f4f6',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 6,
  },
  actionRow: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' as const },
  primaryButton: (disabled: boolean) => ({
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600 as const,
    background: disabled ? '#93c5fd' : '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
  }),
  secondaryButton: (disabled: boolean) => ({
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600 as const,
    background: disabled ? '#e5e7eb' : '#f3f4f6',
    color: '#111827',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
  }),
  dangerButton: (disabled: boolean) => ({
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600 as const,
    background: disabled ? '#fecaca' : '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
  }),
  previewPanel: {
    marginBottom: 10,
    padding: 10,
    background: '#ecfeff',
    border: '1px solid #a5f3fc',
    borderRadius: 8,
  },
  refineBox: {
    marginTop: 12,
    padding: 12,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
  },
  successBox: { marginTop: 20, padding: 20, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' },
  editButton: {
    display: 'inline-block', padding: '10px 18px', fontSize: 14, fontWeight: 600 as const,
    background: '#0ea5e9', color: '#fff', borderRadius: 8,
    textDecoration: 'none' as const, marginTop: 4,
  },
  infoBox: {
    padding: 12,
    background: '#eff6ff',
    borderRadius: 8,
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    marginBottom: 16,
    fontSize: 13,
  },
  failureBox: { marginTop: 20, padding: 20, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' },
  errorBox: { padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626', marginBottom: 16 },
};

export default function StatusPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
        <p style={{ color: '#888' }}>Loading...</p>
      </div>
    }>
      <StatusContent />
    </Suspense>
  );
}
