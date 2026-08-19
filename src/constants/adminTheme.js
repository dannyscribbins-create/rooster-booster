// ─── Admin Design Tokens ──────────────────────────────────────────────────────
//
// ADMIN BRAND RETIREMENT — PHASE 5.1 — THE PALETTE REBUILD
//
// This file used to define the whole admin chrome in a DARK SLATE theme carrying
// the first tenant's navy, red and light blue. Phase 5.1 moved it to a LIGHT
// palette built on RoofMiles' own colours. The design rule it encodes (spec §1,
// verbatim) is: "RoofMiles is the environment. The contractor gets a subtle
// branded touch that is personal to them."
//
// ── PROVENANCE: ONE OUTSIDE VALUE, NOT FOUR ──────────────────────────────────
// Every colour below derives from one of two brand values, or from the single
// documented neutral. There is no fourth source, and adding one needs a ruling.
//
//   #1C2D4D  RoofMiles secondary — navy. Source of: navy, bgSidebar itself
//            (flat since 5.2c — see the warning at the token), navyDark
//            (#15223A, navy x 0.75, which OUTLIVED the sidebar gradient it was
//            introduced for and is still consumed by AdminTeamSettings' avatar
//            circle), bgCardTint (#EDEEF1, navy at 8% over white), tint
//            (#D4DDEB, navy desaturated), every text alpha, both borders, and
//            all three shadows.
//   #F26A1B  RoofMiles primary — orange. Source of: marker.
//   #F8F5F0  LINEN. The one documented neutral, and the only value here that
//            derives from neither brand colour. It is the page ground and the
//            sidebar header plate. A warm ~2%-saturation neutral was chosen so
//            the ground reads as a surface rather than as a tinted brand field.
//
// ⚠ THE PALETTE IS DELIBERATELY TWO-TEMPERATURE. Linen is warm (R>G>B); every
// navy-derived tint is cool (B>G>R); the orange marker is warm again. That falls
// out of the two brand values and is intended, not drift. Do not "correct" the
// tints to warm neutrals — that would put them on a third source.
//
// ── THE TEXT HIERARCHY IS COMPRESSED, AND THAT IS THE POINT ──────────────────
// The dark theme ran 1.00 / 0.55 / 0.30. The light one runs 1.00 / 0.80 / 0.68,
// and the reason is arithmetic rather than taste: navy at 0.55 over linen
// measures 3.32:1 and navy at 0.30 measures 1.81:1. Both fail WCAG's 4.5:1 for
// body text; the second is invisible. 4.5:1 on linen is not reached until alpha
// is about 0.665, so 0.68 is the floor a tertiary can occupy at all — it clears
// at 4.80:1 on linen and 4.98:1 on white, and 0.66 was rejected as a 0.4% margin.
//
// ⚠ A LIGHT GROUND CANNOT CARRY A 0.30 TERTIARY. If these three levels need to
// read further apart, THE SEPARATION MUST COME FROM WEIGHT OR SIZE, NOT FROM
// LOWERING AN ALPHA. Lowering one buys visual hierarchy with legibility, and the
// three values above are already at the edge of what the ground allows.
//
// ── red AND red2 ARE DELIBERATELY THE SAME VALUE. DO NOT MERGE THEM. ─────────
// Both resolve to #DC2626 and that is not an oversight to tidy up. `red` was the
// FIRST TENANT'S brand red doing semantic-danger duty; `red2` was the semantic
// danger red. Retiring the brand red collapsed their values but NOT their
// meanings, and 5.2's D-C audit needs both names intact to tell a branded red
// apart from a destructive one at each of the ~40 call sites that paint red
// directly. Merging these two keys destroys the only remaining signal for that
// audit. The same applies to redBg and red2Bg.
//
// ── blueLight IS A TEMPORARY ALIAS OF tint (5.1 -> 5.2) ──────────────────────
// blueLight did TWO jobs on the dark panel, which one pale blue could serve at
// once: MARKERS that say "you are here" or "this is focused", and TINTS that
// recede behind info boxes. On a light panel those diverge, so 5.1 defines
// `marker` and `tint` as separate tokens. The 86 existing blueLight call sites
// are repointed in 5.2, not here.
//
// ⚠ UNTIL THEN, MARKERS ARE INTENTIONALLY UNDERSTATED. blueLight aliases to
// `tint`, so the active nav rail, the focus rings and the selected-state borders
// render pale rather than orange. THAT IS THE DESIGNED INTERMEDIATE STATE, NOT A
// MISS. It aliases to tint rather than to marker because pale is merely quiet
// everywhere, whereas orange would turn every recessed info-box fill into a loud
// block — wrong in a way that is harder to see past while reviewing the rest.
//
// ── TAG_COLORS NEEDED ALMOST NOTHING — AND 5.1 SAID "NOTHING", WHICH WAS WRONG
// It was ALREADY a light-theme palette — pale pill backgrounds with dark text,
// unchanged since the single-tenant era and correct on the new ground. It is 17
// rows of this file and the instinct is to sweep it with everything else. Don't.
//
// ⚠ BUT 13 OF 14 ENTRIES IS NOT 14. This header used to read "TAG_COLORS NEEDED
// NOTHING", and 5.2d-4 measured every pair: 'Suppressed' was #6B7280 on #F3F4F6,
// 4.39:1, and FAILED the 4.5:1 text bar. It is now AD.grayMuted at 6.87:1. The
// claim mattered because a header telling a future session that a palette needs
// no attention is believed — and this one was consulted and trusted twice before
// anyone measured it. State what was checked, not what was assumed.
// ─────────────────────────────────────────────────────────────────────────────
export const AD = {
  // Surfaces. The dark theme ran four ascending levels; a light theme has fewer
  // usable ones, because white is the ceiling and everything above the ground
  // competes inside a 15/255 band. Rather than invent two near-identical
  // off-whites, bgSurface and bgCard COLLAPSE to the same white and the tint
  // moves BELOW them: ground (linen) -> raised (white) -> recessed-within-raised.
  // Both names are kept so 5.2 can diverge them if the panel reads flat.
  bgPage:     '#F8F5F0',
  bgSurface:  '#FFFFFF',
  bgCard:     '#FFFFFF',
  bgCardTint: '#EDEEF1',
  // ⚠ FLAT ON PURPOSE. THIS WAS A GRADIENT AND MUST NOT BECOME ONE AGAIN.
  // It was linear-gradient(160deg, #1C2D4D 0%, #15223A 100%). The retirement in
  // 5.2c was not a taste call — a CSS gradient resolves against the box of the
  // element painting it, so two adjacent panels sharing ONE gradient token
  // render DIFFERENT colours at the same vertical position. The main sidebar
  // (230px) and the settings sub-nav (220px) did exactly that, and the mismatch
  // ran their full shared height as a seam that read as a rendering fault.
  //
  // "Restore the gradient, it looked richer" is a natural-looking future edit
  // and this comment is the only thing standing in front of it. A flat colour
  // cannot produce that mismatch; a gradient will reintroduce it the moment a
  // second element consumes this token. If depth is wanted, LIFT THE ADJACENT
  // PANEL A STEP — which is what #26385C in AdminSettings.jsx does — rather than
  // putting a gradient back here.
  bgSidebar:  '#1C2D4D',
  // The sidebar header plate (D-D option B). Light on purpose, and applied to
  // EVERY contractor rather than conditioned on the logo's colour — it has to
  // work under a dark logo, a pale one, or none at all. One rule, no new data,
  // nothing to get wrong per tenant.
  bgSidebarHeader: '#F8F5F0',
  // ⚠ A WHITE WASH, AND NOW CORRECTLY SO AT EVERY SITE. Both remaining consumers
  // are nav states on the DARK sidebar (AdminComponents' main nav, AdminSettings'
  // sub-nav), where a white wash is right.
  //
  // 5.1 recorded a role split here and 5.5 resolved it: AdminInboxSidebar's three
  // skeleton bars were the odd site, sitting on a LIGHT drawer after 5.1 where the
  // wash composited to a 1/255 delta and the loading state was invisible. They now
  // carry a navy alpha of their own rather than this token.
  //
  // ⚠ NOTE HOW LONG THAT TOOK, because the shape recurs. 5.2d-2 fixed 36 sites of
  // exactly that defect and walked past this one, because it swept white-alpha
  // LITERALS and this was a TOKEN. A value is only as findable as the form it is
  // written in — the same blind spot as the rgba-vs-hex needle gap.
  bgActive:   'rgba(255,255,255,0.08)',

  navy:       '#1C2D4D',
  navyDark:   '#15223A',
  marker:     '#F26A1B',
  tint:       '#D4DDEB',
  blueLight:  '#D4DDEB',   // temporary alias of `tint` — see header

  red:        '#DC2626',   // see the red/red2 note in the header before merging
  redDark:    '#991B1B',
  redBg:      'rgba(220,38,38,0.12)',

  textPrimary:   '#1C2D4D',
  textSecondary: 'rgba(28,45,77,0.80)',
  textTertiary:  'rgba(28,45,77,0.68)',

  // Semantic. The four *Text values were pastels tuned for a dark ground and
  // measured 1.54:1 to 2.54:1 on linen — unreadable, on nearly every screen.
  // These replacements clear 4.5:1 on BOTH grounds and on their own *Bg pills.
  // The *Bg alphas did not need retuning; only the text colours did.
  //
  // ⚠ `green` (3.89:1 on linen) and `gray` (4.45:1) clear the 3:1 bar for fills,
  // borders and icons but NOT the 4.5:1 bar for text. They must not carry copy.
  green:      '#2D8B5F',
  greenBg:    'rgba(45,139,95,0.15)',
  greenText:  '#166534',
  amber:      '#B45309',   // was #D97706 — 2.93:1 on linen, the only solid that failed even 3:1
  amberBg:    'rgba(217,119,6,0.15)',
  amberText:  '#92400E',
  red2:       '#DC2626',
  red2Bg:     'rgba(220,38,38,0.12)',
  red2Text:   '#B91C1C',
  blue:       '#2563EB',
  blueBg:     'rgba(37,99,235,0.12)',
  blueText:   '#1D4ED8',

  // Both inverted from white alphas. A white hairline is invisible on white:
  // these composite to #E8EAED on a card and #E2E1E0 on the page, which is the
  // same visual weight as the conventional #E5E7EB. border has 315 call sites.
  border:       'rgba(28,45,77,0.10)',
  borderStrong: 'rgba(28,45,77,0.18)',

  gray:        '#6B7280',
  grayBg:      'rgba(107,114,128,0.12)',
  grayMuted:   '#4B5563',
  grayMutedBg: 'rgba(75,85,99,0.12)',

  // Navy-tinted and far lighter than the black-at-0.3-to-0.5 they replace. Black
  // at that weight is a dark-theme depth cue; on linen it reads as grime.
  shadowSm:   '0 1px 3px rgba(28,45,77,0.08), 0 1px 2px rgba(28,45,77,0.04)',
  shadowMd:   '0 4px 12px rgba(28,45,77,0.10), 0 2px 4px rgba(28,45,77,0.06)',
  shadowLg:   '0 8px 32px rgba(28,45,77,0.16)',

  radiusSm:  '6px',
  radiusMd:  '10px',
  radiusLg:  '16px',
  radiusPill:'9999px',
  fontSans:    "'Roboto', sans-serif",
  fontDisplay: "'DM Serif Display', serif",
};

export const TAG_COLORS = {
  'Opted Out':           { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  'SMS Opted Out':       { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  'Referral Only':       { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  'App User':            { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  'Active Referrer':     { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
  'Previously Contacted':{ bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  'High Engager':        { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
  'Never Opened':        { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' },
  'Bounced':             { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  'Suppressed':          { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' },   // was #6B7280 — 4.39:1, failed. Now 6.87:1.
  'Existing Client':     { bg: '#CCFBF1', text: '#0F766E', border: '#99F6E4' },
  'Paid Customer':       { bg: '#CCFBF1', text: '#0F766E', border: '#99F6E4' },
  'Recently Contacted':  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  // ── ADDED IN 5.2d-4, ABSORBING AdminCampaignDetail'S SECOND PALETTE ─────────
  // Both carry meanings no semantic *Bg/*Text pair expresses — purple for an
  // engagement action, teal for a delivery channel. Forcing them onto green or
  // blue would make two different things look identical, which is the opposite
  // of what consolidating a palette is for. Two entries in ONE palette is still
  // one palette. Values are the ones AdminCampaignDetail already used; both
  // already cleared 4.5:1, so this is a MOVE, not a recolour.
  'Clicked CTA':         { bg: '#F3E5F5', text: '#6A1B9A', border: '#E1BEE7' },   // 7.75:1
  'SMS Sent':            { bg: '#E0F7FA', text: '#00695C', border: '#B2EBF2' },   // 5.94:1
  default:               { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};
