// ─────────────────────────────────────────────────────────────────────────────
// THE LOADER, AS IT ACTUALLY RUNS — Palette-13 Part B (B.6, R-G)
//
// ⚠ THIS RENDERS THE APP RATHER THAN READING ITS SOURCE, AND THAT IS THE POINT.
// A source sweep proves a STRING is absent; it proves nothing about whether the
// code still runs. `AnnouncementPopup` threw a ReferenceError on every render
// while its literal sweep passed. So these assertions read the DOM the hook
// actually produced.
//
// ── R-G: THE FOCUS RING ─────────────────────────────────────────────────────
// `useReferrerFonts()` injected `outline: 2px solid #012854` — a RETIRED
// CONTRACTOR TONE on every focusable control across referrer, rep and auth.
// ⚠ IT WAS INVISIBLE TO EVERY SWEEP IN THIS REPO, because it sat inside a
// template string in App.jsx rather than in a style object, and because
// App.jsx is in none of the trees the phrase "the referrer tree is at zero
// retired tones" counts. That sentence was TRUE and did not cover this.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import App from './App';
import { FONT_FACES, FONT_URL_BASE } from './constants/fontManifest.mjs';
import { BRANDING_THEME_DEFAULTS } from './utils/brandingTheme.mjs';

// The three tones ABR Phase 5 retired. Needles, not values to reach for.
const RETIRED_TONES = ['#012854', '#CC0000', '#D3E3F0'];

afterEach(cleanup);

function headText() {
  return [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
}

describe('the font loader, as rendered', () => {
  it('declares an @font-face for every family in the manifest', () => {
    render(<App />);
    const css = document.getElementById('rm-font-faces');
    // POSITIVE CONTROL FIRST: the element exists at all. Without this, every
    // absence assertion below is satisfied by a hook that never ran.
    expect(css).not.toBeNull();
    for (const family of Object.keys(FONT_FACES)) {
      expect(css.textContent).toContain(`font-family:'${family}'`);
    }
    expect(Object.keys(FONT_FACES).length).toBe(15);
  });

  it('every declared face is SAME-ORIGIN — no Google, no CDN (R-B)', () => {
    render(<App />);
    const css = document.getElementById('rm-font-faces').textContent;
    expect(css).toContain(`url('${FONT_URL_BASE}`);
    // ⚠ THE RULING'S DECIDING FACTOR. landing.js narrows font-src to 'self'
    // because a remote font on a page carrying contractor-controlled strings is
    // an exfiltration channel; the product must not hold two positions on it.
    expect(css).not.toMatch(/fonts\.googleapis\.com/);
    expect(css).not.toMatch(/fonts\.gstatic\.com/);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('no stylesheet link to Google remains anywhere in head', () => {
    render(<App />);
    const hrefs = [...document.head.querySelectorAll('link')].map((l) => l.getAttribute('href') || '');
    expect(hrefs.some((h) => h.includes('fonts.googleapis.com'))).toBe(false);
  });

  it('preloads the platform default faces, crossOrigin set', () => {
    render(<App />);
    const preloads = [...document.head.querySelectorAll('link[rel="preload"]')];
    expect(preloads.length).toBe(3);
    for (const l of preloads) {
      expect(l.getAttribute('as')).toBe('font');
      expect(l.getAttribute('type')).toBe('font/woff2');
      // ⚠ A FONT FETCH IS CORS-MODE BY SPECIFICATION. Without this the preload
      // is a different request from the one the CSS makes: the file downloads
      // twice and the browser warns instead of helping.
      expect(l.getAttribute('crossorigin')).toBe('anonymous');
      expect(l.getAttribute('href').startsWith(FONT_URL_BASE)).toBe(true);
    }
    // The defaults specifically — not some other three.
    const files = preloads.map((l) => l.getAttribute('href'));
    for (const role of ['headingFont', 'bodyFont', 'monoFont']) {
      const family = BRANDING_THEME_DEFAULTS[role];
      expect(files).toContain(FONT_URL_BASE + FONT_FACES[family][0].file);
    }
  });
});

describe('R-G — the focus ring carries no retired tone', () => {
  it('the injected focus rule exists and is themed', () => {
    render(<App />);
    const css = headText();
    // POSITIVE CONTROL: the rule is present. "does not contain #012854" is
    // satisfied by a hook that stopped injecting anything at all.
    expect(css).toMatch(/button:focus-visible/);
    expect(css).toMatch(/outline:\s*2px solid var\(--rm-secondary, #1C2D4D\)/);
  });

  it('no retired contractor tone appears in any injected style', () => {
    render(<App />);
    const css = headText();
    for (const tone of RETIRED_TONES) {
      expect(css.toUpperCase()).not.toContain(tone.toUpperCase());
    }
  });

  it('the fallback is the value the provider actually mounts, not a plausible one', () => {
    // ⚠ jsdom RESOLVES NO var(), so the fallback is what would paint in every
    // test in this repo — and a fallback that disagrees with the mount is
    // invisible to all of them. --rm-secondary mounts #1C2D4D in light mode,
    // measured; the light value ships as the literal, matching STATUS_LIGHT and
    // ELEVATION_LIGHT's convention.
    render(<App />);
    expect(headText()).toContain('var(--rm-secondary, #1C2D4D)');
  });
});
