'use strict';

/**
 * Permission registry — single source of truth for every section, its flag set, and a
 * plain-language description used by the Team Management UI.
 *
 * Flag naming:
 *   View-only sections  → one flag equal to the key           (e.g. 'dashboard')
 *   Manage-only section → one flag equal to the key           (e.g. 'advanced')
 *   View+manage sections→ view = key, manage = key + '.manage'
 *   Single flags        → one flag equal to the key           (e.g. 'cashout_approve')
 *
 * 'forward: true' entries are reserved namespace — not yet enforced, defaulted off.
 */
const SECTIONS = [
  // ── CURRENT SECTIONS ────────────────────────────────────────────────────────
  {
    key: 'dashboard',
    type: 'view_only',
    flags: { view: 'dashboard' },
    description: 'View the main dashboard and stats overview',
    forward: false,
  },
  {
    key: 'referrers',
    type: 'view_manage',
    flags: { view: 'referrers', manage: 'referrers.manage' },
    description: 'View and manage the referrers list',
    forward: false,
  },
  {
    key: 'contacts',
    type: 'view_manage',
    flags: { view: 'contacts', manage: 'contacts.manage' },
    description: 'View and manage contacts',
    forward: false,
  },
  {
    key: 'campaigns',
    type: 'view_manage',
    flags: { view: 'campaigns', manage: 'campaigns.manage' },
    description: 'View and manage campaigns',
    forward: false,
  },
  {
    key: 'audiences',
    type: 'view_manage',
    flags: { view: 'audiences', manage: 'audiences.manage' },
    description: 'View and manage dynamic audiences',
    forward: false,
  },
  {
    key: 'experience',
    type: 'view_manage',
    flags: { view: 'experience', manage: 'experience.manage' },
    description: 'View and manage the post-job experience flow',
    forward: false,
  },
  {
    key: 'referral_review',
    type: 'view_manage',
    flags: { view: 'referral_review', manage: 'referral_review.manage' },
    description: 'View and manage pending, missing, and flagged referrals',
    forward: false,
  },
  {
    key: 'cashouts',
    type: 'view_manage',
    flags: { view: 'cashouts', manage: 'cashouts.manage' },
    description: 'View and manage cash-out requests',
    forward: false,
  },
  {
    key: 'cashout_approve',
    type: 'single',
    flags: { single: 'cashout_approve' },
    description: 'Approve cash-out requests (security-critical; cannot be granted to General tier)',
    forward: false,
  },
  {
    key: 'finance_settings',
    type: 'view_manage',
    flags: { view: 'finance_settings', manage: 'finance_settings.manage' },
    description: 'View and manage finance and payout settings',
    forward: false,
  },
  {
    key: 'billing',
    type: 'view_manage',
    flags: { view: 'billing', manage: 'billing.manage' },
    description: 'View and manage billing information',
    forward: false,
  },
  {
    key: 'branding',
    type: 'view_manage',
    flags: { view: 'branding', manage: 'branding.manage' },
    description: 'View and manage branding and appearance settings',
    forward: false,
  },
  {
    key: 'integrations',
    type: 'view_manage',
    flags: { view: 'integrations', manage: 'integrations.manage' },
    description: 'View and manage CRM and third-party integrations',
    forward: false,
  },
  {
    key: 'advanced',
    type: 'manage_only',
    flags: { manage: 'advanced' },
    description: 'Access advanced settings and destructive operations',
    forward: false,
  },
  {
    key: 'activity',
    type: 'view_only',
    flags: { view: 'activity' },
    description: 'View the activity log',
    forward: false,
  },
  {
    key: 'team',
    type: 'view_manage',
    flags: { view: 'team', manage: 'team.manage' },
    description: 'View and manage team members and permissions',
    forward: false,
  },
  {
    key: 'rep_assignment',
    type: 'single',
    flags: { single: 'rep_assignment' },
    description: 'Assign sales reps to contacts and jobs',
    forward: false,
  },

  // ── FORWARD SECTIONS (reserved namespace, not yet enforced) ──────────────────
  {
    key: 'points',
    type: 'view_manage',
    flags: { view: 'points', manage: 'points.manage' },
    description: 'Points and loyalty programme management (not yet live)',
    forward: true,
  },
  {
    key: 'client_portal',
    type: 'view_manage',
    flags: { view: 'client_portal', manage: 'client_portal.manage' },
    description: 'Client-facing portal management (not yet live)',
    forward: true,
  },
  {
    key: 'boost_campaign',
    type: 'view_manage',
    flags: { view: 'boost_campaign', manage: 'boost_campaign.manage' },
    description: 'Boost campaign management (not yet live)',
    forward: true,
  },
  {
    key: 'account_keeping',
    type: 'view_manage',
    flags: { view: 'account_keeping', manage: 'account_keeping.manage' },
    description: 'Account-keeping and reconciliation tools (not yet live)',
    forward: true,
  },
];

// Flat set of every valid flag string — used by registry-reconciliation tests
// to verify that route middleware only references flags that exist in this registry.
const ALL_FLAGS = new Set(
  SECTIONS.flatMap(s => Object.values(s.flags).filter(Boolean))
);

module.exports = { SECTIONS, ALL_FLAGS };
