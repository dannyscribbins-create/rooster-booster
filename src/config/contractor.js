// ─── Config ───────────────────────────────────────────────────────────────────
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

// TODO: Danny to add REACT_APP_STRIPE_PUBLISHABLE_KEY to Vercel environment variables
// Get value from Stripe Dashboard → Developers → API Keys → Publishable key
export const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '';

// ─── Contractor Config (white-label) ──────────────────────────────────────────
// Display/branding config only. contractorId below must NEVER be sent to the backend
// or used to resolve tenancy — it went stale after a contractors-table rename (2026-07-06)
// and caused every referrer-facing endpoint to resolve to the wrong (empty) tenant.
// The backend resolves contractor_id itself via getDefaultContractorId(); no client-supplied
// contractor id is trusted anywhere in the referrer API surface.
export const CONTRACTOR_CONFIG = {
  contractorId:     'accent-roofing',
  name:             'Accent Roofing Service',
  logoUrl:          '/AccentRoofing-Logo-White.png',
  reviewUrl:        'https://g.page/r/CbtYNjHgUCwhEBM/review',
  reviewButtonText: 'Leave a Review',
  reviewMessage:    'Enjoying the rewards? Leave us a quick Google review!',
  phone:            '770-277-4869',
  email:            'contact@leaksmith.com',
  website:          'accentroofingservice.com',
};
