// Badge definitions — single source of truth for both frontend and backend logic.
// trigger values:
//   "pipeline_sync"    — awarded automatically when /api/pipeline is called
//   "account_creation" — awarded at user creation time
//   "admin_awarded"    — manually granted by admin (yearly_winner, future manual badges)
export const BADGES = [
  {
    id: "founding_referrer",
    name: null,
    emoji: "🐓",
    description: null,
    tier: "secret",
    trigger: "account_creation",
  },
  {
    id: "first_referral",
    name: "First Referral",
    emoji: "⭐",
    description: "You made your first referral.",
    tier: "standard",
    trigger: "pipeline_sync",
  },
  {
    id: "milestone_5",
    name: "On a Roll",
    emoji: "🔥",
    description: "5 referrals and counting.",
    tier: "standard",
    trigger: "pipeline_sync",
  },
  {
    id: "milestone_10",
    name: "Double Digits",
    emoji: "🔥",
    description: "10 referrals. You're serious about this.",
    tier: "standard",
    trigger: "pipeline_sync",
  },
  {
    id: "milestone_25",
    name: "Referral Machine",
    emoji: "🔥",
    description: "25 referrals. Legendary.",
    tier: "standard",
    trigger: "pipeline_sync",
  },
  {
    id: "client_badge",
    name: "Client",
    emoji: "🏠",
    description: "You're not just a referrer — you're family.",
    tier: "standard",
    trigger: "pipeline_sync",
  },
  {
    id: "yearly_winner",
    name: "Yearly Champion",
    emoji: "🏆",
    description: "Top of the leaderboard at year end.",
    tier: "standard",
    trigger: "admin_awarded",
  },
];
