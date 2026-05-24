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

    const supabase = getSupabase();

    let repos: string[];
    let existingUrls: Record<string, string | null> = {};
    if (reposParam) {
      repos = reposParam
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
    } else {
      const { data, error } = await supabase
        .from('sites')
        .select('repo_full_name, vercel_url')
        .order('created_at', { ascending: false });
      if (error) throw error;
      repos = (data ?? []).map((row: { repo_full_name: string }) => row.repo_full_name);
      for (const row of data ?? []) {
        existingUrls[row.repo_full_name] = row.vercel_url ?? null;
      }
    }

    const healthList = await runBounded(repos, processSite, CONCURRENCY);

    const sites: SitesHealthResponse['sites'] = {};
    const urlUpdates: Promise<unknown>[] = [];
    for (const h of healthList) {
      sites[h.repo_full_name] = h;
      const deploymentUrl = h.deployment?.url;
      if (deploymentUrl && h.deployment?.state === 'READY' && !existingUrls[h.repo_full_name]) {
        urlUpdates.push(
          Promise.resolve(
            supabase
              .from('sites')
              .update({ vercel_url: deploymentUrl })
              .eq('repo_full_name', h.repo_full_name)
              .is('vercel_url', null)
          )
        );
      }
    }
    await Promise.allSettled(urlUpdates);

    return NextResponse.json({ sites } satisfies SitesHealthResponse);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
