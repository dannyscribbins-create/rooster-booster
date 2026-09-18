// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-3.6 — RED SUITE — THE PICKER SEARCHES BY NAME **AND** BY EMAIL
//
// The ruling's central property: an admin must be able to find ANY Jobber user,
// and with 147 of them — most former staff — the mechanism is search. Searching
// only by name would satisfy "there is a search box" and fail the ruling for
// every person whose display name is spelled differently from how the admin
// remembers it.
//
// ⚠ THIS FENCES AN EXPRESSION THAT ALREADY EXISTED AND HAD NO TEST. It lived
// inline inside a 1200-line drawer component, unreachable without mounting the
// whole thing, which is why "searchable by name and email" was a property of the
// code and of nothing else. Extracting it changed no behaviour; it made the
// property assertable.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { filterJobberUsers } from './jobberUserSearch';

const u = (id, full, raw) => ({ id, name: { full }, email: { raw } });

const USERS = [
  u('usr_1', 'Danny Scribbins', 'danny@leaksmith.test'),
  u('usr_2', 'Maria Lopez', 'm.lopez@accent.test'),
  u('usr_3', 'Allen Wade', 'awade@accent.test'),
  u('usr_4', 'Pat Chen', 'pat@other.test'),
];

describe('Canvass-3.6 — filterJobberUsers', () => {
  it('[RED] matches on NAME', () => {
    expect(filterJobberUsers(USERS, 'maria').map(x => x.id)).toEqual(['usr_2']);
  });

  it('[RED] matches on EMAIL — the half a name-only search would lose', () => {
    // ⚠ THE NEEDLE IS DELIBERATELY ABSENT FROM EVERY NAME. 'awade' appears only
    // in an email address, so a name-only filter returns [] here and this case
    // is the one that separates the two implementations. A needle that also
    // appeared in a name would pass against both.
    expect(filterJobberUsers(USERS, 'awade').map(x => x.id)).toEqual(['usr_3']);
  });

  it('[RED] matches on an email DOMAIN, which no name contains', () => {
    expect(filterJobberUsers(USERS, 'accent.test').map(x => x.id)).toEqual(['usr_2', 'usr_3']);
  });

  it('is case-insensitive on both sides', () => {
    expect(filterJobberUsers(USERS, 'DANNY').map(x => x.id)).toEqual(['usr_1']);
    expect(filterJobberUsers(USERS, 'M.LOPEZ@ACCENT.TEST').map(x => x.id)).toEqual(['usr_2']);
  });

  it('trims the query, so a stray space does not empty the list', () => {
    expect(filterJobberUsers(USERS, '  pat  ').map(x => x.id)).toEqual(['usr_4']);
  });

  it('a blank query returns everything — the caller decides whether to render it', () => {
    expect(filterJobberUsers(USERS, '')).toHaveLength(4);
    expect(filterJobberUsers(USERS, '   ')).toHaveLength(4);
  });

  it('a non-matching query returns an empty list, not everything', () => {
    // ⚠ THE FAILURE DIRECTION THAT WOULD BE INVISIBLE. A filter that fell back
    // to the full list on no match would look like "search is broken but
    // harmless" and would instead hand the admin 147 rows to scroll.
    expect(filterJobberUsers(USERS, 'zzz-nobody')).toEqual([]);
  });

  it('[RED] survives users with a missing name or a missing email', () => {
    // Real Jobber payloads carry users with no email. Before the coercion these
    // threw inside render, which on this surface is a blank drawer rather than
    // an error the admin can read.
    const partial = [
      { id: 'a', name: { full: 'No Email Person' } },
      { id: 'b', email: { raw: 'noname@x.test' } },
      { id: 'c' },
    ];
    expect(filterJobberUsers(partial, 'noemail').map(x => x.id)).toEqual([]);
    expect(filterJobberUsers(partial, 'No Email').map(x => x.id)).toEqual(['a']);
    expect(filterJobberUsers(partial, 'noname').map(x => x.id)).toEqual(['b']);
    expect(() => filterJobberUsers(partial, 'anything')).not.toThrow();
  });

  it('[RED] a non-array input returns [] rather than throwing', () => {
    // The 502 path returns a body with no `users` array at all. Reaching
    // `.filter` on that throws inside render.
    for (const bad of [null, undefined, {}, 'users', 0]) {
      expect(filterJobberUsers(bad, 'x')).toEqual([]);
    }
  });

  it('preserves input order', () => {
    // The route returns users in Jobber's own order across pages; re-sorting
    // here would make the list unstable between a cached and a fresh fetch.
    expect(filterJobberUsers(USERS, 'e').map(x => x.id)).toEqual(['usr_1', 'usr_2', 'usr_3', 'usr_4']);
  });
});
