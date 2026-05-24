const axios = require('axios');
const { pool } = require('../db');
const { refreshTokenIfNeeded } = require('./jobber');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry, resendShouldRetry } = require('../utils/retryHelpers');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { sendAdminNotification, resolveNotificationRecipient } = require('../utils/notificationEmail');
const { isEmailSuppressed } = require('../utils/emailSuppression');
const { applyTag } = require('../utils/tags');

function escapeHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDollars(n) {
  return parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    const hasPaidInvoice = (job.invoices?.nodes || []).some(
      inv => inv.invoiceStatus === 'paid'
    );
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

// ── SYNC SINGLE CLIENT ────────────────────────────────────────────────────────
// Input: contractorId string, Jobber client object, referralStartDate Date object
// Upserts a referred client into pipeline_cache.
// Pre-start-date clients: written to pipeline_cache with pre_start_date=true
// and inserted into flagged_referrals if initial_sync is still running.
// Pre-start-date clients never trigger bonus logic (checked upstream by hard gate).
async function syncSingleClient(contractorId, client, referralStartDate, allClients = []) {
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

  await pool.query(
    `INSERT INTO pipeline_cache
       (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
        pre_start_date, jobber_created_at, last_synced_at, updated_at, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(),
       CASE WHEN $5 = 'paid' THEN NOW() ELSE NULL END)
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
       END`,
    [contractorId, client.id, clientName, referredBy, status,
     isPreStart, createdAt]
  );

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

  // ── #25 NEW REFERRAL ADMIN ALERT (non-blocking) ──────────────────────────────
  // Fires only on first insert of this client — new pipeline_cache row.
  if (!isPreStart && !oldPipelineStatus) {
    (async () => {
      try {
        const safeClientNameA = escapeHtml(clientName);
        const safeReferredByA = escapeHtml(referredBy);
        const adminUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
        const adminEmail25 = await resolveNotificationRecipient(pool, 'general');
        const suppressed25 = await isEmailSuppressed(contractorId, adminEmail25, 'new_referral_detected');
        if (!suppressed25) await sendAdminNotification(
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
        // Look up referrer's app account
        const referrerAccountResult = await pool.query(
          `SELECT id, email, full_name FROM users WHERE LOWER(full_name)=LOWER($1) AND deleted_at IS NULL LIMIT 1`,
          [referredBy]
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
              () => resend.emails.send({
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
              () => resend.emails.send({
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
              () => resend.emails.send({
                from: `${fromName} <noreply@roofmiles.com>`,
                to: referrerAccount.email,
                subject: `${safeClientName} just signed — reward incoming`,
                html: `
                  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                    <h2 style="color:#012854;margin:0 0 12px;">Your referral closed</h2>
                    <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, ${safeClientName} signed with ${companyName}. Once their project is invoiced and paid, your reward will post to your balance automatically. Feel free to check with them and ask how their experience has been so far and start thinking about how you want to spend your first referral bonus!</p>
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
              () => resend.emails.send({
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
              () => resend.emails.send({
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
  await refreshTokenIfNeeded();
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
      clients(first: 50${afterArg}, filter: { createdAt: { after: "${startDateISO}" } }) {
        nodes {
          id firstName lastName createdAt
          customFields { ... on CustomFieldText { label valueText } }
          quotes(first: 10) { nodes { id quoteStatus } }
          jobs(first: 10) {
            nodes {
              id jobStatus
              invoices(first: 5) { nodes { invoiceStatus } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const response = await retryWithBackoff(
      () => axios.post(
        'https://api.getjobber.com/api/graphql',
        { query },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
          },
        }
      ),
      { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );

    if (!response.data.data || !response.data.data.clients) {
      console.error('[pipelineSync] Jobber returned no clients data:', JSON.stringify(response.data));
      throw new Error('Jobber GraphQL returned no clients data during full sync');
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
    await syncSingleClient(contractorId, client, referralStartDate, allClients);
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
  const lastSyncISO  = lastSyncedAt.toISOString();

  console.log(`[pipelineSync] Starting incremental sync for ${contractorId} since ${lastSyncISO}`);

  // Load referral_start_date for pre-start-date check
  const settingsResult = await pool.query(
    'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
    [contractorId]
  );
  const referralStartDate = settingsResult.rows[0]?.referral_start_date
    ? new Date(settingsResult.rows[0].referral_start_date)
    : null;

  // Refresh OAuth token if expiring soon, then fetch the (potentially updated) token
  await refreshTokenIfNeeded();
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
    console.warn(`[pipelineSync] Incremental sync aborted: no access token for ${contractorId}`);
    return;
  }
  const token = tokenResult.rows[0].access_token;

  // Paginate — filter by updatedAt since last sync
  // MVP: same in-memory accumulation as runFullSync — see comment there for scale path.
  let allClients  = [];
  let cursor      = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const afterArg = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      clients(first: 50${afterArg}, filter: { updatedAt: { after: "${lastSyncISO}" } }) {
        nodes {
          id firstName lastName createdAt
          customFields { ... on CustomFieldText { label valueText } }
          quotes(first: 10) { nodes { id quoteStatus } }
          jobs(first: 10) {
            nodes {
              id jobStatus
              invoices(first: 5) { nodes { invoiceStatus } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const response = await retryWithBackoff(
      () => axios.post(
        'https://api.getjobber.com/api/graphql',
        { query },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
          },
        }
      ),
      { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );

    if (!response.data.data || !response.data.data.clients) {
      console.error('[pipelineSync] Jobber returned no clients data during incremental sync:', JSON.stringify(response.data));
      throw new Error('Jobber GraphQL returned no clients data during incremental sync');
    }
    if (response.data.errors?.length) {
      console.warn('[pipelineSync] Jobber returned partial errors during incremental sync:', JSON.stringify(response.data.errors));
    }

    const { nodes, pageInfo } = response.data.data.clients;
    allClients  = allClients.concat(nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor      = pageInfo.endCursor;
  }

  console.log(`[pipelineSync] Incremental sync fetched ${allClients.length} updated clients`);

  for (const client of allClients) {
    await syncSingleClient(contractorId, client, referralStartDate, allClients);
  }

  await pool.query(
    `UPDATE sync_state SET last_synced_at = NOW(), updated_at = NOW()
     WHERE contractor_id = $1`,
    [contractorId]
  );

  console.log(`[pipelineSync] Incremental sync complete for ${contractorId}`);
}

// ── SCHEDULED SYNC RUNNER ────────────────────────────────────────────────────
// Called by server.js on a 30-minute interval.
// Queries all contractors with valid tokens and runs runIncrementalSync for each.
// Per-contractor errors are isolated — one failure never stops the others.
async function runScheduledSync() {
  console.log('[scheduler] Starting scheduled incremental sync cycle');
  try {
    const result = await pool.query(
      'SELECT DISTINCT contractor_id FROM tokens WHERE access_token IS NOT NULL'
    );
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

module.exports = { classifyPipelineStatus, getReferredByValue, syncSingleClient, runFullSync, runIncrementalSync, runScheduledSync };
