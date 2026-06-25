/* eslint-env node */
'use strict';

/**
 * Frontend mirror of server/permissions/registry.js SECTIONS.
 *
 * A drift-guard test (server/test/registryMirror.test.js) enforces these stay
 * in sync — do not edit one without the other.
 *
 * Fields here match the backend exactly: key, type, flags (view/manage/single),
 * forward.  The `label` field is frontend-only (not in the backend registry).
 */
const REGISTRY_SECTIONS = [
  // ── Active sections ──────────────────────────────────────────────────────────
  {
    key: 'dashboard',
    type: 'view_only',
    flags: { view: 'dashboard' },
    label: 'Dashboard',
    description: 'View the main dashboard and stats overview',
    forward: false,
  },
  {
    key: 'referrers',
    type: 'view_manage',
    flags: { view: 'referrers', manage: 'referrers.manage' },
    label: 'Referrers',
    description: 'View and manage the referrers list',
    forward: false,
  },
  {
    key: 'contacts',
    type: 'view_manage',
    flags: { view: 'contacts', manage: 'contacts.manage' },
    label: 'Contacts',
    description: 'View and manage contacts',
    forward: false,
  },
  {
    key: 'campaigns',
    type: 'view_manage',
    flags: { view: 'campaigns', manage: 'campaigns.manage' },
    label: 'Campaigns',
    description: 'View and manage campaigns',
    forward: false,
  },
  {
    key: 'audiences',
    type: 'view_manage',
    flags: { view: 'audiences', manage: 'audiences.manage' },
    label: 'Audiences',
    description: 'View and manage dynamic audiences',
    forward: false,
  },
  {
    key: 'experience',
    type: 'view_manage',
    flags: { view: 'experience', manage: 'experience.manage' },
    label: 'Experience',
    description: 'View and manage the post-job experience flow',
    forward: false,
  },
  {
    key: 'referral_review',
    type: 'view_manage',
    flags: { view: 'referral_review', manage: 'referral_review.manage' },
    label: 'Referral Review',
    description: 'View and manage pending, missing, and flagged referrals',
    forward: false,
  },
  {
    key: 'cashouts',
    type: 'view_manage',
    flags: { view: 'cashouts', manage: 'cashouts.manage' },
    label: 'Cash Outs',
    description: 'View and manage cash-out requests',
    forward: false,
  },
  {
    key: 'cashout_approve',
    type: 'single',
    flags: { single: 'cashout_approve' },
    label: 'Approve Cash-Outs',
    description: 'Approve cash-out requests (security-critical; cannot be granted to General tier)',
    forward: false,
  },
  {
    key: 'finance_settings',
    type: 'view_manage',
    flags: { view: 'finance_settings', manage: 'finance_settings.manage' },
    label: 'Finance Settings',
    description: 'View and manage finance and payout settings',
    forward: false,
  },
  {
    key: 'billing',
    type: 'view_manage',
    flags: { view: 'billing', manage: 'billing.manage' },
    label: 'Billing',
    description: 'View and manage billing information',
    forward: false,
  },
  {
    key: 'branding',
    type: 'view_manage',
    flags: { view: 'branding', manage: 'branding.manage' },
    label: 'Branding',
    description: 'View and manage branding and appearance settings',
    forward: false,
  },
  {
    key: 'integrations',
    type: 'view_manage',
    flags: { view: 'integrations', manage: 'integrations.manage' },
    label: 'Integrations',
    description: 'View and manage CRM and third-party integrations',
    forward: false,
  },
  {
    key: 'advanced',
    type: 'manage_only',
    flags: { manage: 'advanced' },
    label: 'Advanced',
    description: 'Access advanced settings and destructive operations',
    forward: false,
  },
  {
    key: 'activity',
    type: 'view_only',
    flags: { view: 'activity' },
    label: 'Activity Log',
    description: 'View the activity log',
    forward: false,
  },
  {
    key: 'team',
    type: 'view_manage',
    flags: { view: 'team', manage: 'team.manage' },
    label: 'Team',
    description: 'View and manage team members and permissions',
    forward: false,
  },
  {
    key: 'rep_assignment',
    type: 'single',
    flags: { single: 'rep_assignment' },
    label: 'Rep Assignment',
    description: 'Assign sales reps to contacts and jobs',
    forward: false,
  },
  // ── Forward sections (reserved namespace, not yet enforced) ──────────────────
  {
    key: 'points',
    type: 'view_manage',
    flags: { view: 'points', manage: 'points.manage' },
    label: 'Points',
    description: 'Points and loyalty programme management (not yet live)',
    forward: true,
  },
  {
    key: 'client_portal',
    type: 'view_manage',
    flags: { view: 'client_portal', manage: 'client_portal.manage' },
    label: 'Client Portal',
    description: 'Client-facing portal management (not yet live)',
    forward: true,
  },
  {
    key: 'boost_campaign',
    type: 'view_manage',
    flags: { view: 'boost_campaign', manage: 'boost_campaign.manage' },
    label: 'Boost Campaign',
    description: 'Boost campaign management (not yet live)',
    forward: true,
  },
  {
    key: 'account_keeping',
    type: 'view_manage',
    flags: { view: 'account_keeping', manage: 'account_keeping.manage' },
    label: 'Account Keeping',
    description: 'Account-keeping and reconciliation tools (not yet live)',
    forward: true,
  },
];

// Finance flags that only Owners may assign to General-tier members (Wall 1).
const FINANCE_WALL_FLAGS = new Set(['finance_settings', 'finance_settings.manage']);

// UX grouping for the permission grid — each group is collapsible.
const PERM_GROUPS = [
  { key: 'overview',   label: 'Overview',       icon: 'ph-house',     sections: ['dashboard', 'activity'] },
  { key: 'people',     label: 'People',          icon: 'ph-users',     sections: ['referrers', 'contacts'] },
  { key: 'marketing',  label: 'Marketing',       icon: 'ph-megaphone', sections: ['campaigns', 'audiences', 'experience'] },
  { key: 'operations', label: 'Operations',      icon: 'ph-gear',      sections: ['referral_review', 'cashouts', 'cashout_approve'] },
  { key: 'finance',    label: 'Finance',         icon: 'ph-bank',      sections: ['finance_settings', 'billing'] },
  { key: 'admin',      label: 'Administration',  icon: 'ph-shield',    sections: ['branding', 'integrations', 'advanced', 'team', 'rep_assignment'] },
  { key: 'forward',    label: 'Coming Soon',     icon: 'ph-clock',     sections: ['points', 'client_portal', 'boost_campaign', 'account_keeping'] },
];

module.exports = { REGISTRY_SECTIONS, FINANCE_WALL_FLAGS, PERM_GROUPS };
