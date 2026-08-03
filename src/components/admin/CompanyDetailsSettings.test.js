// ─────────────────────────────────────────────────────────────────────────────
// COMPANY DETAILS SAVE-WIPE — PHASE 3 RED SUITE (FRONTEND, DEFENSE-IN-DEPTH)
//
// WHAT THIS PAGE DOES TODAY. CompanyDetailsSettings loads GET /api/admin/settings,
// copies NINE company_* fields out of the response into formData, and DISCARDS THE
// REST. handleSave then PUTs that nine-key formData verbatim. So the request the
// server sees never mentions the logo, the colours, the socials, the review block,
// the fonts, the app display name, the tagline, or the email sender name and
// footer.
//
// WHY THIS IS STILL WORTH FIXING NOW THAT THE SERVER IS SAFE. Phase 2 made
// PUT /api/admin/settings key-presence-driven: absent keys are preserved rather
// than NULLed (server/test/adminSettingsPartialSave.test.js). That fix is the
// root-cause fix and this one is not a substitute for it. It is a SECOND,
// INDEPENDENT LAYER: the page stops sending a partial payload at all, so the data
// survives even a server that reverts to full-row semantics. Two layers, because
// the failure this guards against is silent — an admin editing their phone number
// gets no error and no warning while their brand disappears.
//
// THE REFERENCE IMPLEMENTATION is BrandingProfileSettings.jsx: it keeps the whole
// GET payload in fullSettingsRef and saves { ...fullSettingsRef.current, ...formData }.
// This suite pins the same contract for this page.
//
// SPREAD ORDER IS PART OF THE CONTRACT, not an implementation detail, and the
// second test exists solely to pin it. The loaded settings must go FIRST and
// formData LAST — reverse them and the mount-time copy of every company field
// silently overwrites what the admin just typed. That bug would look exactly like
// "saving does nothing", which is the kind of thing that gets diagnosed as a
// backend problem for a week.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under `react-scripts test`, mirroring
// BrandingProfileSettings.test.js. `fetch` is the ONLY thing replaced, and it is
// replaced at the true external boundary: the component, its form state and its
// save path are all real. Nothing below asserts on the mock itself — every
// assertion reads THE REQUEST THE COMPONENT CHOSE TO SEND, which is the contract
// under test.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CompanyDetailsSettings from './CompanyDetailsSettings';

const SETTINGS_URL     = '/api/admin/settings';
const NOTIFICATION_URL = '/api/admin/notification-settings';
const ABOUT_URL        = '/api/admin/about';

// Branding values the page never displays. Distinctive on purpose: every one of
// them must survive the round trip through a form that has no field for it.
const LOADED_LOGO     = 'https://cdn.test.invalid/alpha/logo.png';
const LOADED_PRIMARY  = '#123456';
const LOADED_TAGLINE  = 'Refer your neighbors. Earn cash rewards.';
const LOADED_FOOTER   = 'Sent by Alpha Roofing Co.';

// Mirrors the COMPLETE GET /api/admin/settings response shape (admin/index.js:572-579),
// not just the fields these tests read. A partial fixture passes here and breaks
// in integration the moment the component reads a field the fixture omitted.
function settingsPayload(overrides = {}) {
  return {
    contractor_id: 'tnt-fixture-internal',
    company_name: 'Alpha Roofing Co',
    company_phone: '555-0100',
    company_email: 'hello@alpha.test.invalid',
    company_url: 'alpha.test.invalid',
    company_address: '1 Old Street',
    company_city: 'Oldtown',
    company_state: 'GA',
    company_zip: '30301',
    company_country: 'US',
    logo_url: LOADED_LOGO, app_logo_url: null,
    primary_color: LOADED_PRIMARY, secondary_color: '#654321', accent_color: '#ABCDEF',
    landing_bg_color: '#0E0E0E',
    social_facebook: 'https://facebook.test.invalid/alpha', social_instagram: null,
    social_google: null, social_nextdoor: null, social_website: null,
    review_url: 'https://reviews.test.invalid/alpha',
    review_button_text: 'Leave a Review',
    review_message: 'Enjoying the rewards? Leave us a quick review!',
    font_heading: 'Montserrat', font_body: 'Roboto',
    app_display_name: 'Alpha Rewards',
    tagline: LOADED_TAGLINE,
    email_sender_name: 'Alpha Roofing Co',
    email_footer_text: LOADED_FOOTER,
    created_at: null, updated_at: null,
    ...overrides,
  };
}

let calls;

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

// This page issues THREE fetches on mount, not one. All three are modelled, and
// an unmodelled URL throws rather than resolving to undefined — a silent
// `await r.json()` on a stub would surface three steps later as a confusing
// render failure.
//
// Note the ordering hazard the string matching avoids: '/api/admin/notification-settings'
// does NOT contain '/api/admin/settings' (the segment reads 'notification-settings'),
// so the two branches cannot capture each other's traffic.
function installFetch({ settings = settingsPayload() } = {}) {
  calls = [];
  global.fetch = jest.fn(async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body });
    const u = String(url);
    if (u.includes(NOTIFICATION_URL)) return jsonResponse({
      notification_email_payouts: null, notification_email_general: null, booking_email: null,
    });
    if (u.includes(ABOUT_URL)) return jsonResponse({
      enabled: false, booking_enabled: false, bio: null,
      years_in_business: null, service_area: null, google_place_id: null, certifications: [],
    });
    if (u.includes(SETTINGS_URL) && opts.method === 'PUT') return jsonResponse({ success: true });
    if (u.includes(SETTINGS_URL)) return jsonResponse(settings);
    throw new Error(`unexpected fetch to ${u} — the fixture does not model this call`);
  });
}

function callsTo(fragment, method) {
  return calls.filter(c => c.url.includes(fragment) && (!method || c.method === method));
}

// The parsed body of the last PUT to /api/admin/settings — i.e. exactly what the
// form chose to save. Every assertion in this file reads this rather than any
// internal state, because it is the only thing the server will ever see.
function lastSaveBody() {
  const puts = callsTo(SETTINGS_URL, 'PUT');
  if (puts.length === 0) throw new Error('the form never issued a save request');
  return JSON.parse(puts[puts.length - 1].body);
}

async function renderPage(options) {
  installFetch(options);
  sessionStorage.setItem('rb_admin_token', 'test-admin-token');
  const utils = render(<CompanyDetailsSettings />);
  // The page renders "Loading…" until the settings GET resolves. Waiting on a real
  // section heading is the precondition for every query below.
  await screen.findByText('Company Information');
  return utils;
}

// Locates a SettingsInput by its visible label and returns its <input>.
function textFieldByLabel(labelText) {
  const label = screen.getByText(labelText);
  const input = label.parentElement.querySelector('input, textarea');
  if (!input) throw new Error(`no input found for the field labelled "${labelText}"`);
  return input;
}

// "Save Changes" is the Company Information + Address save button specifically —
// the page has two other save buttons ("Save Notification Settings", "Save About
// Us") that write DIFFERENT endpoints and different tables. A query that found one
// of those would prove nothing about this contract.
async function save() {
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(callsTo(SETTINGS_URL, 'PUT').length).toBeGreaterThan(0));
}

afterEach(() => {
  sessionStorage.clear();
  delete global.fetch;
});

describe('Company Details save — merged full settings payload', () => {

  it('[RED] a save carries the branding fields loaded from GET, not just the 9 company fields', async () => {
    // ── THE TEST THIS FILE EXISTS FOR ──────────────────────────────────────────
    // The ordinary admin session: open Company Details, correct the phone number,
    // press Save. Today the PUT body contains exactly nine keys, so every branding
    // value the page loaded is simply absent from the request.
    await renderPage();

    fireEvent.change(textFieldByLabel('Phone Number'), { target: { value: '555-0200' } });
    await save();

    const body = lastSaveBody();

    // NON-VACUITY: prove this is a real save carrying the admin's edit. A PUT of an
    // empty object, or one the component never sent, would satisfy several of the
    // assertions below while proving nothing at all.
    expect(body.company_phone).toBe('555-0200');
    expect(body.company_name).toBe('Alpha Roofing Co');

    // THE CONTRACT: the fields the page does not display must still be present,
    // carrying the values GET supplied. Named individually rather than by a
    // whole-object comparison so a failure says WHICH value was dropped.
    expect(body.logo_url).toBe(LOADED_LOGO);
    expect(body.primary_color).toBe(LOADED_PRIMARY);
    expect(body.tagline).toBe(LOADED_TAGLINE);
    expect(body.email_footer_text).toBe(LOADED_FOOTER);
  });

  it('[GUARD] the merge does not clobber the admin\'s edits with the loaded values', async () => {
    // SPREAD ORDER, pinned. { ...fullSettings, ...formData } and
    // { ...formData, ...fullSettings } both make the test above pass — the second
    // one also throws away everything the admin typed, because every company field
    // exists in the loaded payload too and would win the merge.
    //
    // Two edited fields, not one, so the behaviour cannot be satisfied by a
    // special case; plus an untouched field, to prove the merge is still supplying
    // loaded values rather than the component having abandoned the ref entirely.
    await renderPage();

    // NON-VACUITY: the new values must differ from what GET supplied, or "the edit
    // won" is indistinguishable from "the loaded value happened to match".
    expect(settingsPayload().company_phone).not.toBe('555-0200');
    expect(settingsPayload().company_city).not.toBe('Newtown');

    fireEvent.change(textFieldByLabel('Phone Number'), { target: { value: '555-0200' } });
    fireEvent.change(textFieldByLabel('City'),         { target: { value: 'Newtown' } });
    await save();

    const body = lastSaveBody();
    expect(body.company_phone).toBe('555-0200');
    expect(body.company_city).toBe('Newtown');

    // The untouched company field still carries its loaded value, and so does a
    // branding field the page never displays.
    expect(body.company_name).toBe('Alpha Roofing Co');
    expect(body.logo_url).toBe(LOADED_LOGO);
  });
});
