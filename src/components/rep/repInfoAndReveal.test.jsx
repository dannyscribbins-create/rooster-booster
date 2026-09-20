// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-9b — THE INFO AFFORDANCE AND THE LONG-PRESS REVEAL
//
// ⚠ WHICH CLAIMS THIS FILE CAN MAKE, STATED FIRST, BECAUSE 9b's OWN MOTION DEFECT
// IS THE REASON. `pressTransition` shipped green through this suite emitting a
// shorthand that parsed into the wrong thing — jsdom stores a declaration verbatim
// and computes nothing, so `toContain` on a declaration proved only that characters
// were present. The same limit applies here and harder, because this feature makes
// VISUAL and POSITIONAL claims.
//
//   DECLARATION-LEVEL (this file):  which element exists, its role, its aria state,
//                                   which token a style reaches for, event wiring,
//                                   and the SHAPE of a value rather than its effect.
//   BROWSER ONLY (the 9b pass):     that the blur blurs, that the panel covers the
//                                   card, that it opens downward, that the icon
//                                   clears the 3:1 graphic floor on both brands.
//
// ⚠ NOTHING HERE ASSERTS A CONTRAST RATIO OR A PAINTED POSITION, and no `toContain`
// is used where a shape check would say more.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import ThemeProvider from '../shared/ThemeProvider';
import RepInfoIcon from './RepInfoIcon';
import RepRevealCard from './RepRevealCard';
import { REP_GLOSSARY, glossary } from './repGlossary';
import { LONG_PRESS_MS } from './RepRevealCard';
import { MOTION } from './repMotion';
import RepHomeScreen from './RepHomeScreen';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';

const wrap = (ui) => render(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(() => { localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token'); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); cleanup(); delete global.fetch; });

describe('Canvass-9b — the glossary is ONE copy source', () => {
  it('every entry has a term and a body, and no body is empty', () => {
    for (const [key, entry] of Object.entries(REP_GLOSSARY)) {
      expect(typeof entry.term, `${key}.term`).toBe('string');
      expect(entry.term.length, `${key}.term is empty`).toBeGreaterThan(0);
      expect(entry.body.length, `${key}.body is empty`).toBeGreaterThan(0);
    }
  });

  it('⚠ FLAGGED has NO entry — no explanatory language about it anywhere in the app', () => {
    // Danny's ruling. An FAQ and contractor training cover the concept; a rep can take
    // no action on a flag an owner resolves. ⚠ Adding a friendly one-liner is the
    // obvious helpful move and it is forbidden, which is why this is a fence and not
    // a comment.
    expect(REP_GLOSSARY.flagged).toBeUndefined();
    for (const entry of Object.values(REP_GLOSSARY)) {
      expect(entry.term.toLowerCase(), 'a glossary term names Flagged').not.toContain('flag');
      expect(entry.body.toLowerCase(), 'a glossary body explains Flagged').not.toContain('flag');
    }
  });

  it('⚠ REFERRAL CONVERSIONS has no entry — the card already explains itself', () => {
    // Its definition line IS the explanation an icon would have opened. A second route
    // to the same sentence is clutter, not help.
    expect(REP_GLOSSARY.conversions).toBeUndefined();
  });

  it('⚠ an unknown key THROWS rather than returning an empty panel', () => {
    // A control that is present and says nothing is worse than no control — A29's
    // reasoning. A throw surfaces here; a silent `undefined` would render an empty box.
    expect(() => glossary('nope')).toThrow(/no entry/i);
  });

  it('Danny’s attribution wording is carried verbatim', () => {
    // The one string in the glossary already approved. Pinned so an edit is deliberate.
    expect(REP_GLOSSARY.attributionType.body)
      .toBe('Clients matched to you through any means are credited to you.');
  });
});

describe('Canvass-9b — the info icon', () => {
  it('is a real control, closed by default, and names what it explains', () => {
    wrap(<RepInfoIcon termKey="locked" />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    // ⚠ THE ACCESSIBLE NAME SAYS WHAT IT EXPLAINS. Five buttons named "info" on one
    // screen tell a screen-reader user nothing.
    expect(btn.getAttribute('aria-label')).toBe('About Locked');
    expect(document.querySelector('[data-rep-info-panel]')).toBeNull();
  });

  it('opens and closes, and the panel carries the glossary body EXACTLY', () => {
    // ⚠ THE SAME BINDING, NOT A MATCHING STRING. Asserting the rendered text equals
    // `REP_GLOSSARY.locked.body` is what makes "one copy source" checkable — a second
    // copy pasted into the component would pass a `toContain` and fail this.
    wrap(<RepInfoIcon termKey="locked" />);
    fireEvent.click(screen.getByRole('button'));
    const panel = document.querySelector('[data-rep-info-panel="locked"]');
    expect(panel).toBeTruthy();
    expect(panel.textContent).toBe(REP_GLOSSARY.locked.body);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('[data-rep-info-panel]')).toBeNull();
  });

  it('⚠ the panel is WIRED to the button by id, not merely adjacent to it', () => {
    wrap(<RepInfoIcon termKey="provisional" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    const panel = document.querySelector('[data-rep-info-panel]');
    expect(btn.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.id.length).toBeGreaterThan(0);
  });

  it('⚠ two icons for the SAME term on one document get DIFFERENT ids', () => {
    // `locked` and `provisional` appear on BOTH Home and Clients, and both screens are
    // in one document in the admin branding preview. A term-derived id would collide
    // and `aria-controls` would point at the wrong panel.
    wrap(<><RepInfoIcon termKey="locked" /><RepInfoIcon termKey="locked" /></>);
    const [a, b] = screen.getAllByRole('button');
    fireEvent.click(a);
    fireEvent.click(b);
    const ids = [...document.querySelectorAll('[data-rep-info-panel]')].map((p) => p.id);
    expect(new Set(ids).size, 'two panels share an id').toBe(2);
  });

  it('⚠ the icon is NOT faded — it is a control, not decoration', () => {
    // `opacity` INHERITS, so an icon placed inside the muted label would be dimmed to
    // match it. RowChevron is deliberately 0.55 because a chevron repeats on every
    // row; this is a thing a rep is meant to find.
    wrap(<RepInfoIcon termKey="clients" />);
    const btn = screen.getByRole('button');
    expect(btn.style.opacity === '' || btn.style.opacity === '1').toBe(true);
    expect(btn.style.color).toContain('--rm-text');
  });
});

describe('Canvass-9b — which cards carry an icon, and which deliberately do not', () => {
  const payload = {
    stats: { clients: 3, locked: 2, provisional: 1, flagged: 4, conversions: 6 },
    focus: { furthestAlong: [], recentlyAssigned: [] },
  };

  const mountHome = () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => payload }));
    return wrap(<RepHomeScreen />);
  };

  it('CLIENTS, LOCKED and PROVISIONAL each carry one', async () => {
    const { container } = mountHome();
    await screen.findByText('Your book at a glance');
    for (const term of ['clients', 'locked', 'provisional']) {
      expect(
        container.querySelector(`[data-rep-info-icon="${term}"]`),
        `${term} has no info icon`
      ).toBeTruthy();
    }
  });

  it('⚠ the CONVERSIONS card carries NO info icon, though it carries a reveal', async () => {
    // Its definition line is the explanation. The caret opens the BREAKDOWN, which is
    // different content — so the absence of one control and the presence of the other
    // are both deliberate, and asserting them together is what says so.
    const { container } = mountHome();
    await screen.findByText('Your book at a glance');
    const card = container.querySelector('[data-testid="rep-conversions"]');
    expect(card.querySelector('[data-rep-info-icon]'), 'the conversions card grew an info icon').toBeNull();
    expect(card.querySelector('[data-rep-reveal-toggle]'), 'the conversions card lost its reveal').toBeTruthy();
    // And the definition line — the thing that makes the icon unnecessary — is present.
    expect(card.textContent).toContain('People your clients referred who have become customers.');
  });

  it('⚠ NOTHING on the screen explains FLAGGED, even though the payload carries it', async () => {
    // ⚠ THE PAYLOAD DELIBERATELY CARRIES `flagged: 4` so this is about the ABSENCE of
    // explanatory language and not about a fixture that forgot the field.
    const { container } = mountHome();
    await screen.findByText('Your book at a glance');
    expect(container.querySelector('[data-rep-info-icon="flagged"]')).toBeNull();
    expect(container.textContent.toLowerCase()).not.toContain('flagged');
  });
});

describe('Canvass-9b — the long-press reveal', () => {
  const mountReveal = (over = {}) => wrap(
    <RepRevealCard
      revealLabel="Test breakdown"
      left={{ title: 'Referral', value: 7 }}
      right={{ title: 'Total', empty: 'Not recorded yet.' }}
      {...over}
    >
      <div>card face</div>
    </RepRevealCard>
  );

  it('⚠ a HOLD opens it, and a short tap does NOT', async () => {
    vi.useFakeTimers();
    const { container } = mountReveal();
    const card = container.querySelector('[data-rep-reveal-card]');

    // A short press: below the threshold, nothing opens.
    fireEvent.pointerDown(card);
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS - 100); });
    fireEvent.pointerUp(card);
    expect(container.querySelector('[data-rep-reveal-panel]'), 'a short tap opened the reveal').toBeNull();

    // A hold past the threshold: it opens.
    fireEvent.pointerDown(card);
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 10); });
    expect(container.querySelector('[data-rep-reveal-panel]')).toBeTruthy();
    vi.useRealTimers();
  });

  it('⚠ a hold that becomes a SCROLL never opens it', async () => {
    // `pointercancel` with no `pointerup` is what a scroll gesture beginning on a card
    // produces, and on a long list it is the common interaction rather than an edge.
    vi.useFakeTimers();
    const { container } = mountReveal();
    const card = container.querySelector('[data-rep-reveal-card]');
    fireEvent.pointerDown(card);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerCancel(card);
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });
    expect(container.querySelector('[data-rep-reveal-panel]')).toBeNull();
    vi.useRealTimers();
  });

  it('⚠ THE VISIBLE CONTROL OPENS THE SAME PANEL — the gesture is never the only route', () => {
    // Danny's constraint in terms. This is the assertion that makes the long-press a
    // shortcut rather than a secret.
    const { container } = mountReveal();
    expect(container.querySelector('[data-rep-reveal-panel]')).toBeNull();
    fireEvent.click(container.querySelector('[data-rep-reveal-toggle]'));
    const panel = container.querySelector('[data-rep-reveal-panel]');
    expect(panel, 'the visible toggle does not open the panel').toBeTruthy();
    expect(panel.textContent).toContain('Referral');
    expect(panel.textContent).toContain('Total');
  });

  it('⚠ a figure with NO source says so — it never renders a zero', () => {
    // A24.4/A34.6's distinction reaching the panel: "you may not see this", "this does
    // not exist yet" and "this is nought" are three different claims, and a 0 in a
    // titled slot asserts the third.
    const { container } = mountReveal();
    fireEvent.click(container.querySelector('[data-rep-reveal-toggle]'));
    const panel = container.querySelector('[data-rep-reveal-panel]');
    expect(panel.textContent).toContain('Not recorded yet.');
    expect(panel.textContent).not.toMatch(/Total\s*0/);
  });

  it('⚠ the frost is a SEPARATE layer and the panel carries NO opacity of its own', () => {
    // ⚠ THIS IS THE FENCE FOR THE DEFECT DANNY EYE-TESTED. The first writing put
    // `opacity: 0.98` on the PANEL, and **opacity INHERITS** — so the revealed text
    // was translucent too and the card's own number showed through the words meant to
    // cover it. The fix is structural: the translucency lives on a dedicated frost
    // element and the content is its SIBLING, so the text has no ancestor carrying an
    // opacity to inherit.
    const { container } = mountReveal();
    fireEvent.click(container.querySelector('[data-rep-reveal-toggle]'));
    const panel = container.querySelector('[data-rep-reveal-panel]');
    const frost = container.querySelector('[data-rep-reveal-frost]');

    expect(frost, 'there is no dedicated frost layer').toBeTruthy();
    // ⚠ THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT: nothing between the
    // text and the panel may be translucent.
    expect(panel.style.opacity, 'the panel carries an opacity, which its text inherits').toBe('');
    // The frost is where the translucency and the blur live.
    expect(Number(frost.style.opacity)).toBeGreaterThan(0);
    expect(Number(frost.style.opacity)).toBeLessThan(1);
    expect(frost.style.background, 'the frost has no ground of its own').toContain('--rm-surface');
    // ⚠ THE BLUR IS ON THE PANEL, NOT ON THE FROST, AND THIS ASSERTS THE POSITION
    // RATHER THAN MERELY ITS PRESENCE — because the position is what broke.
    // `backdrop-filter` on the frost CHILD resolved its backdrop against the panel
    // (which carries an `animation`, creating a stacking context) instead of against
    // the card behind it, so it blurred nothing and the card's text stayed crisp.
    // **Every declaration-level reading looked correct; only a screenshot showed it.**
    expect(panel.style.backdropFilter, 'the blur is not on the panel').toContain('blur');
    expect(frost.style.backdropFilter || '', 'the blur is back on the frost, where it sees nothing').toBe('');
    // ⚠ AND THE FROST IS NOT AN ANCESTOR OF THE TEXT — the whole point.
    const figureText = [...panel.querySelectorAll('p')].find((el) => el.textContent === 'Referral');
    expect(figureText, 'the figure titles are missing').toBeTruthy();
    expect(frost.contains(figureText), 'the text is INSIDE the frost, so it inherits its opacity').toBe(false);
  });

  it('⚠ the frost goes near-opaque when backdrop-filter is unsupported', () => {
    // jsdom implements no `CSS.supports`, which the component treats as NOT
    // supported — so this environment exercises the FALLBACK tint, and that is the
    // branch where "two legible layers" would actually happen. **The fallback
    // direction is the readable one.**
    const { container } = mountReveal();
    fireEvent.click(container.querySelector('[data-rep-reveal-toggle]'));
    const frost = container.querySelector('[data-rep-reveal-frost]');
    expect(Number(frost.style.opacity)).toBeGreaterThanOrEqual(0.95);
  });

  it('⚠ FIX 1 — the panel opens on the SETTLE duration, not the faster base', () => {
    // Danny: "the whiteout takes the card too suddenly." A panel that covers what
    // someone is reading is the one case where arriving fast reads as a snatch.
    const { container } = mountReveal();
    fireEvent.click(container.querySelector('[data-rep-reveal-toggle]'));
    const panel = container.querySelector('[data-rep-reveal-panel]');
    expect(panel.style.animation).toContain(`${MOTION.settle}ms`);
    expect(panel.style.animation).not.toContain(`${MOTION.base}ms`);
  });

  it('⚠ FIX 3 — tapping OUTSIDE the card closes it', () => {
    // Ruled by Danny. The second half of his reasoning is the real one: it makes the
    // panel read as a temporary window rather than a fixed state.
    const { container } = mountReveal();
    fireEvent.click(container.querySelector('[data-rep-reveal-toggle]'));
    expect(container.querySelector('[data-rep-reveal-panel]')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(container.querySelector('[data-rep-reveal-panel]'), 'an outside tap did not close it').toBeNull();
  });

  it('⚠ and a tap INSIDE the card does NOT close it — the paired negative', () => {
    // Without this, "an outside tap closes" is satisfied by a panel that closes on
    // ANY pointerdown, which would make the caret un-tappable while open and would
    // close the moment a rep touched the card to read it.
    const { container } = mountReveal();
    fireEvent.click(container.querySelector('[data-rep-reveal-toggle]'));
    const panel = container.querySelector('[data-rep-reveal-panel]');
    fireEvent.pointerDown(panel);
    expect(container.querySelector('[data-rep-reveal-panel]'), 'a tap inside closed it').toBeTruthy();
  });

  it('⚠ haptics are GUARDED — an absent navigator.vibrate must not throw', () => {
    // It does not exist on iOS Safari at all. It confirms the hold registered, so its
    // absence costs nothing and must never break the gesture.
    vi.useFakeTimers();
    expect(navigator.vibrate).toBeUndefined();
    const { container } = mountReveal();
    const card = container.querySelector('[data-rep-reveal-card]');
    fireEvent.pointerDown(card);
    expect(() => act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 10); })).not.toThrow();
    expect(container.querySelector('[data-rep-reveal-panel]')).toBeTruthy();
    vi.useRealTimers();
  });

  it('⚠ and it FIRES when available — the paired positive', () => {
    vi.useFakeTimers();
    const vibrate = vi.fn();
    navigator.vibrate = vibrate;
    const { container } = mountReveal();
    fireEvent.pointerDown(container.querySelector('[data-rep-reveal-card]'));
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 10); });
    expect(vibrate, 'the hold fired no haptic although vibrate exists').toHaveBeenCalled();
    delete navigator.vibrate;
    vi.useRealTimers();
  });
});
