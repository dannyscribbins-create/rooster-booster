---
paths:
  - "src/**/*.{js,jsx}"
---

# Frontend conventions

⚠ **NOT LOADED AT SESSION START.** This file loads when Claude reads a `src/**/*.{js,jsx}`
file, and is NOT re-injected after a compaction. `CLAUDE.md` carries a permanent pointer
block naming it, so its absence is announced rather than silent.

⚠ **THE ENFORCEABLE RULES ARE IN `CLAUDE.md`, NOT HERE.** The styling block below elaborates
*Never Break → Frontend Rules*, which stays resident and carries the whole prohibition.
**When deduplicating, never delete the resident copy in favour of the more detailed one
here: that silently unscopes a non-negotiable.**

Moved verbatim from `CLAUDE.md` in restructure Phase 2. Nothing was corrected on the way in.
Three blocks did NOT move and are still in `CLAUDE.md`: the three-surfaces-by-IDENTITY rule,
the `?admin=true` block (its audience is server-side email templates, not this file's), and
the pipeline stage vocabulary.

## Frontend — Component Structure

`src/App.jsx` is a routing shell (~250 lines — has grown beyond original 135-line target; extraction of pipeline state into a custom hook is a future cleanup item). Do not add component code into App.jsx.

## Import conventions
- Referrer: `import { R } from '../../constants/theme'`
- Admin: `import { AD } from '../../constants/adminTheme'`
- Config: `import { BACKEND_URL } from '../../config/contractor'`
- ⚠ **Contractor identity comes from `useBranding()`** (`src/components/shared/ThemeProvider.jsx`), never from a config module. `CONTRACTOR_CONFIG` was **deleted in C/DL-3b Phase 6** — it held one tenant's name, logo, phone, email, website and review link and shipped them to every contractor. `src/config/contractor.js` is platform-level only and nothing contractor-specific may be added back.

## ESLint note
Every `useEffect` with intentionally omitted dependencies must have `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line immediately above the dependency array.

Under Vite, ESLint is **not** part of the build — `react-hooks/exhaustive-deps` is no longer a Vercel build error the way it was under CRA's `CI=true`. It is enforced instead by `npm run lint`, which `npm test` runs first, so a violation blocks the pre-push gate rather than the deploy. `eslint.config.mjs` sets `reportUnusedDisableDirectives: 'off'`: `eslint-plugin-react-hooks` v7 understands stable setState setters and refs that the CRA-era v4 flagged, so ~50 existing disable comments now look "unused". They are kept deliberately — they document intent and re-arm if a future plugin version changes its analysis. Do not strip them with `--fix`.

## Styling
All styling inline. Never add CSS files. Design tokens: `src/constants/theme.js` (R) and `src/constants/adminTheme.js` (AD).
- Colors: **RoofMiles** primary `#F26A1B`, secondary `#1C2D4D`, background `#FDF0E7`, surface
  `#FFFFFF` (`src/utils/brandingTheme.mjs`). ⚠ Navy `#012854` / Red `#CC0000` / Light Blue
  `#D3E3F0` were **Accent Roofing's** and were retired from the admin chrome in ABR Phase 5 —
  **they are sweep needles now, not values to reach for.** Contractor colour resolves at
  runtime via `useBranding()`; the only place it appears in chrome is the primary CTA fill.
- Fonts: Montserrat (display), Roboto (body), Roboto Mono (numbers)
- Icons: Phosphor Icons v2.1.1 only
- Mobile-first: 430px max-width with safe-area insets

## Post-render throws need an error boundary, not a try/catch

A component that renders successfully and throws **later** — in an effect, a settled promise,
an event handler — is invisible to `ErrorBoundary.jsx`, which catches render-phase throws
only. Wrap deferred async work in `safeAsync()` (`src/utils/clientErrorReporter.js`) so the
throw reaches a log.

⚠ **An unwrapped `(async () => {...})()` inside a component reaches NO log and NO console.**
The live example is the IIFE inside `AdminApp.jsx`'s `primeBadgeCounts()`; the two
`safeAsync(...)` calls in the inbox/notification effect above it show the shape it should have.
⚠ **CITED BY ROLE SINCE 2026-08-31.** This read `AdminApp.jsx:148` with siblings at `:120` and
`:130`, and C/DL-3c Phase 2b moved all three — the gating work inserted comment blocks above
them. A function name does not drift, and `citecheck` never sees a scoped rule file's prose.
