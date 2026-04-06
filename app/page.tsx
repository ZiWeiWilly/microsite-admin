'use client';

import { useState, FormEvent } from 'react';

const CURRENCIES = [
  'THB', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW', 'TWD',
  'HKD', 'SGD', 'MYR', 'PHP', 'IDR', 'VND', 'INR', 'RUB', 'AUD',
];

const ALL_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
];

type Step = 'basic' | 'settings' | 'done';

export default function Home() {
  const [step, setStep] = useState<Step>('basic');

  // Basic info
  const [attractionName, setAttractionName] = useState('');
  const [klookUrl, setKlookUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');

  // Settings (auto-filled, user-editable)
  const [baseCurrency, setBaseCurrency] = useState('THB');
  const [languages, setLanguages] = useState<string[]>(ALL_LANGUAGES.map(l => l.code));
  const [colors, setColors] = useState({ primary: '#0ea5e9', secondary: '#06b6d4', accent: '#f59e0b' });
  const [countryName, setCountryName] = useState('');
  const [confidence, setConfidence] = useState('');

  // Loading
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  // Result
  const [result, setResult] = useState<{ repoUrl?: string; statusUrl?: string; error?: string } | null>(null);

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
    } catch (err: unknown) {
      // Fall back to defaults and let user edit
      setStep('settings');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerateLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attractionName, klookUrl, domain, affiliateUrl, baseCurrency, colors, languages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error || 'Generation failed' });
      } else {
        setResult({ repoUrl: data.repoUrl, statusUrl: `/status?repo=${data.repoFullName}` });
        setStep('done');
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
  };

  return (
    <div style={s.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={s.card}>
        <h1 style={s.title}>Microsite Generator</h1>
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
              style={s.input}
              value={domain}
              onChange={e => setDomain(e.target.value)}
              disabled={step !== 'basic'}
            />
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

          {step === 'basic' && (
            <button type="submit" disabled={settingsLoading} style={s.btnPrimary(settingsLoading)}>
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
              <select
                value={baseCurrency}
                onChange={e => setBaseCurrency(e.target.value)}
                style={s.select}
                disabled={step === 'done'}
              >
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
                  <span
                    key={l.code}
                    style={s.langChip(languages.includes(l.code))}
                    onClick={() => step !== 'done' && toggleLang(l.code)}
                  >
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            {step === 'settings' && (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={generateLoading}
                  style={s.btnPrimary(generateLoading)}
                >
                  {generateLoading && <span style={s.spinner} />}
                  {generateLoading ? 'Generating Site...' : 'Generate Site →'}
                </button>
                <div style={{ textAlign: 'center' as const, marginTop: 12 }}>
                  <button style={s.btnSecondary} onClick={() => setStep('basic')}>
                    ← Edit basic info
                  </button>
                </div>
              </>
            )}

            {result?.error && <div style={s.errorBox}>{result.error}</div>}
          </>
        )}

        {/* ── Done ── */}
        {step === 'done' && result?.repoUrl && (
          <div style={s.success}>
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Site generation started!</p>
            <p style={{ margin: '0 0 4px', fontSize: 14 }}>
              Repository: <a href={result.repoUrl} target="_blank" rel="noopener">{result.repoUrl}</a>
            </p>
            <p style={{ margin: 0, fontSize: 14 }}>
              <a href={result.statusUrl}>View generation progress →</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
