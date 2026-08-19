// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3a PHASE 4B — LOCKEDSECTION
//
// ⚠ THIS FILE LIVES IN shared/ AND THAT IS HALF THE POINT. LockedSection was in
// components/admin/ because only the admin panel had permissions. The rep app
// wants it in 3b/3c, so it moved here this phase — two import specifiers
// (PermissionGate.jsx, AdminTeamSettings.jsx) and nothing else. A resolvable
// import at the top of this file IS the proof the move landed; if the file were
// still under admin/, this suite would not collect at all.
//
// WHAT THIS SUITE PINS. LockedSection is LIVE — mode="element" on the admin team
// screen's finance-wall and rep-promotion controls, mode="page" on the whole
// Manage Team screen for an admin without the `team` flag.
//
// ⚠ "NOTHING MOUNTS --rm-* ANYWHERE IN PRODUCTION" WAS TRUE IN 4B AND IS FALSE
// SINCE C/DL-3b PHASE 1. ThemeProvider is the product's first production mount,
// and every primitive on the shelf resolves its variables now. THE NARROW
// VERSION IS THE ONE STILL TRUE, AND IT IS THE ONE THESE ASSERTIONS DEPEND ON:
// nothing mounts --rm-* ON THE ADMIN TREE. AdminPanel renders outside
// ThemeProvider by Ruling 5, and ABR Phase 2 re-proved it structurally by giving
// the panel BrandingProvider, which has no code path that emits a custom
// property. That is why the fallbacks below are asserted as literals — on the
// only surface that renders this component, the fallback is what paints.
//
// 4B's binding requirement was that the admin panel look EXACTLY as it did then,
// while the two hardcoded brand literals became theme-readable for a future rep
// surface. ABR Phase 5 repainted the panel, which retired the first half and
// turned one of those literals into a defect: the lock icon sat at 1.67:1 on the
// repainted card until 6B step 5 routed it through statusVar(). The scrim's
// #012854 is the other one and is still D-G's, still deferred to the pre-launch
// brand-literal sweep.
//
// ⚠ jsdom DOES NOT RESOLVE var(). Same two-half proof as Phase 4A:
//   (a) DECLARATION — the element declares exactly var(--rm-X, <today's value>).
//   (b) CASCADE SCOPE — a --rm-X on a wrapper is visible on the element's own
//       computed style, so it sits where a browser WOULD resolve (a).
//
// ── WHY THE SCRIM IS TWO DIVS AND NOT color-mix ──────────────────────────────
// Today's scrim is rgba(1,40,84,0.75) — one value carrying both a colour and an
// alpha. A custom property cannot be given an alpha inline: `rgba(var(--x), .75)`
// is not valid CSS. The two candidates were:
//
//   color-mix(in srgb, var(--rm-bg, #012854) 75%, transparent)
//       Exact, and jsdom retains it verbatim. REJECTED: on any engine without
//       color-mix the whole declaration is dropped, leaving NO SCRIM — blurred
//       but unveiled permission-gated content. This component fails OPEN in that
//       case, which is the one failure mode it exists to prevent.
//
//   a dedicated scrim layer painted var(--rm-bg, #012854) at opacity 0.75
//       Composites identically BY DEFINITION (a 75%-alpha fill and an opaque fill
//       at 75% opacity are the same paint), uses only the plain var() form the
//       rest of 3a already ships, and has no support floor at all. CHOSEN.
//
// The card cannot live inside that layer — opacity is inherited by descendants
// and would fade the lock card too. Hence three children, not two.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { AD } from '../../constants/adminTheme';
import { STATUS_LIGHT, STATUS_DARK, STATUS_VARS, statusVar } from '../../constants/statusTheme';
import LockedSection from './LockedSection';
import PermissionGate from '../admin/PermissionGate';
import { AdminPermissionsContext } from '../../hooks/useAdminPermissions';

// The scrim's two values, kept as literals: the contract is that these keep
// rendering, so a test comparing a constant to itself pins nothing.
const TODAY_SCRIM_COLOUR = '#012854';   // was baked into rgba(1,40,84,0.75)
const TODAY_SCRIM_ALPHA = '0.75';
//
// There is no matching literal for the lock icon any more. It had one —
// TODAY_LOCK_AMBER, '#fbbf24' — because the component hardcoded the DARK status
// value as its fallback. ABR 6B step 5 routed the icon through statusVar(), so
// the assertions build their expectation from the helper and the light table
// instead, and a local copy of the value would only be one more thing to drift.

const css = (value) => String(value).replace(/\s+/g, '');

// Round-trips a CSS value through jsdom's own parser so comparisons run on what
// jsdom will actually store, not on the source text.
//
// ⚠ WHY THIS IS NEEDED HERE AND NOT IN THE var() ASSERTIONS ABOVE. jsdom leaves a
// var() declaration completely unparsed — '#012854' inside one reads back
// verbatim. A BARE hex is parsed and re-serialised: AD.bgCard '#FFFFFF' reads
// back as 'rgb(255, 255, 255)'. So the AD-token assertions have to normalise and
// the var() ones must not, and comparing an AD token against its raw hex would
// fail while the component was perfectly correct.
//
// (The worked example said '#1f2638' until 5.2d-1 — AD.bgCard's DARK-THEME value,
// left behind when 5.1 collapsed bgCard to #FFFFFF. The mechanism it describes is
// unchanged and the helper is untouched; only the example was stale, which is the
// worst kind here because the whole point of the comment is what jsdom returns.)
function asJsdom(property, value) {
  const probe = document.createElement('div');
  probe.style[property] = value;
  return css(probe.style[property]);
}

function renderThemed(ui, vars = {}) {
  const { container } = render(ui);
  const wrapper = document.createElement('div');
  container.parentNode.insertBefore(wrapper, container);
  wrapper.appendChild(container);
  for (const [name, value] of Object.entries(vars)) wrapper.style.setProperty(name, value);
  return { root: container.firstElementChild, wrapper, container };
}

const lockIcon = (root) => root.querySelector('.ph-lock-simple');

// ── THE CONTRAST HELPERS — WHAT THEY PROVE AND WHAT THEY DO NOT ──────────────
// WCAG 2.x relative luminance and contrast ratio, over two #RRGGBB values.
// Deliberately arithmetic and not rendering: jsdom resolves no var() and
// computes no contrast, so nothing in this suite can observe a painted pixel.
//
// ⚠ WHAT THE CONTRAST CASE PROVES: that the PAIR OF VALUES the component
// declares clears the floor. ⚠ WHAT IT DOES NOT PROVE: that the fallback is
// what actually paints. That is Ruling 5 — guaranteed structurally by the admin
// tree rendering outside ThemeProvider, and asserted in ThemeProvider.test.jsx
// ('mounts NOTHING on document.documentElement') and BrandingProvider.test.jsx
// ('emits no --rm-* custom property on ANY element in its tree'). Two claims,
// two places. Said here because a contrast assertion sitting next to a
// declaration assertion quietly implies it covers both, and it does not.
const srgbToLinear = (channel) => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
};

const contrastRatio = (a, b) => {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

// Pulls the FALLBACK out of a 'var(--name, fallback)' declaration. The fallback
// is what paints on the admin tree, so it — not the token table — is the value
// whose contrast matters.
const fallbackOf = (declaration) => {
  const match = /var\(\s*--[\w-]+\s*,\s*([^)]+)\)/.exec(String(declaration));
  return match ? match[1].trim() : null;
};

// ─────────────────────────────────────────────────────────────────────────────
describe('LockedSection — page mode structure', () => {

  it('blurs the content and makes it non-interactive', () => {
    const { root } = renderThemed(
      <LockedSection mode="page" label="Manage Team"><p>secret roster</p></LockedSection>
    );
    const blurred = root.children[0];
    expect(blurred.style.filter).toBe('blur(6px)');
    expect(blurred.style.pointerEvents).toBe('none');
    expect(blurred.style.userSelect).toBe('none');
    expect(blurred).toHaveTextContent('secret roster');
  });

  it('renders three layers: blurred content, its own scrim, then the card', () => {
    // THE STRUCTURAL CHANGE THIS PHASE MAKES, and the reason it is asserted
    // directly rather than incidentally. The scrim used to be a background on the
    // same div that centres the card; it is now its own layer so it can carry
    // opacity without fading the card. Two children means the split was lost and
    // the scrim is back to needing an inline alpha.
    const { root } = renderThemed(<LockedSection mode="page" label="Manage Team" />);
    expect(root.children).toHaveLength(3);
  });

  it('draws a height placeholder when given no children, so the slot is not empty', () => {
    const { root } = renderThemed(<LockedSection mode="page" label="Manage Team" />);
    expect(root.children[0].firstElementChild.style.height).toBe('400px');
  });

  it('shows the lock affordance and the explanation', () => {
    renderThemed(<LockedSection mode="page" label="Manage Team" />);
    expect(screen.getByText('Manage Team')).toBeInTheDocument();
    expect(screen.getByText('Contact your Owner to adjust permissions.')).toBeInTheDocument();
  });

  it('carries a caller-supplied tooltip instead of the default', () => {
    renderThemed(<LockedSection mode="page" tooltip="Ask your Owner for access to Manage Team." />);
    expect(screen.getByText('Ask your Owner for access to Manage Team.')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LockedSection — element mode structure', () => {

  it('dims the control, blocks pointer events, and overlays a hover target', () => {
    const { root } = renderThemed(
      <LockedSection mode="element" tooltip="Requires rep promotion permission.">
        <button>Promote</button>
      </LockedSection>
    );
    const dimmed = root.children[0];
    expect(dimmed.style.opacity).toBe('0.35');
    expect(dimmed.style.pointerEvents).toBe('none');

    const overlay = root.children[1];
    expect(overlay.style.cursor).toBe('not-allowed');
    expect(overlay).toHaveAttribute('title', 'Requires rep promotion permission.');
  });

  it('stays a two-layer treatment — the scrim split is page mode only', () => {
    // Non-vacuity for the three-children assertion above: if the split had been
    // applied to both modes, that test would pass while this one caught the
    // element treatment gaining a scrim it never had.
    const { root } = renderThemed(<LockedSection mode="element"><button>Promote</button></LockedSection>);
    expect(root.children).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LockedSection — theme declaration, with today as the fallback', () => {

  it('(a) paints the scrim with --rm-bg, falling back to exactly today\'s colour', () => {
    // --rm-bg AND NOT --rm-secondary, which is the intuitive-but-wrong choice. A
    // scrim pushes content back toward the page's own ground, which is what bg
    // IS. --rm-secondary is a BRAND tone that deriveDarkTokens BRIGHTENS until it
    // clears BRAND_ON_DARK_MIN_CONTRAST against the surface — mounting that here
    // would paint a bright wash over the locked content in dark mode.
    const { root } = renderThemed(<LockedSection mode="page" label="Manage Team" />);
    const scrim = root.children[1];
    expect(css(scrim.style.background)).toBe(css(`var(--rm-bg, ${TODAY_SCRIM_COLOUR})`));
    expect(scrim.style.opacity).toBe(TODAY_SCRIM_ALPHA);
  });

  it('the scrim fallback reproduces today\'s rgba(1,40,84,0.75) exactly', () => {
    // Source-over compositing of an opaque fill at 75% element opacity is
    // arithmetically identical to a 75%-alpha fill of the same colour. Asserting
    // the two inputs that make that true is the whole preservation proof.
    const { root } = renderThemed(<LockedSection mode="page" label="Manage Team" />);
    const scrim = root.children[1];
    expect(css(scrim.style.background)).toContain(css(TODAY_SCRIM_COLOUR));
    expect(Number(scrim.style.opacity)).toBe(0.75);
    expect(scrim.style.position).toBe('absolute');
    expect(scrim.style.inset).toBe('0px');
  });

  it('(b) the scrim sits inside the cascade scope that would resolve --rm-bg', () => {
    const { root } = renderThemed(
      <LockedSection mode="page" label="Manage Team" />, { '--rm-bg': '#0B111E' }
    );
    expect(getComputedStyle(root.children[1]).getPropertyValue('--rm-bg')).toBe('#0B111E');
  });

  it('(a) colours the lock icon from --rm-warning-text, falling back to the LIGHT value', () => {
    // ⚠ THIS IS A VALUE ASSERTION, NOT A MECHANISM ONE, and the distinction is
    // load-bearing for the case at the foot of this file. It compares the
    // component's declaration against statusVar()'s output, and a hand-written
    // 'var(--rm-warning-text, #B45309)' would satisfy it identically — the DOM
    // string is the same either way. Nothing here can see whether the helper was
    // called. See "the dark status token stays out of this component's source".
    const { root } = renderThemed(<LockedSection mode="page" label="Manage Team" />);
    expect(css(lockIcon(root).style.color)).toBe(css(statusVar('warningText')));
  });

  it('the lock glyph clears the 3:1 graphic floor against the card it sits on', () => {
    const { root } = renderThemed(<LockedSection mode="page" label="Manage Team" />);
    const declared = fallbackOf(lockIcon(root).style.color);
    expect(declared, 'the icon must declare var(--name, fallback)').toBeTruthy();
    expect(
      contrastRatio(declared, AD.bgCard),
      `${declared} on AD.bgCard ${AD.bgCard}`
    ).toBeGreaterThanOrEqual(3);
  });

  it('(b) the icon sits inside the cascade scope that would resolve it', () => {
    const { root } = renderThemed(
      <LockedSection mode="page" label="Manage Team" />, { '--rm-warning-text': '#B45309' }
    );
    expect(getComputedStyle(lockIcon(root)).getPropertyValue('--rm-warning-text')).toBe('#B45309');
  });

  it('reads its card chrome from the AD tokens rather than from literals', () => {
    // SCOPE FENCE, ASSERTED. Only the two BRAND literals were re-pointed in 4B;
    // the card chrome still comes from AD. Pinning this stops a later edit from
    // half-doing the migration and leaving the admin card in a state neither
    // theme wants.
    //
    // ⚠ REWORDED IN ADMIN BRAND RETIREMENT 5.1. This test was called "leaves the
    // AD dark-admin tokens alone this phase" and argued that AD.borderStrong was
    // "rgba(255,255,255,0.12), a white alpha that is invisible on a light card".
    // Both statements were true when written and are now false: 5.1 moved the AD
    // set to a LIGHT palette and borderStrong is rgba(28,45,77,0.18).
    //
    // THE ASSERTIONS DID NOT CHANGE AND DID NOT NEED TO. They read the tokens
    // dynamically on both sides, so they followed the palette on their own — the
    // stale part was the prose. A comment asserting a false fact outlasts a
    // wrong value, because the sweep catches the value and the next session
    // simply believes the comment.
    const { root } = renderThemed(<LockedSection mode="page" label="Manage Team" />);
    const card = root.children[2].firstElementChild;
    expect(css(card.style.background)).toBe(asJsdom('background', AD.bgCard));
    expect(css(card.style.border)).toBe(asJsdom('border', `1px solid ${AD.borderStrong}`));
    expect(css(card.style.boxShadow)).toBe(asJsdom('boxShadow', AD.shadowLg));
  });

  it('declares no bare var() anywhere — every one carries a fallback', () => {
    const { root } = renderThemed(<LockedSection mode="page" label="Manage Team"><p>x</p></LockedSection>);
    for (const el of [root, ...root.querySelectorAll('*')]) {
      for (const prop of Array.from(el.style)) {
        const value = el.style.getPropertyValue(prop);
        if (!value.includes('var(')) continue;
        expect(value, `${prop} on <${el.tagName.toLowerCase()}>`).toMatch(/var\(\s*--[\w-]+\s*,/);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('statusTheme — the warning role added for the lock affordance', () => {

  it('adds warning to all three tables so the property set cannot drift', () => {
    expect(STATUS_LIGHT.warning).toBe('#D97706');
    expect(STATUS_LIGHT.warningText).toBe('#B45309');
    expect(STATUS_DARK.warning).toBe('#D97706');
    expect(STATUS_DARK.warningText).toBe('#fbbf24');
    expect(STATUS_VARS.warning).toBe('--rm-warning');
    expect(STATUS_VARS.warningText).toBe('--rm-warning-text');
  });

  it('statusVar() keeps its LIGHT-fallback contract for the new role too', () => {
    // The helper is unchanged and still hands back the light value, because a
    // primitive with no variables mounted is on a light surface. LockedSection
    // was the one exception to that and is not any more — ABR 6B step 5 routed
    // its lock icon through this helper like every other consumer.
    expect(statusVar('warningText')).toBe(`var(--rm-warning-text, ${STATUS_LIGHT.warningText})`);
  });

  it('the dark status token stays out of this component\'s source', () => {
    // ⚠ WHAT THIS SEES, AND WHAT NOTHING IN THIS FILE SEES.
    //
    // IT PROVES: STATUS_DARK is absent from LockedSection.jsx's source text.
    // IT DOES NOT PROVE: that the component routes through statusVar(). NO TEST
    // CAN. statusVar('warningText') and a hand-written
    // 'var(--rm-warning-text, #B45309)' emit an identical DOM string, so "(a)
    // colours the lock icon" is a VALUE assertion, not a mechanism one. This
    // case is the only thing in the file that sees the mechanism at all, and
    // only negatively — by the absence of the token the old mechanism needed.
    //
    // ⚠ WHICH IS WHY IT IS NOT REDUNDANT WITH (a), and a reader who assumes (a)
    // covers routing will delete this as duplication. That deletion is the exact
    // regression it exists to catch: this component declared the DARK status
    // value until ABR 6B step 5, four separate records instructed the next
    // session to keep it that way, and (a) passes just as happily if STATUS_DARK
    // comes back and is used for something else in the file.
    //
    // SOURCE TEXT, NOT AN IMPORT CHECK, on purpose: under Vite a missing named
    // import yields undefined rather than throwing, so an import-based check for
    // a removed symbol cannot fail. CLAUDE.md records that as vacuity shape #4.
    //
    // ⚠ IT DOES NOT EXEMPT COMMENTS, and that is deliberate rather than crude.
    // It fired on this very step against a comment in LockedSection.jsx that
    // named the token while explaining why the token was not used; the comment
    // was reworded to say it in prose. Same reasoning as the brand-literal
    // sweep matching hexes in comments — a name in prose is how a retired symbol
    // gets pasted back into code — and it keeps the invariant a plain one:
    // the identifier does not appear in that file, anywhere, for any reason.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/shared/LockedSection.jsx'), 'utf8'
    );
    expect(source).not.toContain('STATUS_DARK');
    expect(source, 'the light-value helper is what replaced it').toContain('statusVar');
  });

  // ── WHAT WAS DELETED HERE, SO IT IS NOT RESTORED ───────────────────────────
  // This block also carried
  //     expect(css(lockIcon(root).style.color)).not.toBe(css(statusVar('warningText')))
  // whose only job was fencing the old inversion — "do not replace the dark
  // fallback with statusVar()'s light one". Step 5 does precisely that, so the
  // assertion's REASON is gone, not merely its value. Rewritten to guard the
  // other direction it would be strictly redundant: "(a)" already excludes every
  // value that is not statusVar()'s output, #fbbf24 included.
  //
  // What replaced it is stronger than what it was. The chain is three links,
  // each pinned by a different case: the component declares statusVar()'s output
  // ("(a) colours the lock icon"), statusVar() returns the light table value
  // ("statusVar() keeps its LIGHT-fallback contract"), and that value is
  // #B45309 ("adds warning to all three tables"). Break any one link and a
  // named case tells you which.
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PermissionGate — unchanged by the move', () => {

  const gate = (value) => render(
    <AdminPermissionsContext.Provider value={value}>
      <PermissionGate flag="team" mode="page" label="Manage Team"><p>roster</p></PermissionGate>
    </AdminPermissionsContext.Provider>
  );

  it('FAIL-CLOSED — denies while permissions are still loading', () => {
    // The single most important behaviour in the file: never flash unlocked
    // content before the answer arrives. Nothing in 4B touches the decision
    // chain, and this is what proves it.
    const { container } = gate({ tier: null, permissions: {}, loading: true });
    expect(lockIcon(container)).not.toBeNull();
  });

  it('FAIL-CLOSED — denies when loading finished with no tier at all', () => {
    const { container } = gate({ tier: null, permissions: {}, loading: false });
    expect(lockIcon(container)).not.toBeNull();
  });

  it('denies a resolved admin who lacks the flag', () => {
    const { container } = gate({ tier: 'admin', permissions: { other: true }, loading: false });
    expect(lockIcon(container)).not.toBeNull();
  });

  it('admits an owner, and admits a holder of the flag', () => {
    // NON-VACUITY for all three denials above: if the gate denied unconditionally
    // they would every one of them pass for free.
    const owner = gate({ tier: 'owner', permissions: {}, loading: false });
    expect(lockIcon(owner.container)).toBeNull();
    expect(owner.container).toHaveTextContent('roster');

    const holder = gate({ tier: 'admin', permissions: { team: true }, loading: false });
    expect(lockIcon(holder.container)).toBeNull();
    expect(holder.container).toHaveTextContent('roster');
  });

  it('still resolves LockedSection from its new shared/ home', () => {
    // If the move had left a stale './LockedSection' specifier in PermissionGate,
    // the import would fail and every test in this block would go red — but this
    // one names the reason.
    const { container } = gate({ tier: 'admin', permissions: {}, loading: false });
    expect(container.firstElementChild.children).toHaveLength(3);
  });
});
