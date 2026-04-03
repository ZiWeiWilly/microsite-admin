import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

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

export async function GET(request: NextRequest) {
  try {
    const repo = request.nextUrl.searchParams.get('repo');
    if (!repo) {
      return NextResponse.json({ error: 'Missing repo parameter' }, { status: 400 });
    }

    // Get latest workflow runs
    const runs = await githubApi(`/repos/${repo}/actions/runs?per_page=5`);
    const latestRun = runs.workflow_runs?.[0];

    if (!latestRun) {
      return NextResponse.json({ status: 'no_runs', message: 'No workflow runs found' });
    }

    // Get jobs for the run
    const jobs = await githubApi(`/repos/${repo}/actions/runs/${latestRun.id}/jobs`);

    const result: {
      status: string; conclusion: string | null; runUrl: string;
      createdAt: string; updatedAt: string; workflowName: string;
      jobs: Array<{ name: string; status: string; conclusion: string | null; steps: Array<{ name: string; status: string; conclusion: string | null }> }>;
      siteUrl?: string;
    } = {
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

    // If completed and succeeded, try to get the site URL
    if (latestRun.conclusion === 'success') {
      try {
        const pages = await githubApi(`/repos/${repo}/pages`);
        result.siteUrl = pages.html_url;
      } catch {
        // Pages might not be set up yet
      }
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
