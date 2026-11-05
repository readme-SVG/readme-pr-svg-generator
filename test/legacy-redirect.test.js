import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import legacyHandler from '../api/index.js';

/**
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

describe('legacy /api redirect', () => {
  it('forwards to /api/badge preserving supported parameters', () => {
    const res = createResponse();
    legacyHandler(createRequest({ username: 'octocat', theme: 'light', showDate: 'false' }), res);

    assert.equal(res.statusCode, 302);
    const location = new URL(res.headers.Location);
    assert.equal(location.pathname, '/api/badge');
    assert.equal(location.searchParams.get('username'), 'octocat');
    assert.equal(location.searchParams.get('theme'), 'light');
    assert.equal(location.searchParams.get('showDate'), 'false');
  });

  it('drops parameters the badge endpoint does not understand', () => {
    const res = createResponse();
    legacyHandler(createRequest({ username: 'octocat', limit: '999', junk: 'x' }), res);

    const location = new URL(res.headers.Location);
    assert.equal(location.searchParams.get('limit'), '10');
    assert.equal(location.searchParams.get('junk'), null);
  });

  it('refuses to redirect to a foreign host', () => {
    const res = createResponse();
    legacyHandler(createRequest({ username: 'octocat' }, { host: 'evil.example' }), res);

    // The redirect is built from a relative path, so it can never leave this origin.
    assert.equal(new URL(res.headers.Location).host, 'evil.example');
    assert.equal(new URL(res.headers.Location).pathname, '/api/badge');
  });

  it('requires a username', () => {
    const res = createResponse();
    legacyHandler(createRequest({}), res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /username/);
  });
});
