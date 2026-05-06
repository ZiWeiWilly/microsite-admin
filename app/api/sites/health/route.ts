import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase';
import { fetchProductionDeployment } from '@/app/lib/vercel-deployments';
import { fetchAllWorkflowRuns } from '@/app/lib/github-workflows';
import type { SiteHealth, SitesHealthResponse } from '@/app/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONCURRENCY = 5;

async function processSite(repoFullName: string): Promise<SiteHealth> {
  const errors: SiteHealth['errors'] = [];

  const [deploymentResult, workflowResult] = await Promise.allSettled([
    fetchProductionDeployment(repoFullName),
    fetchAllWorkflowRuns(repoFullName),
  ]);

  const deployment =
    deploymentResult.status === 'fulfilled'
      ? deploymentResult.value
      : (() => {
          errors.push({
            source: 'vercel',
            message:
              deploymentResult.reason instanceof Error
                ? deploymentResult.reason.message
                : 'Failed to fetch deployment',
          });
          return null;
        })();

  let workflows: SiteHealth['workflows'] = [];
  if (workflowResult.status === 'fulfilled') {
    workflows = workflowResult.value.workflows;
    for (const e of workflowResult.value.errors) {
      errors.push(e);
    }
  } else {
    errors.push({
      source: 'github',
      message:
        workflowResult.reason instanceof Error
          ? workflowResult.reason.message
          : 'Failed to fetch workflows',
    });
  }

  return {
    repo_full_name: repoFullName,
    deployment,
    workflows,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

async function runBounded<T>(
  items: string[],
  fn: (item: string) => Promise<T>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const s of settled) {
      if (s.status === 'fulfilled') results.push(s.value);
    }
  }
  return results;
}

export async function GET(request: NextRequest) {
  try {
    const reposParam = request.nextUrl.searchParams.get('repos');

    let repos: string[];
    if (reposParam) {
      repos = reposParam
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
    } else {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('sites')
        .select('repo_full_name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      repos = (data ?? []).map((row: { repo_full_name: string }) => row.repo_full_name);
    }

    const healthList = await runBounded(repos, processSite, CONCURRENCY);

    const sites: SitesHealthResponse['sites'] = {};
    for (const h of healthList) {
      sites[h.repo_full_name] = h;
    }

    return NextResponse.json({ sites } satisfies SitesHealthResponse);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
