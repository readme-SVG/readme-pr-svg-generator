// --- Helper Functions ---

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(str, length) {
  return str.length > length ? str.substring(0, length - 3) + '...' : str;
}

function getStatusIcon(pr) {
  if (pr.state === 'open') {
    return {
      color: '#3fb950',
      path: 'M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.25 2.25 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1.5 1.5 0 011.5 1.5v5.628a2.25 2.25 0 101.5 0V5.5A3 3 0 0011 2.5zm1.25 9.25a.75.75 0 100 1.5.75.75 0 000-1.5zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z',
    };
  } else if (pr.pull_request && pr.pull_request.merged_at) {
    return {
      color: '#a371f7',
      path: 'M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v3.256a2.25 2.25 0 101.5 0V5.372zm6.75-2.872h-1V4h1a1.5 1.5 0 011.5 1.5v5.628a2.25 2.25 0 101.5 0V5.5A3 3 0 0011.75 2.5zm1.25 9.25a.75.75 0 100 1.5.75.75 0 000-1.5z',
    };
  }
  return {
    color: '#f85149',
    path: 'M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.25 2.25 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zM3 12a.75.75 0 101.5 0A.75.75 0 003 12zm8.25-10.5h-1V4h1a1.5 1.5 0 011.5 1.5v5.628a2.25 2.25 0 101.5 0V5.5a3 3 0 00-3-3zm1.25 9.25a.75.75 0 100 1.5.75.75 0 000-1.5z',
  };
}

// --- Theme Definitions ---

const themes = {
  dark: {
    bg: '#0d1117',
    headerBg: '#161b22',
    border: '#30363d',
    title: '#58a6ff',
    text: '#c9d1d9',
    subtext: '#8b949e',
    rowHover: '#161b22',
    headerText: '#c9d1d9',
  },
  light: {
    bg: '#ffffff',
    headerBg: '#f6f8fa',
    border: '#d0d7de',
    title: '#0969da',
    text: '#1f2328',
    subtext: '#656d76',
    rowHover: '#f6f8fa',
    headerText: '#1f2328',
  },
};

// --- SVG Generators ---

function generateErrorSvg(message, theme = 'dark') {
  const t = themes[theme] || themes.dark;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="80" viewBox="0 0 800 80">
  <rect width="798" height="78" x="1" y="1" rx="6" fill="${t.bg}" stroke="${t.border}" stroke-width="1"/>
  <text x="400" y="45" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" fill="${t.subtext}" text-anchor="middle">${escapeXml(message)}</text>
</svg>`;
}

function generateRow(pr, index, { showDate, showComments, theme: t }) {
  const yOffset = 70 + index * 35;
  const icon = getStatusIcon(pr);
  const repoName = pr.repository_url.split('/').slice(-2).join('/');
  const date = new Date(pr.created_at).toISOString().split('T')[0];
  const title = escapeXml(truncate(pr.title, 55));
  const repoText = escapeXml(truncate(repoName, 22));

  let dateCol = '';
  if (showDate) {
    dateCol = `<text x="700" y="0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" fill="${t.subtext}">${date}</text>`;
  }
  let commentsCol = '';
  if (showComments) {
    const cx = showDate ? 780 : 740;
    commentsCol = `<text x="${cx}" y="0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" fill="${t.subtext}" text-anchor="end">${pr.comments}</text>`;
  }

  return `<g transform="translate(0, ${yOffset})">
    <svg x="20" y="-12" width="16" height="16" viewBox="0 0 16 16" fill="${icon.color}">
      <path fill-rule="evenodd" d="${icon.path}"></path>
    </svg>
    <text x="45" y="0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="${t.subtext}">${repoText}</text>
    <text x="240" y="0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="${t.text}">${title}</text>
    ${dateCol}
    ${commentsCol}
  </g>`;
}

function generateSvg(prs, username, opts) {
  const t = opts.theme;
  const rowsHtml = prs
    .map((pr, i) => generateRow(pr, i, opts))
    .join('\n');

  const svgHeight = 80 + prs.length * 35;
  const safeUsername = escapeXml(username);

  // Header columns
  let headerCols = `
    <text x="45" y="0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${t.headerText}">Repository</text>
    <text x="240" y="0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${t.headerText}">Title</text>`;
  if (opts.showDate) {
    headerCols += `\n    <text x="700" y="0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${t.headerText}">Date</text>`;
  }
  if (opts.showComments) {
    const cx = opts.showDate ? 780 : 740;
    headerCols += `\n    <text x="${cx}" y="0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${t.headerText}" text-anchor="end">Comments</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${svgHeight}" viewBox="0 0 800 ${svgHeight}">
  <rect width="798" height="${svgHeight - 2}" x="1" y="1" rx="6" fill="${t.bg}" stroke="${t.border}" stroke-width="1"/>
  <text x="20" y="30" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="${t.title}">
    Recent Pull Requests by ${safeUsername}
  </text>
  <line x1="1" y1="45" x2="799" y2="45" stroke="${t.border}" stroke-width="1"/>
  <g transform="translate(0, 60)">
    ${headerCols}
  </g>
  ${rowsHtml}
  ${prs.length === 0 ? `<text x="400" y="${svgHeight / 2 + 10}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" fill="${t.subtext}" text-anchor="middle">No pull requests found for ${safeUsername}</text>` : ''}
</svg>`;
}

// --- Main Handler ---

export default async function handler(req, res) {
  const {
    username = 'OstinUA',
    limit = '5',
    theme: themeName = 'dark',
    showDate: showDateParam = 'true',
    showComments: showCommentsParam = 'true',
  } = req.query;

  const prLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);
  const showDate = showDateParam !== 'false';
  const showComments = showCommentsParam !== 'false';
  const themeColors = themes[themeName] || themes.dark;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    const apiUrl = `https://api.github.com/search/issues?q=is:pr+author:${encodeURIComponent(username)}&sort=created&order=desc&per_page=${prLimit}`;
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'github-pr-svg-generator' },
    });

    if (response.status === 403 || response.status === 429) {
      return res.status(200).send(generateErrorSvg('Rate limit exceeded. Please try again later.', themeName));
    }

    if (response.status === 422) {
      return res.status(200).send(generateErrorSvg('Invalid username.', themeName));
    }

    if (!response.ok) {
      return res.status(200).send(generateErrorSvg(`GitHub API error (${response.status})`, themeName));
    }

    const data = await response.json();
    const prs = Array.isArray(data.items) ? data.items : [];

    const svg = generateSvg(prs, username, {
      showDate,
      showComments,
      theme: themeColors,
    });

    return res.status(200).send(svg);
  } catch (error) {
    console.error('Badge generation error:', error);
    return res.status(200).send(generateErrorSvg('An unexpected error occurred.', themeName));
  }
}
