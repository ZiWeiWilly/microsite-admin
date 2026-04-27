'use client';

import { useState, FormEvent, ChangeEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function EditContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repo = searchParams.get('repo') || '';
  const siteUrl = searchParams.get('siteUrl') || '';

  const [requirements, setRequirements] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleScreenshotChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setScreenshot(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!repo) {
      setError('Missing repo parameter');
      return;
    }
    if (!requirements.trim()) {
      setError('Please describe the changes you want');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('repo', repo);
      formData.append('requirements', requirements);
      if (screenshot) formData.append('screenshot', screenshot);

      const res = await fetch('/api/edit', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `Request failed: ${res.status}`);
      }

      router.push(`/status?repo=${encodeURIComponent(repo)}&type=edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  }

  if (!repo) {
    return (
      <div style={s.container}>
        <div style={s.card}>
          <p style={{ color: '#888' }}>No repository specified.</p>
          <a href="/" style={s.link}>&larr; Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <a href={`/status?repo=${encodeURIComponent(repo)}`} style={s.backLink}>&larr; Back to Status</a>
      <div style={s.card}>
        <h1 style={s.title}>Edit Site with AI</h1>
        <p style={s.subtitle}>{repo}</p>

        {siteUrl && (
          <div style={s.siteBox}>
            <span style={{ fontSize: 13, color: '#555' }}>Current site:</span>
            <a href={siteUrl} target="_blank" rel="noopener" style={{ ...s.link, fontSize: 13 }}>
              {siteUrl} &rarr;
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>
              What would you like to change? <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              placeholder="e.g. Change the hero title to “Discover Tokyo” and make the CTA button orange"
              rows={6}
              style={s.textarea}
              required
              disabled={submitting}
            />
            <p style={s.hint}>
              Describe what you want to change in plain English. Be specific — the AI can edit components, styles, and copy.
            </p>
          </div>

          <div style={s.field}>
            <label style={s.label}>Reference screenshot (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleScreenshotChange}
              style={s.fileInput}
              disabled={submitting}
            />
            <p style={s.hint}>
              Upload a screenshot to give the AI visual context (e.g. annotated current state, or a design reference). Max 5MB.
            </p>
            {previewUrl && (
              <div style={s.previewBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Screenshot preview" style={s.preview} />
              </div>
            )}
          </div>

          {error && (
            <div style={s.errorBox}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <button type="submit" disabled={submitting || !requirements.trim()} style={s.submitButton(submitting)}>
            {submitting ? 'Dispatching AI workflow…' : 'Apply AI Edit'}
          </button>

          <p style={s.disclaimer}>
            The AI will modify the repository, commit the changes directly, and trigger a redeploy.
            You'll be redirected to the status page to watch progress.
          </p>
        </form>
      </div>
    </div>
  );
}

const s = {
  container: { maxWidth: 640, margin: '0 auto', padding: '40px 20px' },
  card: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  title: { fontSize: 22, fontWeight: 700 as const, marginBottom: 4, color: '#111' },
  subtitle: { fontSize: 13, color: '#888', fontFamily: 'monospace', marginBottom: 20 },
  backLink: { display: 'inline-block', marginBottom: 16, color: '#0ea5e9', textDecoration: 'none' as const, fontSize: 14 },
  link: { color: '#0ea5e9', textDecoration: 'none' as const },
  siteBox: {
    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const,
    padding: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 24,
  },
  field: { marginBottom: 24 },
  label: { display: 'block', fontSize: 14, fontWeight: 600 as const, marginBottom: 6, color: '#374151' },
  textarea: {
    width: '100%', padding: 12, fontSize: 14, fontFamily: 'inherit',
    border: '1px solid #d1d5db', borderRadius: 8, outline: 'none' as const,
    boxSizing: 'border-box' as const, resize: 'vertical' as const,
  },
  fileInput: { display: 'block', fontSize: 14, color: '#555' },
  hint: { fontSize: 12, color: '#888', marginTop: 6 },
  previewBox: { marginTop: 12, padding: 8, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' },
  preview: { maxWidth: '100%', maxHeight: 240, display: 'block', borderRadius: 4 },
  errorBox: { padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626', marginBottom: 16, fontSize: 13 },
  submitButton: (submitting: boolean) => ({
    width: '100%', padding: '12px 24px', fontSize: 15, fontWeight: 600 as const,
    background: submitting ? '#9ca3af' : '#0ea5e9', color: '#fff',
    border: 'none', borderRadius: 8, cursor: submitting ? 'not-allowed' as const : 'pointer' as const,
  }),
  disclaimer: { fontSize: 12, color: '#888', marginTop: 16, textAlign: 'center' as const },
};

export default function EditPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
        <p style={{ color: '#888' }}>Loading...</p>
      </div>
    }>
      <EditContent />
    </Suspense>
  );
}
