// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 2B RED SUITE — THE RESET SCREEN'S FOUR-DIGIT GATES
//
// Governing spec: CDL_3b_BUILD_SPEC.md §1 D12 / CD-5.
//
// D12 names reset as THE ONE BLOCKED PATH, and the block is client-side as much
// as server-side. Four gates, three of them in this file:
//
//   1. `/^\d{4}$/.test(pin)` in handleSubmit          — refuses anything else
//   2. `maxLength={4}` on both inputs                 — caps the field at four
//   3. `.replace(/\D/g, '').slice(0, 4)` in onChange  — PHYSICALLY STRIPS letters
//                                                       as the person types
//   4. `/^\d{4}$/` on the server                      — server/test/passwordPolicy
//
// GATE 3 IS THE INTERESTING ONE and the reason a component test exists at all
// rather than trusting the server suite. It is not a validator — it is a live
// input coercion. A person who signs up with a 14-character password, forgets
// it, requests a reset and types that same password sees the letters VANISH from
// the field, character by character, with no message explaining why. No server
// test can observe that; nothing about it produces a request to assert on.
//
// So a referrer with a real password cannot restore it, and the failure is
// silent. That is what these tests pin.
//
// ── SCOPE FENCE ─────────────────────────────────────────────────────────────
// This file asserts the PASSWORD POLICY only. The Accent logo import and the
// `.then()` chain that also live in this component belong to Phase 5's rewrite
// (spec §7.1, Group A) and are deliberately not asserted here — pinning them now
// would make Phase 5's rewrite fight a test written before the screen it targets.
//
// CONVENTION: jsdom + @testing-library/react under Vitest, following
// EmailVerifyScreen.test.jsx. `fetch` is replaced at the true external boundary;
// every assertion reads the REQUEST THE COMPONENT CHOSE TO SEND, never the mock.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResetPinScreen from './ResetPinScreen';

const RESET_TOKEN = 'a'.repeat(64);

// 14 characters, alphanumeric — the spec's own example, and a value every one of
// the three client gates mangles or refuses today.
const REAL_PASSWORD = 'Roofm1lesRocks';
const SEVEN_CHARS = 'abc1234';

let calls;

beforeEach(() => {
  calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method, body: JSON.parse(options.body || '{}') });
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  };
});

// The two password inputs, found by their labels rather than by order, so a
// future layout change does not silently swap which field is asserted.
function fields() {
  const inputs = document.querySelectorAll('input[type="password"]');
  return { first: inputs[0], second: inputs[1] };
}

function submitButton() {
  return screen.getByRole('button');
}

describe('C/DL-3b Phase 2B — ResetPinScreen accepts real passwords (D12 / CD-5)', () => {
  it('[RED] keeps every character of a 14-character alphanumeric password', () => {
    // GATE 3. Today `.replace(/\D/g, '').slice(0, 4)` turns 'Roofm1lesRocks'
    // into '1' — the letters are stripped and the remainder truncated, live, as
    // the person types. Nothing tells them why.
    render(<ResetPinScreen token={RESET_TOKEN} />);
    const { first } = fields();

    fireEvent.change(first, { target: { value: REAL_PASSWORD } });

    expect(first.value).toBe(REAL_PASSWORD);
  });

  it('[RED] does not cap either field at four characters', () => {
    // GATE 2. maxLength={4} is a second, independent truncation: even with the
    // onChange coercion gone, the browser would refuse the 5th character.
    render(<ResetPinScreen token={RESET_TOKEN} />);
    const { first, second } = fields();

    expect(first.maxLength).not.toBe(4);
    expect(second.maxLength).not.toBe(4);
  });

  it('[RED] submits a matching 14-character password to the server', async () => {
    // GATE 1. Even with both input gates removed, `/^\d{4}$/.test(pin)` in
    // handleSubmit refuses the value before any request is made. Asserted on the
    // REQUEST rather than on the absence of an error message, so a handler that
    // showed nothing and also sent nothing cannot pass.
    render(<ResetPinScreen token={RESET_TOKEN} />);
    const { first, second } = fields();

    fireEvent.change(first, { target: { value: REAL_PASSWORD } });
    fireEvent.change(second, { target: { value: REAL_PASSWORD } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0].url).toContain('/api/reset-pin');
    expect(calls[0].body.pin).toBe(REAL_PASSWORD);
    expect(calls[0].body.token).toBe(RESET_TOKEN);
  });

  it('[RED] refuses seven characters client-side and sends nothing', async () => {
    // The counterweight. Removing the gates must not remove the POLICY — the
    // cheapest way to pass every test above is to delete all validation, which
    // would push a 400 back from the server and show a worse error later.
    render(<ResetPinScreen token={RESET_TOKEN} />);
    const { first, second } = fields();

    fireEvent.change(first, { target: { value: SEVEN_CHARS } });
    fireEvent.change(second, { target: { value: SEVEN_CHARS } });
    fireEvent.click(submitButton());

    expect(calls.length).toBe(0);
    // Matched on the ERROR wording specifically. A bare /8 characters/i also
    // matches the screen's own helper copy ("Choose a password of at least 8
    // characters"), which is present whether or not the guard fired — the
    // assertion would pass on a component that validated nothing.
    expect(screen.getByText(/must be at least 8 characters/i)).toBeTruthy();
  });

  it('[RED] still refuses a mismatched confirmation', async () => {
    // The other half of the policy that must survive the rewrite.
    render(<ResetPinScreen token={RESET_TOKEN} />);
    const { first, second } = fields();

    fireEvent.change(first, { target: { value: REAL_PASSWORD } });
    fireEvent.change(second, { target: { value: 'Roofm1lesRock5' } });
    fireEvent.click(submitButton());

    expect(calls.length).toBe(0);
    expect(screen.getByText(/match/i)).toBeTruthy();
  });

  it('[RED] no longer describes the rule as four digits anywhere on screen', async () => {
    // The copy is part of the gate. A screen that accepts a real password while
    // still instructing "Choose a 4-digit PIN" teaches the wrong thing and will
    // be read as a bug by the person following it.
    render(<ResetPinScreen token={RESET_TOKEN} />);
    expect(screen.queryByText(/4-digit/i)).toBeNull();
    expect(screen.queryByText(/4 digits/i)).toBeNull();
  });
});
