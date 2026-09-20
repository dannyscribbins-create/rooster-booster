// ── CANVASS-8: THE PROFILE SCREEN ───────────────────────────────────────────
//
// ⚠ WHAT jsdom CAN AND CANNOT SETTLE. jsdom resolves NO `var()` and performs NO
// layout, so every colour claim here is DECLARATION-LEVEL — it proves which token a
// site reaches for, never what it paints. The painted figures come from the browser
// pass and are recorded in the commit and the checklist.
//
// ⚠ THE TITLE CONTROL IS THE ONLY WRITE ON THE REP SURFACE, and most of this file is
// about what happens when it fails. A write tested only on its happy path is a write
// whose failure handling has never run.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import ThemeProvider from '../shared/ThemeProvider';
import RepProfileScreen from './RepProfileScreen';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';

const CONTEXT = { hostname: 'app.roofmiles.com', search: '', storage: null };

const TITLES = [
  { id: 4, name: 'Field Advisor' },
  { id: 7, name: 'Senior Roof Advisor' },
];

const caps = (over = {}) => ({
  loading: false, tier: 'general', title_id: null, full_name: 'Dana Scribbins',
  email: 'dana@example.test', is_field_rep: true, is_attributable: true,
  rep_revenue_visibility: false, ...over,
});

// ⚠ ROUTED BY URL, NOT BY CALL ORDER — ThemeProvider fetches on mount, so an
// order-keyed mock hands the screen's payload to the theme request. Unrouted URLs
// REJECT rather than returning something plausible.
function installFetch({ titles = TITLES, patchStatus = 200, patchBody = null, patchThrows = false } = {}) {
  const calls = [];
  global.fetch = vi.fn(async (url, init) => {
    const u = String(url);
    calls.push({ url: u, method: init?.method || 'GET', body: init?.body });
    if (u.includes('/api/preferences/theme-mode')) return { ok: true, status: 200, json: async () => ({ mode: 'light' }) };
    if (u.includes('/api/session/branding')) return { ok: true, status: 200, json: async () => ({}) };
    if (u.includes('/api/admin/titles')) return { ok: true, status: 200, json: async () => titles };
    if (u.includes('/api/admin/me/title')) {
      if (patchThrows) throw new Error('offline');
      return {
        ok: patchStatus >= 200 && patchStatus < 300,
        status: patchStatus,
        json: async () => patchBody ?? { title_id: JSON.parse(init?.body || '{}').title_id, title_name: 'Senior Roof Advisor' },
      };
    }
    return Promise.reject(new Error(`unrouted fetch: ${u}`));
  });
  return calls;
}

function mount(over = {}, fetchOpts = {}) {
  const calls = installFetch(fetchOpts);
  const utils = render(
    <ThemeProvider context={CONTEXT} fetchStoredMode={async () => null}>
      <RepProfileScreen onLogout={() => {}} caps={caps(over)} />
    </ThemeProvider>
  );
  return { ...utils, calls };
}

const titleSelect = () => document.querySelector('[data-rep-title-select]');

beforeEach(() => { localStorage.setItem(ADMIN_TOKEN_KEY, 'rep-token'); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); delete global.fetch; });

describe('Canvass-8 — the title control (A28), the only write on the rep surface', () => {
  it('loads the contractor\'s titles and offers them', async () => {
    mount();
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    await waitFor(() => expect(titleSelect().querySelectorAll('option').length).toBeGreaterThan(1));
    const names = [...titleSelect().querySelectorAll('option')].map((o) => o.textContent);
    expect(names).toContain('Field Advisor');
    expect(names).toContain('Senior Roof Advisor');
  });

  it('⚠ calls ONLY the two allowlisted admin routes — A34.3, by method and full path', async () => {
    // The client fence in roleRouting.test.jsx names its allowed paths EXACTLY.
    // This is the same rule asserted from the screen's own side, so a new call
    // fails here too rather than only in a file nobody edits alongside this one.
    const { calls } = mount();
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    fireEvent.change(titleSelect(), { target: { value: '7' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));

    const adminCalls = calls.filter((c) => c.url.includes('/api/admin/'));
    const keys = [...new Set(adminCalls.map((c) => `${c.method} ${c.url.split('?')[0].replace(/^.*(\/api\/admin\/)/, '$1')}`))];
    expect(keys.sort()).toEqual(['GET /api/admin/titles', 'PATCH /api/admin/me/title']);
  });

  it('saving a title PATCHes the id and the rendered selection follows', async () => {
    const { calls } = mount();
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    fireEvent.change(titleSelect(), { target: { value: '7' } });

    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH');
      expect(patch).toBeTruthy();
      expect(JSON.parse(patch.body)).toEqual({ title_id: 7 });
    });
    await waitFor(() => expect(titleSelect().value).toBe('7'));
  });

  it('a rep with NO title set renders correctly — the common first state', async () => {
    // team_members.title_id is NULL for every local row, so this is what a real
    // rep sees on first open. It must not look broken or pre-select someone else's.
    mount({ title_id: null });
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    expect(titleSelect().value).toBe('');
    const placeholder = titleSelect().querySelector('option[value=""]');
    expect(placeholder).toBeTruthy();
    expect(placeholder.textContent.toLowerCase()).not.toContain('error');
  });

  it('a rep WITH a title set shows it selected', async () => {
    mount({ title_id: 7 });
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    await waitFor(() => expect(titleSelect().value).toBe('7'));
  });

  it('⚠ a 403 says the title is NO LONGER AVAILABLE, never "not allowed"', async () => {
    // ⚠ ONE STATUS CODE, TWO MEANINGS. The server returns 403 invalid_title both for
    // a cross-contractor id AND for a title an admin deleted between load and save —
    // DELETE /api/admin/titles/:id nulls affected members and leaves the id dangling.
    // A rep hitting the ordinary case is not doing anything forbidden, so permission
    // language would be both alarming and wrong.
    mount({ title_id: null }, { patchStatus: 403, patchBody: { error: 'invalid_title' } });
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    fireEvent.change(titleSelect(), { target: { value: '7' } });

    const msg = await screen.findByRole('status');
    const text = msg.textContent.toLowerCase();
    expect(text).toContain('no longer available');
    for (const forbidden of ['not allowed', 'permission', 'forbidden', 'denied']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('a failed save REVERTS the selection rather than leaving a value that was not stored', async () => {
    // ⚠ NOT OPTIMISTIC, DELIBERATELY. This is the rep's own identity shown back to
    // them; a value that appears saved and was not is a lie the screen tells, and
    // the correction arrives silently on the next load.
    mount({ title_id: 4 }, { patchStatus: 500 });
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    await waitFor(() => expect(titleSelect().value).toBe('4'));

    fireEvent.change(titleSelect(), { target: { value: '7' } });
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(titleSelect().value).toBe('4');
  });

  it('a network throw is reported and does not leave the control stuck', async () => {
    mount({ title_id: 4 }, { patchThrows: true });
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    fireEvent.change(titleSelect(), { target: { value: '7' } });
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(titleSelect().disabled).toBe(false);
    expect(titleSelect().value).toBe('4');
  });

  it('⚠ a non-array titles response does not crash the screen', async () => {
    // A permissive fetch stub elsewhere in this suite returns { mode: undefined } for
    // any GET. The guard matches the VALUE'S OWN SHAPE — Array.isArray, not a
    // truthiness test — because an object is truthy and has no .map.
    mount({}, { titles: { mode: undefined } });
    await waitFor(() => expect(titleSelect()).toBeTruthy());
    expect(titleSelect().querySelectorAll('option[value=""]').length).toBe(1);
  });
});

describe('Canvass-8 — attribution type (display only)', () => {
  // ⚠ THE COPY CHANGED IN CANVASS-9a AND THE WORD "attributable" IS DELIBERATELY GONE
  // FROM THE RENDERED PILL. Part 6b replaced a sentence up to 54 characters long — which
  // wrapped to three lines in a right-aligned value column — with a pill, and the pill's
  // copy had to be TRUE ON ITS OWN because 9b's info popup must add depth rather than
  // rescue an overstated label. "Attributable" is the jargon the old sentence existed to
  // explain, so the pill says what happens instead: "Matches credited to you".
  //
  // ⚠ SO THESE TWO CASES NOW ASSERT THE PILL'S OWN STATE ATTRIBUTE, NOT ITS PROSE, and
  // that is the stronger fence rather than a looser one: `data-attributable` cannot be
  // satisfied by a reworded sentence, and the copy is free to improve without a test
  // pinning a phrase. The positive/negative DISTINCTION — the thing that actually
  // matters — is what is pinned.
  it('an attributable rep is told their matches are credited to them', async () => {
    mount({ is_attributable: true });
    const row = await screen.findByTestId('rep-attribution');
    const pill = row.querySelector('[data-rep-attribution-pill]');
    expect(pill).toBeTruthy();
    expect(pill.getAttribute('data-attributable')).toBe('true');
    expect(pill.textContent.toLowerCase()).toContain('credited to you');
    // ⚠ AND IT MUST NOT READ AS A DENIAL. The negative copy is the positive's with
    // "not" inserted, so a state mix-up would be invisible to a `toContain('credited')`
    // — "not credited to you" contains "credited to you". This is the bare-value
    // `toContain` trap, and the needle is anchored to exclude it.
    expect(pill.textContent.toLowerCase()).not.toContain('not credited');
  });

  it('a NON-attributable rep is told plainly, without blame or a lock', async () => {
    mount({ is_attributable: false });
    const row = await screen.findByTestId('rep-attribution');
    const pill = row.querySelector('[data-rep-attribution-pill]');
    expect(pill).toBeTruthy();
    expect(pill.getAttribute('data-attributable')).toBe('false');
    expect(pill.textContent.toLowerCase()).toContain('not credited to you');
    const text = row.textContent.toLowerCase();
    for (const forbidden of ['locked', 'denied', 'no permission', 'restricted']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('⚠ the NEGATIVE state is NOT filled in the brand primary — a restriction is not an affirmation', async () => {
    // Part 6b specifies the brand primary for this pill. It is applied to the POSITIVE
    // state only: a brand-primary badge is what this app uses for the thing that is
    // true, and announcing a limitation in it would read as a feature. The negative
    // takes StatusPill's unfilled treatment so the two surfaces agree about what an
    // unfilled pill means.
    mount({ is_attributable: false });
    const row = await screen.findByTestId('rep-attribution');
    const pill = row.querySelector('[data-rep-attribution-pill]');
    expect(pill.style.background).toBe('transparent');
    // ⚠ THE PAIRED POSITIVE, ON A SEPARATE MOUNT, IS WHAT MAKES THE ABOVE FALSIFIABLE.
    // Without it "the background is transparent" would pass against a pill that is
    // never filled in either state — an absence assertion proving the presence first.
    cleanup();
    mount({ is_attributable: true });
    const onRow = await screen.findByTestId('rep-attribution');
    const onPill = onRow.querySelector('[data-rep-attribution-pill]');
    expect(onPill.style.background).toContain('--rm-primary');
  });

  it('⚠ REVENUE VISIBILITY GETS NO ROW, IN EITHER STATE — A34.6 and CD-7', async () => {
    // A row reading "Revenue: hidden" tells a rep they are being denied something,
    // which is the lock-by-omission the stat grid already refuses. Revenue is absent
    // from the rep surface entirely until Wave 1.5/1.6, in BOTH flag states.
    for (const visible of [true, false]) {
      const { container, unmount } = mount({ rep_revenue_visibility: visible });
      await screen.findByTestId('rep-attribution');
      const text = container.textContent.toLowerCase();
      expect(text).not.toContain('revenue');
      expect(text).not.toContain('$');
      unmount();
    }
  });
});

describe('Canvass-8 — what does NOT ship, and A30\'s anchor', () => {
  it('⚠ NO Security row — A34.9, and no self-service change-password route exists', async () => {
    const { container } = mount();
    await screen.findByTestId('rep-attribution');
    const text = container.textContent.toLowerCase();
    expect(text).not.toContain('security');
    expect(text).not.toContain('change password');
    expect(text).not.toContain('2fa');
  });

  it('⚠ NO Fallback link row — nothing mints a rep link, and CD-8 voided the example', async () => {
    const { container } = mount();
    await screen.findByTestId('rep-attribution');
    const text = container.textContent.toLowerCase();
    expect(text).not.toContain('fallback');
    expect(text).not.toContain('roofmiles.link');
  });

  it('⚠ A30 IS NOT REGRESSED — the theme row still sits DIRECTLY above Sign out', async () => {
    // Canvass-8 adds rows ABOVE the theme row. This is the fence that makes that a
    // decision rather than a hope: a row inserted into the gap A30 names fails here.
    mount();
    await screen.findByTestId('rep-attribution');
    const row = document.querySelector('[data-rep-theme-row]');
    const signOut = document.querySelector('[data-rep-signout]');
    expect(row, 'the theme row is not on the Profile screen').toBeTruthy();
    expect(signOut).toBeTruthy();
    // ⚠ THE TARGET IS THE SIGN-OUT *ROW* SINCE 9b PART 0(b) — see the twin assertion
    // in repThemeToggle.test.jsx for the full reasoning. The switcher joined Sign
    // out's row rather than becoming a row of its own, so A30's row list is intact.
    let next = row.nextElementSibling;
    while (next && next.getAttribute('aria-hidden') === 'true') next = next.nextElementSibling;
    expect(next, 'something sits between the theme row and the Sign out row')
      .toBe(signOut.closest('[data-rep-account-actions]'));
    expect(next.contains(signOut)).toBe(true);
    expect(next.nextElementSibling, 'something now follows the Sign out row').toBeNull();
  });

  it('renders the rep\'s initials without inventing a name when one is absent', async () => {
    const { unmount } = mount({ full_name: 'Dana Scribbins' });
    expect((await screen.findByTestId('rep-avatar')).textContent).toBe('DS');
    unmount();

    mount({ full_name: null });
    const avatar = await screen.findByTestId('rep-avatar');
    expect(avatar.textContent).toBe('');
    expect(avatar.textContent).not.toContain('null');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANVASS-9a PART 6 — THE SUBTITLE, THE INFO SLOT, AND SIGN OUT'S ISOLATION
describe('Canvass-9a Part 6 — Profile’s chrome', () => {
  it('⚠ Part 6a — there is NO subtitle under the Profile title', async () => {
    // It read "Self-service settings". Danny: the title already says it. It was also the
    // weaker kind of subtitle — a description of the screen's CATEGORY rather than a fact
    // about its contents. Home's and Clients' subtitles survive because they now carry
    // the timeframe window, which is information a heading cannot give.
    mount({});
    await screen.findByText('Profile');
    expect(screen.queryByText('Self-service settings')).toBeNull();
    // ⚠ THE PAIRED POSITIVE: the heading itself must still be there. "The subtitle is
    // absent" would pass against a screen that failed to render its header at all.
    const h1 = document.querySelector('h1');
    expect(h1.textContent).toBe('Profile');
    // And nothing else sits in the header block beside the h1.
    expect(h1.parentElement.children.length).toBe(1);
  });

  it('⚠ Part 6b — the Attribution type LABEL slot is now FILLED by 9b’s info icon', async () => {
    // ⚠ INVERTED IN 9b, NOT DELETED, AND THE INVERSION IS THE RECORD. In 9a this case
    // asserted the slot was EMPTY — *"nothing is rendered into it … no button, no
    // svg"* — on A29's reasoning that an inert control reads as an oversight. **That
    // was correct for a phase that reserved room and built nothing.** 9b built the
    // mechanism, so the slot is now filled with a real, working control, which is what
    // A29's reasoning was waiting for rather than something it forbids.
    //
    // ⚠ THE PREDICTION 9a MADE IS WHAT THIS NOW CHECKS: *"an icon becomes one child
    // here and nothing reflows."* One child became two, and the label is unchanged.
    mount({ is_attributable: true });
    const row = await screen.findByTestId('rep-attribution');
    const labelBox = row.querySelector('[data-rep-info-slot="true"]');
    expect(labelBox, 'the attribution label has no info slot').toBeTruthy();
    expect(labelBox.textContent).toBe('Attribution type');
    expect(labelBox.children.length).toBe(2);

    const icon = labelBox.querySelector('[data-rep-info-icon]');
    expect(icon, 'the info icon is not in the slot').toBeTruthy();
    expect(icon.getAttribute('data-rep-info-icon')).toBe('attributionType');
    // ⚠ IT IS A REAL CONTROL, NOT A DECORATIVE GLYPH — A29's distinction exactly.
    expect(icon.tagName).toBe('BUTTON');
    expect(icon.hasAttribute('disabled')).toBe(false);
    expect(icon.getAttribute('aria-expanded')).toBe('false');

    // ⚠ AND THE PAIRED NEGATIVE SURVIVES THE INVERSION: a row that did NOT ask for the
    // slot must still not have one, or `data-rep-info-slot` is decoration rather than
    // a switch — and the icon must not appear there either.
    const titleRow = screen.getByTestId('rep-title');
    expect(titleRow.querySelector('[data-rep-info-slot="true"]')).toBeNull();
    expect(titleRow.querySelector('[data-rep-info-slot="false"]')).toBeTruthy();
    expect(titleRow.querySelector('[data-rep-info-icon]')).toBeNull();
  });

  it('⚠ Part 6b — the pill is TRUE ON ITS OWN, without the popup 9b will add', async () => {
    // The popup adds DEPTH and must never rescue an overstated label — the same
    // principle the conversions card records. So the pill names WHOSE and WHAT without
    // relying on the mechanism the popup explains, and it must not use the jargon the
    // old sentence existed to define.
    mount({ is_attributable: true });
    const row = await screen.findByTestId('rep-attribution');
    const pill = row.querySelector('[data-rep-attribution-pill]');
    expect(pill.textContent).toBe('Matches credited to you');
    expect(pill.textContent.toLowerCase()).not.toContain('attributable');
  });

  it('⚠ Part 6c — Sign out is isolated from the divider above it', async () => {
    // It was touching the theme row's bottom hairline — `padding: 0`, no margin, directly
    // under a `borderBottom` — so it read as one more row in the list rather than as the
    // one destructive action on the screen.
    mount({});
    const signout = await screen.findByText('Sign out');
    // Vertical padding on the control itself, not only space above it.
    expect(signout.style.paddingTop).not.toBe('');
    expect(signout.style.paddingTop).not.toBe('0px');
    expect(signout.style.paddingBottom).toBe(signout.style.paddingTop);

    // ⚠ AND A SPACER SEPARATES ITS ROW FROM THE ROW ABOVE. Asserted structurally rather
    // than by a pixel total, because what matters is that SOMETHING holds them apart — a
    // future change to the amount should not fail this.
    // ⚠ THE SPACER IS NOW THE ACCOUNT ROW'S PREVIOUS SIBLING, NOT THE BUTTON'S, since
    // 9b Part 0(b) put the switcher beside Sign out inside that row. The property is
    // unchanged; the element the button hangs from moved one level.
    const accountRow = signout.closest('[data-rep-account-actions]');
    expect(accountRow, 'Sign out is not inside the account row').toBeTruthy();
    const spacer = accountRow.previousElementSibling;
    expect(spacer.getAttribute('aria-hidden')).toBe('true');
    expect(parseInt(spacer.style.height, 10)).toBeGreaterThan(20);
  });

  it('⚠ A30 still holds — the theme row is directly above Sign out, spacer notwithstanding', async () => {
    // A30's anchor is ORDER, not proximity: nothing may be INSERTED between the theme
    // row and Sign out. Part 6c added a spacer, and this is the case that proves the
    // spacer did not become an insertion — no interactive control, and no row, came
    // between them.
    mount({});
    const signout = await screen.findByText('Sign out');
    const accountRow = signout.closest('[data-rep-account-actions]');
    const spacer = accountRow.previousElementSibling;
    // The spacer carries nothing at all.
    expect(spacer.children.length).toBe(0);
    expect(spacer.textContent).toBe('');
    // And the element before the spacer is the theme toggle row.
    const themeRow = spacer.previousElementSibling;
    expect(themeRow.textContent.toLowerCase()).toMatch(/dark mode|theme|appearance/);
  });

  it('⚠ Sign out uses the sanctioned status token, not a hand-written custom property', async () => {
    // It read `var(--rm-danger-text, #B91C1C)` — a second copy of a value statusTheme.js
    // already owns, and the exact shape behind the recorded 1.34:1 login-screen defect
    // where a fallback was a plausible tint rather than the value that mounts.
    mount({});
    const signout = await screen.findByText('Sign out');
    expect(signout.style.color).toContain('--rm-danger-text');
    // ⚠ THE POINT IS THE HELPER, AND A DECLARATION-LEVEL TEST CANNOT SEE A CALL — so
    // this asserts the OBSERVABLE consequence instead: whatever the helper emits, the
    // fallback must be the one statusTheme.js defines rather than one retyped here.
    // `themeKeyIntegrity.test.js` owns the value itself and names it when it fires.
    expect(signout.style.color).toMatch(/^var\(--rm-danger-text, #[0-9A-Fa-f]{6}\)$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANVASS-9b PART 0(b) — THE SWITCHER MOVED TO PROFILE, LEFT OF SIGN OUT
//
// Ruled by Danny: it is a rare, account-level action and does not belong on every
// screen. It was costing a 58px row on all four tabs — measured, chrome above the
// page title fell 141.8 -> 71.8px once it and the header padding went.
//
// ⚠ THE CONSTRAINT THAT CAME WITH THE RULING: it is the ONLY route back to the admin
// panel, so it must stay obviously actionable and must NOT read as subordinate to the
// destructive action beside it. These cases fence the structural half of that; the
// painted half is the browser pass (measured 11.16 / 18.45 light / dark on
// palette-beta and 12.00 / 17.96 on palette-alpha, all against a 4.5 floor).
describe('Canvass-9b Part 0(b) — the switcher lives on Profile, beside Sign out', () => {
  const withSwitcher = (over = {}) => {
    installFetch();
    return render(
      <ThemeProvider context={CONTEXT} fetchStoredMode={async () => null}>
        <RepProfileScreen
          onLogout={() => {}}
          caps={caps(over)}
          switcher={<button type="button" data-surface-switcher="admin">Switch to the admin panel</button>}
        />
      </ThemeProvider>
    );
  };

  it('renders the switcher for an ELIGIBLE member, to the LEFT of Sign out in one row', async () => {
    withSwitcher();
    const signout = await screen.findByText('Sign out');
    const row = signout.closest('[data-rep-account-actions]');
    expect(row, 'Sign out is not inside the account row').toBeTruthy();

    const sw = row.querySelector('[data-surface-switcher]');
    expect(sw, 'the switcher is not in the account row').toBeTruthy();

    // ⚠ ORDER IS THE ASSERTION, NOT MERE CO-PRESENCE. "Left of Sign out" is the ruling,
    // and two elements that both exist in the wrong order would satisfy a presence-only
    // check. jsdom performs no layout so `getBoundingClientRect` cannot say which is
    // left — DOM order is the observable that survives here, and it is also what a
    // screen reader follows, which is the half of "not subordinate" that matters most.
    // eslint-disable-next-line no-bitwise
    expect(sw.compareDocumentPosition(signout) & Node.DOCUMENT_POSITION_FOLLOWING,
      'Sign out does not follow the switcher').toBeTruthy();

    // ⚠ AND THE ROW MUST NOT REVERSE ITS OWN VISUAL ORDER — A HOLE THE GUARD-PROOF
    // FOUND RATHER THAN A PRECAUTION I THOUGHT OF. Flipping the row to
    // `flex-direction: row-reverse` paints Sign out on the LEFT and the switcher on
    // the RIGHT, breaking the ruling, while leaving DOM order untouched — so the
    // assertion above stayed GREEN against it. A fence whose failure mode has never
    // been observed is a claim, and this one had a gap exactly where jsdom's lack of
    // layout leaves the reader blind.
    // ⚠ ASSERTED ON THE DECLARATION, WHICH IS THE ONLY OBSERVABLE THERE IS HERE: a
    // reversing direction is forbidden outright, rather than trying to infer painted
    // position from a DOM that has none.
    expect(['', 'row'], 'the account row reverses its visual order, so Sign out paints left of the switcher')
      .toContain(row.style.flexDirection);
  });

  it('⚠ renders NOTHING for an INELIGIBLE member — the paired negative', async () => {
    // A general-tier rep who is not switcher-eligible has no admin panel to return to.
    // ⚠ App.jsx decides this, once, against the live session; this screen receives null.
    // Without this case, "the switcher renders" would be satisfied by a screen that
    // draws it unconditionally — which would offer every rep a door to a panel they
    // cannot open.
    installFetch();
    render(
      <ThemeProvider context={CONTEXT} fetchStoredMode={async () => null}>
        <RepProfileScreen onLogout={() => {}} caps={caps()} switcher={null} />
      </ThemeProvider>
    );
    const signout = await screen.findByText('Sign out');
    expect(document.querySelector('[data-surface-switcher]')).toBeNull();
    expect(document.querySelector('[data-rep-switcher-slot]')).toBeNull();
    // ⚠ AND SIGN OUT STILL WORKS AND IS STILL IN ITS ROW — the row must not collapse
    // or mis-place when its first child is absent.
    expect(signout.closest('[data-rep-account-actions]')).toBeTruthy();
  });

  it('⚠ Sign out still fires when the switcher is beside it', async () => {
    // The destructive action is the one thing on this screen that must not become
    // harder to hit because a control moved next to it.
    installFetch();
    const onLogout = vi.fn();
    render(
      <ThemeProvider context={CONTEXT} fetchStoredMode={async () => null}>
        <RepProfileScreen
          onLogout={onLogout}
          caps={caps()}
          switcher={<button type="button" data-surface-switcher="admin">Switch to the admin panel</button>}
        />
      </ThemeProvider>
    );
    const signout = await screen.findByText('Sign out');
    fireEvent.click(signout);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('⚠ the switcher does not SHRINK when the row runs out of room', async () => {
    // "Must not read as subordinate" built structurally rather than hoped for. A
    // control compressed to fit beside a bigger neighbour is how subordinate gets
    // made by accident, so the row wraps SIGN OUT instead. jsdom cannot measure the
    // wrap; it can assert the declaration that causes it.
    withSwitcher();
    await screen.findByText('Sign out');
    const slot = document.querySelector('[data-rep-switcher-slot]');
    expect(slot.style.flexShrink).toBe('0');
    const row = document.querySelector('[data-rep-account-actions]');
    expect(row.style.flexWrap).toBe('wrap');
  });

  it('⚠ Sign out carries NO border — the switcher is the stronger object in the row', async () => {
    // The visual half of "not subordinate", asserted at declaration level. The
    // switcher is the only bordered control on this screen; Sign out is bare text.
    // ⚠ PAIRED, so this cannot pass by both being bare: the real SurfaceSwitcher
    // paints its own border, and this asserts Sign out declines one.
    // ⚠ `borderStyle`, NOT `border`. jsdom normalises the shorthand and reports
    // `style.border` as 'medium' for `border: none` — a shorthand that never expands
    // the way the author wrote it, which is the recorded jsdom limitation. Reading the
    // longhand is what the assertion actually means anyway: it is the STYLE that
    // decides whether an edge is drawn.
    withSwitcher();
    const signout = await screen.findByText('Sign out');
    expect(signout.style.borderStyle).toBe('none');
    expect(signout.style.background).toBe('none');
  });
});
