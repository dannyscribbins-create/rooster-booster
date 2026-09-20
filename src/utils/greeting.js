// ─── THE TIME-OF-DAY GREETING — one implementation, two surfaces ────────────
//
// Canvass-9a. ⚠ THIS IS AN EXTRACTION, NOT A NEW FEATURE. The admin dashboard has
// greeted by time of day since it was built (`AdminDashboard.jsx`, under the
// `pendingState` block); the rep's Home tab needs the same thing, and CLAUDE.md's
// Code Cleanliness Standards require duplicate logic written in more than one file
// to be extracted to a shared utility rather than copied. So the admin's version
// moved here and both call it.
//
// ⚠ THE BOUNDARIES ARE THE ADMIN'S, UNCHANGED, AND THAT IS DELIBERATE. `< 12` and
// `< 17` are what has been shipping; re-deriving them here would make the rep and
// the admin greet differently at 4pm for no reason anybody asked for. If the
// boundaries are ever wrong they are wrong in one place now.
//
// ── ⚠ THE VIEWER'S TIMEZONE, WHICH IS A REQUIREMENT AND NOT AN ACCIDENT ─────
// `new Date().getHours()` reads the hour in the TIMEZONE OF THE MACHINE RUNNING
// IT. In a browser that is the viewer's own clock, which is the correct answer:
// a rep in Denver opening the app at 8am must be told "good morning" whatever
// timezone the server or the contractor sits in.
//
// ⚠ SO THIS MUST NEVER MOVE TO THE SERVER, AND MUST NEVER TAKE A TIMEZONE FROM
// THE CONTRACTOR RECORD. Both are the same defect wearing different clothes: a
// greeting computed anywhere but the viewer's device is wrong for exactly the
// people who travel, which in a field-rep app is the whole audience. The `at`
// parameter exists so a TEST can pin an hour — not so a caller can supply a
// server clock.
//
// @param {Date} [at] - the instant to read. Defaults to now. Tests pass a fixed
//        Date; production callers pass nothing.
// @returns {'Good morning'|'Good afternoon'|'Good evening'}
export function greetingFor(at = new Date()) {
  const hour = at.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

// The leading word of a person's name, for greeting them by it.
//
// ⚠ RETURNS null RATHER THAN A PLACEHOLDER, and the callers branch on that. A name
// is identity-bearing, so there is no default that is not somebody else's — the
// same rule `initialsOf()` follows on the Profile screen, and the reason a logo may
// fall back to the platform mark while a name may not. A greeting with no name is
// "Good morning." and is complete; a greeting with an invented one is a lie about
// who is logged in.
//
// @param {unknown} fullName
// @returns {string|null}
export function firstNameOf(fullName) {
  if (typeof fullName !== 'string') return null;
  const first = fullName.trim().split(/\s+/).filter(Boolean)[0];
  return first || null;
}

// The whole greeting line, name included when there is one.
//
// ⚠ THE TRAILING FULL STOP IS THE ADMIN'S EXISTING FORM and is kept so the two
// surfaces read identically. It is inside this function rather than at the call
// sites because two call sites punctuating a shared string is how they drift.
//
// @param {unknown} fullName
// @param {Date} [at]
// @returns {string}
export function greetingLine(fullName, at = new Date()) {
  const greeting = greetingFor(at);
  const first = firstNameOf(fullName);
  return first ? `${greeting}, ${first}.` : `${greeting}.`;
}
