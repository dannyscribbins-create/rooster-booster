const axios = require('axios');
const { pool } = require('../db');
const { refreshTokenIfNeeded } = require('./jobber');
const { logError } = require('../middleware/errorLogger');
const { isInvoicePaid } = require('../utils/invoicePaid');
const { refreshReferrerProgress } = require('../utils/referrerProgress');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry, resendShouldRetry } = require('../utils/retryHelpers');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { sendAdminNotification, resolveNotificationRecipient } = require('../utils/notificationEmail');
const { isEmailSuppressed } = require('../utils/emailSuppression');
const { applyTag } = require('../utils/tags');
const { runAttributionEngine } = require('../utils/attributionEngine');
// ── 7b: THE REFERRAL DOOR BECOMES CAPTURE-THEN-DECIDE, LIKE EVERY OTHER DOOR ──
// ⚠ THESE FOUR REQUIRES ARE WHY classifyPipelineStatus HAD TO STAY IN THIS FILE. attributionDecide
// requires it from here, so this file must NEVER require attributionDecide — that is a cycle. The
// request reader lives in its own module (server/utils/requestFacts.js) for exactly this reason,
// and decideFromFacts is reached through a lazy require inside the function below rather than at
// module load. Same problem, same fix, as server/utils/invoicePaid.js.
const { captureClientFacts } = require('../utils/factCapture');
const { makeRequestReader } = require('../utils/requestFacts');
const { withClientLock } = require('../utils/clientLock');
const { fetchFullClient } = require('../utils/jobberClientFetch');

// test seam — inert in production, never called outside server/test/
let _runAttributionEngine = runAttributionEngine;
function _setAttributionEngineForTest(fn) { _runAttributionEngine = fn; }
function _resetAttributionEngine() { _runAttributionEngine = runAttributionEngine; }

// test seam — inert in production, never called outside server/test/
let _psFetchFullClient = fetchFullClient;
function _setPipelineSyncFetchForTest(fn) { _psFetchFullClient = fn; }
function _resetPipelineSyncFetch() { _psFetchFullClient = fetchFullClient; }

// Reassignables for test email suppression — production always uses the real implementations.
let _sendAdminNotification = sendAdminNotification;
let _psSendEmail = (...args) => resend.emails.send(...args);

// test seam — inert in production, never called outside server/test/
function _setPipelineSyncEmailsForTest({ adminNotification, email } = {}) {
  if (adminNotification !== undefined) _sendAdminNotification = adminNotification;
  if (email !== undefined) _psSendEmail = email;
}
function _resetPipelineSyncEmails() {
  _sendAdminNotification = sendAdminNotification;
  _psSendEmail = (...args) => resend.emails.send(...args);
}

// Reassignables for the Jobber HTTP transport and throttle pacing delay —
// production always uses real axios.post and a real setTimeout-based sleep.
let _axiosPost = (...args) => axios.post(...args);
let _sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// test seam — inert in production, never called outside server/test/
function _setPipelineSyncHttpForTest({ axiosPost, sleep } = {}) {
  if (axiosPost !== undefined) _axiosPost = axiosPost;
  if (sleep !== undefined) _sleep = sleep;
}
function _resetPipelineSyncHttp() {
  _axiosPost = (...args) => axios.post(...args);
  _sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDollars(n) {
  return parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Detects a Jobber GraphQL THROTTLED response — HTTP 200 with data: null and
// errors[].extensions.code === 'THROTTLED'. The graphqlErrors array is attached
// at the throw site in the pagination block. message === 'Throttled' is matched
// as a fallback, mirroring fullJobberImport.js's more defensive check.
const isThrottledError = (err) =>
  Array.isArray(err?.graphqlErrors) &&
  err.graphqlErrors.some(e => e?.extensions?.code === 'THROTTLED' || e?.message === 'Throttled');

// ── THROTTLE PACING ────────────────────────────────────────────────────────────
// Input: throttleStatus { currentlyAvailable, restoreRate } read from Jobber's
// response.data.extensions.cost.throttleStatus (or undefined/malformed), and
// requestedQueryCost from the same response's extensions.cost.requestedQueryCost.
// Output: ms to wait before the next request so the bucket has refilled past the
// admission price, capped at PACE_DELAY_CAP_MS. A missing or malformed
// throttleStatus is non-fatal — logs a warning and proceeds without delay, since a
// guessed delay is worse than an occasional extra throttle retry.
const PACE_DELAY_CAP_MS = 60000;
const PACE_DELAY_BUFFER_MS = 500;

function computeThrottlePaceDelayMs(throttleStatus, requestedQueryCost) {
  const currentlyAvailable = throttleStatus?.currentlyAvailable;
  const restoreRate = throttleStatus?.restoreRate;

  const isValid =
    typeof currentlyAvailable === 'number' && !Number.isNaN(currentlyAvailable) &&
    typeof restoreRate === 'number' && !Number.isNaN(restoreRate) && restoreRate > 0 &&
    typeof requestedQueryCost === 'number' && !Number.isNaN(requestedQueryCost);

  if (!isValid) {
    console.warn('[pipelineSync] Missing or malformed throttleStatus — proceeding without pacing delay');
    return 0;
  }

  if (currentlyAvailable >= requestedQueryCost) return 0;

  const rawDelayMs = Math.ceil(((requestedQueryCost - currentlyAvailable) / restoreRate) * 1000) + PACE_DELAY_BUFFER_MS;

  if (rawDelayMs > PACE_DELAY_CAP_MS) {
    console.warn(`[pipelineSync] Computed pacing delay ${rawDelayMs}ms exceeds cap — clamping to ${PACE_DELAY_CAP_MS}ms`);
    return PACE_DELAY_CAP_MS;
  }

  return rawDelayMs;
}

// ── PIPELINE STATUS CLASSIFIER ────────────────────────────────────────────────
// Input: a single Jobber client object with quotes, jobs, invoices
// Output: 'lead' | 'inspection' | 'not_sold' | 'sold' | 'paid'
function classifyPipelineStatus(client) {
  const quotes = client.quotes?.nodes || [];
  const jobs   = client.jobs?.nodes   || [];

  if (jobs.length === 0 && quotes.length === 0) return 'lead';

  // Check for paid invoice — client reached 'paid' stage
  for (const job of jobs) {
    // ⚠ THE ONE DEFINITION (4a). This read `inv.invoiceStatus === 'paid'` — the status alone —
    // which marked a client as paying on a paid-but-unsettled invoice and on a $0 invoice.
    // isInvoicePaid requires status AND a zero balance AND a total above zero. Every caller's
    // query now selects all three, and server/test/oneDefinitionOfPaid.test.js fails if this
    // comparison is written inline again anywhere.
    const hasPaidInvoice = (job.invoices?.nodes || []).some(isInvoicePaid);
    if (hasPaidInvoice) return 'paid';
  }

  // Job exists but no paid invoice yet
  if (jobs.length > 0) return 'sold';

  // No jobs — check quote activity
  const activeQuotes = quotes.filter(q => q.quoteStatus !== 'archived');
  if (activeQuotes.length > 0) return 'inspection';

  // All quotes archived, no job
  return 'not_sold';
}

// ── REFERRED BY FIELD EXTRACTOR ───────────────────────────────────────────────
// Input: a single Jobber client object
// Output: string value of "Referred by" custom field, or null
function getReferredByValue(client) {
  const fields = client.customFields || [];
  const field  = fields.find(f => f.label && f.label.toLowerCase() === 'referred by');
  if (!field) return null;
  const value = field.valueText?.trim();
  return value || null;
}

/**
 * Captures a referred client's facts and runs the engine from them, inside the per-client lock.
 * Inputs: the contractor, the Jobber client id, the referral anchor, an optional capture-shape
 *         client, and a token used only if one must be fetched.
 * Output: nothing. Throws on a capture failure, which the caller records and swallows.
 *
 * ⚠ THE FETCH IS OUTSIDE THE LOCK AND MUST STAY THERE. Holding a pooled connection across a
 * Jobber round trip is the one thing server/utils/clientLock.js forbids outright: a slow Jobber
 * would exhaust the pool rather than delay one client.
 *
 * ⚠ A FAILED CAPTURE MEANS NO DECISION (Commit 5, rule 2), AND ON THIS DOOR THAT MATTERS MORE
 * THAN ON THE OTHERS. This is the only path whose writeOrphanOnMiss is TRUE, so a decision taken
 * from a partial fact set would not merely be wrong — it would raise an orphan flag and ring the
 * admin bell about a referral that is fine. Throwing here leaves the pipeline_cache row, the
 * notifications and the rest of the sync untouched; the next 30-minute tick retries.
 *
 * ⚠ decideFromFacts IS REQUIRED LAZILY, AND IT IS NOT A STYLE CHOICE. attributionDecide requires
 * classifyPipelineStatus from THIS file, so a top-level require here is a cycle — under which
 * Node hands out a half-initialised module and the symbol is `undefined` at call time, with no
 * error until something invokes it. The lazy require resolves after both modules are loaded.
 */
async function attributeReferredClient({ contractorId, jobberClientId, referralAnchor, captureClient, token }) {
  const { decideFromFacts } = require('../utils/attributionDecide');

  const forCapture = captureClient || await _psFetchFullClient(jobberClientId, token, {
    door: 'pipeline-sync', contractorId,
  });

  await withClientLock(pool, { contractorId, jobberClientId, door: 'pipeline-sync' }, async (tx) => {
    await captureClientFacts(tx, { contractorId, client: forCapture });
    // `tx`, not `pool` — a read on another connection would sit outside the lock and could miss
    // the capture on the line above.
    const decided = await decideFromFacts(tx, { contractorId, jobberClientId });
    await _runAttributionEngine(tx, {
      contractorId,
      jobberClientId,
      // ⚠ FROM THE FACTS, NOT FROM classifyPipelineStatus(client) AS IT WAS BEFORE 7b.
      // ⚠ AND IT CAN NOW DIFFER FROM pipeline_cache.pipeline_status, WHICH IS STILL CLASSIFIED
      // FROM THE LIVE OBJECT A FEW LINES UP. That is deliberate and scoped: pipeline_cache is the
      // REFERRAL display and drives bonus timing, and moving it onto facts is a separate change
      // with its own blast radius. The DECISION is what R5i governs. Same accepted, temporary
      // split Commit 4 recorded for jobber_clients.pipeline_stage, filed with it.
      currentStatus: decided.currentStatus,
      client: decided.client,
      readRequests: makeRequestReader(tx, contractorId),
      referralAnchor,
      // ⚠ NO writeOrphanOnMiss HERE, SO IT DEFAULTS TO TRUE — and that is the referral pipeline's
      // ruling (R3 is scoped to the request path ONLY). A referral resolving to no rep is a money
      // question and an incident. Do not add `false` for symmetry with the other doors.
    });
  });
}

// ── SYNC SINGLE CLIENT ────────────────────────────────────────────────────────
// Input: contractorId string, Jobber client object, referralStartDate Date object
// Upserts a referred client into pipeline_cache.
// Pre-start-date clients: written to pipeline_cache with pre_start_date=true
// and inserted into flagged_referrals if initial_sync is still running.
// Pre-start-date clients never trigger bonus logic (checked upstream by hard gate).
// ⚠ `captureClient` IS THE SIXTH PARAMETER AND IT IS NOT OPTIONAL IN SPIRIT (7b). It is the
// CONNECTION-shape client captureClientFacts requires — quotes/jobs/invoices/requests each with
// `.nodes`, and `client { id }` on the quote and job nodes. A caller that already holds one (both
// client webhooks do: they fetch it immediately above) MUST pass it, or this function pays for a
// second identical Jobber fetch. A caller that does not — runFullSync and runIncrementalSync,
// whose own query cannot produce one — omits it and one is fetched, for referred clients only.
// ⚠ DO NOT PASS THE SYNC'S OWN NODE HERE TO "SAVE A FETCH". It is the wrong shape and capturing
// it corrupts crm_job_facts; the block at the attribution call below says exactly how.
async function syncSingleClient(contractorId, client, referralStartDate, allClients = [], token = null, { captureClient = null } = {}) {
  const referredBy = getReferredByValue(client);
  if (!referredBy) return; // not a referred client — do nothing

  const clientName  = `${client.firstName || ''} ${client.lastName || ''}`.trim();
  const createdAt   = client.createdAt ? new Date(client.createdAt) : null;
  const isPreStart  = !!(referralStartDate && createdAt && createdAt < referralStartDate);
  const status      = classifyPipelineStatus(client);

  // ── PRE-UPSERT STATUS CAPTURE (#1 first-referral, #2/#3/#5/#33 transitions) ──
  // Capture old status before upsert so we can detect transitions afterward.
  // Count existing rows for this referrer to detect first-ever referral.
  let oldPipelineStatus = null;
  let isFirstReferralForReferrer = false;
  try {
    const existingCacheRow = await pool.query(
      `SELECT pipeline_status FROM pipeline_cache WHERE contractor_id=$1 AND jobber_client_id=$2`,
      [contractorId, client.id]
    );
    oldPipelineStatus = existingCacheRow.rows[0]?.pipeline_status || null;

    // Only count when this is a new client row — avoids false positive on re-syncs
    if (!oldPipelineStatus) {
      const referrerRowCount = await pool.query(
        `SELECT COUNT(*) AS cnt FROM pipeline_cache WHERE contractor_id=$1 AND LOWER(referred_by)=LOWER($2)`,
        [contractorId, referredBy]
      );
      isFirstReferralForReferrer = parseInt(referrerRowCount.rows[0]?.cnt || '0') === 0;
    }
  } catch (preCheckErr) {
    await logError({ req: null, error: preCheckErr });
    console.error('[pipelineSync] pre-upsert status check failed:', preCheckErr.message);
  }

  const paidAt = status === 'paid' ? new Date() : null;

  // RETURNING created_at gives us the referral anchor for the attribution engine's grace-window
  // checks (see attributionEngine.js) straight from the row Postgres actually persisted — created_at
  // is excluded from the ON CONFLICT update below, so on a re-sync this returns the ORIGINAL
  // first-seen instant, not "now". Reading it back this way (rather than capturing new Date() in JS
  // beforehand) avoids clock/round-trip drift between the JS timestamp and what's actually stored.
  const upsertResult = await pool.query(
    `INSERT INTO pipeline_cache
       (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
        pre_start_date, jobber_created_at, last_synced_at, updated_at, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8)
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       client_name      = EXCLUDED.client_name,
       referred_by      = EXCLUDED.referred_by,
       pipeline_status  = EXCLUDED.pipeline_status,
       pre_start_date   = EXCLUDED.pre_start_date,
       last_synced_at   = NOW(),
       updated_at       = NOW(),
       paid_at          = CASE
         WHEN EXCLUDED.pipeline_status = 'paid' AND pipeline_cache.pipeline_status != 'paid'
         THEN NOW()
         ELSE pipeline_cache.paid_at
       END
     RETURNING created_at`,
    [contractorId, client.id, clientName, referredBy, status,
     isPreStart, createdAt, paidAt]
  );
  const referralAnchor = upsertResult.rows[0].created_at;

  // ── EARNING LIVES HERE NOW, NOT ON A PAGE VIEW (Danny, 2026-09-29) ─────────
  // ⚠ `users.paid_count` AND THE PIPELINE-DRIVEN BADGES USED TO BE WRITTEN BY
  // `GET /api/pipeline`, so whether a referrer earned anything depended on whether they opened
  // the app. The catalogue already marked those badges `trigger: "pipeline_sync"`; only the code
  // disagreed. This is the fact changing, so this is where the record is written.
  // ⚠ IT IS PLACED AFTER THE UPSERT DELIBERATELY: the counts are read FROM `pipeline_cache`,
  // so it must see the row this sync just wrote rather than the previous state.
  // ⚠ AND IT RUNS ON EVERY SYNC OF A REFERRED CLIENT, not only when a notification fires. The
  // notification block further down is gated on `shouldFireAny`; hanging earning off that would
  // make a badge depend on whether an email happened to be due.
  // ⚠ NON-FATAL BY CONSTRUCTION. A badge is not worth failing a sync over — the next tick
  // recomputes from scratch, because the awarder is idempotent rather than incremental.
  try {
    await refreshReferrerProgress(pool, { contractorId, referredBy });
  } catch (progressErr) {
    await logError({ req: null, error: progressErr, contractorId,
      source: 'pipelineSync — refreshReferrerProgress' });
  }

  // ── APP_USER_ PLACEHOLDER CLEANUP ──────────────────────────────────────────
  // If a peer-signup placeholder row exists for this client (written at signup when
  // no Jobber client ID was known yet), delete it now that the real Jobber row has
  // been upserted. The placeholder keys on app_user_<userId> — a different
  // (contractor_id, jobber_client_id) pair — so both rows coexist without this DELETE.
  // Failure is non-fatal: the real row is already written; cleanup can be retried on
  // the next sync cycle.
  try {
    await pool.query(
      `DELETE FROM pipeline_cache
       WHERE contractor_id = $1
         AND LOWER(client_name) = LOWER($2)
         AND jobber_client_id LIKE 'app_user_%'`,
      [contractorId, clientName]
    );
  } catch (cleanupErr) {
    await logError({ req: null, error: cleanupErr });
    console.error('[pipelineSync] app_user_ placeholder cleanup failed:', cleanupErr.message);
  }

  // ── ATTRIBUTION ENGINE — CAPTURE, THEN DECIDE, UNDER THE LOCK (7b) ───────────
  //
  // ⚠ THIS DOOR WAS ENTIRELY LIVE UNTIL 7b, AND IT WAS THE LAST ONE. Commit 5 moved the webhook
  // and sweep doors onto saved facts and did not touch this one, so the referral pipeline went on
  // passing the LIVE client object, a currentStatus classified from that live object, and
  // fetchAttributionData — three inputs the replay took from stored rows. Same client, same
  // moment, two different answers available depending on which door happened to fire.
  //
  // ⚠ IT COULD NOT SIMPLY BE HANDED THE FACT READER, AND THE REASON IS WORTH THE LINES. This
  // function's `client` comes from two very different places: the client webhooks pass a
  // fetchFullClient result (every connection, paged to exhaustion), while runFullSync and
  // runIncrementalSync pass a node from their own `clients(first: 25)` query — which selects NO
  // requests connection at all, no `client { id }` on quotes, and no top-level invoices. Passing
  // the fact reader without capturing would have read an EMPTY request set for those clients,
  // resolved nobody, and — because this path defaults writeOrphanOnMiss to TRUE, unlike the
  // request path — written an orphan flag and an admin bell for every referred client on every
  // sync. A flood, from a change that reads like a simplification.
  // ⚠ AND CAPTURING THE SYNC'S OWN NODE WOULD HAVE BEEN WORSE THAN USELESS: writeQuoteFacts
  // filters on `n.client?.id` and would have silently dropped every quote, while writeJobFacts
  // filters on `n?.id` alone and would have written job facts with a NULL jobber_client_id —
  // orphaning real rows from decideFromFacts' client-scoped read. A capture that corrupts.
  // So a capture-capable client is FETCHED when the caller did not supply one, and only ever for
  // a REFERRED client: the `if (!referredBy) return` above has already sent everyone else home,
  // so the added Jobber cost is one fetch per referred client per sync, not per client.
  //
  // Fail-safe: an attribution error must never abort the sync or block notifications.
  try {
    if (contractorId) {
      await attributeReferredClient({
        contractorId, jobberClientId: client.id, referralAnchor, captureClient, token,
      });
    }
  } catch (err) {
    logError({ req: null, error: err, source: 'pipelineSync/attribution' });
  }

  // ── #25 NEW REFERRAL ADMIN ALERT (non-blocking) ──────────────────────────────
  // Fires only on first insert of this client — new pipeline_cache row.
  if (!isPreStart && !oldPipelineStatus) {
    (async () => {
      try {
        const safeClientNameA = escapeHtml(clientName);
        const safeReferredByA = escapeHtml(referredBy);
        const adminUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
        const adminEmail25 = await resolveNotificationRecipient(pool, 'general', contractorId);
        const suppressed25 = await isEmailSuppressed(contractorId, adminEmail25, 'new_referral_detected');
        if (!suppressed25) await _sendAdminNotification(
          pool,
          'general',
          `New referral detected — ${safeClientNameA} via ${safeReferredByA}`,
          `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
              <h2 style="color:#012854;margin:0 0 12px;">New referral in your pipeline</h2>
              <p style="color:#444;margin:0 0 24px;line-height:1.6;">A new client, ${safeClientNameA}, was added to Jobber with ${safeReferredByA} listed as the referral source. The referral has been logged in RoofMiles.</p>
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${adminUrl}?admin=true" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View in Admin</a>
              </div>
            </div>
          `
        );
      } catch (e25) {
        await logError({ req: null, error: e25 });
        console.error('[pipelineSync] #25 new referral admin alert failed:', e25.message);
      }
    })();
  }

  // ── PAID CUSTOMER TAG ─────────────────────────────────────────────────────────
  // Non-blocking — fires when a referred client's pipeline_status transitions to paid.
  if (!isPreStart && status === 'paid' && oldPipelineStatus !== 'paid') {
    ;(async () => {
      try {
        const contactRes = await pool.query(
          `SELECT id FROM contacts WHERE contractor_id = $1 AND jobber_client_id = $2 LIMIT 1`,
          [contractorId, client.id]
        );
        if (contactRes.rows.length > 0) {
          await applyTag(pool, contactRes.rows[0].id, contractorId, 'Paid Customer', 'jobber');
        }
      } catch (tagErr) {
        await logError({ req: null, error: tagErr, source: 'pipelineSync — Paid Customer tag' });
      }
    })();
  }

  // ── PIPELINE STAGE NOTIFICATION TRIGGERS (#1, #2, #3, #5, #6, #33) ──────────
  // Skipped for pre-start-date clients. Each trigger is individually caught so
  // a failure in one never blocks the sync or any other trigger.
  if (!isPreStart) {
    const shouldFireAny = (
      isFirstReferralForReferrer ||
      (oldPipelineStatus === 'lead' && status === 'inspection') ||
      (status === 'sold' && oldPipelineStatus !== 'sold' && oldPipelineStatus !== null) ||
      (status === 'not_sold' && oldPipelineStatus !== 'not_sold' && oldPipelineStatus !== null) ||
      (status === 'paid' && oldPipelineStatus !== 'paid') ||
      (oldPipelineStatus === 'not_sold' && ['lead', 'inspection', 'sold'].includes(status))
    );

    if (shouldFireAny) {
      try {
        // Look up referrer's app account, scoped to this contractor (Wave 0.3 F8).
        // ⚠ Unscoped, this asked "does this referrer have an account?" of EVERY
        // tenant — so a name held under another contractor produced a match here and
        // the notification emails below were addressed to that other tenant's user.
        const referrerAccountResult = await pool.query(
          `SELECT id, email, full_name FROM users
            WHERE contractor_id = $2 AND LOWER(full_name)=LOWER($1) AND deleted_at IS NULL
            LIMIT 1`,
          [referredBy, contractorId]
        );
        const referrerAccount = referrerAccountResult.rows[0] || null;

        // Fetch contractor settings once for all sends
        const csResult = await pool.query(
          `SELECT email_sender_name, company_name, company_email, company_phone FROM contractor_settings WHERE contractor_id=$1 LIMIT 1`,
          [contractorId]
        );
        const cs = csResult.rows[0] || {};
        const fromName = escapeHtml(cs.email_sender_name || cs.company_name || 'RoofMiles');
        const companyName = escapeHtml(cs.company_name || 'your contractor');
        const companyEmail = cs.company_email || '';
        const companyPhone = cs.company_phone || '';
        const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
        const safeClientName = escapeHtml(clientName);

        // ── #1 FIRST REFERRAL EMAIL ─────────────────────────────────────────────
        if (isFirstReferralForReferrer && referrerAccount?.email) {
          try {
            const firstName = escapeHtml((referrerAccount.full_name || '').split(' ')[0] || referrerAccount.full_name);
            const contactLine = [companyEmail, companyPhone].filter(Boolean).map(escapeHtml).join(' + ');
            const suppressed1 = await isEmailSuppressed(contractorId, referrerAccount.email, 'first_referral_submitted');
            if (!suppressed1) await retryWithBackoff(
              () => _psSendEmail({
                from: `${fromName} <noreply@roofmiles.com>`,
                to: referrerAccount.email,
                subject: `You're in the game! here's what happens next`,
                html: `
                  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                    <h2 style="color:#012854;margin:0 0 12px;">Your first referral is in. what now?</h2>
                    <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, you just submitted your first referral with ${companyName}. Here's what to expect — we'll reach out to them, schedule an inspection, and keep you updated every step of the way. If the job closes, your reward posts automatically to your balance for you to cash out!${contactLine ? ` If you have any questions reach out to us at ${contactLine}.` : ''}</p>
                    <div style="text-align:center;margin-bottom:24px;">
                      <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">See your pipeline!</a>
                    </div>
                  </div>
                `,
              }),
              { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
            );
          } catch (e1) {
            await logError({ req: null, error: e1 });
            console.error('[pipelineSync] #1 first referral email failed:', e1.message);
          }
        }

        // ── #2 REFERRAL MOVES TO INSPECTION ────────────────────────────────────
        if (oldPipelineStatus === 'lead' && status === 'inspection' && referrerAccount?.email) {
          try {
            const firstName = escapeHtml((referrerAccount.full_name || '').split(' ')[0] || referrerAccount.full_name);
            const suppressed2 = await isEmailSuppressed(contractorId, referrerAccount.email, 'referral_inspection');
            if (!suppressed2) await retryWithBackoff(
              () => _psSendEmail({
                from: `${fromName} <noreply@roofmiles.com>`,
                to: referrerAccount.email,
                subject: `${safeClientName} has an inspection scheduled`,
                html: `
                  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                    <h2 style="color:#012854;margin:0 0 12px;">Your referral is moving forward</h2>
                    <p style="color:#444;margin:0 0 24px;line-height:1.6;">Good news, ${firstName} — ${safeClientName} has scheduled an inspection with ${companyName}. Things are progressing. We'll let you know when there's another update.</p>
                    <div style="text-align:center;margin-bottom:24px;">
                      <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View Your Pipeline</a>
                    </div>
                  </div>
                `,
              }),
              { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
            );
          } catch (e2) {
            await logError({ req: null, error: e2 });
            console.error('[pipelineSync] #2 inspection email failed:', e2.message);
          }
        }

        // ── #3 REFERRAL MOVES TO SOLD ───────────────────────────────────────────
        if (status === 'sold' && oldPipelineStatus !== 'sold' && oldPipelineStatus !== null && referrerAccount?.email) {
          try {
            const firstName = escapeHtml((referrerAccount.full_name || '').split(' ')[0] || referrerAccount.full_name);
            const suppressed3 = await isEmailSuppressed(contractorId, referrerAccount.email, 'referral_sold');
            if (!suppressed3) await retryWithBackoff(
              () => _psSendEmail({
                from: `${fromName} <noreply@roofmiles.com>`,
                to: referrerAccount.email,
                subject: `Great news — ${safeClientName}'s job is underway`,
                html: `
                  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                    <h2 style="color:#012854;margin:0 0 12px;">Your referral is now an active job</h2>
                    <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, your referral ${safeClientName} is now an active job with ${companyName}. You'll earn your bonus once the invoice is paid — we'll notify you the moment it's complete.</p>
                    <div style="text-align:center;margin-bottom:24px;">
                      <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View your pipeline</a>
                    </div>
                  </div>
                `,
              }),
              { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
            );
          } catch (e3) {
            await logError({ req: null, error: e3 });
            console.error('[pipelineSync] #3 sold email failed:', e3.message);
          }
        }

        // ── #5 REFERRAL GOES COLD / LOST ────────────────────────────────────────
        if (status === 'not_sold' && oldPipelineStatus !== 'not_sold' && oldPipelineStatus !== null && referrerAccount?.email) {
          try {
            const firstName = escapeHtml((referrerAccount.full_name || '').split(' ')[0] || referrerAccount.full_name);
            const suppressed5 = await isEmailSuppressed(contractorId, referrerAccount.email, 'referral_lost');
            if (!suppressed5) await retryWithBackoff(
              () => _psSendEmail({
                from: `${fromName} <noreply@roofmiles.com>`,
                to: referrerAccount.email,
                subject: `An update on your referral`,
                html: `
                  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                    <h2 style="color:#012854;margin:0 0 12px;">We weren't able to move forward</h2>
                    <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, we wanted to keep you in the loop — we weren't able to move forward with ${safeClientName} at this time. It happens once in a while, and we truly appreciate you thinking to send someone on our way. That said, our mission is to serve our clients and provide the best contractor experience they've ever had, and don't let that stop you from referring others! Your next referral reward is right around the corner.</p>
                    <div style="text-align:center;margin-bottom:24px;">
                      <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View Your Pipeline</a>
                    </div>
                  </div>
                `,
              }),
              { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
            );
          } catch (e5) {
            await logError({ req: null, error: e5 });
            console.error('[pipelineSync] #5 not_sold email failed:', e5.message);
          }
        }

        // ── #6 DORMANT REFERRAL REACTIVATED ──────────────────────────────────────
        if (oldPipelineStatus === 'not_sold' && ['lead', 'inspection', 'sold'].includes(status) && referrerAccount?.email) {
          try {
            const firstName = escapeHtml((referrerAccount.full_name || '').split(' ')[0] || referrerAccount.full_name);
            const suppressed6 = await isEmailSuppressed(contractorId, referrerAccount.email, 'referral_reactivated');
            if (!suppressed6) await retryWithBackoff(
              () => _psSendEmail({
                from: `${fromName} <noreply@roofmiles.com>`,
                to: referrerAccount.email,
                subject: `${safeClientName} is back — your referral just moved forward`,
                html: `
                  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                    <h2 style="color:#012854;margin:0 0 12px;">A referral you sent us a while back just reached out again.</h2>
                    <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, remember ${safeClientName}? Things went quiet for a while, but they've re-engaged with ${companyName} and are moving forward again. Your referral credit is still attached — we'll keep you posted.</p>
                    <div style="text-align:center;margin-bottom:24px;">
                      <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View Your Pipeline</a>
                    </div>
                  </div>
                `,
              }),
              { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
            );
          } catch (e6) {
            await logError({ req: null, error: e6 });
            console.error('[pipelineSync] #6 reactivation email failed:', e6.message);
          }
        }

        // ── #33 PENDING REWARD EMAIL ─────────────────────────────────────────────
        // Fires when the referrer has no app account and their referred client just reached paid.
        if (status === 'paid' && oldPipelineStatus !== 'paid' && !referrerAccount) {
          try {
            const { sendPendingRewardEmail } = require('../utils/pendingReferral');

            // Find pending referral record for this client
            const pendingResult = await pool.query(
              `SELECT referred_by_email, referred_by_name FROM pending_referrals
               WHERE contractor_id=$1 AND jobber_client_id=$2 AND status='pending'
               LIMIT 1`,
              [contractorId, client.id]
            );
            const pendingRow = pendingResult.rows[0];

            if (pendingRow?.referred_by_email) {
              const suppressed33 = await isEmailSuppressed(contractorId, pendingRow.referred_by_email, 'reward_earned_no_account');
              if (!suppressed33) {
              // Calculate bonus amount: count paid pipeline rows for this referrer, apply escalating schedule
              const paidCountResult = await pool.query(
                `SELECT COUNT(*) AS cnt FROM pipeline_cache
                 WHERE contractor_id=$1 AND LOWER(referred_by)=LOWER($2) AND pipeline_status='paid'`,
                [contractorId, referredBy]
              );
              const paidCountForReferrer = parseInt(paidCountResult.rows[0]?.cnt || '1');

              const scheduleResult = await pool.query(
                `SELECT escalating_steps, flat_amount FROM referral_schedules
                 WHERE contractor_id=$1 AND is_active=true AND payout_model='escalating' LIMIT 1`,
                [contractorId]
              );
              let bonusAmount = 500; // fallback
              if (scheduleResult.rows[0]?.escalating_steps) {
                const steps = scheduleResult.rows[0].escalating_steps;
                const matched = steps.find(s => s.referral_number === paidCountForReferrer) || steps[steps.length - 1];
                if (matched?.payout_amount) bonusAmount = matched.payout_amount;
              } else if (scheduleResult.rows[0]?.flat_amount) {
                bonusAmount = scheduleResult.rows[0].flat_amount;
              }

              await sendPendingRewardEmail(
                pendingRow.referred_by_email,
                pendingRow.referred_by_name,
                clientName,
                bonusAmount,
                contractorId
              );
              } // end if (!suppressed33)
            }
          } catch (e33) {
            await logError({ req: null, error: e33 });
            console.error('[pipelineSync] #33 pending reward email failed:', e33.message);
          }
        }

      } catch (notifErr) {
        await logError({ req: null, error: notifErr });
        console.error('[pipelineSync] notification trigger block failed:', notifErr.message);
      }
    }
  }

  // ── PENDING REFERRAL CHECK ──────────────────────────────────────────────────
  // If this referred client's referrer has no app account, create a pending record
  // and fire an auto-invite. Runs async — must not block or throw inside syncSingleClient.
  // SCALABLE: This check runs on every sync. At high contractor volume, consider
  // batching or caching the user lookup. For MVP with single contractor, this is fine.
  try {
    const { checkAndCreatePendingReferral } = require('../utils/pendingReferral');
    await checkAndCreatePendingReferral(contractorId, client, referredBy, allClients);
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pipelineSync] pending referral check failed:', err.message);
  }

  // Flag pre-start-date clients for admin review only during initial sync
  if (isPreStart) {
    const syncResult = await pool.query(
      'SELECT initial_sync_complete FROM sync_state WHERE contractor_id = $1',
      [contractorId]
    );
    const syncComplete = syncResult.rows[0]?.initial_sync_complete ?? false;
    if (!syncComplete) {
      await pool.query(
        `INSERT INTO flagged_referrals
           (contractor_id, jobber_client_id, client_name, referred_by,
            pipeline_status, flag_reason)
         VALUES ($1, $2, $3, $4, $5, 'pre_start_date')
         ON CONFLICT (contractor_id, jobber_client_id) DO NOTHING`,
        [contractorId, client.id, clientName, referredBy, status]
      );
    }
  }

  // ── BOOKING REQUEST MATCH ───────────────────────────────────────────────────
  // When a Jobber client appears whose name matches a pending booking_request referral,
  // mark the request matched so it no longer surfaces as booking_pending in the pipeline.
  // MVP: name-only match — bulk sync omits phones/emails (CLAUDE.md constraint) so
  // full phone/email confirmation via fetchReferrerContact is deferred.
  try {
    await pool.query(
      `UPDATE booking_requests br
       SET status = 'matched', jobber_client_id = $1, matched_at = NOW(), updated_at = NOW()
       FROM users u
       WHERE u.id = br.submitted_by_user_id
         AND LOWER(u.full_name) = LOWER($2)
         AND br.status = 'pending'
         AND br.contractor_id = $3`,
      [client.id, clientName, contractorId]
    );
  } catch (brMatchErr) {
    await logError({ req: null, error: brMatchErr });
    console.error('[pipelineSync] booking request match check failed:', brMatchErr.message);
  }
}

// ── FULL SYNC ─────────────────────────────────────────────────────────────────
// Fetches ALL clients from Jobber since referral_start_date using cursor-based
// pagination. Processes every client through syncSingleClient.
// Hard guard: if referral_start_date is not set, logs a warning and aborts.
async function runFullSync(contractorId) {
  console.log(`[pipelineSync] Starting full sync for contractor: ${contractorId}`);

  // Load CRM settings — referral_start_date is required
  const settingsResult = await pool.query(
    'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
    [contractorId]
  );
  if (settingsResult.rows.length === 0 || !settingsResult.rows[0].referral_start_date) {
    console.warn(`[pipelineSync] Full sync aborted: referral_start_date not set for contractor: ${contractorId}`);
    return;
  }
  const referralStartDate = new Date(settingsResult.rows[0].referral_start_date);
  const startDateISO      = referralStartDate.toISOString();

  // Refresh OAuth token if expiring soon, then fetch the (potentially updated) token
  await refreshTokenIfNeeded(contractorId);
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
    console.warn(`[pipelineSync] Full sync aborted: no access token for contractor: ${contractorId}`);
    return;
  }
  const token = tokenResult.rows[0].access_token;

  // Paginate through all Jobber clients created since referral_start_date
  // MVP: allClients array accumulates all pages before processing. At FORA scale with
  // tens of thousands of clients per contractor, process each page immediately in the
  // while loop rather than collecting all into memory. The schema and sync_state update
  // at the bottom would remain the same.
  let allClients  = [];
  let cursor      = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const afterArg = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      clients(first: 25${afterArg}, filter: { createdAt: { after: "${startDateISO}" } }) {
        nodes {
          id firstName lastName createdAt
          customFields { ... on CustomFieldText { label valueText } }
          quotes(first: 10) { nodes { id quoteStatus lastTransitioned { approvedAt } salesperson { id } } }
          jobs(first: 10) {
            nodes {
              id jobStatus
              invoices(first: 5) { nodes { invoiceStatus amounts { total invoiceBalance } } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const response = await retryWithBackoff(
      () => _axiosPost(
        'https://api.getjobber.com/api/graphql',
        { query },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-05-12',
          },
        }
      ),
      { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );

    if (!response.data.data || !response.data.data.clients) {
      console.error('[pipelineSync] Jobber returned no clients data:', JSON.stringify(response.data));
      const err = new Error('Jobber GraphQL returned no clients data during full sync');
      err.graphqlErrors = response.data.errors || [];
      throw err;
    }
    if (response.data.errors?.length) {
      console.warn('[pipelineSync] Jobber returned partial errors during full sync:', JSON.stringify(response.data.errors));
    }

    const { nodes, pageInfo } = response.data.data.clients;
    allClients  = allClients.concat(nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor      = pageInfo.endCursor;
  }

  console.log(`[pipelineSync] Full sync fetched ${allClients.length} clients from Jobber`);

  // Process every client
  let referredCount = 0;
  for (const client of allClients) {
    const referredBy = getReferredByValue(client);
    if (referredBy) referredCount++;
    await syncSingleClient(contractorId, client, referralStartDate, allClients, token);
  }

  // Mark initial sync complete
  await pool.query(
    `INSERT INTO sync_state (contractor_id, last_synced_at, initial_sync_complete, updated_at)
     VALUES ($1, NOW(), true, NOW())
     ON CONFLICT (contractor_id) DO UPDATE SET
       last_synced_at        = NOW(),
       initial_sync_complete = true,
       updated_at            = NOW()`,
    [contractorId]
  );

  console.log(`[pipelineSync] Full sync complete for ${contractorId}: ${allClients.length} total clients, ${referredCount} referred`);
}

// ── INCREMENTAL SYNC ──────────────────────────────────────────────────────────
// Fetches only clients updated since last_synced_at. Falls back to runFullSync
// if no sync_state record exists or initial_sync_complete is false.
async function runIncrementalSync(contractorId) {
  const syncResult = await pool.query(
    'SELECT last_synced_at, initial_sync_complete FROM sync_state WHERE contractor_id = $1',
    [contractorId]
  );

  if (syncResult.rows.length === 0 || !syncResult.rows[0].initial_sync_complete) {
    console.log(`[pipelineSync] No completed sync found for ${contractorId} — running full sync`);
    return runFullSync(contractorId);
  }

  const lastSyncedAt = new Date(syncResult.rows[0].last_synced_at);

  console.log(`[pipelineSync] Starting incremental sync for ${contractorId} since ${lastSyncedAt.toISOString()}`);

  // Load referral_start_date for pre-start-date check
  const settingsResult = await pool.query(
    'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
    [contractorId]
  );
  const referralStartDate = settingsResult.rows[0]?.referral_start_date
    ? new Date(settingsResult.rows[0].referral_start_date)
    : null;

  // Refresh OAuth token if expiring soon, then fetch the (potentially updated) token
  await refreshTokenIfNeeded(contractorId);
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
    console.warn(`[pipelineSync] Incremental sync aborted: no access token for ${contractorId}`);
    return;
  }
  const token = tokenResult.rows[0].access_token;

  // Chunked incremental sync — processes bounded time windows and persists the
  // checkpoint after each successful chunk, so a throttle or failure never causes
  // data loss or a permanently frozen checkpoint.
  const CHUNK_DEFAULT_MS     = 24 * 60 * 60 * 1000; // 24h starting window
  const CHUNK_MIN_MS         = 30 * 60 * 1000;       // 30 min floor
  const MAX_CHUNKS_PER_CYCLE = 30;                   // safety cap (~30 days at 24h/chunk)
  // Fallback admission price when no response has yet reported extensions.cost —
  // last calibrated against the production query shape (customFields + quotes:10 +
  // jobs:10 + invoices:5) via live GraphiQL. Calibrated against API default version
  // 2025-04-16, not the pinned 2026-05-12 — treat as provisional pending a re-run
  // against the pinned version. See CLAUDE_REGISTRY.md.
  const CONSERVATIVE_REQUESTED_COST = 8055;

  let chunkStart  = lastSyncedAt;
  let chunkSizeMs = CHUNK_DEFAULT_MS;
  let chunksDone  = 0;
  const now       = new Date();

  // Most recently observed extensions.cost from any page response in this sync run —
  // used to pace the next request when the next response's own cost isn't known yet
  // (i.e. before the first page of a new chunk).
  let lastKnownCost = null;
  let throttleRetriesForWindow = 0;

  while (chunkStart < now && chunksDone < MAX_CHUNKS_PER_CYCLE) {
    const chunkEnd  = new Date(Math.min(chunkStart.getTime() + chunkSizeMs, now.getTime()));
    const afterISO  = chunkStart.toISOString();
    const beforeISO = chunkEnd.toISOString();

    try {
      // Paginate through all clients updated within this chunk window.
      // MVP: same in-memory accumulation as runFullSync — see comment there for scale path.
      let allClients  = [];
      let cursor      = null;
      let hasNextPage = true;

      while (hasNextPage) {
        const afterArg = cursor ? `, after: "${cursor}"` : '';
        const query = `{
          clients(first: 25${afterArg}, filter: { updatedAt: { after: "${afterISO}", before: "${beforeISO}" } }) {
            nodes {
              id firstName lastName createdAt
              customFields { ... on CustomFieldText { label valueText } }
              quotes(first: 10) { nodes { id quoteStatus lastTransitioned { approvedAt } salesperson { id } } }
              jobs(first: 10) {
                nodes {
                  id jobStatus
                  invoices(first: 5) { nodes { invoiceStatus amounts { total invoiceBalance } } }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }`;

        const response = await retryWithBackoff(
          () => _axiosPost(
            'https://api.getjobber.com/api/graphql',
            { query },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-JOBBER-GRAPHQL-VERSION': '2026-05-12',
              },
            }
          ),
          { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
        );

        if (!response.data.data || !response.data.data.clients) {
          const err = new Error('Jobber GraphQL returned no clients data during incremental sync');
          err.graphqlErrors = response.data.errors || [];
          err.throttleCost = response.data.extensions?.cost || null;
          throw err;
        }
        if (response.data.errors?.length) {
          console.warn('[pipelineSync] Jobber returned partial errors during incremental sync:', JSON.stringify(response.data.errors));
        }

        if (response.data.extensions?.cost) {
          lastKnownCost = response.data.extensions.cost;
        }

        const { nodes, pageInfo } = response.data.data.clients;
        allClients  = allClients.concat(nodes);
        hasNextPage = pageInfo.hasNextPage;
        cursor      = pageInfo.endCursor;

        // Proactive pacing — before firing the next page in this chunk, wait for the
        // bucket to refill past the admission price if the last response reported it short.
        if (hasNextPage) {
          const paceDelayMs = computeThrottlePaceDelayMs(
            lastKnownCost?.throttleStatus,
            lastKnownCost?.requestedQueryCost ?? CONSERVATIVE_REQUESTED_COST
          );
          if (paceDelayMs > 0) await _sleep(paceDelayMs);
        }
      }

      for (const client of allClients) {
        await syncSingleClient(contractorId, client, referralStartDate, allClients, token);
      }

      await pool.query(
        `UPDATE sync_state SET last_synced_at = $2, updated_at = NOW()
         WHERE contractor_id = $1`,
        [contractorId, beforeISO]
      );

      console.log(`[pipelineSync] Incremental chunk synced for ${contractorId}: ${afterISO} -> ${beforeISO} (${allClients.length} clients)`);

      chunkStart  = chunkEnd;
      chunkSizeMs = CHUNK_DEFAULT_MS;
      chunksDone++;
      throttleRetriesForWindow = 0;

    } catch (err) {
      if (!isThrottledError(err)) throw err;

      throttleRetriesForWindow++;
      const costForDelay = err.throttleCost || lastKnownCost;
      const paceDelayMs = computeThrottlePaceDelayMs(
        costForDelay?.throttleStatus,
        costForDelay?.requestedQueryCost ?? CONSERVATIVE_REQUESTED_COST
      );
      if (paceDelayMs > 0) await _sleep(paceDelayMs);

      if (throttleRetriesForWindow === 1) {
        console.warn(`[pipelineSync] Chunk throttled for ${contractorId}, paced ${paceDelayMs}ms and retrying same window from ${afterISO}`);
        continue;
      }

      if (chunkSizeMs > CHUNK_MIN_MS) {
        chunkSizeMs = Math.max(Math.floor(chunkSizeMs / 2), CHUNK_MIN_MS);
        throttleRetriesForWindow = 0;
        console.warn(`[pipelineSync] Chunk throttled again for ${contractorId}, shrinking window to ${chunkSizeMs / 60000}min and retrying from ${afterISO}`);
        continue;
      }

      throw err;
    }
  }

  if (chunkStart < now) {
    console.log(`[pipelineSync] Incremental sync for ${contractorId} hit max chunks per cycle (${MAX_CHUNKS_PER_CYCLE}), still ${Math.round((now - chunkStart) / 3600000)}h behind — will resume next cycle`);
  } else {
    console.log(`[pipelineSync] Incremental sync for ${contractorId} fully caught up`);
  }
}

// D4 (CRM_TOKEN_FIX_SPEC.md v1.0): contractors eligible for the scheduled sync — must be
// active AND hold a non-null token. Extracted so the discovery contract is directly
// testable without driving all of runScheduledSync's per-contractor side effects.
function getScheduledSyncDiscoveryRows() {
  return pool.query(
    `SELECT DISTINCT t.contractor_id
     FROM tokens t
     JOIN contractors c ON c.id = t.contractor_id
     WHERE t.access_token IS NOT NULL AND c.status = 'active'`
  );
}

// ── SCHEDULED SYNC RUNNER ────────────────────────────────────────────────────
// Called by server.js on a 30-minute interval.
// Queries all contractors with valid tokens and runs runIncrementalSync for each.
// Per-contractor errors are isolated — one failure never stops the others.
async function runScheduledSync() {
  console.log('[scheduler] Starting scheduled incremental sync cycle');
  try {
    const result = await getScheduledSyncDiscoveryRows();
    if (result.rows.length === 0) {
      console.log('[scheduler] No contractors with tokens — skipping cycle');
      return;
    }
    for (const row of result.rows) {
      try {
        await runIncrementalSync(row.contractor_id);
      } catch (err) {
        await logError({ req: null, error: err });
        console.error(`[scheduler] Sync failed for contractor ${row.contractor_id}:`, err.message);
      }
    }
    console.log('[scheduler] Sync cycle complete');
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[scheduler] Failed to query contractor list:', err.message);
  }
}

module.exports = { classifyPipelineStatus, getReferredByValue, syncSingleClient, runFullSync, runIncrementalSync, runScheduledSync, getScheduledSyncDiscoveryRows, isThrottledError, computeThrottlePaceDelayMs, _setAttributionEngineForTest, _resetAttributionEngine, _setPipelineSyncEmailsForTest, _resetPipelineSyncEmails, _setPipelineSyncHttpForTest, _resetPipelineSyncHttp, _setPipelineSyncFetchForTest, _resetPipelineSyncFetch };
