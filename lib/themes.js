/**
 * Colour tokens for every supported badge theme.
 *
 * The palettes intentionally mirror GitHub's own design tokens so a badge sits
 * comfortably next to native UI, and they are the single source of truth for
 * both the SVG renderer and the playground (which derives its CSS variables
 * from the same objects). Adding a theme therefore requires no other change.
 */

/** @typedef {'dark' | 'light'} ColorScheme */

/**
 * @typedef {object} Theme
 * @property {string} id Stable identifier used in URLs.
 * @property {string} label Human readable name.
 * @property {ColorScheme} scheme Document colour scheme.
 * @property {string} surface Card background.
 * @property {string} surfaceAlt Subtle row tint used for striped lists.
 * @property {string} header Table header background.
 * @property {string} border Outer border.
 * @property {string} borderMuted Internal dividers.
 * @property {string} textPrimary Primary text.
 * @property {string} textSecondary Secondary text and metadata.
 * @property {string} textMuted Tertiary text and empty states.
 * @property {string} accent Link and highlight colour.
 * @property {string} accentContrast Foreground colour on top of the accent.
 * @property {{ open: string, merged: string, closed: string, draft: string }} status PR state colours.
 */

/** @type {Record<string, Theme>} */
const THEMES = {
  dark: {
    id: 'dark',
    label: 'Dark',
    scheme: 'dark',
    surface: '#0d1117',
    surfaceAlt: '#11161d',
    header: '#161b22',
    border: '#30363d',
    borderMuted: '#21262d',
    textPrimary: '#e6edf3',
    textSecondary: '#9198a1',
    textMuted: '#6e7681',
    accent: '#58a6ff',
    accentContrast: '#0d1117',
    status: {
      open: '#3fb950',
      merged: '#a371f7',
      closed: '#f85149',
      draft: '#8b949e',
    },
  },
  light: {
    id: 'light',
    label: 'Light',
    scheme: 'light',
    surface: '#ffffff',
    surfaceAlt: '#f6f8fa',
    header: '#f6f8fa',
    border: '#d1d9e0',
    borderMuted: '#eaeef2',
    textPrimary: '#1f2328',
    textSecondary: '#59636e',
    textMuted: '#818b98',
    accent: '#0969da',
    accentContrast: '#ffffff',
    status: {
      open: '#1a7f37',
      merged: '#8250df',
      closed: '#cf222e',
      draft: '#6e7781',
    },
  },
  dimmed: {
    id: 'dimmed',
    label: 'Dimmed',
    scheme: 'dark',
    surface: '#22272e',
    surfaceAlt: '#262c34',
    header: '#2d333b',
    border: '#444c56',
    borderMuted: '#373e47',
    textPrimary: '#adbac7',
    textSecondary: '#909dab',
    textMuted: '#768390',
    accent: '#539bf5',
    accentContrast: '#22272e',
    status: {
      open: '#57ab5a',
      merged: '#b083f0',
      closed: '#f47067',
      draft: '#768390',
    },
  },
};

/** Fallback theme, also used whenever a caller supplies an unknown name. */
export const DEFAULT_THEME_ID = 'dark';

/** @type {readonly string[]} */
export const THEME_IDS = Object.freeze(Object.keys(THEMES));

/**
 * Resolves a theme by identifier.
 *
 * @param {string | null | undefined} id Requested theme name.
 * @returns {Theme} A usable theme; never `undefined`.
 */
export function resolveTheme(id) {
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID];
}

/**
 * Public theme catalogue, safe to serialize into the playground.
 *
 * @returns {Theme[]}
 */
export function listThemes() {
  return Object.values(THEMES);
}
