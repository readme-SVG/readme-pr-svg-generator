import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseIntInRange, parseFlag, parseUsername, pickOneOf } from '../lib/query.js';
import { parseBadgeOptions } from '../lib/options.js';

describe('pickOneOf', () => {
  it('accepts whitelisted values', () => {
    assert.equal(pickOneOf('light', ['dark', 'light'], 'dark'), 'light');
  });

  it('rejects anything else', () => {
    assert.equal(pickOneOf('neon', ['dark', 'light'], 'dark'), 'dark');
    assert.equal(pickOneOf(['light'], ['dark', 'light'], 'dark'), 'dark');
    assert.equal(pickOneOf(null, ['dark'], 'dark'), 'dark');
  });
});

describe('parseIntInRange', () => {
  const bounds = { min: 1, max: 10, fallback: 5 };

  it('clamps out-of-range values', () => {
    assert.equal(parseIntInRange('0', bounds), 1);
    assert.equal(parseIntInRange('999', bounds), 10);
  });

  it('falls back on garbage input', () => {
    assert.equal(parseIntInRange('abc', bounds), 5);
    assert.equal(parseIntInRange(undefined, bounds), 5);
    assert.equal(parseIntInRange('5.9', bounds), 5);
  });
});

describe('parseFlag', () => {
  it('treats the documented falsey spellings as disabled', () => {
    for (const value of ['false', '0', 'no', 'off']) {
      assert.equal(parseFlag(value, true), false);
    }
  });

  it('defaults to the fallback for unknown values', () => {
    assert.equal(parseFlag('maybe', true), true);
    assert.equal(parseFlag(undefined, false), false);
  });
});

describe('parseUsername', () => {
  it('accepts valid logins', () => {
    assert.equal(parseUsername('octocat'), 'octocat');
    assert.equal(parseUsername(' readme-SVG '), 'readme-SVG');
    assert.equal(parseUsername('a'.repeat(39)), 'a'.repeat(39));
  });

  it('rejects everything else', () => {
    for (const value of ['', '-leading', 'trailing-', 'has space', 'a'.repeat(40), 'a/b', null]) {
      assert.equal(parseUsername(value), null, `expected ${value} to be rejected`);
    }
  });
});

describe('parseBadgeOptions', () => {
  it('returns documented defaults', () => {
    const options = parseBadgeOptions({ username: 'octocat' });
    assert.equal(options.limit, 5);
    assert.equal(options.themeId, 'dark');
    assert.equal(options.showDate, true);
    assert.equal(options.showComments, true);
    assert.equal(options.demo, false);
  });

  it('falls back to the default theme for unknown ids', () => {
    const options = parseBadgeOptions({ username: 'octocat', theme: 'neon' });
    assert.equal(options.themeId, 'dark');
    assert.equal(options.theme.id, 'dark');
  });

  it('flags an invalid login while preserving the raw input', () => {
    const options = parseBadgeOptions({ username: '<script>' });
    assert.equal(options.username, null);
    assert.equal(options.rawUsername, '<script>');
  });
});
