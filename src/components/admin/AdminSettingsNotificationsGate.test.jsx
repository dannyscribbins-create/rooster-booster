// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.4 — SCOPE ITEM 2: THE SEND GATE (frontend). PHASE 1, RED FIRST.
//
// The card that decides whether a matched referral produces any outbound
// message at all. It is the reason the wave is safe to deploy: the matcher can
// land, resolve the backlog, and send nothing until a human opens the gate.
//
// ── WHY DEFAULT-OFF IS THE HARD PART, AND IT IS NOT A COPY CHANGE ────────────
// Every other toggle on this page ships ON, and that default is baked into the
// shared control itself — NotifToggle computes `const on = checked !== false`,
// so a key the server has never heard of renders as ON. The call sites repeat
// the same expression (`checked={prefs[item.key] !== false}`). A new card
// dropped into REFERRER_GROUPS therefore ships ON, silently, and the first
// thing it does is mail every referrer in the backlog.
//
// This is CLAUDE.md's predicate rule in its exact form: the guard must match
// its own value's shape, not its siblings' form. N3 is that rule as a test.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under Vitest, mirroring AdminTeamSettings
// .test.jsx. `fetch` is the only thing replaced, at the true external boundary.
// Controls are queried by role + accessible name rather than by walking the DOM
// from a label, so a layout change cannot silently retarget a test at the wrong
// switch. That requires the new switch to HAVE an accessible name — the
// existing ones do not, and N1 pins it.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import AdminSettingsNotifications from './AdminSettingsNotifications';
import BrandingProvider from '../shared/BrandingProvider';

// The contract Phase 1 fixes. Phase 2 may rename it, but only deliberately.
const GATE_KEY    = 'referral_match_outreach';
const GATE_LABEL  = 'Referral match outreach';
const GATE_ANCHOR = 'notif-referral-match-outreach';

// The ruled copy, verbatim. Anchored on the surrounding phrase rather than on a
// fragment, because a bare fragment cannot see a defect in the text around it.
const GATE_SUBCOPY =
  'Sent to both referrer and referred when a referral is matched to a referrer in your system. Both receive an invite to join the program.';
const GATE_OFF_EXPLAINER =
  'Off until you are ready to invite referrers mentioned in a referral’s profile.';

let putBodies = [];

function mockFetch({ prefs = {} } = {}) {
  putBodies = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const u = String(url);
    if (opts.method === 'PUT' || opts.method === 'POST') {
      putBodies.push({ url: u, body: JSON.parse(opts.body || '{}') });
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (u.includes('/api/admin/notification-preferences')) {
      return { ok: true, json: async () => prefs };
    }
    if (u.includes('/api/admin/engagement-cadence')) {
      return { ok: true, json: async () => [] };
    }
    if (u.includes('/api/admin/announcement-settings')) {
      return { ok: true, json: async () => ({ enabled: true, mode: 'preset_1', custom_message: '' }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

const mount = () =>
  render(
    <BrandingProvider supplied={null}>
      <AdminSettingsNotifications />
    </BrandingProvider>
  );

describe('Wave 0.4 item 2 — the referral match outreach send gate (RED first)', () => {
  beforeEach(() => { mockFetch(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('N1 — the card exists in Email Notifications, with a switch that has an accessible name (RED: no such card; and the existing switches are bare role="switch" buttons with no name, so the new one must be queryable by name for every test below to target the right control)', async () => {
    mount();
    expect(await screen.findByText(GATE_LABEL)).toBeTruthy();
    const sw = await screen.findByRole('switch', { name: new RegExp(GATE_LABEL, 'i') });
    expect(sw).toBeTruthy();
  });

  it('N2 — the sub-copy states that BOTH parties are contacted (RED: no such copy; and it matters because one toggle covers two different messages to two different people — the invite to the referrer and the credit-attribution email to the referred client)', async () => {
    mount();
    expect(await screen.findByText(GATE_SUBCOPY)).toBeTruthy();
  });

  // ⚠ THE ONE THAT WILL SHIP WRONG IF IT IS NOT PINNED.
  // VACUITY CHECK: could this pass against unfixed code? No — the card does not
  // exist, so findByRole throws. And once the card exists, it can only pass if
  // the implementation deliberately breaks from NotifToggle's `checked !== false`.
  it('N3 — with NO server row for this key, the switch renders OFF (RED: NotifToggle hardcodes `checked !== false`, so an unknown key renders ON — a new card dropped into REFERRER_GROUPS ships ON and mails the entire backlog)', async () => {
    mockFetch({ prefs: {} }); // server has never heard of this key
    mount();
    const sw = await screen.findByRole('switch', { name: new RegExp(GATE_LABEL, 'i') });
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  // Non-vacuity partner for N3. If the switch were hardcoded to render OFF, N3
  // would pass and mean nothing; this fails.
  it('N4 — with an explicit true from the server, the switch renders ON (the partner that stops N3 from being satisfied by a switch that is simply always off)', async () => {
    mockFetch({ prefs: { [GATE_KEY]: true } });
    mount();
    const sw = await screen.findByRole('switch', { name: new RegExp(GATE_LABEL, 'i') });
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('N5 — the card explains WHY it is off, since an off toggle on a page where everything else ships on reads as broken (RED: no such copy)', async () => {
    mount();
    expect(await screen.findByText(GATE_OFF_EXPLAINER)).toBeTruthy();
  });

  it('N6 — toggling the card persists under the agreed trigger key (RED: no card, so nothing is sent; pins the key the server-side gate reads)', async () => {
    mockFetch({ prefs: {} });
    mount();
    const sw = await screen.findByRole('switch', { name: new RegExp(GATE_LABEL, 'i') });
    fireEvent.click(sw);
    await waitFor(() => expect(putBodies.length).toBeGreaterThan(0));
    const put = putBodies.find(p => p.body.trigger_key === GATE_KEY);
    expect(put, `expected a PUT carrying trigger_key="${GATE_KEY}" — got ${JSON.stringify(putBodies.map(p => p.body))}`).toBeTruthy();
    expect(put.body.email_enabled).toBe(true);
  });

  // Scope item 4's landing half. The banner on a held Pending Referrals row
  // links here; this is the target it links TO.
  it('N7 — the card carries the anchor id the deeplink targets (RED: no anchor exists, so item 4 has nowhere to land)', async () => {
    const { container } = mount();
    await screen.findByText('Email Notifications');
    const anchor = container.querySelector(`#${GATE_ANCHOR}`);
    expect(anchor, `expected an element with id="${GATE_ANCHOR}" for the Pending Referrals banner to link to`).toBeTruthy();
  });
});
