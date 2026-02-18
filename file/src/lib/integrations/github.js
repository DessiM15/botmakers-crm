import { Octokit } from '@octokit/rest';

let _octokit = null;

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('CB-INT-004: GitHub token not configured');
  }
  if (!_octokit) {
    _octokit = new Octokit({ auth: token });
  }
  return _octokit;
}

/**
 * Check if GitHub token is configured.
 */
export function isGitHubConfigured() {
  return !!process.env.GITHUB_TOKEN;
}

/**
 * Validate that a GitHub repo exists and is accessible.
 * Returns { valid, repo } or { valid: false, error }.
 */
export async function validateRepo(owner, repo) {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.repos.get({ owner, repo });
    return {
      valid: true,
      repo: {
        fullName: data.full_name,
        defaultBranch: data.default_branch,
        url: data.html_url,
        private: data.private,
      },
    };
  } catch (err) {
    if (err.status === 404) {
      return { valid: false, error: 'Repository not found' };
    }
    if (err.status === 403) {
      return { valid: false, error: 'Rate limit exceeded or access denied' };
    }
    if (err.message?.startsWith('CB-INT-004')) {
      return { valid: false, error: 'GitHub token not configured' };
    }
    return { valid: false, error: 'Failed to validate repository' };
  }
}

/**
 * Fetch recent commits for a repo.
 */
export async function getRepoCommits(owner, repo, branch = 'main', limit = 10) {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      sha: branch,
      per_page: limit,
    });
    return {
      commits: data.map((c) => ({
        sha: c.sha,
        shortSha: c.sha.substring(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author?.name || c.author?.login || 'Unknown',
        date: c.commit.author?.date,
        url: c.html_url,
      })),
    };
  } catch (err) {
    if (err.status === 404) {
      return { commits: [], error: 'Repository or branch not found' };
    }
    if (err.status === 403) {
      return { commits: [], error: 'Rate limit exceeded' };
    }
    return { commits: [], error: 'Failed to fetch commits' };
  }
}

/**
 * Fetch branches for a repo.
 */
export async function getRepoBranches(owner, repo) {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: 30,
    });
    return {
      branches: data.map((b) => ({
        name: b.name,
        protected: b.protected,
      })),
    };
  } catch (err) {
    if (err.status === 404) {
      return { branches: [], error: 'Repository not found' };
    }
    return { branches: [], error: 'Failed to fetch branches' };
  }
}
