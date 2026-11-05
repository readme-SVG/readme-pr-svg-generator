import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escapeXml, measureText, renderBadge, renderNotice, truncateToWidth } from '../lib/svg.js';
import { resolveTheme } from '../lib/themes.js';

const theme = resolveTheme('dark');

describe('escapeXml', () => {
  it('escapes every XML metacharacter', () => {
    assert.equal(escapeXml(`<&>"'`), '&lt;&amp;&gt;&quot;&apos;');
  });

  it('neutralizes script injection attempts', () => {
    const payload = '<script>alert(1)</script>';
    assert.equal(escapeXml(payload), '&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('coerces non-string input', () => {
    assert.equal(escapeXml(undefined), '');
    assert.equal(escapeXml(0), '0');
  });
});

describe('truncateToWidth', () => {
  it('leaves short strings untouched', () => {
    assert.equal(truncateToWidth('Fixing the parser', 500, 12), 'Fixing the parser');
  });

  it('collapses whitespace so the rendered layout stays predictable', () => {
    assert.equal(truncateToWidth('  fix   the\n parser ', 500, 12), 'fix the parser');
  });

  it('appends an ellipsis when content is removed', () => {
    const result = truncateToWidth('a'.repeat(400), 80, 12);
    assert.ok(result.endsWith('\u2026'));
    assert.ok(measureText(result, 12) <= 80);
  });
});

describe('renderBadge', () => {
  const pullRequests = [
    {
      title: 'Add streaming support',
      repo: 'readme-SVG/readme-pr-svg-generator',
      url: 'https://github.com/readme-SVG/readme-pr-svg-generator/pull/1',
      createdAt: '2026-10-28T09:14:00Z',
      comments: 4,
      status: 'merged',
    },
    {
      title: 'Fix <script> injection',
      repo: 'acme/widgets',
      url: 'https://github.com/acme/widgets/pull/2',
      createdAt: '2026-09-01T00:00:00Z',
      comments: 0,
      status: 'open',
    },
  ];

  const options = { showDate: true, showComments: true, theme, limit: 5 };

  it('produces a well-formed document with an accessible title', () => {
    const svg = renderBadge(pullRequests, 'octocat', options);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<title id="title">Pull requests · octocat<\/title>/);
    assert.match(svg, /role="img"/);
    assert.ok(svg.trimEnd().endsWith('</svg>'));
  });

  it('never emits unescaped user or repository content', () => {
    const svg = renderBadge(pullRequests, 'octocat', options);
    assert.ok(!svg.includes('<script>'));
    assert.ok(svg.includes('&lt;script&gt;'));
  });

  it('respects the configured limit', () => {
    const svg = renderBadge(pullRequests, 'octocat', { ...options, limit: 1 });
    assert.equal(svg.match(/<g class="pr-row">/g).length, 1);
    assert.ok(!svg.includes('acme/widgets'));
  });

  it('hides the optional columns when disabled', () => {
    const svg = renderBadge(pullRequests, 'octocat', {
      ...options,
      showDate: false,
      showComments: false,
    });
    assert.ok(!svg.includes('CREATED'));
    assert.ok(!svg.includes('COMMENTS'));
  });

  it('renders an empty state without any rows', () => {
    const svg = renderBadge([], 'octocat', options);
    assert.match(svg, /No pull requests yet/);
  });

  it('falls back to the closed icon for unknown states', () => {
    const svg = renderBadge([{ ...pullRequests[0], status: 'nonsense' }], 'octocat', options);
    assert.match(svg, /<title>Closed:/);
  });
});

describe('renderNotice', () => {
  it('escapes the message and the hint', () => {
    const svg = renderNotice('<bad>', theme, { hint: '<also bad>' });
    assert.ok(!svg.includes('<bad>'));
    assert.ok(svg.includes('&lt;bad&gt;'));
  });
});
