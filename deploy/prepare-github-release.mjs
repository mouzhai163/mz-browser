import fs from 'node:fs';

const [repository, tag, ...options] = process.argv.slice(2);
const dryRun = options.includes('--dry-run');
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

if (!repository || !tag || options.some((option) => option !== '--dry-run')) {
  throw new Error(
    'Usage: node deploy/prepare-github-release.mjs <owner/repository> <tag> [--dry-run]'
  );
}

if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error(`Invalid GitHub repository name: "${repository}"`);
}

if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`Invalid release tag: "${tag}"`);
}

if (!dryRun && !token) {
  throw new Error('GITHUB_TOKEN or GH_TOKEN is required to create a draft release');
}

const headers = {
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'User-Agent': 'simprint-release-workflow',
  'X-GitHub-Api-Version': '2022-11-28',
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init.headers,
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `GitHub API ${init.method ?? 'GET'} ${path} failed (${response.status}): ${text}`
    );
  }

  return text ? JSON.parse(text) : null;
}

async function readAnnotatedTagNotes() {
  const tagRef = await github(`/repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`);

  if (tagRef.object?.type !== 'tag') {
    throw new Error(`Release tag "${tag}" must be an annotated tag`);
  }

  const annotatedTag = await github(`/repos/${repository}/git/tags/${tagRef.object.sha}`);
  const notes = annotatedTag.message?.trim();

  if (!notes) {
    throw new Error(`Annotated tag "${tag}" does not contain release notes`);
  }

  return notes;
}

async function findExistingRelease() {
  for (let page = 1; ; page += 1) {
    const releases = await github(`/repos/${repository}/releases?per_page=100&page=${page}`);
    const release = releases.find((candidate) => candidate.tag_name === tag);

    if (release) {
      return release;
    }
    if (releases.length < 100) {
      return null;
    }
  }
}

const notes = await readAnnotatedTagNotes();
console.log(`[prepare-github-release] Read ${notes.length} characters from annotated tag ${tag}`);

if (dryRun) {
  console.log('[prepare-github-release] Dry run completed without changing GitHub Release state');
  process.exit(0);
}

const existingRelease = await findExistingRelease();
if (existingRelease && !existingRelease.draft) {
  throw new Error(
    `Release "${tag}" is already published; refusing to replace its notes or assets automatically`
  );
}

const releasePayload = {
  tag_name: tag,
  name: tag,
  body: notes,
  draft: true,
  prerelease: false,
};

const release = existingRelease
  ? await github(`/repos/${repository}/releases/${existingRelease.id}`, {
      method: 'PATCH',
      body: JSON.stringify(releasePayload),
    })
  : await github(`/repos/${repository}/releases`, {
      method: 'POST',
      body: JSON.stringify(releasePayload),
    });

if (!release?.id || !release.draft) {
  throw new Error(`GitHub did not return a valid draft release for "${tag}"`);
}

const githubOutput = process.env.GITHUB_OUTPUT;
if (!githubOutput) {
  throw new Error('GITHUB_OUTPUT is required when preparing a release');
}

fs.appendFileSync(githubOutput, `release_id=${release.id}\n`, 'utf8');
console.log(
  `[prepare-github-release] ${existingRelease ? 'Refreshed' : 'Created'} draft release ${release.id}`
);
