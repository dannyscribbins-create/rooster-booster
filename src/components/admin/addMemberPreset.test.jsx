// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c — PHASE 2b — RULING A(ii): THE PRESET KEEPS ITS PROMISE
//
// The `field_rep` preset reads: tier 'general', permissions {}, blurb "No admin
// panel access. Rep tracking and attribution only." — and it did not set
// `is_field_rep`. It promised rep tracking and attribution and delivered
// NEITHER.
//
// ⚠ THAT IS ONE STEP FROM THE NORMAL FLOW, WHICH IS WHY IT IS A RULING AND NOT A
// POLISH ITEM. Create from the preset literally named "Field Rep", send the
// invite, stop there — the obvious reading of that blurb — and the member signs
// in to an admin panel that refuses them everything. `is_field_rep` has ONE
// writer, POST /:id/promote, reached from a DIFFERENT modal, and nothing linked
// the two.
//
// ⚠ AND IT DOES NOT REPLACE RULING A(i). promote requires `rep_promotion`, which
// team.manage deliberately does not confer, so an Admin who may invite but not
// promote still creates a member with neither permissions nor the flag. That
// path still lands in the dead end and A(i)'s message is what catches it. The
// last case below is that path, and it is the reason both halves ship.
//
// ── ⚠ THERE WAS NO CREATE-FLOW COVERAGE AT ALL BEFORE THIS FILE ────────────
// AdminTeamSettings.test.jsx covers the edit drawer thoroughly and never opens
// AddMemberModal. The two-call create sequence — POST /api/admin/team, then POST
// /:id/permissions — has been shipping untested since it was written.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AdminTeamSettings from './AdminTeamSettings';
import { AdminPermissionsContext } from '../../hooks/useAdminPermissions';

const NEW_ID = 4242;
let calls;
let promoteStatus;

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// ⚠ ORDER-SENSITIVE, for the reason AdminTeamSettings.test.jsx records: both
// '/api/admin/team/flagged-assignments' and '/api/admin/team/4242/promote'
// contain '/api/admin/team', so every specific branch precedes the roster one.
// An unmodelled URL THROWS rather than resolving to undefined.
function installFetch() {
  calls = [];
  promoteStatus = 200;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    calls.push({ url: u, method, body: opts.body });

    if (u.includes('/flagged-assignments')) return jsonResponse({ flags: [] });
    if (u.includes('/api/admin/jobber-users')) return jsonResponse({ users: [], totalCount: 0 });
    if (u.includes('/api/admin/titles')) return jsonResponse([]);
    if (u.includes('/promote')) {
      return promoteStatus === 200
        ? jsonResponse({ id: NEW_ID, is_field_rep: true })
        : jsonResponse({ error: 'Access denied' }, promoteStatus);
    }
    if (u.includes('/permissions')) return jsonResponse({ success: true });
    if (u.includes('/api/admin/team') && method === 'POST') {
      return jsonResponse({ id: NEW_ID, email: 'new@rep.test', invite_sent: true });
    }
    if (u.includes('/api/admin/team')) return jsonResponse([]);
    throw new Error(`unexpected fetch to ${u} — the fixture does not model this call`);
  });
}

const callsTo = (fragment, method) =>
  calls.filter(c => c.url.includes(fragment) && (!method || c.method === method));

// Opens the roster as an Owner and walks the add-member modal to the point of
// submission with the named preset.
async function createWith(presetName) {
  render(
    <AdminPermissionsContext.Provider
      value={{ tier: 'owner', permissions: {}, loading: false, full_name: 'O', email: 'o@t.invalid' }}
    >
      <AdminTeamSettings />
    </AdminPermissionsContext.Provider>
  );

  fireEvent.click(await screen.findByText('Add Member'));
  fireEvent.click(await screen.findByText(presetName));
  fireEvent.change(screen.getByPlaceholderText(/jane@yourcompany/i), { target: { value: 'new@rep.test' } });
  fireEvent.change(screen.getByPlaceholderText(/Jane Smith/i), { target: { value: 'New Rep' } });
  fireEvent.click(screen.getByText(/Create Member/i));
}

beforeEach(() => {
  sessionStorage.setItem('rb_admin_token', 'test-admin-token');
  installFetch();
});

afterEach(() => {
  delete global.fetch;
  sessionStorage.clear();
  localStorage.clear();
});

describe('C/DL-3c Phase 2b — the Field Rep preset sets is_field_rep', () => {

  it('[RED] creating from the Field Rep preset calls POST /:id/promote with is_field_rep true', async () => {
    await createWith('Field Rep');

    await waitFor(() => expect(callsTo('/promote', 'POST').length).toBe(1));
    const body = JSON.parse(callsTo('/promote', 'POST')[0].body);
    expect(body.is_field_rep).toBe(true);

    // ⚠ THE ORDER MATTERS AND IS ASSERTED. promote judges coherence on the MERGED
    // state and the member must exist first; a promote before the create would
    // 404, and a promote before the permissions stamp would be reordering two
    // writes whose failure messages differ.
    const seq = calls.filter(c => c.method === 'POST').map(c => c.url);
    expect(seq.findIndex(u => u.includes('/permissions')))
      .toBeLessThan(seq.findIndex(u => u.includes('/promote')));
  });

  it('[RED] GUARD — a NON-rep preset calls promote NOT AT ALL', async () => {
    // ⚠ WITHOUT THIS, "the rep preset promotes" is satisfied by a create flow
    // that promotes EVERYBODY — which would hand office staff an attribution
    // flag and route them onto a surface built for someone else.
    await createWith('Internal Team');

    await waitFor(() => expect(callsTo('/permissions', 'POST').length).toBe(1));
    expect(callsTo('/promote', 'POST')).toEqual([]);
  });

  it('[RED] the preset does NOT grant is_attributable — that stays a deliberate act', async () => {
    // Ruled separately: keeping the promise means the ROUTING half only. See the
    // file header in AdminTeamSettings.jsx for the argument.
    await createWith('Field Rep');

    await waitFor(() => expect(callsTo('/promote', 'POST').length).toBe(1));
    const body = JSON.parse(callsTo('/promote', 'POST')[0].body);
    expect(body.is_attributable, 'attribution drives payouts and is granted by a human').not.toBe(true);
  });

  it('[RED] when promote is REFUSED the message names what did not happen', async () => {
    // ⚠ THE PATH THAT KEEPS BOTH HALVES OF RULING A ALIVE. promote requires
    // rep_promotion; team.manage deliberately does not confer it. An Admin who
    // can invite but not promote produces a created-but-unpromoted member — who
    // lands in exactly the dead end A(i)'s message catches.
    //
    // Three sequential calls means three partial states, so a generic failure is
    // not actionable. The message must say WHICH half did not happen and WHO can
    // finish it.
    promoteStatus = 403;
    await createWith('Field Rep');

    const msg = await screen.findByText(/not marked as a field rep/i);
    expect(msg).toBeTruthy();
    expect(msg.textContent).toMatch(/owner/i);

    // The member still exists — the failure is partial, and saying otherwise
    // would send the admin to create a duplicate.
    //
    // ⚠ ANCHORED ON THE END OF THE PATH, NOT ON A SUBSTRING. `/api/admin/team`
    // is a prefix of `/api/admin/team/4242/permissions` AND of
    // `.../4242/promote`, so the loose form counted all three and reported 3.
    // The toContain-on-a-bare-value trap, in a URL.
    const creates = calls.filter(c => c.method === 'POST' && /\/api\/admin\/team$/.test(c.url));
    expect(creates.length, 'exactly one member should have been created').toBe(1);
  });
});
