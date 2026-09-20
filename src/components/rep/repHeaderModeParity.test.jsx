// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-9a PART 1 — THE REP HEADER'S BOX MUST NOT DEPEND ON THE MODE
//
// THE DEFECT, MEASURED ON THE RENDERED NODE rather than reasoned about. Danny has
// had two screenshots of the SAME page at the SAME scroll position, differing only
// by the dark-mode toggle, with the content sitting lower in one — since the first
// rep screen shipped. On palette-beta, at a real 430x860 viewport, with all three
// fonts confirmed loaded in BOTH runs:
//
//     header height   dark 87.59   light 67.59   Δ +20
//     main top        dark 145.59  light 125.59  Δ +20
//     h1 top          dark 169.59  light 149.59  Δ +20
//
// CAUSE: `BrandLogo`'s dark-mode plate wraps the mark in a div padded `10px 14px`.
// 10 + 10 = the whole 20. It is a SINGLE displacement introduced at the header, not
// an accumulation — every number below it carries the same 20 unchanged. Proven by
// zeroing only that padding on the rendered node: the dark header collapsed to
// 67.59 and `main` to 125.59, matching light exactly.
//
// ⚠ AND IT IS INVISIBLE ON THE SEEDED LOCAL STACK, WHICH IS WHY IT SURVIVED THIS
// LONG. `seedLocalStack.js` points every `logo_url` at `example.invalid`, so the
// image fails, BrandMark takes its A2 TEXT branch, and NO plate renders in either
// mode — 53px both ways. The defect needs a logo that actually loads, which is every
// real contractor and no local fixture.
//
// ── ⚠ WHAT THIS FILE CAN AND CANNOT ASSERT, STATED BECAUSE IT DECIDES THE SHAPE ──
// **jsdom performs no layout.** `getBoundingClientRect()` returns zeros and
// `offsetHeight` is 0 for everything, so "the header is 59.8px tall in both modes"
// is NOT assertable here and no amount of care makes it so. The browser measurement
// above is where that lives, and it is recorded in this header rather than pretended
// at in an assertion.
//
// **What IS assertable is the property that PRODUCES equal height:** that the header
// subtree declares the same box in both modes. Every box-affecting declaration in
// this subtree is an inline literal (`padding: '10px 14px'`, `margin: '0 auto 0px'`),
// and inline literals are exactly what jsdom reports faithfully. So this file
// compares the two modes' box declarations element for element.
//
// ⚠ COLOUR IS DELIBERATELY EXCLUDED FROM THE COMPARISON, AND THAT IS NOT A LOOPHOLE.
// The plate's background differs between modes BY DESIGN — that is the whole point of
// the plate (Ruling 3) — and a colour cannot move a box. Including it would make this
// fence fail for the one reason that is correct, which is how a fence gets deleted.
//
// ⚠ THE GUARD-PROOF, RUN RATHER THAN CLAIMED: removing `stableBox` from RepShell's
// `<BrandMark>` takes the parity case RED, because light mode then renders a bare
// `<img>` where dark renders a wrapper around one — the signatures differ in element
// count before they differ in padding. A fence whose failure mode has never been
// observed is a claim, not a check.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RepShell from './RepShell';
import ThemeProvider from '../shared/ThemeProvider';

// ⚠ THE `context` PINS D4 RESOLUTION TO "NOBODY RESOLVED", which is BrandMark's A1
// prong and renders the PLATFORM mark through BrandLogo. That is what makes the plate
// branch reachable in a unit test at all — the A2 text branch has no plate in either
// mode and would make this whole file pass vacuously. Same harness as
// BrandLogo.test.jsx's four-site table, deliberately.
function headerAt(mode) {
  const { container, unmount } = render(
    <ThemeProvider mode={mode} context={{ hostname: 'app.roofmiles.com', search: '', storage: null }}>
      <RepShell onLogout={() => {}} />
    </ThemeProvider>
  );
  const header = container.querySelector('header');
  return { header, unmount };
}

// Every declaration that can change an element's VERTICAL extent, and nothing else.
// ⚠ `width` IS INCLUDED FOR IMAGES ONLY, because an image's height is a function of
// its width through its aspect ratio — so a mode that changed the logo's width would
// change the header's height without touching a single padding value.
function boxSignature(root) {
  const out = [];
  const walk = (el, depth) => {
    const s = el.style;
    out.push([
      depth, el.tagName,
      s.padding, s.paddingTop, s.paddingBottom,
      s.margin, s.marginTop, s.marginBottom,
      s.height, s.lineHeight, s.fontSize,
      el.tagName === 'IMG' ? s.width : '',
      s.display, s.alignItems, s.position,
    ].join('|'));
    for (const child of el.children) walk(child, depth + 1);
  };
  walk(root, 0);
  return out;
}

describe('Canvass-9a Part 1 — the rep header is mode-invariant in its box', () => {
  it('⚠ the header subtree declares an IDENTICAL box in light and dark', () => {
    const light = headerAt('light');
    const lightSig = boxSignature(light.header);
    light.unmount();

    const dark = headerAt('dark');
    const darkSig = boxSignature(dark.header);
    dark.unmount();

    // ⚠ ELEMENT COUNT FIRST, AND IT IS A SEPARATE ASSERTION ON PURPose. This is the
    // half the original defect actually tripped: light rendered a bare <img> and dark
    // rendered a padded wrapper around one, so the trees differed in SHAPE before they
    // differed in any value. Asserting only the joined signature would report a
    // confusing diff for what is really "one mode has an extra element".
    expect(darkSig.length, 'the two modes render a different number of elements in the header')
      .toBe(lightSig.length);
    expect(darkSig).toEqual(lightSig);
  });

  it('⚠ the logo box carries the SAME vertical padding in both modes — the measured 20px', () => {
    // The specific value the browser measurement blamed. Asserted directly as well as
    // through the signature above, so a failure says WHICH thing moved rather than
    // handing back two long arrays.
    const light = headerAt('light');
    const lightBox = light.header.querySelector('[data-rm-logo-box]');
    expect(lightBox, 'light mode renders no logo box — the plate\'s 20px cannot be matched').toBeTruthy();
    const lightPad = lightBox.style.padding;
    light.unmount();

    const dark = headerAt('dark');
    const darkBox = dark.header.querySelector('[data-rm-logo-box]');
    expect(darkBox, 'dark mode renders no logo box').toBeTruthy();
    expect(darkBox.style.padding).toBe(lightPad);
    // ⚠ AND THE DARK ONE IS STILL THE PLATE. Without this, "both modes have a box with
    // equal padding" would be satisfied by deleting the plate treatment entirely —
    // which would fix the layout shift by reintroducing Ruling 3's defect, a
    // dark-inked logo invisible on a dark surface.
    expect(darkBox.hasAttribute('data-rm-logo-plate'), 'the dark box is no longer a plate — Ruling 3 regressed').toBe(true);
    dark.unmount();
  });

  it('⚠ light mode is NOT a plate — the paired negative that keeps Ruling 3 meaningful', () => {
    // The flag-ON/flag-OFF sibling pair this repo requires. The case above proves dark
    // plates; without this one, a component that plated UNCONDITIONALLY would satisfy
    // it, and the plate would paint a light square on an already-light surface.
    const light = headerAt('light');
    expect(light.header.querySelector('[data-rm-logo-plate]')).toBeNull();
    light.unmount();
  });

  it('the mark itself is the same size in both modes', () => {
    // ⚠ MEASURED AND WORTH PINNING: the `<img>` was ALREADY identical in both modes
    // (39.59 x 132 at the old size). The mark was never the variable — the wrapper was
    // — and a future change that scaled the logo per mode would reintroduce the shift
    // through a different door, one the padding assertion above cannot see.
    const light = headerAt('light');
    const lightImg = light.header.querySelector('img');
    const lightWidth = lightImg && lightImg.style.width;
    light.unmount();

    const dark = headerAt('dark');
    const darkImg = dark.header.querySelector('img');
    expect(darkImg.style.width).toBe(lightWidth);
    dark.unmount();
  });

  it('⚠ Part 2a — the header logo ships at half its previous width', () => {
    // 132 -> 66, ruled by Danny: the header and the switcher were consuming roughly a
    // third of a phone viewport before anything useful appeared. Pinned because it is a
    // RULED value rather than a taste one — a later change to it should be deliberate,
    // and this is the sentence that makes it so.
    const light = headerAt('light');
    const img = light.header.querySelector('img');
    expect(img.style.width).toBe('66px');
    light.unmount();
  });
});
