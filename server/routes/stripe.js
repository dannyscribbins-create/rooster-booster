const express = require('express');
const Stripe = require('stripe');
const { pool } = require('../db');
const { verifyAdminSession, verifyReferrerSession } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { logError, PLATFORM_TENANT } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { stripeShouldRetry } = require('../utils/retryHelpers');
const { encrypt, decrypt } = require('../utils/encryption');
const { executeStripeTransfer } = require('../utils/stripeTransfer');

const router = express.Router();

// ── TEST SEAM FOR THE ONE CALL THAT MOVES MONEY ───────────────────────────────
// ⚠ THIS EXISTS BECAUSE THE MONEY PATH HAD NO SEAM AT ALL, AND THAT IS PART OF WHY
// THE UNBOUNDED-AMOUNT DEFECT SURVIVED. Every prior test of this route could only
// observe which ERROR came back, so the one thing worth asserting — the amount
// actually handed to Stripe — was unobservable. Nothing could distinguish "sent the
// approved amount" from "sent whatever the caller asked for".
//
// ⚠ INERT IN PRODUCTION: `_executeStripeTransfer` is the real import until a test
// replaces it, and only `server/test/` ever calls the setter. Same pattern as
// `_setPipelineSyncEmailsForTest` in server/crm/pipelineSync.js.
//
// ⚠ AND IT IS A SAFETY MECHANISM, NOT ONLY A CONVENIENCE. The property
// `server/test/crossTenantCredentialWrites.test.js` states in its own header —
// **no test may ever reach Stripe** — was previously enforced by passing a NEGATIVE
// amount in the request body, so `invalid_amount` threw before dispatch. This commit
// makes the body amount non-authoritative, which RETIRES that mechanism. A stub is
// the honest replacement: it cannot dispatch anything. (The other half of that
// re-derivation is in that file, where the sentinel moved into the ROW.)
let _executeStripeTransfer = executeStripeTransfer;
router._setStripeTransferForTest = (fn) => { _executeStripeTransfer = fn; };
router._resetStripeTransferForTest = () => { _executeStripeTransfer = executeStripeTransfer; };

// ── ⚠ THE MODULE-LEVEL CONTRACTOR LITERAL IS GONE — WAVE 1.1-e ───────────────
// A module-scope constant used to sit on this line holding the PRE-RENAME GHOST
// contractor id, with a comment promising to pull it from the session at
// multi-contractor scale. Production's only contractor row carries the renamed
// id, so all five sites that read the constant resolved to ZERO ROWS, and
// getStripeRow()'s `|| { … 'not_connected' }` fallback turned that into a
// plausible answer: the admin Banking Settings card reported NOT CONNECTED
// against a live, healthy connection (acct_…N98EW, active since 2026-08-02) for
// roughly four weeks. A hardcoded literal that resolves to nothing does not
// fail loudly; it manufactures a measurement.
//
// ⚠ DELETING THE CONSTANT IS LOAD-BEARING, NOT TIDINESS — AND ONE COVERAGE
// ARGUMENT DEPENDS ON IT. Route 2's UPDATE predicate is unreachable from any
// test: stripe.accounts.retrieve() must succeed first, and no test may reach
// Stripe. It is covered BY CONSTRUCTION — with the constant gone, the old
// predicate cannot resolve at all. **Reinstating an "unused" constant here
// would silently remove protection that lives in no test.**
//
// ⚠ AND THE FIX WAS DYNAMIC-ID-FIRST, NOT A RENAME. The old literal was NOT
// swapped for the renamed one. A half-completed rename is what created this
// split-brain in the first place; finishing it the same way would only move the
// next failure.
//
// ⚠ NEITHER THE RETIRED LITERAL NOR THE RETIRED SYMBOL NAME IS WRITTEN
// ANYWHERE ABOVE, AND THAT IS DELIBERATE. Both are swept by
// server/test/stripeContractorResolution.test.js, and the first draft of this
// comment tripped it. The prose was reworded; the sweep was NOT given a
// comments-are-exempt carve-out. A retired symbol quoted in a comment is how it
// gets pasted back into code.

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return Stripe(process.env.STRIPE_SECRET_KEY);
}

// ── helpers ───────────────────────────────────────────────────────────────────

// contractorId is REQUIRED and is never defaulted — modelled on
// getContractorStripeAccountId() in server/utils/stripeTransfer.js, which
// CLAUDE_REGISTRY.md Known Issues 2a instructs this shape for: resolve from the
// session's contractorId, and do not reintroduce getDefaultContractorId().
//
// ⚠ THE `|| { … 'not_connected' }` FALLBACK STAYS, AND IT IS NOW HONEST.
// It was never the bug — it is the correct answer for a contractor who has
// signed up and not finished Stripe Connect, and the admin card needs a shape
// to render. What made it a defect was that the LOOKUP could not find a row it
// should have found, so "not configured" and "wrong tenant id" were the same
// output. With the predicate resolved from the caller, the fallback now means
// only what it says.
async function getStripeRow(contractorId) {
  if (!contractorId) {
    const err = new Error('getStripeRow: contractorId is required');
    await logError({ req: null, contractorId: PLATFORM_TENANT, error: err, source: 'getStripeRow' });
    throw err;
  }
  const r = await pool.query(
    'SELECT stripe_account_id, stripe_connect_status FROM contractor_settings WHERE contractor_id = $1',
    [contractorId]
  );
  return r.rows[0] || { stripe_account_id: null, stripe_connect_status: 'not_connected' };
}

// 🔴 THE WRITE PATH, AND THE ONE THAT HAD TEETH. contractor_settings.contractor_id
// is UNIQUE NOT NULL with NO FOREIGN KEY to contractors, so a row under a
// non-existent contractor is perfectly legal — this INSERT … ON CONFLICT keyed
// to the ghost would have created a PHANTOM row the first time anyone pressed
// "Connect Stripe". That is why the standing "do not press Connect Stripe"
// order existed, and why it lifts with this change.
//
// No fallback here, and there must never be one. A write path that defaults its
// tenant is strictly worse than the defect being fixed.
async function upsertStripeAccount(contractorId, stripeAccountId, status) {
  if (!contractorId) {
    const err = new Error('upsertStripeAccount: contractorId is required');
    await logError({ req: null, contractorId: PLATFORM_TENANT, error: err, source: 'upsertStripeAccount' });
    throw err;
  }
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, stripe_account_id, stripe_connect_status)
     VALUES ($1, $2, $3)
     ON CONFLICT (contractor_id) DO UPDATE
       SET stripe_account_id = $2, stripe_connect_status = $3, updated_at = NOW()`,
    [contractorId, stripeAccountId, status]
  );
}

// ── Route 1: POST /api/admin/stripe/create-account-link ───────────────────────

router.post('/api/admin/stripe/create-account-link', requirePermission('finance_settings.manage'), async (req, res) => {
  // CAPTURE form, not the discard form. All four onboarding routes below used
  // `if (!await verifyAdminSession(req, res)) return;` and threw the session
  // away, which is why a literal was the only contractor id available to them.
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const stripe = getStripeClient();
    const row = await getStripeRow(contractorId);
    let stripeAccountId = row.stripe_account_id;

    if (!stripeAccountId) {
      const account = await retryWithBackoff(
        () => stripe.accounts.create({ type: 'standard' }),
        { retries: 2, shouldRetry: stripeShouldRetry }
      );
      stripeAccountId = account.id;
      await upsertStripeAccount(contractorId, stripeAccountId, 'pending');
    }
    // Status not updated here — confirm-connection (Route 2) is the canonical status updater after onboarding

    const frontendUrl = process.env.FRONTEND_URL || '';
    const accountLink = await retryWithBackoff(
      () => stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${frontendUrl}?admin=true&stripe_connect=refresh`,
        return_url: `${frontendUrl}?admin=true&stripe_connect=success`,
        type: 'account_onboarding',
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    res.json({ url: accountLink.url });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to create Stripe account link' });
  }
});

// ── Route 2: POST /api/admin/stripe/confirm-connection ────────────────────────

router.post('/api/admin/stripe/confirm-connection', requirePermission('finance_settings.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const row = await getStripeRow(contractorId);
    if (!row.stripe_account_id) {
      return res.status(400).json({ error: 'No Stripe account linked' });
    }

    const stripe = getStripeClient();
    const account = await retryWithBackoff(
      () => stripe.accounts.retrieve(row.stripe_account_id),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    const status = (account.charges_enabled && account.payouts_enabled) ? 'active' : 'pending';
    await pool.query(
      `UPDATE contractor_settings SET stripe_connect_status = $1, updated_at = NOW() WHERE contractor_id = $2`,
      [status, contractorId]
    );

    res.json({
      status,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to confirm Stripe connection' });
  }
});

// ── Route 3: GET /api/admin/stripe/connection-status ─────────────────────────

router.get('/api/admin/stripe/connection-status', requirePermission('finance_settings'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const row = await getStripeRow(contractorId);
    const maskedId = row.stripe_account_id
      ? `...${row.stripe_account_id.slice(-6)}`
      : null;
    res.json({
      stripe_account_id_masked: maskedId,
      stripe_connect_status: row.stripe_connect_status || 'not_connected',
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to fetch Stripe connection status' });
  }
});

// ── Route 4: POST /api/admin/stripe/disconnect ────────────────────────────────

router.post('/api/admin/stripe/disconnect', requirePermission('finance_settings.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    // MVP: local-only clear. Stripe Standard accounts require manual deauthorization via Stripe dashboard.
    // ⚠ AN UPDATE, AND IT MUST STAY AN UPDATE. A contractor with no
    // contractor_settings row matches nothing here, and that is correct — never
    // "helpfully" turn this into an upsert, which would manufacture a row on a
    // disconnect.
    await pool.query(
      `UPDATE contractor_settings
         SET stripe_account_id = NULL, stripe_connect_status = 'not_connected', updated_at = NOW()
       WHERE contractor_id = $1`,
      [contractorId]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to disconnect Stripe account' });
  }
});

// ── Route 5: POST /api/admin/stripe/transfer ──────────────────────────────────
// TODO: Danny to remove STRIPE_TEST_ACCOUNT_ID from Railway env vars — no longer used

router.post('/api/admin/stripe/transfer', requirePermission('cashout_approve'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { cashoutRequestId, userId, bonusAmount } = req.body;
  // ⚠ bonusAmount IS NO LONGER REQUIRED, AND THAT IS THE POINT OF THIS COMMIT.
  // It used to be mandatory AND authoritative: the amount Stripe was told to send
  // came straight from the request body and was never compared to anything. It is
  // now ADVISORY ONLY — supplied, it must AGREE with the stored row; omitted, the
  // row simply decides. The 400 below therefore drops it.
  if (!cashoutRequestId || !userId) {
    return res.status(400).json({ error: 'cashoutRequestId and userId are required' });
  }
  try {
    // ── TENANCY, IN THE PREDICATE ─────────────────────────────────────────────
    // All three inputs arrive from req.body and none of them was checked against
    // anything before this. The join also BINDS the payee to the cashout: userId
    // is no longer an independent parameter that happens to be passed alongside
    // cashoutRequestId, which is what the endpoint always meant.
    //
    // ⚠ THIS GATE IS THE CONTROL. DO NOT WEAKEN IT ON THE STRENGTH OF THE READS
    // BELOW IT. Removing it during a guard-proof injection produced a 400
    // no_bank_account rather than a leak, because executeStripeTransfer's own
    // scoped user read happened to catch the cross-tenant id — but that is
    // INCIDENTAL, not designed. The shapes do not match because nothing intended
    // them to, and the coincidence disappears the moment that read changes. The
    // inner scoping is correct on its own terms; it is not a second gate, and
    // this comment exists so nobody records it as one.
    //
    // ⚠ AND IT NOW SELECTS THE AMOUNT AND THE STATUS, WHICH IS THE WHOLE FIX.
    // The gate always read this exact row — the row that holds the approved
    // amount — and then threw it away and trusted req.body instead. Selecting two
    // more columns from a query that was already running is the entire cost of
    // closing an unbounded money path.
    const owned = await pool.query(
      `SELECT cr.amount, cr.status
         FROM cashout_requests cr
         JOIN users u ON u.id = cr.user_id
        WHERE cr.id = $1 AND cr.user_id = $2
          AND cr.contractor_id = $3 AND u.contractor_id = $3`,
      [cashoutRequestId, userId, contractorId]
    );
    if (owned.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Cashout request not found' });
    }

    const approvedAmount = Number(owned.rows[0].amount);

    // ── THE STATE GATE ────────────────────────────────────────────────────────
    // ⚠ THE ROUTE USED TO TRANSFER FOR A CASHOUT IN ANY STATE, INCLUDING 'denied'.
    // Danny's ruling: a transfer happens only for a cashout in 'approved'. The
    // admin panel's own flow was the inverse — it fired the transfer on a PENDING
    // row and recorded the approval afterwards — so AdminCashOuts.jsx is reordered
    // in this same commit to approve first. A stale client that still transfers
    // first now gets this 409 rather than moving money out of order.
    if (owned.rows[0].status !== 'approved') {
      return res.status(409).json({
        error: 'not_approved',
        message: `Cashout is '${owned.rows[0].status}' — approve it before transferring`,
      });
    }

    // ── THE AMOUNT MUST AGREE, AND A DISAGREEMENT IS LOGGED ───────────────────
    // ⚠ COMPARED IN CENTS VIA Math.round, NEVER AS FLOATS. `amount` is NUMERIC, so
    // node-postgres hands back a STRING ('250.00'); a caller sends a JSON number.
    // `'250.00' !== 250` and `0.1 + 0.2 !== 0.3`, so both a string compare and a
    // float compare would reject correct requests. Integer cents is the only
    // comparison that is true for the values this column actually holds.
    //
    // ⚠ AND IT IS LOGGED BECAUSE A MISMATCH IS NEVER A TYPO. The only client that
    // sends this field reads it from the row it is displaying, so a disagreement
    // means the client is stale, the row moved under it, or the request was
    // tampered with. Each of those is worth an alert on a money path.
    if (bonusAmount !== undefined && bonusAmount !== null) {
      const requested = Number(bonusAmount);
      const agrees = Number.isFinite(requested)
        && Math.round(requested * 100) === Math.round(approvedAmount * 100);
      if (!agrees) {
        await logError({
          req,
          contractorId,
          error: new Error(
            `[stripe/transfer] amount_mismatch — cashout ${cashoutRequestId} is approved at ` +
            `${approvedAmount} but the request asked for ${bonusAmount}. Refused; nothing was sent.`
          ),
          source: 'POST /api/admin/stripe/transfer — amount_mismatch',
        });
        return res.status(422).json({
          error: 'amount_mismatch',
          message: 'The requested amount does not match the approved cashout. Nothing was sent.',
        });
      }
    }

    // ── AT MOST ONCE — A COMPARE-AND-SWAP, NOT A READ-THEN-WRITE ──────────────
    // ⚠ THE `AND status = 'approved'` IN THIS UPDATE IS THE IDEMPOTENCY CONTROL,
    // NOT THE CHECK ABOVE IT. The check above is a fast, legible rejection; two
    // concurrent requests can both pass it. Only one can win this UPDATE, because
    // the first flips the row out of 'approved' — so `rowCount === 0` here means
    // "somebody else already claimed it", and that is the reading that makes a
    // double transfer structurally impossible rather than unlikely.
    //
    // ⚠ CLAIM BEFORE TRANSFER, DELIBERATELY, AND THE TRADEOFF IS STATED BECAUSE IT
    // IS A MONEY DECISION. Claiming first means a hard crash between the claim and
    // the transfer leaves a row marked 'paid' that was never sent — recoverable by
    // hand, and visible. Claiming AFTER would let two concurrent callers both send.
    // "At most once" is the ruling, so the failure direction is UNDER-paying.
    // A transfer that fails in a way we can observe releases the claim below.
    const claim = await pool.query(
      `UPDATE cashout_requests SET status = 'paid', paid_at = NOW()
        WHERE id = $1 AND contractor_id = $2 AND status = 'approved'
        RETURNING amount`,
      [cashoutRequestId, contractorId]
    );
    if (claim.rowCount === 0) {
      return res.status(409).json({
        error: 'already_processed',
        message: 'This cashout was already claimed by another transfer. Nothing was sent.',
      });
    }

    // ⚠ THE AMOUNT COMES FROM THE CLAIM'S OWN `RETURNING`, NOT FROM THE READ ABOVE
    // AND NEVER FROM req.body. The read and the claim are two statements, so the
    // row could in principle have been edited between them; the value that goes to
    // Stripe is the one belonging to the row this request actually claimed.
    const amountToSend = Number(claim.rows[0].amount);

    try {
      const result = await _executeStripeTransfer(pool, {
        userId, cashoutRequestId, bonusAmount: amountToSend, contractorId,
      });
      return res.json({ success: true, transferId: result.transferId, amount: amountToSend });
    } catch (transferErr) {
      // ⚠ RELEASE THE CLAIM SO A FAILED TRANSFER CAN BE RETRIED. Scoped
      // `AND status = 'paid'` so this can only ever undo THIS request's own claim
      // and never reopen a cashout somebody else has since settled.
      // ⚠ NOTE WHAT IS NOT DONE HERE: no non-positive-amount check was added to
      // this route. `executeStripeTransfer` already throws 'invalid_amount' for
      // that, and duplicating the decision would give it two homes — which is the
      // shape `server/utils/invoicePaid.js` exists to prevent. The throw arrives
      // here and is released and reported like any other failure.
      try {
        await pool.query(
          `UPDATE cashout_requests SET status = 'approved', paid_at = NULL
            WHERE id = $1 AND contractor_id = $2 AND status = 'paid'`,
          [cashoutRequestId, contractorId]
        );
      } catch (releaseErr) {
        await logError({
          req,
          contractorId,
          error: new Error(
            `[stripe/transfer] cashout ${cashoutRequestId} is marked 'paid' but the transfer ` +
            `FAILED and the claim could not be released: ${releaseErr.message}. Needs a manual check.`
          ),
          source: 'POST /api/admin/stripe/transfer — claim release failed',
        });
      }
      throw transferErr;
    }
  } catch (err) {
    if (err.code === 'no_bank_account') {
      return res.status(400).json({
        error: 'no_bank_account',
        message: 'Referrer has no bank account connected'
      });
    }
    if (err.message === 'no_contractor_stripe_account') {
      return res.status(400).json({
        error: 'no_stripe_account',
        message: 'Contractor Stripe account not connected'
      });
    }
    await logError({ req, error: err });
    return res.status(500).json({ error: 'transfer_failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// REFERRER BANK CONNECTION ROUTES
//
// All four routes below are protected by verifyReferrerSession(), the sanctioned
// verifier — CLOSED 2026-08-28, Wave 1.1-d.
//
// ── THE RECORD OF WHAT WAS HERE, KEPT BECAUSE IT EXPLAINS THE SHAPE ──────────
//
// ⚠ THIS HEADER ONCE SAID "Protected by referrer session auth (same pattern
// as referrer.js)". THAT WAS NOT TRUE, AND IT WAS AN INVERTED RECORD RATHER
// THAN A STALE ONE — it told the next reader a mechanism was in place, so the
// reader who checked would stop checking. Corrected 2026-08-27, Wave 1.1; the
// sentence is true as of the fix below, which is exactly why the history stays.
//
// WHAT THESE FOUR ROUTES USED TO DO. Each hand-rolled its own session lookup
// instead of calling verifyReferrerSession():
//     SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()
// That was a live violation of CLAUDE.md's Never Break These Rules, which names
// verifyReferrerSession() as one of the only authorised ways to protect an
// endpoint and says never to inline a raw token check.
//
// SIX DIFFERENCES, not the three first recorded. All six are now closed, and
// each has an assertion in server/test/referrerStripeInlineAuth.test.js:
//   1. u.deleted_at IS NULL  — a SOFT-DELETED homeowner kept working here.
//      ⚠ TEST-ONLY: production held ZERO soft-deleted users on 2026-08-28, so
//      nothing exercises this in production and the suite is the whole proof.
//   2. s.contractor_id IS NOT NULL — a tenant-less session authenticated.
//   3. applySessionSlide()   — these four silently opted OUT of D7's 30-day
//      sliding window while every other referrer route extended it. A person
//      whose only activity was banking aged out on a schedule nobody chose.
//      Nothing failed; the session just quietly expired early.
//   4. JOIN users — the inline query returned user_id = NULL for a session with
//      no user behind it, and the handlers ran their whole body against it.
//      bank-status answered 200, and disconnect-bank reported SUCCESS.
//   5. The auth error path — a throw in the session lookup landed in the
//      ROUTE's catch, so an authentication outage was reported to the caller as
//      "Failed to fetch bank status".
//   6. logError attribution — that same failure was stamped 'backend' against a
//      banking route, so nothing in ops pointed at auth.
//
// AND NO GUARD SAW ANY OF IT: adminRouteCoverage.test.js filters /api/admin/*
// and these are /api/referrer/*, so they were neither gated, nor allowlisted,
// nor checked. ⚠ THAT GAP IS STILL OPEN — the fix below closes these four, not
// the blind spot that hid them. A companion invariant over /api/referrer/* is
// Wave 1.1-d2. save-bank-account is also a step-up re-auth target.
//
// ⚠ DO NOT "FIX" A FUTURE DIVERGENCE BY COPYING PREDICATES INTO A HANDLER.
// That is what produced these four. Route everything through the verifier.
//
// Sensitive values: never log payment method IDs, bank tokens,
// Financial Connections account IDs, or decrypted values anywhere
// ─────────────────────────────────────────────────────────────

// ── Route 6: POST /api/referrer/stripe/create-financial-connections-session ───

router.post('/api/referrer/stripe/create-financial-connections-session', async (req, res) => {
  try {
    const referrerSession = await verifyReferrerSession(req, res);
    if (!referrerSession) return;
    // contractorId comes off the session descriptor verifyReferrerSession
    // already returns — a destructure, not a second lookup. It stamps the
    // Stripe customer's metadata below.
    const { userId, contractorId } = referrerSession;

    const userResult = await pool.query(
      'SELECT id, full_name, email, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    const stripe = getStripeClient();
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await retryWithBackoff(
        () => stripe.customers.create({
          name: user.full_name,
          email: user.email,
          // ⚠ NOT PURELY FORWARD-LOOKING. Every Stripe customer created before
          // Wave 1.1-e carries the pre-rename ghost id in this metadata field —
          // an id with no contractors row. That is the field anyone would
          // reconcile Stripe records against tenants by. The BACKFILL for those
          // existing customers is filed to the Stripe architecture phase; this
          // line only stops the bleeding.
          metadata: { roofmiles_user_id: String(user.id), contractor_id: contractorId }
        }),
        { retries: 2, shouldRetry: stripeShouldRetry }
      );
      customerId = customer.id;
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
    }

    const session = await retryWithBackoff(
      () => stripe.financialConnections.sessions.create({
        account_holder: { type: 'customer', customer: customerId },
        filters: { countries: ['US'] },
        permissions: ['payment_method', 'balances'],
        return_url: process.env.FRONTEND_URL + '/profile?section=manage-account&stripe_bank=complete'
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to create bank connection session' });
  }
});

// ── Route 7: POST /api/referrer/stripe/save-bank-account ─────────────────────

router.post('/api/referrer/stripe/save-bank-account', async (req, res) => {
  try {
    const referrerSession = await verifyReferrerSession(req, res);
    if (!referrerSession) return;
    const { userId } = referrerSession;

    const { financialConnectionsAccountId } = req.body;
    if (!financialConnectionsAccountId) {
      return res.status(400).json({ error: 'financialConnectionsAccountId is required' });
    }

    const userResult = await pool.query(
      'SELECT stripe_bank_account_token, full_name FROM users WHERE id = $1',
      [userId]
    );
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const userRow = userResult.rows[0];

    const stripe = getStripeClient();
    const paymentMethod = await retryWithBackoff(
      () => stripe.paymentMethods.create({
        type: 'us_bank_account',
        us_bank_account: { financial_connections_account: financialConnectionsAccountId },
        billing_details: { name: userRow.full_name }
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );
    const paymentMethodId = paymentMethod.id;
    const encrypted = encrypt(paymentMethodId);

    await pool.query(
      'UPDATE users SET stripe_bank_account_token = $1 WHERE id = $2',
      [encrypted, userId]
    );

    const bankName = paymentMethod.us_bank_account?.bank_name || null;
    const last4 = paymentMethod.us_bank_account?.last4 || null;

    console.log('[stripe] bank account saved for user', userId); // diagnostic log — intentional

    res.json({ success: true, bankName, last4 });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to save bank account' });
  }
});

// ── Route 8: GET /api/referrer/stripe/bank-status ────────────────────────────

router.get('/api/referrer/stripe/bank-status', async (req, res) => {
  try {
    const referrerSession = await verifyReferrerSession(req, res);
    if (!referrerSession) return;
    const { userId } = referrerSession;

    const result = await pool.query(
      'SELECT stripe_bank_account_token FROM users WHERE id = $1',
      [userId]
    );
    if (!result.rows.length || !result.rows[0].stripe_bank_account_token) {
      return res.json({ connected: false });
    }

    const paymentMethodId = decrypt(result.rows[0].stripe_bank_account_token);
    const stripe = getStripeClient();
    try {
      const pm = await retryWithBackoff(
        () => stripe.paymentMethods.retrieve(paymentMethodId),
        { retries: 2, shouldRetry: stripeShouldRetry }
      );
      const bankName = pm.us_bank_account?.bank_name || null;
      const last4 = pm.us_bank_account?.last4 || null;
      return res.json({ connected: true, bankName, last4 });
    } catch {
      // Graceful degradation — stale/invalid token, do not crash
      return res.json({ connected: false, stale: true });
    }
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to fetch bank status' });
  }
});

// ── Route 9: POST /api/referrer/stripe/disconnect-bank ───────────────────────

router.post('/api/referrer/stripe/disconnect-bank', async (req, res) => {
  try {
    const referrerSession = await verifyReferrerSession(req, res);
    if (!referrerSession) return;
    const { userId } = referrerSession;

    const pendingResult = await pool.query(
      `SELECT COUNT(*) FROM cashout_requests
       WHERE user_id = $1 AND status IN ('pending', 'approved')`,
      [userId]
    );
    if (parseInt(pendingResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'pending_cashouts',
        message: 'Cannot disconnect bank while a cashout is pending'
      });
    }

    // Clear only the bank token — keep stripe_customer_id so it can be reused on reconnect
    await pool.query(
      'UPDATE users SET stripe_bank_account_token = NULL WHERE id = $1',
      [userId]
    );

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to disconnect bank account' });
  }
});

module.exports = router;

// ADDITIVE, AND DELIBERATELY NOT A NAMED-EXPORTS OBJECT — the same pattern and
// the same reason as server/routes/landing.js and server/routes/branding.js.
// server/app.js requires this module and passes the result straight to
// app.use('/', stripeRoutes), so replacing the line above with
// { router, getStripeRow, … } would unmount five admin routes and four referrer
// routes. A router is a function object, so a property hangs off it without
// disturbing what the module exports.
//
// Exposed for test, and it is the ONLY level at which route 1 is testable.
// POST /api/admin/stripe/create-account-link calls getStripeClient() as the
// first statement in its try and reaches stripe.accountLinks.create on every
// success, so its contractor resolution cannot be exercised end-to-end without
// a real network call. server/test/stripeContractorResolution.test.js asserts
// these two directly instead, and records in its header that the route-level
// assertion is ABSENT rather than overlooked.
module.exports.getStripeRow = getStripeRow;
module.exports.upsertStripeAccount = upsertStripeAccount;
