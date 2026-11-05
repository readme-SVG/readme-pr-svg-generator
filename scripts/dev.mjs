#!/usr/bin/env node
/**
 * Local development server.
 *
 * Vercel's CLI is the canonical way to run this project, but it requires an
 * account and a linked project. This server reproduces the parts of the routing
 * that matter — static files from `public/` and the `api/` handlers with a
 * `req.query` object — so the project can be exercised offline with `node`.
 * It is a development tool only; production always runs on Vercel.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/** Extension to MIME type. Anything unknown is served as binary. */
const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
});

/** Route table, mirroring the file layout Vercel would deploy. */
const API_ROUTES = Object.freeze({
  '/api': '../api/index.js',
  '/api/': '../api/index.js',
  '/api/badge': '../api/badge.js',
  '/api/options': '../api/options.js',
});

/**
 * Adds Vercel's `req.query` shape to a Node request.
 *
 * Repeated keys collapse into an array, matching what the platform provides, so
 * handlers can rely on the same behaviour locally and in production.
 *
 * @param {URL} url
 * @returns {Record<string, string | string[]>}
 */
function parseQuery(url) {
  /** @type {Record<string, string | string[]>} */
  const query = {};

  for (const [key, value] of url.searchParams) {
    const existing = query[key];
    if (existing === undefined) query[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else query[key] = [existing, value];
  }

  return query;
}

/**
 * Resolves a URL path to a file inside `public/`, rejecting traversal attempts.
 *
 * @param {string} pathname
 * @returns {string | null}
 */
function resolveStaticPath(pathname) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(PUBLIC_DIR, relative === '/' ? 'index.html' : relative);

  // `normalize` collapses `..` segments; this check catches anything that still
  // escapes the directory, including on platforms with unusual separators.
  if (!candidate.startsWith(PUBLIC_DIR + sep)) return null;
  return candidate;
}

/**
 * Serves a file from `public/`.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname
 * @returns {Promise<boolean>} Whether the request was handled.
 */
async function serveStatic(res, pathname) {
  const filePath = resolveStaticPath(pathname);
  if (!filePath) return false;

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(`${req.method} ${url.pathname}${url.search} → ${res.statusCode} (${durationMs.toFixed(1)} ms)`);
  });

  const route = API_ROUTES[url.pathname];

  if (route) {
    try {
      const { default: handler } = await import(new URL(route, import.meta.url));
      req.query = parseQuery(url);
      await handler(req, res);
    } catch (error) {
      console.error('Handler failed:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
    }
    return;
  }

  if (await serveStatic(res, url.pathname)) return;

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`readme-pr-svg-generator listening on http://localhost:${PORT}`);
});
