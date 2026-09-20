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
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
  it('an attributable rep is told their work can be credited to them', async () => {
    mount({ is_attributable: true });
    const row = await screen.findByTestId('rep-attribution');
    const text = row.textContent.toLowerCase();
    expect(text).toContain('attributable');
    expect(text).toContain('credited');
  });

  it('a NON-attributable rep is told plainly, without blame or a lock', async () => {
    mount({ is_attributable: false });
    const row = await screen.findByTestId('rep-attribution');
    const text = row.textContent.toLowerCase();
    expect(text).toContain('not attributable');
    for (const forbidden of ['locked', 'denied', 'no permission', 'restricted']) {
      expect(text).not.toContain(forbidden);
    }
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
    let next = row.nextElementSibling;
    while (next && next.getAttribute('aria-hidden') === 'true') next = next.nextElementSibling;
    expect(next, 'something sits between the theme row and Sign out').toBe(signOut);
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
