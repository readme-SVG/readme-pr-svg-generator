import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildBadgeUrl, buildMarkdown } from '../public/js/badge-url.js';

const origin = 'https://example.vercel.app';
const settings = { username: 'octocat', limit: 5, theme: 'dark', showDate: true, showComments: true };

describe('buildBadgeUrl', () => {
  it('omits parameters that already match the API defaults', () => {
    assert.equal(buildBadgeUrl(settings, origin), `${origin}/api/badge?username=octocat&limit=5&theme=dark`);
  });

  it('encodes the explicitly disabled columns', () => {
    const url = buildBadgeUrl({ ...settings, showDate: false, showComments: false }, origin);
    assert.ok(url.includes('showDate=false'));
    assert.ok(url.includes('showComments=false'));
  });

  it('percent-encodes user input', () => {
    const url = buildBadgeUrl({ ...settings, username: 'a b' }, origin);
    assert.ok(url.includes('username=a+b'));
  });
});

describe('buildMarkdown', () => {
  it('wraps the badge in a link to the pull request list', () => {
    const markdown = buildMarkdown(settings, origin);
    assert.equal(
      markdown,
      `[![Pull requests](${origin}/api/badge?username=octocat&limit=5&theme=dark)](https://github.com/pulls?q=is%3Apr%20author%3Aoctocat)`,
    );
  });
});
