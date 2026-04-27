'use client';

import { useState, FormEvent, ChangeEvent, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Site } from '@/app/lib/supabase';

// ─── Step 1: Find site by URL ─────────────────────────────────────────────────

function StepFindSite({ onFound }: { onFound: (site: Site) => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleFind(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/lookup?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Site not found');
        return;
      }
      onFound(data.site);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.stepWrap}>
      <div style={s.stepHeader}>
        <span style={s.stepBadge}>1 / 3</span>
        <h2 style={s.stepTitle}>Find the page to edit</h2>
      </div>
      <form onSubmit={handleFind}>
        <div style={s.field}>
          <label style={s.label}>Page URL <span style={s.required}>*</span></label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://tokyo.example.com"
            style={s.input}
            required
            disabled={loading}
            autoFocus
          />
          <p style={s.hint}>Enter the URL of any already-generated page — Vercel, Cloudflare Pages, or custom domain.</p>
        </div>
        {error && <div style={s.errorBox}><strong>Error:</strong> {error}</div>}
        <button type="submit" disabled={loading || !url.trim()} style={s.btn(loading || !url.trim())}>
          {loading ? 'Looking up…' : 'Find Site'}
        </button>
      </form>
    </div>
  );
}

// ─── Step 2: Upload annotated screenshot ──────────────────────────────────────

function StepScreenshot({
  site,
  onContinue,
  onBack,
}: {
  site: Site;
  onContinue: (screenshot: File | null, areaDesc: string) => void;
  onBack: () => void;
}) {
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [areaDesc, setAreaDesc] = useState('');

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setScreenshot(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  return (
    <div style={s.stepWrap}>
      <div style={s.stepHeader}>
        <span style={s.stepBadge}>2 / 3</span>
        <h2 style={s.stepTitle}>Show where to change</h2>
      </div>

      <SiteCard site={site} />

      <div style={s.field}>
        <label style={s.label}>Annotated screenshot <span style={s.optional}>(optional)</span></label>
        <p style={s.hint}>
          Mark up your screenshot in any tool first (Preview, Snagit, browser DevTools screenshot, etc.), then upload it here.
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={s.fileInput}
        />
        {screenshot && screenshot.size > 5 * 1024 * 1024 && (
          <p style={{ ...s.hint, color: '#dc2626' }}>File exceeds 5 MB — please use a smaller image.</p>
        )}
        {previewUrl && (
          <div style={s.previewBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Screenshot preview" style={s.preview} />
          </div>
        )}
      </div>

      <div style={s.field}>
        <label style={s.label}>Describe this area <span style={s.optional}>(optional)</span></label>
        <input
          type="text"
          value={areaDesc}
          onChange={e => setAreaDesc(e.target.value)}
          placeholder="e.g. the hero section at the top of the page"
          style={s.input}
        />
      </div>

      <div style={s.row}>
        <button type="button" onClick={onBack} style={s.secondaryBtn}>
          ← Back
        </button>
        <button
          type="button"
          onClick={() => onContinue(screenshot && screenshot.size <= 5 * 1024 * 1024 ? screenshot : null, areaDesc)}
          style={s.btn(false)}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Describe the change ─────────────────────────────────────────────

function StepDescribe({
  site,
  screenshot,
  areaDesc,
  onBack,
}: {
  site: Site;
  screenshot: File | null;
  areaDesc: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [requirements, setRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!requirements.trim()) return;
    setSubmitting(true);

    const combinedRequirements = areaDesc.trim()
      ? `Area: ${areaDesc.trim()}\n\nChange: ${requirements.trim()}`
      : requirements.trim();

    try {
      const formData = new FormData();
      formData.append('repo', site.repo_full_name);
      formData.append('requirements', combinedRequirements);
      if (screenshot) formData.append('screenshot', screenshot);

      const res = await fetch('/api/edit', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Request failed: ${res.status}`);

      router.push(`/status?repo=${encodeURIComponent(site.repo_full_name)}&type=edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  }

  return (
    <div style={s.stepWrap}>
      <div style={s.stepHeader}>
        <span style={s.stepBadge}>3 / 3</span>
        <h2 style={s.stepTitle}>Describe the change</h2>
      </div>

      <SiteCard site={site} />
      {screenshot && (
        <div style={s.attachedBadge}>
          📎 Screenshot attached: {screenshot.name}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={s.field}>
          <label style={s.label}>What would you like to change? <span style={s.required}>*</span></label>
          <textarea
            value={requirements}
            onChange={e => setRequirements(e.target.value)}
            placeholder={`e.g. Change the hero title to "Discover Tokyo" and make the CTA button orange`}
            rows={6}
            style={s.textarea}
            required
            disabled={submitting}
            autoFocus
          />
          <p style={s.hint}>
            Be specific — the AI can edit components, styles, copy, and i18n content.
          </p>
        </div>

        {error && <div style={s.errorBox}><strong>Error:</strong> {error}</div>}

        <div style={s.row}>
          <button type="button" onClick={onBack} disabled={submitting} style={s.secondaryBtn}>
            ← Back
          </button>
          <button type="submit" disabled={submitting || !requirements.trim()} style={s.btn(submitting || !requirements.trim())}>
            {submitting ? 'Dispatching AI workflow…' : 'Apply AI Edit'}
          </button>
        </div>

        <p style={s.disclaimer}>
          The AI will modify the repository, commit the changes directly, and trigger a redeploy.
          You'll be redirected to the status page to watch progress.
        </p>
      </form>
    </div>
  );
}

// ─── Shared site card ─────────────────────────────────────────────────────────

function SiteCard({ site }: { site: Site }) {
  const siteUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : site.vercel_url || site.pages_url || null;

  return (
    <div style={s.siteCard}>
      <div style={s.siteCardName}>{site.attraction_name}</div>
      <div style={s.siteCardMeta}>
        <code style={s.siteCardRepo}>{site.repo_full_name}</code>
        <span style={{ ...s.statusBadge, ...statusColor(site.status) }}>{site.status}</span>
      </div>
      {siteUrl && (
        <a href={siteUrl} target="_blank" rel="noopener" style={s.siteCardLink}>
          {siteUrl} →
        </a>
      )}
    </div>
  );
}

function statusColor(status: Site['status']) {
  const map: Record<Site['status'], { background: string; color: string }> = {
    ready: { background: '#dcfce7', color: '#15803d' },
    generating: { background: '#fef9c3', color: '#92400e' },
    editing: { background: '#dbeafe', color: '#1d4ed8' },
    failed: { background: '#fee2e2', color: '#dc2626' },
  };
  return map[status] ?? { background: '#f3f4f6', color: '#374151' };
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

function EditContent() {
  const searchParams = useSearchParams();
  const repoParam = searchParams.get('repo');
  const siteUrlParam = searchParams.get('siteUrl');

  // If coming from dashboard with repo pre-filled, synthesise a minimal Site-like object
  // and skip step 1. A full fetch isn't strictly required for the edit API.
  const prefilled: Site | null = repoParam
    ? ({
        repo_full_name: repoParam,
        attraction_name: repoParam.split('/')[1] ?? repoParam,
        domain: '',
        klook_url: '',
        affiliate_url: '',
        vercel_url: siteUrlParam || null,
        pages_url: null,
        custom_domain: null,
        status: 'ready',
        id: '',
        repo_url: null,
        base_currency: null,
        languages: null,
        colors: null,
        head_scripts: null,
        created_by_email: '',
        created_by_name: null,
        created_at: '',
        updated_at: '',
      } as Site)
    : null;

  const [step, setStep] = useState<1 | 2 | 3>(prefilled ? 2 : 1);
  const [site, setSite] = useState<Site | null>(prefilled);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [areaDesc, setAreaDesc] = useState('');

  return (
    <div style={s.container}>
      <a href="/" style={s.backLink}>← Dashboard</a>
      <div style={s.card}>
        <h1 style={s.title}>Edit Site with AI</h1>

        {step === 1 && (
          <StepFindSite
            onFound={found => { setSite(found); setStep(2); }}
          />
        )}

        {step === 2 && site && (
          <StepScreenshot
            site={site}
            onContinue={(file, desc) => { setScreenshot(file); setAreaDesc(desc); setStep(3); }}
            onBack={() => { if (!prefilled) setStep(1); }}
          />
        )}

        {step === 3 && site && (
          <StepDescribe
            site={site}
            screenshot={screenshot}
            areaDesc={areaDesc}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  container: { maxWidth: 640, margin: '0 auto', padding: '40px 20px' },
  card: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  title: { fontSize: 22, fontWeight: 700 as const, marginBottom: 24, color: '#111' },
  backLink: { display: 'inline-block', marginBottom: 16, color: '#0ea5e9', textDecoration: 'none' as const, fontSize: 14 },

  stepWrap: { display: 'flex', flexDirection: 'column' as const, gap: 0 },
  stepHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  stepBadge: {
    fontSize: 11, fontWeight: 600 as const, background: '#f0f9ff', color: '#0284c7',
    borderRadius: 20, padding: '2px 8px', border: '1px solid #bae6fd',
  },
  stepTitle: { fontSize: 16, fontWeight: 600 as const, color: '#111', margin: 0 },

  field: { marginBottom: 20 },
  label: { display: 'block', fontSize: 14, fontWeight: 600 as const, marginBottom: 6, color: '#374151' },
  required: { color: '#dc2626' },
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

  siteCard: {
    padding: 14, background: '#f9fafb', borderRadius: 10,
    border: '1px solid #e5e7eb', marginBottom: 20,
  },
  siteCardName: { fontSize: 15, fontWeight: 600 as const, color: '#111', marginBottom: 6 },
  siteCardMeta: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const },
  siteCardRepo: { fontSize: 12, color: '#555', fontFamily: 'monospace' },
  siteCardLink: { display: 'block', fontSize: 12, color: '#0ea5e9', textDecoration: 'none' as const, marginTop: 4 },
  statusBadge: { fontSize: 11, fontWeight: 600 as const, borderRadius: 4, padding: '2px 6px' },

  attachedBadge: {
    fontSize: 13, color: '#374151', background: '#f0fdf4', borderRadius: 8,
    padding: '8px 12px', border: '1px solid #bbf7d0', marginBottom: 20,
  },

  row: { display: 'flex', gap: 10, marginTop: 4 },
  btn: (disabled: boolean) => ({
    flex: 1, padding: '11px 20px', fontSize: 15, fontWeight: 600 as const,
    background: disabled ? '#9ca3af' : '#0ea5e9',
    color: '#fff', border: 'none', borderRadius: 8,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
  }),
  secondaryBtn: {
    padding: '11px 20px', fontSize: 14, fontWeight: 500 as const,
    background: '#f3f4f6', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' as const,
  },
  errorBox: {
    padding: 12, background: '#fef2f2', borderRadius: 8,
    border: '1px solid #fecaca', color: '#dc2626', marginBottom: 16, fontSize: 13,
  },
  disclaimer: { fontSize: 12, color: '#888', marginTop: 16, textAlign: 'center' as const },
};

// ─── Export ───────────────────────────────────────────────────────────────────

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
