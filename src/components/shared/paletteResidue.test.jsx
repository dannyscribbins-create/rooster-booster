// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-14 — THE RESIDUE, AND WHAT IS CORRECTLY LITERAL
//
// The last Palette phase. What it fences is not "no raw colours" — that would be
// false, and making it true would be wrong. This arc has ruled three times that
// a value is CORRECT as a literal:
//
//   SCRIM        dims what is BEHIND a modal. Not a themed ground; a brand-
//                coloured scrim paints a wash over the thing it should recede.
//   STATUS       STATUS_CONFIG's seven-state PIPELINE vocabulary is not brand
//                semantics — `lead` and `inspection` have no danger/success
//                meaning, and forcing them into the render set would be wrong.
//   DECORATIVE   medal golds, confetti, a review star. Meaning that is not the
//                contractor's, so it must not move when their brand does.
//
// ⚠ SO THIS IS A BASELINE NAMING WHAT STAYS, NOT A ZERO-ASSERTION. It fails when
// the count GROWS — a new unclassified literal — and it also fails when a named
// file stops carrying one, so the list shrinks as work lands rather than rotting
// into a permanent allowance.
//
// ⚠ AND IT READS CODE, NOT COMMENTS. A draft of this phase's own census counted
// continuation lines inside `{/* */}` blocks and over-reported by 15, inventing
// findings in LockedSection and ProfileTab that were records of retired reads.
// Block comments are BLANKED line-by-line here, preserving line numbers.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');
const TREES = ['referrer', 'shared', 'auth', 'rep'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

const blankComments = (src) => src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split(/\r?\n/)
  .map((l) => (/^\s*\/\//.test(l) ? '' : l.replace(/\/\/[^\n'"`]*$/, '')))
  .join('\n');

const FILES = TREES.flatMap((t) => walk(path.join(SRC, 'components', t)))
  .map((f) => [path.relative(path.join(SRC, 'components'), f).split(path.sep).join('/'),
    blankComments(fs.readFileSync(f, 'utf8'))]);

// ── RETIRED TONES — three spellings ─────────────────────────────────────────
// ⚠ THE DECIMAL NEEDLE HAS OUT-FOUND THE HEX ONE IN FOUR CONSECUTIVE PHASES, and
// a KEY whose VALUE is the tone is a third route that neither sees.
const RETIRED = [
  ['#012854', [1, 40, 84]],
  ['#CC0000', [204, 0, 0]],
  ['#8C0000', [140, 0, 0]],
  ['#D3E3F0', [211, 227, 240]],
];
const RETIRED_KEYS = ['navy', 'navyDark', 'red', 'redDark', 'blueLight'];

function retiredReaches(code) {
  const hits = [];
  for (const [hex, [r, g, b]] of RETIRED) {
    if (new RegExp(hex, 'i').test(code)) hits.push('hex ' + hex);
    if (new RegExp('rgba?\\(\\s*' + r + '\\s*,\\s*' + g + '\\s*,\\s*' + b + '\\b').test(code)) hits.push('decimal ' + hex);
  }
  for (const k of RETIRED_KEYS) {
    if (new RegExp('\\bR\\.' + k + '\\b').test(code)) hits.push('key R.' + k);
  }
  return hits;
}

// ⚠ THE BASELINE. Measured 2026-09-15. Every entry is a file that legitimately
// still reaches a retired tone, with the reason — NOT a backlog.
const RETIRED_BASELINE = Object.freeze({
  // D-G's deliberate var() fallback. The admin tree mounts no --rm-*, so this
  // literal is what paints there; re-pointing it in the same pass that moved the
  // mount tree is how a deliberate fallback becomes an accidental one. Filed.
  'shared/LockedSection.jsx': ['hex #012854'],
  // ⚠ NOT RESIDUE — TWO SCREENS THAT WERE NEVER COLOUR-MIGRATED AT ALL. Their
  // five siblings in auth/ are migrated and carry none of this. Migrating these
  // is a phase with its own blast radius across signup and email verification,
  // not a cleanup, and it is filed as such.
  'auth/EmailVerifyScreen.jsx': ['hex/decimal/keys — unmigrated screen'],
  'auth/SignupScreen.jsx': ['hex/decimal/keys — unmigrated screen'],
});

describe('T3 — retired tones in the four in-scope trees', () => {
  it('the file set is real — otherwise every assertion here is free', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(44);
    for (const t of TREES) expect(FILES.some(([f]) => f.startsWith(t + '/')), `${t} contributed nothing`).toBe(true);
  });

  it('the needles find a planted tone and spare a near-miss', () => {
    // ⚠ BOTH DIRECTIONS. A needle that cannot match makes every assertion below
    // permanently satisfied, watching nothing.
    expect(retiredReaches("color: '#012854'")).toContain('hex #012854');
    expect(retiredReaches("boxShadow: '0 4px 14px rgba(1,40,84,0.35)'")).toContain('decimal #012854');
    expect(retiredReaches('background: R.navy')).toContain('key R.navy');
    expect(retiredReaches("color: '#012855'")).toEqual([]);      // one digit off
    expect(retiredReaches("color: 'rgba(1,40,85,0.35)'")).toEqual([]);
    expect(retiredReaches("color: '#1C2D4D'")).toEqual([]);      // the PLATFORM navy
  });

  it('no file outside the baseline reaches a retired tone', () => {
    const offenders = FILES
      .map(([f, code]) => [f, retiredReaches(code)])
      .filter(([f, hits]) => hits.length && !RETIRED_BASELINE[f]);
    expect(offenders.map(([f, h]) => f + ' -> ' + h.join(', '))).toEqual([]);
  });

  it('the baseline shrinks rather than rotting — a repaired file must leave it', () => {
    const stillListed = Object.keys(RETIRED_BASELINE).filter((f) => {
      const entry = FILES.find(([n]) => n === f);
      return entry && retiredReaches(entry[1]).length === 0;
    });
    expect(stillListed).toEqual([]);
  });
});

describe('T2 — the residue, and what is correctly literal', () => {
  // Files that legitimately carry raw colour, with the ruling that permits it.
  const LITERAL_BASELINE = Object.freeze({
    'referrer/AnnouncementPopup.jsx': 'scrim',
    'referrer/BadgeCelebrationPopup.jsx': 'scrim',
    'referrer/BookingFormModal.jsx': 'alpha-on-brand + scrim + error-on-brand-fill',
    'referrer/CashOutTab.jsx': 'alpha-on-brand + status + on-colour',
    'referrer/ContractorAboutModal.jsx': 'alpha-on-brand on a branded dark header + decorative star',
    'referrer/DashboardTab.jsx': 'scrim + decorative star + shadow',
    'referrer/ExperiencePopup.jsx': 'scrim + shadow + on-colour',
    'referrer/ManageAccount.jsx': 'scrim + shadow + on-colour',
    'referrer/MissingReferralModal.jsx': 'scrim',
    'referrer/PendingMatchPopup.jsx': 'decorative confetti + scrim',
    'referrer/ProfileTab.jsx': 'shadow + error-on-brand-fill',
    'referrer/RankingsTab.jsx': 'decorative medals',
    'referrer/ReferrerApp.jsx': 'shadow',
    'shared/AvatarCircle.jsx': 'on-colour + shadow',
    'shared/ContactModal.jsx': 'scrim',
    'shared/ErrorBoundary.jsx': 'renders outside the tree — literals are the honest choice',
    // ⚠ LockedSection IS DELIBERATELY ABSENT AND THE SHRINK-CHECK IS WHY.
    // A draft listed it here; its only retired value lives inside a
    // `var(--rm-bg, #012854)` FALLBACK, which the var() stripper removes, so it
    // carries no raw literal and the list must not claim it does. It stays in
    // RETIRED_BASELINE above, where the needle does not strip fallbacks —
    // the two lists ask different questions of the same file.
    'shared/Skeleton.jsx': 'neutral-alpha fill',
    'shared/SurfaceSwitcher.jsx': 'alpha-on-brand',
    'auth/ChoiceScreen.jsx': 'shadow',
    'auth/EmailVerifyScreen.jsx': 'unmigrated screen',
    'auth/FrozenAccountScreen.jsx': 'shadow',
    'auth/LoginScreen.jsx': 'shadow + neutral-alpha border',
    'auth/ResetPinScreen.jsx': 'shadow + neutral-alpha border',
    'auth/SignupScreen.jsx': 'unmigrated screen',
    'auth/TeamAccessRevokedScreen.jsx': 'shadow',
  });

  const HEX = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g;
  const RGBA = /rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/g;
  const stripVar = (s) => s.replace(/var\(\s*--[\w-]+\s*,[^)]*\)/g, 'var(--X)');
  const rawCount = (code) => {
    const c = stripVar(code);
    return (c.match(HEX) || []).length + (c.match(RGBA) || []).length;
  };

  it('no file outside the baseline carries a raw colour literal', () => {
    const offenders = FILES
      .filter(([f, code]) => rawCount(code) > 0 && !LITERAL_BASELINE[f])
      .map(([f, code]) => f + ' (' + rawCount(code) + ')');
    expect(offenders).toEqual([]);
  });

  it('the baseline shrinks — a file with no literal left must leave the list', () => {
    const stale = Object.keys(LITERAL_BASELINE).filter((f) => {
      const entry = FILES.find(([n]) => n === f);
      return entry && rawCount(entry[1]) === 0;
    });
    expect(stale).toEqual([]);
  });

  it('the var() stripper works — otherwise every declared fallback counts as residue', () => {
    // Non-vacuity for rawCount: without this, a tree full of correct
    // var(--rm-x, #FFFFFF) declarations would read as hundreds of literals.
    expect(rawCount("color: 'var(--rm-text, #1C2D4D)'")).toBe(0);
    expect(rawCount("color: '#1C2D4D'")).toBe(1);
  });

  it('and the trees still declare tokens — absence is satisfied by emptying them', () => {
    const declaring = FILES.filter(([, code]) => /var\(--rm-/.test(code));
    expect(declaring.length).toBeGreaterThanOrEqual(30);
  });
});
