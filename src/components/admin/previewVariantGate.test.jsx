// ─────────────────────────────────────────────────────────────────────────────
// THE FIXTURE-VARIANT PILLS ARE DEV-ONLY — AND THEY SHIPPED TO PRODUCTION ONCE
//
// `9b1fe59` rendered seven internal pills — `default`, `late-stages`,
// `closed-stage`, `stale`, `rate-limited`, `unavailable`, `empty-pipeline` — on
// the live admin Branding panel, where a contractor could see and click them.
// Ruled (Danny, 2026-09-16, option A): gate them on Vite's build-time DEV flag.
//
// ── ⚠ BOTH DIRECTIONS ARE ASSERTED, AND THE ON DIRECTION IS THE IMPORTANT ONE ─
// A gate proven only in the OFF direction passes just as happily if the control
// were DELETED, and a permanently-off control is a silently removed feature —
// here, the whole mechanism P4's eye test depends on. The ON case is what
// distinguishes "gated" from "gone". Same argument, and the same shape, as
// `rmControlGate.test.jsx`.
//
// ── HOW THE FLAG IS DRIVEN ──────────────────────────────────────────────────
// `import.meta.env` is inlined by Vite at build time, so the usual worry is that
// it cannot be moved from a test. It can here: `vi.stubEnv` reaches
// `import.meta.env` under this repo's Vitest setup — the precedent, and the
// empirical verification, are recorded in `rmControlGate.test.jsx`.
//
// That works only because the component reads the flag AT RENDER TIME rather
// than caching it into a module-level const. A const would force this file to
// re-import the whole module graph to change one value, which tests the
// reloading machinery instead of the gate.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import BrandingPreview from './BrandingPreview';
import { PREVIEW_FIXTURE_VARIANTS } from './previewFixture';

const DRAFT = {
  company_name: 'Preview Co',
  primary_color: '#0B3D3B',
  secondary_color: '#C2185B',
  accent_color: '#E6F4F1',
};

afterEach(() => { vi.unstubAllEnvs(); });

/** Opens the panel on the dashboard view and waits for the real mount. */
async function openDashboard() {
  render(<BrandingPreview formData={DRAFT} />);
  await screen.findByText('Live Preview');
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
  await waitFor(() => {
    const frame = document.querySelector('iframe[data-preview-frame]');
    const root = frame?.contentDocument?.querySelector('[data-rm-theme]');
    if (!root) throw new Error('the dashboard view did not mount — nothing below is meaningful');
    return root;
  });
  return document.querySelector('iframe[data-preview-frame]').contentDocument;
}

describe('the fixture-variant pills are gated on import.meta.env.DEV', () => {

  it('DEV=false — the pills are ABSENT (this is what production renders)', async () => {
    vi.stubEnv('DEV', false);
    await openDashboard();

    expect(
      document.querySelector('[data-preview-variant-picker]'),
      'the variant picker rendered in a production build — contractors can see it'
    ).toBeNull();
    expect(document.querySelectorAll('[data-preview-variant]').length).toBe(0);
  });

  it('DEV=true — the pills are PRESENT, one per fixture variant (positive control)', async () => {
    // ⚠ WITHOUT THIS THE CASE ABOVE PASSES AGAINST A DELETED CONTROL.
    vi.stubEnv('DEV', true);
    await openDashboard();

    const picker = document.querySelector('[data-preview-variant-picker]');
    expect(picker, 'the picker is gone even in DEV — the control was removed, not gated').toBeTruthy();

    const keys = [...document.querySelectorAll('[data-preview-variant]')]
      .map(b => b.dataset.previewVariant);
    // Derived from the fixture, so the two cannot drift apart silently.
    expect(keys).toEqual([...PREVIEW_FIXTURE_VARIANTS]);
  });

  it('DEV=false — the dashboard still renders the DEFAULT variant, not a blank or another fixture', async () => {
    // ⚠ HIDING A SELECTOR COULD HAVE STRANDED THE VIEW. The variant is component
    // state seeded to `default`; the pills only MOVE it. This pins that removing
    // the control leaves the initial fixture rendering, which is what a
    // contractor actually sees in production.
    vi.stubEnv('DEV', false);
    const doc = await openDashboard();
    // ⚠ textContent, NOT innerText — jsdom does not implement innerText and
    // returns undefined, which makes every toMatch below a TypeError rather than
    // a silent pass. (It failed loudly here; worth the note so nobody re-tries it.)
    const text = doc.body.textContent;

    expect(text).toMatch(/Hey, Jordan/);        // the fixture's user
    expect(text).toMatch(/Sam Rivera/);          // `default`'s first client
    expect(text).toMatch(/Lead Submitted/);      // `default`'s first stage
    // and NOT a stage that only another variant carries
    expect(text, 'a non-default variant is rendering in production').not.toMatch(/Booking Sent|Not Sold/);
  });

  it('no sample-data or fixture wording reaches the dashboard view (P2)', async () => {
    // ⚠ P2: "NO 'sample data' label on screen. It would be clutter — the preview
    // frame already makes the context evident." `9b1fe59` shipped exactly that
    // label, in the admin chrome beside the casing, AND pinned it with a test.
    //
    // ⚠ THIS SWEEPS THE ADMIN PANEL, NOT THE FRAME. The label was never inside
    // the previewed surface; it sat in the chrome around it, which is precisely
    // where a reader would take it for part of the product. Sweeping the frame
    // would have reported clean about a document the defect was never in.
    vi.stubEnv('DEV', false);
    await openDashboard();

    const frame = document.querySelector('iframe[data-preview-frame]');
    const chrome = document.body.textContent.replace(frame?.contentDocument?.body?.textContent || '', '');

    expect(chrome, 'sample-data wording is on screen — P2 forbids it')
      .not.toMatch(/sample data|sample|fixture|dummy data|placeholder data|not your real/i);
  });

  it('DEV=true — the P2 sweep still holds, so the pills themselves are not a label', async () => {
    // ⚠ THE PILLS ARE NOT EXEMPT FROM P2 JUST BECAUSE THEY ARE DEV-ONLY. Their
    // group label used to read "Sample data variant", which would have failed the
    // sweep above the moment anyone ran it with DEV on. Kept honest here rather
    // than carved out — a sweep that stops reading the states it is hardest to
    // see has a hole in it.
    vi.stubEnv('DEV', true);
    await openDashboard();

    const picker = document.querySelector('[data-preview-variant-picker]');
    expect(picker).toBeTruthy();
    expect(picker.getAttribute('aria-label') || '')
      .not.toMatch(/sample data/i);
  });
});
