import { NextResponse } from 'next/server';
import _sodium from 'libsodium-wrappers';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const TEMPLATE_OWNER = process.env.TEMPLATE_OWNER || 'ZiWeiWilly';
const TEMPLATE_REPO = process.env.TEMPLATE_REPO || 'microsite-template';
const TARGET_OWNER = process.env.TARGET_OWNER || TEMPLATE_OWNER;

interface SiteConfig {
  attractionName: string;
  klookUrl: string;
  domain: string;
  affiliateUrl: string;
  baseCurrency?: string;
  colors?: { primary: string; secondary: string; accent: string };
  languages?: string[];
}

async function githubApi(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} - ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

/** Encrypt a secret value with the repo's public key (required by GitHub Secrets API) */
async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
  await _sodium.ready;
  const sodium = _sodium;
  const keyBytes = Buffer.from(publicKey, 'base64');
  const messageBytes = Buffer.from(secretValue);
  const encrypted = sodium.crypto_box_seal(messageBytes, keyBytes);
  return Buffer.from(encrypted).toString('base64');
}

/** Set OPENROUTER_API_KEY and FIRECRAWL_API_KEY on the new repo */
async function setRepoSecrets(repoFullName: string) {
  const secrets: Record<string, string> = {};
  if (process.env.OPENROUTER_API_KEY) secrets['OPENROUTER_API_KEY'] = process.env.OPENROUTER_API_KEY;
  if (process.env.FIRECRAWL_API_KEY) secrets['FIRECRAWL_API_KEY'] = process.env.FIRECRAWL_API_KEY;

  if (Object.keys(secrets).length === 0) return;

  // Get repo public key for encryption
  const { key, key_id } = await githubApi(`/repos/${repoFullName}/actions/secrets/public-key`);

  for (const [name, value] of Object.entries(secrets)) {
    const encryptedValue = await encryptSecret(key, value);
    await githubApi(`/repos/${repoFullName}/actions/secrets/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ encrypted_value: encryptedValue, key_id }),
    });
  }
}

export async function POST(request: Request) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 });
    }

    const config: SiteConfig = await request.json();

    // Validate required fields
    const required = ['attractionName', 'klookUrl', 'domain', 'affiliateUrl'] as const;
    for (const field of required) {
      if (!config[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Generate repo name from domain
    const repoName = config.domain.replace(/\./g, '-');

    // Step 1: Create repo from template
    let repoData;
    try {
      repoData = await githubApi(`/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}/generate`, {
        method: 'POST',
        body: JSON.stringify({
          owner: TARGET_OWNER,
          name: repoName,
          description: `Klook affiliate landing page for ${config.attractionName}`,
          private: false,
          include_all_branches: false,
        }),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // If repo already exists, try to use it
      if (msg.includes('already exists') || msg.includes('422')) {
        repoData = await githubApi(`/repos/${TARGET_OWNER}/${repoName}`);
      } else {
        throw e;
      }
    }

    const repoFullName = repoData.full_name;
    const repoUrl = repoData.html_url;

    // Step 2: Wait for repo to be ready (template generation is async)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Auto-set secrets on new repo
    await setRepoSecrets(repoFullName);

    // Step 4: Trigger the generate-and-deploy workflow
    try {
      await githubApi(`/repos/${repoFullName}/actions/workflows/generate-and-deploy.yml/dispatches`, {
        method: 'POST',
        body: JSON.stringify({
          ref: 'master',
          inputs: {
            config: JSON.stringify(config),
          },
        }),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Workflow might not be available yet if repo is still being created
      return NextResponse.json({
        repoUrl,
        repoFullName,
        warning: `Repo created but workflow trigger failed: ${msg}. You may need to trigger the workflow manually from the Actions tab.`,
      });
    }

    // Step 5: Get the workflow run URL
    await new Promise(resolve => setTimeout(resolve, 2000));
    let runUrl = `${repoUrl}/actions`;
    try {
      const runs = await githubApi(`/repos/${repoFullName}/actions/runs?per_page=1`);
      if (runs.workflow_runs?.length > 0) {
        runUrl = runs.workflow_runs[0].html_url;
      }
    } catch {
      // Not critical
    }

    return NextResponse.json({
      repoUrl,
      repoFullName,
      runUrl,
      message: `Site generation started for ${config.attractionName}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
