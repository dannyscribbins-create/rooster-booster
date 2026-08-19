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
// ⚠ THE COLOUR NEEDLES NOW EXIST (5.2d-5b). This paragraph used to say they were
// deferred; they landed once 5.2d-5a cleared the population to zero. adminTheme.js
// is swept on both axes.
//
// ══ WHAT A GREEN SWEEP DOES NOT PROVE ═══════════════════════════════════════
// Read this before quoting a clean run as evidence. Both gaps are structural and
// neither is fixable by a source scanner.
//
//   (a) ACCENT CAN RENDER WITHOUT ANY ACCENT LITERAL BEING PRESENT.
//       AdminSettingsNotifications.jsx imports `R` from src/constants/theme.js and
//       renders R.navy (#012854) and R.red (#CC0000) — correctly, because that
//       block PREVIEWS the referrer-facing announcement popup. theme.js is exempt
//       from the colour needles (C/DL-3c owns it), so those values are invisible
//       here permanently. A GREEN SWEEP DOES NOT MEAN "NO ACCENT RENDERS IN THE
//       PANEL." It means no Accent literal is WRITTEN in the walked roots.
//
//   (b) TEMPLATE-INTERPOLATED VALUES ARE A THIRD ENCODING NOTHING HERE CAN SEE.
//       `${AD.blue}30`, `${cfg.color}22`, `${secondary}bb` append an alpha suffix
//       to a token and resolve to a hex only at runtime. Ten such sites exist
//       today and none carries an Accent value, because no AD.* token has held one
//       since 5.1. But a future `${R.navy}30` in an admin file would be invisible
//       to this sweep forever. The blind spot is permanent; only its emptiness is
//       current, and only as of 5.2d-5b.
//
// Both were found by tracing what RENDERS rather than what is written — which is
// the check a source sweep structurally cannot perform on itself.
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
  // FOURTH ROOT, added with the colour needles (D-N). 5.0 rewrote the two
  // comments here that would otherwise have tripped them; verified clean against
  // BOTH needle kinds before this root was added, not after.
  'src/utils',
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
// ── THE COLOUR MATCHER (5.2d-5b) ─────────────────────────────────────────────
// ⚠ IT PARSES, IT DOES NOT SUBSTRING-MATCH, AND THAT IS THE WHOLE DESIGN.
// A needle written as /204,0,0/ would fire on `zIndex: 204` and `width: 204`,
// and a needle that fires on innocent code gets suppressed — after which it
// protects nothing. So every colour on a line is parsed out and canonicalised to
// lowercase #rrggbb, and comparison happens between canonical values.
//
// This is the phone-number lesson applied to colour. 5.2d's Phase 0 found that
// D-N's planned hex-only needles would have matched 40 of 58 Accent survivors and
// reported CLEAN while 18 remained, because rgba(204,0,0,0.5) contains no
// '#CC0000'. A sweep that certifies a dirty repo is worse than no sweep: it turns
// an open problem into a closed one.
//
// ALPHA IS DROPPED DELIBERATELY. Accent's red at 4% opacity is still Accent's red.
//
// ⚠ 3-DIGIT HEX (#C00) IS NOT MATCHED, AND THAT IS A DECISION, NOT AN OVERSIGHT.
// None exists in any walked root — checked, not assumed — and widening the
// matcher to a form nobody writes buys false-positive surface for nothing. A
// future #C00 arrives with its own guard-proof, like any other needle shape.
const COLOUR_IN_LINE = /#([0-9a-f]{6})(?:[0-9a-f]{2})?\b|\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,[^)]*)?\)/gi;

/**
 * Every colour written on one line, canonicalised.
 *
 * @param {string} line - one line of source.
 * @returns {Array<{canonical: string, raw: string}>} `canonical` is lowercase
 *          #rrggbb; `raw` is the text as the author wrote it, so the failure
 *          message can say WHICH FORM matched.
 */
function coloursIn(line) {
  const out = [];
  for (const m of line.matchAll(COLOUR_IN_LINE)) {
    const canonical = m[1]
      ? `#${m[1].toLowerCase()}`
      : `#${[m[2], m[3], m[4]].map(n => Number(n).toString(16).padStart(2, '0')).join('')}`;
    out.push({ canonical, raw: m[0] });
  }
  return out;
}

// ── THE NEEDLE-SCOPED EXCLUSION (R4) ─────────────────────────────────────────
// ⚠ SCOPED TO ONE NEEDLE KIND, NOT A BLANKET EXEMPTION. src/constants/theme.js is
// the REFERRER palette and holds all four Accent values on six lines. C/DL-3c owns
// it; retiring them here would put this session in front of that one.
//
// It is exempt from the COLOUR needles ONLY. Every identity needle — the name, the
// domains, the phone number — still applies to it in full, and the guard-proof
// below exercises both halves: that the file stays green holding four Accent
// hexes, AND that it still FIRES on an identity literal. An exclusion never
// watched exclude, and never watched still fire on the other kind, is a guess.
//
// This is a different case from the comment ruling. Phase 4 ruled REWORD, NEVER
// EXCLUDE for comments naming a literal — those are prose this session owns. These
// are LIVE VALUES in a file it does not.
const COLOUR_NEEDLE_EXEMPT = new Set(['src/constants/theme.js']);

const normalise = {
  digits: text => text.replace(/\D/g, ''),
  plain:  text => text.toLowerCase(),
};

// Each needle declares HOW it must be compared, not just what it is.
//
// ⚠ THE COLOUR NEEDLES LANDED IN 5.2d-5b, AFTER 5.2d-5a CLEARED THE POPULATION,
// never before — §5 forbids committing a permanently-red sweep. They are in a
// SEPARATE COMMIT from the fix on purpose: needles written alongside their own fix
// are written against a tree already known to be clean, so a green sweep would be
// decoration. Landing them separately means this sweep runs against a tree the
// previous commit CLAIMS is clean and independently confirms it — and reverting
// that commit alone correctly turns this red.
//
// ⚠ FOUR VALUES, NOT THREE. D-N named #012854 / #CC0000 / #041D3E. Spec §1 lists
// Accent's palette as #012854 / #CC0000 / #D3E3F0, so #D3E3F0 was missing from
// D-N's list and #041D3E (a derived dark navy) was in it. Both belong. Recorded as
// a SPEC AMENDMENT rather than left for a later session to rediscover as a gap.
const ACCENT = [
  { kind: 'colour', value: '#012854' },   // Accent navy
  { kind: 'colour', value: '#CC0000' },   // Accent red
  { kind: 'colour', value: '#D3E3F0' },   // Accent light blue — absent from D-N, see above
  { kind: 'colour', value: '#041D3E' },   // Accent navy-dark, the gradient endpoint
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
 * @param {string} [relPath] - the file's repo-relative path. Required for the
 *        COLOUR needles, which are exempted per-file per-kind; omitted in the
 *        self-tests below that exercise the other kinds against synthetic lines.
 * @returns {Array<{line: number, needle: string, text: string}>} one entry per
 *          hit; `text` is the matched line trimmed, so a hit whose formatting
 *          differs from the needle is visible in the failure message.
 */
function findHits(source, relPath = '') {
  const hits = [];
  const colourExempt = COLOUR_NEEDLE_EXEMPT.has(relPath);
  source.split(/\r?\n/).forEach((line, i) => {
    for (const { kind, value } of ACCENT) {
      if (kind === 'colour') {
        if (colourExempt) continue;
        const target = value.toLowerCase();
        const found = coloursIn(line).find(c => c.canonical === target);
        if (found) {
          // ⚠ THE NEEDLE NAMES THE FORM THAT MATCHED, not just the value. Someone
          // hitting this in six months with no context needs to see that
          // rgba(204,0,0,0.5) IS #CC0000 — otherwise the obvious reading is that
          // the sweep is broken, and the obvious fix is to disable it.
          hits.push({
            line: i + 1,
            needle: found.raw.toLowerCase() === target ? value : `${value} (as ${found.raw})`,
            text: line.trim().slice(0, 160),
          });
        }
        continue;
      }
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

    // ── THE COLOUR NEEDLE, EVERY PROPERTY IT CLAIMS ──────────────────────────
    const canon = src => findHits(src).map(h => h.needle);
    // Both forms, one needle.
    expect(canon("color: '#CC0000'")).toContain('#CC0000');
    expect(canon("background: 'rgba(204,0,0,0.5)'")[0]).toBe('#CC0000 (as rgba(204,0,0,0.5))');
    // Case, and whitespace inside the function.
    expect(canon("color: '#cc0000'")).toContain('#CC0000');
    expect(canon("background: 'rgba(204, 0, 0, .5)'")[0]).toBe('#CC0000 (as rgba(204, 0, 0, .5))');
    // Alpha is dropped: 4% Accent red is still Accent red.
    expect(canon("border: '1px solid rgba(204,0,0,0.04)'")).toHaveLength(1);
    // All four values, not the three D-N named.
    expect(canon("a:'#012854' b:'#D3E3F0' c:'#041D3E'")).toEqual(['#012854', '#D3E3F0', '#041D3E']);
    // ⚠ FALSE POSITIVES. A substring matcher on '204,0,0' would fire on both of
    // these, and a needle that fires on innocent code gets suppressed.
    expect(findHits('style={{ zIndex: 204, width: 204 }}')).toEqual([]);
    expect(findHits("const n = 20400; const m = '1,40,84';")).toEqual([]);
    // 3-digit hex is deliberately NOT matched — see the matcher's comment.
    expect(findHits("color: '#c00'")).toEqual([]);
  });

  it('the theme.js exclusion is NEEDLE-SCOPED, proven in both directions', () => {
    // ⚠ THE HALF EVERYONE ASSUMES. An exclusion never watched exclude is a guess,
    // and one never watched STILL FIRE on the other needle kind is worse — it
    // would silently be a blanket exemption while reading as a scoped one.
    const EXEMPT = 'src/constants/theme.js';
    const OTHER = 'src/components/admin/AdminApp.jsx';

    // (a) Colour needles do not fire there…
    expect(findHits("navy: '#012854', red: '#CC0000'", EXEMPT)).toEqual([]);
    // …and DO fire in any file that is not exempt.
    expect(findHits("navy: '#012854'", OTHER).map(h => h.needle)).toContain('#012854');

    // (b) …but every IDENTITY needle still applies to the exempt file.
    expect(findHits("const who = 'Accent Roofing';", EXEMPT).map(h => h.needle))
      .toContain('Accent Roofing');
    expect(findHits('href="tel:770.277.4869"', EXEMPT).map(h => h.needle))
      .toContain('770-277-4869');
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
      const hits = findHits(fs.readFileSync(path.resolve(REPO, file), 'utf8'), file);

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
