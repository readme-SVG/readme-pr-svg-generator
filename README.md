# readme-pr-svg-generator

[![Pull requests](https://readme-pr-svg-generator.vercel.app/api/badge?username=OstinUA)](https://github.com/pulls?q=is%3Apr%20author%3AOstinUA)

An embeddable SVG badge that lists a GitHub user's most recent pull requests. The
badge is rendered on the server as a single self-contained document, so it works
in any Markdown renderer that supports images — no JavaScript, no client-side
tracking, and no third-party widgets in your README.

## Usage

Paste this into your README, replacing the username:

```markdown
[![Pull requests](https://readme-pr-svg-generator.vercel.app/api/badge?username=OstinUA)](https://github.com/pulls?q=is%3Apr%20author%3AOstinUA)
```

Or configure it visually in the [playground](https://readme-pr-svg-generator.vercel.app),
which generates the snippet for you.

## Parameters

| Parameter      | Default | Description                                                       |
| -------------- | ------- | ----------------------------------------------------------------- |
| `username`     | —       | GitHub login. Required. Letters, digits and hyphens.               |
| `limit`        | `5`     | Rows to render, clamped to `1`–`10`.                               |
| `theme`        | `dark`  | `dark`, `light` or `dimmed`. Unknown values fall back to `dark`.   |
| `showDate`     | `true`  | Set to `false` to hide the creation date column.                   |
| `showComments` | `true`  | Set to `false` to hide the comment count column.                   |
| `demo`         | `false` | Set to `true` to render deterministic fixture data (no API call).  |

Responses are served with `Cache-Control: public, s-maxage=1800` and
`stale-while-revalidate=86400`, so a badge in a popular README is answered from
the edge rather than from GitHub.

## How it works

```
api/badge.js     HTTP handler: validates input, chooses a cache policy, renders
api/index.js     Legacy `/api` → `/api/badge` redirect
api/options.js   Theme and limit catalogue consumed by the playground
lib/github.js    GitHub Search client: timeouts, error taxonomy, request coalescing
lib/svg.js       Pure renderer; all layout and escaping lives here
lib/options.js   Request contract shared by the API and the playground
lib/query.js     Tolerant parsing of untrusted query parameters
lib/themes.js    Design tokens for every theme
lib/http.js      Response helpers and shared security headers
public/          Playground (static, ES modules, no build step, no dependencies)
scripts/dev.mjs  Zero-dependency local server that mirrors the Vercel routing
test/            Node test runner suites
```

The renderer is a pure function and the GitHub client is the only module that
performs I/O, which keeps both trivially testable and keeps the failure surface
in one place.

## Development

```bash
npm run dev     # http://localhost:3000
npm test        # node --test, no dependencies to install
```

`npm run vercel:dev` runs the same project through the Vercel CLI when you need
platform parity.

## Configuration

| Variable       | Required | Purpose                                                            |
| -------------- | -------- | ------------------------------------------------------------------ |
| `GITHUB_TOKEN` | No       | Raises the GitHub rate limit. A read-only token is sufficient.      |

Without a token the unauthenticated Search API allows 10 requests per minute per
IP. Successful lookups are cached for five minutes, concurrent lookups for the
same login are coalesced into a single request, and failures are remembered for
30 seconds so an outage does not turn every badge impression into another
upstream call. A token is recommended if the badge appears in a high-traffic
README.

## Design notes

- **The badge endpoint always returns `200` with a valid SVG.** A broken image in
  someone's README explains nothing, so validation errors and upstream outages are
  reported inside the image instead. Error responses are sent with
  `max-age=0` so a transient failure is never pinned in a CDN.
- **Untrusted input never reaches the document unescaped.** Titles and repository
  names come from GitHub, which means they are user-controlled; every value is
  escaped and truncated against a font metric before it is written.
- **SVG is served with a sandboxing CSP** (`script-src 'none'`, `object-src 'none'`).
  An SVG is a document, not an image: without those headers an inline script in a
  badge opened directly could run on this origin.
- **Query parameters are validated against a closed set of values** and the legacy
  redirect is rebuilt from the validated parameters only, so no route can be used
  as an open redirect.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
