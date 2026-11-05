/**
 * Badge endpoint: `GET /api/badge`.
 *
 * Contract: always answer with a valid SVG document and a 200 status, because
 * the consumer is an `<img>` tag in someone else's README. A 4xx/5xx would
 * render as a broken image with no explanation, which is a far worse failure
 * mode than an inline error card. Validation problems and upstream failures are
 * therefore reported *inside* the image.
 */

import { GitHubApiError, GitHubErrorReason, fetchPullRequests } from '../lib/github.js';
import { enforceMethod, sendSvg } from '../lib/http.js';
import { DEMO_PULL_REQUESTS, LIMIT, parseBadgeOptions } from '../lib/options.js';
import { renderBadge, renderNotice } from '../lib/svg.js';

/** Successful render: cached at the edge, revalidated in the background. */
const SUCCESS_CACHE = Object.freeze({ immutable: false, maxAge: 1800, staleWhileRevalidate: 86_400 });

/** Failure render: never cached, so a transient outage heals immediately. */
const FAILURE_CACHE = Object.freeze({ immutable: false, maxAge: 0, staleWhileRevalidate: 0 });

/** Fixture render: static content, safe to cache aggressively. */
const DEMO_CACHE = Object.freeze({ immutable: false, maxAge: 300, staleWhileRevalidate: 3600 });

/** User facing copy for each upstream failure. */
const ERROR_COPY = Object.freeze({
  [GitHubErrorReason.RATE_LIMITED]: {
    message: 'GitHub rate limit reached',
    hint: 'The unauthenticated search API allows 10 requests per minute. Try again shortly.',
  },
  [GitHubErrorReason.TIMEOUT]: {
    message: 'GitHub did not respond in time',
    hint: 'The badge will recover automatically on the next request.',
  },
  [GitHubErrorReason.UNAVAILABLE]: {
    message: 'GitHub is currently unavailable',
    hint: 'The badge will recover automatically once the API responds again.',
  },
  [GitHubErrorReason.USER_NOT_FOUND]: {
    message: 'That GitHub username cannot be searched',
    hint: 'Check the spelling of the username in the badge URL.',
  },
});

/**
 * @param {import('http').IncomingMessage & { query: Record<string, unknown> }} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (enforceMethod(req, res)) return;

  const options = parseBadgeOptions(req.query ?? {});

  if (!options.username) {
    return sendSvg(
      res,
      renderNotice(
        options.rawUsername ? 'Invalid GitHub username' : 'Missing GitHub username',
        options.theme,
        { hint: 'Pass ?username=<login> — logins are 1-39 letters, digits or hyphens.' },
      ),
      FAILURE_CACHE,
    );
  }

  if (options.demo) {
    return sendSvg(res, renderBadge([...DEMO_PULL_REQUESTS], options.username, options), DEMO_CACHE);
  }

  try {
    // Always request the maximum window: the renderer slices it down to
    // `options.limit`, so every limit shares one upstream call and one cache
    // entry instead of fragmenting the rate limit budget.
    const pullRequests = await fetchPullRequests(options.username, LIMIT.max);
    return sendSvg(res, renderBadge(pullRequests, options.username, options), SUCCESS_CACHE);
  } catch (error) {
    if (!(error instanceof GitHubApiError)) {
      console.error('Unhandled badge error:', error);
      return sendSvg(
        res,
        renderNotice('Unexpected error while building the badge', options.theme),
        FAILURE_CACHE,
      );
    }

    const copy = ERROR_COPY[error.reason] ?? ERROR_COPY[GitHubErrorReason.UNAVAILABLE];
    return sendSvg(res, renderNotice(copy.message, options.theme, { hint: copy.hint }), FAILURE_CACHE);
  }
}
