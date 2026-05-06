export type DeploymentState =
  | 'READY'
  | 'BUILDING'
  | 'QUEUED'
  | 'ERROR'
  | 'CANCELED'
  | 'UNKNOWN'
  | 'NOT_LINKED';

export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'unknown';

export type RunConclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | null;

export interface DeploymentInfo {
  state: DeploymentState;
  url: string | null;
  updatedAt: string | null;
  inspectorUrl: string | null;
}

export interface WorkflowRunSummary {
  runId: number;
  status: RunStatus;
  conclusion: RunConclusion;
  runUrl: string;
  createdAt: string;
  updatedAt: string;
  headBranch: string;
}

export interface WorkflowSummary {
  workflowFile: string;
  workflowName: string;
  latestRun: WorkflowRunSummary | null;
}

export interface SiteHealthError {
  source: 'github' | 'vercel';
  message: string;
}

export interface SiteHealth {
  repo_full_name: string;
  deployment: DeploymentInfo | null;
  workflows: WorkflowSummary[];
  errors?: SiteHealthError[];
}

export interface SitesHealthResponse {
  sites: Record<string, SiteHealth>;
}
