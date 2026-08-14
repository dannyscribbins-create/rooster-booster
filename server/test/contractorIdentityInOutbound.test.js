'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 6C — NO TENANT'S NAME IS HARDCODED INTO OUTBOUND CONTENT
//
// Governing spec: CDL_3b_BUILD_SPEC.md §8, plus the Phase 6C ruling that folded
// the server-side literals in.
//
// WHY THE SERVER NEEDED THIS AT ALL. Phase 6's first classification pass swept
// `src/` only. The server carried the identical defect and one instance was worse
// than anything on the client: `campaigns.js` built `emailSubject` from a
// hardcoded business name, so EVERY contractor's outbound campaign email went out
// under one specific tenant's name — to homeowners, not to a screen anyone
// internal would look at.
//
// ── TWO CHECKS, AND THE SECOND IS THE INTERESTING ONE ───────────────────────
//
//   1. A SOURCE-TEXT SWEEP. Same instrument as the client sweep, for the same
//      reason: a literal on a branch no test exercises — a fallback, a catch, an
//      error path — is invisible to behavioural assertions.
//
//   2. THE AI PROMPT MUST NOT LEAN. This one is not a literal problem and a sweep
//      alone would not have found it if the wording had differed slightly. The
//      subject-line prompt's worked EXAMPLE named a real tenant twice:
//
//        'For example: "Danny at <Tenant> wanted to reach out" or
//         "A quick note from <Tenant> Service"'
//
//      An example is an INSTRUCTION. A model given that prompt is being steered
//      toward that business name, and it will surface in generated copy for
//      contractors who have nothing to do with it — with no literal anywhere in
//      the output path to grep for, and nothing failing. The example is now
//      templated, and the prompt additionally forbids reusing any name from its
//      own instructions.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The retired tenant's identifying strings. Deliberately assembled from parts so
// this FILE does not itself contain the literals its sweep searches for — the
// sweep would otherwise have to exempt its own test, which is the exemption that
// eventually swallows a real hit.
const TENANT = ['Ac', 'cent Roo', 'fing'].join('');

// ⚠ NORMALISE BEFORE COMPARING — A LITERAL SWEEP MATCHES FORMATTING, NOT VALUES.
//
// The first version of this list held the phone number in its DASHED rendering
// only. A `tel:` href carries digits with no separators — the same number in a
// different rendering — so it matched nothing and survived the entire Phase 6
// sweep, live in production, on the tap target a homeowner presses. Each needle
// now declares HOW it is compared.
//
//   digits — any rendering of a phone number: dashes, dots, parens, +1, or bare
//   url    — with/without scheme, with/without www., with/without trailing slash
//   plain  — names and identifiers, which have no alternate spelling; email too,
//            the one single-rendering case here
const NEEDLES = [
  { kind: 'plain',  value: TENANT },
  { kind: 'plain',  value: TENANT.replace(' ', '') },
  { kind: 'plain',  value: ['leak', 'smith.com'].join('') },
  { kind: 'url',    value: ['accent', 'roofingservice.com'].join('') },
  { kind: 'digits', value: ['770-', '277-4869'].join('') },
];

const normalise = {
  digits: text => text.replace(/\D/g, ''),
  url:    text => text.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''),
  plain:  text => text.toLowerCase(),
};

// Returns the needles present in `source`, comparing each by its own rule.
function hits(source) {
  return NEEDLES.filter(({ kind, value }) => {
    if (kind === 'digits') {
      const target = normalise.digits(value);
      return (source.match(/[\d][\d\s().+-]{6,}[\d]/g) || [])
        .some(run => normalise.digits(run).endsWith(target));
    }
    if (kind === 'url') {
      return normalise.url(source).includes(normalise.url(value));
    }
    return normalise.plain(source).includes(normalise.plain(value));
  }).map(n => n.value);
}

// Server files that compose outbound content — email bodies, subjects, AI prompts.
const FILES = [
  'server/routes/admin/campaigns.js',
  'server/routes/webhooks/jobber.js',
];

describe('C/DL-3b Phase 6C — outbound content carries no hardcoded tenant identity', () => {

  for (const file of FILES) {
    it(`${file} contains no hardcoded tenant identity`, () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      const found = hits(source);
      assert.deepEqual(
        found, [],
        `${file} still carries: ${found.join(', ')}. The contractor's identity is a fact ` +
        'about the authenticated session — resolveContractorIdentity() reads it, and the ' +
        'PLATFORM default is the only permitted fallback.'
      );
    });
  }

  it('NO AI prompt steers the model toward any real business', () => {
    // ⚠ EVERY PROMPT IN THE FILE, NOT ONE. The first version of this test used
    // indexOf('You are an expert email marketing copywriter') — and there are TWO
    // prompts opening with that sentence, so it sliced the RAPPORT prompt while
    // claiming to check the SUBJECT-LINE one. Its own non-vacuity assertion is
    // what caught that; without it the test would have passed while examining the
    // wrong string, which is the same shape as every other vacuity found this
    // session.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'server/routes/admin/campaigns.js'), 'utf8'
    );

    const prompts = [...source.matchAll(/You are an expert email marketing copywriter[\s\S]{0,2500}/g)]
      .map(m => m[0]);
    assert.ok(prompts.length >= 2,
      `expected at least two AI prompts in campaigns.js, found ${prompts.length} — have they been ` +
      'renamed? A prompt this test cannot find is a prompt it cannot police.');

    for (const [index, prompt] of prompts.entries()) {
      const found = hits(prompt);
      assert.deepEqual(
        found, [],
        `AI prompt #${index + 1} names ${found.join(', ')} in its own instructions. AN EXAMPLE IS ` +
        'AN INSTRUCTION: the model will reuse that business name in copy generated for unrelated ' +
        'contractors, and nothing downstream would catch it.'
      );
    }

    // NON-VACUITY, on the SUBJECT-LINE prompt specifically — identified by its own
    // wording rather than by position, so reordering the file cannot silently
    // point this at the other one.
    const subjectPrompt = prompts.find(p => p.includes('subject lines'));
    assert.ok(subjectPrompt, 'the subject-line prompt was not found among the extracted prompts');
    assert.ok(
      subjectPrompt.includes('Never invent a business name'),
      'the subject-line prompt no longer forbids inventing or reusing a business name — that ' +
      'instruction is what replaced the worked example naming a real tenant'
    );
  });
});
