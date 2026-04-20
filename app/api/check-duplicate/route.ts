import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const TARGET_OWNER = process.env.TARGET_OWNER || process.env.TEMPLATE_OWNER || 'ZiWeiWilly';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_ORG_ID = process.env.VERCEL_ORG_ID;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
  }

  const repoName = domain.replace(/\./g, '-');

  const [githubExists, vercelExists] = await Promise.all([
    checkGitHub(repoName),
    checkVercel(repoName),
  ]);

  return NextResponse.json({ repoName, github: githubExists, vercel: vercelExists });
}

async function checkGitHub(repoName: string): Promise<boolean> {
  if (!GITHUB_TOKEN) return false;
  try {
    const res = await fetch(`https://api.github.com/repos/${TARGET_OWNER}/${repoName}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function checkVercel(projectName: string): Promise<boolean> {
  if (!VERCEL_TOKEN) return false;
  try {
    const url = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}`);
    if (VERCEL_ORG_ID) url.searchParams.set('teamId', VERCEL_ORG_ID);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}
