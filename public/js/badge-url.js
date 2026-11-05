/**
 * URL construction for the badge endpoint.
 *
 * Kept separate from the DOM code so the exact URL format — which is the public
 * contract of the project, since users copy it into their READMEs — can be unit
 * tested in isolation.
 */

/**
 * @typedef {object} BadgeSettings
 * @property {string} username Validated GitHub login.
 * @property {number} limit Number of rows to render.
 * @property {string} theme Theme identifier.
 * @property {boolean} showDate Include the creation date column.
 * @property {boolean} showComments Include the comment count column.
 */

/**
 * Returns the badge URL for the given settings.
 *
 * Default values are omitted so the snippet stays short and, more importantly,
 * so a CDN key is identical for semantically identical requests.
 *
 * @param {BadgeSettings} settings
 * @param {string} origin Origin of the current deployment.
 * @returns {string}
 */
export function buildBadgeUrl(settings, origin) {
  const params = new URLSearchParams({ username: settings.username });
  params.set('limit', String(settings.limit));
  params.set('theme', settings.theme);
  if (!settings.showDate) params.set('showDate', 'false');
  if (!settings.showComments) params.set('showComments', 'false');
  return `${origin}/api/badge?${params.toString()}`;
}

/**
 * Returns the Markdown snippet that embeds the badge and links to the PR list.
 *
 * @param {BadgeSettings} settings
 * @param {string} origin Origin of the current deployment.
 * @returns {string}
 */
export function buildMarkdown(settings, origin) {
  const badgeUrl = buildBadgeUrl(settings, origin);
  const query = encodeURIComponent(`is:pr author:${settings.username}`);
  return `[![Pull requests](${badgeUrl})](https://github.com/pulls?q=${query})`;
}
