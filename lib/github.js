/**
 * GitHub Search API client.
 *
 * Two responsibilities only: talk to GitHub with a predictable failure model,
 * and normalize the payload into the shape the renderer expects. Nothing here
 * knows anything about SVG.
 *
 * The unauthenticated Search API allows 10 requests per minute per IP. A badge
 * embedded in a popular README can easily exceed that, so identical lookups are
 * coalesced in-process and cached briefly. Combined with the CDN cache this
 * keeps GitHub traffic proportional to unique usernames rather than page views.
 */

import { performance } from 'node:perf_hooks';

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'readme-pr-svg-generator/2.1 (+https://github.com/readme-SVG/readme-pr-svg-generator)';
const REQUEST_TIMEOUT_MS = 5_000;
const SUCCESS_TTL_MS = 5 * 60 * 1000;
const FAILURE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 200;

/**
 * Machine readable failure reasons. Each maps to a distinct user facing message
 * so a broken README tells its owner what is actually wrong.
 */
export const GitHubErrorReason = Object.freeze({
  USER_NOT_FOUND: 'user_not_found',
  RATE_LIMITED: 'rate_limited',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
});

export class GitHubApiError extends Error {
  /**
   * @param {keyof typeof GitHubErrorReason} reason
   * @param {string} message Developer facing detail.
   */
  constructor(reason, message) {
    super(message);
    this.name = 'GitHubApiError';
    this.reason = reason;
  }
}

/** @typedef {{ size: number }} CacheEntryMeta */

/**
 * Bounded TTL cache with insertion-ordered eviction.
 *
 * `Map` preserves insertion order, so deleting and re-setting on write keeps the
 * oldest entry at the head of the iteration order and eviction is O(1).
 *
 * @template T
 */
class TtlCache {
  /** @param {{ maxEntries: number }} options */
  constructor({ maxEntries }) {
    this.maxEntries = maxEntries;
    /** @type {Map<string, { value: T, expiresAt: number }>} */
    this.entries = new Map();
  }

  /** @param {string} key @returns {T | undefined} */
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh recency so frequently requested badges survive eviction.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** @param {string} key @param {T} value @param {number} ttlMs */
  set(key, value, ttlMs) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });

    if (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }
  }

  clear() {
    this.entries.clear();
  }
}

/** @typedef {{ title: string, repo: string, url: string, createdAt: string, comments: number, status: 'open'|'merged'|'closed'|'draft' }} PullRequest */

/** @type {TtlCache<PullRequest[]>} */
const pullRequestCache = new TtlCache({ maxEntries: MAX_CACHE_ENTRIES });

/**
 * Cache of lookups that are currently in flight.
 *
 * Storing the promise rather than the result means a burst of concurrent
 * requests for the same username results in exactly one call to GitHub.
 *
 * @type {Map<string, Promise<PullRequest[]>>}
 */
const inFlightRequests = new Map();

/**
 * Fetches the most recently created pull requests authored by a user.
 *
 * @param {string} username Validated GitHub login.
 * @param {number} limit Maximum number of entries to return.
 * @returns {Promise<PullRequest[]>} Newest first.
 * @throws {GitHubApiError}
 */
export async function fetchPullRequests(username, limit) {
  const cacheKey = `${username.toLowerCase()}:${limit}`;
  const cached = pullRequestCache.get(cacheKey);
  if (cached) return cached;

  const pending = inFlightRequests.get(cacheKey);
  if (pending) return pending;

  const request = requestPullRequests(username, limit)
    .then((pullRequests) => {
      pullRequestCache.set(cacheKey, pullRequests, SUCCESS_TTL_MS);
      return pullRequests;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
}

/**
 * Performs the HTTP call and translates the response into domain objects.
 *
 * @param {string} username
 * @param {number} limit
 * @returns {Promise<PullRequest[]>}
 */
async function requestPullRequests(username, limit) {
  const query = `is:pr author:${username}`;
  const url = new URL(`${GITHUB_API}/search/issues`);
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'created');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(limit));

  /** @type {Response} */
  let response;
  const startedAt = performance.now();

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new GitHubApiError(
      timedOut ? GitHubErrorReason.TIMEOUT : GitHubErrorReason.UNAVAILABLE,
      `GitHub request failed: ${error?.message ?? error}`,
    );
  } finally {
    // Latency is the first thing to look at when GitHub starts throttling us.
    console.info(
      JSON.stringify({
        event: 'github_request',
        query,
        status: response?.status ?? 0,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  }

  if (response.status === 403 || response.status === 429) {
    throw new GitHubApiError(GitHubErrorReason.RATE_LIMITED, 'GitHub rate limit reached');
  }

  if (response.status === 422) {
    throw new GitHubApiError(GitHubErrorReason.USER_NOT_FOUND, `Unsearchable login: ${username}`);
  }

  if (!response.ok) {
    throw new GitHubApiError(
      GitHubErrorReason.UNAVAILABLE,
      `GitHub responded with ${response.status}`,
    );
  }

  const payload = await safelyParseJson(response);
  const items = Array.isArray(payload?.items) ? payload.items : [];

  // The search index can return hits whose author merely matches the query
  // text, so authorship is verified again here.
  return items
    .filter((item) => item?.pull_request && item?.user?.login?.toLowerCase() === username.toLowerCase())
    .slice(0, limit)
    .map(toPullRequest);
}

/**
 * @param {Response} response
 * @returns {Promise<any>} Parsed JSON, or `null` when the body is not JSON.
 */
async function safelyParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Maps a raw search result to the renderer's domain model.
 *
 * @param {any} item
 * @returns {PullRequest}
 */
function toPullRequest(item) {
  const repositoryUrl = typeof item.repository_url === 'string' ? item.repository_url : '';
  const [, , , owner = '', name = ''] = repositoryUrl.split('/');

  return {
    title: typeof item.title === 'string' ? item.title : 'Untitled pull request',
    repo: owner && name ? `${owner}/${name}` : 'unknown/repository',
    url: typeof item.html_url === 'string' ? item.html_url : '',
    createdAt: item.created_at,
    comments: Number.isFinite(item.comments) ? item.comments : 0,
    status: resolveStatus(item),
  };
}

/**
 * Derives the display status of a pull request.
 *
 * The Search API does not expose merge state, so a merged PR is reported as
 * `closed` there. `merged_at` is honoured when present (for example when the
 * payload comes from a fixture or the REST endpoint) and `draft` is taken from
 * the optional `draft` field.
 *
 * @param {any} item
 * @returns {'open' | 'merged' | 'closed' | 'draft'}
 */
function resolveStatus(item) {
  if (item.state === 'open') return item.draft === true ? 'draft' : 'open';
  if (item.pull_request?.merged_at) return 'merged';
  return 'closed';
}

/** Exposed for tests: resets the in-process caches. */
export function clearGitHubCache() {
  pullRequestCache.clear();
  inFlightRequests.clear();
}
