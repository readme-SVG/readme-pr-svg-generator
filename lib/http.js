/**
 * Transport-level concerns that every endpoint shares.
 *
 * Keeping these helpers in one place guarantees that no route can accidentally
 * introduce an open redirect, emit a cacheable error, or bypass the CSP that
 * protects SVG documents served from our own origin.
 */

/**
 * Headers applied to every response that leaves the API surface.
 *
 * SVG is a first-class document format: when a badge URL is opened directly in
 * a browser it may execute inline script and same-origin requests. The sandbox
 * CSP below keeps the renderer capable of drawing but unable to script, submit
 * forms, or navigate the embedding page.
 */
const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; " +
    "script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; " +
    "frame-ancestors *",
};

/**
 * Resolves a caller-supplied path against this deployment's own origin.
 *
 * Only relative paths or absolute URLs pointing back at `req` are accepted.
 * Anything else yields `null`, so upstream query parameters can never be turned
 * into an open redirect or used to reflect an attacker-controlled URL.
 *
 * @param {string | null | undefined} value Candidate path, e.g. `/demo`.
 * @param {object} req Incoming request, used to discover the origin.
 * @returns {string | null} Safe, same-origin absolute URL.
 */
export function resolveSameOriginUrl(value, req) {
  if (!value) return null;

  try {
    const resolved = new URL(value, `https://${req.headers.host ?? 'localhost'}`);
    const allowedHosts = new Set([req.headers.host, process.env.VERCEL_URL]);

    return allowedHosts.has(resolved.host) ? resolved.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Sends a text/plain body with the shared hardening headers.
 *
 * @param {object} res Response object.
 * @param {number} status HTTP status code.
 * @param {string} body Human readable message.
 * @param {Record<string, string>} [extraHeaders] Route specific overrides.
 */
export function sendText(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    ...BASE_HEADERS,
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

/**
 * Sends an SVG document.
 *
 * Errors are deliberately uncacheable: a transient GitHub outage must not be
 * pinned in a CDN or in the README of every visitor for the next half hour.
 *
 * @param {object} res Response object.
 * @param {string} svg Serialized SVG document.
 * @param {{ immutable: boolean, maxAge: number, staleWhileRevalidate: number }} cache Cache policy.
 */
export function sendSvg(res, svg, cache) {
  const cacheControl = cache.immutable
    ? `public, max-age=${cache.maxAge}, immutable`
    : `public, max-age=0, s-maxage=${cache.maxAge}, stale-while-revalidate=${cache.staleWhileRevalidate}`;

  res.writeHead(200, {
    ...BASE_HEADERS,
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': cacheControl,
    'Content-Length': Buffer.byteLength(svg),
  });
  res.end(svg);
}

/**
 * Sends a JSON document with the shared hardening headers.
 *
 * @param {object} res Response object.
 * @param {unknown} body Serializable payload.
 * @param {{ maxAge: number }} cache `s-maxage` in seconds; `0` disables caching.
 */
export function sendJson(res, body, cache) {
  const payload = JSON.stringify(body);
  const cacheControl =
    cache.maxAge > 0
      ? `public, max-age=0, s-maxage=${cache.maxAge}, stale-while-revalidate=${cache.maxAge * 2}`
      : 'no-store';

  res.writeHead(200, {
    ...BASE_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Redirects to a location that has already been validated.
 *
 * @param {object} res Response object.
 * @param {string} location Absolute, same-origin URL.
 */
export function redirect(res, location) {
  res.writeHead(302, {
    ...BASE_HEADERS,
    Location: location,
    'Cache-Control': 'no-store',
  });
  res.end();
}

/**
 * Answers CORS preflight and rejects unsupported methods.
 *
 * The badge endpoint is consumed by browsers (the playground preview and any
 * embedded `<img>`), so `GET` and `HEAD` are the only meaningful verbs.
 *
 * @param {object} req Request object.
 * @param {object} res Response object.
 * @param {string[]} [methods] Allowed methods.
 * @returns {boolean} `true` when the request was fully handled and the caller must stop.
 */
export function enforceMethod(req, res, methods = ['GET', 'HEAD']) {
  if (methods.includes(req.method)) return false;

  res.setHeader('Allow', methods.join(', '));
  sendText(res, 405, 'Method Not Allowed');
  return true;
}
