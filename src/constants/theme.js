// ─── Brand Design Tokens ──────────────────────────────────────────────────────
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
  bgCardTint: "#F5F3EE",
  bgBlueLight:"#D3E3F0",

  // Brand
  red:        "#CC0000",
  redDark:    "#8C0000",
  navy:       "#012854",
  navyDark:   "#041D3E",
  blueLight:  "#D3E3F0",

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
  borderMed: "rgba(0,0,0,0.13)",
  shadow:    "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:  "0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.05)",
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
