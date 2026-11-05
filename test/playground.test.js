import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DICTIONARIES, normalizeLanguage, resolveInitialLanguage } from '../public/js/i18n.js';

describe('localization', () => {
  it('keeps every locale in sync with the reference locale', () => {
    const reference = Object.keys(DICTIONARIES.en).sort();

    for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
      assert.deepEqual(Object.keys(dictionary).sort(), reference, `locale ${locale} drifted`);
    }
  });

  it('resolves regional tags to a supported base language', () => {
    assert.equal(normalizeLanguage('ru-RU'), 'ru');
    assert.equal(normalizeLanguage('en_GB'), 'en');
    assert.equal(normalizeLanguage('de-DE'), 'en');
    assert.equal(normalizeLanguage(undefined), 'en');
  });

  it('prefers the stored preference over the browser hint', () => {
    const storage = { getItem: () => 'ru' };
    assert.equal(resolveInitialLanguage(storage, 'en-US'), 'ru');

    const emptyStorage = { getItem: () => null };
    assert.equal(resolveInitialLanguage(emptyStorage, 'ru-RU'), 'ru');
  });
});

describe('theme styling', () => {
  it('defines a stylesheet palette for every theme the API exposes', async () => {
    const [{ readFile }, { THEME_IDS, DEFAULT_THEME_ID }] = await Promise.all([
      import('node:fs/promises'),
      import('../lib/themes.js'),
    ]);

    const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

    for (const id of THEME_IDS) {
      if (id === DEFAULT_THEME_ID) continue; // The default palette lives on :root.
      assert.ok(css.includes(`[data-theme="${id}"]`), `styles.css is missing a palette for ${id}`);
    }
  });
});
