// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE CLIENT SENDS WHEN A BOUNDARY CATCHES (post-N4 cleanup C)
//
// The server half of Danny's ruling 1 is fenced in `server/test/clientErrorReporting.test.js`. This
// is the half the server cannot see: whether the browser ever SENDS the three things it now reads.
//
// ⚠ A SERVER THAT READS `fatal` AND A CLIENT THAT NEVER SENDS IT IS A GATE THAT SILENTLY NEVER
// FIRES — this repo's most-recorded shape, and the reason both halves are fenced. The server suite
// posts its own bodies, so it would stay green against an `ErrorBoundary` that still smuggled the
// componentStack through `context` and sent no `fatal` at all.
//
// ⚠ AND IT ASSERTS ON THE REQUEST ACTUALLY MADE, not on the reporter's arguments. `reportClientError`
// is reached through `componentDidCatch`, so the only honest observation is the `fetch` body.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';
import { ADMIN_TOKEN_KEY, REFERRER_TOKEN_KEY } from '../../utils/authStorage';

/**
 * A component that throws during render, so the boundary catches it for real.
 *
 * ⚠ EVERY CASE PASSES A DISTINCT MESSAGE, AND THE FIRST WRITING DID NOT — WHICH COST SEVEN
 * FAILURES WITH ZERO FETCH CALLS. `clientErrorReporter` keeps a MODULE-LEVEL throttle keyed on
 * `context:message` and suppresses a repeat for 60 seconds. With the same message thrown from the
 * same context in every case, only the FIRST case reported and the other seven observed nothing.
 * **Module-level state outlives a test, and `vi.restoreAllMocks()` does not touch it.**
 * The throttle is correct production behaviour and is not this commit's subject; unique messages
 * are also the more realistic fixture.
 */
function Exploding({ msg }) {
  throw new Error(msg);
}

/** The single POST to /api/log-client-error, parsed. Asserts exactly one was made. */
function soleReport() {
  const calls = global.fetch.mock.calls.filter(
    (c) => String(c[0]).includes('/api/log-client-error')
  );
  expect(calls.length).toBe(1);
  const [, init] = calls[0];
  return { init, body: JSON.parse(init.body) };
}

describe('cleanup C — a boundary catch reports fatal, with its component stack', () => {
  let consoleError;

  beforeEach(() => {
    vi.restoreAllMocks();
    // React prints the caught error; silence it so the run stays readable.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    try { localStorage.clear(); } catch { /* private window */ }
  });

  afterEach(() => {
    delete global.fetch;
    try { localStorage.clear(); } catch { /* private window */ }
    consoleError?.mockRestore();
  });

  it('[RED before the fix] sends fatal: true — the server cannot infer this from a route', async () => {
    render(<ErrorBoundary><Exploding msg="kaboom fatal flag" /></ErrorBoundary>);
    const { body } = soleReport();
    expect(body.fatal).toBe(true);
  });

  it('[RED before the fix] sends the componentStack in its OWN field', async () => {
    render(<ErrorBoundary><Exploding msg="kaboom component stack" /></ErrorBoundary>);
    const { body } = soleReport();
    // React supplies the stack; it must arrive as `component_stack`, not smuggled through `component`.
    expect(typeof body.component_stack).toBe('string');
    expect(body.component_stack).toMatch(/Exploding/);
  });

  it('and `component` is now a short label, not the whole React tree', async () => {
    // ⚠ THE OLD CALL PASSED THE componentStack AS THE `context` ARGUMENT, so `component` was a
    // multi-line tree — and the server used `component` as a fallback for the stored ROUTE, which is
    // part of the dedup key. A route containing newlines could never dedupe with the next crash.
    render(<ErrorBoundary><Exploding msg="kaboom short label" /></ErrorBoundary>);
    const { body } = soleReport();
    expect(body.component).toBe('ErrorBoundary');
    expect(body.component).not.toMatch(/\n/);
  });

  it('still sends the message, the JS stack and the route', async () => {
    // A regression floor: the three fields that already worked must not be lost to the new ones.
    render(<ErrorBoundary><Exploding msg="kaboom regression floor" /></ErrorBoundary>);
    const { body } = soleReport();
    expect(body.error_message).toMatch(/kaboom regression floor/);
    expect(typeof body.stack_trace).toBe('string');
    expect(body.route).toBe(window.location.pathname);
  });
});

describe('cleanup C — the report carries a session token when the browser holds one', () => {
  let consoleError;

  beforeEach(() => {
    vi.restoreAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    try { localStorage.clear(); } catch { /* private window */ }
  });

  afterEach(() => {
    delete global.fetch;
    try { localStorage.clear(); } catch { /* private window */ }
    consoleError?.mockRestore();
  });

  it('[RED before the fix] an admin token is sent, so the row can be filed under their tenant', () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'admin-token-xyz');
    render(<ErrorBoundary><Exploding msg="kaboom admin token" /></ErrorBoundary>);
    const { init } = soleReport();
    expect(init.headers.Authorization).toBe('Bearer admin-token-xyz');
  });

  it('a referrer token is sent too — the resolution is role-agnostic by design', () => {
    localStorage.setItem(REFERRER_TOKEN_KEY, 'referrer-token-abc');
    render(<ErrorBoundary><Exploding msg="kaboom referrer token" /></ErrorBoundary>);
    expect(soleReport().init.headers.Authorization).toBe('Bearer referrer-token-abc');
  });

  it('PAIRED NEGATIVE: with NO token, no Authorization header — and the report still goes', () => {
    // ⚠ THE ROUTE IS UNAUTHENTICATED BY DESIGN: a crashed app that was never logged in must still be
    // able to report. Without this case, a reporter that REQUIRED a token would look correct.
    render(<ErrorBoundary><Exploding msg="kaboom no token" /></ErrorBoundary>);
    const { init, body } = soleReport();
    expect('Authorization' in init.headers).toBe(false);
    expect(body.error_message).toMatch(/kaboom no token/);
  });

  it('the Content-Type is still set — adding a header must not replace the others', () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'tok');
    render(<ErrorBoundary><Exploding msg="kaboom content type" /></ErrorBoundary>);
    expect(soleReport().init.headers['Content-Type']).toBe('application/json');
  });
});
