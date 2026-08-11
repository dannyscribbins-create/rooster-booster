// ─── Config ───────────────────────────────────────────────────────────────────
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// Get value from Stripe Dashboard → Developers → API Keys → Publishable key
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// ─── Contractor Config (white-label) ──────────────────────────────────────────
// Display/branding config only. contractorId below may NEVER be used to select whose data
// to serve, on any endpoint.
//
// ── THE contractorSlug EXCEPTION IS RETIRED (C/DL-3b Phase 2B, decision D1) ──────────────
// TENANT_RESOLUTION_REBUILD_SPEC.md Section 3.5 carved out two pre-session endpoints —
// POST /api/login and POST /api/forgot-pin — that accepted a contractorSlug field and used
// it to scope a WHERE clause. Both endpoints now IGNORE that field entirely.
//
// It was not retired by finding the host-based resolution the old note anticipated. It was
// retired by making the narrowing unnecessary: login gathers every candidate across all
// contractors, compares the password against each, and takes its tenancy from whichever row
// authenticated; forgot-pin sends one reset per matching account and answers generically
// either way. Tenancy comes from the authenticated row, never from the request.
//
// LoginScreen.jsx still SENDS the field, and that is harmless — the server does not read it.
// Both call sites are removed when Phase 5 rewrites the screen (spec §7.1).
export const CONTRACTOR_CONFIG = {
  contractorId:     'accent-roofing-dev', // must match the live contractors.id — see backend-literal reconciliation (registry Known Issues 2a)
  name:             'Accent Roofing Service',
  logoUrl:          '/AccentRoofing-Logo-White.png',
  reviewUrl:        'https://g.page/r/CbtYNjHgUCwhEBM/review',
  reviewButtonText: 'Leave a Review',
  reviewMessage:    'Enjoying the rewards? Leave us a quick Google review!',
  phone:            '770-277-4869',
  email:            'contact@leaksmith.com',
  website:          'accentroofingservice.com',
};
