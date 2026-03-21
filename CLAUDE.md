# CLAUDE.md

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

**Rooster Booster** is a referral rewards platform for Accent Roofing Service — a full-stack app with a Node.js/Express backend (`server.js`) and a React SPA frontend (`src/App.js`).

### Backend (`server.js`)

Single-file Express server handling:
- **Jobber OAuth 2.0** — token acquisition, storage in `tokens` table, and automatic refresh when expiring
- **Two auth systems** — referrers authenticate via email + PIN (bcrypt-hashed), admins via password; both get session tokens stored in `sessions` table (24h TTL)
- **Jobber GraphQL API** — queried to find clients with a "Referred by" custom field, then cross-referenced with quotes/jobs/invoices to determine pipeline stage
- **Pipeline stages**: lead → inspection → sold → paid
- **Bonus calculation** — 7-tier boost schedule ($500–$900 per sale) based on cumulative sales count
- **Cash out workflow** — referrers request payouts; admin approves/denies; Resend API sends email notifications
- **Admin dashboard stats** — cached in `admin_cache` table with 15-minute TTL
- **Rate limiting** — 10 attempts/15min for referrer login, 5 for admin login

**Database tables**: `tokens`, `users`, `sessions`, `cashout_requests`, `activity_log`, `admin_cache`

### Frontend (`src/App.js`)

A single 2100+ line file containing the entire React application with no component splitting. Two top-level modes:

- **Referrer app** — 5-tab bottom nav: Dashboard, Pipeline, Cash Out, History, Profile
- **Admin panel** — 4-section dashboard: Dashboard, Referrers, Cash Outs, Activity Log

All styling is inline (no CSS framework). Design system constants are defined at the top of `App.js`:
- Colors: Navy `#012854`, Red `#CC0000`, Light Blue `#D3E3F0`
- Fonts: Montserrat (display), DM Sans (body), DM Mono (monospace)
- Icons: Phosphor Icons v2.1.1
- Mobile-first layout: 430px max-width with safe-area insets

## Brand Standards

For any UI or UX work, read and apply the design skills at:
- `.claude/skills/ui-designer/` — UI design guidance
- `.claude/skills/ux-designer/` — UX design guidance

Also reference the brand files located at:

`G:\My Drive\Accent Roofing Service\app builder\accent roofing brand kit`

- `accent-roofing-brand-tokens.css` — design tokens (colors, typography, spacing, etc.)
- `accent-roofing-brand-reference.md` — brand guidelines and usage rules

### Deployment

Hosted on Railway.app. Environment variables required:
- `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, `REDIRECT_URI` — Jobber OAuth
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSWORD` — admin panel access
- `RESEND_API_KEY` — email notifications via Resend
