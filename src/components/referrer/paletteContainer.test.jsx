// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-2 — THE CONTAINER
//
// The first migration phase. `Screen.jsx`'s column ground and body text, and
// `ReferrerApp.jsx`'s full-width wrapper.
//
// ⚠ THE TWO FILES ARE ONE EDIT. Both painted `R.bgPage`, and `ReferrerApp`'s
// wrapper is what covers the body background edge-to-edge behind the 430px
// column. Migrating one alone is what would CREATE the desktop gutter seam the
// record wrongly describes as already existing. T2 is that fence.
//
// ── ⚠ WHAT THESE TESTS CAN AND CANNOT SEE, SAID UP FRONT ───────────────────
// jsdom does not resolve var(). So every assertion here is DECLARATION-level:
// it can prove a site names the right custom property with the right fallback,
// and it CANNOT prove the property was mounted. That distinction is the R-1
// defect class, so it is not left to a test that cannot see it — the
// mounted-vs-fallback verification is the browser harness (scripts/paletteHarness.js),
// run against the real app on the seeded stack, and its result is in the commit
// body. These tests fence the half they can actually observe.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { deriveThemeTokens } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import Screen from '../shared/Screen';
import ReferrerApp from './ReferrerApp';
import DashboardTab from './DashboardTab';
import ProfileTab from './ProfileTab';
import CashOutTab from './CashOutTab';
import RankingsTab from './RankingsTab';
import ReferAFriendTab from './ReferAFriendTab';

const SRC = path.resolve(process.cwd(), 'src');
const readSrc = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');

// ⚠ COMMENTS ARE STRIPPED FOR THE CODE-LEVEL ASSERTIONS, AND THAT IS *NOT* THE
// COMMENTS-ARE-EXEMPT CARVE-OUT CLAUDE.md FORBIDS. The distinction is what the
// sweep is ASKING:
//   · themeKeyIntegrity.test.js asks "does this NAME appear anywhere a reader
//     could copy from" — prose included, deliberately, because a mistyped token
//     in a comment is exactly what gets pasted into code. It keeps no carve-out
//     and it has already fired on prose twice, correctly.
//   · These cases ask "does this file still READ R.* / declare --rm-bg". A
//     comment explaining WHY the ground is not --rm-bg is not a read, and a
//     migration check that cannot mention the token it rejected would have to
//     choose between an unexplained edit and a red suite.
// Split on \r?\n as a REGEX (written here as an escape, not a raw byte).
// `.` does not match a carriage return, and core.autocrlf=true is the Windows
// default, so a tracked LF file is CRLF in the working tree.
// ⚠ THIS FUNCTION WAS BRIEFLY BROKEN BY A HEREDOC THAT ATE THE BACKSLASHES,
// turning the escapes into literal CR and LF bytes and making this module fail
// to load. The run then reported "5 passed" while THIS FILE CONTRIBUTED ZERO —
// the module-load signature CLAUDE.md records. Regex-bearing code goes in a
// file, never through a shell heredoc.
function codeOnly(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

// The platform-default values these declarations must fall back to. Derived,
// never typed — a hand-copied hex is how a fallback drifts from its mount.
const PLATFORM = deriveThemeTokens(resolveBrandingTheme(null), 'light');

// ── THE `R.` NEEDLE, VALIDATED BEFORE USE ───────────────────────────────────
// ⚠ CLAUDE.md records a `\.` that reached a script as `.` and returned 80
// plausible, ordered, file-attributed findings against a true answer of 7. A
// sweep is a TOOL REPORT until its pattern has been checked against a case whose
// answer is already known.
const R_REF = /(^|[^A-Za-z0-9_.])R\.([a-zA-Z][A-Za-z0-9_]*)/g;

function rRefs(text) {
  const out = [];
  R_REF.lastIndex = 0;
  let m;
  while ((m = R_REF.exec(text)) !== null) {
    out.push(m[2]);
    R_REF.lastIndex = m.index + m[0].length;
  }
  return out;
}

describe('Palette-2 — the R. needle is validated against a known answer first', () => {
  it('matches exactly the five it should, and none of the four it should not', () => {
    const fixture = [
      'const a = R.textPrimary;',      // 1
      'const b = { c: R.navy };',      // 2
      'const c = `${R.fontBody}`;',    // 3
      'const d = [R.red, R.green];',   // 4, 5
      'const e = AD.textPrimary;',     // must NOT match
      'const f = foo.R.bar;',          // must NOT match
      'const g = BAR.navy;',           // must NOT match
      'const h = REGISTER.thing;',     // must NOT match
    ].join('\n');
    expect(rRefs(fixture)).toEqual(['textPrimary', 'navy', 'fontBody', 'red', 'green']);
  });
});

// ── T1 — EACH SITE DECLARES ITS RULED TOKEN, WITH THE MOUNTED VALUE AS FALLBACK
describe('Palette-2 T1 — the five sites carry their ruled token', () => {
  const screenSrc = () => codeOnly(readSrc('components/shared/Screen.jsx'));
  const appSrc = () => codeOnly(readSrc('components/referrer/ReferrerApp.jsx'));

  it('[RED] Screen\'s column ground is --rm-recess, not --rm-bg', () => {
    // ⚠ RULED recess, NOT bg, AND THE MEASUREMENT IS WHY. For an unset
    // contractor --rm-bg is #FFFFFF and cards are #FFFFFF, so a `bg` ruling puts
    // the ground at 1.00:1 against every card — the app flattens to one white
    // sheet the moment this ships. --rm-recess is #ECF0F8 and lands at 1.14:1,
    // which is what R.bgPage already paints (1.12:1).
    expect(screenSrc()).toMatch(/background:\s*'var\(--rm-recess,\s*#ECF0F8\)'/);
    expect(screenSrc()).not.toMatch(/--rm-bg/);
  });

  it('[RED] Screen\'s body text is --rm-text', () => {
    expect(screenSrc()).toMatch(/color:\s*'var\(--rm-text,\s*#1C2D4D\)'/);
  });

  it('[RED] ReferrerApp\'s full-width wrapper is --rm-recess', () => {
    expect(appSrc()).toMatch(/background:\s*'var\(--rm-recess,\s*#ECF0F8\)'/);
  });

  it('[RED] every declared fallback IS the value that mounts for the platform default', () => {
    // ⚠ THE TINT-IS-NOT-A-FILL CLAUSE, ASSERTED RATHER THAN TRUSTED. A fallback
    // that merely looks plausible is R-1's defect: var(--rm-danger, #FEE2E2)
    // measured 5.30:1 and painted 1.34:1. themeKeyIntegrity.test.js enforces this
    // across all of src/; this case pins THESE sites against the derivation so a
    // failure names the container rather than arriving as a generic sweep hit.
    expect(PLATFORM.recess).toBe('#ECF0F8');
    expect(PLATFORM.text).toBe('#1C2D4D');
    for (const src of [screenSrc(), appSrc()]) {
      for (const [, prop, fallback] of src.matchAll(/var\((--rm-[a-z-]+),\s*(#[0-9A-Fa-f]{6})\)/g)) {
        const key = { '--rm-recess': 'recess', '--rm-text': 'text' }[prop];
        expect(key, `unexpected custom property ${prop} in the container`).toBeTruthy();
        expect(fallback.toUpperCase(), `${prop} falls back to ${fallback}`).toBe(PLATFORM[key].toUpperCase());
      }
    }
  });
});

// ── T2 — THE SEAM FENCE ─────────────────────────────────────────────────────
describe('Palette-2 T2 — the two grounds paint the SAME value', () => {
  it('[RED] Screen and ReferrerApp\'s wrapper declare an identical background', () => {
    // ⚠ THIS IS THE WHOLE REASON THE TWO FILES ARE ONE EDIT. ReferrerApp's
    // wrapper is full-width and covers the body ground; Screen is the 430px
    // column inside it. While they paint the same value there is no desktop
    // gutter seam. If they ever diverge, one appears — and it would appear only
    // at wide viewports, which is exactly where nobody looks.
    const pick = (src) => {
      const m = /background:\s*('var\(--rm-[a-z-]+,\s*#[0-9A-Fa-f]{6}\)')/.exec(src);
      if (!m) throw new Error('no themed background declaration found — the file did not migrate');
      return m[1];
    };
    const a = pick(codeOnly(readSrc('components/shared/Screen.jsx')));
    const b = pick(codeOnly(readSrc('components/referrer/ReferrerApp.jsx')));
    expect(a, 'the column ground and the full-width wrapper have diverged — a desktop gutter seam').toBe(b);
  });
});

// ── T3 — NO R. IN THE MIGRATED DECLARATIONS, AND THE FILES STILL RUN ────────
describe('Palette-2 T3 — what remains of R., enumerated rather than assumed', () => {
  it('[RED] Screen keeps only its font reference — every colour is migrated', () => {
    // ⚠ NOT "no R. remains". Fonts are explicitly out of this phase, so
    // R.fontBody stays and the honest assertion is the EXACT remaining set. A
    // blanket "no R." here would have to be either false or a licence to migrate
    // something this phase was told not to touch.
    expect(rRefs(codeOnly(readSrc('components/shared/Screen.jsx')))).toEqual(['fontBody']);
  });

  it('[RED] ReferrerApp keeps only its bottom-nav references', () => {
    // The bottom nav is not the wrapper and is not in scope. Enumerated so the
    // next phase inherits a list rather than a guess.
    expect(rRefs(codeOnly(readSrc('components/referrer/ReferrerApp.jsx'))).sort())
      .toEqual(['bgCard', 'fontMono', 'red', 'red']);
  });

  it('[RED] and both files still RENDER — a sweep proves absence, not liveness', () => {
    // ⚠ CLAUDE.md's shape 6: AnnouncementPopup threw a ReferenceError on every
    // render while its literal sweep passed. A file that no longer runs satisfies
    // the two assertions above perfectly.
    const { container } = render(<Screen><p>child</p></Screen>);
    const root = container.firstElementChild;
    expect(root.style.maxWidth).toBe('430px');
    expect(root.style.background).toBe('var(--rm-recess, #ECF0F8)');
    expect(screen.getByText('child')).toBeTruthy();
  });
});

// ── T4 — THE FIVE IMPORTERS ─────────────────────────────────────────────────
describe('Palette-2 T4 — every importer of Screen still renders', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  // ⚠ THE DOUBLE THROWS ON A SHAPE IT DOES NOT RECOGNISE. A permissive stub that
  // can also answer "no data" is indistinguishable from a component that failed
  // to ask — the trap the BR arc hit three times.
  function installFetch() {
    vi.stubGlobal('fetch', async (url) => {
      if (typeof url !== 'string' && !(url instanceof URL)) {
        throw new Error(`fetch double: unexpected url shape ${Object.prototype.toString.call(url)}`);
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
  }

  const CASES = [
    ['DashboardTab', () => <DashboardTab setTab={() => {}} pipeline={[]} loading={false} userName="A" balance={0} paidCount={0} sessionToken="t" />],
    ['ProfileTab', () => <ProfileTab onLogout={() => {}} pipeline={[]} loading={false} userName="A" userEmail="a@b.co" onNameUpdate={() => {}} setProfilePhoto={() => {}} onResetHighlight={() => {}} refreshBankStatus={() => {}} onResetOpenManageAccount={() => {}} />],
    ['CashOutTab', () => <CashOutTab pipeline={[]} loading={false} userName="A" userEmail="a@b.co" setTab={() => {}} token="t" />],
    ['RankingsTab', () => <RankingsTab token="t" />],
    ['ReferAFriendTab', () => <ReferAFriendTab userName="A" token="t" />],
  ];

  for (const [name, mk] of CASES) {
    it(`[RED] ${name} renders and its Screen carries the migrated ground`, () => {
      installFetch();
      const { container } = render(mk());
      // ⚠ ANCHORED ON THE COLUMN'S OWN STRUCTURE, not on copy. Screen is the only
      // element in the tree with maxWidth 430px, and a needle made of rendered
      // text breaks when the copy is improved.
      const col = [...container.querySelectorAll('div')].find((d) => d.style.maxWidth === '430px');
      expect(col, `${name} did not render a Screen column`).toBeTruthy();
      expect(col.style.background).toBe('var(--rm-recess, #ECF0F8)');
    });
  }
});

// ── T2b — THE WRAPPER RENDERS TOO ───────────────────────────────────────────
describe('Palette-2 — ReferrerApp\'s wrapper renders the migrated ground', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('[RED] the full-width wrapper is present and carries --rm-recess', () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const { container } = render(
      <ReferrerApp onLogout={() => {}} userName="A" userEmail="a@b.co" onNameUpdate={() => {}} />
    );
    const wrapper = [...container.querySelectorAll('div')]
      .find((d) => d.style.minHeight === '100vh' && d.style.background);
    expect(wrapper, 'ReferrerApp rendered no full-width wrapper').toBeTruthy();
    expect(wrapper.style.background).toBe('var(--rm-recess, #ECF0F8)');
  });
});
