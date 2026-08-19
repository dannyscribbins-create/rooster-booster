// ─────────────────────────────────────────────────────────────────────────────
// THE PAYOUT ANNOUNCEMENT AMOUNT — EXACTLY ONE DOLLAR SIGN
//
// THE DEFECT. The preset templates carried a LITERAL '$' in front of the token
// ("your $[Amount] payout") while the resolver's substitution ALREADY supplied
// one ("$500"). Every rendered announcement therefore read "$$500".
//
// Live to referrers since c5c0617 (2026-03-29) — both halves were written in the
// same commit, on the referrer-facing popup, and survived four extractions.
// Roughly four and a half months in production.
//
// ── ⚠ WHY THIS FILE ASSERTS FULL PHRASES AND NOT VALUES ────────────────────
// The Phase 4 test that was supposed to cover this preview asserted
//
//     expect(preview.textContent).toContain('$500')
//
// and "$$500" CONTAINS "$500". It went green over a live defect. The anchor was
// chosen because it was the substituted value, and nothing then checked what the
// value had been substituted INTO — so the one character that was wrong sat
// immediately outside the assertion's field of view.
//
// Every assertion below anchors on the SURROUNDING PHRASE ("cashout request of
// $500 for referring"), which cannot match the doubled form. A `toContain` on a
// bare value is only ever evidence that the value appears SOMEWHERE, in SOME
// context — and the context is usually where the bug is.
//
// ── THE FOUR SURFACES ──────────────────────────────────────────────────────
// One resolver, three callers, plus the admin-authored custom path. Covered
// individually because they resolve at different times and only the resolver is
// shared — a fix applied at a call site would leave two of them broken.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ThemeProvider from '../components/shared/ThemeProvider';
import BrandingProvider from '../components/shared/BrandingProvider';
import AnnouncementPopup from '../components/referrer/AnnouncementPopup';
import AdminSettingsNotifications from '../components/admin/AdminSettingsNotifications';
import { TENANT_A } from '../components/admin/__fixtures__/twoTenantBranding';
import { resolveMessage } from './announcementMessage';

// The exact phrases a referrer reads. Full clauses, amount embedded — these are
// the assertions, and none of them can match a doubled sign.
const PRESET_1_PHRASE = 'your $500 payout for referring Sample Client';
const PRESET_2_PHRASE = 'cashout request of $500 for referring Sample Client';

/**
 * Asserts `text` reads correctly around the amount.
 *
 * Two independent checks, because either alone can be satisfied by the wrong
 * string: the phrase proves the amount sits in the right context, and the
 * doubled-sign scan proves no OTHER amount elsewhere in the same output is
 * malformed (the popup renders a second, separately-formatted figure).
 */
function expectCleanAmount(text, phrase, where) {
  expect(text, `${where}: expected the phrase "${phrase}"`).toContain(phrase);
  expect(text, `${where}: a doubled dollar sign is present in "${text}"`).not.toMatch(/\$\$/);
}

// ═══ THE RESOLVER — the shared unit all three callers go through ════════════
describe('resolveMessage — one dollar sign, from the formatter only', () => {

  it('[RED] preset_1 reads "your $500 payout", not "$$500"', () => {
    const out = resolveMessage({ mode: 'preset_1' }, 'Dana', 500, 'Sample Client', 'Acme Roofing');
    expectCleanAmount(out, PRESET_1_PHRASE, 'preset_1');
  });

  it('[RED] preset_2 reads "cashout request of $500 for", not "$$500"', () => {
    const out = resolveMessage({ mode: 'preset_2' }, 'Dana', 500, 'Sample Client', 'Acme Roofing');
    expectCleanAmount(out, PRESET_2_PHRASE, 'preset_2');
  });

  it('[RED] the thousands separator survives, still with one sign', () => {
    // Guards the fix against being made by deleting the formatter's '$' instead
    // of the template's — which would also produce a single sign, while dropping
    // the currency symbol from every custom message already written.
    const out = resolveMessage({ mode: 'preset_2' }, 'Dana', 1500.5, 'Sample Client', 'Acme');
    expectCleanAmount(out, 'cashout request of $1,500.5 for', 'preset_2 @1500.5');
  });

  it('[RED] the CUSTOM path with the documented [Amount] token renders one sign', () => {
    // [Amount] is what the editor's helper text documents. An admin who follows
    // it must get "$1,500" — the token carries the symbol.
    const out = resolveMessage(
      { mode: 'custom', custom_message: 'you earned [Amount] for that one!' },
      'Dana', 1500, 'Sample Client', 'Acme'
    );
    expectCleanAmount(out, 'Hey Dana, you earned $1,500 for that one!', 'custom [Amount]');
  });

  it('an admin who types their OWN $ in front of the token still gets two — by their hand, not ours', () => {
    // NOT A BUG AND DELIBERATELY PINNED. The token supplies the symbol, so a
    // literal '$' beside it is the author's own doubling and we must not silently
    // rewrite what an admin typed. This is recorded because it is precisely what
    // the presets were doing — and once they stop, nothing shipped teaches the
    // broken form any more.
    const out = resolveMessage(
      { mode: 'custom', custom_message: 'you earned $[Amount] today' },
      'Dana', 1500, 'Sample Client', 'Acme'
    );
    expect(out).toContain('$$1,500');
  });
});

// ═══ CALLER 1 + 2 — THE TWO ADMIN PREVIEWS ══════════════════════════════════
describe('the admin previews render one dollar sign', () => {

  const STATS = Object.freeze({});

  function installFetch(mode) {
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/admin/announcement-settings')) {
        return { ok: true, status: 200, json: async () => ({ enabled: true, mode, custom_message: '' }) };
      }
      if (u.includes('/api/admin/engagement-cadence')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      return { ok: true, status: 200, json: async () => STATS };
    });
  }
  afterEach(() => { delete global.fetch; });

  const underTenant = ui => (
    <BrandingProvider supplied={{ branding: TENANT_A, source: 'session' }}>{ui}</BrandingProvider>
  );

  it('the popup preview carries the CONTRACTOR mark and no platform mark (5.4)', async () => {
    // ⚠ 5.3 COULD NOT STAND THIS UP AND REMOVED IT RATHER THAN WEAKEN IT. The cause
    // was the harness, not the component: AnnouncementPreviewPopup renders only
    // when `showPreview` is true, which the PREVIEW BUTTON sets. Rendering the
    // settings page and asserting on the lockup was asserting against a modal that
    // had never mounted. The inline live-preview asserted in the sibling test below
    // is a different element and carries no logo at all.
    //
    // ⚠ A PAIR, NOT AN ABSENCE ASSERTION. Proving the platform mark is gone also
    // passes when the whole lockup is gone — which is how 5.2c-2's three
    // "non-vacuity" guards went green against a collapsed ternary, and very nearly
    // how this one would have gone green against an unmounted modal.
    installFetch('preset_2');
    render(underTenant(<AdminSettingsNotifications />));

    const previewBtn = await waitFor(() => screen.getByRole('button', { name: /preview/i }));
    await act(async () => { fireEvent.click(previewBtn); });

    const logo = await waitFor(() => screen.getByAltText(TENANT_A.companyName));
    expect(logo.getAttribute('src')).toBe(TENANT_A.logoUrl);
    expect(screen.queryByAltText(/rooster booster|roofmiles/i)).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/rb[%20_ ]?logo/i);
  });

  it('[RED] the LIVE PREVIEW reads "cashout request of $500 for referring Sample Client"', async () => {
    installFetch('preset_2');
    render(underTenant(<AdminSettingsNotifications />));

    // Located BY the full phrase. If the amount renders doubled this find fails,
    // which is the assertion — not a lookup that then needs checking.
    const preview = await waitFor(() =>
      screen.getByText(content => content.includes(PRESET_2_PHRASE)));
    expectCleanAmount(preview.textContent, PRESET_2_PHRASE, 'admin live preview');
  });

  it('[RED] the POPUP PREVIEW reads the same, and its big figure is unaffected', async () => {
    // The second caller. Reached only by clicking Preview, which is why the
    // Phase 4 tests never rendered it — an unopened overlay asserts nothing.
    installFetch('preset_2');
    render(underTenant(<AdminSettingsNotifications />));
    await waitFor(() => screen.getByRole('button', { name: /preview/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));

    const popup = await waitFor(() =>
      screen.getAllByText(content => content.includes(PRESET_2_PHRASE)));
    expect(popup.length).toBeGreaterThan(0);

    // The popup ALSO renders a large "$500" formatted independently of the
    // resolver. Scanning the whole document proves the fix did not leave one
    // amount right and the other wrong.
    expect(document.body.textContent, 'a doubled sign survives somewhere in the popup')
      .not.toMatch(/\$\$/);
  });

  it('[RED] preset_1 in the live preview is clean too', async () => {
    installFetch('preset_1');
    render(underTenant(<AdminSettingsNotifications />));
    const preview = await waitFor(() =>
      screen.getByText(content => content.includes(PRESET_1_PHRASE)));
    expectCleanAmount(preview.textContent, PRESET_1_PHRASE, 'admin live preview preset_1');
  });
});

// ═══ CALLER 3 — THE REFERRER-FACING POPUP, WHERE THIS ACTUALLY SHIPPED ══════
describe('the referrer popup renders one dollar sign', () => {

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  });
  afterEach(() => { delete global.fetch; });

  it('[RED] the message a referrer reads has one sign, not two', async () => {
    // This is the surface the defect has been live on since March. It resolves
    // through ThemeProvider/useBranding rather than the admin context, so it is
    // rendered here rather than assumed to match the previews.
    render(
      <ThemeProvider fetchStoredMode={async () => null}>
        <AnnouncementPopup
          announcement={{ id: 1, amount: 500, referredName: 'Sample Client' }}
          referrerFirstName="Dana" onDismiss={() => {}}
          settings={{ enabled: true, mode: 'preset_2', custom_message: null }}
        />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(document.body.textContent).toContain('cashout request of'));
    expectCleanAmount(document.body.textContent, PRESET_2_PHRASE, 'referrer popup');
  });
});
