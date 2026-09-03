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
// jsdom + @testing-library/react under Vitest, following the repo's only existing
// component test (src/App.test.jsx). Runs under `npm run test:react`, which
// `npm test` chains after the server suite — see the note in
// BrandingPreview.test.jsx.
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
    logo_url: OLD_LOGO,
    primary_color: '#123456', secondary_color: '#654321', accent_color: '#ABCDEF',
    landing_bg_color: null,
    social_facebook: null, social_instagram: null, social_google: null,
    social_nextdoor: null, social_website: null,
    review_url: null, review_button_text: 'Leave a Review',
    review_message: 'Enjoying the rewards? Leave us a quick review!',
    font_heading: 'Montserrat', font_body: 'Roboto',
    app_display_name: 'Alpha Rewards',
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

// ─────────────────────────────────────────────────────────────────────────────
// B-3c — RED SUITE — WHAT THE SETTINGS PAGE HANDS ITS PREVIEW
//
// THE DEFECT, SEEN LIVE. The real login screen rendered the contractor's
// uploaded mark; the preview beside it rendered the platform placeholder. Same
// component, same provider, different logo.
//
// ⚠ THE OBVIOUS READING WAS WRONG TWICE OVER, AND BOTH WRONG TURNS ARE WORTH
// RECORDING BECAUSE EACH LEADS SOMEWHERE ELSE.
//
// FIRST: it looked like the preview was reading the OTHER logo field — the form
// offers two, and the second was unset with a note saying the platform mark
// stands in for it. It was reading NO field: the two logo URLs live in their own
// state object and only `formData` reached the preview. Both surfaces showed the
// platform mark for the same reason — it is the fallback — and that coincidence
// disguised a cannot-see-it defect as a wrong-field one. Re-pointing at the other
// column would have gone permanently blank, because no resolver key exposes it.
//
// SECOND, AND THIS FILE IS WHERE IT LANDED: the first RED cases for this were
// written against BrandingPreview and went GREEN immediately. ⚠ BrandingPreview
// WAS NEVER BROKEN. Handed an object containing a logo it renders the logo,
// faithfully, which is what B-3 built it to do. The defect is HERE — in what this
// page chooses to hand it. Testing the component that displayed the symptom
// proved only that it was innocent.
//
// ⚠ AND THE LOGO WAS NOT ALONE. The resolver reads sixteen input keys; the object
// this page passed supplied eight. `company_name` was falling back on the same
// screen, in the subtitle and the footer, and nobody had reported it — a wrong
// NAME is quieter than a wrong MARK, which is exactly why it survived.
// ─────────────────────────────────────────────────────────────────────────────

// The preview's nested viewport, reached from the settings page.
function previewFrameDoc() {
  const frame = document.querySelector('iframe[data-preview-frame]');
  return frame?.contentDocument ?? null;
}

function previewText() {
  return previewFrameDoc()?.body?.textContent ?? '';
}

function previewImageSources() {
  return Array.from(previewFrameDoc()?.querySelectorAll('img') ?? [])
    .map(img => img.getAttribute('src'));
}

describe('B-3c — the preview receives the branding the real screen receives', () => {

  it('[RED] the preview renders the contractor mark, not the platform placeholder', async () => {
    // ⚠ ASSERTED AS "IS THE SAVED URL", NOT "AN IMAGE EXISTS". The screen always
    // renders an img — the fallback is an image too — so a presence check passes
    // against the defect it is meant to catch.
    await renderForm();

    await waitFor(() => expect(previewImageSources().length).toBeGreaterThan(0));
    const sources = previewImageSources();

    expect(
      sources.some(src => src === OLD_LOGO),
      `the preview rendered ${JSON.stringify(sources)}. The contractor's saved logo_url ` +
      'never reached it, so the login screen fell back to the platform mark — while the ' +
      'real screen, reading the same key from the same resolver, shows the upload.'
    ).toBe(true);
  });

  it('[RED] the preview renders the contractor name, not the platform fallback', async () => {
    // The second defect, on the same screen, never reported.
    await renderForm();

    await waitFor(() => expect(previewText()).toContain('Alpha Roofing Co'));
  });

  it('[RED] an UPLOADED logo reaches the preview before any save', async () => {
    // ⚠ THE REASON logoData IS SPREAD LAST. An upload updates that state after the
    // saved-settings snapshot was captured on mount, so a merge that let the
    // snapshot win would show the OLD mark until the admin saved and reloaded —
    // which is the same "you must save and come back" defect B-3b removed,
    // arriving through a different key.
    await renderForm();
    await uploadALogo();

    await waitFor(() => expect(previewImageSources()).toContain(NEW_LOGO));
    expect(previewImageSources()).not.toContain(OLD_LOGO);
  });

  it('[GREEN-by-design] PRECEDENCE — a colour edited in the form beats the saved payload', async () => {
    // ⚠ GREEN BEFORE THE FIX AND LABELLED SO RATHER THAN CLAIMED AS RED. The
    // colour fields were already in the object the preview received, so this
    // passes today. It exists to FAIL LATER: it is the guard on the merge this
    // change introduces, and it would fire the moment the spread order flipped or
    // a later key shadowed an earlier one.
    // ⚠ THE RISK THE MERGE INTRODUCES, PINNED BEFORE IT CAN BITE. The saved
    // settings are spread first and the form's edits over them. Reverse that, or
    // let a later key shadow an earlier one, and the preview shows SAVED state
    // while the admin types — the regression B-3b just finished removing, from a
    // different direction.
    await renderForm();

    const field = colorFieldMatching(/primary/i);
    expect(field, 'no primary colour field — the precedence case cannot run').toBeTruthy();
    fireEvent.change(field, { target: { value: '#2E6B2E' } });

    // The theme root lives inside the preview frame; its mounted token is the
    // observable end of the merge.
    await waitFor(() => {
      const root = previewFrameDoc()?.querySelector('[data-rm-theme]');
      expect(root, 'no provider inside the preview frame').toBeTruthy();
      // In light mode a fill that already clears the floor passes through, so the
      // edited value is the token itself — no derivation ambiguity to reason about.
      expect(root.style.getPropertyValue('--rm-secondary').toUpperCase()).toBe('#2E6B2E');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BR-2 Phase 3 — the card rename, the grouping, and the retired fields', () => {

  // ⚠ EVERY TEST HERE ASSERTS THE SURROUNDING CARD RENDERED. A component that
  // threw satisfies every "the retired field is gone" assertion below for
  // entirely the wrong reason — the blank-render trap this repo keeps finding.
  // Uses this file's own renderForm helper, which installs the fetch double and
  // waits for a real section heading — the precondition every query needs.
  const renderCard = () => renderForm();

  it('[RED] T6 — Brand Logos renders ONE row, with no orphaned label or empty slot', async () => {
    await renderCard();

    // POSITIVE: the surviving row is there and is the uploadable one.
    expect(screen.getByText('App Logo')).toBeInTheDocument();
    // NEGATIVE: the retired display-only row is gone entirely — label included.
    expect(screen.queryByText('Referrer App Logo')).toBeNull();
    // ⚠ AND NO ORPHANED SLOT. The row's label and its content live in the same
    // mapped element, so a half-removed member would leave one without the other.
    // Asserting the section still has its heading proves the container survived
    // the array going from two members to one.
    expect(screen.getByText(/Brand Logos/i)).toBeInTheDocument();
  });

  it('[RED] the Tagline field is gone from the panel', async () => {
    await renderCard();
    expect(screen.queryByLabelText(/Tagline/i)).toBeNull();
    expect(screen.queryByText(/Shown on the referrer login screen and dashboard/i)).toBeNull();
  });

  it('[RED] B.1/B.2 — the card is renamed and BOTH group labels render', async () => {
    await renderCard();

    // The rename: it names both halves of what it now holds.
    expect(screen.getByText(/App Identity & Landing Page/i)).toBeInTheDocument();
    // The grouping — ⚠ this is what makes the rename useful rather than merely
    // accurate. Without it the five landing fields read as app settings.
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Landing Page Copy')).toBeInTheDocument();
  });

  it('[RED] C.1/C.2 — the App Display Name copy no longer names the retired codename', async () => {
    await renderCard();

    // ⚠ THE PLACEHOLDER DESCRIBES RATHER THAN NAMES. "Rooster Booster" was
    // generic placeholder text AND a false default claim — the real fallback is
    // the company name, verified in renderState1 and the three referrer tabs.
    const input = screen.getByPlaceholderText('Your program name');
    expect(input).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Rooster Booster')).toBeNull();
    // The helper names where the value ACTUALLY appears, and the real fallback.
    // ⚠ ANCHORED ON THE FULL SENTENCE, NOT ON THE TRAILING CLAUSE. The Email
    // Sender Name helper also ends 'Leave blank to use your company name...',
    // so the short needle matches two nodes and throws — the substring trap,
    // in a query rather than an assertion, for the second time this arc.
    expect(screen.getByText(/The name of your rewards program\./i)).toBeInTheDocument();
    expect(screen.getByText(/Appears in your landing page headline/i)).toBeInTheDocument();
    expect(screen.queryByText(/replaces "Rooster Booster" throughout the referrer app/i)).toBeNull();
  });

  it('[RED] C.4 — the no-logo preview describes the SHIPPED behaviour, not the retired one', async () => {
    await renderCard();
    // The fixture has a logo set, so the no-logo branch is not on screen here —
    // what is asserted is that the FALSE claim is gone from the component
    // entirely, which is true on either branch.
    expect(screen.queryByText(/the RoofMiles mark is shown as a placeholder/i)).toBeNull();
  });
});
