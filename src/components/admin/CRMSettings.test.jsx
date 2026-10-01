// ─────────────────────────────────────────────────────────────────────────────
// CRM SETTINGS MOUNTS — AND IT SHIPPED A PRODUCTION CRASH BECAUSE NOTHING MOUNTED IT
//
// ⚠ WHAT HAPPENED: Commit B rewrote the Referrer Field Mapping card and used `crmDisplayName` in
// THREE places inside `renderFieldMappingCard()`. That identifier was declared inside
// `renderCampaignFieldMappingCard()` — a DIFFERENT function — so it was not in scope, and the card
// threw `ReferenceError: crmDisplayName is not defined`. Because that card renders whenever
// `isConnected && !tokenError`, the error boundary blanked the ENTIRE page on every visit, surviving
// refresh. Logged in production 2026-10-01 16:58:43 UTC.
//
// ⚠ `npm run lint` COULD NOT CATCH IT, BY DESIGN, AND THAT IS THE POINT OF THIS FILE. The ESLint
// config is react-hooks rules only — CLAUDE.md says never add a recommended preset — so `no-undef`
// is not in the gate. A clean lint shipped a ReferenceError. The only thing that catches an
// out-of-scope identifier in a render path is RENDERING IT.
//
// ⚠ AND THE GAP WAS NAMED IN THE COMMIT THAT FELL INTO IT. Commit B's own report said "no React test
// mounts CRMSettings" — stated as a reassurance that the React count would not move, and it was
// simultaneously the reason the crash could ship. **A noticed absence is not a covered one.**
// This is CLAUDE.md's "any file a sweep touches needs at least one render test, however trivial" with
// the sweep being a rewrite.
//
// ⚠ THE FIXTURES ARE PRODUCTION SHAPES, READ FROM THE LIVE TENANT, NOT INVENTED. Accent's nine
// `ALL_CLIENTS` configurations include six ARCHIVED rows, TWO sharing the label `Source`, and
// `Referred by Chuck Rigdon` whose label is a superset of the one that is meant. The second contractor
// row holds 17 fields with `entity` NULL (pre-7c-1 discovery, never re-run), which is the case a
// filter on entity must survive rather than crash on.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CRMSettings from './CRMSettings';

const CFG = (type, n) => btoa(`gid://Jobber/CustomFieldConfiguration${type}/${n}`);

// Accent's real ALL_CLIENTS set, label-for-label, with the real archived flags.
const CLIENT_FIELDS = [
  { jobber_field_id: CFG('Text', '2508867'), label: 'Campaign', field_type: 'text', entity: 'ALL_CLIENTS', archived: true, transferable: false },
  { jobber_field_id: CFG('Dropdown', '681760'), label: 'Insurance Company', field_type: 'dropdown', entity: 'ALL_CLIENTS', archived: false, transferable: true },
  { jobber_field_id: CFG('Text', '2508864'), label: 'Lead Status', field_type: 'text', entity: 'ALL_CLIENTS', archived: true, transferable: false },
  { jobber_field_id: CFG('Text', '2508866'), label: 'Medium', field_type: 'text', entity: 'ALL_CLIENTS', archived: true, transferable: false },
  { jobber_field_id: CFG('Text', '3655374'), label: 'Referred by', field_type: 'text', entity: 'ALL_CLIENTS', archived: false, transferable: false },
  { jobber_field_id: CFG('Text', '2519789'), label: 'Referred by Chuck Rigdon', field_type: 'text', entity: 'ALL_CLIENTS', archived: true, transferable: false },
  { jobber_field_id: CFG('Text', '2508865'), label: 'Source', field_type: 'text', entity: 'ALL_CLIENTS', archived: true, transferable: false },
  { jobber_field_id: CFG('Dropdown', '89729'), label: 'Source', field_type: 'dropdown', entity: 'ALL_CLIENTS', archived: false, transferable: false },
  { jobber_field_id: CFG('Link', '2508868'), label: 'Timeline URL', field_type: 'link', entity: 'ALL_CLIENTS', archived: true, transferable: false },
];

// Other entities, including the THREE same-labelled "Job Type" configurations that 7c-1 exists for.
const OTHER_FIELDS = [
  { jobber_field_id: CFG('Dropdown', '730114'), label: 'Job Type', field_type: 'dropdown', entity: 'ALL_JOBS', archived: false, transferable: true },
  { jobber_field_id: CFG('Dropdown', '730115'), label: 'Job Type', field_type: 'dropdown', entity: 'ALL_INVOICES', archived: false, transferable: false },
  { jobber_field_id: CFG('Dropdown', '1573072'), label: 'Job Type', field_type: 'dropdown', entity: 'ALL_QUOTES', archived: false, transferable: false },
  // ⚠ ENTITY NULL IS A REAL STORED STATE, not a defensive invention: the second contractor row holds
  // 17 fields discovered before 7c-1 added the column. A card that filters on entity meets these.
  { jobber_field_id: CFG('Text', '9000001'), label: 'Pre-7c-1 Field', field_type: 'text', entity: null, archived: null, transferable: null },
  { jobber_field_id: CFG('Text', '9000002'), label: 'Referred by', field_type: 'text', entity: null, archived: null, transferable: null },
];

const ALL_FIELDS = [...CLIENT_FIELDS, ...OTHER_FIELDS].map(f => ({
  ...f,
  // The server adds this; "Job Type (Job)" is what makes three same-named rows pickable.
  display_label: f.entity
    ? `${f.label} (${{ ALL_CLIENTS: 'Client', ALL_JOBS: 'Job', ALL_INVOICES: 'Invoice', ALL_QUOTES: 'Quote' }[f.entity] || f.entity})${f.archived ? ' — archived in Jobber' : ''}`
    : f.label,
}));

const PICKED = {
  fieldId: CFG('Text', '3655374'), entity: 'ALL_CLIENTS', label: 'Referred by',
  displayLabel: 'Referred by (Client)', archived: false, missing: false, legacy: false,
};

/** Accent's live /crm/status shape. `referralSourceField` is Commit B's addition. */
const status = (over = {}) => ({
  contractorId: 'accent-roofing-dev',
  isConnected: true,
  crmType: 'jobber',
  crmAccountName: 'Accent Roofing Service',
  connectionMethod: 'oauth',
  referrerFieldName: 'Referred by',
  referralSourceField: PICKED,
  stageMap: { lead: 'Quote Sent', inspection: 'Assessment Scheduled', sold: 'Job Approved', paid: 'Invoice Paid' },
  connectedAt: '2026-05-01T00:00:00Z',
  referralStartDate: '2026-06-01T00:00:00Z',
  lastSyncedAt: '2026-10-01T16:40:00Z',
  syncIntervalMins: 30,
  tokenStatus: { ok: true },
  attributionSource: 'assessment_assigned_users',
  tagGroupVisibility: {},
  ...over,
});

function installFetch({ statusOver = {}, fields = ALL_FIELDS, mappings = {} } = {}) {
  return vi.fn(async (url) => {
    const u = String(url);
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes('/api/admin/crm/status')) return ok(status(statusOver));
    if (u.includes('/api/admin/jobber/fields')) return ok({ fields });
    if (u.includes('/api/admin/jobber/field-mappings')) return ok({ mappings });
    if (u.includes('/api/admin/jobber-import-status')) return ok({ state: 'idle' });
    if (u.includes('/api/admin/jobber-client-tag-summary')) return ok({ groups: [] });
    // Anything else this screen loads: a well-formed empty answer rather than a throw, so an
    // unlisted endpoint cannot be mistaken for the defect under test.
    return ok({});
  });
}

const realFetch = globalThis.fetch;
beforeEach(() => { localStorage.setItem('rm_admin_token', 'test-token'); });
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); localStorage.clear(); });

/**
 * Mount and wait for the page to settle.
 * ⚠ IT ASSERTS THE PAGE RENDERED ITS OWN CONTENT, not merely that render() returned. A component that
 * throws during render in React 18 leaves an EMPTY container rather than raising out of `render()`, so
 * "it did not throw" is not evidence — the crash this file exists for would pass such a check.
 */
async function mountSettled(opts) {
  globalThis.fetch = installFetch(opts);
  const view = render(<CRMSettings />);
  await waitFor(() => {
    expect(view.container.textContent).toMatch(/Referrer Field/i);
  });
  return view;
}

describe('CRMSettings mounts with production-shaped data', () => {
  it('🔴 renders the whole page without throwing — the crash Commit B shipped', async () => {
    // ⚠ THIS IS THE REGRESSION CASE. Before the fix, `renderFieldMappingCard()` threw
    // `ReferenceError: crmDisplayName is not defined` and the container came back EMPTY.
    const errors = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a.join(' ')); });

    const { container } = await mountSettled();

    // The three cards that follow the crashing one must all be present — if Card 3 throws, React
    // unmounts the whole tree and none of these exist.
    expect(container.textContent).toMatch(/Referrer Field Mapping/i);
    expect(container.textContent).toMatch(/Pipeline Stage Mapping/i);
    expect(container.textContent).toMatch(/CRM FIELD MAPPING/i);

    // And no ReferenceError reached the console, which is where React reports a render throw.
    expect(errors.join('\n')).not.toMatch(/ReferenceError/);
    expect(errors.join('\n')).not.toMatch(/crmDisplayName/);
  });

  it('the CRM display name actually renders in Card 3 — the identifier resolves, not merely exists', async () => {
    // ⚠ A PAIRED POSITIVE, BECAUSE "it did not crash" is satisfied by deleting the reference. The
    // copy names the CRM, so the value has to reach the card for this to pass.
    const { container } = await mountSettled();
    const card = container.textContent;
    expect(card).toMatch(/Which field in Jobber does your team use/i);
  });

  it('offers only CLIENT fields, and never a job/invoice/quote one', async () => {
    await mountSettled();
    const select = await screen.findByLabelText(/Referrer Field/i);
    const labels = [...select.querySelectorAll('option')].map(o => o.textContent);

    expect(labels.some(l => /Referred by \(Client\)/.test(l))).toBe(true);
    expect(labels.some(l => /Insurance Company \(Client\)/.test(l))).toBe(true);
    // ⚠ THE THREE "Job Type" CONFIGURATIONS MUST NOT BE OFFERED. A referrer is named on the CLIENT, so
    // a job-entity field could never match a client record — the server refuses one, and the picker
    // must not propose it in the first place.
    expect(labels.some(l => /Job Type/.test(l))).toBe(false);
  });

  it('survives fields whose entity is NULL rather than filtering them in or crashing', async () => {
    // The pre-7c-1 rows. `f.entity === 'ALL_CLIENTS'` is false for null, which is correct — but the
    // page must still render, and the null-entity `Referred by` must NOT appear as an option.
    await mountSettled();
    const select = await screen.findByLabelText(/Referrer Field/i);
    const labels = [...select.querySelectorAll('option')].map(o => o.textContent);
    expect(labels.some(l => /Pre-7c-1 Field/.test(l))).toBe(false);
    // Exactly ONE "Referred by" client option, despite a same-labelled null-entity row existing.
    expect(labels.filter(l => /^Referred by \(Client\)/.test(l)).length).toBe(1);
  });

  it('shows ARCHIVED fields as archived, so an admin can tell a dead field from a live one', async () => {
    await mountSettled();
    const select = await screen.findByLabelText(/Referrer Field/i);
    const labels = [...select.querySelectorAll('option')].map(o => o.textContent);
    expect(labels.some(l => /Referred by Chuck Rigdon.*archived/i.test(l))).toBe(true);
    // ⚠ AND THE LIVE ONE IS NOT MARKED. Without this the assertion above passes on a page that labels
    // everything archived.
    expect(labels.some(l => /^Referred by \(Client\)$/.test(l))).toBe(true);
  });

  it('names the LEGACY FALLBACK option rather than showing a blank choice', async () => {
    // ⚠ CHOOSING NOTHING IS LEGITIMATE and keeps the stored-name behaviour. An admin must be able to
    // see WHICH name that is without reading the code.
    await mountSettled();
    const select = await screen.findByLabelText(/Referrer Field/i);
    const fallback = [...select.querySelectorAll('option')].find(o => o.value === '');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toMatch(/Use the saved name/i);
    expect(fallback.textContent).toMatch(/Referred by/);
  });

  it('pre-selects the picked field from referralSourceField', async () => {
    await mountSettled();
    const select = await screen.findByLabelText(/Referrer Field/i);
    expect(select.value).toBe(PICKED.fieldId);
  });

  it('warns when the picked field is ARCHIVED, and still shows it selected', async () => {
    await mountSettled({ statusOver: { referralSourceField: {
      ...PICKED, fieldId: CFG('Text', '2519789'), label: 'Referred by Chuck Rigdon',
      displayLabel: 'Referred by Chuck Rigdon (Client) — archived in Jobber', archived: true,
    } } });
    expect(document.querySelector('[data-referral-field-warning="archived"]')).toBeTruthy();
    const select = await screen.findByLabelText(/Referrer Field/i);
    expect(select.value).toBe(CFG('Text', '2519789'));
  });

  it('warns when the picked field is MISSING, and keeps it selected rather than silently unsetting it', async () => {
    // ⚠ THE CASE THAT MUST NOT LOOK LIKE "nothing chosen". Dropping an undiscovered pick from the list
    // would invite an admin to re-pick a setting that was never broken.
    const vanished = CFG('Text', '999999');
    await mountSettled({ statusOver: { referralSourceField: {
      fieldId: vanished, entity: 'ALL_CLIENTS', label: 'Gone Away',
      displayLabel: 'Gone Away — no longer found in Client', archived: false, missing: true, legacy: false,
    } } });
    expect(document.querySelector('[data-referral-field-warning="missing"]')).toBeTruthy();
    const select = await screen.findByLabelText(/Referrer Field/i);
    expect(select.value).toBe(vanished);
  });

  it('shows NEITHER warning for a healthy pick', async () => {
    // The paired negative: without it, the two warning cases pass on a page that always warns.
    await mountSettled();
    expect(document.querySelector('[data-referral-field-warning="archived"]')).toBeNull();
    expect(document.querySelector('[data-referral-field-warning="missing"]')).toBeNull();
  });

  it('renders with NO discovered fields at all, telling the admin to run discovery', async () => {
    // The other contractor's state, and every brand-new one: discovery has never run.
    await mountSettled({ fields: [], statusOver: { referralSourceField: {
      fieldId: null, entity: null, label: 'Referred by', displayLabel: 'Referred by',
      archived: false, missing: false, legacy: true,
    } } });
    expect(screen.getByText(/No client fields discovered yet/i)).toBeTruthy();
    const select = await screen.findByLabelText(/Referrer Field/i);
    expect(select.disabled).toBe(true);
  });

  it('renders when the server sends NO referralSourceField at all — an older payload', async () => {
    // ⚠ FORWARD/BACKWARD SAFETY: the field is new, and a cached or older server response omits it.
    // `picked?.missing` on undefined must not throw.
    await mountSettled({ statusOver: { referralSourceField: undefined } });
    const select = await screen.findByLabelText(/Referrer Field/i);
    expect(select.value).toBe('');
    expect(document.querySelector('[data-referral-field-warning="missing"]')).toBeNull();
  });
});
