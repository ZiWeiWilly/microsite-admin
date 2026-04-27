import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

interface ApproveRequestBody {
  repo?: string;
  prNumber?: number;
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

async function deleteBranch(repo: string, branchName: string) {
  try {
    await githubApi(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branchName)}`, {
      method: 'DELETE',
    });
  } catch (e: unknown) {
    const status = (e as Error & { status?: number }).status;
    if (status !== 404 && status !== 422) {
      throw e;
    }
  }
}

export async function POST(request: Request) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as ApproveRequestBody;
    const repo = body.repo?.trim();
    const prNumber = Number(body.prNumber);
    if (!repo || !Number.isInteger(prNumber) || prNumber <= 0) {
      return NextResponse.json({ error: 'Missing required fields: repo and prNumber' }, { status: 400 });
    }

    const pr = await githubApi(`/repos/${repo}/pulls/${prNumber}`);
    const branchName = pr?.head?.ref as string | undefined;
    const mergeRes = await githubApi(`/repos/${repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({
        merge_method: 'squash',
      }),
    });

    if (branchName) {
      await deleteBranch(repo, branchName);
    }

    try {
      const supabase = getSupabase();
      await supabase.from('sites').update({ status: 'ready' }).eq('repo_full_name', repo);
    } catch {
      // best effort only
    }

    return NextResponse.json({
      merged: true,
      mergedSha: mergeRes?.sha ?? null,
      branchName: branchName ?? null,
      productionDeployStarted: true,
      message: 'PR merged successfully',
    });
  } catch (e: unknown) {
    const status = (e as Error & { status?: number }).status;
    const message = e instanceof Error ? e.message : 'Unknown error';
    if (status === 409 || status === 422) {
      return NextResponse.json({
        error: 'Pull request is not mergeable right now. Please resolve conflicts or wait for checks to finish.',
        details: message,
      }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
