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
  runUrl: string;
  createdAt: string;
  updatedAt: string;
  workflowName: string;
  jobs: Job[];
  siteUrl?: string;
  message?: string;
  error?: string;
}

function StatusContent() {
  const searchParams = useSearchParams();
  const repo = searchParams.get('repo');
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    if (!repo) return;
    try {
      const res = await fetch(`/api/status?repo=${encodeURIComponent(repo)}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch {
      setError('Failed to fetch status');
    }
  }, [repo]);

  useEffect(() => {
    fetchStatus();
    // Poll every 10 seconds while in progress
    const interval = setInterval(() => {
      if (data?.status === 'completed') return;
      fetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, data?.status]);

  const styles = {
    container: { maxWidth: 720, margin: '0 auto', padding: '40px 20px' },
    card: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    title: { fontSize: 24, fontWeight: 700 as const, marginBottom: 8, color: '#111' },
    subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
    statusBadge: (status: string, conclusion: string | null) => ({
      display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 as const,
      background: conclusion === 'success' ? '#dcfce7' : conclusion === 'failure' ? '#fef2f2' : '#fef3c7',
      color: conclusion === 'success' ? '#166534' : conclusion === 'failure' ? '#dc2626' : '#92400e',
    }),
    stepList: { listStyle: 'none' as const, padding: 0, margin: '16px 0' },
    stepItem: { padding: '8px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    stepIcon: (status: string, conclusion: string | null) => ({
      width: 20, height: 20, borderRadius: '50%', display: 'inline-block',
      background: conclusion === 'success' ? '#22c55e' : conclusion === 'failure' ? '#ef4444' : status === 'in_progress' ? '#f59e0b' : '#d1d5db',
      marginRight: 8, verticalAlign: 'middle',
    }),
    success: { marginTop: 24, padding: 20, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' },
    error: { marginTop: 20, padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626' },
    link: { color: '#0ea5e9', textDecoration: 'none' as const },
    backLink: { display: 'block', marginBottom: 20, color: '#0ea5e9', textDecoration: 'none' as const, fontSize: 14 },
  };

  if (!repo) {
    return <div style={styles.container}><div style={styles.card}><p>No repo specified.</p></div></div>;
  }

  return (
    <div style={styles.container}>
      <a href="/" style={styles.backLink}>&larr; Back to Generator</a>
      <div style={styles.card}>
        <h1 style={styles.title}>Generation Status</h1>
        <p style={styles.subtitle}>Repository: {repo}</p>

        {error && <div style={styles.error}>{error}</div>}

        {data && (
          <>
            <div style={{ marginBottom: 16 }}>
              <span style={styles.statusBadge(data.status, data.conclusion)}>
                {data.conclusion || data.status}
              </span>
              {' '}
              <a href={data.runUrl} target="_blank" rel="noopener" style={styles.link}>
                View on GitHub &rarr;
              </a>
            </div>

            {data.jobs?.map((job, i) => (
              <div key={i}>
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>{job.name}</h3>
                <ul style={styles.stepList}>
                  {job.steps?.map((step, j) => (
                    <li key={j} style={styles.stepItem}>
                      <span>
                        <span style={styles.stepIcon(step.status, step.conclusion)} />
                        {step.name}
                      </span>
                      <span style={{ fontSize: 12, color: '#888' }}>{step.conclusion || step.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {data.conclusion === 'success' && (
              <div style={styles.success}>
                <p style={{ fontWeight: 600 }}>Site generated successfully!</p>
                {data.siteUrl && (
                  <p>Live at: <a href={data.siteUrl} target="_blank" rel="noopener" style={styles.link}>{data.siteUrl}</a></p>
                )}
                <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
                  Note: DNS propagation may take up to 24 hours. GitHub Pages setup may take a few minutes.
                </p>
              </div>
            )}

            {data.status !== 'completed' && (
              <p style={{ fontSize: 13, color: '#888', marginTop: 16 }}>
                Auto-refreshing every 10 seconds...
              </p>
            )}
          </>
        )}

        {!data && !error && (
          <p style={{ color: '#888' }}>Loading status...</p>
        )}
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}><p>Loading...</p></div>}>
      <StatusContent />
    </Suspense>
  );
}
