const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getCRMAdapter } = require('../crm/index');
const { refreshTokenIfNeeded } = require('../crm/jobber'); // still used for background Jobber client-match at signup
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const axios = require('axios');
const { logError } = require('../middleware/errorLogger');
const { body, validationResult } = require('express-validator');
const { getPeriodDateRange } = require('../utils/dateUtils');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { resendShouldRetry } = require('../utils/retryHelpers');
const { sendAdminNotification, resolveNotificationRecipient } = require('../utils/notificationEmail');
const { isEmailSuppressed } = require('../utils/emailSuppression');
const { executeStripeTransfer } = require('../utils/stripeTransfer');
const { verifyReferrerSession } = require('../middleware/auth');
const { applyTag } = require('../utils/tags');
const { runContactMatchingPass } = require('../jobs/contactMatchingPass');
// recordScanEvent is NOT imported here any more — the only caller was the landing
// resolution body, which moved to utils/landingResolve.js in C/DL-2 Phase 3d-1.
const {
  generateSlug,
  buildInviteUrl,
  resolveToken,
  redeemToken,
} = require('../utils/inviteTokens');
const { getInviteHostSlug } = require('../utils/contractorSlug');
// C/DL-2 Phase 3d-1 — landing resolution moved to a shared module so the
// server-rendered page and this JSON endpoint run ONE implementation. See that
// file's header for why a second copy is the failure mode rather than the
// shortcut. loadContractorBranding is imported rather than redefined here; it has
// four other call sites in this file (signup email, resend-code, PIN reset).
const { resolveLanding, loadContractorBranding } = require('../utils/landingResolve');
// C/DL-3b Phase 1 — the theme provider's stored light/dark read. This is
// user_preferences' FIRST PRODUCTION CALLER; the store shipped in C/DL-3a with
// none. Read only — the toggle that writes it is 3c (spec D8).
const { getPreference, THEME_MODE_PREF_KEY } = require('../utils/userPreferences');
// C/DL-3b Phase 2B — timing parity on a login miss. Shared rather than a third
// copy of the constant; see that file's header.
const { DUMMY_BCRYPT_HASH } = require('../utils/dummyHash');
// C/DL-3b Phase 3 — the verified-but-frozen answer (D3). Shared with
// POST /api/admin/login so the two doors cannot disagree about what a frozen
// account looks like; see that file's header for when it may be called.
const { buildFrozenAccountBody } = require('../utils/frozenAccount');

// test seam — inert in production, never called outside server/test/
// Only the cashout-section call sites below use these overrides.
let _sendEmail              = (...args) => resend.emails.send(...args);
let _sendAdminNotificationFn = sendAdminNotification;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const clientErrorLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many error reports. Please try again in an hour.' }
});

const pipelineLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'Too many pipeline requests. Please wait a few minutes.' }
});

const cashoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many cashout requests. Please try again in an hour.' }
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many booking requests. Please try again in an hour.' }
});

const missingReferralLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many missing referral reports. Please try again tomorrow.' }
});

router.post('/api/log-client-error', clientErrorLimiter, async (req, res) => {
  try {
    const { error_message, stack_trace, route, component } = req.body

    if (!error_message) {
      return res.status(400).json({ error: 'error_message is required' })
    }

    await logError({
      req: {
        path: route || component || 'frontend-unknown',
        method: 'CLIENT'
      },
      error: {
        message: String(error_message).substring(0, 500),
        stack: stack_trace ? String(stack_trace).substring(0, 5000) : null
      },
      source: 'frontend'
    })

    res.status(200).json({ ok: true })
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/log-client-error' });
    console.error('[log-client-error] Failed to log client error:', err);
    res.status(500).json({ error: 'Failed to log error' });
  }
})

const referrerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const forgotPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reset requests. Please try again in 15 minutes.' }
});

const resetPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please request a new reset link.' }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many signup attempts. Please try again in an hour.' }
});

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts. Please wait 15 minutes.' }
});

// ── VERIFICATION CODE RESEND LIMIT (C/DL-2 Phase 2b) ──────────────────────────
// Unauthenticated, and it sends mail to an address the caller supplies — the exact
// shape of an abuse primitive, and the same shape as /api/forgot-pin. The numbers
// therefore match forgotPinLimiter (3 per 15 minutes per IP) rather than being
// reasoned about independently.
//
// EXPORTED as a plain object (see the bottom of this file) so the test suite reads
// the threshold instead of hardcoding it, and tuning these numbers cannot break a
// test. Same convention as LANDING_RESOLVE_LIMIT below.
const RESEND_CODE_LIMIT = { windowMs: 15 * 60 * 1000, max: 3 };

const resendCodeLimiter = rateLimit({
  windowMs: RESEND_CODE_LIMIT.windowMs,
  max: RESEND_CODE_LIMIT.max,
  message: { error: 'Too many code requests. Please try again in 15 minutes.' }
});

// ── PUBLIC LANDING RESOLUTION LIMIT (C/DL-2 Phase 2a) ─────────────────────────
// The one endpoint on this router that takes unauthenticated internet traffic AND
// performs a write (recordScanEvent), so it needs its own limiter.
//
// 30 per 5 minutes per IP. Sized against the shape of the traffic, not by analogy:
// a single QR scan produces a handful of loads (scan, reload, the browser's
// prefetch), and a jobsite crew can legitimately share one cell hotspot behind a
// single NAT address — so a tighter bound would rate-limit real customers. It is
// still far below what a scraper walking the token space would need.
//
// EXPORTED as a plain object (see the bottom of this file) so the test suite reads
// the threshold instead of hardcoding it, and tuning these numbers cannot break a
// test.
const LANDING_RESOLVE_LIMIT = { windowMs: 5 * 60 * 1000, max: 30 };

const landingResolveLimiter = rateLimit({
  windowMs: LANDING_RESOLVE_LIMIT.windowMs,
  max: LANDING_RESOLVE_LIMIT.max,
  message: { error: 'Too many requests. Please wait a few minutes and try again.' }
});

// ── WARMUP ENTRIES ────────────────────────────────────────────────────────────
// Must stay in sync with src/constants/shouts.js WARMUP_ENTRIES.
// Kept server-side to avoid a runtime import of an ES module from CommonJS.
const WARMUP_ENTRIES_SERVER = [
  { id: "warmup_1",  firstName: "Nail",     lastName: "Armstrong", referralCount: 14, earnings: 11600, shout: "I nailed it." },
  { id: "warmup_2",  firstName: "Galvan",   lastName: "Ized",      referralCount: 11, earnings: 8900,  shout: "Fully charged. ⚡" },
  { id: "warmup_3",  firstName: "Paige",    lastName: "Turner",    referralCount: 9,  earnings: 7300,  shout: "On to the next chapter." },
  { id: "warmup_4",  firstName: "Flash",    lastName: "Feltman",   referralCount: 8,  earnings: 6400,  shout: "Blink and you'll miss me." },
  { id: "warmup_5",  firstName: "Roger",    lastName: "Ringshank", referralCount: 7,  earnings: 5500,  shout: "Roger that. 🫡" },
  { id: "warmup_6",  firstName: "Grant",    lastName: "Gable",     referralCount: 6,  earnings: 4600,  shout: "It's a great day to refer." },
  { id: "warmup_7",  firstName: "Victor",   lastName: "Valley",    referralCount: 5,  earnings: 3500,  shout: "Victory is the only option." },
  { id: "warmup_8",  firstName: "Pete",     lastName: "Pitch",     referralCount: 4,  earnings: 2600,  shout: "Always closing." },
  { id: "warmup_9",  firstName: "Ridgeard", lastName: "Runner",    referralCount: 3,  earnings: 1800,  shout: "Keep running those referrals." },
  { id: "warmup_10", firstName: "Tarence",  lastName: "Tack",      referralCount: 2,  earnings: 1100,  shout: "Staying sharp." },
];

// ── WHITE-LABEL FALLBACK NAME (C/DL-2 Phase 2a, narrowed in Phase 3d-1) ───────
// Replaces the module constant CONTRACTOR_NAME = 'Accent Roofing Service', which
// was the platform's last hardcoded tenant identity on a public surface (Phase 0
// finding C9).
//
// SINGLE SOURCE OF TRUTH: the RoofMiles fallback tokens (LP §5) are declared in
// server/utils/brandingTheme.js, the shared resolver the landing page and the
// admin preview both consume, so the two surfaces' fallbacks cannot be tuned
// independently. The aliased name is kept because every call site below reads it,
// and server/test/brandingTheme.test.js pins this file's exported
// ROOFMILES_DEFAULTS against that module's.
//
// ONLY THE DEFAULTS ARE NEEDED HERE AS OF PHASE 3d-1. resolveBrandingTheme itself
// was called by loadContractorBranding, which moved to utils/landingResolve.js.
// What remains are four email handlers below that fall back to the platform name
// when a contractor has no branding row.
const { BRANDING_THEME_DEFAULTS } = require('../utils/brandingTheme');
const ROOFMILES_DEFAULTS = BRANDING_THEME_DEFAULTS;

// loadContractorBranding, toChipName and loadReferrerChip MOVED to
// server/utils/landingResolve.js (C/DL-2 Phase 3d-1), along with the landing
// resolution body that used to live in the /api/invite callback below.
//
// They were module-private here, which meant the server-rendered landing page
// could not reach them and would have needed its own copy — two mismatch rules
// and two chip-privacy rules, agreeing on the day they were written and drifting
// after. loadContractorBranding is imported at the top of this file because four
// other handlers here still use it for white-labeled email.

// ── BADGE AWARD HELPER ────────────────────────────────────────────────────────
// Called after every pipeline sync. Checks pipeline_sync-triggered badges and
// inserts any newly qualifying ones. Returns array of newly awarded badge ids
// so the caller can surface the celebration popup.
async function checkAndAwardBadges(userId, totalReferralCount) {
  const existing = await pool.query(
    'SELECT badge_id FROM user_badges WHERE user_id=$1',
    [userId]
  );
  const earned = new Set(existing.rows.map(r => r.badge_id));

  const candidates = [
    { id: 'first_referral', qualifies: totalReferralCount >= 1 },
    { id: 'milestone_5',    qualifies: totalReferralCount >= 5  },
    { id: 'milestone_10',   qualifies: totalReferralCount >= 10 },
    { id: 'milestone_25',   qualifies: totalReferralCount >= 25 },
    // MVP shortcut: full trigger via Jobber webhook in Stripe ACH session
    // { id: 'client_badge', qualifies: ... },
    // MVP shortcut: full trigger via Jobber webhook in Stripe ACH session
    // { id: 'yearly_winner', qualifies: ... },
  ];

  const newlyAwarded = [];
  for (const { id, qualifies } of candidates) {
    if (qualifies && !earned.has(id)) {
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, seen)
         VALUES ($1, $2, false)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [userId, id]
      );
      newlyAwarded.push(id);
    }
  }
  return newlyAwarded;
}

// ── PUBLIC LANDING RESOLUTION ─────────────────────────────────────────────────
// The call the landing page makes to learn who it is rendering for. Also the SPA's
// invite validation call today (src/App.jsx:79-82), which is why contractorName
// stays at the TOP LEVEL of the payload alongside the full branding block — the
// SPA reads data.contractorName and Phase 3 owns the UI.
//
// TWO MOUNTS, ONE HANDLER, ONE LIMITER:
//   GET /api/invite/:slug   a token — "invite" mode
//   GET /api/invite         no token — "marketing" mode
// The second mount is what makes a bare subdomain a first-class valid page rather
// than a 404: accent.roofmiles.com with no token is contractor-marketing mode, and
// a contractor's subdomain alone is a usable marketing asset (LP §6.4).
//
// THE TOKEN IS THE TENANCY AUTHORITY; THE SUBDOMAIN IS COSMETIC ROUTING. Every
// contractor-scoped value below is read from the TOKEN ROW's contractor_id. The
// hostname's only jobs are selecting branding when there is no token at all, and
// being checked for agreement when there is one.
//
// A landing-page load against an unredeemed token is a detectable scan event
// (CD-16) — unchanged from C/DL-1, and deliberately recorded only AFTER the
// mismatch check, so a tampering attempt never writes to the roster.
//
// ── THE BODY MOVED TO server/utils/landingResolve.js (C/DL-2 Phase 3d-1) ─────
// This handler is now transport only: read the two inputs off the request, hand
// them to the shared resolver, serialise the result. The mode selection, the
// mismatch rule, chip privacy, the scan event and the payload assembly all live
// in that module because the server-rendered landing page renders from the SAME
// call. Anything re-inlined here becomes a second implementation of rules that
// must not have two — see that file's header for the drift this already caused
// once in this codebase.
//
// `req` is forwarded so a failed scan write still logs with a route and method.
router.get(['/api/invite', '/api/invite/:slug'], landingResolveLimiter, async (req, res) => {
  try {
    // req.hostname is reliable here because server/app.js sets `trust proxy 1`.
    res.json(await resolveLanding(pool, {
      host: req.hostname,
      slug: req.params.slug,
      req,
    }));
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/invite/:slug' });
    // Was `err.message` — leaked internals to the client (Security Standards).
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── SELF-SERVE SIGNUP: CREATE ACCOUNT ─────────────────────────────────────────
// One statement, two execution contexts: the pool for peer/contractor signups
// (unchanged from before C/DL-1) and a checked-out transaction client for the
// rep branch. Hoisted so the two paths can never drift apart.
const SIGNUP_USER_INSERT = `
  INSERT INTO users (full_name, email, pin, phone, invite_slug, invited_by_user_id, signup_source, email_verified, contractor_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
  RETURNING id`;

router.post('/api/signup', signupLimiter, async (req, res) => {
  const { firstName, lastName, phone, email, password, inviteSlug } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !phone || !email || !password || !inviteSlug) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  const phoneRe = /^[\d\s\-\+\(\)]{7,}$/;
  if (!phoneRe.test(phone)) return res.status(400).json({ error: 'Invalid phone number.' });
  // CD-5 / D12 — raised from 6 to the unified 8-character minimum. Signup,
  // reset-pin and team accept-invite now enforce one policy; before this phase
  // they enforced 6, "exactly 4 digits", and 8 respectively.
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  try {
    // Check invite link. resolveToken replaces the inline SELECT and adds the
    // expiry predicate — an expired token is now refused here rather than
    // silently accepted (CD-14: an expired token is never resurrected).
    const link = await resolveToken(pool, inviteSlug);
    if (!link) {
      return res.status(400).json({ error: 'Invalid or expired invite link.' });
    }

    // Check for duplicate email
    const existing = await pool.query('SELECT id FROM users WHERE contractor_id = $1 AND LOWER(email) = LOWER($2)', [link.contractor_id, email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const full_name = `${firstName.trim()} ${lastName.trim()}`;
    const hashedPassword = await bcrypt.hash(String(password), 10);

    // Attribution by link type. peer and contractor are unchanged from before
    // C/DL-1; 'rep' is new and gets its own source so C/DL-3 can tell a
    // rep-generated signup from a marketing-QR one — labelling it
    // 'contractor_link' would corrupt the data C/DL-3 reads.
    //
    // ── A19: THE ROWS THIS BRANCH CREATES ARE THE RE-ATTRIBUTION POPULATION ───
    // A signup through a `contractor` token — a marketing QR, or the bare
    // subdomain's auto-minted default (A17/A18) — is stamped
    // signup_source='contractor_link' with a NULL invited_by_user_id, because
    // that token has no personal owner to credit.
    //
    // Some of those homeowners WERE genuinely referred by a peer and simply
    // arrived through the marketing path instead of their friend's link. Today
    // they cannot be credited to that peer: nothing attaches a referrer to a user
    // row after creation, and the bonus flow reads attribution at conversion
    // time. A17 widened the marketing path, so this is the class of uncreditable
    // referrals it manufactures — named here, at the line that creates them,
    // because a note in a spec is not read by the person editing this branch.
    //
    // The attribution engine must be able to RE-ATTRIBUTE a signup after the
    // fact: set invited_by_user_id and have the bonus flow correctly from that
    // point. Danny's direction is a multi-gate catch system — signup-time
    // capture ("were you referred?"), in-app peer attribution, and CRM matching —
    // rather than one point that must be got right. NOTHING IS BUILT FOR IT HERE;
    // the query that finds these rows is
    //   WHERE signup_source = 'contractor_link' AND invited_by_user_id IS NULL.
    let signupSource = 'contractor_link';
    let invitedByUserId = null;
    if (link.link_type === 'peer') {
      signupSource = 'peer_link';
      invitedByUserId = link.created_by_user_id;
    } else if (link.link_type === 'rep') {
      signupSource = 'rep_link';
    }

    const userInsertParams = [
      full_name, email, hashedPassword, phone || null, inviteSlug,
      invitedByUserId, signupSource, link.contractor_id,
    ];

    // ── REDEMPTION IS link_type-AWARE ──────────────────────────────────────────
    // peer and contractor links are MULTI-USE: one referrer's personal link
    // serves many friend signups, one marketing QR serves many scans. Neither
    // writes anything to the token row and neither is ever deactivated —
    // attribution lands on the user row, exactly as it did before C/DL-1. Those
    // two paths run on the pool with no transaction, unchanged.
    //
    // rep links are SINGLE-USE and must redeem atomically with the user insert,
    // so that branch — and only that branch — runs in a transaction on a
    // checked-out client. It has no live caller until C/DL-3 mints rep tokens.
    let newUserId;
    if (link.link_type === 'rep') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const txUser = await client.query(SIGNUP_USER_INSERT, userInsertParams);
        newUserId = txUser.rows[0].id;

        // Zero rows means refuse — already redeemed, revoked, expired, or not a
        // rep token. The user insert above must not survive that.
        const redeemed = await redeemToken(client, inviteSlug, newUserId);
        if (!redeemed) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid or expired invite link.' });
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } else {
      const userResult = await pool.query(SIGNUP_USER_INSERT, userInsertParams);
      newUserId = userResult.rows[0].id;
    }

    // Sync new referrer into contacts table
    try {
      await pool.query(`
        INSERT INTO contacts (id, contractor_id, email, name, phone, is_app_user, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
        ON CONFLICT (contractor_id, email) DO UPDATE SET
          is_app_user = true,
          name = COALESCE(EXCLUDED.name, contacts.name),
          phone = COALESCE(EXCLUDED.phone, contacts.phone),
          updated_at = NOW()
      `, [link.contractor_id, email, full_name, phone || null]);

      // Non-blocking App User tag write — look up the contact UUID by email then apply tag
      ;(async () => {
        try {
          const contactRes = await pool.query(
            `SELECT id FROM contacts WHERE contractor_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
            [link.contractor_id, email]
          );
          if (contactRes.rows.length > 0) {
            await applyTag(pool, contactRes.rows[0].id, link.contractor_id, 'App User', 'system');
          }
        } catch (tagErr) {
          logError({ req, error: tagErr, source: 'POST /api/signup — App User tag' });
        }
      })();
    } catch (syncErr) {
      logError({ req, error: syncErr, source: 'POST /api/signup — contacts sync' });
      // Non-blocking — signup succeeds even if contacts sync fails
    }

    // Generate 6-digit verification code
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      `INSERT INTO email_verifications (user_id, code, expires_at) VALUES ($1, $2, $3)`,
      [newUserId, code, expiresAt]
    );

    // Send verification email via Resend.
    //
    // WHITE-LABELED (C/DL-2 Phase 2a). This was the second consumer of the
    // hardcoded CONTRACTOR_NAME constant, and the more damaging of the two: every
    // future contractor's homeowners would have been welcomed to a different
    // roofer's rewards program. The name comes from the same loader the landing
    // page uses, keyed by the TOKEN row's contractor — never a client field.
    //
    // TWO FORMS, and mixing them is a real bug rather than a nicety: the HTML body
    // needs escapeHtml because the name is admin-sourced text landing in markup,
    // but the SUBJECT is plain text, where escaping would turn "Smith & Sons" into
    // "Smith &amp; Sons" in the recipient's inbox.
    const signupBranding = await loadContractorBranding(pool, link.contractor_id);
    const signupCompanyName = signupBranding ? signupBranding.companyName : ROOFMILES_DEFAULTS.companyName;
    const signupCompanyNameHtml = escapeHtml(signupCompanyName);

    await retryWithBackoff(
      () => resend.emails.send({
        from: 'Rooster Booster <noreply@roofmiles.com>',
        to: email,
        subject: `Your ${signupCompanyName} rewards account — verify your email`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#012854;margin:0 0 8px;">Welcome to ${signupCompanyNameHtml}'s rewards program!</h2>
          <p style="color:#444;margin:0 0 24px;line-height:1.6;">
            You're almost in. Enter the verification code below to activate your account.
          </p>
          <div style="background:#f5f8ff;border:2px solid #D3E3F0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;letter-spacing:0.05em;text-transform:uppercase;">Your verification code</p>
            <p style="margin:0;font-size:40px;font-weight:700;color:#012854;letter-spacing:0.15em;font-family:monospace;">${code}</p>
          </div>
          <p style="color:#888;font-size:13px;margin:0;">This code expires in 1 hour. If you didn't create this account, you can ignore this email.</p>
        </div>
      `,
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
    );

    // MVP: Award founding_referrer badge if within first 20 users.
    // Counts all users (no contractor filter) to match admin.js logic.
    // At FORA scale, scope this count per contractor_id so each contractor
    // gets their own founding cohort of 20.
    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    if (parseInt(countResult.rows[0].total) <= 20) {
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, seen)
         VALUES ($1, 'founding_referrer', false)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [newUserId]
      );
    }

    // ── #20 NEW REFERRER SIGNUP ADMIN ALERT ─────────────────────────────────────
    // Non-blocking: never allowed to fail the signup response.
    (async () => {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
        const safeName = escapeHtml(full_name);
        const safeEmail = escapeHtml(email);
        const adminEmail20 = await resolveNotificationRecipient(pool, 'general');
        const suppressed20 = await isEmailSuppressed(link.contractor_id, adminEmail20, 'new_referrer_signup');
        if (!suppressed20) await sendAdminNotification(
          pool,
          'general',
          `${safeName} just joined your referral program`,
          `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <h2 style="color:#012854;margin:0 0 12px;">New referrer</h2>
              <p style="color:#444;margin:0 0 16px;line-height:1.6;">${safeName} created an account through your referral program. They're ready to start referring.</p>
              <p style="color:#444;margin:0 0 24px;"><strong>Email:</strong> ${safeEmail}</p>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${frontendUrl}?admin=true" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View in Admin</a>
              </div>
            </div>
          `
        );
      } catch (adminAlertErr) {
        await logError({ req, error: adminAlertErr, source: 'POST /api/signup — #20 admin alert' });
      }
    })();

    // BACKGROUND: Jobber client lookup by phone or email.
    // Do not await — never blocks the signup response.
    // MVP: This is a one-time lookup at signup. Full solution is a Jobber webhook that fires
    // on client creation and runs this match automatically. Build in Stripe ACH / webhook session.
    (async () => {
      try {
        await refreshTokenIfNeeded(link.contractor_id);
        const tokenRes = await pool.query('SELECT access_token FROM tokens WHERE contractor_id = $1', [link.contractor_id]);
        if (!tokenRes.rows[0]?.access_token) {
          throw new Error(`POST /api/signup — Jobber match: no access token found for contractor ${link.contractor_id}`);
        }
        const jobberToken = tokenRes.rows[0].access_token;

        const gqlResponse = await axios.post(
          'https://api.getjobber.com/api/graphql',
          // MVP: fetches only first 100 Jobber clients — no pagination. At scale, use Jobber webhook (Stripe ACH session).
          { query: `{ clients(first:100) { nodes { id phoneNumbers { number } emails { address } } } }` },
          { headers: { Authorization: `Bearer ${jobberToken}`, 'Content-Type': 'application/json', 'X-JOBBER-GRAPHQL-VERSION': '2026-02-17' } }
        );

        const clients = gqlResponse.data.data?.clients?.nodes || [];
        const cleanPhone = phone.replace(/\D/g, '');
        const match = clients.find(c =>
          c.phoneNumbers?.some(p => p.number.replace(/\D/g, '') === cleanPhone) ||
          c.emails?.some(e => e.address.toLowerCase() === email.toLowerCase())
        );

        if (match) {
          await pool.query('UPDATE users SET jobber_client_id=$1 WHERE id=$2', [match.id, newUserId]);
          await pool.query(
            `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
            [full_name, email, `Jobber client match found at signup: ${match.id}`]
          );
        } else {
          await pool.query(
            `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
            [full_name, email, 'No Jobber client match found at signup — expected for peer signups']
          );
        }
      } catch (err) {
        await logError({ req, error: err });
        console.error('Background Jobber match failed for signup:', err.message);
      }
    })();

    // BACKGROUND: Contact-side matching pass — links this new app user to any Jobber client
    // in contact_jobber_links using the contact matching standard.
    ;(async () => {
      try {
        const contactRow = await pool.query(
          `SELECT id FROM contacts WHERE contractor_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
          [link.contractor_id, email]
        );
        if (contactRow.rows[0]) {
          await runContactMatchingPass(link.contractor_id, { contactId: contactRow.rows[0].id });
        }
      } catch (matchErr) {
        await logError({ req, error: matchErr, source: 'POST /api/signup — contact matching pass' });
      }
    })();

    res.status(201).json({ message: 'Account created. Check your email for a verification code.', userId: newUserId });
  } catch (err) {
    await logError({ req, error: err });
    // Was `'Signup failed: ' + err.message` — leaked internals to the client on a
    // PUBLIC, unauthenticated endpoint (Security Standards). Same violation, same
    // public signup flow, as the verify-email handler below; fixing one door and
    // leaving the other open would have been incoherent. The real detail is in
    // error_log via logError above, which is where it belongs.
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── SELF-SERVE SIGNUP: VERIFY EMAIL ───────────────────────────────────────────
router.post('/api/signup/verify-email', verifyEmailLimiter, async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(400).json({ error: 'Missing userId or code.' });
  try {
    const result = await pool.query(
      `SELECT id FROM email_verifications
       WHERE user_id=$1 AND code=$2 AND used_at IS NULL AND expires_at > NOW()`,
      [userId, String(code)]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
    }
    const verificationId = result.rows[0].id;
    await pool.query('UPDATE email_verifications SET used_at=NOW() WHERE id=$1', [verificationId]);
    await pool.query('UPDATE users SET email_verified=true WHERE id=$1', [userId]);

    const newUserResult = await pool.query(
      'SELECT full_name, email, invited_by_user_id, contractor_id FROM users WHERE id=$1',
      [userId]
    );
    const newUser = newUserResult.rows[0];
    if (newUser) {
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
        [newUser.full_name, newUser.email, 'Email verified for new signup']
      );
    }

    // ── PEER LINK: WRITE pipeline_cache PLACEHOLDER ─────────────────────────────
    // If this user signed up via a peer invite link, immediately write an app_user
    // placeholder to pipeline_cache so the referring user's pipeline tab shows them
    // at once — before any Jobber sync cycle runs.
    // Wrapped in its own try/catch: failure here must never block or roll back the signup.
    (async () => {
      try {
        if (!newUser?.invited_by_user_id) return;

        const inviterResult = await pool.query(
          'SELECT full_name FROM users WHERE id=$1',
          [newUser.invited_by_user_id]
        );
        const inviterName = inviterResult.rows[0]?.full_name;
        if (!inviterName) return;

        const pipelineContractorId = newUser.contractor_id;

        // Guard: don't write if pipeline_cache already has a row for this client name
        // (avoids duplicates when Jobber sync already caught this user)
        const existing = await pool.query(
          `SELECT 1 FROM pipeline_cache
           WHERE contractor_id = $1
             AND LOWER(client_name) = LOWER($2)
           LIMIT 1`,
          [pipelineContractorId, newUser.full_name]
        );
        if (existing.rows.length > 0) return;

        await pool.query(
          `INSERT INTO pipeline_cache
             (contractor_id, jobber_client_id, client_name, referred_by,
              pipeline_status, pre_start_date, raw_data, last_synced_at)
           VALUES ($1, $2, $3, $4, 'app_user', false, $5, NOW())`,
          [
            pipelineContractorId,
            'app_user_' + userId,
            newUser.full_name,
            inviterName,
            JSON.stringify({ source: 'app_signup', invited_by_user_id: newUser.invited_by_user_id }),
          ]
        );
      } catch (err) {
        await logError({ req, error: err });
        console.error('[signup] pipeline_cache write failed:', err.message);
      }
    })();

    // ── PENDING REFERRAL MATCH CHECK ────────────────────────────────────────────
    // Check if this newly verified user matches any pending referral record.
    // Runs async in background — must not block the signup response.
    (async () => {
      try {
        const { matchPendingReferral } = require('../utils/pendingReferral');
        const uResult = await pool.query('SELECT email, phone FROM users WHERE id=$1', [userId]);
        const u = uResult.rows[0];
        if (u) await matchPendingReferral(userId, u.email, u.phone);
      } catch (err) {
        await logError({ req, error: err });
        console.error('[signup] pending referral match check failed:', err.message);
      }
    })();

    res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    await logError({ req, error: err });
    // Was `'Verification failed: ' + err.message` — leaked internals to the client
    // on a PUBLIC, unauthenticated endpoint (Security Standards). A non-integer
    // userId made Postgres answer "invalid input syntax for type integer: <the
    // caller's own probe>", which handed out the column's type and echoed the
    // probe back; vary it and this was a free schema-enumeration oracle.
    //
    // Only the CATCH is generic. The 400 above it — "Invalid or expired code.
    // Request a new one." — is deliberately untouched: it is actionable, carries
    // no internals, and is the message a homeowner who mistyped a digit needs.
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── SELF-SERVE SIGNUP: RESEND VERIFICATION CODE ───────────────────────────────
// Re-mints the 6-digit code and mails it. Until now EmailVerifyScreen.jsx's Resend
// button called nothing — it set a 60-second cooldown and told the homeowner the
// code had been resent. A homeowner whose code never arrived was told it was sent
// again and waited for an email that did not exist.
//
// KEYED ON email + contractorId, NOT userId, and that is a security decision rather
// than a style one. The verify endpoint above takes userId, so reusing it here would
// have been the shorter change — but users.id is a sequential integer, which makes a
// userId-keyed resend a mailbomb primitive: POST 1, 2, 3 … and every account in the
// table receives mail. Keyed on an address the caller must already know, this
// endpoint hands out nothing it was not given. contractorId scopes the lookup, which
// is required and not optional: users is UNIQUE(contractor_id, email), so the same
// homeowner address can hold an account under two contractors.
//
// NON-DISCLOSURE, matching /api/forgot-pin below: ONE genericResponse for every
// outcome — found, unknown, already verified, missing parameter, and swallowed DB or
// mail error alike. Anything that varies by outcome turns this into an
// account-enumeration oracle. Mail failures are swallowed for the same reason.
//
// ONE LIVE CODE AT A TIME. Every prior unused code is retired in the same
// transaction that issues the new one. A 6-digit code is one-in-a-million per guess;
// leaving the old one live on every press of a button the user can press repeatedly
// turns that into an unbounded pile of simultaneously-valid codes.
router.post('/api/signup/resend-code', resendCodeLimiter, async (req, res) => {
  const { email, contractorId } = req.body;
  const genericResponse = { message: "If that account still needs verifying, a new code is on its way." };
  // Fail closed to the same generic response — never reveal the missing-param distinction.
  if (!email || !contractorId) return res.json(genericResponse);

  try {
    // email_verified = false is part of the predicate, not a later branch: a verified
    // account has nothing to verify, and issuing it a code would make this a free
    // mailer aimed at any address that has ever completed signup.
    const userResult = await pool.query(
      `SELECT id, email, contractor_id FROM users
        WHERE contractor_id = $1 AND LOWER(email) = LOWER($2) AND email_verified = false`,
      [contractorId, email]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const code = String(crypto.randomInt(100000, 1000000));
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour, matching signup

      // ONE TRANSACTION. Retiring the old codes and issuing the new one must not be
      // separable: a crash between them either leaves the user with no way in
      // (retired, nothing issued) or defeats the one-code rule (issued, nothing
      // retired). Both halves commit or neither does.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE email_verifications SET used_at = NOW()
            WHERE user_id = $1 AND used_at IS NULL`,
          [user.id]
        );
        await client.query(
          `INSERT INTO email_verifications (user_id, code, expires_at) VALUES ($1, $2, $3)`,
          [user.id, code, expiresAt]
        );
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      // WHITE-LABELED, through the same loader and the same two forms as the signup
      // send above: escaped for the HTML body, raw for the plain-text subject. This
      // is a second copy of the verification email, and every hardcoded-name bug
      // Phase 2a removed from the first one is one copy-paste away from reappearing
      // here — a homeowner who dealt with a roofer and receives mail from a platform
      // they have never heard of reads it as phishing and deletes it.
      try {
        const branding = await loadContractorBranding(pool, user.contractor_id);
        const companyName = branding ? branding.companyName : ROOFMILES_DEFAULTS.companyName;
        const companyNameHtml = escapeHtml(companyName);

        await retryWithBackoff(
          () => resend.emails.send({
            from: 'Rooster Booster <noreply@roofmiles.com>',
            to: user.email,
            subject: `Your ${companyName} rewards account — verify your email`,
            html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#012854;margin:0 0 8px;">Here's your new code for ${companyNameHtml}'s rewards program</h2>
          <p style="color:#444;margin:0 0 24px;line-height:1.6;">
            Enter the verification code below to activate your account. Any earlier code you were sent no longer works.
          </p>
          <div style="background:#f5f8ff;border:2px solid #D3E3F0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;letter-spacing:0.05em;text-transform:uppercase;">Your verification code</p>
            <p style="margin:0;font-size:40px;font-weight:700;color:#012854;letter-spacing:0.15em;font-family:monospace;">${code}</p>
          </div>
          <p style="color:#888;font-size:13px;margin:0;">This code expires in 1 hour. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
          }),
          { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
        );
      } catch (emailErr) {
        await logError({ req, error: emailErr, source: 'POST /api/signup/resend-code — send' });
        // swallow — do not reveal whether the account exists
      }
    }

    res.json(genericResponse);
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/signup/resend-code' });
    res.json(genericResponse); // always generic, even on DB error
  }
});

// ── REFERRER: PIPELINE ────────────────────────────────────────────────────────
router.get('/api/pipeline', pipelineLimiter, async (req, res) => {
  let referrerName;
  let userId;
  let contractorId;
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    userId = session.userId;
    const userNameResult = await pool.query('SELECT full_name FROM users WHERE id=$1', [userId]);
    if (!userNameResult.rows[0]?.full_name) return res.status(404).json({ error: 'User not found' });
    referrerName = userNameResult.rows[0].full_name;
    // MVP: single contractor — resolved via session.contractorId (tenant rebuild S2).
    contractorId = session.contractorId;
    const adapter = await getCRMAdapter(contractorId);
    const data = await adapter.fetchPipelineForReferrer(referrerName);
    // MVP: update this to cron-based sync at scale
    await pool.query(
      'UPDATE users SET paid_count=$1, paid_count_updated_at=NOW() WHERE id=$2',
      [data.paidCount, userId]
    );

    // BUSINESS RULE: one conversion per referred client, ever. A returning client does not
    // generate a second bonus for the original referrer. The UNIQUE constraint on
    // (user_id, jobber_client_id) enforces this automatically — duplicate inserts are silently ignored.
    //
    // SCALABLE: currently conversions are recorded when a referrer loads their pipeline.
    // The production-grade version is a Jobber webhook that fires the moment an invoice
    // is marked paid in Jobber — writes the conversion row, triggers Stripe ACH payout,
    // updates balance, and fires a push notification immediately. Build this during the
    // Stripe ACH session. Until then Danny should periodically view referrers in the admin
    // panel near period end dates to ensure all syncs are current before prize decisions are made.
    for (const item of data.pipeline) {
      // Hard gate: pre-start-date referrals never earn bonuses, regardless of pipeline_status.
      // This is enforced at sync time (pre_start_date=true in pipeline_cache) and here as a
      // double-check before writing to referral_conversions.
      if (item.pre_start_date) {
        console.log(`[pipeline] Skipping pre-start-date referral: ${item.name} (contractor: ${contractorId || 'unknown'})`);
        continue;
      }
      if (!item.bonusEarned) continue;
      // bonus_amount stored at sync time — source of truth for all period-filtered earnings queries.
      // Full real-time accuracy requires Jobber webhook (Stripe ACH session).
      await pool.query(
        `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
         VALUES ($1, $2, $3, NOW(), $4)
         ON CONFLICT (user_id, jobber_client_id) DO NOTHING`,
        [userId, contractorId, item.id, item.payout]
      );
    }

    await checkAndAwardBadges(userId, data.pipeline.length);

    // Fetch pending booking requests submitted by this referrer's peer-referred users
    // and append them as booking_pending pipeline items.
    try {
      const brResult = await pool.query(
        `SELECT br.id, br.referred_name, br.notes, br.created_at,
                u.full_name AS submitter_name
         FROM booking_requests br
         JOIN users u ON u.id = br.submitted_by_user_id
         WHERE br.submitted_by_user_id IN (
           SELECT id FROM users WHERE invited_by_user_id = $1
         )
         AND br.status = 'pending'
         AND br.contractor_id = $2`,
        // Only surfaces for peer-referred users (invited_by_user_id IS NOT NULL).
        // Users who joined via contractor invite link have no referrer attribution
        // and their booking requests do not appear in any pipeline.
        // This is intentional — contractor-link users are already known to the contractor.
        [userId, contractorId]
      );
      const existingNames = new Set(data.pipeline.map(p => p.name.toLowerCase()));
      const bookingItems = brResult.rows
        .filter(row =>
          !existingNames.has(row.submitter_name.toLowerCase()) &&
          !existingNames.has(row.referred_name.toLowerCase())
        )
        .map(row => ({
          id: 'booking_' + row.id,
          name: row.referred_name,
          status: 'booking_pending',
          bonusEarned: false,
          payout: null,
          pre_start_date: false,
          source: 'booking_request',
          booking_submitted_at: row.created_at,
          notes: row.notes || null,
        }));
      data.pipeline = [...data.pipeline, ...bookingItems];
    } catch (brErr) {
      await logError({ req, error: brErr });
      // booking_requests failure must never break the pipeline response
    }

    res.json(data);
  } catch (err) {
    await logError({ req, error: err });
    if (err.message && (err.message.includes('No CRM connected') || err.message.includes('No connected CRM'))) {
      return res.status(503).json({ error: 'crm_not_connected', message: 'No CRM is connected for this contractor. Please connect a CRM in admin settings.' });
    }
    console.error('CRM fetch error:', err);

    // Stale cache fallback — serve last known pipeline data when the adapter throws
    if (referrerName) {
      try {
        const cacheResult = await pool.query(
          `SELECT jobber_client_id, client_name, pipeline_status, pre_start_date, last_synced_at
           FROM pipeline_cache
           WHERE contractor_id = $1 AND LOWER(referred_by) = LOWER($2)
           ORDER BY jobber_created_at ASC NULLS LAST`,
          [contractorId, referrerName]
        );

        if (cacheResult.rows.length > 0) {
          // Fetch confirmed conversion amounts for stale-cache display
          const staleCacheConvMap = {};
          try {
            const staleCacheConvResult = await pool.query(
              `SELECT jobber_client_id, bonus_amount FROM referral_conversions WHERE user_id = $1 AND contractor_id = $2`,
              [userId, contractorId]
            );
            for (const scRow of staleCacheConvResult.rows) {
              staleCacheConvMap[scRow.jobber_client_id] = parseInt(scRow.bonus_amount);
            }
          } catch (staleCacheConvErr) {
            await logError({ req, error: staleCacheConvErr });
          }

          const boostSchedule = [0, 100, 200, 250, 300, 350, 400];
          let paidCount = 0;
          let totalBalance = 0;
          const pipeline = cacheResult.rows.map(row => {
            const isPreStart = row.pre_start_date;
            let status;
            if (row.pipeline_status === 'paid') status = 'complete';
            else if (row.pipeline_status === 'not_sold') status = 'closed';
            else status = row.pipeline_status;
            const bonusEarned = row.pipeline_status === 'paid' && !isPreStart;
            const conversionBonus = bonusEarned ? (staleCacheConvMap[row.jobber_client_id] ?? null) : null;
            let payout = null;
            if (bonusEarned) {
              const boost = boostSchedule[Math.min(paidCount, boostSchedule.length - 1)];
              payout = 500 + boost;
              totalBalance += conversionBonus ?? payout;
              paidCount++;
            }
            return { id: row.jobber_client_id, name: row.client_name || 'Unknown', status, bonusEarned, payout, conversion_bonus: conversionBonus, pre_start_date: isPreStart };
          });
          const maxSyncedAt = cacheResult.rows.reduce(
            (max, row) => (row.last_synced_at && (!max || row.last_synced_at > max) ? row.last_synced_at : max),
            null
          );
          console.warn(`[pipeline] Serving stale cache for ${referrerName} after adapter error`);

          // Append booking_pending items even in stale mode — these come from our DB, not Jobber.
          if (userId) {
            try {
              const brResult = await pool.query(
                `SELECT br.id, br.referred_name, br.notes, br.created_at,
                        u.full_name AS submitter_name
                 FROM booking_requests br
                 JOIN users u ON u.id = br.submitted_by_user_id
                 WHERE br.submitted_by_user_id IN (
                   SELECT id FROM users WHERE invited_by_user_id = $1
                 )
                 AND br.status = 'pending'
                 AND br.contractor_id = $2`,
                [userId, contractorId]
              );
              const existingNames = new Set(pipeline.map(p => p.name.toLowerCase()));
              const bookingItems = brResult.rows
                .filter(row =>
                  !existingNames.has(row.submitter_name.toLowerCase()) &&
                  !existingNames.has(row.referred_name.toLowerCase())
                )
                .map(row => ({
                  id: 'booking_' + row.id,
                  name: row.referred_name,
                  status: 'booking_pending',
                  bonusEarned: false,
                  payout: null,
                  pre_start_date: false,
                  source: 'booking_request',
                  booking_submitted_at: row.created_at,
                  notes: row.notes || null,
                }));
              pipeline.push(...bookingItems);
            } catch (brErr) {
              await logError({ req, error: brErr });
              // booking_requests failure must never block the stale cache response
            }
          }

          return res.json({ pipeline, balance: totalBalance, paidCount, stale: true, stale_since: maxSyncedAt });
        }
      } catch (cacheErr) {
        await logError({ req, error: cacheErr, source: 'GET /api/pipeline' });
        console.error('[pipeline] Stale cache fallback also failed:', cacheErr.message);
      }
    }

    res.status(503).json({ error: 'pipeline_unavailable', message: 'Pipeline data is temporarily unavailable.' });
  }
});

// ── UNIFIED LOGIN (C/DL-3b Phase 2B — D1 / D2) ────────────────────────────────
//
// VERIFY, THEN DISAMBIGUATE. The old handler identified the account and THEN
// checked the password: narrow `users` by a client-supplied contractorSlug, take
// rows[0], compare. D1 inverts that order, and the inversion is the whole point.
//
// The form collects { email, password } and has no tenant information at all.
// The host cannot supply it either — the React app lives on app.roofmiles.com and
// `app` is a reserved slug, so host resolution correctly returns null there.
// Asking "which company?" BEFORE the password would show an unauthenticated
// stranger which contractors an address is registered with, which is a real
// privacy leak. Asking AFTER the password is proven leaks nothing: the person has
// already demonstrated they hold the credential for every option displayed.
//
// TENANCY COMES FROM THE AUTHENTICATED ROW, never from the request. This is
// already how session ISSUANCE works; D1 extends the same principle to LOOKUP.
//
// This also retires Tenant Rebuild §3.5's contractorSlug narrowing exception —
// not by relaxing it, but by making it unnecessary. See server/test/
// tenantIsolation.test.js for the mechanism shift spelled out against the
// arbitrary-row bug the old guard existed to prevent.
const LOGIN_CANDIDATE_CAP = 5;
const CHOICE_TOKEN_TTL_MINUTES = 2;
const INVALID_CREDENTIALS = 'Invalid email or PIN';

// Gathers every identity the address could belong to: the team_members row
// (globally unique) plus every users row across ALL contractors.
//
// TEAM_MEMBERS IS ORDERED FIRST AND THAT IS LOAD-BEARING, not incidental. The cap
// truncates the combined list, so putting the at-most-one employee row first is
// what stops an employee whose address also holds many homeowner accounts from
// being unable to reach the side they actually work in.
//
// THE CAP EXISTS BECAUSE bcrypt IS EXPENSIVE. Without it, N compares per request
// is a cheap denial of service: register one address with many contractors and
// every login attempt against it costs N hashes. Five is the ceiling per D1.
//
// ⚠ `active = true` IS DELIBERATELY ABSENT FROM THE team_members LOOKUP, AND
// PUTTING IT BACK IS A BUG (C/DL-3b Phase 3, D3). A deactivated member must be
// GATHERED and COMPARED like anyone else; whether their account is frozen is
// decided in the handler, after their password has actually opened the hash.
//
// Filtering here is what produced the old misleading 401 — a deactivated person
// with the CORRECT password was told their credentials were invalid and retried
// until the rate limiter locked them out. Filtering AFTER the compare is what
// keeps the honest answer from becoming an account enumerator: nothing different
// is said until the credential is proven. server/test/frozenAccount.test.js
// fences both halves.
async function gatherLoginCandidates(email) {
  const teamResult = await pool.query(
    `SELECT id, contractor_id, password_hash, tier, permissions, active
       FROM team_members
      WHERE LOWER(email) = LOWER($1)
      ORDER BY id
      LIMIT $2`,
    [email, LOGIN_CANDIDATE_CAP]
  );
  const userResult = await pool.query(
    `SELECT id, contractor_id, full_name, email, phone, pin
       FROM users
      WHERE LOWER(email) = LOWER($1)
      ORDER BY contractor_id, id
      LIMIT $2`,
    [email, LOGIN_CANDIDATE_CAP]
  );
  const candidates = [
    ...teamResult.rows.map(row => ({
      source: 'team_members', id: row.id, contractorId: row.contractor_id, hash: row.password_hash,
      active: row.active, row,
    })),
    // A users row has NO active column and cannot be frozen — deactivation is a
    // team-membership concept. `true` is the honest constant, not a placeholder:
    // it keeps one candidate shape so the handler's partition never has to ask
    // which table a candidate came from.
    ...userResult.rows.map(row => ({
      source: 'users', id: row.id, contractorId: row.contractor_id, hash: row.pin,
      active: true, row,
    })),
  ];
  return candidates.slice(0, LOGIN_CANDIDATE_CAP);
}

// Compares one candidate and returns it on a match, or null.
//
// The try/catch is not decoration. A malformed or legacy hash makes bcrypt throw,
// and an uncaught throw here would 500 the endpoint — worse, it would take login
// down for every OTHER candidate sharing that address, so one bad row could lock
// out an unrelated person at a different contractor. A hash that cannot be parsed
// simply does not match. It is logged because it is a real data problem.
async function compareCandidate(req, secret, candidate) {
  try {
    return (await bcrypt.compare(secret, candidate.hash)) ? candidate : null;
  } catch (compareErr) {
    await logError({ req, error: compareErr, source: 'POST /api/login (candidate compare)' });
    return null;
  }
}

// Resolves display names for the choice screen. COALESCE mirrors the three-rung
// chain the branding loader uses: the white-label company name, then the
// contractor's own name, then the platform default.
async function loadContractorDisplayNames(contractorIds) {
  if (!contractorIds.length) return new Map();
  const { rows } = await pool.query(
    `SELECT c.id, COALESCE(NULLIF(cs.company_name, ''), c.name) AS display_name
       FROM contractors c
       LEFT JOIN contractor_settings cs ON cs.contractor_id = c.id
      WHERE c.id = ANY($1::text[])`,
    [contractorIds]
  );
  return new Map(rows.map(r => [r.id, r.display_name]));
}

// Re-reads one identity by primary key. Used by choice redemption rather than
// trusting the blob stored two minutes earlier, so a row that was deleted or
// deactivated inside the choice window can no longer mint a session.
//
// ⚠ THE active PREDICATE MOVED OUT OF THIS QUERY TOO (D3), for the same reason it
// left the gather. A deactivation landing inside the two-minute choice window used
// to come back as a generic 401 — the same misleading answer, reached by a longer
// route. It is now REPORTED rather than filtered: the caller reads `active` and
// answers 403 account_frozen.
//
// THE GUARANTEE IS UNCHANGED — a frozen row still mints NOTHING. A row that is
// GONE still returns null and still gets the generic 401, and that distinction is
// deliberate: a deleted identity is indistinguishable from a forged token and must
// stay in the generic bucket.
async function loadCandidateById(source, id) {
  if (source === 'team_members') {
    const { rows } = await pool.query(
      `SELECT id, contractor_id, password_hash, tier, permissions, active
         FROM team_members WHERE id = $1`,
      [id]
    );
    return rows.length
      ? {
        source, id: rows[0].id, contractorId: rows[0].contractor_id,
        hash: rows[0].password_hash, active: rows[0].active, row: rows[0],
      }
      : null;
  }
  if (source === 'users') {
    const { rows } = await pool.query(
      `SELECT id, contractor_id, full_name, email, phone, pin FROM users WHERE id = $1`,
      [id]
    );
    return rows.length
      ? {
        source, id: rows[0].id, contractorId: rows[0].contractor_id,
        hash: rows[0].pin, active: true, row: rows[0],
      }
      : null;
  }
  return null;
}

// Mints the session for ONE authenticated identity and builds its response body.
// Reached only after the credential is proven, from exactly two call sites: the
// single-match branch of /api/login and choice redemption.
//
// The session ROLE stays 'referrer' or 'admin' — the two values that already
// exist. A field rep is a team member and gets 'admin', exactly as
// POST /api/admin/login has always minted, so no session query anywhere needs to
// learn a new value. The response carries `role` for the CLIENT to route on;
// which surface a team member lands on is Phase 5's decision, not the session's.
async function issueSessionFor(req, candidate) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const deviceInfo = req.headers['user-agent'] || null;
  const ipAddress = req.ip || null;

  if (candidate.source === 'team_members') {
    const member = candidate.row;
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, device_info, ip_address, role, contractor_id, team_member_id)
       VALUES (NULL,$1,$2,$3,$4,$5,$6,$7)`,
      [token, expiresAt, deviceInfo, ipAddress, 'admin', member.contractor_id, member.id]
    );
    // Stamp last_login_at. Failure is logged but must never block the response —
    // the session already exists and is valid. Parity with POST /api/admin/login.
    try {
      await pool.query('UPDATE team_members SET last_login_at = NOW() WHERE id = $1', [member.id]);
    } catch (stampErr) {
      await logError({ req, error: stampErr, source: 'POST /api/login (last_login_at stamp)' });
    }
    return {
      success: true,
      token,
      role: 'team',
      tier: member.tier,
      permissions: member.permissions || {},
    };
  }

  const user = candidate.row;
  const sessionResult = await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at, device_info, ip_address, role, contractor_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [user.id, token, expiresAt, deviceInfo, ipAddress, 'referrer', user.contractor_id]
  );
  const sessionId = sessionResult.rows[0].id;
  return await finishReferrerLogin(req, user, token, sessionId, ipAddress);
}

// The referrer success payload, unchanged from the pre-2B handler: geo lookup,
// activity log, login-count bump, review card, announcement and its settings.
// Extracted only so the single-match branch and choice redemption cannot drift.
async function finishReferrerLogin(req, user, token, sessionId, ipAddress) {
    // Async geo-lookup — do not await, never blocks login response
    if (ipAddress) {
      (async () => {
        try {
          const geoRes = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=city,country`, { timeout: 3000 });
          if (geoRes.data && geoRes.data.city) {
            await pool.query(
              'UPDATE sessions SET city=$1, country=$2 WHERE id=$3',
              [geoRes.data.city || null, geoRes.data.country || null, sessionId]
            );
          }
        } catch (_) {
          await logError({ req, error: _ });
          /* non-critical */
        }
      })();
    }
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('login',$1,$2,$3)`,
      [user.full_name, user.email, 'Logged in']
    );

    // Increment login_count and read back updated values in one round-trip
    const updatedUser = await pool.query(
      'UPDATE users SET login_count = login_count + 1 WHERE id = $1 RETURNING login_count, review_dismissed_login',
      [user.id]
    );
    const { login_count, review_dismissed_login } = updatedUser.rows[0];

    // showReviewCard: true if never dismissed OR 5+ logins since dismissal
    const showReviewCard = review_dismissed_login === null || (login_count - review_dismissed_login) >= 5;

    // Check for unseen payout announcement
    const announcementResult = await pool.query(
      `SELECT pa.id, cr.amount, cr.full_name as referred_name
       FROM payout_announcements pa
       JOIN cashout_requests cr ON cr.id = pa.cashout_request_id
       WHERE pa.user_id = $1 AND pa.seen_at IS NULL
       LIMIT 1`,
      [user.id]
    );
    const announcement = announcementResult.rows.length > 0
      ? { id: announcementResult.rows[0].id, amount: announcementResult.rows[0].amount, referredName: announcementResult.rows[0].referred_name }
      : null;

    // Fetch announcement settings for popup rendering
    const settingsResult = await pool.query(
      'SELECT enabled, mode, custom_message FROM announcement_settings WHERE contractor_id = $1',
      [user.contractor_id]
    );
    const announcementSettings = settingsResult.rows[0] || { enabled: true, mode: 'preset_1', custom_message: null };

  return {
    success: true,
    role: 'referrer',
    fullName: user.full_name,
    email: user.email,
    phone: user.phone || null,
    token,
    showReviewCard,
    announcement,
    announcementSettings,
  };
}

// ── POST /api/login ───────────────────────────────────────────────────────────
//
// ⚠ THERE IS DELIBERATELY NO isEmail() VALIDATOR ON THIS ROUTE, and it must not
// acquire one as "obvious hardening". Two reasons:
//
//   1. It would buy nothing. A malformed address matches no candidate and gets
//      the same generic 401 an unknown address gets. Rejecting it at a validator
//      instead creates a SECOND, distinguishable rejection shape (422 with a
//      field error) on an endpoint whose entire anti-enumeration posture depends
//      on every failure looking identical.
//   2. server/test/loginErrorDisclosure.test.js DEPENDS ON ITS ABSENCE. That test
//      drives a NUL byte through `email` to provoke a 22021 inside the try block
//      and prove the catch leaks no internals. A validator would answer first,
//      the probe would never reach the handler, and the test would silently stop
//      testing anything — its non-vacuity gate is what would catch that.
router.post('/api/login', referrerLoginLimiter, async (req, res) => {
  // The wire field stays `pin` for the currently deployed LoginScreen, and
  // `password` is accepted alongside it so Phase 5's rewritten screen can send
  // the honest name without a flag-day deploy. D12: users.pin keeps its COLUMN
  // name too — this is a label change, never a migration.
  const { email } = req.body;
  const secret = req.body.password !== undefined ? req.body.password : req.body.pin;

  try {
    // Coerced rather than guarded. A missing email falls through to a lookup that
    // matches nothing, then to the dummy compare, then to the same 401 — so an
    // absent field is not a distinguishable early return either.
    const candidates = await gatherLoginCandidates(email == null ? '' : String(email));
    const secretString = secret == null ? '' : String(secret);

    if (candidates.length === 0) {
      // TIMING PARITY (D1, binding). Always run at least one compare, so the
      // response time on a miss does not reveal that the address is unknown.
      await compareCandidate(req, secretString, { source: 'dummy', hash: DUMMY_BCRYPT_HASH });
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    // EVERY candidate is compared — no early exit on the first match. Exiting
    // early would make the response time depend on the matching row's POSITION,
    // and it is also what makes the count meaningful: the branch below is on how
    // many matched, never on which came first. rows[0] is never consulted.
    //
    // ⚠ THIS LOOP IS GUARD-PROOFED, AND THE SHAPE OF THE FAILURE IS THE POINT.
    // Replacing it with `candidates.slice(0, 1)` does NOT error. It collapses the
    // multi-match branch into a SILENT SINGLE MATCH on the first row — which is
    // the historical arbitrary-row bug (a global email lookup, tenancy taken from
    // whichever row ordering happened to surface) restaged inside the new
    // architecture. Nothing would throw; a person would simply be logged into the
    // wrong tenant. server/test/unifiedLogin.test.js's compare-count assertion is
    // what catches it, because a response-shape assertion never would.
    const results = await Promise.all(
      candidates.map(candidate => compareCandidate(req, secretString, candidate))
    );
    const matched = results.filter(Boolean);

    if (matched.length === 0) return res.status(401).json({ error: INVALID_CREDENTIALS });

    // ── THE FROZEN BRANCH (D3), AND ITS POSITION IS THE DESIGN ───────────────
    // Everything above this line is identical for a frozen account and a live
    // one, which is what stops the 403 below from enumerating addresses: it is
    // unreachable without a hash that actually opened.
    //
    // PARTITION RATHER THAN FILTER. A frozen identity is not a destination, so it
    // never reaches issueSessionFor and never appears on the choice screen — a
    // choice list is "where you can go", and an option that always fails is worse
    // than one that is absent. But it must not simply vanish either: when it is
    // the ONLY thing the credential opened, it is exactly the person D3 exists to
    // answer, and dropping it would restore the misleading 401 through the back
    // door.
    //
    // In practice `frozen` holds at most one row — team_members.email is globally
    // unique and a users row cannot be deactivated — but nothing here depends on
    // that, so a future per-tenant employee table does not quietly break it.
    const live = matched.filter(candidate => candidate.active);
    const frozen = matched.filter(candidate => !candidate.active);

    if (live.length === 0) {
      // MINTS NOTHING (D3, binding). No session, no choice token, no
      // half-privileged state — the screen this feeds needs no authenticated
      // data. Tenancy for the branding comes from the AUTHENTICATED ROW.
      return res.status(403).json(await buildFrozenAccountBody(pool, frozen[0].contractorId));
    }

    if (live.length === 1) return res.json(await issueSessionFor(req, live[0]));

    // ── MORE THAN ONE MATCH → A CHOICE, NOT A SESSION (D2) ──────────────────
    // The server cannot mint here: it has proven the credential but does not know
    // which identity the person means. It must also not ask for the password
    // again. So it stores the matched set server-side and hands back an opaque
    // token plus a display list carrying contractor name and role ONLY.
    //
    // BUILT FROM `live`, NOT `matched` — a frozen identity is not offered (D3).
    const choiceToken = crypto.randomBytes(32).toString('hex');
    const stored = live.map((candidate, index) => ({
      selection: index, source: candidate.source, id: candidate.id, contractor_id: candidate.contractorId,
    }));
    await pool.query(
      `INSERT INTO login_choice_tokens (token, candidates, expires_at)
       VALUES ($1, $2::jsonb, NOW() + ($3 || ' minutes')::interval)`,
      [choiceToken, JSON.stringify(stored), String(CHOICE_TOKEN_TTL_MINUTES)]
    );

    const displayNames = await loadContractorDisplayNames(live.map(c => c.contractorId));
    return res.json({
      choice_required: true,
      choice_token: choiceToken,
      identities: live.map((candidate, index) => ({
        selection: index,
        contractor_name: displayNames.get(candidate.contractorId) || ROOFMILES_DEFAULTS.companyName,
        role: candidate.source === 'team_members' ? 'team' : 'referrer',
      })),
    });
  } catch (err) {
    await logError({ req, error: err });
    // Was `'Login failed: ' + err.message` — leaked internals to the client on a
    // PUBLIC, unauthenticated endpoint (Security Standards). The third instance
    // of the identical violation on this router: Phase 3a fixed /api/signup and
    // /api/signup/verify-email and this one sat untouched between them, which is
    // worse than never having swept at all — a caller probing for internal detail
    // simply uses whichever door still answers.
    //
    // Only the CATCH is generic. The 401s above are deliberately untouched: they
    // are actionable, carry no internals, and are identical for a wrong password
    // and an unknown address, so they stay non-enumerating.
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/login/choice — REDEEM A CHOICE TOKEN (D2) ───────────────────────
//
// Takes { choice_token, selection } and NEVER the password again: the credential
// was already proven when the token was issued, and asking for it a second time
// would mean holding it in the client across two requests for no gain.
//
// Shares referrerLoginLimiter with /api/login — the two halves are one login
// attempt and belong to one budget.
router.post('/api/login/choice', referrerLoginLimiter, async (req, res) => {
  const { choice_token: choiceToken, selection } = req.body;
  try {
    // Shape-checked before touching the database so a malformed value costs a
    // regex rather than a query, and answers with the same generic 401 as a
    // forgery — this endpoint distinguishes nothing either.
    if (typeof choiceToken !== 'string' || !/^[0-9a-f]{64}$/.test(choiceToken)) {
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    // ⚠ THE BURN IS THE SELECT. One atomic UPDATE ... RETURNING is what makes the
    // token single-use: two concurrent redemptions race inside Postgres and
    // exactly one sees a row. A read-then-write pair would let both through.
    // Expiry and prior consumption are checked in the same predicate, so a
    // replayed, expired, or forged token are indistinguishable — all three come
    // back as zero rows and get the same answer.
    const { rows } = await pool.query(
      `UPDATE login_choice_tokens SET consumed_at = NOW()
        WHERE token = $1 AND consumed_at IS NULL AND expires_at > NOW()
        RETURNING candidates`,
      [choiceToken]
    );
    if (rows.length === 0) return res.status(401).json({ error: INVALID_CREDENTIALS });

    // An out-of-range selection burns the token rather than allowing a retry.
    // Deliberate: the token is a bearer credential with a 2-minute life, and
    // letting a caller probe selections against a live one is worth more to an
    // attacker than a retry is worth to a client that sent the wrong index.
    const stored = rows[0].candidates;
    const chosen = Array.isArray(stored)
      ? stored.find(entry => entry.selection === selection)
      : null;
    if (!chosen) return res.status(401).json({ error: INVALID_CREDENTIALS });

    // Re-read rather than trusting the two-minute-old blob, so a row deleted or
    // deactivated inside the choice window cannot still mint a session.
    const candidate = await loadCandidateById(chosen.source, chosen.id);
    if (!candidate) return res.status(401).json({ error: INVALID_CREDENTIALS });

    // A DEACTIVATION LANDING INSIDE THE WINDOW GETS THE HONEST ANSWER (D3). This
    // person's credential was proven two minutes ago — the choice token IS that
    // proof — so the same reasoning that makes the 403 safe on /api/login makes it
    // safe here. Still mints nothing.
    if (!candidate.active) {
      return res.status(403).json(await buildFrozenAccountBody(pool, candidate.contractorId));
    }

    return res.json(await issueSessionFor(req, candidate));
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/login/choice' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── REFERRER: ENABLED PAYOUT METHODS ──────────────────────────────────────────
router.get('/api/referrer/enabled-payout-methods', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const contractorId = session.contractorId;
    const result = await pool.query(
      `SELECT enabled_payout_methods FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
      [contractorId]
    );
    if (result.rows.length === 0) {
      return res.json({ enabled_payout_methods: ['stripe_ach', 'check', 'venmo', 'zelle'] });
    }
    const { enabled_payout_methods } = result.rows[0];
    res.json({ enabled_payout_methods: enabled_payout_methods || ['stripe_ach', 'check', 'venmo', 'zelle'] });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: CASH OUT ────────────────────────────────────────────────────────
router.post('/api/cashout', cashoutLimiter, [
  body('amount').isNumeric().withMessage('Amount must be a number')
    .custom(val => parseFloat(val) > 0).withMessage('Amount must be greater than 0')
    .custom(val => parseFloat(val) < 10000).withMessage('Amount must be less than 10000'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  const session = await verifyReferrerSession(req, res);
  if (!session) return;
  const { amount, method, payout_method, referral_conversion_id } = req.body;
  if (parseFloat(amount) < 20) {
    return res.status(400).json({ error: 'Minimum cashout amount is $20' });
  }
  const VALID_PAYOUT_METHODS = ['stripe_ach', 'check', 'venmo', 'zelle'];
  if (!payout_method || !VALID_PAYOUT_METHODS.includes(payout_method)) {
    return res.status(400).json({ error: 'payout_method must be one of: stripe_ach, check, venmo, zelle' });
  }
  if (referral_conversion_id != null && !Number.isInteger(Number(referral_conversion_id))) {
    return res.status(400).json({ error: 'referral_conversion_id must be an integer' });
  }
  try {
    const userId = session.userId;
    const contractorId = session.contractorId;
    const userResult = await pool.query('SELECT full_name, email FROM users WHERE id=$1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const { full_name, email } = userResult.rows[0];
    const [earnedResult, pendingResult] = await Promise.all([
      pool.query('SELECT COALESCE(SUM(bonus_amount), 0) AS earned FROM referral_conversions WHERE user_id = $1', [userId]),
      pool.query("SELECT COALESCE(SUM(amount), 0) AS pending FROM cashout_requests WHERE user_id = $1 AND status IN ('pending', 'approved')", [userId]),
    ]);
    const available = parseFloat(earnedResult.rows[0].earned) - parseFloat(pendingResult.rows[0].pending);
    if (parseFloat(amount) > available) {
      return res.status(400).json({ error: 'Requested amount exceeds your available balance' });
    }
    const cashoutInsert = await pool.query(
      `INSERT INTO cashout_requests (user_id,full_name,email,amount,method,payout_method,referral_conversion_id,contractor_id,status,requested_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW()) RETURNING id`,
      [userId, full_name, email, amount, method || null, payout_method, referral_conversion_id != null ? parseInt(referral_conversion_id, 10) : null, contractorId]
    );
    const newCashoutId = cashoutInsert.rows[0].id;
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('cashout',$1,$2,$3)`,
      [full_name, email, `Requested $${amount} via ${method || 'unknown'}`]
    );
    await _sendAdminNotificationFn(
      pool,
      'payouts',
      'New Cash Out Request - Rooster Booster',
      `<h2>New Cash Out Request</h2><p><strong>Name:</strong> ${full_name}</p>
       <p><strong>Email:</strong> ${email}</p><p><strong>Amount:</strong> $${amount}</p>
       <p><strong>Method:</strong> ${method || 'Not specified'}</p>
       <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>`
    );

    // ── #7 CASHOUT REQUEST RECEIVED EMAIL ─────────────────────────────────────
    try {
      const csResult = await pool.query(
        `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      );
      const cs = csResult.rows[0] || {};
      const fromName = escapeHtml(cs.email_sender_name || cs.company_name || 'RoofMiles');
      const companyName = escapeHtml(cs.company_name || 'your contractor');
      const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
      const firstName = escapeHtml(full_name.split(' ')[0] || full_name);
      const formattedAmount = parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

      const suppressed7 = await isEmailSuppressed(contractorId, email, 'cashout_request_received');
      if (!suppressed7) await retryWithBackoff(
        () => _sendEmail({
          from: `${fromName} <noreply@roofmiles.com>`,
          to: email,
          subject: 'We got your cashout request',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
              <h2 style="color:#012854;margin:0 0 12px;">Your request is being reviewed!</h2>
              <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, we received your cashout request for $${formattedAmount}. The ${companyName} team will review it shortly. You'll get a confirmation email once it's processed.</p>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View Request Status</a>
              </div>
            </div>
          `,
        }),
        { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
      );
    } catch (cashoutConfirmErr) {
      await logError({ req, error: cashoutConfirmErr, source: 'POST /api/cashout — #7 request confirmation' });
    }

    // ── AUTO-FIRE CHECK ──────────────────────────────────────────────────────
    // Read contractor payout automation setting and decide whether to auto-fire
    // an ACH transfer or leave in queue for manual review.
    // Only applies to stripe_ach payment method.
    const responseData = { success: true };
    try {
      const settingsResult = await pool.query(
        'SELECT payout_automation, payout_review_threshold FROM contractor_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const settings = settingsResult.rows[0] || {};
      const { payout_automation, payout_review_threshold } = settings;

      const shouldAutoFire = (
        payout_method === 'stripe_ach' &&
        (
          payout_automation === 'full_auto' ||
          (payout_automation === 'threshold' &&
           parseFloat(amount) < parseFloat(payout_review_threshold))
        )
      );

      if (shouldAutoFire) {
        try {
          await executeStripeTransfer(pool, {
            userId,
            cashoutRequestId: newCashoutId,
            bonusAmount: parseFloat(amount)
          });
          await pool.query(
            'UPDATE cashout_requests SET status = $1 WHERE id = $2',
            ['paid', newCashoutId]
          );
          responseData.auto_processed = true;
        } catch (transferErr) {
          if (transferErr.code === 'no_bank_account') {
            await pool.query(
              'UPDATE cashout_requests SET bank_connection_blocked_reason = $1 WHERE id = $2',
              ['Auto-fire blocked — referrer has no bank account connected. Awaiting manual review.', newCashoutId]
            );
            try {
              await retryWithBackoff(
                () => _sendEmail({
                  from: 'noreply@roofmiles.com',
                  to: email,
                  subject: 'Action Required: Connect Your Bank to Receive Your Bonus',
                  html: `<div style="font-family: Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #012854;">
                    <h2 style="color: #012854;">You have a bonus waiting!</h2>
                    <p>Great news — a cashout of <strong>$${amount}</strong> has been approved for you.</p>
                    <p>To receive your payment, you need to connect your bank account in the app.</p>
                    <p><strong>Once connected, your contractor will be notified to complete the transfer.</strong></p>
                    <p style="margin-top: 24px;">
                      <a href="${process.env.FRONTEND_URL}?section=manage-account&stripe_bank=connect"
                         style="background: #CC0000; color: white; padding: 12px 24px;
                                text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Connect Your Bank Account
                      </a>
                    </p>
                    <p style="margin-top: 24px; font-size: 13px; color: #666;">
                      Your banking information is encrypted and never shared with your
                      contractor or anyone else. It is used only to deliver your
                      earnings directly to your account.
                    </p>
                  </div>`
                }),
                { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
              );
            } catch (referrerEmailErr) {
              await logError({ req, error: referrerEmailErr, source: 'POST /api/cashout' });
              // do not crash the cashout flow on referrer email failure
            }
            await _sendAdminNotificationFn(
              pool,
              'payouts',
              'Auto-Fire Blocked — Bank Account Not Connected',
              `<div style="font-family: Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #012854;">
                <h2 style="color: #CC0000;">Auto-Fire Cashout Blocked</h2>
                <p>A cashout could not be automatically processed because the referrer
                   has no bank account connected.</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                  <tr>
                    <td style="padding: 8px; border: 1px solid #D3E3F0; font-weight: bold;">Referrer</td>
                    <td style="padding: 8px; border: 1px solid #D3E3F0;">${full_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #D3E3F0; font-weight: bold;">Amount</td>
                    <td style="padding: 8px; border: 1px solid #D3E3F0;">$${amount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #D3E3F0; font-weight: bold;">Cashout ID</td>
                    <td style="padding: 8px; border: 1px solid #D3E3F0;">${newCashoutId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #D3E3F0; font-weight: bold;">Status</td>
                    <td style="padding: 8px; border: 1px solid #D3E3F0;">Pending — awaiting bank connection</td>
                  </tr>
                </table>
                <p style="margin-top: 16px;">
                  This cashout will remain in your queue marked as pending.
                  Once the referrer connects their bank, you will need to manually
                  approve the transfer from the admin cashout queue.
                </p>
                <p style="margin-top: 8px; font-size: 13px; color: #666;">
                  The referrer has been automatically notified by email to connect
                  their bank account.
                </p>
              </div>`
            );
          } else {
            await pool.query(
              'UPDATE cashout_requests SET bank_connection_blocked_reason = $1 WHERE id = $2',
              ['Auto-fire attempted but Stripe transfer failed: ' + transferErr.message, newCashoutId]
            );
            await logError({ req, error: transferErr });
          }
        }
      }
    } catch (autoFireErr) {
      await logError({ req, error: autoFireErr });
    }

    res.json(responseData);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to save cash out request' });
  }
});

// ── REFERRER: GET PROFILE PHOTO ───────────────────────────────────────────────
router.get('/api/profile/photo', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    const result = await pool.query('SELECT profile_photo FROM users WHERE id=$1', [userId]);
    res.json({ photo: result.rows[0]?.profile_photo || null });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// ── REFERRER: SAVE PROFILE PHOTO ──────────────────────────────────────────────
router.post('/api/profile/photo', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { photo } = req.body;
    if (!photo) return res.status(400).json({ error: 'No photo provided' });
    if (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Invalid photo' });
    }
    const userId = session.userId;
    await pool.query('UPDATE users SET profile_photo=$1 WHERE id=$2', [photo, userId]);
    // ── #14 PROFILE PHOTO UPLOADED (non-blocking) ─────────────────────────────
    (async () => {
      try {
        const userRow = (await pool.query('SELECT full_name, email FROM users WHERE id=$1', [userId])).rows[0];
        if (!userRow?.email) return;
        const contractorId = session.contractorId;
        const csResult = await pool.query(
          `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id=$1 LIMIT 1`,
          [contractorId]
        );
        const cs = csResult.rows[0] || {};
        const fromName = escapeHtml(cs.email_sender_name || cs.company_name || 'RoofMiles');
        const firstName = escapeHtml((userRow.full_name || '').split(' ')[0] || userRow.full_name);
        const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
        const suppressed14 = await isEmailSuppressed(contractorId, userRow.email, 'profile_photo_uploaded');
        if (!suppressed14) await retryWithBackoff(
          () => resend.emails.send({
            from: `${fromName} <noreply@roofmiles.com>`,
            to: userRow.email,
            subject: `Looking good — your profile is complete`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                <h2 style="color:#012854;margin:0 0 12px;">Profile photo saved</h2>
                <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, your profile photo has been saved and is now showing on your profile and the leaderboard. Thanks for making it personal.</p>
                <div style="text-align:center;margin-bottom:24px;">
                  <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View Your Profile</a>
                </div>
              </div>
            `,
          }),
          { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
        );
      } catch (e14) {
        await logError({ req, error: e14 });
      }
    })();
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to save photo' });
  }
});

// ── REFERRER: FORGOT PIN ───────────────────────────────────────────────────────
router.post('/api/forgot-pin', forgotPinLimiter, async (req, res) => {
  // THE contractorSlug WIRE FIELD RETIRES HERE (C/DL-3b Phase 2B, D1), alongside
  // the one on /api/login. It is no longer read at all — a client that still
  // sends it gets the same answer as one that does not.
  //
  // WHY THIS ENDPOINT CANNOT BORROW LOGIN'S ANSWER. Login disambiguates with the
  // password; there is no password here, so nothing is ever proven and the server
  // may not disclose anything at all. The only safe shape is to send one reset
  // email PER matching account, each naming its own contractor in the body, and
  // return the identical generic response every time. The recipient sorts it out
  // in their inbox — where reaching the mailbox is itself the proof of ownership.
  //
  // THE RESPONSE MUST NOT VARY WITH THE MATCH COUNT. If it did, this would leak
  // strictly more than the old endpoint: not just whether an address is
  // registered, but with how many contractors.
  //
  // CAPPED at the same ceiling as login's candidate gather. Unauthenticated, and
  // it sends mail to an address the caller supplies — an unbounded fan-out here
  // is an abuse primitive, not a feature.
  //
  // USERS ONLY. team_members has no reset flow to reach (pin_reset_tokens FKs to
  // users(id)); a team-member reset path is its own future item.
  const { email } = req.body;
  const genericResponse = { message: "If that email is registered, you'll receive a reset link shortly." };

  try {
    const userResult = await pool.query(
      `SELECT id, full_name, email, contractor_id
         FROM users
        WHERE LOWER(email) = LOWER($1)
        ORDER BY contractor_id, id
        LIMIT $2`,
      [email == null ? '' : String(email), LOGIN_CANDIDATE_CAP]
    );

    for (const user of userResult.rows) {
      const token = crypto.randomBytes(32).toString('hex');

      await pool.query(
        `INSERT INTO pin_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + interval '1 hour')`,
        [user.id, token]
      );

      const frontendUrl = process.env.FRONTEND_URL || '';
      if (!frontendUrl) console.warn('WARNING: FRONTEND_URL is not set — reset links will be broken');
      const resetUrl = `${frontendUrl}/?reset=${token}`;

      try {
        const pinResetCs = await pool.query(
          `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
          [user.contractor_id]
        );
        const pinResetSettings = pinResetCs.rows[0] || {};

        // ESCAPING RULE — escapeHtml APPLIES TO HTML BODIES ONLY.
        //
        // Subjects, From: display names, and every other plain-text header carry the
        // RAW value. There is no markup to inject into, so escaping protects nothing,
        // and a mail client renders a header literally: "Smith & Sons Roofing" would
        // arrive in the inbox as "Smith &amp; Sons Roofing", from a company whose own
        // name looks broken.
        //
        // This is the SECOND instance of the same mistake — Phase 2a removed it from
        // the signup verification email's subject. Both are now pinned by tests
        // (signupEmailWhiteLabel.test.js, forgotPinEmailEscaping.test.js) so the next
        // person writing email copy has two correct examples and no broken one.
        const pinResetFromName = pinResetSettings.email_sender_name || pinResetSettings.company_name || 'RoofMiles';

        // C9, THIRD CONSUMER. The body of this email carried the literal string
        // 'Accent Roofing Service' — Phase 2a removed the hardcoded contractor name
        // from the landing payload and the signup email and missed this one, so
        // every future contractor's referrer would have been asked to reset their
        // PIN by a company they have never dealt with. Same loader, same three-rung
        // chain (company_name -> contractors.name -> 'RoofMiles') as the signup send.
        // Escaped because it lands in markup.
        const pinResetBranding = await loadContractorBranding(pool, user.contractor_id);
        const pinResetCompanyName = escapeHtml(
          pinResetBranding ? pinResetBranding.companyName : ROOFMILES_DEFAULTS.companyName
        );

        await retryWithBackoff(
          () => resend.emails.send({
          from: `${pinResetFromName} <noreply@roofmiles.com>`,
          to: user.email,
          subject: 'Reset your Rooster Booster PIN',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <p style="font-size: 20px; font-weight: 700; color: #012854; margin: 0 0 8px;">${pinResetCompanyName}</p>
              <h1 style="font-size: 24px; color: #012854; margin: 0 0 16px;">Reset your PIN</h1>
              <p style="font-size: 15px; color: #444; margin: 0 0 24px;">
                Someone requested a PIN reset for your Rooster Booster referral account.
                Click the button below to set a new PIN. This link expires in 1 hour.
              </p>
              <a href="${resetUrl}" style="
                display: inline-block;
                background: #CC0000;
                color: #fff;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 8px;
                font-weight: 700;
                font-size: 15px;
                margin-bottom: 24px;
              ">Set New PIN</a>
              <p style="font-size: 13px; color: #888; margin: 0;">
                If you didn't request this, you can safely ignore this email. Your PIN has not been changed.
              </p>
            </div>
          `,
          }),
          { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
        );
      } catch (emailErr) {
        await logError({ req, error: emailErr });
        console.error('Resend error (forgot-pin):', emailErr);
        // swallow — do not reveal whether email exists
      }

      try {
        await pool.query(
          `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ($1, $2, $3, $4)`,
          ['pin_reset_request', user.full_name, user.email, 'Reset link sent']
        );
      } catch (logErr) {
        await logError({ req, error: logErr });
        console.error('Activity log error (forgot-pin):', logErr);
      }
    }

    res.json(genericResponse);
  } catch (err) {
    await logError({ req, error: err });
    console.error('forgot-pin error:', err);
    res.json(genericResponse); // always return generic even on DB error
  }
});

// ── REFERRER: RESET PIN ────────────────────────────────────────────────────────
router.post('/api/reset-pin', resetPinLimiter, async (req, res) => {
  const { token, pin } = req.body;

  // CD-5 / D12 — UNIFIED 8-CHARACTER MINIMUM, replacing `^\d{4}$`.
  //
  // The old rule did not merely fail to require 8 characters; it actively REFUSED
  // anything that was not exactly four digits, so a referrer who signed up with a
  // real password physically could not reset to one. This was the single blocked
  // path D12 names, and it is why CD-5 is a validator change rather than a
  // migration: users.pin is TEXT NOT NULL with no length constraint and no CHECK,
  // and a 14-character alphanumeric already stores and re-authenticates fine.
  //
  // Raising the floor breaks nobody. bcrypt does not care what was hashed, so
  // every existing shorter credential keeps working; this binds new values only.
  if (typeof pin !== 'string' || pin.length < 8 || pin.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ error: 'Reset token is required.' });
  }

  try {
    const tokenResult = await pool.query(
      `SELECT prt.user_id, u.full_name, u.email
       FROM pin_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const { user_id, full_name, email } = tokenResult.rows[0];
    const hashedPin = await bcrypt.hash(String(pin), 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET pin=$1 WHERE id=$2', [hashedPin, user_id]);
      await client.query('UPDATE pin_reset_tokens SET used_at=NOW() WHERE token=$1', [token]);
      await client.query('COMMIT');
    } catch (txErr) {
      await logError({ req, error: txErr });
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
    try {
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ($1, $2, $3, $4)`,
        ['pin_reset', full_name, email, 'PIN reset via email link']
      );
    } catch (logErr) {
      await logError({ req, error: logErr });
      console.error('Activity log error (reset-pin):', logErr);
    }

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    console.error('reset-pin error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── REFERRER: DISMISS REVIEW CARD ─────────────────────────────────────────────
router.post('/api/review/dismiss', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    await pool.query(
      'UPDATE users SET review_dismissed_login = login_count WHERE id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: PEER INVITE LINK — SHARED LOOKUP ───────────────────────────────
// The single source of a referrer's personal invite slug. Both the Dashboard QR
// modal and the Refer tab call it, so the two surfaces can never hand out
// different destinations (they did before C/DL-1: the QR endpoint minted a
// leaky leaksmith.com URL while the Refer tab returned an opaque slug).
//
// Lazily creates the link on first request, matching the previous behavior.
//
// ORDER BY is load-bearing, not decoration. A referrer should only ever hold one
// active peer link, but if supersession (C/DL-3) or a concurrent first-request
// race ever produces two, both surfaces must agree on which one they serve. The
// previous LIMIT 1 carried no ORDER BY and left that choice to the planner.
//
// Pre-existing and unchanged: two simultaneous first requests can both miss the
// SELECT and both INSERT, leaving the referrer with two active peer links. The
// deterministic ORDER BY makes that harmless (both surfaces then agree on the
// newest); closing the race itself needs a partial unique index, which belongs
// with C/DL-3's supersession work rather than here.
async function getOrCreatePeerInviteLink({ userId, contractorId }) {
  const existing = await pool.query(
    `SELECT slug FROM contractor_invite_links
      WHERE created_by_user_id = $1 AND link_type = 'peer' AND active = true
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0].slug;

  const slug = generateSlug();
  await pool.query(
    `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, created_by_user_id, active)
     VALUES ($1, $2, 'peer', $3, true)`,
    [contractorId, slug, userId]
  );
  return slug;
}

// ── REFERRER: QR CODE ─────────────────────────────────────────────────────────
// Serves the same peer link as /api/referrer/my-invite-link, rendered as a QR.
// Scheme A died here — the legacy construction put a raw userId and contractorId
// in the query string of a domain the app does not serve. The literal is not
// reproduced here on purpose: the generator sweep matches on source text and
// cannot tell a comment from code, which is what stops a commented-out generator
// from being quietly uncommented later.
router.get('/api/referrer/qr-code', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId, contractorId } = session;

    const slug = await getOrCreatePeerInviteLink({ userId, contractorId });
    // PUBLIC slug, never contractorId — getInviteHostSlug is the only sanctioned
    // answer to "which subdomain does this contractor's link render on". Passing
    // contractorId here would print the internal id on a QR code.
    const fullUrl = buildInviteUrl(slug, { contractorSlug: await getInviteHostSlug(pool, contractorId) });

    // Same QR options as my-invite-link so both surfaces render byte-identical
    // images for the same referrer.
    const qrCodeDataUrl = await QRCode.toDataURL(fullUrl, { width: 400, margin: 2 });

    // slug and fullUrl are ADDITIVE. DashboardTab.jsx reads qrCodeDataUrl and is
    // untouched; the added fields make the emitted URL assertable at all, which
    // a base64 PNG alone is not.
    res.json({ qrCodeDataUrl, slug, fullUrl });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/referrer/qr-code' });
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ── REFERRER: PERSONAL INVITE LINK ────────────────────────────────────────────
// Lazy-generates a peer invite link for this referrer on first request.
router.get('/api/referrer/my-invite-link', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId, contractorId } = session;

    const slug = await getOrCreatePeerInviteLink({ userId, contractorId });
    // PUBLIC slug, never contractorId — see the note on the QR endpoint above.
    const fullUrl = buildInviteUrl(slug, { contractorSlug: await getInviteHostSlug(pool, contractorId) });

    // Generate QR code for the invite URL (server-side, existing qrcode package)
    // MVP: QR code generated server-side per request. Full solution: pre-generate and cache as
    // a stored asset when print materials are needed (Stripe ACH / print session).
    const qrCodeDataUrl = await QRCode.toDataURL(fullUrl, { width: 400, margin: 2 });

    res.json({ slug, fullUrl, qrCodeDataUrl });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/referrer/my-invite-link' });
    // Was `'Failed to get invite link: ' + err.message` — leaked internals to the
    // client, against the Security Standards rule on error responses.
    res.status(500).json({ error: 'Failed to get invite link' });
  }
});

// ── REFERRER: ABOUT ───────────────────────────────────────────────────────────
router.get('/api/referrer/about', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    const contractorId = session.contractorId;

    const aboutResult = await pool.query(
      'SELECT * FROM contractor_about WHERE contractor_id = $1 LIMIT 1',
      [contractorId]
    );
    const about = aboutResult.rows[0];
    if (!about || !about.enabled) return res.json({ enabled: false });

    let google_rating = null;
    let google_review_count = null;

    if (about.google_place_id && process.env.GOOGLE_PLACES_API_KEY) {
      try {
        const cached = await pool.query(
          "SELECT data, cached_at FROM admin_cache WHERE contractor_id = $1 AND cache_key = 'google_rating' AND cached_at > NOW() - INTERVAL '86400 seconds'",
          [contractorId]
        );
        if (cached.rows.length > 0) {
          google_rating = cached.rows[0].data.rating ?? null;
          google_review_count = cached.rows[0].data.userRatingCount ?? null;
        } else {
          const googleRes = await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(about.google_place_id)}`,
            {
              headers: {
                'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'rating,userRatingCount'
              }
            }
          );
          if (googleRes.ok) {
            const googleData = await googleRes.json();
            google_rating = googleData.rating ?? null;
            google_review_count = googleData.userRatingCount ?? null;
            await pool.query(
              `INSERT INTO admin_cache (contractor_id, cache_key, data, cached_at) VALUES ($1, 'google_rating', $2, NOW())
               ON CONFLICT (contractor_id, cache_key) DO UPDATE SET data=$2, cached_at=NOW()`,
              [contractorId, JSON.stringify({ rating: google_rating, userRatingCount: google_review_count })]
            );
          }
        }
      } catch (e) {
        await logError({ req, error: e, source: 'GET /api/referrer/about' });
        console.error('Google Places API error:', e.message);
      }
    }

    const userResult = await pool.query('SELECT about_modal_seen, booking_submitted FROM users WHERE id = $1', [userId]);
    const about_modal_seen   = userResult.rows[0]?.about_modal_seen   ?? false;
    const booking_submitted  = userResult.rows[0]?.booking_submitted  ?? false;

    const certs = typeof about.certifications === 'string' ? JSON.parse(about.certifications) : (about.certifications || []);
    res.json({ ...about, certifications: certs, google_rating, google_review_count, about_modal_seen, booking_submitted });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: MARK ABOUT MODAL SEEN ───────────────────────────────────────────
router.patch('/api/referrer/about/seen', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    await pool.query('UPDATE users SET about_modal_seen = true WHERE id = $1', [userId]);
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: BOOKING ─────────────────────────────────────────────────────────
router.post('/api/referrer/booking', bookingLimiter, [
  body('name').notEmpty().withMessage('Name is required').isString().isLength({ max: 100 }).withMessage('Name must be 100 characters or less').trim(),
  body('phone').optional().matches(/^[\d\s\(\)\-\+]{7,20}$/).withMessage('Invalid phone number'),
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes must be 500 characters or less'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  const session = await verifyReferrerSession(req, res);
  if (!session) return;
  const { userId } = session;
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    await pool.query('UPDATE users SET booking_submitted = true WHERE id = $1', [userId]);

    const toEmail = await resolveNotificationRecipient(pool, 'booking');
    const contractorId = session.contractorId;

    const bookingCs = await pool.query(
      `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
      [contractorId]
    );
    const bookingSettings = bookingCs.rows[0] || {};
    const bookingFromName = escapeHtml(bookingSettings.email_sender_name || bookingSettings.company_name || 'RoofMiles');

    await retryWithBackoff(
      () => resend.emails.send({
        from: `${bookingFromName} <noreply@roofmiles.com>`,
        to: toEmail,
        subject: `New Inspection Booking Request — ${escapeHtml(name)}`,
        html: `<h2>New Inspection Booking Request</h2>
               <p><strong>Name:</strong> ${escapeHtml(name)}</p>
               <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
               ${email ? `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` : ''}
               ${address ? `<p><strong>Address:</strong> ${escapeHtml(address)}</p>` : ''}
               ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
               <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>`,
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
    );

    try {
      await pool.query(
        `INSERT INTO booking_requests
           (contractor_id, submitted_by_user_id, referred_name, referred_phone,
            referred_email, referred_address, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [contractorId, userId, name, phone || null, email || null, address || null, notes || null]
      );
    } catch (bookingErr) {
      await logError({ req, error: bookingErr });
      // booking_requests insert failure must never prevent the email success response
    }

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: MARK ANNOUNCEMENT SEEN ──────────────────────────────────────────
router.post('/api/announcement/seen', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    const { announcementId } = req.body;
    if (!announcementId) return res.status(400).json({ error: 'announcementId is required' });
    await pool.query(
      'UPDATE payout_announcements SET seen_at = NOW() WHERE id = $1 AND user_id = $2',
      [announcementId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: BADGES ──────────────────────────────────────────────────────────

// Badge master list — must match src/constants/badges.js exactly.
// Kept server-side to avoid a runtime import of an ES module from CommonJS.
const BADGES_MASTER = [
  { id: "founding_referrer", name: null,              emoji: "🐓", description: null,                                          tier: "secret",   trigger: "account_creation" },
  { id: "first_referral",    name: "First Referral",  emoji: "⭐", description: "You made your first referral.",               tier: "standard", trigger: "pipeline_sync"    },
  { id: "milestone_5",       name: "On a Roll",        emoji: "🔥", description: "5 referrals and counting.",                  tier: "standard", trigger: "pipeline_sync"    },
  { id: "milestone_10",      name: "Double Digits",    emoji: "🔥", description: "10 referrals. You're serious about this.",   tier: "standard", trigger: "pipeline_sync"    },
  { id: "milestone_25",      name: "Referral Machine", emoji: "🔥", description: "25 referrals. Legendary.",                   tier: "standard", trigger: "pipeline_sync"    },
  { id: "client_badge",      name: "Client",           emoji: "🏠", description: "You're not just a referrer — you're family.", tier: "standard", trigger: "pipeline_sync"   },
  { id: "yearly_winner",     name: "Yearly Champion",  emoji: "🏆", description: "Top of the leaderboard at year end.",        tier: "standard", trigger: "admin_awarded"    },
];

router.get('/api/referrer/badges', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;

    const earnedResult = await pool.query(
      'SELECT badge_id, earned_at, seen FROM user_badges WHERE user_id=$1',
      [userId]
    );
    const earnedMap = {};
    for (const row of earnedResult.rows) {
      earnedMap[row.badge_id] = { earned_at: row.earned_at, seen: row.seen };
    }

    const badges = BADGES_MASTER.map(badge => {
      const record = earnedMap[badge.id];
      if (record) {
        return { ...badge, earned: true, earned_at: record.earned_at, seen: record.seen };
      }
      // Unearned secret badges: reveal nothing
      if (badge.tier === 'secret') {
        return { id: badge.id, emoji: badge.emoji, name: null, description: null, tier: 'secret', trigger: badge.trigger, earned: false, earned_at: null, seen: false };
      }
      return { ...badge, earned: false, earned_at: null, seen: false };
    });

    res.json(badges);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/referrer/badges/acknowledge', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;

    const { badgeIds } = req.body;
    if (!Array.isArray(badgeIds) || badgeIds.length === 0) return res.status(400).json({ error: 'badgeIds must be a non-empty array' });

    await pool.query(
      'UPDATE user_badges SET seen=true WHERE user_id=$1 AND badge_id=ANY($2)',
      [userId, badgeIds]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: LEADERBOARD ──────────────────────────────────────────────────────

// Priority order for leaderboard display badge — first match wins
const BADGE_PRIORITY = ['yearly_winner', 'milestone_25', 'milestone_10', 'milestone_5', 'client_badge', 'first_referral', 'founding_referrer'];

// Returns { id, emoji } for the highest-priority badge the user has earned, or null
function pickDisplayBadge(earnedSet) {
  for (const id of BADGE_PRIORITY) {
    if (earnedSet.has(id)) {
      const badge = BADGES_MASTER.find(b => b.id === id);
      return badge ? { id: badge.id, emoji: badge.emoji } : null;
    }
  }
  return null;
}

router.get('/api/referrer/leaderboard', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    const contractorId = session.contractorId;

    const [settingsResult, userShoutResult] = await Promise.all([
      pool.query(
        `SELECT leaderboard_enabled, year_start_month, quarter_1_start,
                quarter_2_start, quarter_3_start, quarter_4_start,
                quarterly_prizes, yearly_prizes,
                warmup_mode_enabled, shouts_enabled
         FROM engagement_settings WHERE contractor_id=$1`,
        [contractorId]
      ),
      pool.query(
        'SELECT shout_opt_out, pinned_shout, full_name, profile_photo FROM users WHERE id=$1',
        [userId]
      ),
    ]);

    const settings = settingsResult.rows[0] || {};
    const leaderboard_enabled  = settings.leaderboard_enabled  ?? true;
    const warmup_mode_enabled  = settings.warmup_mode_enabled  ?? false;
    const shouts_enabled       = settings.shouts_enabled       ?? true;
    const shout_opt_out        = userShoutResult.rows[0]?.shout_opt_out  ?? false;
    const pinned_shout         = userShoutResult.rows[0]?.pinned_shout   ?? null;

    const period = req.query.period || 'alltime';
    const { start, end } = getPeriodDateRange(period, settings);

    let top10Result, userCountResult;
    if (!start) {
      [top10Result, userCountResult] = await Promise.all([
        pool.query(
          `SELECT u.id, u.full_name, u.profile_photo,
                  COUNT(rc.id) as converted_count,
                  COALESCE(SUM(rc.bonus_amount), 0) as period_earnings
           FROM users u
           LEFT JOIN referral_conversions rc ON rc.user_id = u.id AND rc.contractor_id = $1
           GROUP BY u.id, u.full_name, u.profile_photo
           ORDER BY converted_count DESC
           LIMIT 10`,
          [contractorId]
        ),
        pool.query(
          `SELECT COUNT(*) as converted_count,
                  COALESCE(SUM(bonus_amount), 0) as period_earnings
           FROM referral_conversions
           WHERE user_id = $1 AND contractor_id = $2`,
          [userId, contractorId]
        ),
      ]);
    } else {
      [top10Result, userCountResult] = await Promise.all([
        pool.query(
          `SELECT u.id, u.full_name, u.profile_photo,
                  COUNT(rc.id) as converted_count,
                  COALESCE(SUM(rc.bonus_amount), 0) as period_earnings
           FROM users u
           LEFT JOIN referral_conversions rc ON rc.user_id = u.id
             AND rc.contractor_id = $3
             AND rc.converted_at >= $1 AND rc.converted_at < $2
           GROUP BY u.id, u.full_name, u.profile_photo
           ORDER BY converted_count DESC
           LIMIT 10`,
          [start, end, contractorId]
        ),
        pool.query(
          `SELECT COUNT(*) as converted_count,
                  COALESCE(SUM(bonus_amount), 0) as period_earnings
           FROM referral_conversions
           WHERE user_id = $1 AND contractor_id = $4
             AND converted_at >= $2 AND converted_at < $3`,
          [userId, start, end, contractorId]
        ),
      ]);
    }

    const userCount = parseInt(userCountResult.rows[0]?.converted_count) || 0;

    // Count real entries with at least 1 conversion for warmup threshold check
    const realWithCount = top10Result.rows.filter(r => parseInt(r.converted_count) > 0).length;

    // ── Warmup mode: return placeholder entries when fewer than 5 real referrers have converted ──
    if (warmup_mode_enabled) {
      if (realWithCount < 5) {
        const warmupTop10 = WARMUP_ENTRIES_SERVER.map((entry, i) => ({
          rank: i + 1,
          first_name: entry.firstName,
          last_name: entry.lastName,
          converted_count: entry.referralCount,
          period_earnings: entry.earnings,
          shout: entry.shout,
          display_badge: null,
          is_warmup: true,
        }));
        return res.json({
          top10: warmupTop10,
          userRank: null,
          current_user: {
            full_name: userShoutResult.rows[0]?.full_name || null,
            profile_photo: userShoutResult.rows[0]?.profile_photo || null,
          },
          leaderboard_enabled,
          warmup_mode_enabled: true,
          shouts_enabled,
          shout_opt_out,
          pinned_shout,
          quarterly_prizes: settings.quarterly_prizes ?? [],
          yearly_prizes: settings.yearly_prizes ?? [],
        });
      }
      // 5+ real referrers — auto-disable warmup mode
      await pool.query(
        `UPDATE engagement_settings SET warmup_mode_enabled=false WHERE contractor_id=$1`,
        [contractorId]
      );
    }

    // ── Normal leaderboard path ───────────────────────────────────────────────
    // Collect all user IDs we need badges for: top 10 + the logged-in user
    const top10Ids = top10Result.rows.map(r => r.id);
    const allIds = [...new Set([...top10Ids, userId])];

    // Run badge lookup, rank query, and current user profile in parallel
    const badgesPromise = pool.query(
      'SELECT user_id, badge_id FROM user_badges WHERE user_id = ANY($1)',
      [allIds]
    );
    const userProfilePromise = pool.query(
      'SELECT full_name, profile_photo FROM users WHERE id=$1',
      [userId]
    );
    const rankPromise = userCount > 0
      ? (!start
          ? pool.query(
              `SELECT COUNT(*) as rank_above FROM (
                 SELECT user_id FROM referral_conversions
                 WHERE contractor_id = $1
                 GROUP BY user_id HAVING COUNT(*) > $2
               ) sub`,
              [contractorId, userCount]
            )
          : pool.query(
              `SELECT COUNT(*) as rank_above FROM (
                 SELECT user_id FROM referral_conversions
                 WHERE contractor_id = $1
                   AND converted_at >= $2 AND converted_at < $3
                 GROUP BY user_id HAVING COUNT(*) > $4
               ) sub`,
              [contractorId, start, end, userCount]
            )
        )
      : Promise.resolve(null);

    const [badgesResult, rankResult, userProfileResult] = await Promise.all([badgesPromise, rankPromise, userProfilePromise]);

    // Build badge map: userId → Set of earned badge ids
    const badgeMap = {};
    for (const row of badgesResult.rows) {
      if (!badgeMap[row.user_id]) badgeMap[row.user_id] = new Set();
      badgeMap[row.user_id].add(row.badge_id);
    }

    const top10 = top10Result.rows.map((row, i) => ({
      rank: i + 1,
      first_name: row.full_name.split(' ')[0],
      profile_photo: row.profile_photo || null,
      converted_count: parseInt(row.converted_count) || 0,
      period_earnings: parseInt(row.period_earnings) || 0,
      display_badge: pickDisplayBadge(badgeMap[row.id] || new Set()),
    }));

    const userProfile = userProfileResult.rows[0] || {};
    const userRank = userCount > 0 ? {
      rank: parseInt(rankResult.rows[0]?.rank_above || 0) + 1,
      full_name: userProfile.full_name || null,
      profile_photo: userProfile.profile_photo || null,
      converted_count: userCount,
      period_earnings: parseInt(userCountResult.rows[0]?.period_earnings) || 0,
      display_badge: pickDisplayBadge(badgeMap[userId] || new Set()),
    } : null;

    const response = {
      top10,
      userRank,
      current_user: {
        full_name: userProfile.full_name || null,
        profile_photo: userProfile.profile_photo || null,
      },
      leaderboard_enabled,
      warmup_mode_enabled: false,
      shouts_enabled,
      shout_opt_out,
      pinned_shout,
      quarterly_prizes: settings.quarterly_prizes ?? [],
      yearly_prizes: settings.yearly_prizes ?? [],
    };

    // Signal to admin panel that warmup was just auto-disabled
    if (warmup_mode_enabled && realWithCount >= 5) {
      response.warmup_just_disabled = true;
    }

    res.json(response);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: SHOUT SETTINGS ───────────────────────────────────────────────────
router.patch('/api/referrer/shout-settings', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;

    const { shout_opt_out, pinned_shout } = req.body;
    if (typeof shout_opt_out !== 'boolean') {
      return res.status(400).json({ error: 'shout_opt_out must be a boolean' });
    }
    if (pinned_shout !== null && typeof pinned_shout !== 'string') {
      return res.status(400).json({ error: 'pinned_shout must be a string or null' });
    }

    await pool.query(
      'UPDATE users SET shout_opt_out=$1, pinned_shout=$2 WHERE id=$3',
      [shout_opt_out, pinned_shout, userId]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── PENDING REFERRAL: MATCH CHECK ─────────────────────────────────────────────
// GET /api/referral/pending/match-check
// Called by ReferrerApp on login to check for unseen pending referral matches.
// Returns the pending record if matched_at is set and match_seen_at is null.
router.get('/api/referral/pending/match-check', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    const result = await pool.query(
      `SELECT id, client_name, referred_by_name, matched_at
       FROM pending_referrals
       WHERE matched_user_id=$1 AND match_seen_at IS NULL AND status='matched'
       LIMIT 1`,
      [userId]
    );
    res.json({ match: result.rows[0] || null });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── PENDING REFERRAL: MARK SEEN ───────────────────────────────────────────────
// PUT /api/referral/pending/:id/seen
// Marks the celebration popup as seen so it does not fire again.
router.put('/api/referral/pending/:id/seen', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    await pool.query(
      'UPDATE pending_referrals SET match_seen_at=NOW() WHERE id=$1 AND matched_user_id=$2',
      [req.params.id, userId]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── REFERRER: MISSING REFERRAL REPORT ─────────────────────────────────────────

const VALID_CHANNELS = ['qr_code', 'personal_link', 'company_info_via_app', 'company_info_outside_app', 'salesman_contact'];
const CHANNEL_LABELS = {
  qr_code:                  'In-app QR code',
  personal_link:            'Personal link via app',
  company_info_via_app:     'Sent company info via app',
  company_info_outside_app: 'Sent company info outside of app',
  salesman_contact:         'Sent salesman\'s contact info',
};

router.post('/api/referrer/missing-referral', missingReferralLimiter, async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    const contractorId = session.contractorId;

    const userResult = await pool.query('SELECT full_name FROM users WHERE id=$1 AND deleted_at IS NULL', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const fullName = userResult.rows[0].full_name;

    const { referred_name, channel, referred_contact, approximate_date } = req.body;
    if (!referred_name || typeof referred_name !== 'string' || referred_name.trim().length === 0) {
      return res.status(400).json({ error: 'referred_name is required' });
    }
    if (!channel || !VALID_CHANNELS.includes(channel)) {
      return res.status(400).json({ error: 'channel must be one of: ' + VALID_CHANNELS.join(', ') });
    }

    const safeReferredName   = referred_name.trim().substring(0, 200);
    const safeReferredContact = referred_contact ? String(referred_contact).trim().substring(0, 200) : null;
    const safeApproxDate     = approximate_date || null;

    const reportResult = await pool.query(
      `INSERT INTO missing_referral_reports
         (user_id, referred_name, referred_contact, channel, approximate_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, safeReferredName, safeReferredContact, channel, safeApproxDate]
    );
    const reportId = reportResult.rows[0].id;

    const channelLabel = CHANNEL_LABELS[channel] || channel;
    const messageTitle = `Missing Referral — ${fullName}`;
    const messageBody  = `${fullName} reported a missing referral: ${safeReferredName} via ${channelLabel}`;

    await pool.query(
      `INSERT INTO admin_messages
         (contractor_id, message_type, reference_id, title, body, color_code)
       VALUES ($1, 'missing_referral', $2, $3, $4, 'purple')`,
      [contractorId, reportId, messageTitle, messageBody]
    );

    // ── #23 MISSING REFERRAL ADMIN ALERT ─────────────────────────────────────
    // Non-blocking: failure must not break the report submission response.
    (async () => {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
        const safeFn = escapeHtml(fullName);
        const safeRef = escapeHtml(safeReferredName);
        const adminEmail23 = await resolveNotificationRecipient(pool, 'general');
        const suppressed23 = await isEmailSuppressed(contractorId, adminEmail23, 'missing_referral_report');
        if (!suppressed23) await sendAdminNotification(
          pool,
          'general',
          `${safeFn} submitted a missing referral report`,
          `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <h2 style="color:#012854;margin:0 0 12px;">Missing referral needs review</h2>
              <p style="color:#444;margin:0 0 16px;line-height:1.6;">${safeFn} says they referred someone who isn't showing in their pipeline. Log in to review the details and investigate.</p>
              <p style="color:#444;margin:0 0 8px;"><strong>Reported name:</strong> ${safeRef}</p>
              <p style="color:#444;margin:0 0 24px;"><strong>Channel:</strong> ${escapeHtml(channelLabel)}</p>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${frontendUrl}?admin=true" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Review Report</a>
              </div>
            </div>
          `
        );
      } catch (adminAlertErr) {
        await logError({ req, error: adminAlertErr, source: 'POST /api/referrer/missing-referral — #23 admin alert' });
      }
    })();

    try {
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, detail)
         VALUES ('missing_referral_submitted', $1, $2)`,
        [fullName, `Reported missing referral: ${safeReferredName} via ${channelLabel}`]
      );
    } catch (logErr) {
      await logError({ req, error: logErr });
    }

    res.status(201).json({ id: reportId });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/referrer/missing-referrals', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;

    const result = await pool.query(
      `SELECT id, referred_name, referred_contact, channel, approximate_date,
              resolved, resolved_at, created_at
       FROM missing_referral_reports
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── EXPERIENCE FLOW ───────────────────────────────────────────────────────────

router.get('/api/referrer/experience-prompt', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;

    const result = await pool.query(
      `SELECT ep.id, ep.response_type, ep.triggered_at, ca.google_place_id,
              u.referral_code
       FROM experience_prompts ep
       LEFT JOIN contractor_about ca ON ca.contractor_id = ep.contractor_id
       LEFT JOIN users u ON u.id = ep.user_id
       WHERE ep.user_id = $1 AND ep.response_type = 'pending'
       ORDER BY ep.triggered_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) return res.json({ prompt: null });
    const row = result.rows[0];
    const frontendUrl  = process.env.FRONTEND_URL || '';
    const referralLink = row.referral_code ? `${frontendUrl}/?ref=${row.referral_code}` : null;
    res.json({
      prompt: {
        id:            row.id,
        response_type: row.response_type,
        triggered_at:  row.triggered_at,
        google_place_id: row.google_place_id,
        ...(referralLink ? { referral_link: referralLink } : {}),
      },
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/referrer/experience-prompt/:id/respond', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;

    const { response_type, suggestion_text } = req.body;
    if (!['positive', 'negative'].includes(response_type)) {
      return res.status(400).json({ error: 'response_type must be positive or negative' });
    }
    if (response_type === 'negative') {
      if (!suggestion_text || !suggestion_text.trim()) {
        return res.status(400).json({ error: 'suggestion_text is required for negative responses' });
      }
      if (suggestion_text.length > 2000) {
        return res.status(400).json({ error: 'suggestion_text must be 2000 characters or fewer' });
      }
    }

    const promptResult = await pool.query(
      'SELECT id, user_id, contractor_id, response_type FROM experience_prompts WHERE id = $1',
      [req.params.id]
    );
    if (promptResult.rows.length === 0) return res.status(404).json({ error: 'Prompt not found' });
    const prompt = promptResult.rows[0];
    if (prompt.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (prompt.response_type !== 'pending') return res.json({ success: true, alreadyCompleted: true });

    await pool.query(
      'UPDATE experience_prompts SET response_type = $1, completed_at = NOW() WHERE id = $2',
      [response_type, prompt.id]
    );

    if (response_type === 'negative') {
      const submissionResult = await pool.query(
        'INSERT INTO suggestion_box_submissions (user_id, contractor_id, message_text) VALUES ($1, $2, $3) RETURNING id',
        [userId, prompt.contractor_id, suggestion_text]
      );
      const submissionId = submissionResult.rows[0].id;
      const msgBody = suggestion_text.substring(0, 120) + (suggestion_text.length > 120 ? '...' : '');
      await pool.query(
        `INSERT INTO admin_messages (contractor_id, message_type, reference_id, title, body, color_code, read)
         VALUES ($1, 'suggestion_box', $2, 'New Suggestion Submitted', $3, 'red', false)`,
        [prompt.contractor_id, submissionId, msgBody]
      );
    }

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/referrer/claim-experience-token', async (req, res) => {
  try {
    const { token, user_id } = req.body;
    if (!token || !user_id) {
      return res.status(400).json({ error: 'token and user_id are required' });
    }

    const tokenResult = await pool.query(
      `SELECT id, contractor_id, jobber_invoice_id, expires_at, claimed_at
       FROM experience_invite_tokens WHERE token = $1 LIMIT 1`,
      [token]
    );
    if (tokenResult.rows.length === 0) return res.status(404).json({ error: 'Token not found' });
    const inviteToken = tokenResult.rows[0];

    if (new Date(inviteToken.expires_at) < new Date()) return res.status(410).json({ error: 'Token expired' });
    if (inviteToken.claimed_at) return res.status(409).json({ error: 'Token already claimed' });

    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await pool.query(
      `INSERT INTO experience_prompts (user_id, contractor_id, jobber_invoice_id, response_type)
       VALUES ($1, $2, $3, 'pending')`,
      [user_id, inviteToken.contractor_id, inviteToken.jobber_invoice_id]
    );

    await pool.query(
      'UPDATE experience_invite_tokens SET claimed_at = NOW() WHERE id = $1',
      [inviteToken.id]
    );

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrer/feedback
// Captures bad-path suggestion text from the T+24h post-job modal flow.
router.post('/api/referrer/feedback', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: 'message must be 5000 characters or fewer' });
    }

    // MVP: single contractor — resolved via session.contractorId (tenant rebuild S2).
    const contractorId = session.contractorId;

    const submissionResult = await pool.query(
      'INSERT INTO suggestion_box_submissions (user_id, contractor_id, message_text) VALUES ($1, $2, $3) RETURNING id',
      [userId, contractorId, message.trim()]
    );
    const submissionId = submissionResult.rows[0].id;
    const msgBody = message.trim().substring(0, 120) + (message.trim().length > 120 ? '...' : '');
    await pool.query(
      `INSERT INTO admin_messages (contractor_id, message_type, reference_id, title, body, color_code, read)
       VALUES ($1, 'suggestion_box', $2, 'New Suggestion Submitted', $3, 'red', false)`,
      [contractorId, submissionId, msgBody]
    );

    // Mark the most recent pending experience prompt so the respond endpoint treats it as alreadyCompleted
    await pool.query(
      `UPDATE experience_prompts SET response_type = 'negative', completed_at = NOW()
       WHERE id = (
         SELECT id FROM experience_prompts
         WHERE user_id = $1 AND response_type = 'pending'
         ORDER BY triggered_at DESC LIMIT 1
       )`,
      [userId]
    );

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrer/post-job-sequence-complete
// Called when the user completes or dismisses the T+24h ExperiencePopup flow.
// Sets post_job_modal_shown = TRUE on the relevant pipeline_cache row.
router.post('/api/referrer/post-job-sequence-complete', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;

    // Find the most-recent experience_prompt for this user.
    // jobber_invoice_id stores the jobber_client_id when created by the T+24h cron.
    const promptResult = await pool.query(
      `SELECT jobber_invoice_id, contractor_id FROM experience_prompts
       WHERE user_id = $1
       ORDER BY triggered_at DESC LIMIT 1`,
      [userId]
    );

    if (promptResult.rows.length > 0) {
      const { jobber_invoice_id: jobberClientId, contractor_id: contractorId } = promptResult.rows[0];
      if (jobberClientId) {
        await pool.query(
          `UPDATE pipeline_cache SET post_job_modal_shown = TRUE
           WHERE contractor_id = $1 AND jobber_client_id = $2`,
          [contractorId, jobberClientId]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referrer/schedules
// Returns active referral schedules for the contractor in homeowner-facing format.
// Used by the dynamic Reward Schedule card on the referrer dashboard.
router.get('/api/referrer/schedules', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    // MVP: single contractor — resolved via session.contractorId (tenant rebuild S2).
    const contractorId = session.contractorId;

    const result = await pool.query(
      `SELECT s.id, s.name, s.payout_model, s.minimum_invoice, s.reset_period,
              s.escalating_steps, s.tier_brackets, s.flat_amount,
              s.percentage_rate, s.percentage_max_cap,
              array_agg(jt.jobber_label ORDER BY jt.jobber_label) AS job_type_labels
       FROM referral_schedules s
       JOIN referral_schedule_job_types jt ON jt.schedule_id = s.id
       WHERE s.contractor_id = $1 AND s.is_active = true
       GROUP BY s.id
       ORDER BY s.payout_model = 'escalating' DESC, s.name ASC`,
      [contractorId]
    );

    res.json({ schedules: result.rows });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to load schedules' });
  }
});

// GET /api/referrer/conversions
// Returns all referral_conversions for the logged-in referrer with schedule attribution.
// Used by earnings history display and pipeline detail view for converted clients.
router.get('/api/referrer/conversions', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;
    const { userId } = session;
    // MVP: single contractor — resolved via session.contractorId (tenant rebuild S2).
    const contractorId = session.contractorId;

    // DISTINCT ON (rc.id) prevents duplicate rows when multiple activity_log entries
    // reference the same jobber_client_id. MVP: add schedule_id column to
    // referral_conversions at FORA scale to make schedule attribution a direct join.
    const result = await pool.query(
      `SELECT DISTINCT ON (rc.id)
         rc.id,
         rc.jobber_client_id,
         rc.converted_at,
         rc.bonus_amount,
         pc.client_name,
         al.detail AS conversion_detail
       FROM referral_conversions rc
       LEFT JOIN pipeline_cache pc
         ON pc.jobber_client_id = rc.jobber_client_id
        AND pc.contractor_id = rc.contractor_id
       LEFT JOIN activity_log al
         ON al.event_type = 'referral_conversion'
        AND al.detail LIKE '%' || rc.jobber_client_id || '%'
       WHERE rc.user_id = $1
         AND rc.contractor_id = $2
       ORDER BY rc.id, rc.converted_at DESC`,
      [userId, contractorId]
    );

    res.json({ conversions: result.rows });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to load conversions' });
  }
});

// ── THEME MODE PREFERENCE — READ (C/DL-3b Phase 1, spec D8) ──────────────────
// The one word the theme provider needs on boot: 'light', 'dark', or null.
//
// user_preferences' FIRST PRODUCTION CALLER. The table and
// server/utils/userPreferences.js shipped in C/DL-3a with zero — verified again
// in this phase's Step 1. getPreference() is server-side and the provider runs in
// a browser, so D8's "read the stored mode" is not satisfiable without an HTTP
// surface, and this is the smallest one that does it.
//
// READ ONLY, DELIBERATELY. There is no writer because THE TOGGLE IS 3c (D8,
// explicit). Shipping a writer now would be live surface with a tenancy predicate
// on it that nothing can reach — more attack surface than feature.
//
// REFERRER SESSION ONLY, and that is scope rather than oversight. The provider
// wraps the login screen and the referrer/rep tree; AdminPanel and the
// super-admin shell render OUTSIDE it and never read a --rm-* value, so an
// admin-session path would have no consumer today. userPreferences.js already
// routes subjectType 'team_member'; the rep half lands in 3c with the rep app.
//
// THE VALUE IS VALIDATED HERE RATHER THAN FORWARDED. pref_value is JSONB with no
// CHECK constraint, so the column will hold anything at all — and
// deriveThemeTokens THROWS on an unknown mode rather than defaulting, precisely
// so a bad mode cannot silently paint a dark-mode user a white surface. Without
// this gate one junk row would turn into a blank app for that user.
router.get('/api/preferences/theme-mode', async (req, res) => {
  const session = await verifyReferrerSession(req, res);
  if (!session) return;

  try {
    const stored = await getPreference({
      subjectType: 'user',
      subjectId: session.userId,
      contractorId: session.contractorId,
      key: THEME_MODE_PREF_KEY,
    });

    // Anything that is not one of the two known modes reads as "unset", which the
    // provider answers with its light default.
    const mode = (stored === 'light' || stored === 'dark') ? stored : null;
    res.json({ mode });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/preferences/theme-mode' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ sendEmail: a, sendAdminNotification: b } = {}) {
  if (a !== undefined) _sendEmail              = a;
  if (b !== undefined) _sendAdminNotificationFn = b;
}
// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  _sendEmail              = (...args) => resend.emails.send(...args);
  _sendAdminNotificationFn = sendAdminNotification;
}
router._setTestOverrides  = _setTestOverrides;
router._resetTestOverrides = _resetTestOverrides;

// Public landing limiter configuration. Exported so the suite reads the threshold
// rather than hardcoding it — tuning these numbers must never break a test.
// Read-only by contract; frozen so a caller cannot tune the live limiter by
// mutating the object it was built from.
router.LANDING_RESOLVE_LIMIT = Object.freeze({ ...LANDING_RESOLVE_LIMIT });

// Verification-code resend limiter configuration. Exported and frozen for the same
// two reasons as LANDING_RESOLVE_LIMIT above: the suite reads the threshold rather
// than hardcoding it, and a caller cannot tune the live limiter by mutating the
// object it was built from.
router.RESEND_CODE_LIMIT = Object.freeze({ ...RESEND_CODE_LIMIT });

// The RoofMiles fallback tokens, re-exported from their home in
// server/utils/brandingTheme.js. Exported so the drift guard in
// server/test/brandingTheme.test.js reads the constant the server actually
// serves rather than re-typing the hex values — a test that re-typed them would
// go on passing while the two copies diverged, which is exactly how
// BrandingPreview.jsx ended up three colours away from the server with nothing
// failing. Already frozen at its source.
router.ROOFMILES_DEFAULTS = ROOFMILES_DEFAULTS;

module.exports = router;
