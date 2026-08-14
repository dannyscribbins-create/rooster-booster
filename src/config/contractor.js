// ─── Platform Config ──────────────────────────────────────────────────────────
//
// ⚠ THIS FILE HOLDS PLATFORM-LEVEL VALUES ONLY. NOTHING CONTRACTOR-SPECIFIC MAY
// BE ADDED BACK — not a name, not a logo, not a phone number, not a colour.
//
// ── WHAT USED TO BE HERE, AND WHY IT IS GONE (C/DL-3b Phase 6) ───────────────
// `CONTRACTOR_CONFIG` held ONE tenant's identity as module constants:
// contractorId, name, logoUrl, reviewUrl, reviewButtonText, reviewMessage, phone,
// email and website. Nine keys, eight of them that tenant's, read by six
// components and shipped to every contractor.
//
// It was not a styling problem. A homeowner referred by contractor #2 opened the
// app and saw contractor #1's phone number, email, website and Google review link
// — and `ContactModal`, reached from the login screen behind "Homeowners: don't
// have an account? Contact your rep", meant the one instruction the product gives
// a stranded homeowner **routed their support call to a competitor**.
//
// ── WHERE CONTRACTOR IDENTITY COMES FROM NOW ────────────────────────────────
// The D4 branding chain (`src/utils/brandingChain.js`) resolves it, ThemeProvider
// publishes it, and components read it through `useBranding()`. One seam, one
// answer, and it is the CONTRACTOR'S OWN data from `contractor_settings` rather
// than a constant compiled into the bundle.
//
// `contractorId` needed no migration at all — Phase 5 removed its last reader
// when the unified login stopped sending the retired `contractorSlug`, so it was
// already dead when this file was cut down.
//
// THE GUARD: `src/components/referrer/contractorBranding.test.jsx` sweeps the
// rewired components for the string `CONTRACTOR_CONFIG` as well as for Accent
// literals — the delivery mechanism is swept alongside the values it delivered,
// so re-introducing the module in order to "just hardcode one thing" fails.
// ─────────────────────────────────────────────────────────────────────────────

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// Get value from Stripe Dashboard → Developers → API Keys → Publishable key
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
