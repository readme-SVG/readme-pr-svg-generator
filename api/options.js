/**
 * Configuration endpoint: `GET /api/options`.
 *
 * The playground needs to know which themes and limits exist. Serving that from
 * the same module the API validates with removes the usual class of bug where
 * the UI offers a value the backend silently ignores.
 */

import { enforceMethod, sendJson } from '../lib/http.js';
import { LIMIT } from '../lib/options.js';
import { listThemes } from '../lib/themes.js';

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default function handler(req, res) {
  if (enforceMethod(req, res)) return;

  sendJson(
    res,
    {
      version: 1,
      limit: LIMIT,
      themes: listThemes(),
      defaults: {
        username: '',
        limit: LIMIT.default,
        theme: 'dark',
        showDate: true,
        showComments: true,
      },
    },
    { maxAge: 3600 },
  );
}
