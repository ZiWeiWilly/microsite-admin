import type {
  RunConclusion,
  RunStatus,
  WorkflowRunSummary,
  WorkflowSummary,
} from './types';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

interface GithubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
}

interface GithubWorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_branch: string;
}

async function githubApi<T = unknown>(endpoint: string): Promise<T> {
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
  return res.json() as Promise<T>;
}

export async function listWorkflows(repo: string): Promise<GithubWorkflow[]> {
  const data = await githubApi<{ workflows?: GithubWorkflow[] }>(
    `/repos/${repo}/actions/workflows`
  );
  return (data.workflows ?? []).filter((w) => w.state === 'active');
}

function workflowFileFromPath(path: string): string {
  // path is like ".github/workflows/ai-edit.yml"
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function normalizeRunStatus(raw: string): RunStatus {
  if (raw === 'queued' || raw === 'in_progress' || raw === 'completed') return raw;
  return 'unknown';
}

function normalizeConclusion(raw: string | null): RunConclusion {
  if (raw === null) return null;
  if (
    raw === 'success' ||
    raw === 'failure' ||
    raw === 'cancelled' ||
    raw === 'skipped' ||
    raw === 'timed_out'
  ) {
    return raw;
  }
  return 'failure';
}

function toRunSummary(run: GithubWorkflowRun): WorkflowRunSummary {
  return {
    runId: run.id,
    status: normalizeRunStatus(run.status),
    conclusion: normalizeConclusion(run.conclusion),
    runUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    headBranch: run.head_branch,
  };
}

export async function fetchLatestRunForWorkflow(
  repo: string,
  workflowFile: string
): Promise<WorkflowRunSummary | null> {
  const data = await githubApi<{ workflow_runs?: GithubWorkflowRun[] }>(
    `/repos/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=1`
  );
  const run = data.workflow_runs?.[0];
  return run ? toRunSummary(run) : null;
}

export interface AllRunsResult {
  workflows: WorkflowSummary[];
  errors: { source: 'github'; message: string }[];
}

export async function fetchAllWorkflowRuns(repo: string): Promise<AllRunsResult> {
  const errors: { source: 'github'; message: string }[] = [];

  let workflows: GithubWorkflow[];
  try {
    workflows = await listWorkflows(repo);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to list workflows';
    return { workflows: [], errors: [{ source: 'github', message }] };
  }

  const summaries = await Promise.all(
    workflows.map(async (wf): Promise<WorkflowSummary> => {
      const file = workflowFileFromPath(wf.path);
      try {
        const latestRun = await fetchLatestRunForWorkflow(repo, file);
        return { workflowFile: file, workflowName: wf.name, latestRun };
      } catch (e) {
        const message = e instanceof Error ? e.message : `Failed to fetch runs for ${file}`;
        errors.push({ source: 'github', message });
        return { workflowFile: file, workflowName: wf.name, latestRun: null };
      }
    })
  );

  return { workflows: summaries, errors };
}
