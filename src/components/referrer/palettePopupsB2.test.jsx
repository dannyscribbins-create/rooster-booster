// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-11 B2 — the remaining five popups. This completes the referrer tree.
//
// T1  every site resolves to its ruled token
// T2  each popup RENDERS ITS CONTENT — ⚠ a blank modal passes every contrast
//     assertion, so the substantive element is asserted by name, with negatives
// T3  the money rule — ⚠ AnnouncementPopup broadcasts SOMEONE ELSE'S payout
// T4  no R. colour, no retired hex tone, no retired DECIMAL tone
// T5  ⚠ ContractorAboutModal's logo-else-name and its social row still hold
// T8  Palette-1's shortfall fences, unweakened
//
// ⚠ WHAT jsdom CANNOT SEE. It resolves no var(), so a declaration assertion
// proves the token NAME reached the element and nothing about what it paints.
// Mounted-vs-fallback is the browser harness's half. ⚠ AND B1 PROVED A THIRD GAP
// NEITHER COVERS: a value that is not a colour at all. Four checks passed while
// five icons rendered black, because every one of them assumes a colour is
// present and measures its properties. `themeKeyIntegrity` now fences that.
//
// ⚠ THE GROUNDS, ESTABLISHED BEFORE ANY TOKEN WAS RULED (M.2). Modals change
// grounds by construction and this set changes them more than B1's did:
//     AnnouncementPopup      scrim -> card `surface`
//     BadgeCelebrationPopup  scrim -> card `surface`
//     PendingMatchPopup      scrim -> card `surface`
//     BookingFormModal       scrim -> ⚠ DARK PANEL on `secondary`
//     ContractorAboutModal   scrim -> ⚠ DARK PANEL on `secondary`
// ⚠ TWO OF THE FIVE ARE DARK PANELS, so their text is `onSecondary`, not `text`.
// A token floored against `surface` is not safe there — that pairing has been
// hand-caught in three consecutive phases.
//
// ⚠ CASE COUNT IS COUNTED WITH grep, NOT ESTIMATED. See the phase report.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio, RENDER_TOKEN_KEYS } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import AnnouncementPopup from './AnnouncementPopup';
import BadgeCelebrationPopup from './BadgeCelebrationPopup';
import PendingMatchPopup from './PendingMatchPopup';

const SRC = path.resolve(process.cwd(), 'src');
const read = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');

const RAW = {
  AnnouncementPopup: read('components/referrer/AnnouncementPopup.jsx'),
  BadgeCelebrationPopup: read('components/referrer/BadgeCelebrationPopup.jsx'),
  BookingFormModal: read('components/referrer/BookingFormModal.jsx'),
  PendingMatchPopup: read('components/referrer/PendingMatchPopup.jsx'),
  ContractorAboutModal: read('components/referrer/ContractorAboutModal.jsx'),
};

const TEXT_FLOOR = 4.5;
const GRAPHIC_FLOOR = 3;
const MUTED = 0.72;

const BRANDS = [
  ['Gamma (UNSET)', null],
  ['Alpha', { primary_color: '#1C2D4D', secondary_color: '#F26A1B' }],
  ['Beta', { primary_color: '#0B3D3B', secondary_color: '#C2185B' }],
  ['Accent-shaped', { primary_color: '#012854', secondary_color: '#CC0000' }],
];
const MODES = ['light', 'dark'];
function eachBrandMode(fn) {
  for (const [label, src] of BRANDS) {
    for (const mode of MODES) fn(label, mode, deriveThemeTokens(resolveBrandingTheme(src), mode));
  }
}

function codeOnly(text) {
  const out = [];
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (inBlock) { if (t.includes('*/')) inBlock = false; continue; }
    if (t.startsWith('/*') || t.startsWith('{/*')) { if (!t.includes('*/')) inBlock = true; continue; }
    if (t.startsWith('//') || t.startsWith('*')) continue;
    out.push(line);
  }
  return out.join('\n');
}
const CODE = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, codeOnly(v)]));
const FILES = Object.entries(CODE);
const LIGHT_PANEL = ['AnnouncementPopup', 'BadgeCelebrationPopup', 'PendingMatchPopup'];
const DARK_PANEL = ['BookingFormModal', 'ContractorAboutModal'];

const px = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function composite(hex, ground, alpha) {
  const f = px(hex), b = px(ground);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

// ── T1 — THE TOKENS ────────────────────────────────────────────────────────
describe('Palette-11 B2 T1 — every site resolves to its ruled token', () => {
  it('[RED] every file declares the render tokens it uses', () => {
    for (const [name, code] of FILES) {
      expect(code, `${name} declares no render token at all`).toMatch(/var\(--rm-/);
    }
  });

  it('[RED] the three LIGHT panels ground on `surface`', () => {
    for (const name of LIGHT_PANEL) {
      expect(CODE[name], `${name}'s card left \`surface\``).toContain('var(--rm-surface,');
    }
  });

  it('[RED] the two DARK panels ground on `secondary` and take `onSecondary`', () => {
    // ⚠ THE DARK PANEL IS THE HIGH-RISK CASE. Its text cannot be `--rm-text`,
    // which is floored against `surface` and `recess`; it must be the tone
    // derived FOR that fill. Measured worst 6.71:1 across brands and modes.
    for (const name of DARK_PANEL) {
      expect(CODE[name], `${name}'s panel left \`secondary\``).toContain('var(--rm-secondary,');
      expect(CODE[name], `${name}'s panel text left \`onSecondary\``)
        .toContain('var(--rm-on-secondary,');
    }
  });

  it('[RED] the dark-panel text pair clears the text floor, every brand and mode', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.onSecondary, t.secondary);
      expect(r, `${label}/${mode}: dark-panel body text is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] the light-panel body text clears the floor, every brand and mode', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.text, t.surface);
      expect(r, `${label}/${mode}: light-panel body text is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] muted text clears the floor at the existing idiom on `surface`', () => {
    eachBrandMode((label, mode, t) => {
      const c = composite(t.text, t.surface, MUTED);
      const r = contrastRatio(c, t.surface);
      expect(r, `${label}/${mode}: muted text is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] a fill takes the brand token and its label the ON tone — no bare white', () => {
    // ⚠ `onPrimary` is DERIVED and is BLACK on the platform brand. A hardcoded
    // white label on a derived fill is a defect waiting for a light brand.
    for (const [name, code] of FILES) {
      expect(code, `${name} still hardcodes a white label`).not.toMatch(/color: ['"]#fff['"]/i);
    }
  });

  it('[RED] every fill/label pair clears the text floor, every brand and mode', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.onPrimary, t.primary);
      expect(r, `${label}/${mode}: a CTA label is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] non-colour goes through the side channel', () => {
    for (const [name, code] of FILES) {
      if (/boxShadow/.test(code)) {
        expect(code, `${name} declares a shadow outside the side channel`)
          .toMatch(/elevationVar\('(shadow|shadowMd|shadowLg)'\)/);
      }
    }
  });

  it('[RED] the muted idiom is the EXISTING one, and no second one appears', () => {
    for (const [name, code] of FILES) {
      const opacities = [...code.matchAll(/opacity:\s*(0\.\d+)/g)].map((m) => m[1]);
      for (const o of opacities) {
        expect(['0.72', '0.5', '0.6', '0.4', '0.35', '0.3', '0.1'],
          `${name} invented a muting opacity ${o}`).toContain(o);
      }
    }
  });
});

// ── T2 — THEY RENDER ───────────────────────────────────────────────────────
describe('Palette-11 B2 T2 — each popup renders its content', () => {
  it('[RED] AnnouncementPopup renders the broadcast amount and name', () => {
    // ⚠ THE PROP IS `onDismiss`, NOT `onClose` — checked against the component
    // rather than assumed, because a wrong prop name renders fine and fails only
    // when the button is pressed.
    render(<AnnouncementPopup
      announcement={{ id: 1, amount: 250, referredName: 'Riley Chen' }}
      referrerFirstName="Beta"
      settings={{ enabled: true, mode: 'preset_1', custom_message: null }}
      onDismiss={() => {}} />);
    // ⚠ `getByText(/Riley Chen/)` THREW ON MULTIPLE MATCHES — the name appears
    // twice in the rendered copy. That is the multiple-match trap, and the fix is
    // to anchor rather than to loosen: assert the COUNT explicitly so a third
    // occurrence is a failure rather than a silent pass.
    expect(screen.getAllByText(/Riley Chen/).length,
      'the broadcast should name the other person exactly twice').toBe(2);
    expect(screen.getAllByText(/250/).length,
      'the broadcast amount is missing').toBeGreaterThan(0);
  });

  it('[RED] BadgeCelebrationPopup renders the earned badge', () => {
    render(<BadgeCelebrationPopup
      badges={[{ id: 'first_referral', name: 'First Referral', emoji: '⭐',
        description: 'You made your first referral.' }]}
      onDismiss={() => {}} />);
    expect(screen.getByText('First Referral')).toBeTruthy();
  });

  it('[RED] PendingMatchPopup renders the matched client', () => {
    render(<PendingMatchPopup
      match={{ id: 1, client_name: 'Jordan Blake', referred_by_name: 'Beta Homeowner' }}
      onDismiss={() => {}} token="t" />);
    expect(screen.getByText(/Jordan Blake/)).toBeTruthy();
  });

  it('[RED] and BadgeCelebrationPopup renders NOTHING with no badges', () => {
    // ⚠ THE NEGATIVE HALF. Without it the positive would pass on a component
    // that always renders its shell and never actually opened.
    const { container } = render(<BadgeCelebrationPopup badges={[]} onDismiss={() => {}} />);
    expect(container.firstChild, 'an empty celebration still rendered').toBeNull();
  });
});

// ── T3 — THE MONEY RULE ────────────────────────────────────────────────────
describe('Palette-11 B2 T3 — other peoples money is the text tone', () => {
  it('[RED] AnnouncementPopup does NOT wear the money tone', () => {
    // ⚠ IT BROADCASTS SOMEONE ELSE'S PAYOUT. The money rule covers money IN THE
    // ACCOUNT; another person's cashout is not the reader's money and takes the
    // text tone, exactly as projections and teasers do.
    expect(CODE.AnnouncementPopup, 'the broadcast acquired the money tone')
      .not.toContain('--rm-primary-text');
  });

  it('[RED] GUARD-PROOF — the needle sees the money tone if it appears', () => {
    const injected = "color: 'var(--rm-primary-text, #B1480A)'";
    expect(injected.includes('--rm-primary-text'),
      'the needle cannot see an injected money tone').toBe(true);
    expect(CODE.AnnouncementPopup.includes('--rm-primary-text'),
      'baseline: the file is clean').toBe(false);
  });

  it('[RED] no B2 surface renders an account figure at all', () => {
    for (const [name, code] of FILES) {
      expect(code, `${name} renders a balance-like figure`)
        .not.toMatch(/\$\{[^}]*\bbalance\b/i);
    }
  });
});

// ── T4 — NO R COLOUR, NO RETIRED TONE IN EITHER SPELLING ───────────────────
describe('Palette-11 B2 T4 — no R colour, no retired tone', () => {
  const COLOUR_KEYS = ['navy', 'red', 'redDark', 'green', 'greenBg', 'greenText', 'bgPage',
    'bgCard', 'border', 'borderMed', 'textPrimary', 'textSecondary', 'textMuted',
    'shadow', 'shadowLg'];

  it('[RED] no R.* COLOUR key is read in any of the five', () => {
    for (const [name, code] of FILES) {
      const survivors = COLOUR_KEYS.filter((k) => new RegExp('\\bR\\.' + k + '\\b').test(code));
      expect(survivors, `${name} still reads: ${survivors.join(', ')}`).toEqual([]);
    }
  });

  it('[RED] the non-colour R keys survive — the split is the point', () => {
    for (const [name, code] of FILES) {
      expect(code, `${name} lost its fonts`).toMatch(/R\.font(Body|Sans|Mono)/);
    }
  });

  it('[RED] no retired tone survives as a HEX', () => {
    for (const [name, code] of FILES) {
      for (const hex of ['#012854', '#CC0000', '#D3E3F0']) {
        expect(code.toUpperCase(), `${name}: ${hex} survives`).not.toContain(hex);
      }
    }
  });

  it('[RED] and none survives as a DECIMAL — the needle that keeps out-finding hex', () => {
    // ⚠ THREE OF THESE WERE IN `AnnouncementPopup` ALONE, INVISIBLE TO HEX:
    // two scrim/shadow layers on rgba(1,40,84,…) and one on rgba(204,0,0,…).
    // The decimal needle has out-found the hex one in four phases now.
    for (const [name, code] of FILES) {
      const flat = code.replace(/\s+/g, '');
      for (const dec of ['1,40,84', '204,0,0', '211,227,240']) {
        expect(flat, `${name}: rgba(${dec}) survives`).not.toContain(dec);
      }
    }
  });

  it('[RED] GUARD-PROOF — all three needles fire on their own injected form', () => {
    expect("color: '#012854'".toUpperCase().includes('#012854')).toBe(true);
    expect('background: rgba(1, 40, 84, 0.85)'.replace(/\s+/g, '').includes('1,40,84')).toBe(true);
    expect(/\bR\.navy\b/.test('color: R.navy')).toBe(true);
    // ⚠ AND THE PREFIX TRAP, which a bare substring needle fails
    expect(/\bR\.red\b/.test('R.redDark'), 'prefix trap: red must not match redDark').toBe(false);
    expect(/\bR\.green\b/.test('R.greenBg'), 'prefix trap').toBe(false);
  });
});

// ── T5 — WHAT B2 MUST NOT DISTURB ──────────────────────────────────────────
describe('Palette-11 B2 T5 — ContractorAboutModals prior rulings still hold', () => {
  it('[RED] the logo-else-company-name branch is intact, BOTH directions', () => {
    // ⚠ BR-1's A2 prong. Asserted in both directions because a component that
    // always renders the name would pass a one-sided check.
    expect(CODE.ContractorAboutModal, 'the logo branch is gone')
      .toContain('branding.logoUrl ?');
    expect(CODE.ContractorAboutModal, 'the name fallback is gone')
      .toContain("branding.companyName || 'Your Contractor'");
  });

  it('[RED] the social row and its accessibility affordances are intact', () => {
    // ⚠ BR-2. The per-link aria-label names the CONTRACTOR, and `House` stands
    // in for Nextdoor because the admin editor labels that field with a house.
    expect(CODE.ContractorAboutModal, 'the socials presence check is gone')
      .toContain('branding.socials &&');
    expect(CODE.ContractorAboutModal, 'the socials hook is gone')
      .toContain('data-rm-socials');
    expect(CODE.ContractorAboutModal, 'the per-link aria-label is gone')
      .toContain('aria-label={`${contractorName} on ${label}`}');
    expect(CODE.ContractorAboutModal, 'the Nextdoor stand-in glyph is gone')
      .toContain('nextdoor:  House');
  });

  it('[RED] GUARD-PROOF — these needles would notice their own removal', () => {
    const stripped = CODE.ContractorAboutModal.replace('data-rm-socials', 'data-removed');
    expect(stripped.includes('data-rm-socials'),
      'the needle cannot see the social row being removed').toBe(false);
    expect(CODE.ContractorAboutModal.includes('data-rm-socials'),
      'baseline: the social row is present').toBe(true);
  });
});

// ── T8 — PALETTE-1'S FENCES ────────────────────────────────────────────────
describe('Palette-11 B2 T8 — Palette-1s shortfall fences are not weakened', () => {
  it('[RED] recess/surface separation stays BELOW 3:1 by design', () => {
    eachBrandMode((label, mode, t) => {
      const sep = contrastRatio(t.recess, t.surface);
      expect(sep, `${label}/${mode}: recess/surface now clears 3:1 — update the ruling`)
        .toBeLessThan(GRAPHIC_FLOOR);
      expect(sep, `${label}/${mode}: recess collapsed onto surface`).toBeGreaterThan(1.0);
    });
  });

  it('[RED] every render token still derives to a valid hex', () => {
    eachBrandMode((label, mode, t) => {
      for (const k of RENDER_TOKEN_KEYS) {
        expect(t[k], `${label}/${mode}: ${k} is not a hex`).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });

  it('[RED] the status palettes keep their re-floored values', () => {
    expect(STATUS_LIGHT.successText).toBe('#137639');
    expect(STATUS_DARK.successText).toBe('#7DD3AA');
  });
});
