This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
```bash
# Development
npm start          # React frontend on port 3000
node server.js     # Express backend on port 4000

# Production (Railway)
npm install        # build step
node server.js     # start step

# Tests
npm test           # runs react-scripts test in watch mode

# Build
npm run build      # production React build
```

No lint script is configured. `.npmrc` sets `legacy-peer-deps=true` to handle dependency conflicts.

## Architecture

## Architectural Principles

Every decision in this codebase must pass two filters before implementation:

1. **Will this produce healthy, efficient code that is unlikely to break?**
2. **Will this work at large scale — many contractors, many referrers?**

If a shortcut is taken for MVP speed, it must be flagged with a code comment in the exact location where the shortcut lives, explaining: (a) what the limitation is, (b) what the scalable version looks like, and (c) when to build it.

### Known MVP shortcuts to address later

- **paid_count on users table** — updated only when a referrer loads their pipeline. Stale if a referral converts in Jobber between app visits. At FORA scale, replace with a background cron job that syncs all referrers' pipeline data from their CRM on a scheduled interval (e.g. every 24 hours). The column stays — the cron job is additive, not a rewrite. Flagged in code with comment: `// MVP: update this to cron-based sync at scale`

- **Jobber webhook not yet implemented** — referral_conversions rows are recorded only when the leaderboard endpoint is called (i.e. when a referrer opens the Rankings tab). At FORA scale, implement a Jobber webhook that fires on invoice payment and writes to referral_conversions immediately, then also trigger a push notification and kick off the Stripe ACH payout flow. See referral_conversions insert logic for full comment. This is the Stripe ACH session deliverable.

---

**Rooster Booster** is a referral rewards platform for Accent Roofing Service — a full-stack app with a Node.js/Express backend and a React SPA frontend split across organized component files.

### Backend — Folder Structure

`server.js` is a 23-line entry point only. It imports, mounts routes, calls initDB, and starts the server. Do not add route handlers or logic into server.js.

```
server.js                          ← 23-line entry point — imports, middleware, route mounts, listen
server/
├── db.js                          ← PostgreSQL pool + initDB() — returns access token on load
├── crm/
│   ├── index.js                   ← getCRMAdapter(contractorId) — dispatcher, currently always returns Jobber
│   ├── jobber.js                  ← accessToken, setAccessToken(), refreshTokenIfNeeded(), fetchPipelineForReferrer()
│   ├── servicetitan.js            ← placeholder — implement fetchPipeline() when ready
│   └── acculynx.js                ← placeholder — implement fetchPipeline() when ready
├── middleware/
│   └── auth.js                    ← verifyAdminSession()
└── routes/
    ├── oauth.js                   ← GET /auth/jobber, GET /callback
    ├── referrer.js                ← all /api/* referrer endpoints (9 routes + 3 rate limiters)
    ├── admin.js                   ← all /api/admin/* endpoints (12 routes + 1 rate limiter)
    └── stripe.js                  ← placeholder — implement Stripe ACH payout routes when ready
```

**What each layer does:**
- **db.js** — owns the PostgreSQL pool. All other files import `{ pool }` from here. `initDB()` creates/migrates all tables and returns the Jobber access token if one exists.
- **crm/jobber.js** — owns `accessToken` and all Jobber-specific logic. `fetchPipelineForReferrer()` is the core shared function used by both referrer and admin routes.
- **crm/index.js** — `getCRMAdapter(contractorId)` is the FORA hook. When contractor #2 uses a different CRM, add their adapter file and update this dispatcher. No route code changes needed.
- **middleware/auth.js** — `verifyAdminSession(req, res)` returns true/false and handles 401 response automatically.
- **routes/referrer.js** — referrerLoginLimiter, forgotPinLimiter, resetPinLimiter live here.
- **routes/admin.js** — adminLoginLimiter and ADMIN_PASSWORD live here.

**Adding new backend routes:**
- New referrer endpoints → add to `server/routes/referrer.js`
- New admin endpoints → add to `server/routes/admin.js`
- New CRM → create `server/crm/yourcrmname.js`, update `server/crm/index.js`
- Stripe ACH routes → build into `server/routes/stripe.js`

**Key backend behaviors:**
- **Jobber OAuth 2.0** — token acquisition in oauth.js, storage in `tokens` table, automatic refresh in crm/jobber.js when expiring
- **Two auth systems** — referrers: email + PIN (bcrypt), admins: password; both get session tokens in `sessions` table (24h TTL, role column separates referrer/admin)
- **Jobber GraphQL API** — queried in fetchPipelineForReferrer() to find clients with "Referred by" custom field, cross-referenced with quotes/jobs/invoices
- **Pipeline stages**: lead → inspection → sold → paid
- **Bonus calculation** — 7-tier boost schedule ($500–$900 per sale) based on cumulative paid count
- **Leaderboard endpoint** — returns `period_earnings` (sum of bonus_amount for the filtered period) on every top10 row, userRank row, and warmup row; returns `current_user` (full_name, profile_photo) on all responses for the personal rank row
- **Cash out workflow** — referrers request payouts; admin approves/denies; Resend sends email notifications; approval triggers payout_announcements row
- **Admin dashboard stats** — cached in `admin_cache` table with 15-minute TTL
- **Rate limiting** — 10 attempts/15min referrer login, 5 admin login, 3 forgot-pin, 10 reset-pin
- **Badge system** — `GET /api/referrer/badges` returns all 7 badges merged with user's earned records (unearned secrets return null name/description); `POST /api/referrer/badges/acknowledge` marks badges seen after the celebration popup is dismissed; `checkAndAwardBadges(userId, count)` runs after every pipeline sync; founding_referrer awarded at account creation (first 20 users)

**Database tables**: `tokens`, `users` (incl. paid_count + paid_count_updated_at — MVP, see Architectural Principles), `sessions`, `cashout_requests`, `activity_log`, `admin_cache`, `payout_announcements`, `announcement_settings`, `pin_reset_tokens`, `engagement_settings` (incl. season settings), `user_badges` (incl. seen column), `referral_conversions` (incl. bonus_amount INTEGER — dollar amount stored at sync time, source of truth for period-filtered earnings; see pipeline sync comment)

---

### Frontend — Component Structure

`src/App.js` is a 135-line routing shell. It holds root state, two useEffect hooks, and the routing gate. Do not add component code into App.js — all UI lives in the component files below.

**Two top-level modes:**
- **Referrer app** — 5-tab bottom nav: Home, Refer, Rankings, Cash Out, Profile
- **Admin panel** — accessed via `?admin=true` URL param — 6 sections: Dashboard, Referrers, Cash Outs, Activity Log, Announcements, Engagement

#### Root state (lives in App.js — do not move)
`loggedIn`, `tab`, `userName`, `userEmail`, `pipeline`, `balance`, `paidCount`, `loading`, `profilePhoto`, `showReviewCard`, `announcement`, `announcementSettings`, `showAnnouncement`, `announcementShown`

#### Folder structure
```
src/
├── App.js                          ← 135-line routing shell + root state only
├── config/
│   └── contractor.js               ← CONTRACTOR_CONFIG (incl. contractorId) + BACKEND_URL (white-label boundary for FORA)
├── constants/
│   ├── theme.js                    ← R design tokens + STATUS_CONFIG
│   ├── adminTheme.js               ← AD admin design tokens
│   ├── boostSchedule.js            ← BOOST_TABLE + getNextPayout()
│   └── badges.js                   ← BADGES array — badge definitions, tiers, and trigger types
├── hooks/
│   └── useEntrance.js              ← useEntrance animation hook
└── components/
    ├── shared/
    │   ├── Screen.jsx              ← Page wrapper
    │   ├── AnimCard.jsx            ← Animated card wrapper
    │   ├── StatusBadge.jsx         ← Status badge (referrer + admin)
    │   ├── AvatarCircle.jsx        ← Avatar with camera hint
    │   └── ContactModal.jsx        ← Contact modal (Login + Profile)
    ├── auth/
    │   ├── LoginScreen.jsx         ← Login + inline forgot PIN flow
    │   └── ResetPinScreen.jsx      ← Reset PIN (email reset links)
    ├── referrer/
    │   ├── ReferrerApp.jsx         ← Tab shell + BottomNav
    │   ├── DashboardTab.jsx
    │   ├── ReferAFriendTab.jsx     ← Refer a Friend tab — QR code + share link
    │   ├── RankingsTab.jsx         ← Rankings tab — podium display (top 3), leaderboard list (4–10), time filters, prize display, always-visible personal rank row with period_earnings
    │   ├── CashOutTab.jsx
    │   ├── ProfileTab.jsx          ← Personal hub — My Referrals (pipeline), Activity feed, Badge gallery
    │   ├── BadgeCelebrationPopup.jsx ← New badge celebration overlay — one badge at a time, entrance animation
    │   └── AnnouncementPopup.jsx   ← Payout popup + PRESET_MESSAGES + resolveMessage()
    └── admin/
        ├── AdminApp.jsx            ← AdminPanel + AdminLogin + useAdminFonts
        ├── AdminComponents.jsx     ← AdminSidebar, AdminShell, AdminPageHeader,
        │                              StatCard, Badge, Btn, AdminInput, PipelineBar, ADMIN_NAV
        ├── AdminDashboard.jsx
        ├── AdminReferrers.jsx
        ├── AdminCashOuts.jsx
        ├── AdminActivityLog.jsx
        └── AdminAnnouncementSettings.jsx
```

#### Import conventions
- Referrer components: `import { R } from '../../constants/theme'`
- Admin components: `import { AD } from '../../constants/adminTheme'`
- Backend URL + white-label config: `import { BACKEND_URL, CONTRACTOR_CONFIG } from '../../config/contractor'`
- Boost table: `import { BOOST_TABLE, getNextPayout } from '../../constants/boostSchedule'`
- Animation hook: `import useEntrance from '../../hooks/useEntrance'`

#### New referrer features
Add new tab files to `src/components/referrer/`. Wire them into `ReferrerApp.jsx` (tab shell) and add a nav entry to `BottomNav` inside that file.

#### New admin features
Add new page files to `src/components/admin/`. Wire them into `AdminApp.jsx` and add a nav entry to `ADMIN_NAV` in `AdminComponents.jsx`.

#### ESLint note
`react-hooks/exhaustive-deps` warnings are hard Vercel build errors. Every `useEffect` with intentionally omitted dependencies must have `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line immediately above the dependency array.

### Styling
All styling is inline (no CSS framework). Never add CSS files. Design tokens live in `src/constants/theme.js` (R object) and `src/constants/adminTheme.js` (AD object).
- Colors: Navy `#012854`, Red `#CC0000`, Light Blue `#D3E3F0`
- Fonts: Montserrat (display), Roboto (body), Roboto Mono (numbers)
- Icons: Phosphor Icons v2.1.1
- Mobile-first layout: 430px max-width with safe-area insets

## Brand Standards

For any UI or UX work, read and apply the design skills at:
- `.claude/skills/ui-designer/` — UI design guidance
- `.claude/skills/ux-designer/` — UX design guidance
- `.claude/skills/ui-ux-pro-max/` — installed Session 15, use for polish passes

Also reference the brand files located at:

`G:\My Drive\Accent Roofing Service\app builder\accent roofing brand kit`

- `accent-roofing-brand-tokens.css` — design tokens (colors, typography, spacing, etc.)
- `accent-roofing-brand-reference.md` — brand guidelines and usage rules

## Deployment

Hosted on Railway (backend) and Vercel (frontend). Environment variables required:
- `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, `REDIRECT_URI` — Jobber OAuth
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSWORD` — admin panel access
- `RESEND_API_KEY` — email notifications via Resend
- `FRONTEND_URL` — required for forgot PIN reset email links

Railway auto-deploys on every GitHub push. Wait ~30 seconds after pushing before testing. Vercel may need a manual redeploy — go to Vercel dashboard, find latest deployment, click three dots, Redeploy.

**Local environment cannot connect to Railway PostgreSQL.** Always test login-dependent features on the live Vercel/Railway deployment, never locally.

**Jobber API version header is `2026-02-17`** — monitor for deprecation notices. Real Accent Roofing Jobber account connects April 14, 2026.