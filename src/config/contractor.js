// ─── Config ───────────────────────────────────────────────────────────────────
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

// TODO: Danny to add REACT_APP_STRIPE_PUBLISHABLE_KEY to Vercel environment variables
// Get value from Stripe Dashboard → Developers → API Keys → Publishable key
export const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '';

// ─── Contractor Config (white-label) ──────────────────────────────────────────
// Display/branding config only. contractorId below may be sent to the backend ONLY on the
// two pre-session endpoints that explicitly accept a contractorSlug field (POST /api/login,
// POST /api/forgot-pin — see TENANT_RESOLUTION_REBUILD_SPEC.md Section 3.5), where it scopes
// a WHERE clause that a credential check (PIN, or a not-found-either-way generic response)
// still gates. It may NEVER be used to select whose data to serve on any authenticated or
// data-returning endpoint. This narrower rule replaces the original blanket "never send to
// backend" rule after the 2026-07-06 tenant-resolution rebuild (approved by Danny, spec
// Section 9, Q2, 2026-07-07).
//
// Planned retirement: once per-contractor Host-header/subdomain-based tenant resolution
// exists, this exception should be removed and contractorSlug deleted from both endpoints'
// request bodies — same retirement discipline as getDefaultContractorId() (Section 5).
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
