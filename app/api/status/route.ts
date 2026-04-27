import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_ORG_ID = process.env.VERCEL_ORG_ID;
const AI_EDIT_BRANCH_PREFIX = 'ai-edit/';

interface PullRequestSummary {
  number: number;
  html_url: string;
  head: { ref: string; sha: string };
}

interface WorkflowStatusResponse {
  status: string;
  conclusion: string | null;
  runUrl: string;
  createdAt: string;
  updatedAt: string;
  workflowName: string;
  jobs: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    steps: Array<{ name: string; status: string; conclusion: string | null }>;
  }>;
  siteUrl?: string;
  previewUrl?: string;
  previewState?: string;
  previewCommitSha?: string;
  prNumber?: number;
  prUrl?: string;
  branchName?: string;
}

async function vercelApi(url: string) {
  if (!VERCEL_TOKEN) return null;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function githubApi(endpoint: string) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`GitHub API error: ${res.status} - ${data.message || ''}`);
  }
  return res.json();
}

async function getOpenAiEditPr(repo: string): Promise<PullRequestSummary | null> {
  const pulls = await githubApi(`/repos/${repo}/pulls?state=open&per_page=30`);
  const list = Array.isArray(pulls) ? pulls : [];
  return (
    list.find((pr: PullRequestSummary) => pr?.head?.ref?.startsWith(AI_EDIT_BRANCH_PREFIX)) || null
  );
}

async function getVercelProject(repo: string) {
  if (!VERCEL_TOKEN) return null;
  const repoName = repo.split('/').pop();
  if (!repoName) return null;
  const params = new URLSearchParams();
  if (VERCEL_ORG_ID) params.set('teamId', VERCEL_ORG_ID);
  const suffix = params.toString();
  const data = await vercelApi(`https://api.vercel.com/v9/projects/${repoName}${suffix ? `?${suffix}` : ''}`);
  if (!data?.id) return null;
  return data;
}

async function getPreviewDeployment(repo: string, branchName: string) {
  const project = await getVercelProject(repo);
  if (!project?.id) return null;

  const params = new URLSearchParams({
    projectId: project.id,
    target: 'preview',
    limit: '1',
    'meta-githubCommitRef': branchName,
  });
  if (VERCEL_ORG_ID) params.set('teamId', VERCEL_ORG_ID);
  const data = await vercelApi(`https://api.vercel.com/v6/deployments?${params.toString()}`);
  const deployment = data?.deployments?.[0];
  if (!deployment) return null;

  return {
    previewUrl: deployment.url ? `https://${deployment.url}` : undefined,
    previewState: deployment.readyState || deployment.state || 'UNKNOWN',
    previewCommitSha:
      deployment.meta?.githubCommitSha ||
      deployment.meta?.githubCommitRef ||
      undefined,
  };
}

async function getProductionSiteUrl(repo: string): Promise<string | undefined> {
  if (!VERCEL_TOKEN) return undefined;
  const project = await getVercelProject(repo);
  if (project?.name) return `https://${project.name}.vercel.app`;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const repo = request.nextUrl.searchParams.get('repo');
    const type = request.nextUrl.searchParams.get('type') === 'edit' ? 'edit' : 'generate';
    if (!repo) {
      return NextResponse.json({ error: 'Missing repo parameter' }, { status: 400 });
    }

    // Get latest workflow runs
    const runs = await githubApi(
      type === 'edit'
        ? `/repos/${repo}/actions/workflows/ai-edit.yml/runs?per_page=5`
        : `/repos/${repo}/actions/runs?per_page=5`
    );
    const latestRun = runs.workflow_runs?.[0];

    if (!latestRun) {
      return NextResponse.json({ status: 'no_runs', message: 'No workflow runs found' });
    }

    // Get jobs for the run
    const jobs = await githubApi(`/repos/${repo}/actions/runs/${latestRun.id}/jobs`);

    const result: WorkflowStatusResponse = {
      status: latestRun.status,
      conclusion: latestRun.conclusion,
      runUrl: latestRun.html_url,
      createdAt: latestRun.created_at,
      updatedAt: latestRun.updated_at,
      workflowName: latestRun.name,
      jobs: (jobs.jobs || []).map((j: { name: string; status: string; conclusion: string | null; steps: Array<{ name: string; status: string; conclusion: string | null }> }) => ({
        name: j.name,
        status: j.status,
        conclusion: j.conclusion,
        steps: (j.steps || []).map((s: { name: string; status: string; conclusion: string | null }) => ({
          name: s.name,
          status: s.status,
          conclusion: s.conclusion,
        })),
      })),
    };

    if (type === 'edit') {
      try {
        const aiEditPr = await getOpenAiEditPr(repo);
        if (aiEditPr) {
          result.prNumber = aiEditPr.number;
          result.prUrl = aiEditPr.html_url;
          result.branchName = aiEditPr.head.ref;
          const preview = await getPreviewDeployment(repo, aiEditPr.head.ref);
          if (preview?.previewUrl) result.previewUrl = preview.previewUrl;
          if (preview?.previewState) result.previewState = preview.previewState;
          if (preview?.previewCommitSha) result.previewCommitSha = preview.previewCommitSha;
          if (!VERCEL_TOKEN && !result.previewState) {
            result.previewState = 'UNAVAILABLE';
          }
        }
      } catch {
        // best-effort only
      }
    }

    // If completed and succeeded, get the Vercel project URL
    if (latestRun.conclusion === 'success' && VERCEL_TOKEN) {
      try {
        result.siteUrl = await getProductionSiteUrl(repo);
      } catch {
        // Vercel project might not exist yet
      }
    }

    // Sync to Supabase (best-effort) — only update on completion to avoid
    // overwriting initial 'generating' / 'editing' states while a run is live.
    if (latestRun.status === 'completed') {
      try {
        const supabase = getSupabase();
        const status = latestRun.conclusion === 'success' ? 'ready' : 'failed';
        const update: Record<string, string | null> = { status };
        if (result.siteUrl) update.vercel_url = result.siteUrl;
        await supabase.from('sites').update(update).eq('repo_full_name', repo);
      } catch {
        // Site may not be tracked in DB; ignore
      }
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
