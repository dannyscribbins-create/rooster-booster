'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-1 — THE TOKEN FOUNDATIONS
//
// T1  the recess token derives, mounts, and meets its floors — per mode, per brand
// T2  the mirror drift guard catches a key present in only one copy
// T4  gradient partners derive per brand and differ VISIBLY from their base
// T5b the harness route is ABSENT from a production build (T5a renders it, in vitest)
//
// ⚠ NOTHING HERE MIGRATES ANYTHING. Palette-1 builds destinations; not one R.*
// reference changed in the commit that added this file.
// ─────────────────────────────────────────────────────────────────────────────

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const canonical = require('../utils/themeTokens.js');
const { resolveBrandingTheme } = require('../utils/brandingTheme.js');

const {
  deriveThemeTokens, themeCssVariables, contrastRatio,
  RENDER_TOKEN_KEYS, RENDER_TOKEN_VARS,
  TEXT_CONTRAST_MIN, GRADIENT_PARTNER_MIN_CONTRAST,
} = canonical;

// The three seeded contractors, by their stored brand columns. Gamma is the
// UNSET one and is the case that matters — it is what a contractor looks like
// before they have chosen anything, which is every contractor's first minute.
const BRANDS = [
  ['Gamma (UNSET — the onboarding baseline)', null],
  ['Alpha', { primary_color: '#1C2D4D', secondary_color: '#F26A1B', landing_bg_color: '#FFFFFF' }],
  ['Beta',  { primary_color: '#0B3D3B', secondary_color: '#C2185B', landing_bg_color: '#F4FBFA' }],
];
const MODES = ['light', 'dark'];

describe('Palette-1 T1 — the recess token', () => {
  test('[RED] it is in the token set, mounts as --rm-recess, and survives the validator', () => {
    assert.ok(RENDER_TOKEN_KEYS.includes('recess'), 'recess is not a render token');
    assert.equal(RENDER_TOKEN_VARS.recess, '--rm-recess');
    // ⚠ APPENDED, NOT INSERTED. A23.1's claim is about the PREFIX of this list,
    // so the first six must still be the first six in the same order.
    assert.deepEqual(
      RENDER_TOKEN_KEYS.slice(0, 6),
      ['primary', 'secondary', 'bg', 'surface', 'text', 'onPrimary'],
      'the A23.1 prefix moved — a Palette key was inserted rather than appended'
    );
  });

  test('[RED] text clears the TEXT floor ON the recess, every brand, every mode', () => {
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        const ratio = contrastRatio(t.text, t.recess);
        assert.ok(
          ratio >= TEXT_CONTRAST_MIN,
          `${label}/${mode}: text ${t.text} on recess ${t.recess} = ${ratio.toFixed(2)}:1, floor ${TEXT_CONTRAST_MIN}`
        );
      }
    }
  });

  test('⚠ the recess/surface separation is REPORTED, and is deliberately NOT held to 3:1', () => {
    // ⚠ THIS ASSERTS A KNOWN SHORTFALL, ON PURPOSE, AND IT IS NOT A BUG.
    // A fill that clears the 3:1 non-text floor against white is a mid-grey
    // (~#767676) — that is a filled block, not a recess. The separation lands
    // where R.bgPage/R.bgCard already sits (1.12:1). The 3:1 obligation for a
    // recessed CONTROL belongs to its edge, which is elevationVar('border').
    // If a future change DOES clear 3:1 here, this goes red and whoever did it
    // must delete it — a limitation nobody re-checks becomes a permanent one.
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        const ratio = contrastRatio(t.recess, t.surface);
        assert.ok(ratio < 3, `${label}/${mode}: recess/surface is ${ratio.toFixed(2)}:1 — if this now clears 3:1, update the ruling`);
        assert.ok(ratio > 1.0, `${label}/${mode}: recess is INDISTINGUISHABLE from surface (${ratio.toFixed(2)}:1)`);
      }
    }
  });

  test('⚠ VACUITY — on the UNSET brand the recess is DERIVED, not a substituted constant', () => {
    // The question this answers: does Gamma pass because a value was computed
    // from its brand, or because some default was dropped in? The test is
    // movement — change the brand's dark tone and the recess MUST follow. A
    // substituted constant cannot.
    const unset = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    const teal = deriveThemeTokens(resolveBrandingTheme({ primary_color: '#0B3D3B' }), 'light');
    assert.notEqual(
      unset.recess, teal.recess,
      'recess did not move when the brand did — it is a constant, not a derivation'
    );
    // And it is not simply one of the stored inputs handed back.
    const brand = resolveBrandingTheme(null);
    for (const stored of [brand.primaryColor, brand.secondaryColor, brand.accentColor, brand.backgroundColor]) {
      assert.notEqual(unset.recess.toUpperCase(), String(stored).toUpperCase(),
        `recess is just the stored ${stored} passed through`);
    }
  });
});

describe('Palette-4a Part B T1 — the onSecondary token', () => {
  test('[RED] it is in the token set and mounts as --rm-on-secondary', () => {
    assert.ok(RENDER_TOKEN_KEYS.includes('onSecondary'), 'onSecondary is not a render token');
    assert.equal(RENDER_TOKEN_VARS.onSecondary, '--rm-on-secondary');
    // Appended, like every addition since onPrimary — A23.1's claim is about the prefix.
    assert.deepEqual(
      RENDER_TOKEN_KEYS.slice(0, 6),
      ['primary', 'secondary', 'bg', 'surface', 'text', 'onPrimary'],
      'A23.1 rests on this prefix; an insertion rather than an append falsifies it'
    );
    assert.equal(
      RENDER_TOKEN_KEYS[RENDER_TOKEN_KEYS.length - 1], 'onSecondary',
      'onSecondary must be the last key — it was appended, not inserted'
    );
  });

  test('[RED] it clears the TEXT floor on its own fill, every brand, every mode', () => {
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        const ratio = contrastRatio(t.onSecondary, t.secondary);
        assert.ok(
          ratio >= TEXT_CONTRAST_MIN,
          `${label}/${mode}: onSecondary ${t.onSecondary} on secondary ${t.secondary} is ${ratio.toFixed(2)}:1`
        );
      }
    }
  });

  // ⚠ THE MONEY FENCE'S TWIN, AND IT IS THE SAME SHAPE: assert that the value
  // the sites USED TO CARRY fails, so the token cannot be quietly reverted to it.
  // Without this the case above passes against a hardcoded '#FFFFFF' in light
  // mode and nothing would ever report the dark half.
  test('[RED] a bare white FAILS on the dark-mode secondary — which is the defect', () => {
    let sawFailure = false;
    for (const [label, src] of BRANDS) {
      const t = deriveThemeTokens(resolveBrandingTheme(src), 'dark');
      const white = contrastRatio('#FFFFFF', t.secondary);
      if (white < TEXT_CONTRAST_MIN) {
        sawFailure = true;
        assert.ok(
          contrastRatio(t.onSecondary, t.secondary) >= TEXT_CONTRAST_MIN,
          `${label}: white fails at ${white.toFixed(2)}:1 and onSecondary does not rescue it`
        );
      }
    }
    // ⚠ NON-VACUITY. If no brand ever failed under white, this test would pass
    // by examining nothing and the token would have no demonstrated purpose.
    assert.ok(
      sawFailure,
      'no seeded brand failed under a bare white — the premise for onSecondary is unproven'
    );
  });

  test('[RED] light and dark derive it from DIFFERENT inputs, and that is not a bug', () => {
    // Light-mode `secondary` is a strict passthrough of brand.primaryColor;
    // dark-mode `secondary` is that colour BRIGHTENED. A single expression
    // cannot serve both, so this pins that they are computed against their own
    // mode's fill rather than against a shared one.
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        const best = contrastRatio('#FFFFFF', t.secondary) >= contrastRatio('#000000', t.secondary)
          ? '#FFFFFF' : '#000000';
        assert.equal(
          t.onSecondary, best,
          `${label}/${mode}: onSecondary is not the better foreground for THIS mode's fill`
        );
      }
    }
  });

  test('every onSecondary is a valid #RRGGBB — which is why it is a render token', () => {
    for (const [, src] of BRANDS) {
      for (const mode of MODES) {
        const vars = themeCssVariables(deriveThemeTokens(resolveBrandingTheme(src), mode));
        assert.match(vars['--rm-on-secondary'], /^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('Palette-4a T1 — the brand-text token', () => {
  test('[RED] it is in the token set and mounts as --rm-primary-text', () => {
    assert.ok(RENDER_TOKEN_KEYS.includes('primaryText'), 'primaryText is not a render token');
    assert.equal(RENDER_TOKEN_VARS.primaryText, '--rm-primary-text');
    // Appended, like every addition since onPrimary — A23.1's claim is about the prefix.
    assert.deepEqual(
      RENDER_TOKEN_KEYS.slice(0, 6),
      ['primary', 'secondary', 'bg', 'surface', 'text', 'onPrimary'],
      'the A23.1 prefix moved'
    );
  });

  test('[RED] it clears the TEXT floor against BOTH surface and recess, every brand, every mode', () => {
    // ⚠ BOTH GROUNDS. A brand-text value can sit on a card or in a recessed well,
    // and in light mode the recess is the darker of the two — a value floored only
    // against `surface` is not guaranteed on `recess`.
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        for (const [ground, value] of [['surface', t.surface], ['recess', t.recess]]) {
          const ratio = contrastRatio(t.primaryText, value);
          assert.ok(
            ratio >= TEXT_CONTRAST_MIN,
            `${label}/${mode}: primaryText ${t.primaryText} on ${ground} ${value} = ${ratio.toFixed(2)}:1, floor ${TEXT_CONTRAST_MIN}`
          );
        }
      }
    }
  });

  test('⚠ THE MONEY FENCE — --rm-primary CANNOT carry text, which is why this token exists', () => {
    // ⚠ THIS ASSERTS THE DEFECT THE TOKEN PREVENTS. `primary` is floored against
    // BRAND_ON_LIGHT_MIN_CONTRAST = 3, the NON-TEXT floor. For the platform brand
    // it lands at 3.06:1 against surface — below 4.5 — while a magenta brand
    // passes at 5.87:1. That per-contractor split on the dollar amounts is the
    // whole reason Palette-4a exists.
    const platform = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    assert.ok(
      contrastRatio(platform.primary, platform.surface) < TEXT_CONTRAST_MIN,
      'primary now clears the text floor for the platform brand — if the derivation ' +
      'changed, re-derive whether primaryText is still needed rather than deleting it'
    );
    assert.ok(
      contrastRatio(platform.primaryText, platform.surface) >= TEXT_CONTRAST_MIN,
      'primaryText does not clear the text floor — the token is not doing its job'
    );
  });

  test('it is a no-op wherever the brand colour already clears — measured, not assumed', () => {
    // ⚠ RECORDED SO THE PIXELS ARE NOT A SURPRISE. A red or magenta action colour
    // is returned UNCHANGED: an Accent-shaped #CC0000 clears at 5.89:1, so those
    // dollar figures do not move at all. It is the platform ORANGE that shifts.
    // And in DARK mode it is a no-op for every real palette, because `primary` is
    // already floored there at BRAND_ON_DARK_MIN_CONTRAST = 5.25 > 4.5.
    const accentShaped = deriveThemeTokens(
      resolveBrandingTheme({ primary_color: '#012854', secondary_color: '#CC0000' }), 'light'
    );
    assert.equal(accentShaped.primaryText, accentShaped.primary,
      'a brand colour that already clears the text floor must be returned unchanged');

    const platformDark = deriveThemeTokens(resolveBrandingTheme(null), 'dark');
    assert.equal(platformDark.primaryText, platformDark.primary,
      'dark mode should be a no-op — primary is already floored above the text floor there');
  });

  test('every derived primaryText is a valid #RRGGBB — which is why it is a render token', () => {
    for (const [, src] of BRANDS) {
      for (const mode of MODES) {
        const vars = themeCssVariables(deriveThemeTokens(resolveBrandingTheme(src), mode));
        assert.match(vars['--rm-primary-text'], /^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('Palette-1 T2 — the mirror drift guard', () => {
  test('[RED] both copies publish the same render token keys', () => {
    // The canonical copy is server/utils; src/ is the mirror. themeTokens.test.js
    // owns the full drift comparison — this case is the Palette-1 tripwire for the
    // three new keys specifically, so a half-applied mirror fails HERE with a
    // message naming Palette rather than in a generic diff.
    const mirrorSrc = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src', 'utils', 'themeTokens.mjs'), 'utf8'
    );
    // ⚠ THE LIST GROWS WITH THE ARC. Palette-4a added `primaryText` and Part B
    // added `onSecondary`; a new key not listed here is a key whose half-applied
    // mirror fails only in the generic diff, which is the message that used to
    // not say which copy had drifted.
    for (const key of ['recess', 'primaryDark', 'secondaryDark', 'primaryText', 'onSecondary']) {
      assert.ok(RENDER_TOKEN_KEYS.includes(key), `canonical copy is missing ${key}`);
      assert.ok(
        new RegExp(`'${key}'`).test(mirrorSrc),
        `MIRROR DRIFT: src/utils/themeTokens.mjs does not declare '${key}' — the two copies must move together`
      );
    }
  });
});

describe('Palette-1 T4 — gradient partners', () => {
  test('[RED] both partners derive for every brand and every mode, and clear the floor', () => {
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        for (const [base, partner] of [['primary', 'primaryDark'], ['secondary', 'secondaryDark']]) {
          const ratio = contrastRatio(t[base], t[partner]);
          assert.ok(
            ratio >= GRADIENT_PARTNER_MIN_CONTRAST,
            `${label}/${mode}: ${base} ${t[base]} -> ${partner} ${t[partner]} = ${ratio.toFixed(2)}:1, floor ${GRADIENT_PARTNER_MIN_CONTRAST}`
          );
        }
      }
    }
  });

  test('[RED] a partner is never equal to its base — a flat fill wearing gradient syntax', () => {
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        assert.notEqual(t.primary, t.primaryDark, `${label}/${mode}: primaryDark == primary`);
        assert.notEqual(t.secondary, t.secondaryDark, `${label}/${mode}: secondaryDark == secondary`);
      }
    }
  });

  test('⚠ a near-black base takes the LIGHTEN fallback — the branch is not dead code', () => {
    // A fixed lightness delta CLAMPS TO BLACK for an already-dark base, which is
    // why derivePartner tries the other direction. Measured: Beta's light-mode
    // secondary reaches #000000 under a fixed delta and stops separating.
    const t = deriveThemeTokens(
      { primaryColor: '#000000', secondaryColor: '#000000', backgroundColor: '#FFFFFF' }, 'light'
    );
    assert.ok(
      contrastRatio(t.secondary, t.secondaryDark) >= GRADIENT_PARTNER_MIN_CONTRAST,
      'a black base produced no usable partner'
    );
    assert.notEqual(t.secondaryDark, '#000000', 'the partner clamped to black instead of lightening');
  });

  test('every partner is a valid #RRGGBB — which is why they are render tokens', () => {
    for (const [, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        const vars = themeCssVariables(t); // throws on any non-hex
        assert.match(vars['--rm-primary-dark'], /^#[0-9A-Fa-f]{6}$/);
        assert.match(vars['--rm-secondary-dark'], /^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('Palette-1 T5b — the harness route is ABSENT from a production build', () => {
  test('[RED] a real production bundle contains neither the marker nor the component', () => {
    // ⚠ THIS RUNS THE REAL BUILD RATHER THAN ASSERTING ON SOURCE. A source-text
    // check would prove the guard is WRITTEN, not that it ELIMINATES — and
    // "unreachable in production" asserted from source is a mechanism reporting
    // health it cannot observe. Vite substitutes `false` for import.meta.env.DEV
    // in a production build and Rollup folds the branch away, so the correct
    // observation is of the emitted asset.
    const repo = path.resolve(__dirname, '..', '..');
    execFileSync('npm', ['run', 'build'], { cwd: repo, stdio: 'pipe', shell: true, timeout: 180000 });

    const assetsDir = path.join(repo, 'dist', 'assets');
    const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    // ⚠ NON-VACUITY: if the build emitted no JS this case would pass by reading
    // nothing, which is the exact failure shape it exists to prevent.
    assert.ok(files.length > 0, 'the production build emitted no JS assets to check');

    let sawAppCode = false;
    for (const f of files) {
      const text = fs.readFileSync(path.join(assetsDir, f), 'utf8');
      assert.ok(
        !text.includes('rm-palette-harness-route-dev-only'),
        `the harness marker SHIPPED in dist/assets/${f} — the DEV guard is not eliminating it`
      );
      assert.ok(
        !text.includes('PaletteHarnessRoute'),
        `PaletteHarnessRoute SHIPPED in dist/assets/${f}`
      );
      if (text.includes('Available Balance') || text.includes('Sign in to')) sawAppCode = true;
    }
    // ⚠ AND THE POSITIVE CONTROL: prove the bundle is actually THIS app. Without
    // it, an empty or wrong-project build would satisfy every assertion above.
    assert.ok(sawAppCode, 'the emitted bundle does not look like this app — the absence proves nothing');
  });
});
