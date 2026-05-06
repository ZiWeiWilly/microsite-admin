import type { DeploymentInfo, DeploymentState } from './types';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_ORG_ID = process.env.VERCEL_ORG_ID;

interface VercelProject {
  id: string;
  name: string;
}

interface VercelDeployment {
  uid?: string;
  url?: string;
  readyState?: string;
  state?: string;
  inspectorUrl?: string;
  createdAt?: number;
  meta?: {
    githubCommitSha?: string;
    githubCommitRef?: string;
  };
}

export async function vercelApi<T = unknown>(url: string): Promise<T | null> {
  if (!VERCEL_TOKEN) return null;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export async function getVercelProject(repo: string): Promise<VercelProject | null> {
  if (!VERCEL_TOKEN) return null;
  const repoName = repo.split('/').pop();
  if (!repoName) return null;
  const params = new URLSearchParams();
  if (VERCEL_ORG_ID) params.set('teamId', VERCEL_ORG_ID);
  const suffix = params.toString();
  const data = await vercelApi<VercelProject>(
    `https://api.vercel.com/v9/projects/${repoName}${suffix ? `?${suffix}` : ''}`
  );
  if (!data?.id) return null;
  return data;
}

export async function getPreviewDeployment(repo: string, branchName: string) {
  const project = await getVercelProject(repo);
  if (!project?.id) return null;

  const params = new URLSearchParams({
    projectId: project.id,
    target: 'preview',
    limit: '1',
    'meta-githubCommitRef': branchName,
  });
  if (VERCEL_ORG_ID) params.set('teamId', VERCEL_ORG_ID);
  const data = await vercelApi<{ deployments?: VercelDeployment[] }>(
    `https://api.vercel.com/v6/deployments?${params.toString()}`
  );
  const deployment = data?.deployments?.[0];
  if (!deployment) return null;

  return {
    previewUrl: deployment.url ? `https://${deployment.url}` : undefined,
    previewState: deployment.readyState || deployment.state || 'UNKNOWN',
    previewCommitSha:
      deployment.meta?.githubCommitSha || deployment.meta?.githubCommitRef || undefined,
  };
}

export async function getProductionSiteUrl(repo: string): Promise<string | undefined> {
  if (!VERCEL_TOKEN) return undefined;
  const project = await getVercelProject(repo);
  if (project?.name) return `https://${project.name}.vercel.app`;
  return undefined;
}

const READY_LIKE = new Set(['READY']);
const BUILDING_LIKE = new Set(['BUILDING', 'INITIALIZING']);
const QUEUED_LIKE = new Set(['QUEUED']);
const ERROR_LIKE = new Set(['ERROR']);
const CANCELED_LIKE = new Set(['CANCELED', 'CANCELLED']);

function normalizeState(raw: string | undefined): DeploymentState {
  if (!raw) return 'UNKNOWN';
  const s = raw.toUpperCase();
  if (READY_LIKE.has(s)) return 'READY';
  if (BUILDING_LIKE.has(s)) return 'BUILDING';
  if (QUEUED_LIKE.has(s)) return 'QUEUED';
  if (ERROR_LIKE.has(s)) return 'ERROR';
  if (CANCELED_LIKE.has(s)) return 'CANCELED';
  return 'UNKNOWN';
}

export async function fetchProductionDeployment(repo: string): Promise<DeploymentInfo | null> {
  if (!VERCEL_TOKEN) {
    return { state: 'NOT_LINKED', url: null, updatedAt: null, inspectorUrl: null };
  }
  const project = await getVercelProject(repo);
  if (!project?.id) {
    return { state: 'NOT_LINKED', url: null, updatedAt: null, inspectorUrl: null };
  }

  const params = new URLSearchParams({
    projectId: project.id,
    target: 'production',
    limit: '1',
  });
  if (VERCEL_ORG_ID) params.set('teamId', VERCEL_ORG_ID);
  const data = await vercelApi<{ deployments?: VercelDeployment[] }>(
    `https://api.vercel.com/v6/deployments?${params.toString()}`
  );
  const deployment = data?.deployments?.[0];

  if (!deployment) {
    // Project exists but no deployments yet
    return {
      state: 'UNKNOWN',
      url: project.name ? `https://${project.name}.vercel.app` : null,
      updatedAt: null,
      inspectorUrl: null,
    };
  }

  return {
    state: normalizeState(deployment.readyState || deployment.state),
    url: deployment.url ? `https://${deployment.url}` : `https://${project.name}.vercel.app`,
    updatedAt: deployment.createdAt ? new Date(deployment.createdAt).toISOString() : null,
    inspectorUrl: deployment.inspectorUrl ?? null,
  };
}
