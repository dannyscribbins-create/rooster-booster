'use strict';

// A real bcrypt hash of a value nobody holds, compared against when a login
// lookup finds no candidate at all.
//
// WHY IT EXISTS. bcrypt.compare is deliberately slow. A handler that returns
// early on "no such account" answers in microseconds, while one that found a row
// answers in tens of milliseconds — a difference that is measurable over the
// network and turns any login endpoint into an account-enumeration oracle
// without the response body ever differing. Comparing against this constant
// makes the miss path cost roughly what the hit path costs.
//
// WHY IT LIVES HERE. It was already copy-pasted into two route files
// (admin/index.js, superAdmin.js) before the unified login became a third
// consumer. CLAUDE.md: duplicate logic written in more than one file must be
// extracted to a shared utility — so it is extracted here rather than tripled.
//
// THE VALUE IS NOT A SECRET and does not need to be. All that matters is that it
// is a well-formed bcrypt hash of something unguessable, so the comparison does
// real work and can never accidentally succeed.
const DUMMY_BCRYPT_HASH = '$2b$12$zx3jp3cwKJyBjvkjLrxpC.tFQcGrtob.60TLBryMPGb8IZQvlLF32';

module.exports = { DUMMY_BCRYPT_HASH };
