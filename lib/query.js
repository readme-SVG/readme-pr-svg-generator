/**
 * Strict query string parsing.
 *
 * Everything that reaches the renderer originates from a URL, which means it is
 * attacker controlled by definition. These helpers coerce values into a small,
 * closed set of allowed shapes and never throw, so a malformed query degrades
 * to documented defaults instead of a 500 response.
 */

/**
 * Whitelists one value from a fixed set of options.
 *
 * @template {string} T
 * @param {unknown} value Raw query value.
 * @param {readonly T[]} allowed Supported values.
 * @param {T} fallback Value used when the input is absent or unsupported.
 * @returns {T}
 */
export function pickOneOf(value, allowed, fallback) {
  return typeof value === 'string' && allowed.includes(/** @type {T} */ (value))
    ? /** @type {T} */ (value)
    : fallback;
}

/**
 * Parses a bounded integer.
 *
 * @param {unknown} value Raw query value.
 * @param {{ min: number, max: number, fallback: number }} bounds Inclusive range and default.
 * @returns {number}
 */
export function parseIntInRange(value, { min, max, fallback }) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Reads a boolean flag. Only the literal `"false"` disables a feature, matching
 * the convention used by shields.io and similar badge services.
 *
 * @param {unknown} value Raw query value.
 * @param {boolean} [fallback] Value used when the parameter is absent.
 * @returns {boolean}
 */
export function parseFlag(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}

/**
 * Trims and validates a GitHub login.
 *
 * GitHub logins are 1-39 characters of `[A-Za-z0-9-]` and may not start or end
 * with a hyphen. Enforcing the shape locally avoids burning API quota on input
 * that cannot possibly resolve.
 *
 * @param {unknown} value Raw query value.
 * @returns {string | null} Normalized login, or `null` when invalid.
 */
export function parseUsername(value) {
  const login = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login) ? login : null;
}
