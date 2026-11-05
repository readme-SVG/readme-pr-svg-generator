import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import handler from '../api/badge.js';
import { clearGitHubCache } from '../lib/github.js';

/**
 * Minimal response double capturing the values the handler writes.
 *
 * @returns {{ statusCode: number, headers: Record<string, string>, body: string, writeHead: Function, setHeader: Function, end: Function }}
 */
function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(chunk = '') {
      this.body += chunk;
    },
  };
}

/**
 * @param {Record<string, string>} query
 * @param {{ method?: string, host?: string }} [overrides]
 */
function createRequest(query, { method = 'GET', host = 'badge.example.com' } = {}) {
  return { method, query, headers: { host } };
}

/** A representative GitHub search payload. */
function searchPayload() {
  return {
    items: [
      {
        title: 'Add caching',
        html_url: 'https://github.com/acme/widgets/pull/1',
        repository_url: 'https://api.github.com/repos/acme/widgets',
        created_at: '2026-10-01T10:00:00Z',
        comments: 2,
        state: 'open',
        draft: false,
        user: { login: 'octocat' },
        pull_request: { merged_at: null },
      },
      {
        title: 'Impostor',
        html_url: 'https://github.com/acme/widgets/pull/2',
        repository_url: 'https://api.github.com/repos/acme/widgets',
        created_at: '2026-10-02T10:00:00Z',
        comments: 0,
        state: 'open',
        user: { login: 'someone-else' },
        pull_request: { merged_at: null },
      },
    ],
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  clearGitHubCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

describe('badge handler', () => {
  it('returns an SVG document for a valid login', async () => {
    globalThis.fetch = mock.fn(async () => new Response(JSON.stringify(searchPayload()), { status: 200 }));

    const res = createResponse();
    await handler(createRequest({ username: 'octocat' }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'image/svg+xml; charset=utf-8');
    assert.match(res.body, /^<svg/);
    assert.ok(res.body.includes('octocat'));
    // Rows authored by someone else are filtered out.
    assert.ok(!res.body.includes('Impostor'));
  });

  it('sets a sandboxing CSP that forbids scripting', async () => {
    globalThis.fetch = mock.fn(async () => new Response(JSON.stringify(searchPayload()), { status: 200 }));

    const res = createResponse();
    await handler(createRequest({ username: 'octocat' }), res);

    assert.match(res.headers['Content-Security-Policy'], /script-src 'none'/);
    assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  });

  it('never caches an error response', async () => {
    globalThis.fetch = mock.fn(async () => new Response('{}', { status: 403 }));

    const res = createResponse();
    await handler(createRequest({ username: 'octocat' }), res);

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Cache-Control'], /max-age=0/);
    assert.match(res.body, /rate limit/i);
  });

  it('rejects an invalid login without calling GitHub', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('should not be called');
    });

    const res = createResponse();
    await handler(createRequest({ username: '<script>' }), res);

    assert.equal(globalThis.fetch.mock.callCount(), 0);
    assert.match(res.body, /Invalid GitHub username/);
  });

  it('asks for the full window so every limit shares one cache entry', async () => {
    const fetchMock = mock.fn(async () => new Response(JSON.stringify(searchPayload()), { status: 200 }));
    globalThis.fetch = fetchMock;

    await handler(createRequest({ username: 'octocat', limit: '3' }), createResponse());

    assert.ok(String(fetchMock.mock.calls[0].arguments[0]).includes('per_page=10'));
  });

  it('coalesces concurrent requests for the same login', async () => {
    const fetchMock = mock.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(new Response(JSON.stringify(searchPayload()), { status: 200 })), 5);
        }),
    );
    globalThis.fetch = fetchMock;

    await Promise.all([
      handler(createRequest({ username: 'octocat' }), createResponse()),
      handler(createRequest({ username: 'octocat' }), createResponse()),
      handler(createRequest({ username: 'octocat' }), createResponse()),
    ]);

    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it('rejects unsupported methods', async () => {
    const res = createResponse();
    await handler(createRequest({}, { method: 'DELETE' }), res);

    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET, HEAD');
  });

  it('serves the demo fixture without touching the network', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('should not be called');
    });

    const res = createResponse();
    await handler(createRequest({ username: 'octocat', demo: 'true' }), res);

    assert.equal(globalThis.fetch.mock.callCount(), 0);
    assert.match(res.body, /Add streaming support/);
  });
});
