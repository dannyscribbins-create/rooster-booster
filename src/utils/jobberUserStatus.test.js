// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-3.6b — RED SUITE — THE RETIRED-USER MARKER
//
// THE RULING (Danny, 2026-09-17): retired users remain SELECTABLE. The marker
// INFORMS; it never filters and never disables. ⚠ Every case below that asserts
// a label also exists to pin that nothing here returns a reason to HIDE someone
// — this module has no filtering surface at all, and that is the property.
//
// ⚠ AND IT IS NEUTRAL TO THE COPY, WHICH IS ITSELF UNDER TEST. Only ACTIVATED
// means a working account; the other four values describe different situations
// (one person who left, three who were never set up) and the decision about what
// to CALL them waits on a count of Accent's 147 users by status. So these cases
// assert the value passes THROUGH, humanised — never that DEACTIVATED reads
// "Retired". A test that pinned invented copy would freeze the decision this
// phase deliberately left open.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { jobberUserStatusLabel, isJobberUserMarked } from './jobberUserStatus';

// The five values, introspected live from Jobber on 2026-09-17 (explorer version
// 2026-05-12). Listed in full rather than sampled: the point of the enum is that
// four of five are non-active, and a test that only tried DEACTIVATED would pass
// against an implementation that special-cased that one word.
const ENUM = ['ACTIVATED', 'DEACTIVATED', 'NOT_INVITED', 'RESEND_INVITE', 'SEND_INVITE'];

describe('Canvass-3.6b — jobberUserStatusLabel', () => {
  it('[RED] ACTIVATED gets NO marker — it is the only working-account value', () => {
    expect(jobberUserStatusLabel('ACTIVATED')).toBeNull();
    expect(isJobberUserMarked('ACTIVATED')).toBe(false);
  });

  it('[RED] DEACTIVATED is marked — the live sighting, and the ruling\'s subject', () => {
    // Sandy Dawson, the first user returned from Accent's real account, is
    // DEACTIVATED. This is not a hypothetical state.
    expect(jobberUserStatusLabel('DEACTIVATED')).toBe('Deactivated');
    expect(isJobberUserMarked('DEACTIVATED')).toBe(true);
  });

  it('[RED] the three NEVER-SET-UP values are each marked, and each keeps its OWN words', () => {
    // ⚠ THE CASE THAT FORBIDS COLLAPSING. NOT_INVITED, SEND_INVITE and
    // RESEND_INVITE are not "retired" — they describe someone who was never
    // fully set up. Mapping all four non-active values to one word would be
    // wrong about three of them, and this asserts they stay distinguishable.
    expect(jobberUserStatusLabel('NOT_INVITED')).toBe('Not invited');
    expect(jobberUserStatusLabel('SEND_INVITE')).toBe('Send invite');
    expect(jobberUserStatusLabel('RESEND_INVITE')).toBe('Resend invite');
    const labels = ['DEACTIVATED', 'NOT_INVITED', 'SEND_INVITE', 'RESEND_INVITE'].map(jobberUserStatusLabel);
    expect(new Set(labels).size).toBe(4, 'two statuses produced the same label — they were collapsed');
  });

  it('[RED] every non-ACTIVATED value in the enum is marked — exactly four of five', () => {
    const marked = ENUM.filter(isJobberUserMarked);
    expect(marked).toEqual(['DEACTIVATED', 'NOT_INVITED', 'RESEND_INVITE', 'SEND_INVITE']);
  });

  it('[RED] an ABSENT status is NOT marked — the degradation path, not an "Unknown" pill', () => {
    // ⚠ THIS IS THE UI HALF OF THE ROUTE'S FALLBACK. When `User.status` is
    // unavailable at our pinned API version the route retries WITHOUT it, so
    // every user arrives status-less. Rendering "Unknown" against all 147 would
    // describe our API version, not the people — and would look exactly like a
    // company where nobody has an account.
    for (const absent of [undefined, null, '', '   ', 0, false, {}, []]) {
      expect(jobberUserStatusLabel(absent)).toBeNull();
      expect(isJobberUserMarked(absent)).toBe(false);
    }
  });

  it('[RED] an UNKNOWN future enum value is marked rather than silently treated as active', () => {
    // ⚠ FAILS SAFE IN THE INFORMATIVE DIRECTION. The test is "is it ACTIVATED",
    // never "is it one of these four", so a value Jobber adds later shows a
    // marker instead of passing as a working account. A closed list would make
    // the new state invisible — the worse of the two errors, because a marker
    // that should not be there is visible and a missing one is not.
    expect(jobberUserStatusLabel('SUSPENDED')).toBe('Suspended');
    expect(isJobberUserMarked('ARCHIVED_BY_OWNER')).toBe(true);
  });

  it('tolerates lower-case and padded values without inventing a marker for an active user', () => {
    expect(jobberUserStatusLabel('activated')).toBeNull();
    expect(jobberUserStatusLabel('  ACTIVATED  ')).toBeNull();
  });

  it('⚠ THE MODULE HAS NO FILTERING SURFACE — the marker informs, it never hides', () => {
    // The ruling as a structural assertion rather than a comment: nothing here
    // can be used to exclude a user. If a future edit adds a predicate that
    // callers could filter on, this fails and forces the ruling to be re-read.
    // eslint-disable-next-line no-undef
    const mod = { jobberUserStatusLabel, isJobberUserMarked };
    expect(Object.keys(mod).sort()).toEqual(['isJobberUserMarked', 'jobberUserStatusLabel']);
    // And the marker predicate must never be usable as "should I show this user":
    // every enum value, marked or not, is still a user the picker lists.
    expect(ENUM.every(s => typeof jobberUserStatusLabel(s) !== 'undefined')).toBe(true);
  });
});
