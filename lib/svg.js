/**
 * SVG document builder.
 *
 * The renderer is a pure function of its inputs: it never performs I/O, never
 * mutates its arguments, and returns a self-contained string. Every value taken
 * from the network is escaped and every measured string is truncated against a
 * real font metric, so a hostile repository name cannot break out of the
 * document or push the layout out of its viewport.
 */

/** Font stack shared by every text node; keeps metrics predictable across platforms. */
const FONT_FAMILY = "'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
const MONO_FAMILY = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

/** Layout constants, expressed in user units (CSS pixels at 1x). */
const LAYOUT = Object.freeze({
  width: 832,
  gutter: 20,
  headerBlock: 52,
  tableHeaderHeight: 28,
  rowHeight: 28,
  tablePadding: 6,
  footerHeight: 26,
  radius: 10,
  titleFontSize: 15,
  metaFontSize: 11,
  cellFontSize: 12,
  radiusDot: 5,
});

/** Horizontal anchors measured from the card's left edge. */
const COLUMN_X = Object.freeze({
  status: 22,
  stateLabel: 34,
  repository: 96,
  title: 232,
  date: 560,
  comments: 690,
});

/**
 * Text budgets for the flexible columns, derived from the anchors so that
 * moving a column boundary automatically reflows the truncation limits.
 */
const TITLE_MAX_WIDTH = COLUMN_X.date - COLUMN_X.title - 16;
const REPOSITORY_MAX_WIDTH = COLUMN_X.title - COLUMN_X.repository - 12;

/**
 * Advance width per character class, in em.
 *
 * The values are deliberately pessimistic: they have to hold for the widest
 * font in the stack (a DejaVu-style fallback), not just for Segoe UI, because the
 * badge renders wherever the *viewer's* machine decides to resolve the stack.
 */
const ADVANCE = Object.freeze({
  narrow: 0.32,
  regular: 0.57,
  wide: 0.68,
  upper: 0.71,
  cyrillic: 0.61,
  symbol: 0.68,
});

/** Bold text is marginally wider; a single factor is accurate enough here. */
const BOLD_FACTOR = 1.02;

/** Characters that are visibly narrower than the body average. */
const NARROW_CHARS = 'iljtfrI.,:;!|\'`';
/** Characters that are visibly wider than the body average. */
const WIDE_CHARS = 'mwMW@%&';
const ELLIPSIS = '\u2026';

/** Human readable state label, also used as the accessible name of each row. */
const STATUS_LABELS = Object.freeze({
  open: 'Open',
  merged: 'Merged',
  closed: 'Closed',
  draft: 'Draft',
});

/**
 * Escapes a value for use in XML text and attribute content.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Returns the advance width of a single character in em.
 *
 * @param {string} char A single code point.
 * @returns {number}
 */
function charWidth(char) {
  if (NARROW_CHARS.includes(char)) return ADVANCE.narrow;
  if (WIDE_CHARS.includes(char)) return ADVANCE.wide;
  if (char >= 'A' && char <= 'Z') return ADVANCE.upper;
  if (char >= '\u0400' && char <= '\u04FF') return ADVANCE.cyrillic;
  return char.codePointAt(0) > 0x2000 ? ADVANCE.symbol : ADVANCE.regular;
}

/**
 * Approximates the rendered width of a string in CSS pixels.
 *
 * The server has no text metrics API and shipping a font file just to measure
 * would dwarf the payload, so widths are estimated from a per-character advance
 * table. The estimate is intentionally conservative in the direction that
 * matters: text may end up slightly narrower than the budget, never wider.
 *
 * @param {string} text
 * @param {number} fontSize
 * @param {{ bold?: boolean }} [options]
 * @returns {number}
 */
export function measureText(text, fontSize, { bold = false } = {}) {
  let em = 0;
  for (const char of text) em += charWidth(char);
  return em * fontSize * (bold ? BOLD_FACTOR : 1);
}

/**
 * Truncates a string so that it fits into `maxWidth` pixels, appending an
 * ellipsis when content had to be removed.
 *
 * The running width is accumulated rather than re-measured per candidate, which
 * keeps this linear even for pathological input lengths.
 *
 * @param {string} text
 * @param {number} maxWidth
 * @param {number} fontSize
 * @param {{ bold?: boolean }} [options]
 * @returns {string}
 */
export function truncateToWidth(text, maxWidth, fontSize, options = {}) {
  const normalized = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (measureText(normalized, fontSize, options) <= maxWidth) return normalized;

  const scale = fontSize * (options.bold ? BOLD_FACTOR : 1);
  const budget = maxWidth - charWidth(ELLIPSIS) * scale;
  let used = 0;
  let result = '';

  for (const char of normalized) {
    used += charWidth(char) * scale;
    if (used > budget) break;
    result += char;
  }

  return `${result.trimEnd()}${ELLIPSIS}`;
}

/**
 * Formats an ISO timestamp as a compact, timezone independent date.
 *
 * @param {string | undefined} isoDate
 * @returns {string} `YYYY-MM-DD`, or an empty string when the input is unusable.
 */
function formatDate(isoDate) {
  const parsed = new Date(isoDate ?? '');
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

/**
 * Builds the document title, e.g. `Pull requests · OstinUA`.
 *
 * @param {string} username
 * @returns {string}
 */
export function formatHeading(username) {
  return `Pull requests \u00b7 ${username}`;
}

/**
 * Renders a row of the pull request table.
 *
 * @param {import('./github.js').PullRequest} pullRequest
 * @param {number} index Zero-based row index.
 * @param {{ showDate: boolean, showComments: boolean, theme: import('./themes.js').Theme }} options
 * @returns {string}
 */
function renderRow(pullRequest, index, { showDate, showComments, theme }) {
  const status = STATUS_LABELS[pullRequest.status] ? pullRequest.status : 'closed';
  const color = theme.status[status];
  const y = LAYOUT.tableHeaderHeight + LAYOUT.rowHeight * index + 19;
  const striped = index % 2 === 1;

  const title = truncateToWidth(pullRequest.title, TITLE_MAX_WIDTH, LAYOUT.cellFontSize, { bold: true });
  const repository = truncateToWidth(pullRequest.repo, REPOSITORY_MAX_WIDTH, LAYOUT.cellFontSize);
  const accessibleLabel = escapeXml(`${STATUS_LABELS[status]}: ${repository} — ${title}`);

  return [
    '<g class="pr-row">',
    `<title>${accessibleLabel}</title>`,
    `<rect class="pr-row__bg" x="1" y="${y - 19}" width="${LAYOUT.width - 2}" height="${LAYOUT.rowHeight}" fill="${
      striped ? theme.surfaceAlt : theme.header
    }" opacity="${striped ? 1 : 0}"/>`,
    `<circle cx="${COLUMN_X.status}" cy="${y - 4}" r="4" fill="${color}"/>`,
    `<text x="${COLUMN_X.stateLabel}" y="${y}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" fill="${color}">${STATUS_LABELS[status]}</text>`,
    `<text x="${COLUMN_X.repository}" y="${y}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.cellFontSize}" fill="${theme.textSecondary}">${escapeXml(repository)}</text>`,
    `<text x="${COLUMN_X.title}" y="${y}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.cellFontSize}" font-weight="600" fill="${theme.textPrimary}">${escapeXml(title)}</text>`,
    showDate ? renderDateCell(pullRequest, y, theme) : '',
    showComments ? renderCommentsCell(pullRequest, y, theme, showDate) : '',
    '</g>',
  ].join('');
}

/**
 * @param {import('./github.js').PullRequest} pullRequest
 * @param {number} y Row baseline.
 * @param {import('./themes.js').Theme} theme
 * @returns {string}
 */
function renderDateCell(pullRequest, y, theme) {
  const date = formatDate(pullRequest.createdAt);
  if (!date) return '';

  return `<text x="${COLUMN_X.date}" y="${y}" font-family="${MONO_FAMILY}" font-size="${LAYOUT.metaFontSize}" fill="${theme.textMuted}">${date}</text>`;
}

/**
 * @param {import('./github.js').PullRequest} pullRequest
 * @param {number} y Row baseline.
 * @param {import('./themes.js').Theme} theme
 * @param {boolean} showDate
 * @returns {string}
 */
function renderCommentsCell(pullRequest, y, theme, showDate) {
  const x = showDate ? COLUMN_X.comments : COLUMN_X.date;
  const count = Math.max(0, Number(pullRequest.comments) || 0);

  return (
    `<svg x="${x - 26}" y="${y - 10}" width="12" height="12" viewBox="0 0 16 16" fill="${theme.textMuted}" aria-hidden="true">` +
    `<path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 13H8.061l-2.574 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25v-8.5C0 1.784.784 1 1.75 1ZM1.5 2.75v8.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z"/></svg>` +
    `<text x="${x}" y="${y}" font-family="${MONO_FAMILY}" font-size="${LAYOUT.metaFontSize}" fill="${theme.textMuted}">${count}</text>`
  );
}

/**
 * Renders the empty state shown when a user has no pull requests.
 *
 * @param {number} top Offset of the table body from the top of the card.
 * @param {import('./themes.js').Theme} theme
 * @returns {string}
 */
function renderEmptyState(top, theme) {
  return (
    `<text x="${LAYOUT.width / 2}" y="${top + 34}" font-family="${FONT_FAMILY}" font-size="13" font-weight="600" fill="${theme.textSecondary}" text-anchor="middle">No pull requests yet</text>` +
    `<text x="${LAYOUT.width / 2}" y="${top + 54}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" fill="${theme.textMuted}" text-anchor="middle">Opened pull requests will show up here automatically</text>`
  );
}

/**
 * Renders the complete badge.
 *
 * @param {import('./github.js').PullRequest[]} pullRequests
 * @param {string} username Validated login, unescaped.
 * @param {{ showDate: boolean, showComments: boolean, theme: import('./themes.js').Theme, limit: number }} options
 * @returns {string}
 */
export function renderBadge(pullRequests, username, options) {
  const { showDate, showComments, theme } = options;
  const rows = pullRequests.slice(0, options.limit);
  const bodyHeight =
    rows.length === 0
      ? 64
      : LAYOUT.tableHeaderHeight + rows.length * LAYOUT.rowHeight + LAYOUT.tablePadding;

  const height = LAYOUT.headerBlock + bodyHeight + LAYOUT.footerHeight;
  const heading = escapeXml(truncateToWidth(formatHeading(username), 420, LAYOUT.titleFontSize, { bold: true }));
  const subtitle = escapeXml(
    rows.length === 0
      ? 'No activity found for this account'
      : truncateToWidth(
          `${rows.length} most recent ${rows.length === 1 ? 'pull request' : 'pull requests'}`,
          480,
          LAYOUT.metaFontSize,
        ),
  );

  const tableHeader =
    `<rect x="1" y="${LAYOUT.headerBlock - 1}" width="${LAYOUT.width - 2}" height="${LAYOUT.tableHeaderHeight}" fill="${theme.header}"/>` +
    `<text x="${COLUMN_X.status - 4}" y="${LAYOUT.headerBlock + 19}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" font-weight="700" fill="${theme.textSecondary}" letter-spacing="0.6">STATE</text>` +
    `<text x="${COLUMN_X.repository}" y="${LAYOUT.headerBlock + 19}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" font-weight="700" fill="${theme.textSecondary}" letter-spacing="0.6">REPOSITORY</text>` +
    `<text x="${COLUMN_X.title}" y="${LAYOUT.headerBlock + 19}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" font-weight="700" fill="${theme.textSecondary}" letter-spacing="0.6">TITLE</text>` +
    (showDate
      ? `<text x="${COLUMN_X.date}" y="${LAYOUT.headerBlock + 19}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" font-weight="700" fill="${theme.textSecondary}" letter-spacing="0.6">CREATED</text>`
      : '') +
    (showComments
      ? `<text x="${showDate ? COLUMN_X.comments : COLUMN_X.date}" y="${LAYOUT.headerBlock + 19}" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" font-weight="700" fill="${theme.textSecondary}" letter-spacing="0.6">COMMENTS</text>`
      : '');

  const body =
    rows.length === 0
      ? renderEmptyState(LAYOUT.headerBlock, theme)
      : `<g transform="translate(0, ${LAYOUT.headerBlock})">${rows
          .map((pullRequest, index) => renderRow(pullRequest, index, { showDate, showComments, theme }))
          .join('\n    ')}</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LAYOUT.width}" height="${height}" viewBox="0 0 ${LAYOUT.width} ${height}" role="img" aria-labelledby="title desc" color-scheme="${theme.scheme}">
  <title id="title">${heading}</title>
  <desc id="desc">${subtitle}</desc>
  <defs>
    <clipPath id="card"><rect x="1" y="1" width="${LAYOUT.width - 2}" height="${height - 2}" rx="${LAYOUT.radius}"/></clipPath>
    <style>
      /* The badge is often displayed at 100% in a README; a subtle row highlight
         makes long lists easier to scan. Transitions respect the viewer's
         reduced-motion preference and are ignored outside a browser. */
      .pr-row__bg { opacity: 0; transition: opacity 120ms ease-out; }
      .pr-row:hover .pr-row__bg { opacity: 1; }
      @media (prefers-reduced-motion: reduce) { .pr-row__bg { transition: none; } }
    </style>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${LAYOUT.width}" height="${height}" fill="${theme.surface}"/>
    <text x="${LAYOUT.gutter}" y="32" font-family="${FONT_FAMILY}" font-size="${LAYOUT.titleFontSize}" font-weight="600" fill="${theme.textPrimary}">${heading}</text>
    <text x="${LAYOUT.gutter}" y="47" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" fill="${theme.textMuted}">${subtitle}</text>
    ${tableHeader}
    ${body}
    <rect x="0" y="${height - LAYOUT.footerHeight}" width="${LAYOUT.width}" height="${LAYOUT.footerHeight}" fill="${theme.header}"/>
    <text x="${LAYOUT.gutter}" y="${height - 9}" font-family="${MONO_FAMILY}" font-size="10" fill="${theme.textMuted}">github.com/${escapeXml(truncateToWidth(username, 260, 10))}</text>
    <text x="${LAYOUT.width - LAYOUT.gutter}" y="${height - 9}" text-anchor="end" font-family="${MONO_FAMILY}" font-size="10" fill="${theme.textMuted}">updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</text>
  </g>
  <rect x="0.5" y="0.5" width="${LAYOUT.width - 1}" height="${height - 1}" rx="${LAYOUT.radius}" fill="none" stroke="${theme.border}"/>
</svg>`;
}

/**
 * Renders the placeholder document used for every failure mode.
 *
 * The result is still a valid badge so a broken README degrades gracefully, but
 * it is never cached by intermediaries.
 *
 * @param {string} message Already localized, user facing explanation.
 * @param {import('./themes.js').Theme} theme
 * @param {{ hint?: string }} [options]
 * @returns {string}
 */
export function renderNotice(message, theme, options = {}) {
  const title = escapeXml(truncateToWidth(message, 470, 13, { bold: true }));
  const hint = options.hint ? escapeXml(truncateToWidth(options.hint, 520, 11)) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LAYOUT.width}" height="76" viewBox="0 0 ${LAYOUT.width} 76" role="img" aria-labelledby="title">
  <title id="title">${title}</title>
  <rect x="0.5" y="0.5" width="${LAYOUT.width - 1}" height="75" rx="${LAYOUT.radius}" fill="${theme.surface}" stroke="${theme.border}"/>
  <circle cx="30" cy="38" r="9" fill="${theme.status.closed}" opacity="0.16"/>
  <circle cx="30" cy="38" r="3.5" fill="${theme.status.closed}"/>
  <text x="52" y="35" font-family="${FONT_FAMILY}" font-size="13" font-weight="600" fill="${theme.textPrimary}">${title}</text>
  ${hint ? `<text x="52" y="54" font-family="${FONT_FAMILY}" font-size="${LAYOUT.metaFontSize}" fill="${theme.textMuted}">${hint}</text>` : ''}
  <text x="${LAYOUT.width - LAYOUT.gutter}" y="35" text-anchor="end" font-family="${MONO_FAMILY}" font-size="10" fill="${theme.textMuted}">readme-pr-svg-generator</text>
</svg>`;
}
