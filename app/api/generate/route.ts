import { NextResponse } from 'next/server';
import _sodium from 'libsodium-wrappers';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const TEMPLATE_OWNER = process.env.TEMPLATE_OWNER || 'ZiWeiWilly';
const TEMPLATE_REPO = process.env.TEMPLATE_REPO || 'microsite-template';
const TARGET_OWNER = process.env.TARGET_OWNER || TEMPLATE_OWNER;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_ORG_ID = process.env.VERCEL_ORG_ID;

interface SiteConfig {
  attractionName: string;
  klookUrl: string;
  domain: string;
  affiliateUrl: string;
  baseCurrency?: string;
  colors?: { primary: string; secondary: string; accent: string };
  languages?: string[];
  headScripts?: string;
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

async function createVercelProject(
  projectName: string,
  githubOwner: string,
  githubRepo: string,
  productionBranch: string
): Promise<{ id: string; url: string }> {
  const url = new URL('https://api.vercel.com/v10/projects');
  if (VERCEL_ORG_ID) url.searchParams.set('teamId', VERCEL_ORG_ID);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName,
      gitRepository: {
        type: 'github',
        repo: `${githubOwner}/${githubRepo}`,
      },
      productionBranch,
      framework: null,
      buildCommand: 'npm run build',
      outputDirectory: '.',
      installCommand: 'npm install',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Vercel API error: ${data.error?.message || JSON.stringify(data)}`);
  }
  return { id: data.id, url: `https://${data.name}.vercel.app` };
}

/** Set required runtime secrets on the newly generated repo */
async function setRepoSecrets(repoFullName: string, extraSecrets: Record<string, string> = {}) {
  const secrets: Record<string, string> = { ...extraSecrets };
  if (process.env.OPENROUTER_API_KEY) secrets['OPENROUTER_API_KEY'] = process.env.OPENROUTER_API_KEY;
  if (process.env.FIRECRAWL_API_KEY) secrets['FIRECRAWL_API_KEY'] = process.env.FIRECRAWL_API_KEY;
  if (GITHUB_TOKEN) secrets['PERSONAL_TOKEN'] = GITHUB_TOKEN;

  console.log(`[setRepoSecrets] keys to set: ${Object.keys(secrets).join(', ') || 'none'}`);
  if (Object.keys(secrets).length === 0) {
    console.warn('[setRepoSecrets] No secrets found in env vars');
    return;
  }

  // Get repo public key for encryption
  const { key, key_id } = await githubApi(`/repos/${repoFullName}/actions/secrets/public-key`);

  for (const [name, value] of Object.entries(secrets)) {
    const encryptedValue = await encryptSecret(key, value);
    await githubApi(`/repos/${repoFullName}/actions/secrets/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ encrypted_value: encryptedValue, key_id }),
    });
    console.log(`[setRepoSecrets] ✓ set ${name}`);
  }
}

async function cloudflareApi(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

async function setupCloudflarePages(repoOwner: string, repoName: string, domain: string) {
  // Project name: max 63 chars, lowercase alphanumeric + hyphens
  const projectName = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63);

  // Create Pages project linked to the GitHub repo
  await cloudflareApi(`/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
      source: {
        type: 'github',
        config: {
          owner: repoOwner,
          repo_name: repoName,
          production_branch: 'main',
          pr_comments_enabled: false,
          deployments_enabled: true,
        },
      },
      build_config: {
        build_command: '',
        destination_dir: '.',
      },
    }),
  });

  // Bind the custom domain (Cloudflare handles DNS automatically since domain is on CF)
  await cloudflareApi(`/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });

  return {
    projectName,
    pagesUrl: `https://${projectName}.pages.dev`,
    customDomain: `https://${domain}`,
  };
}

/** Commit a file to the repo via GitHub Contents API */
async function commitFileToRepo(repoFullName: string, path: string, contentBase64: string, message: string) {
  let sha: string | undefined;
  try {
    const existing = await githubApi(`/repos/${repoFullName}/contents/${path}`);
    if (typeof existing?.sha === 'string') {
      sha = existing.sha;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // 404 means file does not exist yet, so create without sha.
    if (!msg.includes('GitHub API error: 404')) {
      throw e;
    }
  }

  await githubApi(`/repos/${repoFullName}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    }),
  });
  console.log(`[commitFile] ✓ ${path}`);
}

export async function POST(request: Request) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const config: SiteConfig = JSON.parse(formData.get('config') as string);
    const logoFile = formData.get('logo') as File | null;
    const logoLightFile = formData.get('logoLight') as File | null;
    const logoIconFile = formData.get('logoIcon') as File | null;

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
          private: true,
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
    const defaultBranch = repoData.default_branch || 'main';

    // Step 2: Wait for repo to be ready (template generation is async)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Create Vercel project linked to the GitHub repo
    let vercelWarning: string | undefined;
    let vercelProjectUrl: string | undefined;
    let vercelProjectId: string | undefined;
    const repoOwner = repoData.owner?.login || TARGET_OWNER;
    if (VERCEL_TOKEN && repoOwner) {
      try {
        const vercel = await createVercelProject(repoName, repoOwner, repoName, defaultBranch);
        vercelProjectId = vercel.id;
        vercelProjectUrl = vercel.url;
        console.log(`[vercel] ✓ project created: ${vercelProjectUrl}`);
      } catch (e: unknown) {
        vercelWarning = e instanceof Error ? e.message : String(e);
        console.warn(`[vercel] project creation failed: ${vercelWarning}`);
      }
    }
    const vercelSecrets: Record<string, string> = {};
    if (VERCEL_TOKEN) vercelSecrets['VERCEL_TOKEN'] = VERCEL_TOKEN;
    if (VERCEL_ORG_ID) vercelSecrets['VERCEL_ORG_ID'] = VERCEL_ORG_ID;
    if (vercelProjectId) vercelSecrets['VERCEL_PROJECT_ID'] = vercelProjectId;
    await setRepoSecrets(repoFullName, vercelSecrets);

    // Step 4: Commit logo images to the repo
    const imageFiles = [
      { file: logoFile, path: 'images/logo.png' },
      { file: logoLightFile, path: 'images/logo-light.png' },
      { file: logoIconFile, path: 'images/logo-icon.png' },
    ];
    for (const { file, path } of imageFiles) {
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString('base64');
        await commitFileToRepo(repoFullName, path, base64, `Add ${path}`);
      }
    }

    // Step 5: Set up Cloudflare Pages + custom domain (if configured)
    let cloudflareResult: { projectName: string; pagesUrl: string; customDomain: string } | undefined;
    let cloudflareWarning: string | undefined;
    if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN && config.domain) {
      try {
        cloudflareResult = await setupCloudflarePages(TARGET_OWNER, repoName, config.domain);
        console.log(`[cloudflare] ✓ Pages project created: ${cloudflareResult.pagesUrl}`);
        console.log(`[cloudflare] ✓ Custom domain bound: ${cloudflareResult.customDomain}`);
      } catch (e: unknown) {
        cloudflareWarning = e instanceof Error ? e.message : String(e);
        console.warn(`[cloudflare] setup failed: ${cloudflareWarning}`);
      }
    }

    // Step 6: Trigger the generate-and-deploy workflow
    try {
      await githubApi(`/repos/${repoFullName}/actions/workflows/generate-and-deploy.yml/dispatches`, {
        method: 'POST',
        body: JSON.stringify({
          ref: defaultBranch,
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
        ...(cloudflareResult && {
          pagesUrl: cloudflareResult.pagesUrl,
          customDomain: cloudflareResult.customDomain,
        }),
        ...(cloudflareWarning && { cloudflareWarning }),
      });
    }

    // Step 7: Get the workflow run URL
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
      ...(vercelProjectUrl && { vercelProjectUrl }),
      ...(vercelWarning && { vercelWarning }),
      ...(cloudflareResult && {
        pagesUrl: cloudflareResult.pagesUrl,
        customDomain: cloudflareResult.customDomain,
      }),
      ...(cloudflareWarning && { cloudflareWarning }),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
