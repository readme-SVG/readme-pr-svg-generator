/**
 * Playground controller.
 *
 * The page has three pieces of state: settings, the active language, and the
 * preview lifecycle. Everything rendered — the `<img>` URL and the Markdown
 * snippet — is derived from that state in a single pass, so the two can never
 * disagree, and rapid edits collapse into one request thanks to a shared
 * debounce timer and an abortable in-flight preview.
 */

import { buildBadgeUrl, buildMarkdown } from './badge-url.js';
import { DICTIONARIES, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, resolveInitialLanguage } from './i18n.js';

const STORAGE_KEY = 'pr-svg:settings';
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const DEBOUNCE_MS = 400;
const DEFAULT_SETTINGS = Object.freeze({
  username: '',
  limit: 5,
  theme: 'dark',
  showDate: true,
  showComments: true,
});

const dom = {
  root: document.documentElement,
  form: document.getElementById('config-form'),
  username: document.getElementById('username'),
  limit: document.getElementById('limit'),
  theme: document.getElementById('theme'),
  showDate: document.getElementById('show-date'),
  showComments: document.getElementById('show-comments'),
  language: document.getElementById('language'),
  previewImage: document.getElementById('preview-image'),
  previewPlaceholder: document.getElementById('preview-placeholder'),
  previewStatus: document.getElementById('preview-status'),
  snippet: document.getElementById('snippet'),
  copyButton: document.getElementById('copy-button'),
  copyLabel: document.getElementById('copy-label'),
  error: document.getElementById('form-error'),
};

/** @type {{ settings: import('./badge-url.js').BadgeSettings, language: string }} */
const state = { settings: { ...DEFAULT_SETTINGS }, language: DEFAULT_LANGUAGE };

let debounceTimer = 0;
let copyResetTimer = 0;

/**
 * Translates a key, falling back to English and then to the key itself.
 *
 * @param {string} key
 * @returns {string}
 */
function t(key) {
  return DICTIONARIES[state.language]?.[key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key;
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Re-renders every localized node, the document title and the snippet.
 */
function renderLanguage() {
  dom.root.lang = state.language;
  dom.language.value = state.language;

  for (const node of document.querySelectorAll('[data-i18n]')) {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  }

  document.title = `${t('app.title')} — ${t('app.tagline')}`;
  dom.previewImage.alt = t('preview.alt');
  dom.previewStatus.textContent = t(
    dom.previewStatus.dataset.state === 'busy' ? 'status.rendering' : 'status.ready',
  );
  dom.copyLabel.textContent = t('markdown.copy');
  renderSnippet();
}

/**
 * Renders the Markdown snippet, or an explicit template while no username is set.
 */
function renderSnippet() {
  const { username } = state.settings;
  dom.snippet.textContent = username
    ? buildMarkdown(state.settings, window.location.origin)
    : `${window.location.origin}/api/badge?username=<login>`;
}

/**
 * Refreshes the preview image and its loading state.
 */
function renderPreview() {
  const { username } = state.settings;

  if (!username || !USERNAME_PATTERN.test(username)) {
    dom.previewImage.hidden = true;
    dom.previewPlaceholder.hidden = false;
    setStatus('idle');
    return;
  }

  dom.previewPlaceholder.hidden = true;
  dom.previewImage.hidden = false;
  setStatus('busy');
  dom.previewImage.src = buildBadgeUrl(state.settings, window.location.origin);
}

/**
 * @param {'idle' | 'busy' | 'failed'} status
 */
function setStatus(status) {
  dom.previewStatus.dataset.state = status;
  dom.previewStatus.textContent = t(status === 'busy' ? 'status.rendering' : 'status.ready');
}

/**
 * @param {string | null} message
 */
function setError(message) {
  dom.error.textContent = message ?? '';
  dom.error.hidden = !message;
  dom.username.setAttribute('aria-invalid', message ? 'true' : 'false');
}

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Reads the form into state and validates it.
 *
 * @returns {boolean} Whether the settings are renderable.
 */
function readForm() {
  state.settings = {
    username: dom.username.value.trim(),
    limit: Number(dom.limit.value) || DEFAULT_SETTINGS.limit,
    theme: dom.theme.value,
    showDate: dom.showDate.checked,
    showComments: dom.showComments.checked,
  };

  if (!state.settings.username) {
    setError(null);
    return false;
  }

  const valid = USERNAME_PATTERN.test(state.settings.username);
  setError(valid ? null : t('error.invalidUsername'));
  return valid;
}

/**
 * Persists settings, tolerating disabled or full storage.
 */
function persistSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  } catch {
    // Storage is an enhancement; the playground works without it.
  }
}

/**
 * Restores settings persisted by a previous visit.
 *
 * @returns {import('./badge-url.js').BadgeSettings}
 */
function restoreSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };

    return {
      username: typeof parsed.username === 'string' ? parsed.username : '',
      limit: Number(parsed.limit) || DEFAULT_SETTINGS.limit,
      theme: typeof parsed.theme === 'string' ? parsed.theme : DEFAULT_SETTINGS.theme,
      showDate: parsed.showDate !== false,
      showComments: parsed.showComments !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Handles any edit: validate, persist, re-render, then schedule a preview.
 */
function handleEdit() {
  const valid = readForm();
  persistSettings();
  applyTheme(state.settings.theme);
  renderSnippet();

  window.clearTimeout(debounceTimer);
  if (!valid) {
    dom.previewImage.hidden = true;
    dom.previewPlaceholder.hidden = false;
    setStatus('idle');
    return;
  }

  debounceTimer = window.setTimeout(renderPreview, DEBOUNCE_MS);
}

/**
 * Applies the selected theme to the whole page so the chrome matches the badge.
 *
 * @param {string} themeId
 */
function applyTheme(themeId) {
  dom.root.dataset.theme = themeId;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Copies the snippet, falling back to a text selection when the Clipboard API
 * is unavailable (insecure context or older browser).
 */
async function copySnippet() {
  const text = dom.snippet.textContent ?? '';
  let result = 'copied';

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(dom.snippet);
    selection?.removeAllRanges();
    selection?.addRange(range);
    result = 'failed';
  }

  dom.copyButton.dataset.state = result;
  dom.copyLabel.textContent = t(result === 'copied' ? 'markdown.copied' : 'markdown.copyFailed');

  window.clearTimeout(copyResetTimer);
  copyResetTimer = window.setTimeout(() => {
    dom.copyButton.dataset.state = 'idle';
    dom.copyLabel.textContent = t('markdown.copy');
  }, 2000);
}

/**
 * Populates the theme selector from the API so the UI cannot offer a theme the
 * server does not support. The static options in the markup are the fallback.
 */
async function loadThemes() {
  try {
    const response = await fetch('/api/options');
    if (!response.ok) return;

    const { themes } = await response.json();
    if (!Array.isArray(themes) || themes.length === 0) return;

    dom.theme.replaceChildren(
      ...themes.map((theme) => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = t(`theme.${theme.id}`);
        return option;
      }),
    );

    const selected = state.settings.theme;
    if ([...dom.theme.options].some((option) => option.value === selected)) {
      dom.theme.value = selected;
    } else {
      dom.theme.value = 'dark';
      state.settings.theme = 'dark';
    }
  } catch {
    // Keep the statically rendered options.
  }
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                  */
/* -------------------------------------------------------------------------- */

function bindEvents() {
  dom.form.addEventListener('input', handleEdit);
  dom.form.addEventListener('change', handleEdit);
  dom.form.addEventListener('submit', (event) => event.preventDefault());

  dom.language.addEventListener('change', () => {
    state.language = dom.language.value;
    try {
      localStorage.setItem('pr-svg:language', state.language);
    } catch {
      // Ignored: the preference simply will not survive a reload.
    }
    renderLanguage();
    void loadThemes();
  });

  dom.copyButton.addEventListener('click', () => void copySnippet());
  dom.previewImage.addEventListener('error', () => {
    setStatus('failed');
    dom.previewStatus.textContent = t('preview.unavailable');
  });
}

async function main() {
  state.settings = restoreSettings();
  state.language = resolveInitialLanguage(safeStorage(), navigator.language);

  dom.language.replaceChildren(
    ...SUPPORTED_LANGUAGES.map((code) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code.toUpperCase();
      return option;
    }),
  );

  dom.username.value = state.settings.username;
  dom.limit.value = String(state.settings.limit);
  dom.showDate.checked = state.settings.showDate;
  dom.showComments.checked = state.settings.showComments;

  bindEvents();
  await loadThemes();
  renderLanguage();
  applyTheme(state.settings.theme);

  // Re-validate whatever was restored from storage before rendering, so a stale
  // or hand-edited value surfaces the same error a typed one would.
  if (readForm()) {
    renderPreview();
  } else {
    dom.previewPlaceholder.hidden = false;
  }
}

/**
 * Returns `localStorage` when it is reachable, `undefined` otherwise.
 *
 * @returns {Storage | undefined}
 */
function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

void main();
