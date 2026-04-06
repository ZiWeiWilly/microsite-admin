'use client';

import { useState, useRef, FormEvent } from 'react';

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

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ repoUrl?: string; statusUrl?: string; error?: string } | null>(null);

  // Controlled fields for auto-recommend
  const [attractionName, setAttractionName] = useState('');
  const [klookUrl, setKlookUrl] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('THB');
  const [languages, setLanguages] = useState<string[]>(ALL_LANGUAGES.map(l => l.code));
  const [colors, setColors] = useState({ primary: '#0ea5e9', secondary: '#06b6d4', accent: '#f59e0b' });

  // Recommend state
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendInfo, setRecommendInfo] = useState<{ countryName: string; confidence: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchRecommendations(url: string, name: string) {
    if (!url.includes('klook.com/activity/')) return;

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRecommendLoading(true);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klookUrl: url, attractionName: name }),
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json();

      setBaseCurrency(data.baseCurrency);
      setLanguages(data.languages);
      setColors(data.colors);
      setRecommendInfo({ countryName: data.countryName, confidence: data.confidence });
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // Silently ignore — user can fill manually
    } finally {
      setRecommendLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const form = new FormData(e.currentTarget);

    const config = {
      attractionName,
      klookUrl,
      domain: form.get('domain') as string,
      affiliateUrl: form.get('affiliateUrl') as string,
      baseCurrency,
      colors,
      languages,
    };

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error || 'Generation failed' });
      } else {
        setResult({ repoUrl: data.repoUrl, statusUrl: `/status?repo=${data.repoFullName}` });
      }
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  function toggleLang(code: string) {
    setLanguages(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }

  const fadingStyle = recommendLoading
    ? { opacity: 0.5, transition: 'opacity 0.3s', pointerEvents: 'none' as const }
    : { opacity: 1, transition: 'opacity 0.3s' };

  const styles = {
    container: { maxWidth: 720, margin: '0 auto', padding: '40px 20px' },
    card: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    title: { fontSize: 24, fontWeight: 700 as const, marginBottom: 4, color: '#111' },
    subtitle: { fontSize: 14, color: '#666', marginBottom: 32 },
    fieldGroup: { marginBottom: 20 },
    label: { display: 'block' as const, fontSize: 13, fontWeight: 600 as const, color: '#333', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const },
    select: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 },
    colorRow: { display: 'flex', gap: 12, alignItems: 'center' as const },
    colorInput: { width: 48, height: 36, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' },
    langGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
    langChip: (active: boolean) => ({
      padding: '6px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
      border: active ? '2px solid #0ea5e9' : '2px solid #e5e5e5',
      background: active ? '#f0f9ff' : '#fff',
      color: active ? '#0369a1' : '#666',
    }),
    button: {
      width: '100%', padding: '14px 24px', background: '#0ea5e9', color: '#fff',
      border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 600 as const,
      cursor: 'pointer', marginTop: 24,
    },
    buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
    success: { marginTop: 20, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' },
    error: { marginTop: 20, padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626' },
    recommendBadge: {
      padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20,
      background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
      display: 'flex', alignItems: 'center' as const, gap: 8,
    },
    sectionLabel: { fontSize: 11, fontWeight: 700 as const, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12, marginTop: 28 },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Microsite Generator</h1>
        <p style={styles.subtitle}>Fill in the details below to generate a new Klook affiliate landing page.</p>

        <form onSubmit={handleSubmit}>
          {/* === Basic Info === */}
          <div style={styles.sectionLabel}>Basic Info</div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Attraction Name *</label>
            <input
              name="attractionName"
              required
              placeholder="e.g. Ramayana Water Park"
              style={styles.input}
              value={attractionName}
              onChange={e => setAttractionName(e.target.value)}
              onBlur={() => { if (klookUrl) fetchRecommendations(klookUrl, attractionName); }}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Klook Activity URL *</label>
            <input
              name="klookUrl"
              required
              placeholder="https://www.klook.com/activity/12345-..."
              style={styles.input}
              value={klookUrl}
              onChange={e => setKlookUrl(e.target.value)}
              onBlur={() => fetchRecommendations(klookUrl, attractionName)}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Domain *</label>
            <input name="domain" required placeholder="e.g. ramayana-waterpark.guide" style={styles.input} />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Affiliate URL *</label>
            <input name="affiliateUrl" required placeholder="https://affiliate.klook.com/redirect?aid=..." style={styles.input} />
          </div>

          {/* === Auto-Recommend Badge === */}
          {recommendLoading && (
            <div style={{ ...styles.recommendBadge, animation: 'pulse 1.5s ease-in-out infinite' }}>
              Analyzing Klook URL...
            </div>
          )}
          {!recommendLoading && recommendInfo && (
            <div style={styles.recommendBadge}>
              <span>Auto-recommended for <strong>{recommendInfo.countryName}</strong></span>
              {recommendInfo.confidence !== 'high' && (
                <span style={{ fontSize: 11, color: '#6b7280' }}>(best guess)</span>
              )}
              <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>Adjust below if needed</span>
            </div>
          )}

          {/* === Recommended Settings === */}
          <div style={{ ...fadingStyle }}>
            <div style={styles.sectionLabel}>Settings</div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Base Currency</label>
              <select
                name="baseCurrency"
                value={baseCurrency}
                onChange={e => setBaseCurrency(e.target.value)}
                style={styles.select}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Brand Colors</label>
              <div style={styles.colorRow}>
                <div>
                  <small>Primary</small>
                  <input
                    name="colorPrimary"
                    type="color"
                    value={colors.primary}
                    onChange={e => setColors(prev => ({ ...prev, primary: e.target.value }))}
                    style={styles.colorInput}
                  />
                </div>
                <div>
                  <small>Secondary</small>
                  <input
                    name="colorSecondary"
                    type="color"
                    value={colors.secondary}
                    onChange={e => setColors(prev => ({ ...prev, secondary: e.target.value }))}
                    style={styles.colorInput}
                  />
                </div>
                <div>
                  <small>Accent</small>
                  <input
                    name="colorAccent"
                    type="color"
                    value={colors.accent}
                    onChange={e => setColors(prev => ({ ...prev, accent: e.target.value }))}
                    style={styles.colorInput}
                  />
                </div>
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Languages</label>
              <div style={styles.langGrid}>
                {ALL_LANGUAGES.map(l => (
                  <span
                    key={l.code}
                    style={styles.langChip(languages.includes(l.code))}
                    onClick={() => l.code === 'en' ? null : toggleLang(l.code)}
                  >
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
          >
            {loading ? 'Generating...' : 'Generate Site'}
          </button>
        </form>

        {result?.error && (
          <div style={styles.error}>{result.error}</div>
        )}

        {result?.repoUrl && (
          <div style={styles.success}>
            <p><strong>Site generation started!</strong></p>
            <p>Repository: <a href={result.repoUrl} target="_blank" rel="noopener">{result.repoUrl}</a></p>
            <p><a href={result.statusUrl}>View generation progress &rarr;</a></p>
          </div>
        )}
      </div>
    </div>
  );
}
