'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// URL SAFETY — THE SHARED SCHEME CHECK
//
// ⚠ MOVED VERBATIM FROM server/routes/landing.js. Not one character of either
// function's body or its comments was changed on the way in — the relocation
// rule, so the diff can be checked mechanically. Anything that needed correcting
// is a separate commit.
//
// ── WHY IT MOVED, AND WHY NOT JUST EXPORTED FROM WHERE IT WAS ───────────────
// `landing.js` already requires `escapeHtml` from `utils/pendingReferral.js`.
// Exporting these from the route and importing them back into that util would
// have made a cycle out of a route and a utility, which is the wrong direction
// for both. A util with no imports of its own can serve every caller.
//
// ⚠ THIS IS THE LESSON OF 460e87c APPLIED BEFORE THE FACT. That commit found
// EIGHT copies of one escaper across server/ — the weakest of them the only live
// defect, and invisible to three separate enumerations because it was named
// differently. The answer to "a second surface needs this logic" is never a
// second copy. `server/test/emailUrlSafety.test.js` carries a baseline fence so
// a ninth instance of that pattern cannot appear quietly in a new family.
//
// ⚠ AND A NAME THAT CLAIMS THE PROPERTY IS NOT THE PROPERTY.
// `pendingReferral.js` already had a local `const safeLogoUrl = escapeHtml(…)` —
// escaping only, no scheme check at all, sitting in an `<img src>`. It read as
// solved at every call site. That is the same shape as a test named for a
// precondition it never established.
// ─────────────────────────────────────────────────────────────────────────────

// ── LOGO URL SAFETY ──────────────────────────────────────────────────────────
// Returns the URL only when it is https, else null.
//
// escapeHtml is NOT sufficient here and this is not defence in depth — it is a
// different control for a different hole. Escaping stops an attribute breakout;
// nothing in `javascript:alert(1)` needs escaping, so an escaped hostile scheme
// lands in src= perfectly intact. contractor_settings.logo_url is an
// unconstrained TEXT column, so the scheme has to be checked separately.
//
// PLAIN http IS ALSO REFUSED, and not only for that reason: a TLS page pulling
// its logo over http is mixed content, which browsers block outright — so the
// contractor's brand silently vanishes from the one surface it exists for.
//
// A refused URL falls through to the no-logo path, which renders the company
// NAME as styled text. It never falls back to the RoofMiles mark: the homeowner
// scanned a sign in a yard and the header has to say whose yard it was.
function safeLogoUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Not an absolute URL at all — a relative path, a bare hostname, or noise.
    return null;
  }
  // The ORIGINAL string is returned rather than parsed.href, which normalises
  // (a bare origin gains a trailing slash) and would no longer match the value
  // the upload pipeline wrote.
  return parsed.protocol === 'https:' ? trimmed : null;
}

// ── WEBSITE URL SAFETY ───────────────────────────────────────────────────────
// Returns { href, label } for a linkable contractor website, else null.
//
// A SIBLING OF safeLogoUrl RATHER THAN A WIDENING OF IT, and the split is the
// point. safeLogoUrl calls new URL() with no scheme handling, so a BARE DOMAIN
// throws and is refused — correct there, because for an img src a bare hostname
// is a broken relative path. Here the bare domain is the NORMAL case:
// contractor_settings.company_url is what the admin Company Details "Website
// URL" field writes, its placeholder asks for 'accentroofingservice.com', and
// nothing between that field and the column normalises anything. Relaxing the
// logo guard to accept it would weaken the guard on an unconstrained TEXT column
// to fix a different problem.
//
// THE SCHEME IS PREPENDED ONLY WHEN THERE IS NONE, which is what keeps a hostile
// scheme from being laundered into an https one. The two hostile shapes take
// different paths to the same answer, and both are deliberate:
//   javascript:alert(1)            no '://', so the prepend fires and
//                                  new URL('https://javascript:alert(1)') throws
//                                  on the invalid port — refused by the PARSE.
//   javascript://host/%0aalert(1)  has '://', so nothing is prepended, it parses
//                                  as protocol javascript: — refused by the
//                                  PROTOCOL CHECK.
//
// PLAIN http IS REFUSED for the reason safeLogoUrl states: a TLS page reaching
// out over http is the same mixed-content posture, and two sibling guards on the
// same page should not disagree about which schemes are acceptable.
//
// A HOSTNAME NEEDS A DOT. 'https://localhost' and 'https://foo' parse perfectly
// well, so the parse cannot catch them; a single-label host on a homeowner-facing
// page is a typo or an internal address, never the roofer's website.
//
// LABEL IS THE ORIGINAL, HREF IS THE NORMALISED FORM — the same distinction
// safeLogoUrl makes when it returns the original string instead of parsed.href.
// new URL() adds a trailing slash to a bare origin, so a page rendering the href
// as its own link text would show 'https://accentroofingservice.com/' to someone
// whose roofer's sign says 'accentroofingservice.com'.
function safeWebsiteUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    // Not parseable even with a scheme — free text, or a hostile scheme whose
    // remainder is not a valid host and port.
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (!parsed.hostname.includes('.')) return null;

  return { href: parsed.href, label: trimmed };
}

module.exports = { safeLogoUrl, safeWebsiteUrl };
