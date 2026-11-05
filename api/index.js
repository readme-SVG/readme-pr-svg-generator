/**
 * Legacy entry point: `GET /api?username=...`.
 *
 * The badge moved to `/api/badge` in 2.0. READMEs in the wild still point at the
 * old path, so requests carrying a `username` parameter are redirected there
 * permanently. The redirect target is rebuilt from validated inputs only, which
 * keeps the route from becoming an open redirect.
 */

import { enforceMethod, redirect, resolveSameOriginUrl, sendText } from '../lib/http.js';
import { parseBadgeOptions } from '../lib/options.js';

/**
 * @param {import('http').IncomingMessage & { query: Record<string, unknown> }} req
 * @param {import('http').ServerResponse} res
 */
export default function handler(req, res) {
  // Vercel serves `index.html` for the bare domain; only the API path is ours.
  if (enforceMethod(req, res)) return;

  const query = req.query ?? {};
  if (!query.username && !query.demo) {
    sendText(res, 400, 'Missing required parameter: username');
    return;
  }

  const target = resolveSameOriginUrl(`/api/badge?${buildQuery(query)}`, req);
  if (!target) {
    sendText(res, 400, 'Unable to resolve redirect target');
    return;
  }

  redirect(res, target);
}

/**
 * Re-serializes only the parameters the badge endpoint understands, in a stable
 * order, after validating them.
 *
 * @param {Record<string, unknown>} query
 * @returns {string}
 */
function buildQuery(query) {
  const options = parseBadgeOptions(query);
  const params = new URLSearchParams();

  if (options.username) params.set('username', options.username);
  else params.set('username', String(query.username ?? ''));

  params.set('limit', String(options.limit));
  params.set('theme', options.themeId);
  if (!options.showDate) params.set('showDate', 'false');
  if (!options.showComments) params.set('showComments', 'false');
  if (options.demo) params.set('demo', 'true');

  return params.toString();
}
