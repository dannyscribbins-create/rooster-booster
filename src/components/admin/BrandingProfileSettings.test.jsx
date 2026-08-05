// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3c RED SUITE — ADMIN BRANDING FORM: LOGO UPLOAD + BACKGROUND
//
// TWO CONTROLS THAT DO NOT EXIST YET, and one landmine between them.
//
//   (a) LOGO UPLOAD. POST /api/admin/branding/logo shipped in Phase 3b and works
//       — server/test/logoUpload.test.js proves it. Nothing calls it. The Brand
//       Logos section displays the current logos read-only and says "Logo uploads
//       coming soon — contact support to update" (BrandingProfileSettings.jsx:455).
//
//   (b) landing_bg_color PICKER. GET and PUT /api/admin/settings both carry the
//       column as of Phase 3b, and the public landing page reads it. The form has
//       no field for it, so no admin can set it.
//
// ── THE LANDMINE, and why it is the reason this file exists ──────────────────
//
// handleSave (BrandingProfileSettings.jsx:319-347) sends
//
//     { ...fullSettingsRef.current, ...formData }
//
// where fullSettingsRef.current is the GET payload captured ON MOUNT. logo_url is
// NOT in formData — it lives in a separate `logoData` state — so the value that
// gets PUT is always the one loaded at mount time.
//
// PUT /api/admin/settings is a FULL-ROW UPSERT: every column it names is written
// on every call, absent keys mapping to NULL. So the ordinary admin session
//
//     open Branding (logo_url: null)  ->  upload a logo  ->  edit the tagline
//     ->  press Save
//
// writes logo_url = null and DESTROYS THE LOGO THAT WAS JUST UPLOADED. Adding the
// upload control without also refreshing what the save sends is therefore STRICTLY
// WORSE THAN SHIPPING NOTHING: today the feature is merely absent; then it would
// appear to work and silently undo itself one save later.
//
// This is the same failure shape as the landing_bg_color landmine
// (server/test/adminSettingsBranding.test.js:299) and is proven INDEPENDENTLY,
// because the two columns reach the row by different routes: landing_bg_color was
// missing from GET; logo_url is written by a SEPARATE ENDPOINT the form's loaded
// copy knows nothing about.
//
// WHY THE FIX CANNOT BE ON THE SERVER: proven in
// server/test/brandingSaveRoundTrip.test.js's [CHARACTERIZATION] test. The server
// was told to write null and did. Distinguishing "the client means null" from
// "the client's copy is stale" requires a partial-update protocol, which would
// break the full-row semantics landing_bg_color's guarantee rests on.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under `react-scripts test`, following the repo's
// only existing component test (src/App.test.js). ⚠ Runs under
// `npm run test:react`, NOT under `npm test` — see the note in
// BrandingPreview.test.js.
//
// `fetch` is the ONLY thing replaced, and it is replaced at the true external
// boundary: the component, its child BrandingPreview, its form state and its save
// path are all real. Nothing below asserts on the mock itself — every assertion
// reads the REQUEST THE COMPONENT CHOSE TO SEND, which is the contract under test.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BrandingProfileSettings from './BrandingProfileSettings';

const SETTINGS_URL = '/api/admin/settings';
const LOGO_URL     = '/api/admin/branding/logo';

const OLD_LOGO = 'https://cdn.test.invalid/alpha/old-logo.png';
const NEW_LOGO = 'https://cdn.test.invalid/alpha/1700000000-abcd1234-logo.png';

// Mirrors the COMPLETE GET /api/admin/settings response shape (admin/index.js:572-579),
// not just the fields these tests read. A partial fixture passes here and breaks
// in integration the moment the component reads a field the fixture omitted.
function settingsPayload(overrides = {}) {
  return {
    contractor_id: 'tnt-fixture-internal',
    company_name: 'Alpha Roofing Co',
    company_phone: '555-0100', company_email: 'hello@alpha.test.invalid', company_url: null,
    company_address: null, company_city: null, company_state: null,
    company_zip: null, company_country: 'US',
    logo_url: OLD_LOGO, app_logo_url: null,
    primary_color: '#123456', secondary_color: '#654321', accent_color: '#ABCDEF',
    landing_bg_color: null,
    social_facebook: null, social_instagram: null, social_google: null,
    social_nextdoor: null, social_website: null,
    review_url: null, review_button_text: 'Leave a Review',
    review_message: 'Enjoying the rewards? Leave us a quick review!',
    font_heading: 'Montserrat', font_body: 'Roboto',
    app_display_name: 'Alpha Rewards', tagline: 'Refer your neighbors. Earn cash rewards.',
    email_sender_name: null, email_footer_text: null,
    created_at: null, updated_at: null,
    ...overrides,
  };
}

let calls;

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function installFetch({ settings = settingsPayload(), uploadedLogo = NEW_LOGO } = {}) {
  calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body });
    const u = String(url);
    if (u.includes(LOGO_URL))     return jsonResponse({ success: true, logo_url: uploadedLogo });
    if (u.includes(SETTINGS_URL) && (opts.method === 'PUT')) return jsonResponse({ success: true });
    if (u.includes(SETTINGS_URL)) return jsonResponse(settings);
    if (u.includes('/api/admin/invite-links')) return jsonResponse([]);
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

async function renderForm(options) {
  installFetch(options);
  sessionStorage.setItem('rb_admin_token', 'test-admin-token');
  const utils = render(<BrandingProfileSettings />);
  // The form renders "Loading…" until both mount fetches resolve. Waiting for a
  // real section heading is the precondition for every query below.
  await screen.findByText('Brand Logos');
  return utils;
}

// Locates a SettingsInput by its visible label and returns its <input>.
function textFieldByLabel(labelText) {
  const label = screen.getByText(labelText);
  const input = label.parentElement.querySelector('input, textarea');
  if (!input) throw new Error(`no input found for the field labelled "${labelText}"`);
  return input;
}

// Locates a colour field by a LABEL PATTERN rather than exact copy, so this suite
// does not dictate the picker's final wording. It requires only that the control
// is a text-entry colour field whose label mentions the background.
function colorFieldMatching(pattern) {
  const label = Array.from(document.querySelectorAll('label'))
    .find(l => pattern.test(l.textContent || ''));
  if (!label) return null;
  return label.parentElement.querySelector('input[type="text"]');
}

// The logo uploader, required to live in the Brand Logos section — the card that
// already displays the current logos. Scoping matters: the Brand Colors card
// contains an unrelated file input (the in-browser colour eyedropper, which
// persists nothing), and a query that found THAT one would report a working
// uploader where none exists.
function logoUploadInput() {
  const heading = screen.getByText('Brand Logos');
  const card = heading.parentElement;
  return card.querySelector('input[type="file"]');
}

async function uploadALogo() {
  const input = logoUploadInput();
  expect(input).not.toBeNull();
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(callsTo(LOGO_URL, 'POST').length).toBe(1));
}

async function save() {
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(callsTo(SETTINGS_URL, 'PUT').length).toBeGreaterThan(0));
}

afterEach(() => {
  sessionStorage.clear();
  delete global.fetch;
});

describe('C/DL-2 Phase 3c — admin Branding form: logo upload and landing background', () => {

  // ── 1. THE UPLOAD CONTROL EXISTS AND CALLS THE ENDPOINT ────────────────────

  it('[RED] the Brand Logos section offers an upload control that POSTs to the logo endpoint', () => {
    return renderForm().then(() => {
      // NON-VACUITY: the section itself must have rendered. renderForm already
      // waited on this heading, so a blank page cannot reach the assertion below.
      expect(screen.getByText('Brand Logos')).toBeInTheDocument();

      expect(
        screen.queryByText(/Logo uploads coming soon/i)
      ).toBeNull();

      const input = logoUploadInput();
      expect(input).not.toBeNull();
    });
  });

  it('[RED] choosing a file uploads it as multipart to POST /api/admin/branding/logo', async () => {
    // The behaviour, not merely the control's presence: an uploader that rendered
    // and did nothing would satisfy the test above.
    await renderForm();
    await uploadALogo();

    const upload = callsTo(LOGO_URL, 'POST')[0];
    expect(upload.body).toBeInstanceOf(FormData);
    expect(upload.body.get('logo')).toBeInstanceOf(File);
  });

  it('[RED] the newly uploaded logo is displayed without a page reload', async () => {
    // The admin must be able to see what they just uploaded. Pinned separately
    // from the save path because a fix that only refreshed the SAVE payload would
    // leave the admin staring at the old image with no reason to trust the upload.
    await renderForm();
    // NON-VACUITY: the OLD logo is on screen first, so "the new URL is present"
    // cannot be satisfied by a component that renders every URL it has ever seen.
    expect(screen.getByText(OLD_LOGO)).toBeInTheDocument();

    await uploadALogo();

    await waitFor(() => expect(screen.getByText(NEW_LOGO)).toBeInTheDocument());
  });

  // ── 2. THE LANDMINE ────────────────────────────────────────────────────────

  it('[RED] a save after an upload sends the NEW logo_url, not the stale one', async () => {
    // ── THE TEST THIS FILE EXISTS FOR ────────────────────────────────────────
    // Reproduces the ordinary admin session exactly: load, upload, edit something
    // unrelated, save. Today the PUT carries the logo_url captured at MOUNT, so
    // the save silently destroys the upload.
    await renderForm();
    await uploadALogo();

    fireEvent.change(textFieldByLabel('App Display Name'), { target: { value: 'Alpha Rewards Plus' } });
    await save();

    const body = lastSaveBody();

    // NON-VACUITY: prove the save is a real save carrying the unrelated edit.
    // A PUT of an empty object would satisfy "logo_url is not the stale one"
    // while proving nothing at all.
    expect(body.app_display_name).toBe('Alpha Rewards Plus');
    expect(callsTo(LOGO_URL, 'POST').length).toBe(1);

    expect(body.logo_url).toBe(NEW_LOGO);
  });

  it('[GREEN-by-design] with no upload, a save still sends the logo_url that came from GET', async () => {
    // THE COUNTERWEIGHT, and it rules out the laziest fix. Dropping logo_url from
    // the save payload entirely would make the test above pass — and would then
    // write NULL over every existing logo on the first save any admin performs,
    // because PUT maps an absent key to NULL.
    await renderForm();

    fireEvent.change(textFieldByLabel('App Display Name'), { target: { value: 'Alpha Rewards Plus' } });
    await save();

    const body = lastSaveBody();
    expect(body.app_display_name).toBe('Alpha Rewards Plus');
    expect(body.logo_url).toBe(OLD_LOGO);
  });

  // ── 3. THE landing_bg_color PICKER ─────────────────────────────────────────

  it('[RED] the form offers a landing background colour control', async () => {
    // Matched on a LABEL PATTERN, not exact copy — this suite pins that the
    // control exists and is editable, not what the final wording is.
    await renderForm();
    // NON-VACUITY: the colour section rendered and its existing fields are
    // findable by the same query shape, so a null result below means the new field
    // is missing rather than that the query is wrong.
    expect(colorFieldMatching(/^primary colou?r$/i)).not.toBeNull();

    expect(colorFieldMatching(/background/i)).not.toBeNull();
  });

  it('[RED] a landing background typed into the form reaches the save payload', async () => {
    // The behaviour. A field that rendered but was not wired into formData would
    // satisfy the test above and save nothing.
    await renderForm();

    const field = colorFieldMatching(/background/i);
    expect(field).not.toBeNull();
    fireEvent.change(field, { target: { value: '#0D0D0D' } });
    await save();

    const body = lastSaveBody();
    // NON-VACUITY: prove the save carried the rest of the form too, so a PUT
    // containing ONLY landing_bg_color would not pass.
    expect(body.company_name).toBe('Alpha Roofing Co');

    expect(body.landing_bg_color).toBe('#0D0D0D');
  });

  it('[GREEN-by-design] an existing landing background survives a save that edits something else', async () => {
    // ⚠ GREEN ON ARRIVAL, and the label was corrected after the first run rather
    // than the test being contorted into a false RED. It passes today for a reason
    // that disappears the moment Phase 3c starts: landing_bg_color is not in
    // formData at all, so `{ ...fullSettingsRef.current, ...formData }` carries the
    // GET value straight through untouched.
    //
    // It becomes LOAD-BEARING the instant the picker is added, because the obvious
    // wiring — a new EMPTY_FORM key seeded from nothing — makes formData shadow the
    // ref's value with '', and PUT writes that empty string over a real colour. The
    // browser renders an empty string as no colour at all, so the admin's landing
    // page loses its background the first time they edit their tagline.
    //
    // The server-side proof (adminSettingsBranding.test.js) cannot see this: it
    // covers GET->PUT round-tripping of the payload and has no view of what the
    // form's own state does to the column on the way through.
    await renderForm({ settings: settingsPayload({ landing_bg_color: '#0E0E0E' }) });

    fireEvent.change(textFieldByLabel('App Display Name'), { target: { value: 'Alpha Rewards Plus' } });
    await save();

    const body = lastSaveBody();
    expect(body.app_display_name).toBe('Alpha Rewards Plus');
    expect(body.landing_bg_color).toBe('#0E0E0E');
  });
});
