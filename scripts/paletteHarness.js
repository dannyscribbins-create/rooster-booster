'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-0 — THE COMPUTED-STYLE HARNESS
//
// ⚠ WHY THIS EXISTS RATHER THAN SCREENSHOTS. Screenshot capture is unusable in
// this environment: reproduced against https://example.com — a white page with
// black text — the capture returned a uniformly near-black frame AND REPORTED
// SUCCESS. A mechanism that reports health it cannot observe is worse than no
// mechanism, so pixels are off the table here.
//
// What DOES work, measured the same session: getComputedStyle in a real browser
// RESOLVES var(), and distinguishes a mounted value from a fallback —
// rgb(220, 38, 38) against rgb(254, 226, 226). jsdom cannot do this at all, which
// is why 654 green React tests never saw the R-1 defect.
//
// ⚠ THE ONE RULE THIS FILE EXISTS TO ENFORCE: READ THE MOUNTED VALUE, NEVER THE
// DECLARATION. A declaration reading `var(--rm-danger, #FEE2E2)` MEASURES 5.30:1
// and PAINTS 1.34:1. A harness that reads source reproduces the bug it was built
// to catch — that is not hypothetical, it is exactly how the login screen shipped.
//
// ── WHAT IT DELIBERATELY IS NOT ─────────────────────────────────────────────
// Not a visual-regression system. No layout, no geometry, no pixel diffing, no
// screenshots, no fonts, no spacing. It answers ONE question per element:
//   "did this end up painting the contractor's colour, or something else?"
// Everything else Palette needs — whether a card edge survives a collapse,
// whether a gradient reads as brand, whether a flattened grid LOOKS broken — is
// a human judgement and is out of scope by construction, not by omission.
// ─────────────────────────────────────────────────────────────────────────────

// ── ⚠ HOW TO DRIVE IT, AND THE ONE ORDERING TRAP — MEASURED, NOT ASSUMED ────
// The harness is a pure module; the browser half is driven through the
// claude-in-chrome tools. Proven working 2026-09-04 against a fixture whose
// answers were written down first:
//
//   1. navigate to the surface
//   2. ⚠ CALL read_network_requests ONCE FIRST, BEFORE the action you want to
//      observe. Network tracking STARTS when that tool is first called — a probe
//      fired before it reports "No requests found", which is indistinguishable
//      from a surface that made none. That is the exact shape of a wrong answer
//      this file exists to refuse, and it bit on the first attempt.
//      ⚠ CONSOLE IS DIFFERENT: read_console_messages returned lines emitted
//      BEFORE it was first called. Console is retroactive, network is not.
//   3. javascript_exec the output of buildProbeScript(selector)
//   4. assertHarnessResult(...) — THEN classify. Never classify a raw result.
//
// Both channels verified: network reports url + method + statusCode with URL
// filtering, which is the "exactly one /api/session/branding call and zero
// /api/branding/:slug calls" evidence the BR arc turned on and which no DOM read
// can produce. Console filters by regex.
//
// ── COLOUR NORMALISATION ────────────────────────────────────────────────────
// Browsers return `rgb(r, g, b)` / `rgba(...)`; source declares `#RRGGBB`.
// Comparing them as strings is the trap; every comparison here goes through this.
function normalizeColour(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v === '') return null;
  let m = /^#([0-9a-fA-F]{3})$/.exec(v);
  if (m) {
    const [r, g, b] = m[1].split('');
    return `rgb(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)})`;
  }
  m = /^#([0-9a-fA-F]{6})$/.exec(v);
  if (m) {
    const n = m[1];
    return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`;
  }
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/.exec(v);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((x) => Math.round(parseFloat(x)));
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return v; // a keyword like `transparent`, or a gradient — returned as-is
}

/** Pulls the custom-property name and literal fallback out of a declaration. */
function parseVarDeclaration(declared) {
  if (typeof declared !== 'string') return null;
  const m = /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]*))?\)/.exec(declared);
  if (!m) return null;
  return { name: m[1], fallback: m[2] === undefined ? null : m[2].trim() };
}

/**
 * THE CORE DECISION, AND THE ONE B.2 CALLS THE HARD PART: did this element paint
 * from a MOUNTED custom property, or did it silently take its FALLBACK?
 *
 * ⚠ THE SIGNAL IS THE PROPERTY'S OWN RESOLVED VALUE AT THIS ELEMENT, not a
 * colour comparison. `getComputedStyle(el).getPropertyValue('--rm-danger')`
 * returns '' when nothing up the tree mounted it, and the mounted value when
 * something did. That is decisive where a colour comparison is merely suggestive
 * — a fallback that HAPPENS to equal the mounted value (which is the healthy
 * case, and the majority) is indistinguishable by colour alone.
 *
 * @param {object} r
 * @param {string} r.declared   the inline declaration, e.g. 'var(--rm-text, #1C2D4D)'
 * @param {string} r.computed   what getComputedStyle returned for the property
 * @param {string} r.varValue   getPropertyValue(varName) at this element; '' if unmounted
 * @returns {{source:'mounted'|'fallback'|'literal'|'unexplained', ...}}
 * @throws  on a malformed reading. ⚠ NEVER RETURNS A "COULD NOT TELL" SHAPE —
 *          a classifier that can also answer "unknown" satisfies every assertion
 *          that looks for absence, which is the double-that-stands-in-for-failure
 *          trap this codebase has hit three times.
 */
function classifyPaint(r) {
  if (!r || typeof r !== 'object') {
    throw new Error('classifyPaint: expected a reading object, got ' + JSON.stringify(r));
  }
  const { declared, computed } = r;
  if (typeof computed !== 'string' || computed.trim() === '') {
    throw new Error(
      'classifyPaint: no computed value. The element did not render, or the page ' +
      'was read before paint — either way this is not a result.'
    );
  }
  const resolved = normalizeColour(computed);
  const parsed = parseVarDeclaration(declared);

  if (!parsed) {
    // No custom property named at all: a raw hex, or an R.* value baked in at
    // build time. Either way this site is NOT migrated.
    return { source: 'literal', property: null, resolved, expected: null, matches: true };
  }

  const varValue = typeof r.varValue === 'string' ? r.varValue.trim() : '';
  const mounted = varValue !== '';
  const expectedRaw = mounted ? varValue : parsed.fallback;
  const expected = normalizeColour(expectedRaw);
  const matches = expected === null ? false : expected === resolved;

  // ⚠ A READING THAT MATCHES NEITHER IS NOT A PASS AND NOT A FAILURE OF THE PAGE
  // — it is a failure of this harness's model, and it must be surfaced as such
  // rather than bucketed into whichever answer is convenient.
  if (!matches) {
    return {
      source: 'unexplained', property: parsed.name, resolved, expected,
      matches: false, mountedVar: mounted,
      note: 'computed value matches neither the mounted property nor the declared fallback',
    };
  }
  return {
    source: mounted ? 'mounted' : 'fallback',
    property: parsed.name, resolved, expected, matches: true, mountedVar: mounted,
  };
}

/**
 * The script injected into the page. Returns one reading per matched element.
 *
 * ⚠ IT REPORTS `varValue` PER ELEMENT, NOT PER DOCUMENT. Custom properties
 * cascade, so "is --rm-danger mounted" has no document-level answer — it depends
 * where the element sits. Reading it at the element is what makes the admin tree
 * (outside ThemeProvider, nothing mounted) distinguishable from the referrer tree.
 */
function buildProbeScript(selector = '*') {
  return `(() => {
    const out = [];
    const els = document.querySelectorAll(${JSON.stringify(selector)});
    for (const el of els) {
      const cs = getComputedStyle(el);
      for (const prop of ['backgroundColor', 'color', 'borderColor']) {
        const declared = el.style ? (el.style[prop] || '') : '';
        if (!declared) continue;
        const m = /var\\(\\s*(--[a-zA-Z0-9-]+)/.exec(declared);
        out.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 40),
          prop,
          declared,
          computed: cs[prop],
          varValue: m ? cs.getPropertyValue(m[1]) : '',
        });
      }
    }
    return { ok: true, count: out.length, readings: out };
  })()`;
}

/**
 * ⚠ THE FAIL-LOUDLY GATE (B.5). The browser connection has dropped mid-session
 * in this project before — during R-1, after working earlier in the same session.
 * A dropped connection must NEVER surface as an empty reading set, because an
 * empty set reads exactly like "swept everything, found no defects".
 *
 * @throws on anything that is not a well-formed, non-empty result.
 */
function assertHarnessResult(raw, { expectAtLeast = 1 } = {}) {
  if (raw === null || raw === undefined) {
    throw new Error(
      'HARNESS: no result. The browser returned nothing — a dropped extension ' +
      'connection or a page that never loaded. THIS IS NOT "no defects found".'
    );
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('HARNESS: malformed result, expected an object, got ' + typeof raw);
  }
  if (raw.ok !== true) {
    throw new Error('HARNESS: probe did not report ok:true — ' + JSON.stringify(raw).slice(0, 200));
  }
  if (!Array.isArray(raw.readings)) {
    throw new Error('HARNESS: result carries no readings array.');
  }
  if (raw.readings.length < expectAtLeast) {
    throw new Error(
      `HARNESS: ${raw.readings.length} readings, expected at least ${expectAtLeast}. ` +
      'A probe that matched nothing is a broken selector or an unrendered page, ' +
      'NOT a clean sweep.'
    );
  }
  return raw.readings;
}

/** Rolls readings up into the per-source tally a phase would act on. */
function summarize(readings) {
  const tally = { mounted: 0, fallback: 0, literal: 0, unexplained: 0 };
  const flagged = [];
  for (const r of readings) {
    const c = classifyPaint(r);
    tally[c.source]++;
    if (c.source === 'fallback' || c.source === 'unexplained') {
      flagged.push({ ...r, ...c });
    }
  }
  return { tally, flagged };
}


// ═══════════════════════════════════════════════════════════════════════════
// PALETTE-8 PART C — THE CONTRAST FLOOR CHECK
//
// ⚠ WHY THIS IS HERE AND NOT IN A SECOND MODULE. The half above already reads
// COMPOSITED values off RENDERED nodes in a real browser — the only place a
// var() resolves and the only place an inherited opacity is visible. A separate
// checker would be a second mechanism answering the same question, and the two
// would drift. This extends it.
//
// ⚠ WHAT MOTIVATED IT: NOTHING IN THE PALETTE ARC WATCHED THE 3:1 NON-TEXT
// FLOOR, and three defects shipped because of it — each caught by the FOLLOWING
// phase or by hand, never by a check:
//   · an icon moved 3.00:1 -> 2.55:1 when its ground changed, in a phase whose
//     entire subject was contrast (Palette-4b)
//   · the bottom nav's inactive labels composited to 2.40:1, unnoticed from
//     before this arc began
//   · ContactModal's close control at 2.61:1, open across two arcs
//
// ⚠ AND THE THREE DEFECT SHAPES IT MUST SEE THROUGH, all of which shipped:
//   1. OPACITY INHERITS. A correct declaration inside a muted parent composites
//      to something else; every element's own colour reads fine.
//   2. A GROUND CAN MOVE. The foreground never changed in the icon case.
//   3. A GRADIENT HAS TWO STOPS and the floor is the DARKER one.
// All three are why this measures the COMPOSITE, never the declaration.
// ═══════════════════════════════════════════════════════════════════════════

/** WCAG 1.4.3 normal text. */
const TEXT_FLOOR = 4.5;
/** WCAG 1.4.3 large text, and 1.4.11 non-text — the same number for two reasons. */
const LARGE_TEXT_FLOOR = 3;
const NON_TEXT_FLOOR = 3;

// ─── RULING-DERIVED FLOORS (Palette-10 C.2) ─────────────────────────────────
// ⚠ A CHECKER QUIETLY SOFTER THAN THE RULES IS THE SAME SHAPE AS THE EMOJI
// EXEMPTION THAT SWALLOWED MONEY: it reports clean on something nobody
// verified. WCAG permits 3:1 for large text, and the money ruling declines that
// allowance — so before this existed, the checker scored the 52px balance
// against 3 while the fence held it to 4.5, and the two agreed on the OUTCOME
// only because the measured value happened to clear both.
//
// ⚠ A RULING MAY ONLY TIGHTEN. If one would permit LESS than WCAG, that is a
// FINDING and this module throws rather than honouring it — a configuration
// that can lower a floor is a way to make any surface pass.
//
// Each entry: `id`, the `floor` it demands, `why` (shown in the report), and a
// `test(reading)` that decides whether the site is the ruled one.
// ─── TOKEN FLOORING, AND THE GROUND EACH TOKEN WAS FLOORED AGAINST (F.4) ────
// ⚠ THREE HAND-CATCHES OF THE SAME PAIRING IN TWO PHASES: ManageAccount's bank
// icon at 2.68:1 and its check icon at 2.89:1, then MissingReferralModal's focus
// ring at 2.68:1 — every one of them `--rm-primary` used on `--rm-recess`.
// Three is a pattern, not three coincidences.
//
// ⚠ WHY THIS LIVES IN THE HARNESS AND NOT IN A SOURCE SWEEP. The ground is a DOM
// fact. A declaration says which TOKEN an element takes; only the rendered tree
// says what is BEHIND it. All three catches came from asking what ground the
// element actually has, and a source-only fence cannot ask that.
//
// Each entry: the token, the ground(s) it was floored against, and the floor it
// was floored to. A token used on a ground it was NOT floored against is not
// automatically wrong — it is UNPROVEN, and must clear on the arithmetic instead.
//
// ⚠ AND A TOKEN CAN BE FLOORED AGAINST A PARTNER RATHER THAN A GROUND (Palette-12
// Part B). The two gradient partners are derived by nudging lightness until they
// separate from their base by GRADIENT_PARTNER_MIN_CONTRAST — that is a floor
// against ANOTHER TOKEN, and it says nothing whatsoever about any ground. Before
// this they returned `unknown-token`, whose message reads "add it before relying
// on this"; the boost bar now puts `--rm-secondary-dark` on `--rm-recess`, so
// something is relying on it. Recorded with `partnerOf` and an EMPTY grounds
// list, which makes every ground use come back `unproven` — the honest answer —
// instead of an unrecognised token that a reader can mistake for an oversight.
const TOKEN_FLOORING = Object.freeze({
  // floored at the 3:1 NON-TEXT threshold against `surface` only
  '--rm-primary':      Object.freeze({ grounds: ['surface'], floor: 3 }),
  '--rm-secondary':    Object.freeze({ grounds: ['surface'], floor: 3 }),
  // floored at 4.5 against BOTH grounds — this is the one that is safe on a recess
  '--rm-primary-text': Object.freeze({ grounds: ['surface', 'recess'], floor: 4.5 }),
  // the body text tone is floored against both by construction
  '--rm-text':         Object.freeze({ grounds: ['surface', 'recess'], floor: 4.5 }),
  // floored against their PARTNER, against no ground at all
  '--rm-primary-dark':   Object.freeze({ grounds: [], floor: null, partnerOf: '--rm-primary' }),
  '--rm-secondary-dark': Object.freeze({ grounds: [], floor: null, partnerOf: '--rm-secondary' }),
});

/**
 * Was this token PROVEN safe on this ground, or merely used there?
 *
 * ⚠ IT RETURNS A STATUS, NOT A VERDICT. `unproven` does not mean "fails" — it
 * means the token's own flooring says nothing about this ground, so the measured
 * ratio is the only evidence and must be read. That distinction is the whole
 * point: the three known instances were all `unproven` AND below floor.
 *
 * @param {string} tokenVar  e.g. '--rm-primary'
 * @param {string} groundName e.g. 'recess'
 * @returns {{status:'floored'|'unproven'|'unknown-token', floor:number|null, why:string}}
 */
function groundFlooring(tokenVar, groundName) {
  const entry = TOKEN_FLOORING[tokenVar];
  if (!entry) {
    return { status: 'unknown-token', floor: null,
      why: tokenVar + ' has no recorded flooring — add it before relying on this' };
  }
  if (entry.grounds.includes(groundName)) {
    return { status: 'floored', floor: entry.floor,
      why: tokenVar + ' is floored to ' + entry.floor + ':1 against `' + groundName + '`' };
  }
  // ⚠ A PARTNER-FLOORED TOKEN IS UNPROVEN ON EVERY GROUND, INCLUDING THE ONE ITS
  // BASE WAS FLOORED AGAINST. Saying "floored against  only" with an empty list
  // would be a sentence that reads like an answer and carries none.
  if (entry.partnerOf) {
    return { status: 'unproven', floor: null,
      why: tokenVar + ' is floored against its partner ' + entry.partnerOf
        + ', not against any ground — on `' + groundName + '` it is UNPROVEN and the'
        + ' measured ratio is the only evidence' };
  }
  return { status: 'unproven', floor: null,
    why: tokenVar + ' is floored against ' + entry.grounds.map((g) => '`' + g + '`').join(' and ')
      + ' only — on `' + groundName + '` it is UNPROVEN and the measured ratio is the only evidence' };
}

const RULING_FLOORS = Object.freeze([
  Object.freeze({
    id: 'money-4.5',
    floor: 4.5,
    why: 'money never takes the large-text allowance (ruled 2026-09-05)',
    // A money figure is a currency amount or a bare figure in the mono face.
    // ⚠ ANCHORED, NOT A BARE `$` SUBSTRING: "$" alone is the split glyph of the
    // Dashboard balance and must match, but a sentence merely containing a
    // dollar sign is prose and must not.
    test: (r) => {
      const t = typeof r.ownText === 'string' ? r.ownText.trim() : '';
      if (!t) return false;
      return /^\+?\$$/.test(t) || /^\+?\$?[\d,]+(\.\d+)?$/.test(t);
    },
  }),
]);

/**
 * The floor a reading must actually meet, and WHERE that floor came from.
 * ⚠ REPORTS BOTH, because a reader must be able to tell a WCAG floor from a
 * ruled one. `Math.max` is what makes "tighten only" structural rather than a
 * convention someone can quietly violate.
 *
 * @param {number|null} wcagFloor - the floor the element's own size/role implies
 * @param {object} reading
 * @param {Array} rulings - defaults to RULING_FLOORS
 * @returns {{floor: number|null, floorSource: string, wcagFloor: number|null, ruling: string|null}}
 * @throws if a ruling would LOOSEN a floor — that is a finding, not a config.
 */
function resolveFloor(wcagFloor, reading, rulings) {
  const table = Array.isArray(rulings) ? rulings : RULING_FLOORS;
  if (wcagFloor === null) {
    return { floor: null, floorSource: 'unmeasurable', wcagFloor: null, ruling: null };
  }
  let floor = wcagFloor;
  let ruling = null;
  for (const rule of table) {
    if (typeof rule.test !== 'function' || !rule.test(reading)) continue;
    if (rule.floor < wcagFloor) {
      throw new Error(
        'resolveFloor: ruling "' + rule.id + '" would LOOSEN the floor from '
        + wcagFloor + ' to ' + rule.floor + '. A ruling may only tighten. '
        + 'This is a finding, not a configuration.'
      );
    }
    const tightened = Math.max(floor, rule.floor);
    if (tightened > floor) { floor = tightened; ruling = rule.id; }
    else if (rule.floor === wcagFloor && ruling === null) { ruling = null; }
  }
  return {
    floor,
    floorSource: ruling ? ('ruling:' + ruling) : 'wcag',
    wcagFloor,
    ruling,
  };
}


// A run of pictographic characters (with optional variation selectors / ZWJ /
// skin-tone modifiers) and nothing else. Deliberately anchored: a label that
// merely CONTAINS an emoji beside real words is still text and still gets a floor.
//
// ⚠ IT MUST CONTAIN AT LEAST ONE Extended_Pictographic, AND IT MUST NOT USE
// \p{Emoji_Component}. THE FIRST VERSION OF THIS REGEX USED Emoji_Component AND
// THAT PROPERTY INCLUDES THE ASCII DIGITS 0-9 (they are keycap components), SO
// '500' AND '1' BOTH MATCHED. The live Home sweep classified a money figure and a
// rank as 'pictographic, unmeasurable' — an exemption that silently swallowed
// exactly the values this arc exists to protect, and reported it as a clean run.
// A false NEGATIVE in a checker is worse than the shortfall it hides, because it
// reports health it cannot observe.
const EMOJI_ONLY = /^(?=[\s\S]*\p{Extended_Pictographic})(?:[\p{Extended_Pictographic}\p{Emoji_Modifier}️‍]|\s)+$/u;

/** Relative luminance, WCAG 2.x. Input must be an {r,g,b} 0-255 triple. */
function relativeLuminance({ r, g, b }) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contrast ratio between two {r,g,b} triples. */
function ratioBetween(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Which floor applies to this element, and WHY.
 *
 * ⚠ C.2's RULE: A CHECKER THAT APPLIES ONE FLOOR TO EVERYTHING IS WRONG IN BOTH
 * DIRECTIONS — it fails legitimate icons at 3.5:1 and passes body text at 3.5:1.
 *
 * ⚠ AND `unclassifiable` IS A REPORTED OUTCOME, NOT A DEFAULT. That looks like
 * the "could not tell" shape classifyPaint refuses above, and the difference is
 * the whole point: classifyPaint's unknown would have SATISFIED an absence
 * assertion silently. This one is counted in its own bucket, is never a pass,
 * and assertContrastResult refuses to call a run clean while any remain
 * unacknowledged. A wrong default is worse than a reported unknown.
 *
 * @throws on a malformed reading — never guesses at a shape it was not given.
 */
function classifyContrastRole(r) {
  if (!r || typeof r !== 'object') {
    throw new Error('classifyContrastRole: expected a reading object, got ' + JSON.stringify(r));
  }
  if (typeof r.tag !== 'string' || r.tag === '') {
    throw new Error('classifyContrastRole: reading carries no tag');
  }
  const hasOwnText = typeof r.ownText === 'string' && r.ownText.trim() !== '';
  const px = Number(r.fontSizePx);
  const weight = Number(r.fontWeight);

  // ⚠ AN EMOJI IS NOT TEXT THE 'color' PROPERTY PAINTS, AND SCORING IT AS TEXT
  // MANUFACTURES A SHORTFALL THAT IS NOT THERE. A pictographic glyph carries its
  // own multi-colour bitmap; the computed 'color' is simply not what a reader
  // sees, so the ratio computed from it is a number about nothing. Found on the
  // first live Profile sweep, which reported seven of these at 1.44:1 and 2.20:1
  // — all of them badge emoji sitting on a fill that 'color' never touched.
  // Reported as UNMEASURABLE rather than passing or failing: this checker cannot
  // see these, and saying so is the point. Sampling the rendered pixels is the
  // only way to floor them, which is a different tool.
  if (hasOwnText && EMOJI_ONLY.test(r.ownText.trim())) {
    return {
      kind: 'unclassifiable',
      floor: null,
      why: 'pictographic glyph paints its own colour — not measurable from computed style',
    };
  }

  if (hasOwnText) {
    if (!Number.isFinite(px)) {
      throw new Error('classifyContrastRole: text element with no font size — the probe is wrong, not the page');
    }
    // ⚠ Number.isFinite on the VALUE's own shape, not on its siblings' form.
    const large = px >= 24 || (px >= 18.66 && Number.isFinite(weight) && weight >= 700);
    return {
      kind: 'text',
      floor: large ? LARGE_TEXT_FLOOR : TEXT_FLOOR,
      why: large ? 'text, large (1.4.3 exception)' : 'text, normal (1.4.3)',
    };
  }

  // No text of its own. Is it a GRAPHIC that carries meaning?
  if (r.tag === 'i' || r.tag === 'svg' || r.tag === 'path' || r.isIconFont === true) {
    return { kind: 'non-text', floor: NON_TEXT_FLOOR, why: 'icon glyph (1.4.11)' };
  }
  if (r.graphicRole) {
    // borders, state indicators, dividers, focus rings — set by the probe
    return { kind: 'non-text', floor: NON_TEXT_FLOOR, why: r.graphicRole + ' (1.4.11)' };
  }

  return {
    kind: 'unclassifiable',
    floor: null,
    why: 'carries a colour but has neither own text nor an identifiable graphic role',
  };
}

/**
 * The contrast probe. One reading per element that paints something a person
 * could need to see.
 *
 * ⚠ IT REPORTS EVERY GRADIENT STOP, NOT AN AVERAGE. The floor is the worst stop;
 * averaging would have passed the hero text that failed at 3.54:1 on a darker
 * stop while reading 5.48:1 against the base.
 * ⚠ AND EFFECTIVE ALPHA IS THE PRODUCT OF EVERY ANCESTOR'S OPACITY. A money span
 * inside a muted paragraph composited to 3.29:1 with a perfectly correct
 * declaration of its own; nothing at the element could show that.
 */
function buildContrastProbeScript(selector = '*') {
  return `(() => {
    const parse = (s) => { const m = String(s).match(/[\\d.]+/g); if (!m) return null;
      return { r:+m[0], g:+m[1], b:+m[2], a: m.length > 3 ? +m[3] : 1 }; };
    const over = (f, b) => ({ r: f.r*f.a + b.r*(1-f.a), g: f.g*f.a + b.g*(1-f.a), b: f.b*f.a + b.b*(1-f.a), a: 1 });

    // Walk to the first OPAQUE ground, compositing translucent layers on the way.
    // A gradient ends the walk and contributes every one of its colour stops.
    const groundsOf = (el) => {
      let n = el, layers = [];
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        const bi = cs.backgroundImage;
        if (bi && bi !== 'none') {
          const stops = [...bi.matchAll(/rgba?\\([^)]*\\)/g)].map(m => parse(m[0])).filter(c => c && c.a > 0);
          if (stops.length) return stops.map(st => { let c = st;
            for (let i = layers.length - 1; i >= 0; i--) c = over(layers[i], c); return c; });
        }
        const bg = parse(cs.backgroundColor);
        if (bg && bg.a >= 1) { let c = bg;
          for (let i = layers.length - 1; i >= 0; i--) c = over(layers[i], c); return [c]; }
        if (bg && bg.a > 0) layers.push(bg);
        n = n.parentElement;
      }
      return [{ r:255, g:255, b:255, a:1 }];
    };

    const effectiveAlpha = (el) => { let a = 1, n = el;
      while (n && n !== document.documentElement) { a *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
      return a; };

    const ownText = (el) => [...el.childNodes]
      .filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();

    const out = [];
    for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const text = ownText(el);
      const cls = el.className && typeof el.className === 'string' ? el.className : '';
      const isIconFont = /\\bph[\\s-]/.test(cls);

      // What visual role, if any, does this element paint?
      let graphicRole = null;
      if (!text) {
        const bw = ['Top','Right','Bottom','Left'].map(s => parseFloat(cs['border' + s + 'Width']) || 0);
        const solidBorder = bw.some(w => w > 0);
        if (solidBorder) graphicRole = 'border';
        else if (rect.height <= 6 && rect.width >= 12) graphicRole = 'state indicator';
        else if (rect.width <= 6 && rect.height >= 12) graphicRole = 'divider';
      }

      const alpha = effectiveAlpha(el);
      if (alpha === 0) continue;   // not painted at all; a hidden state, not a defect

      // FOREGROUND: text colour for text and icons; border colour for a border.
      const fgRaw = (graphicRole === 'border')
        ? cs.borderTopColor || cs.borderBottomColor || cs.borderLeftColor || cs.borderRightColor
        : (text || isIconFont || el.tagName.toLowerCase() === 'i') ? cs.color
        : (graphicRole ? cs.backgroundColor : null);
      // Which property supplied the foreground decides where the ground walk starts.
      const fgSource = (graphicRole === 'border') ? 'border'
        : (text || isIconFont || el.tagName.toLowerCase() === 'i') ? 'color'
        : (graphicRole ? 'backgroundColor' : 'color');
      if (!fgRaw) {
        // paints nothing a floor applies to (a layout box)
        if (!text && !graphicRole && !isIconFont) continue;
      }
      const fg = parse(fgRaw || cs.color);
      if (!fg || fg.a === 0) continue;

      // ⚠ WHERE THE GROUND WALK STARTS DEPENDS ON WHICH PROPERTY PAINTED THE
      // FOREGROUND, AND GETTING THIS WRONG PRODUCES A CONFIDENT 1.00:1.
      //   - fg from 'color' (text, icon glyph): the element's OWN background sits
      //     behind those glyphs, so the walk starts AT the element. Starting at the
      //     parent scores a filled button's label against whatever is behind the
      //     button, which is not what a reader sees.
      //   - fg from 'backgroundColor' (a dot, a swatch, a state indicator): the
      //     element's own background IS the foreground. Starting at the element
      //     compares it to itself and returns exactly 1.00:1 — a report about the
      //     probe, not about the page. Start at the PARENT.
      //   - fg from a border colour: the border delimits the element against what
      //     surrounds it, so the parent is the honest ground.
      // Both mistakes were made on the first two live runs; each produced readings
      // at exactly 1.00:1, which is the tell that fg and ground are the same pixel.
      const groundStart = (fgSource === 'color') ? el : (el.parentElement || el);
      const grounds = groundsOf(groundStart);

      // A finding nobody can locate is not actionable. Carry a DOM path.
      const parts = [];
      for (let c = el; c && c !== document.body && parts.length < 6; c = c.parentElement) {
        const sibs = c.parentElement ? [...c.parentElement.children].filter((k) => k.tagName === c.tagName) : [];
        parts.unshift(c.tagName.toLowerCase() + (sibs.length > 1 ? '[' + (sibs.indexOf(c) + 1) + ']' : ''));
      }

      out.push({
        tag: el.tagName.toLowerCase(),
        cls: cls.slice(0, 40),
        path: parts.join('>'),
        fgSource,
        ownText: text.slice(0, 40),
        isIconFont,
        graphicRole,
        ariaHidden: el.getAttribute('aria-hidden') === 'true',
        fontSizePx: parseFloat(cs.fontSize),
        fontWeight: parseFloat(cs.fontWeight),
        declared: (el.style && el.style.color) || '',
        effectiveAlpha: alpha,
        fg: { r: fg.r, g: fg.g, b: fg.b, a: fg.a },
        grounds: grounds.map(g => ({ r: g.r, g: g.g, b: g.b })),
      });
    }
    return { ok: true, count: out.length, readings: out };
  })()`;
}

/**
 * Scores one probe reading: composites the foreground at its effective alpha
 * over EVERY ground stop, and keeps the WORST.
 */
function scoreContrast(r, rulings) {
  const role = classifyContrastRole(r);
  // ⚠ THE RULED FLOOR REPLACES THE WCAG ONE ONLY WHEN IT IS STRICTER.
  const resolved = resolveFloor(role.floor, r, rulings);
  if (!Array.isArray(r.grounds) || r.grounds.length === 0) {
    throw new Error('scoreContrast: reading carries no grounds — the probe failed, this is not a pass');
  }
  const alpha = Number(r.effectiveAlpha);
  if (!Number.isFinite(alpha)) throw new Error('scoreContrast: reading carries no effectiveAlpha');

  let worst = Infinity;
  let worstGround = null;
  for (const g of r.grounds) {
    const composited = {
      r: r.fg.r * alpha + g.r * (1 - alpha),
      g: r.fg.g * alpha + g.g * (1 - alpha),
      b: r.fg.b * alpha + g.b * (1 - alpha),
    };
    const ratio = ratioBetween(composited, g);
    if (ratio < worst) { worst = ratio; worstGround = g; }
  }
  return {
    ...role,
    floor: resolved.floor,
    // ⚠ BOTH ARE REPORTED. A reader must be able to tell a WCAG-derived floor
    // from a ruling-derived one; "4.5" alone does not say which rule produced it.
    floorSource: resolved.floorSource,
    wcagFloor: resolved.wcagFloor,
    ruling: resolved.ruling,
    ratio: Math.round(worst * 100) / 100,
    stops: r.grounds.length,
    worstGround,
    passes: resolved.floor === null ? null : worst >= resolved.floor,
  };
}

/**
 * ⚠ THE FAIL-LOUDLY GATE, EXTENDED RATHER THAN RE-IMPLEMENTED (C.3). It defers
 * the shape and emptiness checks to assertHarnessResult, then adds the one thing
 * a contrast run needs on top: a POSITIVE CONTROL.
 *
 * ⚠ WHY A POSITIVE CONTROL AND NOT JUST A COUNT. A run can return hundreds of
 * readings and still have missed the thing you cared about — Palette-8's own
 * Part A scan returned zero role-on-fill hits, and the only reason that zero was
 * trustworthy was a control proving the same pass DID find 36 role-carrying
 * elements. A count proves the probe ran; a control proves it looked in the
 * right place.
 *
 * @param {object} raw               the probe result
 * @param {object} opts
 * @param {number} opts.expectAtLeast
 * @param {function} opts.positiveControl  predicate; at least one reading must satisfy it
 * @param {string} opts.controlName        what that predicate is looking for
 */
function assertContrastResult(raw, { expectAtLeast = 1, positiveControl, controlName } = {}) {
  const readings = assertHarnessResult(raw, { expectAtLeast });
  if (typeof positiveControl !== 'function') {
    throw new Error(
      'assertContrastResult: no positive control. A contrast run without one cannot ' +
      'tell "found nothing wrong" from "looked in the wrong place".'
    );
  }
  const hit = readings.some((r) => {
    try { return positiveControl(r); } catch { return false; }
  });
  if (!hit) {
    throw new Error(
      'CONTRAST HARNESS: the positive control found nothing' +
      (controlName ? ' (' + controlName + ')' : '') +
      '. The probe ran and returned ' + readings.length + ' readings, but not the ones ' +
      'expected — a wrong surface, a changed selector, or a page in the wrong state. ' +
      'THIS IS NOT "no defects found".'
    );
  }
  return readings;
}

/** Rolls contrast readings into the tally a phase would act on. */
function summarizeContrast(readings) {
  const tally = { text: 0, 'non-text': 0, unclassifiable: 0 };
  const shortfalls = [];
  const unclassifiable = [];
  for (const r of readings) {
    const s = scoreContrast(r);
    tally[s.kind]++;
    if (s.kind === 'unclassifiable') { unclassifiable.push({ ...r, ...s }); continue; }
    if (!s.passes) shortfalls.push({ ...r, ...s });
  }
  // ⚠ SHORTFALLS ARE REPORTED, NOT RULED ON. This arc has twice decided a
  // shortfall was correct: the badge grid's 1.12:1 tint is grouping on
  // non-interactive tiles, and the nav's 0.60 alpha was accepted because no
  // alpha cleared both of its constraints and state is multiply encoded.
  return { tally, shortfalls, unclassifiable };
}

module.exports = {
  normalizeColour, parseVarDeclaration, classifyPaint,
  buildProbeScript, assertHarnessResult, summarize,
  // Palette-8 Part C — the contrast floor check
  TEXT_FLOOR, LARGE_TEXT_FLOOR, NON_TEXT_FLOOR,
  EMOJI_ONLY,
  RULING_FLOORS, resolveFloor,
  TOKEN_FLOORING, groundFlooring,
  relativeLuminance, ratioBetween, classifyContrastRole,
  buildContrastProbeScript, scoreContrast, assertContrastResult, summarizeContrast,
};
