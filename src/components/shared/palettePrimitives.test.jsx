// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-3 — THE SHARED PRIMITIVES
//
// `AvatarCircle` and `ContactModal`. ⚠ `StatusBadge` IS NOT MIGRATED AND THAT IS
// A RULING, NOT AN OMISSION — see the B.5 block at the foot of this file.
//
// ── ⚠ WHAT THESE TESTS CAN AND CANNOT SEE ──────────────────────────────────
// jsdom does not resolve var(). Every assertion here is DECLARATION-level plus
// ARITHMETIC over the derivation: it proves a site names the right property with
// the right fallback, and that the resulting pair clears its floor. It CANNOT
// prove the property was mounted. That distinction is R-1's defect class, so it
// is not left to a test that cannot see it — mounted-vs-fallback is the browser
// harness, run against three brands, and its result is in the commit body.
//
// ⚠ EXPECTED COUNT: 22 cases in this file. Stated because a heredoc has eaten
// backslashes three times this session, and the last one made a module fail to
// LOAD while the runner still reported the run as passing — the file simply
// contributed zero. A count you did not predict cannot surprise you.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { ELEVATION_LIGHT, elevationVar } from '../../constants/elevationTheme';
import AvatarCircle from './AvatarCircle';
// ⚠ STATIC, NOT `await import()` INSIDE THE TEST BODY. A dynamic import in a
// test is resolved against the PER-TEST timeout, so the module's load cost is
// charged to the case rather than to module setup. Under a 57-file suite the
// DashboardTab case reached 44s against a 20000ms allowance; isolated it was
// unchanged at 2.41s, so it was contention, not the component.
// ⚠ THE BESPOKE TIMEOUT WAS REMOVED RATHER THAN RAISED. Its own comment said a
// second timeout meant "a real change in the component, investigate rather than
// re-raise" — that was right, and the investigation showed the cost had not
// moved. Raising the number a second time would have been fitting the check to
// the failure; hoisting removes the cause instead.
import RankingsTab from '../referrer/RankingsTab';
import LoginScreen from '../auth/LoginScreen';
import ProfileTab from '../referrer/ProfileTab';
import DashboardTab from '../referrer/DashboardTab';
import ContactModal from './ContactModal';
import StatusBadge from './StatusBadge';
import { ThemeContext } from './ThemeProvider';

const SRC = path.resolve(process.cwd(), 'src');
const readSrc = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');

// Comments stripped for the CODE-level assertions only — the same distinction
// Palette-2 recorded. These ask "does the CODE still read R. / a retired
// literal"; themeKeyIntegrity.test.js asks "does this NAME appear anywhere a
// reader could copy from" and keeps no carve-out.
function codeOnly(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('{/*');
    })
    .join('\n');
}

const R_REF = /(^|[^A-Za-z0-9_.])R\.([a-zA-Z][A-Za-z0-9_]*)/g;
function rRefs(text) {
  const out = [];
  R_REF.lastIndex = 0;
  let m;
  while ((m = R_REF.exec(text)) !== null) { out.push(m[2]); R_REF.lastIndex = m.index + m[0].length; }
  return out;
}

// The retired Accent tones. ⚠ AvatarCircle reached these through `R`, NOT as
// literals — which is exactly why HARDCODED_ACCENT_INVENTORY.md never listed it:
// a hex needle cannot see a value reached through a needle-exempt constants file.
const RETIRED = /#(012854|CC0000|8C0000|041D3E|D3E3F0)\b/i;

const PLATFORM = deriveThemeTokens(resolveBrandingTheme(null), 'light');
const BRANDS = [
  ['Gamma', null],
  ['Alpha', { primary_color: '#1C2D4D', secondary_color: '#F26A1B', landing_bg_color: '#FFFFFF' }],
  ['Beta', { primary_color: '#0B3D3B', secondary_color: '#C2185B', landing_bg_color: '#F4FBFA' }],
];

describe('Palette-3 — the needles are validated against known answers first', () => {
  it('the R. needle matches the five it should and none of the four it should not', () => {
    const fixture = [
      'const a = R.textPrimary;', 'const b = { c: R.navy };', 'const c = `${R.fontBody}`;',
      'const d = [R.red, R.green];', 'const e = AD.textPrimary;', 'const f = foo.R.bar;',
      'const g = BAR.navy;', 'const h = REGISTER.thing;',
    ].join('\n');
    expect(rRefs(fixture)).toEqual(['textPrimary', 'navy', 'fontBody', 'red', 'green']);
  });

  it('the retired-Accent needle matches the tones and not their lookalikes', () => {
    expect(RETIRED.test('color: "#012854"')).toBe(true);
    expect(RETIRED.test('color: "#CC0000"')).toBe(true);
    // ⚠ a longer hex that merely STARTS with a retired tone must not match —
    // the substring trap that made `A32` look taken when it was `#A32D2D`.
    expect(RETIRED.test('color: "#012854FF00"')).toBe(false);
    expect(RETIRED.test('color: "#1C2D4D"')).toBe(false);
  });
});

// ── T1 — THE RULED TOKENS ───────────────────────────────────────────────────
describe('Palette-3 T1 — every migrated site carries its ruled token', () => {
  const avatar = () => codeOnly(readSrc('components/shared/AvatarCircle.jsx'));
  const modal = () => codeOnly(readSrc('components/shared/ContactModal.jsx'));

  it('[RED] AvatarCircle: the default fill is --rm-primary, the initials --rm-on-primary', () => {
    // The fill was R.red — the retired Accent red, sitting in the ACTION colour
    // slot. --rm-primary is the action colour, so this is a like-for-like move.
    expect(avatar()).toMatch(/var\(--rm-primary,\s*#F26A1B\)/);
    expect(avatar()).toMatch(/var\(--rm-on-primary,\s*#000000\)/);
  });

  it('[RED] AvatarCircle: the camera hint sits on --rm-surface with --rm-text', () => {
    expect(avatar()).toMatch(/var\(--rm-surface,\s*#FFFFFF\)/);
    expect(avatar()).toMatch(/var\(--rm-text,\s*#1C2D4D\)/);
  });

  it('[RED] ContactModal: the PANEL is --rm-surface — the dark-mode fix', () => {
    // It was a hardcoded #FFFFFF, which is why the modal rendered a light panel
    // on a dark login screen. That was seen in a production screenshot.
    expect(modal()).toMatch(/background:\s*'var\(--rm-surface,\s*#FFFFFF\)'/);
  });

  it('[RED] ContactModal: heading, links and icons are --rm-text', () => {
    const m = modal();
    // five sites that were R.navy, plus the close label
    expect((m.match(/var\(--rm-text,\s*#1C2D4D\)/g) || []).length).toBeGreaterThanOrEqual(6);
  });

  it('[RED] ContactModal: both rules go through the elevation side channel', () => {
    // ⚠ ASSERT THE CALL, NOT THE EMITTED STRING. `elevationVar('border')`
    // produces `var(--rm-border, …)` at RUNTIME; the source holds the call. An
    // earlier draft of this case grepped for the emitted text and failed against
    // correct code — a needle looking for the wrong artefact entirely.
    const m = modal();
    expect((m.match(/elevationVar\('border'\)/g) || []).length).toBe(2);
    // And the contract that call answers to, so the two halves cannot drift.
    expect(elevationVar('border')).toBe(`var(--rm-border, ${ELEVATION_LIGHT.border})`);
  });

  it('[RED] every declared fallback IS the value that mounts for the platform default', () => {
    // ⚠ THE TINT-IS-NOT-A-FILL CLAUSE. themeKeyIntegrity enforces this across
    // src/; this pins THESE files so a failure names the primitives.
    const EXPECT = {
      '--rm-primary': PLATFORM.primary, '--rm-on-primary': PLATFORM.onPrimary,
      '--rm-surface': PLATFORM.surface, '--rm-text': PLATFORM.text,
    };
    for (const src of [avatar(), modal()]) {
      for (const [, prop, fb] of src.matchAll(/var\((--rm-[a-z-]+),\s*(#[0-9A-Fa-f]{6})\)/g)) {
        expect(EXPECT[prop], `unexpected property ${prop}`).toBeTruthy();
        expect(fb.toUpperCase(), `${prop} falls back to ${fb}`).toBe(EXPECT[prop].toUpperCase());
      }
    }
  });
});

// ── T2 — THE ✕ REGRESSION FENCE ─────────────────────────────────────────────
describe('Palette-3 T2 — the close control clears the 3:1 non-text floor', () => {
  it('[RED] it no longer reads R.textMuted, which measured 2.61:1', () => {
    const m = codeOnly(readSrc('components/shared/ContactModal.jsx'));
    expect(m).not.toMatch(/ph-x[\s\S]{0,120}textMuted/);
    expect(contrastRatio('#A0A0A0', '#FFFFFF')).toBeLessThan(3);
  });

  it('[RED] --rm-text on --rm-surface clears 3:1 for every brand in both modes', () => {
    // ⚠ A REGRESSION FENCE. This was below floor for weeks, found and left twice.
    for (const [label, src] of BRANDS) {
      for (const mode of ['light', 'dark']) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        const ratio = contrastRatio(t.text, t.surface);
        expect(ratio, `${label}/${mode}: ✕ ${t.text} on ${t.surface} = ${ratio.toFixed(2)}:1`)
          .toBeGreaterThanOrEqual(3);
      }
    }
  });
});

// ── T3 — WHAT REMAINS, ENUMERATED ───────────────────────────────────────────
describe('Palette-3 T3 — the remaining R. is enumerated, and the files still run', () => {
  it('[RED] AvatarCircle reads nothing from R — its font is migrated', () => {
    // ⚠ THIS EXPECTED `['fontMono']`; Palette-13 B.7 migrated the font.
    // ⚠ AND A DRAFT OF THIS CASE EXPECTED `['navy']`, ON THE STRENGTH OF A
    // MEASUREMENT THAT COUNTED COMMENTS AS CODE. All three `R.` strings left in
    // that file are RECORDS of retired reads — two in `//` comments and one in a
    // JSX `{/* */}` comment, which a naive line-prefix filter does not strip at
    // all. `codeOnly()` does, so the honest set is empty, and this fence is what
    // said so. **A sweep that reads comments reports a defect that is not there**
    // — the mirror image of the prose-matches-the-pattern trap.
    expect(rRefs(codeOnly(readSrc('components/shared/AvatarCircle.jsx')))).toEqual([]);
    // Paired positive — the file still declares a family.
    expect(readSrc('components/shared/AvatarCircle.jsx')).toMatch(/fontVar\('mono'\)/);
  });

  it('[RED] ContactModal keeps only the large shadow — its fonts are migrated', () => {
    // ⚠ shadowLg HAS NO DESTINATION. The side channel publishes ONE shadow role;
    // `shadowLg` is a heavier elevation with nowhere to go, and inventing a
    // second role is Palette-1's job, not this phase's. Reported, not forced.
    // ⚠ THE FOUR FONT KEYS LEFT IN PALETTE-13 B.7 — migrated, not deleted.
    expect(rRefs(codeOnly(readSrc('components/shared/ContactModal.jsx'))).sort())
      .toEqual(['shadowLg']);
    expect(readSrc('components/shared/ContactModal.jsx')).toMatch(/fontVar\('(heading|body)'\)/);
  });

  it('[RED] no retired Accent tone remains in either migrated file', () => {
    for (const f of ['AvatarCircle', 'ContactModal']) {
      const code = codeOnly(readSrc(`components/shared/${f}.jsx`));
      expect(RETIRED.test(code), `${f} still paints a retired Accent tone`).toBe(false);
    }
  });

  it('[RED] and both still RENDER — absence alone is satisfied by a file that threw', () => {
    const { container } = render(<AvatarCircle userName="Ada Lovelace" size={48} />);
    expect(screen.getByText('AL')).toBeTruthy();
    expect(container.querySelector('div')).toBeTruthy();
    const modal = render(<ContactModal isOpen onClose={() => {}} />);
    expect(modal.getByText('Get in Touch')).toBeTruthy();
  });
});

// ── T4 — THE IMPORTERS ──────────────────────────────────────────────────────
describe('Palette-3 T4 — every importer still renders', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  function installFetch() {
    vi.stubGlobal('fetch', async (url) => {
      if (typeof url !== 'string' && !(url instanceof URL)) {
        throw new Error(`fetch double: unexpected url shape ${Object.prototype.toString.call(url)}`);
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
  }

  // Named explicitly, per A.1. ContactModal's LoginScreen importer is the
  // PRE-AUTH one and is the reason this phase touches a pre-auth surface.
  it('[RED] AvatarCircle renders inside a tab (Dashboard, Profile, Rankings all import it)', () => {
    installFetch();
    const { container } = render(<RankingsTab token="t" />);
    expect(container).toBeTruthy();
  });

  it('[RED] LoginScreen — ContactModal\'s PRE-AUTH importer — still renders', async () => {
    installFetch();
    render(<LoginScreen onAuthenticated={() => {}} />);
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('[RED] ProfileTab — importer of all three primitives — still renders', () => {
    installFetch();
    const { container } = render(
      <ProfileTab onLogout={() => {}} pipeline={[]} loading={false} userName="A" userEmail="a@b.co"
        onNameUpdate={() => {}} setProfilePhoto={() => {}} onResetHighlight={() => {}}
        refreshBankStatus={() => {}} onResetOpenManageAccount={() => {}} />
    );
    expect(container.querySelector('div')).toBeTruthy();
  });

  // ⚠ AN EXPLICIT TIMEOUT, AND THE NUMBER IS MEASURED RATHER THAN GUESSED.
  // This case passed in isolation and TIMED OUT at the 5000ms default under the
  // full 49-file suite. Measured per-case in isolation: LoginScreen 51ms,
  // AvatarCircle-in-RankingsTab 68ms, ProfileTab 105ms, and DashboardTab
  // **2157ms** — 20-40x its siblings. It is the heaviest component in the
  // referrer tree and it also arms a 400ms bar-animation timer.
  // ⚠ SO THIS IS COST, NOT A MASKED DEFECT, AND THE DISTINCTION MATTERS: the
  // component is not hanging, and nothing here was relaxed to make a failing
  // assertion pass. 20000ms is ~9x the isolated cost, which clears contention.
  // If this ever times out AGAIN, that is a real change in the component and
  // should be investigated rather than re-raised.
  it('[RED] DashboardTab — importer of AvatarCircle and StatusBadge — still renders', () => {
    installFetch();
    const { container } = render(
      <DashboardTab setTab={() => {}} pipeline={[]} loading={false} userName="A" balance={0}
        paidCount={0} sessionToken="t" />
    );
    expect(container.querySelector('div')).toBeTruthy();
  });
});

// ── T5 — CONTACTMODAL IN DARK MODE ──────────────────────────────────────────
describe('Palette-3 T5 — ContactModal no longer hardcodes a light panel', () => {
  it('[RED] its panel and text declare tokens, so dark mode follows the provider', () => {
    // ⚠ THE BR-ARC DEFECT. The modal painted a hardcoded #FFFFFF panel with
    // R.navy text — a light card on a dark login screen, seen in a production
    // screenshot. jsdom cannot resolve var(), so what this asserts is that the
    // panel is no longer MODE-BLIND; the rendered dark result is the harness's.
    const m = codeOnly(readSrc('components/shared/ContactModal.jsx'));
    expect(m).not.toMatch(/background:\s*"#FFFFFF"/);
    expect(m).toMatch(/var\(--rm-surface,/);
    // And arithmetic over the dark derivation: the pair the provider will mount.
    for (const [label, src] of BRANDS) {
      const d = deriveThemeTokens(resolveBrandingTheme(src), 'dark');
      expect(contrastRatio(d.text, d.surface), `${label} dark panel`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('renders inside a dark-mode provider without throwing', () => {
    const dark = deriveThemeTokens(resolveBrandingTheme(null), 'dark');
    const ctx = { branding: { phone: '(770) 555-0101', email: 'a@b.co' }, mode: 'dark', source: 'test' };
    render(
      <ThemeContext.Provider value={ctx}>
        <div style={{ '--rm-surface': dark.surface, '--rm-text': dark.text }}>
          <ContactModal isOpen onClose={() => {}} />
        </div>
      </ThemeContext.Provider>
    );
    expect(screen.getByText('Get in Touch')).toBeTruthy();
    expect(screen.getByText('(770) 555-0101')).toBeTruthy();
  });
});

// ── B.5 — THE StatusBadge RULING, RECORDED AS A TEST SO IT IS NOT RE-LITIGATED
describe('Palette-3 B.5 — StatusBadge belongs to the STATUS system, and is NOT migrated', () => {
  it('it reads nothing from R — it had no colour of its own, and now no font either', () => {
    // Every colour it paints comes from STATUS_CONFIG, which it is handed. Its
    // one remaining reference was the monospace key, migrated in Palette-13 B.7.
    expect(rRefs(codeOnly(readSrc('components/shared/StatusBadge.jsx')))).toEqual([]);
    // Paired positive — it still declares a family; the file was not emptied.
    expect(readSrc('components/shared/StatusBadge.jsx')).toMatch(/fontVar\('mono'\)/);
  });

  it('⚠ and the status system does NOT cover its vocabulary — which is why it waits', () => {
    // STATUS_CONFIG is a SEVEN-state PIPELINE vocabulary; statusTheme.js carries
    // THREE semantic roles. `lead`, `inspection`, `app_user` and `complete` have
    // no danger/success/warning meaning at all — a brand palette does not imply
    // "In App" teal any more than it implies "danger" red, which is the exact
    // argument statusTheme.js was created on.
    // ⚠ FORCING THESE INTO THE RENDER SET WOULD BE WRONG, and forcing them into
    // statusTheme means extending it to a pipeline vocabulary — a ruling, not a
    // migration. Recorded here so the next phase inherits the reasoning.
    const theme = readSrc('constants/theme.js');
    const states = [...theme.matchAll(/^\s{2}([a-z_]+):\s+\{ label:/gm)].map((m) => m[1]);
    expect(states.sort()).toEqual(
      ['app_user', 'booking_pending', 'closed', 'complete', 'inspection', 'lead', 'sold']
    );
    const status = readSrc('constants/statusTheme.js');
    for (const role of ['danger', 'success', 'warning']) {
      expect(status).toContain(`${role}:`);
    }
    // No pipeline state is a status role, and no status role is a pipeline state.
    for (const s of states) expect(['danger', 'success', 'warning']).not.toContain(s);
  });
});
