'use client';

import { useState, FormEvent, ChangeEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { uploadScreenshot } from '@/app/lib/upload-screenshot';

function EditContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Optional: if coming from dashboard "Edit with AI", repo is pre-known so we skip
  // server-side URL→repo lookup. Page URL is still required from the user.
  const prefilledRepo = searchParams.get('repo') || '';
  const prefilledSiteUrl = searchParams.get('siteUrl') || '';

  const [pageUrl, setPageUrl] = useState(prefilledSiteUrl);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [areaDescription, setAreaDescription] = useState('');
  const [requirements, setRequirements] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleScreenshotChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 10 * 1024 * 1024) {
      setError('Screenshot exceeds 10 MB. Please use a smaller file.');
      e.target.value = '';
      return;
    }
    setError('');
    setScreenshot(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!pageUrl.trim()) {
      setError('Please enter the page URL');
      return;
    }
    if (!requirements.trim()) {
      setError('Please describe the changes you want');
      return;
    }

    setSubmitting(true);
    try {
      const screenshotUrl = screenshot ? await uploadScreenshot(screenshot) : undefined;

      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageUrl: pageUrl.trim(),
          requirements,
          areaDescription: areaDescription.trim() || undefined,
          repo: prefilledRepo || undefined,
          screenshotUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Request failed: ${res.status}`);

      router.push(
        `/status?repo=${encodeURIComponent(data.repoFullName)}&type=edit&pageUrl=${encodeURIComponent(pageUrl.trim())}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  }

  return (
    <div style={s.container}>
      <a href="/" style={s.backLink}>← Dashboard</a>
      <div style={s.card}>
        <h1 style={s.title}>Edit Site with AI</h1>
        <p style={s.intro}>
          Tell the AI which page to change, where to change it, and what to change.
        </p>

        <form onSubmit={handleSubmit}>

          {/* Input 1: Page URL */}
          <div style={s.field}>
            <div style={s.fieldHead}>
              <span style={s.numberBadge}>1</span>
              <label style={s.label}>Page URL <span style={s.required}>*</span></label>
            </div>
            <input
              type="url"
              value={pageUrl}
              onChange={e => setPageUrl(e.target.value)}
              placeholder="https://ramaya-water-park.vercel.app/tw/tours/xxx"
              style={s.input}
              required
              disabled={submitting}
            />
            <p style={s.hint}>
              The exact URL of the page you want to edit. Include the path so the AI knows which route to modify.
            </p>
          </div>

          {/* Input 2: Screenshot + area description */}
          <div style={s.field}>
            <div style={s.fieldHead}>
              <span style={s.numberBadge}>2</span>
              <label style={s.label}>Where on the page <span style={s.optional}>(optional)</span></label>
            </div>
            <p style={{ ...s.hint, marginTop: 0, marginBottom: 8 }}>
              Upload a screenshot (mark it up first in Preview / Snagit / DevTools), and/or describe the area in words.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleScreenshotChange}
              style={s.fileInput}
              disabled={submitting}
            />
            {previewUrl && (
              <div style={s.previewBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Screenshot preview" style={s.preview} />
              </div>
            )}
            <input
              type="text"
              value={areaDescription}
              onChange={e => setAreaDescription(e.target.value)}
              placeholder="e.g. the hero section at the top of the page"
              style={{ ...s.input, marginTop: 10 }}
              disabled={submitting}
            />
          </div>

          {/* Input 3: Change description */}
          <div style={s.field}>
            <div style={s.fieldHead}>
              <span style={s.numberBadge}>3</span>
              <label style={s.label}>What to change <span style={s.required}>*</span></label>
            </div>
            <textarea
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              placeholder={`e.g. Change the hero title to "Discover Tokyo" and make the CTA button orange`}
              rows={6}
              style={s.textarea}
              required
              disabled={submitting}
            />
            <p style={s.hint}>
              Describe the change in plain English. The AI can edit components, styles, copy, and i18n content.
            </p>
          </div>

          {error && (
            <div style={s.errorBox}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <button type="submit" disabled={submitting || !pageUrl.trim() || !requirements.trim()} style={s.submitButton(submitting)}>
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
  title: { fontSize: 22, fontWeight: 700 as const, marginBottom: 6, color: '#111' },
  intro: { fontSize: 13, color: '#666', marginBottom: 24 },
  backLink: { display: 'inline-block', marginBottom: 16, color: '#0ea5e9', textDecoration: 'none' as const, fontSize: 14 },

  field: { marginBottom: 28 },
  fieldHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  numberBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: '50%',
    background: '#0ea5e9', color: '#fff', fontSize: 12, fontWeight: 700 as const,
  },
  label: { fontSize: 14, fontWeight: 600 as const, color: '#374151', margin: 0 },
  required: { color: '#dc2626', fontWeight: 400 as const },
  optional: { color: '#9ca3af', fontWeight: 400 as const },

  input: {
    width: '100%', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
    border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%', padding: 12, fontSize: 14, fontFamily: 'inherit',
    border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
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
        <p style={{ color: '#888' }}>Loading…</p>
      </div>
    }>
      <EditContent />
    </Suspense>
  );
}
