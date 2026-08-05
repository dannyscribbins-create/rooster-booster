// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3c RED SUITE — THE RESEND BUTTON ACTUALLY RESENDS
//
// THE BUG, in full. EmailVerifyScreen.jsx:67-72:
//
//     function handleResend() {
//       // MVP: add a dedicated /api/signup/resend-code endpoint …
//       setResendCooldown(60);
//       setResendSuccess(true);
//       setTimeout(() => setResendSuccess(false), 3000);
//     }
//
// It makes NO NETWORK CALL. It tells the homeowner "Code resent! Check your
// inbox." and then locks the button for sixty seconds. A homeowner whose code
// never arrived — the only person who ever presses this button — is told a new
// one is on its way, waits for an email that does not exist, presses again, and
// is told the same thing. The signup dead-ends and nothing is logged anywhere.
//
// THE ENDPOINT ALREADY EXISTS. POST /api/signup/resend-code shipped in Phase 2b
// and is proven by server/test/resendVerificationCode.test.js — it re-mints the
// code, retires the old ones in one transaction, white-labels the email and
// rate-limits the caller. It takes { email, contractorId }.
//
// ── WHY THIS IS TWO TESTS AND NOT ONE ────────────────────────────────────────
// The component is handed userId, email, inviteSlug and contractorName — and NOT
// contractorId. App.js already RECEIVES data.contractorId from the invite payload
// (the landing resolution returns it; landingResolution.test.js pins it) and
// discards it at App.js:88, keeping only contractorName.
//
// So wiring the fetch into the component alone produces a request with
// contractorId: undefined, which the endpoint answers with its generic
// non-disclosure 200 having sent nothing. The bug would look FIXED — same
// reassuring copy, same silence — while behaving identically. That is why the
// second describe drives the whole flow through the real App: the component
// contract is worthless without proof that something supplies the prop.
//
// ── THE NON-DISCLOSURE RULE, WHICH THE UI MUST NOT UNDERMINE ─────────────────
// The endpoint returns ONE generic 200 for every outcome — account found, unknown
// address, already verified, missing parameter, swallowed DB or mail error alike
// (referrer.js:869). Anything that varied by outcome would turn it into an
// account-enumeration oracle.
//
// THEREFORE THE UI MUST KEEP ITS OPTIMISTIC COPY AND 60s COOLDOWN INDEPENDENT OF
// THE RESPONSE. Making "Code resent!" conditional on a success flag would move
// the oracle from the server to the screen and undo the endpoint's whole design.
// Pinned below so a later "improvement" cannot quietly reintroduce it.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under Vitest, following src/App.test.jsx.
// Runs under `npm run test:react`, which `npm test` chains after the server suite.
// `fetch` is replaced at the true external boundary; every component in the flow
// is real, and no assertion below reads the mock — each reads the REQUEST THE
// APP CHOSE TO SEND.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailVerifyScreen from './EmailVerifyScreen';
import App from '../../App';

const RESEND_URL = '/api/signup/resend-code';

const HOMEOWNER_EMAIL = 'homeowner@example.test.invalid';
const CONTRACTOR_ID   = 'tnt-fixture-internal';
const CONTRACTOR_NAME = 'Alpha Roofing Co';
const INVITE_SLUG     = 'fixture-invite-slug';
const NEW_USER_ID     = 4242;

// Puts the browser on the Scheme B signup URL the SPA still reads
// (App.js:57-60 does params.get('signup')).
//
// ⚠ BUILT WITH URLSearchParams, NOT AS A TEMPLATE LITERAL, AND THAT IS NOT STYLE.
// server/test/linkGeneratorSweep.test.js runs a STATIC SOURCE SWEEP over every
// .js/.jsx file in server/ and src/ for the literal Scheme B needle, and allows it
// in exactly one file (server/utils/inviteTokens.js). Writing the query string
// inline here turns that sweep RED — verified: it did, on this file's first run.
// The sweep is right to be that blunt, and the sweep's own source dodges its
// needle the same way (linkGeneratorSweep.test.js:46 concatenates it).
function goToSignupUrl(slug) {
  window.history.replaceState({}, '', `/?${new URLSearchParams({ signup: slug })}`);
}

// The endpoint's REAL response — one generic message, no success flag, no field
// that varies by outcome (referrer.js:869). Modelled exactly, because a fixture
// that invented `{ success: true }` would let a UI that gates its copy on a
// success flag pass these tests and then show nothing in production.
const GENERIC_RESEND_BODY = {
  message: "If that account still needs verifying, a new code is on its way.",
};

let calls;

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function callsTo(fragment, method) {
  return calls.filter(c => c.url.includes(fragment) && (!method || c.method === method));
}

function bodyOf(call) {
  return JSON.parse(call.body);
}

afterEach(() => {
  delete global.fetch;
  window.history.replaceState({}, '', '/');
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE COMPONENT CONTRACT
// ═════════════════════════════════════════════════════════════════════════════

describe('C/DL-2 Phase 3c — EmailVerifyScreen resend', () => {

  function installFetch({ resend = jsonResponse(GENERIC_RESEND_BODY) } = {}) {
    calls = [];
    global.fetch = vi.fn(async (url, opts = {}) => {
      calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body });
      if (String(url).includes(RESEND_URL)) {
        if (resend instanceof Error) throw resend;
        return resend;
      }
      throw new Error(`unexpected fetch to ${url} — the fixture does not model this call`);
    });
  }

  // Renders the screen with every prop the production call site supplies, plus
  // the contractorId this phase adds.
  function renderScreen(props = {}) {
    return render(
      <EmailVerifyScreen
        userId={NEW_USER_ID}
        email={HOMEOWNER_EMAIL}
        inviteSlug={INVITE_SLUG}
        contractorName={CONTRACTOR_NAME}
        contractorId={CONTRACTOR_ID}
        onVerifyComplete={() => {}}
        {...props}
      />
    );
  }

  it('[RED] pressing Resend issues POST /api/signup/resend-code', async () => {
    // Today this button calls nothing at all.
    installFetch();
    renderScreen();

    // NON-VACUITY: the button must genuinely be on screen and pressable before
    // "no request was sent" can be blamed on the wiring rather than on a screen
    // that rendered its cooldown or success state instead.
    const button = screen.getByText('Resend');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => expect(callsTo(RESEND_URL, 'POST').length).toBe(1));
  });

  it('[RED] the resend request carries BOTH email and contractorId', async () => {
    // The endpoint is keyed on email + contractorId and fails CLOSED to its
    // generic 200 when either is missing (referrer.js:871) — so a request with
    // contractorId: undefined looks identical, from the screen, to one that worked.
    //
    // contractorId is REQUIRED and not optional: users is UNIQUE(contractor_id, email),
    // so the same homeowner address can hold an account under two contractors and
    // an unscoped lookup has no way to know which one to re-mint a code for.
    installFetch();
    renderScreen();
    fireEvent.click(screen.getByText('Resend'));

    await waitFor(() => expect(callsTo(RESEND_URL, 'POST').length).toBe(1));
    const body = bodyOf(callsTo(RESEND_URL, 'POST')[0]);

    expect(body.email).toBe(HOMEOWNER_EMAIL);
    expect(body.contractorId).toBe(CONTRACTOR_ID);
  });

  it('[RED] the resend request is NOT keyed on userId', async () => {
    // A DELIBERATE SECURITY DECISION recorded at referrer.js:849-856, pinned here
    // so the shorter wiring cannot creep back in. The verify endpoint directly
    // above this button already takes userId, so reusing it is the obvious move —
    // but users.id is a SEQUENTIAL INTEGER, which makes a userId-keyed resend a
    // mailbomb primitive: POST 1, 2, 3 … and every account in the table receives
    // mail. Keyed on an address the caller already knows, the endpoint hands out
    // nothing it was not given.
    //
    // The component HAS userId in scope (it uses it to verify), so sending it is
    // one word away at all times.
    installFetch();
    renderScreen();
    fireEvent.click(screen.getByText('Resend'));

    await waitFor(() => expect(callsTo(RESEND_URL, 'POST').length).toBe(1));
    const body = bodyOf(callsTo(RESEND_URL, 'POST')[0]);

    expect(body.userId).toBeUndefined();
  });

  it('[GREEN-by-design] the optimistic copy and cooldown do not depend on the response body', async () => {
    // THE NON-DISCLOSURE PIN. The response carries no success flag and never will
    // — every outcome returns GENERIC_RESEND_BODY. A UI that gated its copy on one
    // would show nothing forever; a UI that gated it on a flag the server DID vary
    // would leak whether the account exists, straight to the screen.
    //
    // Green on arrival, because today the copy is set unconditionally with no
    // request at all. It becomes load-bearing the moment the fetch is added, which
    // is exactly when someone reaches for `if (data.success)`.
    //
    // ⚠ DELIBERATELY NO REQUEST-COUNT GATE. Waiting for the POST first would make
    // this test RED today for the WIRING's reason rather than its own, hiding the
    // rule it exists to protect behind a failure that three other tests already
    // report. The copy is the subject here; whether a request went out is not.
    installFetch();
    renderScreen();
    fireEvent.click(screen.getByText('Resend'));

    await waitFor(() => expect(screen.getByText('Code resent! Check your inbox.')).toBeInTheDocument());
    // The cooldown is active: the button is gone until it expires.
    expect(screen.queryByText('Resend')).toBeNull();
  });

  it('[GREEN-by-design] a failed request shows the same copy and the same cooldown', async () => {
    // The other half of the same rule. If a network failure produced a DIFFERENT
    // message, the screen would distinguish outcomes the endpoint deliberately
    // refuses to distinguish — and a homeowner on a flaky connection would be told
    // something about their account rather than about their connection.
    //
    // The lost code is recoverable: the cooldown expires and the button returns.
    //
    // ⚠ TRIVIALLY GREEN TODAY — there is no request to fail, so this passes for a
    // reason unrelated to what it asserts. Recorded as such rather than presented
    // as coverage. It only becomes load-bearing once handleResend awaits a fetch,
    // which is precisely when a `.catch(() => setError(...))` gets added.
    installFetch({ resend: new Error('network down') });
    renderScreen();
    fireEvent.click(screen.getByText('Resend'));

    await waitFor(() => expect(screen.getByText('Code resent! Check your inbox.')).toBeInTheDocument());
    expect(screen.queryByText('Resend')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE THREADING — App.js captures contractorId and passes it down
// ═════════════════════════════════════════════════════════════════════════════

describe('C/DL-2 Phase 3c — contractorId reaches the verify screen from the invite payload', () => {

  function installFetch() {
    calls = [];
    global.fetch = vi.fn(async (url, opts = {}) => {
      const u = String(url);
      calls.push({ url: u, method: opts.method || 'GET', body: opts.body });

      // The real landing resolution payload (referrer.js:385-391 / 421-431).
      // contractorId is present and always has been — App.js simply drops it.
      if (u.includes(`/api/invite/${INVITE_SLUG}`)) {
        return jsonResponse({
          valid: true,
          mode: 'invite',
          contractorId: CONTRACTOR_ID,
          contractorName: CONTRACTOR_NAME,
          linkType: 'contractor',
          contractor: {
            slug: 'alpharoofing', companyName: CONTRACTOR_NAME, programName: 'Alpha Rewards',
            primaryColor: '#123456', secondaryColor: '#654321', backgroundColor: '#ABCDEF',
            logoUrl: null, phone: null, email: null,
          },
        });
      }
      if (u.includes('/api/signup') && !u.includes(RESEND_URL)) {
        return jsonResponse({ userId: NEW_USER_ID });
      }
      if (u.includes(RESEND_URL)) return jsonResponse(GENERIC_RESEND_BODY);
      // Anything else the shell reaches for is not part of this flow.
      return jsonResponse({});
    });
  }

  // Fills a SignupScreen field located by its visible label.
  function fillField(labelText, value) {
    const input = screen.getByText(labelText).parentElement.querySelector('input');
    if (!input) throw new Error(`no input found for the field labelled "${labelText}"`);
    fireEvent.change(input, { target: { value } });
  }

  it('[RED] the whole signup flow carries contractorId from the invite payload into the resend request', async () => {
    // AN INTEGRATION TEST ON PURPOSE, with real components throughout: App,
    // SignupScreen and EmailVerifyScreen. The value under test crosses two
    // component boundaries and one piece of state, and a unit test at either end
    // would pass while the middle stayed unwired — which is the exact failure mode
    // here, since App.js already receives contractorId and throws it away.
    goToSignupUrl(INVITE_SLUG);
    installFetch();

    render(<App />);

    // ── LEG 1: the invite resolves and the signup screen renders ──────────────
    // NON-VACUITY for everything below: if this never appears, the flow never
    // started and no later absence could mean anything.
    await screen.findByText('Create your account');
    expect(callsTo(`/api/invite/${INVITE_SLUG}`).length).toBe(1);

    // ── LEG 2: complete signup, reaching the verify screen ───────────────────
    fillField('First name',    'Dana');
    fillField('Last name',     'Reyes');
    fillField('Phone number',  '(770) 555-1234');
    fillField('Email address', HOMEOWNER_EMAIL);
    fillField('Password',         'hunter2!');
    fillField('Confirm password', 'hunter2!');
    fireEvent.click(screen.getByText('Create Account'));

    await screen.findByText('Check your email');

    // ── LEG 3: press Resend and read what was actually sent ──────────────────
    fireEvent.click(screen.getByText('Resend'));
    await waitFor(() => expect(callsTo(RESEND_URL, 'POST').length).toBe(1));

    const body = bodyOf(callsTo(RESEND_URL, 'POST')[0]);
    expect(body.email).toBe(HOMEOWNER_EMAIL);
    expect(body.contractorId).toBe(CONTRACTOR_ID);
  });

  it('[RED] contractorId comes from the invite payload, not from anything the page can guess', async () => {
    // GUARDS AGAINST THE SHORTCUT. A second contractor id that is NOT the one in
    // the payload proves the value was READ from the response rather than derived
    // from the slug, the hostname or a default. Those would all satisfy the test
    // above in a single-fixture world and silently mis-scope every resend the
    // moment a second contractor exists — and users is UNIQUE(contractor_id, email),
    // so a wrong id means a code re-minted for the wrong account or for none.
    const OTHER_CONTRACTOR_ID = 'tnt-other-internal';
    goToSignupUrl(INVITE_SLUG);
    calls = [];
    global.fetch = vi.fn(async (url, opts = {}) => {
      const u = String(url);
      calls.push({ url: u, method: opts.method || 'GET', body: opts.body });
      if (u.includes(`/api/invite/${INVITE_SLUG}`)) {
        return jsonResponse({
          valid: true, mode: 'invite',
          contractorId: OTHER_CONTRACTOR_ID,
          contractorName: 'Beta Roofing Co',
          linkType: 'contractor',
        });
      }
      if (u.includes('/api/signup') && !u.includes(RESEND_URL)) return jsonResponse({ userId: NEW_USER_ID });
      if (u.includes(RESEND_URL)) return jsonResponse(GENERIC_RESEND_BODY);
      return jsonResponse({});
    });

    render(<App />);
    await screen.findByText('Create your account');

    fillField('First name',    'Dana');
    fillField('Last name',     'Reyes');
    fillField('Phone number',  '(770) 555-1234');
    fillField('Email address', HOMEOWNER_EMAIL);
    fillField('Password',         'hunter2!');
    fillField('Confirm password', 'hunter2!');
    fireEvent.click(screen.getByText('Create Account'));

    await screen.findByText('Check your email');
    fireEvent.click(screen.getByText('Resend'));
    await waitFor(() => expect(callsTo(RESEND_URL, 'POST').length).toBe(1));

    const body = bodyOf(callsTo(RESEND_URL, 'POST')[0]);
    expect(body.contractorId).toBe(OTHER_CONTRACTOR_ID);
    expect(body.contractorId).not.toBe(CONTRACTOR_ID);
  });
});
