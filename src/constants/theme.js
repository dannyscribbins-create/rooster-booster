// ─── Brand Design Tokens ──────────────────────────────────────────────────────
//
// ⚠ THREE MORE WERE REMOVED ON 2026-09-06 (Palette-6), AND THE REASON IS THE
// OPPOSITE OF THE FIVE BELOW: those were never used, these STOPPED being used.
//
//     bgCardTint  #F5F3EE      bgBlueLight #D3E3F0      shadowMd  a 2-part shadow
// ⚠ AND `borderMed` JOINED THEM ON 2026-09-07 (Palette-11 B1). Its last two
// readers were ExperiencePopup's disabled-review-button edge; both moved to
// `elevationVar('border')`, which is the side channel that owns borders.
// The dead-key check found it the moment the readers went — which is the
// mechanism working, not a surprise.
//
// `bgBlueLight` was a RETIRED ACCENT TONE and its readers went to `--rm-recess`
// and `--rm-primary`.
//
// ⚠ AND ONE MORE WENT ON 2026-09-15 (PALETTE-15): `blueLight`, #D3E3F0. Its
// only three readers were the two auth screens that were never colour-migrated,
// and it died the moment they were. themeKeyIntegrity's dead-key check found it
// by FAILING THE GATE — the mechanism working, again, rather than anyone
// remembering to look.
//
// ⚠ THE SENTENCE ABOVE USED TO CALL `bgBlueLight` "the last definition of it in
// the codebase", AND THAT WAS FALSE ON THE DAY IT WAS WRITTEN — `blueLight` held
// the IDENTICAL value seven lines below it, in this same object. It is corrected
// rather than quietly deleted because the error is instructive: the claim was
// made about a KEY NAME, and a sweep for that name could not see a differently
// named key carrying the same tone. That is the third route a retired tone
// travels, recorded elsewhere in CLAUDE.md, biting inside the very comment that
// announced the tone was gone. It is gone NOW.
// `bgCardTint` went to `--rm-recess`; `shadowMd` went to the side channel's own
// `shadowMd` role, which Palette-4a Part B added.
//
// ⚠ THEY WERE FOUND BY themeKeyIntegrity's dead-key check FAILING THE GATE, not
// by anyone remembering to look. That is the mechanism working as designed: a
// migration that empties a key is exactly when the key should go, and the check
// is what makes "in the same session" enforceable rather than aspirational.
//
// ⚠ FIVE KEYS WERE REMOVED HERE ON 2026-09-04 (Palette D-5, R-13). TOMBSTONED
// RATHER THAN SILENTLY DELETED, because one of them is load-bearing EVIDENCE in
// an open ruling and someone will otherwise go looking for it.
//
//     bgSurface   #FAFAF8      bgNavy    #012854      bgNavyDark  #041D3E
//     textNavy    #012854      textOnDark #FFFFFF
//
// Each was referenced ZERO times as `R.<key>` anywhere in src/, server/ or
// scripts/, and zero times in tracked markdown. themeKeyIntegrity.test.js now
// asserts that no key here is unreferenced, so this class cannot re-accumulate.
//
// ⚠ `bgSurface` IS THE ONE THAT MATTERS, AND ITS ABSENCE IS THE POINT.
// PRE_LAUNCH_CHECKLIST.md's R/AD entry frames the elevation problem as
// "bgPage vs bgCard vs bgSurface is a three-level elevation the token set
// expresses with two". THERE WERE ONLY EVER TWO LEVELS IN THE RENDERED PRODUCT:
// bgSurface had no reader on the day that sentence was written. The real gap is
// that the render set has no token BELOW `surface` — see the R-5 elevation
// ruling, still open.
//
// ⚠ AND THE SWEEP THAT FOUND THEM HAD TO BE ANCHORED ON `R.<key>`, NOT THE BARE
// WORD. `adminTheme.js` defines its own `bgSurface`, so an unanchored search
// reports this key as live and it is not. The same trap decides whether a name
// is free — a bare substring answers a different question than the one asked.
export const R = {
  // Backgrounds
  bgPage:     "#EEF2F7",
  bgCard:     "#FFFFFF",

  // Brand
  red:        "#CC0000",
  redDark:    "#8C0000",
  navy:       "#012854",
  navyDark:   "#041D3E",

  // Text
  textPrimary:   "#1A1A1A",
  textSecondary: "#6B6B6B",
  textMuted:     "#A0A0A0",

  // Status
  green:     "#16a34a",
  greenBg:   "#dcfce7",
  greenText: "#15803d",
  amber:     "#d97706",
  amberBg:   "#fef3c7",
  amberText: "#b45309",
  blue:      "#2563eb",
  blueBg:    "#dbeafe",
  blueText:  "#1d4ed8",
  grayBg:    "#f3f4f6",
  grayText:  "#6b7280",

  teal:      "#0891b2",
  tealBg:    "#cffafe",
  tealText:  "#0e7490",

  emerald:     "#059669",
  emeraldBg:   "#d1fae5",
  emeraldText: "#065f46",

  // Borders & Shadows
  border:    "rgba(0,0,0,0.08)",
  shadow:    "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowLg:  "0 8px 32px rgba(1,40,84,0.13)",

  // Fonts
  fontSans:    "'Montserrat', 'Roboto', sans-serif",
  fontBody:    "'Roboto', sans-serif",
  fontMono:    "'Roboto Mono', monospace",
};

export const STATUS_CONFIG = {
  lead:            { label: "Lead Submitted",       color: R.grayText,  dot: R.grayText,  bg: R.grayBg  },
  inspection:      { label: "Inspection Completed", color: R.blueText,  dot: R.blue,      bg: R.blueBg  },
  sold:            { label: "Sold ✓",               color: R.greenText, dot: R.green,     bg: R.greenBg },
  closed:          { label: "Not Sold",             color: "#b91c1c",   dot: "#ef4444",   bg: "#fee2e2" },
  booking_pending: { label: "Booking Sent",         color: R.amberText, dot: R.amber,     bg: R.amberBg },
  app_user:        { label: "In App",               color: R.tealText,  dot: R.teal,      bg: R.tealBg  },
  complete:        { label: "Complete ✓",           color: R.emeraldText, dot: R.emerald, bg: R.emeraldBg },
};
