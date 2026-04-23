// ─── Brand Design Tokens ──────────────────────────────────────────────────────
export const R = {
  // Backgrounds
  bgPage:     "#EEF2F7",
  bgSurface:  "#FAFAF8",
  bgCard:     "#FFFFFF",
  bgCardTint: "#F5F3EE",
  bgNavy:     "#012854",
  bgNavyDark: "#041D3E",
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
  textNavy:      "#012854",
  textOnDark:    "#FFFFFF",

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
};
