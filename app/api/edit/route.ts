import { NextResponse } from 'next/server';
import { getSupabase, SCREENSHOT_BUCKET } from '@/app/lib/supabase';
import { lookupSiteByUrl } from '@/app/lib/site-lookup';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

const AI_EDIT_WORKFLOW_PATH = '.github/workflows/ai-edit.yml';

const AI_EDIT_WORKFLOW_YAML = `name: AI Edit
on:
  workflow_dispatch:
    inputs:
      requirements:
        description: 'User requirements (natural language)'
        required: true
        type: string
      screenshot_url:
        description: 'Public URL of reference screenshot'
        required: false
        type: string

jobs:
  ai-edit:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          token: \${{ secrets.PERSONAL_TOKEN }}
          fetch-depth: 0

      - name: Download screenshot
        if: \${{ inputs.screenshot_url != '' }}
        run: |
          mkdir -p .ai-edit
          curl -L -o .ai-edit/screenshot.png "\${{ inputs.screenshot_url }}"

      - name: Run Claude Code
        uses: anthropics/claude-code-base-action@beta
        with:
          model: anthropic/claude-sonnet-4-5
          claude_env: |
            ANTHROPIC_BASE_URL: https://openrouter.ai/api/v1
            ANTHROPIC_API_KEY: \${{ secrets.OPENROUTER_API_KEY }}
          allowed_tools: Read,Write,Edit,Glob,Grep,Bash
          max_turns: '30'
          prompt: |
            You are editing a Klook microsite repository to fulfill the user's request.

            User requirements:
            \${{ inputs.requirements }}

            \${{ inputs.screenshot_url && 'A reference screenshot is at .ai-edit/screenshot.png — read it with the Read tool to understand the visual context.' || '' }}

            Rules:
            - Modify only files under app/, components/, src/, styles/, public/, content/, or top-level config files like tailwind.config.* and next.config.*
            - Do NOT modify .github/, package.json dependencies, or any workflow files
            - Do NOT modify or delete the .ai-edit/ directory
            - Keep changes minimal and focused on the user's request
            - Preserve existing i18n keys; add new ones if needed
            - When unsure about a file's purpose, use Glob/Grep to explore before editing

      - name: Commit and push
        run: |
          git config user.name "AI Edit Bot"
          git config user.email "ai-edit@klook.com"
          rm -rf .ai-edit
          if [ -n "$(git status --porcelain)" ]; then
            git add -A
            REQ_SUMMARY=$(echo "\${{ inputs.requirements }}" | tr '\\n' ' ' | head -c 60)
            git commit -m "AI edit: $REQ_SUMMARY"
            git push
          else
            echo "No changes produced by AI"
            exit 1
          fi
`;

interface EditRequestBody {
  repo?: string;
  pageUrl: string;
  requirements: string;
  areaDescription?: string;
}

function composeRequirements(input: { pageUrl: string; areaDescription?: string; change: string }): string {
  const parts: string[] = [];
  parts.push(`Target page URL: ${input.pageUrl}`);
  parts.push('');
  parts.push(
    `The user wants to modify the page served at the URL above. The repository is the Next.js source (not a built site) — locate the route/file in this repo that corresponds to this URL by examining the app/ directory and any i18n routing, then make the change there.`
  );
  if (input.areaDescription?.trim()) {
    parts.push('');
    parts.push(`Area on the page to change: ${input.areaDescription.trim()}`);
  }
  parts.push('');
  parts.push(`Change requested: ${input.change.trim()}`);
  return parts.join('\n');
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

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`GitHub API error: ${res.status} - ${data.message || JSON.stringify(data)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return data;
}

async function ensureWorkflowFile(repoFullName: string) {
  let existingSha: string | undefined;
  try {
    const existing = await githubApi(`/repos/${repoFullName}/contents/${AI_EDIT_WORKFLOW_PATH}`);
    existingSha = existing.sha;
  } catch (e: unknown) {
    const status = (e as Error & { status?: number }).status;
    if (status !== 404) throw e;
  }

  const content = Buffer.from(AI_EDIT_WORKFLOW_YAML).toString('base64');
  await githubApi(`/repos/${repoFullName}/contents/${AI_EDIT_WORKFLOW_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: existingSha ? 'Update AI edit workflow' : 'Add AI edit workflow',
      content,
      ...(existingSha && { sha: existingSha }),
    }),
  });
}

async function getDefaultBranch(repoFullName: string): Promise<string> {
  const data = await githubApi(`/repos/${repoFullName}`);
  return data.default_branch || 'main';
}

export async function POST(request: Request) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const body: EditRequestBody = {
      repo: (formData.get('repo') as string) || undefined,
      pageUrl: (formData.get('pageUrl') as string) || '',
      requirements: (formData.get('requirements') as string) || '',
      areaDescription: (formData.get('areaDescription') as string) || undefined,
    };
    const screenshotFile = formData.get('screenshot') as File | null;

    if (!body.pageUrl?.trim() || !body.requirements?.trim()) {
      return NextResponse.json({ error: 'Missing required fields: pageUrl and requirements' }, { status: 400 });
    }

    // Resolve repo from pageUrl if not provided
    let repo = body.repo;
    if (!repo) {
      const site = await lookupSiteByUrl(body.pageUrl);
      if (!site) {
        return NextResponse.json({ error: `No site found matching URL: ${body.pageUrl}` }, { status: 404 });
      }
      repo = site.repo_full_name;
    }

    const composedRequirements = composeRequirements({
      pageUrl: body.pageUrl.trim(),
      areaDescription: body.areaDescription,
      change: body.requirements,
    });

    if (screenshotFile) {
      if (!screenshotFile.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Screenshot must be an image file' }, { status: 400 });
      }
      if (screenshotFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Screenshot too large (max 5MB)' }, { status: 400 });
      }
    }

    let screenshotUrl: string | undefined;
    if (screenshotFile) {
      try {
        const supabase = getSupabase();
        const ext = screenshotFile.name.split('.').pop() || 'png';
        const objectPath = `${repo.replace('/', '-')}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(SCREENSHOT_BUCKET)
          .upload(objectPath, screenshotFile, {
            contentType: screenshotFile.type,
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(objectPath);
        screenshotUrl = data.publicUrl;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({
          error: `Screenshot upload failed (Supabase): ${msg}. Verify SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY and that the "${SCREENSHOT_BUCKET}" bucket exists.`
        }, { status: 500 });
      }
    }

    // Mark site as editing in DB (best-effort; ignore if not in DB)
    try {
      const supabase = getSupabase();
      await supabase
        .from('sites')
        .update({ status: 'editing' })
        .eq('repo_full_name', repo);
    } catch {
      // Site may pre-date DB tracking; continue
    }

    await ensureWorkflowFile(repo);

    const defaultBranch = await getDefaultBranch(repo);

    await new Promise(resolve => setTimeout(resolve, 1500));

    await githubApi(`/repos/${repo}/actions/workflows/ai-edit.yml/dispatches`, {
      method: 'POST',
      body: JSON.stringify({
        ref: defaultBranch,
        inputs: {
          requirements: composedRequirements,
          screenshot_url: screenshotUrl ?? '',
        },
      }),
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    let runUrl = `https://github.com/${repo}/actions`;
    try {
      const runs = await githubApi(`/repos/${repo}/actions/runs?per_page=1`);
      if (runs.workflow_runs?.length > 0) {
        runUrl = runs.workflow_runs[0].html_url;
      }
    } catch {
      // not critical
    }

    return NextResponse.json({
      repoFullName: repo,
      runUrl,
      screenshotUrl,
      message: 'AI edit workflow dispatched',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
