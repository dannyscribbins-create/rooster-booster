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

module.exports = {
  normalizeColour, parseVarDeclaration, classifyPaint,
  buildProbeScript, assertHarnessResult, summarize,
};
