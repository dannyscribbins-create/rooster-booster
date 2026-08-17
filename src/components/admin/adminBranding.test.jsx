// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BRAND RETIREMENT — PHASE 3 — THE WALKING SWEEP
//
// Governing spec: ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md, D-N.
//
// ⚠ THIS IS A SIBLING OF contractorBranding.test.jsx's SWEEP, NOT A REPLACEMENT.
// That file keeps its own hand-maintained FILES array and its own rewired-file
// assertions, AdminCampaigns.jsx included. Nothing was relocated out of it.
//
// ── WHY THIS ONE WALKS ─────────────────────────────────────────────────────
// CLAUDE.md records the hand-maintained FILES list as an UNFIXED gap: "New files
// are invisible until remembered, and nothing announces the omission. A clean
// sweep is evidence about the listed files only." This session produced the
// mechanism failing in the most direct way available — the inventory named an
// ORPHANED file while missing its LIVE twin, and the panel's two most-viewed
// literals (AdminDashboard and AdminSettings) were on no list at all.
//
// So the inclusion side is never enumerated here. Three directory roots are
// walked; whatever is in them is swept. A file added tomorrow is swept tomorrow.
//
// ── THE THIRD ROOT IS NOT OPTIONAL ─────────────────────────────────────────
// src/constants/ is walked because adminTheme.js lives there and holds Accent's
// entire palette. Walking only src/components/admin/ would make the single most
// brand-defining file in the panel structurally invisible.
//
// ⚠ AND THE PALETTE IS STILL INVISIBLE TO THE NEEDLES THIS PHASE, ON PURPOSE.
// No colour code contains the word "Accent", so adminTheme.js passes this sweep
// today even though it is walked. D-N places #012854 / #CC0000 / #041D3E as
// needles AFTER Phase 5, when the palette actually changes — adding them now
// would commit a permanently-red test, which §5 forbids. Both axes are required
// and only one of them exists yet. Do not read a green adminTheme.js row as
// evidence about its colours.
//
// ── WHAT THIS SWEEP DOES NOT REACH, BY CONSTRUCTION ────────────────────────
// Everything below is outside the three walk roots. None of it is "excluded" —
// there is no exclusion list to consult, and a future reader who assumes these
// were covered will be wrong. This is the escapeHtml-×3 shape at
// PRE_LAUNCH_CHECKLIST.md:60-66: two records that never met.
//
//   1. shared/LockedSection.jsx (D-G). Its `var(--rm-bg, #012854)` fallback is
//      OWNED BY THE PRE-LAUNCH BRAND-LITERAL SWEEP, not by this session. It
//      lives in src/components/shared/, so this walk misses it BY CONSTRUCTION
//      RATHER THAN BY EXCLUSION. The fallback's whole premise is Ruling 5 and
//      Phase 2 changed what mounts on the admin tree; touching both in one
//      session is how a deliberate fallback becomes an accidental one.
//
//   2. The three legal pages — PrivacyPolicy.jsx, TermsOfService.jsx,
//      ContractorTerms.jsx (D-F). Out of scope for this session: they are
//      blocked on the LLC amendment, which makes them the WRONG LEGAL PARTY
//      rather than the wrong logo, and they carry the only remaining live
//      Accent phone number and email (PrivacyPolicy.jsx:140-141) — which is
//      exactly what makes them tempting to sweep. They also render OUTSIDE
//      ThemeProvider deliberately (App.jsx:368-370, reachable without a
//      session) and must not be wrapped to fix a branding symptom. They sit in
//      src/components/, so like LockedSection they are missed by construction;
//      widening a root to reach them would put this session in front of the
//      LLC amendment.
//
//   3. Every admin-notification EMAIL TEMPLATE on the server side
//      (pipelineSync.js:268, referrer.js:552,2774, resendWebhook.js:228,310).
//      Server files, not src/. Pre-launch sweep — and neither sweep may assume
//      the other did it.
//
//   4. ASSETS. public/AccentRoofing-Logo-White.png and
//      src/assets/images/AccentRoofing-Logo.png are binaries; a source sweep
//      can see the REFERENCE to a file but never the file itself. Phase 4
//      deletes them once unreferenced.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

// ── THE ROOTS ────────────────────────────────────────────────────────────────
// Repo-relative, walked recursively. This is the ONLY list in the file, and it
// is a list of DIRECTORIES — adding a file to any of them requires no edit here.
const ROOTS = [
  'src/components/admin',
  'src/constants',
  'src/components/superAdmin',
];

// ── THE WALKER ───────────────────────────────────────────────────────────────
// Carried from contractorBranding.test.jsx:369-390, whose two decisions are
// reproduced with them:
//
//   • TEST FILES ARE EXCLUDED, narrowly and on purpose: the needles below ARE
//     the strings 'Accent Roofing' and '770-277-4869', so a test file naming
//     them is the guard working, not a violation. This very file would fail its
//     own sweep otherwise.
//
//   • .mjs IS INCLUDED HERE, which the 3b walker's /\.(js|jsx)$/ does not do.
//     src/constants/registrySections.mjs would otherwise be walked-but-skipped
//     — reached by the directory list and then dropped by the extension filter,
//     the most invisible way for a file to escape a sweep. The 3b walker's
//     narrower filter was correct for what it looked for (a JSX import
//     statement); it is not correct for identity literals, which can sit in any
//     module format.
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full, out); continue; }
    if (!/\.(js|jsx|mjs)$/.test(entry.name)) continue;
    if (/\.test\.(js|jsx|mjs)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

const REPO = process.cwd();
const SWEPT = ROOTS.flatMap(root => walk(path.resolve(REPO, root), []))
  .map(full => path.relative(REPO, full).split(path.sep).join('/'))
  .sort();

// ⚠ NORMALISE BEFORE COMPARING. A LITERAL SWEEP MATCHES FORMATTING, NOT VALUES.
//
// Carried verbatim from contractorBranding.test.jsx:299-303, and the incident
// that produced it is carried with it: the needle list once held '770-277-4869'
// and nothing else, so a `tel:` href carrying THE SAME NUMBER with its
// separators removed matched nothing and survived an entire sweep. The modal
// displayed the right contractor's number and dialled the wrong one, in
// production, on the tap target a homeowner on a phone actually presses.
//
//   PHONE — dashes, spaces, dots, parens, +1 prefix, or bare digits.
//           Normalised by stripping every non-digit from BOTH sides.
//   NAMES / IDENTIFIERS / DOMAINS — compared lowercased. Every one of them is a
//           substring of any longer rendering ('accentroofingservice' is inside
//           'https://www.accentroofingservice.com/'), so no URL normaliser is
//           needed and none is defined: 3b's `normalise.url` exists for
//           value-to-value comparison, has no needle declaring `kind: 'url'`,
//           and copying an unreachable branch into a new file would be dead
//           code that no guard-proof could ever turn red. A future needle whose
//           renderings are NOT substring-safe must arrive with its own kind and
//           its own guard-proof.
const normalise = {
  digits: text => text.replace(/\D/g, ''),
  plain:  text => text.toLowerCase(),
};

// Each needle declares HOW it must be compared, not just what it is.
// ⚠ NO HEX NEEDLES THIS PHASE — see the header. They land in Phase 5.
const ACCENT = [
  { kind: 'plain',  value: 'Accent Roofing' },
  { kind: 'plain',  value: 'AccentRoofing' },
  { kind: 'plain',  value: 'accentRoofingLogo' },
  { kind: 'plain',  value: 'leaksmith.com' },
  { kind: 'plain',  value: 'accentroofingservice' },
  { kind: 'plain',  value: 'CbtYNjHgUCwhEBM' },  // the g.page short link's id
  { kind: 'plain',  value: 'CONTRACTOR_CONFIG' }, // the delivery mechanism goes too
  { kind: 'digits', value: '770-277-4869' },      // ⚠ matches ANY rendering of the number
];

// A digit run long enough to be a phone number: at least eight characters of
// digits and separators. Carried from 3b.
const DIGIT_RUN = /[\d][\d\s().+-]{6,}[\d]/g;

/**
 * Finds every needle hit in one file's source, WITH LINE NUMBERS.
 *
 * Line-by-line rather than whole-file, because the deliverable of this phase is
 * a reviewable list of exactly where the live literals are — a boolean "this
 * file is dirty" would send the next phase back to grep for the same thing.
 *
 * @param {string} source - the file's full text.
 * @returns {Array<{line: number, needle: string, text: string}>} one entry per
 *          hit; `text` is the matched line trimmed, so a hit whose formatting
 *          differs from the needle is visible in the failure message.
 */
function findHits(source) {
  const hits = [];
  source.split(/\r?\n/).forEach((line, i) => {
    for (const { kind, value } of ACCENT) {
      if (kind === 'digits') {
        // Compare digit-runs, so dashed, bare, parenthesised, dotted and
        // country-prefixed renderings are all the same needle.
        const target = normalise.digits(value);
        const runs = line.match(DIGIT_RUN) || [];
        if (runs.some(run => normalise.digits(run).endsWith(target))) {
          hits.push({ line: i + 1, needle: value, text: line.trim().slice(0, 160) });
        }
        continue;
      }
      if (normalise.plain(line).includes(normalise.plain(value))) {
        hits.push({ line: i + 1, needle: value, text: line.trim().slice(0, 160) });
      }
    }
  });
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚠ THE NON-VACUITY BLOCK — READ BEFORE THE SWEEP ITSELF
//
// A walk that returns NOTHING generates NO `it` blocks, and a describe with no
// tests in it is GREEN. That is the one way this file can report "clean" while
// having examined not a single byte — a wrong cwd, a renamed directory, or an
// over-eager filter all produce it, and all of them look exactly like success.
// The assertions below are what make every row that follows mean something.
//
// They are hand-typed, and that is not a contradiction of "never enumerate
// inclusions": these are ANCHORS proving the walk reached each root, not the
// set of files to sweep. The sweep's coverage is still whatever is on disk.
// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 3 — the walk is real before anything it reports can matter', () => {

  it('reaches all three roots, with at least one file from each', () => {
    for (const root of ROOTS) {
      const fromRoot = SWEPT.filter(f => f.startsWith(`${root}/`));
      expect(fromRoot.length,
        `the walk reached NO file under ${root}. Every sweep row below is ` +
        'therefore evidence about the other roots only.'
      ).toBeGreaterThan(0);
    }
  });

  it('reaches the three files the roots exist for', () => {
    // One anchor per root, each chosen because losing it would silently gut the
    // sweep: the panel's chrome, the palette, and the surface D-K gated off.
    for (const anchor of [
      'src/components/admin/AdminComponents.jsx',
      'src/constants/adminTheme.js',
      'src/components/superAdmin/SuperAdminShell.jsx',
    ]) {
      expect(SWEPT, `${anchor} is not in the swept set`).toContain(anchor);
    }
  });

  it('walks .mjs as well as .js and .jsx', () => {
    // registrySections.mjs is the only .mjs under a walked root today. If it
    // ever moves, this must be pointed at whatever replaced it rather than
    // deleted — the extension filter is the failure mode being guarded, not
    // this one file.
    expect(SWEPT).toContain('src/constants/registrySections.mjs');
  });

  it('excludes test files, and ONLY test files', () => {
    // The needles ARE Accent's strings, so a test naming them is the guard
    // working. Proven in both directions: no .test. file swept, and this file's
    // own sibling production modules still are.
    expect(SWEPT.filter(f => /\.test\.(js|jsx|mjs)$/.test(f))).toEqual([]);
    expect(SWEPT).toContain('src/components/admin/AdminDashboard.jsx');
  });

  it('the needle matcher itself can find something', () => {
    // The last thing that can be silently broken: a matcher that returns [] for
    // every input would make all 30-odd rows below pass on a dirty repo. Each
    // kind is exercised against a synthetic line, including the DOTTED phone
    // rendering that the digits normaliser exists for.
    expect(findHits("const a = 'Accent Roofing';").map(h => h.needle)).toContain('Accent Roofing');
    expect(findHits('href="tel:770.277.4869"').map(h => h.needle)).toContain('770-277-4869');
    expect(findHits('href="tel:+17702774869"').map(h => h.needle)).toContain('770-277-4869');
    expect(findHits('mailto:contact@leaksmith.com').map(h => h.needle)).toContain('leaksmith.com');
    expect(findHits('const clean = 1;')).toEqual([]);
    // Line numbers are real, not always 1.
    expect(findHits("a\nb\nconst x = 'accent roofing';")[0].line).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE SWEEP
//
// Source text, not rendered output: the failure mode is a literal on a branch no
// test happens to render — a fallback, an error state, a placeholder in a form
// field. Reading the file catches every branch at once.
//
// One `it` per file so a failure NAMES THE FILE. A single aggregate assertion
// would report "the admin panel is dirty" and make the next phase re-derive the
// list this phase exists to hand over.
// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 3 — no Accent identity literal survives in the admin surfaces', () => {
  for (const file of SWEPT) {
    it(`[RED] ${file}`, () => {
      const hits = findHits(fs.readFileSync(path.resolve(REPO, file), 'utf8'));

      expect(hits.map(h => `${file}:${h.line} [${h.needle}] ${h.text}`),
        `${file} still carries Accent Roofing's identity. Contractor identity ` +
        'comes from useAdminBranding() (BrandingProvider, fed by GET ' +
        '/api/admin/me), never from a hardcoded literal. NOTE: the phone needle ' +
        'matches ANY rendering of the number, so a hit may be formatted ' +
        'differently from the needle shown.'
      ).toEqual([]);
    });
  }
});
