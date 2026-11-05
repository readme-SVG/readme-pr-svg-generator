/**
 * Badge request options.
 *
 * This module is the single contract between the query string, the SVG
 * renderer, and the playground: it declares the supported parameters, their
 * bounds, and their defaults. The playground fetches the same declaration from
 * `/api/options`, so the UI can never drift from what the API accepts.
 */

import { parseIntInRange, parseFlag, parseUsername, pickOneOf } from './query.js';
import { DEFAULT_THEME_ID, THEME_IDS, resolveTheme } from './themes.js';

/** Supported value range for the `limit` parameter. */
export const LIMIT = Object.freeze({ min: 1, max: 10, default: 5 });

/**
 * @typedef {object} BadgeOptions
 * @property {string | null} username Validated login, or `null` when the input is invalid.
 * @property {string} rawUsername Login exactly as supplied, used in error copy.
 * @property {number} limit Number of rows to render.
 * @property {string} themeId Resolved theme identifier.
 * @property {import('./themes.js').Theme} theme Resolved theme tokens.
 * @property {boolean} showDate Whether the creation date column is rendered.
 * @property {boolean} showComments Whether the comment count column is rendered.
 * @property {boolean} demo Render fixture data instead of calling GitHub.
 */

/**
 * @param {Record<string, unknown>} query
 * @returns {BadgeOptions}
 */
export function parseBadgeOptions(query) {
  const rawUsername = typeof query.username === 'string' ? query.username.trim() : '';
  const username = parseUsername(rawUsername);
  const themeId = pickOneOf(query.theme, THEME_IDS, DEFAULT_THEME_ID);

  return {
    username,
    rawUsername,
    limit: parseIntInRange(query.limit, { ...LIMIT, fallback: LIMIT.default }),
    themeId,
    theme: resolveTheme(themeId),
    showDate: parseFlag(query.showDate, true),
    showComments: parseFlag(query.showComments, true),
    demo: parseFlag(query.demo, false),
  };
}

/**
 * Fixture used by `?demo=true`.
 *
 * It makes the badge renderable without a GitHub round-trip, which keeps the
 * playground preview meaningful while typing and gives documentation a stable
 * screenshot target.
 *
 * @type {import('./github.js').PullRequest[]}
 */
export const DEMO_PULL_REQUESTS = Object.freeze([
  {
    title: 'Add streaming support to the badge renderer',
    repo: 'readme-SVG/readme-pr-svg-generator',
    url: 'https://github.com/readme-SVG/readme-pr-svg-generator/pull/42',
    createdAt: '2026-10-28T09:14:00Z',
    comments: 12,
    status: 'merged',
  },
  {
    title: 'Fix layout regression on narrow viewports',
    repo: 'vercel/next.js',
    url: 'https://github.com/vercel/next.js/pull/68410',
    createdAt: '2026-10-24T16:02:00Z',
    comments: 3,
    status: 'open',
  },
  {
    title: 'Replace the ad-hoc cache with a bounded TTL cache',
    repo: 'nodejs/undici',
    url: 'https://github.com/nodejs/undici/pull/3512',
    createdAt: '2026-10-19T11:47:00Z',
    comments: 7,
    status: 'open',
  },
  {
    title: 'Document the security model of SVG responses',
    repo: 'github/docs',
    url: 'https://github.com/github/docs/pull/31200',
    createdAt: '2026-10-11T08:05:00Z',
    comments: 0,
    status: 'closed',
  },
  {
    title: 'Draft: experiment with variable font metrics',
    repo: 'fontsource/fontsource',
    url: 'https://github.com/fontsource/fontsource/pull/910',
    createdAt: '2026-10-02T19:30:00Z',
    comments: 1,
    status: 'draft',
  },
]);
