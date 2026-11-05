/**
 * Localization for the playground.
 *
 * Only the UI chrome is translated: the SVG itself stays language neutral so a
 * badge embedded in a README does not depend on a query parameter just to be
 * readable. Adding a locale means adding one dictionary — nothing else.
 */

/** @typedef {Record<string, string>} Dictionary */

/** @type {Record<string, Dictionary>} */
export const DICTIONARIES = {
  en: {
    'app.title': 'PR SVG Generator',
    'app.tagline': 'Embeddable pull request badge for GitHub profiles',
    'hero.heading': 'Pull request badge for your README',
    'hero.body':
      'Renders your most recent pull requests as a self-contained SVG. No client-side JavaScript, no tracking, cached at the edge.',
    'config.heading': 'Configuration',
    'config.username': 'GitHub username',
    'config.usernameHint': 'Letters, digits and hyphens. Case insensitive.',
    'config.limit': 'Pull requests',
    'config.theme': 'Theme',
    'config.display': 'Display columns',
    'config.showDate': 'Created date',
    'config.showComments': 'Comment count',
    'preview.heading': 'Live preview',
    'preview.loading': 'Rendering…',
    'preview.alt': 'Preview of the pull request badge',
    'preview.empty': 'Enter a GitHub username to render the badge.',
    'preview.unavailable': 'Unavailable',
    'markdown.heading': 'Markdown snippet',
    'markdown.copy': 'Copy',
    'markdown.copied': 'Copied',
    'markdown.copyFailed': 'Press Ctrl+C',
    'theme.dark': 'Dark',
    'theme.light': 'Light',
    'theme.dimmed': 'Dimmed',
    'status.ready': 'Ready',
    'status.rendering': 'Rendering',
    'footer.source': 'Source',
    'footer.api': 'GitHub API',
    'footer.builtWith': 'Deployed on Vercel',
    'error.invalidUsername': 'Enter a valid GitHub username',
  },
  ru: {
    'app.title': 'PR SVG Генератор',
    'app.tagline': 'Бейдж пул-реквестов для профиля GitHub',
    'hero.heading': 'Бейдж пул-реквестов для вашего README',
    'hero.body':
      'Показывает последние пул-реквесты в виде самодостаточного SVG. Без клиентского JavaScript, без трекинга, с кешированием на периферии.',
    'config.heading': 'Настройки',
    'config.username': 'Имя пользователя GitHub',
    'config.usernameHint': 'Латиница, цифры и дефисы. Регистр не важен.',
    'config.limit': 'Количество PR',
    'config.theme': 'Тема',
    'config.display': 'Отображаемые колонки',
    'config.showDate': 'Дата создания',
    'config.showComments': 'Количество комментариев',
    'preview.heading': 'Предпросмотр',
    'preview.loading': 'Отрисовка…',
    'preview.alt': 'Предпросмотр бейджа пул-реквестов',
    'preview.empty': 'Введите имя пользователя GitHub, чтобы отрисовать бейдж.',
    'preview.unavailable': 'Недоступно',
    'markdown.heading': 'Markdown для README',
    'markdown.copy': 'Копировать',
    'markdown.copied': 'Скопировано',
    'markdown.copyFailed': 'Нажмите Ctrl+C',
    'theme.dark': 'Тёмная',
    'theme.light': 'Светлая',
    'theme.dimmed': 'Приглушённая',
    'status.ready': 'Готово',
    'status.rendering': 'Отрисовка',
    'footer.source': 'Исходный код',
    'footer.api': 'GitHub API',
    'footer.builtWith': 'Развёрнуто на Vercel',
    'error.invalidUsername': 'Введите корректное имя пользователя GitHub',
  },
};

export const SUPPORTED_LANGUAGES = Object.freeze(Object.keys(DICTIONARIES));
export const DEFAULT_LANGUAGE = 'en';

/**
 * Resolves a locale tag (`ru-RU`, `en_GB`, `de`) to a supported dictionary key.
 *
 * @param {string | null | undefined} tag
 * @returns {string}
 */
export function normalizeLanguage(tag) {
  const base = String(tag ?? '').toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE;
}

/**
 * Picks the initial language: stored preference first, then the browser hint.
 *
 * @param {Storage | undefined} storage
 * @param {string | undefined} browserLanguage
 * @returns {string}
 */
export function resolveInitialLanguage(storage, browserLanguage) {
  const stored = storage?.getItem('pr-svg:language');
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  return normalizeLanguage(browserLanguage);
}
