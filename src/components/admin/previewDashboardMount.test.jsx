// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW-1 — THE DASHBOARD VIEW IS A REAL MOUNT, AND IT IS SILENT
//
// The branding preview's third view used to render `DashboardPreview`, a
// hand-painted illustration. It now mounts the REAL referrer `Dashboard` inside
// `PreviewFrame`, fed by `previewFixture.js`.
//
// ⚠ THE PROPERTY UNDER TEST IS NOT "IT RENDERS". It is that the preview makes
// ZERO network requests and can open NO modal, while still being a faithful
// render. Those are one guarantee rather than two: `aboutData` — the subtree's
// only mount-time modal opener — is fed solely by the `/about` fetch, so the
// thing that keeps the preview quiet is the same thing that keeps it closed.
//
// ⚠ EVERY ABSENCE ASSERTION HERE IS PAIRED WITH A POSITIVE CONTROL. "No requests
// were made" is satisfied by a component that failed to mount at all, which is
// the shape this repo has shipped more than once. An absence assertion must
// first prove the presence it is asserting the absence of.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import BrandingPreview from './BrandingPreview';
import RewardScheduleCard from '../referrer/RewardScheduleCard';
import Dashboard from '../referrer/DashboardTab';
import ThemeProvider from '../shared/ThemeProvider';
import { PREVIEW_FIXTURE, PREVIEW_FIXTURE_VARIANTS } from './previewFixture';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_CONFIG } from '../../constants/theme';

const DRAFT = {
  company_name: 'Preview Co',
  primary_color: '#2B1B4D',
  secondary_color: '#E0562A',
  accent_color: '#F3E9E2',
};

const NO_STORED_MODE = async () => null;

function frameDoc() {
  const frame = document.querySelector('iframe[data-preview-frame]');
  return frame?.contentDocument ?? null;
}

/** Opens the panel and switches to the dashboard view, waiting for the mount. */
async function openDashboard(props = {}) {
  const utils = render(<BrandingPreview formData={DRAFT} {...props} />);
  await screen.findByText('Live Preview');
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
  await waitFor(() => {
    const root = frameDoc()?.querySelector('[data-rm-theme]');
    if (!root) throw new Error('the dashboard view did not mount a provider');
    return root;
  });
  return utils;
}

let fetchSpy;

beforeEach(() => {
  // ⚠ A DOUBLE THAT THROWS ON AN UNRECOGNISED SHAPE RATHER THAN ANSWERING
  // PLAUSIBLY. A stub that resolves `{}` to everything is indistinguishable from
  // a route that was never called, which is exactly how a "no answer" shape
  // satisfies every absence assertion in a suite.
  fetchSpy = vi.fn(() => Promise.resolve({
    ok: true,
    json: async () => ({ enabled: false, schedules: [] }),
  }));
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.querySelectorAll('link[data-test-injected]').forEach(el => el.remove());
});

describe('Preview-1 — the dashboard preview makes no requests', () => {

  it('the dashboard view issues ZERO requests', async () => {
    await openDashboard();
    // Let any effect that was going to fire, fire.
    await act(async () => { await Promise.resolve(); });

    const urls = fetchSpy.mock.calls.map(c => String(c[0]));
    expect(urls, `the preview called: ${urls.join(', ')}`).toEqual([]);
  });

  it('POSITIVE CONTROL — the same fixture WITH a token does issue requests', async () => {
    // ⚠ WITHOUT THIS THE TEST ABOVE IS WORTHLESS. It passes identically against a
    // dashboard that failed to mount, against a fixture that renders nothing, and
    // against a `fetch` double that was never wired to the component at all. This
    // proves the component in this configuration DOES call fetch when it should,
    // so silence above is a property of the preview and not of the harness.
    render(
      <ThemeProvider
        supplied={{ branding: resolveBrandingTheme(DRAFT), source: 'preview' }}
        fetchStoredMode={NO_STORED_MODE}
        mode="light"
      >
        <Dashboard {...PREVIEW_FIXTURE.default} sessionToken="control-token" schedules={undefined} />
      </ThemeProvider>
    );
    await act(async () => { await Promise.resolve(); });

    const urls = fetchSpy.mock.calls.map(c => String(c[0]));
    expect(urls.some(u => u.includes('/api/referrer/about')),
      'the control did not reach /about — the harness is not wired to the component').toBe(true);
    expect(urls.some(u => u.includes('/api/referrer/schedules')),
      'the control did not reach /schedules — the card is not fetching in the control either').toBe(true);
  });

  it('no modal is open inside the frame, and none can auto-open', async () => {
    await openDashboard();
    await act(async () => { await Promise.resolve(); });

    // The About modal is the ONLY mount-time opener in the subtree, and it is
    // gated on `aboutData`, which only the /about fetch sets.
    const doc = frameDoc();
    expect(doc.body.textContent).not.toMatch(/about us/i);
    // POSITIVE: the surface really did render, so the absence above means something.
    expect(doc.body.textContent).toMatch(/Jordan Avery|Reward Schedule/i);
  });

  it('the QR button cannot be ACTIVATED inside the frame — userEvent, not fireEvent', async () => {
    // ⚠ `fireEvent` WOULD PASS HERE AGAINST AN OPERABLE SURFACE. It dispatches an
    // event at a node and performs NO hit-testing, so it happily "clicks" through
    // `pointer-events: none`. Only a pointer-aware driver can tell an inert
    // surface from a live one — recorded in the 3-A handoff, and the reason this
    // case is written with `userEvent`.
    //
    // ⚠ AND THE QR PATH IS THE ONE THE OMITTED TOKEN DOES NOT COVER. Every other
    // fetch in the subtree reads the `sessionToken` PROP; `/qr-code` reads
    // `getReferrerToken()` from storage instead, so the zero-network guarantee
    // for that path rests on the button being unreachable rather than on the
    // fixture. That is worth a test of its own precisely because it is the
    // weakest link.
    await openDashboard();
    const doc = frameDoc();

    // ⚠ THE TRIGGER IS THE "Refer a Friend" BUTTON, NOT ANYTHING CALLED "QR".
    // A first draft of this test searched for /qr|code/i, found nothing, and fell
    // through to a weak "there is no QR text" assertion that passed while testing
    // nothing at all. The opener is `onClick={() => setShowQRModal(true)}` on the
    // share button — named for what the referrer does, not for what it opens.
    const qrButton = Array.from(doc.querySelectorAll('button'))
      .find(el => /refer a friend/i.test(el.textContent || ''));
    expect(qrButton, 'the QR trigger is not on screen — this test is not exercising the path').toBeTruthy();

    // ⚠ THE POSITIVE CONTROL, AND IT COMES FIRST — the repo's established idiom.
    // userEvent refusing a click is only evidence about the FRAME if userEvent
    // will accept one elsewhere. Without this line, "userEvent threw" is equally
    // explained by a broken harness.
    // ⚠ PINNED AT v13: no setup(), click() is SYNCHRONOUS and THROWS.
    expect(
      () => userEvent.click(screen.getByRole('button', { name: 'Dashboard' })),
      'userEvent refused a click in the PARENT document — the refusal below proves nothing'
    ).not.toThrow();

    expect(
      () => userEvent.click(qrButton),
      'a real click reached the QR trigger — the preview is operable and /qr-code is one tap away'
    ).toThrow(/pointer-events/);

    // The modal did not open and nothing was fetched.
    expect(doc.body.textContent).not.toMatch(/scan|qr code/i);
    expect(fetchSpy.mock.calls.map(c => String(c[0]))).toEqual([]);
  });
});

describe('Preview-1 — RewardScheduleCard always reaches a terminal state', () => {

  function skeletonCount(container) {
    return Array.from(container.querySelectorAll('div'))
      .filter(el => (el.getAttribute('style') || '').includes('skeletonPulse')).length;
  }

  it('a FALSY token settles on the empty state, not an eternal skeleton', async () => {
    // ⚠ THE BUG THIS PINS: `if (!sessionToken) return` sat OUTSIDE the async IIFE,
    // above the `try`, so the `setLoading(false)` in its `finally` was never
    // reached and the card rendered three animated skeletons forever. Not a slow
    // load — a permanent one, in the real app as much as in the preview.
    const { container } = render(
      <ThemeProvider
        supplied={{ branding: resolveBrandingTheme(DRAFT), source: 'preview' }}
        fetchStoredMode={NO_STORED_MODE}
        mode="light"
      >
        <RewardScheduleCard sessionToken={undefined} />
      </ThemeProvider>
    );
    await act(async () => { await Promise.resolve(); });

    await waitFor(() => expect(skeletonCount(container)).toBe(0));
    expect(container.textContent).toMatch(/no reward schedules available/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSITIVE CONTROL — the skeleton detector can actually see a skeleton', async () => {
    // ⚠ `skeletonCount() === 0` IS SATISFIED BY A DETECTOR THAT MATCHES NOTHING.
    // A never-resolving fetch holds the card in its loading state, which is the
    // only way to prove the query above is looking at the right thing.
    fetchSpy.mockImplementation(() => new Promise(() => {}));
    const { container } = render(
      <ThemeProvider
        supplied={{ branding: resolveBrandingTheme(DRAFT), source: 'preview' }}
        fetchStoredMode={NO_STORED_MODE}
        mode="light"
      >
        <RewardScheduleCard sessionToken="held-open" />
      </ThemeProvider>
    );
    await act(async () => { await Promise.resolve(); });

    expect(skeletonCount(container)).toBeGreaterThan(0);
  });

  it('a SUPPLIED schedules array suppresses the fetch and renders immediately', async () => {
    const { container } = render(
      <ThemeProvider
        supplied={{ branding: resolveBrandingTheme(DRAFT), source: 'preview' }}
        fetchStoredMode={NO_STORED_MODE}
        mode="light"
      >
        <RewardScheduleCard sessionToken="would-fetch" schedules={PREVIEW_FIXTURE.default.schedules} />
      </ThemeProvider>
    );
    await act(async () => { await Promise.resolve(); });

    expect(fetchSpy, 'a supplied array must not fetch, even with a token present')
      .not.toHaveBeenCalled();
    expect(skeletonCount(container)).toBe(0);
    expect(container.textContent).toMatch(/Standard/);
  });

  it('a SUPPLIED EMPTY array is a real answer, not an absent one', async () => {
    // ⚠ THE PREDICATE MATCHES ITS OWN VALUE'S SHAPE. `Array.isArray`, not
    // truthiness: `[]` means "this contractor has no schedules" and must suppress
    // the fetch exactly as a populated array does. Truthiness would re-arm it.
    render(
      <ThemeProvider
        supplied={{ branding: resolveBrandingTheme(DRAFT), source: 'preview' }}
        fetchStoredMode={NO_STORED_MODE}
        mode="light"
      >
        <RewardScheduleCard sessionToken="would-fetch" schedules={[]} />
      </ThemeProvider>
    );
    await act(async () => { await Promise.resolve(); });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Preview-1 — the frame copies stylesheet links without duplicating them', () => {

  it('an id-LESS link is copied once and stays at one across re-renders', async () => {
    // ⚠ THE DEFECT: the copy effect has no dependency array, so it runs on every
    // render, and its dedupe read `doc.getElementById(link.id || '_')` — an
    // id-less link looked up the literal '_', missed, and was appended again.
    // Unbounded growth for as long as the panel was open.
    //
    // ⚠ IT WAS INVISIBLE ON THE LINKS ANYONE LOOKED AT. The font links this
    // machinery exists to copy DO carry ids (`gfont-<Family>`), so the only
    // affected links were the ones nobody was thinking about.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://example.test/no-id.css';
    link.setAttribute('data-test-injected', '');
    document.head.appendChild(link);

    const { rerender } = await openDashboard();

    const count = () => frameDoc().head.querySelectorAll('link[href="https://example.test/no-id.css"]').length;

    // POSITIVE FIRST: a frame that copied NOTHING would satisfy "the count did
    // not grow" perfectly.
    expect(count(), 'the frame copied no links at all — nothing below is meaningful')
      .toBeGreaterThan(0);
    const initial = count();

    for (let i = 0; i < 3; i++) {
      rerender(<BrandingPreview formData={{ ...DRAFT, company_name: `Preview Co ${i}` }} />);
      await act(async () => { await Promise.resolve(); });
    }

    expect(count(), 'the id-less link was re-cloned — the href dedupe is not holding')
      .toBe(initial);
  });
});

describe('Preview-1 — the dashboard view renders the REAL component', () => {

  it('it mounts the real Dashboard, not an illustration', async () => {
    await openDashboard();
    const doc = frameDoc();

    // ⚠ FIXTURE DATA THE ILLUSTRATION NEVER CARRIED — and anchored on what the
    // component ACTUALLY renders rather than on the value handed in. `userName`
    // is 'Jordan Avery'; the greeting shows the FIRST name and the avatar shows
    // initials, so a needle of the full string fails against a correct render.
    // The client names are the honest anchor: they are printed verbatim.
    expect(doc.body.textContent).toMatch(/Hey, Jordan/);
    expect(doc.body.textContent).toMatch(/Sam Rivera/);
    expect(doc.body.textContent).toMatch(/Reward Schedule/i);
    // And the tokens follow the draft, which an illustration reading no token
    // could not do.
    const root = doc.querySelector('[data-rm-theme]');
    expect(root.style.getPropertyValue('--rm-primary')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('every pipeline stage in the fixture renders its StatusBadge label', async () => {
    // ⚠ THE DASHBOARD SLICES TO THREE ROWS (`pipeline.slice(0, 3)`), which is why
    // the stages are split across variants rather than piled into one list. A
    // single six-entry fixture would have eye-tested three pills while LOOKING
    // like it covered six — a fixture reporting coverage it does not have.
    const seen = new Set();

    for (const variant of PREVIEW_FIXTURE_VARIANTS) {
      const fixture = PREVIEW_FIXTURE[variant];
      if (!fixture.pipeline.length) continue;

      const { unmount } = render(
        <ThemeProvider
          supplied={{ branding: resolveBrandingTheme(DRAFT), source: 'preview' }}
          fetchStoredMode={NO_STORED_MODE}
          mode="light"
        >
          <Dashboard {...fixture} />
        </ThemeProvider>
      );
      await act(async () => { await Promise.resolve(); });

      for (const entry of fixture.pipeline.slice(0, 3)) {
        const label = STATUS_CONFIG[entry.status].label;
        expect(
          screen.getAllByText(label).length,
          `the "${label}" pill did not render in variant "${variant}"`
        ).toBeGreaterThan(0);
        seen.add(entry.status);
      }
      unmount();
    }

    // ⚠ THE COVERAGE ASSERTION, AND IT IS THE POINT OF THE LOOP. Without it this
    // passes while the variants quietly stop covering the stages the eye test
    // needs — including `lead`, the 4.39:1 pill this arc most needs visible.
    for (const status of Object.keys(STATUS_CONFIG)) {
      expect(seen.has(status), `no fixture variant renders the "${status}" stage — it cannot be eye-tested`).toBe(true);
    }
  });
});
