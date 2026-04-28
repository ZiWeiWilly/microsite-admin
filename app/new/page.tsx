'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ALL_LANGUAGES } from '../lib/recommend-data';

const CURRENCIES = [
  'THB', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW', 'TWD',
  'HKD', 'SGD', 'MYR', 'PHP', 'IDR', 'VND', 'INR', 'RUB', 'AUD',
];

type Step = 'basic' | 'settings' | 'done';
type DomainEnvironment = 'production' | 'test';

export default function NewSitePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('basic');

  // Basic info
  const [attractionName, setAttractionName] = useState('');
  const [klookUrl, setKlookUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [domainEnvironment, setDomainEnvironment] = useState<DomainEnvironment>('test');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [headScripts, setHeadScripts] = useState('');

  // Logo images — AI-generated (base64) or manually uploaded
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoLightFile, setLogoLightFile] = useState<File | null>(null);
  const [logoIconFile, setLogoIconFile] = useState<File | null>(null);
  const [generatedLogos, setGeneratedLogos] = useState<{ logo: string; logoLight: string; logoIcon: string } | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  type ChatMessage = { role: 'user' | 'assistant'; content: string };
  const [logoHistory, setLogoHistory] = useState<ChatMessage[]>([]);
  const [logoRefinement, setLogoRefinement] = useState('');

  // Settings (auto-filled, user-editable)
  const [baseCurrency, setBaseCurrency] = useState('THB');
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [colors, setColors] = useState({ primary: '#0ea5e9', secondary: '#06b6d4', accent: '#f59e0b' });
  const [countryName, setCountryName] = useState('');
  const [confidence, setConfidence] = useState('');

  // Duplicate check
  type DupStatus = 'idle' | 'checking' | 'ok' | 'duplicate';
  const [dupStatus, setDupStatus] = useState<DupStatus>('idle');
  const [dupResult, setDupResult] = useState<{ github: boolean; vercel: boolean; repoName: string } | null>(null);
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    if (!domain) { setDupStatus('idle'); setDupResult(null); return; }
    setDupStatus('checking');
    dupTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-duplicate?domain=${encodeURIComponent(domain)}`);
        const data = await res.json();
        setDupResult(data);
        setDupStatus(data.github || data.vercel ? 'duplicate' : 'ok');
      } catch {
        setDupStatus('idle');
      }
    }, 600);
    return () => { if (dupTimerRef.current) clearTimeout(dupTimerRef.current); };
  }, [domain]);

  // Loading
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  // Result
  const [result, setResult] = useState<{ repoUrl?: string; statusUrl?: string; vercelProjectUrl?: string; actionsUrl?: string; error?: string } | null>(null);

  async function handleAutoSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klookUrl, attractionName }),
      });
      if (!res.ok) throw new Error('Failed to get recommendations');
      const data = await res.json();

      setBaseCurrency(data.baseCurrency);
      setLanguages(data.languages);
      setColors(data.colors);
      setCountryName(data.countryName);
      setConfidence(data.confidence);
      setStep('settings');
    } catch {
      setStep('settings');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleGenerateLogo(refinement?: string) {
    if (!attractionName) return;
    setLogoLoading(true);

    let history: ChatMessage[] = logoHistory;
    if (refinement?.trim()) {
      history = [...logoHistory, { role: 'user', content: refinement.trim() }];
    }

    try {
      const res = await fetch('/api/generate-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attractionName, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Logo generation failed');
      setGeneratedLogos(data);
      setLogoHistory(data.history ?? []);
      setLogoRefinement('');
      setLogoFile(null);
      setLogoLightFile(null);
      setLogoIconFile(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Logo generation failed');
    } finally {
      setLogoLoading(false);
    }
  }

  function base64ToFile(b64: string, filename: string): File {
    const byteString = atob(b64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new File([ab], filename, { type: 'image/png' });
  }

  async function handleGenerate() {
    setGenerateLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('config', JSON.stringify({
        attractionName,
        klookUrl,
        domain,
        domainEnvironment,
        affiliateUrl,
        baseCurrency,
        colors,
        languages,
        ...(headScripts.trim() && { headScripts: headScripts.trim() }),
      }));

      const finalLogo = logoFile ?? (generatedLogos ? base64ToFile(generatedLogos.logo, 'logo.png') : null);
      const finalLogoLight = logoLightFile ?? (generatedLogos ? base64ToFile(generatedLogos.logoLight, 'logo-light.png') : null);
      const finalLogoIcon = logoIconFile ?? (generatedLogos ? base64ToFile(generatedLogos.logoIcon, 'logo-icon.png') : null);

      if (finalLogo) formData.append('logo', finalLogo);
      if (finalLogoLight) formData.append('logoLight', finalLogoLight);
      if (finalLogoIcon) formData.append('logoIcon', finalLogoIcon);

      const res = await fetch('/api/generate', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error || 'Generation failed', repoUrl: data.repoUrl, actionsUrl: data.actionsUrl });
      } else {
        router.push(`/status?repo=${data.repoFullName}`);
      }
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setGenerateLoading(false);
    }
  }

  function toggleLang(code: string) {
    if (code === 'en') return;
    setLanguages(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }

  const s = {
    container: { maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' },
    card: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    title: { fontSize: 24, fontWeight: 700 as const, marginBottom: 4, color: '#111' },
    subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
    sectionTitle: { fontSize: 11, fontWeight: 700 as const, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16 },
    divider: { borderTop: '1px solid #f0f0f0', margin: '28px 0' },
    fieldGroup: { marginBottom: 20 },
    label: { display: 'block' as const, fontSize: 13, fontWeight: 600 as const, color: '#333', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' },
    select: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 },
    colorRow: { display: 'flex', gap: 16, alignItems: 'center' as const },
    colorSwatch: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' as const, gap: 4 },
    colorLabel: { fontSize: 11, color: '#888' },
    colorInput: { width: 48, height: 36, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' },
    langGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
    langChip: (active: boolean) => ({
      padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
      border: `2px solid ${active ? '#0ea5e9' : '#e5e5e5'}`,
      background: active ? '#f0f9ff' : '#fff',
      color: active ? '#0369a1' : '#888',
      userSelect: 'none' as const,
    }),
    btnPrimary: (disabled: boolean) => ({
      width: '100%', padding: '14px 24px', background: disabled ? '#a0d8f1' : '#0ea5e9',
      color: '#fff', border: 'none', borderRadius: 10, fontSize: 16,
      fontWeight: 600 as const, cursor: disabled ? 'not-allowed' : 'pointer',
      marginTop: 8, display: 'flex', alignItems: 'center' as const, justifyContent: 'center' as const, gap: 10,
    }),
    btnSecondary: {
      background: 'none', border: 'none', color: '#0ea5e9', fontSize: 13,
      cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' as const,
    },
    badge: {
      display: 'inline-flex', alignItems: 'center' as const, gap: 6,
      padding: '6px 12px', borderRadius: 20, fontSize: 12,
      background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', marginBottom: 20,
    },
    spinner: {
      width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    },
    success: { marginTop: 20, padding: 20, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' },
    errorBox: { marginTop: 16, padding: 14, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626', fontSize: 14 },
    fileRow: { display: 'flex', alignItems: 'center' as const, gap: 12 },
    fileInput: { fontSize: 13, color: '#555' },
    fileHint: { fontSize: 11, color: '#999', marginTop: 4 },
    preview: { height: 36, maxWidth: 120, objectFit: 'contain' as const, borderRadius: 4, border: '1px solid #eee' },
    radioGroup: { display: 'flex', flexDirection: 'column' as const, gap: 8, marginTop: 10 },
    radioOption: (disabled: boolean) => ({
      display: 'flex',
      alignItems: 'center' as const,
      gap: 8,
      fontSize: 13,
      color: disabled ? '#9ca3af' : '#374151',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
  };

  return (
    <div style={s.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <a href="/" style={{ color: '#0ea5e9', textDecoration: 'none', fontSize: 14 }}>&larr; Dashboard</a>
        {session?.user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {session.user.image && (
              <img src={session.user.image} alt={session.user.name ?? ''} width={28} height={28} style={{ borderRadius: '50%' }} />
            )}
            <span style={{ fontSize: 13, color: '#555' }}>{session.user.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{ fontSize: 12, color: '#888', background: 'none', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      <div style={s.card}>
        <h1 style={s.title}>New Site</h1>
        <p style={s.subtitle}>Generate a new Klook affiliate landing page in two steps.</p>

        {/* ── Step 1: Basic Info ── */}
        <div style={s.sectionTitle}>Step 1 — Basic Info</div>
        <form onSubmit={handleAutoSettings}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Attraction Name *</label>
            <input
              required
              placeholder="e.g. Ramayana Water Park"
              style={s.input}
              value={attractionName}
              onChange={e => setAttractionName(e.target.value)}
              disabled={step !== 'basic'}
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Klook Activity URL *</label>
            <input
              required
              placeholder="https://www.klook.com/activity/12345-..."
              style={s.input}
              value={klookUrl}
              onChange={e => setKlookUrl(e.target.value)}
              disabled={step !== 'basic'}
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Domain *</label>
            <input
              required
              placeholder="e.g. ramayana-waterpark.guide"
              style={{ ...s.input, borderColor: dupStatus === 'duplicate' ? '#f87171' : dupStatus === 'ok' ? '#86efac' : '#ddd' }}
              value={domain}
              onChange={e => setDomain(e.target.value)}
              disabled={step !== 'basic'}
            />
            <div style={s.radioGroup}>
              <label style={s.radioOption(step !== 'basic')}>
                <input
                  type="radio"
                  name="domainEnvironment"
                  value="test"
                  checked={domainEnvironment === 'test'}
                  onChange={() => setDomainEnvironment('test')}
                  disabled={step !== 'basic'}
                />
                Test (Vercel)
              </label>
              <label
                style={s.radioOption(true)}
                title="Cloudflare not available"
              >
                <input
                  type="radio"
                  name="domainEnvironment"
                  value="production"
                  checked={domainEnvironment === 'production'}
                  onChange={() => setDomainEnvironment('production')}
                  disabled
                />
                Production (Cloudflare)
              </label>
            </div>
            {dupStatus === 'checking' && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Checking for existing project...</div>}
            {dupStatus === 'ok' && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ Name is available</div>}
            {dupStatus === 'duplicate' && dupResult && (
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                A project named <strong>{dupResult.repoName}</strong> already exists
                {dupResult.github && dupResult.vercel && ' on GitHub and Vercel'}
                {dupResult.github && !dupResult.vercel && ' on GitHub'}
                {!dupResult.github && dupResult.vercel && ' on Vercel'}
                . Please use a different domain.
              </div>
            )}
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Affiliate URL *</label>
            <input
              required
              placeholder="https://affiliate.klook.com/redirect?aid=..."
              style={s.input}
              value={affiliateUrl}
              onChange={e => setAffiliateUrl(e.target.value)}
              disabled={step !== 'basic'}
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Head Scripts <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></label>
            <textarea
              placeholder={'Paste tracking scripts to inject into <head> — e.g. GTM, GA4, Hotjar snippets'}
              style={{ ...s.input, height: 100, resize: 'vertical' as const, fontFamily: 'monospace', fontSize: 12 }}
              value={headScripts}
              onChange={e => setHeadScripts(e.target.value)}
              disabled={step !== 'basic'}
            />
            <div style={s.fileHint}>Raw HTML injected verbatim into &lt;head&gt;. Supports any &lt;script&gt; tag.</div>
          </div>

          <div style={{ ...s.divider, margin: '20px 0' }} />
          <div style={s.sectionTitle}>Logo</div>

          {/* AI-generated logo preview + refinement chat */}
          {generatedLogos && (
            <div style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>Generated logos</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                  {[
                    { key: 'logo', label: 'Navbar (logo.png)', value: generatedLogos.logo, height: 40, bg: '#fff' },
                    { key: 'logoLight', label: 'Footer Dark (logo-light.png)', value: generatedLogos.logoLight, height: 40, bg: '#0f172a' },
                    { key: 'logoIcon', label: 'Favicon (logo-icon.png)', value: generatedLogos.logoIcon, height: 56, bg: '#fff' },
                  ].map(item => (
                    <div key={item.key} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, background: '#fff' }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{item.label}</div>
                      <div style={{ borderRadius: 6, background: item.bg, padding: 8, display: 'flex', alignItems: 'center' }}>
                        <img
                          src={`data:image/png;base64,${item.value}`}
                          alt={item.label}
                          style={{ height: item.height, maxWidth: '100%', objectFit: 'contain' as const }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {logoHistory.filter(m => m.role === 'user').length > 0 && (
                <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #f0f0f0', maxHeight: 140, overflowY: 'auto' as const }}>
                  {logoHistory.map((msg, i) => (
                    msg.role === 'user' ? (
                      <div key={i} style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: '#0ea5e9' }}>You: </span>{msg.content}
                      </div>
                    ) : null
                  ))}
                </div>
              )}

              {step === 'basic' && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#fff' }}>
                  <input
                    placeholder="Tell Gemini what to change, e.g. make it more vibrant..."
                    style={{ ...s.input, flex: 1, fontSize: 13 }}
                    value={logoRefinement}
                    onChange={e => setLogoRefinement(e.target.value)}
                    disabled={logoLoading}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateLogo(logoRefinement)}
                    disabled={!logoRefinement.trim() || logoLoading}
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 as const,
                      border: 'none', background: (!logoRefinement.trim() || logoLoading) ? '#e2e8f0' : '#0ea5e9',
                      color: (!logoRefinement.trim() || logoLoading) ? '#aaa' : '#fff',
                      cursor: (!logoRefinement.trim() || logoLoading) ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap' as const, display: 'flex', alignItems: 'center' as const, gap: 6,
                    }}
                  >
                    {logoLoading && <span style={{ ...s.spinner, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />}
                    {logoLoading ? '' : 'Refine'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={s.fieldGroup}>
            <button
              type="button"
              onClick={() => { setLogoHistory([]); handleGenerateLogo(); }}
              disabled={!attractionName || logoLoading || step !== 'basic'}
              style={{
                padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 as const,
                border: '1px solid #0ea5e9', background: logoLoading ? '#f0f9ff' : '#fff',
                color: '#0ea5e9', cursor: (!attractionName || logoLoading || step !== 'basic') ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center' as const, gap: 8,
              }}
            >
              {logoLoading && !logoRefinement && <span style={{ ...s.spinner, border: '2px solid #bae6fd', borderTopColor: '#0ea5e9' }} />}
              {logoLoading && !logoRefinement ? 'Generating...' : generatedLogos ? 'Regenerate from Scratch' : 'Generate Logo with AI'}
            </button>
            <div style={s.fileHint}>Uses Gemini to create a "Powered by Klook" branded logo for navbar, footer, and favicon.</div>
          </div>

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>Or upload manually (overrides AI-generated):</div>
            {([
              { label: 'Logo — Navbar', file: logoFile, setter: setLogoFile, name: 'logo.png', generated: generatedLogos?.logo, previewBg: '#fff' },
              { label: 'Logo Light — Footer', file: logoLightFile, setter: setLogoLightFile, name: 'logo-light.png', generated: generatedLogos?.logoLight, previewBg: '#0f172a' },
              { label: 'Logo Icon — Favicon', file: logoIconFile, setter: setLogoIconFile, name: 'logo-icon.png', generated: generatedLogos?.logoIcon, previewBg: '#fff' },
            ] as const).map(({ label, file, setter, name, generated, previewBg }) => (
              <div key={name} style={{ ...s.fieldGroup, marginBottom: 10 }}>
                <label style={{ ...s.label, fontSize: 12, color: '#888' }}>{label}</label>
                <div style={s.fileRow}>
                  <input
                    type="file"
                    accept="image/*"
                    style={s.fileInput}
                    onChange={e => setter(e.target.files?.[0] ?? null)}
                    disabled={step !== 'basic'}
                  />
                  {(file || generated) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ borderRadius: 6, background: previewBg, padding: 6, border: '1px solid #e2e8f0' }}>
                        <img
                          src={file ? URL.createObjectURL(file) : `data:image/png;base64,${generated}`}
                          alt={label}
                          style={s.preview}
                        />
                      </div>
                      {file && (
                        <button
                          type="button"
                          onClick={() => setter(null)}
                          style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                        >
                          Use AI version
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={s.fileHint}>{name}{file ? ' (manual override)' : generated ? ' (AI generated)' : ''}</div>
              </div>
            ))}
          </div>

          {step === 'basic' && (
            <button
              type="submit"
              disabled={settingsLoading || dupStatus === 'duplicate' || dupStatus === 'checking'}
              style={s.btnPrimary(settingsLoading || dupStatus === 'duplicate' || dupStatus === 'checking')}
            >
              {settingsLoading && <span style={s.spinner} />}
              {settingsLoading ? 'Generating Settings...' : 'Auto Settings →'}
            </button>
          )}
        </form>

        {/* ── Step 2: Settings ── */}
        {(step === 'settings' || step === 'done') && (
          <>
            <div style={s.divider} />
            <div style={s.sectionTitle}>Step 2 — Settings</div>

            {countryName && (
              <div style={s.badge}>
                Auto-configured for <strong style={{ marginLeft: 2 }}>{countryName}</strong>
                {confidence !== 'high' && <span style={{ color: '#6b7280' }}> (best guess)</span>}
              </div>
            )}

            <div style={s.fieldGroup}>
              <label style={s.label}>Base Currency</label>
              <select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} style={s.select} disabled={step === 'done'}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Brand Colors</label>
              <div style={s.colorRow}>
                {(['primary', 'secondary', 'accent'] as const).map(key => (
                  <div key={key} style={s.colorSwatch}>
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={e => setColors(prev => ({ ...prev, [key]: e.target.value }))}
                      style={s.colorInput}
                      disabled={step === 'done'}
                    />
                    <span style={s.colorLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Languages</label>
              <div style={s.langGrid}>
                {ALL_LANGUAGES.map(l => (
                  <span key={l.code} style={s.langChip(languages.includes(l.code))} onClick={() => step !== 'done' && toggleLang(l.code)}>
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            {step === 'settings' && (
              <>
                <button onClick={handleGenerate} disabled={generateLoading} style={s.btnPrimary(generateLoading)}>
                  {generateLoading && <span style={s.spinner} />}
                  {generateLoading ? 'Generating Site...' : 'Generate Site →'}
                </button>
                <div style={{ textAlign: 'center' as const, marginTop: 12 }}>
                  <button style={s.btnSecondary} onClick={() => setStep('basic')}>← Edit basic info</button>
                </div>
              </>
            )}

            {result?.error && (
              <div style={s.errorBox}>
                <div>{result.error}</div>
                {(result.repoUrl || result.actionsUrl) && (
                  <div style={{ marginTop: 10, fontSize: 13, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {result.repoUrl && <a href={result.repoUrl} target="_blank" rel="noopener">Open repo →</a>}
                    {result.actionsUrl && <a href={result.actionsUrl} target="_blank" rel="noopener">Run workflow manually →</a>}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Done ── */}
        {step === 'done' && result?.repoUrl && (
          <div style={s.success}>
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Site generation started!</p>
            <p style={{ margin: '0 0 4px', fontSize: 14 }}>
              Repository: <a href={result.repoUrl} target="_blank" rel="noopener">{result.repoUrl}</a>
            </p>
            {result.vercelProjectUrl && (
              <p style={{ margin: '0 0 4px', fontSize: 14 }}>
                Vercel: <a href={result.vercelProjectUrl} target="_blank" rel="noopener">{result.vercelProjectUrl}</a>
                {' '}(live after workflow completes)
              </p>
            )}
            <p style={{ margin: 0, fontSize: 14 }}>
              <a href={result.statusUrl}>View generation progress →</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
