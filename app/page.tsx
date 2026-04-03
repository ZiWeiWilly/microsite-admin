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
  { code: 'ru', label: 'Русский' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'lo', label: 'ລາວ' },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ repoUrl?: string; statusUrl?: string; error?: string } | null>(null);
  const [languages, setLanguages] = useState<string[]>(ALL_LANGUAGES.map(l => l.code));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const form = new FormData(e.currentTarget);

    const config = {
      attractionName: form.get('attractionName') as string,
      klookUrl: form.get('klookUrl') as string,
      domain: form.get('domain') as string,
      affiliateUrl: form.get('affiliateUrl') as string,
      baseCurrency: form.get('baseCurrency') as string,
      colors: {
        primary: form.get('colorPrimary') as string,
        secondary: form.get('colorSecondary') as string,
        accent: form.get('colorAccent') as string,
      },
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
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Microsite Generator</h1>
        <p style={styles.subtitle}>Fill in the details below to generate a new Klook affiliate landing page.</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Attraction Name *</label>
            <input name="attractionName" required placeholder="e.g. Ramayana Water Park" style={styles.input} />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Klook Activity URL *</label>
            <input name="klookUrl" required placeholder="https://www.klook.com/activity/12345-..." style={styles.input} />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Domain *</label>
            <input name="domain" required placeholder="e.g. ramayana-waterpark.guide" style={styles.input} />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Affiliate URL *</label>
            <input name="affiliateUrl" required placeholder="https://affiliate.klook.com/redirect?aid=..." style={styles.input} />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Base Currency</label>
            <select name="baseCurrency" defaultValue="THB" style={styles.select}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Brand Colors</label>
            <div style={styles.colorRow}>
              <div>
                <small>Primary</small>
                <input name="colorPrimary" type="color" defaultValue="#0ea5e9" style={styles.colorInput} />
              </div>
              <div>
                <small>Secondary</small>
                <input name="colorSecondary" type="color" defaultValue="#06b6d4" style={styles.colorInput} />
              </div>
              <div>
                <small>Accent</small>
                <input name="colorAccent" type="color" defaultValue="#f59e0b" style={styles.colorInput} />
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
